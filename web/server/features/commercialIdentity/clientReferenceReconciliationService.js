import { createHash, randomUUID } from "node:crypto";
import { advanceReferenceHighWater } from "./referenceAllocator.js";

const canonicalJson = (value) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export const hashReconciliationValue = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const normalizeRef = (value) => String(value || "").trim().toUpperCase();
const issue = (message, code, status = 409) => Object.assign(new Error(message), { code, status });

async function tableHasColumn(db, table, column) {
  const exists = await db.get("SELECT 1 found FROM sqlite_master WHERE type='table' AND name=?", table);
  if (!exists) return false;
  return (await db.all(`PRAGMA table_info("${table}")`)).some((item) => item.name === column);
}

export async function snapshotClientRelationships(db, clientId) {
  const direct = {}, estimateOwned = {};
  const tables = (await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((row) => row.name);
  for (const table of tables) {
    if (["canonical_reference_registry", "protected_client_identities", "client_reference_reconciliation_journal"].includes(table)) continue;
    if (await tableHasColumn(db, table, "client_id")) direct[table] = Number((await db.get(`SELECT COUNT(*) count FROM "${table}" WHERE client_id=?`, clientId))?.count || 0);
  }
  const estimateIds = (await db.all("SELECT id FROM estimates WHERE client_id=?", clientId)).map((row) => row.id);
  if (estimateIds.length) for (const table of tables) if (await tableHasColumn(db, table, "estimate_id")) {
    estimateOwned[table] = Number((await db.get(`SELECT COUNT(*) count FROM "${table}" WHERE estimate_id IN (${estimateIds.map(() => "?").join(",")})`, ...estimateIds))?.count || 0);
  }
  const communications = await db.all("SELECT links_json FROM communication_messages").catch(() => []);
  const communicationLinks = communications.reduce((total, row) => {
    try { return total + (JSON.parse(row.links_json || "[]").some((link) => link?.kind === "client" && link.id === clientId) ? 1 : 0); } catch { return total; }
  }, 0);
  return { direct, estimateOwned, communicationLinks };
}

function validateActions(actions) {
  const allowed = new Set(["keep", "renumber", "create", "demo_isolate", "review", "create_project"]), ids = new Set(), liveTargets = new Set();
  for (const action of actions) {
    if (!allowed.has(action.type)) throw issue(`Unsupported reconciliation action ${action.type}.`, "reconciliation_action_invalid", 422);
    if (action.actionId && ids.has(action.actionId)) throw issue("Reconciliation action IDs must be unique.", "reconciliation_action_duplicate", 422);
    if (action.actionId) ids.add(action.actionId);
    if (["keep", "renumber", "demo_isolate"].includes(action.type) && !action.clientId) throw issue("Existing-Client actions require an internal Client ID.", "reconciliation_client_required", 422);
    if (["keep", "renumber", "create"].includes(action.type) && !/^EF-CL-\d{3}$/.test(normalizeRef(action.targetRef))) throw issue("Live Client references use EF-CL-###.", "reconciliation_reference_invalid", 422);
    if (["keep", "renumber", "create"].includes(action.type)) {
      const target = normalizeRef(action.targetRef);
      if (liveTargets.has(target)) throw issue(`Live Client reference ${target} is assigned more than once in the plan.`, "reconciliation_reference_duplicate", 422);
      liveTargets.add(target);
    }
    if (action.type === "demo_isolate" && (!/^(?:DEMO|TEST)-CL-[A-Z0-9-]+$/.test(normalizeRef(action.targetRef)) || !["demo", "test"].includes(action.namespace))) throw issue("Demo isolation requires an explicit DEMO-CL or TEST-CL reference namespace.", "reconciliation_demo_reference_invalid", 422);
    if (action.type === "create_project" && (!action.clientRef || !action.projectName || !action.providerFolderId)) throw issue("Project migration requires Client reference, reviewed project name and provider folder ID.", "reconciliation_project_invalid", 422);
  }
}

export function buildClientReferencePlan({ version, driveInventoryHash, actions }) {
  validateActions(actions);
  const matrix = { version, driveInventoryHash, actions };
  return { ...matrix, planHash: hashReconciliationValue(matrix) };
}

export function createClientReferenceReconciliationService(db, { now = () => new Date(), id = randomUUID, failAfterAction = null, validateBeforeCommit = null } = {}) {
  async function prepare(input) {
    const plan = buildClientReferencePlan(input), baseline = {};
    for (const action of plan.actions.filter((item) => item.clientId)) {
      const client = await db.get("SELECT id,client_ref,reference_namespace,deleted_at FROM clients WHERE id=?", action.clientId);
      if (client && action.sourceRef && normalizeRef(client.client_ref) !== normalizeRef(action.sourceRef)) throw issue(`Client ${action.clientId} does not hold the reviewed source reference.`, "reconciliation_source_stale", 409);
      if (client && action.type === "keep" && normalizeRef(client.client_ref) !== normalizeRef(action.targetRef)) throw issue(`Client ${action.clientId} no longer matches its KEEP decision.`, "reconciliation_keep_stale", 409);
      baseline[action.clientId] = client ? { clientRef: normalizeRef(client.client_ref), referenceNamespace: client.reference_namespace, deletedAt: client.deleted_at, relationships: await snapshotClientRelationships(db, client.id) } : null;
    }
    const planId = input.id || id(), createdAt = now().toISOString();
    await db.run(`INSERT INTO client_reference_reconciliation_plans(id,plan_version,plan_hash,drive_inventory_hash,matrix_json,baseline_json,status,created_at)
      VALUES(?,?,?,?,?,?,'prepared',?) ON CONFLICT(plan_hash) DO NOTHING`, planId, plan.version, plan.planHash, plan.driveInventoryHash, JSON.stringify(plan.actions), JSON.stringify(baseline), createdAt);
    return db.get("SELECT * FROM client_reference_reconciliation_plans WHERE plan_hash=?", plan.planHash);
  }

  async function execute({ planHash, driveInventoryHash, approval, backupEvidence }) {
    if (!approval?.approvedBy || approval.planHash !== planHash) throw issue("Explicit approval for this exact reconciliation plan is required.", "reconciliation_approval_required", 403);
    if (!backupEvidence?.verified || !backupEvidence?.backupId || !/^[a-f0-9]{64}$/i.test(String(backupEvidence.sha256 || ""))) throw issue("A verified database backup is required before reconciliation.", "reconciliation_backup_required", 412);
    const plan = await db.get("SELECT * FROM client_reference_reconciliation_plans WHERE plan_hash=?", planHash);
    if (!plan || plan.status !== "prepared") throw issue("The prepared reconciliation plan is unavailable.", "reconciliation_plan_unavailable", 404);
    if (plan.drive_inventory_hash !== driveInventoryHash) throw issue("The Drive inventory has changed; prepare and approve a fresh plan.", "reconciliation_inventory_stale", 409);
    const actions = JSON.parse(plan.matrix_json), baseline = JSON.parse(plan.baseline_json), protectedApproval = new Set(approval.protectedClientIds || []);
    const moving = actions.filter((action) => ["renumber", "demo_isolate"].includes(action.type));
    for (const action of actions.filter((item) => item.clientId)) {
      const current = await db.get("SELECT id,client_ref,reference_namespace,deleted_at FROM clients WHERE id=?", action.clientId);
      const expected = baseline[action.clientId];
      if (!current || !expected || normalizeRef(current.client_ref) !== expected.clientRef || current.reference_namespace !== expected.referenceNamespace || current.deleted_at !== expected.deletedAt) throw issue(`Client ${action.clientId} changed after plan preparation.`, "reconciliation_plan_stale", 409);
      const protectedIdentity = await db.get("SELECT 1 found FROM protected_client_identities WHERE client_id=?", action.clientId);
      if (protectedIdentity && moving.includes(action) && !protectedApproval.has(action.clientId)) throw issue(`Protected Client ${action.clientId} requires explicit migration approval.`, "protected_client_approval_required", 403);
    }

    await db.exec("BEGIN IMMEDIATE");
    try {
      const timestamp = now().toISOString(), journal = [];
      for (const [index, action] of moving.entries()) {
        const tempRef = `MIG-${planHash.slice(0, 10).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
        await db.run("UPDATE clients SET client_ref=?,reference_namespace='migration',updated_at=? WHERE id=?", tempRef, timestamp, action.clientId);
      }
      let sequence = 0;
      for (const action of actions) {
        if (action.type === "review") continue;
        sequence += 1;
        let clientId = action.clientId || null, before = clientId ? await db.get("SELECT id,client_ref,reference_namespace,commercial_lifecycle FROM clients WHERE id=?", clientId) : null, after = before;
        if (action.type === "renumber") {
          await db.run("UPDATE clients SET client_ref=?,reference_namespace='live',updated_at=? WHERE id=?", normalizeRef(action.targetRef), timestamp, clientId);
          await db.run(`INSERT INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason,reconciliation_plan_id) VALUES(?,'client',?,?,?,?) ON CONFLICT(reference) DO UPDATE SET entity_id=excluded.entity_id,allocation_reason=excluded.allocation_reason,reconciliation_plan_id=excluded.reconciliation_plan_id`, normalizeRef(action.targetRef), clientId, timestamp, "controlled_reconciliation", plan.id);
        } else if (action.type === "demo_isolate") {
          await db.run("UPDATE clients SET client_ref=?,reference_namespace=?,updated_at=? WHERE id=?", normalizeRef(action.targetRef), action.namespace === "test" ? "test" : "demo", timestamp, clientId);
        } else if (action.type === "create") {
          clientId = action.clientId || id();
          await db.run(`INSERT INTO clients(id,name,email,phone,mobile,home,project_name,created_at,client_ref,client_type,contact_name,company_name,customer_address,project_address,invoice_address,invoice_same_as_customer,invoice_same_as_project,customer_address_json,project_address_json,invoice_address_json,what3words,latitude,longitude,deleted_at,commercial_lifecycle,reference_namespace,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,'live',?)`, clientId, action.name, "", "", "", "", action.projectName || "", timestamp, normalizeRef(action.targetRef), action.clientType || "Individual", action.contactName || "", action.companyName || "", "", "", "", 0, 0, "{}", "{}", "{}", "", null, null, action.lifecycle || "unknown_review", timestamp);
          await db.run(`INSERT INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason,reconciliation_plan_id) VALUES(?,'client',?,?,?,?) ON CONFLICT(reference) DO UPDATE SET entity_id=excluded.entity_id,allocation_reason=excluded.allocation_reason,reconciliation_plan_id=excluded.reconciliation_plan_id`, normalizeRef(action.targetRef), clientId, timestamp, "controlled_reconciliation_create", plan.id);
        } else if (action.type === "create_project") {
          const client = await db.get("SELECT id FROM clients WHERE UPPER(TRIM(client_ref))=? AND deleted_at IS NULL AND reference_namespace='live'", normalizeRef(action.clientRef));
          if (!client) throw issue(`Project Client ${action.clientRef} is unavailable.`, "reconciliation_project_client_missing", 409);
          const existing = await db.get("SELECT entity_id FROM canonical_drive_folders WHERE provider='google_drive' AND entity_kind='project' AND provider_folder_id=? AND removed_at IS NULL", action.providerFolderId);
          if (existing) { clientId = client.id; after = { projectId: existing.entity_id, reused: true }; }
          else {
            const projectId = action.projectId || id();
            await db.run(`INSERT INTO projects(id,client_id,source_enquiry_id,name,status,context_year,site_address,site_address_json,postcode,what3words,latitude,longitude,created_at,updated_at) VALUES(?,?,NULL,?,'active',?,'','{}','','',NULL,NULL,?,?)`, projectId, client.id, action.projectName, Number(action.year), timestamp, timestamp);
            await db.run(`INSERT INTO canonical_drive_folders(id,provider,provider_account_id,entity_kind,entity_id,logical_key,name,parent_logical_key,provider_folder_id,provider_parent_folder_id,folder_path,provenance,last_seen_at,removed_at,created_at,updated_at) VALUES(?,'google_drive',NULL,'project',?,'project',?,NULL,?,NULL,?,'reconciliation_inventory',?,NULL,?,?)`, id(), projectId, action.projectName, action.providerFolderId, action.folderPath || action.projectName, timestamp, timestamp, timestamp);
            clientId = client.id; after = { projectId, reused: false };
          }
        }
        if (clientId && action.type !== "create_project") after = await db.get("SELECT id,client_ref,reference_namespace,commercial_lifecycle FROM clients WHERE id=?", clientId);
        const relationshipSnapshot = clientId ? await snapshotClientRelationships(db, clientId) : {};
        if (action.clientId && action.type !== "create_project" && canonicalJson(relationshipSnapshot) !== canonicalJson(baseline[action.clientId].relationships)) throw issue(`Relationships changed for Client ${action.clientId}.`, "reconciliation_relationship_changed", 409);
        journal.push({ sequence, action, clientId, before, after, relationshipSnapshot });
        if (failAfterAction === sequence) throw issue("Injected reconciliation failure.", "reconciliation_injected_failure", 500);
      }
      const duplicates = await db.all(`SELECT UPPER(TRIM(client_ref)) reference,COUNT(*) count FROM clients WHERE deleted_at IS NULL AND reference_namespace='live' AND client_ref GLOB 'EF-CL-[0-9][0-9][0-9]' GROUP BY UPPER(TRIM(client_ref)) HAVING COUNT(*)>1`);
      if (duplicates.length) throw issue("Live canonical Client reference uniqueness validation failed.", "reconciliation_uniqueness_failed", 409);
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_live_canonical_ref_unique ON clients(UPPER(TRIM(client_ref))) WHERE deleted_at IS NULL AND reference_namespace='live' AND client_ref GLOB 'EF-CL-[0-9][0-9][0-9]'`);
      const maximum = Number((await db.get(`SELECT MAX(CAST(SUBSTR(client_ref,7,3) AS INTEGER)) maximum FROM clients WHERE deleted_at IS NULL AND reference_namespace='live' AND client_ref GLOB 'EF-CL-[0-9][0-9][0-9]'`))?.maximum || 0);
      await advanceReferenceHighWater(db, { kind: "client", minimum: maximum, now: timestamp });
      if (validateBeforeCommit) await validateBeforeCommit({ db, plan, actions, baseline, journal, maximumClientReference: maximum });
      for (const entry of journal) await db.run(`INSERT INTO client_reference_reconciliation_journal(id,plan_id,sequence,action,client_id,before_json,after_json,relationship_snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`, id(), plan.id, entry.sequence, entry.action.type, entry.clientId, JSON.stringify(entry.before || {}), JSON.stringify(entry.after || {}), JSON.stringify(entry.relationshipSnapshot), timestamp);
      await db.run(`UPDATE client_reference_reconciliation_plans SET status='executed',approved_by=?,approved_at=?,backup_evidence_json=?,executed_at=? WHERE id=?`, approval.approvedBy, approval.approvedAt || timestamp, JSON.stringify(backupEvidence), timestamp, plan.id);
      await db.exec("COMMIT");
      return { planId: plan.id, planHash, status: "executed", actions: journal.length, maximumClientReference: maximum };
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => {});
      throw error;
    }
  }

  async function reconcileProtectedIdentities({ planHash, approval, expectedClientIds }) {
    if (!approval?.approvedBy || approval.planHash !== planHash) throw issue("Explicit approval for this exact protection reconciliation is required.", "reconciliation_approval_required", 403);
    const plan = await db.get("SELECT * FROM client_reference_reconciliation_plans WHERE plan_hash=?", planHash);
    if (!plan || plan.status !== "executed") throw issue("An executed reconciliation plan is required before repairing protected identities.", "reconciliation_plan_unavailable", 404);
    const expected = new Set(expectedClientIds || []), baseline = JSON.parse(plan.baseline_json);
    if (!expected.size || [...expected].some((clientId) => !baseline[clientId])) throw issue("Protected identity repair must use reviewed pre-migration internal Client IDs.", "protected_identity_set_invalid", 422);
    const current = await db.all("SELECT p.client_id,c.client_ref,c.reference_namespace FROM protected_client_identities p JOIN clients c ON c.id=p.client_id ORDER BY p.client_id");
    const unexpected = current.filter((row) => !expected.has(row.client_id));
    for (const row of unexpected) {
      const createdByPlan = await db.get("SELECT 1 found FROM canonical_reference_registry WHERE reference=? AND entity_id=? AND reconciliation_plan_id=? AND allocation_reason='controlled_reconciliation_create'", normalizeRef(row.client_ref), row.client_id, plan.id);
      if (!createdByPlan) throw issue(`Unexpected protected Client ${row.client_id} was not created by the approved reconciliation.`, "protected_identity_repair_unsafe", 409);
    }
    await db.exec("BEGIN IMMEDIATE");
    try {
      const timestamp = now().toISOString();
      let sequence = Number((await db.get("SELECT MAX(sequence) sequence FROM client_reference_reconciliation_journal WHERE plan_id=?", plan.id))?.sequence || 0);
      for (const row of unexpected) {
        await db.run("DELETE FROM protected_client_identities WHERE client_id=?", row.client_id);
        sequence += 1;
        await db.run(`INSERT INTO client_reference_reconciliation_journal(id,plan_id,sequence,action,client_id,before_json,after_json,relationship_snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`, id(), plan.id, sequence, "protected_identity_repair", row.client_id, JSON.stringify({ protected: true, clientRef: row.client_ref }), JSON.stringify({ protected: false, clientRef: row.client_ref }), JSON.stringify({}), timestamp);
      }
      const after = new Set((await db.all("SELECT client_id FROM protected_client_identities")).map((row) => row.client_id));
      if (after.size !== expected.size || [...expected].some((clientId) => !after.has(clientId))) throw issue("Protected internal Client identities do not match the reviewed pre-migration set.", "protected_identity_repair_failed", 409);
      await db.exec("COMMIT");
      return { planId: plan.id, repaired: unexpected.length, protectedClientIds: [...expected].sort() };
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => {});
      throw error;
    }
  }

  return { prepare, execute, reconcileProtectedIdentities };
}
