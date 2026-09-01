import { randomUUID } from 'node:crypto';

const json = value => { try { return JSON.parse(value); } catch { return value; } };
const invalid = message => Object.assign(new Error(message), { code: 'invalid_catalogue' });

function validateCatalogueInput(input, existing = {}) {
  if (input.priceAmount != null && input.priceAmount !== '' && !/^\d+(?:\.\d+)?$/.test(String(input.priceAmount))) throw invalid('Catalogue price must be a non-negative decimal string or blank.');
  const label = String(input.label ?? existing.label ?? '').trim();
  const category = String(input.category ?? existing.category ?? '').trim().toLowerCase();
  const rateType = String(input.rateType ?? existing.rate_type ?? '').trim().toLowerCase();
  const currency = String(input.currency ?? existing.currency ?? 'GBP').trim().toUpperCase();
  if (!label) throw invalid('Catalogue product name is required.');
  if (!/^[a-z][a-z0-9_]*$/.test(category)) throw invalid('Catalogue category is invalid.');
  if (!/^[a-z][a-z0-9_]*$/.test(rateType)) throw invalid('Catalogue purchase unit is invalid.');
  if (!/^[A-Z]{3}$/.test(currency)) throw invalid('Catalogue currency must be a three-letter code.');
  return { label, category, rateType, currency };
}

export async function readCalculatorAdminConfiguration(db) {
  const [catalogue, rules, packages] = await Promise.all([
    db.all('SELECT * FROM project_calculator_admin_catalogue_items ORDER BY category,label'),
    db.all('SELECT * FROM project_calculator_admin_rules ORDER BY rule_key'),
    db.all('SELECT * FROM project_calculator_admin_package_rules ORDER BY package_code'),
  ]);
  return {
    catalogue: catalogue.map(row => ({ id: row.id, category: row.category, label: row.label, rateType: row.rate_type, priceAmount: row.price_amount, currency: row.currency, variant: json(row.variant_json), supplier: row.supplier, notes: row.notes, active: !!row.active, version: row.version })),
    rules: Object.fromEntries(rules.map(row => [row.rule_key, { value: json(row.rule_value_json), version: row.version }])),
    packageRules: Object.fromEntries(packages.map(row => [row.package_code, { inclusions: json(row.inclusions_json), version: row.version }])),
  };
}

export async function snapshotCalculatorAdminConfiguration(db, scenarioId, revision, now = new Date().toISOString()) {
  const config = await readCalculatorAdminConfiguration(db);
  await db.run('INSERT INTO project_calculator_lab_catalogue_snapshots(id,scenario_id,scenario_revision,catalogue_json,rules_json,package_rules_json,created_at) VALUES(?,?,?,?,?,?,?)', randomUUID(), scenarioId, revision, JSON.stringify(config.catalogue), JSON.stringify(config.rules), JSON.stringify(config.packageRules), now);
  return config;
}

export async function auditCalculatorCatalogueDependencies(db, itemId) {
  const snapshots = await db.all('SELECT id,scenario_id,catalogue_json FROM project_calculator_lab_catalogue_snapshots');
  const referencedSnapshots = snapshots.filter(row => {
    const catalogue = json(row.catalogue_json);
    return Array.isArray(catalogue) && catalogue.some(item => item?.id === itemId);
  });
  return { itemId, snapshotReferenceCount: referencedSnapshots.length, scenarioIds: [...new Set(referencedSnapshots.map(row => row.scenario_id))], snapshotsAreSelfContained: true, liveForeignKeyReferenceCount: 0 };
}

export function createCalculatorAdminService(db) {
  return {
    getConfiguration: () => readCalculatorAdminConfiguration(db),
    auditCatalogueItem: id => auditCalculatorCatalogueDependencies(db, id),
    async createCatalogueItem(input) {
      const value = validateCatalogueInput(input);
      const id = `admin_catalogue_${randomUUID()}`, now = new Date().toISOString();
      await db.run('INSERT INTO project_calculator_admin_catalogue_items(id,category,label,rate_type,price_amount,currency,variant_json,supplier,notes,active,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)', id, value.category, value.label, value.rateType, input.priceAmount === '' ? null : input.priceAmount ?? null, value.currency, JSON.stringify(input.variant ?? {}), input.supplier ?? null, input.notes ?? null, input.active === false ? 0 : 1, now, now);
      return readCalculatorAdminConfiguration(db);
    },
    async updateCatalogueItem(id, input) {
      const existing = await db.get('SELECT * FROM project_calculator_admin_catalogue_items WHERE id=?', id);
      if (!existing) return null;
      const value = validateCatalogueInput(input, existing);
      await db.run('UPDATE project_calculator_admin_catalogue_items SET category=?,label=?,rate_type=?,price_amount=?,currency=?,supplier=?,notes=?,variant_json=?,active=?,version=version+1,updated_at=? WHERE id=?', value.category, value.label, value.rateType, input.priceAmount === '' ? null : input.priceAmount ?? existing.price_amount, value.currency, input.supplier ?? existing.supplier, input.notes ?? existing.notes, input.variant ? JSON.stringify(input.variant) : existing.variant_json, typeof input.active === 'boolean' ? (input.active ? 1 : 0) : existing.active, new Date().toISOString(), id);
      return readCalculatorAdminConfiguration(db);
    },
    async removeCatalogueItem(id) {
      const existing = await db.get('SELECT id FROM project_calculator_admin_catalogue_items WHERE id=?', id);
      if (!existing) return null;
      const dependencies = await auditCalculatorCatalogueDependencies(db, id);
      if (dependencies.snapshotReferenceCount > 0) {
        await db.run('UPDATE project_calculator_admin_catalogue_items SET active=0,version=version+CASE WHEN active=1 THEN 1 ELSE 0 END,updated_at=? WHERE id=?', new Date().toISOString(), id);
        return { configuration: await readCalculatorAdminConfiguration(db), disposition: 'deactivated', dependencies };
      }
      await db.run('DELETE FROM project_calculator_admin_catalogue_items WHERE id=?', id);
      return { configuration: await readCalculatorAdminConfiguration(db), disposition: 'deleted', dependencies };
    },
    async updateRule(key, value) {
      const result = await db.run('UPDATE project_calculator_admin_rules SET rule_value_json=?,version=version+1,updated_at=? WHERE rule_key=?', JSON.stringify(value), new Date().toISOString(), key);
      return result.changes ? readCalculatorAdminConfiguration(db) : null;
    },
    async updatePackage(code, inclusions) {
      const result = await db.run('UPDATE project_calculator_admin_package_rules SET inclusions_json=?,version=version+1,updated_at=? WHERE package_code=?', JSON.stringify(inclusions), new Date().toISOString(), code);
      return result.changes ? readCalculatorAdminConfiguration(db) : null;
    },
  };
}
