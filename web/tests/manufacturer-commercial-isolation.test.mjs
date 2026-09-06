import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { buildProductSupplyReconciliation, buildQuotationProductCommercialEvidence, resolveQuotationProductCommercialBasis } from '../server/features/projectCalculatorLab/quotationProductCommercialEvidence.js';
import { assertSupplierProductSupplyReconciliation, buildSupplierQuotationCommercialClassification, classifySupplierCommercialItem } from '../server/features/projectCalculatorLab/supplierQuotationCommercialClassification.js';
import { assertCommercialDealerIdentity } from '../server/features/supplierQuotes/supplierIdentity.js';
import { inspectConfirmedProjectionDrift } from '../server/features/supplierQuotes/supplierImportReliability.js';
import { linkSupplierPositionToEstimate, readCanonicalEstimatePositions } from '../server/features/estimatePositions/canonicalEstimatePositions.js';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import { calculateSupplierCommercialPolicy } from '../server/features/projectCalculatorLab/supplierCommercialPricing.js';

const ecohausSummary = {
  currency: 'GBP',
  productSubtotal: '67523.64',
  comparisonTotals: [
    { classification: 'supplier_list_price', amount: '84404.55', currency: 'GBP', sourceTrace: [{ pageNumber: 14 }] },
    { classification: 'supplier_discount', percentage: '20', currency: 'GBP', sourceTrace: [{ pageNumber: 14 }] },
  ],
  reconciliation: { reconciled: true },
};

test('EcoHaus gross rows and couplers reconcile while the source discount remains unapplied by default', () => {
  const evidence = buildQuotationProductCommercialEvidence({
    positionRows: [{ displayReference: '16 source positions', quantity: 1, unitPrice: '84367.41', totalPrice: '84367.41', includedInSupplierTotal: true }],
    additionalItems: [{ normalizedLabel: 'N couplers', commercialRole: 'coupling_profile', quantity: 2, unitPrice: '18.57', totalPrice: '37.14', includedInSupplierTotal: false, sourceTrace: [{ pageNumber: 13 }] }],
    summary: ecohausSummary,
  });
  assert.deepEqual({
    status: evidence.status,
    positionPriceBasis: evidence.positionPriceBasis,
    grossPositionAmount: evidence.grossPositionAmount,
    couplers: evidence.embeddedAccessoryGrossAmount,
    grossList: evidence.grossListAmount,
    discount: evidence.discountAmount,
    net: evidence.netProductSubtotal,
    positionAdjustment: evidence.positionToNetAdjustmentAmount,
    rewritten: evidence.sourceAmountsRewritten,
    allocation: evidence.allocationToPositions,
  }, {
    status: 'applicable', positionPriceBasis: 'gross_list', grossPositionAmount: '84367.41', couplers: '37.14', grossList: '84404.55', discount: '16880.91', net: '67523.64', positionAdjustment: '-16843.77', rewritten: false, allocation: 'none',
  });
  assert.equal(resolveQuotationProductCommercialBasis({ evidence, policy: { sourceQuotedPriceBasis: 'gross_list', sourceDiscountDecision: { status: 'not_applied' } } }).status, 'available_not_applied');
  const appliedPolicy = { pricingMethod: 'factory_price', sourceQuotedPriceBasis: 'gross_list', sourceDiscountDecision: { status: 'applied' }, projectDiscount: { mode: 'fixed', amount: '16880.91', percentage: '20', source: 'supplier_quotation', scope: 'products_supply', evidenceVersion: evidence.version } };
  assert.equal(resolveQuotationProductCommercialBasis({ evidence, policy: appliedPolicy }).status, 'applied');
  assert.equal(resolveQuotationProductCommercialBasis({ evidence, policy: { ...appliedPolicy, projectDiscount: { ...appliedPolicy.projectDiscount, amount: '16880.90' } } }).status, 'review_required');
  assert.equal(resolveQuotationProductCommercialBasis({ evidence: { ...evidence, positionPriceBasis: 'net' } }).status, 'review_required');
  assert.equal(resolveQuotationProductCommercialBasis({ evidence, policy: { ...appliedPolicy, pricingMethod: 'staged_discount', discountPolicy: { type: 'single', percentage: '20' } } }).status, 'review_required');
  const configuredPolicy = calculateSupplierCommercialPolicy({ quotedCurrency: 'GBP', quotedAmount: '84404.55', manufacturerListAmount: '84404.55', paidInQuotedCurrency: true, settlementCurrency: 'GBP', pricingMethod: 'factory_price', pricingBasis: 'factory_price', projectDiscount: appliedPolicy.projectDiscount, sourceDiscountDecision: appliedPolicy.sourceDiscountDecision, sourceProductCommercialEvidence: evidence });
  assert.equal(configuredPolicy.standardNetBuyingAmount, '84404.55');
  assert.equal(configuredPolicy.discountedSupplierPurchaseAmount, '67523.64');
  assert.equal(evidence.productSupplyReconciliation.status, 'reconciled_exact');
  assert.equal(evidence.productSupplyReconciliation.extractedSubtotal, '84404.55');
  assert.equal(evidence.productSupplyReconciliation.variance, '0.00');
  assert.deepEqual(evidence.productSupplyReconciliation.contributors.map((item) => [item.reference, item.calculation, item.calculatedAmount]), [['16 source positions', 'source_unit_price_x_source_quantity', '84367.41'], ['N couplers', 'source_unit_price_x_source_quantity', '37.14']]);
});

test('pre-discount Products / Supply reconciliation is unavailable without a source subtotal and fails closed on material variance', () => {
  const rows = [{ displayReference: 'A', quantity: 2, unitPrice: '100.00', totalPrice: '200.00', includedInSupplierTotal: true }];
  const unavailable = buildProductSupplyReconciliation({ positionRows: rows, summary: { currency: 'GBP', comparisonTotals: [] } });
  assert.deepEqual({ status: unavailable.status, blocking: unavailable.blocking, expected: unavailable.expectedSubtotal, extracted: unavailable.extractedSubtotal }, { status: 'not_available', blocking: false, expected: null, extracted: '200.00' });

  const classification = buildSupplierQuotationCommercialClassification({
    positionRows: [...rows, { displayReference: 'A duplicate', quantity: 1, unitPrice: '50.00', totalPrice: '50.00', includedInSupplierTotal: true }],
    additionalItems: [{ normalizedLabel: 'External cills', commercialRole: 'external_cills', category: 'sill', quantity: 1, unitPrice: '25.00', totalPrice: '25.00', includedInSupplierTotal: true }],
    summary: { currency: 'GBP', comparisonTotals: [{ classification: 'supplier_list_price', amount: '200.00', currency: 'GBP' }] },
  });
  const failed = classification.productSupplyReconciliation;
  assert.equal(failed.status, 'review_required');
  assert.equal(failed.extractedSubtotal, '250.00');
  assert.equal(failed.variance, '50.00');
  assert.deepEqual(failed.excludedItems.map((item) => [item.reference, item.classification]), [['External cills', 'extras']]);
  assert.throws(() => assertSupplierProductSupplyReconciliation(classification), (error) => error.code === 'supplier_product_reconciliation_failed' && error.productSupplyReconciliation.variance === '50.00');

  const acceptedRounding = buildProductSupplyReconciliation({ positionRows: rows, summary: { currency: 'GBP', comparisonTotals: [{ classification: 'supplier_list_price', amount: '200.01', currency: 'GBP' }] } });
  assert.deepEqual({ status: acceptedRounding.status, blocking: acceptedRounding.blocking, variance: acceptedRounding.variance }, { status: 'reconciled_rounding_variance', blocking: false, variance: '-0.01' });

  const missing = buildSupplierQuotationCommercialClassification({ positionRows: rows, summary: { currency: 'GBP', comparisonTotals: [{ classification: 'supplier_list_price', amount: '300.00', currency: 'GBP' }] } }).productSupplyReconciliation;
  assert.deepEqual({ status: missing.status, extracted: missing.extractedSubtotal, variance: missing.variance }, { status: 'review_required', extracted: '200.00', variance: '-100.00' });

  const misclassified = buildSupplierQuotationCommercialClassification({ positionRows: rows, additionalItems: [{ normalizedLabel: 'Unmapped coupling profile', category: 'other', quantity: 2, unitPrice: '18.57', totalPrice: '37.14' }], summary: { currency: 'GBP', comparisonTotals: [{ classification: 'supplier_list_price', amount: '237.14', currency: 'GBP' }] } }).productSupplyReconciliation;
  assert.equal(misclassified.status, 'review_required');
  assert.deepEqual(misclassified.excludedItems.map((item) => [item.reference, item.classification]), [['Unmapped coupling profile', 'informational']]);
});

test('canonical source items classify into Products, Extras, Transport and evidence-only decisions', () => {
  const additionalItems = [
    { commercialRole: 'installation', category: 'other', totalPrice: '10939.15', currency: 'GBP' },
    { commercialRole: 'delivery', category: 'delivery', totalPrice: '3145.71', currency: 'GBP' },
    { commercialRole: 'survey', category: 'other', totalPrice: '967.71', currency: 'GBP' },
    { commercialRole: 'external_cills', category: 'sill', totalPrice: '2245.47', currency: 'GBP' },
    { commercialRole: 'coupling_profile', category: 'accessory', totalPrice: '37.14', currency: 'GBP', includedInSupplierTotal: false },
  ];
  assert.deepEqual(additionalItems.map(classifySupplierCommercialItem).map((item) => [item.canonicalCategory, item.automaticImport]), [['installation', false], ['transport', true], ['survey', false], ['extras', true], ['products_supply', true]]);
  const classification = buildSupplierQuotationCommercialClassification({ positionRows: [{ totalPrice: '84367.41', includedInSupplierTotal: true }], additionalItems, summary: { ...ecohausSummary, finalSupplierTotal: '84821.69' } });
  assert.deepEqual({ products: classification.categories.productsSupply.amount, extras: classification.categories.extras.amount, transport: classification.categories.transport.amount, installation: classification.categories.installation.amount, survey: classification.categories.survey.amount, discount: classification.categories.discount.amount, imported: classification.defaultImportedCost, quoted: classification.supplierQuotedTotal }, { products: '84404.55', extras: '2245.47', transport: '3145.71', installation: '10939.15', survey: '967.71', discount: '16880.91', imported: '89795.73', quoted: '84821.69' });
});

test('an explicit dealer issuer fails closed against another configured dealer or quotation aggregate', () => {
  const ecohaus = { supplierCode: 'EH', supplierName: 'EcoHaus' };
  assert.doesNotThrow(() => assertCommercialDealerIdentity({ sourceDealerName: 'ecoHaus SW Ltd', sourceAuthority: 'explicit_document_issuer', configuredDealer: { supplierCode: 'EH', supplierName: 'ecoHaus SW Ltd' }, quotationDealerName: 'EcoHaus SW Ltd', quotationDealerCode: 'EH' }));
  assert.doesNotThrow(() => assertCommercialDealerIdentity({ sourceDealerName: 'EKO-OKNA', sourceAuthority: 'explicit_document_issuer', configuredDealer: { supplierCode: 'EKO', supplierName: 'EKO' }, quotationDealerName: 'EKO', quotationDealerCode: 'EKO' }));
  assert.doesNotThrow(() => assertCommercialDealerIdentity({ sourceDealerName: 'EKO-OKNA', sourceAuthority: 'explicit_document_issuer', configuredDealer: { supplierCode: 'EKO', supplierName: 'EKO' }, quotationDealerName: 'Automatic identification pending', quotationDealerCode: 'AUTO-FIXTURE' }));
  assert.throws(() => assertCommercialDealerIdentity({ sourceDealerName: 'EcoHaus', sourceAuthority: 'explicit_document_issuer', configuredDealer: { supplierCode: 'ZF', supplierName: 'Zyle Fenster' }, quotationDealerName: 'Zyle Fenster', quotationDealerCode: 'ZF' }), (error) => error.code === 'dealer_identity_mismatch');
  assert.throws(() => assertCommercialDealerIdentity({ sourceDealerName: 'EcoHaus', sourceAuthority: 'explicit_document_issuer', configuredDealer: ecohaus, quotationDealerName: 'Zyle Fenster', quotationDealerCode: 'ZF' }), (error) => error.code === 'quotation_aggregate_dealer_mismatch');
});

test('canonical positions are reusable across own revisions but isolated across dealer quotation aggregates', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-commercial-isolation-'));
  const db = await open({ filename: path.join(root, 'bridge.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("CREATE TABLE estimates(id TEXT PRIMARY KEY,positions_json TEXT,updated_at TEXT);CREATE TABLE supplier_position_applications(estimate_id TEXT,supplier_quote_position_id TEXT,target_estimate_position_id TEXT,action TEXT,active INTEGER,applied_at TEXT);INSERT INTO estimates VALUES('estimate','[]',datetime('now'));");
  const base = { estimateId: 'estimate', sourceSequence: 0, displayReference: 'A', quantity: 1, widthMm: 1000, heightMm: 660, supplierName: 'EcoHaus', supplierCode: 'EH', quotationReference: '20260057' };
  const first = await linkSupplierPositionToEstimate(db, { ...base, sourceQuoteId: 'eco-quote', sourceRevisionId: 'eco-r1', sourcePositionId: 'eco-a-r1' });
  const revision = await linkSupplierPositionToEstimate(db, { ...base, sourceQuoteId: 'eco-quote', sourceRevisionId: 'eco-r2', sourcePositionId: 'eco-a-r2' });
  const otherDealer = await linkSupplierPositionToEstimate(db, { ...base, sourceQuoteId: 'glass-quote', sourceRevisionId: 'glass-r1', sourcePositionId: 'glass-a-r1', supplierName: 'Glass Worx', supplierCode: 'GW', quotationReference: '25-116' });
  assert.equal(revision.position.id, first.position.id);
  assert.notEqual(otherDealer.position.id, first.position.id);
  const positions = await readCanonicalEstimatePositions(db, 'estimate');
  assert.equal(positions.length, 2);
  assert.deepEqual(positions.map((position) => position.supplierEvidenceLinks.map((link) => link.sourceQuoteId)), [['eco-quote', 'eco-quote'], ['glass-quote']]);
});

test('Glass Worx and EcoHaus confirmations coexist in Products and Costing even with matching position signatures', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-multi-dealer-confirmation-'));
  const db = await open({ filename: path.join(root, 'multi.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-FIXTURE','Fixture',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-FIXTURE','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await db.exec("CREATE TABLE IF NOT EXISTS configurator_manufacturers(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);INSERT INTO configurator_manufacturers(id,name,code,is_active) VALUES('manufacturer-internorm','Internorm','IN',1);");
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  for (const dealer of [{ code: 'GW', name: 'Glass Worx' }, { code: 'EH', name: 'EcoHaus' }]) await calculator.saveSupplierCommercialDefault({ supplierCode: dealer.code, supplierName: dealer.name, policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Products / Supply', currency: 'GBP', packageCode: 'supply_only' });
  const rowFor = (dealer) => { const original = { displayReference: 'A', supplierReferenceTokens: ['A'], quantity: 1, widthMm: 1000, heightMm: 660, unitPrice: '500.00', totalPrice: '500.00', currency: 'GBP', classification: 'standard', includedInSupplierTotal: true }; return { ordinal: 0, ...original, manufacturerEvidence: { manufacturerName: 'Internorm', product: 'Window', productSystem: 'HF410', customerSafeSpecification: [] }, sourcePages: [1], sourceTrace: [{ pageNumber: 1 }], warnings: [], status: 'extracted', originalExtractedSnapshot: { ...original, dealer } }; };
  const service = createSupplierQuotesService(db, {
    attachmentRoot: root,
    fileSupplierAttachments: false,
    extractDocument: async (_file, attachment) => ({ textAvailable: true, dealer: attachment.id.startsWith('glass') ? 'Glass Worx' : 'EcoHaus', warnings: [], pages: [{ blocks: [{ id: 'A', text: 'A' }] }] }),
    parseFields: (document) => ({ supplier: document.dealer, manufacturer: 'Internorm', supplierIdentity: { authority: 'explicit_document_issuer' }, rows: [rowFor(document.dealer)], warnings: [] }),
    parseSummary: () => ({ summary: null, additionalItems: [], warnings: [] }),
    derivePreviews: async () => ({ warnings: [] }),
  });
  for (const dealer of [{ code: 'GW', name: 'Glass Worx', quote: '25-116', attachment: 'glass-source' }, { code: 'EH', name: 'EcoHaus', quote: '20260057', attachment: 'eco-source' }]) {
    const quote = await service.createQuote('estimate', { supplierCode: dealer.code, supplierName: dealer.name });
    const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: dealer.quote, currency: 'GBP' });
    const selection = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: dealer.attachment }];
    await service.insertAttachments('estimate', quote.id, revision.id, [{ id: dealer.attachment, role: 'original_quote', documentKind: 'complete_quotation', originalFileName: `${dealer.quote}.pdf`, mediaType: 'application/pdf', sizeBytes: 1, sha256: dealer.code.toLowerCase().repeat(32), storageKey: `${dealer.quote}.pdf`, parserEligible: true, createdAt: new Date().toISOString() }]);
    const review = await service.prepareImportReview('estimate', selection);
    await service.extractAndLoadSupplierCosts('estimate', scenario.id, selection, { selectedRowKeys: review.documents[0].rows.map((row) => row.rowKey), supplierCode: dealer.code, manufacturerId: 'manufacturer-internorm', metadata: { quotationNumber: dealer.quote, currency: 'GBP' } });
  }
  const ecoQuote = await db.get("SELECT id FROM supplier_quotes WHERE supplier_code='EH'");
  const ecoRevision2 = await service.createRevision('estimate', ecoQuote.id, { supplierQuotationNumber: '20260057', supplierRevision: '2', currency: 'GBP' });
  const revisionSelection = [{ quoteId: ecoQuote.id, revisionId: ecoRevision2.id, attachmentId: 'eco-r2-source' }];
  await service.insertAttachments('estimate', ecoQuote.id, ecoRevision2.id, [{ id: 'eco-r2-source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: '20260057-r2.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'e2'.repeat(32), storageKey: '20260057-r2.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  const revisionReview = await service.prepareImportReview('estimate', revisionSelection);
  await service.extractAndLoadSupplierCosts('estimate', scenario.id, revisionSelection, { selectedRowKeys: revisionReview.documents[0].rows.map((row) => row.rowKey), supplierCode: 'EH', manufacturerId: 'manufacturer-internorm', metadata: { quotationNumber: '20260057', revision: '2', currency: 'GBP' } });
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count, 3);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=?', scenario.id)).count, 2);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_supplier_quote_revisions WHERE scenario_id=?', scenario.id)).count, 3);
  assert.equal((await readCanonicalEstimatePositions(db, 'estimate')).length, 2);
  assert.deepEqual((await db.all('SELECT q.supplier_name,r.supplier_quotation_number,r.supplier_revision FROM project_calculator_estimate_product_rows product JOIN supplier_quote_revisions r ON r.id=product.source_revision_id JOIN supplier_quotes q ON q.id=r.supplier_quote_id ORDER BY q.supplier_name')).map((row) => [row.supplier_name, row.supplier_quotation_number, row.supplier_revision]), [['EcoHaus', '20260057', '2'], ['Glass Worx', '25-116', null]]);
});

test('confirmed historical postconditions remain immutable while missing current projections report drift', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-projection-drift-'));
  const db = await open({ filename: path.join(root, 'drift.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec(`
    CREATE TABLE supplier_quote_import_operations(id TEXT,estimate_id TEXT,revision_id TEXT,scenario_id TEXT,status TEXT,intended_counts_json TEXT,post_state_json TEXT,confirmed_at TEXT);
    CREATE TABLE supplier_quote_import_runs(id TEXT,revision_id TEXT);
    CREATE TABLE supplier_quote_positions(id TEXT,revision_id TEXT);
    CREATE TABLE project_calculator_estimate_product_rows(id TEXT,scenario_id TEXT,source_revision_id TEXT,estimate_position_id TEXT);
    CREATE TABLE supplier_quote_extras(id TEXT,revision_id TEXT);
    CREATE TABLE project_calculator_estimate_supplier_costs(id TEXT,scenario_id TEXT,source_revision_id TEXT);
    CREATE TABLE project_calculator_supplier_quote_revisions(scenario_id TEXT,revision_id TEXT);
    INSERT INTO supplier_quote_import_operations VALUES('glass-op','estimate','glass-revision','scenario','confirmed','{"validCanonicalPositions":27}','{"operationCounts":{"productsSupplyRows":27,"projectCostingRows":27}}','2026-08-30T00:00:00.000Z');
  `);
  for (let index = 0; index < 27; index += 1) await db.run('INSERT INTO supplier_quote_positions VALUES(?,?)', `glass-${index}`, 'glass-revision');
  const [drift] = await inspectConfirmedProjectionDrift(db, { estimateId: 'estimate' });
  assert.equal(drift.status, 'projection_drift');
  assert.deepEqual(drift.missing, { supplierPositions: 0, productsSupplyRows: 27, projectCostingRows: 27 });
  assert.equal(drift.historicalPostState.operationCounts.productsSupplyRows, 27);
});

test('confirmation source contains bounded transaction failure stages and no estimate-wide product deletion', async () => {
  const source = await fs.readFile(new URL('../server/features/supplierQuotes/supplierQuotesService.js', import.meta.url), 'utf8');
  for (const stage of ['operation_journal', 'supplier_position_persistence', 'products_projection', 'project_costing_projection', 'package_adjustments', 'revision_reconciliation', 'postcondition_validation']) assert.match(source, new RegExp(`failureInjector\\('${stage}'`));
  assert.doesNotMatch(source, /DELETE FROM project_calculator_estimate_product_rows WHERE scenario_id=\?\s*(?:['"`]|\))/);
  assert.match(source, /sourceQuoteId:quote\.id/);
});
