export const CANONICAL_QUOTATION_PACKAGE_LEVELS = Object.freeze([
  Object.freeze({ id: 'supply_only', label: 'Supply Only', upliftCategory: null }),
  Object.freeze({ id: 'supply_installation_support', label: 'Supply + Installation Support', upliftCategory: 'installation_support' }),
  Object.freeze({ id: 'supply_install', label: 'Supply + Install', upliftCategory: 'installation' }),
]);

const LEVEL_BY_ID = new Map(CANONICAL_QUOTATION_PACKAGE_LEVELS.map((item) => [item.id, item]));
const MARKETING_SEQUENCES = new Set(['bronze|silver|gold', 'silver|gold|platinum']);

const normalizeLabel = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const marketingTier = (value) => normalizeLabel(value).match(/\b(bronze|silver|gold|platinum)\b/)?.[1] ?? null;

function explicitCanonicalLevel(value) {
  const label = normalizeLabel(value);
  if (/\bsupply\s*(?:\/|\+|and)?\s*only\b/.test(label)) return 'supply_only';
  if (/\b(?:installation|install)\s+support\b/.test(label)) return 'supply_installation_support';
  if (/\bfull\s+installation\b/.test(label) || /\bsupply\s*(?:\+|and)\s*install(?:ation)?\b/.test(label)) return 'supply_install';
  return null;
}

export function canonicalQuotationPackageLabel(level) {
  return LEVEL_BY_ID.get(level)?.label ?? 'Please confirm';
}

export function canonicalQuotationPackageUpliftCategory(level) {
  return LEVEL_BY_ID.get(level)?.upliftCategory ?? null;
}

export function buildQuotationPackageEvidence(comparisonTotals = []) {
  const sourceOptions = (Array.isArray(comparisonTotals) ? comparisonTotals : []).filter((item) => item?.classification === 'package_option');
  const marketingSequence = sourceOptions.length === CANONICAL_QUOTATION_PACKAGE_LEVELS.length
    ? sourceOptions.map((item) => marketingTier(item.label)).join('|')
    : '';
  const recognizedSequence = MARKETING_SEQUENCES.has(marketingSequence);

  return sourceOptions.map((item, index) => {
    const explicitLevel = explicitCanonicalLevel(item.label);
    const canonicalPackageLevel = explicitLevel ?? (recognizedSequence ? CANONICAL_QUOTATION_PACKAGE_LEVELS[index].id : null);
    const level = canonicalPackageLevel ? LEVEL_BY_ID.get(canonicalPackageLevel) : null;
    return {
      id: `evidence-${index}`,
      label: item.label,
      sourceLabel: item.label,
      description: item.label,
      enabled: true,
      isBase: level ? level.id === 'supply_only' : index === 0,
      packageType: level?.id ?? 'review_required',
      canonicalPackageLevel,
      canonicalPackageLabel: level?.label ?? 'Please confirm',
      canonicalMeaningProvenance: explicitLevel ? 'quotation_wording' : recognizedSequence ? 'recognized_marketing_sequence' : 'review_required',
      upliftCategory: level?.upliftCategory ?? (index === 0 ? null : 'installation'),
      amount: item.amount,
      amountProvenance: 'supplier_quotation',
      sourceTrace: Array.isArray(item.sourceTrace) ? item.sourceTrace : [],
      displayOrder: index,
      selected: Boolean(item.selected),
    };
  });
}

export function correctQuotationPackageMeaning(packages, packageId, canonicalPackageLevel) {
  const level = LEVEL_BY_ID.get(canonicalPackageLevel);
  if (!level) throw new RangeError('Unsupported canonical quotation package meaning.');
  return (Array.isArray(packages) ? packages : []).map((item) => {
    if (item.id === packageId) return {
      ...item,
      isBase: level.id === 'supply_only',
      packageType: level.id,
      canonicalPackageLevel: level.id,
      canonicalPackageLabel: level.label,
      canonicalMeaningProvenance: 'manual',
      upliftCategory: level.upliftCategory,
    };
    return level.id === 'supply_only' ? { ...item, isBase: false } : item;
  });
}
