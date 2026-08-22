import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { extractSupplierDocument } from '../server/features/supplierImportLab/documentExtraction.js';
import { emfRendererScriptPath, mapManufacturerVisualsToRows } from '../server/features/supplierImportLab/manufacturerPositionVisuals.js';
import { parseCommercialFields } from '../server/features/supplierImportLab/commercialFieldParser.js';

const fixture = path.resolve('docs/Supplier_Quotes/343117-3_EF-EST-2026-004 - Luke.docx');
const mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('real Zyle DOCX maps sequential and grouped references to their same-cell EMFs and renders print PNGs', { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qs-zyle-visual-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const document = await extractSupplierDocument(fixture, { id: 'zyle-343117-3', sessionId: 'fixture', mediaType }, { visualRoot: root });
  const parsed = parseCommercialFields(document, { currency: 'EUR' });
  assert.equal(document.manufacturerVisualCandidates.length, 21); assert.equal(parsed.rows.length, 21);
  for (const [reference, source] of [['W1', 'word/media/image2.emf'], ['W2', 'word/media/image3.emf'], ['W7, W8', 'word/media/image8.emf'], ['W14, W15', 'word/media/image14.emf'], ['Back door', 'word/media/image21.emf'], ['Patio door', 'word/media/image22.emf']]) {
    const row = parsed.rows.find((item: any) => item.displayReference === reference); assert.ok(row); const visual = row.manufacturerEvidence.sourceVisual;
    assert.equal(visual.status, 'available'); assert.equal(visual.mappingReviewStatus, 'mapped_automatic'); assert.equal(visual.sourceMediaObject, source); assert.equal(visual.sourceFormat, 'emf'); assert.match(visual.url, /^\/api\/manufacturer-position-visuals\/[a-f0-9]{40}\/quotation\.png$/); assert.equal(visual.renderedDerivative.dpi, 300); assert.equal(Math.max(visual.renderedDerivative.widthPx, visual.renderedDerivative.heightPx), 2400);
  }
  const first = parsed.rows[0].manufacturerEvidence.sourceVisual; const zip = await JSZip.loadAsync(await readFile(fixture)); const embedded = await zip.file(first.sourceMediaObject)!.async('nodebuffer'); const retained = await readFile(path.join(root, first.originalAsset.storageKey.replace('manufacturer-position-visuals/', ''))); assert.deepEqual(retained, embedded);
  assert.equal(parsed.rows[0].manufacturerEvidence.manufacturerItemNumber, null); assert.equal(parsed.rows[0].manufacturerEvidence.customerReference, 'W1');
  assert.equal(parsed.rows[0].manufacturerEvidence.manufacturerQuotedUg, '0.53'); assert.equal(parsed.rows[0].manufacturerEvidence.manufacturerQuotedUw, '0.89');
});

test('ambiguous reference mapping remains unavailable and requires review', () => {
  const evidence = () => ({ sourceVisual: { kind: 'manufacturer_document_image', status: 'unavailable' } });
  const rows: any[] = [0, 1].map((ordinal) => ({ ordinal, displayReference: 'W1', manufacturerEvidence: evidence(), originalExtractedSnapshot: { manufacturerEvidence: evidence() } }));
  mapManufacturerVisualsToRows(rows, [{ customerReference: 'W1', mappingConfidence: 'strong', mappingMethod: 'docx_same_table_cell_exact_reference', status: 'available', renderedDerivative: { mediaType: 'image/png', url: '/must-not-leak.png' } }]);
  for (const row of rows) { assert.equal(row.manufacturerEvidence.sourceVisual.status, 'unavailable'); assert.equal(row.manufacturerEvidence.sourceVisual.mappingReviewStatus, 'needs_review'); assert.equal(row.manufacturerEvidence.sourceVisual.url, undefined); }
});

test('EMF renderer location is module-relative and independent of the working directory', async () => {
  const original = process.cwd();
  try {
    process.chdir(os.tmpdir());
    await access(emfRendererScriptPath);
    assert.match(emfRendererScriptPath.replaceAll('\\', '/'), /server\/features\/supplierImportLab\/renderEmfToPng\.ps1$/);
  } finally { process.chdir(original); }
});

test('same-cell U-Value suffix maps conservatively while collisions remain unavailable', () => {
  const evidence = () => ({ sourceVisual: { kind: 'manufacturer_document_image', status: 'unavailable' } });
  const row: any = { displayReference: 'M', manufacturerEvidence: evidence(), originalExtractedSnapshot: { manufacturerEvidence: evidence() } };
  mapManufacturerVisualsToRows([row], [{ customerReference: 'M U-Value – 0,92', mappingConfidence: 'strong', mappingMethod: 'docx_same_table_cell_exact_reference', status: 'available', sourceFormat: 'png', renderedDerivative: { mediaType: 'image/png', url: '/m.png' } }]);
  assert.equal(row.manufacturerEvidence.sourceVisual.status, 'available');
  assert.equal(row.manufacturerEvidence.sourceVisual.url, '/m.png');

  const duplicates: any[] = [0, 1].map(() => ({ displayReference: 'M', manufacturerEvidence: evidence(), originalExtractedSnapshot: { manufacturerEvidence: evidence() } }));
  mapManufacturerVisualsToRows(duplicates, [{ customerReference: 'M U-Value – 0,92', mappingConfidence: 'strong', mappingMethod: 'docx_same_table_cell_exact_reference', status: 'available', renderedDerivative: { mediaType: 'image/png', url: '/must-not-map.png' } }]);
  for (const duplicate of duplicates) assert.equal(duplicate.manufacturerEvidence.sourceVisual.status, 'unavailable');
});
