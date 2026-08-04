import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ensureAttachmentRoot, resolveManagedPath } from './managedAttachmentStorage.js';
import { SUPPLIER_UPLOAD_LIMITS } from '../../config/supplierUploadLimits.js';

export const TEMP_UPLOAD_PREFIX = 'stage1d-';

export async function createSupplierUploadMiddleware(root) {
  const resolvedRoot = await ensureAttachmentRoot(root);
  const temporaryDirectory = path.join(resolvedRoot, '.temporary-uploads');
  await mkdir(temporaryDirectory, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, temporaryDirectory),
    filename: (_request, _file, callback) => callback(null, `${TEMP_UPLOAD_PREFIX}${randomUUID()}.upload`),
  });
  return multer({ storage, limits: { files: SUPPLIER_UPLOAD_LIMITS.maxFiles, fileSize: SUPPLIER_UPLOAD_LIMITS.maxFileBytes, fields: SUPPLIER_UPLOAD_LIMITS.maxFields, fieldNameSize: 100, fieldSize: 4096 } }).array('files', SUPPLIER_UPLOAD_LIMITS.maxFiles);
}

export async function moveTemporaryUpload(temporaryPath, storageKey, root) {
  const finalPath = resolveManagedPath(storageKey, root);
  await mkdir(path.dirname(finalPath), { recursive: true });
  await rename(temporaryPath, finalPath);
  return finalPath;
}

export async function removeFileIfPresent(filename) {
  if (!filename) return;
  try { await unlink(filename); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
}

export async function listStaleTemporaryUploads(root, olderThanMs, now = Date.now()) {
  const directory = path.join(await ensureAttachmentRoot(root), '.temporary-uploads');
  const entries = await readdir(directory, { withFileTypes: true });
  const stale = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(TEMP_UPLOAD_PREFIX) || !entry.name.endsWith('.upload')) continue;
    const filename = path.join(directory, entry.name); const metadata = await stat(filename);
    if (now - metadata.mtimeMs >= olderThanMs) stale.push(filename);
  }
  return stale;
}
