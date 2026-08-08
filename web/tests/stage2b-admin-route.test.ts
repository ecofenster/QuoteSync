import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabRouter } from '../server/routes/projectCalculatorLab.js';

test('mounted Admin configuration route returns catalogue, rules and package rules', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qs-stage2b-route-'));
  const db = await open({ filename: path.join(root, 'test.db'), driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys=ON; CREATE TABLE estimates(id TEXT PRIMARY KEY); CREATE TABLE clients(id TEXT PRIMARY KEY);');
  await initializeSupplierCommercialSchema(db);
  const app = express();
  app.use(express.json());
  app.use('/api/admin/project-calculator-lab', await createProjectCalculatorLabRouter({ dbPromise: Promise.resolve(db) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); await rm(root, { recursive: true, force: true }); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/project-calculator-lab/admin-configuration`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  const body = await response.json() as { catalogue: unknown[]; rules: Record<string, unknown>; packageRules: Record<string, unknown> };
  assert.ok(body.catalogue.length > 0, 'catalogue loads');
  assert.ok(Object.keys(body.rules).length > 0, 'rules load');
  assert.ok(Object.keys(body.packageRules).length > 0, 'package rules load');
});

test('Admin catalogue UI catches configuration load failures', async () => {
  const source = await (await import('node:fs/promises')).readFile('src/features/projectCalculatorLab/CalculatorAdminCatalogue.tsx', 'utf8');
  assert.match(source, /getAdminConfiguration\(\).*\.catch/s);
  assert.match(source, /role="alert"/);
  assert.match(source, /configuration unavailable/i);
});
