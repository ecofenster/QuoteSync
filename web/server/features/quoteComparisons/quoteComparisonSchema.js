export async function initializeQuoteComparisonSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quote_comparisons (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      project_id TEXT,
      baseline_estimate_id TEXT NOT NULL,
      baseline_estimate_revision INTEGER NOT NULL,
      baseline_snapshot_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft_review_required'
        CHECK(status IN ('draft_review_required','approved','superseded')),
      record_revision INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
      FOREIGN KEY(baseline_estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS quote_comparison_proposals (
      id TEXT PRIMARY KEY,
      comparison_id TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT NOT NULL,
      manufacturer_name TEXT,
      quotation_number TEXT,
      quotation_revision TEXT,
      quotation_date TEXT,
      scope_kind TEXT NOT NULL DEFAULT 'unresolved'
        CHECK(scope_kind IN ('supply_only','supply_and_install','supply_install_support','unresolved')),
      currency TEXT,
      original_total_amount TEXT,
      comparable_scope_amount TEXT,
      normalized_project_amount TEXT,
      options_json TEXT NOT NULL DEFAULT '[]',
      exclusions_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'review_required'
        CHECK(status IN ('review_required','reviewed','excluded')),
      provenance_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(comparison_id) REFERENCES quote_comparisons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quote_comparison_proposal_documents (
      proposal_id TEXT NOT NULL,
      canonical_document_id TEXT NOT NULL,
      document_role TEXT NOT NULL DEFAULT 'commercial'
        CHECK(document_role IN ('commercial','technical','supporting')),
      linked_at TEXT NOT NULL,
      linked_by TEXT NOT NULL,
      PRIMARY KEY(proposal_id, canonical_document_id),
      FOREIGN KEY(proposal_id) REFERENCES quote_comparison_proposals(id) ON DELETE CASCADE,
      FOREIGN KEY(canonical_document_id) REFERENCES canonical_documents(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS quote_comparison_position_mappings (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      supplier_item_reference TEXT NOT NULL,
      supplier_item_snapshot_json TEXT NOT NULL DEFAULT '{}',
      canonical_estimate_position_id TEXT,
      relationship_kind TEXT NOT NULL DEFAULT 'unmapped'
        CHECK(relationship_kind IN ('exact','grouped','split','missing','additional','alternative','unmapped')),
      difference_status TEXT NOT NULL DEFAULT 'review_required'
        CHECK(difference_status IN ('exact_match','close_acceptable_alternative','minor_difference','material_mismatch','dimension_mismatch','quantity_mismatch','configuration_mismatch','product_system_substitution','missing','additional','alternative','unmapped','information_not_supplied','review_required','not_applicable')),
      differences_json TEXT NOT NULL DEFAULT '[]',
      provenance_json TEXT NOT NULL DEFAULT '{}',
      corrected_by TEXT,
      corrected_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(proposal_id, supplier_item_reference),
      FOREIGN KEY(proposal_id) REFERENCES quote_comparison_proposals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quote_comparison_audit_events (
      id TEXT PRIMARY KEY,
      comparison_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(comparison_id) REFERENCES quote_comparisons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manufacturer_system_documents (
      id TEXT PRIMARY KEY,
      owner_kind TEXT NOT NULL CHECK(owner_kind IN ('manufacturer','supplier')),
      owner_id TEXT,
      owner_code TEXT,
      owner_name TEXT NOT NULL,
      product_system_id TEXT,
      product_system_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('certificate','system_drawing')),
      subcategory TEXT NOT NULL,
      title TEXT NOT NULL,
      document_format TEXT NOT NULL CHECK(document_format IN ('PDF','DWG','RVT','IFC','OTHER')),
      canonical_document_id TEXT NOT NULL,
      version_label TEXT,
      issue_date TEXT,
      expiry_date TEXT,
      jurisdiction TEXT,
      applicability_json TEXT NOT NULL DEFAULT '{}',
      source_provenance_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded')),
      superseded_by_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(canonical_document_id) REFERENCES canonical_documents(id) ON DELETE RESTRICT,
      FOREIGN KEY(superseded_by_id) REFERENCES manufacturer_system_documents(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS project_manufacturer_document_links (
      project_id TEXT NOT NULL,
      manufacturer_system_document_id TEXT NOT NULL,
      portal_visibility TEXT NOT NULL DEFAULT 'internal_only'
        CHECK(portal_visibility IN ('internal_only','customer_approved')),
      applicability_evidence_json TEXT NOT NULL DEFAULT '{}',
      linked_by TEXT NOT NULL,
      linked_at TEXT NOT NULL,
      PRIMARY KEY(project_id, manufacturer_system_document_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(manufacturer_system_document_id) REFERENCES manufacturer_system_documents(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_quote_comparisons_client ON quote_comparisons(client_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quote_comparison_proposals ON quote_comparison_proposals(comparison_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_quote_comparison_mappings ON quote_comparison_position_mappings(proposal_id, canonical_estimate_position_id);
    CREATE INDEX IF NOT EXISTS idx_manufacturer_system_documents_hierarchy ON manufacturer_system_documents(owner_name, product_system_name, category, subcategory, status);
    CREATE INDEX IF NOT EXISTS idx_project_manufacturer_documents ON project_manufacturer_document_links(project_id, portal_visibility);
  `);
}
