import { createHash, randomUUID } from 'node:crypto';
import { extractSupplierDocument, EXTRACTOR_VERSION } from '../supplierImportLab/documentExtraction.js';
import { parseCommercialFields, FIELD_PARSER_VERSION } from '../supplierImportLab/commercialFieldParser.js';
import { parseCommercialSummary, SUMMARY_PARSER_VERSION } from '../supplierImportLab/commercialSummaryParser.js';
import { resolveAttachmentRoot, resolveManagedPath } from './managedAttachmentStorage.js';
import { linkSupplierPositionToEstimate, syncEstimatePositionProjections } from '../estimatePositions/canonicalEstimatePositions.js';

function nowIso() { return new Date().toISOString(); }
function mapQuote(row) { return { id: row.id, estimateId: row.estimate_id, supplierCode: row.supplier_code, supplierName: row.supplier_name, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at }; }
function money(amount, currency) { return amount == null ? null : { amount: String(amount), currency }; }
function mapRevision(row) { return { id: row.id, supplierQuoteId: row.supplier_quote_id, estimateId: row.estimate_id, revisionSequence: row.revision_sequence, supplierQuotationNumber: row.supplier_quotation_number, supplierRevision: row.supplier_revision, fullQuotationReference: row.full_quotation_reference, quotationDate: row.quotation_date, customerReference: row.customer_reference, currency: row.currency, vatStatus: row.vat_status, productSubtotal: money(row.product_subtotal_amount, row.currency), extrasTotal: money(row.extras_total_amount, row.currency), deliveryTotal: money(row.delivery_total_amount, row.currency), vatTotal: money(row.vat_total_amount, row.currency), finalSupplierTotal: money(row.final_supplier_total_amount, row.currency), comparisonTotals:JSON.parse(row.comparison_totals_json||'[]'), lifecycleStatus: row.lifecycle_status, isLatest: !row.superseded_by_revision_id && row.lifecycle_status !== 'archived', createdAt: row.created_at, supersededAt: row.superseded_at, supersededByRevisionId: row.superseded_by_revision_id }; }
function mapAttachment(row) { return { id: row.id, estimateId: row.estimate_id, revisionId: row.revision_id, role: row.role, documentKind: row.document_kind || 'complete_quotation', originalFileName: row.original_file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256, parserEligible: Boolean(row.parser_eligible), uploadedBy: row.uploaded_by || 'local-admin', uploadOrder: Number(row.upload_order || 0), createdAt: row.created_at, derivedFromAttachmentId: row.derived_from_attachment_id, artifactType: row.artifact_type, extractorVersion: row.extractor_version }; }

const stableRevisionEvidenceId = (kind, revisionId, key) => `${kind}-${createHash('sha256').update(`${revisionId}:${key}`).digest('hex')}`;
const normalizeReference = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
const unsignedDecimal = /^\d+(?:\.\d+)?$/;
const signedDecimal = /^-?\d+(?:\.\d+)?$/;
const complementaryDocumentKinds = new Set(['window_schedule','quotation_letter','installation_pricing']);
function geometry(widthMm, heightMm, quantity) { const area = BigInt(widthMm) * BigInt(heightMm) * BigInt(quantity); const perimeter = 2n * BigInt(widthMm + heightMm) * BigInt(quantity) * 1000n; const decimal = (value) => { const raw = value.toString().padStart(7, '0'); return `${raw.slice(0, -6)}.${raw.slice(-6)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }; return { area: decimal(area), perimeter: decimal(perimeter) }; }

export function createSupplierQuotesService(db, { attachmentRoot = resolveAttachmentRoot(), extractDocument = extractSupplierDocument, parseFields = parseCommercialFields, parseSummary = parseCommercialSummary } = {}) {
  async function estimateExists(estimateId) { return Boolean(await db.get('SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL', estimateId)); }
  async function quoteRow(estimateId, quoteId) { return db.get('SELECT * FROM supplier_quotes WHERE id=? AND estimate_id=?', quoteId, estimateId); }
  async function revisionRow(estimateId, quoteId, revisionId) { return db.get('SELECT r.* FROM supplier_quote_revisions r WHERE r.id=? AND r.supplier_quote_id=? AND r.estimate_id=?', revisionId, quoteId, estimateId); }
  async function attachmentRow(estimateId, quoteId, revisionId, attachmentId) { return db.get(`SELECT a.* FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id AND r.estimate_id=a.estimate_id WHERE a.id=? AND a.revision_id=? AND a.estimate_id=? AND r.supplier_quote_id=?`, attachmentId, revisionId, estimateId, quoteId); }
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
      const sequence = Number((await db.get('SELECT COALESCE(MAX(revision_sequence),-1)+1 AS value FROM supplier_quote_revisions WHERE supplier_quote_id=? AND estimate_id=?', quoteId, estimateId)).value);
      const currency = String(input.currency || 'GBP').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Currency must be a three-letter code.'), { code: 'invalid_revision' });
      const quotationNumber = String(input.supplierQuotationNumber || '').trim(); const supplierRevision = String(input.supplierRevision || '').trim() || null;
      const revision = { id: randomUUID(), supplierQuoteId: quoteId, estimateId, revisionSequence: sequence, supplierQuotationNumber: quotationNumber, supplierRevision, fullQuotationReference: String(input.fullQuotationReference || quotationNumber || `Revision ${sequence + 1}`).trim(), quotationDate: input.quotationDate || null, customerReference: String(input.customerReference || '').trim() || null, currency, vatStatus: input.vatStatus || 'unknown', lifecycleStatus: 'uploaded', createdAt: nowIso(), supersededAt: null, supersededByRevisionId: null };
      await db.run(`INSERT INTO supplier_quote_revisions(id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,supplier_revision,full_quotation_reference,quotation_date,customer_reference,currency,vat_status,lifecycle_status,created_at,superseded_at,superseded_by_revision_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL)`, revision.id, quoteId, estimateId, sequence, revision.supplierQuotationNumber, revision.supplierRevision, revision.fullQuotationReference, revision.quotationDate, revision.customerReference, currency, revision.vatStatus, revision.lifecycleStatus, revision.createdAt);
      await db.run(`UPDATE supplier_quote_revisions SET lifecycle_status='superseded',superseded_at=?,superseded_by_revision_id=? WHERE supplier_quote_id=? AND estimate_id=? AND id<>? AND superseded_by_revision_id IS NULL AND lifecycle_status NOT IN ('archived','superseded')`, revision.createdAt, revision.id, quoteId, estimateId, revision.id);
      await db.exec('COMMIT'); return { ...revision, productSubtotal: null, extrasTotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: null };
    } catch (error) { try { await db.exec('ROLLBACK'); } catch {} throw error; }
  }
  async function listRevisions(estimateId, quoteId) { if (!(await quoteRow(estimateId, quoteId))) return null; return (await db.all('SELECT * FROM supplier_quote_revisions WHERE estimate_id=? AND supplier_quote_id=? ORDER BY revision_sequence DESC', estimateId, quoteId)).map(mapRevision); }
  async function getRevision(estimateId, quoteId, revisionId) { const row = await revisionRow(estimateId, quoteId, revisionId); return row ? mapRevision(row) : null; }
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
  async function extractAndLoadSupplierCosts(estimateId, scenarioId, documents) {
    if (!(await estimateExists(estimateId))) return null;
    const scenario = await db.get('SELECT * FROM project_calculator_lab_scenarios WHERE id=? AND estimate_id=?', scenarioId, estimateId);
    if (!scenario) throw Object.assign(new Error('Project Costing record not found for this estimate.'), { code: 'scenario_not_found' });
    if (!Array.isArray(documents) || !documents.length) throw Object.assign(new Error('Select at least one supplier document.'), { code: 'no_attachments_selected' });
    const selectedDocuments = [];
    for (const item of documents) {
      const quoteId = String(item.quoteId || ''); const revisionId = String(item.revisionId || '');
      const attachment = await attachmentRow(estimateId, quoteId, revisionId, String(item.attachmentId || ''));
      const revision = attachment && await revisionRow(estimateId, quoteId, revisionId); const quote = attachment && await quoteRow(estimateId, quoteId);
      if (!attachment || !revision || !quote || attachment.role === 'derived_artifact' || !attachment.parser_eligible) throw Object.assign(new Error('A selected supplier document is unavailable or not eligible for extraction.'), { code: 'attachment_not_eligible' });
      const extracted = await extractDocument(resolveManagedPath(attachment.storage_key, attachmentRoot), { id: attachment.id, sessionId: estimateId, mediaType: attachment.media_type });
      if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
      const fields = parseFields(extracted, { currency: revision.currency });
      const summaryResult = parseSummary(extracted, { currency: revision.currency, positionRows: fields.rows });
      const effectiveDocumentKind = complementaryDocumentKinds.has(fields.documentType) ? fields.documentType : attachment.document_kind;
      selectedDocuments.push({ quoteId, revisionId, quote, revision, attachment: { ...attachment, document_kind: effectiveDocumentKind }, extracted, fields, summaryResult, effectiveDocumentKind });
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
      const attachments = selected.map((item) => item.attachment);
      const runId = randomUUID(); const startedAt = nowIso();
      await db.run(`INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,status,warnings_json) VALUES(?,?,?,?,?,?,?,?,?,'running','[]')`, runId, estimateId, revision.id, 'quotesync-commercial-extractor', EXTRACTOR_VERSION, 'supplier-neutral', FIELD_PARSER_VERSION, 'not-applicable', startedAt);
      for (const [ordinal, attachment] of attachments.entries()) await db.run('INSERT INTO supplier_quote_import_run_attachments(import_run_id,attachment_id,ordinal,role) VALUES(?,?,?,?)', runId, attachment.id, ordinal, attachment.role);
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
            const valid = normalizeReference(row.displayReference) && Number.isInteger(row.quantity) && row.quantity > 0 && Number.isInteger(row.widthMm) && row.widthMm > 0 && Number.isInteger(row.heightMm) && row.heightMm > 0 && row.currency === effectiveCurrency && (row.unitPrice == null || unsignedDecimal.test(String(row.unitPrice))) && (row.totalPrice == null || unsignedDecimal.test(String(row.totalPrice)));
            if (!valid) { invalidProducts += 1; continue; }
            const identity = [normalizeReference(row.displayReference), row.widthMm, row.heightMm, row.quantity].join('|'); const occurrence = occurrences.get(identity) || 0; occurrences.set(identity, occurrence + 1); const key = `${identity}|${occurrence}`; const sourceDocument = { attachmentId: attachment.id, fileName: attachment.original_file_name, documentKind: attachment.document_kind };
            const existing = products.get(key); if (!existing || (existing.row.totalPrice == null && row.totalPrice != null)) products.set(key, { row, key, attachment, sourceDocuments: [...(existing?.sourceDocuments || []), sourceDocument] }); else existing.sourceDocuments.push(sourceDocument);
          }
          for (const cost of summaryResult.additionalItems) {
            const value = String(cost.totalPrice ?? ''); const valid = cost.currency === effectiveCurrency && signedDecimal.test(value) && (cost.category === 'discount' || !value.startsWith('-'));
            if (!valid) { invalidCosts += 1; continue; }
            const key = [cost.category, String(cost.normalizedLabel || cost.originalDescription).trim().toUpperCase(), cost.quantity || '', value].join('|');
            if (!costs.has(key)) costs.set(key, { cost, key, attachment, sourceDocuments: [] }); costs.get(key).sourceDocuments.push({ attachmentId: attachment.id, fileName: attachment.original_file_name, documentKind: attachment.document_kind });
          }
        }
        if (!products.size && !costs.size && !summaries.some(Boolean)) throw Object.assign(new Error('No commercial rows were extracted from the selected document.'), { code: 'no_commercial_evidence' });
        const summary = summaries.reduce((merged, item) => { if (!item) return merged; for (const field of ['productSubtotal','additionalItemsSubtotal','deliveryTotal','vatTotal','finalSupplierTotal']) { if (item[field] != null && merged[field] == null) merged[field] = item[field]; else if (item[field] != null && merged[field] !== item[field]) warnings.push(`Conflicting ${field} values were supplied; the first value was retained.`); } merged.comparisonTotals.push(...(item.comparisonTotals||[])); return merged; }, {comparisonTotals:[]});
        const completedAt = nowIso(); let loadedProducts = 0; let loadedCosts = 0;
        await db.exec('BEGIN IMMEDIATE');
        try {
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
          const existingProductQueues=new Map();for(const existing of await db.all('SELECT c.*,p.review_status source_review_status FROM project_calculator_estimate_product_rows c LEFT JOIN supplier_quote_positions p ON p.id=c.source_position_id WHERE c.scenario_id=? AND c.source_revision_id=? ORDER BY c.rowid',scenarioId,revision.id)){const identity=[normalizeReference(existing.display_reference),existing.width_mm,existing.height_mm,existing.quantity].join('|');if(!existingProductQueues.has(identity))existingProductQueues.set(identity,[]);existingProductQueues.get(identity).push(existing);}
          for (const [sourceSequence,{ row, key, attachment, sourceDocuments }] of [...products.values()].entries()) {
            const sourceId = stableRevisionEvidenceId('supplier-position', revision.id, key);
            const snapshot = { ...row.originalExtractedSnapshot, supplierName: quote.supplier_name, supplierQuoteId: quote.id, supplierQuotationNumber: revision.supplier_quotation_number, supplierRevisionId: revision.id, supplierRevision: revision.supplier_revision, attachmentId: attachment.id, attachmentFileName: attachment.original_file_name, documentKind: attachment.document_kind, sourceDocuments, extractionRunId: runId, currency: effectiveCurrency, originalSupplierAmount: row.totalPrice, reference: row.displayReference, category: 'product', sourceTrace: row.sourceTrace, warnings: row.warnings };
            await db.run(`INSERT INTO supplier_quote_positions(id,estimate_id,revision_id,source_sequence,classification,included_in_supplier_total,alternative_to_reference,classification_evidence,display_reference,supplier_reference_tokens_json,quantity,width_mm,height_mm,unit_purchase_price_amount,total_purchase_price_amount,currency,source_pages_json,trace_json,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, sourceId, estimateId, revision.id, sourceSequence, row.classification||'standard', row.includedInSupplierTotal===false?0:1, row.alternativeTo||null, row.classificationEvidence||null, row.displayReference, JSON.stringify(row.supplierReferenceTokens), row.quantity, row.widthMm, row.heightMm, row.unitPrice, row.totalPrice, row.currency, JSON.stringify(row.sourcePages), JSON.stringify(row.sourceTrace), row.status === 'needs_review' ? 'needs_review' : 'unreviewed', completedAt, completedAt);
            const canonical=await linkSupplierPositionToEstimate(db,{estimateId,sourcePositionId:sourceId,sourceRevisionId:revision.id,sourceSequence,displayReference:row.displayReference,quantity:row.quantity,widthMm:row.widthMm,heightMm:row.heightMm,classification:row.classification||'standard',alternativeTo:row.alternativeTo||null,supplierName:quote.supplier_name,supplierCode:quote.supplier_code,product:row.product??null,productSystem:row.productSystem??null});
            const dimensions = geometry(row.widthMm, row.heightMm, row.quantity);
            const identity=[normalizeReference(row.displayReference),row.widthMm,row.heightMm,row.quantity].join('|');let existingCostingRow=existingProductQueues.get(identity)?.shift();if(!existingCostingRow)existingCostingRow=await db.get('SELECT c.*,p.review_status source_review_status FROM project_calculator_estimate_product_rows c LEFT JOIN supplier_quote_positions p ON p.id=c.source_position_id WHERE c.scenario_id=? AND c.estimate_position_id=? ORDER BY c.updated_at DESC LIMIT 1',scenarioId,canonical.position.id);if(existingCostingRow){const reviewed=existingCostingRow.source_review_status==='reviewed';await db.run('UPDATE project_calculator_estimate_product_rows SET estimate_position_id=?,source_position_id=?,source_attachment_id=?,source_revision_id=?,source_snapshot_json=?,display_reference=?,quantity=?,width_mm=?,height_mm=?,total_price_amount=?,currency=?,area_square_metres=?,frame_perimeter_metres=?,classification=?,included_in_current_estimate=?,alternative_to_reference=?,updated_at=? WHERE id=?',canonical.position.id,sourceId,attachment.id,revision.id,JSON.stringify(snapshot),row.displayReference,row.quantity,row.widthMm,row.heightMm,row.totalPrice,row.currency,dimensions.area,dimensions.perimeter,reviewed?existingCostingRow.classification:row.classification||'standard',reviewed?existingCostingRow.included_in_current_estimate:row.includedInSupplierTotal===false?0:1,reviewed?existingCostingRow.alternative_to_reference:row.alternativeTo||null,completedAt,existingCostingRow.id);continue;}
            const inserted = await db.run(`INSERT INTO project_calculator_estimate_product_rows(id,scenario_id,estimate_position_id,source_position_id,source_attachment_id,source_revision_id,source_snapshot_json,display_reference,product_class,quantity,width_mm,height_mm,total_price_amount,currency,area_square_metres,frame_perimeter_metres,classification,included_in_current_estimate,alternative_to_reference,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,source_position_id) DO NOTHING`, randomUUID(), scenarioId, canonical.position.id, sourceId, attachment.id, revision.id, JSON.stringify(snapshot), row.displayReference, 'Needs review', row.quantity, row.widthMm, row.heightMm, row.totalPrice, row.currency, dimensions.area, dimensions.perimeter,row.classification||'standard',row.includedInSupplierTotal===false?0:1,row.alternativeTo||null,completedAt, completedAt);
            loadedProducts += inserted.changes;
          }
          let removedCompatibilityProducts=0;for(const queue of existingProductQueues.values())for(const obsolete of queue)removedCompatibilityProducts+=(await db.run('DELETE FROM project_calculator_estimate_product_rows WHERE id=? AND scenario_id=?',obsolete.id,scenarioId)).changes;if(removedCompatibilityProducts)warnings.push(`${removedCompatibilityProducts} legacy duplicate product row${removedCompatibilityProducts===1?' was':'s were'} reconciled to canonical supplier evidence.`);
          for (const { cost, key, attachment, sourceDocuments } of costs.values()) {
            const sourceId = stableRevisionEvidenceId('supplier-extra', revision.id, key);
            const snapshot = { ...cost.originalExtractedSnapshot, supplierName: quote.supplier_name, supplierQuoteId: quote.id, supplierQuotationNumber: revision.supplier_quotation_number, supplierRevisionId: revision.id, supplierRevision: revision.supplier_revision, attachmentId: attachment.id, attachmentFileName: attachment.original_file_name, documentKind: attachment.document_kind, sourceDocuments, extractionRunId: runId, currency: effectiveCurrency, originalSupplierAmount: cost.totalPrice, reference: null, category: cost.category, sourceTrace: cost.sourceTrace, warnings: cost.warnings };
            await db.run(`INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,quantity,unit_price_amount,total_price_amount,currency,trace_json,included_in_supplier_total,inclusion_evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, sourceId, estimateId, revision.id, cost.category, cost.normalizedLabel || cost.originalDescription.split('\n')[0], cost.originalDescription, cost.quantity, cost.unitPrice, cost.totalPrice, cost.currency, JSON.stringify(cost.sourceTrace),cost.includedInSupplierTotal===false?0:1,cost.inclusionEvidence||null,completedAt);
            const inserted = await db.run(`INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,included_in_current_estimate,inclusion_evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,source_extra_id) DO NOTHING`, randomUUID(), scenarioId, sourceId, attachment.id, revision.id, JSON.stringify(snapshot), cost.category, cost.normalizedLabel || cost.originalDescription.split('\n')[0], cost.totalPrice, cost.currency,cost.includedInSupplierTotal===false?0:1,cost.inclusionEvidence||null,completedAt);
            loadedCosts += inserted.changes;
          }
          await db.run(`UPDATE supplier_quote_revisions SET currency=?,product_subtotal_amount=COALESCE(?,product_subtotal_amount),extras_total_amount=COALESCE(?,extras_total_amount),delivery_total_amount=COALESCE(?,delivery_total_amount),vat_total_amount=COALESCE(?,vat_total_amount),final_supplier_total_amount=COALESCE(?,final_supplier_total_amount),comparison_totals_json=?,lifecycle_status='parsed' WHERE id=? AND estimate_id=?`, effectiveCurrency, summary.productSubtotal, summary.additionalItemsSubtotal, summary.deliveryTotal, summary.vatTotal, summary.finalSupplierTotal,JSON.stringify(summary.comparisonTotals||[]), revision.id, estimateId);
          const supplierDefault=await db.get('SELECT policy_json FROM supplier_commercial_defaults WHERE supplier_code=?',quote.supplier_code);const evidencePackages=(summary.comparisonTotals||[]).filter(item=>item.classification==='package_option').map((item,index)=>({id:`evidence-${index}`,label:item.label,description:item.label,enabled:true,isBase:index===0,packageType:index===0?'supply_only':'service',upliftCategory:index===0?null:'installation',amount:item.amount,displayOrder:index,selected:item.selected}));const documentPackageId=evidencePackages.find(item=>item.selected)?.id??null;const commercialPolicy={...(supplierDefault?JSON.parse(supplierDefault.policy_json):{}),quotedCurrency:effectiveCurrency,quotedAmount:summary.finalSupplierTotal,paidInQuotedCurrency:supplierDefault?JSON.parse(supplierDefault.policy_json).paidInQuotedCurrency!==false:true,settlementCurrency:supplierDefault?JSON.parse(supplierDefault.policy_json).settlementCurrency||effectiveCurrency:effectiveCurrency,pricingBasis:supplierDefault?JSON.parse(supplierDefault.policy_json).pricingBasis||'net_buying_price':'net_buying_price',packages:evidencePackages.length?evidencePackages:(supplierDefault?JSON.parse(supplierDefault.policy_json).packages||[]:[]),packagePricingAvailable:evidencePackages.length>0||Boolean(supplierDefault&&JSON.parse(supplierDefault.policy_json).packagePricingAvailable),supplierDocumentPackageId:documentPackageId,selectedPackageId:documentPackageId??evidencePackages.find(item=>item.isBase)?.id??null};
          await db.run(`INSERT INTO project_calculator_supplier_quote_revisions(scenario_id,supplier_quote_id,revision_id,import_run_id,commercial_policy_json,currency,linked_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(scenario_id,revision_id) DO UPDATE SET import_run_id=excluded.import_run_id,currency=excluded.currency,linked_at=excluded.linked_at,commercial_policy_json=COALESCE(project_calculator_supplier_quote_revisions.commercial_policy_json,excluded.commercial_policy_json)`, scenarioId, quote.id, revision.id, runId,JSON.stringify(commercialPolicy), effectiveCurrency, completedAt);
          await db.run(`UPDATE supplier_quote_import_runs SET status=?,completed_at=?,warnings_json=? WHERE id=?`, warnings.length ? 'completed_with_warnings' : 'completed', completedAt, JSON.stringify(warnings), runId);
          await db.run("UPDATE project_calculator_lab_scenarios SET origin=CASE WHEN origin IN ('manual','estimate') THEN 'mixed' ELSE origin END,updated_at=? WHERE id=?",completedAt,scenarioId);
          await syncEstimatePositionProjections(db,scenarioId);
          await db.exec('COMMIT');
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
        results.push({ runId, attachmentIds: attachments.map(({ id }) => id), quoteId: quote.id, revisionId: revision.id, status: warnings.length ? 'completed_with_warnings' : 'completed', extractedProducts: products.size, extractedCosts: costs.size, loadedProducts, loadedCosts, duplicateProducts: products.size - loadedProducts, duplicateCosts: costs.size - loadedCosts, invalidProducts, invalidCosts, summaryUpdated: Object.values(summary).some((value) => value != null), warnings });
      } catch (error) {
        const code = error?.code || 'document_extraction_failed'; const completedAt = nowIso();
        await db.run(`UPDATE supplier_quote_import_runs SET status='failed',completed_at=?,error_code=?,error_message=? WHERE id=?`, completedAt, code, error.message, runId);
        throw error;
      }
    }
    return { scenarioId, documents: results };
  }
  async function attachmentIsInUse(estimateId, attachmentId) {
    const row = await db.get(`SELECT 1 AS used FROM supplier_quote_attachments a WHERE a.id=? AND a.estimate_id=? AND (EXISTS(SELECT 1 FROM supplier_quote_import_run_attachments j WHERE j.attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_attachments d WHERE d.derived_from_attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_import_runs r WHERE r.raw_result_attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_positions p WHERE p.supplier_drawing_attachment_id=a.id)) LIMIT 1`, attachmentId, estimateId);
    return Boolean(row);
  }
  async function deleteAttachmentMetadata(estimateId, quoteId, revisionId, attachmentId) { const row = await attachmentRow(estimateId, quoteId, revisionId, attachmentId); if (!row) return null; if (await attachmentIsInUse(estimateId, attachmentId)) throw Object.assign(new Error('Attachment is referenced by supplier evidence.'), { code: 'attachment_in_use' }); const result = await db.run('DELETE FROM supplier_quote_attachments WHERE id=? AND estimate_id=? AND revision_id=?', attachmentId, estimateId, revisionId); return result.changes ? { storageKey: row.storage_key } : null; }
  return { estimateExists, createQuote, listQuotes, getQuote, createRevision, listRevisions, getRevision, listAttachments, getAttachment, insertAttachments, createImportRuns, extractAndLoadSupplierCosts, deleteAttachmentMetadata };
}
