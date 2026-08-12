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

test('source validation is mode-specific and estimate mode explains unavailability', () => {
  const base = { name: 'Scenario', sourceRunId: '', currency: 'EUR', packageCode: 'support' as const, installationOpeningCount: '0' };
  assert.equal(validateScenarioCreation({ ...base, origin: 'manual' }, []), null);
  assert.match(validateScenarioCreation({ ...base, origin: 'supplier_import' }, []) || '', /No eligible/);
  assert.match(validateScenarioCreation({ ...base, origin: 'estimate' }, []) || '', /not available yet/);
});

test('UI exposes all creation choices and manual product/cost entry', async () => {
  const ui = await readFile('src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx', 'utf8');
  for (const text of ['Supplier quotation import', 'QuoteSuite generated estimate — unavailable', 'Manual Entry', 'Add manual product', 'Add manual cost', 'manual evidence, not supplier-extracted evidence']) assert.match(ui, new RegExp(text));
});
