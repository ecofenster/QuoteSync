import { createHash } from 'node:crypto';

export const MANUFACTURER_IMPORT_RECOVERY_LADDER = Object.freeze([
  'native_structural_extraction',
  'deterministic_geometry_reconstruction',
  'bounded_supplier_interpretation',
  'visual_page_region_evidence',
  'bounded_ocr_for_missing_evidence',
  'reviewed_unresolved_evidence',
]);

export const supplierImportOperationStatuses = Object.freeze([
  'uploaded', 'extracting', 'extracted', 'review_required', 'ready_to_confirm',
  'confirming', 'confirmed', 'partial_recovery_required', 'failed_recoverable',
]);

const normalized = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createSupplierImportOperationIdentity({ quote, revision, scenarioId, attachments, selectedRowKeys, reviewedRows = [], reviewedCurrency }) {
  const sourceIdentity = [...attachments].map((attachment) => ({ attachmentId: attachment.id, sha256: attachment.sha256, documentKind: attachment.document_kind })).sort((left, right) => left.attachmentId.localeCompare(right.attachmentId));
  const rowKeys = [...new Set(selectedRowKeys || [])].sort();
  const reviewedEvidence = reviewedRows.map((row) => ({ reference: normalized(row.displayReference), quantity: row.quantity, widthMm: row.widthMm, heightMm: row.heightMm, unitPrice: row.unitPrice, totalPrice: row.totalPrice, currency: normalized(row.currency), classification: row.classification || 'standard', included: row.includedInSupplierTotal !== false, alternativeTo: normalized(row.alternativeTo), product: normalized(row.manufacturerEvidence?.product ?? row.product), productSystem: normalized(row.manufacturerEvidence?.productSystem ?? row.productSystem) }));
  const selectionIdentity = { rowKeys, reviewedEvidenceHash: hash(reviewedEvidence) };
  const identity = { supplier: normalized(quote.supplier_code || quote.supplier_name), quotation: normalized(revision.supplier_quotation_number), revision: normalized(revision.supplier_revision), scenarioId: String(scenarioId), sourceIdentity, selectionIdentity, reviewedCurrency: normalized(reviewedCurrency) };
  const operationKey = hash(identity);
  return { operationId: `supplier-import-operation-${operationKey}`, operationKey, sourceIdentity, selectionIdentity };
}

export function evaluateSupplierImportCompletion(counts) {
  const values = Object.fromEntries(Object.entries(counts || {}).map(([key, value]) => [key, Number(value || 0)]));
  const expected = values.validCanonicalPositions;
  const failures = [];
  if (values.selectedPositions < 1) failures.push('No reviewed positions were selected.');
  if (expected < 1) failures.push(`${values.selectedPositions} positions selected — none are canonical-ready.`);
  if (values.persistedPositions !== expected) failures.push(`${expected} canonical-ready positions expected but ${values.persistedPositions} supplier positions persisted.`);
  if (values.productsSupplyRows !== expected) failures.push(`${expected} Products / Supply rows expected but ${values.productsSupplyRows} persisted.`);
  if (values.projectCostingRows !== expected) failures.push(`${expected} Project Costing product rows expected but ${values.projectCostingRows} persisted.`);
  if (failures.length) return { status: 'partial_recovery_required', confirmed: false, failures };
  if (values.reviewRequiredPositions > 0) return { status: 'review_required', confirmed: false, failures: [`Review required for ${values.reviewRequiredPositions} positions; ${expected} canonical-ready positions were preserved.`] };
  return { status: 'confirmed', confirmed: true, failures: [] };
}

export async function readSupplierImportState(db, { scenarioId, revisionId }) {
  const one = async (sql, ...params) => Number((await db.get(sql, ...params))?.count || 0);
  return {
    importRuns: await one('SELECT COUNT(*) count FROM supplier_quote_import_runs WHERE revision_id=?', revisionId),
    supplierPositions: await one('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', revisionId),
    productsSupplyRows: await one('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND source_revision_id=?', scenarioId, revisionId),
    projectCostingRows: await one('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND source_revision_id=? AND estimate_position_id IS NOT NULL', scenarioId, revisionId),
    supplierExtras: await one('SELECT COUNT(*) count FROM supplier_quote_extras WHERE revision_id=?', revisionId),
    projectCostingSupplierCosts: await one('SELECT COUNT(*) count FROM project_calculator_estimate_supplier_costs WHERE scenario_id=? AND source_revision_id=?', scenarioId, revisionId),
    revisionScenarioLinks: await one('SELECT COUNT(*) count FROM project_calculator_supplier_quote_revisions WHERE scenario_id=? AND revision_id=?', scenarioId, revisionId),
  };
}

export async function inspectConfirmedProjectionDrift(db, { estimateId = null, revisionId = null } = {}) {
  const clauses = ["operation.status='confirmed'"];
  const parameters = [];
  if (estimateId) { clauses.push('operation.estimate_id=?'); parameters.push(estimateId); }
  if (revisionId) { clauses.push('operation.revision_id=?'); parameters.push(revisionId); }
  const operations = await db.all(`SELECT operation.id,operation.revision_id,operation.scenario_id,operation.intended_counts_json,operation.post_state_json FROM supplier_quote_import_operations operation WHERE ${clauses.join(' AND ')} ORDER BY operation.confirmed_at,operation.id`, ...parameters);
  const results = [];
  for (const operation of operations) {
    const intended = JSON.parse(operation.intended_counts_json || '{}');
    const expected = Number(intended.validCanonicalPositions || 0);
    const current = await readSupplierImportState(db, { scenarioId: operation.scenario_id, revisionId: operation.revision_id });
    const missing = {
      supplierPositions: Math.max(0, expected - current.supplierPositions),
      productsSupplyRows: Math.max(0, expected - current.productsSupplyRows),
      projectCostingRows: Math.max(0, expected - current.projectCostingRows),
    };
    const drifted = Object.values(missing).some((count) => count > 0);
    results.push({ operationId: operation.id, revisionId: operation.revision_id, scenarioId: operation.scenario_id, expectedCanonicalPositions: expected, current, missing, status: drifted ? 'projection_drift' : 'current', historicalPostState: JSON.parse(operation.post_state_json || '{}') });
  }
  return results;
}

export async function reconcileStaleSupplierImportRuns(db, { now = new Date(), thresholdMs = 15 * 60 * 1000 } = {}) {
  const cutoff = new Date(now.getTime() - thresholdMs).toISOString();
  const stale = await db.all("SELECT id,operation_id FROM supplier_quote_import_runs WHERE status IN ('queued','running') AND started_at<?", cutoff);
  if (!stale.length) return [];
  const completedAt = now.toISOString();
  await db.exec('BEGIN IMMEDIATE');
  try {
    for (const run of stale) {
      await db.run("UPDATE supplier_quote_import_runs SET status='failed',confirmation_status='failed_recoverable',completed_at=?,error_code='stale_import_run',error_message='Import was interrupted before completion; original evidence is retained and reviewed recovery is required.',recovery_reason=COALESCE(recovery_reason,'process_interrupted') WHERE id=?", completedAt, run.id);
      if (run.operation_id) await db.run("UPDATE supplier_quote_import_operations SET status='failed_recoverable',last_error_code='stale_import_run',last_error_message='Import was interrupted before completion; original evidence is retained and reviewed recovery is required.',updated_at=? WHERE id=? AND status<>'confirmed'", completedAt, run.operation_id);
    }
    await db.exec('COMMIT');
  } catch (error) { await db.exec('ROLLBACK'); throw error; }
  return stale.map((run) => run.id);
}

export function supplierImportFailure(stage) {
  return Object.assign(new Error(`Injected supplier import failure at ${stage}.`), { code: `supplier_import_${stage}_failed`, stage });
}
