import assert from "node:assert/strict";
import test from "node:test";
import { deriveProjectCostingCommercialResult } from "../src/features/projectCalculatorLab/domain/projectCostingCommercialResult";
import { PROJECT_COMMERCIAL_COST_CATEGORIES } from "../src/features/projectCalculatorLab/domain/projectCommercialActuals";

const scenario = (included = true, imports = 1, duty = "0.00") => ({
  id: "import-customs",
  currency: "GBP",
  products: [], supplierCosts: [], packageItems: [], unpricedSupplierTotals: [], supplierPackageUplifts: [],
  importCustoms: { id: "global-import-customs", includedByDefault: true, included, baseImportCost: "237.17", contingencyPercent: "20", defaultImports: imports, dutyPercent: Number(duty) ? "5" : "0", dutyBasisAmount: Number(duty) ? "1000" : "0", markupPercent: "20", importVatTreatment: "excluded", allowanceType: "internal_commercial_allowance", status: "configured", provenance: null, ruleVersion: "global-import-customs-allowance-v1", contingencyAmount: "47.43", budgetedImportCostPerImport: "284.60", importAllowanceCost: imports === 1 ? "284.60" : "569.20", dutyCost: duty, purchaseCost: included ? imports === 1 ? String((284.6 + Number(duty)).toFixed(2)) : "569.20" : "0.00", sellingPrice: "0.00", reviewRequired: [] },
  markups: { product: "0", extras: "40", transport: "0", siteVisit: "0", equipment: "0", installation: "0", materials: "0", duties: "20" },
  options: null,
  customerPricing: { discount: { mode: "percentage", percentage: "0", amount: "0" }, fixedSellingPrice: { enabled: false, amount: "0", currency: "GBP", basis: "ex_vat" } },
}) as any;

test("Import / Customs contributes once to project cost, profit and its own markup", () => {
  const result = deriveProjectCostingCommercialResult(scenario());
  assert.equal(result.importCustomsGbp, "284.60");
  assert.equal(result.projectCost, "284.60");
  assert.equal(result.feeSale, "341.52");
  assert.equal(result.extrasGbp, "0.00");
});

test("Include No is neutral and non-zero duty remains within Import / Customs", () => {
  assert.equal(deriveProjectCostingCommercialResult(scenario(false)).projectCost, "0.00");
  const duty = deriveProjectCostingCommercialResult(scenario(true, 1, "50.00"));
  assert.equal(duty.importCustomsGbp, "334.60");
  assert.equal(duty.projectCost, "334.60");
  assert.equal(duty.feeSale, "401.52");
});

test("a global allowance suppresses legacy imported fee contribution instead of double counting", () => {
  const withLegacy = scenario();
  withLegacy.supplierCosts = [{ id: "legacy", category: "other", label: "Import fee", includedInCurrentEstimate: true, gbpAmount: "99.00", commercialGbpAmount: "99.00", markedUpAmount: "99.00" }];
  const result = deriveProjectCostingCommercialResult(withLegacy);
  assert.equal(result.importCustomsGbp, "284.60");
  assert.equal(result.projectCost, "284.60");
});

test("future Actual Costs align to the sold budget without collapsing Service / Remedial", () => {
  assert.deepEqual(PROJECT_COMMERCIAL_COST_CATEGORIES, ["products_supply", "extras", "transport", "import_customs", "survey_site_visit", "installation_materials", "installation", "service_remedial", "other"]);
});
