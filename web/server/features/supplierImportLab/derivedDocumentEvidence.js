import { createHash } from 'node:crypto';

const COMMERCIAL_FIELDS = new Set(['price', 'currency', 'quantity', 'width', 'height', 'dimensions']);
const normalized = (value) => String(value ?? '').replace(/\s+/g, ' ').replace(/[×]/g, 'x').replace(/,/g, '.').trim().toLowerCase();

export function derivedDocumentCacheIdentity({ sourceSha256, converter, converterVersion, conversionProfile }) {
  if (!/^[a-f0-9]{64}$/i.test(String(sourceSha256 ?? ''))) throw new Error('A valid immutable source SHA-256 is required.');
  const identity = { sourceSha256: sourceSha256.toLowerCase(), converter: String(converter), converterVersion: String(converterVersion), conversionProfile: String(conversionProfile) };
  return `manufacturer-derived-document-${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`;
}

/**
 * A derived document can corroborate original-PDF evidence, but never silently
 * override it. Commercial disagreements fail closed; technical wording
 * disagreements retain both representations for review.
 */
export function assessDerivedEvidence({ category, nativeValue, derivedValue, nativeProvenance, derivedProvenance }) {
  const native = normalized(nativeValue);
  const derived = normalized(derivedValue);
  if (!derived) return { status: native ? 'native_only' : 'missing', chosenValue: nativeValue ?? null, reviewRequired: false, provenance: native ? [nativeProvenance] : [] };
  if (native && native === derived) return { status: 'corroborated', chosenValue: nativeValue, reviewRequired: false, provenance: [nativeProvenance, derivedProvenance] };
  if (native) return { status: COMMERCIAL_FIELDS.has(category) ? 'commercial_conflict' : 'specification_conflict', chosenValue: nativeValue, derivedValue, reviewRequired: true, provenance: [nativeProvenance, derivedProvenance] };
  return { status: COMMERCIAL_FIELDS.has(category) ? 'commercial_source_missing' : 'derived_candidate_review', chosenValue: null, derivedValue, reviewRequired: true, provenance: [derivedProvenance] };
}

export function shouldAttemptDerivedDocument({ nativePositionCount, expectedPositionCount, structuredFieldCounts, approvedConverterAvailable, supplierProfileAllowsDerivedPass }) {
  if (!approvedConverterAvailable || !supplierProfileAllowsDerivedPass) return false;
  if (Number(nativePositionCount) !== Number(expectedPositionCount)) return true;
  return Array.isArray(structuredFieldCounts) && structuredFieldCounts.some((count) => Number(count) < 1);
}
