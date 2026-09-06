import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { extractSupplierDocument } from '../server/features/supplierImportLab/documentExtraction.js';
import { parseCommercialFields } from '../server/features/supplierImportLab/commercialFieldParser.js';
import { derivePdfPositionPreviews, PDF_POSITION_PREVIEW_VERSION } from '../server/features/supplierImportLab/pdfPositionPreviews.js';
import { auditPdfJsRuntimeResources, pdfJsRuntimeOptions, PDFJS_RUNTIME_VERSION } from '../server/features/supplierImportLab/pdfJsRuntime.js';
import { detectPdfDocumentCurrency } from '../server/features/supplierImportLab/pdfSupplierAdapters.js';
import { normalizeSupplierIdentity, resolveCanonicalSupplier } from '../server/features/supplierQuotes/supplierIdentity.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';

const sourceFile = path.resolve('docs/Supplier_Quotes/Kosztorys - OF_25_2263569.pdf');
const sourceSha256 = 'be0d783701c6286b639dfd1da7cb55228fd591fbd5334d36751ce8022720d5e6';
const expectedPages = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20];
const count = async (db, table, where = '', ...parameters) => Number((await db.get(`SELECT COUNT(*) count FROM ${table}${where ? ` WHERE ${where}` : ''}`, ...parameters)).count);
const previewFilename = (root, visual) => path.join(root, visual.url.split('/')[3], 'quotation.png');
async function blueEdgePixels(filename) {
  const image = await loadImage(filename); const canvas = createCanvas(image.width, image.height); const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data; let count = 0;
  const blue = (offset) => pixels[offset + 2] > 130 && pixels[offset + 2] > pixels[offset] * 1.35 && pixels[offset + 2] > pixels[offset + 1] * 1.15;
  for (let y = 0; y < Math.min(4, image.height); y += 1) for (let x = 0; x < image.width; x += 1) if (blue((y * image.width + x) * 4)) count += 1;
  for (let x = Math.max(0, image.width - 4); x < image.width; x += 1) for (let y = 0; y < image.height; y += 1) if (blue((y * image.width + x) * 4)) count += 1;
  return count;
}

const goldenDrawingContract = {
  '001': { dimensions: ['1227', '1265', '1285', '20', '613.5', '613.5'], fields: ['1.01', '2.01'] },
  '002': { dimensions: ['1227', '1265', '1285', '20', '613.5', '613.5'], fields: ['1.01', '2.01'] },
  '003': { dimensions: ['1227', '1265', '1285', '20', '613.5', '613.5'], fields: ['1.01', '2.01'] },
  '004': { dimensions: ['552', '1265', '1285', '20'], fields: ['1.01'], daylight: ['± 370 x 1083'] },
  '005': { dimensions: ['1790', '1190', '1210', '20', '605.3', '579.3', '605.3'], fields: ['1.01', '2.01', '3.01'], daylight: ['± 435 x 1008', '± 518 x 1106'] },
  '006': { dimensions: ['1790', '1190', '1210', '20', '605.3', '579.3', '605.3'], fields: ['1.01', '2.01', '3.01'], daylight: ['± 435 x 1008', '± 518 x 1106'] },
  '008': { dimensions: ['1227', '1190', '1210', '20', '613.5', '613.5'], fields: ['1.01', '2.01'] },
  '009': { dimensions: ['665', '1190', '1210', '840', '350', '20', '20'], fields: ['1.01', '2.01'] },
  '010': { dimensions: ['1227', '1190', '1210', '840', '350', '20', '20', '613.5', '613.5'], fields: ['1.01', '2.01', '3.01', '4.01'] },
  '012': { dimensions: ['890', '1190', '1210', '20'], fields: ['1.01'] },
};

const occurrences = (values) => values.reduce((counts, value) => counts.set(value, (counts.get(value) || 0) + 1), new Map());
function assertContainsOccurrences(actual, expected, message) {
  const actualCounts = occurrences(actual);
  for (const [value, count] of occurrences(expected)) assert.equal((actualCounts.get(value) || 0) >= count, true, `${message}: expected ${count} occurrence(s) of ${value}, got ${actualCounts.get(value) || 0}`);
}

function textObjectBounds(block) {
  const [a = 0, b = 0, c = 0, d = 0, x = block.boundingBox.x, y = block.boundingBox.y] = block.transform || [];
  if (Math.abs(b) > Math.abs(a)) return { x: x + Math.min(0, c), y: y + Math.min(0, b), width: Math.max(Math.abs(c), block.boundingBox.height), height: block.boundingBox.width };
  const height = Math.max(Math.abs(d), block.boundingBox.height);
  return { x, y: y - height * 0.24, width: block.boundingBox.width, height: height * 1.24 };
}

function inkPixels(canvas, box) {
  const left = Math.max(0, Math.floor(box.x)); const top = Math.max(0, Math.floor(box.y)); const right = Math.min(canvas.width, Math.ceil(box.x + box.width)); const bottom = Math.min(canvas.height, Math.ceil(box.y + box.height));
  if (right <= left || bottom <= top) return 0;
  const pixels = canvas.getContext('2d').getImageData(left, top, right - left, bottom - top).data; let ink = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3] && pixels[offset] < 210 && pixels[offset + 1] < 210 && pixels[offset + 2] < 210) ink += 1;
  return ink;
}

async function imageCanvas(filename) {
  const image = await loadImage(filename); const canvas = createCanvas(image.width, image.height); canvas.getContext('2d').drawImage(image, 0, 0); return canvas;
}

test('EkoOkna document currency follows explicit source evidence, not the supplier default', () => {
  const document = (texts) => ({ pages: [{ pageNumber: 1, blocks: texts.map((text, index) => ({ id: `block-${index}`, text })) }] });
  assert.deepEqual(detectPdfDocumentCurrency(document(['Price', '436,31 €', 'Total 5 989,85 EUR'])), { currency: 'EUR', evidence: { GBP: 0, EUR: 2 } });
  assert.deepEqual(detectPdfDocumentCurrency(document(['Price', '£ 436.31', 'Payment threshold 400/600 GBP'])), { currency: 'GBP', evidence: { GBP: 2, EUR: 0 } });
  assert.equal(detectPdfDocumentCurrency(document(['Price', '£ 436.31', 'Reference total 436,31 €'])).currency, null);
  assert.equal(detectPdfDocumentCurrency(document(['Price', '436.31'])).currency, null);
});

test('EkoOkna aliases resolve only through one configured canonical supplier', () => {
  const aliases = ['EkoOkna', 'EKO-OKNA', 'Eko-Okna', 'EKO OKNA'];
  assert.equal(new Set(aliases.map(normalizeSupplierIdentity)).size, 1);
  const resolved = resolveCanonicalSupplier({ recognizedSupplierName: 'EKO-OKNA', storedSupplierCode: 'DOC-EKO', storedSupplierName: 'EkoOkna', configuredSuppliers: [{ supplierCode: 'EKO', supplierName: 'Eko-Okna' }] });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.supplier.supplierCode, 'EKO');
  assert.equal(resolved.method, 'normalized_supplier_name');
  const missing = resolveCanonicalSupplier({ recognizedSupplierName: 'EKO-OKNA', storedSupplierCode: 'DOC-EKO', storedSupplierName: 'EkoOkna', configuredSuppliers: [] });
  assert.equal(missing.status, 'not_configured');
  const ambiguous = resolveCanonicalSupplier({ recognizedSupplierName: 'EKO-OKNA', storedSupplierName: 'EkoOkna', configuredSuppliers: [{ supplierCode: 'EKO-A', supplierName: 'EkoOkna' }, { supplierCode: 'EKO-B', supplierName: 'EKO OKNA' }] });
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.supplier, null);
});

test('EkoOkna position 001 retains rich source specification and strong canonical mappings', async () => {
  const document = await extractSupplierDocument(sourceFile, { id: 'source', sessionId: 'fixture', mediaType: 'application/pdf' });
  const rows = parseCommercialFields(document, { currency: 'GBP' }).rows;
  assert.equal(rows.length, 12);
  const position = rows[0];
  const evidence = position.manufacturerEvidence;
  const specification = evidence.sourceSpecification;
  const canonical = specification.canonical;
  assert.deepEqual(evidence.customerSafeSpecification, []);
  const field = (section, label) => specification.sections.find((item) => item.name === section)?.fields.find((item) => item.label === label);
  assert.deepEqual({ reference: position.displayReference, productSystem: evidence.productSystem, width: position.widthMm, height: position.heightMm, quantity: position.quantity, price: position.unitPrice, currency: position.currency }, { reference: '001', productSystem: 'Aluplast Nord-Line', width: 1227, height: 1265, quantity: 1, price: '436.31', currency: 'GBP' });
  assert.equal(specification.version, 'manufacturer-source-specification-v1');
  assert.equal(specification.supplierInterpretation, 'eko_okna_winpro_specification_v1');
  assert.equal(specification.sourceAttachmentId, 'source');
  assert.deepEqual(specification.sourcePages, [2]);
  assert.equal(specification.fieldCount >= 55, true);
  assert.deepEqual(specification.sections.map((section) => section.name), ['Outer frame', 'Peripheral profile', 'Transom', 'Glazing', 'Sash 1', 'Sash 2', 'Messages', 'Performance', 'Accessories', 'Glazing used', 'Commercial']);
  assert.equal(field('Outer frame', 'Profile').rawValue, '140090 frame Nord-Line');
  assert.equal(field('Outer frame', 'Outside colour').rawValue, '1-side ext. AP060 / Anthracite Grey Sand Structure');
  assert.equal(field('Outer frame', 'Inside colour').rawValue, 'White with black gasket');
  assert.equal(field('Outer frame', 'Wall configuration').rawValue, 'Standard');
  assert.equal(field('Outer frame', 'Veneer code for frame').rawValue, 'HS 436-7003');
  assert.equal(field('Outer frame', 'Veneer code for sash').rawValue, 'HS 436-7003');
  assert.equal(field('Outer frame', 'Drainage').rawValue, 'DRAINAGE STD (visible, at front)');
  assert.equal(field('Outer frame', 'Frame decompression').rawValue, 'No');
  assert.equal(field('Outer frame', 'Weld type').rawValue, 'V-Super');
  assert.equal(field('Peripheral profile', 'Profile').rawValue, 'Below: 120106 Windowsill profile 20 x 13 mm');
  assert.equal(field('Transom', 'Profile').rawValue, '140099 114 mm - Vertical');
  assert.equal(field('Glazing', 'Glazing required').rawValue, '4th/14Ar/4/14Ar/4th [Ug=0.6] Rw=32dB (40mm)');
  assert.equal(field('Glazing', 'Glazing bead').rawValue, 'QUBE- LINE Glazing bead');
  assert.equal(field('Sash 1', 'Profile').rawValue, '140093 STRAIGHT Sash NOT FLUSHED 60mm');
  assert.equal(field('Sash 1', 'Fitting').rawValue, 'Side Hung - Turn');
  assert.equal(field('Sash 1', 'Hardware type').rawValue, 'Standard');
  assert.equal(field('Sash 1', 'Security class').rawValue, 'Standard');
  assert.equal(field('Sash 1', 'Closing type').rawValue, 'Handle');
  assert.equal(field('Sash 1', 'Opening lock').rawValue, 'Storm lock with 1 gasket');
  assert.equal(field('Sash 2', 'Profile').rawValue, 'Fix in frame');
  assert.equal(field('Performance', 'Thermal coefficient').rawValue, 'Uw = 0,98 W/m²·K');
  assert.equal(field('Performance', 'Unit weight').rawValue, '68 Kg');
  assert.equal(field('Performance', 'Perimeter').rawValue, '5 m');
  assert.equal(field('Commercial', 'Window price').rawValue, '436,31 £');
  assert.deepEqual(canonical.externalFinish, { role: 'outside', value: 'Anthracite Grey Sand Structure', manufacturerCode: 'AP060', manufacturerSourceValue: '1-side ext. AP060 / Anthracite Grey Sand Structure', sourceFieldId: field('Outer frame', 'Outside colour').id });
  assert.equal(canonical.internalFinish.value, 'White with black gasket');
  assert.equal(canonical.frameProfile.value, '140090 frame Nord-Line');
  assert.equal(canonical.frameVeneerCode.value, 'HS 436-7003');
  assert.equal(canonical.sashVeneerCode.value, 'HS 436-7003');
  assert.equal(canonical.drainage.value, 'DRAINAGE STD (visible, at front)');
  assert.equal(canonical.frameDecompression.value, 'No');
  assert.equal(canonical.weldType.value, 'V-Super');
  assert.equal(canonical.peripheralProfiles[0].value, '120106 Windowsill profile 20 x 13 mm');
  assert.equal(canonical.glazingBead.value, 'QUBE-LINE Glazing bead');
  assert.deepEqual(canonical.sashes.map((sash) => [sash.sourceElementReference, sash.fitting ?? sash.profile]), [['1.01', 'Side Hung - Turn'], ['2.01', 'Fix in frame']]);
  assert.deepEqual(canonical.glazingUnits.map((pane) => ({ reference: pane.sourceElementReference, ug: pane.ug, rw: pane.acousticRw, thickness: pane.thicknessMm, warmEdge: pane.warmEdge, solar: pane.solarGainPercent, light: pane.lightTransmissionPercent, dimensions: pane.dimensions })), [
    { reference: '1.01', ug: '0.6', rw: '32dB', thickness: 40, warmEdge: 'Warm edge: SWISSPACER ULTIMATE black (9005)', solar: '54', light: '74', dimensions: '469 x 1109' },
    { reference: '2.01', ug: '0.6', rw: '32dB', thickness: 40, warmEdge: 'Warm edge: SWISSPACER ULTIMATE black (9005)', solar: '54', light: '74', dimensions: '563 x 1203' },
  ]);
  assert.equal(canonical.weightKg.value, '68');
  assert.equal(canonical.perimeterMetres.value, '5');
  assert.equal(canonical.sourcePrice.value, '436.31');
  assert.equal(canonical.sourcePrice.currency, 'GBP');
  assert.equal(canonical.accessories.length, 3);
  assert.equal(canonical.messages.some((message) => /warm spacer/i.test(message.value)), true);
  const internal = evidence.internalSpecification;
  assert.equal(internal.version, 'manufacturer-internal-position-specification-v1');
  assert.equal(internal.audience, 'internal');
  assert.equal(internal.itemCount >= 40, true);
  assert.deepEqual(internal.groups.map((group) => group.label), ['Product', 'Dimensions', 'Opening / configuration', 'Finishes', 'Frame / profiles', 'Glazing', 'Hardware / fittings', 'Thermal', 'Accessories', 'Manufacturer notes / warnings']);
  const internalItem = (group, label) => internal.groups.find((item) => item.label === group)?.items.find((item) => item.label === label)?.value;
  assert.equal(internalItem('Product', 'System'), 'Aluplast Nord-Line');
  assert.equal(internalItem('Dimensions', 'Overall'), '1227 × 1265 mm');
  assert.equal(internalItem('Finishes', 'Outside'), '1-side ext. AP060 / Anthracite Grey Sand Structure');
  assert.equal(internalItem('Finishes', 'Inside'), 'White with black gasket');
  assert.equal(internalItem('Frame / profiles', 'Weld'), 'V-Super');
  assert.match(internalItem('Glazing', '1.01'), /4th\/14Ar\/4\/14Ar\/4th.*Ug 0\.6.*Rw 32dB.*40 mm.*SWISSPACER ULTIMATE black.*Solar gain 54%.*Light transmission 74%/);
  assert.match(internalItem('Hardware / fittings', '1.01'), /Side Hung - Turn.*Standard.*Handle.*Storm lock with 1 gasket/);
});

test('all 12 EkoOkna positions retain structured variable-shape evidence', async () => {
  const document = await extractSupplierDocument(sourceFile, { id: 'source', sessionId: 'fixture', mediaType: 'application/pdf' });
  const rows = parseCommercialFields(document, { currency: 'GBP' }).rows;
  assert.equal(rows.length, 12);
  assert.equal(rows.every((row) => row.manufacturerEvidence.sourceSpecification.fieldCount >= 40), true);
  assert.equal(rows.every((row) => row.manufacturerEvidence.sourceSpecification.sections.some((section) => section.name === 'Outer frame')), true);
  assert.equal(rows.every((row) => row.manufacturerEvidence.sourceSpecification.sections.some((section) => section.name === 'Glazing')), true);
  assert.equal(rows.every((row) => row.manufacturerEvidence.sourceSpecification.sections.some((section) => section.name === 'Performance')), true);
  assert.equal(rows.every((row) => row.manufacturerEvidence.canonicalSpecification.externalFinish.manufacturerCode === 'AP060'), true);
  assert.deepEqual(rows.map((row) => row.manufacturerEvidence.canonicalSpecification.sashes.length), [2, 2, 2, 1, 3, 3, 3, 2, 2, 4, 3, 1]);
  assert.deepEqual(rows.map((row) => row.manufacturerEvidence.weightKg), ['68', '68', '73.4', '34.5', '96.5', '96.5', '101.2', '69.7', '36.8', '67.4', '85.7', '41.9']);
  assert.deepEqual(rows.map((row) => row.manufacturerEvidence.sourceSpecification.sourcePages), [[2], [3], [4, 5], [5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 19], [20]]);
  assert.deepEqual(rows.map((row) => row.manufacturerEvidence.canonicalSpecification.sourcePrice.value), rows.map((row) => row.unitPrice));
  assert.equal(rows.every((row) => row.manufacturerEvidence.internalSpecification.audience === 'internal'), true);
  assert.equal(rows.every((row) => row.manufacturerEvidence.internalSpecification.itemCount >= 30), true);
  assert.deepEqual(rows.map((row) => row.manufacturerEvidence.customerSafeSpecification), Array.from({ length: 12 }, () => []));
});

test('production PDF.js resources use loadable Node filesystem paths', async () => {
  const audit = await auditPdfJsRuntimeResources();
  assert.equal(audit.version, PDFJS_RUNTIME_VERSION);
  assert.equal(audit.ready, true);
  assert.equal(audit.configuration.standardFontDataUrl.startsWith('file:'), false);
  assert.equal(audit.configuration.cMapUrl.startsWith('file:'), false);
  assert.equal(audit.configuration.wasmUrl.startsWith('file:'), false);
  assert.equal(audit.configuration.cMapPacked, true);
  assert.equal(audit.configuration.disableFontFace, true);
  assert.equal(audit.configuration.useSystemFonts, false);
  assert.equal(audit.standardFonts.requiredForEkoControl.every((item) => item.available && item.bytes > 0), true);
  assert.equal(audit.cMaps.fileCount > 100, true);
  assert.equal(audit.wasm.files.includes('openjpeg.wasm'), true);
});

test('an unproven PDF panel remains review_required instead of becoming a Products preview', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-eko-review-preview-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const visual = { kind: 'manufacturer_document_region', role: 'combined_source', primary: true, primaryUse: 'products_supply', status: 'unavailable', sourceFormat: 'pdf', sourcePage: 6, boundingRegion: { x: 10, y: 10, width: 100, height: 100 }, mappingReviewStatus: 'review_required' };
  const row = { manufacturerEvidence: { sourceVisuals: [visual], sourceVisual: visual }, sourceVisual: visual };
  const result = await derivePdfPositionPreviews({ filename: sourceFile, attachment: { id: 'source', media_type: 'application/pdf', sha256: sourceSha256 }, document: { pages: [{ pageNumber: 6, width: 595, height: 842 }] }, rows: [row], visualRoot: root });
  assert.deepEqual({ eligible: result.eligible, rendered: result.rendered, unavailable: result.unavailable }, { eligible: 0, rendered: 0, unavailable: 1 });
  assert.match(result.warnings.join(' '), /review_required.*deterministic position ownership was not proven/i);
  assert.equal(row.manufacturerEvidence.sourceVisual.status, 'unavailable');
});

test('EkoOkna source regions render as bounded, deterministic browser-safe PNG derivatives', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-eko-previews-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const attachment = { id: 'source', media_type: 'application/pdf', sha256: sourceSha256 };
  const extract = async () => {
    const document = await extractSupplierDocument(sourceFile, { id: attachment.id, sessionId: 'fixture', mediaType: attachment.media_type });
    return { document, rows: parseCommercialFields(document, { currency: 'EUR' }).rows };
  };
  const first = await extract();
  assert.deepEqual(first.rows.map((row) => row.displayReference), Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(3, '0')));
  assert.deepEqual(first.rows.map((row) => row.manufacturerEvidence.sourceVisual.sourcePage), expectedPages);
  const rendered = await derivePdfPositionPreviews({ filename: sourceFile, attachment, document: first.document, rows: first.rows, visualRoot: root });
  assert.deepEqual({ eligible: rendered.eligible, rendered: rendered.rendered, cached: rendered.cached, unavailable: rendered.unavailable }, { eligible: 36, rendered: 36, cached: 0, unavailable: 0 });
  assert.equal(new Set(first.rows.map((row) => row.manufacturerEvidence.sourceVisual.url)).size, 12);
  for (const row of first.rows) {
    const visual = row.manufacturerEvidence.sourceVisual;
    assert.equal(visual.role, 'inside');
    assert.equal(visual.primary, true);
    assert.equal(visual.primaryUse, 'products_supply');
    assert.equal(visual.status, 'available');
    assert.equal(visual.originalAsset.mediaType, 'application/pdf');
    assert.equal(visual.originalAsset.sha256, sourceSha256);
    assert.equal(visual.renderedDerivative.mediaType, 'image/png');
    assert.match(visual.url, /^\/api\/manufacturer-position-visuals\/[a-f0-9]{40}\/quotation\.png$/);
    assert.equal(JSON.stringify(visual).includes(process.cwd()), false);
    assert.deepEqual(row.manufacturerEvidence.sourceVisuals.map((item) => item.role), ['inside', 'outside', 'combined_source']);
    assert.equal(row.manufacturerEvidence.sourceVisuals.every((item) => item.status === 'available'), true);
    assert.equal(row.manufacturerEvidence.sourceVisuals.every((item) => item.originalAsset.sha256 === sourceSha256), true);
    assert.equal(row.manufacturerEvidence.sourceSpecification.sourceAttachmentHash, sourceSha256);
    const [inside, outside, combined] = row.manufacturerEvidence.sourceVisuals;
    assert.equal(inside.boundingRegion.y >= outside.boundingRegion.y + outside.boundingRegion.height - 10, true);
    assert.equal(outside.boundingRegion.y + outside.boundingRegion.height <= inside.boundingRegion.y, true);
    assert.equal(combined.boundingRegion.height > inside.boundingRegion.height + outside.boundingRegion.height - 15, true);
    assert.equal(inside.renderedDerivative.widthPx >= 250, true);
    assert.equal(inside.renderedDerivative.heightPx >= 300, true);
    assert.equal(inside.mappingMethod, 'eko_winpro_inside_drawing_panel_geometry_v2');
    assert.equal(inside.renderedDerivative.renderVersion, PDF_POSITION_PREVIEW_VERSION);
    assert.equal(inside.mappingConfidence, 'strong');
    assert.equal(inside.mappingReviewStatus, 'mapped_automatic');
    assert.equal(inside.geometryEvidence.specificationTableBoundary.vectorBoundaryX > inside.boundingRegion.x + inside.boundingRegion.width, true);
    assert.equal(inside.geometryEvidence.cropExclusion.rightBeforeTableX < inside.geometryEvidence.specificationTableBoundary.vectorBoundaryX, true);
    assert.equal(inside.geometryEvidence.drawingObjectClasses.includes('dimension_text'), true);
    assert.equal(inside.geometryEvidence.drawingObjectClasses.includes('frame_sash_or_opening_geometry'), true);
    assert.equal(inside.geometryEvidence.specificationTableTopBoundary.paths.length > 0, true);
    for (const tablePath of inside.geometryEvidence.specificationTableTopBoundary.paths) {
      const halfStroke = tablePath.lineWidth / 2;
      assert.equal(tablePath.bounds.y - halfStroke > inside.boundingRegion.y + inside.boundingRegion.height, true, `${row.displayReference} table path ${tablePath.id} must be outside the final Inside derivative`);
    }
    assert.equal(await blueEdgePixels(previewFilename(root, inside)), 0, `${row.displayReference} must not contain the blue specification-table boundary at its top/right crop edges`);
  }
  for (const [reference, contract] of Object.entries(goldenDrawingContract)) {
    const geometry = first.rows.find((row) => row.displayReference === reference).manufacturerEvidence.sourceVisual.geometryEvidence;
    assertContainsOccurrences(geometry.detectedDimensionRuns, contract.dimensions, `${reference} dimensions`);
    assertContainsOccurrences(geometry.detectedSashLabels, contract.fields, `${reference} field references`);
    assert.equal(geometry.detectedDaylightLabels.length > 0, true, `${reference} must retain source daylight annotations`);
    if (contract.daylight) assertContainsOccurrences(geometry.detectedDaylightLabels, contract.daylight, `${reference} daylight annotations`);
  }
  for (const reference of ['005', '006']) {
    const inside = first.rows.find((row) => row.displayReference === reference).manufacturerEvidence.sourceVisual;
    assert.equal(inside.boundingRegion.y > 590, true, `${reference} must use its position-specific view separator rather than the old fixed page split`);
    assert.equal(inside.boundingRegion.height < 190, true, `${reference} Inside crop must not include the Outside elevation`);
    assert.deepEqual(inside.geometryEvidence.rightDimensionLabels, ['1190', '1210']);
    assert.deepEqual(inside.geometryEvidence.lowerDimensionLabels, ['20', '605.3', '579.3', '605.3']);
    assert.deepEqual(new Set(inside.geometryEvidence.detectedSashLabels), new Set(['1.01', '2.01', '3.01']));
    assert.equal(inside.geometryEvidence.overallWidthLabel, '1790');
  }
  const position001 = first.rows.find((row) => row.displayReference === '001').manufacturerEvidence.sourceVisual;
  assert.deepEqual(position001.geometryEvidence.rightDimensionLabels, ['1265', '1285']);
  assert.deepEqual(position001.geometryEvidence.lowerDimensionLabels, ['20', '613.5', '613.5']);
  const position010 = first.rows.find((row) => row.displayReference === '010').manufacturerEvidence.sourceVisual;
  assert.deepEqual(new Set(position010.geometryEvidence.detectedSashLabels), new Set(['1.01', '2.01', '3.01', '4.01']));
  assert.equal(first.rows.every((row) => row.manufacturerEvidence.sourceVisual.geometryEvidence.confidence === 'strong'), true);
  for (const row of first.rows) {
    const inside = row.manufacturerEvidence.sourceVisual; const layout = first.document.pages.find((page) => page.pageNumber === inside.sourcePage); const raster = await imageCanvas(previewFilename(root, inside)); const scale = raster.width / inside.boundingRegion.width; const geometry = inside.geometryEvidence; const requiredText = [...geometry.detectedDimensionRuns, ...geometry.detectedSashLabels, ...geometry.detectedDaylightLabels]; const candidates = layout.blocks.filter((block) => requiredText.includes(block.text) && block.boundingBox.y >= inside.boundingRegion.y && block.boundingBox.y <= inside.boundingRegion.y + inside.boundingRegion.height); const used = new Set();
    for (const value of requiredText) {
      const run = candidates.find((item) => item.text === value && !used.has(item.id)); assert.ok(run, `${row.displayReference} ${value} must have an owned source text object`); used.add(run.id); const bounds = textObjectBounds(run); const cropBox = { x: (bounds.x - inside.boundingRegion.x) * scale, y: (inside.boundingRegion.y + inside.boundingRegion.height - bounds.y - bounds.height) * scale, width: bounds.width * scale, height: bounds.height * scale };
      assert.equal(inkPixels(raster, cropBox) > 3, true, `${row.displayReference} ${value} must visibly render in the final Inside derivative`);
    }
  }

  const position005Row = first.rows.find((row) => row.displayReference === '005'); const inside005 = position005Row.manufacturerEvidence.sourceVisual; const page6Layout = first.document.pages.find((page) => page.pageNumber === 6);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs'); const source = new Uint8Array(await fs.readFile(sourceFile)); const loadingTask = getDocument(pdfJsRuntimeOptions({ data: source }));
  try {
    const pdf = await loadingTask.promise; const page = await pdf.getPage(6); const viewport = page.getViewport({ scale: 2 }); const fullPage = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); const fullContext = fullPage.getContext('2d'); fullContext.fillStyle = '#fff'; fullContext.fillRect(0, 0, fullPage.width, fullPage.height); await page.render({ canvas: fullPage, canvasContext: fullContext, viewport, annotationMode: 0 }).promise;
    const cropped = await imageCanvas(previewFilename(root, inside005)); const cropScale = cropped.width / inside005.boundingRegion.width; const fullScale = fullPage.width / page6Layout.width; const required = ['1790', '1190', '1210', '605.3', '579.3', '605.3']; const candidates = page6Layout.blocks.filter((block) => required.includes(block.text) && block.boundingBox.y >= inside005.boundingRegion.y && block.boundingBox.y <= inside005.boundingRegion.y + inside005.boundingRegion.height); const used = new Set();
    for (const value of required) {
      const run = candidates.find((item) => item.text === value && !used.has(item.id)); assert.ok(run, `${value} must be extracted from page 6`); used.add(run.id); assert.match(run.fontName, /_f2$/); const bounds = textObjectBounds(run);
      assert.equal(bounds.x >= inside005.boundingRegion.x && bounds.y >= inside005.boundingRegion.y && bounds.x + bounds.width <= inside005.boundingRegion.x + inside005.boundingRegion.width && bounds.y + bounds.height <= inside005.boundingRegion.y + inside005.boundingRegion.height, true, `${value} must be owned by the final Inside region`);
      const fullBox = { x: bounds.x * fullScale, y: (page6Layout.height - bounds.y - bounds.height) * fullScale, width: bounds.width * fullScale, height: bounds.height * fullScale }; const cropBox = { x: (bounds.x - inside005.boundingRegion.x) * cropScale, y: (inside005.boundingRegion.y + inside005.boundingRegion.height - bounds.y - bounds.height) * cropScale, width: bounds.width * cropScale, height: bounds.height * cropScale };
      assert.equal(inkPixels(fullPage, fullBox) > 10, true, `${value} must produce glyph pixels in the full-page production raster`);
      assert.equal(inkPixels(cropped, cropBox) > 10, true, `${value} must retain glyph pixels after crop/compositing`);
    }
    page.cleanup();
  } finally { await loadingTask.destroy(); }
  const second = await extract();
  const cached = await derivePdfPositionPreviews({ filename: sourceFile, attachment, document: second.document, rows: second.rows, visualRoot: root });
  assert.deepEqual({ eligible: cached.eligible, rendered: cached.rendered, cached: cached.cached, unavailable: cached.unavailable }, { eligible: 36, rendered: 0, cached: 36, unavailable: 0 });
  const cached005 = second.rows.find((row) => row.displayReference === '005').manufacturerEvidence.sourceVisual;
  assert.equal(cached005.renderedDerivative.cached, true);
  assert.equal(await fs.readFile(previewFilename(root, cached005)).then((bytes) => createHash('sha256').update(bytes).digest('hex')), await fs.readFile(previewFilename(root, inside005)).then((bytes) => createHash('sha256').update(bytes).digest('hex')));
});

async function setupFixture(t, { configureSupplier, automaticPending = false }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-eko-import-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','TEST-CLIENT','EKO IMPORT TEST',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','TEST-EKO-IMPORT','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  if (configureSupplier) await calculator.saveSupplierCommercialDefault({ supplierCode: 'EKO', supplierName: 'EKO-OKNA', policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price', quotedCurrency: 'EUR', paidInQuotedCurrency: true, settlementCurrency: 'EUR', discountPolicy: { type: 'net', thresholdBasis: 'manufacturer_list_gbp_before_discounts', stages: [], bands: [] } }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'EkoOkna acceptance', currency: 'GBP', packageCode: 'supply_only' });
  const storedSource = path.join(root, 'source.pdf');
  await fs.copyFile(sourceFile, storedSource);
  const bytes = await fs.readFile(storedSource);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sourceSha256);
  const supplier = createSupplierQuotesService(db, { attachmentRoot: root, fileSupplierAttachments: false });
  const quote = await supplier.createQuote('estimate', automaticPending ? { supplierCode: 'AUTO-EKO-ANALYSIS', supplierName: 'Automatic identification pending' } : { supplierCode: 'DOC-EKO', supplierName: 'EkoOkna' });
  const revision = await supplier.createRevision('estimate', quote.id, automaticPending ? { supplierQuotationNumber: '', fullQuotationReference: 'Analysis pending', currency: 'XXX' } : { supplierQuotationNumber: '2263569', currency: 'EUR' });
  await supplier.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'Kosztorys - OF_25_2263569.pdf', mediaType: 'application/pdf', sizeBytes: bytes.length, sha256: sourceSha256, storageKey: 'source.pdf', parserEligible: true, createdAt: '2026-08-28T00:00:00.000Z' }]);
  return { db, root, calculator, scenario, supplier, quote, revision, selection: [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }] };
}

async function confirmFixture(fixture) {
  const review = await fixture.supplier.prepareImportReview('estimate', fixture.selection);
  const selectedRowKeys = review.documents[0].rows.map((row) => row.rowKey);
  await fixture.supplier.extractAndLoadSupplierCosts('estimate', fixture.scenario.id, fixture.selection, { selectedRowKeys, supplierCode: 'EKO', metadata: { quotationNumber: 'OF/25/2263569', revision: '', currency: 'GBP' } });
}

async function downgradeManufacturerEvidence(fixture) {
  const rows = await fixture.db.all('SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id);
  for (const row of rows) {
    const snapshot = JSON.parse(row.source_snapshot_json);
    const evidence = snapshot.manufacturerEvidence;
    delete evidence.sourceSpecification;
    delete evidence.canonicalSpecification;
    delete evidence.internalSpecification;
    delete evidence.sourceVisuals;
    delete evidence.evidenceRefresh;
    evidence.configurationDescription = null;
    evidence.weightKg = null;
    evidence.fittingsSpecification = null;
    if (evidence.sourceVisual) {
      evidence.sourceVisual = { ...evidence.sourceVisual, role: undefined, primary: undefined, primaryUse: undefined, renderedDerivative: { ...evidence.sourceVisual.renderedDerivative, renderVersion: 'pdf-position-region-v1' }, renderParameters: { ...evidence.sourceVisual.renderParameters, renderVersion: 'pdf-position-region-v1' } };
    }
    await fixture.db.run('UPDATE project_calculator_estimate_product_rows SET source_snapshot_json=? WHERE id=?', JSON.stringify(snapshot), row.id);
  }
}

const tableSnapshot = async (db, sql, ...parameters) => JSON.stringify(await db.all(sql, ...parameters));

test('missing canonical EkoOkna supplier stops before commercial mutation with truthful diagnostics', async (t) => {
  const fixture = await setupFixture(t, { configureSupplier: false });
  const review = await fixture.supplier.prepareImportReview('estimate', fixture.selection);
  assert.equal(review.positionCount, 12);
  assert.equal(review.metadata.recognizedSupplierName, 'EKO-OKNA');
  assert.equal(review.metadata.recognizedManufacturerName, 'EKO-OKNA');
  assert.equal(review.metadata.supplierResolutionStatus, 'not_configured');
  assert.equal(review.metadata.supplierCode, null);
  assert.equal(review.documents[0].diagnostics.status, 'canonical_supplier_required');
  const selectedRowKeys = review.documents[0].rows.map((row) => row.rowKey);
  await assert.rejects(fixture.supplier.extractAndLoadSupplierCosts('estimate', fixture.scenario.id, fixture.selection, { selectedRowKeys, metadata: { quotationNumber: 'OF/25/2263569', revision: '', currency: 'GBP' } }), (error) => error.code === 'commercial_supplier_required');
  assert.equal(await count(fixture.db, 'supplier_quote_import_runs'), 0);
  assert.equal(await count(fixture.db, 'supplier_quote_import_operations'), 0);
  assert.equal(await count(fixture.db, 'supplier_quote_positions'), 0);
  assert.equal(await count(fixture.db, 'project_calculator_estimate_product_rows'), 0);
});

test('automatic-first EkoOkna evidence identifies, confirms and imports 12/12/12 without duplicate upload', async (t) => {
  const fixture = await setupFixture(t, { configureSupplier: true, automaticPending: true });
  const review = await fixture.supplier.prepareImportReview('estimate', fixture.selection);
  assert.equal(review.positionCount, 12);
  assert.equal(review.metadata.supplierResolutionStatus, 'resolved');
  assert.equal(review.metadata.supplierResolutionMethod, 'normalized_supplier_name');
  assert.equal(review.metadata.supplierCode, 'EKO');
  assert.equal(review.metadata.currency, 'GBP');
  assert.equal(review.metadata.quotationNumber, 'OF/25/2263569');
  assert.equal(review.metadata.quotationDate, '2025-11-18');
  assert.equal(review.metadata.documentType, 'complete_quotation');
  assert.equal(review.metadata.supplierQuotedSubtotal, '5989.85');
  assert.equal(review.metadata.supplierQuotedTotal, '5989.85');
  assert.equal((await fixture.supplier.listAttachments('estimate', fixture.quote.id, fixture.revision.id)).length, 1);
  assert.equal(review.documents[0].diagnostics.status, 'ready_to_confirm');
  assert.equal(review.documents[0].rows.filter((row) => row.include).length, 12);
  assert.equal(review.documents[0].rows.filter((row) => row.sourceVisual.status === 'available').length, 12);
  assert.equal(review.documents[0].rows.every((row) => row.sourceVisual.role === 'inside'), true);
  assert.equal(review.documents[0].rows.every((row) => row.sourceVisuals.map((visual) => visual.role).join(',') === 'inside,outside,combined_source'), true);
  assert.equal(review.documents[0].rows.every((row) => row.sourceSpecification.fieldCount >= 40), true);
  const selectedRowKeys = review.documents[0].rows.map((row) => row.rowKey);
  const confirmation = { selectedRowKeys, supplierCode: 'EKO', metadata: { quotationNumber: 'OF/25/2263569', revision: '', quotationDate: '2025-11-18', currency: 'GBP', documentType: 'complete_quotation' } };
  const first = await fixture.supplier.extractAndLoadSupplierCosts('estimate', fixture.scenario.id, fixture.selection, confirmation);
  const counts = first.documents[0].diagnostics.counts;
  assert.deepEqual([counts.parsedPositions, counts.selectedPositions, counts.validCanonicalPositions, counts.persistedPositions, counts.productsSupplyRows, counts.projectCostingRows], [12, 12, 12, 12, 12, 12]);
  assert.equal(first.operationStatus, 'confirmed');
  assert.equal(await count(fixture.db, 'supplier_quote_positions', 'revision_id=?', fixture.revision.id), 12);
  assert.equal(await count(fixture.db, 'project_calculator_estimate_product_rows', 'scenario_id=? AND source_revision_id=?', fixture.scenario.id, fixture.revision.id), 12);
  assert.equal(await count(fixture.db, 'project_calculator_estimate_product_rows', 'scenario_id=? AND source_revision_id=? AND estimate_position_id IS NOT NULL', fixture.scenario.id, fixture.revision.id), 12);
  assert.equal((await fixture.db.get('SELECT supplier_code FROM supplier_quotes WHERE id=?', fixture.quote.id)).supplier_code, 'EKO');
  assert.equal((await fixture.db.get('SELECT supplier_name FROM supplier_quotes WHERE id=?', fixture.quote.id)).supplier_name, 'EKO-OKNA');
  assert.equal((await fixture.db.get('SELECT quotation_date FROM supplier_quote_revisions WHERE id=?', fixture.revision.id)).quotation_date, '2025-11-18');
  assert.equal((await fixture.db.get('SELECT currency FROM supplier_quote_revisions WHERE id=?', fixture.revision.id)).currency, 'GBP');
  assert.equal((await fixture.db.get('SELECT currency FROM project_calculator_supplier_quote_revisions WHERE revision_id=?', fixture.revision.id)).currency, 'GBP');
  const savedRows = await fixture.db.all('SELECT display_reference,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id);
  assert.deepEqual(savedRows.map((row) => row.display_reference), Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(3, '0')));
  assert.deepEqual(savedRows.map((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceVisual.sourcePage), expectedPages);
  assert.equal(savedRows.every((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceVisual.role === 'inside'), true);
  assert.equal(savedRows.every((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceVisuals.length === 3), true);
  assert.equal(savedRows.every((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceSpecification.version === 'manufacturer-source-specification-v1'), true);
  assert.equal(savedRows.every((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceSpecification.sourceAttachmentHash === sourceSha256), true);
  assert.equal(JSON.parse(savedRows[0].source_snapshot_json).manufacturerEvidence.canonicalSpecification.externalFinish.manufacturerCode, 'AP060');
  assert.equal(savedRows.every((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceVisual.originalAsset.sha256 === sourceSha256), true);
  assert.equal(new Set(savedRows.map((row) => JSON.parse(row.source_snapshot_json).manufacturerEvidence.sourceVisual.url)).size, 12);
  const operation = await fixture.db.get('SELECT status,intended_counts_json,post_state_json,currency_decision_json FROM supplier_quote_import_operations WHERE revision_id=?', fixture.revision.id);
  assert.equal(operation.status, 'confirmed');
  assert.equal(JSON.parse(operation.intended_counts_json).selectedPositions, 12);
  assert.deepEqual(JSON.parse(operation.post_state_json).operationCounts, { persistedPositions: 12, productsSupplyRows: 12, projectCostingRows: 12 });
  assert.equal(JSON.parse(operation.currency_decision_json).sourceCurrency, 'GBP');
  const storedRevision = (await fixture.supplier.listRevisions('estimate', fixture.quote.id)).find((item) => item.id === fixture.revision.id);
  assert.equal(storedRevision.confirmationStatus, 'confirmed');
  assert.equal(storedRevision.confirmationOperationId, `supplier-import-operation-${(await fixture.db.get('SELECT operation_key FROM supplier_quote_import_operations WHERE revision_id=?', fixture.revision.id)).operation_key}`);
  const retry = await fixture.supplier.extractAndLoadSupplierCosts('estimate', fixture.scenario.id, fixture.selection, confirmation);
  assert.equal(retry.documents[0].idempotentReplay, true);
  assert.equal(retry.documents[0].loadedProducts, 0);
  assert.equal(await count(fixture.db, 'supplier_quote_import_runs', 'revision_id=?', fixture.revision.id), 1);
  assert.equal(await count(fixture.db, 'supplier_quote_import_operations', 'revision_id=?', fixture.revision.id), 1);
  assert.equal(await count(fixture.db, 'supplier_quote_positions', 'revision_id=?', fixture.revision.id), 12);
  assert.equal(await count(fixture.db, 'project_calculator_estimate_product_rows', 'source_revision_id=?', fixture.revision.id), 12);
});

test('evidence-only refresh enriches all 12 confirmed positions without commercial, operation, run, costing, price, FX or customer-safe mutation', async (t) => {
  const fixture = await setupFixture(t, { configureSupplier: true });
  await confirmFixture(fixture);
  await downgradeManufacturerEvidence(fixture);
  const before = await fixture.supplier.inspectManufacturerEvidenceRefresh('estimate', fixture.quote.id, fixture.revision.id, 'source');
  assert.deepEqual(before.counts, { confirmedOperations: 1, completedRuns: 1, supplierPositions: 12, productsSupply: 12, projectCostingProducts: 12 });
  assert.equal(before.source.unchanged, true);
  assert.equal(before.evidence.every((item) => item.sourceSpecificationFields === 0), true);
  const protectedBefore = {
    positions: await tableSnapshot(fixture.db, 'SELECT * FROM supplier_quote_positions WHERE revision_id=? ORDER BY source_sequence,rowid', fixture.revision.id),
    estimate: await tableSnapshot(fixture.db, 'SELECT id,positions_json FROM estimates WHERE id=?', 'estimate'),
    costing: await tableSnapshot(fixture.db, 'SELECT id,scenario_id,estimate_position_id,source_position_id,source_attachment_id,source_revision_id,display_reference,product_class,quantity,width_mm,height_mm,total_price_amount,currency,area_square_metres,frame_perimeter_metres,classification,included_in_current_estimate,alternative_to_reference,alternative_to_estimate_position_id,created_at,updated_at FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference,rowid', fixture.revision.id),
    operations: await tableSnapshot(fixture.db, 'SELECT * FROM supplier_quote_import_operations WHERE revision_id=? ORDER BY created_at,id', fixture.revision.id),
    runs: await tableSnapshot(fixture.db, 'SELECT * FROM supplier_quote_import_runs WHERE revision_id=? ORDER BY started_at,id', fixture.revision.id),
    links: await tableSnapshot(fixture.db, 'SELECT * FROM project_calculator_supplier_quote_revisions WHERE revision_id=?', fixture.revision.id),
    fx: await tableSnapshot(fixture.db, 'SELECT * FROM project_calculator_supplier_fx_snapshots WHERE supplier_quote_revision_id=? ORDER BY created_at,id', fixture.revision.id),
    supplierPolicy: await tableSnapshot(fixture.db, "SELECT * FROM supplier_commercial_defaults WHERE supplier_code='EKO'"),
  };
  const guard = { expectedSourceSha256: sourceSha256, expectedCommercialFingerprintHash: before.commercialFingerprintHash, expectedPositionCount: 12, expectedOperationCount: 1, expectedRunCount: 1, expectedCurrency: 'GBP' };
  const result = await fixture.supplier.refreshManufacturerEvidence('estimate', fixture.quote.id, fixture.revision.id, 'source', guard);
  assert.equal(result.status, 'refreshed');
  assert.equal(result.idempotent, false);
  assert.equal(result.updatedPositions, 12);
  assert.deepEqual(result.preCounts, result.postCounts);
  const after = await fixture.supplier.inspectManufacturerEvidenceRefresh('estimate', fixture.quote.id, fixture.revision.id, 'source');
  assert.equal(after.commercialFingerprintHash, before.commercialFingerprintHash);
  assert.deepEqual(after.counts, before.counts);
  assert.equal(after.evidence.every((item) => item.sourceSpecificationFields >= 40 && item.primaryVisualRole === 'inside'), true);
  assert.equal(after.evidence.every((item) => item.internalSpecificationVersion === 'manufacturer-internal-position-specification-v1' && item.internalSpecificationItems >= 30), true);
  assert.equal(after.evidence.every((item) => item.availableVisualRoles.join(',') === 'inside,outside,combined_source'), true);
  assert.equal(after.evidence.every((item) => item.visualMappingMethods.join(',') === 'eko_winpro_inside_drawing_panel_geometry_v2'), true);
  assert.equal(after.evidence.every((item) => item.visualRenderVersions.join(',') === 'pdf-position-region-v5'), true);
  const liveSnapshots = await fixture.db.all('SELECT display_reference,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id);
  const position001 = JSON.parse(liveSnapshots[0].source_snapshot_json).manufacturerEvidence;
  assert.equal(position001.sourceSpecification.fieldCount >= 55, true);
  assert.equal(position001.canonicalSpecification.externalFinish.manufacturerCode, 'AP060');
  assert.equal(position001.canonicalSpecification.internalFinish.value, 'White with black gasket');
  assert.deepEqual(position001.canonicalSpecification.glazingUnits.map((pane) => [pane.sourceElementReference, pane.dimensions]), [['1.01', '469 x 1109'], ['2.01', '563 x 1203']]);
  assert.equal(position001.sourceVisual.role, 'inside');
  assert.deepEqual(position001.sourceVisuals.map((visual) => visual.role), ['inside', 'outside', 'combined_source']);
  assert.deepEqual(position001.customerSafeSpecification, []);
  const protectedAfter = {
    positions: await tableSnapshot(fixture.db, 'SELECT * FROM supplier_quote_positions WHERE revision_id=? ORDER BY source_sequence,rowid', fixture.revision.id),
    estimate: await tableSnapshot(fixture.db, 'SELECT id,positions_json FROM estimates WHERE id=?', 'estimate'),
    costing: await tableSnapshot(fixture.db, 'SELECT id,scenario_id,estimate_position_id,source_position_id,source_attachment_id,source_revision_id,display_reference,product_class,quantity,width_mm,height_mm,total_price_amount,currency,area_square_metres,frame_perimeter_metres,classification,included_in_current_estimate,alternative_to_reference,alternative_to_estimate_position_id,created_at,updated_at FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference,rowid', fixture.revision.id),
    operations: await tableSnapshot(fixture.db, 'SELECT * FROM supplier_quote_import_operations WHERE revision_id=? ORDER BY created_at,id', fixture.revision.id),
    runs: await tableSnapshot(fixture.db, 'SELECT * FROM supplier_quote_import_runs WHERE revision_id=? ORDER BY started_at,id', fixture.revision.id),
    links: await tableSnapshot(fixture.db, 'SELECT * FROM project_calculator_supplier_quote_revisions WHERE revision_id=?', fixture.revision.id),
    fx: await tableSnapshot(fixture.db, 'SELECT * FROM project_calculator_supplier_fx_snapshots WHERE supplier_quote_revision_id=? ORDER BY created_at,id', fixture.revision.id),
    supplierPolicy: await tableSnapshot(fixture.db, "SELECT * FROM supplier_commercial_defaults WHERE supplier_code='EKO'"),
  };
  assert.deepEqual(protectedAfter, protectedBefore);
  const enrichedBeforeReplay = await tableSnapshot(fixture.db, 'SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id);
  const replay = await fixture.supplier.refreshManufacturerEvidence('estimate', fixture.quote.id, fixture.revision.id, 'source', guard);
  assert.equal(replay.status, 'already_current');
  assert.equal(replay.idempotent, true);
  assert.equal(replay.updatedPositions, 0);
  assert.equal(await tableSnapshot(fixture.db, 'SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id), enrichedBeforeReplay);
});

test('evidence-only refresh rolls back all positions on injected failure and refuses a changed commercial fingerprint', async (t) => {
  const fixture = await setupFixture(t, { configureSupplier: true });
  await confirmFixture(fixture);
  await downgradeManufacturerEvidence(fixture);
  const before = await fixture.supplier.inspectManufacturerEvidenceRefresh('estimate', fixture.quote.id, fixture.revision.id, 'source');
  const guard = { expectedSourceSha256: sourceSha256, expectedCommercialFingerprintHash: before.commercialFingerprintHash, expectedPositionCount: 12, expectedOperationCount: 1, expectedRunCount: 1, expectedCurrency: 'GBP' };
  const snapshotsBefore = await tableSnapshot(fixture.db, 'SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id);
  const failing = createSupplierQuotesService(fixture.db, { attachmentRoot: fixture.root, fileSupplierAttachments: false, evidenceRefreshFailureInjector: async (stage, context) => { if (stage === 'after_position_update' && context.index === 5) throw Object.assign(new Error('fixture evidence persistence failure'), { code: 'fixture_evidence_failure' }); } });
  await assert.rejects(failing.refreshManufacturerEvidence('estimate', fixture.quote.id, fixture.revision.id, 'source', guard), /fixture evidence persistence failure/);
  assert.equal(await tableSnapshot(fixture.db, 'SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id), snapshotsBefore);
  assert.equal(await count(fixture.db, 'supplier_quote_import_runs', 'revision_id=?', fixture.revision.id), 1);
  assert.equal(await count(fixture.db, 'supplier_quote_import_operations', 'revision_id=?', fixture.revision.id), 1);
  await fixture.db.run('UPDATE supplier_quote_positions SET total_purchase_price_amount=? WHERE revision_id=? AND display_reference=?', '999.99', fixture.revision.id, '001');
  await assert.rejects(fixture.supplier.refreshManufacturerEvidence('estimate', fixture.quote.id, fixture.revision.id, 'source', guard), (error) => error.code === 'evidence_refresh_fingerprint_mismatch');
  assert.equal(await tableSnapshot(fixture.db, 'SELECT id,source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY display_reference', fixture.revision.id), snapshotsBefore);
});
