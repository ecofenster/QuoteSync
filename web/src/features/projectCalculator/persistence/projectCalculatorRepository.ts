import { isValidCurrencyCode, isValidDecimalString } from "../../commercial/domain/commercial.validation";
import { requireEstimate, requireValid, stringifyJson, withSqliteTransaction, type SqliteDatabase } from "../../commercial/persistence/sqlitePersistence";
import type { CalculatorSnapshot, PricingScenario, ProjectCalculator, ProjectCostItem } from "../domain/projectCalculator.types";
import { validateCalculatorSnapshot, validatePricingScenario, validateProjectCalculator, validateProjectCostItem } from "../domain/projectCalculator.validation";

export type PersistedProjectCalculator = ProjectCalculator & { archivedAt: string | null };
export type PersistedProjectCostItem = ProjectCostItem & {
  exchangeRate: string | null;
  exchangeRateDate: string | null;
  exchangeRateSource: string | null;
  convertedTotalAmount: string | null;
  convertedCurrency: string | null;
};

function validateConversion(item: PersistedProjectCostItem): void {
  if (item.exchangeRate != null && !isValidDecimalString(item.exchangeRate)) throw new Error("Exchange rate must be exact decimal text.");
  if (item.convertedTotalAmount != null && !isValidDecimalString(item.convertedTotalAmount)) throw new Error("Converted total must be exact decimal text.");
  if (item.convertedCurrency != null && !isValidCurrencyCode(item.convertedCurrency)) throw new Error("Converted currency must be normalized.");
  const hasConversion = item.convertedTotalAmount != null || item.convertedCurrency != null;
  if (hasConversion && (!item.exchangeRate || !item.exchangeRateDate || !item.exchangeRateSource || !item.convertedTotalAmount || !item.convertedCurrency)) throw new Error("Conversion snapshots require rate, date, source, amount, and currency.");
}

export function createProjectCalculatorRepository(db: SqliteDatabase) {
  async function createCalculator(calculator: PersistedProjectCalculator): Promise<void> {
    requireValid(validateProjectCalculator(calculator)); await requireEstimate(db, calculator.estimateId);
    await db.run("INSERT INTO project_calculators (id,estimate_id,base_currency,active_scenario_id,created_at,updated_at,archived_at) VALUES (?,?,?,?,?,?,?)", calculator.id, calculator.estimateId, calculator.baseCurrency, calculator.activeScenarioId, calculator.createdAt, calculator.updatedAt, calculator.archivedAt);
  }
  async function createCostItem(item: PersistedProjectCostItem): Promise<void> {
    requireValid(validateProjectCostItem(item)); validateConversion(item);
    await db.run(`INSERT INTO project_cost_items (id,calculator_id,estimate_id,category,label,quantity,unit_cost_amount,unit_cost_currency,total_cost_amount,total_cost_currency,source,included,supplier_quote_revision_id,supplier_position_id,manually_overridden,source_value_snapshot_json,exchange_rate,exchange_rate_date,exchange_rate_source,converted_total_amount,converted_currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, item.id, item.calculatorId, item.estimateId, item.category, item.label, item.quantity, item.unitCost.amount, item.unitCost.currency, item.totalCost.amount, item.totalCost.currency, item.source, item.included ? 1 : 0, item.supplierQuoteRevisionId, item.supplierPositionId, item.manuallyOverridden ? 1 : 0, item.sourceValueSnapshot == null ? null : stringifyJson(item.sourceValueSnapshot), item.exchangeRate, item.exchangeRateDate, item.exchangeRateSource, item.convertedTotalAmount, item.convertedCurrency, item.createdAt, item.updatedAt);
  }
  async function createScenario(scenario: PricingScenario): Promise<void> {
    requireValid(validatePricingScenario(scenario));
    const money = [scenario.netCost, scenario.contingency, scenario.grossProfit, scenario.vatAmount, scenario.sellingPriceExVat, scenario.sellingPriceIncVat];
    if (money.some((value) => value.currency !== scenario.netCost.currency)) throw new Error("Pricing scenario values must use one scenario currency.");
    await db.run(`INSERT INTO pricing_scenarios (id,calculator_id,estimate_id,name,status,markup_percent,target_margin_percent,net_cost_amount,currency,contingency_amount,gross_profit_amount,margin_percent,vat_status,vat_rate_percent,vat_amount,selling_price_ex_vat,selling_price_inc_vat,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, scenario.id, scenario.calculatorId, scenario.estimateId, scenario.name, scenario.status, scenario.markupPercent, scenario.targetMarginPercent, scenario.netCost.amount, scenario.netCost.currency, scenario.contingency.amount, scenario.grossProfit.amount, scenario.marginPercent, scenario.vatStatus, scenario.vatRatePercent, scenario.vatAmount.amount, scenario.sellingPriceExVat.amount, scenario.sellingPriceIncVat.amount, scenario.createdAt, scenario.updatedAt);
  }
  async function appendSnapshot(snapshot: CalculatorSnapshot): Promise<void> {
    requireValid(validateCalculatorSnapshot(snapshot));
    await db.run("INSERT INTO calculator_snapshots (id,calculator_id,estimate_id,scenario_id,snapshot_version,calculation_inputs_json,calculation_outputs_json,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)", snapshot.id, snapshot.calculatorId, snapshot.estimateId, snapshot.scenarioId, snapshot.snapshotVersion, stringifyJson(snapshot.calculationInputs), stringifyJson(snapshot.calculationOutputs), snapshot.createdAt, snapshot.createdBy);
  }
  async function createCalculatorWithScenario(calculator: PersistedProjectCalculator, scenario: PricingScenario): Promise<void> {
    if (calculator.estimateId !== scenario.estimateId || calculator.id !== scenario.calculatorId) throw new Error("Calculator/scenario ownership mismatch.");
    await withSqliteTransaction(db, async () => { await createCalculator({ ...calculator, activeScenarioId: null }); await createScenario(scenario); await db.run("UPDATE project_calculators SET active_scenario_id=?,updated_at=? WHERE id=? AND estimate_id=?", scenario.id, calculator.updatedAt, calculator.id, calculator.estimateId); });
  }
  return { createCalculator, createCostItem, createScenario, appendSnapshot, createCalculatorWithScenario };
}
