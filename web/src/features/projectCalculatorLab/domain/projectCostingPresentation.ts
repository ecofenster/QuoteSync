import type { CalculatorProductRow, CalculatorScenario, CalculatorSupplierCost } from "./projectCalculatorLab.types";

type UnpricedSupplierTotal = { originalAmount: string; originalCurrency: string };
type OriginalEvidenceRow = Pick<CalculatorProductRow | CalculatorSupplierCost, "originalAmount" | "originalCurrency" | "sourceSnapshot">;

function sourceRevisionId(row: OriginalEvidenceRow) {
  const value = row.sourceSnapshot?.supplierRevisionId;
  return typeof value === "string" && value ? value : null;
}

export function supplierNameForProduct(row: CalculatorProductRow) {
  const value = row.sourceSnapshot?.supplierName;
  if (typeof value === "string" && value.trim()) return value.trim();
  return row.evidenceOrigin === "manual" ? "Manual entry" : "Supplier not recorded";
}

export function originalSupplierPurchaseGroups(scenario: CalculatorScenario, unpricedTotals: UnpricedSupplierTotal[] = []) {
  const groups: Record<string, string[]> = {};
  const quotations = scenario.supplierSummary?.quotations ?? [];
  const revisionsWithFinalTotals = new Set<string>();
  for (const quotation of quotations) {
    if (quotation.finalSupplierTotal == null) continue;
    (groups[quotation.currency] ??= []).push(quotation.finalSupplierTotal);
    revisionsWithFinalTotals.add(quotation.revisionId);
  }
  for (const row of [...scenario.products, ...scenario.supplierCosts]) {
    const revisionId = sourceRevisionId(row);
    if (revisionId && revisionsWithFinalTotals.has(revisionId)) continue;
    if (row.originalAmount != null && row.originalCurrency) (groups[row.originalCurrency] ??= []).push(row.originalAmount);
  }
  if (!quotations.length) for (const total of unpricedTotals) (groups[total.originalCurrency] ??= []).push(total.originalAmount);
  return groups;
}
