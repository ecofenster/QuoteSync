import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { parsePdfSupplierFields } from '../server/features/supplierImportLab/pdfSupplierAdapters.js';
import { internormAspectStructureFixture } from './fixtures/internorm-aspect-6366-structure.mjs';
import { internormGlassWorxStructureFixture } from './fixtures/internorm-glass-worx-structure.mjs';

test('Glass Worx feeds the shared Internorm system, configuration and three-layer specification contract', () => {
  const parsed = parsePdfSupplierFields(internormGlassWorxStructureFixture());
  assert.equal(parsed.adapter, 'internorm_schedule_v1');
  assert.equal(parsed.supplier, 'Glass Worx');
  assert.equal(parsed.manufacturer, 'Internorm');
  assert.deepEqual(parsed.rows.map((row) => row.productSystem), ['HF510', 'AT510', 'HS330', 'HF410']);
  assert.deepEqual(parsed.rows.map((row) => row.configurationDescription), ['Fixed', 'Entrance door · Inward-opening · left', 'Lift-sliding door · Left · IF/FIX', 'Turn door Right']);
  for (const row of parsed.rows) {
    assert.equal(row.sourceSpecification.version, 'manufacturer-source-specification-v1');
    assert.equal(row.sourceSpecification.supplierInterpretation, 'internorm_schedule_v1');
    assert.equal(row.internalSpecification.version, 'manufacturer-internal-position-specification-v1');
    assert.ok(row.sourceSpecification.canonical.internalFinish);
    assert.ok(row.sourceSpecification.canonical.externalFinish);
    assert.ok(row.sourceSpecification.canonical.glazing);
    assert.equal(row.sourceVisual.status, 'unavailable');
    assert.equal(row.sourceVisual.mappingReviewStatus, 'needs_review');
    assert.equal(row.sourceVisual.originalAsset.sha256, 'f'.repeat(64));
  }
  const fixed = parsed.rows.find((row) => row.displayReference === 'GF-W-W1');
  assert.doesNotMatch(fixed.sourceSpecification.canonical.frameProfile?.value ?? '', /Offer number|Page \d+/i);
  const entranceDoor = parsed.rows.find((row) => row.displayReference === 'GF-W-D1-B');
  assert.equal(entranceDoor.sourceSpecification.canonical.sashes[0].fitting, 'Entrance door · Inward-opening · left');
  assert.equal(entranceDoor.sourceSpecification.canonical.sashes[0].closing, 'Inward-opening');
});

test('Internorm schedule image ownership is automatic only when the position and PDF object evidence reconcile one-to-one', () => {
  const fixture = internormGlassWorxStructureFixture();
  fixture.pages.at(-1).imageEvidence = [
    ['drawing-1', 680], ['drawing-2', 520], ['drawing-3', 360], ['drawing-4', 200],
  ].map(([objectId, y], index) => ({
    id: `visual-${index}`,
    objectId,
    pageNumber: 6,
    boundingBox: { x: 50, y, width: 130, height: 60 },
    sourceOperatorIndex: 100 + index,
    sourceType: 'image_xobject_bounds',
    intrinsicWidth: 260,
    intrinsicHeight: 120,
  }));
  const parsed = parsePdfSupplierFields(fixture);
  assert.equal(parsed.rows.length, 4);
  assert.ok(parsed.rows.every((row) => row.sourceVisual.mappingReviewStatus === 'mapped_automatic'));
  assert.deepEqual(parsed.rows.map((row) => row.sourceVisual.originalAsset.sourceObjectIds[0]), ['drawing-1', 'drawing-2', 'drawing-3', 'drawing-4']);
  assert.ok(parsed.rows.every((row) => row.sourceVisual.role === 'unknown'));
  assert.ok(parsed.rows.every((row) => row.sourceVisual.renderCacheVersion === 'internorm-pdf-image-region-v1'));
  assert.ok(parsed.rows.every((row) => row.sourceVisual.geometryEvidence.classifier === 'ordered_one_to_one_position_image_xobject_ownership'));
});

test('Aspect technical selection remains independent from commercial confirmation readiness', async () => {
  const parsed = parsePdfSupplierFields(internormAspectStructureFixture());
  assert.equal(parsed.rows.length, 35);
  assert.ok(parsed.rows.every((row) => row.commercialReadiness === 'review_required'));
  const serviceSource = await fs.readFile(new URL('../server/features/supplierQuotes/supplierQuotesService.js', import.meta.url), 'utf8');
  const reviewSource = await fs.readFile(new URL('../src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx', import.meta.url), 'utf8');
  assert.match(serviceSource, /isTechnicallySelectablePositionRow/);
  assert.match(serviceSource, /technical positions require commercial price review/);
  assert.match(reviewSource, /selectedReviewRows\.some\(row=>!row\.commerciallyReady\)/);
  assert.match(reviewSource, /Commercial price review required/);
  assert.match(reviewSource, /Selected positions require commercial evidence review/);
});

test('Review terminology stays explicit for dealer/manufacturer documents', async () => {
  const source = await fs.readFile(new URL('../src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx', import.meta.url), 'utf8');
  for (const label of ['Document issuer / branded dealer:', 'Manufacturer / fabricator:', 'Canonical manufacturer:', 'Commercial Supplier:', 'Pricing Method:', 'Quotation / reference:', 'Currency:']) assert.match(source, new RegExp(label.replaceAll('/', '\\/')));
});
