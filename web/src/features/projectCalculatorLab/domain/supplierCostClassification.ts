import type { CalculatorSupplierCost } from "./projectCalculatorLab.types";

const OPTIONAL_SUPPLIER_CATEGORIES = new Set([
  "supplier_installation",
  "supplier_survey",
]);

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();

/**
 * Resolve the Project Costing role from controlled source evidence. Persisted
 * legacy categories remain provenance only and cannot override that role.
 */
export function resolveProjectCostingSupplierCategory(
  persistedCategory: unknown,
  sourceSnapshot: unknown,
) {
  const source = record(sourceSnapshot);
  const classification = record(source.sourceCommercialClassification);
  const classified = classification.projectCostingCategory;
  if (typeof classified === "string" && classified.trim()) return classified.trim();

  switch (normalized(source.commercialRole)) {
    case "installation":
      return "supplier_installation";
    case "survey":
      return "supplier_survey";
    case "coupling_profile":
      return "product_supply";
    case "delivery":
      return "delivery";
    case "external_cills":
      return "extras";
    case "discount":
      return "supplier_discount";
    default:
      return String(persistedCategory || "other");
  }
}

export function normalizeSupplierCostForProjectCosting(
  row: CalculatorSupplierCost,
): CalculatorSupplierCost {
  const persistedCategory = row.persistedCategory ?? row.category;
  const category = resolveProjectCostingSupplierCategory(
    persistedCategory,
    row.sourceSnapshot,
  );
  let includedInCurrentEstimate = row.includedInCurrentEstimate;

  if (OPTIONAL_SUPPLIER_CATEGORIES.has(category)) {
    const explicitDecision = String(row.inclusionEvidence ?? "").startsWith(
      `${category}:user_`,
    );
    const legacyRoleWasReclassified = category !== row.category;
    const serverExposedPersistedCategory = row.persistedCategory != null;
    if (!explicitDecision && (legacyRoleWasReclassified || serverExposedPersistedCategory)) {
      includedInCurrentEstimate = false;
    }
  }

  return {
    ...row,
    persistedCategory,
    category,
    includedInCurrentEstimate,
  };
}

export function normalizeSupplierCostsForProjectCosting(value: unknown) {
  return Array.isArray(value)
    ? value.map((row) => normalizeSupplierCostForProjectCosting(row as CalculatorSupplierCost))
    : [];
}
