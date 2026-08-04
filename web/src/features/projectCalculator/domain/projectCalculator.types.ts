import type { EstimateId } from "../../../models/types";
import type { CurrencyCode, DecimalString, ISODateTime, JsonValue, Money } from "../../commercial/domain/commercial.types";
import type {
  SupplierQuoteDuplicationPolicy,
  SupplierQuotePositionId,
  SupplierQuoteRevisionId,
  VatStatus,
} from "../../supplierQuoteImport/domain/supplierQuote.types";

export type ProjectCalculatorId = string;
export type ProjectCostItemId = string;
export type PricingScenarioId = string;
export type CalculatorSnapshotId = string;

export type ProjectCalculator = {
  id: ProjectCalculatorId;
  estimateId: EstimateId;
  baseCurrency: CurrencyCode;
  activeScenarioId: PricingScenarioId | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ProjectCostItemCategory =
  | "supplier_purchase"
  | "supplier_delivery"
  | "supplier_extra"
  | "labour"
  | "installation"
  | "material"
  | "plant"
  | "travel"
  | "waste"
  | "overhead"
  | "contingency"
  | "other";

export type ProjectCostItemSource = "supplier_import" | "estimate_default" | "manual" | "calculated";

export type ProjectCostItem = {
  id: ProjectCostItemId;
  calculatorId: ProjectCalculatorId;
  estimateId: EstimateId;
  category: ProjectCostItemCategory;
  label: string;
  quantity: DecimalString;
  unitCost: Money;
  totalCost: Money;
  source: ProjectCostItemSource;
  included: boolean;
  supplierQuoteRevisionId: SupplierQuoteRevisionId | null;
  supplierPositionId: SupplierQuotePositionId | null;
  manuallyOverridden: boolean;
  sourceValueSnapshot: JsonValue | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type PricingScenarioStatus = "draft" | "active" | "archived";

export type PricingScenario = {
  id: PricingScenarioId;
  calculatorId: ProjectCalculatorId;
  estimateId: EstimateId;
  name: string;
  status: PricingScenarioStatus;
  markupPercent: DecimalString | null;
  targetMarginPercent: DecimalString | null;
  netCost: Money;
  contingency: Money;
  grossProfit: Money;
  marginPercent: DecimalString;
  vatStatus: VatStatus;
  vatRatePercent: DecimalString;
  vatAmount: Money;
  sellingPriceExVat: Money;
  sellingPriceIncVat: Money;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

/** Immutable evidence of calculator inputs and outputs at a point in time. */
export type CalculatorSnapshot = Readonly<{
  id: CalculatorSnapshotId;
  calculatorId: ProjectCalculatorId;
  estimateId: EstimateId;
  scenarioId: PricingScenarioId;
  snapshotVersion: string;
  calculationInputs: JsonValue;
  calculationOutputs: JsonValue;
  createdAt: ISODateTime;
  createdBy: string;
}>;

export type CalculatorDuplicationPolicy = "do_not_copy" | "copy_current_values" | "copy_active_scenario" | "copy_all_scenarios_without_snapshots" | "copy_full_history";

/**
 * No duplication default is selected here. Existing estimate duplication also leaves nested
 * configuredContract identity IDs stale after estimate/position IDs change; that is a separate follow-up risk.
 */
export type EstimateCommercialDuplicationPolicy = {
  supplierQuotes: SupplierQuoteDuplicationPolicy;
  calculator: CalculatorDuplicationPolicy;
};
