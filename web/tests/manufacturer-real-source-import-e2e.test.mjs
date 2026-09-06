import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { assertCommercialDealerIdentity } from '../server/features/supplierQuotes/supplierIdentity.js';
import { createSupplierQuotesRouter } from '../server/routes/supplierQuotes.js';
import { createProjectCalculatorLabRouter } from '../server/routes/projectCalculatorLab.js';
import { createManufacturerPositionVisualsRouter } from '../server/routes/manufacturerPositionVisuals.js';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { replaceEditableEstimatePositions } from '../server/features/estimatePositions/canonicalEstimatePositions.js';

const sourcePath = path.resolve('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf');
const sourceSha256 = 'd1f34d3fd36ef40e4fb1b3ccbddc96b96837fdfd86f598af9c2b189f674f1899';
const now = '2026-09-04T12:00:00.000Z';

test('historical issuer-as-commercial-supplier gate exposes the exception previously wrapped as supplier_load_failed', () => {
  assert.throws(() => assertCommercialDealerIdentity({
    sourceDealerName: 'Ecofenster',
    sourceAuthority: 'explicit_document_issuer',
    configuredDealer: { supplierCode: 'EKO', supplierName: 'EKO-OKNA' },
    quotationDealerName: 'Automatic identification pending',
    quotationDealerCode: 'AUTO-JOHN',
  }), (error) => error.code === 'dealer_identity_mismatch' && error.message === 'The quotation issuer Ecofenster cannot be confirmed against EKO-OKNA.');
});

async function setup(t, { failureInjector = async () => {}, ekoActive = true, includeLegacyAnyRows = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-john-wingfield-e2e-'));
  const attachmentRoot = path.join(root, 'attachments');
  const db = await open({ filename: path.join(root, 'quotesuite.sqlite'), driver: sqlite3.Database });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('disposable-client','TEST-CL-JW','John Wingfield disposable',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('disposable-estimate','TEST-EST-JW','disposable-client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await db.exec("CREATE TABLE IF NOT EXISTS configurator_manufacturers(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);INSERT INTO configurator_manufacturers(id,name,code,is_active) VALUES('manufacturer-eko','EKO-OKNA','EKO',1);");
  let currentEurRate = '0.85898';
  const rates = async (currency) => ({ rawRate: String(currency).toUpperCase() === 'GBP' ? '1' : currentEurRate, provider: 'exact-source-test', quotedAt: now });
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: rates });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'EKO', supplierName: 'EKO-OKNA', active: ekoActive, policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price', paidInQuotedCurrency: true, settlementCurrency: 'EUR' }, pricingDisplayPolicy: {} });
  if (includeLegacyAnyRows) for (const code of ['FACTORY PRICE', '1 TO 1 PRICING', 'STAGED DISCOUNT']) await calculator.saveSupplierCommercialDefault({ supplierCode: code, supplierName: 'Any', policy: { pricingMethod: 'factory_price', pricingBasis: 'factory_price' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'disposable-estimate', origin: 'estimate', name: 'Disposable John Wingfield costing', currency: 'EUR', packageCode: 'supply_only' });

  const errors = [];
  const app = express();
  app.use(express.json());
  app.use('/api/estimates', await createSupplierQuotesRouter({ dbPromise: Promise.resolve(db), attachmentRoot, exchangeRateProvider: rates, supplierServiceOptions: { failureInjector, fileSupplierAttachments: false } }));
  app.use('/api/admin/project-calculator-lab', await createProjectCalculatorLabRouter({ dbPromise: Promise.resolve(db), exchangeRateProvider: rates }));
  app.use('/api/manufacturer-position-visuals', createManufacturerPositionVisualsRouter({ attachmentRoot }));
  app.use((error, request, response, _next) => {
    errors.push({ code: error?.code ?? null, message: error instanceof Error ? error.message : String(error), stack: error?.stack ?? null });
    response.status(500).json({ code: error?.code ?? 'test_error', error: error instanceof Error ? error.message : String(error) });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  return { db, calculator, scenario, errors, origin: `http://127.0.0.1:${address.port}`, setCurrentEurRate: (rate) => { currentEurRate = String(rate); } };
}

async function request(origin, pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.equal(response.ok, true, `${options.method ?? 'GET'} ${pathname} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function uploadAndReview(origin) {
  const source = await fs.readFile(sourcePath);
  assert.equal(source.length, 239162);
  assert.equal(createHash('sha256').update(source).digest('hex'), sourceSha256);

  const base = '/api/estimates/disposable-estimate/supplier-quotes';
  const quote = await request(origin, base, json({ supplierCode: 'AUTO-JOHN', supplierName: 'Automatic identification pending' }));
  const revision = await request(origin, `${base}/${quote.id}/revisions`, json({ supplierQuotationNumber: '', supplierRevision: '', fullQuotationReference: 'Analysis pending', currency: 'XXX' }));
  const form = new FormData();
  form.append('files', new Blob([source], { type: 'application/pdf' }), 'web-26-1133450.pdf');
  form.append('role', 'original_quote');
  form.append('documentKind', 'complete_quotation');
  const uploaded = await request(origin, `${base}/${quote.id}/revisions/${revision.id}/attachments`, { method: 'POST', body: form });
  const attachment = uploaded.attachments[0];
  assert.equal(attachment.sha256, sourceSha256);
  const retrieved = Buffer.from(await (await fetch(`${origin}${base}/${quote.id}/revisions/${revision.id}/attachments/${attachment.id}/download`)).arrayBuffer());
  assert.equal(createHash('sha256').update(retrieved).digest('hex'), sourceSha256);

  const documents = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: attachment.id }];
  const review = await request(origin, `${base}/prepare-review`, json({ documents }));
  assert.equal(review.positionCount, 5);
  assert.equal(review.documents[0].rows.filter((row) => row.sourceVisual?.status === 'available').length, 5);
  assert.equal(review.metadata.supplierQuotedTotal, '7885.45');
  assert.equal(review.metadata.recognizedDealerName, 'Ecofenster');
  assert.equal(review.metadata.recognizedManufacturerName, 'EKO-OKNA');
  assert.equal(review.metadata.recognizedCommercialSupplierName, 'EKO-OKNA');
  const selectedRowKeys = review.documents[0].rows.map((row) => row.rowKey);
  return { base, quote, revision, attachment, documents, review, selectedRowKeys };
}

const confirmationBody = (scenarioId, prepared) => ({
  scenarioId,
  documents: prepared.documents,
  selectedRowKeys: prepared.selectedRowKeys,
  commercialSupplierCode: 'EKO',
  manufacturerId: 'manufacturer-eko',
  metadata: { quotationNumber: 'WEB/26/1133450', revision: '', quotationDate: '2026-09-03', currency: 'EUR', documentType: 'complete_quotation' },
});

test('exact John Wingfield raw PDF completes final supplier load and Project Costing reload', { timeout: 180_000 }, async (t) => {
  const { db, calculator, scenario, errors, origin, setCurrentEurRate } = await setup(t);
  const prepared = await uploadAndReview(origin);

  const confirmation = await request(origin, `${prepared.base}/extract-and-load`, json(confirmationBody(scenario.id, prepared)));
  assert.deepEqual(errors, []);
  assert.equal(confirmation.operationStatus, 'confirmed');
  assert.equal(confirmation.counts.persistedPositions, 5);
  assert.equal(confirmation.counts.productsSupplyRows, 5);
  assert.equal(confirmation.counts.projectCostingRows, 5);

  const reloaded = await request(origin, `/api/admin/project-calculator-lab/scenarios/${scenario.id}?estimate_id=disposable-estimate`);
  assert.equal(reloaded.products.length, 5);
  assert.equal(new Set(reloaded.products.map((row) => row.sourceRowId)).size, 5);
  assert.equal(reloaded.supplierCommercialPolicies.length, 1);
  assert.equal(reloaded.supplierCommercialPolicies[0].pricingMethod, 'factory_price');
  assert.equal(reloaded.supplierCommercialPolicies[0].policy.pricingMethod, 'factory_price');
  assert.equal(Number(reloaded.supplierCommercialPolicies[0].actualGbpPurchaseCost).toFixed(2), '6860.34');
  assert.equal(reloaded.supplierSummary.productSubtotal, '7885.45');
  assert.equal(reloaded.supplierSummary.finalSupplierTotal, '7885.45');
  assert.equal(reloaded.products.reduce((sum, row) => sum + Number(row.totalPrice), 0).toFixed(2), '7885.45');
  assert.equal(reloaded.products.reduce((sum, row) => sum + Number(row.gbpAmount), 0).toFixed(2), '6860.34');
  assert.equal(reloaded.exchangeRates[0].liveMarketRate, '0.85898');
  assert.equal(reloaded.exchangeRates[0].estimateFixedRate, '0.87');
  assert.equal(reloaded.exchangeRates[0].costingRateBasis, 'estimate_fixed');
  for (const row of reloaded.products) {
    assert.equal(row.sourceSnapshot.commercialSupplier.supplierCode, 'EKO');
    assert.equal(row.sourceSnapshot.commercialSupplier.supplierName, 'EKO-OKNA');
    assert.equal(row.sourceSnapshot.documentIssuer.name, 'Ecofenster');
    assert.equal(row.sourceSnapshot.canonicalManufacturer.manufacturerName, 'EKO-OKNA');
    assert.match(row.sourceSnapshot.manufacturerSystemIdentity.systemCode, /REYNAERS MASTER LINE 8/i);
    assert.equal(row.sourceSnapshot.manufacturerEvidence.sourceVisual.status, 'available');
    assert.ok(row.sourceSnapshot.manufacturerEvidence.productSystem || row.sourceSnapshot.manufacturerEvidence.configurationDescription || row.sourceSnapshot.manufacturerEvidence.glassSpecification);
    const preview = await fetch(`${origin}${row.sourceSnapshot.manufacturerEvidence.sourceVisual.url}`);
    assert.equal(preview.ok, true);
    assert.ok((await preview.arrayBuffer()).byteLength > 10_000);
  }
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', prepared.revision.id)).count, 5);

  assert.equal(JSON.parse((await db.get('SELECT positions_json FROM estimates WHERE id=?', 'disposable-estimate')).positions_json).length, 5);
  await replaceEditableEstimatePositions(db, { estimateId: 'disposable-estimate', incomingPositions: [] });
  assert.equal(JSON.parse((await db.get('SELECT positions_json FROM estimates WHERE id=?', 'disposable-estimate')).positions_json).length, 5);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=?', scenario.id)).count, 5);
  const synchronized = await calculator.syncEstimatePositions(scenario.id);
  assert.equal(synchronized.products.length, 5);
  const secondReload = await request(origin, `/api/admin/project-calculator-lab/scenarios/${scenario.id}?estimate_id=disposable-estimate`);
  assert.equal(secondReload.products.length, 5);
  assert.equal(secondReload.products.filter((row) => row.sourceSnapshot.manufacturerEvidence.sourceVisual.status === 'available').length, 5);
  assert.deepEqual(secondReload.products.map((row) => row.sourceSnapshot.manufacturerEvidence), reloaded.products.map((row) => row.sourceSnapshot.manufacturerEvidence));

  setCurrentEurRate('0.875');
  const liveRate = await request(origin, `/api/admin/project-calculator-lab/scenarios/${scenario.id}/exchange-rate/live`);
  assert.deepEqual(liveRate.rates.map((item) => [item.currency, item.rate]), [['EUR', '0.875']]);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_supplier_fx_snapshots WHERE scenario_id=?', scenario.id)).count, 1);
  const unchangedAfterPolling = await request(origin, `/api/admin/project-calculator-lab/scenarios/${scenario.id}?estimate_id=disposable-estimate`);
  assert.equal(unchangedAfterPolling.exchangeRates[0].estimateFixedRate, '0.87');
  assert.equal(unchangedAfterPolling.products.reduce((sum, row) => sum + Number(row.gbpAmount), 0).toFixed(2), '6860.34');
  const refreshedRate = await request(origin, `/api/admin/project-calculator-lab/scenarios/${scenario.id}/exchange-rate/refresh`, json({}));
  assert.equal(refreshedRate.exchangeRates[0].liveMarketRate, '0.875');
  assert.equal(refreshedRate.exchangeRates[0].estimateFixedRate, '0.89');
  assert.equal(Number(refreshedRate.supplierCommercialPolicies[0].actualGbpPurchaseCost).toFixed(2), '7018.05');
  assert.equal(refreshedRate.products.reduce((sum, row) => sum + Number(row.gbpAmount), 0).toFixed(2), '7018.05');
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_supplier_fx_snapshots WHERE scenario_id=?', scenario.id)).count, 2);
  assert.deepEqual(refreshedRate.exchangeRateHistory.map((item) => [item.liveMarketRate, item.estimateFixedRate]), [['0.875', '0.89'], ['0.85898', '0.87']]);
  const savedFirstRate = await db.get('SELECT supplier_to_gbp_live_rate,supplier_to_gbp_selling_rate,costing_rate_basis FROM project_calculator_supplier_fx_snapshots WHERE scenario_id=? ORDER BY scenario_revision LIMIT 1', scenario.id);
  assert.deepEqual(savedFirstRate, { supplier_to_gbp_live_rate: '0.85898', supplier_to_gbp_selling_rate: '0.87', costing_rate_basis: 'estimate_fixed' });

  const replay = await request(origin, `${prepared.base}/extract-and-load`, json(confirmationBody(scenario.id, prepared)));
  assert.equal(replay.documents[0].idempotentReplay, true);
  const replayReload = await request(origin, `/api/admin/project-calculator-lab/scenarios/${scenario.id}?estimate_id=disposable-estimate`);
  assert.equal(replayReload.products.length, 5);
  assert.equal(JSON.parse((await db.get('SELECT positions_json FROM estimates WHERE id=?', 'disposable-estimate')).positions_json).length, 5);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs WHERE revision_id=?', prepared.revision.id)).count, 1);
});

test('exact John Wingfield real-state shape treats listed EKO as current and excludes legacy Any method holders', { timeout: 180_000 }, async (t) => {
  const context = await setup(t, { ekoActive: false, includeLegacyAnyRows: true });
  const prepared = await uploadAndReview(context.origin);
  assert.deepEqual(prepared.review.commercialSuppliers.map((item) => [item.supplierCode, item.supplierName, item.active, item.pricingPolicyAvailable]), [['EKO', 'EKO-OKNA', true, true]]);
  assert.equal(prepared.review.metadata.commercialSupplierCode, 'EKO');
  assert.equal(prepared.review.metadata.commercialSupplierName, 'EKO-OKNA');
  assert.equal(prepared.review.metadata.commercialSupplierProposalSource, 'document_family');
  assert.equal(prepared.review.metadata.commercialSupplierActive, true);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count, 0);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows')).count, 0);
});

test('exact John Wingfield API final-load failure rolls back all commercial projections', { timeout: 180_000 }, async (t) => {
  const injected = Object.assign(new Error('Controlled exact-source products projection failure.'), { code: 'controlled_products_projection_failure' });
  const context = await setup(t, { failureInjector: async (stage) => { if (stage === 'products_projection') throw injected; } });
  const prepared = await uploadAndReview(context.origin);
  const response = await fetch(`${context.origin}${prepared.base}/extract-and-load`, json(confirmationBody(context.scenario.id, prepared)));
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.code, 'supplier_load_failed');
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', prepared.revision.id)).count, 0);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE source_revision_id=?', prepared.revision.id)).count, 0);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM project_calculator_supplier_quote_revisions WHERE revision_id=?', prepared.revision.id)).count, 0);
  assert.equal((await context.db.get("SELECT COUNT(*) count FROM supplier_quote_import_operations WHERE revision_id=? AND status='confirmed'", prepared.revision.id)).count, 0);
  assert.equal((await context.db.get("SELECT COUNT(*) count FROM supplier_quote_import_runs WHERE revision_id=? AND confirmation_status='confirmed'", prepared.revision.id)).count, 0);
  assert.deepEqual(await context.db.get('SELECT supplier_code,supplier_name FROM supplier_quotes WHERE id=?', prepared.quote.id), { supplier_code: 'AUTO-JOHN', supplier_name: 'Automatic identification pending' });
  assert.deepEqual(await context.db.get('SELECT supplier_quotation_number,quotation_date,currency,lifecycle_status FROM supplier_quote_revisions WHERE id=?', prepared.revision.id), { supplier_quotation_number: '', quotation_date: null, currency: 'XXX', lifecycle_status: 'uploaded' });
  assert.equal((await context.db.get('SELECT positions_json FROM estimates WHERE id=?', 'disposable-estimate')).positions_json, '[]');
  const reloaded = await request(context.origin, `/api/admin/project-calculator-lab/scenarios/${context.scenario.id}?estimate_id=disposable-estimate`);
  assert.equal(reloaded.products.length, 0);
});
