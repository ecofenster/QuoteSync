import { COMMUNICATION_FOLDER_CHECK_SQL } from "../communications/communicationFolder.js";

const communicationMessagesTableSql = (tableName, ifNotExists = true) => `CREATE TABLE ${ifNotExists ? "IF NOT EXISTS " : ""}${tableName} (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_message_id TEXT,
    provider_thread_id TEXT,
    mailbox_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    folder TEXT NOT NULL CHECK (folder IN (${COMMUNICATION_FOLDER_CHECK_SQL})),
    status TEXT NOT NULL CHECK (status IN ('draft','sending','sent','failed','received')),
    from_json TEXT NOT NULL DEFAULT '[]',
    to_json TEXT NOT NULL DEFAULT '[]',
    cc_json TEXT NOT NULL DEFAULT '[]',
    bcc_json TEXT NOT NULL DEFAULT '[]',
    subject TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    in_reply_to_provider_message_id TEXT,
    links_json TEXT NOT NULL DEFAULT '[]',
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, provider_message_id)
  )`;

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS integration_provider_config (
    provider TEXT PRIMARY KEY,
    client_id TEXT,
    encrypted_client_secret TEXT,
    redirect_uri TEXT,
    capabilities_json TEXT NOT NULL DEFAULT '[]',
    enquiries_root_folder_id TEXT,
    estimates_root_folder_id TEXT,
    orders_root_folder_id TEXT,
    folder_template_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS integration_oauth_connections (
    provider TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('disconnected','connected','error')),
    account_id TEXT,
    account_email TEXT,
    account_name TEXT,
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    token_type TEXT,
    expires_at TEXT,
    scopes_json TEXT NOT NULL DEFAULT '[]',
    error_message TEXT,
    connected_at TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS integration_oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  communicationMessagesTableSql("communication_messages"),
  `CREATE TABLE IF NOT EXISTS communication_attachments (
    id TEXT PRIMARY KEY,
    communication_message_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_key TEXT,
    provider_attachment_id TEXT,
    drive_file_id TEXT,
    sha256 TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (communication_message_id) REFERENCES communication_messages(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS customer_quotation_documents (
    id TEXT PRIMARY KEY,
    estimate_id TEXT NOT NULL,
    quotation_revision INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    projection_sha256 TEXT NOT NULL,
    projection_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS issued_quotations (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    estimate_id TEXT NOT NULL,
    estimate_revision INTEGER NOT NULL,
    quotation_revision INTEGER NOT NULL,
    document_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('prepared_not_sent','issued','failed')),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    provider TEXT,
    provider_message_id TEXT,
    communication_message_id TEXT,
    prepared_at TEXT NOT NULL,
    issued_at TEXT,
    failed_at TEXT,
    failure_reason TEXT,
    commercial_snapshot_json TEXT NOT NULL,
    terms_snapshot TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
    FOREIGN KEY (document_id) REFERENCES customer_quotation_documents(id) ON DELETE RESTRICT,
    FOREIGN KEY (communication_message_id) REFERENCES communication_messages(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    links_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(event_name, evidence_id)
  )`,
  `CREATE TABLE IF NOT EXISTS drive_project_folders (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    estimate_id TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_logical_key TEXT,
    provider_folder_id TEXT NOT NULL,
    provider_account_id TEXT,
    provider_parent_folder_id TEXT,
    folder_path TEXT,
    last_seen_at TEXT,
    last_seen_sync_id TEXT,
    removed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, estimate_id, logical_key),
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS drive_document_links (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    estimate_id TEXT NOT NULL,
    supplier_quote_id TEXT,
    supplier_revision_id TEXT,
    source_attachment_id TEXT,
    quotation_document_id TEXT,
    provider_file_id TEXT NOT NULL,
    provider_folder_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(provider, source_attachment_id),
    UNIQUE(provider, quotation_document_id),
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS drive_discovered_documents (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    provider_file_id TEXT NOT NULL,
    provider_folder_id TEXT,
    estimate_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    project_id TEXT,
    order_id TEXT,
    supplier_id TEXT,
    supplier_name TEXT,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    provider_created_at TEXT,
    provider_modified_at TEXT,
    provider_version TEXT,
    provider_revision TEXT,
    md5_checksum TEXT,
    web_view_link TEXT,
    folder_path TEXT NOT NULL DEFAULT '',
    trashed INTEGER NOT NULL DEFAULT 0 CHECK (trashed IN (0,1)),
    removed_at TEXT,
    discovered_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_seen_sync_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, provider_account_id, provider_file_id),
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS drive_document_sync_states (
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    estimate_id TEXT NOT NULL,
    strategy TEXT NOT NULL DEFAULT 'full_enumeration',
    change_token TEXT,
    status TEXT NOT NULL CHECK (status IN ('syncing','synced','failed')),
    last_attempt_at TEXT NOT NULL,
    last_success_at TEXT,
    error_message TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(provider, provider_account_id, estimate_id),
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
  )`,
];

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_issued_quotations_estimate ON issued_quotations(estimate_id, created_at DESC)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_quotation_document_revision ON customer_quotation_documents(estimate_id, quotation_revision, projection_sha256)",
  "CREATE INDEX IF NOT EXISTS idx_communications_folder ON communication_messages(folder, updated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_drive_folders_estimate ON drive_project_folders(estimate_id, logical_key)",
  "CREATE INDEX IF NOT EXISTS idx_drive_discovered_documents_estimate ON drive_discovered_documents(estimate_id, provider_modified_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_drive_discovered_documents_folder ON drive_discovered_documents(provider, provider_account_id, provider_folder_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_followups_origin_event ON followups(origin_event_id) WHERE origin_event_id IS NOT NULL",
];
const triggers = [
  `CREATE TRIGGER trg_customer_quotation_documents_immutable_update BEFORE UPDATE ON customer_quotation_documents WHEN EXISTS(SELECT 1 FROM issued_quotations WHERE document_id=OLD.id AND status='issued') BEGIN SELECT RAISE(ABORT,'Issued customer quotation documents are immutable'); END`,
  `CREATE TRIGGER trg_customer_quotation_documents_immutable_delete BEFORE DELETE ON customer_quotation_documents WHEN EXISTS(SELECT 1 FROM issued_quotations WHERE document_id=OLD.id AND status='issued') BEGIN SELECT RAISE(ABORT,'Issued customer quotation documents are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_issued_quotations_immutable_after_issue BEFORE UPDATE ON issued_quotations WHEN OLD.status='issued' BEGIN SELECT RAISE(ABORT,'Issued quotation evidence is immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS trg_issued_quotations_no_delete_after_issue BEFORE DELETE ON issued_quotations WHEN OLD.status='issued' BEGIN SELECT RAISE(ABORT,'Issued quotation evidence is immutable'); END`,
];

async function ensureColumn(db, table, name, definition) {
  const columns = await db.all(`PRAGMA table_info(${table})`);
  if (!columns.some((column) => column.name === name)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

async function allowSharedDriveFolderMappings(db) {
  const current = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='drive_project_folders'");
  if (!current?.sql?.includes("UNIQUE(provider, provider_folder_id)")) return;
  await db.exec(`
    BEGIN;
    CREATE TABLE drive_project_folders_next (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      estimate_id TEXT NOT NULL,
      logical_key TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_logical_key TEXT,
      provider_folder_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, estimate_id, logical_key),
      FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
    );
    INSERT INTO drive_project_folders_next SELECT id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,created_at,updated_at FROM drive_project_folders;
    DROP TABLE drive_project_folders;
    ALTER TABLE drive_project_folders_next RENAME TO drive_project_folders;
    COMMIT;
  `);
}

async function expandCommunicationFolderDomain(db) {
  const current = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='communication_messages'");
  if (!current?.sql || (current.sql.includes("'trash'") && current.sql.includes("'spam'"))) return;
  const foreignKeysEnabled = Number((await db.get("PRAGMA foreign_keys"))?.foreign_keys || 0) === 1;
  if (foreignKeysEnabled) await db.exec("PRAGMA foreign_keys=OFF");
  try {
    await db.exec(`
      BEGIN IMMEDIATE;
      ${communicationMessagesTableSql("communication_messages_next", false)};
      INSERT INTO communication_messages_next(id,provider,provider_message_id,provider_thread_id,mailbox_id,direction,folder,status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at)
      SELECT id,provider,provider_message_id,provider_thread_id,mailbox_id,direction,
        CASE lower(folder) WHEN 'inbox' THEN 'inbox' WHEN 'sent' THEN 'sent' WHEN 'drafts' THEN 'drafts' WHEN 'trash' THEN 'trash' WHEN 'bin' THEN 'trash' WHEN 'spam' THEN 'spam' ELSE 'other' END,
        status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at
      FROM communication_messages;
      DROP TABLE communication_messages;
      ALTER TABLE communication_messages_next RENAME TO communication_messages;
      COMMIT;
    `);
  } catch (error) {
    await db.exec("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (foreignKeysEnabled) await db.exec("PRAGMA foreign_keys=ON");
  }
}

export async function initializeWorkflowSchema(db) {
  for (const statement of tableStatements) await db.exec(statement);
  await expandCommunicationFolderDomain(db);
  await allowSharedDriveFolderMappings(db);
  await ensureColumn(db, "drive_project_folders", "provider_account_id", "TEXT");
  await ensureColumn(db, "integration_provider_config", "enquiries_root_folder_id", "TEXT");
  await ensureColumn(db, "drive_project_folders", "provider_parent_folder_id", "TEXT");
  await ensureColumn(db, "drive_project_folders", "folder_path", "TEXT");
  await ensureColumn(db, "drive_project_folders", "last_seen_at", "TEXT");
  await ensureColumn(db, "drive_project_folders", "last_seen_sync_id", "TEXT");
  await ensureColumn(db, "drive_project_folders", "removed_at", "TEXT");
  await ensureColumn(db, "drive_discovered_documents", "client_id", "TEXT");
  await ensureColumn(db, "drive_discovered_documents", "project_id", "TEXT");
  await ensureColumn(db, "drive_discovered_documents", "order_id", "TEXT");
  await ensureColumn(db, "followups", "issued_quotation_id", "TEXT");
  await ensureColumn(db, "followups", "communication_message_id", "TEXT");
  await ensureColumn(db, "followups", "origin_event_id", "TEXT");
  for (const statement of indexes) await db.exec(statement);
  for (const name of ["trg_customer_quotation_documents_immutable_update","trg_customer_quotation_documents_immutable_delete","trg_issued_quotations_immutable_after_issue","trg_issued_quotations_no_delete_after_issue"]) await db.exec(`DROP TRIGGER IF EXISTS ${name}`);
  for (const statement of triggers) await db.exec(statement);
}
