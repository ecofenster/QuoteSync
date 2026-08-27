async function ensureColumn(db, table, name, definition) {
  const columns = await db.all(`PRAGMA table_info("${table}")`);
  if (!columns.some((column) => column.name === name)) await db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
}

export async function initializeCommercialIdentitySchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_reference_sequences (
      reference_kind TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      last_value INTEGER NOT NULL DEFAULT 0 CHECK(last_value >= 0),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(reference_kind, scope_key)
    );
    CREATE TABLE IF NOT EXISTS canonical_reference_registry (
      reference TEXT PRIMARY KEY,
      reference_kind TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      allocated_at TEXT NOT NULL,
      allocation_reason TEXT NOT NULL,
      reconciliation_plan_id TEXT
    );
    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY,
      enquiry_ref TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','qualified','closed','converted')),
      source TEXT NOT NULL DEFAULT '',
      lead_source TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telephone TEXT NOT NULL DEFAULT '',
      project_name TEXT NOT NULL DEFAULT '',
      site_address TEXT NOT NULL DEFAULT '',
      site_address_json TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '',
      qualification_mode TEXT CHECK(qualification_mode IN ('existing_client','new_client')),
      converted_client_id TEXT,
      converted_project_id TEXT,
      drive_transition_status TEXT NOT NULL DEFAULT 'pending' CHECK(drive_transition_status IN ('pending','linked','failed','not_required')),
      conversion_evidence_json TEXT NOT NULL DEFAULT '{}',
      qualified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY(converted_client_id) REFERENCES clients(id) ON DELETE RESTRICT,
      FOREIGN KEY(converted_project_id) REFERENCES projects(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      source_enquiry_id TEXT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','completed','cancelled','review')),
      context_year INTEGER,
      site_address TEXT NOT NULL DEFAULT '',
      site_address_json TEXT NOT NULL DEFAULT '{}',
      postcode TEXT NOT NULL DEFAULT '',
      what3words TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
      FOREIGN KEY(source_enquiry_id) REFERENCES enquiries(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_ref TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      source_estimate_id TEXT NOT NULL,
      source_estimate_revision INTEGER NOT NULL,
      accepted_commercial_snapshot_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
      FOREIGN KEY(source_estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS canonical_drive_folders (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_account_id TEXT,
      entity_kind TEXT NOT NULL CHECK(entity_kind IN ('enquiry','client','project','estimate','order')),
      entity_id TEXT NOT NULL,
      logical_key TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_logical_key TEXT,
      provider_folder_id TEXT NOT NULL,
      provider_parent_folder_id TEXT,
      folder_path TEXT NOT NULL DEFAULT '',
      provenance TEXT NOT NULL DEFAULT 'quotesuite',
      last_seen_at TEXT,
      removed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, entity_kind, entity_id, logical_key)
    );
    CREATE TABLE IF NOT EXISTS canonical_documents (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      provider_file_id TEXT NOT NULL,
      provider_folder_id TEXT,
      enquiry_id TEXT,
      client_id TEXT,
      project_id TEXT,
      estimate_id TEXT,
      order_id TEXT,
      supplier_id TEXT,
      supplier_quotation_id TEXT,
      document_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      provider_created_at TEXT,
      provider_modified_at TEXT,
      provider_version TEXT,
      provider_revision TEXT,
      checksum TEXT,
      web_view_link TEXT,
      folder_path TEXT NOT NULL DEFAULT '',
      trashed INTEGER NOT NULL DEFAULT 0 CHECK(trashed IN (0,1)),
      removed_at TEXT,
      discovered_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(enquiry_id IS NOT NULL OR client_id IS NOT NULL OR project_id IS NOT NULL OR estimate_id IS NOT NULL OR order_id IS NOT NULL OR supplier_id IS NOT NULL OR supplier_quotation_id IS NOT NULL),
      UNIQUE(provider, provider_account_id, provider_file_id),
      FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE SET NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE SET NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS protected_client_identities (
      client_id TEXT PRIMARY KEY,
      protection_reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS commercial_identity_bootstrap_markers (
      marker TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS client_reference_reconciliation_plans (
      id TEXT PRIMARY KEY,
      plan_version TEXT NOT NULL,
      plan_hash TEXT NOT NULL UNIQUE,
      drive_inventory_hash TEXT NOT NULL,
      matrix_json TEXT NOT NULL,
      baseline_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('prepared','executed','failed')),
      approved_by TEXT,
      approved_at TEXT,
      backup_evidence_json TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS client_reference_reconciliation_journal (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      action TEXT NOT NULL,
      client_id TEXT,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      relationship_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(plan_id, sequence),
      FOREIGN KEY(plan_id) REFERENCES client_reference_reconciliation_plans(id) ON DELETE RESTRICT
    );
    CREATE TRIGGER IF NOT EXISTS trg_orders_client_commercial_lifecycle
      AFTER INSERT ON orders
      BEGIN
        UPDATE clients
        SET commercial_lifecycle=CASE WHEN (SELECT COUNT(*) FROM orders WHERE client_id=NEW.client_id)>1 THEN 'repeat_customer' ELSE 'customer' END,
            updated_at=NEW.created_at
        WHERE id=NEW.client_id;
      END;
  `);

  await ensureColumn(db, "clients", "commercial_lifecycle", "TEXT NOT NULL DEFAULT 'unknown_review'");
  await ensureColumn(db, "clients", "reference_namespace", "TEXT NOT NULL DEFAULT 'live'");
  await ensureColumn(db, "clients", "updated_at", "TEXT");
  await ensureColumn(db, "estimates", "project_id", "TEXT");
  await ensureColumn(db, "integration_provider_config", "enquiries_root_folder_id", "TEXT");
  await ensureColumn(db, "drive_discovered_documents", "enquiry_id", "TEXT");

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id, context_year, created_at);
    CREATE INDEX IF NOT EXISTS idx_estimates_project ON estimates(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_project ON orders(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_canonical_documents_client ON canonical_documents(client_id, provider_modified_at DESC);
    CREATE INDEX IF NOT EXISTS idx_canonical_documents_project ON canonical_documents(project_id, provider_modified_at DESC);
    CREATE INDEX IF NOT EXISTS idx_canonical_documents_estimate ON canonical_documents(estimate_id, provider_modified_at DESC);
    CREATE INDEX IF NOT EXISTS idx_clients_live_canonical_ref_lookup
      ON clients(UPPER(TRIM(client_ref)))
      WHERE deleted_at IS NULL AND reference_namespace='live' AND client_ref GLOB 'EF-CL-[0-9][0-9][0-9]';
  `);

  const timestamp = new Date().toISOString();
  const protectionSeeded = await db.get("SELECT 1 found FROM commercial_identity_bootstrap_markers WHERE marker='historical_protected_client_ids_seeded'");
  if (!protectionSeeded) {
    await db.run(`INSERT OR IGNORE INTO protected_client_identities(client_id,protection_reason,created_at)
      SELECT id,'Historical live Client protected before controlled reconciliation',?
      FROM clients WHERE UPPER(TRIM(client_ref)) IN ('EF-CL-001','EF-CL-002','EF-CL-003','EF-CL-004','EF-CL-005','EF-CL-006','EF-CL-007','EF-CL-008')`, timestamp);
    await db.run("INSERT INTO commercial_identity_bootstrap_markers(marker,applied_at) VALUES('historical_protected_client_ids_seeded',?)", timestamp);
  }
  await db.run(`INSERT OR IGNORE INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason)
    SELECT UPPER(TRIM(client_ref)),'client',id,COALESCE(created_at,?),'legacy_seed'
    FROM clients WHERE client_ref GLOB 'EF-CL-[0-9][0-9][0-9]'`, timestamp);
  await db.run(`INSERT OR IGNORE INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason)
    SELECT UPPER(TRIM(enquiry_ref)),'enquiry',id,COALESCE(created_at,?),'legacy_seed'
    FROM enquiries WHERE enquiry_ref GLOB 'EF-ENQ-[0-9][0-9][0-9]'`, timestamp);
  await db.run(`INSERT OR IGNORE INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason)
    SELECT UPPER(TRIM(estimate_ref)),'estimate',id,COALESCE(created_at,?),'legacy_seed'
    FROM estimates WHERE estimate_ref GLOB 'EF-EST-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]*'`, timestamp);
  await db.run(`INSERT OR IGNORE INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason)
    SELECT UPPER(TRIM(order_ref)),'order',id,COALESCE(created_at,?),'legacy_seed'
    FROM orders WHERE order_ref GLOB 'EF-ORD-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'`, timestamp);
  await db.run(`INSERT INTO canonical_reference_sequences(reference_kind,scope_key,last_value,updated_at)
    SELECT 'client','global',COALESCE(MAX(CAST(SUBSTR(client_ref,7,3) AS INTEGER)),0),? FROM clients WHERE client_ref GLOB 'EF-CL-[0-9][0-9][0-9]'
    ON CONFLICT(reference_kind,scope_key) DO UPDATE SET last_value=MAX(canonical_reference_sequences.last_value,excluded.last_value),updated_at=excluded.updated_at`, timestamp);
  await db.run(`INSERT INTO canonical_reference_sequences(reference_kind,scope_key,last_value,updated_at)
    SELECT 'enquiry','global',COALESCE(MAX(CAST(SUBSTR(enquiry_ref,8,3) AS INTEGER)),0),? FROM enquiries WHERE enquiry_ref GLOB 'EF-ENQ-[0-9][0-9][0-9]'
    ON CONFLICT(reference_kind,scope_key) DO UPDATE SET last_value=MAX(canonical_reference_sequences.last_value,excluded.last_value),updated_at=excluded.updated_at`, timestamp);
  const estimateYears = await db.all(`SELECT SUBSTR(estimate_ref,8,4) year,MAX(CAST(SUBSTR(estimate_ref,13,3) AS INTEGER)) maximum FROM estimates WHERE estimate_ref GLOB 'EF-EST-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]*' GROUP BY SUBSTR(estimate_ref,8,4)`);
  for (const row of estimateYears) await db.run(`INSERT INTO canonical_reference_sequences(reference_kind,scope_key,last_value,updated_at) VALUES('estimate',?,?,?) ON CONFLICT(reference_kind,scope_key) DO UPDATE SET last_value=MAX(canonical_reference_sequences.last_value,excluded.last_value),updated_at=excluded.updated_at`, row.year, Number(row.maximum || 0), timestamp);
  const orderYears = await db.all(`SELECT SUBSTR(order_ref,8,4) year,MAX(CAST(SUBSTR(order_ref,13,3) AS INTEGER)) maximum FROM orders WHERE order_ref GLOB 'EF-ORD-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]' GROUP BY SUBSTR(order_ref,8,4)`);
  for (const row of orderYears) await db.run(`INSERT INTO canonical_reference_sequences(reference_kind,scope_key,last_value,updated_at) VALUES('order',?,?,?) ON CONFLICT(reference_kind,scope_key) DO UPDATE SET last_value=MAX(canonical_reference_sequences.last_value,excluded.last_value),updated_at=excluded.updated_at`, row.year, Number(row.maximum || 0), timestamp);
}
