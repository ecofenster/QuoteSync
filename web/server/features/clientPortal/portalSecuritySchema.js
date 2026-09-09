const statements = [
  `CREATE TABLE IF NOT EXISTS portal_feature_controls (
    tenant_id TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(tenant_id, feature_key)
  )`,
  `CREATE TABLE IF NOT EXISTS portal_contacts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','revoked')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, client_id, email_normalized),
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_identities (
    id TEXT PRIMARY KEY,
    portal_contact_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_subject TEXT NOT NULL,
    verified_email_normalized TEXT NOT NULL,
    linked_at TEXT NOT NULL,
    last_authenticated_at TEXT,
    UNIQUE(provider, provider_subject),
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_project_grants (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    portal_contact_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    access_role TEXT NOT NULL DEFAULT 'reviewer' CHECK(access_role IN ('viewer','reviewer','delegate')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_by TEXT,
    revoked_at TEXT,
    UNIQUE(portal_contact_id, project_id),
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_invitations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    portal_contact_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    revoked_by TEXT,
    revoked_at TEXT,
    access_role TEXT NOT NULL DEFAULT 'reviewer' CHECK(access_role IN ('viewer','reviewer','delegate')),
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_sessions (
    id TEXT PRIMARY KEY,
    portal_contact_id TEXT NOT NULL,
    portal_identity_id TEXT NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    csrf_token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    idle_expires_at TEXT NOT NULL,
    absolute_expires_at TEXT NOT NULL,
    revoked_at TEXT,
    revoked_reason TEXT,
    rotated_from_session_id TEXT,
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT,
    FOREIGN KEY(portal_identity_id) REFERENCES portal_identities(id) ON DELETE RESTRICT,
    FOREIGN KEY(rotated_from_session_id) REFERENCES portal_sessions(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS estimate_revision_releases (
    id TEXT PRIMARY KEY,
    issued_quotation_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    estimate_id TEXT NOT NULL,
    estimate_revision INTEGER NOT NULL,
    recipient_portal_contact_id TEXT,
    document_id TEXT NOT NULL,
    estimate_snapshot_json TEXT NOT NULL,
    customer_projection_json TEXT NOT NULL,
    commercial_snapshot_json TEXT NOT NULL,
    terms_snapshot TEXT,
    release_sha256 TEXT NOT NULL,
    released_by TEXT NOT NULL,
    released_at TEXT NOT NULL,
    UNIQUE(estimate_id, estimate_revision),
    FOREIGN KEY(issued_quotation_id) REFERENCES issued_quotations(id) ON DELETE RESTRICT,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
    FOREIGN KEY(recipient_portal_contact_id) REFERENCES portal_contacts(id) ON DELETE SET NULL,
    FOREIGN KEY(document_id) REFERENCES customer_quotation_documents(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS estimate_revision_lineage (
    id TEXT PRIMARY KEY,
    source_release_id TEXT NOT NULL UNIQUE,
    successor_estimate_id TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(source_release_id) REFERENCES estimate_revision_releases(id) ON DELETE RESTRICT,
    FOREIGN KEY(successor_estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_resource_releases (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('estimate','document','comparison','order')),
    resource_id TEXT NOT NULL,
    resource_revision TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'released' CHECK(status IN ('released','revoked')),
    released_by TEXT NOT NULL,
    released_at TEXT NOT NULL,
    revoked_by TEXT,
    revoked_at TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(tenant_id, project_id, resource_type, resource_id, resource_revision)
  )`,
  `CREATE TABLE IF NOT EXISTS portal_commands (
    id TEXT PRIMARY KEY,
    command_type TEXT NOT NULL CHECK(command_type IN ('review_submit','decline_estimate','intent_to_proceed')),
    idempotency_key_hash TEXT NOT NULL,
    request_sha256 TEXT NOT NULL,
    portal_session_id TEXT NOT NULL,
    portal_contact_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_revision TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
    result_json TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE(portal_contact_id, command_type, idempotency_key_hash),
    FOREIGN KEY(portal_session_id) REFERENCES portal_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_review_submissions (
    id TEXT PRIMARY KEY,
    portal_command_id TEXT NOT NULL UNIQUE,
    estimate_release_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    portal_contact_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','staff_reviewing','revision_created','closed')),
    general_comment TEXT NOT NULL DEFAULT '',
    submitted_at TEXT NOT NULL,
    UNIQUE(estimate_release_id, portal_contact_id),
    FOREIGN KEY(portal_command_id) REFERENCES portal_commands(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_release_id) REFERENCES estimate_revision_releases(id) ON DELETE RESTRICT,
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_review_position_entries (
    id TEXT PRIMARY KEY,
    review_submission_id TEXT NOT NULL,
    estimate_position_id TEXT NOT NULL,
    position_reference TEXT NOT NULL,
    response TEXT NOT NULL CHECK(response IN ('accepted_as_shown','amendment_requested','question_comment')),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(review_submission_id, estimate_position_id),
    FOREIGN KEY(review_submission_id) REFERENCES portal_review_submissions(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_estimate_decisions (
    id TEXT PRIMARY KEY,
    portal_command_id TEXT NOT NULL UNIQUE,
    estimate_release_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    portal_contact_id TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK(decision_type IN ('declined','intent_to_proceed')),
    decline_reason TEXT CHECK(decline_reason IN ('cost','confidence','chose_another_supplier','other')),
    optional_supplier_name TEXT,
    detail TEXT NOT NULL DEFAULT '',
    decided_at TEXT NOT NULL,
    UNIQUE(estimate_release_id, portal_contact_id, decision_type),
    FOREIGN KEY(portal_command_id) REFERENCES portal_commands(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_release_id) REFERENCES estimate_revision_releases(id) ON DELETE RESTRICT,
    FOREIGN KEY(portal_contact_id) REFERENCES portal_contacts(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK(actor_type IN ('staff','external_contact','system')),
    actor_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    client_id TEXT,
    project_id TEXT,
    resource_type TEXT,
    resource_id TEXT,
    portal_command_id TEXT,
    occurred_at TEXT NOT NULL,
    safe_metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(portal_command_id) REFERENCES portal_commands(id) ON DELETE RESTRICT
  )`,
];

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_portal_contacts_client ON portal_contacts(tenant_id, client_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_portal_grants_project ON portal_project_grants(tenant_id, project_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_portal_invitations_contact ON portal_invitations(portal_contact_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_portal_sessions_contact ON portal_sessions(portal_contact_id, status, absolute_expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_estimate_releases_project ON estimate_revision_releases(tenant_id, project_id, released_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_portal_resource_release ON portal_resource_releases(tenant_id, project_id, resource_type, status)",
  "CREATE INDEX IF NOT EXISTS idx_portal_audit_scope ON portal_audit_events(tenant_id, client_id, project_id, occurred_at DESC)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_review_one_submission ON portal_review_submissions(estimate_release_id, portal_contact_id)",
];

const immutableTriggers = [
  `CREATE TRIGGER IF NOT EXISTS trg_estimate_revision_release_immutable_update BEFORE UPDATE ON estimate_revision_releases BEGIN SELECT RAISE(ABORT,'Issued Estimate release evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_estimate_revision_release_immutable_delete BEFORE DELETE ON estimate_revision_releases BEGIN SELECT RAISE(ABORT,'Issued Estimate release evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_portal_review_submission_immutable_update BEFORE UPDATE ON portal_review_submissions BEGIN SELECT RAISE(ABORT,'Submitted customer review evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_portal_review_submission_immutable_delete BEFORE DELETE ON portal_review_submissions BEGIN SELECT RAISE(ABORT,'Submitted customer review evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_portal_review_position_immutable_update BEFORE UPDATE ON portal_review_position_entries BEGIN SELECT RAISE(ABORT,'Submitted customer review evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_portal_review_position_immutable_delete BEFORE DELETE ON portal_review_position_entries BEGIN SELECT RAISE(ABORT,'Submitted customer review evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_portal_estimate_decision_immutable_update BEFORE UPDATE ON portal_estimate_decisions BEGIN SELECT RAISE(ABORT,'Customer Estimate decision evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_portal_estimate_decision_immutable_delete BEFORE DELETE ON portal_estimate_decisions BEGIN SELECT RAISE(ABORT,'Customer Estimate decision evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_released_estimate_immutable_update BEFORE UPDATE ON estimates
    WHEN EXISTS(SELECT 1 FROM estimate_revision_releases r WHERE r.estimate_id=OLD.id AND r.estimate_revision=OLD.revision_no)
    BEGIN SELECT RAISE(ABORT,'Issued Estimate revision is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_released_estimate_immutable_delete BEFORE DELETE ON estimates
    WHEN EXISTS(SELECT 1 FROM estimate_revision_releases r WHERE r.estimate_id=OLD.id AND r.estimate_revision=OLD.revision_no)
    BEGIN SELECT RAISE(ABORT,'Issued Estimate revision is immutable'); END`,
];

async function protectEstimateCostingTables(db) {
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_calculator_%'");
  for (const { name } of tables) {
    if (name === "project_calculator_lab_scenarios") continue;
    const columns = await db.all(`PRAGMA table_info("${name}")`);
    if (!columns.some((column) => column.name === "scenario_id")) continue;
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      const ref = operation === "DELETE" ? "OLD" : "NEW";
      const trigger = `trg_released_estimate_${name}_${operation.toLowerCase()}`;
      await db.exec(`CREATE TRIGGER IF NOT EXISTS "${trigger}" BEFORE ${operation} ON "${name}"
        WHEN EXISTS(
          SELECT 1 FROM project_calculator_lab_scenarios s
          JOIN estimates e ON e.id=s.estimate_id
          JOIN estimate_revision_releases r ON r.estimate_id=e.id AND r.estimate_revision=e.revision_no
          WHERE s.id=${ref}.scenario_id
        )
        BEGIN SELECT RAISE(ABORT,'Issued Estimate revision costing is immutable'); END`);
    }
  }
  const scenario = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='project_calculator_lab_scenarios'");
  if (scenario) {
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      const ref = operation === "DELETE" ? "OLD" : "NEW";
      await db.exec(`CREATE TRIGGER IF NOT EXISTS "trg_released_estimate_scenario_${operation.toLowerCase()}" BEFORE ${operation} ON project_calculator_lab_scenarios
        WHEN ${ref}.estimate_id IS NOT NULL AND EXISTS(
          SELECT 1 FROM estimates e JOIN estimate_revision_releases r ON r.estimate_id=e.id AND r.estimate_revision=e.revision_no
          WHERE e.id=${ref}.estimate_id
        )
        BEGIN SELECT RAISE(ABORT,'Issued Estimate revision costing is immutable'); END`);
    }
  }
}

export async function initializePortalSecuritySchema(db) {
  for (const statement of statements) await db.exec(statement);
  const invitationColumns = await db.all("PRAGMA table_info('portal_invitations')");
  if (!invitationColumns.some((column) => column.name === "access_role")) {
    await db.exec("ALTER TABLE portal_invitations ADD COLUMN access_role TEXT NOT NULL DEFAULT 'reviewer' CHECK(access_role IN ('viewer','reviewer','delegate'))");
  }
  for (const statement of indexes) await db.exec(statement);
  for (const statement of immutableTriggers) await db.exec(statement);
  await protectEstimateCostingTables(db);
}
