import { open } from 'node:fs/promises';
import path from 'node:path';
import { SUPPLIER_UPLOAD_MIME_TYPES } from '../../config/supplierUploadLimits.js';

export function validateOriginalFileName(value, maxLength = 255) {
  const name = String(value || '');
  if (!name || name.length > maxLength || /[\u0000-\u001f\u007f]/.test(name)) {
    return { valid: false, code: 'invalid_filename' };
  }
  return { valid: true, displayName: path.basename(name) };
}

async function readHead(filename, length = 8) {
  const handle = await open(filename, 'r');
  try { const buffer = Buffer.alloc(length); const { bytesRead } = await handle.read(buffer, 0, length, 0); return buffer.subarray(0, bytesRead); }
  finally { await handle.close(); }
}

async function fileContainsAsciiMarkers(filename, markers) {
  const handle = await open(filename, 'r');
  const pending = new Set(markers);
  let overlap = Buffer.alloc(0);
  try {
    const buffer = Buffer.alloc(64 * 1024);
    let position = 0;
    while (pending.size) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (!bytesRead) break;
      position += bytesRead;
      const text = Buffer.concat([overlap, buffer.subarray(0, bytesRead)]).toString('latin1');
      for (const marker of pending) if (text.includes(marker)) pending.delete(marker);
      overlap = Buffer.from(text.slice(-256), 'latin1');
    }
  } finally { await handle.close(); }
  return pending.size === 0;
}

export async function validateSupplierDocumentFile({ filename, originalFileName, declaredMimeType, sizeBytes, maxFileNameLength = 255 }) {
  const nameResult = validateOriginalFileName(originalFileName, maxFileNameLength);
  if (!nameResult.valid) return nameResult;
  if (!sizeBytes) return { valid: false, code: 'empty_file' };
  const extension = path.extname(nameResult.displayName).toLowerCase();
  const head = await readHead(filename);
  if (extension === '.pdf') {
    if (declaredMimeType !== SUPPLIER_UPLOAD_MIME_TYPES.pdf) return { valid: false, code: 'unsupported_file_type' };
    if (!head.subarray(0, 5).equals(Buffer.from('%PDF-'))) return { valid: false, code: 'file_signature_mismatch' };
    return { valid: true, mediaType: SUPPLIER_UPLOAD_MIME_TYPES.pdf, parserEligible: true, displayName: nameResult.displayName };
  }
  if (extension === '.docx') {
    if (declaredMimeType !== SUPPLIER_UPLOAD_MIME_TYPES.docx) return { valid: false, code: 'unsupported_file_type' };
    const zipSignature = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2]) && [0x04, 0x06, 0x08].includes(head[3]);
    if (!zipSignature) return { valid: false, code: 'file_signature_mismatch' };
    const isDocx = await fileContainsAsciiMarkers(filename, ['[Content_Types].xml', 'word/document.xml']);
    if (!isDocx) return { valid: false, code: 'file_signature_mismatch' };
    return { valid: true, mediaType: SUPPLIER_UPLOAD_MIME_TYPES.docx, parserEligible: true, displayName: nameResult.displayName };
  }
  return { valid: false, code: 'unsupported_file_type' };
}
