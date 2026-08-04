import express from 'express';
import { createReadStream } from 'node:fs';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SUPPLIER_UPLOAD_LIMITS } from '../config/supplierUploadLimits.js';
import { calculateFileSha256, readFileIntegrity, resolveAttachmentRoot, resolveManagedPath } from '../features/supplierQuotes/managedAttachmentStorage.js';
import { validateSupplierDocumentFile } from '../features/supplierQuotes/fileTypeValidation.js';
import { createSupplierQuotesService } from '../features/supplierQuotes/supplierQuotesService.js';
import { createSupplierUploadMiddleware, moveTemporaryUpload, removeFileIfPresent } from '../features/supplierQuotes/supplierUploadStorage.js';

const allowedRoles = new Set(['original_quote', 'supporting_document', 'supplier_drawing']);
function apiError(res, status, code, message) { return res.status(status).json({ error: message, code }); }
function safeDownloadName(value) { return String(value || 'supplier-document').replace(/[\r\n"\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '_').slice(0, 255) || 'supplier-document'; }
function rolesForRequest(body, count) { const raw = typeof body.roles === 'string' ? body.roles : typeof body.role === 'string' ? body.role : 'original_quote'; let roles; try { roles = raw.startsWith('[') ? JSON.parse(raw) : [raw]; } catch { roles = []; } if (roles.length === 1 && count > 1) roles = Array(count).fill(roles[0]); if (roles.length !== count || roles.some((role) => !allowedRoles.has(role))) throw Object.assign(new Error('Invalid attachment role.'), { code: 'unsupported_file_type' }); return roles; }
function middlewarePromise(middleware) { return (req, res, next) => middleware(req, res, (error) => error ? next(error) : next()); }

export async function createSupplierQuotesRouter({ dbPromise, attachmentRoot = resolveAttachmentRoot() } = {}) {
  if (!dbPromise) throw new Error('Supplier Quotes router requires a database promise.');
  const router = express.Router(); const upload = await createSupplierUploadMiddleware(attachmentRoot);
  const service = async () => createSupplierQuotesService(await dbPromise);
  router.get('/:estimateId/supplier-quotes', async (req, res, next) => { try { const value = await (await service()).listQuotes(req.params.estimateId); return value ? res.json(value) : apiError(res, 404, 'estimate_not_found', 'Estimate not found.'); } catch (e) { next(e); } });
  router.post('/:estimateId/supplier-quotes', async (req, res, next) => { try { const value = await (await service()).createQuote(req.params.estimateId, req.body || {}); return value ? res.status(201).json(value) : apiError(res, 404, 'estimate_not_found', 'Estimate not found.'); } catch (e) { next(e); } });
  router.get('/:estimateId/supplier-quotes/:quoteId', async (req, res, next) => { try { const value = await (await service()).getQuote(req.params.estimateId, req.params.quoteId); return value ? res.json(value) : apiError(res, 404, 'supplier_quote_not_found', 'Supplier quote not found.'); } catch (e) { next(e); } });
  router.get('/:estimateId/supplier-quotes/:quoteId/revisions', async (req, res, next) => { try { const value = await (await service()).listRevisions(req.params.estimateId, req.params.quoteId); return value ? res.json(value) : apiError(res, 404, 'supplier_quote_not_found', 'Supplier quote not found.'); } catch (e) { next(e); } });
  router.post('/:estimateId/supplier-quotes/:quoteId/revisions', async (req, res, next) => { try { const value = await (await service()).createRevision(req.params.estimateId, req.params.quoteId, req.body || {}); return value ? res.status(201).json(value) : apiError(res, 404, 'supplier_quote_not_found', 'Supplier quote not found.'); } catch (e) { next(e); } });
  router.get('/:estimateId/supplier-quotes/:quoteId/revisions/:revisionId', async (req, res, next) => { try { const value = await (await service()).getRevision(req.params.estimateId, req.params.quoteId, req.params.revisionId); return value ? res.json(value) : apiError(res, 404, 'revision_not_found', 'Revision not found.'); } catch (e) { next(e); } });
  router.get('/:estimateId/supplier-quotes/:quoteId/revisions/:revisionId/attachments', async (req, res, next) => { try { const value = await (await service()).listAttachments(req.params.estimateId, req.params.quoteId, req.params.revisionId); return value ? res.json(value) : apiError(res, 404, 'revision_not_found', 'Revision not found.'); } catch (e) { next(e); } });
  router.get('/:estimateId/supplier-quotes/:quoteId/revisions/:revisionId/attachments/:attachmentId', async (req, res, next) => { try { const value = await (await service()).getAttachment(req.params.estimateId, req.params.quoteId, req.params.revisionId, req.params.attachmentId); return value ? res.json(value.metadata) : apiError(res, 404, 'attachment_not_found', 'Attachment not found.'); } catch (e) { next(e); } });
  router.post('/:estimateId/supplier-quotes/:quoteId/revisions/:revisionId/attachments', (req, res, next) => {
    const contentLength = Number(req.headers['content-length'] || 0); if (contentLength > SUPPLIER_UPLOAD_LIMITS.maxCombinedFileBytes + 1024 * 1024) return apiError(res, 413, 'request_too_large', 'Upload request is too large.');
    return middlewarePromise(upload)(req, res, next);
  }, async (req, res, next) => {
    const files = Array.isArray(req.files) ? req.files : []; const temporary = files.map((file) => file.path); const finals = [];
    let retained = false;
    const cleanup = async () => { await Promise.allSettled([...temporary, ...finals].map(removeFileIfPresent)); };
    req.once('aborted', () => { if (!retained) void cleanup(); });
    try {
      if (!files.length) return apiError(res, 400, 'empty_file', 'At least one PDF or DOCX file is required.');
      const total = files.reduce((sum, file) => sum + file.size, 0); if (total > SUPPLIER_UPLOAD_LIMITS.maxCombinedFileBytes) { await cleanup(); return apiError(res, 413, 'request_too_large', 'Combined file size exceeds the limit.'); }
      const roles = rolesForRequest(req.body || {}, files.length); const records = [];
      for (const [index, file] of files.entries()) {
        const validated = await validateSupplierDocumentFile({ filename: file.path, originalFileName: file.originalname, declaredMimeType: file.mimetype, sizeBytes: file.size, maxFileNameLength: SUPPLIER_UPLOAD_LIMITS.maxOriginalFileNameLength });
        if (!validated.valid) throw Object.assign(new Error('File validation failed.'), { code: validated.code });
        const id = randomUUID(); const storageKey = ['estimates', req.params.estimateId, 'supplier-quotes', req.params.revisionId, id].join('/'); const finalPath = await moveTemporaryUpload(file.path, storageKey, attachmentRoot); finals.push(finalPath);
        records.push({ id, estimateId: req.params.estimateId, revisionId: req.params.revisionId, role: roles[index], originalFileName: validated.displayName, mediaType: validated.mediaType, sizeBytes: file.size, sha256: await calculateFileSha256(finalPath), storageKey, parserEligible: validated.parserEligible, createdAt: new Date().toISOString(), derivedFromAttachmentId: null, artifactType: null, extractorVersion: null });
      }
      const stored = await (await service()).insertAttachments(req.params.estimateId, req.params.quoteId, req.params.revisionId, records); retained = true; return res.status(201).json({ attachments: stored });
    } catch (error) { await cleanup(); const code = error?.code || 'storage_failure'; const status = code === 'revision_not_found' ? 404 : code === 'request_too_large' || code === 'LIMIT_FILE_SIZE' ? 413 : 400; return apiError(res, status, code, code === 'revision_not_found' ? 'Revision not found.' : 'Upload rejected.'); }
  });
  router.get('/:estimateId/supplier-quotes/:quoteId/revisions/:revisionId/attachments/:attachmentId/download', async (req, res, next) => { try { const record = await (await service()).getAttachment(req.params.estimateId, req.params.quoteId, req.params.revisionId, req.params.attachmentId); if (!record) return apiError(res, 404, 'attachment_not_found', 'Attachment not found.'); const filename = resolveManagedPath(record.storageKey, attachmentRoot); let integrity; try { integrity = await readFileIntegrity(filename); } catch { return apiError(res, 404, 'attachment_not_found', 'Attachment not found.'); } if (integrity.sizeBytes !== record.metadata.sizeBytes || integrity.sha256 !== record.metadata.sha256) { console.error('Supplier attachment integrity failure', { estimateId: req.params.estimateId, attachmentId: req.params.attachmentId }); return apiError(res, 409, 'integrity_failure', 'Attachment integrity verification failed.'); } res.setHeader('Content-Type', record.metadata.mediaType); res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(record.metadata.originalFileName)}"`); res.setHeader('Content-Length', String(integrity.sizeBytes)); res.setHeader('X-Content-Type-Options', 'nosniff'); createReadStream(filename).on('error', next).pipe(res); } catch (e) { next(e); } });
  router.delete('/:estimateId/supplier-quotes/:quoteId/revisions/:revisionId/attachments/:attachmentId', async (req, res, next) => { let quarantinePath; try { const record = await (await service()).getAttachment(req.params.estimateId, req.params.quoteId, req.params.revisionId, req.params.attachmentId); if (!record) return apiError(res, 404, 'attachment_not_found', 'Attachment not found.'); const filename = resolveManagedPath(record.storageKey, attachmentRoot); quarantinePath = `${filename}.delete-${randomUUID()}`; try { await rename(filename, quarantinePath); } catch (error) { if (error?.code !== 'ENOENT') throw error; quarantinePath = null; } try { await (await service()).deleteAttachmentMetadata(req.params.estimateId, req.params.quoteId, req.params.revisionId, req.params.attachmentId); } catch (error) { if (quarantinePath) await rename(quarantinePath, filename); throw error; } if (quarantinePath) await removeFileIfPresent(quarantinePath); return res.status(204).end(); } catch (error) { if (error?.code === 'attachment_in_use') return apiError(res, 409, 'attachment_in_use', 'Attachment is retained because supplier evidence references it.'); next(error); } });
  router.use((error, req, res, _next) => { const code = error?.code === 'LIMIT_FILE_COUNT' ? 'too_many_files' : error?.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'storage_failure'; const status = code === 'storage_failure' ? 500 : 413; console.error('Supplier Quotes request failed', { code, method: req.method, estimateId: req.params?.estimateId || null }); return apiError(res, status, code, code === 'storage_failure' ? 'Supplier document operation failed.' : 'Upload limit exceeded.'); });
  return router;
}
