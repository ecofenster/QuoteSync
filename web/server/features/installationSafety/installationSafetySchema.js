const tables=[
  `CREATE TABLE IF NOT EXISTS installation_rams (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL, project_id TEXT, estimate_id TEXT NOT NULL, order_id TEXT,
    source_revision INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review_required','issued')),
    current_draft_version INTEGER NOT NULL DEFAULT 1, current_issued_version INTEGER,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(estimate_id,source_revision,order_id),
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS installation_rams_versions (
    id TEXT PRIMARY KEY, rams_id TEXT NOT NULL, version INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN('draft','issued','superseded')),
    title TEXT NOT NULL, work_summary TEXT NOT NULL, site_conditions_json TEXT NOT NULL DEFAULT '{}',
    hazards_json TEXT NOT NULL DEFAULT '[]', method_steps_json TEXT NOT NULL DEFAULT '[]', emergency_arrangements TEXT NOT NULL DEFAULT '',
    public_protection TEXT NOT NULL DEFAULT '', waste_arrangements TEXT NOT NULL DEFAULT '', specialist_assessment TEXT NOT NULL DEFAULT '',
    supporting_document_ids_json TEXT NOT NULL DEFAULT '[]', source_snapshot_json TEXT NOT NULL,
    source_fingerprint TEXT NOT NULL, reviewer_name TEXT, reviewer_role TEXT, reviewed_at TEXT,
    competent_person_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(competent_person_confirmed IN(0,1)),
    issued_at TEXT, pdf_storage_key TEXT, pdf_file_name TEXT, pdf_sha256 TEXT, pdf_size_bytes INTEGER,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(rams_id,version), FOREIGN KEY(rams_id) REFERENCES installation_rams(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS installation_rams_briefings (
    id TEXT PRIMARY KEY, rams_id TEXT NOT NULL, rams_version INTEGER NOT NULL, installer_id TEXT,
    person_name TEXT NOT NULL, acknowledged_at TEXT NOT NULL, acknowledgement TEXT NOT NULL,
    recorded_by TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
    FOREIGN KEY(rams_id) REFERENCES installation_rams(id) ON DELETE RESTRICT,
    FOREIGN KEY(installer_id) REFERENCES installation_installers(id) ON DELETE RESTRICT
  )`,
];
const indexes=[
  'CREATE INDEX IF NOT EXISTS idx_installation_rams_estimate ON installation_rams(estimate_id,source_revision,updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_installation_rams_project ON installation_rams(project_id,status,updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_installation_rams_versions ON installation_rams_versions(rams_id,version DESC)',
];
const triggers=[
  `CREATE TRIGGER IF NOT EXISTS trg_installation_rams_issued_immutable_update BEFORE UPDATE ON installation_rams_versions
   WHEN OLD.state IN('issued','superseded') BEGIN SELECT RAISE(ABORT,'Issued RAMS revisions are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_installation_rams_issued_immutable_delete BEFORE DELETE ON installation_rams_versions
   WHEN OLD.state IN('issued','superseded') BEGIN SELECT RAISE(ABORT,'Issued RAMS revisions are immutable'); END`,
];
export async function initializeInstallationSafetySchema(db){for(const sql of tables)await db.exec(sql);for(const sql of indexes)await db.exec(sql);for(const sql of triggers)await db.exec(sql);}
