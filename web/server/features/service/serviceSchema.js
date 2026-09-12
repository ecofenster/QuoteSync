const tables = [
  `CREATE TABLE IF NOT EXISTS responsibility_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(trim(name)) > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS responsibility_team_members (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(team_id,user_id),
    FOREIGN KEY(team_id) REFERENCES responsibility_teams(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS responsibility_routing_rules (
    id TEXT PRIMARY KEY,
    responsibility_area TEXT NOT NULL CHECK(responsibility_area IN ('enquiries','estimates','orders','completed_aftercare','lost_reengagement','service')),
    case_type TEXT NOT NULL DEFAULT '',
    team_id TEXT NOT NULL,
    default_assignee_id TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES responsibility_teams(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS record_assignments (
    record_kind TEXT NOT NULL,
    record_id TEXT NOT NULL,
    responsibility_area TEXT NOT NULL,
    team_id TEXT,
    team_name TEXT,
    assignee_id TEXT,
    assignee_name TEXT,
    routing_state TEXT NOT NULL CHECK(routing_state IN ('assigned','unassigned','retained')),
    assigned_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(record_kind,record_id)
  )`,
  `CREATE TABLE IF NOT EXISTS assignment_history (
    id TEXT PRIMARY KEY,
    record_kind TEXT NOT NULL,
    record_id TEXT NOT NULL,
    responsibility_area TEXT NOT NULL,
    from_team_id TEXT,
    from_assignee_id TEXT,
    to_team_id TEXT,
    to_assignee_id TEXT,
    reason TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS service_sla_policies (
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    publication_state TEXT NOT NULL CHECK(publication_state IN ('proposal','active_internal','approved_customer')),
    priority TEXT NOT NULL DEFAULT '',
    case_type TEXT NOT NULL DEFAULT '',
    team_id TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL,
    business_hours_json TEXT NOT NULL,
    holidays_json TEXT NOT NULL,
    targets_json TEXT NOT NULL,
    pause_rules_json TEXT NOT NULL,
    escalation_team_id TEXT,
    escalation_owner_id TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(id,version)
  )`,
  `CREATE TABLE IF NOT EXISTS service_cases (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    service_ref TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    project_id TEXT,
    order_id TEXT,
    position_ids_json TEXT NOT NULL DEFAULT '[]',
    case_type TEXT NOT NULL DEFAULT 'service',
    issue_summary TEXT NOT NULL,
    description TEXT NOT NULL,
    reported_at TEXT NOT NULL,
    first_noticed_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('new','under_review','awaiting','resolved','closed')),
    priority TEXT NOT NULL CHECK(priority IN ('low','normal','high','urgent')),
    waiting_on TEXT NOT NULL CHECK(waiting_on IN ('none','customer','supplier','internal')),
    team_id TEXT,
    team_name TEXT,
    assignee_id TEXT,
    assignee_name TEXT,
    next_action TEXT NOT NULL DEFAULT '',
    next_action_due_at TEXT,
    warranty_state TEXT NOT NULL CHECK(warranty_state IN ('not_assessed','potentially_covered','evidence_required','outside_supplier_terms','staff_confirmed')),
    warranty_assessment_json TEXT NOT NULL DEFAULT '{}',
    resolution TEXT NOT NULL DEFAULT '',
    policy_id TEXT,
    policy_version INTEGER,
    policy_snapshot_json TEXT,
    idempotency_scope TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    closed_at TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS service_case_events (
    id TEXT PRIMARY KEY,
    service_case_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('customer','internal')),
    body TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    actor_type TEXT NOT NULL CHECK(actor_type IN ('staff','customer','system')),
    actor_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    idempotency_scope TEXT NOT NULL UNIQUE,
    FOREIGN KEY(service_case_id) REFERENCES service_cases(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS service_case_attachments (
    id TEXT PRIMARY KEY,
    service_case_id TEXT NOT NULL,
    event_id TEXT,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT,
    visibility TEXT NOT NULL CHECK(visibility IN ('customer','internal')),
    file_name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    content BLOB NOT NULL,
    uploaded_by_type TEXT NOT NULL CHECK(uploaded_by_type IN ('staff','customer')),
    uploaded_by_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(service_case_id) REFERENCES service_cases(id) ON DELETE RESTRICT,
    FOREIGN KEY(event_id) REFERENCES service_case_events(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS service_case_timers (
    id TEXT PRIMARY KEY,
    service_case_id TEXT NOT NULL,
    cycle INTEGER NOT NULL DEFAULT 1,
    target_key TEXT NOT NULL CHECK(target_key IN ('first_response','customer_update','assessment_plan','resolution')),
    target_minutes INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    due_at TEXT NOT NULL,
    paused_at TEXT,
    accumulated_pause_minutes INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    state TEXT NOT NULL CHECK(state IN ('running','paused','completed','breached')),
    last_calculated_at TEXT NOT NULL,
    UNIQUE(service_case_id,cycle,target_key),
    FOREIGN KEY(service_case_id) REFERENCES service_cases(id) ON DELETE RESTRICT
  )`
];

const indexes = [
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_responsibility_route_unique ON responsibility_routing_rules(responsibility_area,case_type) WHERE active=1",
  "CREATE INDEX IF NOT EXISTS idx_record_assignments_queue ON record_assignments(responsibility_area,routing_state,team_id,assignee_id)",
  "CREATE INDEX IF NOT EXISTS idx_service_case_queue ON service_cases(status,priority,team_id,assignee_id,next_action_due_at)",
  "CREATE INDEX IF NOT EXISTS idx_service_case_client ON service_cases(tenant_id,client_id,project_id,created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_service_events_case ON service_case_events(service_case_id,occurred_at,id)",
  "CREATE INDEX IF NOT EXISTS idx_service_attachments_case ON service_case_attachments(service_case_id,created_at,id)",
  "CREATE INDEX IF NOT EXISTS idx_service_timers_due ON service_case_timers(state,due_at)"
];

const triggers = [
  `CREATE TRIGGER IF NOT EXISTS trg_service_reference_immutable BEFORE UPDATE OF service_ref ON service_cases
   WHEN OLD.service_ref <> NEW.service_ref BEGIN SELECT RAISE(ABORT,'Service reference is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_service_event_immutable_update BEFORE UPDATE ON service_case_events BEGIN SELECT RAISE(ABORT,'Service history is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_service_event_immutable_delete BEFORE DELETE ON service_case_events BEGIN SELECT RAISE(ABORT,'Service history is immutable'); END`
];

export async function initializeServiceSchema(db) {
  for (const sql of tables) await db.exec(sql);
  for (const sql of indexes) await db.exec(sql);
  for (const sql of triggers) await db.exec(sql);
}
