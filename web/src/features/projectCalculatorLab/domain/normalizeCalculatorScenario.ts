import type { CalculatorScenario } from "./projectCalculatorLab.types";

export function normalizeCalculatorScenario(value: CalculatorScenario): CalculatorScenario {
  return {
    ...value,
    products: Array.isArray(value.products) ? value.products : [],
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
