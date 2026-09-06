import { randomUUID } from "node:crypto";

const parseJson = (value, fallback) => {
  try { return JSON.parse(value ?? ""); } catch { return fallback; }
};

const asText = (value) => String(value ?? "").trim();
const differenceStatuses = new Set([
  "exact_match", "close_acceptable_alternative", "minor_difference", "material_mismatch",
  "dimension_mismatch", "quantity_mismatch", "configuration_mismatch", "product_system_substitution",
  "missing", "additional", "alternative", "unmapped", "information_not_supplied", "review_required",
  "not_applicable",
]);
const relationshipKinds = new Set(["exact", "grouped", "split", "missing", "additional", "alternative", "unmapped"]);
const scopeKinds = new Set(["supply_only", "supply_and_install", "supply_install_support", "unresolved"]);

function fail(message, status = 400, code = "invalid_comparison") {
  throw Object.assign(new Error(message), { status, code });
}

function mapComparisonRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id || null,
    baselineEstimateId: row.baseline_estimate_id,
    baselineEstimateRevision: Number(row.baseline_estimate_revision),
    baselineSnapshot: parseJson(row.baseline_snapshot_json, {}),
    status: row.status,
    recordRevision: Number(row.record_revision),
    createdBy: row.created_by,
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProposalRow(row) {
  return {
    id: row.id,
    comparisonId: row.comparison_id,
    supplierId: row.supplier_id || null,
    supplierName: row.supplier_name,
    manufacturerName: row.manufacturer_name || null,
    quotationNumber: row.quotation_number || null,
    quotationRevision: row.quotation_revision || null,
    quotationDate: row.quotation_date || null,
    scopeKind: row.scope_kind,
    currency: row.currency || null,
    originalTotalAmount: row.original_total_amount || null,
    comparableScopeAmount: row.comparable_scope_amount || null,
    normalizedProjectAmount: row.normalized_project_amount || null,
    options: parseJson(row.options_json, []),
    exclusions: parseJson(row.exclusions_json, []),
    status: row.status,
    provenance: parseJson(row.provenance_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMappingRow(row) {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    supplierItemReference: row.supplier_item_reference,
    supplierItemSnapshot: parseJson(row.supplier_item_snapshot_json, {}),
    canonicalEstimatePositionId: row.canonical_estimate_position_id || null,
    relationshipKind: row.relationship_kind,
    differenceStatus: row.difference_status,
    differences: parseJson(row.differences_json, []),
    provenance: parseJson(row.provenance_json, {}),
    correctedBy: row.corrected_by || null,
    correctedAt: row.corrected_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createQuoteComparisonService(db) {
  async function hydrate(row) {
    if (!row) return null;
    const comparison = mapComparisonRow(row);
    const proposalRows = await db.all("SELECT * FROM quote_comparison_proposals WHERE comparison_id=? ORDER BY created_at,id", row.id);
    const proposals = [];
    for (const proposalRow of proposalRows) {
      const proposal = mapProposalRow(proposalRow);
      proposal.documents = await db.all(`
        SELECT link.canonical_document_id canonicalDocumentId,link.document_role documentRole,
          d.file_name fileName,d.mime_type mimeType,d.provider,d.web_view_link openUrl,d.document_type documentType
        FROM quote_comparison_proposal_documents link
        JOIN canonical_documents d ON d.id=link.canonical_document_id
        WHERE link.proposal_id=? ORDER BY d.file_name`, proposal.id);
      proposal.positionMappings = (await db.all("SELECT * FROM quote_comparison_position_mappings WHERE proposal_id=? ORDER BY created_at,id", proposal.id)).map(mapMappingRow);
      proposals.push(proposal);
    }
    return { ...comparison, proposals };
  }

  async function listForClient(clientId) {
    const rows = await db.all("SELECT * FROM quote_comparisons WHERE client_id=? ORDER BY updated_at DESC", asText(clientId));
    return Promise.all(rows.map(hydrate));
  }

  async function get(comparisonId, clientId = null) {
    const row = clientId
      ? await db.get("SELECT * FROM quote_comparisons WHERE id=? AND client_id=?", asText(comparisonId), asText(clientId))
      : await db.get("SELECT * FROM quote_comparisons WHERE id=?", asText(comparisonId));
    return hydrate(row);
  }

  async function assertCanonicalClientDocument(documentId, clientId) {
    const row = await db.get(`
      SELECT d.id,d.file_name,d.mime_type
      FROM canonical_documents d
      LEFT JOIN estimates e ON e.id=d.estimate_id
      LEFT JOIN projects p ON p.id=d.project_id
      WHERE d.id=? AND d.removed_at IS NULL AND d.trashed=0
        AND COALESCE(d.client_id,e.client_id,p.client_id)=?`, documentId, clientId);
    if (!row) fail("A proposal source is not an active canonical Client File.", 422, "comparison_document_scope_mismatch");
    return row;
  }

  async function create(input, actorId = "user-1") {
    const clientId = asText(input?.clientId), baselineEstimateId = asText(input?.baselineEstimateId);
    if (!clientId || !baselineEstimateId) fail("Client and baseline Estimate revision are required.");
    const proposals = Array.isArray(input?.proposals) ? input.proposals : [];
    if (proposals.length < 2) fail("At least two supplier proposal packages are required.", 422, "comparison_requires_two_proposals");
    const estimate = await db.get(`SELECT id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,
      positions_json,created_at,updated_at FROM estimates WHERE id=? AND client_id=? AND deleted_at IS NULL`, baselineEstimateId, clientId);
    if (!estimate) fail("The selected baseline Estimate revision does not belong to this Client.", 422, "comparison_baseline_scope_mismatch");
    const positions = parseJson(estimate.positions_json, []);
    if (!Array.isArray(positions) || positions.some((position) => !asText(position?.id))) fail("The baseline Estimate contains a position without canonical identity.", 422, "comparison_baseline_position_identity_missing");
    const canonicalPositionIds = new Set(positions.map((position) => asText(position.id)));
    for (const proposal of proposals) {
      if (!asText(proposal?.supplierName)) fail("Each proposal package needs a supplier identity.", 422, "comparison_supplier_required");
      const documents = Array.isArray(proposal?.documents) ? proposal.documents : [];
      if (!documents.length) fail("Each supplier proposal package needs at least one canonical Client File.", 422, "comparison_document_required");
      if (new Set(documents.map((document) => asText(document?.canonicalDocumentId))).size !== documents.length) fail("A canonical Client File may be linked only once within a proposal package.", 422, "comparison_document_duplicate");
      const documentRows = [];
      for (const document of documents) documentRows.push({ input: document, row: await assertCanonicalClientDocument(asText(document?.canonicalDocumentId), clientId) });
      const commercialSources = documentRows.filter(({ input }) => !["technical", "supporting"].includes(input.documentRole));
      if (!commercialSources.length || !commercialSources.some(({ row }) => /pdf|msword|wordprocessingml/i.test(row.mime_type) || /\.(pdf|docx?)$/i.test(row.file_name))) fail("Each proposal needs a PDF or Word commercial quotation source.", 422, "comparison_commercial_source_required");
      const items = Array.isArray(proposal?.items) ? proposal.items : [];
      for (const item of items) {
        if (!asText(item?.supplierItemReference)) fail("Supplier item references are required within a proposal package.");
        if (item.canonicalEstimatePositionId && !canonicalPositionIds.has(asText(item.canonicalEstimatePositionId))) fail("A supplier item mapping targets a Position outside the frozen baseline.", 422, "comparison_position_scope_mismatch");
      }
    }
    const now = new Date().toISOString(), comparisonId = randomUUID();
    const baselineSnapshot = {
      estimateId: estimate.id,
      estimateRef: estimate.estimate_ref,
      baseEstimateRef: estimate.base_estimate_ref,
      revisionNo: Number(estimate.revision_no),
      status: estimate.status,
      positions,
      capturedAt: now,
      sourceUpdatedAt: estimate.updated_at || estimate.created_at,
    };
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`INSERT INTO quote_comparisons(id,client_id,project_id,baseline_estimate_id,baseline_estimate_revision,baseline_snapshot_json,status,record_revision,created_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,'draft_review_required',1,?,?,?)`, comparisonId, clientId, estimate.project_id || null, estimate.id, Number(estimate.revision_no), JSON.stringify(baselineSnapshot), actorId, now, now);
      for (const proposalInput of proposals) {
        const proposalId = randomUUID(), scopeKind = scopeKinds.has(proposalInput.scopeKind) ? proposalInput.scopeKind : "unresolved";
        await db.run(`INSERT INTO quote_comparison_proposals(id,comparison_id,supplier_id,supplier_name,manufacturer_name,quotation_number,quotation_revision,quotation_date,scope_kind,currency,original_total_amount,comparable_scope_amount,normalized_project_amount,options_json,exclusions_json,status,provenance_json,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'review_required',?,?,?)`, proposalId, comparisonId, asText(proposalInput.supplierId) || null, asText(proposalInput.supplierName), asText(proposalInput.manufacturerName) || null, asText(proposalInput.quotationNumber) || null, asText(proposalInput.quotationRevision) || null, asText(proposalInput.quotationDate) || null, scopeKind, asText(proposalInput.currency).toUpperCase() || null, asText(proposalInput.originalTotalAmount) || null, asText(proposalInput.comparableScopeAmount) || null, asText(proposalInput.normalizedProjectAmount) || null, JSON.stringify(proposalInput.options || []), JSON.stringify(proposalInput.exclusions || []), JSON.stringify({ source: "staff_package", actorId, ...(proposalInput.provenance || {}) }), now, now);
        for (const document of proposalInput.documents) await db.run(`INSERT INTO quote_comparison_proposal_documents(proposal_id,canonical_document_id,document_role,linked_at,linked_by) VALUES(?,?,?,?,?)`, proposalId, asText(document.canonicalDocumentId), ["technical","supporting"].includes(document.documentRole) ? document.documentRole : "commercial", now, actorId);
        for (const item of proposalInput.items || []) {
          const status = differenceStatuses.has(item.differenceStatus) ? item.differenceStatus : "review_required";
          const relationship = relationshipKinds.has(item.relationshipKind) ? item.relationshipKind : "unmapped";
          await db.run(`INSERT INTO quote_comparison_position_mappings(id,proposal_id,supplier_item_reference,supplier_item_snapshot_json,canonical_estimate_position_id,relationship_kind,difference_status,differences_json,provenance_json,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)`, randomUUID(), proposalId, asText(item.supplierItemReference), JSON.stringify(item.supplierItemSnapshot || {}), asText(item.canonicalEstimatePositionId) || null, relationship, status, JSON.stringify(item.differences || []), JSON.stringify({ source: "staff_mapping", actorId, ...(item.provenance || {}) }), now, now);
        }
      }
      await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,after_json,created_at) VALUES(?,?,?,?,?,?)", randomUUID(), comparisonId, "comparison.created", actorId, JSON.stringify({ baselineEstimateId, proposalCount: proposals.length }), now);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return get(comparisonId, clientId);
  }

  async function correctMapping(comparisonId, mappingId, input, actorId = "user-1") {
    const row = await db.get(`SELECT m.*,p.comparison_id,c.baseline_snapshot_json,c.status comparison_status
      FROM quote_comparison_position_mappings m JOIN quote_comparison_proposals p ON p.id=m.proposal_id
      JOIN quote_comparisons c ON c.id=p.comparison_id WHERE m.id=? AND c.id=?`, asText(mappingId), asText(comparisonId));
    if (!row) return null;
    if (row.comparison_status !== "draft_review_required") fail("Approved comparison evidence is immutable; create a new comparison revision.", 409, "comparison_immutable");
    const snapshot = parseJson(row.baseline_snapshot_json, {}), ids = new Set((snapshot.positions || []).map((position) => asText(position.id)));
    const positionId = input.canonicalEstimatePositionId == null ? null : asText(input.canonicalEstimatePositionId);
    if (positionId && !ids.has(positionId)) fail("The corrected mapping targets a Position outside the frozen baseline.", 422, "comparison_position_scope_mismatch");
    const status = differenceStatuses.has(input.differenceStatus) ? input.differenceStatus : row.difference_status;
    const relationship = relationshipKinds.has(input.relationshipKind) ? input.relationshipKind : row.relationship_kind;
    const now = new Date().toISOString(), before = mapMappingRow(row);
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`UPDATE quote_comparison_position_mappings SET canonical_estimate_position_id=?,relationship_kind=?,difference_status=?,differences_json=?,provenance_json=?,corrected_by=?,corrected_at=?,updated_at=? WHERE id=?`, positionId, relationship, status, JSON.stringify(input.differences ?? before.differences), JSON.stringify({ ...before.provenance, correction: "staff", actorId }), actorId, now, now, mappingId);
      await db.run("UPDATE quote_comparisons SET record_revision=record_revision+1,updated_at=? WHERE id=?", now, comparisonId);
      const afterRow = await db.get("SELECT * FROM quote_comparison_position_mappings WHERE id=?", mappingId);
      await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?)", randomUUID(), comparisonId, "mapping.corrected", actorId, JSON.stringify(before), JSON.stringify(mapMappingRow(afterRow)), now);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return get(comparisonId);
  }

  async function approve(comparisonId, actorId = "user-1") {
    const comparison = await get(comparisonId);
    if (!comparison) return null;
    if (comparison.status === "approved") return comparison;
    if (comparison.proposals.length < 2) fail("At least two supplier proposal packages are required before approval.", 422, "comparison_requires_two_proposals");
    const unresolved = comparison.proposals.flatMap((proposal) => proposal.positionMappings).filter((mapping) => ["review_required","unmapped"].includes(mapping.differenceStatus));
    if (unresolved.length) fail("Review or explicitly classify every supplier item before approving the comparison.", 422, "comparison_review_required");
    const scopes = new Set(comparison.proposals.map((proposal) => proposal.scopeKind));
    if (scopes.has("unresolved") || scopes.size > 1) fail("Commercial scopes differ or remain unresolved. Normalize scope before approval.", 422, "comparison_scope_review_required");
    const now = new Date().toISOString();
    await db.run("UPDATE quote_comparisons SET status='approved',approved_by=?,approved_at=?,updated_at=?,record_revision=record_revision+1 WHERE id=?", actorId, now, now, comparisonId);
    await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,after_json,created_at) VALUES(?,?,?,?,?,?)", randomUUID(), comparisonId, "comparison.approved", actorId, JSON.stringify({ status: "approved" }), now);
    return get(comparisonId);
  }

  return { listForClient, get, create, correctMapping, approve };
}
