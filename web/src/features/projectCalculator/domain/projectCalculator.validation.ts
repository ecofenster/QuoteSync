import { isValidCurrencyCode, isValidDecimalString, validateMoney } from "../../commercial/domain/commercial.validation";
import type { ValidationIssue, ValidationResult } from "../../commercial/domain/commercial.types";
import type { CalculatorSnapshot, PricingScenario, ProjectCalculator, ProjectCostItem } from "./projectCalculator.types";

function result(issues: ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues };
}

function requiredString(value: unknown, path: string, issues: ValidationIssue[]) {
  if (typeof value !== "string" || !value.trim()) issues.push({ code: "required", path, message: `${path} is required.` });
}

function requireOwnership(value: { estimateId: unknown }, issues: ValidationIssue[]) {
  requiredString(value.estimateId, "estimateId", issues);
}

export function validateProjectCalculator(calculator: ProjectCalculator): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireOwnership(calculator, issues);
  requiredString(calculator.id, "id", issues);
  if (!isValidCurrencyCode(calculator.baseCurrency)) issues.push({ code: "calculator.currency", path: "baseCurrency", message: "Base currency must be normalized." });
  return result(issues);
}

export function validateProjectCostItem(item: ProjectCostItem): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireOwnership(item, issues);
  requiredString(item.calculatorId, "calculatorId", issues);
  requiredString(item.label, "label", issues);
  if (!isValidDecimalString(item.quantity)) issues.push({ code: "cost.quantity", path: "quantity", message: "Quantity must be a decimal string." });
  issues.push(...validateMoney(item.unitCost, { path: "unitCost", allowNegative: item.category === "supplier_extra" }).issues);
  issues.push(...validateMoney(item.totalCost, { path: "totalCost", allowNegative: item.category === "supplier_extra" }).issues);
  if (item.source === "supplier_import" && !item.supplierQuoteRevisionId) issues.push({ code: "cost.supplier_revision", path: "supplierQuoteRevisionId", message: "Imported costs require supplier revision traceability." });
  return result(issues);
}

export function validatePricingScenario(scenario: PricingScenario): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireOwnership(scenario, issues);
  requiredString(scenario.calculatorId, "calculatorId", issues);
  requiredString(scenario.name, "name", issues);
  for (const [path, value] of [["markupPercent", scenario.markupPercent], ["targetMarginPercent", scenario.targetMarginPercent], ["marginPercent", scenario.marginPercent], ["vatRatePercent", scenario.vatRatePercent]] as const) {
    if (value != null && !isValidDecimalString(value)) issues.push({ code: "scenario.decimal", path, message: `${path} must be a decimal string.` });
  }
  for (const field of ["netCost", "contingency", "grossProfit", "vatAmount", "sellingPriceExVat", "sellingPriceIncVat"] as const) {
    issues.push(...validateMoney(scenario[field], { path: field, allowNegative: field === "grossProfit" }).issues);
  }
  return result(issues);
}

export function validateCalculatorSnapshot(snapshot: CalculatorSnapshot): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireOwnership(snapshot, issues);
  requiredString(snapshot.calculatorId, "calculatorId", issues);
  requiredString(snapshot.scenarioId, "scenarioId", issues);
  requiredString(snapshot.snapshotVersion, "snapshotVersion", issues);
  requiredString(snapshot.createdBy, "createdBy", issues);
  return result(issues);
}
