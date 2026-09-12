import { createHash, randomUUID } from "node:crypto";
import { allocateCanonicalReference } from "../commercialIdentity/referenceAllocator.js";
import { CURRENT_APP_USER } from "../../currentUser.js";
import { createResponsibilityService } from "./responsibilityService.js";
import { addBusinessMinutes, businessMinutesBetween, normalizeServicePolicy } from "./serviceLevelCalculator.js";
import { DEFAULT_PORTAL_TENANT_ID } from "../clientPortal/portalSecurityService.js";

const clean = (value) => String(value ?? "").trim();
const parse = (value, fallback) => { try { return JSON.parse(value || "") ?? fallback; } catch { return fallback; } };
const fail = (message, status = 422, code = "service_case_invalid") => Object.assign(new Error(message), { status, code });
const allowedStatus = new Set(["new", "under_review", "awaiting", "resolved", "closed"]);
const allowedPriority = new Set(["low", "normal", "high", "urgent"]);
const allowedWaiting = new Set(["none", "customer", "supplier", "internal"]);
const allowedWarranty = new Set(["not_assessed", "potentially_covered", "evidence_required", "outside_supplier_terms", "staff_confirmed"]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function mapTimer(row, at = new Date()) {
  const derivedState = !row.completed_at && row.state !== "paused" && new Date(row.due_at) < at ? "breached" : row.state;
  return { id: row.id, cycle: Number(row.cycle), targetKey: row.target_key, targetMinutes: Number(row.target_minutes), startedAt: row.started_at, dueAt: row.due_at, pausedAt: row.paused_at || null, accumulatedPauseMinutes: Number(row.accumulated_pause_minutes), completedAt: row.completed_at || null, state: derivedState };
}
function mapCase(row, timers = [], events = [], attachments = []) {
  const policy = parse(row.policy_snapshot_json, null);
  return {
    id: row.id, tenantId: row.tenant_id, reference: row.service_ref, clientId: row.client_id, clientReference: row.client_ref || null,
    clientName: row.client_name || null, projectId: row.project_id || null, projectName: row.project_name || null, orderId: row.order_id || null,
    orderReference: row.order_ref || null, positionIds: parse(row.position_ids_json, []), caseType: row.case_type, issueSummary: row.issue_summary,
    description: row.description, reportedAt: row.reported_at, firstNoticedAt: row.first_noticed_at || null, status: row.status, priority: row.priority,
    waitingOn: row.waiting_on, teamId: row.team_id || null, teamName: row.team_name || null, assigneeId: row.assignee_id || null,
    assigneeName: row.assignee_name || null, nextAction: row.next_action, nextActionDueAt: row.next_action_due_at || null,
    warrantyState: row.warranty_state, warrantyAssessment: parse(row.warranty_assessment_json, {}), resolution: row.resolution,
    policy: policy ? { id: row.policy_id, version: Number(row.policy_version), ...policy } : null,
    customerExpectation: policy?.publicationState === "approved_customer" ? policy.customerExpectation || "An approved service policy applies. The next promised update is shown below." : null,
    timers: timers.map((timer) => mapTimer(timer)), events, attachments,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at || null, closedAt: row.closed_at || null
  };
}

export function createServiceCaseService(db, { id = randomUUID, clock = () => new Date(), tenantId = DEFAULT_PORTAL_TENANT_ID } = {}) {
  const responsibilities = createResponsibilityService(db, { id, clock });
  const now = () => clock().toISOString();

  async function servicePrefix() {
    const configured = await db.get("SELECT value FROM settings WHERE key='references.servicePrefix'");
    const parsed = parse(configured?.value, {}), explicit = clean(parsed?.value);
    if (explicit) return explicit.toUpperCase();
    const client = await db.get("SELECT value FROM settings WHERE key='references.clientPrefix'");
    const clientPrefix = clean(parse(client?.value, {})?.value);
    const workspacePrefix = clientPrefix.replace(/-CL$/i, "");
    if (!workspacePrefix) throw fail("Configure the Service reference prefix in Administration before registering a case.", 409, "service_reference_prefix_missing");
    return `${workspacePrefix.toUpperCase()}-SER`;
  }

  async function selectPolicy({ priority, caseType, teamId }) {
    const rows = await db.all(`SELECT * FROM service_sla_policies WHERE active=1 AND publication_state IN ('active_internal','approved_customer')
      AND priority IN (?, '') AND case_type IN (?, '') AND team_id IN (?, '')
      ORDER BY (priority<>'')+(case_type<>'')+(team_id<>'') DESC, CASE publication_state WHEN 'approved_customer' THEN 0 ELSE 1 END, version DESC, created_at DESC`, priority, caseType, teamId || "");
    return rows[0] || null;
  }

  async function createTimers(caseId, policySnapshot, startedAt, cycle = 1, keys = null) {
    if (!policySnapshot) return;
    for (const [targetKey, targetMinutes] of Object.entries(policySnapshot.targets || {})) {
      if (keys && !keys.includes(targetKey)) continue;
      if (targetKey === "customer_update") continue;
      await db.run(`INSERT INTO service_case_timers(id,service_case_id,cycle,target_key,target_minutes,started_at,due_at,state,last_calculated_at)
        VALUES(?,?,?,?,?,?,?,'running',?) ON CONFLICT(service_case_id,cycle,target_key) DO NOTHING`, id(), caseId, cycle, targetKey, targetMinutes, startedAt, addBusinessMinutes(startedAt, targetMinutes, policySnapshot), startedAt);
    }
  }

  async function recordEvent(caseId, { eventType, visibility = "internal", body = "", metadata = {}, actorType = "staff", actorId = CURRENT_APP_USER.id, idempotencyScope }) {
    const scope = clean(idempotencyScope);
    if (!scope) throw fail("A retry-safe Service action identity is required.", 400, "service_idempotency_required");
    const existing = await db.get("SELECT * FROM service_case_events WHERE idempotency_scope=?", scope);
    if (existing) return existing;
    const at = now(), eventId = id();
    await db.run(`INSERT INTO service_case_events(id,service_case_id,event_type,visibility,body,metadata_json,actor_type,actor_id,occurred_at,idempotency_scope)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, eventId, caseId, eventType, visibility, clean(body), JSON.stringify(metadata || {}), actorType, actorId, at, scope);
    return db.get("SELECT * FROM service_case_events WHERE id=?", eventId);
  }

  async function caseRow(caseId, scope = {}) {
    const clauses = ["sc.id=?"], args = [caseId];
    if (scope.tenantId) { clauses.push("sc.tenant_id=?"); args.push(scope.tenantId); }
    if (scope.clientId) { clauses.push("sc.client_id=?"); args.push(scope.clientId); }
    if (scope.projectId) { clauses.push("sc.project_id=?"); args.push(scope.projectId); }
    return db.get(`SELECT sc.*,c.client_ref,c.name client_name,p.name project_name,o.order_ref FROM service_cases sc
      JOIN clients c ON c.id=sc.client_id LEFT JOIN projects p ON p.id=sc.project_id LEFT JOIN orders o ON o.id=sc.order_id
      WHERE ${clauses.join(" AND ")}`, ...args);
  }

  async function get(caseId, scope = {}, { includeInternal = true } = {}) {
    const row = await caseRow(caseId, scope);
    if (!row) throw fail("Service case not found or not available in this customer context.", 404, "service_case_not_found");
    const [timers, rawEvents, attachments] = await Promise.all([
      db.all("SELECT * FROM service_case_timers WHERE service_case_id=? ORDER BY cycle,target_key", row.id),
      db.all(`SELECT id,event_type,visibility,body,metadata_json,actor_type,actor_id,occurred_at FROM service_case_events WHERE service_case_id=? ${includeInternal ? "" : "AND visibility='customer'"} ORDER BY occurred_at,id`, row.id),
      db.all(`SELECT id,event_id,visibility,file_name,media_type,size_bytes,sha256,uploaded_by_type,uploaded_by_id,created_at FROM service_case_attachments WHERE service_case_id=? ${includeInternal ? "" : "AND visibility='customer'"} ORDER BY created_at,id`, row.id)
    ]);
    return mapCase(row, timers, rawEvents.map((event) => ({ id: event.id, eventType: event.event_type, visibility: event.visibility, body: event.body, metadata: parse(event.metadata_json, {}), actorType: event.actor_type, actorId: event.actor_id, occurredAt: event.occurred_at })), attachments.map((file) => ({ id: file.id, eventId: file.event_id || null, visibility: file.visibility, fileName: file.file_name, mediaType: file.media_type, sizeBytes: Number(file.size_bytes), sha256: file.sha256, uploadedByType: file.uploaded_by_type, uploadedById: file.uploaded_by_id, createdAt: file.created_at, downloadUrl: `/api/service/cases/${row.id}/attachments/${file.id}` })));
  }

  async function list(filters = {}, scope = {}) {
    const clauses = ["1=1"], args = [];
    const add = (sql, value) => { if (clean(value)) { clauses.push(sql); args.push(clean(value)); } };
    add("sc.tenant_id=?", scope.tenantId); add("sc.client_id=?", scope.clientId); add("sc.project_id=?", scope.projectId);
    add("sc.team_id=?", filters.teamId); add("sc.assignee_id=?", filters.assigneeId); add("sc.status=?", filters.status); add("sc.priority=?", filters.priority); add("sc.waiting_on=?", filters.waitingOn);
    if (clean(filters.search)) { clauses.push("lower(sc.service_ref||' '||sc.issue_summary||' '||sc.description||' '||c.name||' '||COALESCE(p.name,'')) LIKE ?"); args.push(`%${clean(filters.search).toLowerCase()}%`); }
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const rows = await db.all(`SELECT sc.*,c.client_ref,c.name client_name,p.name project_name,o.order_ref FROM service_cases sc JOIN clients c ON c.id=sc.client_id LEFT JOIN projects p ON p.id=sc.project_id LEFT JOIN orders o ON o.id=sc.order_id WHERE ${clauses.join(" AND ")}
      ORDER BY CASE sc.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,CASE WHEN sc.next_action_due_at IS NULL THEN 1 ELSE 0 END,sc.next_action_due_at,sc.created_at DESC LIMIT ?`, ...args, limit);
    return Promise.all(rows.map(async (row) => {
      const timers = await db.all("SELECT * FROM service_case_timers WHERE service_case_id=? AND completed_at IS NULL ORDER BY due_at", row.id);
      return mapCase(row, timers);
    }));
  }

  async function create(input = {}, actor = { type: "staff", id: CURRENT_APP_USER.id }, scope = {}) {
    const clientId = clean(scope.clientId || input.clientId), projectId = clean(scope.projectId || input.projectId) || null, orderId = clean(input.orderId) || null;
    const summary = clean(input.issueSummary), description = clean(input.description), idempotencyScope = clean(input.idempotencyKey);
    if (!clientId || !summary || !description || !idempotencyScope) throw fail("Choose the customer and describe the issue before submitting.");
    const existing = await db.get("SELECT id FROM service_cases WHERE idempotency_scope=?", `${scope.tenantId || tenantId}:${actor.type}:${actor.id}:${idempotencyScope}`);
    if (existing) return get(existing.id, scope, { includeInternal: actor.type !== "customer" });
    const client = await db.get("SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", clientId);
    if (!client) throw fail("The selected Client is unavailable.", 404, "service_client_not_found");
    if (projectId && !(await db.get("SELECT id FROM projects WHERE id=? AND client_id=? AND deleted_at IS NULL", projectId, clientId))) throw fail("The selected Project does not belong to this Client.", 409, "service_project_mismatch");
    if (scope.projectId && projectId !== scope.projectId) throw fail("The Service case must remain in the authorised Project.", 403, "service_project_forbidden");
    if (orderId && !(await db.get("SELECT id FROM orders WHERE id=? AND client_id=? AND (? IS NULL OR project_id=?)", orderId, clientId, projectId, projectId))) throw fail("The selected Order does not belong to this customer context.", 409, "service_order_mismatch");
    const priority = allowedPriority.has(clean(input.priority)) ? clean(input.priority) : "normal", caseType = clean(input.caseType) || "service";
    const caseId = id(), at = now(), serviceRefPrefix = await servicePrefix(), stableScope = `${scope.tenantId || tenantId}:${actor.type}:${actor.id}:${idempotencyScope}`;
    await db.exec("BEGIN IMMEDIATE");
    try {
      const reference = await allocateCanonicalReference(db, { kind: "service", prefix: serviceRefPrefix, entityId: caseId, reason: "service_case_registered", now: at });
      await db.run(`INSERT INTO service_cases(id,tenant_id,service_ref,client_id,project_id,order_id,position_ids_json,case_type,issue_summary,description,reported_at,first_noticed_at,status,priority,waiting_on,next_action,next_action_due_at,warranty_state,idempotency_scope,created_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'new',?,'none',?,?,'not_assessed',?,?,?,?)`, caseId, scope.tenantId || tenantId, reference, clientId, projectId, orderId, JSON.stringify(Array.isArray(input.positionIds) ? [...new Set(input.positionIds.map(clean).filter(Boolean))] : []), caseType, summary, description, clean(input.reportedAt) || at, clean(input.firstNoticedAt) || null, priority, clean(input.nextAction) || "Review the reported issue", clean(input.nextActionDueAt) || null, stableScope, actor.id, at, at);
      const assignment = await responsibilities.route({ recordKind: "service", recordId: caseId, responsibilityArea: "service", caseType, transitionKey: "registered", actorId: actor.id });
      await db.run("UPDATE service_cases SET team_id=?,team_name=?,assignee_id=?,assignee_name=? WHERE id=?", assignment.teamId, assignment.teamName, assignment.assigneeId, assignment.assigneeName, caseId);
      const policy = await selectPolicy({ priority, caseType, teamId: assignment.teamId });
      if (policy) {
        const normalized = normalizeServicePolicy({ timezone: policy.timezone, businessHours: parse(policy.business_hours_json, {}), holidays: parse(policy.holidays_json, []), targets: parse(policy.targets_json, {}), pauseRules: parse(policy.pause_rules_json, {}) });
        const snapshot = { name: policy.name, publicationState: policy.publication_state, timezone: normalized.timezone, businessHours: normalized.businessHours, holidays: normalized.holidays, targets: normalized.targets, pauseRules: normalized.pauseRules, escalationTeamId: policy.escalation_team_id || null, escalationOwnerId: policy.escalation_owner_id || null, customerExpectation: clean(input.customerExpectation) || null };
        await db.run("UPDATE service_cases SET policy_id=?,policy_version=?,policy_snapshot_json=? WHERE id=?", policy.id, policy.version, JSON.stringify(snapshot), caseId);
        await createTimers(caseId, snapshot, at);
      }
      await recordEvent(caseId, { eventType: "case_registered", visibility: "customer", body: description, metadata: { issueSummary: summary, reference, acknowledgementIsSubstantiveResponse: false }, actorType: actor.type, actorId: actor.id, idempotencyScope: `${stableScope}:registered` });
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
    return get(caseId, scope, { includeInternal: actor.type !== "customer" });
  }

  async function addAttachment(caseId, input, actor, scope = {}) {
    const current = await caseRow(caseId, scope);
    if (!current) throw fail("Service case not found or not available in this customer context.", 404, "service_case_not_found");
    const content = Buffer.from(clean(input.contentBase64), "base64"), fileName = clean(input.fileName).replace(/[\\/]/g, "-");
    if (!fileName || !content.length) throw fail("Choose a genuine photo or document to upload.", 422, "service_attachment_required");
    if (content.length > 10 * 1024 * 1024) throw fail("Each Service attachment must be 10 MB or smaller.", 413, "service_attachment_too_large");
    const mediaType = clean(input.mediaType) || "application/octet-stream", hash = sha256(content), visibility = actor.type === "customer" ? "customer" : input.visibility === "internal" ? "internal" : "customer";
    const prior = await db.get("SELECT id FROM service_case_attachments WHERE service_case_id=? AND sha256=? AND visibility=?", caseId, hash, visibility);
    if (prior) return { reused: true, attachment: (await get(caseId, scope, { includeInternal: actor.type !== "customer" })).attachments.find((item) => item.id === prior.id) };
    const at = now(), attachmentId = id();
    await db.run(`INSERT INTO service_case_attachments(id,service_case_id,tenant_id,client_id,project_id,visibility,file_name,media_type,size_bytes,sha256,content,uploaded_by_type,uploaded_by_id,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, attachmentId, caseId, current.tenant_id, current.client_id, current.project_id, visibility, fileName, mediaType, content.length, hash, content, actor.type, actor.id, at);
    await recordEvent(caseId, { eventType: "attachment_added", visibility, body: fileName, metadata: { attachmentId, mediaType, sizeBytes: content.length, sha256: hash }, actorType: actor.type, actorId: actor.id, idempotencyScope: `${clean(input.idempotencyKey) || `${actor.type}:${actor.id}:${hash}`}:attachment` });
    return { reused: false, attachment: (await get(caseId, scope, { includeInternal: actor.type !== "customer" })).attachments.find((item) => item.id === attachmentId) };
  }

  async function substantiveResponse(caseId, at, policy) {
    const first = await db.get("SELECT * FROM service_case_timers WHERE service_case_id=? AND target_key='first_response' AND completed_at IS NULL ORDER BY cycle DESC LIMIT 1", caseId);
    if (first) await db.run("UPDATE service_case_timers SET state='completed',completed_at=?,last_calculated_at=? WHERE id=?", at, at, first.id);
    const currentUpdate = await db.get("SELECT * FROM service_case_timers WHERE service_case_id=? AND target_key='customer_update' AND completed_at IS NULL ORDER BY cycle DESC LIMIT 1", caseId);
    if (currentUpdate) await db.run("UPDATE service_case_timers SET state='completed',completed_at=?,last_calculated_at=? WHERE id=?", at, at, currentUpdate.id);
    const minutes = policy?.targets?.customer_update;
    if (minutes) {
      const cycle = Number((await db.get("SELECT MAX(cycle) maximum FROM service_case_timers WHERE service_case_id=? AND target_key='customer_update'", caseId))?.maximum || 0) + 1;
      await db.run("INSERT INTO service_case_timers(id,service_case_id,cycle,target_key,target_minutes,started_at,due_at,state,last_calculated_at) VALUES(?,?,?,?,?,?,?,'running',?)", id(), caseId, cycle, "customer_update", minutes, at, addBusinessMinutes(at, minutes, policy), at);
    }
  }

  async function addUpdate(caseId, input = {}, actor = { type: "staff", id: CURRENT_APP_USER.id }, scope = {}) {
    const current = await caseRow(caseId, scope); if (!current) throw fail("Service case not found.", 404, "service_case_not_found");
    const body = clean(input.body); if (!body) throw fail("Enter the update or note.");
    const visibility = actor.type === "customer" ? "customer" : input.visibility === "internal" ? "internal" : "customer", eventType = actor.type === "customer" ? "customer_information_added" : visibility === "internal" ? "internal_note_added" : "customer_update_added";
    const event = await recordEvent(caseId, { eventType, visibility, body, actorType: actor.type, actorId: actor.id, idempotencyScope: clean(input.idempotencyKey) });
    if (actor.type === "staff" && visibility === "customer" && input.automated !== true) await substantiveResponse(caseId, event.occurred_at, parse(current.policy_snapshot_json, null));
    await db.run("UPDATE service_cases SET updated_at=? WHERE id=?", event.occurred_at, caseId);
    return get(caseId, scope, { includeInternal: actor.type !== "customer" });
  }

  async function pauseOrResumeTimers(caseId, previousWaiting, nextWaiting, policy, at) {
    if (!policy) return;
    const timers = await db.all("SELECT * FROM service_case_timers WHERE service_case_id=? AND completed_at IS NULL", caseId);
    for (const timer of timers) {
      const pauseStates = policy.pauseRules?.[timer.target_key] || [], shouldPause = pauseStates.includes(nextWaiting);
      if (timer.state !== "paused" && shouldPause) await db.run("UPDATE service_case_timers SET state='paused',paused_at=?,last_calculated_at=? WHERE id=?", at, at, timer.id);
      else if (timer.state === "paused" && !shouldPause) {
        const paused = businessMinutesBetween(timer.paused_at, at, policy), dueAt = addBusinessMinutes(timer.due_at, paused, policy);
        await db.run("UPDATE service_case_timers SET state='running',paused_at=NULL,accumulated_pause_minutes=accumulated_pause_minutes+?,due_at=?,last_calculated_at=? WHERE id=?", paused, dueAt, at, timer.id);
      }
    }
  }

  async function update(caseId, input = {}, actorId = CURRENT_APP_USER.id) {
    const current = await caseRow(caseId); if (!current) throw fail("Service case not found.", 404, "service_case_not_found");
    const status = clean(input.status || current.status), priority = clean(input.priority || current.priority), waiting = clean(input.waitingOn ?? current.waiting_on), at = now();
    if (!allowedStatus.has(status) || !allowedPriority.has(priority) || !allowedWaiting.has(waiting)) throw fail("Choose a valid Service status, priority and waiting state.");
    if ((status === "resolved" || status === "closed") && !clean(input.resolution ?? current.resolution)) throw fail("Record the resolution before resolving or closing the case.", 422, "service_resolution_required");
    await pauseOrResumeTimers(caseId, current.waiting_on, waiting, parse(current.policy_snapshot_json, null), at);
    const nextArea = status === "resolved" || status === "closed" ? "completed_aftercare" : "service";
    let assignment = await responsibilities.getAssignment("service", caseId);
    if (nextArea !== assignment?.responsibilityArea) assignment = await responsibilities.route({ recordKind: "service", recordId: caseId, responsibilityArea: nextArea, caseType: current.case_type, transitionKey: `status:${status}`, actorId });
    if (input.teamId !== undefined || input.assigneeId !== undefined) assignment = await responsibilities.assign({ recordKind: "service", recordId: caseId, responsibilityArea: nextArea, teamId: clean(input.teamId) || null, assigneeId: clean(input.assigneeId) || null, reason: clean(input.assignmentReason) || "Reviewed Service reassignment", actorId, idempotencyKey: clean(input.idempotencyKey) || `service:${caseId}:assignment:${at}` });
    const warrantyState = clean(input.warrantyState || current.warranty_state); if (!allowedWarranty.has(warrantyState)) throw fail("Choose a valid warranty assessment state.");
    await db.run(`UPDATE service_cases SET status=?,priority=?,waiting_on=?,team_id=?,team_name=?,assignee_id=?,assignee_name=?,next_action=?,next_action_due_at=?,warranty_state=?,warranty_assessment_json=?,resolution=?,resolved_at=?,closed_at=?,updated_at=? WHERE id=?`, status, priority, waiting, assignment?.teamId || null, assignment?.teamName || null, assignment?.assigneeId || null, assignment?.assigneeName || null, clean(input.nextAction ?? current.next_action), clean(input.nextActionDueAt ?? current.next_action_due_at) || null, warrantyState, JSON.stringify(input.warrantyAssessment ?? parse(current.warranty_assessment_json, {})), clean(input.resolution ?? current.resolution), status === "resolved" ? current.resolved_at || at : current.resolved_at, status === "closed" ? current.closed_at || at : current.closed_at, at, caseId);
    await recordEvent(caseId, { eventType: status !== current.status ? `status_${status}` : "case_updated", visibility: "internal", body: clean(input.reason) || `Service case updated to ${status.replaceAll("_", " ")}.`, metadata: { fromStatus: current.status, status, fromWaitingOn: current.waiting_on, waitingOn: waiting, warrantyState }, actorId, idempotencyScope: clean(input.idempotencyKey) || `service:${caseId}:update:${at}` });
    if (status === "under_review") await db.run("UPDATE service_case_timers SET state='completed',completed_at=?,last_calculated_at=? WHERE service_case_id=? AND target_key='assessment_plan' AND completed_at IS NULL", at, at, caseId);
    if (status === "resolved" || status === "closed") await db.run("UPDATE service_case_timers SET state='completed',completed_at=?,last_calculated_at=? WHERE service_case_id=? AND target_key='resolution' AND completed_at IS NULL", at, at, caseId);
    return get(caseId);
  }

  async function reopen(caseId, input = {}, actorId = CURRENT_APP_USER.id) {
    const current = await caseRow(caseId); if (!current) throw fail("Service case not found.", 404, "service_case_not_found");
    const reason = clean(input.reason); if (!reason) throw fail("Explain why this case is being reopened.", 422, "service_reopen_reason_required");
    const at = now(), policy = parse(current.policy_snapshot_json, null), cycle = Number((await db.get("SELECT MAX(cycle) maximum FROM service_case_timers WHERE service_case_id=?", caseId))?.maximum || 1) + 1;
    await db.run("UPDATE service_cases SET status='under_review',waiting_on='internal',resolution='',resolved_at=NULL,closed_at=NULL,next_action=?,next_action_due_at=?,updated_at=? WHERE id=?", clean(input.nextAction) || "Review the reopened issue", clean(input.nextActionDueAt) || null, at, caseId);
    if (policy?.targets?.resolution) await db.run("INSERT INTO service_case_timers(id,service_case_id,cycle,target_key,target_minutes,started_at,due_at,state,last_calculated_at) VALUES(?,?,?,?,?,?,?,'running',?)", id(), caseId, cycle, "resolution", policy.targets.resolution, at, addBusinessMinutes(at, policy.targets.resolution, policy), at);
    await recordEvent(caseId, { eventType: "case_reopened", visibility: "customer", body: reason, metadata: { timerCycle: cycle }, actorId, idempotencyScope: clean(input.idempotencyKey) || `service:${caseId}:reopen:${at}` });
    return get(caseId);
  }

  async function savePolicy(input = {}, actorId = CURRENT_APP_USER.id) {
    const policyId = clean(input.id) || id(), name = clean(input.name); if (!name) throw fail("Enter a policy name.");
    const publication = ["proposal", "active_internal", "approved_customer"].includes(input.publicationState) ? input.publicationState : "proposal";
    const normalized = normalizeServicePolicy(input), version = Number((await db.get("SELECT MAX(version) maximum FROM service_sla_policies WHERE id=?", policyId))?.maximum || 0) + 1, at = now();
    if (publication !== "proposal" && !Object.keys(normalized.targets).length) throw fail("Configure at least one internal target before activating this policy.");
    await db.run(`INSERT INTO service_sla_policies(id,version,name,publication_state,priority,case_type,team_id,timezone,business_hours_json,holidays_json,targets_json,pause_rules_json,escalation_team_id,escalation_owner_id,active,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`, policyId, version, name, publication, clean(input.priority), clean(input.caseType), clean(input.teamId), normalized.timezone, JSON.stringify(normalized.businessHours), JSON.stringify(normalized.holidays), JSON.stringify(normalized.targets), JSON.stringify(normalized.pauseRules), clean(input.escalationTeamId) || null, clean(input.escalationOwnerId) || null, actorId, at);
    return listPolicies();
  }

  async function listPolicies() {
    const rows = await db.all("SELECT * FROM service_sla_policies WHERE active=1 ORDER BY name,version DESC");
    return rows.map((row) => ({ id: row.id, version: Number(row.version), name: row.name, publicationState: row.publication_state, priority: row.priority, caseType: row.case_type, teamId: row.team_id, timezone: row.timezone, businessHours: parse(row.business_hours_json, {}), holidays: parse(row.holidays_json, []), targets: parse(row.targets_json, {}), pauseRules: parse(row.pause_rules_json, {}), escalationTeamId: row.escalation_team_id || null, escalationOwnerId: row.escalation_owner_id || null, createdBy: row.created_by, createdAt: row.created_at }));
  }

  async function attachment(caseId, attachmentId, scope = {}, includeInternal = true) {
    const current = await caseRow(caseId, scope); if (!current) throw fail("Service attachment is unavailable.", 404, "service_attachment_not_found");
    const row = await db.get(`SELECT * FROM service_case_attachments WHERE id=? AND service_case_id=? ${includeInternal ? "" : "AND visibility='customer'"}`, attachmentId, caseId);
    if (!row) throw fail("Service attachment is unavailable.", 404, "service_attachment_not_found");
    return { fileName: row.file_name, mediaType: row.media_type, bytes: row.content };
  }

  return { list, get, create, update, reopen, addUpdate, addAttachment, attachment, listPolicies, savePolicy, responsibilities };
}
