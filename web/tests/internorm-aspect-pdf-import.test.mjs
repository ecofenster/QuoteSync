import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { parsePdfSupplierFields, parsePdfSupplierSummary } from '../server/features/supplierImportLab/pdfSupplierAdapters.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import { canonicalManufacturerSystemIdentity, createSupplierManufacturerRelationship, resolveCanonicalManufacturer } from '../server/features/supplierQuotes/manufacturerIdentity.js';
import { internormAspectStructureFixture } from './fixtures/internorm-aspect-6366-structure.mjs';

function parsedFixture() {
  const document = internormAspectStructureFixture();
  const parsed = parsePdfSupplierFields(document);
  assert.ok(parsed);
  return { document, parsed };
}

async function configureInternormManufacturer(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS configurator_manufacturers(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.run("INSERT INTO configurator_manufacturers(id,name,code,is_active,updated_at) VALUES(?,?,?,?,?)", 'manufacturer-internorm', 'Internorm', 'IN', 1, new Date().toISOString());
}

test('Aspect selects a bounded dealer-specific Internorm schedule adapter and metadata-backed reference', () => {
  const { parsed } = parsedFixture();
  assert.equal(parsed.adapter, 'internorm_aspect_schedule_v1');
  assert.equal(parsed.supplier, 'Aspect Aluminium');
  assert.equal(parsed.manufacturer, 'Internorm');
  assert.equal(parsed.supplierIdentity.role, 'quotation_issuer');
  assert.equal(parsed.supplierIdentity.authority, 'explicit_document_issuer');
  assert.equal(parsed.supplierIdentity.sourceLegalName, 'Aspect Aluminium');
  assert.equal(parsed.manufacturerIdentity.role, 'product_manufacturer');
  assert.equal(parsed.supplierManufacturerRelationship.relationship, 'dealer_supplies_manufacturer_products');
  assert.equal(parsed.supplierManufacturerRelationship.pricingScope, 'supplier_dealer_quotation');
  assert.equal(parsed.quotation.supplierQuotationNumber, '6366');
  assert.equal(parsed.quotation.referenceAuthority, 'pdf_title_metadata');
  assert.deepEqual(parsed.quotation.sourceDocumentMetadata, { reference: '6366', authority: 'pdf_title_metadata', field: 'Title', value: 'Microsoft Word - 6366 - Internorm Quote Letter' });
  assert.match(parsed.quotation.warnings[0], /PDF Title metadata/);
  assert.deepEqual(parsed.systemDefaults, ['HF410', 'HS330']);
  assert.ok(parsed.rows.every((row) => row.currency === 'GBP' && row.manufacturerName === 'Internorm'));
});

test('Aspect retains 35 grouped product references and four coupling-profile source extras', () => {
  const { parsed } = parsedFixture();
  assert.deepEqual(parsed.metadata, {
    supplierCustomer: null,
    projectReference: null,
    quotationDate: null,
    quotationReferenceAuthority: 'pdf_title_metadata',
    sourcePositionLineCount: 39,
    canonicalProductPositionCount: 35,
    sourceExtraCount: 4,
    reviewRequiredPositionCount: 35,
  });
  assert.deepEqual(parsed.rows.slice(0, 13).map((row) => row.displayReference), ['1 Utility', '2 Pantry', '3 Cinema', '4 Gym', '5 Snug', '6 Door', '6 Side', '7 Living', '8 Morning', '9 Door', '9 Side', '10 Morning', '11 Kitchen']);
  assert.deepEqual(parsed.rows.slice(-7).map((row) => row.displayReference), ['26 Dressing', '27 Bed 1', '28 Bed 1 Door', '28 Bed Side 1', '29 Bed 2', '30 Bed 3', '31 Study']);
  assert.deepEqual(parsed.sourceExtras.map((item) => item.reference), ['6 Coupler', '9 Coupler', '16 Coupler', '28 Coupler']);
  assert.equal(parsed.rows.find((row) => row.displayReference === '10 Morning').quantity, 2);
  assert.equal(parsed.rows.find((row) => row.displayReference === '12 Kitchen').quantity, 2);
  assert.equal(parsed.rows.reduce((sum, row) => sum + row.quantity, 0), 37);
});

test('HF410 and HS330 dimensions, configurations and three-layer specification evidence remain source-driven', () => {
  const { parsed } = parsedFixture();
  const byReference = new Map(parsed.rows.map((row) => [row.displayReference, row]));
  assert.deepEqual([byReference.get('1 Utility').widthMm, byReference.get('1 Utility').heightMm, byReference.get('1 Utility').productSystem], [610, 610, 'HF410']);
  assert.deepEqual([byReference.get('11 Kitchen').widthMm, byReference.get('11 Kitchen').heightMm, byReference.get('11 Kitchen').productSystem], [7060, 2440, 'HS330']);
  assert.equal(byReference.get('3 Cinema').configurationDescription, 'Fixed');
  assert.equal(byReference.get('4 Gym').configurationDescription, 'Tilt with drive · Right');
  assert.equal(byReference.get('28 Bed 1 Door').configurationDescription, 'Turn door · Left');
  assert.match(byReference.get('29 Bed 2').configurationDescription, /Turn\/tilt sash Left \/ Turn sash Right/);
  assert.match(byReference.get('11 Kitchen').configurationDescription, /Lift-sliding door · Right/);
  const source = byReference.get('1 Utility').sourceSpecification;
  assert.equal(source.version, 'manufacturer-source-specification-v1');
  assert.equal(source.supplierInterpretation, 'internorm_aspect_schedule_v1');
  assert.equal(source.inheritance.system, 'HF410');
  assert.equal(source.canonical.internalFinish.value, 'Wood H9016 (white) opaque (H9016)');
  assert.equal(source.canonical.externalFinish.value, 'Anthracite grey RAL 7016 matt (HM716)');
  assert.match(source.canonical.glazing.value, /Triple 48mm/);
  assert.equal(byReference.get('1 Utility').internalSpecification.version, 'manufacturer-internal-position-specification-v1');
});

test('missing position prices remain explicit review requirements while package evidence is retained without invention', () => {
  const { document, parsed } = parsedFixture();
  assert.ok(parsed.rows.every((row) => row.status === 'needs_review' && row.unitPrice === null && row.totalPrice === null));
  assert.ok(parsed.rows.every((row) => row.warnings.some((warning) => /does not state position-level unit and line prices/.test(warning))));
  const commercial = parsePdfSupplierSummary(document, parsed.rows);
  assert.equal(commercial.summary.currency, 'GBP');
  assert.equal(commercial.summary.finalSupplierTotal, '91079.00');
  assert.equal(commercial.summary.status, 'needs_review');
  assert.equal(commercial.summary.reconciliation.reconciled, false);
  assert.equal(commercial.summary.reconciliation.reviewRequiredPositionCount, 35);
  assert.equal(commercial.additionalItems.filter((item) => item.commercialRole === 'coupling_profile').length, 4);
  const rooflight = commercial.additionalItems.find((item) => item.commercialRole === 'rooflight_package');
  assert.equal(rooflight.rawAmount, '11.810.00');
  assert.equal(rooflight.totalPrice, null);
  assert.equal(rooflight.status, 'needs_review');
  assert.match(commercial.summary.warnings.join(' '), /retained as ambiguous source evidence/);
});

test('Aspect fixture drawings remain review-required when deterministic image-object ownership is absent', () => {
  const { parsed } = parsedFixture();
  for (const row of parsed.rows) {
    assert.equal(row.sourceVisual.status, 'unavailable');
    assert.equal(row.sourceVisual.geometryEvidence.version, 'internorm-pdf-image-ownership-v1');
    assert.equal(row.sourceVisual.geometryEvidence.classifier, 'position_image_xobject_ownership_unresolved');
    assert.equal(row.sourceVisual.geometryEvidence.reviewState, 'needs_review');
    assert.doesNotMatch(JSON.stringify(row.sourceVisual), /eko_okna|pdf-position-region-v5|internorm_ecohaus_mixed/i);
  }
});

test('Aspect and EcoHaus reuse one Internorm manufacturer/system while dealer quotation and pricing scopes remain isolated', () => {
  const configuredManufacturers = [{ manufacturerId: 'manufacturer-internorm', manufacturerName: 'Internorm', manufacturerCode: 'IN' }];
  const internorm = resolveCanonicalManufacturer({ recognizedManufacturerName: 'Internorm', configuredManufacturers }).manufacturer;
  const ecoHausSystem = canonicalManufacturerSystemIdentity(internorm, 'HF410');
  const aspectSystem = canonicalManufacturerSystemIdentity(internorm, 'HF410');
  assert.deepEqual(aspectSystem, ecoHausSystem);
  const ecoHaus = createSupplierManufacturerRelationship({ manufacturer: internorm, supplier: { supplierCode: 'ECOHAUS', supplierName: 'EcoHaus' }, sourceLegalName: 'ecoHaus SW ltd.' });
  const aspect = createSupplierManufacturerRelationship({ manufacturer: internorm, supplier: { supplierCode: 'ASPECT', supplierName: 'Aspect Aluminium' }, sourceLegalName: 'Aspect Aluminium' });
  assert.equal(ecoHaus.manufacturerId, aspect.manufacturerId);
  assert.notEqual(ecoHaus.supplierCode, aspect.supplierCode);
  assert.equal(aspect.pricingScope, 'supplier_dealer_quotation');
  assert.equal(aspect.relationship, 'dealer_supplies_manufacturer_products');
});

test('Review UI distinguishes manufacturer, dealer and commercial confirmation without disabling technical selection', async () => {
  const source = await fs.readFile(new URL('../src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx', import.meta.url), 'utf8');
  assert.match(source, /<strong>Manufacturer:<\/strong>/);
  assert.match(source, /<strong>Source supplier \/ dealer:<\/strong>/);
  assert.match(source, /<strong>Canonical manufacturer:<\/strong>/);
  assert.match(source, /<strong>Configured supplier \/ dealer:<\/strong>/);
  assert.match(source, /<strong>Quotation \/ reference:<\/strong>/);
  assert.match(source, /<strong>Currency:<\/strong>/);
  assert.match(source, /Select configured supplier \/ dealer/);
  assert.match(source, /disabled=\{busy\|\|!row\.include\}/);
  assert.match(source, /Commercial price review required/);
  assert.match(source, /no positions have complete commercial evidence/);
});

test('read-only review shows Aspect dealer unresolved, canonical Internorm resolved and 35 parsed / zero ready', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-aspect-review-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-ASPECT','Fixture',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-ASPECT','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await configureInternormManufacturer(db);
  const service = createSupplierQuotesService(db, { attachmentRoot: root, fileSupplierAttachments: false, extractDocument: async () => internormAspectStructureFixture(), derivePreviews: async () => ({ warnings: [] }) });
  const quote = await service.createQuote('estimate', { supplierCode: 'INTERNORM', supplierName: 'Internorm' });
  const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: '010101', currency: 'EUR' });
  await service.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'safe-aspect-structure-fixture.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'c'.repeat(64), storageKey: 'safe-aspect-structure-fixture.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  const review = await service.prepareImportReview('estimate', [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }]);
  assert.equal(review.metadata.recognizedSupplierName, 'Aspect Aluminium');
  assert.equal(review.metadata.recognizedDealerName, 'Aspect Aluminium');
  assert.equal(review.metadata.supplierResolutionStatus, 'not_configured');
  assert.equal(review.metadata.supplierCode, null);
  assert.equal(review.metadata.recognizedManufacturerName, 'Internorm');
  assert.equal(review.metadata.manufacturerResolutionStatus, 'resolved');
  assert.equal(review.metadata.manufacturerId, 'manufacturer-internorm');
  assert.equal(review.metadata.manufacturerCode, 'IN');
  assert.equal(review.metadata.quotationNumber, '010101');
  assert.equal(review.metadata.quotationReferenceAuthority, 'reviewed_user_entered');
  assert.equal(review.metadata.reviewedQuotationReference, '010101');
  assert.equal(review.metadata.sourceQuotationReference, '6366');
  assert.equal(review.metadata.sourceQuotationReferenceAuthority, 'pdf_title_metadata');
  assert.equal(review.metadata.documentMetadataReference, '6366');
  assert.equal(review.metadata.currency, 'GBP');
  assert.equal(review.positionCount, 35);
  assert.equal(review.documents[0].adapter, 'internorm_aspect_schedule_v1');
  assert.equal(review.documents[0].diagnostics.counts.parsedPositions, 35);
  assert.equal(review.documents[0].diagnostics.counts.validCanonicalPositions, 0);
  assert.equal(review.documents[0].diagnostics.counts.ambiguousVisualEvidence, 35);
  assert.ok(review.documents[0].rows.every((row) => row.include === true && row.technicallySelectable === true && row.commerciallyReady === false && row.manufacturerName === 'Internorm'));
  assert.equal(review.documents[0].rows.filter((row) => row.include).length, 35);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_operations')).count, 0);
});
