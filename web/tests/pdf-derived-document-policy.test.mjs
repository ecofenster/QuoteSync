import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDerivedEvidence, derivedDocumentCacheIdentity, shouldAttemptDerivedDocument } from '../server/features/supplierImportLab/derivedDocumentEvidence.js';

const native = { representation: 'original_pdf', sourceHash: 'a'.repeat(64), page: 2 };
const derived = { representation: 'derived_docx', sourceHash: 'a'.repeat(64), converter: 'word', converterVersion: '16' };

test('derived evidence corroborates but never replaces matching original-PDF evidence', () => {
  assert.deepEqual(assessDerivedEvidence({ category: 'frame', nativeValue: '140090 frame Nord-Line', derivedValue: '140090 frame Nord-Line', nativeProvenance: native, derivedProvenance: derived }), {
    status: 'corroborated', chosenValue: '140090 frame Nord-Line', reviewRequired: false, provenance: [native, derived],
  });
});

test('derived commercial conflicts fail closed and technical conflicts retain both representations', () => {
  const price = assessDerivedEvidence({ category: 'price', nativeValue: '436.31', derivedValue: '463.31', nativeProvenance: native, derivedProvenance: derived });
  assert.equal(price.status, 'commercial_conflict');
  assert.equal(price.chosenValue, '436.31');
  assert.equal(price.reviewRequired, true);
  const wording = assessDerivedEvidence({ category: 'frame', nativeValue: '140090 frame Nord-Line', derivedValue: 'frame Nord-Line', nativeProvenance: native, derivedProvenance: derived });
  assert.equal(wording.status, 'specification_conflict');
  assert.equal(wording.chosenValue, '140090 frame Nord-Line');
  assert.equal(wording.derivedValue, 'frame Nord-Line');
  assert.equal(wording.reviewRequired, true);
});

test('derived pass is capability-gated and cache identity includes source, converter, version and profile', () => {
  assert.equal(shouldAttemptDerivedDocument({ nativePositionCount: 12, expectedPositionCount: 12, structuredFieldCounts: Array(12).fill(40), approvedConverterAvailable: true, supplierProfileAllowsDerivedPass: true }), false);
  assert.equal(shouldAttemptDerivedDocument({ nativePositionCount: 12, expectedPositionCount: 12, structuredFieldCounts: [40, 0], approvedConverterAvailable: true, supplierProfileAllowsDerivedPass: true }), true);
  assert.equal(shouldAttemptDerivedDocument({ nativePositionCount: 0, expectedPositionCount: 12, structuredFieldCounts: [], approvedConverterAvailable: false, supplierProfileAllowsDerivedPass: true }), false);
  const one = derivedDocumentCacheIdentity({ sourceSha256: 'a'.repeat(64), converter: 'word', converterVersion: '16', conversionProfile: 'pdf-reflow-v1' });
  const two = derivedDocumentCacheIdentity({ sourceSha256: 'a'.repeat(64), converter: 'word', converterVersion: '17', conversionProfile: 'pdf-reflow-v1' });
  assert.match(one, /^manufacturer-derived-document-[a-f0-9]{64}$/);
  assert.notEqual(one, two);
});
