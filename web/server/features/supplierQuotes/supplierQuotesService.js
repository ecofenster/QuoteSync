import { randomUUID } from 'node:crypto';

function nowIso() { return new Date().toISOString(); }
function mapQuote(row) { return { id: row.id, estimateId: row.estimate_id, supplierCode: row.supplier_code, supplierName: row.supplier_name, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at }; }
function money(amount, currency) { return amount == null ? null : { amount: String(amount), currency }; }
function mapRevision(row) { return { id: row.id, supplierQuoteId: row.supplier_quote_id, estimateId: row.estimate_id, revisionSequence: row.revision_sequence, supplierQuotationNumber: row.supplier_quotation_number, supplierRevision: row.supplier_revision, fullQuotationReference: row.full_quotation_reference, quotationDate: row.quotation_date, customerReference: row.customer_reference, currency: row.currency, vatStatus: row.vat_status, productSubtotal: money(row.product_subtotal_amount, row.currency), extrasTotal: money(row.extras_total_amount, row.currency), deliveryTotal: money(row.delivery_total_amount, row.currency), vatTotal: money(row.vat_total_amount, row.currency), finalSupplierTotal: money(row.final_supplier_total_amount, row.currency), lifecycleStatus: row.lifecycle_status, createdAt: row.created_at, supersededAt: row.superseded_at, supersededByRevisionId: row.superseded_by_revision_id }; }
function mapAttachment(row) { return { id: row.id, estimateId: row.estimate_id, revisionId: row.revision_id, role: row.role, originalFileName: row.original_file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256, parserEligible: Boolean(row.parser_eligible), createdAt: row.created_at, derivedFromAttachmentId: row.derived_from_attachment_id, artifactType: row.artifact_type, extractorVersion: row.extractor_version }; }

export function createSupplierQuotesService(db) {
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
  async function attachmentIsInUse(estimateId, attachmentId) {
    const row = await db.get(`SELECT 1 AS used FROM supplier_quote_attachments a WHERE a.id=? AND a.estimate_id=? AND (EXISTS(SELECT 1 FROM supplier_quote_import_run_attachments j WHERE j.attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_attachments d WHERE d.derived_from_attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_import_runs r WHERE r.raw_result_attachment_id=a.id) OR EXISTS(SELECT 1 FROM supplier_quote_positions p WHERE p.supplier_drawing_attachment_id=a.id)) LIMIT 1`, attachmentId, estimateId);
    return Boolean(row);
  }
  async function deleteAttachmentMetadata(estimateId, quoteId, revisionId, attachmentId) { const row = await attachmentRow(estimateId, quoteId, revisionId, attachmentId); if (!row) return null; if (await attachmentIsInUse(estimateId, attachmentId)) throw Object.assign(new Error('Attachment is referenced by supplier evidence.'), { code: 'attachment_in_use' }); const result = await db.run('DELETE FROM supplier_quote_attachments WHERE id=? AND estimate_id=? AND revision_id=?', attachmentId, estimateId, revisionId); return result.changes ? { storageKey: row.storage_key } : null; }
  return { estimateExists, createQuote, listQuotes, getQuote, createRevision, listRevisions, getRevision, listAttachments, getAttachment, insertAttachments, deleteAttachmentMetadata };
}
