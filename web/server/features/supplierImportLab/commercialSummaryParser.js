import { randomUUID } from 'node:crypto';
import { normalizeDecimal } from './commercialFieldParser.js';

export const SUMMARY_PARSER_VERSION = '1.0.0';
const moneyOnly = /^[+-]?[\d.,]+(?:\s*[A-Z]{3})?$/i;
const totalQuantity = /^(?:total\s+quantity|qty\s*\(([^)]+)\))\s*:?$/i;
const totalArea = /^(?:total\s+)?(?:area|m2|m²)\s*:?$/i;
const productTotal = /^(?:product\s+total|positions?\s+subtotal|total\s+(?:excl\.?|without)\s+vat)\s*:?$/i;
const additionalTotal = /^(?:additional\s+(?:items?|costs?)\s+(?:subtotal|total)|extras?\s+(?:subtotal|total))\s*:?$/i;
const finalTotal = /^(?:final\s+total|total\s+amount|quotation\s+total)\s*:?$/i;
const deliveryLabel = /^(?:delivery|transport|freight|carriage)(?:\s+.*)?$/i;
const uValue = /average\s+u-value[^:]*:\s*([\d.,]+)/i;
const weight = /total\s+weight\s*:\s*([\d.,]+)\s*kg/i;
const stopNotes = /^(?:sales manager|e-?mail\s*\.?\s*:)/i;

function flatten(document) {
  return document.pages.flatMap((page) => page.blocks.map((block) => ({ ...block, text: String(block.text).trim(), pageNumber: page.pageNumber }))).filter((block) => block.text);
}
function trace(document, blocks) {
  return blocks.map((block) => ({ attachmentId: document.attachmentId, pageNumber: block.pageNumber, blockId: block.id, boundingBox: block.boundingBox, coordinateSpace: block.boundingBox ? 'pdf_points' : null, extractedText: block.text }));
}
function integerDecimal(value) { return value != null && /^\d+$/.test(value) ? value : null; }
function categoryFor(description) {
  if (/delivery|transport|freight|carriage/i.test(description)) return 'delivery';
  if (/sill/i.test(description)) return 'sill';
  if (/flashing/i.test(description)) return 'flashing';
  if (/trim|flat|corner/i.test(description)) return 'trim';
  if (/pack/i.test(description)) return 'packaging';
  if (/discount|credit/i.test(description)) return 'discount';
  if (/cap|accessor/i.test(description)) return 'accessory';
  if (/surcharge/i.test(description)) return 'surcharge';
  return 'other';
}
function quantityFrom(text) {
  const match = text.match(/\((\d+)\s*([A-Za-z]+)\)/); return match ? { quantity: match[1], quantityUnit: match[2] } : { quantity: null, quantityUnit: null };
}
function decimalParts(value) { const [whole, fraction = ''] = String(value).split('.'); return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length }; }
function sumDecimals(values) {
  const present = values.filter((value) => value != null); if (!present.length) return null; const parts = present.map(decimalParts); const scale = Math.max(...parts.map((item) => item.scale)); const integer = parts.reduce((sum, item) => sum + item.integer * 10n ** BigInt(scale - item.scale), 0n); const digits = integer.toString().padStart(scale + 1, '0'); return scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
}
function equalDecimals(left, right) { if (left == null || right == null) return false; return sumDecimals([left, `-${right}`])?.replace(/^-?0(?:\.0+)?$/, '0') === '0'; }

export function reconcileCommercialSummary(positionRows, summary, additionalItems) {
  const positionSubtotal = sumDecimals(positionRows.map((row) => row.totalPrice));
  const additionalSubtotal = sumDecimals(additionalItems.filter((item) => item.category !== 'delivery').map((item) => item.totalPrice));
  const deliverySubtotal = sumDecimals(additionalItems.filter((item) => item.category === 'delivery').map((item) => item.totalPrice));
  const expectedFinal = sumDecimals([summary.productSubtotal ?? positionSubtotal, additionalSubtotal, summary.deliveryTotal ?? deliverySubtotal, summary.vatTotal]);
  const warnings = [];
  if (summary.productSubtotal && positionSubtotal && !equalDecimals(summary.productSubtotal, positionSubtotal)) warnings.push('Supplied product subtotal does not match extracted position totals.');
  if (summary.additionalItemsSubtotal && additionalSubtotal && !equalDecimals(summary.additionalItemsSubtotal, additionalSubtotal)) warnings.push('Supplied additional-items subtotal does not match extracted additional costs.');
  if (summary.deliveryTotal && deliverySubtotal && !equalDecimals(summary.deliveryTotal, deliverySubtotal)) warnings.push('Supplied delivery total does not match delivery lines.');
  if (summary.finalSupplierTotal && expectedFinal && !equalDecimals(summary.finalSupplierTotal, expectedFinal)) warnings.push('Supplied final total does not reconcile with the extracted commercial evidence.');
  if (!summary.finalSupplierTotal || !expectedFinal) warnings.push('Commercial reconciliation is incomplete because one or more totals are absent.');
  return { positionSubtotal, additionalSubtotal, deliverySubtotal, expectedFinal, reconciled: Boolean(summary.finalSupplierTotal && expectedFinal && equalDecimals(summary.finalSupplierTotal, expectedFinal)), warnings };
}

export function parseCommercialSummary(document, { currency: sessionCurrency, positionRows = [] }) {
  const blocks = flatten(document); let start = blocks.findIndex((block) => totalQuantity.test(block.text) || totalArea.test(block.text) || productTotal.test(block.text) || additionalTotal.test(block.text)); const firstFinal = blocks.findIndex((block) => finalTotal.test(block.text)); if (start < 0 && firstFinal >= 0) { const delivery = blocks.slice(Math.max(0, firstFinal - 20), firstFinal).findIndex((block) => deliveryLabel.test(block.text)); start = delivery >= 0 ? Math.max(0, firstFinal - 20) + delivery : firstFinal; }
  if (start < 0) return { summary: null, additionalItems: [], warnings: ['End-of-quotation commercial summary was not found.'] };
  const endBlocks = blocks.slice(start); const valueAfter = (pattern) => { const index = endBlocks.findIndex((block) => pattern.test(block.text)); return index >= 0 ? { index, value: normalizeDecimal(endBlocks[index + 1]?.text), blocks: endBlocks.slice(index, index + 2) } : { index: -1, value: null, blocks: [] }; };
  const quantity = valueAfter(totalQuantity); const area = valueAfter(totalArea); const product = valueAfter(productTotal); const additional = valueAfter(additionalTotal); const final = valueAfter(finalTotal);
  const finalIndex = final.index >= 0 ? final.index : endBlocks.length; const leadingSummaryIndex = Math.max(quantity.index, area.index); const firstItem = product.index >= 0 ? product.index + 2 : leadingSummaryIndex >= 0 ? leadingSummaryIndex + 2 : 0; const items = [];
  for (let index = Math.max(0, firstItem); index < finalIndex;) {
    const descriptionBlock = endBlocks[index]; if (!descriptionBlock || moneyOnly.test(descriptionBlock.text) || /^(?:all prices|average\s+u-value|total\s+weight)/i.test(descriptionBlock.text)) { index += 1; continue; }
    const itemBlocks = [descriptionBlock]; let cursor = index + 1; while (cursor < finalIndex && !moneyOnly.test(endBlocks[cursor].text)) { itemBlocks.push(endBlocks[cursor]); cursor += 1; }
    const priceBlock = endBlocks[cursor]; const totalPrice = priceBlock ? normalizeDecimal(priceBlock.text) : null; if (!totalPrice) { index += 1; continue; } itemBlocks.push(priceBlock);
    const originalDescription = itemBlocks.slice(0, -1).map((block) => block.text).join('\n'); const quantityValue = quantityFrom(originalDescription); const category = categoryFor(originalDescription); const warnings = [];
    if (totalPrice.startsWith('-') && category !== 'discount') warnings.push('Negative amount requires an explicit discount or credit category.');
    const original = { category, originalDescription, normalizedLabel: null, quantity: quantityValue.quantity, quantityUnit: quantityValue.quantityUnit, unitPrice: null, totalPrice, currency: sessionCurrency.toUpperCase(), selectedForFutureUse: true };
    items.push({ id: randomUUID(), ordinal: items.length, ...original, sourceTrace: trace(document, itemBlocks), warnings, confidence: warnings.length ? 0.75 : 0.96, status: warnings.length ? 'needs_review' : 'extracted', originalExtractedSnapshot: original }); index = cursor + 1;
  }
  const deliveryItems = items.filter((item) => item.category === 'delivery'); const deliveryTotal = deliveryItems.length === 1 ? deliveryItems[0].totalPrice : null;
  const uBlock = endBlocks.find((block) => uValue.test(block.text)); const weightBlock = endBlocks.find((block) => weight.test(block.text)); const u = uBlock?.text.match(uValue)?.[1]; const kg = weightBlock?.text.match(weight)?.[1];
  const notesStart = endBlocks.findIndex((block) => /^(?:all prices|\s*-\s|Uw values)/i.test(block.text)); const noteBlocks = notesStart >= 0 ? endBlocks.slice(notesStart).filter((block) => !stopNotes.test(block.text) && !uValue.test(block.text) && !weight.test(block.text)) : [];
  const summaryBlockIds = new Set([...quantity.blocks, ...area.blocks, ...product.blocks, ...additional.blocks, ...final.blocks, ...(uBlock ? [uBlock] : []), ...(weightBlock ? [weightBlock] : []), ...noteBlocks].map((block) => block.id)); const summaryBlocks = endBlocks.filter((block) => summaryBlockIds.has(block.id));
  const original = { currency: sessionCurrency.toUpperCase(), totalQuantity: integerDecimal(quantity.value), totalQuantityUnit: quantity.index >= 0 ? endBlocks[quantity.index].text.match(totalQuantity)?.[1] || 'sets' : null, totalAreaSquareMetres: area.value, productSubtotal: product.value, additionalItemsSubtotal: additional.value, deliveryTotal, vatTotal: null, finalSupplierTotal: final.value, averageUValue: normalizeDecimal(u), totalWeightKg: normalizeDecimal(kg), closingNotes: noteBlocks.map((block) => block.text).join('\n') || null };
  const summary = { id: randomUUID(), ...original, sourceTrace: trace(document, summaryBlocks), warnings: [], confidence: 0.96, status: 'extracted', originalExtractedSnapshot: original };
  const reconciliation = reconcileCommercialSummary(positionRows, summary, items); const vatExplicit = endBlocks.some((block) => /\bVAT\b/i.test(block.text)); summary.warnings = [...reconciliation.warnings, ...(final.value && !vatExplicit ? ['VAT treatment is not explicit in the detected summary.'] : [])]; if (summary.warnings.length) summary.status = 'needs_review';
  return { summary: { ...summary, reconciliation }, additionalItems: items, warnings: summary.warnings };
}
