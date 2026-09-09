export async function initializeEstimateProcurementActionSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS estimate_procurement_actions (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL,
      project_id TEXT,
      action_type TEXT NOT NULL CHECK(action_type IN ('request_supplier_revision','raise_order_to_factory')),
      status TEXT NOT NULL CHECK(status IN ('draft_staff_review','ready_for_future_dispatch')),
      supplier_quote_id TEXT,
      supplier_revision_id TEXT,
      idempotency_key_hash TEXT NOT NULL,
      request_json TEXT NOT NULL DEFAULT '{}',
      gate_snapshot_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(estimate_id, action_type, idempotency_key_hash),
      FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
      FOREIGN KEY(supplier_quote_id) REFERENCES supplier_quotes(id) ON DELETE RESTRICT,
      FOREIGN KEY(supplier_revision_id) REFERENCES supplier_quote_revisions(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_estimate_procurement_actions ON estimate_procurement_actions(estimate_id,created_at DESC);
  `);
}
