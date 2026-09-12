import { CURRENT_APP_USER } from "../../currentUser.js";

const text = (value) => String(value ?? "").trim();
const parse = (value, fallback) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const iso = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };
const dateOnly = (value) => text(value).slice(0, 10);
const clampLimit = (value, fallback = 20, maximum = 50) => Math.max(1, Math.min(maximum, Number(value) || fallback));

function clientName(row) {
  return text(row.company_name || row.client_name || row.contact_name || row.display_name) || "Client";
}

function targetFromLinks(rawLinks) {
  const links = Array.isArray(rawLinks) ? rawLinks : parse(rawLinks, []);
  const byKind = new Map(links.map((link) => [text(link?.kind), text(link?.id)]).filter((entry) => entry[0] && entry[1]));
  if (byKind.has("estimate")) return { kind: "estimate", id: byKind.get("estimate"), clientId: byKind.get("client") || null };
  if (byKind.has("order")) return { kind: "order", id: byKind.get("order"), projectId: byKind.get("project") || null };
  if (byKind.has("project")) return { kind: "project", id: byKind.get("project"), clientId: byKind.get("client") || null };
  if (byKind.has("enquiry")) return { kind: "enquiry", id: byKind.get("enquiry") };
  if (byKind.has("client")) return { kind: "client", id: byKind.get("client") };
  return null;
}

function workItemFromState(row, reason) {
  const recordKind = text(row.record_kind);
  const id = text(row.record_id);
  const target = {
    kind: recordKind,
    id,
    clientId: text(row.client_id) || null,
    projectId: text(row.project_id) || null,
    estimateId: text(row.estimate_id) || null,
  };
  return {
    id: `work:${recordKind}:${id}`,
    reason,
    title: text(row.record_ref) || text(row.record_name) || "Work item",
    context: text(row.context_name) || clientName(row),
    ownerName: text(row.owner_name) || CURRENT_APP_USER.name,
    stage: text(row.stage) || "Needs review",
    waitingFor: text(row.waiting_for) || "none",
    nextAction: text(row.next_action) || "Review record",
    dueAt: row.due_at ? text(row.due_at) : null,
    lastContactAt: row.last_contact_at ? text(row.last_contact_at) : null,
    target,
  };
}

function mapSearchRow(kind, row) {
  const common = { kind, id: text(row.id), clientId: text(row.client_id || (kind === "client" ? row.id : "")) || null, projectId: text(row.project_id || (kind === "project" ? row.id : "")) || null, estimateId: text(row.estimate_id || (kind === "estimate" ? row.id : "")) || null };
  if (kind === "client") return { ...common, label: text(row.client_ref) || clientName(row), description: clientName(row), target: common };
  if (kind === "enquiry") return { ...common, label: text(row.enquiry_ref), description: text(row.company_name || row.display_name), target: common };
  if (kind === "project") return { ...common, label: text(row.name), description: [text(row.client_ref), clientName(row)].filter(Boolean).join(" · "), target: common };
  if (kind === "estimate") return { ...common, label: text(row.estimate_ref), description: [text(row.project_name), text(row.client_ref), clientName(row)].filter(Boolean).join(" · "), target: common };
  return { ...common, label: text(row.order_ref), description: [text(row.project_name), text(row.client_ref), clientName(row)].filter(Boolean).join(" · "), target: common };
}

export function createCrmDashboardService(db, { now = () => new Date() } = {}) {
  async function communicationEvidence() {
    const rows = await db.all(`SELECT id,direction,subject,links_json,COALESCE(sent_at,updated_at,created_at) occurred_at
      FROM communication_messages ORDER BY COALESCE(sent_at,updated_at,created_at) DESC LIMIT 250`).catch(() => []);
    const outboundEnquiries = new Set();
    const latestByRecord = new Map();
    for (const row of rows) {
      const links = parse(row.links_json, []);
      for (const link of links) {
        const kind = text(link?.kind), id = text(link?.id);
        if (!kind || !id) continue;
        if (row.direction === "outbound" && kind === "enquiry") outboundEnquiries.add(id);
        const key = `${kind}:${id}`;
        if (!latestByRecord.has(key)) latestByRecord.set(key, text(row.occurred_at));
      }
    }
    return { rows, outboundEnquiries, latestByRecord };
  }

  async function listWorkStates() {
    return db.all(`SELECT w.*,
      COALESCE(en.enquiry_ref,c.client_ref,e.estimate_ref,o.order_ref,p.name) record_ref,
      COALESCE(en.company_name,en.display_name,p.name,e.estimate_ref,o.order_ref,c.company_name,c.name) record_name,
      COALESCE(c2.id,c3.id,c4.id,c5.id,c.id) client_id,
      COALESCE(c2.client_ref,c3.client_ref,c4.client_ref,c5.client_ref,c.client_ref) client_ref,
      COALESCE(c2.company_name,c3.company_name,c4.company_name,c5.company_name,c.company_name) company_name,
      COALESCE(c2.name,c3.name,c4.name,c5.name,c.name) client_name,
      COALESCE(p.id,p2.id,p3.id) project_id,
      COALESCE(p.name,p2.name,p3.name) context_name,
      CASE WHEN w.record_kind='estimate' THEN e.id WHEN w.record_kind='order' THEN o.source_estimate_id ELSE NULL END estimate_id
      FROM crm_record_work_states w
      LEFT JOIN enquiries en ON w.record_kind='enquiry' AND en.id=w.record_id AND en.deleted_at IS NULL
      LEFT JOIN clients c ON w.record_kind='client' AND c.id=w.record_id AND c.deleted_at IS NULL
      LEFT JOIN projects p ON w.record_kind='project' AND p.id=w.record_id AND p.deleted_at IS NULL
      LEFT JOIN clients c2 ON c2.id=p.client_id AND c2.deleted_at IS NULL
      LEFT JOIN estimates e ON w.record_kind='estimate' AND e.id=w.record_id AND e.deleted_at IS NULL
      LEFT JOIN projects p2 ON p2.id=e.project_id AND p2.deleted_at IS NULL
      LEFT JOIN clients c3 ON c3.id=e.client_id AND c3.deleted_at IS NULL
      LEFT JOIN orders o ON w.record_kind='order' AND o.id=w.record_id
      LEFT JOIN projects p3 ON p3.id=o.project_id AND p3.deleted_at IS NULL
      LEFT JOIN clients c4 ON c4.id=o.client_id AND c4.deleted_at IS NULL
      LEFT JOIN clients c5 ON c5.id=en.converted_client_id AND c5.deleted_at IS NULL
      WHERE en.id IS NOT NULL OR c.id IS NOT NULL OR p.id IS NOT NULL OR e.id IS NOT NULL OR o.id IS NOT NULL
      ORDER BY CASE WHEN w.due_at IS NULL THEN 1 ELSE 0 END,w.due_at ASC,w.updated_at DESC LIMIT 200`);
  }

  async function dashboard() {
    const current = now();
    const today = dateOnly(current.toISOString());
    const [followups, states, communications, enquiries, pipelineRows, orderCountRow, serviceCases, serviceEvents, revisionRequests] = await Promise.all([
      db.all(`SELECT f.*,c.client_ref,c.name client_name,c.company_name,c.contact_name,e.estimate_ref,e.project_id
        FROM followups f JOIN clients c ON c.id=f.client_id AND c.deleted_at IS NULL
        LEFT JOIN estimates e ON e.id=f.estimate_id AND e.deleted_at IS NULL
        WHERE lower(COALESCE(f.status,'')) NOT IN ('done','completed')
        ORDER BY CASE WHEN f.due_at IS NULL THEN 1 ELSE 0 END,f.due_at ASC,f.updated_at DESC LIMIT 200`),
      listWorkStates(),
      communicationEvidence(),
      db.all("SELECT id,enquiry_ref,display_name,company_name,created_at,updated_at FROM enquiries WHERE deleted_at IS NULL AND status='new' ORDER BY created_at DESC LIMIT 200"),
      db.all(`SELECT e.id,e.client_id,e.project_id,e.estimate_ref,e.outcome,e.status,e.positions_json,e.order_meta_json,e.updated_at,
          CASE WHEN EXISTS(SELECT 1 FROM issued_quotations iq WHERE iq.estimate_id=e.id AND iq.status='issued') THEN 1 ELSE 0 END issued
        FROM estimates e JOIN clients c ON c.id=e.client_id AND c.deleted_at IS NULL
        WHERE e.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM estimate_archives ea WHERE ea.estimate_id=e.id)
        ORDER BY e.updated_at DESC LIMIT 500`),
      db.get("SELECT COUNT(*) count FROM orders"),
      db.all(`SELECT sc.*,(SELECT MIN(due_at) FROM service_case_timers t WHERE t.service_case_id=sc.id AND t.completed_at IS NULL AND t.state<>'paused') target_due_at
        FROM service_cases sc WHERE sc.status NOT IN ('closed') ORDER BY CASE sc.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,COALESCE(sc.next_action_due_at,target_due_at,sc.created_at) LIMIT 100`).catch(() => []),
      db.all("SELECT e.id,e.service_case_id,e.event_type,e.body,e.occurred_at,sc.client_id,sc.project_id FROM service_case_events e JOIN service_cases sc ON sc.id=e.service_case_id ORDER BY e.occurred_at DESC LIMIT 20").catch(() => []),
      db.all(`SELECT sr.id,sr.review_submission_id,sr.successor_estimate_id,sr.workflow_state,sr.response_due_at,sr.responsible_user_id,sr.created_at,
        rel.client_id,rel.project_id,c.client_ref,c.name client_name,p.name project_name,e.estimate_ref
        FROM supplier_revision_requests sr JOIN estimate_revision_releases rel ON rel.id=sr.source_release_id
        JOIN clients c ON c.id=rel.client_id JOIN projects p ON p.id=rel.project_id JOIN estimates e ON e.id=sr.successor_estimate_id
        WHERE sr.status<>'cancelled' AND sr.workflow_state<>'revised_customer_estimate_issued' ORDER BY COALESCE(sr.response_due_at,sr.created_at) LIMIT 100`).catch(()=>[]),
    ]);

    const attention = [];
    const schedule = [];
    const seen = new Set();
    let unansweredEnquiryCount = 0;
    let waitingOnCustomerCount = 0;
    let waitingOnSupplierCount = 0;
    let serviceNewUnassigned = 0;
    let serviceRequiringStaff = 0;
    let serviceOverdue = 0;
    let revisionsRequested = 0;
    for (const row of followups) {
      const due = dateOnly(row.due_at);
      const item = {
        id: `followup:${row.id}`, reason: due && due < today ? "overdue_follow_up" : "follow_up",
        title: text(row.title) || "Customer follow-up", context: [text(row.estimate_ref), text(row.client_ref), clientName(row)].filter(Boolean).join(" · "),
        ownerName: CURRENT_APP_USER.name, stage: row.issued_quotation_id ? "Estimate sent" : "Follow-up", waitingFor: "staff",
        nextAction: text(row.notes) || "Complete follow-up", dueAt: row.due_at || null, lastContactAt: null,
        target: { kind: "followup", id: text(row.id), clientId: text(row.client_id), estimateId: text(row.estimate_id) || null, projectId: text(row.project_id) || null, dueAt: row.due_at || null },
      };
      if (due === today) schedule.push(item);
      if (!due || due <= today) { attention.push(item); seen.add(item.id); }
    }
    for (const row of states) {
      const key = `${row.record_kind}:${row.record_id}`;
      const latestContact = communications.latestByRecord.get(key) || row.last_contact_at || null;
      const due = dateOnly(row.due_at);
      let reason = null;
      const unanswered = row.record_kind === "enquiry" && row.stage === "new_enquiry" && !communications.outboundEnquiries.has(text(row.record_id));
      if (unanswered) unansweredEnquiryCount += 1;
      if (row.waiting_for === "customer") waitingOnCustomerCount += 1;
      if (row.waiting_for === "supplier") waitingOnSupplierCount += 1;
      if (row.waiting_for && row.waiting_for !== "none") reason = `waiting_on_${row.waiting_for}`;
      else if (unanswered) reason = "unanswered_enquiry";
      else if (due && due < today) reason = "overdue_next_action";
      const item = workItemFromState({ ...row, last_contact_at: latestContact }, reason || "next_action");
      if (due === today && !schedule.some((entry) => entry.id === item.id)) schedule.push(item);
      if (reason && !seen.has(item.id)) { attention.push(item); seen.add(item.id); }
    }
    for (const row of serviceCases) {
      const targetDue = row.target_due_at || row.next_action_due_at || null, dueTime = targetDue ? new Date(targetDue).getTime() : null;
      const overdue = dueTime !== null && dueTime < current.getTime(), unassigned = !row.team_id, waiting = text(row.waiting_on);
      if (row.status === "new" || unassigned) serviceNewUnassigned += 1;
      if (waiting === "none" || waiting === "internal") serviceRequiringStaff += 1;
      if (overdue) serviceOverdue += 1;
      if (waiting === "customer") waitingOnCustomerCount += 1;
      if (waiting === "supplier") waitingOnSupplierCount += 1;
      const reason = unassigned ? "service_unassigned" : overdue ? "service_target_overdue" : waiting === "customer" ? "service_waiting_on_customer" : waiting === "supplier" ? "service_waiting_on_supplier" : row.status === "new" ? "new_service_case" : "service_action_required";
      const item = { id:`service:${row.id}`,reason,title:text(row.service_ref),context:text(row.issue_summary),ownerName:text(row.assignee_name||row.team_name)||"Unassigned",stage:`Service · ${text(row.status)}`,waitingFor:waiting,nextAction:text(row.next_action)||"Review Service case",dueAt:targetDue,lastContactAt:null,target:{kind:"service",id:text(row.id),clientId:text(row.client_id),projectId:text(row.project_id)||null} };
      if (!seen.has(item.id) && (unassigned || overdue || row.status === "new" || waiting !== "customer" && waiting !== "supplier")) { attention.push(item); seen.add(item.id); }
      if (dateOnly(row.next_action_due_at) === today) schedule.push(item);
    }
    for(const row of revisionRequests){
      revisionsRequested+=1;const dueTime=row.response_due_at?new Date(row.response_due_at).getTime():null,overdue=dueTime!==null&&dueTime<current.getTime(),state=overdue&&row.workflow_state==='sent_to_supplier'?'supplier_response_overdue':row.workflow_state;
      const item={id:`revision:${row.id}`,reason:overdue?'supplier_response_overdue':'revision_requested',title:text(row.estimate_ref),context:[text(row.client_ref),clientName(row),text(row.project_name)].filter(Boolean).join(' · '),ownerName:text(row.responsible_user_id)||CURRENT_APP_USER.name,stage:text(state),waitingFor:['sent_to_supplier','supplier_response_overdue'].includes(state)?'supplier':'staff',nextAction:state==='revision_requested'?'Review the customer changes and prepare the supplier request':state==='prepared_for_review'?'Review and send the prepared supplier request':state==='revised_document_received'?'Review and process the revised supplier document':overdue?'Review the overdue supplier response':'Continue the tracked revision request',dueAt:row.response_due_at||null,lastContactAt:null,target:{kind:'revision_request',id:text(row.review_submission_id),clientId:text(row.client_id),projectId:text(row.project_id),estimateId:text(row.successor_estimate_id)}};
      if(!seen.has(item.id)){attention.push(item);seen.add(item.id)}
    }

    let installationsToday = 0;
    let invoicesDueToday = 0;
    let ordersNeedingAttention = 0;
    const stageCounts = { new_enquiry: enquiries.length, draft_estimate: 0, customer_review: 0, won: Number(orderCountRow?.count || 0) };
    for (const row of pipelineRows) {
      if (String(row.outcome || "Open") === "Order") {
        const meta = parse(row.order_meta_json, {});
        const target = { kind: "estimate", id: text(row.id), clientId: text(row.client_id), estimateId: text(row.id), projectId: text(row.project_id) || null };
        if (dateOnly(meta.installationDate) === today) {
          installationsToday += 1;
          schedule.push({ id: `installation:${row.id}`, reason: "installation_today", title: text(row.estimate_ref) || "Installation", context: "Installation scheduled", ownerName: text(meta.installerId) || "Unassigned", stage: "Installation", waitingFor: "staff", nextAction: "Open installation", dueAt: meta.installationDate, lastContactAt: null, target });
        }
        if (dateOnly(meta.balanceInvoiceDueDate) === today) {
          invoicesDueToday += 1;
          schedule.push({ id: `invoice:${row.id}`, reason: "invoice_due", title: text(row.estimate_ref) || "Invoice", context: "Balance invoice due", ownerName: "Accounts", stage: "Invoice due", waitingFor: "staff", nextAction: "Review invoice", dueAt: meta.balanceInvoiceDueDate, lastContactAt: null, target });
        }
        if (!meta.clientSignoffReceivedDate || !meta.factoryOrderSignedOffDate || !meta.productionStartDate || !meta.deliveryDate || !meta.installationDate) ordersNeedingAttention += 1;
        continue;
      }
      if (Number(row.issued)) stageCounts.customer_review += 1;
      else stageCounts.draft_estimate += 1;
    }

    const recentActivity = [];
    for (const row of communications.rows.slice(0, 20)) {
      const target = targetFromLinks(row.links_json);
      if (target) recentActivity.push({ id: `communication:${row.id}`, kind: "communication", title: text(row.subject) || (row.direction === "inbound" ? "Email received" : "Email sent"), detail: row.direction === "inbound" ? "Email received" : "Email sent", occurredAt: text(row.occurred_at), target });
    }
    const workflowRows = await db.all("SELECT id,event_name,occurred_at,links_json FROM workflow_events ORDER BY occurred_at DESC LIMIT 20").catch(() => []);
    for (const row of workflowRows) recentActivity.push({ id: `workflow:${row.id}`, kind: "workflow", title: text(row.event_name).replaceAll(".", " "), detail: "Workflow update", occurredAt: text(row.occurred_at), target: targetFromLinks(row.links_json) });
    for (const row of serviceEvents) recentActivity.push({ id:`service:${row.id}`,kind:"service",title:text(row.event_type).replaceAll("_"," "),detail:text(row.body)||"Service update",occurredAt:text(row.occurred_at),target:{kind:"service",id:text(row.service_case_id),clientId:text(row.client_id),projectId:text(row.project_id)||null} });
    recentActivity.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    attention.sort((a, b) => String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999")));
    schedule.sort((a, b) => String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999")));
    return {
      generatedAt: current.toISOString(),
      user: CURRENT_APP_USER,
      summary: {
        overdue: attention.filter((item) => item.reason.startsWith("overdue")).length,
        dueToday: schedule.length,
        unansweredEnquiries: unansweredEnquiryCount,
        waitingOnCustomer: waitingOnCustomerCount,
        waitingOnSupplier: waitingOnSupplierCount,
        installationsToday,
        invoicesDueToday,
        ordersNeedingAttention,
        serviceNewUnassigned,
        serviceRequiringStaff,
        serviceOverdue,
        revisionsRequested,
      },
      attention: attention.slice(0, 40),
      today: schedule.slice(0, 30),
      pipeline: [
        { id: "new_enquiry", label: "New Enquiries", count: stageCounts.new_enquiry },
        { id: "draft_estimate", label: "Estimate in progress", count: stageCounts.draft_estimate },
        { id: "customer_review", label: "Awaiting customer", count: stageCounts.customer_review },
        { id: "won", label: "Orders", count: stageCounts.won },
      ],
      recentActivity: recentActivity.slice(0, 12),
      limits: { attention: 40, today: 30, recentActivity: 12 },
    };
  }

  async function search(query, requestedLimit) {
    const q = text(query);
    if (q.length < 2) return { query: q, results: [], minimumCharacters: 2 };
    const limit = clampLimit(requestedLimit);
    const like = `%${q.toLowerCase()}%`;
    const perKind = Math.max(3, Math.ceil(limit / 3));
    const [clients, enquiries, projects, estimates, orders] = await Promise.all([
      db.all(`SELECT id,client_ref,name client_name,company_name,contact_name FROM clients WHERE deleted_at IS NULL AND (lower(client_ref) LIKE ? OR lower(name) LIKE ? OR lower(company_name) LIKE ? OR lower(email) LIKE ?) ORDER BY updated_at DESC,created_at DESC LIMIT ?`, like, like, like, like, perKind),
      db.all(`SELECT id,enquiry_ref,display_name,company_name FROM enquiries WHERE deleted_at IS NULL AND (lower(enquiry_ref) LIKE ? OR lower(display_name) LIKE ? OR lower(company_name) LIKE ? OR lower(email) LIKE ? OR lower(project_name) LIKE ?) ORDER BY updated_at DESC LIMIT ?`, like, like, like, like, like, perKind),
      db.all(`SELECT p.id,p.id project_id,p.client_id,p.name,c.client_ref,c.name client_name,c.company_name,c.contact_name FROM projects p JOIN clients c ON c.id=p.client_id AND c.deleted_at IS NULL WHERE p.deleted_at IS NULL AND (lower(p.name) LIKE ? OR lower(p.site_address) LIKE ? OR lower(c.client_ref) LIKE ? OR lower(c.name) LIKE ? OR lower(c.company_name) LIKE ?) ORDER BY p.updated_at DESC LIMIT ?`, like, like, like, like, like, perKind),
      db.all(`SELECT e.id,e.id estimate_id,e.client_id,e.project_id,e.estimate_ref,p.name project_name,c.client_ref,c.name client_name,c.company_name,c.contact_name FROM estimates e JOIN clients c ON c.id=e.client_id AND c.deleted_at IS NULL LEFT JOIN projects p ON p.id=e.project_id WHERE e.deleted_at IS NULL AND (lower(e.estimate_ref) LIKE ? OR lower(p.name) LIKE ? OR lower(c.client_ref) LIKE ? OR lower(c.name) LIKE ? OR lower(c.company_name) LIKE ?) ORDER BY e.updated_at DESC LIMIT ?`, like, like, like, like, like, perKind),
      db.all(`SELECT o.id,o.order_ref,o.client_id,o.project_id,o.source_estimate_id estimate_id,p.name project_name,c.client_ref,c.name client_name,c.company_name,c.contact_name FROM orders o JOIN clients c ON c.id=o.client_id AND c.deleted_at IS NULL LEFT JOIN projects p ON p.id=o.project_id WHERE lower(o.order_ref) LIKE ? OR lower(p.name) LIKE ? OR lower(c.client_ref) LIKE ? OR lower(c.name) LIKE ? OR lower(c.company_name) LIKE ? ORDER BY o.updated_at DESC LIMIT ?`, like, like, like, like, like, perKind),
    ]);
    const results = [
      ...clients.map((row) => mapSearchRow("client", row)),
      ...enquiries.map((row) => mapSearchRow("enquiry", row)),
      ...projects.map((row) => mapSearchRow("project", row)),
      ...estimates.map((row) => mapSearchRow("estimate", row)),
      ...orders.map((row) => mapSearchRow("order", row)),
    ].slice(0, limit);
    return { query: q, results, limit, truncated: results.length === limit };
  }

  async function updateWorkState(recordKind, recordId, input = {}) {
    if (!new Set(["enquiry", "client", "project", "estimate", "order"]).has(recordKind)) throw Object.assign(new Error("Choose a supported CRM record."), { status: 422, code: "crm_record_kind_invalid" });
    const table = { enquiry: "enquiries", client: "clients", project: "projects", estimate: "estimates", order: "orders" }[recordKind];
    const record = await db.get(`SELECT id FROM ${table} WHERE id=?${recordKind === "order" ? "" : " AND deleted_at IS NULL"}`, recordId);
    if (!record) throw Object.assign(new Error("The selected record is no longer available."), { status: 404, code: "crm_record_not_found" });
    const current = await db.get("SELECT * FROM crm_record_work_states WHERE record_kind=? AND record_id=?", recordKind, recordId);
    const waitingFor = input.waitingFor === undefined ? text(current?.waiting_for) || "none" : text(input.waitingFor);
    if (!new Set(["none", "staff", "customer", "supplier"]).has(waitingFor)) throw Object.assign(new Error("Choose who the work is waiting on."), { status: 422, code: "crm_waiting_for_invalid" });
    const updatedAt = now().toISOString();
    const value = {
      ownerUserId: input.ownerUserId === undefined ? text(current?.owner_user_id) || CURRENT_APP_USER.id : text(input.ownerUserId) || CURRENT_APP_USER.id,
      ownerName: input.ownerName === undefined ? text(current?.owner_name) || CURRENT_APP_USER.name : text(input.ownerName) || CURRENT_APP_USER.name,
      stage: input.stage === undefined ? text(current?.stage) : text(input.stage),
      waitingFor,
      nextAction: input.nextAction === undefined ? text(current?.next_action) : text(input.nextAction),
      dueAt: input.dueAt === undefined ? current?.due_at || null : (text(input.dueAt) ? iso(input.dueAt) : null),
      lastContactAt: input.lastContactAt === undefined ? current?.last_contact_at || null : (text(input.lastContactAt) ? iso(input.lastContactAt) : null),
    };
    if (text(input.dueAt) && !value.dueAt) throw Object.assign(new Error("Use a valid next-action date."), { status: 422, code: "crm_due_at_invalid" });
    await db.run(`INSERT INTO crm_record_work_states(record_kind,record_id,owner_user_id,owner_name,stage,waiting_for,next_action,due_at,last_contact_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(record_kind,record_id) DO UPDATE SET owner_user_id=excluded.owner_user_id,owner_name=excluded.owner_name,stage=excluded.stage,waiting_for=excluded.waiting_for,next_action=excluded.next_action,due_at=excluded.due_at,last_contact_at=excluded.last_contact_at,updated_at=excluded.updated_at`,
      recordKind,recordId,value.ownerUserId,value.ownerName,value.stage,value.waitingFor,value.nextAction,value.dueAt,value.lastContactAt,current?.created_at || updatedAt,updatedAt);
    return { recordKind, recordId, ...value, updatedAt };
  }

  return { dashboard, search, updateWorkState };
}
