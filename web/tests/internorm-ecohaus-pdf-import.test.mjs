import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { buildSupplierQuotationCommercialClassification } from '../server/features/projectCalculatorLab/supplierQuotationCommercialClassification.js';
import { detectPdfDocumentCurrency, parsePdfSupplierFields, parsePdfSupplierSummary } from '../server/features/supplierImportLab/pdfSupplierAdapters.js';
import { parseInternormEuropeanDecimal } from '../server/features/supplierImportLab/internormEcohausSpecification.js';
import { assessSupplierRoundingVariance } from '../server/features/supplierImportLab/supplierRoundingPolicy.js';
import { canonicalManufacturerSystemIdentity, createSupplierManufacturerRelationship, resolveCanonicalManufacturer } from '../server/features/supplierQuotes/manufacturerIdentity.js';
import { internormEcohausStructureFixture } from './fixtures/internorm-ecohaus-20260057-structure.mjs';

const parsedFixture = () => {
  const document = internormEcohausStructureFixture();
  const parsed = parsePdfSupplierFields(document);
  assert.ok(parsed);
  return { document, parsed };
};

async function configureInternormManufacturer(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS configurator_manufacturers(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.run("INSERT INTO configurator_manufacturers(id,name,code,is_active,updated_at) VALUES(?,?,?,?,?)", 'manufacturer-internorm', 'Internorm', 'IN', 1, new Date().toISOString());
}

test('EcoHaus complete quotation selects the bounded Internorm variant and document-supported GBP', () => {
  const { document, parsed } = parsedFixture();
  assert.equal(parsed.adapter, 'internorm_ecohaus_complete_quotation_v1');
  assert.equal(parsed.supplier, 'EcoHaus');
  assert.equal(parsed.manufacturer, 'Internorm');
  assert.equal(parsed.supplierIdentity.role, 'quotation_issuer');
  assert.equal(parsed.supplierIdentity.authority, 'explicit_document_issuer');
  assert.equal(parsed.supplierIdentity.sourceLegalName, 'ecoHaus SW ltd.');
  assert.equal(parsed.supplierIdentity.evidence[0].extractedText, 'ecoHaus SW ltd.');
  assert.equal(parsed.manufacturerIdentity.role, 'product_manufacturer');
  assert.ok(parsed.manufacturerIdentity.evidence.some((item) => /Internorm/.test(item.extractedText)));
  assert.deepEqual(parsed.supplierManufacturerRelationship, { relationship: 'dealer_supplies_manufacturer_products', supplierDealerName: 'EcoHaus', supplierSourceLegalName: 'ecoHaus SW ltd.', manufacturerName: 'Internorm', pricingScope: 'supplier_dealer_quotation' });
  assert.equal(parsed.quotation.supplierQuotationNumber, '20260057');
  assert.deepEqual(detectPdfDocumentCurrency(document), { currency: 'GBP', evidence: { GBP: 9, EUR: 0 } });
  assert.deepEqual(parsed.systemDefaults, ['HF410', 'KF410', 'HS330']);
  assert.ok(parsed.rows.every((row) => row.manufacturerName === 'Internorm'));
});

test('alphabetic, suffix and punctuation references remain distinct grouped positions', () => {
  const { parsed } = parsedFixture();
  assert.equal(parsed.metadata.sourcePositionLineCount, 17);
  assert.equal(parsed.metadata.canonicalProductPositionCount, 16);
  assert.equal(parsed.metadata.sourceExtraCount, 1);
  assert.deepEqual(parsed.rows.map((row) => row.displayReference), ['A', 'A 2', 'B', 'B 2', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M.', 'N', 'P']);
  assert.deepEqual(parsed.rows.map((row) => row.quantity), [6, 3, 2, 1, 1, 2, 1, 1, 1, 4, 1, 1, 1, 1, 4, 2]);
  assert.ok(parsed.rows.every((row) => row.status === 'extracted'));
});

test('representative windows, fixed elements, lift-slides and door retain dimensions and commercial evidence', () => {
  const { parsed } = parsedFixture();
  const byReference = new Map(parsed.rows.map((row) => [row.displayReference, row]));
  assert.deepEqual([byReference.get('A').quantity, byReference.get('A').widthMm, byReference.get('A').heightMm, byReference.get('A').unitPrice, byReference.get('A').totalPrice], [6, 1000, 660, '926.90', '5561.40']);
  assert.deepEqual([byReference.get('A 2').productSystem, byReference.get('A 2').unitPrice], ['KF410', '663.61']);
  assert.match(byReference.get('B').configurationDescription, /Turn\/tilt sash Left \/ Turn sash Right/);
  assert.equal(byReference.get('C').configurationDescription, 'Fixed');
  assert.deepEqual([byReference.get('F').product, byReference.get('F').widthMm, byReference.get('F').heightMm, byReference.get('F').totalPrice], ['HS330 lift-sliding door', 2600, 2100, '8450.82']);
  assert.match(byReference.get('M.').configurationDescription, /FIX\/IF · Lift-sliding door · Right/);
  assert.deepEqual([byReference.get('P').product, byReference.get('P').quantity, byReference.get('P').widthMm, byReference.get('P').heightMm], ['HF410 door', 2, 1010, 2440]);
  assert.match(byReference.get('P').fittingsSpecification, /multi-point lock/i);
});

test('European punctuation is parsed as GBP money without treating thousands dots as decimals', () => {
  assert.equal(parseInternormEuropeanDecimal('926,90'), '926.90');
  assert.equal(parseInternormEuropeanDecimal('5.561,40'), '5561.40');
  assert.equal(parseInternormEuropeanDecimal('1.606,79'), '1606.79');
  assert.equal(parseInternormEuropeanDecimal('17.405,76'), '17405.76');
});

test('system defaults inherit with provenance while position glazing and Uw override them', () => {
  const { parsed } = parsedFixture();
  const byReference = new Map(parsed.rows.map((row) => [row.displayReference, row]));
  const a = byReference.get('A');
  const h = byReference.get('H');
  assert.equal(a.sourceSpecification.version, 'manufacturer-source-specification-v1');
  assert.equal(a.internalSpecification.version, 'manufacturer-internal-position-specification-v1');
  assert.equal(a.sourceSpecification.inheritance.system, 'HF410');
  assert.equal(a.sourceSpecification.canonical.internalFinish.value, 'Spruce FI501 (FI501)');
  assert.equal(a.sourceSpecification.canonical.externalFinish.manufacturerCode, 'HM721');
  assert.equal(a.sourceSpecification.canonical.constructionDepthMm.value, '85');
  assert.equal(a.sourceSpecification.canonical.systemThermalPerformance.value, '0.71');
  assert.ok(a.internalSpecification.groups.find((group) => group.id === 'thermal').items.some((item) => item.label === 'System heat insulation' && item.value === '0.71'));
  assert.equal(a.manufacturerQuotedUg, '0.5');
  assert.equal(h.manufacturerQuotedUg, '0.6');
  assert.equal(h.manufacturerQuotedUw, '0.79');
  assert.match(h.sourceSpecification.canonical.glazing.value, /6btoughened\/16Ar/);
  assert.ok(h.sourceSpecification.sections.flatMap((section) => section.fields).some((field) => field.label === 'Glazing' && field.evidenceClass === 'explicit'));
});

test('couplers remain an accessory and package charges remain separate from product positions', () => {
  const { document, parsed } = parsedFixture();
  const commercial = parsePdfSupplierSummary(document, parsed.rows);
  assert.equal(commercial.summary.currency, 'GBP');
  assert.equal(commercial.summary.productSubtotal, '67523.64');
  assert.equal(commercial.summary.finalSupplierTotal, '84821.69');
  assert.equal(commercial.summary.reconciliation.expectedFinal, '84821.68');
  assert.equal(commercial.summary.reconciliation.reconciled, true);
  assert.equal(commercial.summary.reconciliation.roundingVariance.status, 'accepted_supplier_rounding_variance');
  assert.equal(commercial.summary.reconciliation.roundingVariance.differenceMinorUnits, 1);
  assert.equal(commercial.summary.status, 'extracted');
  assert.match(commercial.summary.warnings[0], /Accepted supplier rounding variance/);
  assert.deepEqual(commercial.additionalItems.map((item) => item.category), ['other', 'delivery', 'other', 'sill', 'accessory']);
  assert.deepEqual(commercial.additionalItems.map((item) => item.commercialRole), ['installation', 'delivery', 'survey', 'external_cills', 'coupling_profile']);
  const couplers = commercial.additionalItems.at(-1);
  assert.equal(couplers.originalDescription, 'Timber/wood coupling profile');
  assert.equal(couplers.quantity, 2);
  assert.equal(couplers.totalPrice, '37.14');
  assert.equal(couplers.includedInSupplierTotal, false);
  assert.equal(couplers.selectedForFutureUse, false);
  assert.equal(parsed.rows.some((row) => row.displayReference === 'N couplers'), false);
  const classification = buildSupplierQuotationCommercialClassification({ positionRows: parsed.rows, additionalItems: commercial.additionalItems, summary: commercial.summary });
  assert.deepEqual({ status: classification.productSupplyReconciliation.status, expected: classification.productSupplyReconciliation.expectedSubtotal, extracted: classification.productSupplyReconciliation.extractedSubtotal, variance: classification.productSupplyReconciliation.variance, contributors: classification.productSupplyReconciliation.contributors.length }, { status: 'reconciled_exact', expected: '84404.55', extracted: '84404.55', variance: '0.00', contributors: 17 });
  assert.ok(classification.productSupplyReconciliation.contributors.every((item) => item.calculation === 'source_unit_price_x_source_quantity'));
});

test('supplier rounding policy accepts exactly one minor unit and rejects broader variances', () => {
  assert.deepEqual(
    assessSupplierRoundingVariance({ currency: 'GBP', calculatedTotal: '84821.68', supplierStatedTotal: '84821.69' }),
    {
      status: 'accepted_supplier_rounding_variance', accepted: true, currency: 'GBP', differenceMinorUnits: 1,
      difference: '0.01', rule: 'exactly_one_minor_currency_unit', calculatedTotal: '84821.68',
      supplierStatedTotal: '84821.69', sourceValuesPreserved: true,
    },
  );
  assert.equal(assessSupplierRoundingVariance({ currency: 'GBP', calculatedTotal: '100.00', supplierStatedTotal: '100.02' }).status, 'material_variance');
  assert.equal(assessSupplierRoundingVariance({ currency: 'GBP', calculatedTotal: '100.00', supplierStatedTotal: '100.02' }).accepted, false);
});

test('fixture visuals retain review-only provenance without deterministic image-object evidence or EKO geometry', () => {
  const { parsed } = parsedFixture();
  for (const row of parsed.rows) {
    assert.equal(row.sourceVisual.status, 'unavailable');
    assert.equal(row.sourceVisual.geometryEvidence.version, 'internorm-pdf-image-ownership-v1');
    assert.equal(row.sourceVisual.geometryEvidence.classifier, 'position_image_xobject_ownership_unresolved');
    assert.equal(row.sourceVisual.geometryEvidence.reviewState, 'needs_review');
    assert.doesNotMatch(JSON.stringify(row.sourceVisual), /eko_okna|pdf-position-region-v5/i);
  }
});

test('read-only review separates EcoHaus quotation supplier from Internorm manufacturer and ignores a manufacturer-only supplier match', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-ecohaus-review-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-FIXTURE','Fixture',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-FIXTURE','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await configureInternormManufacturer(db);
  const service = createSupplierQuotesService(db, {
    attachmentRoot: root,
    fileSupplierAttachments: false,
    extractDocument: async () => internormEcohausStructureFixture(),
    derivePreviews: async () => ({ warnings: [] }),
  });
  const quote = await service.createQuote('estimate', { supplierCode: 'INTERNORM', supplierName: 'Internorm' });
  const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: '20260057', currency: 'EUR' });
  await service.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'safe-structure-fixture.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'a'.repeat(64), storageKey: 'safe-structure-fixture.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  await db.run('INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at,active) VALUES(?,?,?,?,?,1)', 'INTERNORM', 'Internorm', JSON.stringify({ pricingMethod: 'staged_discount' }), '{}', new Date().toISOString());
  const review = await service.prepareImportReview('estimate', [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }]);
  assert.equal(review.metadata.recognizedSupplierName, 'EcoHaus');
  assert.equal(review.metadata.recognizedManufacturerName, 'Internorm');
  assert.equal(review.metadata.manufacturerResolutionStatus, 'resolved');
  assert.equal(review.metadata.manufacturerId, 'manufacturer-internorm');
  assert.equal(review.metadata.manufacturerName, 'Internorm');
  assert.equal(review.metadata.manufacturerCode, 'IN');
  assert.equal(review.metadata.supplierIdentityRole, 'quotation_issuer');
  assert.equal(review.metadata.manufacturerIdentityRole, 'product_manufacturer');
  assert.equal(review.metadata.supplierResolutionStatus, 'not_configured');
  assert.equal(review.metadata.dealerResolutionStatus, 'not_configured');
  assert.equal(review.metadata.supplierCode, null);
  assert.equal(review.metadata.currency, 'GBP');
  assert.equal(review.positionCount, 16);
  assert.equal(review.documents[0].diagnostics.counts.validCanonicalPositions, 16);
  assert.equal(review.documents[0].diagnostics.counts.ambiguousVisualEvidence, 16);
  assert.equal(review.documents[0].rows.filter((row) => row.include).length, 16);
  assert.ok(review.documents[0].rows.every((row) => row.manufacturerName === 'Internorm'));
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_operations')).count, 0);
});

test('EcoHaus commercial configuration owns pricing resolution while Internorm remains product evidence', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-ecohaus-pricing-owner-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-FIXTURE','Fixture',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-FIXTURE','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await configureInternormManufacturer(db);
  await db.run('INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at,active) VALUES(?,?,?,?,?,1)', 'ECOHAUS', 'EcoHaus', JSON.stringify({ pricingMethod: 'factory_price' }), '{}', new Date().toISOString());
  const service = createSupplierQuotesService(db, { attachmentRoot: root, fileSupplierAttachments: false, extractDocument: async () => internormEcohausStructureFixture(), derivePreviews: async () => ({ warnings: [] }) });
  const quote = await service.createQuote('estimate', { supplierCode: 'DOC-INTERNORM', supplierName: 'Internorm' });
  const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: '20260057', currency: 'EUR' });
  await service.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'safe-structure-fixture.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'b'.repeat(64), storageKey: 'safe-structure-fixture.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  const review = await service.prepareImportReview('estimate', [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }]);
  assert.equal(review.metadata.supplierCode, 'ECOHAUS');
  assert.equal(review.metadata.supplierName, 'EcoHaus');
  assert.equal(review.metadata.supplierResolutionMethod, 'normalized_supplier_name');
  assert.equal(review.commercialSuppliers.find((item) => item.supplierCode === 'ECOHAUS').pricingMethod, 'factory_price');
  assert.equal(review.metadata.recognizedManufacturerName, 'Internorm');
  assert.equal(review.metadata.manufacturerId, 'manufacturer-internorm');
  assert.equal(review.canonicalManufacturers.length, 1);
  assert.equal(review.metadata.supplierManufacturerRelationship.relationship, 'dealer_supplies_manufacturer_products');
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs')).count, 0);
});

test('EcoHaus cannot be confirmed against the historically wrong Zyle dealer or parity policy', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-ecohaus-wrong-dealer-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-FIXTURE','Fixture',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-FIXTURE','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await configureInternormManufacturer(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'ZF', supplierName: 'Zyle Fenster', policy: { pricingMethod: 'parity_1_to_1', pricingBasis: 'parity_1_to_1', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Products / Supply', currency: 'GBP', packageCode: 'supply_only' });
  const service = createSupplierQuotesService(db, { attachmentRoot: root, fileSupplierAttachments: false, extractDocument: async () => internormEcohausStructureFixture(), derivePreviews: async () => ({ warnings: [] }) });
  const quote = await service.createQuote('estimate', { supplierCode: 'ZF', supplierName: 'Zyle Fenster' });
  const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: '20260057', currency: 'GBP' });
  const selection = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }];
  await service.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'safe-structure-fixture.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'c'.repeat(64), storageKey: 'safe-structure-fixture.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  const review = await service.prepareImportReview('estimate', selection);
  const selectedRowKeys = review.documents[0].rows.map((row) => row.rowKey);
  await assert.rejects(service.extractAndLoadSupplierCosts('estimate', scenario.id, selection, { selectedRowKeys, supplierCode: 'ZF', manufacturerId: 'manufacturer-internorm', metadata: { quotationNumber: '20260057', currency: 'GBP' } }), (error) => error.code === 'dealer_identity_mismatch');
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', revision.id)).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs WHERE revision_id=?', revision.id)).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_operations WHERE revision_id=?', revision.id)).count, 0);
  assert.deepEqual(await db.get('SELECT supplier_code,supplier_name FROM supplier_quotes WHERE id=?', quote.id), { supplier_code: 'ZF', supplier_name: 'Zyle Fenster' });
});

test('EcoHaus confirmation classifies commercial evidence without automatically applying discount or installation', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-ecohaus-discount-model-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-FIXTURE','Fixture',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-FIXTURE','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await configureInternormManufacturer(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'ECOHAUS', supplierName: 'EcoHaus', policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Products / Supply', currency: 'GBP', packageCode: 'supply_only' });
  const service = createSupplierQuotesService(db, { attachmentRoot: root, fileSupplierAttachments: false, extractDocument: async () => internormEcohausStructureFixture(), derivePreviews: async () => ({ warnings: [] }) });
  const quote = await service.createQuote('estimate', { supplierCode: 'ECOHAUS', supplierName: 'EcoHaus' });
  const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: '20260057', currency: 'GBP' });
  const selection = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }];
  await service.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'safe-structure-fixture.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'd'.repeat(64), storageKey: 'safe-structure-fixture.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  const review = await service.prepareImportReview('estimate', selection);
  assert.deepEqual({ products: review.documents[0].commercialEvidence.categories.productsSupply.amount, extras: review.documents[0].commercialEvidence.categories.extras.amount, transport: review.documents[0].commercialEvidence.categories.transport.amount, installation: review.documents[0].commercialEvidence.categories.installation.amount, survey: review.documents[0].commercialEvidence.categories.survey.amount, discount: review.documents[0].commercialEvidence.categories.discount.amount, imported: review.documents[0].commercialEvidence.defaultImportedCost }, { products: '84404.55', extras: '2245.47', transport: '3145.71', installation: '10939.15', survey: '967.71', discount: '16880.91', imported: '89795.73' });
  const result = await service.extractAndLoadSupplierCosts('estimate', scenario.id, selection, { selectedRowKeys: review.documents[0].rows.map((row) => row.rowKey), supplierCode: 'ECOHAUS', manufacturerId: 'manufacturer-internorm', metadata: { quotationNumber: '20260057', currency: 'GBP' } });
  assert.equal(result.documents[0].extractedProducts, 16);
  assert.equal((await db.get('SELECT printf("%.2f",SUM(total_purchase_price_amount)) gross FROM supplier_quote_positions WHERE revision_id=?', revision.id)).gross, '84367.41');
  const coupler = await db.get("SELECT total_price_amount,included_in_supplier_total FROM supplier_quote_extras WHERE revision_id=? AND category='accessory'", revision.id);
  assert.deepEqual(coupler, { total_price_amount: '37.14', included_in_supplier_total: 0 });
  const link = await db.get('SELECT commercial_policy_json FROM project_calculator_supplier_quote_revisions WHERE scenario_id=? AND revision_id=?', scenario.id, revision.id);
  const policy = JSON.parse(link.commercial_policy_json), evidence = policy.sourceProductCommercialEvidence;
  assert.deepEqual({ grossPositions: evidence.grossPositionAmount, couplers: evidence.embeddedAccessoryGrossAmount, list: evidence.grossListAmount, discount: evidence.discountAmount, net: evidence.netProductSubtotal, allocation: evidence.allocationToPositions }, { grossPositions: '84367.41', couplers: '37.14', list: '84404.55', discount: '16880.91', net: '67523.64', allocation: 'none' });
  assert.equal(policy.sourceDiscountDecision.status, 'not_applied');
  await calculator.ensureSupplierRevisionExchangeRates(scenario.id, [revision.id]);
  let projected = await calculator.getScenario(scenario.id);
  assert.equal(projected.products.reduce((sum, row) => sum + Number(row.originalAmount), 0).toFixed(2), '84367.41');
  assert.equal(projected.supplierProductCommercialAdjustments[0].status, 'available_not_applied');
  assert.deepEqual(projected.supplierCosts.map((row) => [row.category, row.includedInCurrentEstimate]), [['delivery', true], ['extras', true], ['supplier_installation', false], ['supplier_survey', false], ['product_supply', true]]);
  assert.equal(projected.supplierCosts.find((row) => row.category === 'product_supply').originalAmount, '37.14');
  const supplierInstallation = projected.supplierCosts.find((row) => row.category === 'supplier_installation');
  const sourceInstallationBefore = await db.get('SELECT included_in_supplier_total FROM supplier_quote_extras WHERE id=?', supplierInstallation.sourceAdditionalCostId);
  await calculator.updateSupplierCost(scenario.id, supplierInstallation.id, { includedInCurrentEstimate: true });
  assert.equal((await calculator.getScenario(scenario.id)).supplierCosts.find((row) => row.id === supplierInstallation.id).includedInCurrentEstimate, true);
  assert.deepEqual(await db.get('SELECT included_in_supplier_total FROM supplier_quote_extras WHERE id=?', supplierInstallation.sourceAdditionalCostId), sourceInstallationBefore);
  await calculator.updateSupplierCost(scenario.id, supplierInstallation.id, { includedInCurrentEstimate: false });
  await calculator.updateSupplierCommercialPolicy(scenario.id, revision.id, { ...policy, sourceDiscountDecision: { status: 'applied', evidenceVersion: evidence.version }, projectDiscount: { mode: 'fixed', amount: evidence.discountAmount, percentage: evidence.discountPercentage, source: 'supplier_quotation', scope: 'products_supply', evidenceVersion: evidence.version } });
  projected = await calculator.getScenario(scenario.id);
  assert.equal(projected.supplierProductCommercialAdjustments[0].status, 'applied');
  assert.equal(projected.supplierProductCommercialAdjustments[0].netProductPurchaseGbp, '67523.64');
  assert.equal((await db.get('SELECT printf("%.2f",SUM(total_purchase_price_amount)) gross FROM supplier_quote_positions WHERE revision_id=?', revision.id)).gross, '84367.41');
});

test('one canonical Internorm system identity is reused across independent dealers and quotations', () => {
  const configuredManufacturers = [{ manufacturerId: 'manufacturer-internorm', manufacturerName: 'Internorm', manufacturerCode: 'IN' }];
  const ecoHaus = resolveCanonicalManufacturer({ recognizedManufacturerName: 'Internorm', configuredManufacturers });
  const dealerTwo = resolveCanonicalManufacturer({ recognizedManufacturerName: 'INTERNORM', configuredManufacturers });
  assert.equal(ecoHaus.manufacturer.manufacturerId, 'manufacturer-internorm');
  assert.equal(dealerTwo.manufacturer.manufacturerId, 'manufacturer-internorm');
  assert.deepEqual(canonicalManufacturerSystemIdentity(ecoHaus.manufacturer, 'HF410'), canonicalManufacturerSystemIdentity(dealerTwo.manufacturer, 'HF410'));
  const quotations = [
    { manufacturerId: ecoHaus.manufacturer.manufacturerId, supplierCode: 'ECOHAUS', quotation: '20260057', pricingMethod: 'factory_price' },
    { manufacturerId: dealerTwo.manufacturer.manufacturerId, supplierCode: 'DEALER-TWO', quotation: 'D2-1001', pricingMethod: 'staged_discount' },
  ];
  assert.equal(new Set(quotations.map((item) => item.manufacturerId)).size, 1);
  assert.equal(new Set(quotations.map((item) => `${item.supplierCode}:${item.quotation}:${item.pricingMethod}`)).size, 2);
  const ecoHausRelationship = createSupplierManufacturerRelationship({ manufacturer: ecoHaus.manufacturer, supplier: { supplierCode: 'ECOHAUS', supplierName: 'EcoHaus' }, sourceLegalName: 'ecoHaus SW ltd.' });
  const dealerTwoRelationship = createSupplierManufacturerRelationship({ manufacturer: dealerTwo.manufacturer, supplier: { supplierCode: 'DEALER-TWO', supplierName: 'Dealer Two' } });
  const directRelationship = createSupplierManufacturerRelationship({ manufacturer: ecoHaus.manufacturer, supplier: { supplierCode: 'IN', supplierName: 'Internorm' } });
  assert.equal(ecoHausRelationship.relationship, 'dealer_supplies_manufacturer_products');
  assert.equal(dealerTwoRelationship.manufacturerId, ecoHausRelationship.manufacturerId);
  assert.equal(directRelationship.relationship, 'direct_manufacturer_supplier');
});
