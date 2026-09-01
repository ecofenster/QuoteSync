const OPTIONAL_SUPPLIER_CATEGORIES = new Set(["supplier_installation", "supplier_survey"]);

const normalized = value => String(value ?? "").trim().toLowerCase();

export function resolveProjectCostingSupplierCategory(persistedCategory, sourceSnapshot = null) {
  const source = sourceSnapshot && typeof sourceSnapshot === "object" ? sourceSnapshot : {};
  const classified = source.sourceCommercialClassification && typeof source.sourceCommercialClassification === "object"
    ? source.sourceCommercialClassification.projectCostingCategory
    : null;
  if (classified) return String(classified);
  const role = normalized(source.commercialRole);
  if (role === "installation") return "supplier_installation";
  if (role === "survey") return "supplier_survey";
  if (role === "coupling_profile") return "product_supply";
  if (role === "delivery") return "delivery";
  if (role === "external_cills") return "extras";
  if (role === "discount") return "supplier_discount";
  return String(persistedCategory || "other");
}

export const isOptionalSupplierCostCategory = category => OPTIONAL_SUPPLIER_CATEGORIES.has(String(category));

export function resolveSupplierCostInclusion({ persistedCategory, sourceSnapshot, included, inclusionEvidence }) {
  const category = resolveProjectCostingSupplierCategory(persistedCategory, sourceSnapshot);
  if (!isOptionalSupplierCostCategory(category)) return Boolean(included);
  const decisionPrefix = `${category}:user_`;
  return String(inclusionEvidence ?? "").startsWith(decisionPrefix) ? Boolean(included) : false;
}

export function supplierCostDecisionEvidence(category, included) {
  if (!isOptionalSupplierCostCategory(category)) return null;
  return `${category}:user_${included ? "selected" : "declined"}`;
}
