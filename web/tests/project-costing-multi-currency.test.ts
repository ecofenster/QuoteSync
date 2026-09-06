import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import { normalizeCalculatorScenario } from '../src/features/projectCalculatorLab/domain/normalizeCalculatorScenario.js';
import { manufacturerNameForProduct, originalSupplierPurchaseGroups, productCommercialSourceLabel, supplierNameForProduct } from '../src/features/projectCalculatorLab/domain/projectCostingPresentation.js';

const rates: Record<string, string> = { EUR: '0.86', GBP: '1', PLN: '0.20' };

test('legacy and loading-era API payloads normalize new collections before worksheet rendering', () => {
  const legacy = normalizeCalculatorScenario({ products: undefined, supplierCosts: undefined, packageItems: undefined, routeSnapshots: undefined, exchangeRates: undefined, revisions: undefined, supplierSummary: { productSubtotal: '1000', deliveryTotal: null, finalSupplierTotal: '1000', originalSnapshot: {} } } as unknown as Parameters<typeof normalizeCalculatorScenario>[0]);
  assert.deepEqual(legacy.products, []);
  assert.deepEqual(legacy.exchangeRates, []);
  assert.equal(legacy.importCustoms, null);
  assert.deepEqual(legacy.supplierSummary?.quotations, []);
  assert.equal(legacy.supplierSummary?.finalSupplierTotalGbp, null);
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quotesync-multifx-'));
  const db = await open({ filename: path.join(root, 'test.sqlite'), driver: sqlite3.Database });
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    INSERT INTO clients VALUES('client','C-1','Client',datetime('now'),datetime('now'));
    INSERT INTO estimates(id,estimate_ref,client_id,status,positions_json,created_at,updated_at) VALUES('estimate','E-1','client','draft','[]',datetime('now'),datetime('now'));`);
  await initializeSupplierCommercialSchema(db);
  const provider = async (currency: string) => ({ provider: currency === 'GBP' ? 'identity' : 'test-fx', quotedAt: `2026-08-09T0${currency === 'EUR' ? 1 : currency === 'PLN' ? 2 : 0}:00:00.000Z`, rawRate: rates[currency] });
  return { root, db, provider };
}
function extractedRow(documentId: string, currency: string) {
  const unpriced = documentId === 'unpriced';
  return { ordinal: 0, displayReference: unpriced ? 'S1-S10' : documentId === 'eur' ? 'W7, W8' : documentId.toUpperCase(), originalReferenceText: documentId, supplierReferenceTokens: [documentId], quantity: unpriced ? 10 : documentId === 'eur' ? 2 : 1, widthMm: 1000, heightMm: 1000, unitPrice: unpriced ? null : documentId === 'eur' ? '500' : documentId === 'gbp' ? '4850' : '31000', totalPrice: unpriced ? null : documentId === 'eur' ? '1000' : documentId === 'gbp' ? '4850' : '31000', currency, sourcePages: [1], sourceTrace: [], warnings: [], status: 'extracted', originalExtractedSnapshot: {} };
}

test('EUR, GBP and PLN revisions retain independent FX provenance and aggregate in GBP', async () => {
  const { root, db, provider } = await setup();
  try {
    const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: provider });
    const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Mixed supplier costing', currency: 'GBP', packageCode: 'supply_only' });
    const documents: Record<string, { currency: string; total: string }> = { eur: { currency: 'EUR', total: '1000' }, gbp: { currency: 'GBP', total: '4850' }, pln: { currency: 'PLN', total: '31000' } };
    const supplier = createSupplierQuotesService(db, { attachmentRoot: root, extractDocument: async (_filename, metadata) => ({ textAvailable: true, warnings: [], documentId: metadata.id }), parseFields: (document: any, { currency }: any) => ({ rows: [extractedRow(document.documentId, currency)], warnings: [] }), parseSummary: (document: any) => ({ summary: { productSubtotal: documents[document.documentId].total, additionalItemsSubtotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: documents[document.documentId].total }, additionalItems: [], warnings: [] }) });
    const selected: Array<{ quoteId: string; revisionId: string; attachmentId: string; supplierCode: string }> = [];
    for (const [id, data] of Object.entries(documents)) {
      await calculator.saveSupplierCommercialDefault({ supplierCode: id.toUpperCase(), supplierName: `${id.toUpperCase()} Supplier`, policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price', paidInQuotedCurrency: true, settlementCurrency: data.currency }, pricingDisplayPolicy: {} });
      const quote = await supplier.createQuote('estimate', { supplierCode: id.toUpperCase(), supplierName: `${id.toUpperCase()} Supplier` });
      const revision = await supplier.createRevision('estimate', quote.id, { supplierQuotationNumber: `Q-${id}`, supplierRevision: '1', currency: data.currency });
      await supplier.insertAttachments('estimate', quote.id, revision.id, [{ id, role: 'original_quote', documentKind: 'complete_quotation', originalFileName: `${id}.pdf`, mediaType: 'application/pdf', sizeBytes: 1, sha256: id.padEnd(64, id[0]), storageKey: id, parserEligible: true, createdAt: new Date().toISOString() }]);
      const selection = { quoteId: quote.id, revisionId: revision.id, attachmentId: id };
      const imported = await supplier.extractAndLoadSupplierCosts('estimate', scenario.id, [selection], { commercialSupplierCode: id.toUpperCase() });
      await calculator.ensureSupplierRevisionExchangeRates(scenario.id, imported.documents.map(item => item.revisionId));
      selected.push({ ...selection, supplierCode: id.toUpperCase() });
    }
    const loaded = await calculator.getScenario(scenario.id);
    assert.equal(loaded.products.length, 3);
    assert.equal(loaded.products.find((item: any) => item.displayReference === 'W7, W8').quantity, 2);
    assert.equal(loaded.products.find((item: any) => item.currency === 'EUR').originalAmount, '1000');
    assert.equal(loaded.products.find((item: any) => item.currency === 'EUR').gbpAmount, '870.00');
    assert.equal(loaded.products.find((item: any) => item.currency === 'EUR').commercialGbpAmount, '870.00');
    assert.equal(loaded.products.find((item: any) => item.currency === 'GBP').gbpAmount, '4850.00');
    assert.equal(loaded.products.find((item: any) => item.currency === 'GBP').fxSnapshot.provider, 'identity');
    assert.equal(loaded.products.find((item: any) => item.currency === 'PLN').originalAmount, '31000');
    assert.equal(loaded.products.find((item: any) => item.currency === 'PLN').gbpAmount, '6510.00');
    assert.equal(loaded.products.find((item: any) => item.currency === 'PLN').commercialGbpAmount, '6510.00');
    assert.equal(loaded.exchangeRates.length, 3);
    assert.deepEqual(new Set(loaded.exchangeRates.map((item: any) => item.supplierCurrency)), new Set(['EUR', 'GBP', 'PLN']));
    assert.equal(loaded.supplierSummary.finalSupplierTotalGbp, '12230.00');
    assert.deepEqual(originalSupplierPurchaseGroups(loaded), { EUR: ['1000'], GBP: ['4850'], PLN: ['31000'] });
    assert.equal(supplierNameForProduct(loaded.products.find((item: any) => item.currency === 'GBP')), 'GBP Supplier');
    const dealerProduct = { ...loaded.products.find((item: any) => item.currency === 'GBP'), sourceSnapshot: { supplierName: 'EcoHaus', supplierQuotationNumber: '20260057', manufacturerEvidence: { manufacturerName: 'Internorm' } } };
    assert.equal(manufacturerNameForProduct(dealerProduct), 'Internorm');
    assert.equal(productCommercialSourceLabel(dealerProduct), 'Internorm · supplied by EcoHaus · quote 20260057');
    const directProduct = { ...dealerProduct, sourceSnapshot: { supplierName: 'Internorm', supplierQuotationNumber: 'DIRECT-1', manufacturerEvidence: { manufacturerName: 'Internorm' } } };
    assert.equal(productCommercialSourceLabel(directProduct), 'Internorm · quote DIRECT-1');
    const persistedRows = await db.all('SELECT currency,purchase_amount_gbp,selling_amount_gbp,fx_snapshot_id FROM project_calculator_estimate_product_rows WHERE scenario_id=? ORDER BY currency', scenario.id);
    assert.deepEqual(persistedRows.map(item => [item.currency, item.purchase_amount_gbp, item.selling_amount_gbp, Boolean(item.fx_snapshot_id)]), [['EUR', '870.00', '870.00', true], ['GBP', '4850.00', '4850.00', true], ['PLN', '6510.00', '6510.00', true]]);
    assert.deepEqual((await calculator.getScenario(scenario.id)).exchangeRates, loaded.exchangeRates);
    for (const item of selected) {
      const duplicate = await supplier.extractAndLoadSupplierCosts('estimate', scenario.id, [item], { commercialSupplierCode: item.supplierCode });
      assert.equal(duplicate.documents.reduce((sum, document) => sum + document.loadedProducts + document.loadedCosts, 0), 0);
    }
  } finally { await db.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('unpriced schedule converts only its total and explicit refresh preserves prior revision FX', async () => {
  const { root, db, provider } = await setup();
  try {
    const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: provider });
    await calculator.saveSupplierCommercialDefault({ supplierCode: 'SCHED', supplierName: 'Schedule Supplier', policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price', paidInQuotedCurrency: true, settlementCurrency: 'EUR' }, pricingDisplayPolicy: {} });
    const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Unpriced schedule', currency: 'GBP', packageCode: 'supply_only' });
    const supplier = createSupplierQuotesService(db, { attachmentRoot: root, extractDocument: async () => ({ textAvailable: true, warnings: [], documentId: 'unpriced' }), parseFields: (_document: any, { currency }: any) => ({ rows: [extractedRow('unpriced', currency)], warnings: [] }), parseSummary: () => ({ summary: { productSubtotal: null, additionalItemsSubtotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: '20000' }, additionalItems: [], warnings: [] }) });
    const quote = await supplier.createQuote('estimate', { supplierCode: 'SCHED', supplierName: 'Schedule Supplier' });
    const revision = await supplier.createRevision('estimate', quote.id, { supplierQuotationNumber: 'S-1', supplierRevision: '1', currency: 'EUR' });
    await supplier.insertAttachments('estimate', quote.id, revision.id, [{ id: 'unpriced', role: 'original_quote', documentKind: 'window_schedule', originalFileName: 'schedule.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'a'.repeat(64), storageKey: 'unpriced', parserEligible: true, createdAt: new Date().toISOString() }]);
    const imported = await supplier.extractAndLoadSupplierCosts('estimate', scenario.id, [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'unpriced' }], { commercialSupplierCode: 'SCHED' });
    await calculator.ensureSupplierRevisionExchangeRates(scenario.id, [revision.id]);
    let loaded = await calculator.getScenario(scenario.id);
    assert.equal(loaded.products[0].totalPrice, null);
    assert.equal(loaded.unpricedSupplierTotals[0].originalAmount, '20000');
    assert.equal(loaded.unpricedSupplierTotals[0].purchaseAmountGbp, '17400.00');
    assert.equal(loaded.unpricedSupplierTotals[0].sellingAmountGbp, '17400.00');
    await calculator.createRevision(scenario.id);
    const originalSnapshotId = loaded.exchangeRates[0].id;
    rates.EUR = '0.84';
    loaded = await calculator.refreshExchangeRate(scenario.id);
    assert.equal(loaded.exchangeRates[0].supplierToGbpLiveRate, '0.84');
    assert.notEqual(loaded.exchangeRates[0].id, originalSnapshotId);
    const snapshots = await db.all('SELECT supplier_to_gbp_live_rate FROM project_calculator_supplier_fx_snapshots WHERE scenario_id=? ORDER BY created_at', scenario.id);
    assert.deepEqual(snapshots.map(item => item.supplier_to_gbp_live_rate), ['0.86', '0.84']);
    const savedRevision = await db.get("SELECT snapshot_json FROM project_calculator_lab_revisions WHERE scenario_id=? AND reason='revision_created' ORDER BY created_at DESC LIMIT 1", scenario.id);
    assert.equal(JSON.parse(savedRevision.snapshot_json).supplierExchangeRates[0].supplier_to_gbp_live_rate, '0.86');
    assert.equal(imported.documents[0].loadedProducts, 1);
  } finally { rates.EUR = '0.86'; await db.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('new single-snapshot costings use the fixed Estimate rate', async () => {
  const { root, db, provider } = await setup();
  try {
    const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: provider });
    const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Legacy EUR costing', currency: 'EUR', packageCode: 'supply_only' });
    await calculator.addManualProduct(scenario.id, { reference: 'LEGACY-1', productClass: 'Other', widthMm: 1000, heightMm: 1000, quantity: 1, installationOpeningCount: 1, unitSupplyCost: '1000', totalSupplyCost: '1000', currency: 'EUR' });
    const loaded = await calculator.getScenario(scenario.id);
    assert.equal(loaded.exchangeRates.length, 0);
    assert.equal(loaded.exchangeRate.supplierToGbpLiveRate, '0.86');
    assert.equal(loaded.products[0].originalAmount, '1000');
    assert.equal(loaded.exchangeRate.estimateFixedRate, '0.87');
    assert.equal(loaded.products[0].gbpAmount, '870.00');
    assert.equal(loaded.products[0].commercialGbpAmount, '870.00');
  } finally { await db.close(); await fs.rm(root, { recursive: true, force: true }); }
});
