import { createHash } from 'node:crypto';

export const MANUFACTURER_EVIDENCE_REFRESH_VERSION = 'manufacturer-evidence-refresh-v2';

const normalizeReference = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
const normalizedDecimal = (value) => value == null || value === '' ? null : String(value).replace(/^(-?)0+(?=\d)/, '$1').replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
  return value;
}

export const canonicalJson = (value) => JSON.stringify(ordered(value));
export const canonicalHash = (value) => createHash('sha256').update(canonicalJson(value)).digest('hex');

export function createManufacturerEvidenceRefreshIdentity({ estimateId, quoteId, revisionId, attachmentId, sourceSha256, sourceSpecificationVersion, internalSpecificationVersion, visualMappingMethods, renderVersion }) {
  const evidenceIdentity = {
    estimateId,
    quoteId,
    revisionId,
    attachmentId,
    sourceSha256,
    sourceSpecificationVersion,
    internalSpecificationVersion,
    visualMappingMethods: [...new Set(visualMappingMethods || [])].sort(),
    renderVersion,
  };
  return {
    id: `supplier-evidence-refresh-${canonicalHash(evidenceIdentity)}`,
    evidenceIdentity,
  };
}

export function buildCommercialFingerprint({ estimateId, quoteId, revision, attachment, link, fxSnapshots, positions, costingRows, canonicalPositions, operations, runs }) {
  const costingBySource = new Map(costingRows.map((row) => [row.source_position_id, row]));
  const canonicalById = new Map(canonicalPositions.map((row) => [row.id, row]));
  const rows = positions.map((position) => {
    const costing = costingBySource.get(position.id);
    const canonical = costing && canonicalById.get(costing.estimate_position_id);
    return {
      supplierPositionIdentity: position.id,
      sourceSequence: Number(position.source_sequence),
      customerManufacturerReference: position.display_reference,
      normalizedReference: normalizeReference(position.display_reference),
      quantity: Number(position.quantity),
      sourceUnitPrice: normalizedDecimal(position.unit_purchase_price_amount),
      sourcePrice: normalizedDecimal(position.total_purchase_price_amount),
      currency: position.currency,
      widthMm: Number(position.width_mm),
      heightMm: Number(position.height_mm),
      quotationRevisionIdentity: position.revision_id,
      productsIdentity: costing?.estimate_position_id ?? null,
      productsProjection: canonical ? {
        id: canonical.id,
        sourcePositionId: canonical.sourceProvenance?.sourcePositionId ?? null,
        sourceRevisionId: canonical.sourceProvenance?.sourceRevisionId ?? null,
        positionRef: canonical.positionRef,
        quantity: Number(canonical.qty),
        widthMm: Number(canonical.widthMm),
        heightMm: Number(canonical.heightMm),
        classification: canonical.classification ?? null,
      } : null,
      projectCostingIdentity: costing?.id ?? null,
      projectCostingValue: costing ? {
        sourcePositionId: costing.source_position_id,
        sourceAttachmentId: costing.source_attachment_id,
        sourceRevisionId: costing.source_revision_id,
        quantity: Number(costing.quantity),
        widthMm: Number(costing.width_mm),
        heightMm: Number(costing.height_mm),
        totalPrice: normalizedDecimal(costing.total_price_amount),
        currency: costing.currency,
        classification: costing.classification,
        included: Number(costing.included_in_current_estimate),
        alternativeToReference: costing.alternative_to_reference ?? null,
      } : null,
      fxSnapshotReference: link?.fx_snapshot_id ?? null,
    };
  });
  const fingerprint = {
    estimateId,
    quoteId,
    revision: revision ? {
      id: revision.id,
      supplierQuoteId: revision.supplier_quote_id,
      quotationNumber: revision.supplier_quotation_number,
      supplierRevision: revision.supplier_revision,
      currency: revision.currency,
      confirmationStatus: revision.confirmation_status,
      confirmationOperationId: revision.confirmation_operation_id,
    } : null,
    sourceAttachment: attachment ? { id: attachment.id, sha256: attachment.sha256, sizeBytes: Number(attachment.size_bytes) } : null,
    revisionScenarioLink: link ? {
      scenarioId: link.scenario_id,
      supplierQuoteId: link.supplier_quote_id,
      revisionId: link.revision_id,
      importRunId: link.import_run_id,
      fxSnapshotId: link.fx_snapshot_id,
      currency: link.currency,
      commercialPolicy: JSON.parse(link.commercial_policy_json || '{}'),
      linkedAt: link.linked_at,
    } : null,
    fxSnapshots: fxSnapshots.map((row) => ({ ...row })),
    confirmedOperations: operations.map((row) => ({ id: row.id, operationKey: row.operation_key, status: row.status, confirmedAt: row.confirmed_at })),
    completedRuns: runs.map((row) => ({ id: row.id, operationId: row.operation_id, status: row.status, confirmationStatus: row.confirmation_status, extractorVersion: row.extractor_version, completedAt: row.completed_at })),
    rows,
  };
  return { hash: canonicalHash(fingerprint), fingerprint };
}

export function assertExtractedCommercialEvidence(extractedRows, fingerprintRows) {
  const extractedByReference = new Map();
  for (const row of extractedRows) {
    const key = normalizeReference(row.displayReference);
    extractedByReference.set(key, [...(extractedByReference.get(key) || []), row]);
  }
  const discrepancies = [];
  const matches = [];
  for (const expected of fingerprintRows) {
    const candidates = extractedByReference.get(expected.normalizedReference) || [];
    if (candidates.length !== 1) {
      discrepancies.push({ reference: expected.customerManufacturerReference, field: 'identity', expected: 'one immutable source position', actual: candidates.length });
      continue;
    }
    const actual = candidates[0];
    const comparisons = [
      ['quantity', expected.quantity, Number(actual.quantity)],
      ['widthMm', expected.widthMm, Number(actual.widthMm)],
      ['heightMm', expected.heightMm, Number(actual.heightMm)],
      ['sourcePrice', expected.sourcePrice, normalizedDecimal(actual.totalPrice)],
      ['sourceUnitPrice', expected.sourceUnitPrice, normalizedDecimal(actual.unitPrice)],
      ['currency', expected.currency, actual.currency],
    ];
    for (const [field, expectedValue, actualValue] of comparisons) if (expectedValue !== actualValue) discrepancies.push({ reference: expected.customerManufacturerReference, field, expected: expectedValue, actual: actualValue });
    matches.push({ expected, row: actual });
  }
  if (extractedRows.length !== fingerprintRows.length) discrepancies.push({ field: 'positionCount', expected: fingerprintRows.length, actual: extractedRows.length });
  if (discrepancies.length) throw Object.assign(new Error('Immutable source commercial evidence differs from the confirmed position fingerprint. Evidence refresh was not applied.'), { code: 'evidence_refresh_commercial_mismatch', discrepancies });
  return matches;
}

export function enrichManufacturerSourceSnapshot(snapshot, sourceRow, refresh) {
  const priorEvidence = snapshot.manufacturerEvidence || {};
  const extractedEvidence = structuredClone(sourceRow.manufacturerEvidence || {});
  const priorReview = priorEvidence.sourceVisual ? {
    customerReviewStatus: priorEvidence.sourceVisual.customerReviewStatus,
    reviewedAt: priorEvidence.sourceVisual.reviewedAt,
  } : {};
  if (extractedEvidence.sourceVisual) Object.assign(extractedEvidence.sourceVisual, Object.fromEntries(Object.entries(priorReview).filter(([, value]) => value != null)));
  const manufacturerEvidence = {
    ...priorEvidence,
    ...extractedEvidence,
    customerSafeSpecification: structuredClone(priorEvidence.customerSafeSpecification ?? extractedEvidence.customerSafeSpecification ?? []),
    evidenceRefresh: refresh,
  };
  return {
    ...snapshot,
    manufacturerEvidence,
    sourceVisual: manufacturerEvidence.sourceVisual ?? snapshot.sourceVisual,
  };
}

export function summarizeManufacturerEvidence(snapshot) {
  const evidence = snapshot?.manufacturerEvidence || {};
  const visuals = Array.isArray(evidence.sourceVisuals) ? evidence.sourceVisuals : [];
  return {
    refreshIdentity: evidence.evidenceRefresh?.id ?? null,
    sourceSpecificationVersion: evidence.sourceSpecification?.version ?? null,
    sourceSpecificationFields: Number(evidence.sourceSpecification?.fieldCount || 0),
    internalSpecificationVersion: evidence.internalSpecification?.version ?? null,
    internalSpecificationItems: Number(evidence.internalSpecification?.itemCount || 0),
    visualRoles: visuals.map((visual) => visual.role),
    availableVisualRoles: visuals.filter((visual) => visual.status === 'available').map((visual) => visual.role),
    visualMappingMethods: [...new Set(visuals.map((visual) => visual.mappingMethod).filter(Boolean))].sort(),
    visualRenderVersions: [...new Set(visuals.map((visual) => visual.renderedDerivative?.renderVersion).filter(Boolean))].sort(),
    primaryVisualRole: evidence.sourceVisual?.role ?? null,
    customerSafeSpecificationCount: Array.isArray(evidence.customerSafeSpecification) ? evidence.customerSafeSpecification.length : 0,
  };
}
