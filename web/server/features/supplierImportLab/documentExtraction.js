import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { extractDocxManufacturerVisuals } from './manufacturerPositionVisuals.js';
import { resolveAttachmentRoot } from '../supplierQuotes/managedAttachmentStorage.js';

export const EXTRACTOR_VERSION = '1.1.0';
const MAX_DOCX_ENTRIES = 2_000;
const MAX_DOCX_EXPANDED_BYTES = 128 * 1024 * 1024;
const MAX_DOCX_RATIO = 200;

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
  return { attachmentId: attachment.id, sessionId: attachment.sessionId, mediaType: attachment.mediaType, extractorName: 'mammoth', extractorVersion: EXTRACTOR_VERSION, createdAt: new Date().toISOString(), pages: [{ pageNumber: null, pageLabel: 'document', width: null, height: null, text: lines.join('\n'), blocks, tables }], manufacturerVisualCandidates: visuals.candidates, warnings: [...raw.messages.map((item) => item.message), ...visuals.warnings], textAvailable: lines.join('').length >= 20, extractionStatus: lines.join('').length >= 20 ? 'completed' : 'unsupported' };
}

async function extractPdf(filename, attachment) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(filename));
  const standardFontDataUrl = new URL('../../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href;
  const pdf = await getDocument({ data, isEvalSupported: false, useSystemFonts: false, standardFontDataUrl }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number); const viewport = page.getViewport({ scale: 1 }); const content = await page.getTextContent();
    const items = content.items.filter((item) => typeof item.str === 'string' && clean(item.str));
    const blocks = items.map((item, index) => ({ id: `pdf-${number}-${index}`, text: clean(item.str), pageNumber: number, boundingBox: { x: item.transform[4], y: item.transform[5], width: Math.max(Number(item.width) || 0.01, 0.01), height: Math.max(Number(item.height) || Math.abs(item.transform[3]) || 0.01, 0.01) }, readingOrder: index, sourceType: 'positioned_text' }));
    pages.push({ pageNumber: number, pageLabel: String(number), width: viewport.width, height: viewport.height, text: blocks.map((item) => item.text).join('\n'), blocks, tables: [] });
  }
  const textLength = pages.reduce((sum, page) => sum + page.text.replace(/\s/g, '').length, 0);
  return { attachmentId: attachment.id, sessionId: attachment.sessionId, mediaType: attachment.mediaType, extractorName: 'pdfjs-dist', extractorVersion: EXTRACTOR_VERSION, createdAt: new Date().toISOString(), pages, warnings: textLength < 20 ? ['OCR required — unsupported in Stage 1E'] : [], textAvailable: textLength >= 20, extractionStatus: textLength >= 20 ? 'completed' : 'unsupported' };
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
