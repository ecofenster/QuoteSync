import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { validateScenarioCreation } from '../src/features/projectCalculatorLab/domain/scenarioCreation.js';
import { calculateCommercialMargin } from '../src/features/projectCalculatorLab/domain/commercialMargin.js';

(globalThis as typeof globalThis & {__quoteSyncExchangeRateTestProvider?:(currency:string)=>Promise<{rawRate:string;provider:string;quotedAt:string}>}).__quoteSyncExchangeRateTestProvider=async()=>({rawRate:'0.875',provider:'test',quotedAt:'2026-08-05T00:00:00.000Z'});

test('manual scenario requires no Import Lab records and manual lines never fabricate supplier provenance', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qs-stage2a-manual-'));
  const db = await open({ filename: path.join(root, 'test.db'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  await db.exec('PRAGMA foreign_keys=ON;CREATE TABLE estimates(id TEXT PRIMARY KEY);CREATE TABLE clients(id TEXT PRIMARY KEY);');
  await initializeSupplierCommercialSchema(db);
  const service = createProjectCalculatorLabService(db);
  let scenario = await service.createScenario({ origin: 'manual', name: 'Manual EUR', currency: 'EUR', packageCode: 'supply_only', installationOpeningCount: 2 });
  assert.equal(scenario.origin, 'manual');
  assert.equal(scenario.importLabSessionId, null);
  assert.equal(scenario.extractionRunId, null);
  assert.equal(scenario.sourceAttachmentId, null);
  scenario = await service.addManualProduct(scenario.id, { reference: 'W7, W8', productClass: 'Window', widthMm: 610, heightMm: 1200, quantity: 2, installationOpeningCount: 1, unitSupplyCost: '537.12', totalSupplyCost: '1074.24' });
  scenario = await service.addManualCost(scenario.id, { category: 'delivery', label: 'Manual delivery allowance', amount: '2200.00' });
  scenario = await service.updateProduct(scenario.id, scenario.products[0].id, { productClass: 'Single door', widthMm: 900, heightMm: 2100, quantity: 1, installationOpeningCount: 1, unitSupplyCost: '800.00', totalPrice: '800.00' });
  assert.equal(scenario.products.length, 1);
  assert.equal(scenario.products[0].evidenceOrigin, 'manual');
  assert.equal(scenario.products[0].sourceRowId, null);
  assert.equal(scenario.products[0].sourceSnapshot, null);
  assert.equal(scenario.products[0].displayReference, 'W7, W8');
  assert.equal(scenario.products[0].productClass, 'Single door');
  assert.equal(scenario.products[0].widthMm, 900);
  assert.equal(scenario.supplierCosts[0].evidenceOrigin, 'manual');
  assert.equal(scenario.supplierCosts[0].sourceAdditionalCostId, null);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_import_lab_sessions')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quotes')).count, 0);
});

test('source validation is mode-specific and canonical Estimate positions are available', () => {
  const base = { name: 'Scenario', sourceRunId: '', currency: 'EUR', packageCode: 'support' as const, installationOpeningCount: '0' };
  assert.equal(validateScenarioCreation({ ...base, origin: 'manual' }, []), null);
  assert.match(validateScenarioCreation({ ...base, origin: 'supplier_import' }, []) || '', /No eligible/);
  assert.equal(validateScenarioCreation({ ...base, origin: 'estimate' }, []), null);
});

test('UI exposes all creation choices and manual product/cost entry', async () => {
  const ui = await readFile('src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx', 'utf8');
  for (const text of ['Supplier quotation import', 'Estimate positions', 'Canonical Estimate positions are shown', 'Manual Entry', 'Add manual product', 'Add manual cost', 'manual evidence, not supplier-extracted evidence']) assert.match(ui, new RegExp(text));
});

test('manual and supplier Extras persist independent inclusion without losing value or revision history', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qs-stage2a-mixed-extras-'));
  const db = await open({ filename: path.join(root, 'test.db'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  await db.exec('CREATE TABLE estimates(id TEXT PRIMARY KEY);CREATE TABLE clients(id TEXT PRIMARY KEY);');
  await initializeSupplierCommercialSchema(db);
  const service = createProjectCalculatorLabService(db);
  let scenario = await service.createScenario({ origin: 'manual', name: 'Mixed Extras', currency: 'GBP', packageCode: 'supply_only', installationOpeningCount: 0 });
  scenario = await service.addManualCost(scenario.id, { category: 'extras', label: 'Manual trim', amount: '100.00' });
  const manual = scenario.supplierCosts.find((row) => row.costKind === 'manual')!;
  assert.equal(manual.evidenceOrigin, 'manual');
  assert.equal(manual.includedInCurrentEstimate, true);

  await db.exec('PRAGMA foreign_keys=OFF');
  await db.run("INSERT INTO supplier_quote_revisions(id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,full_quotation_reference,currency,vat_status,lifecycle_status) VALUES('revision','quote','estimate',1,'Q1','Q1-1','GBP','exclusive','current')");
  await db.run("INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,total_price_amount,currency) VALUES('source-extra','estimate','revision','extras','Supplier sill','Supplier sill','50.00','GBP')");
  await db.run("INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,created_at) VALUES('supplier-extra',?,'source-extra','attachment','revision','{}','extras','Supplier sill','50.00','GBP','now')",scenario.id);
  await db.run("INSERT INTO project_calculator_supplier_fx_snapshots(id,scenario_id,supplier_quote_revision_id,import_run_id,scenario_revision,supplier_currency,target_currency,provider,provider_timestamp,supplier_to_gbp_live_rate,rounded_up_rate,uplift_amount,calculated_selling_rate,supplier_to_gbp_selling_rate,adjustment_enabled,created_at) VALUES('supplier-fx',?,'revision','run',1,'GBP','GBP','identity','now','1','1','0','1','1',0,'now')",scenario.id);
  await db.run("INSERT INTO project_calculator_supplier_quote_revisions(scenario_id,supplier_quote_id,revision_id,import_run_id,fx_snapshot_id,currency,linked_at) VALUES(?,'quote','revision','run','supplier-fx','GBP','now')",scenario.id);
  scenario = await service.getScenario(scenario.id);
  const supplier = scenario.supplierCosts.find((row) => row.costKind === 'supplier')!;
  assert.equal(supplier.includedInCurrentEstimate, true);

  scenario = await service.updateMarkups(scenario.id, { extras: '20' });
  assert.equal(scenario.supplierCosts.filter((row) => row.includedInCurrentEstimate !== false).reduce((sum, row) => sum + Number(row.gbpAmount), 0), 150);
  assert.equal(scenario.supplierCosts.filter((row) => row.includedInCurrentEstimate !== false).reduce((sum, row) => sum + Number(row.markedUpAmount), 0), 180);

  scenario = await service.updateManualCost(scenario.id, manual.id, { includedInCurrentEstimate: false });
  const excludedManual = scenario.supplierCosts.find((row) => row.id === manual.id)!;
  assert.equal(excludedManual.includedInCurrentEstimate, false);
  assert.equal(excludedManual.label, 'Manual trim');
  assert.equal(excludedManual.amount, '100.00');
  assert.equal(excludedManual.currency, 'GBP');
  assert.equal(excludedManual.markedUpAmount, '0');
  assert.equal(scenario.supplierCosts.find((row) => row.id === supplier.id)!.includedInCurrentEstimate, true);
  assert.equal(scenario.supplierCosts.filter((row) => row.includedInCurrentEstimate !== false).reduce((sum, row) => sum + Number(row.gbpAmount), 0), 50);

  const excludedSnapshot = JSON.parse((await db.get("SELECT snapshot_json FROM project_calculator_lab_revisions WHERE scenario_id=? AND reason='manual_extra_selection_reviewed' ORDER BY version_number DESC LIMIT 1",scenario.id)).snapshot_json);
  assert.equal(excludedSnapshot.manualCosts.find((row:Record<string,unknown>) => row.id === manual.id).included_in_current_estimate, 0);
  scenario = await service.createRevision(scenario.id);
  const historicalVersion = scenario.revisionNumber;
  scenario = await service.updateManualCost(scenario.id, manual.id, { includedInCurrentEstimate: true });
  const includedManual = scenario.supplierCosts.find((row) => row.id === manual.id)!;
  assert.equal(includedManual.includedInCurrentEstimate, true);
  assert.equal(includedManual.amount, '100.00');
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_lab_manual_cost_lines WHERE scenario_id=?',scenario.id)).count, 1);
  const historical = JSON.parse((await db.get('SELECT snapshot_json FROM project_calculator_lab_revisions WHERE scenario_id=? AND version_number=?',scenario.id,historicalVersion)).snapshot_json);
  assert.equal(historical.manualCosts.find((row:Record<string,unknown>) => row.id === manual.id).included_in_current_estimate, 0);

  scenario = await service.updateSupplierCost(scenario.id, supplier.id, { includedInCurrentEstimate: false });
  assert.equal(scenario.supplierCosts.find((row) => row.id === supplier.id)!.includedInCurrentEstimate, false);
  assert.equal(scenario.supplierCosts.find((row) => row.id === manual.id)!.includedInCurrentEstimate, true);
  assert.equal((await db.get("SELECT included_in_supplier_total FROM supplier_quote_extras WHERE id='source-extra'")).included_in_supplier_total, 0);
  assert.equal((await db.get('SELECT included_in_current_estimate FROM project_calculator_lab_manual_cost_lines WHERE id=?',manual.id)).included_in_current_estimate, 1);
  assert.deepEqual(calculateCommercialMargin('100.00', '120.00', '35'), { grossProfit:'20.00',grossMarginPercent:'16.67',overallMarkupPercent:'20.00',targetSellingPrice:'153.85',varianceAmount:'33.85',varianceDirection:'below',requiredOverallMarkupPercent:'53.85' });
});

test('Extras UI dispatches manual rows explicitly and keeps the supplier route for supplier rows', async () => {
  const [worksheet, workspace, api] = await Promise.all([
    readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx', 'utf8'),
    readFile('src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx', 'utf8'),
    readFile('src/features/projectCalculatorLab/api/projectCalculatorLabApi.ts', 'utf8'),
  ]);
  assert.match(worksheet, /row\.costKind==="manual"\?onUpdateManualCost:onUpdateSupplierCost/);
  assert.match(workspace, /onUpdateManualCost=.*projectCalculatorLabApi\.updateManualCost/);
  assert.match(api, /updateManualCost:[^]*\/manual-costs\//);
  assert.match(api, /updateSupplierCost:[^]*\/supplier-costs\//);
});
