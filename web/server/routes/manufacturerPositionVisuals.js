import express from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { resolveAttachmentRoot } from '../features/supplierQuotes/managedAttachmentStorage.js';

const tokenPattern = /^[a-f0-9]{40}$/;
const files = { 'quotation.png': 'image/png', 'quotation.jpg': 'image/jpeg' };

export function createManufacturerPositionVisualsRouter({ attachmentRoot = resolveAttachmentRoot() } = {}) {
  const router = express.Router(); const root = path.join(attachmentRoot, 'manufacturer-position-visuals');
  router.get('/:token/:file', async (req, res, next) => {
    if (!tokenPattern.test(req.params.token) || !files[req.params.file]) return res.status(404).end();
    const filename = path.join(root, req.params.token, req.params.file);
    try { const metadata = await stat(filename); res.setHeader('Content-Type', files[req.params.file]); res.setHeader('Content-Length', String(metadata.size)); res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); res.setHeader('X-Content-Type-Options', 'nosniff'); createReadStream(filename).on('error', next).pipe(res); }
    catch (error) { if (error?.code === 'ENOENT') return res.status(404).end(); next(error); }
  });
  return router;
}
