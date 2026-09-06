import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { calculateImportCustoms, GLOBAL_IMPORT_CUSTOMS_DEFAULTS } from '../shared/importCustoms.js';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';

const gbp = async () => ({ provider: 'fixture', quotedAt: '2026-09-02T00:00:00.000Z', rawRate: '1' });

async function fixture(t, defaults = null) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qs-global-import-customs-'));
  const db = await open({ filename: path.join(root, 'fixture.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  await db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT,group_name TEXT,updated_at TEXT)');
  if (defaults) await db.run('INSERT INTO settings VALUES(?,?,?,?)', 'projectCalculator.importCustomsDefaults', JSON.stringify(defaults), 'projectPreferences', '2026-09-02T00:00:00.000Z');
  await initializeSupplierCommercialSchema(db);
  return { db, service: createProjectCalculatorLabService(db, { exchangeRateProvider: gbp }) };
}

test('global allowance keeps base, contingency, count, duty and commercial markup distinct', () => {
  const one = calculateImportCustoms({ ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, included: true }, '20');
  assert.equal(one.contingencyAmount, '47.43');
  assert.equal(one.budgetedImportCostPerImport, '284.60');
  assert.equal(one.purchaseCost, '284.60');
  assert.equal(one.sellingPrice, '341.52');
  assert.equal(calculateImportCustoms({ ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, included: true, defaultImports: 2 }, '0').purchaseCost, '569.20');
  assert.equal(calculateImportCustoms({ ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, included: true, defaultImports: 3 }, '0').purchaseCost, '853.80');
  assert.equal(calculateImportCustoms({ ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, included: false }, '20').purchaseCost, '0.00');
  const duty = calculateImportCustoms({ ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, included: true, dutyPercent: '5', dutyBasisAmount: '1000' }, '0');
  assert.equal(duty.dutyCost, '50.00');
  assert.equal(duty.purchaseCost, '334.60');
});

test('manual, Eko, UK, unknown and multi-supplier-labelled Estimates receive one identical global default', async (t) => {
  const { service } = await fixture(t);
  for (const name of ['Manual / no supplier', 'Eko Estimate', 'UK supplier Estimate', 'Unknown supplier Estimate', 'Three suppliers']) {
    const scenario = await service.createScenario({ origin: 'manual', name, packageCode: 'supply_only', currency: 'GBP', installationOpeningCount: 0 });
    assert.equal(scenario.importCustoms.purchaseCost, '284.60', name);
    assert.equal(scenario.importCustoms.defaultImports, 1, name);
    assert.equal(scenario.importCustoms.included, true, name);
    assert.equal(scenario.importCustoms.importVatTreatment, 'excluded', name);
    assert.equal('supplierCode' in scenario.importCustoms, false, name);
  }
});

test('Estimate include and import count choices persist through canonical revisions and reload', async (t) => {
  const { db, service } = await fixture(t, { ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, markupPercent: '20' });
  let scenario = await service.createScenario({ origin: 'manual', name: 'Import choice', packageCode: 'supply_only', currency: 'GBP' });
  assert.equal(scenario.importCustoms.purchaseCost, '284.60');
  assert.equal(scenario.importCustoms.sellingPrice, '341.52');
  assert.equal(scenario.markups.duties, '20');
  const createdRevision = scenario.revisionNumber;
  scenario = await service.updateImportCustoms(scenario.id, { included: false });
  assert.equal(scenario.importCustoms.purchaseCost, '0.00');
  assert.equal(scenario.revisionNumber, createdRevision + 1);
  assert.equal((await service.getScenario(scenario.id)).importCustoms.included, false);
  scenario = await service.updateImportCustoms(scenario.id, { included: true, defaultImports: 2 });
  assert.equal(scenario.importCustoms.purchaseCost, '569.20');
  const snapshot = JSON.parse((await db.get('SELECT snapshot_json FROM project_calculator_lab_revisions WHERE scenario_id=? ORDER BY version_number DESC LIMIT 1', scenario.id)).snapshot_json);
  assert.equal(snapshot.options.options_json.importCustoms.defaultImports, 2);
});

test('Admin changes affect new or explicitly amended costings, never existing saved snapshots', async (t) => {
  const { db, service } = await fixture(t);
  let historical = await service.createScenario({ origin: 'manual', name: 'Historical', packageCode: 'supply_only', currency: 'GBP' });
  await db.run('INSERT OR REPLACE INTO settings VALUES(?,?,?,?)', 'projectCalculator.importCustomsDefaults', JSON.stringify({ ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS, baseImportCost: '300', contingencyPercent: '10' }), 'projectPreferences', '2026-09-02T01:00:00.000Z');
  historical = await service.createRevision(historical.id);
  assert.equal(historical.importCustoms.purchaseCost, '284.60');
  const current = await service.createScenario({ origin: 'manual', name: 'Current', packageCode: 'supply_only', currency: 'GBP' });
  assert.equal(current.importCustoms.purchaseCost, '330.00');
  historical = await service.useCurrentImportCustomsDefaults(historical.id);
  assert.equal(historical.importCustoms.purchaseCost, '330.00');
  assert.equal(historical.importCustoms.source, 'explicit_current_global_default_adoption');
});

test('failed Import / Customs revision persistence rolls back atomically', async (t) => {
  const { db, service } = await fixture(t);
  const before = await service.createScenario({ origin: 'manual', name: 'Atomic', packageCode: 'supply_only', currency: 'GBP' });
  await db.exec("CREATE TRIGGER reject_import_customs_revision BEFORE INSERT ON project_calculator_lab_revisions WHEN NEW.reason='import_customs_choice_changed' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  await assert.rejects(service.updateImportCustoms(before.id, { included: false }), /fixture failure/);
  const after = await service.getScenario(before.id);
  assert.equal(after.importCustoms.included, true);
  assert.equal(after.revisionNumber, before.revisionNumber);
});

test('superseded supplier-specific Phase 1 snapshots remain readable but do not create multiple active allowances', () => {
  const legacy = calculateImportCustoms({ entries: [{ id: 'supplier-old', required: true, included: true, baseImportCost: '237.17', contingencyPercent: '20', defaultImports: 1, dutyPercent: '0', dutyBasisAmount: '0' }] }, '0');
  assert.equal(legacy.id, 'global-import-customs');
  assert.equal(legacy.purchaseCost, '284.60');
});
