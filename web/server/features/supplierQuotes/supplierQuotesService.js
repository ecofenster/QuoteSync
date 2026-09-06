import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { extractSupplierDocument, EXTRACTOR_VERSION } from '../supplierImportLab/documentExtraction.js';
import { parseCommercialFields, FIELD_PARSER_VERSION } from '../supplierImportLab/commercialFieldParser.js';
import { parseCommercialSummary, SUMMARY_PARSER_VERSION } from '../supplierImportLab/commercialSummaryParser.js';
import { readFileIntegrity, resolveAttachmentRoot, resolveManagedPath } from './managedAttachmentStorage.js';
import { linkSupplierPositionToEstimate, syncEstimatePositionProjections } from '../estimatePositions/canonicalEstimatePositions.js';
import { createDriveIntegrationService } from '../documents/driveIntegrationService.js';
import { createSupplierImportDiagnostics } from '../supplierImportLab/supplierImportDiagnostics.js';
import { createSupplierImportOperationIdentity, evaluateSupplierImportCompletion, readSupplierImportState, reconcileStaleSupplierImportRuns } from './supplierImportReliability.js';
import { derivePdfPositionPreviews, PDF_POSITION_PREVIEW_VERSION } from '../supplierImportLab/pdfPositionPreviews.js';
import { PDFJS_RUNTIME_VERSION } from '../supplierImportLab/pdfJsRuntime.js';
import { EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION } from '../supplierImportLab/ekoOknaDrawingPanelGeometry.js';
import { resolveCanonicalSupplier } from './supplierIdentity.js';
import { canonicalManufacturerSystemIdentity, createSupplierManufacturerRelationship, normalizeManufacturerIdentity, resolveCanonicalManufacturer } from './manufacturerIdentity.js';
import { assertExtractedCommercialEvidence, buildCommercialFingerprint, createManufacturerEvidenceRefreshIdentity, enrichManufacturerSourceSnapshot, MANUFACTURER_EVIDENCE_REFRESH_VERSION, summarizeManufacturerEvidence } from './manufacturerEvidenceRefresh.js';
import { assertSupplierProductSupplyReconciliation, buildSupplierQuotationCommercialClassification, classifySupplierCommercialItem } from '../projectCalculatorLab/supplierQuotationCommercialClassification.js';
import { buildQuotationPackageEvidence } from '../../../shared/quotationPackageModel.js';

function nowIso() { return new Date().toISOString(); }
function mapQuote(row) { return { id: row.id, estimateId: row.estimate_id, supplierCode: row.supplier_code, supplierName: row.supplier_name, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at }; }
function money(amount, currency) { return amount == null ? null : { amount: String(amount), currency }; }
function mapRevision(row) { const intended=JSON.parse(row.confirmation_intended_counts_json||'{}'),expected=Number(intended.validCanonicalPositions||0),current={supplierPositions:Number(row.current_supplier_positions||0),productsSupplyRows:Number(row.current_products_supply_rows||0),projectCostingRows:Number(row.current_project_costing_rows||0)},projectionDrift=row.confirmation_status==='confirmed'&&expected>0&&Object.values(current).some((count)=>count!==expected);return { id: row.id, supplierQuoteId: row.supplier_quote_id, estimateId: row.estimate_id, revisionSequence: row.revision_sequence, supplierQuotationNumber: row.supplier_quotation_number, supplierRevision: row.supplier_revision, fullQuotationReference: row.full_quotation_reference, quotationDate: row.quotation_date, customerReference: row.customer_reference, currency: row.currency, vatStatus: row.vat_status, productSubtotal: money(row.product_subtotal_amount, row.currency), extrasTotal: money(row.extras_total_amount, row.currency), deliveryTotal: money(row.delivery_total_amount, row.currency), vatTotal: money(row.vat_total_amount, row.currency), finalSupplierTotal: money(row.final_supplier_total_amount, row.currency), comparisonTotals:JSON.parse(row.comparison_totals_json||'[]'), lifecycleStatus: row.lifecycle_status, confirmationStatus: row.confirmation_status || null, confirmationOperationId: row.confirmation_operation_id || null, confirmationUpdatedAt: row.confirmation_updated_at || null,projectionStatus:row.confirmation_status==='confirmed'?(projectionDrift?'projection_drift':'current'):null,projectionCounts:row.confirmation_status==='confirmed'?{expected,...current}:null,isLatest: !row.superseded_by_revision_id && row.lifecycle_status !== 'archived', createdAt: row.created_at, supersededAt: row.superseded_at, supersededByRevisionId: row.superseded_by_revision_id }; }
function mapAttachment(row) { return { id: row.id, estimateId: row.estimate_id, revisionId: row.revision_id, role: row.role, documentKind: row.document_kind || 'complete_quotation', originalFileName: row.original_file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256, parserEligible: Boolean(row.parser_eligible), uploadedBy: row.uploaded_by || 'local-admin', uploadOrder: Number(row.upload_order || 0), createdAt: row.created_at, derivedFromAttachmentId: row.derived_from_attachment_id, artifactType: row.artifact_type, extractorVersion: row.extractor_version }; }

const stableRevisionEvidenceId = (kind, revisionId, key) => `${kind}-${createHash('sha256').update(`${revisionId}:${key}`).digest('hex')}`;
const normalizeReference = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
const quotationRevisionKey = (quotationNumber, supplierRevision) => {
  const quotation = normalizeReference(quotationNumber); const revision = normalizeReference(supplierRevision);
  return quotation && revision ? `${quotation}|${revision}` : null;
};
const unsignedDecimal = /^\d+(?:\.\d+)?$/;
const signedDecimal = /^-?\d+(?:\.\d+)?$/;
const complementaryDocumentKinds = new Set(['window_schedule','quotation_letter','installation_pricing']);
const allowedManufacturerDocumentKinds = new Set(['complete_quotation','window_schedule','quotation_letter','installation_pricing','supporting_document']);
function geometry(widthMm, heightMm, quantity) { const area = BigInt(widthMm) * BigInt(heightMm) * BigInt(quantity); const perimeter = 2n * BigInt(widthMm + heightMm) * BigInt(quantity) * 1000n; const decimal = (value) => { const raw = value.toString().padStart(7, '0'); return `${raw.slice(0, -6)}.${raw.slice(-6)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }; return { area: decimal(area), perimeter: decimal(perimeter) }; }
const isCanonicalPositionRow = (row, currency = row.currency) => Boolean(row.commercialReadiness !== 'review_required' && normalizeReference(row.displayReference) && Number.isInteger(row.quantity) && row.quantity > 0 && Number.isInteger(row.widthMm) && row.widthMm > 0 && Number.isInteger(row.heightMm) && row.heightMm > 0 && row.currency === currency && (row.unitPrice == null || unsignedDecimal.test(String(row.unitPrice))) && (row.totalPrice == null || unsignedDecimal.test(String(row.totalPrice))));
const isTechnicallySelectablePositionRow = (row) => Boolean(normalizeReference(row.displayReference) && Number.isInteger(row.quantity) && row.quantity > 0 && Number.isInteger(row.widthMm) && row.widthMm > 0 && Number.isInteger(row.heightMm) && row.heightMm > 0 && /^[A-Z]{3}$/.test(String(row.currency || '')));

async function listCanonicalManufacturers(db) {
  return (await db.all('SELECT id,name,code,updated_at FROM configurator_manufacturers WHERE is_active<>0 ORDER BY name').catch(() => [])).map((row) => ({ manufacturerId: row.id, manufacturerName: row.name, manufacturerCode: row.code, updatedAt: row.updated_at }));
}

function recognizedManufacturer(fields) {
  return fields.manufacturer ?? fields.rows.find((row) => row.manufacturerEvidence?.manufacturerName)?.manufacturerEvidence?.manufacturerName ?? null;
}

function manufacturerResolutionForFields(fields, configuredManufacturers, commercialSupplier) {
  const recognizedManufacturerName = recognizedManufacturer(fields);
  const resolution = resolveCanonicalManufacturer({ recognizedManufacturerName, configuredManufacturers });
  if (resolution.manufacturer) return { recognizedManufacturerName, ...resolution };
  const explicitlyDirect = fields.supplierManufacturerRelationship?.relationship === 'direct_manufacturer_supplier'
    && fields.manufacturerIdentity?.authority
    && normalizeManufacturerIdentity(recognizedManufacturerName) === normalizeManufacturerIdentity(fields.supplier);
  if (commercialSupplier && explicitlyDirect) {
    return {
      recognizedManufacturerName,
      status: 'resolved',
      method: 'document_supported_direct_identity',
      candidates: [],
      manufacturer: {
        manufacturerId: `legacy-direct-supplier:${commercialSupplier.supplierCode}`,
        manufacturerName: recognizedManufacturerName,
        manufacturerCode: commercialSupplier.supplierCode,
        compatibilityIdentity: true,
      },
    };
  }
  if (fields.manufacturer) return { recognizedManufacturerName, ...resolution };
  if (!commercialSupplier) return { recognizedManufacturerName, ...resolution };
  return {
    recognizedManufacturerName,
    status: 'resolved',
    method: 'legacy_direct_supplier_compatibility',
    candidates: [],
    manufacturer: {
      manufacturerId: `legacy-direct-supplier:${commercialSupplier.supplierCode}`,
      manufacturerName: recognizedManufacturerName || commercialSupplier.supplierName,
      manufacturerCode: commercialSupplier.supplierCode,
      compatibilityIdentity: true,
    },
  };
}

function resolveReviewQuotationReference(revision, fields) {
  const reviewedReference = String(revision.supplier_quotation_number || '').trim() || null;
  const sourceReference = String(fields.quotation?.supplierQuotationNumber || '').trim() || null;
  const sourceAuthority = fields.quotation?.referenceAuthority ?? fields.metadata?.quotationReferenceAuthority ?? (sourceReference ? 'explicit_source_document' : 'unavailable');
  return {
    quotationNumber: reviewedReference ?? sourceReference,
    quotationReferenceAuthority: reviewedReference ? 'reviewed_user_entered' : sourceAuthority,
    reviewedQuotationReference: reviewedReference,
    sourceQuotationReference: sourceReference,
    sourceQuotationReferenceAuthority: sourceAuthority,
    documentMetadataReference: sourceAuthority === 'pdf_title_metadata' ? sourceReference : null,
  };
}

function commercialSupplierOption(row) {
  let policy = {};
  try { policy = JSON.parse(row.policy_json || '{}'); } catch {}
  const pricingMethod = policy.pricingMethod || policy.pricingBasis || null;
  return { supplierCode: row.supplier_code, supplierName: row.supplier_name, pricingMethod, pricingPolicyAvailable: Boolean(pricingMethod), active: true, policyUpdatedAt: row.updated_at };
}

const legacyPricingMethodHolderCodes = new Set(['FACTORY PRICE', '1 TO 1 PRICING', 'STAGED DISCOUNT']);
function isCommercialSupplierRecord(option) {
  return !(normalizeManufacturerIdentity(option.supplierName) === 'ANY' && legacyPricingMethodHolderCodes.has(String(option.supplierCode).trim().toUpperCase()));
}
async function listCommercialSupplierOptions(db) {
  return (await db.all('SELECT supplier_code,supplier_name,policy_json,updated_at,active FROM supplier_commercial_defaults ORDER BY supplier_name')).map(commercialSupplierOption).filter(isCommercialSupplierRecord);
}
function proposalSource(authority) {
  if (/^explicit_/.test(String(authority || ''))) return 'quotation';
  if (/document_family|eko_web/.test(String(authority || ''))) return 'document_family';
  if (authority === 'configured_manufacturer_supplier_relationship') return 'configured_relationship';
  return null;
}
function commercialSupplierProposalForFields(fields, manufacturerResolution, suppliers) {
  const proposedName = String(fields.commercialSupplierIdentity?.proposedName || fields.supplierManufacturerRelationship?.commercialSupplierName || '').trim();
  if (proposedName) {
    const authority = fields.commercialSupplierIdentity?.authority ?? 'explicit_supplier_relationship';
    return { proposedName, authority, source: proposalSource(authority) };
  }
  const manufacturer = manufacturerResolution?.manufacturer;
  if (!manufacturer) return { proposedName: null, authority: null, source: null };
  const matches = suppliers.filter((item) => normalizeManufacturerIdentity(item.supplierName) === normalizeManufacturerIdentity(manufacturer.manufacturerName));
  if (matches.length !== 1) return { proposedName: null, authority: null, source: null };
  return { proposedName: matches[0].supplierName, authority: 'configured_manufacturer_supplier_relationship', source: 'configured_relationship' };
}

function enrichManufacturerCommercialEvidence(row, fields, manufacturer, commercialSupplier, proposal = null) {
  const manufacturerSystem = canonicalManufacturerSystemIdentity(manufacturer, row.manufacturerEvidence?.productSystem ?? row.productSystem);
  const relationship = createSupplierManufacturerRelationship({ manufacturer, supplier: commercialSupplier, sourceSupplierName: fields.supplier, sourceLegalName: fields.supplierIdentity?.sourceLegalName });
  const manufacturerEvidence = {
    ...(row.manufacturerEvidence || {}),
    manufacturerName: manufacturer.manufacturerName,
    canonicalManufacturer: manufacturer,
    manufacturerSystemIdentity: manufacturerSystem,
    documentIssuer: { name: fields.supplier ?? null, legalName: fields.supplierIdentity?.sourceLegalName ?? null, authority: fields.supplierIdentity?.authority ?? 'not_supplied' },
    commercialSupplier: { supplierCode: commercialSupplier.supplierCode, supplierName: commercialSupplier.supplierName, proposedSourceName: proposal?.proposedName ?? null, proposalAuthority: proposal?.authority ?? null, proposalSource: proposal?.source ?? null },
    supplierManufacturerRelationship: relationship,
  };
  row.manufacturerEvidence = manufacturerEvidence;
  row.manufacturerName = manufacturer.manufacturerName;
  row.originalExtractedSnapshot = {
    ...(row.originalExtractedSnapshot || {}),
    manufacturerEvidence: {
      ...(row.originalExtractedSnapshot?.manufacturerEvidence || {}),
      ...manufacturerEvidence,
    },
  };
}

export function createSupplierQuotesService(db, { attachmentRoot = resolveAttachmentRoot(), extractDocument = extractSupplierDocument, parseFields = parseCommercialFields, parseSummary = parseCommercialSummary, derivePreviews = derivePdfPositionPreviews, failureInjector = async () => {}, evidenceRefreshFailureInjector = async () => {}, fileSupplierAttachments = true } = {}) {
  async function recordRecoverableImportFailure(context, error) {
    if (!context) return;
    const completedAt = nowIso();
    const code = error?.code || 'document_extraction_failed';
    const status = code === 'supplier_confirmation_postcondition_failed' ? 'partial_recovery_required' : 'failed_recoverable';
    const diagnostics = { ...(error?.diagnostics || {}), ...(error?.postState ? { attemptedPostState: error.postState } : {}) };
    const postState = await readSupplierImportState(db, { scenarioId: context.scenarioId, revisionId: context.revision.id });
    try {
      await db.exec('BEGIN IMMEDIATE');
      await db.run(`INSERT INTO supplier_quote_import_operations(id,operation_key,estimate_id,supplier_quote_id,revision_id,scenario_id,current_run_id,status,source_identity_json,selection_identity_json,pre_state_json,intended_counts_json,post_state_json,diagnostics_json,recovery_reason,currency_decision_json,last_error_code,last_error_message,result_json,created_at,updated_at,confirmed_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?,NULL)
        ON CONFLICT(id) DO UPDATE SET current_run_id=excluded.current_run_id,status=CASE WHEN supplier_quote_import_operations.status='confirmed' THEN supplier_quote_import_operations.status ELSE excluded.status END,pre_state_json=excluded.pre_state_json,intended_counts_json=excluded.intended_counts_json,post_state_json=excluded.post_state_json,diagnostics_json=excluded.diagnostics_json,recovery_reason=excluded.recovery_reason,currency_decision_json=excluded.currency_decision_json,last_error_code=excluded.last_error_code,last_error_message=excluded.last_error_message,updated_at=excluded.updated_at`, context.identity.operationId, context.identity.operationKey, context.quote.estimate_id, context.quote.id, context.revision.id, context.scenarioId, context.runId, status, JSON.stringify(context.identity.sourceIdentity), JSON.stringify(context.identity.selectionIdentity), JSON.stringify(context.preState), JSON.stringify(context.intendedCounts), JSON.stringify(postState), JSON.stringify(diagnostics), error?.recoveryReason || code, JSON.stringify(context.currencyDecision), code, error?.message || 'Supplier import failed.', '{}', context.startedAt, completedAt);
      await db.run(`INSERT OR IGNORE INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,completed_at,status,warnings_json,error_code,error_message,operation_id,confirmation_status,diagnostics_json,expected_counts_json,pre_state_json,post_state_json,recovery_reason,currency_decision_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,'failed','[]',?,?,?,?,?,?,?,?,?,?)`, context.runId, context.quote.estimate_id, context.revision.id, 'quotesync-commercial-extractor', EXTRACTOR_VERSION, 'supplier-neutral', FIELD_PARSER_VERSION, SUMMARY_PARSER_VERSION, context.startedAt, completedAt, code, error?.message || 'Supplier import failed.', context.identity.operationId, status, JSON.stringify(diagnostics), JSON.stringify(context.intendedCounts), JSON.stringify(context.preState), JSON.stringify(postState), error?.recoveryReason || code, JSON.stringify(context.currencyDecision));
      for (const [ordinal, attachment] of context.attachments.entries()) await db.run('INSERT OR IGNORE INTO supplier_quote_import_run_attachments(import_run_id,attachment_id,ordinal,role) VALUES(?,?,?,?)', context.runId, attachment.id, ordinal, attachment.role);
      await db.exec('COMMIT');
    } catch {
      try { await db.exec('ROLLBACK'); } catch {}
    }
  }
  async function estimateExists(estimateId) { return Boolean(await db.get('SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL', estimateId)); }
  async function quoteRow(estimateId, quoteId) { return db.get('SELECT * FROM supplier_quotes WHERE id=? AND estimate_id=?', quoteId, estimateId); }
  async function revisionRow(estimateId, quoteId, revisionId) { return db.get('SELECT r.* FROM supplier_quote_revisions r WHERE r.id=? AND r.supplier_quote_id=? AND r.estimate_id=?', revisionId, quoteId, estimateId); }
  async function attachmentRow(estimateId, quoteId, revisionId, attachmentId) { return db.get(`SELECT a.* FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id AND r.estimate_id=a.estimate_id WHERE a.id=? AND a.revision_id=? AND a.estimate_id=? AND r.supplier_quote_id=?`, attachmentId, revisionId, estimateId, quoteId); }
  async function readManufacturerEvidenceRefreshState(estimateId, quoteId, revisionId, attachmentId) {
    const [estimate, quote, revision, attachment] = await Promise.all([
      db.get('SELECT id,estimate_ref,positions_json FROM estimates WHERE id=? AND deleted_at IS NULL', estimateId),
      quoteRow(estimateId, quoteId),
      revisionRow(estimateId, quoteId, revisionId),
      attachmentRow(estimateId, quoteId, revisionId, attachmentId),
    ]);
    if (!estimate || !quote || !revision || !attachment) return null;
    const links = await db.all('SELECT * FROM project_calculator_supplier_quote_revisions WHERE revision_id=? ORDER BY linked_at,rowid', revisionId);
    if (links.length !== 1) throw Object.assign(new Error('Evidence refresh requires exactly one confirmed revision/scenario relationship.'), { code: 'evidence_refresh_relationship_mismatch', count: links.length });
    const link = links[0];
    const [positions, costingRows, operations, runs, fxSnapshots] = await Promise.all([
      db.all('SELECT * FROM supplier_quote_positions WHERE estimate_id=? AND revision_id=? ORDER BY source_sequence,rowid', estimateId, revisionId),
      db.all('SELECT * FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND source_revision_id=? ORDER BY display_reference,rowid', link.scenario_id, revisionId),
      db.all("SELECT id,operation_key,status,confirmed_at FROM supplier_quote_import_operations WHERE revision_id=? AND status='confirmed' ORDER BY created_at,id", revisionId),
      db.all("SELECT id,operation_id,status,confirmation_status,extractor_version,completed_at FROM supplier_quote_import_runs WHERE revision_id=? AND status='completed' AND confirmation_status='confirmed' ORDER BY started_at,id", revisionId),
      db.all('SELECT * FROM project_calculator_supplier_fx_snapshots WHERE scenario_id=? AND supplier_quote_revision_id=? ORDER BY created_at,id', link.scenario_id, revisionId),
    ]);
    let estimatePositions;
    try { estimatePositions = JSON.parse(estimate.positions_json || '[]'); } catch { estimatePositions = []; }
    const canonicalPositions = (Array.isArray(estimatePositions) ? estimatePositions : []).filter((position) => position?.sourceProvenance?.sourceRevisionId === revisionId);
    const commercial = buildCommercialFingerprint({ estimateId, quoteId, revision, attachment, link, fxSnapshots, positions, costingRows, canonicalPositions, operations, runs });
    const snapshots = costingRows.map((row) => {
      let snapshot;
      try { snapshot = JSON.parse(row.source_snapshot_json || '{}'); } catch { snapshot = {}; }
      return { row, snapshot, evidence: summarizeManufacturerEvidence(snapshot) };
    });
    return { estimate, quote, revision, attachment, link, positions, costingRows, canonicalPositions, operations, runs, fxSnapshots, commercial, snapshots };
  }
  async function createQuote(estimateId, input) {
    if (!(await estimateExists(estimateId))) return null;
    const supplierCode = String(input.supplierCode || '').trim().toUpperCase(); const supplierName = String(input.supplierName || '').trim();
    if (!supplierCode || !supplierName) throw Object.assign(new Error('Supplier code and name are required.'), { code: 'invalid_supplier_quote' });
    const quote = { id: randomUUID(), estimateId, supplierCode, supplierName, createdAt: nowIso(), updatedAt: nowIso(), archivedAt: null };
    await db.run('INSERT INTO supplier_quotes(id,estimate_id,supplier_code,supplier_name,created_at,updated_at,archived_at) VALUES(?,?,?,?,?,?,NULL)', quote.id, estimateId, supplierCode, supplierName, quote.createdAt, quote.updatedAt);
    return quote;
  }
  async function listQuotes(estimateId) { if (!(await estimateExists(estimateId))) return null; return (await db.all('SELECT * FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL ORDER BY created_at,rowid', estimateId)).map(mapQuote); }
  async function getQuote(estimateId, quoteId) { const row = await quoteRow(estimateId, quoteId); return row ? mapQuote(row) : null; }
  async function createRevision(estimateId, quoteId, input) {
    await db.exec('BEGIN IMMEDIATE');
    try {
      if (!(await quoteRow(estimateId, quoteId))) { await db.exec('ROLLBACK'); return null; }
      const currency = String(input.currency || 'GBP').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Currency must be a three-letter code.'), { code: 'invalid_revision' });
      const quotationNumber = String(input.supplierQuotationNumber || '').trim(); const supplierRevision = String(input.supplierRevision || '').trim() || null;
      const identity = quotationRevisionKey(quotationNumber, supplierRevision);
      if (identity) {
        const existing = (await db.all("SELECT * FROM supplier_quote_revisions WHERE supplier_quote_id=? AND estimate_id=? AND lifecycle_status<>'archived' ORDER BY revision_sequence DESC", quoteId, estimateId)).find(row => quotationRevisionKey(row.supplier_quotation_number, row.supplier_revision) === identity);
        if (existing) { await db.exec('COMMIT'); return mapRevision(existing); }
      }
      const sequence = Number((await db.get('SELECT COALESCE(MAX(revision_sequence),-1)+1 AS value FROM supplier_quote_revisions WHERE supplier_quote_id=? AND estimate_id=?', quoteId, estimateId)).value);
      const revision = { id: randomUUID(), supplierQuoteId: quoteId, estimateId, revisionSequence: sequence, supplierQuotationNumber: quotationNumber, supplierRevision, fullQuotationReference: String(input.fullQuotationReference || quotationNumber || `Revision ${sequence + 1}`).trim(), quotationDate: input.quotationDate || null, customerReference: String(input.customerReference || '').trim() || null, currency, vatStatus: input.vatStatus || 'unknown', lifecycleStatus: 'uploaded', createdAt: nowIso(), supersededAt: null, supersededByRevisionId: null };
      await db.run(`INSERT INTO supplier_quote_revisions(id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,supplier_revision,full_quotation_reference,quotation_date,customer_reference,currency,vat_status,lifecycle_status,created_at,superseded_at,superseded_by_revision_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL)`, revision.id, quoteId, estimateId, sequence, revision.supplierQuotationNumber, revision.supplierRevision, revision.fullQuotationReference, revision.quotationDate, revision.customerReference, currency, revision.vatStatus, revision.lifecycleStatus, revision.createdAt);
      if (identity) await db.run(`UPDATE supplier_quote_revisions SET lifecycle_status='superseded',superseded_at=?,superseded_by_revision_id=? WHERE supplier_quote_id=? AND estimate_id=? AND id<>? AND superseded_by_revision_id IS NULL AND lifecycle_status NOT IN ('archived','superseded') AND NOT (UPPER(TRIM(supplier_quotation_number))=? AND UPPER(TRIM(COALESCE(supplier_revision,'')))=?)`, revision.createdAt, revision.id, quoteId, estimateId, revision.id, normalizeReference(quotationNumber), normalizeReference(supplierRevision));
      await db.exec('COMMIT'); return { ...revision, productSubtotal: null, extrasTotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: null };
    } catch (error) { try { await db.exec('ROLLBACK'); } catch {} throw error; }
  }
  async function listRevisions(estimateId, quoteId) { if (!(await quoteRow(estimateId, quoteId))) return null; return (await db.all(`SELECT revision.*,
    (SELECT operation.status FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_status,
    (SELECT operation.id FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_operation_id,
    (SELECT operation.updated_at FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_updated_at,
    (SELECT operation.intended_counts_json FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_intended_counts_json,
    (SELECT COUNT(*) FROM supplier_quote_positions position WHERE position.revision_id=revision.id) current_supplier_positions,
    (SELECT COUNT(*) FROM project_calculator_estimate_product_rows product WHERE product.source_revision_id=revision.id) current_products_supply_rows,
    (SELECT COUNT(*) FROM project_calculator_estimate_product_rows product WHERE product.source_revision_id=revision.id AND product.estimate_position_id IS NOT NULL) current_project_costing_rows
    FROM supplier_quote_revisions revision WHERE revision.estimate_id=? AND revision.supplier_quote_id=? ORDER BY revision.revision_sequence DESC`, estimateId, quoteId)).map(mapRevision); }
  async function getRevision(estimateId, quoteId, revisionId) { const row = await db.get(`SELECT revision.*,
    (SELECT operation.status FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_status,
    (SELECT operation.id FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_operation_id,
    (SELECT operation.updated_at FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_updated_at,
    (SELECT operation.intended_counts_json FROM supplier_quote_import_operations operation WHERE operation.revision_id=revision.id ORDER BY operation.updated_at DESC,operation.created_at DESC LIMIT 1) confirmation_intended_counts_json,
    (SELECT COUNT(*) FROM supplier_quote_positions position WHERE position.revision_id=revision.id) current_supplier_positions,
    (SELECT COUNT(*) FROM project_calculator_estimate_product_rows product WHERE product.source_revision_id=revision.id) current_products_supply_rows,
    (SELECT COUNT(*) FROM project_calculator_estimate_product_rows product WHERE product.source_revision_id=revision.id AND product.estimate_position_id IS NOT NULL) current_project_costing_rows
    FROM supplier_quote_revisions revision WHERE revision.id=? AND revision.supplier_quote_id=? AND revision.estimate_id=?`, revisionId, quoteId, estimateId); return row ? mapRevision(row) : null; }
  async function listAttachments(estimateId, quoteId, revisionId) { if (!(await revisionRow(estimateId, quoteId, revisionId))) return null; return (await db.all('SELECT * FROM supplier_quote_attachments WHERE estimate_id=? AND revision_id=? ORDER BY upload_order,created_at,rowid', estimateId, revisionId)).map(mapAttachment); }
  async function getAttachment(estimateId, quoteId, revisionId, attachmentId) { const row = await attachmentRow(estimateId, quoteId, revisionId, attachmentId); return row ? { metadata: mapAttachment(row), storageKey: row.storage_key } : null; }
  async function insertAttachments(estimateId, quoteId, revisionId, attachments) {
    await db.exec('BEGIN IMMEDIATE');
    try {
      if (!(await revisionRow(estimateId, quoteId, revisionId))) throw Object.assign(new Error('Revision not found.'), { code: 'revision_not_found' });
      const nextOrder=Number((await db.get('SELECT COALESCE(MAX(upload_order),-1)+1 value FROM supplier_quote_attachments WHERE estimate_id=? AND revision_id=?',estimateId,revisionId)).value);
      for (const [offset,item] of attachments.entries()) await db.run(`INSERT INTO supplier_quote_attachments(id,estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at,derived_from_attachment_id,artifact_type,extractor_version,document_kind,uploaded_by,upload_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,?,?,?)`, item.id, estimateId, revisionId, item.role, item.originalFileName, item.mediaType, item.sizeBytes, item.sha256, item.storageKey, item.parserEligible ? 1 : 0, item.createdAt,item.documentKind||'complete_quotation',item.uploadedBy||'local-admin',nextOrder+offset);
      await db.exec('COMMIT'); return attachments.map(({ storageKey: _storageKey, ...item }) => item);
    } catch (error) { try { await db.exec('ROLLBACK'); } catch {} throw error; }
  }
  async function createImportRuns(estimateId, documents) {
    if (!(await estimateExists(estimateId))) return null;
    if (!Array.isArray(documents) || !documents.length) throw Object.assign(new Error('Select at least one supplier document.'), { code: 'no_attachments_selected' });
    const groups = new Map();
    for (const item of documents) {
      const row = await attachmentRow(estimateId, String(item.quoteId || ''), String(item.revisionId || ''), String(item.attachmentId || ''));
      if (!row || row.role === 'derived_artifact' || !row.parser_eligible) throw Object.assign(new Error('A selected supplier document is unavailable or not eligible for extraction.'), { code: 'attachment_not_eligible' });
      const key = `${item.quoteId}:${item.revisionId}`; if (!groups.has(key)) groups.set(key, { revisionId: item.revisionId, attachments: [] }); groups.get(key).attachments.push(row);
    }
    const created = [], now = nowIso(); await db.exec('BEGIN IMMEDIATE');
    try { for (const group of groups.values()) { const id = randomUUID(); await db.run(`INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,status,warnings_json) VALUES(?,?,?,?,?,?,?,?,?,'queued','[]')`, id, estimateId, group.revisionId, 'quotesync-commercial-extractor', 'stage-1e', 'supplier-neutral', 'stage-1e', 'not-applicable', now); for (const [ordinal, attachment] of group.attachments.entries()) await db.run('INSERT INTO supplier_quote_import_run_attachments(import_run_id,attachment_id,ordinal,role) VALUES(?,?,?,?)', id, attachment.id, ordinal, attachment.role); created.push({ id, revisionId: group.revisionId, attachmentIds: group.attachments.map(item => item.id), status: 'queued' }); } await db.exec('COMMIT'); return created; } catch (error) { await db.exec('ROLLBACK'); throw error; }
  }
  async function prepareImportReview(estimateId, documents) {
    await reconcileStaleSupplierImportRuns(db);
    if (!(await estimateExists(estimateId))) return null;
    if (!Array.isArray(documents) || !documents.length) throw Object.assign(new Error('Select at least one supplier document.'), { code: 'no_attachments_selected' });
    const suppliers = await listCommercialSupplierOptions(db);
    const manufacturers = await listCanonicalManufacturers(db);
    const reviewedDocuments = [];
    for (const item of documents) {
      const quoteId = String(item.quoteId || ''), revisionId = String(item.revisionId || ''), attachmentId = String(item.attachmentId || '');
      const attachment = await attachmentRow(estimateId, quoteId, revisionId, attachmentId); const revision = attachment && await revisionRow(estimateId, quoteId, revisionId); const quote = attachment && await quoteRow(estimateId, quoteId);
      if (!attachment || !revision || !quote || attachment.role === 'derived_artifact' || !attachment.parser_eligible) throw Object.assign(new Error('A selected supplier document is unavailable or not eligible for extraction.'), { code: 'attachment_not_eligible' });
      const extracted = await extractDocument(resolveManagedPath(attachment.storage_key, attachmentRoot), { id: attachment.id, sha256: attachment.sha256, sessionId: estimateId, mediaType: attachment.media_type }, { visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
      await failureInjector('extraction', { estimateId, quoteId, revisionId, attachmentId: attachment.id });
      if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
      const fields = parseFields(extracted, { currency: revision.currency });
      const reviewSummary = parseSummary(extracted, { currency: revision.currency, positionRows: fields.rows });
      const commercialEvidence = buildSupplierQuotationCommercialClassification({ positionRows: fields.rows, additionalItems: reviewSummary.additionalItems, summary: reviewSummary.summary });
      const previewResult = await derivePreviews({ filename: resolveManagedPath(attachment.storage_key, attachmentRoot), attachment, document: extracted, rows: fields.rows, visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
      extracted.warnings.push(...reviewSummary.warnings, ...previewResult.warnings);
      const validRows=fields.rows.filter((row) => isCanonicalPositionRow(row));
      const diagnostics=createSupplierImportDiagnostics({confirmationAttempted:false,textAvailable:extracted.textAvailable,rawBlocks:extracted.pages?.reduce((sum,page)=>sum+(page.blocks?.length||0),0),sourcePositions:fields.rows.length,candidatePositionBlocks:fields.rows.length,parsedPositions:fields.rows.length,validCanonicalPositions:validRows.length,visualEvidence:fields.rows.filter(row=>row.manufacturerEvidence?.sourceVisual?.status==='available'||row.manufacturerEvidence?.sourceVisual?.originalAsset).length,ambiguousVisualEvidence:fields.rows.filter(row=>row.manufacturerEvidence?.sourceVisual?.mappingReviewStatus==='needs_review').length});
      reviewedDocuments.push({ quoteId, revisionId, attachmentId, adapter: fields.adapter ?? null, quote, revision, fields, diagnostics, commercialEvidence, rows: fields.rows.map(row => { const technicallySelectable=isTechnicallySelectablePositionRow(row),commerciallyReady=isCanonicalPositionRow(row);return { rowKey: `${attachment.id}:${row.ordinal}`, include: technicallySelectable, technicallySelectable, commerciallyReady, commercialReadiness: row.commercialReadiness ?? (commerciallyReady?'canonical_ready':'review_required'), manufacturerName: row.manufacturerEvidence?.manufacturerName ?? fields.manufacturer ?? fields.supplier ?? null, manufacturerItemNumber: row.manufacturerEvidence?.manufacturerItemNumber ?? null, customerReference: row.manufacturerEvidence?.customerReference ?? row.displayReference ?? null, roomLocation: row.manufacturerEvidence?.roomLocation ?? null, product: row.manufacturerEvidence?.product ?? null, productSystem: row.manufacturerEvidence?.productSystem ?? null, configurationDescription: row.manufacturerEvidence?.configurationDescription ?? null, widthMm: row.widthMm ?? null, heightMm: row.heightMm ?? null, areaSquareMetres: row.manufacturerEvidence?.areaSquareMetres ?? null, weightKg: row.manufacturerEvidence?.weightKg ?? null, glassSpecification: row.manufacturerEvidence?.glassSpecification ?? null, fittingsSpecification: row.manufacturerEvidence?.fittingsSpecification ?? null, quantity: row.quantity ?? null, currency: row.currency ?? null, unitPrice: row.unitPrice ?? null, totalPrice: row.totalPrice ?? null, manufacturerQuotedUg: row.manufacturerEvidence?.manufacturerQuotedUg ?? null, manufacturerQuotedUw: row.manufacturerEvidence?.manufacturerQuotedUw ?? null, sourceSpecification: row.manufacturerEvidence?.sourceSpecification ?? null, canonicalSpecification: row.manufacturerEvidence?.canonicalSpecification ?? null, sourceVisuals: row.manufacturerEvidence?.sourceVisuals ?? [], sourceVisual: row.manufacturerEvidence?.sourceVisual ?? { status: 'unavailable', reason: 'No mapped manufacturer visual.' }, warnings: [...(row.warnings ?? []),...(technicallySelectable?[]:['Reference, positive quantity, dimensions and currency are required before this position can be selected.']),...(technicallySelectable&&!commerciallyReady?['Commercial price evidence is incomplete; technical review is available but confirmation remains blocked.']:[])] }; }) });
    }
    const first = reviewedDocuments[0], quotationReference = resolveReviewQuotationReference(first.revision, first.fields), detectedRevision = first.revision.supplier_revision ?? first.fields.quotation?.supplierRevision;
    const detectedDocumentTypes = new Set(reviewedDocuments.map((item) => item.fields.documentType).filter(Boolean));
    const detectedDocumentType = detectedDocumentTypes.size === 1 ? [...detectedDocumentTypes][0] : null;
    const detectedQuotationDate = first.fields.metadata?.quotationDate ?? first.revision.quotation_date ?? null;
    const expectedSupplierSubtotal = first.commercialEvidence?.productSupplyReconciliation?.expectedSubtotal ?? null;
    const hasSourceBackedProductAmount = Boolean(first.commercialEvidence?.productEvidence || first.fields.rows.some((row) => row.totalPrice != null));
    const supplierQuotedSubtotal = expectedSupplierSubtotal ?? (hasSourceBackedProductAmount ? first.commercialEvidence?.categories?.productsSupply?.amount ?? null : null);
    const supplierQuotedTotal = first.commercialEvidence?.supplierQuotedTotal ?? null;
    const positionCurrencies = new Set(reviewedDocuments.flatMap((item) => item.fields.rows.map((row) => row.currency)).filter((currency) => /^[A-Z]{3}$/.test(String(currency || ''))));
    const detectedCurrency = positionCurrencies.size === 1 ? [...positionCurrencies][0] : first.revision.currency;
    const automaticPendingQuote = String(first.quote.supplier_code || '').startsWith('AUTO-') && normalizeManufacturerIdentity(first.quote.supplier_name) === normalizeManufacturerIdentity('Automatic identification pending');
    const recognizedDealerName = first.fields.supplier ?? (automaticPendingQuote ? null : first.quote.supplier_name);
    const issuerIsAuthoritative = first.fields.supplierIdentity?.authority === 'explicit_document_issuer';
    const dealerResolution = recognizedDealerName
      ? resolveCanonicalSupplier({ recognizedSupplierName: recognizedDealerName, storedSupplierCode: issuerIsAuthoritative ? null : first.quote.supplier_code, storedSupplierName: issuerIsAuthoritative ? null : first.quote.supplier_name, configuredSuppliers: suppliers })
      : { status: 'not_supplied', supplier: null, method: null, candidates: [] };
    const preliminaryManufacturerResolution = manufacturerResolutionForFields(first.fields, manufacturers, null);
    const commercialSupplierProposal = commercialSupplierProposalForFields(first.fields, preliminaryManufacturerResolution, suppliers);
    const recognizedCommercialSupplierName = commercialSupplierProposal.proposedName;
    const commercialSupplierResolution = recognizedCommercialSupplierName
      ? resolveCanonicalSupplier({ recognizedSupplierName: recognizedCommercialSupplierName, storedSupplierCode: null, storedSupplierName: null, configuredSuppliers: suppliers })
      : { status: 'not_supplied', supplier: null, method: null, candidates: [] };
    const manufacturerResolution = preliminaryManufacturerResolution.manufacturer ? preliminaryManufacturerResolution : manufacturerResolutionForFields(first.fields, manufacturers, commercialSupplierResolution.supplier);
    for (const item of reviewedDocuments) item.diagnostics = createSupplierImportDiagnostics({ ...item.diagnostics.counts, confirmationAttempted: false, canonicalSupplierStatus: commercialSupplierResolution.status });
    return {
      estimateId,
      documents: reviewedDocuments.map(({ fields: _fields, quote: _quote, revision: _revision, ...item }) => item),
      metadata: {
        recognizedSupplierName: recognizedDealerName,
        recognizedDealerName,
        recognizedManufacturerName: manufacturerResolution.recognizedManufacturerName,
        recognizedCommercialSupplierName,
        supplierIdentityRole: 'quotation_issuer',
        manufacturerIdentityRole: 'product_manufacturer',
        commercialSupplierIdentityRole: 'commercial_supplier',
        storedSupplierName: first.quote.supplier_name,
        supplierResolutionStatus: dealerResolution.status,
        supplierResolutionMethod: dealerResolution.method,
        dealerResolutionStatus: dealerResolution.status,
        dealerResolutionMethod: dealerResolution.method,
        supplierName: commercialSupplierResolution.supplier?.supplierName ?? recognizedCommercialSupplierName,
        supplierCode: commercialSupplierResolution.supplier?.supplierCode ?? null,
        commercialSupplierName: commercialSupplierResolution.supplier?.supplierName ?? recognizedCommercialSupplierName,
        commercialSupplierCode: commercialSupplierResolution.supplier?.supplierCode ?? null,
        commercialSupplierResolutionStatus: commercialSupplierResolution.status,
        commercialSupplierResolutionMethod: commercialSupplierResolution.method,
        commercialSupplierProposalAuthority: commercialSupplierProposal.authority,
        commercialSupplierProposalSource: commercialSupplierProposal.source,
        commercialSupplierActive: commercialSupplierResolution.supplier?.active ?? null,
        manufacturerResolutionStatus: manufacturerResolution.status,
        manufacturerResolutionMethod: manufacturerResolution.method,
        manufacturerId: manufacturerResolution.manufacturer?.manufacturerId ?? null,
        manufacturerName: manufacturerResolution.manufacturer?.manufacturerName ?? manufacturerResolution.recognizedManufacturerName,
        manufacturerCode: manufacturerResolution.manufacturer?.manufacturerCode ?? null,
        supplierManufacturerRelationship: first.fields.supplierManufacturerRelationship ?? (recognizedCommercialSupplierName ? {
          relationship: normalizeManufacturerIdentity(manufacturerResolution.recognizedManufacturerName) === normalizeManufacturerIdentity(recognizedCommercialSupplierName) ? 'direct_manufacturer_supplier' : 'dealer_supplies_manufacturer_products',
          documentIssuerName: recognizedDealerName,
          commercialSupplierName: recognizedCommercialSupplierName,
          manufacturerName: manufacturerResolution.recognizedManufacturerName,
          pricingScope: 'commercial_supplier_quotation',
        } : null),
        quotationNumber: quotationReference.quotationNumber,
        quotationReferenceAuthority: quotationReference.quotationReferenceAuthority,
        reviewedQuotationReference: quotationReference.reviewedQuotationReference,
        sourceQuotationReference: quotationReference.sourceQuotationReference,
        sourceQuotationReferenceAuthority: quotationReference.sourceQuotationReferenceAuthority,
        documentMetadataReference: quotationReference.documentMetadataReference,
        revision: detectedRevision,
        currency: detectedCurrency,
        quotationDate: detectedQuotationDate,
        documentType: detectedDocumentType,
        supplierQuotedSubtotal,
        supplierQuotedTotal,
      },
      canonicalManufacturers: manufacturers,
      commercialSuppliers: suppliers,
      canonicalSuppliers: suppliers,
      positionCount: reviewedDocuments.reduce((sum, item) => sum + item.rows.length, 0),
    };
  }
  async function regenerateManufacturerVisuals(estimateId, quoteId, revisionId, attachmentId) {
    const attachment = await attachmentRow(estimateId, quoteId, revisionId, attachmentId);
    const revision = attachment && await revisionRow(estimateId, quoteId, revisionId);
    if (!attachment || !revision || attachment.role === 'derived_artifact' || !attachment.parser_eligible) return null;
    const extracted = await extractDocument(resolveManagedPath(attachment.storage_key, attachmentRoot), { id: attachment.id, sha256: attachment.sha256, sessionId: estimateId, mediaType: attachment.media_type }, { visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
    if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
    const fields = parseFields(extracted, { currency: revision.currency });
    const previewResult = await derivePreviews({ filename: resolveManagedPath(attachment.storage_key, attachmentRoot), attachment, document: extracted, rows: fields.rows, visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
    extracted.warnings.push(...previewResult.warnings);
    const positions = await db.all('SELECT id,display_reference FROM supplier_quote_positions WHERE estimate_id=? AND revision_id=? ORDER BY source_sequence,rowid', estimateId, revisionId);
    const positionsByReference = new Map();
    for (const position of positions) { const key = normalizeReference(position.display_reference); positionsByReference.set(key, [...(positionsByReference.get(key) || []), position]); }
    const updates = [];
    for (const row of fields.rows) {
      const visual = row.manufacturerEvidence?.sourceVisual;
      const matches = positionsByReference.get(normalizeReference(row.displayReference)) || [];
      if (matches.length === 1 && visual?.status === 'available' && visual.url) updates.push({ sourcePositionId: matches[0].id, visual });
    }
    let updatedCostingRows = 0;
    await db.exec('BEGIN IMMEDIATE');
    try {
      for (const update of updates) {
        const costingRows = await db.all('SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_position_id=? AND source_revision_id=?', update.sourcePositionId, revisionId);
        for (const costingRow of costingRows) {
          const snapshot = JSON.parse(costingRow.source_snapshot_json || '{}');
          snapshot.manufacturerEvidence = { ...(snapshot.manufacturerEvidence || {}), sourceVisual: update.visual };
          snapshot.sourceVisual = update.visual;
          snapshot.originalExtractedSnapshot = { ...(snapshot.originalExtractedSnapshot || {}), manufacturerEvidence: { ...(snapshot.originalExtractedSnapshot?.manufacturerEvidence || {}), sourceVisual: update.visual } };
          await db.run('UPDATE project_calculator_estimate_product_rows SET source_snapshot_json=?,updated_at=? WHERE id=?', JSON.stringify(snapshot), nowIso(), costingRow.id);
          updatedCostingRows += 1;
        }
      }
      await db.exec('COMMIT');
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
    return { estimateId, quoteId, revisionId, attachmentId, positionCount: fields.rows.length, availablePreviews: fields.rows.filter(row => row.manufacturerEvidence?.sourceVisual?.status === 'available').length, retainedSources: extracted.manufacturerVisualCandidates.filter(item => item.originalAsset).length, updatedCostingRows, warnings: extracted.warnings };
  }
  async function inspectManufacturerEvidenceRefresh(estimateId, quoteId, revisionId, attachmentId) {
    const state = await readManufacturerEvidenceRefreshState(estimateId, quoteId, revisionId, attachmentId);
    if (!state) return null;
    const integrity = await readFileIntegrity(resolveManagedPath(state.attachment.storage_key, attachmentRoot));
    return {
      estimateId,
      estimateReference: state.estimate.estimate_ref,
      quoteId,
      revisionId,
      attachmentId,
      scenarioId: state.link.scenario_id,
      quotationNumber: state.revision.supplier_quotation_number,
      supplier: { code: state.quote.supplier_code, name: state.quote.supplier_name },
      currency: { revision: state.revision.currency, link: state.link.currency, positions: [...new Set(state.positions.map((row) => row.currency))], costing: [...new Set(state.costingRows.map((row) => row.currency))] },
      source: { storedSha256: state.attachment.sha256, actualSha256: integrity.sha256, storedSizeBytes: Number(state.attachment.size_bytes), actualSizeBytes: integrity.sizeBytes, unchanged: state.attachment.sha256 === integrity.sha256 && Number(state.attachment.size_bytes) === integrity.sizeBytes },
      counts: { confirmedOperations: state.operations.length, completedRuns: state.runs.length, supplierPositions: state.positions.length, productsSupply: state.canonicalPositions.length, projectCostingProducts: state.costingRows.length },
      commercialFingerprintHash: state.commercial.hash,
      commercialFingerprints: state.commercial.fingerprint.rows,
      commercialContext: { revision: state.commercial.fingerprint.revision, revisionScenarioLink: state.commercial.fingerprint.revisionScenarioLink, fxSnapshots: state.commercial.fingerprint.fxSnapshots },
      evidence: state.snapshots.map(({ row, evidence }) => ({ reference: row.display_reference, projectCostingIdentity: row.id, ...evidence })),
    };
  }
  async function inspectManufacturerEvidenceRefreshRuntime(estimateId, quoteId, revisionId, attachmentId) {
    const state = await readManufacturerEvidenceRefreshState(estimateId, quoteId, revisionId, attachmentId);
    if (!state || state.attachment.role === 'derived_artifact' || !state.attachment.parser_eligible) return null;
    const sourcePath = resolveManagedPath(state.attachment.storage_key, attachmentRoot);
    const integrity = await readFileIntegrity(sourcePath);
    if (integrity.sha256 !== state.attachment.sha256 || integrity.sizeBytes !== Number(state.attachment.size_bytes)) throw Object.assign(new Error('Immutable manufacturer source identity differs from persisted attachment evidence.'), { code: 'evidence_refresh_source_mismatch' });
    const extracted = await extractDocument(sourcePath, { id: state.attachment.id, sha256: state.attachment.sha256, sessionId: estimateId, mediaType: state.attachment.media_type }, { visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
    if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
    const fields = parseFields(extracted, { currency: state.revision.currency });
    assertExtractedCommercialEvidence(fields.rows, state.commercial.fingerprint.rows);
    const previewResult = await derivePreviews({ filename: sourcePath, attachment: state.attachment, document: extracted, rows: fields.rows, visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
    const sourceSpecificationVersions = [...new Set(fields.rows.map((row) => row.manufacturerEvidence?.sourceSpecification?.version).filter(Boolean))];
    const internalSpecificationVersions = [...new Set(fields.rows.map((row) => row.manufacturerEvidence?.internalSpecification?.version).filter(Boolean))];
    const visualMappingMethods = [...new Set(fields.rows.flatMap((row) => row.manufacturerEvidence?.sourceVisuals || []).map((visual) => visual.mappingMethod).filter(Boolean))].sort();
    const identity = createManufacturerEvidenceRefreshIdentity({ estimateId, quoteId, revisionId, attachmentId, sourceSha256: integrity.sha256, sourceSpecificationVersion: sourceSpecificationVersions[0], internalSpecificationVersion: internalSpecificationVersions[0], visualMappingMethods, renderVersion: PDF_POSITION_PREVIEW_VERSION });
    const positions = fields.rows.map((row) => {
      const visuals = row.manufacturerEvidence?.sourceVisuals || [];
      const inside = visuals.find((visual) => visual.role === 'inside');
      return {
        reference: row.displayReference,
        primaryRole: row.manufacturerEvidence?.sourceVisual?.role ?? null,
        roles: visuals.map((visual) => visual.role),
        availableRoles: visuals.filter((visual) => visual.status === 'available').map((visual) => visual.role),
        reviewStates: visuals.map((visual) => visual.mappingReviewStatus),
        mappingMethods: [...new Set(visuals.map((visual) => visual.mappingMethod).filter(Boolean))],
        renderVersions: [...new Set(visuals.map((visual) => visual.renderedDerivative?.renderVersion).filter(Boolean))],
        inside: inside ? { sourcePage: inside.sourcePage, boundingRegion: inside.boundingRegion, mappingMethod: inside.mappingMethod, mappingReviewStatus: inside.mappingReviewStatus, renderVersion: inside.renderedDerivative?.renderVersion, url: inside.renderedDerivative?.url, geometryEvidence: inside.geometryEvidence } : null,
      };
    });
    return {
      readOnly: true,
      source: { sha256: integrity.sha256, sizeBytes: integrity.sizeBytes },
      commercialFingerprintHash: state.commercial.hash,
      runtime: { pdfRuntime: PDFJS_RUNTIME_VERSION, renderVersion: PDF_POSITION_PREVIEW_VERSION, drawingClassifier: EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION, completeInsideDrawingPanelGeometry: EKO_INSIDE_DRAWING_PANEL_GEOMETRY_VERSION, sourceSpecificationVersion: sourceSpecificationVersions[0] ?? null, internalSpecificationVersion: internalSpecificationVersions[0] ?? null, visualRoleMapping: { inside: 'inside', outside: 'outside', unknown: 'unknown' } },
      expectedRefreshIdentity: identity,
      counts: { positions: positions.length, automaticInsideRegions: positions.filter((position) => position.inside?.mappingReviewStatus === 'mapped_automatic').length, insideRoles: positions.filter((position) => position.availableRoles.includes('inside')).length, outsideRoles: positions.filter((position) => position.availableRoles.includes('outside')).length, combinedSourceRoles: positions.filter((position) => position.availableRoles.includes('combined_source')).length, availableVisuals: positions.reduce((count, position) => count + position.availableRoles.length, 0), reviewRequiredPositions: positions.filter((position) => position.reviewStates.includes('review_required')).length },
      previewResult,
      warnings: [...extracted.warnings, ...previewResult.warnings],
      positions,
    };
  }
  async function refreshManufacturerEvidence(estimateId, quoteId, revisionId, attachmentId, guard = {}) {
    const initial = await readManufacturerEvidenceRefreshState(estimateId, quoteId, revisionId, attachmentId);
    if (!initial || initial.attachment.role === 'derived_artifact' || !initial.attachment.parser_eligible) return null;
    const expectedCount = Number(guard.expectedPositionCount ?? initial.positions.length);
    const expectedOperationCount = Number(guard.expectedOperationCount ?? initial.operations.length);
    const expectedRunCount = Number(guard.expectedRunCount ?? initial.runs.length);
    const assertState = (state, stage) => {
      const counts = { supplierPositions: state.positions.length, productsSupply: state.canonicalPositions.length, projectCostingProducts: state.costingRows.length, confirmedOperations: state.operations.length, completedRuns: state.runs.length };
      if (expectedCount <= 0 || counts.supplierPositions !== expectedCount || counts.productsSupply !== expectedCount || counts.projectCostingProducts !== expectedCount || counts.confirmedOperations !== expectedOperationCount || counts.completedRuns !== expectedRunCount) throw Object.assign(new Error(`Evidence refresh ${stage} state does not match the confirmed commercial baseline.`), { code: 'evidence_refresh_baseline_mismatch', stage, counts, expected: { positionCount: expectedCount, operationCount: expectedOperationCount, runCount: expectedRunCount } });
      const unique = (values) => new Set(values).size === values.length;
      if (!unique(state.positions.map((row) => row.id)) || !unique(state.positions.map((row) => normalizeReference(row.display_reference))) || !unique(state.costingRows.map((row) => row.id)) || !unique(state.costingRows.map((row) => row.source_position_id)) || !unique(state.costingRows.map((row) => row.estimate_position_id)) || !unique(state.canonicalPositions.map((row) => row.id))) throw Object.assign(new Error(`Evidence refresh ${stage} state contains duplicate commercial identities.`), { code: 'evidence_refresh_duplicate_identity', stage });
      if (state.positions.some((position) => !state.costingRows.some((row) => row.source_position_id === position.id)) || state.costingRows.some((row) => row.source_attachment_id !== attachmentId || row.source_revision_id !== revisionId)) throw Object.assign(new Error(`Evidence refresh ${stage} source relationships are incomplete.`), { code: 'evidence_refresh_relationship_mismatch', stage });
      if (guard.expectedCommercialFingerprintHash && state.commercial.hash !== guard.expectedCommercialFingerprintHash) throw Object.assign(new Error(`Evidence refresh ${stage} commercial fingerprint differs from the approved baseline.`), { code: 'evidence_refresh_fingerprint_mismatch', stage, expected: guard.expectedCommercialFingerprintHash, actual: state.commercial.hash });
      if (guard.expectedCurrency && (state.revision.currency !== guard.expectedCurrency || state.link.currency !== guard.expectedCurrency || state.costingRows.some((row) => row.currency !== guard.expectedCurrency) || state.positions.some((row) => row.currency !== guard.expectedCurrency))) throw Object.assign(new Error(`Evidence refresh ${stage} currency differs from the approved baseline.`), { code: 'evidence_refresh_currency_mismatch', stage });
      return counts;
    };
    const preCounts = assertState(initial, 'pre-extraction');
    const sourcePath = resolveManagedPath(initial.attachment.storage_key, attachmentRoot);
    const integrity = await readFileIntegrity(sourcePath);
    if (integrity.sha256 !== initial.attachment.sha256 || integrity.sizeBytes !== Number(initial.attachment.size_bytes) || (guard.expectedSourceSha256 && integrity.sha256 !== guard.expectedSourceSha256)) throw Object.assign(new Error('Immutable manufacturer source identity differs from the approved evidence-refresh source.'), { code: 'evidence_refresh_source_mismatch', storedSha256: initial.attachment.sha256, actualSha256: integrity.sha256, expectedSha256: guard.expectedSourceSha256 ?? null });
    const extracted = await extractDocument(sourcePath, { id: initial.attachment.id, sha256: initial.attachment.sha256, sessionId: estimateId, mediaType: initial.attachment.media_type }, { visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
    if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
    const fields = parseFields(extracted, { currency: initial.revision.currency });
    const matches = assertExtractedCommercialEvidence(fields.rows, initial.commercial.fingerprint.rows);
    const sourceSpecificationVersions = new Set(fields.rows.map((row) => row.manufacturerEvidence?.sourceSpecification?.version).filter(Boolean));
    if (sourceSpecificationVersions.size !== 1) throw Object.assign(new Error('Evidence refresh requires one complete structured source-specification version across all confirmed positions.'), { code: 'evidence_refresh_specification_incomplete', versions: [...sourceSpecificationVersions] });
    const sourceSpecificationVersion = [...sourceSpecificationVersions][0];
    const internalSpecificationVersions = new Set(fields.rows.map((row) => row.manufacturerEvidence?.internalSpecification?.version).filter(Boolean));
    if (internalSpecificationVersions.size !== 1) throw Object.assign(new Error('Evidence refresh requires one complete internal manufacturer-specification version across all confirmed positions.'), { code: 'evidence_refresh_internal_specification_incomplete', versions: [...internalSpecificationVersions] });
    const internalSpecificationVersion = [...internalSpecificationVersions][0];
    const visualMappingMethods = [...new Set(fields.rows.flatMap((row) => row.manufacturerEvidence?.sourceVisuals || []).map((visual) => visual.mappingMethod).filter(Boolean))].sort();
    const identity = createManufacturerEvidenceRefreshIdentity({ estimateId, quoteId, revisionId, attachmentId, sourceSha256: integrity.sha256, sourceSpecificationVersion, internalSpecificationVersion, visualMappingMethods, renderVersion: PDF_POSITION_PREVIEW_VERSION });
    const evidenceIsCurrent = (evidence) => evidence.refreshIdentity === identity.id
      && evidence.sourceSpecificationVersion === sourceSpecificationVersion
      && evidence.internalSpecificationVersion === internalSpecificationVersion
      && evidence.primaryVisualRole === 'inside'
      && ['inside', 'outside', 'combined_source'].every((role) => evidence.availableVisualRoles.includes(role))
      && visualMappingMethods.every((method) => evidence.visualMappingMethods.includes(method))
      && evidence.visualRenderVersions.length === 1
      && evidence.visualRenderVersions[0] === PDF_POSITION_PREVIEW_VERSION;
    const alreadyCurrent = initial.snapshots.length === expectedCount && initial.snapshots.every(({ evidence }) => evidenceIsCurrent(evidence));
    if (alreadyCurrent) return { estimateId, quoteId, revisionId, attachmentId, scenarioId: initial.link.scenario_id, refreshIdentity: identity.id, refreshVersion: MANUFACTURER_EVIDENCE_REFRESH_VERSION, status: 'already_current', idempotent: true, sourceSha256: integrity.sha256, commercialFingerprintHash: initial.commercial.hash, preCounts, postCounts: preCounts, updatedPositions: 0, evidence: initial.snapshots.map(({ row, evidence }) => ({ reference: row.display_reference, ...evidence })), warnings: extracted.warnings };
    const previewResult = await derivePreviews({ filename: sourcePath, attachment: initial.attachment, document: extracted, rows: fields.rows, visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
    extracted.warnings.push(...previewResult.warnings);
    const invalidEvidence = fields.rows.filter((row) => row.manufacturerEvidence?.sourceSpecification?.version !== sourceSpecificationVersion || row.manufacturerEvidence?.sourceSpecification?.sourceAttachmentHash !== integrity.sha256 || row.manufacturerEvidence?.internalSpecification?.version !== internalSpecificationVersion || row.manufacturerEvidence?.sourceVisual?.role !== 'inside' || !['inside', 'outside', 'combined_source'].every((role) => row.manufacturerEvidence?.sourceVisuals?.some((visual) => visual.role === role && visual.status === 'available' && visual.originalAsset?.sha256 === integrity.sha256 && visual.mappingMethod && visual.renderedDerivative?.renderVersion === PDF_POSITION_PREVIEW_VERSION)));
    if (invalidEvidence.length) throw Object.assign(new Error('Structured manufacturer evidence or visual-role derivation is incomplete; no evidence was refreshed.'), { code: 'evidence_refresh_evidence_incomplete', positions: invalidEvidence.map((row) => row.displayReference) });
    await evidenceRefreshFailureInjector('before_transaction', { identity, matches });
    const refreshedAt = nowIso();
    const refreshRecord = { id: identity.id, version: MANUFACTURER_EVIDENCE_REFRESH_VERSION, sourceSha256: integrity.sha256, sourceSpecificationVersion, internalSpecificationVersion, visualMappingMethods, renderVersion: PDF_POSITION_PREVIEW_VERSION, refreshedAt };
    let postState;
    await db.exec('BEGIN IMMEDIATE');
    try {
      const locked = await readManufacturerEvidenceRefreshState(estimateId, quoteId, revisionId, attachmentId);
      assertState(locked, 'transaction-start');
      if (locked.commercial.hash !== initial.commercial.hash) throw Object.assign(new Error('Commercial state changed while manufacturer evidence was being prepared.'), { code: 'evidence_refresh_fingerprint_mismatch', stage: 'transaction-start', expected: initial.commercial.hash, actual: locked.commercial.hash });
      const lockedSnapshotsBySource = new Map(locked.snapshots.map((item) => [item.row.source_position_id, item]));
      for (const [index, match] of matches.entries()) {
        const current = lockedSnapshotsBySource.get(match.expected.supplierPositionIdentity);
        if (!current) throw Object.assign(new Error(`Confirmed position ${match.expected.customerManufacturerReference} has no unique evidence projection.`), { code: 'evidence_refresh_relationship_mismatch', position: match.expected.customerManufacturerReference });
        const nextSnapshot = enrichManufacturerSourceSnapshot(current.snapshot, match.row, refreshRecord);
        const result = await db.run('UPDATE project_calculator_estimate_product_rows SET source_snapshot_json=? WHERE id=? AND source_position_id=? AND source_revision_id=? AND source_attachment_id=?', JSON.stringify(nextSnapshot), current.row.id, match.expected.supplierPositionIdentity, revisionId, attachmentId);
        if (result.changes !== 1) throw Object.assign(new Error(`Evidence update for position ${match.expected.customerManufacturerReference} did not target exactly one canonical row.`), { code: 'evidence_refresh_update_mismatch', position: match.expected.customerManufacturerReference });
        await evidenceRefreshFailureInjector('after_position_update', { index, reference: match.expected.customerManufacturerReference, identity });
      }
      await evidenceRefreshFailureInjector('before_postcondition', { identity });
      postState = await readManufacturerEvidenceRefreshState(estimateId, quoteId, revisionId, attachmentId);
      const postCounts = assertState(postState, 'postcondition');
      if (postState.commercial.hash !== initial.commercial.hash) throw Object.assign(new Error('Evidence refresh changed protected commercial state.'), { code: 'evidence_refresh_commercial_mutation', expected: initial.commercial.hash, actual: postState.commercial.hash });
      const incomplete = postState.snapshots.filter(({ evidence }) => !evidenceIsCurrent(evidence));
      if (incomplete.length) throw Object.assign(new Error('Evidence refresh postcondition failed; all position updates were rolled back.'), { code: 'evidence_refresh_postcondition_failed', positions: incomplete.map(({ row }) => row.display_reference) });
      await db.exec('COMMIT');
      return { estimateId, quoteId, revisionId, attachmentId, scenarioId: initial.link.scenario_id, refreshIdentity: identity.id, refreshVersion: MANUFACTURER_EVIDENCE_REFRESH_VERSION, status: 'refreshed', idempotent: false, sourceSha256: integrity.sha256, commercialFingerprintHash: initial.commercial.hash, preCounts, postCounts, updatedPositions: expectedCount, evidence: postState.snapshots.map(({ row, evidence }) => ({ reference: row.display_reference, ...evidence })), previewResult, warnings: extracted.warnings };
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
  }
  async function extractAndLoadSupplierCosts(estimateId, scenarioId, documents, confirmation = {}) {
    await reconcileStaleSupplierImportRuns(db);
    if (!(await estimateExists(estimateId))) return null;
    const scenario = await db.get('SELECT * FROM project_calculator_lab_scenarios WHERE id=? AND estimate_id=?', scenarioId, estimateId);
    if (!scenario) throw Object.assign(new Error('Project Costing record not found for this estimate.'), { code: 'scenario_not_found' });
    if (!Array.isArray(documents) || !documents.length) throw Object.assign(new Error('Select at least one supplier document.'), { code: 'no_attachments_selected' });
    if (Array.isArray(confirmation.selectedRowKeys) && !confirmation.selectedRowKeys.length) throw Object.assign(new Error('Select at least one extracted position.'), { code: 'no_positions_selected' });
    const configuredSuppliers = await listCommercialSupplierOptions(db);
    const configuredManufacturers = await listCanonicalManufacturers(db);
    const requestedCommercialSupplierCode = confirmation.commercialSupplierCode ?? confirmation.supplierCode;
    const requestedCommercialSupplier = requestedCommercialSupplierCode ? configuredSuppliers.find((item) => item.supplierCode === String(requestedCommercialSupplierCode).trim().toUpperCase()) : null;
    const requestedManufacturer = confirmation.manufacturerId ? configuredManufacturers.find((item) => item.manufacturerId === String(confirmation.manufacturerId).trim()) : null;
    if (!requestedCommercialSupplierCode || !requestedCommercialSupplier) throw Object.assign(new Error('Commercial supplier/pricing required before Import to Project Costing.'), { code: 'commercial_supplier_required' });
    if (!requestedCommercialSupplier.pricingPolicyAvailable) throw Object.assign(new Error('Commercial supplier/pricing required before Import to Project Costing.'), { code: 'commercial_supplier_pricing_required' });
    if (confirmation.manufacturerId && !requestedManufacturer) throw Object.assign(new Error('Choose an active canonical manufacturer.'), { code: 'canonical_manufacturer_required' });
    const selectedDocuments = [];
    for (const item of documents) {
      const quoteId = String(item.quoteId || ''); const revisionId = String(item.revisionId || '');
      const attachment = await attachmentRow(estimateId, quoteId, revisionId, String(item.attachmentId || ''));
      const revision = attachment && await revisionRow(estimateId, quoteId, revisionId); const quote = attachment && await quoteRow(estimateId, quoteId);
      if (!attachment || !revision || !quote || attachment.role === 'derived_artifact' || !attachment.parser_eligible) throw Object.assign(new Error('A selected supplier document is unavailable or not eligible for extraction.'), { code: 'attachment_not_eligible' });
      const storedRevisionCurrency = revision.currency;
      if (confirmation.metadata) { const metadata = confirmation.metadata; revision.supplier_quotation_number = String(metadata.quotationNumber || revision.supplier_quotation_number || '').trim(); revision.supplier_revision = String(metadata.revision || '').trim() || null; revision.full_quotation_reference = [revision.supplier_quotation_number, revision.supplier_revision].filter(Boolean).join('-') || revision.full_quotation_reference; revision.currency = String(metadata.currency || revision.currency).trim().toUpperCase(); revision.quotation_date = String(metadata.quotationDate || revision.quotation_date || '').trim() || null; }
      const extracted = await extractDocument(resolveManagedPath(attachment.storage_key, attachmentRoot), { id: attachment.id, sha256: attachment.sha256, sessionId: estimateId, mediaType: attachment.media_type }, { visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
      await failureInjector('extraction', { estimateId, quoteId, revisionId, attachmentId: attachment.id });
      if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
      const fields = parseFields(extracted, { currency: revision.currency });
      const previewResult = await derivePreviews({ filename: resolveManagedPath(attachment.storage_key, attachmentRoot), attachment, document: extracted, rows: fields.rows, visualRoot: path.join(attachmentRoot, 'manufacturer-position-visuals') });
      extracted.warnings.push(...previewResult.warnings);
      const detectedManufacturer = recognizedManufacturer(fields, requestedCommercialSupplier.supplierName);
      if (requestedManufacturer && fields.manufacturer && normalizeManufacturerIdentity(requestedManufacturer.manufacturerName) !== normalizeManufacturerIdentity(detectedManufacturer)) throw Object.assign(new Error(`Selected canonical manufacturer ${requestedManufacturer.manufacturerName} conflicts with explicit source manufacturer ${detectedManufacturer}.`), { code: 'manufacturer_identity_mismatch' });
      const manufacturerResolution = requestedManufacturer
        ? { recognizedManufacturerName: detectedManufacturer, status: 'resolved', manufacturer: requestedManufacturer, method: 'reviewed_manufacturer_selection' }
        : manufacturerResolutionForFields(fields, configuredManufacturers, requestedCommercialSupplier);
      if (!manufacturerResolution.manufacturer) throw Object.assign(new Error(`Canonical manufacturer required. Manufacturer recognised: ${detectedManufacturer || 'unknown'}. Configure or select one controlled manufacturer identity before confirmation.`), { code: 'canonical_manufacturer_required', manufacturerResolutionStatus: manufacturerResolution.status });
      quote.supplier_code = requestedCommercialSupplier.supplierCode; quote.supplier_name = requestedCommercialSupplier.supplierName;
      const commercialSupplierProposal = commercialSupplierProposalForFields(fields, manufacturerResolution, configuredSuppliers);
      for (const row of fields.rows) enrichManufacturerCommercialEvidence(row, fields, manufacturerResolution.manufacturer, requestedCommercialSupplier, commercialSupplierProposal);
      const extractedPositionCount=fields.rows.length;
      const allRows=fields.rows.map((row)=>structuredClone(row));
      if (Array.isArray(confirmation.selectedRowKeys)) fields.rows = fields.rows.filter(row => confirmation.selectedRowKeys.includes(`${attachment.id}:${row.ordinal}`));
      if (Array.isArray(confirmation.selectedRowKeys)) for (const row of fields.rows) { const visual=row.manufacturerEvidence?.sourceVisual; if (visual?.status==='available') { visual.customerReviewStatus='approved'; visual.reviewedAt=nowIso(); if(row.originalExtractedSnapshot?.manufacturerEvidence?.sourceVisual){row.originalExtractedSnapshot.manufacturerEvidence.sourceVisual.customerReviewStatus='approved';row.originalExtractedSnapshot.manufacturerEvidence.sourceVisual.reviewedAt=visual.reviewedAt;} } }
      const summaryResult = parseSummary(extracted, { currency: revision.currency, positionRows: fields.rows });
      const reviewedDocumentKind = confirmation.metadata && allowedManufacturerDocumentKinds.has(String(confirmation.metadata.documentType || '')) ? String(confirmation.metadata.documentType) : null;
      const effectiveDocumentKind = reviewedDocumentKind ?? (complementaryDocumentKinds.has(fields.documentType) ? fields.documentType : attachment.document_kind);
      selectedDocuments.push({ quoteId, revisionId, quote, revision, storedRevisionCurrency, attachment: { ...attachment, document_kind: effectiveDocumentKind }, extracted, fields, allRows, summaryResult, effectiveDocumentKind, extractedPositionCount });
    }
    const groups = new Map();
    for (const selected of selectedDocuments) {
      const { quoteId, revisionId, quote, revision, attachment } = selected;
      const selectedKinds = new Set(selectedDocuments.filter((candidate) => candidate.quoteId === quoteId).map((candidate) => candidate.effectiveDocumentKind));
      const isComplementaryPackage = selectedKinds.has('window_schedule') && [...selectedKinds].some((kind) => kind === 'quotation_letter' || kind === 'installation_pricing');
      const key = isComplementaryPackage ? `${quoteId}:package` : `${quoteId}:${revisionId}`;
      if (!groups.has(key)) groups.set(key, { quote, revision, selected: [], isComplementaryPackage });
      const group = groups.get(key);
      if (isComplementaryPackage && Number(revision.revision_sequence) > Number(group.revision.revision_sequence)) group.revision = revision;
      group.selected.push(selected);
    }
    const results = [];
    for (const { quote, revision, selected, isComplementaryPackage } of groups.values()) {
      const documentPriority = (kind) => kind === 'window_schedule' ? 0 : kind === 'quotation_letter' ? 1 : kind === 'installation_pricing' ? 2 : 3;
      selected.sort((left,right)=>documentPriority(left.effectiveDocumentKind)-documentPriority(right.effectiveDocumentKind)||Number(left.attachment.upload_order||0)-Number(right.attachment.upload_order||0)||String(left.attachment.created_at).localeCompare(String(right.attachment.created_at)));
      const selectedPositionRows = selected.flatMap((item) => item.fields.rows);
      if (selectedPositionRows.some((row) => row.commercialReadiness === 'review_required')) throw Object.assign(new Error('Selected technical positions require commercial price review before they can be loaded to Products / Supply or Project Costing.'), { code: 'confirmation_review_required' });
      const selectedPositionCurrencies = new Set(selectedPositionRows.map((row) => row.currency).filter((currency) => /^[A-Z]{3}$/.test(String(currency || ''))));
      if (selectedPositionCurrencies.size > 1) throw Object.assign(new Error('Selected positions use more than one currency. Review the source currency before confirmation.'), { code: 'confirmation_currency_review_required' });
      const sourcePositionCurrency = selectedPositionCurrencies.size === 1 ? [...selectedPositionCurrencies][0] : null;
      if (sourcePositionCurrency && revision.currency !== sourcePositionCurrency) {
        if (confirmation.metadata) throw Object.assign(new Error(`Selected positions are quoted in ${sourcePositionCurrency}. Set the confirmation currency to ${sourcePositionCurrency} before loading.`), { code: 'confirmation_currency_mismatch' });
        revision.currency = sourcePositionCurrency;
      }
      await failureInjector('currency_validation', { estimateId, revisionId: revision.id, sourceCurrency: sourcePositionCurrency, reviewedCurrency: revision.currency });
      const attachments = selected.map((item) => item.attachment);
      const identity=createSupplierImportOperationIdentity({quote,revision,scenarioId,attachments,selectedRowKeys:confirmation.selectedRowKeys||selected.flatMap(item=>item.fields.rows.map(row=>`${item.attachment.id}:${row.ordinal}`)),reviewedRows:selectedPositionRows,reviewedCurrency:revision.currency});
      const existingOperation=await db.get('SELECT * FROM supplier_quote_import_operations WHERE operation_key=?',identity.operationKey);
      if(existingOperation?.status==='confirmed'){
        const saved=JSON.parse(existingOperation.result_json||'{}');
        results.push(...(saved.documents||[]).map(document=>({...document,loadedProducts:0,loadedCosts:0,duplicateProducts:document.extractedProducts||0,duplicateCosts:document.extractedCosts||0,idempotentReplay:true,operationId:identity.operationId,operationStatus:'confirmed'})));
        continue;
      }
      const runId = randomUUID(); const startedAt = nowIso();
      const preState=await readSupplierImportState(db,{scenarioId,revisionId:revision.id});
      const selectedCanonicalRows=selectedPositionRows.filter(row=>isCanonicalPositionRow(row,revision.currency));
      const intendedCounts={parsedPositions:selected.reduce((sum,item)=>sum+item.extractedPositionCount,0),selectedPositions:selectedPositionRows.length,validCanonicalPositions:selectedCanonicalRows.length,reviewRequiredPositions:selected.reduce((sum,item)=>sum+item.allRows.filter(row=>!isCanonicalPositionRow(row,revision.currency)).length,0),supplierExtras:preState.supplierExtras,projectCostingSupplierCosts:preState.projectCostingSupplierCosts};
      const currencyDecision={storedCurrency:selected[0]?.storedRevisionCurrency||null,sourceCurrency:sourcePositionCurrency,reviewedCurrency:revision.currency,decision:selected[0]?.storedRevisionCurrency!==revision.currency?'reviewed_source_currency_correction':'source_currency_confirmed',sourceAmountsRewritten:false};
      const operationContext={identity,quote,revision,scenarioId,attachments,runId,startedAt,preState,intendedCounts,currencyDecision};
      try {
        const products = new Map(); const costs = new Map(); const summaries = []; const warnings = []; const parsedDocuments = []; let invalidProducts = 0; let invalidCosts = 0;
        for (const { attachment, extracted, fields, summaryResult, effectiveDocumentKind } of selected) {
          warnings.push(...extracted.warnings, ...fields.warnings, ...summaryResult.warnings); summaries.push(summaryResult.summary); parsedDocuments.push({ attachment, fields, summaryResult });
          if (attachment.document_kind !== effectiveDocumentKind) attachment.document_kind = effectiveDocumentKind;
        }
        const detectedCurrencies = new Set(parsedDocuments.flatMap(({ fields, summaryResult }) => [...fields.rows.map((row) => row.currency), summaryResult.summary?.currency].filter(Boolean)));
        const effectiveCurrency = detectedCurrencies.size === 1 ? [...detectedCurrencies][0] : revision.currency;
        if (detectedCurrencies.size > 1) warnings.push('Conflicting supplier currencies were detected; the stored revision currency was retained.');
        for (const { attachment, fields, summaryResult } of parsedDocuments) {
          const occurrences = new Map();
          for (const row of fields.rows) {
            const valid = isCanonicalPositionRow(row, effectiveCurrency);
            if (!valid) { invalidProducts += 1; continue; }
            const identity = [normalizeReference(row.displayReference), row.widthMm, row.heightMm, row.quantity].join('|'); const occurrence = occurrences.get(identity) || 0; occurrences.set(identity, occurrence + 1); const key = `${attachment.id}|${identity}|${occurrence}`; const sourceDocument = { attachmentId: attachment.id, fileName: attachment.original_file_name, documentKind: attachment.document_kind };
            const existing = products.get(key); if (!existing || (existing.row.totalPrice == null && row.totalPrice != null)) products.set(key, { row, key, attachment, sourceDocuments: [...(existing?.sourceDocuments || []), sourceDocument] }); else existing.sourceDocuments.push(sourceDocument);
          }
          for (const cost of summaryResult.additionalItems) {
            const value = String(cost.totalPrice ?? ''); const valid = cost.currency === effectiveCurrency && signedDecimal.test(value) && (cost.category === 'discount' || !value.startsWith('-'));
            if (!valid) { invalidCosts += 1; continue; }
            const key = [attachment.id, cost.category, String(cost.normalizedLabel || cost.originalDescription).trim().toUpperCase(), cost.quantity || '', value].join('|');
            const commercialClassification = classifySupplierCommercialItem(cost);
            if (!costs.has(key)) costs.set(key, { cost: { ...cost, commercialClassification }, key, attachment, sourceDocuments: [] }); costs.get(key).sourceDocuments.push({ attachmentId: attachment.id, fileName: attachment.original_file_name, documentKind: attachment.document_kind });
          }
        }
        if (!products.size && !costs.size && !summaries.some(Boolean)) throw Object.assign(new Error('No commercial rows were extracted from the selected document.'), { code: 'no_commercial_evidence' });
        const summary = summaries.reduce((merged, item) => { if (!item) return merged; for (const field of ['productSubtotal','additionalItemsSubtotal','deliveryTotal','vatTotal','finalSupplierTotal']) { if (item[field] != null && merged[field] == null) merged[field] = item[field]; else if (item[field] != null && merged[field] !== item[field]) warnings.push(`Conflicting ${field} values were supplied; the first value was retained.`); } merged.comparisonTotals.push(...(item.comparisonTotals||[])); return merged; }, {comparisonTotals:[]});
        const sourceRows=selected.flatMap((item)=>item.allRows),sourceItems=[...costs.values()].map((item)=>item.cost),sourceSummary={...summary,currency:effectiveCurrency,reconciliation:summaries.find((item)=>item?.reconciliation)?.reconciliation??null},sourceCommercialClassification=buildSupplierQuotationCommercialClassification({positionRows:sourceRows,additionalItems:sourceItems,summary:sourceSummary}),productSupplyReconciliation=sourceCommercialClassification.productSupplyReconciliation;
        assertSupplierProductSupplyReconciliation(sourceCommercialClassification);
        const completedAt = nowIso(); let loadedProducts = 0; let loadedCosts = 0;
        await db.exec('BEGIN IMMEDIATE');
        try {
          await db.run(`INSERT INTO supplier_quote_import_operations(id,operation_key,estimate_id,supplier_quote_id,revision_id,scenario_id,current_run_id,status,source_identity_json,selection_identity_json,pre_state_json,intended_counts_json,post_state_json,diagnostics_json,recovery_reason,currency_decision_json,last_error_code,last_error_message,result_json,created_at,updated_at,confirmed_at)
            VALUES(?,?,?,?,?,?,?,'confirming',?,?,?,?,?,'{}',NULL,?,NULL,NULL,'{}',?,?,NULL)
            ON CONFLICT(id) DO UPDATE SET current_run_id=excluded.current_run_id,status='confirming',pre_state_json=excluded.pre_state_json,intended_counts_json=excluded.intended_counts_json,currency_decision_json=excluded.currency_decision_json,last_error_code=NULL,last_error_message=NULL,updated_at=excluded.updated_at`, identity.operationId, identity.operationKey, estimateId, quote.id, revision.id, scenarioId, runId, JSON.stringify(identity.sourceIdentity), JSON.stringify(identity.selectionIdentity), JSON.stringify(preState), JSON.stringify(intendedCounts), '{}', JSON.stringify(currencyDecision), startedAt, startedAt);
          await db.run(`INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,status,warnings_json,operation_id,confirmation_status,expected_counts_json,pre_state_json,currency_decision_json)
            VALUES(?,?,?,?,?,?,?,?,?,'running','[]',?,'confirming',?,?,?)`, runId, estimateId, revision.id, 'quotesync-commercial-extractor', EXTRACTOR_VERSION, 'supplier-neutral', FIELD_PARSER_VERSION, SUMMARY_PARSER_VERSION, startedAt, identity.operationId, JSON.stringify(intendedCounts), JSON.stringify(preState), JSON.stringify(currencyDecision));
          for (const [ordinal, attachment] of attachments.entries()) await db.run('INSERT INTO supplier_quote_import_run_attachments(import_run_id,attachment_id,ordinal,role) VALUES(?,?,?,?)', runId, attachment.id, ordinal, attachment.role);
          for (const item of selected) for (const row of item.allRows) {
            const canonicalReady = isCanonicalPositionRow(row, effectiveCurrency);
            const readinessStatus = row.classification === 'excluded' ? 'excluded' : canonicalReady ? 'canonical_ready' : 'review_required';
            const sourceSnapshot = row.originalExtractedSnapshot || row;
            const provenance = { attachmentId: item.attachment.id, sha256: item.attachment.sha256, sourcePages: row.sourcePages || [], sourceTrace: row.sourceTrace || [], manufacturerEvidence: row.manufacturerEvidence || null, evidenceClass: row.evidenceClass ?? row.provenanceClass ?? null };
            const reviewReasons = [...(row.warnings || [])];
            if (!canonicalReady && !reviewReasons.length) reviewReasons.push('Canonical position fields are incomplete or conflict with the reviewed currency.');
            await db.run(`INSERT INTO supplier_quote_import_position_evidence(operation_id,attachment_id,row_key,ordinal,readiness_status,source_snapshot_json,provenance_json,review_reasons_json,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(operation_id,row_key) DO UPDATE SET readiness_status=excluded.readiness_status,source_snapshot_json=excluded.source_snapshot_json,provenance_json=excluded.provenance_json,review_reasons_json=excluded.review_reasons_json`, identity.operationId, item.attachment.id, `${item.attachment.id}:${row.ordinal}`, Number(row.ordinal || 0), readinessStatus, JSON.stringify(sourceSnapshot), JSON.stringify(provenance), JSON.stringify(reviewReasons), startedAt);
          }
          await failureInjector('operation_journal', operationContext);
          await db.run('UPDATE supplier_quotes SET supplier_code=?,supplier_name=?,updated_at=? WHERE id=? AND estimate_id=?', quote.supplier_code, quote.supplier_name, completedAt, quote.id, estimateId);
          await db.run('UPDATE supplier_quote_revisions SET supplier_quotation_number=?,supplier_revision=?,full_quotation_reference=?,quotation_date=?,currency=? WHERE id=? AND estimate_id=?', revision.supplier_quotation_number, revision.supplier_revision, revision.full_quotation_reference, revision.quotation_date, revision.currency, revision.id, estimateId);
          const revisionIdentity=quotationRevisionKey(revision.supplier_quotation_number,revision.supplier_revision); if(revisionIdentity) await db.run(`UPDATE supplier_quote_revisions SET lifecycle_status=CASE WHEN EXISTS(SELECT 1 FROM supplier_quote_import_runs run WHERE run.revision_id=supplier_quote_revisions.id AND run.status IN ('completed','completed_with_warnings')) THEN 'parsed' ELSE 'uploaded' END,superseded_at=NULL,superseded_by_revision_id=NULL WHERE supplier_quote_id=? AND estimate_id=? AND UPPER(TRIM(supplier_quotation_number))=? AND UPPER(TRIM(COALESCE(supplier_revision,'')))=? AND lifecycle_status='superseded'`,quote.id,estimateId,normalizeReference(revision.supplier_quotation_number),normalizeReference(revision.supplier_revision));
          for (const item of selected) {
            const role = item.effectiveDocumentKind === 'window_schedule' ? 'original_quote' : complementaryDocumentKinds.has(item.effectiveDocumentKind) ? 'supporting_document' : item.attachment.role;
            await db.run('UPDATE supplier_quote_attachments SET document_kind=?,role=? WHERE id=? AND estimate_id=?', item.effectiveDocumentKind, role, item.attachment.id, estimateId);
          }
          if (isComplementaryPackage) {
            for (const item of selected) if (item.revision.id !== revision.id && item.revision.superseded_by_revision_id === revision.id && !item.revision.supplier_revision) {
              await db.run("UPDATE supplier_quote_revisions SET lifecycle_status='parsed',superseded_at=NULL,superseded_by_revision_id=NULL WHERE id=? AND estimate_id=?", item.revision.id, estimateId);
            }
          }
          const obsoleteComparisonExtras=await db.all("SELECT id FROM supplier_quote_extras WHERE revision_id=? AND lower(label) LIKE 'total%alternative%'",revision.id); for(const item of obsoleteComparisonExtras)await db.run('DELETE FROM project_calculator_estimate_supplier_costs WHERE scenario_id=? AND source_extra_id=?',scenarioId,item.id); await db.run("DELETE FROM supplier_quote_extras WHERE revision_id=? AND lower(label) LIKE 'total%alternative%'",revision.id);
          const selectedAttachmentIds=new Set(attachments.map(item=>item.id));const existingProductQueues=new Map();for(const existing of await db.all('SELECT c.*,p.review_status source_review_status FROM project_calculator_estimate_product_rows c LEFT JOIN supplier_quote_positions p ON p.id=c.source_position_id WHERE c.scenario_id=? AND c.source_revision_id=? ORDER BY c.rowid',scenarioId,revision.id)){if(!selectedAttachmentIds.has(existing.source_attachment_id))continue;const identity=[existing.source_attachment_id,normalizeReference(existing.display_reference),existing.width_mm,existing.height_mm,existing.quantity].join('|');if(!existingProductQueues.has(identity))existingProductQueues.set(identity,[]);existingProductQueues.get(identity).push(existing);}
          for (const [sourceSequence,{ row, key, attachment, sourceDocuments }] of [...products.values()].entries()) {
            const sourceId = stableRevisionEvidenceId('supplier-position', revision.id, key);
            const snapshot = { ...row.originalExtractedSnapshot, supplierName: quote.supplier_name, supplierCode: quote.supplier_code, commercialSupplier: row.manufacturerEvidence?.commercialSupplier ?? { supplierCode: quote.supplier_code, supplierName: quote.supplier_name }, documentIssuer: row.manufacturerEvidence?.documentIssuer ?? null, supplierDealer: row.manufacturerEvidence?.documentIssuer ?? null, canonicalManufacturer: row.manufacturerEvidence?.canonicalManufacturer ?? null, manufacturerSystemIdentity: row.manufacturerEvidence?.manufacturerSystemIdentity ?? null, supplierManufacturerRelationship: row.manufacturerEvidence?.supplierManufacturerRelationship ?? null, supplierQuoteId: quote.id, supplierQuotationNumber: revision.supplier_quotation_number, supplierRevisionId: revision.id, supplierRevision: revision.supplier_revision, attachmentId: attachment.id, attachmentFileName: attachment.original_file_name, documentKind: attachment.document_kind, sourceDocuments, extractionRunId: runId, currency: effectiveCurrency, originalSupplierAmount: row.totalPrice, reference: row.displayReference, category: 'product', sourceTrace: row.sourceTrace, warnings: row.warnings };
            const manufacturer=row.manufacturerEvidence||{};const specificationItems=[...(manufacturer.customerSafeSpecification||[]),...([['product',manufacturer.product],['system',manufacturer.productSystem],['glass',manufacturer.glassSpecification],['fittings',manufacturer.fittingsSpecification],['Ug',manufacturer.manufacturerQuotedUg],['Uw',manufacturer.manufacturerQuotedUw]].filter(([,value])=>value!=null).map(([label,value])=>({label,value})))];const specificationText=[...new Map(specificationItems.map(item=>[`${item.label}:${item.value}`,item])).values()].map(item=>`${item.label}: ${item.value}`).join('\n');
            await db.run(`INSERT INTO supplier_quote_positions(id,estimate_id,revision_id,source_sequence,classification,included_in_supplier_total,alternative_to_reference,classification_evidence,display_reference,supplier_reference_tokens_json,quantity,product,product_system,original_specification_text,width_mm,height_mm,supplier_area_square_metres,unit_purchase_price_amount,total_purchase_price_amount,currency,source_pages_json,trace_json,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_sequence=excluded.source_sequence,classification=CASE WHEN supplier_quote_positions.review_status='reviewed' THEN supplier_quote_positions.classification ELSE excluded.classification END,included_in_supplier_total=CASE WHEN supplier_quote_positions.review_status='reviewed' THEN supplier_quote_positions.included_in_supplier_total ELSE excluded.included_in_supplier_total END,alternative_to_reference=CASE WHEN supplier_quote_positions.review_status='reviewed' THEN supplier_quote_positions.alternative_to_reference ELSE excluded.alternative_to_reference END,classification_evidence=excluded.classification_evidence,display_reference=excluded.display_reference,supplier_reference_tokens_json=excluded.supplier_reference_tokens_json,quantity=excluded.quantity,product=excluded.product,product_system=excluded.product_system,original_specification_text=excluded.original_specification_text,width_mm=excluded.width_mm,height_mm=excluded.height_mm,supplier_area_square_metres=excluded.supplier_area_square_metres,unit_purchase_price_amount=excluded.unit_purchase_price_amount,total_purchase_price_amount=excluded.total_purchase_price_amount,currency=excluded.currency,source_pages_json=excluded.source_pages_json,trace_json=excluded.trace_json,updated_at=excluded.updated_at`, sourceId, estimateId, revision.id, sourceSequence, row.classification||'standard', row.includedInSupplierTotal===false?0:1, row.alternativeTo||null, row.classificationEvidence||null, row.displayReference, JSON.stringify(row.supplierReferenceTokens), row.quantity, manufacturer.product??row.product??null, manufacturer.productSystem??row.productSystem??null, specificationText, row.widthMm, row.heightMm, manufacturer.areaSquareMetres??null, row.unitPrice, row.totalPrice, row.currency, JSON.stringify(row.sourcePages), JSON.stringify(row.sourceTrace), row.status === 'needs_review' ? 'needs_review' : 'unreviewed', completedAt, completedAt);
            const identity=[attachment.id,normalizeReference(row.displayReference),row.widthMm,row.heightMm,row.quantity].join('|');let existingCostingRow=existingProductQueues.get(identity)?.shift();const productClass=manufacturer.productSystem??manufacturer.product??row.productSystem??row.product??'Needs review';
            const canonical=await linkSupplierPositionToEstimate(db,{estimateId,sourcePositionId:sourceId,sourceRevisionId:revision.id,sourceQuoteId:quote.id,quotationReference:revision.full_quotation_reference,sourceSequence,displayReference:row.displayReference,quantity:row.quantity,widthMm:row.widthMm,heightMm:row.heightMm,classification:row.classification||'standard',alternativeTo:row.alternativeTo||null,supplierName:quote.supplier_name,supplierCode:quote.supplier_code,product:row.product??null,productSystem:row.productSystem??null,preferredEstimatePositionId:existingCostingRow?.estimate_position_id??null,replacesSourcePositionId:existingCostingRow?.source_position_id??null});
            snapshot.canonicalPosition={id:canonical.position.id,alternativeToPositionId:canonical.position.alternativeToPositionId??null};
            const dimensions = geometry(row.widthMm, row.heightMm, row.quantity);
            if(existingCostingRow){const reviewed=existingCostingRow.source_review_status==='reviewed';await db.run('UPDATE project_calculator_estimate_product_rows SET estimate_position_id=?,source_position_id=?,source_attachment_id=?,source_revision_id=?,source_snapshot_json=?,display_reference=?,product_class=?,quantity=?,width_mm=?,height_mm=?,total_price_amount=?,currency=?,area_square_metres=?,frame_perimeter_metres=?,classification=?,included_in_current_estimate=?,alternative_to_reference=?,alternative_to_estimate_position_id=?,updated_at=? WHERE id=?',canonical.position.id,sourceId,attachment.id,revision.id,JSON.stringify(snapshot),row.displayReference,productClass,row.quantity,row.widthMm,row.heightMm,row.totalPrice,row.currency,dimensions.area,dimensions.perimeter,reviewed?existingCostingRow.classification:row.classification||'standard',reviewed?existingCostingRow.included_in_current_estimate:row.includedInSupplierTotal===false?0:1,reviewed?existingCostingRow.alternative_to_reference:row.alternativeTo||null,reviewed?existingCostingRow.alternative_to_estimate_position_id:canonical.position.alternativeToPositionId??null,completedAt,existingCostingRow.id);continue;}
            const inserted = await db.run(`INSERT INTO project_calculator_estimate_product_rows(id,scenario_id,estimate_position_id,source_position_id,source_attachment_id,source_revision_id,source_snapshot_json,display_reference,product_class,quantity,width_mm,height_mm,total_price_amount,currency,area_square_metres,frame_perimeter_metres,classification,included_in_current_estimate,alternative_to_reference,alternative_to_estimate_position_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,source_position_id) DO NOTHING`, randomUUID(), scenarioId, canonical.position.id, sourceId, attachment.id, revision.id, JSON.stringify(snapshot), row.displayReference, productClass, row.quantity, row.widthMm, row.heightMm, row.totalPrice, row.currency, dimensions.area, dimensions.perimeter,row.classification||'standard',row.includedInSupplierTotal===false?0:1,row.alternativeTo||null,canonical.position.alternativeToPositionId??null,completedAt, completedAt);
            loadedProducts += inserted.changes;
          }
          await failureInjector('supplier_position_persistence', operationContext);
          await failureInjector('products_projection', operationContext);
          await failureInjector('project_costing_projection', operationContext);
          let removedCompatibilityProducts=0;for(const queue of existingProductQueues.values())for(const obsolete of queue)removedCompatibilityProducts+=(await db.run('DELETE FROM project_calculator_estimate_product_rows WHERE id=? AND scenario_id=?',obsolete.id,scenarioId)).changes;if(removedCompatibilityProducts)warnings.push(`${removedCompatibilityProducts} legacy duplicate product row${removedCompatibilityProducts===1?' was':'s were'} reconciled to canonical supplier evidence.`);
          for (const { cost, key, attachment, sourceDocuments } of costs.values()) {
            const sourceId = stableRevisionEvidenceId('supplier-extra', revision.id, key);
            const classification = cost.commercialClassification ?? classifySupplierCommercialItem(cost);
            const snapshot = { ...cost.originalExtractedSnapshot, supplierName: quote.supplier_name, supplierQuoteId: quote.id, supplierQuotationNumber: revision.supplier_quotation_number, supplierRevisionId: revision.id, supplierRevision: revision.supplier_revision, attachmentId: attachment.id, attachmentFileName: attachment.original_file_name, documentKind: attachment.document_kind, sourceDocuments, extractionRunId: runId, currency: effectiveCurrency, originalSupplierAmount: cost.totalPrice, reference: null, category: cost.category, sourceCommercialClassification: classification, sourceIncludedInSupplierTotal: cost.includedInSupplierTotal !== false, sourceTrace: cost.sourceTrace, warnings: cost.warnings };
            await db.run(`INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,quantity,unit_price_amount,total_price_amount,currency,trace_json,included_in_supplier_total,inclusion_evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, sourceId, estimateId, revision.id, cost.category, cost.normalizedLabel || cost.originalDescription.split('\n')[0], cost.originalDescription, cost.quantity, cost.unitPrice, cost.totalPrice, cost.currency, JSON.stringify(cost.sourceTrace),cost.includedInSupplierTotal===false?0:1,cost.inclusionEvidence||null,completedAt);
            const inserted = await db.run(`INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,included_in_current_estimate,inclusion_evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,source_extra_id) DO NOTHING`, randomUUID(), scenarioId, sourceId, attachment.id, revision.id, JSON.stringify(snapshot), classification.projectCostingCategory, cost.normalizedLabel || cost.originalDescription.split('\n')[0], cost.totalPrice, cost.currency,classification.automaticImport?1:0,`${classification.canonicalCategory}:${classification.decision}`,completedAt);
            loadedCosts += inserted.changes;
          }
          await db.run(`UPDATE supplier_quote_revisions SET currency=?,product_subtotal_amount=COALESCE(?,product_subtotal_amount),extras_total_amount=COALESCE(?,extras_total_amount),delivery_total_amount=COALESCE(?,delivery_total_amount),vat_total_amount=COALESCE(?,vat_total_amount),final_supplier_total_amount=COALESCE(?,final_supplier_total_amount),comparison_totals_json=?,lifecycle_status=CASE WHEN lifecycle_status='superseded' THEN 'superseded' ELSE 'parsed' END WHERE id=? AND estimate_id=?`, effectiveCurrency, summary.productSubtotal, summary.additionalItemsSubtotal, summary.deliveryTotal, summary.vatTotal, summary.finalSupplierTotal,JSON.stringify(summary.comparisonTotals||[]), revision.id, estimateId);
          const supplierDefault=await db.get('SELECT policy_json FROM supplier_commercial_defaults WHERE supplier_code=?',quote.supplier_code);const evidencePackages=buildQuotationPackageEvidence(summary.comparisonTotals||[]);const documentPackageId=evidencePackages.find(item=>item.selected)?.id??null,defaults=supplierDefault?JSON.parse(supplierDefault.policy_json):{},sourceProductCommercialEvidence=sourceCommercialClassification.productEvidence,sourceProductListAmount=productSupplyReconciliation?.expectedSubtotal??sourceProductCommercialEvidence?.grossListAmount??summary.finalSupplierTotal;const commercialPolicy={...defaults,quotedCurrency:effectiveCurrency,quotedAmount:sourceProductListAmount,manufacturerListAmount:sourceProductListAmount,paidInQuotedCurrency:supplierDefault?defaults.paidInQuotedCurrency!==false:true,settlementCurrency:supplierDefault&&defaults.paidInQuotedCurrency===false?defaults.settlementCurrency||effectiveCurrency:effectiveCurrency,pricingBasis:supplierDefault?defaults.pricingBasis||'factory_price':'factory_price',pricingMethod:supplierDefault?defaults.pricingMethod||defaults.pricingBasis||'factory_price':'factory_price',pricingPolicyVersion:supplierDefault?defaults.pricingPolicyVersion??2:2,packages:evidencePackages,packagePricingAvailable:evidencePackages.length>0,supplierDocumentPackageId:documentPackageId,selectedPackageId:documentPackageId??evidencePackages.find(item=>item.isBase)?.id??null,projectDiscount:sourceProductCommercialEvidence?{mode:'percentage',percentage:'0',amount:'0'}:defaults.projectDiscount,sourceAdjustmentMode:'user_decision_required',sourceQuotedPriceBasis:sourceProductCommercialEvidence?'gross_list':'source_document',sourceDiscountDecision:{status:'not_applied'},sourceProductCommercialEvidence,sourceCommercialClassification};
          await db.run(`INSERT INTO project_calculator_supplier_quote_revisions(scenario_id,supplier_quote_id,revision_id,import_run_id,commercial_policy_json,currency,linked_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(scenario_id,revision_id) DO UPDATE SET import_run_id=excluded.import_run_id,currency=excluded.currency,linked_at=excluded.linked_at,commercial_policy_json=COALESCE(project_calculator_supplier_quote_revisions.commercial_policy_json,excluded.commercial_policy_json)`, scenarioId, quote.id, revision.id, runId,JSON.stringify(commercialPolicy), effectiveCurrency, completedAt);
          await failureInjector('package_adjustments', {...operationContext,sourceProductCommercialEvidence});
          const supersededOwnRevisions=await db.all(`SELECT linked.revision_id FROM project_calculator_supplier_quote_revisions linked JOIN supplier_quote_revisions prior ON prior.id=linked.revision_id WHERE linked.scenario_id=? AND linked.supplier_quote_id=? AND linked.revision_id<>? AND (prior.superseded_by_revision_id=? OR prior.lifecycle_status='superseded')`,scenarioId,quote.id,revision.id,revision.id);
          for(const prior of supersededOwnRevisions){await db.run('DELETE FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND source_revision_id=?',scenarioId,prior.revision_id);await db.run('DELETE FROM project_calculator_estimate_supplier_costs WHERE scenario_id=? AND source_revision_id=?',scenarioId,prior.revision_id);}
          if(supersededOwnRevisions.length)warnings.push(`${supersededOwnRevisions.length} superseded revision projection${supersededOwnRevisions.length===1?' was':'s were'} replaced within this dealer-owned quotation aggregate; other quotation projections were retained.`);
          await failureInjector('revision_reconciliation', {...operationContext,supersededRevisionIds:supersededOwnRevisions.map((item)=>item.revision_id)});
          await db.run("UPDATE project_calculator_lab_scenarios SET origin=CASE WHEN origin IN ('manual','estimate') THEN 'mixed' ELSE origin END,updated_at=? WHERE id=?",completedAt,scenarioId);
          await syncEstimatePositionProjections(db,scenarioId);
          const expectedSourceIds=[...products.values()].map(({key})=>stableRevisionEvidenceId('supplier-position',revision.id,key));
          const placeholders=expectedSourceIds.map(()=>'?').join(',');
          const scopedCount=async(sql,...prefixParameters)=>expectedSourceIds.length?Number((await db.get(sql,...prefixParameters,...expectedSourceIds))?.count||0):0;
          const persistedPositions=await scopedCount(`SELECT COUNT(*) count FROM supplier_quote_positions WHERE id IN (${placeholders})`);
          const productsSupplyRows=await scopedCount(`SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND source_position_id IN (${placeholders})`,scenarioId);
          const projectCostingRows=await scopedCount(`SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND estimate_position_id IS NOT NULL AND source_position_id IN (${placeholders})`,scenarioId);
          const diagnostics=createSupplierImportDiagnostics({textAvailable:true,rawBlocks:selected.reduce((sum,item)=>sum+(item.extracted.pages?.reduce((pageSum,page)=>pageSum+(page.blocks?.length||0),0)||0),0),sourcePositions:intendedCounts.parsedPositions,candidatePositionBlocks:intendedCounts.selectedPositions,parsedPositions:intendedCounts.parsedPositions,selectedPositions:intendedCounts.selectedPositions,validCanonicalPositions:products.size,reviewRequiredPositions:intendedCounts.reviewRequiredPositions,persistedPositions,productsSupplyRows,projectCostingRows,includedRows:[...products.values()].filter(item=>item.row.includedInSupplierTotal!==false&&item.row.classification!=='alternative'&&item.row.classification!=='excluded').length,alternativeRows:[...products.values()].filter(item=>item.row.classification==='alternative').length,excludedRows:[...products.values()].filter(item=>item.row.classification==='excluded').length,visualEvidence:[...products.values()].filter(item=>item.row.manufacturerEvidence?.sourceVisual?.status==='available'||item.row.manufacturerEvidence?.sourceVisual?.originalAsset).length,ambiguousVisualEvidence:[...products.values()].filter(item=>item.row.manufacturerEvidence?.sourceVisual?.mappingReviewStatus==='needs_review').length});
          const postState=await readSupplierImportState(db,{scenarioId,revisionId:revision.id});
          postState.operationCounts={persistedPositions,productsSupplyRows,projectCostingRows};
          postState.sourceAttachments=attachments.map(({id,sha256,original_file_name})=>({id,sha256,fileName:original_file_name}));
          postState.currency=effectiveCurrency;
          await failureInjector('postcondition_validation',{...operationContext,diagnostics,postState});
          const completion=evaluateSupplierImportCompletion(diagnostics.counts);
          if(completion.status==='partial_recovery_required'){
            const postconditionError=Object.assign(new Error(`${intendedCounts.selectedPositions} positions selected — confirmation incomplete. ${completion.failures.join(' ')} Original quotation retained.`),{code:'supplier_confirmation_postcondition_failed',diagnostics,postState,recoveryReason:'persisted_quantitative_postcondition_failed'});
            throw postconditionError;
          }
          const runStatus=completion.confirmed?'completed':'failed';
          const runErrorCode=completion.confirmed?null:'confirmation_review_required';
          const runErrorMessage=completion.confirmed?null:completion.failures.join(' ');
          const documentResult={runId,attachmentIds:attachments.map(({id})=>id),quoteId:quote.id,revisionId:revision.id,status:completion.status,operationId:identity.operationId,operationStatus:completion.status,extractedProducts:products.size,extractedCosts:costs.size,loadedProducts,loadedCosts,duplicateProducts:products.size-loadedProducts,duplicateCosts:costs.size-loadedCosts,invalidProducts,invalidCosts,summaryUpdated:Object.values(summary).some((value)=>value!=null),diagnostics,warnings,idempotentReplay:false};
          const resultPayload={scenarioId,operationId:identity.operationId,operationStatus:completion.status,documents:[documentResult]};
          await db.run(`UPDATE supplier_quote_import_runs SET status=?,confirmation_status=?,completed_at=?,warnings_json=?,error_code=?,error_message=?,diagnostics_json=?,post_state_json=?,recovery_reason=? WHERE id=?`,runStatus,completion.status,completedAt,JSON.stringify(warnings),runErrorCode,runErrorMessage,JSON.stringify(diagnostics),JSON.stringify(postState),completion.confirmed?null:'unresolved_position_evidence',runId);
          await db.run(`UPDATE supplier_quote_import_operations SET status=?,post_state_json=?,diagnostics_json=?,recovery_reason=?,last_error_code=?,last_error_message=?,result_json=?,updated_at=?,confirmed_at=? WHERE id=?`,completion.status,JSON.stringify(postState),JSON.stringify(diagnostics),completion.confirmed?null:'unresolved_position_evidence',runErrorCode,runErrorMessage,JSON.stringify(resultPayload),completedAt,completion.confirmed?completedAt:null,identity.operationId);
          await failureInjector('diagnostics_persistence',{...operationContext,diagnostics,postState});
          await failureInjector('transaction_commit',{...operationContext,diagnostics,postState});
          await db.exec('COMMIT');
          results.push(documentResult);
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
        if (fileSupplierAttachments) {
          try { const drive=createDriveIntegrationService(db,{attachmentRoot});for(const attachment of attachments)await drive.fileSupplierAttachment({estimateId,quoteId:quote.id,revisionId:revision.id,attachmentId:attachment.id,supplierName:quote.supplier_name}); }
          catch (driveError) { warnings.push(`Google Drive filing pending: ${driveError instanceof Error ? driveError.message : 'provider unavailable'}`); }
        } else warnings.push('Google Drive filing deliberately deferred; canonical commercial confirmation is unaffected.');
      } catch (error) {
        await recordRecoverableImportFailure(operationContext,error);
        throw error;
      }
    }
    const operationStatus=results.some(item=>item.operationStatus==='partial_recovery_required')?'partial_recovery_required':results.some(item=>item.operationStatus==='review_required')?'review_required':'confirmed';
    return { scenarioId, operationStatus, documents: results };
  }
  async function attachmentIsInUse(estimateId, attachmentId) {
    const row = await db.get(`SELECT 1 AS used FROM supplier_quote_attachments a WHERE a.id=? AND a.estimate_id=? AND (EXISTS(SELECT 1 FROM supplier_quote_import_run_attachments j WHERE j.attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_attachments d WHERE d.derived_from_attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_import_runs r WHERE r.raw_result_attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_positions p WHERE p.supplier_drawing_attachment_id=a.id)) LIMIT 1`, attachmentId, estimateId);
    return Boolean(row);
  }
  async function deleteAttachmentMetadata(estimateId, quoteId, revisionId, attachmentId) { const row = await attachmentRow(estimateId, quoteId, revisionId, attachmentId); if (!row) return null; if (await attachmentIsInUse(estimateId, attachmentId)) throw Object.assign(new Error('Attachment is referenced by supplier evidence.'), { code: 'attachment_in_use' }); const result = await db.run('DELETE FROM supplier_quote_attachments WHERE id=? AND estimate_id=? AND revision_id=?', attachmentId, estimateId, revisionId); return result.changes ? { storageKey: row.storage_key } : null; }
  return { estimateExists, createQuote, listQuotes, getQuote, createRevision, listRevisions, getRevision, listAttachments, getAttachment, insertAttachments, createImportRuns, prepareImportReview, regenerateManufacturerVisuals, inspectManufacturerEvidenceRefresh, inspectManufacturerEvidenceRefreshRuntime, refreshManufacturerEvidence, extractAndLoadSupplierCosts, deleteAttachmentMetadata };
}
