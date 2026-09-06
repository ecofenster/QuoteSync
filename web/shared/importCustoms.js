const DECIMAL = /^\d+(?:\.\d+)?$/;

const parseDecimal = (value) => {
  const text = String(value ?? "0").trim();
  if (!DECIMAL.test(text)) throw Object.assign(new Error("Import / Customs amounts and percentages must be non-negative decimal values."), { code: "invalid_import_customs" });
  const [whole, fraction = ""] = text.split(".");
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length };
};

const scale = (value, places) => {
  const parsed = parseDecimal(value);
  if (parsed.scale <= places) return parsed.integer * 10n ** BigInt(places - parsed.scale);
  const divisor = 10n ** BigInt(parsed.scale - places);
  return (parsed.integer + divisor / 2n) / divisor;
};

const money = (pence) => `${pence / 100n}.${String(pence % 100n).padStart(2, "0")}`;
const percentagePence = (amountPence, percentage) => {
  const rate = parseDecimal(percentage);
  const divisor = 100n * 10n ** BigInt(rate.scale);
  return (amountPence * rate.integer + divisor / 2n) / divisor;
};

export const IMPORT_CUSTOMS_RULE_VERSION = "global-import-customs-allowance-v2";
export const GLOBAL_IMPORT_CUSTOMS_DEFAULTS = Object.freeze({
  includedByDefault: true,
  baseImportCost: "237.17",
  contingencyPercent: "0",
  defaultImports: 1,
  dutyPercent: "0",
  dutyBasisAmount: "0",
  markupPercent: "20",
  provenance: {
    method: "observed_import_customs_average",
    observedAverage: "237.17",
    excludedEvidence: "import_vat",
  },
});

export function normalizeImportCustomsDefaults(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const includedByDefault = source.includedByDefault ?? source.required ?? true;
  return {
    includedByDefault: includedByDefault !== false,
    baseImportCost: source.baseImportCost == null ? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.baseImportCost : String(source.baseImportCost),
    contingencyPercent: source.contingencyPercent == null ? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.contingencyPercent : String(source.contingencyPercent),
    defaultImports: source.defaultImports == null ? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.defaultImports : Number(source.defaultImports),
    dutyPercent: source.dutyPercent == null ? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.dutyPercent : String(source.dutyPercent),
    dutyBasisAmount: source.dutyBasisAmount == null ? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.dutyBasisAmount : String(source.dutyBasisAmount),
    markupPercent: source.markupPercent == null ? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.markupPercent : String(source.markupPercent),
    importVatTreatment: "excluded",
    allowanceType: "internal_commercial_allowance",
    status: "configured",
    provenance: source.provenance ?? GLOBAL_IMPORT_CUSTOMS_DEFAULTS.provenance,
    ruleVersion: IMPORT_CUSTOMS_RULE_VERSION,
  };
}

export function validateImportCustomsConfiguration(value) {
  const normalized = normalizeImportCustomsDefaults(value);
  if (!Number.isSafeInteger(normalized.defaultImports) || normalized.defaultImports < 1) throw Object.assign(new Error("Number of Imports must be a positive whole number."), { code: "invalid_import_customs" });
  for (const [label, amount] of [["Base Import Cost", normalized.baseImportCost], ["Cost Contingency", normalized.contingencyPercent], ["Duty", normalized.dutyPercent], ["Duty Basis Amount", normalized.dutyBasisAmount], ["Import / Customs Markup", normalized.markupPercent]]) {
    parseDecimal(amount);
    if ((label === "Cost Contingency" || label === "Duty" || label === "Import / Customs Markup") && Number(amount) > 999.99) throw Object.assign(new Error(`${label} must not exceed 999.99%.`), { code: "invalid_import_customs" });
  }
  return normalized;
}

export function normalizeImportCustomsSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  // Accept the superseded Phase 1 entries shape read-only; never use it as an active option source.
  if (Array.isArray(value.entries)) return value.entries[0] && typeof value.entries[0] === "object" ? value.entries[0] : null;
  return value;
}

export function calculateImportCustoms(value, markupOverride = null) {
  const source = normalizeImportCustomsSnapshot(value);
  if (!source) return null;
  const normalized = normalizeImportCustomsDefaults(source);
  const included = source.included == null ? normalized.includedByDefault : source.included === true;
  const basePence = scale(normalized.baseImportCost, 2);
  const contingencyPence = percentagePence(basePence, normalized.contingencyPercent);
  const perImportPence = basePence + contingencyPence;
  const allowancePence = perImportPence * BigInt(normalized.defaultImports);
  const dutyBasisPence = scale(normalized.dutyBasisAmount, 2);
  const dutyPence = percentagePence(dutyBasisPence, normalized.dutyPercent);
  const activePurchasePence = included ? allowancePence + dutyPence : 0n;
  const markup = markupOverride == null ? normalized.markupPercent : String(markupOverride);
  const sellingPence = activePurchasePence + percentagePence(activePurchasePence, markup);
  return {
    ...source,
    ...normalized,
    id: "global-import-customs",
    included,
    contingencyAmount: money(contingencyPence),
    budgetedImportCostPerImport: money(perImportPence),
    importAllowanceCost: money(allowancePence),
    dutyCost: money(dutyPence),
    purchaseCost: money(activePurchasePence),
    sellingPrice: money(sellingPence),
    markupPercent: markup,
    reviewRequired: [],
  };
}

export function createImportCustomsSnapshot(defaults, context = {}) {
  const normalized = validateImportCustomsConfiguration(defaults);
  return calculateImportCustoms({
    ...normalized,
    id: "global-import-customs",
    included: normalized.includedByDefault,
    capturedAt: context.capturedAt ?? new Date().toISOString(),
    source: context.source ?? "global_project_costing_default",
  }, normalized.markupPercent);
}
