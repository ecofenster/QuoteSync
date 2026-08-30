import type { CalculatorScenario } from "./projectCalculatorLab.types";
import { resolveManufacturerVisualAssetUrl } from "../../manufacturerVisuals/manufacturerVisualAssetUrl";

function normalizeProductVisual<T extends CalculatorScenario["products"][number]>(product: T): T {
  const snapshot = product.sourceSnapshot as Record<string, unknown> | null;
  const evidence = snapshot?.manufacturerEvidence as Record<string, unknown> | undefined;
  const visual = evidence?.sourceVisual as Record<string, unknown> | undefined;
  if (!visual || typeof visual.url !== "string") return product;
  const sourceVisuals = Array.isArray(evidence?.sourceVisuals)
    ? evidence.sourceVisuals.map((item) => {
        const candidate = item as Record<string, unknown>;
        return typeof candidate.url === "string" ? { ...candidate, url: resolveManufacturerVisualAssetUrl(candidate.url) } : candidate;
      })
    : undefined;
  return { ...product, sourceSnapshot: { ...snapshot, manufacturerEvidence: { ...evidence, ...(sourceVisuals ? { sourceVisuals } : {}), sourceVisual: { ...visual, url: resolveManufacturerVisualAssetUrl(visual.url) } } } } as T;
}

export function normalizeCalculatorScenario(value: CalculatorScenario): CalculatorScenario {
  return {
    ...value,
    products: Array.isArray(value.products) ? value.products.map(normalizeProductVisual) : [],
    supplierCosts: Array.isArray(value.supplierCosts) ? value.supplierCosts : [],
    packageItems: Array.isArray(value.packageItems) ? value.packageItems : [],
    routeSnapshots: Array.isArray(value.routeSnapshots) ? value.routeSnapshots : [],
    exchangeRates: Array.isArray(value.exchangeRates) ? value.exchangeRates : [],
    revisions: Array.isArray(value.revisions) ? value.revisions : [],
    supplierSummary: value.supplierSummary ? {
      ...value.supplierSummary,
      productSubtotalGbp: value.supplierSummary.productSubtotalGbp ?? null,
      deliveryTotalGbp: value.supplierSummary.deliveryTotalGbp ?? null,
      finalSupplierTotalGbp: value.supplierSummary.finalSupplierTotalGbp ?? null,
      quotations: Array.isArray(value.supplierSummary.quotations) ? value.supplierSummary.quotations : [],
    } : null,
  };
}
