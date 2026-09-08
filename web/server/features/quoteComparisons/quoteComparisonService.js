import { randomUUID } from "node:crypto";
import { applyMarkup } from "../projectCalculatorLab/exchangeRateModel.js";
import { inferQuoteComparisonMappings } from "../../../shared/quoteComparisonPositionMapping.js";

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
const positionReference = (position) => asText(position?.customerReference || position?.positionRef || position?.reference || position?.displayReference || position?.id);

async function enrichedBaselinePositions(db, estimateId, positions, scenarioId = null) {
  if (!scenarioId || !Array.isArray(positions) || !positions.length) return positions;
  const [rows, markupRow] = await Promise.all([
    db.all(`SELECT estimate_position_id,source_snapshot_json,selling_amount_gbp,quantity,markup_override_percent
      FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND estimate_position_id IS NOT NULL
      ORDER BY created_at,id`, scenarioId).catch(() => []),
    db.get("SELECT product_percent FROM project_calculator_lab_markup_rules WHERE scenario_id=?", scenarioId).catch(() => null),
  ]);
  const byPosition = new Map(rows.map((row) => [asText(row.estimate_position_id), row]));
  return positions.map((position) => {
    const row = byPosition.get(asText(position.id));
    if (!row) return position;
    const source = parseJson(row.source_snapshot_json, {}), manufacturer = source.manufacturerEvidence || {};
    const markupPercent = row.markup_override_percent ?? markupRow?.product_percent ?? "0";
    const selling = applyMarkup(row.selling_amount_gbp, markupPercent)?.markedUpAmount ?? row.selling_amount_gbp;
    const quantity = Number(row.quantity || position.qty || position.quantity || 1);
    const customerUnitPrice = Number(selling) > 0 && quantity > 0 ? (Number(selling) / quantity).toFixed(2) : null;
    return {
      ...position,
      manufacturerName: manufacturer.manufacturerName ?? source.canonicalManufacturer?.manufacturerName ?? null,
      product: manufacturer.product ?? position.product,
      productSystem: manufacturer.productSystem ?? position.productSystem,
      configurationDescription: manufacturer.configurationDescription ?? position.configurationDescription ?? position.insertion,
      glassSpecification: manufacturer.glassSpecification ?? null,
      fittingsSpecification: manufacturer.fittingsSpecification ?? null,
      manufacturerQuotedUg: manufacturer.manufacturerQuotedUg ?? null,
      manufacturerQuotedUw: manufacturer.manufacturerQuotedUw ?? null,
      customerSafeSpecification: manufacturer.customerSafeSpecification ?? [],
      sourceSpecification: manufacturer.sourceSpecification ?? null,
      canonicalSpecification: manufacturer.canonicalSpecification ?? manufacturer.sourceSpecification?.canonical ?? null,
      customerUnitPrice,
      customerQuantityPrice: selling ?? null,
      customerPriceSource: "project_costing_position_selling_value",
    };
  });
}

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
    name: row.name || null,
    description: row.description || null,
    archivedAt: row.archived_at || null,
    archivedBy: row.archived_by || null,
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
      const managedSources = await db.all(`SELECT source_id supplierAttachmentId,source_kind sourceKind,
        supplier_quote_id supplierQuoteId,supplier_revision_id supplierRevisionId,document_role documentRole,
        file_name fileName,mime_type mimeType,source_snapshot_json sourceSnapshotJson
        FROM quote_comparison_proposal_sources WHERE proposal_id=? ORDER BY linked_at,id`, proposal.id);
      proposal.documents.push(...managedSources.map((source) => ({ ...source, canonicalDocumentId: null, sourceSnapshot: parseJson(source.sourceSnapshotJson, {}) })));
      proposal.positionMappings = (await db.all("SELECT * FROM quote_comparison_position_mappings WHERE proposal_id=? ORDER BY created_at,id", proposal.id)).map(mapMappingRow);
      proposals.push(proposal);
    }
    return { ...comparison, proposals };
  }

  async function listForClient(clientId) {
    const rows = await db.all("SELECT * FROM quote_comparisons WHERE client_id=? AND deleted_at IS NULL ORDER BY updated_at DESC", asText(clientId));
    return Promise.all(rows.map(hydrate));
  }

  async function updateDetails(comparisonId, input, actorId = "user-1") {
    const comparison = await get(comparisonId);
    if (!comparison) return null;
    if (comparison.status === "approved" && (input?.name == null && input?.description == null)) fail("Approved comparison evidence is immutable.", 409, "comparison_immutable");
    const before = { name: comparison.name, description: comparison.description };
    const name = input?.name == null ? comparison.name : asText(input.name).slice(0, 160) || null;
    const description = input?.description == null ? comparison.description : asText(input.description).slice(0, 1000) || null;
    const now = new Date().toISOString();
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run("UPDATE quote_comparisons SET name=?,description=?,record_revision=record_revision+1,updated_at=? WHERE id=?", name, description, now, comparisonId);
      await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?)", randomUUID(), comparisonId, "comparison.details_updated", actorId, JSON.stringify(before), JSON.stringify({ name, description }), now);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return get(comparisonId);
  }

  async function setArchived(comparisonId, archived, actorId = "user-1") {
    const comparison = await get(comparisonId);
    if (!comparison) return null;
    if (Boolean(comparison.archivedAt) === archived) return comparison;
    const now = new Date().toISOString();
    await db.run("UPDATE quote_comparisons SET archived_at=?,archived_by=?,record_revision=record_revision+1,updated_at=? WHERE id=?", archived ? now : null, archived ? actorId : null, now, comparisonId);
    await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?)", randomUUID(), comparisonId, archived ? "comparison.archived" : "comparison.restored", actorId, JSON.stringify({ archivedAt: comparison.archivedAt }), JSON.stringify({ archivedAt: archived ? now : null }), now);
    return get(comparisonId);
  }

  async function remove(comparisonId, actorId = "user-1") {
    const comparison = await get(comparisonId);
    if (!comparison) return null;
    if (comparison.status !== "draft_review_required") fail("Approved or relied-upon comparisons must be archived, not deleted.", 409, "comparison_delete_forbidden");
    const release = await db.get("SELECT id FROM portal_resource_releases WHERE resource_type='comparison' AND resource_id=? LIMIT 1", comparisonId).catch(() => null);
    if (release) fail("This comparison has release or decision evidence and cannot be deleted. Archive it instead.", 409, "comparison_delete_referenced");
    const now = new Date().toISOString();
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run("UPDATE quote_comparisons SET deleted_at=?,deleted_by=?,updated_at=? WHERE id=?", now, actorId, now, comparisonId);
      await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?)", randomUUID(), comparisonId, "comparison.deleted", actorId, JSON.stringify({ status: comparison.status }), JSON.stringify({ deletedAt: now }), now);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return { id: comparisonId, deleted: true, actorId };
  }

  async function copy(comparisonId, actorId = "user-1") {
    const source = await get(comparisonId);
    if (!source) return null;
    const now = new Date().toISOString(), nextId = randomUUID();
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`INSERT INTO quote_comparisons(id,client_id,project_id,baseline_estimate_id,baseline_estimate_revision,baseline_snapshot_json,name,description,status,record_revision,created_by,created_at,updated_at)
        SELECT ?,client_id,project_id,baseline_estimate_id,baseline_estimate_revision,baseline_snapshot_json,?,description,'draft_review_required',1,?,?,? FROM quote_comparisons WHERE id=?`, nextId, `${source.name || source.baselineSnapshot.estimateRef} — Copy`, actorId, now, now, comparisonId);
      for (const proposal of source.proposals) {
        const nextProposalId = randomUUID();
        await db.run(`INSERT INTO quote_comparison_proposals(id,comparison_id,supplier_id,supplier_name,manufacturer_name,quotation_number,quotation_revision,quotation_date,scope_kind,currency,original_total_amount,comparable_scope_amount,normalized_project_amount,options_json,exclusions_json,status,provenance_json,created_at,updated_at)
          SELECT ?,?,supplier_id,supplier_name,manufacturer_name,quotation_number,quotation_revision,quotation_date,scope_kind,currency,original_total_amount,comparable_scope_amount,normalized_project_amount,options_json,exclusions_json,'review_required',?, ?,? FROM quote_comparison_proposals WHERE id=?`, nextProposalId, nextId, JSON.stringify({ ...proposal.provenance, copiedFromProposalId: proposal.id, copiedBy: actorId }), now, now, proposal.id);
        for (const document of proposal.documents) {
          if (document.supplierAttachmentId) await db.run(`INSERT INTO quote_comparison_proposal_sources(id,proposal_id,source_kind,source_id,supplier_quote_id,supplier_revision_id,document_role,file_name,mime_type,source_snapshot_json,linked_at,linked_by)
            SELECT ?,?,source_kind,source_id,supplier_quote_id,supplier_revision_id,document_role,file_name,mime_type,source_snapshot_json,?,? FROM quote_comparison_proposal_sources WHERE proposal_id=? AND source_id=?`, randomUUID(), nextProposalId, now, actorId, proposal.id, document.supplierAttachmentId);
          else await db.run(`INSERT INTO quote_comparison_proposal_documents(proposal_id,canonical_document_id,document_role,linked_at,linked_by)
            SELECT ?,canonical_document_id,document_role,?,? FROM quote_comparison_proposal_documents WHERE proposal_id=? AND canonical_document_id=?`, nextProposalId, now, actorId, proposal.id, document.canonicalDocumentId);
        }
        for (const mapping of proposal.positionMappings) await db.run(`INSERT INTO quote_comparison_position_mappings(id,proposal_id,supplier_item_reference,supplier_item_snapshot_json,canonical_estimate_position_id,relationship_kind,difference_status,differences_json,provenance_json,corrected_by,corrected_at,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, randomUUID(), nextProposalId, mapping.supplierItemReference, JSON.stringify(mapping.supplierItemSnapshot), mapping.canonicalEstimatePositionId, mapping.relationshipKind, mapping.differenceStatus, JSON.stringify(mapping.differences), JSON.stringify({ ...mapping.provenance, copiedFromMappingId: mapping.id, copiedBy: actorId }), mapping.correctedBy, mapping.correctedAt, now, now);
      }
      await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,after_json,created_at) VALUES(?,?,?,?,?,?)", randomUUID(), nextId, "comparison.copied", actorId, JSON.stringify({ copiedFromComparisonId: comparisonId, approvalState: "draft_review_required" }), now);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return get(nextId);
  }

  async function get(comparisonId, clientId = null) {
    const row = clientId
      ? await db.get("SELECT * FROM quote_comparisons WHERE id=? AND client_id=? AND deleted_at IS NULL", asText(comparisonId), asText(clientId))
      : await db.get("SELECT * FROM quote_comparisons WHERE id=? AND deleted_at IS NULL", asText(comparisonId));
    return hydrate(row);
  }

  async function resolveAutomaticBaseline(clientId, projectId = null) {
    const parameters = [asText(clientId)], projectClause = projectId ? "AND project_id=?" : "";
    if (projectId) parameters.push(asText(projectId));
    const estimate = await db.get(`SELECT id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,outcome,
      positions_json,created_at,updated_at FROM estimates WHERE client_id=? ${projectClause} AND deleted_at IS NULL
      AND COALESCE(outcome,'Open')<>'Lost'
      ORDER BY CASE WHEN COALESCE(outcome,'Open')='Open' THEN 0 ELSE 1 END, updated_at DESC, revision_no DESC LIMIT 1`, ...parameters);
    if (!estimate) return { status: "baseline_upload_required", clientId: asText(clientId), projectId: projectId ? asText(projectId) : null, baseline: null };
    const rawPositions = parseJson(estimate.positions_json, []);
    const issued = await db.get(`SELECT iq.id,iq.quotation_revision,iq.commercial_snapshot_json,iq.issued_at,d.id document_id,d.file_name
      FROM issued_quotations iq JOIN customer_quotation_documents d ON d.id=iq.document_id
      WHERE iq.estimate_id=? AND iq.status='issued' ORDER BY iq.issued_at DESC,iq.created_at DESC LIMIT 1`, estimate.id).catch(()=>null);
    const scenario = await db.get("SELECT id,revision_number,updated_at FROM project_calculator_lab_scenarios WHERE estimate_id=? ORDER BY updated_at DESC LIMIT 1", estimate.id).catch(()=>null);
    const positions = await enrichedBaselinePositions(db, estimate.id, rawPositions, scenario?.id);
    const technicalSourceEvidence=scenario?await db.all(`SELECT DISTINCT attachment.id attachmentId,attachment.original_file_name fileName,quote.supplier_name supplierName,revision.id revisionId
      FROM project_calculator_supplier_quote_revisions linked
      JOIN supplier_quote_revisions revision ON revision.id=linked.revision_id
      JOIN supplier_quotes quote ON quote.id=revision.supplier_quote_id
      JOIN supplier_quote_attachments attachment ON attachment.revision_id=revision.id AND attachment.estimate_id=revision.estimate_id
      WHERE linked.scenario_id=? AND attachment.role<>'derived_artifact' ORDER BY attachment.created_at`,scenario.id).catch(()=>[]):[];
    const customerCommercialSources=[];
    if(issued) customerCommercialSources.push({kind:"issued_customer_quotation",issuedQuotationId:issued.id,documentId:issued.document_id,fileName:issued.file_name,quotationRevision:Number(issued.quotation_revision),commercialSnapshot:parseJson(issued.commercial_snapshot_json,{}),capturedAt:issued.issued_at});
    if(scenario) customerCommercialSources.push({kind:"current_project_costing",scenarioId:scenario.id,scenarioRevision:Number(scenario.revision_number),capturedAt:scenario.updated_at});
    return { status: "canonical_baseline_detected", clientId: estimate.client_id, projectId: estimate.project_id || null, baseline: { estimateId: estimate.id, estimateRef: estimate.estimate_ref, baseEstimateRef: estimate.base_estimate_ref, revisionNo: Number(estimate.revision_no), status: estimate.status, outcome: estimate.outcome, positionCount: Array.isArray(positions) ? positions.length : 0, positions, customerCommercialSources,technicalSourceEvidence,preferredCustomerCommercialSource:issued?"issued_customer_quotation":scenario?"current_project_costing":"customer_baseline_required" } };
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


  async function assertSupplierAttachment(source, clientId, baselineEstimateId) {
    const row = await db.get(`SELECT a.id,a.original_file_name file_name,a.media_type mime_type,a.sha256,
      a.revision_id supplier_revision_id,r.supplier_quote_id,q.supplier_name,q.supplier_code,e.client_id
      FROM supplier_quote_attachments a
      JOIN supplier_quote_revisions r ON r.id=a.revision_id AND r.estimate_id=a.estimate_id
      JOIN supplier_quotes q ON q.id=r.supplier_quote_id AND q.estimate_id=r.estimate_id
      JOIN estimates e ON e.id=a.estimate_id
      WHERE a.id=? AND a.estimate_id=? AND e.client_id=? AND e.deleted_at IS NULL`, asText(source.supplierAttachmentId), baselineEstimateId, clientId);
    if (!row || (source.supplierQuoteId && asText(source.supplierQuoteId) !== row.supplier_quote_id) || (source.supplierRevisionId && asText(source.supplierRevisionId) !== row.supplier_revision_id)) fail("A proposal source is not retained supplier evidence for the baseline Estimate.", 422, "comparison_document_scope_mismatch");
    return row;
  }

  async function create(input, actorId = "user-1") {
    const clientId = asText(input?.clientId), baselineEstimateId = asText(input?.baselineEstimateId);
    if (!clientId || !baselineEstimateId) fail("Client and baseline Estimate revision are required.");
    const proposals = Array.isArray(input?.proposals) ? input.proposals : [];
    if (proposals.length < 1) fail("At least one competitor proposal package is required.", 422, "comparison_requires_proposal");
    const estimate = await db.get(`SELECT id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,
      positions_json,created_at,updated_at FROM estimates WHERE id=? AND client_id=? AND deleted_at IS NULL`, baselineEstimateId, clientId);
    if (!estimate) fail("The selected baseline Estimate revision does not belong to this Client.", 422, "comparison_baseline_scope_mismatch");
    const rawPositions = parseJson(estimate.positions_json, []);
    const activeScenario = await db.get("SELECT id FROM project_calculator_lab_scenarios WHERE estimate_id=? ORDER BY updated_at DESC LIMIT 1", estimate.id).catch(() => null);
    const positions = await enrichedBaselinePositions(db, estimate.id, rawPositions, activeScenario?.id);
    if (!Array.isArray(positions) || positions.some((position) => !asText(position?.id))) fail("The baseline Estimate contains a position without canonical identity.", 422, "comparison_baseline_position_identity_missing");
    const canonicalPositionIds = new Set(positions.map((position) => asText(position.id)));
    const requestedCommercial=input?.baselineCommercial||{};
    let customerCommercial;
    if(requestedCommercial.kind==="issued_customer_quotation"){
      const issued=await db.get("SELECT id,document_id,commercial_snapshot_json,issued_at FROM issued_quotations WHERE id=? AND estimate_id=? AND status='issued'",asText(requestedCommercial.issuedQuotationId),estimate.id);
      if(!issued)fail("The selected issued customer quotation is not an eligible baseline.",422,"comparison_customer_baseline_mismatch");
      customerCommercial={kind:"issued_customer_quotation",issuedQuotationId:issued.id,documentId:issued.document_id,currency:"GBP",...parseJson(issued.commercial_snapshot_json,{}),capturedAt:issued.issued_at};
    }else if(requestedCommercial.kind==="current_project_costing"){
      const scenario=await db.get("SELECT id,revision_number,updated_at FROM project_calculator_lab_scenarios WHERE id=? AND estimate_id=?",asText(requestedCommercial.scenarioId),estimate.id);
      const sellingExVat=asText(requestedCommercial.customerSellingExVatGbp),vat=asText(requestedCommercial.vatGbp),total=asText(requestedCommercial.totalIncVatGbp);
      if(!scenario||![sellingExVat,vat,total].every(value=>/^\d+(?:\.\d{1,2})?$/.test(value)))fail("A canonical customer-facing Project Costing total is required for comparison.",422,"comparison_customer_baseline_required");
      customerCommercial={kind:"current_project_costing",scenarioId:scenario.id,scenarioRevision:Number(scenario.revision_number),currency:"GBP",customerSellingExVatGbp:sellingExVat,vatGbp:vat,totalIncVatGbp:total,scopeKind:asText(requestedCommercial.scopeKind)||"unresolved",commercialNormalization:requestedCommercial.commercialNormalization&&typeof requestedCommercial.commercialNormalization==="object"?requestedCommercial.commercialNormalization:null,capturedAt:scenario.updated_at};
    }else fail("Select an issued customer quotation or the current customer-facing Estimate as the commercial baseline.",422,"comparison_customer_baseline_required");
    for (const proposal of proposals) {
      const documents = Array.isArray(proposal?.documents) ? proposal.documents : [];
      if (!documents.length) fail("Each supplier proposal package needs at least one canonical Client File.", 422, "comparison_document_required");
      const sourceKeys = documents.map((document) => document?.supplierAttachmentId ? `supplier:${asText(document.supplierAttachmentId)}` : `canonical:${asText(document?.canonicalDocumentId)}`);
      if (sourceKeys.some((key) => /:$/.test(key)) || new Set(sourceKeys).size !== documents.length) fail("A Client File may be linked only once within a proposal package.", 422, "comparison_document_duplicate");
      const documentRows = [];
      for (const document of documents) documentRows.push({ input: document, row: document.supplierAttachmentId ? await assertSupplierAttachment(document, clientId, baselineEstimateId) : await assertCanonicalClientDocument(asText(document?.canonicalDocumentId), clientId) });
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
      customerCommercial,
      technicalEvidenceRole:"canonical_positions_and_retained_supplier_sources",
    };
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`INSERT INTO quote_comparisons(id,client_id,project_id,baseline_estimate_id,baseline_estimate_revision,baseline_snapshot_json,name,description,status,record_revision,created_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?, 'draft_review_required',1,?,?,?)`, comparisonId, clientId, estimate.project_id || null, estimate.id, Number(estimate.revision_no), JSON.stringify(baselineSnapshot), asText(input?.name).slice(0,160)||`${estimate.estimate_ref} supplier comparison`, asText(input?.description).slice(0,1000)||null, actorId, now, now);
      for (const proposalInput of proposals) {
        const proposalId = randomUUID(), scopeKind = scopeKinds.has(proposalInput.scopeKind) ? proposalInput.scopeKind : "unresolved";
        const supplierName = asText(proposalInput.supplierName) || "Supplier review required";
        const corrections = Array.isArray(proposalInput.corrections) ? proposalInput.corrections.map((entry) => ({ field: asText(entry.field), originalValue: entry.originalValue ?? null, correctedValue: entry.correctedValue ?? null, reason: asText(entry.reason) || "staff_review", actorId, correctedAt: now })) : [];
        await db.run(`INSERT INTO quote_comparison_proposals(id,comparison_id,supplier_id,supplier_name,manufacturer_name,quotation_number,quotation_revision,quotation_date,scope_kind,currency,original_total_amount,comparable_scope_amount,normalized_project_amount,options_json,exclusions_json,status,provenance_json,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'review_required',?,?,?)`, proposalId, comparisonId, asText(proposalInput.supplierId) || null, supplierName, asText(proposalInput.manufacturerName) || null, asText(proposalInput.quotationNumber) || null, asText(proposalInput.quotationRevision) || null, asText(proposalInput.quotationDate) || null, scopeKind, asText(proposalInput.currency).toUpperCase() || null, asText(proposalInput.originalTotalAmount) || null, asText(proposalInput.comparableScopeAmount) || null, asText(proposalInput.normalizedProjectAmount) || null, JSON.stringify(proposalInput.options || []), JSON.stringify(proposalInput.exclusions || []), JSON.stringify({ source: "extraction_first_review", actorId, ...(proposalInput.provenance || {}), corrections }), now, now);
        for (const document of proposalInput.documents) {
          const role = ["technical","supporting"].includes(document.documentRole) ? document.documentRole : "commercial";
          if (document.supplierAttachmentId) {
            const source = await assertSupplierAttachment(document, clientId, baselineEstimateId);
            await db.run(`INSERT INTO quote_comparison_proposal_sources(id,proposal_id,source_kind,source_id,supplier_quote_id,supplier_revision_id,document_role,file_name,mime_type,source_snapshot_json,linked_at,linked_by) VALUES(?,?,'supplier_quote_attachment',?,?,?,?,?,?,?,?,?)`, randomUUID(), proposalId, source.id, source.supplier_quote_id, source.supplier_revision_id, role, source.file_name, source.mime_type, JSON.stringify({ sha256: source.sha256, supplierName: source.supplier_name, supplierCode: source.supplier_code }), now, actorId);
          } else await db.run(`INSERT INTO quote_comparison_proposal_documents(proposal_id,canonical_document_id,document_role,linked_at,linked_by) VALUES(?,?,?,?,?)`, proposalId, asText(document.canonicalDocumentId), role, now, actorId);
        }
        const inferred = inferQuoteComparisonMappings(proposalInput.items || [], positions);
        const claimedPositionIds = inferred.claimedPositionIds;
        const inferredItems = inferred.mappings;
        const hasUnresolvedSourceItems = inferredItems.some((item) => !item.canonicalEstimatePositionId || item.differenceStatus === "review_required");
        const noExtractedPositions = inferredItems.length === 0;
        for (const position of positions) if (!claimedPositionIds.has(asText(position.id))) {
          const differenceStatus = noExtractedPositions ? "information_not_supplied" : hasUnresolvedSourceItems ? "review_required" : "missing";
          const relationshipKind = differenceStatus === "missing" ? "missing" : "unmapped";
          const note = noExtractedPositions ? "Position evidence was not supplied in an extractable form." : hasUnresolvedSourceItems ? "No corresponding item is confirmed while extracted supplier rows remain unresolved." : "The complete mapped proposal contains no corresponding item.";
          inferredItems.push({ supplierItemReference: `${differenceStatus === "missing" ? "Missing" : "Not confirmed"} · ${positionReference(position)}`, supplierItemSnapshot: { generatedFromBaseline: true }, canonicalEstimatePositionId: asText(position.id), relationshipKind, differenceStatus, differences: [{ field: "position", baseline: positionReference(position), supplier: null, note }], provenance: { source: differenceStatus === "missing" ? "automatic_missing_detection" : "automatic_unresolved_position_evidence" } });
        }
        for (const item of inferredItems) {
          const status = differenceStatuses.has(item.differenceStatus) ? item.differenceStatus : "review_required";
          const relationship = relationshipKinds.has(item.relationshipKind) ? item.relationshipKind : "unmapped";
          await db.run(`INSERT INTO quote_comparison_position_mappings(id,proposal_id,supplier_item_reference,supplier_item_snapshot_json,canonical_estimate_position_id,relationship_kind,difference_status,differences_json,provenance_json,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)`, randomUUID(), proposalId, asText(item.supplierItemReference), JSON.stringify(item.supplierItemSnapshot || {}), asText(item.canonicalEstimatePositionId) || null, relationship, status, JSON.stringify(item.differences || []), JSON.stringify({ source: item.provenance?.mappingAuthority ? "automatic_mapping" : "extracted_supplier_item", actorId, ...(item.provenance || {}) }), now, now);
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
    if (comparison.proposals.length < 1) fail("At least one competitor proposal package is required before approval.", 422, "comparison_requires_proposal");
    const unresolved = comparison.proposals.flatMap((proposal) => proposal.positionMappings).filter((mapping) => ["review_required","unmapped"].includes(mapping.differenceStatus));
    if (unresolved.length) fail("Review or explicitly classify every supplier item before approving the comparison.", 422, "comparison_review_required");
    const scopes = new Set(comparison.proposals.map((proposal) => proposal.scopeKind));
    if (scopes.has("unresolved") || scopes.size > 1) fail("Commercial scopes differ or remain unresolved. Normalize scope before approval.", 422, "comparison_scope_review_required");
    const now = new Date().toISOString();
    await db.run("UPDATE quote_comparisons SET status='approved',approved_by=?,approved_at=?,updated_at=?,record_revision=record_revision+1 WHERE id=?", actorId, now, now, comparisonId);
    await db.run("INSERT INTO quote_comparison_audit_events(id,comparison_id,event_type,actor_id,after_json,created_at) VALUES(?,?,?,?,?,?)", randomUUID(), comparisonId, "comparison.approved", actorId, JSON.stringify({ status: "approved" }), now);
    return get(comparisonId);
  }

  return { listForClient, get, resolveAutomaticBaseline, create, updateDetails, setArchived, remove, copy, correctMapping, approve };
}
