import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { createSupplierImportConfirmationResponse } from '../server/features/supplierQuotes/supplierImportConfirmation.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';

const visual = (reference) => ({ kind: 'manufacturer_document_image', status: 'available', url: `/fixtures/${reference}.png`, originalAsset: { mediaType: 'image/x-emf', storageKey: `fixtures/${reference}.emf` }, mappingReviewStatus: 'mapped_automatic', mappingConfidence: 'strong' });
const sourceRow = (ordinal) => {
  const alternative = ordinal === 21;
  const reference = alternative ? 'W22 ALT' : `W${ordinal + 1}`;
  const manufacturerEvidence = { manufacturerItemNumber: String(ordinal + 1), customerReference: reference, product: 'Window', productSystem: '92 Europa window', configurationDescription: 'Tilt and turn', areaSquareMetres: '1.08', manufacturerQuotedUg: '0.5', manufacturerQuotedUw: '0.8', customerSafeSpecification: [], sourceVisual: visual(reference) };
  const original = { displayReference: reference, supplierReferenceTokens: [reference], quantity: 1, widthMm: 1200, heightMm: 900, unitPrice: '500.00', totalPrice: '500.00', currency: 'GBP', classification: alternative ? 'alternative' : 'standard', includedInSupplierTotal: !alternative, alternativeTo: alternative ? 'W21' : null, classificationEvidence: alternative ? 'Supplier marks this position as an alternative.' : null, manufacturerEvidence };
  return { id: `row-${ordinal}`, ordinal, ...original, ...manufacturerEvidence, sourcePages: [1], sourceTrace: [{ pageNumber: 1, boundingBox: { x: 1, y: ordinal + 1, width: 2, height: 2 } }], confidence: '0.98', warnings: [], status: 'extracted', originalExtractedSnapshot: original };
};

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-confirmation-'));
  const db = await open({ filename: path.join(root, 'test.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-001','Client',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-2026-001','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async (currency) => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: currency === 'GBP' ? '1' : '0.85' }) });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'ZF', supplierName: 'Zyle Fenster', policy: { pricingMethod: 'parity_1_to_1', pricingBasis: 'parity_1_to_1', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Products / Supply', currency: 'GBP', packageCode: 'supply_only' });
  const rows = Array.from({ length: 22 }, (_, ordinal) => sourceRow(ordinal));
  const supplier = createSupplierQuotesService(db, {
    attachmentRoot: root,
    extractDocument: async () => ({ textAvailable: true, warnings: [], pages: [{ blocks: rows.map((row) => ({ id: row.id, text: row.displayReference })) }] }),
    parseFields: () => ({ quotation: { supplierQuotationNumber: '343117', supplierRevision: '5' }, rows: rows.map((row) => structuredClone(row)), warnings: [] }),
    parseSummary: () => ({ summary: null, additionalItems: [], warnings: [] }),
  });
  const quote = await supplier.createQuote('estimate', { supplierCode: 'ZF', supplierName: 'Zyle Fenster' });
  const revision = await supplier.createRevision('estimate', quote.id, { supplierQuotationNumber: '343117', supplierRevision: '5', currency: 'EUR' });
  await supplier.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'fixture.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 1, sha256: 'a'.repeat(64), storageKey: 'fixture.docx', parserEligible: true, createdAt: new Date().toISOString() }]);
  return { db, calculator, scenario, supplier, quote, revision, selection: [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }] };
}

test('confirmation contract requires diagnostics and aggregates explicit counts', () => {
  assert.throws(() => createSupplierImportConfirmationResponse({ scenarioId: 's', documents: [{}] }, null), (error) => error.code === 'supplier_confirmation_contract_error');
  const diagnostics = { counts: { sourcePositions: 22, parsedPositions: 22, selectedPositions: 22, validCanonicalPositions: 22, reviewRequiredPositions: 0, persistedPositions: 22, productsSupplyRows: 22, projectCostingRows: 22, includedRows: 21, alternativeRows: 1, excludedRows: 0 } };
  const response = createSupplierImportConfirmationResponse({ scenarioId: 's', documents: [{ diagnostics }] }, { id: 's' });
  assert.deepEqual(response.counts, diagnostics.counts);
  assert.equal(response.status, 'confirmed');
});

test('22-position confirmation detects source currency, rejects mismatch before mutation, and retries idempotently', async (t) => {
  const context = await setup(t);
  const review = await context.supplier.prepareImportReview('estimate', context.selection);
  assert.equal(review.positionCount, 22);
  assert.equal(review.metadata.currency, 'GBP');
  assert.equal(review.documents[0].rows.filter((row) => row.include).length, 22);
  const selectedRowKeys = review.documents[0].rows.map((row) => row.rowKey);
  await assert.rejects(
    context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, { selectedRowKeys, supplierCode: 'ZF', metadata: { quotationNumber: '343117', revision: '5', currency: 'EUR' } }),
    (error) => error.code === 'confirmation_currency_mismatch',
  );
  assert.equal((await context.db.get('SELECT currency FROM supplier_quote_revisions WHERE id=?', context.revision.id)).currency, 'EUR');
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', context.revision.id)).count, 0);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs WHERE revision_id=?', context.revision.id)).count, 0);

  const first = await context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, { selectedRowKeys, supplierCode: 'ZF', metadata: { quotationNumber: '343117', revision: '5', currency: 'GBP' } });
  await context.calculator.ensureSupplierRevisionExchangeRates(context.scenario.id, [context.revision.id]);
  const costing = await context.calculator.getScenario(context.scenario.id);
  const response = createSupplierImportConfirmationResponse(first, costing);
  assert.equal(response.counts.selectedPositions, 22);
  assert.equal(response.counts.persistedPositions, 22);
  assert.equal(response.counts.productsSupplyRows, 22);
  assert.equal(response.counts.projectCostingRows, 22);
  assert.equal(response.counts.alternativeRows, 1);
  assert.equal(costing.products.length, 22);
  assert.equal(costing.products.filter((row) => row.includedInCurrentEstimate !== false).length, 21);
  const savedVisual = JSON.parse((await context.db.get('SELECT source_snapshot_json FROM project_calculator_estimate_product_rows WHERE source_revision_id=? ORDER BY rowid LIMIT 1', context.revision.id)).source_snapshot_json).manufacturerEvidence.sourceVisual;
  assert.equal(savedVisual.status, 'available');
  assert.match(savedVisual.url, /fixtures\/W1\.png$/);

  const retry = await context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, { selectedRowKeys, supplierCode: 'ZF', metadata: { quotationNumber: '343117', revision: '5', currency: 'GBP' } });
  assert.equal(retry.documents[0].loadedProducts, 0);
  assert.equal(retry.documents[0].idempotentReplay, true);
  assert.equal(retry.documents[0].diagnostics.counts.persistedPositions, 22);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', context.revision.id)).count, 22);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE source_revision_id=?', context.revision.id)).count, 22);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs WHERE revision_id=?', context.revision.id)).count, 1);
  assert.equal((await context.db.get('SELECT COUNT(*) count FROM supplier_quote_import_operations WHERE revision_id=?', context.revision.id)).count, 1);
});

test('review UI has deterministic loading and bounded responsive table contracts', async () => {
  const [component, styles, api] = await Promise.all([
    fs.readFile('src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx', 'utf8'),
    fs.readFile('src/features/estimateCommercial/estimateCommercialWorkspace.css', 'utf8'),
    fs.readFile('src/features/supplierQuotes/api/supplierQuotesApi.ts', 'utf8'),
  ]);
  assert.match(component, /aria-busy=\{busy\}/);
  assert.match(component, /busy\?"Confirming…":confirmationBlocked\?"Select canonical supplier to confirm":"Confirm & Load to Project Costing"/);
  assert.doesNotMatch(component, /busy\?"Loading…":"Confirm & Load to Project Costing"/);
  assert.match(component, /data-label="Customer reference"/);
  assert.match(component, /confirmationStatus==="confirmed"/);
  assert.match(component, /canonical import complete/);
  assert.match(component, /data-confirmation-status/);
  assert.match(styles, /table-layout:fixed/);
  assert.match(styles, /manufacturer-import-operation-status/);
  assert.match(styles, /position:sticky/);
  assert.match(styles, /@media\(max-width:720px\)/);
  assert.match(styles, /content:attr\(data-label\)/);
  assert.match(api, /parseSupplierImportConfirmationResponse/);
  assert.match(api, /Supplier confirmation response was incomplete/);
});
