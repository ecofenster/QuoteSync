import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('main navigation exposes only the approved user destinations', async () => {
  const source = await readFile(new URL('../src/layout/appShellNav.ts', import.meta.url), 'utf8');
  for (const label of ['Home', 'Create', 'Tools', 'Help', 'Admin']) assert.match(source, new RegExp(`label: "${label}"`));
  for (const legacy of ['Window Types Render/Preview', 'Configurator Render', 'B92 Configurator', 'Client Portal']) assert.doesNotMatch(source, new RegExp(legacy));
});

test('Create menu routes to canonical estimate/client and existing tool workflows', async () => {
  const source = await readFile(new URL('../src/layout/appShellNav.ts', import.meta.url), 'utf8');
  for (const label of ['Create Estimate', 'Create Client', 'PHPP', 'Glass Calculator']) assert.match(source, new RegExp(label));
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /openAddEstimateModal\(\)/);
  assert.match(app, /openAddClientPanel\(\)/);
  assert.match(app, /key === "phpp" \|\| key === "glass_calculator"/);
});

test('technical configurator workspaces remain Admin-owned', async () => {
  const admin = await readFile(new URL('../src/features/admin/AdminPlaceholderPage.tsx', import.meta.url), 'utf8');
  assert.match(admin, /activeSection === "configurator_controls"/);
  assert.match(admin, /AdminConfiguratorCatalogWorkspace/);
});
