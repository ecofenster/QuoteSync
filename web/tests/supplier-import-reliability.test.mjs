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
import { reconcileStaleSupplierImportRuns, supplierImportFailure } from '../server/features/supplierQuotes/supplierImportReliability.js';

const sourceRow = (ordinal, { invalid = false } = {}) => {
  const reference = `W${ordinal + 1}`;
  const manufacturerEvidence = { manufacturerItemNumber: String(ordinal + 1), customerReference: reference, product: 'Window', productSystem: '92 Europa window', configurationDescription: 'Tilt and turn', customerSafeSpecification: [], sourceVisual: { status: 'unavailable', reason: 'Fixture contains no visual.' } };
  const original = { displayReference: reference, supplierReferenceTokens: [reference], quantity: 1, widthMm: invalid ? null : 1200, heightMm: 900, unitPrice: '500.00', totalPrice: '500.00', currency: 'GBP', classification: 'standard', includedInSupplierTotal: true, manufacturerEvidence };
  return { id: `row-${ordinal}`, ordinal, ...original, ...manufacturerEvidence, sourcePages: [1], sourceTrace: [{ pageNumber: 1, region: `position-${ordinal + 1}` }], confidence: invalid ? '0.45' : '0.98', warnings: invalid ? ['Width requires review.'] : [], status: invalid ? 'needs_review' : 'extracted', originalExtractedSnapshot: structuredClone(original) };
};

async function setup(t, { rowCount = 22, invalidRows = 0, priorRuns = 0, existingExtras = 0, failureInjector = async () => {} } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-import-reliability-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-001','Client',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-2026-001','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'ZF', supplierName: 'Zyle Fenster', policy: { pricingMethod: 'parity_1_to_1', pricingBasis: 'parity_1_to_1', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Products / Supply', currency: 'GBP', packageCode: 'supply_only' });
  const rows = Array.from({ length: rowCount }, (_, ordinal) => sourceRow(ordinal, { invalid: ordinal >= rowCount - invalidRows }));
  const supplier = createSupplierQuotesService(db, {
    attachmentRoot: root,
    extractDocument: async () => ({ textAvailable: true, warnings: [], pages: [{ blocks: rows.map((row) => ({ id: row.id, text: row.displayReference })) }] }),
    parseFields: () => ({ quotation: { supplierQuotationNumber: '343117', supplierRevision: '5' }, rows: rows.map((row) => structuredClone(row)), warnings: [] }),
    parseSummary: () => ({ summary: null, additionalItems: [], warnings: [] }),
    failureInjector,
  });
  const quote = await supplier.createQuote('estimate', { supplierCode: 'ZF', supplierName: 'Zyle Fenster' });
  const revision = await supplier.createRevision('estimate', quote.id, { supplierQuotationNumber: '343117', supplierRevision: '5', currency: 'EUR' });
  const sourceSha = 'a'.repeat(64);
  await supplier.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: '343117-5.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 343117, sha256: sourceSha, storageKey: '343117-5.docx', parserEligible: true, createdAt: '2026-08-01T10:00:00.000Z' }]);
  for (let index = 0; index < priorRuns; index += 1) {
    const runId = `prior-run-${index + 1}`;
    await db.run(`INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,completed_at,status,warnings_json) VALUES(?,?,?,'quotesync-commercial-extractor','1.1.0','supplier-neutral','1.1.0','not-applicable',?,?,'completed_with_warnings','[]')`, runId, 'estimate', revision.id, `2026-08-0${index + 1}T09:00:00.000Z`, `2026-08-0${index + 1}T09:01:00.000Z`);
    await db.run('INSERT INTO supplier_quote_import_run_attachments(import_run_id,attachment_id,ordinal,role) VALUES(?,?,0,?)', runId, 'source', 'original_quote');
  }
  for (let index = 0; index < existingExtras; index += 1) {
    const extraId = `existing-extra-${index + 1}`;
    await db.run(`INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,quantity,unit_price_amount,total_price_amount,currency,trace_json,included_in_supplier_total,inclusion_evidence,created_at) VALUES(?,?,?,'additional_charge',?,?,NULL,NULL,?,'GBP','[]',1,'explicit source total',?)`, extraId, 'estimate', revision.id, `Existing extra ${index + 1}`, `Existing extra ${index + 1}`, `${index + 1}.00`, '2026-08-01T10:00:00.000Z');
    await db.run(`INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,created_at,included_in_current_estimate,inclusion_evidence) VALUES(?,?,?,?,?,?,'additional_charge',?,?,'GBP',?,1,'explicit source total')`, `existing-cost-${index + 1}`, scenario.id, extraId, 'source', revision.id, JSON.stringify({ attachmentId: 'source', sourceExtraId: extraId }), `Existing extra ${index + 1}`, `${index + 1}.00`, '2026-08-01T10:00:00.000Z');
  }
  if (priorRuns) await db.run(`INSERT INTO project_calculator_supplier_quote_revisions(scenario_id,supplier_quote_id,revision_id,import_run_id,commercial_policy_json,currency,linked_at) VALUES(?,?,?,?,?,'EUR',?)`, scenario.id, quote.id, revision.id, `prior-run-${priorRuns}`, '{}', '2026-08-07T09:01:00.000Z');
  return { db, root, scenario, supplier, quote, revision, sourceSha, rows, selection: [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }] };
}

const confirmationFor = (context, selectedRowKeys = context.rows.filter((row) => row.status !== 'needs_review').map((row) => `source:${row.ordinal}`)) => ({ selectedRowKeys, supplierCode: 'ZF', metadata: { quotationNumber: '343117', revision: '5', currency: 'GBP' } });
const count = async (db, table, where = '', ...parameters) => Number((await db.get(`SELECT COUNT(*) count FROM ${table}${where ? ` WHERE ${where}` : ''}`, ...parameters)).count);

test('343117-5-shaped recovery confirms 22 rows, preserves 11 extras/source, and replays idempotently', async (t) => {
  const context = await setup(t, { priorRuns: 7, existingExtras: 11 });
  const originalExtras = await context.db.all('SELECT id,total_price_amount,currency FROM supplier_quote_extras ORDER BY id');
  const first = await context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, confirmationFor(context));
  assert.equal(first.operationStatus, 'confirmed');
  assert.equal(first.documents[0].diagnostics.counts.selectedPositions, 22);
  assert.equal(first.documents[0].diagnostics.counts.validCanonicalPositions, 22);
  assert.equal(first.documents[0].diagnostics.counts.persistedPositions, 22);
  assert.equal(first.documents[0].diagnostics.counts.productsSupplyRows, 22);
  assert.equal(first.documents[0].diagnostics.counts.projectCostingRows, 22);
  assert.equal(await count(context.db, 'supplier_quote_import_runs', 'revision_id=?', context.revision.id), 8);
  assert.equal(await count(context.db, 'supplier_quote_positions', 'revision_id=?', context.revision.id), 22);
  assert.equal(await count(context.db, 'project_calculator_estimate_product_rows', 'scenario_id=? AND source_revision_id=?', context.scenario.id, context.revision.id), 22);
  assert.equal(await count(context.db, 'project_calculator_estimate_product_rows', 'scenario_id=? AND source_revision_id=? AND estimate_position_id IS NOT NULL', context.scenario.id, context.revision.id), 22);
  assert.equal(await count(context.db, 'supplier_quote_extras', 'revision_id=?', context.revision.id), 11);
  assert.equal(await count(context.db, 'project_calculator_estimate_supplier_costs', 'scenario_id=? AND source_revision_id=?', context.scenario.id, context.revision.id), 11);
  assert.deepEqual(await context.db.all('SELECT id,total_price_amount,currency FROM supplier_quote_extras ORDER BY id'), originalExtras);
  assert.equal(await count(context.db, 'supplier_quote_attachments', 'revision_id=?', context.revision.id), 1);
  assert.equal((await context.db.get('SELECT sha256 FROM supplier_quote_attachments WHERE id=?', 'source')).sha256, context.sourceSha);
  assert.equal((await context.db.get('SELECT currency FROM supplier_quote_revisions WHERE id=?', context.revision.id)).currency, 'GBP');
  assert.equal((await context.db.get('SELECT currency FROM project_calculator_supplier_quote_revisions WHERE revision_id=?', context.revision.id)).currency, 'GBP');
  const operation = await context.db.get('SELECT * FROM supplier_quote_import_operations WHERE revision_id=?', context.revision.id);
  assert.equal(operation.status, 'confirmed');
  assert.equal(JSON.parse(operation.pre_state_json).importRuns, 7);
  assert.deepEqual(JSON.parse(operation.currency_decision_json), { storedCurrency: 'EUR', sourceCurrency: 'GBP', reviewedCurrency: 'GBP', decision: 'reviewed_source_currency_correction', sourceAmountsRewritten: false });
  assert.equal(JSON.parse(operation.diagnostics_json).counts.projectCostingRows, 22);
  assert.equal(await count(context.db, 'supplier_quote_import_position_evidence', 'operation_id=?', operation.id), 22);
  const retry = await context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, confirmationFor(context));
  assert.equal(retry.documents[0].idempotentReplay, true);
  assert.equal(retry.documents[0].loadedProducts, 0);
  assert.equal(await count(context.db, 'supplier_quote_import_runs', 'revision_id=?', context.revision.id), 8);
  assert.equal(await count(context.db, 'supplier_quote_import_operations', 'revision_id=?', context.revision.id), 1);
  assert.equal(await count(context.db, 'supplier_quote_positions', 'revision_id=?', context.revision.id), 22);
  assert.equal(await count(context.db, 'supplier_quote_extras', 'revision_id=?', context.revision.id), 11);
});

test('mixed evidence preserves all parsed rows while committing only canonical-ready rows as review-required', async (t) => {
  const context = await setup(t, { rowCount: 30, invalidRows: 2 });
  const result = await context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, confirmationFor(context));
  assert.equal(result.operationStatus, 'review_required');
  assert.equal(result.documents[0].diagnostics.counts.parsedPositions, 30);
  assert.equal(result.documents[0].diagnostics.counts.selectedPositions, 28);
  assert.equal(result.documents[0].diagnostics.counts.validCanonicalPositions, 28);
  assert.equal(result.documents[0].diagnostics.counts.reviewRequiredPositions, 2);
  assert.equal(await count(context.db, 'supplier_quote_positions', 'revision_id=?', context.revision.id), 28);
  const operation = await context.db.get('SELECT id,status FROM supplier_quote_import_operations WHERE revision_id=?', context.revision.id);
  assert.equal(operation.status, 'review_required');
  assert.equal(await count(context.db, 'supplier_quote_import_position_evidence', 'operation_id=?', operation.id), 30);
  assert.equal(await count(context.db, 'supplier_quote_import_position_evidence', "operation_id=? AND readiness_status='review_required'", operation.id), 2);
  const run = await context.db.get('SELECT status,confirmation_status,error_code FROM supplier_quote_import_runs WHERE operation_id=?', operation.id);
  assert.deepEqual(run, { status: 'failed', confirmation_status: 'review_required', error_code: 'confirmation_review_required' });
});

for (const stage of ['extraction', 'currency_validation', 'operation_journal', 'supplier_position_persistence', 'products_projection', 'project_costing_projection', 'package_adjustments', 'revision_reconciliation', 'diagnostics_persistence', 'transaction_commit', 'postcondition_validation']) {
  test(`failure injection at ${stage} never creates false completion`, async (t) => {
    const context = await setup(t, { rowCount: 2, failureInjector: async (currentStage) => { if (currentStage === stage) throw supplierImportFailure(stage); } });
    await assert.rejects(context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, confirmationFor(context)), (error) => error.code === `supplier_import_${stage}_failed`);
    assert.equal(await count(context.db, 'supplier_quote_positions', 'revision_id=?', context.revision.id), 0);
    assert.equal(await count(context.db, 'project_calculator_estimate_product_rows', 'source_revision_id=?', context.revision.id), 0);
    assert.equal(await count(context.db, 'supplier_quote_import_operations', "revision_id=? AND status='confirmed'", context.revision.id), 0);
    assert.equal(await count(context.db, 'supplier_quote_import_runs', "revision_id=? AND confirmation_status='confirmed'", context.revision.id), 0);
  });
}

test('persisted postcondition mismatch rolls back and journals partial recovery required', async (t) => {
  let context;
  context = await setup(t, { rowCount: 2, failureInjector: async (stage, operation) => { if (stage === 'project_costing_projection') await context.db.run('UPDATE project_calculator_estimate_product_rows SET estimate_position_id=NULL WHERE scenario_id=?', operation.scenarioId); } });
  await assert.rejects(context.supplier.extractAndLoadSupplierCosts('estimate', context.scenario.id, context.selection, confirmationFor(context)), (error) => error.code === 'supplier_confirmation_postcondition_failed');
  assert.equal(await count(context.db, 'supplier_quote_positions', 'revision_id=?', context.revision.id), 0);
  assert.equal(await count(context.db, 'project_calculator_estimate_product_rows', 'source_revision_id=?', context.revision.id), 0);
  const operation = await context.db.get('SELECT status,post_state_json,diagnostics_json FROM supplier_quote_import_operations WHERE revision_id=?', context.revision.id);
  assert.equal(operation.status, 'partial_recovery_required');
  assert.equal(JSON.parse(operation.post_state_json).supplierPositions, 0);
  assert.equal(JSON.parse(operation.diagnostics_json).attemptedPostState.operationCounts.projectCostingRows, 0);
  assert.equal((await context.db.get('SELECT confirmation_status FROM supplier_quote_import_runs WHERE revision_id=?', context.revision.id)).confirmation_status, 'partial_recovery_required');
});

test('stale in-progress runs become recoverable without replaying provider or business mutations', async (t) => {
  const context = await setup(t, { rowCount: 2 });
  const identity = 'stale-operation';
  await context.db.run(`INSERT INTO supplier_quote_import_operations(id,operation_key,estimate_id,supplier_quote_id,revision_id,scenario_id,current_run_id,status,source_identity_json,selection_identity_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'confirming','[]','[]',?,?)`, identity, identity, 'estimate', context.quote.id, context.revision.id, context.scenario.id, 'stale-run', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  await context.db.run(`INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,status,warnings_json,operation_id,confirmation_status) VALUES(?,?,?,'extractor','1','neutral','1','1',?,'running','[]',?,'confirming')`, 'stale-run', 'estimate', context.revision.id, '2026-08-01T00:00:00.000Z', identity);
  const reconciled = await reconcileStaleSupplierImportRuns(context.db, { now: new Date('2026-08-28T12:00:00.000Z') });
  assert.deepEqual(reconciled, ['stale-run']);
  assert.equal((await context.db.get('SELECT status FROM supplier_quote_import_operations WHERE id=?', identity)).status, 'failed_recoverable');
  const run = await context.db.get('SELECT status,confirmation_status,error_code FROM supplier_quote_import_runs WHERE id=?', 'stale-run');
  assert.deepEqual(run, { status: 'failed', confirmation_status: 'failed_recoverable', error_code: 'stale_import_run' });
  assert.equal(await count(context.db, 'supplier_quote_positions', 'revision_id=?', context.revision.id), 0);
});
