import { randomUUID } from 'node:crypto';

export const FIELD_PARSER_VERSION = '1.0.0';
const decimalPattern = /^[-+]?\d+(?:[.,]\d+)?$/;
const dimensionPattern = /^(\d+)\s*[x×]\s*(\d+)\s*mm$/i;
const priceHeaderPattern = /^Price\s*,?\s*([A-Z]{3})?$/i;

export function normalizeDecimal(raw) {
  const compact = String(raw ?? '').replace(/\b[A-Z]{3}\b/gi, '').replace(/[\s\u00a0€£$]/g, '');
  if (!/^[-+]?\d[\d.,]*$/.test(compact)) return null;
  const comma = compact.lastIndexOf(','); const dot = compact.lastIndexOf('.');
  const normalized = comma >= 0 && dot >= 0 ? (comma > dot ? compact.replaceAll('.', '').replace(',', '.') : compact.replaceAll(',', '')) : comma >= 0 ? compact.replace(',', '.') : compact;
  return decimalPattern.test(normalized) ? normalized : null;
}

function decimalParts(value) { const [whole, fraction = ''] = value.split('.'); return { scale: fraction.length, integer: BigInt(`${whole}${fraction}`) }; }
function multiplyDecimal(value, quantity) { const { scale, integer } = decimalParts(value); const digits = (integer * BigInt(quantity)).toString().padStart(scale + 1, '0'); return scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits; }
function equivalentMoney(left, right) { const a = decimalParts(left); const b = decimalParts(right); const scale = Math.max(a.scale, b.scale); return a.integer * 10n ** BigInt(scale - a.scale) === b.integer * 10n ** BigInt(scale - b.scale); }

export function parseQuotationReference(text) {
  const match = String(text).match(/(?:PRICE\s+OFFER|QUOTATION|QUOTE)\s*(?:No\.?|NUMBER)?\s*[:#]?\s*([A-Z0-9]+)-(\d+)\b/i);
  if (!match) return { supplierQuotationNumber: null, supplierRevision: null, fullQuotationReference: null, warnings: [] };
  return { supplierQuotationNumber: match[1], supplierRevision: match[2], fullQuotationReference: `${match[1]}-${match[2]}`, warnings: [] };
}

function flatten(document) {
  return document.pages.flatMap((page) => page.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber }))).filter((item) => item.text);
}

export function parseCommercialFields(document, { currency: sessionCurrency }) {
  const blocks = flatten(document); const quotation = parseQuotationReference(blocks.map((item) => item.text).join('\n')); const rows = []; let start = quotation.fullQuotationReference ? blocks.findIndex((item) => item.text.includes(quotation.fullQuotationReference)) + 1 : 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const header = blocks[index].text.match(priceHeaderPattern); if (!header || !/^Qty$/i.test(blocks[index + 1]?.text || '') || !/^Total\s*,?/i.test(blocks[index + 2]?.text || '')) continue;
    const tail = blocks.slice(index + 3, index + 10); const dimensionIndex = tail.findIndex((item) => dimensionPattern.test(item.text)); if (dimensionIndex < 0) continue;
    const dimensions = tail[dimensionIndex].text.match(dimensionPattern); const numeric = tail.slice(dimensionIndex + 1).filter((item) => normalizeDecimal(item.text) !== null); if (numeric.length < 3) continue;
    const [unitRaw, quantityRaw, totalRaw] = numeric; const quantity = /^\d+$/.test(quantityRaw.text) ? Number(quantityRaw.text) : null; const unitPrice = normalizeDecimal(unitRaw.text); const totalPrice = normalizeDecimal(totalRaw.text); const referenceBlock = blocks[start]; const warnings = [];
    if (!referenceBlock || /^\d+\./.test(referenceBlock.text)) warnings.push('Position block segmentation requires review.');
    if (!header[1]) warnings.push(`Currency fell back to session currency ${sessionCurrency}.`);
    if (quantity && unitPrice && totalPrice && !equivalentMoney(multiplyDecimal(unitPrice, quantity), totalPrice)) warnings.push('Supplied total does not equal unit price multiplied by quantity.');
    const source = blocks.slice(start, index + 3 + dimensionIndex + numeric.indexOf(totalRaw) + 1); const sourcePages = [...new Set(source.map((item) => item.pageNumber).filter(Number.isInteger))]; const displayReference = referenceBlock?.text || null;
    const original = { displayReference, originalReferenceText: displayReference, supplierReferenceTokens: displayReference ? displayReference.split(',').map((item) => item.trim()).filter(Boolean) : [], quantity, widthMm: Number(dimensions[1]), heightMm: Number(dimensions[2]), originalDimensionsText: tail[dimensionIndex].text, unitPrice, totalPrice, currency: (header[1] || sessionCurrency).toUpperCase() };
    rows.push({ id: randomUUID(), ordinal: rows.length, ...original, sourcePages, sourceTrace: source.map((item) => ({ attachmentId: document.attachmentId, pageNumber: item.pageNumber, blockId: item.id, boundingBox: item.boundingBox, coordinateSpace: item.boundingBox ? 'pdf_points' : null, extractedText: item.text })), confidence: warnings.length ? '0.75' : '0.98', warnings, status: warnings.length ? 'needs_review' : 'extracted', originalExtractedSnapshot: original });
    start = blocks.indexOf(totalRaw) + 1;
  }
  return { quotation, rows, warnings: rows.length ? [] : ['No commercial position blocks were detected.'] };
}
