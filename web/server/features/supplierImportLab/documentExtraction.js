import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { extractDocxManufacturerVisuals } from './manufacturerPositionVisuals.js';
import { resolveAttachmentRoot } from '../supplierQuotes/managedAttachmentStorage.js';
import { reconstructPdfPageLayout } from './pdfLayout.js';
import { assertPdfJsRuntimeResources, pdfJsRuntimeOptions, PDFJS_RUNTIME_VERSION } from './pdfJsRuntime.js';

export const EXTRACTOR_VERSION = '1.3.0';
const MAX_DOCX_ENTRIES = 2_000;
const MAX_DOCX_EXPANDED_BYTES = 128 * 1024 * 1024;
const MAX_DOCX_RATIO = 200;
const MAX_PDF_BYTES = 64 * 1024 * 1024;
const MAX_PDF_PAGES = 400;
const MAX_PDF_TEXT_RUNS = 500_000;
const MAX_PDF_OPERATORS = 2_000_000;
const MAX_PDF_VECTOR_PATHS = 250_000;

const multiplyTransform = (left, right) => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];
const transformPoint = (matrix, x, y) => ({ x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] });
function transformedBox(raw, matrix) {
  const values = Array.from(raw || [], Number);
  if (values.length < 4 || values.some((value) => !Number.isFinite(value))) return null;
  const points = [transformPoint(matrix, values[0], values[1]), transformPoint(matrix, values[2], values[1]), transformPoint(matrix, values[0], values[3]), transformPoint(matrix, values[2], values[3])];
  const left = Math.min(...points.map((point) => point.x)); const bottom = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x)); const top = Math.max(...points.map((point) => point.y));
  return { x: left, y: bottom, width: right - left, height: top - bottom };
}

function zipSafety(buffer) {
  let entries = 0; let expanded = 0; let compressed = 0;
  for (let offset = 0; offset + 46 <= buffer.length;) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x02014b50) { offset += 1; continue; }
    entries += 1; compressed += buffer.readUInt32LE(offset + 20); expanded += buffer.readUInt32LE(offset + 24);
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (!entries || entries > MAX_DOCX_ENTRIES || expanded > MAX_DOCX_EXPANDED_BYTES || (compressed && expanded / compressed > MAX_DOCX_RATIO)) {
    throw Object.assign(new Error('DOCX package exceeds safe extraction limits.'), { code: 'unsafe_docx_package' });
  }
}

const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const stripHtml = (value) => clean(String(value).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

async function extractDocx(filename, attachment, options) {
  const buffer = await readFile(filename); zipSafety(buffer);
  const raw = await mammoth.extractRawText({ buffer });
  const html = await mammoth.convertToHtml({ buffer });
  const lines = raw.value.split(/\r?\n/).map(clean).filter(Boolean);
  const blocks = lines.map((text, index) => ({ id: `docx-block-${index}`, text, pageNumber: null, boundingBox: null, readingOrder: index, sourceType: 'paragraph' }));
  const tables = [...html.value.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((table, tableIndex) => ({ id: `docx-table-${tableIndex}`, pageNumber: null, rows: [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row, rowIndex) => [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell, column) => ({ row: rowIndex, column, text: stripHtml(cell[1]), boundingBox: null }))), sourceTrace: [{ attachmentId: attachment.id, blockId: `docx-table-${tableIndex}`, coordinateSpace: null }] }));
  const visuals = await extractDocxManufacturerVisuals(buffer, attachment, options);
  return { attachmentId: attachment.id, sourceSha256: attachment.sha256 ?? null, sessionId: attachment.sessionId, mediaType: attachment.mediaType, extractorName: 'mammoth', extractorVersion: EXTRACTOR_VERSION, createdAt: new Date().toISOString(), pages: [{ pageNumber: null, pageLabel: 'document', width: null, height: null, text: lines.join('\n'), blocks, tables }], manufacturerVisualCandidates: visuals.candidates, warnings: [...raw.messages.map((item) => item.message), ...visuals.warnings], textAvailable: lines.join('').length >= 20, extractionStatus: lines.join('').length >= 20 ? 'completed' : 'unsupported' };
}

async function extractPdf(filename, attachment) {
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  await assertPdfJsRuntimeResources();
  const source = await readFile(filename);
  if (source.length > MAX_PDF_BYTES) throw Object.assign(new Error('PDF exceeds the safe extraction size limit.'), { code: 'unsafe_pdf_document' });
  const data = new Uint8Array(source);
  const loadingTask = getDocument(pdfJsRuntimeOptions({ data }));
  const pdf = await loadingTask.promise;
  if (pdf.numPages > MAX_PDF_PAGES) { await loadingTask.destroy(); throw Object.assign(new Error('PDF exceeds the safe page-count limit.'), { code: 'unsafe_pdf_document' }); }
  const pages = []; let totalRuns = 0; let totalOperators = 0; const structure = { pageCount: pdf.numPages, textRunCount: 0, operatorCount: 0, fontNames: [], imageObjectCount: 0, vectorPathCount: 0, formObjectCount: 0, emptyTextPages: 0, mixedContentPages: 0 };
  const fontNames = new Set();
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number); const viewport = page.getViewport({ scale: 1 }); const content = await page.getTextContent();
    totalRuns += content.items.length;
    if (totalRuns > MAX_PDF_TEXT_RUNS) { await loadingTask.destroy(); throw Object.assign(new Error('PDF exceeds the safe positioned-text limit.'), { code: 'unsafe_pdf_document' }); }
    const layout = reconstructPdfPageLayout(content, number, viewport);
    for (const run of layout.runs) if (run.fontName) fontNames.add(run.fontName);
    const operators = await page.getOperatorList(); totalOperators += operators.fnArray.length;
    if (totalOperators > MAX_PDF_OPERATORS) { await loadingTask.destroy(); throw Object.assign(new Error('PDF exceeds the safe rendering-operator limit.'), { code: 'unsafe_pdf_document' }); }
    let images = 0; let vectors = 0; let forms = 0;
    let vectorPaths = 0;
    let graphics = { transform: [1, 0, 0, 1, 0, 0], strokeColor: null, fillColor: null, lineWidth: 1 };
    const graphicsStack = [];
    const vectorEvidence = [];
    const imageEvidence = [];
    for (const [operatorIndex, operator] of operators.fnArray.entries()) {
      const args = operators.argsArray[operatorIndex];
      if (operator === OPS.paintImageXObject || operator === OPS.paintInlineImageXObject || operator === OPS.paintImageMaskXObject) {
        images += 1;
        const boundingBox = transformedBox([0, 0, 1, 1], graphics.transform);
        if (boundingBox) imageEvidence.push({
          id: `pdf-${number}-image-${operatorIndex}`,
          objectId: typeof args?.[0] === 'string' ? args[0] : null,
          pageNumber: number,
          boundingBox,
          sourceOperatorIndex: operatorIndex,
          sourceType: operator === OPS.paintImageXObject ? 'image_xobject_bounds' : operator === OPS.paintInlineImageXObject ? 'inline_image_bounds' : 'image_mask_bounds',
          intrinsicWidth: Number.isFinite(Number(args?.[1])) ? Number(args[1]) : null,
          intrinsicHeight: Number.isFinite(Number(args?.[2])) ? Number(args[2]) : null,
        });
      }
      else if (operator === OPS.save) graphicsStack.push({ ...graphics, transform: [...graphics.transform] });
      else if (operator === OPS.restore) graphics = graphicsStack.pop() || graphics;
      else if (operator === OPS.transform && Array.isArray(args) && args.length >= 6) graphics = { ...graphics, transform: multiplyTransform(graphics.transform, args.map(Number)) };
      else if (operator === OPS.setStrokeRGBColor) graphics = { ...graphics, strokeColor: String(args?.[0] || '') || null };
      else if (operator === OPS.setFillRGBColor) graphics = { ...graphics, fillColor: String(args?.[0] || '') || null };
      else if (operator === OPS.setLineWidth) graphics = { ...graphics, lineWidth: Number(args?.[0]) || graphics.lineWidth };
      else if (operator === OPS.constructPath) {
        vectors += 1; vectorPaths += 1;
        if (vectorPaths > MAX_PDF_VECTOR_PATHS) { await loadingTask.destroy(); throw Object.assign(new Error('PDF exceeds the safe vector-evidence limit.'), { code: 'unsafe_pdf_document' }); }
        const boundingBox = transformedBox(args?.[2], graphics.transform);
        if (boundingBox) vectorEvidence.push({ id: `pdf-${number}-vector-${operatorIndex}`, pageNumber: number, boundingBox, strokeColor: graphics.strokeColor, fillColor: graphics.fillColor, lineWidth: Math.abs(graphics.lineWidth * graphics.transform[0]), sourceOperatorIndex: operatorIndex, sourceType: 'vector_path_bounds' });
      }
      else if (operator === OPS.paintFormXObjectBegin) forms += 1;
    }
    layout.vectorEvidence = vectorEvidence;
    layout.imageEvidence = imageEvidence;
    layout.contentEvidence = { textRunCount: layout.runs.length, lineCount: layout.lines.length, regionCount: layout.regions.length, imageObjectCount: images, vectorPathCount: vectors, formObjectCount: forms, hasText: layout.runs.length > 0, hasRasterImages: images > 0, hasVectorContent: vectors > 0 };
    if (!layout.runs.length) structure.emptyTextPages += 1;
    if (layout.runs.length && (images || vectors)) structure.mixedContentPages += 1;
    structure.textRunCount += layout.runs.length; structure.operatorCount += operators.fnArray.length; structure.imageObjectCount += images; structure.vectorPathCount += vectors; structure.formObjectCount += forms;
    pages.push(layout);
  }
  structure.fontNames = [...fontNames];
  const metadata = await pdf.getMetadata().catch(() => null); const permissions = await pdf.getPermissions().catch(() => null);
  const documentMetadata = {
    title: clean(metadata?.info?.Title),
    creationDate: clean(metadata?.info?.CreationDate),
    modificationDate: clean(metadata?.info?.ModDate),
    producer: clean(metadata?.info?.Producer),
  };
  await loadingTask.destroy();
  const textLength = pages.reduce((sum, page) => sum + page.text.replace(/\s/g, '').length, 0);
  const warnings = textLength < 20 ? ['No machine-readable text layer; bounded OCR fallback is required.'] : [];
  return { attachmentId: attachment.id, sourceSha256: attachment.sha256 ?? null, sessionId: attachment.sessionId, mediaType: attachment.mediaType, extractorName: 'pdfjs-dist', extractorVersion: EXTRACTOR_VERSION, createdAt: new Date().toISOString(), pages, manufacturerVisualCandidates: [], pdfStructure: { ...structure, runtimeVersion: PDFJS_RUNTIME_VERSION, documentMetadata, encrypted: Boolean(metadata?.info?.EncryptFilterName), restricted: Array.isArray(permissions) && permissions.length > 0, permissions: Array.isArray(permissions) ? permissions : null }, warnings, textAvailable: textLength >= 20, extractionStatus: textLength >= 20 ? 'completed' : 'ocr_required' };
}

export async function extractSupplierDocument(filename, attachment, options = {}) {
  try {
    if (attachment.mediaType === 'application/pdf') return await extractPdf(filename, attachment);
    if (attachment.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return await extractDocx(filename, attachment, { visualRoot: path.join(resolveAttachmentRoot(), 'manufacturer-position-visuals'), ...options });
    throw Object.assign(new Error('Unsupported extraction media type.'), { code: 'unsupported_file_type' });
  } catch (error) {
    if (error.code) throw error;
    throw Object.assign(new Error('Document could not be safely extracted.'), { code: 'document_extraction_failed', cause: error });
  }
}
