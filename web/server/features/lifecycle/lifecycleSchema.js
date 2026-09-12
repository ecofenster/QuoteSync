const statements = [
  `CREATE TABLE IF NOT EXISTS enquiry_email_intakes (
    id TEXT PRIMARY KEY,enquiry_id TEXT NOT NULL UNIQUE,communication_message_id TEXT NOT NULL UNIQUE,provider_message_id TEXT,
    reviewed_brief TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
    FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE RESTRICT,
    FOREIGN KEY(communication_message_id) REFERENCES communication_messages(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS enquiry_intake_attachments (
    id TEXT PRIMARY KEY,enquiry_email_intake_id TEXT NOT NULL,communication_attachment_id TEXT NOT NULL,file_name TEXT NOT NULL,
    storage_status TEXT NOT NULL DEFAULT 'pending' CHECK(storage_status IN ('pending','stored','failed','not_selected')),canonical_document_id TEXT,error_code TEXT,
    UNIQUE(enquiry_email_intake_id,communication_attachment_id),
    FOREIGN KEY(enquiry_email_intake_id) REFERENCES enquiry_email_intakes(id) ON DELETE RESTRICT,
    FOREIGN KEY(communication_attachment_id) REFERENCES communication_attachments(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS supplier_revision_requests (
    id TEXT PRIMARY KEY,review_submission_id TEXT NOT NULL UNIQUE,source_release_id TEXT NOT NULL,successor_estimate_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','sent','cancelled')),recipient TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,summary_json TEXT NOT NULL,document_ids_json TEXT NOT NULL DEFAULT '[]',communication_message_id TEXT,
    created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(review_submission_id) REFERENCES portal_review_submissions(id) ON DELETE RESTRICT,
    FOREIGN KEY(source_release_id) REFERENCES estimate_revision_releases(id) ON DELETE RESTRICT,
    FOREIGN KEY(successor_estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS supplier_enquiry_drafts (
    id TEXT PRIMARY KEY,project_id TEXT NOT NULL,estimate_id TEXT,supplier_id TEXT,recipient TEXT NOT NULL,subject TEXT NOT NULL,body_text TEXT NOT NULL,
    document_ids_json TEXT NOT NULL DEFAULT '[]',document_snapshot_json TEXT NOT NULL DEFAULT '[]',communication_message_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','sent','cancelled')),
    idempotency_key TEXT,content_sha256 TEXT,revision_no INTEGER NOT NULL DEFAULT 1,supersedes_id TEXT,
    created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
    FOREIGN KEY(communication_message_id) REFERENCES communication_messages(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS supplier_revision_documents (
    id TEXT PRIMARY KEY,supplier_revision_request_id TEXT NOT NULL UNIQUE,file_name TEXT NOT NULL,media_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,size_bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,snapshot_sha256 TEXT NOT NULL,snapshot_json TEXT NOT NULL,created_at TEXT NOT NULL,
    FOREIGN KEY(supplier_revision_request_id) REFERENCES supplier_revision_requests(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS manufacturer_response_links (
    id TEXT PRIMARY KEY,project_id TEXT NOT NULL,estimate_id TEXT,supplier_enquiry_id TEXT,communication_message_id TEXT NOT NULL,canonical_document_id TEXT,
    status TEXT NOT NULL DEFAULT 'ready_for_import' CHECK(status IN ('ready_for_import','imported','review_required')),created_by TEXT NOT NULL,created_at TEXT NOT NULL,
    UNIQUE(project_id,communication_message_id,canonical_document_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
    FOREIGN KEY(supplier_enquiry_id) REFERENCES supplier_enquiry_drafts(id) ON DELETE RESTRICT,
    FOREIGN KEY(communication_message_id) REFERENCES communication_messages(id) ON DELETE RESTRICT,
    FOREIGN KEY(canonical_document_id) REFERENCES canonical_documents(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS revision_change_checks (
    id TEXT PRIMARY KEY,supplier_revision_request_id TEXT NOT NULL,estimate_position_id TEXT,field_key TEXT NOT NULL,
    requested_change TEXT NOT NULL,before_value TEXT,expected_value TEXT,after_value TEXT,
    status TEXT NOT NULL CHECK(status IN ('implemented','not_implemented','needs_review','approved_difference')),
    before_source_reference TEXT,after_source_reference TEXT,resolution_note TEXT NOT NULL DEFAULT '',resolved_by TEXT,resolved_at TEXT,
    created_at TEXT NOT NULL,UNIQUE(supplier_revision_request_id,estimate_position_id,field_key),
    FOREIGN KEY(supplier_revision_request_id) REFERENCES supplier_revision_requests(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS order_staff_approvals (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE,approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_order_requests (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','sent','cancelled')),
    recipient TEXT NOT NULL,subject TEXT NOT NULL,body_text TEXT NOT NULL,document_ids_json TEXT NOT NULL DEFAULT '[]',
    communication_message_id TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_confirmations (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL,canonical_document_id TEXT NOT NULL,revision TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'staff_review' CHECK(status IN ('staff_review','review_resolved','released','superseded')),
    source_sha256 TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(order_id,canonical_document_id,revision),
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    FOREIGN KEY(canonical_document_id) REFERENCES canonical_documents(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_confirmation_checks (
    id TEXT PRIMARY KEY,factory_confirmation_id TEXT NOT NULL,estimate_position_id TEXT NOT NULL,field_key TEXT NOT NULL,
    approved_value TEXT,confirmed_value TEXT,status TEXT NOT NULL CHECK(status IN ('no_change','change_detected','needs_review','approved_difference')),
    approved_source_reference TEXT,confirmation_source_reference TEXT,resolution_note TEXT NOT NULL DEFAULT '',resolved_by TEXT,resolved_at TEXT,
    UNIQUE(factory_confirmation_id,estimate_position_id,field_key),FOREIGN KEY(factory_confirmation_id) REFERENCES factory_confirmations(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_confirmation_releases (
    id TEXT PRIMARY KEY,factory_confirmation_id TEXT NOT NULL UNIQUE,project_id TEXT NOT NULL,released_by TEXT NOT NULL,released_at TEXT NOT NULL,
    FOREIGN KEY(factory_confirmation_id) REFERENCES factory_confirmations(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_confirmation_signoffs (
    id TEXT PRIMARY KEY,factory_confirmation_release_id TEXT NOT NULL UNIQUE,portal_contact_id TEXT,overall_approved INTEGER NOT NULL CHECK(overall_approved IN (0,1)),
    signed_pdf_document_id TEXT,signed_pdf_reviewed_by TEXT,signed_pdf_reviewed_at TEXT,approved_at TEXT NOT NULL,
    FOREIGN KEY(factory_confirmation_release_id) REFERENCES factory_confirmation_releases(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_confirmation_position_approvals (
    id TEXT PRIMARY KEY,signoff_id TEXT NOT NULL,estimate_position_id TEXT NOT NULL,approved INTEGER NOT NULL CHECK(approved IN (0,1)),created_at TEXT NOT NULL,
    UNIQUE(signoff_id,estimate_position_id),FOREIGN KEY(signoff_id) REFERENCES factory_confirmation_signoffs(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS factory_confirmation_signed_pdf_reviews (
    id TEXT PRIMARY KEY,factory_confirmation_release_id TEXT NOT NULL,signed_pdf_document_id TEXT NOT NULL,
    reviewed_by TEXT NOT NULL,reviewed_at TEXT NOT NULL,overall_approved INTEGER NOT NULL CHECK(overall_approved IN (0,1)),
    position_ids_json TEXT NOT NULL,UNIQUE(factory_confirmation_release_id,signed_pdf_document_id),
    FOREIGN KEY(factory_confirmation_release_id) REFERENCES factory_confirmation_releases(id) ON DELETE RESTRICT,
    FOREIGN KEY(signed_pdf_document_id) REFERENCES canonical_documents(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS customer_lifecycle_documents (
    id TEXT PRIMARY KEY,document_kind TEXT NOT NULL CHECK(document_kind IN ('order','final_confirmation')),
    owner_id TEXT NOT NULL,client_id TEXT NOT NULL,project_id TEXT NOT NULL,order_id TEXT NOT NULL,revision TEXT NOT NULL,
    file_name TEXT NOT NULL,media_type TEXT NOT NULL,storage_key TEXT NOT NULL,size_bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,
    source_estimate_document_id TEXT NOT NULL,projection_sha256 TEXT NOT NULL,projection_json TEXT NOT NULL,context_json TEXT NOT NULL,created_at TEXT NOT NULL,
    UNIQUE(document_kind,owner_id,revision),
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    FOREIGN KEY(source_estimate_document_id) REFERENCES customer_quotation_documents(id) ON DELETE RESTRICT
  )`,
];

async function ensureColumn(db, table, name, definition) {
  const columns = await db.all(`PRAGMA table_info("${table}")`);
  if (!columns.some((column) => column.name === name)) await db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
}

const immutable = [
  'enquiry_email_intakes','supplier_enquiry_drafts','manufacturer_response_links','supplier_revision_requests','supplier_revision_documents','revision_change_checks','order_staff_approvals','factory_order_requests','factory_confirmations','factory_confirmation_checks','factory_confirmation_releases','factory_confirmation_signoffs','factory_confirmation_position_approvals','factory_confirmation_signed_pdf_reviews','customer_lifecycle_documents',
];

export async function initializeLifecycleSchema(db) {
  for (const statement of statements) await db.exec(statement);
  await ensureColumn(db, 'supplier_revision_requests', 'body_text', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'supplier_revision_requests', 'returned_document_id', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'returned_revision', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'returned_source_kind', "TEXT NOT NULL DEFAULT 'canonical_document' CHECK(returned_source_kind IN ('canonical_document','supplier_quote_attachment'))");
  await ensureColumn(db, 'supplier_revision_requests', 'verified_at', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'workflow_state', "TEXT NOT NULL DEFAULT 'revision_requested'");
  await ensureColumn(db, 'supplier_revision_requests', 'responsible_user_id', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'sent_at', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'response_due_at', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'received_at', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'completed_at', 'TEXT');
  await ensureColumn(db, 'supplier_revision_requests', 'returned_checksum', 'TEXT');
  await db.exec(`UPDATE supplier_revision_requests
    SET workflow_state = CASE
      WHEN status = 'sent' THEN 'sent_to_supplier'
      WHEN status = 'approved' AND communication_message_id IS NOT NULL THEN 'prepared_for_review'
      WHEN status = 'cancelled' THEN 'cancelled'
      ELSE workflow_state
    END
    WHERE workflow_state = 'revision_requested'`);
  await ensureColumn(db, 'supplier_enquiry_drafts', 'document_snapshot_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(db, 'supplier_enquiry_drafts', 'idempotency_key', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'content_sha256', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'revision_no', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'supersedes_id', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'request_kind', "TEXT NOT NULL DEFAULT 'initial'");
  await ensureColumn(db, 'supplier_enquiry_drafts', 'revision_request_id', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'sent_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'response_due_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'response_state', "TEXT NOT NULL DEFAULT 'outstanding'");
  await ensureColumn(db, 'supplier_enquiry_drafts', 'received_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'completed_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'followup_due_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'followup_attempted_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'followup_sent_at', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'followup_message_id', 'TEXT');
  await ensureColumn(db, 'supplier_enquiry_drafts', 'followup_failure', "TEXT NOT NULL DEFAULT ''");
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_enquiry_idempotency ON supplier_enquiry_drafts(idempotency_key) WHERE idempotency_key IS NOT NULL');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_enquiry_project_estimate ON supplier_enquiry_drafts(project_id,estimate_id,created_at DESC)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_revision_followup_due ON supplier_enquiry_drafts(request_kind,status,response_state,followup_due_at)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_supplier_revision_parent ON supplier_enquiry_drafts(revision_request_id,created_at DESC)');
  await ensureColumn(db, 'revision_change_checks', 'change_kind', "TEXT NOT NULL DEFAULT 'requested' CHECK(change_kind IN ('requested','unrelated_material_change'))");
  await ensureColumn(db, 'revision_change_checks', 'source_identity', 'TEXT');
  await db.exec(`CREATE TABLE IF NOT EXISTS supplier_revision_review_history (
    id TEXT PRIMARY KEY,request_id TEXT NOT NULL,source_identity TEXT NOT NULL,
    checks_json TEXT NOT NULL,reviewed_by TEXT NOT NULL,reviewed_at TEXT NOT NULL,
    FOREIGN KEY(request_id) REFERENCES supplier_revision_requests(id) ON DELETE RESTRICT)`);
  for(const action of ['UPDATE','DELETE'])await db.exec(`CREATE TRIGGER IF NOT EXISTS trg_supplier_revision_review_history_${action.toLowerCase()} BEFORE ${action} ON supplier_revision_review_history BEGIN SELECT RAISE(ABORT,'Supplier review history is immutable'); END`);
  for (const table of immutable) await db.exec(`CREATE TRIGGER IF NOT EXISTS trg_${table}_delete_evidence BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Lifecycle evidence must be superseded, not deleted'); END`);
}
