import { createHash, randomUUID } from 'node:crypto';
import { extractSupplierDocument, EXTRACTOR_VERSION } from '../supplierImportLab/documentExtraction.js';
import { parseCommercialFields, FIELD_PARSER_VERSION } from '../supplierImportLab/commercialFieldParser.js';
import { parseCommercialSummary, SUMMARY_PARSER_VERSION } from '../supplierImportLab/commercialSummaryParser.js';
import { resolveAttachmentRoot, resolveManagedPath } from './managedAttachmentStorage.js';

function nowIso() { return new Date().toISOString(); }
function mapQuote(row) { return { id: row.id, estimateId: row.estimate_id, supplierCode: row.supplier_code, supplierName: row.supplier_name, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at }; }
function money(amount, currency) { return amount == null ? null : { amount: String(amount), currency }; }
function mapRevision(row) { return { id: row.id, supplierQuoteId: row.supplier_quote_id, estimateId: row.estimate_id, revisionSequence: row.revision_sequence, supplierQuotationNumber: row.supplier_quotation_number, supplierRevision: row.supplier_revision, fullQuotationReference: row.full_quotation_reference, quotationDate: row.quotation_date, customerReference: row.customer_reference, currency: row.currency, vatStatus: row.vat_status, productSubtotal: money(row.product_subtotal_amount, row.currency), extrasTotal: money(row.extras_total_amount, row.currency), deliveryTotal: money(row.delivery_total_amount, row.currency), vatTotal: money(row.vat_total_amount, row.currency), finalSupplierTotal: money(row.final_supplier_total_amount, row.currency), lifecycleStatus: row.lifecycle_status, createdAt: row.created_at, supersededAt: row.superseded_at, supersededByRevisionId: row.superseded_by_revision_id }; }
function mapAttachment(row) { return { id: row.id, estimateId: row.estimate_id, revisionId: row.revision_id, role: row.role, originalFileName: row.original_file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256, parserEligible: Boolean(row.parser_eligible), createdAt: row.created_at, derivedFromAttachmentId: row.derived_from_attachment_id, artifactType: row.artifact_type, extractorVersion: row.extractor_version }; }

const stableEvidenceId = (kind, attachmentId, ordinal) => `${kind}-${createHash('sha256').update(`${attachmentId}:${ordinal}`).digest('hex')}`;
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
      await db.exec('COMMIT'); return { ...revision, productSubtotal: null, extrasTotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: null };
    } catch (error) { try { await db.exec('ROLLBACK'); } catch {} throw error; }
  }
  async function listRevisions(estimateId, quoteId) { if (!(await quoteRow(estimateId, quoteId))) return null; return (await db.all('SELECT * FROM supplier_quote_revisions WHERE estimate_id=? AND supplier_quote_id=? ORDER BY revision_sequence DESC', estimateId, quoteId)).map(mapRevision); }
  async function getRevision(estimateId, quoteId, revisionId) { const row = await revisionRow(estimateId, quoteId, revisionId); return row ? mapRevision(row) : null; }
  async function listAttachments(estimateId, quoteId, revisionId) { if (!(await revisionRow(estimateId, quoteId, revisionId))) return null; return (await db.all('SELECT * FROM supplier_quote_attachments WHERE estimate_id=? AND revision_id=? ORDER BY created_at,rowid', estimateId, revisionId)).map(mapAttachment); }
  async function getAttachment(estimateId, quoteId, revisionId, attachmentId) { const row = await attachmentRow(estimateId, quoteId, revisionId, attachmentId); return row ? { metadata: mapAttachment(row), storageKey: row.storage_key } : null; }
  async function insertAttachments(estimateId, quoteId, revisionId, attachments) {
    await db.exec('BEGIN IMMEDIATE');
    try {
      if (!(await revisionRow(estimateId, quoteId, revisionId))) throw Object.assign(new Error('Revision not found.'), { code: 'revision_not_found' });
      for (const item of attachments) await db.run(`INSERT INTO supplier_quote_attachments(id,estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at,derived_from_attachment_id,artifact_type,extractor_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL)`, item.id, estimateId, revisionId, item.role, item.originalFileName, item.mediaType, item.sizeBytes, item.sha256, item.storageKey, item.parserEligible ? 1 : 0, item.createdAt);
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
    const results = [];
    for (const item of documents) {
      const attachment = await attachmentRow(estimateId, String(item.quoteId || ''), String(item.revisionId || ''), String(item.attachmentId || ''));
      const revision = attachment && await revisionRow(estimateId, String(item.quoteId || ''), String(item.revisionId || ''));
      const quote = attachment && await quoteRow(estimateId, String(item.quoteId || ''));
      if (!attachment || !revision || !quote || attachment.role === 'derived_artifact' || !attachment.parser_eligible) throw Object.assign(new Error('A selected supplier document is unavailable or not eligible for extraction.'), { code: 'attachment_not_eligible' });
      const runId = randomUUID(); const startedAt = nowIso();
      await db.run(`INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,status,warnings_json) VALUES(?,?,?,?,?,?,?,?,?,'running','[]')`, runId, estimateId, revision.id, 'quotesync-commercial-extractor', EXTRACTOR_VERSION, 'supplier-neutral', FIELD_PARSER_VERSION, 'not-applicable', startedAt);
      await db.run('INSERT INTO supplier_quote_import_run_attachments(import_run_id,attachment_id,ordinal,role) VALUES(?,?,0,?)', runId, attachment.id, attachment.role);
      try {
        const extracted = await extractDocument(resolveManagedPath(attachment.storage_key, attachmentRoot), { id: attachment.id, sessionId: estimateId, mediaType: attachment.media_type });
        if (!extracted.textAvailable) throw Object.assign(new Error('OCR required — unsupported for this document.'), { code: 'ocr_required' });
        const fields = parseFields(extracted, { currency: revision.currency });
        const extractedCurrency = fields.rows.find((row) => row.currency)?.currency || revision.currency;
        const summaryResult = parseSummary(extracted, { currency: extractedCurrency, positionRows: fields.rows });
        const completedAt = nowIso(); const warnings = [...extracted.warnings, ...fields.warnings, ...summaryResult.warnings]; let loadedProducts = 0; let loadedCosts = 0;
        await db.exec('BEGIN IMMEDIATE');
        try {
          for (const row of fields.rows) {
            if (!row.displayReference || !row.widthMm || !row.heightMm || !row.quantity) continue;
            const sourceId = stableEvidenceId('supplier-position', attachment.id, row.ordinal);
            const snapshot = { ...row.originalExtractedSnapshot, supplierName: quote.supplier_name, supplierQuoteId: quote.id, supplierRevisionId: revision.id, supplierRevision: revision.supplier_revision, attachmentId: attachment.id, attachmentFileName: attachment.original_file_name, extractionRunId: runId, sourceTrace: row.sourceTrace, warnings: row.warnings };
            await db.run(`INSERT INTO supplier_quote_positions(id,estimate_id,revision_id,display_reference,supplier_reference_tokens_json,quantity,width_mm,height_mm,unit_purchase_price_amount,total_purchase_price_amount,currency,source_pages_json,trace_json,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, sourceId, estimateId, revision.id, row.displayReference, JSON.stringify(row.supplierReferenceTokens), row.quantity, row.widthMm, row.heightMm, row.unitPrice, row.totalPrice, row.currency, JSON.stringify(row.sourcePages), JSON.stringify(row.sourceTrace), row.status === 'needs_review' ? 'needs_review' : 'unreviewed', completedAt, completedAt);
            const dimensions = geometry(row.widthMm, row.heightMm, row.quantity);
            const inserted = await db.run(`INSERT INTO project_calculator_estimate_product_rows(id,scenario_id,source_position_id,source_attachment_id,source_revision_id,source_snapshot_json,display_reference,product_class,quantity,width_mm,height_mm,total_price_amount,currency,area_square_metres,frame_perimeter_metres,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,source_position_id) DO NOTHING`, randomUUID(), scenarioId, sourceId, attachment.id, revision.id, JSON.stringify(snapshot), row.displayReference, 'Needs review', row.quantity, row.widthMm, row.heightMm, row.totalPrice, row.currency, dimensions.area, dimensions.perimeter, completedAt, completedAt);
            loadedProducts += inserted.changes;
          }
          for (const cost of summaryResult.additionalItems) {
            const sourceId = stableEvidenceId('supplier-extra', attachment.id, cost.ordinal);
            const snapshot = { ...cost.originalExtractedSnapshot, supplierName: quote.supplier_name, supplierQuoteId: quote.id, supplierRevisionId: revision.id, supplierRevision: revision.supplier_revision, attachmentId: attachment.id, attachmentFileName: attachment.original_file_name, extractionRunId: runId, sourceTrace: cost.sourceTrace, warnings: cost.warnings };
            await db.run(`INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,quantity,unit_price_amount,total_price_amount,currency,trace_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, sourceId, estimateId, revision.id, cost.category, cost.normalizedLabel || cost.originalDescription.split('\n')[0], cost.originalDescription, cost.quantity, cost.unitPrice, cost.totalPrice, cost.currency, JSON.stringify(cost.sourceTrace), completedAt);
            const inserted = await db.run(`INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,source_extra_id) DO NOTHING`, randomUUID(), scenarioId, sourceId, attachment.id, revision.id, JSON.stringify(snapshot), cost.category, cost.normalizedLabel || cost.originalDescription.split('\n')[0], cost.totalPrice, cost.currency, completedAt);
            loadedCosts += inserted.changes;
          }
          const summary = summaryResult.summary;
          if (summary) await db.run(`UPDATE supplier_quote_revisions SET currency=?,product_subtotal_amount=COALESCE(?,product_subtotal_amount),extras_total_amount=COALESCE(?,extras_total_amount),delivery_total_amount=COALESCE(?,delivery_total_amount),vat_total_amount=COALESCE(?,vat_total_amount),final_supplier_total_amount=COALESCE(?,final_supplier_total_amount),lifecycle_status='parsed' WHERE id=? AND estimate_id=?`, extractedCurrency, summary.productSubtotal, summary.additionalItemsSubtotal, summary.deliveryTotal, summary.vatTotal, summary.finalSupplierTotal, revision.id, estimateId);
          await db.run(`UPDATE supplier_quote_import_runs SET status=?,completed_at=?,warnings_json=? WHERE id=?`, warnings.length ? 'completed_with_warnings' : 'completed', completedAt, JSON.stringify(warnings), runId);
          await db.run('UPDATE project_calculator_lab_scenarios SET origin=CASE WHEN origin=? THEN ? ELSE origin END,updated_at=? WHERE id=?', 'manual', 'mixed', completedAt, scenarioId);
          await db.exec('COMMIT');
        } catch (error) { await db.exec('ROLLBACK'); throw error; }
        results.push({ runId, attachmentId: attachment.id, revisionId: revision.id, status: warnings.length ? 'completed_with_warnings' : 'completed', extractedProducts: fields.rows.length, loadedProducts, loadedCosts, duplicateProducts: fields.rows.length - loadedProducts, warnings });
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
