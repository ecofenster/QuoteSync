import assert from "node:assert/strict";
import test from "node:test";
import { deriveProjectCostingCommercialResult, type ProjectCostingScenarioView } from "../src/features/projectCalculatorLab/domain/projectCostingCommercialResult";

const priced = (id: string, amount: string, category: string, included = true) => ({
  id, scenarioId: "scenario", sourceAdditionalCostId: id, sourceRevisionId: "eco-revision", sourceSnapshot: null, evidenceOrigin: "supplier_import" as const, costKind: "supplier" as const,
  category, label: id, amount, currency: "GBP", originalAmount: amount, originalCurrency: "GBP", fxSnapshot: null, pricingPolicy: null,
  gbpAmount: amount, commercialGbpAmount: amount, markupPercent: category === "product_supply" ? "40" : category === "delivery" ? "10" : "40", markupValue: "0", markedUpAmount: amount, includedInCurrentEstimate: included,
});

const adjustment = (status: "available_not_applied" | "applied" = "available_not_applied") => ({ supplierName: "EcoHaus", supplierQuoteId: "eco-quote", sourceRevisionId: "eco-revision", quotationReference: "20260057", currency: "GBP", status, reasons: [], grossPositionAmount: "84367.41", embeddedAccessoryGrossAmount: "37.14", grossListAmount: "84404.55", discountPercentage: "20", discountAmount: "16880.91", netProductSubtotal: "67523.64", grossListPurchaseGbp: "84404.55", grossListCommercialGbp: "84404.55", netProductPurchaseGbp: "67523.64", netProductCommercialGbp: "67523.64", purchaseDiscountGbp: "16880.91", commercialDiscountGbp: "16880.91", allocationToPositions: "none" as const });

const scenario = (status: "available_not_applied" | "applied" = "available_not_applied"): ProjectCostingScenarioView => ({
  id: "scenario", name: "Products / Supply", currency: "GBP", packageCode: "supply_only", origin: "supplier_import", importLabSessionId: null, extractionRunId: null, sourceAttachmentId: null, sourceRevision: null, revisionNumber: 1, installationOpeningCount: 0, createdAt: "", updatedAt: "",
  products: [{ id: "eco-products", scenarioId: "scenario", estimatePositionId: "position", sourceRowId: "source", sourceRevisionId: "eco-revision", sourceSnapshot: null, evidenceOrigin: "supplier_import", displayReference: "EcoHaus positions", productClass: "Window", quantity: 1, widthMm: 1000, heightMm: 1000, installationOpeningCount: null, unitSupplyCost: "84367.41", totalPrice: "84367.41", currency: "GBP", areaSquareMetres: "1", framePerimeterMetres: "4", classification: "standard", includedInCurrentEstimate: true, markupOverridePercent: null, originalAmount: "84367.41", originalCurrency: "GBP", fxSnapshot: null, pricingPolicy: null, gbpAmount: "84367.41", commercialGbpAmount: "84367.41", markupPercent: "40", markupValue: "33746.96", markedUpAmount: "118114.37" }],
  supplierCosts: [priced("N couplers", "37.14", "product_supply"), priced("Installation by ecoHaus", "10939.15", "supplier_installation", false), priced("Survey", "967.71", "supplier_survey", false), priced("External aluminium cills", "2245.47", "extras"), priced("Delivery", "3145.71", "delivery")],
  supplierProductCommercialAdjustments: [adjustment(status)],
  packageItems: [], routeSnapshots: [], supplierSummary: null, exchangeRate: null, exchangeRates: [], markups: { product: "40", extras: "40", transport: "10", siteVisit: "40", equipment: "0", installation: "0", materials: "0", duties: "0" }, revisions: [], catalogueSnapshot: null,
  options: { projectType: "refurbishment", crewSize: 2, useIllbruck: false, bracketsRequired: false, stayAway: false, customerTransport: null, allocateTransportDifference: false, transportAllocationMethod: "equal_per_position", transportCosting: { supplierTransportIncluded: true, storageCostsEnabled: false, storageCosts: "0", storageAllocateToProducts: false, storageAllocationAmount: "0", hiabDeliveryOffloadFeeEnabled: false, hiabDeliveryOffloadFee: "0", hiabAllocateToProducts: false, hiabAllocationAmount: "0", allocateToProducts: false, allocationAmount: "0", allocationMethod: "equal_per_position" } },
  transportCosting: { currency: "GBP", supplierTransportIncluded: true, originalSupplierTransport: "3145.71", allocatedOriginalAmount: "0.00", remainingOriginalTransport: "3145.71", allocatedPurchaseGbp: "0.00", allocatedCommercialGbp: "0.00", remainingSupplierPurchaseGbp: "3145.71", remainingSupplierCommercialGbp: "3145.71", storageCosts: "0.00", allocatedStorageCosts: "0.00", remainingStorageCosts: "0.00", hiabDeliveryOffloadFee: "0.00", allocatedHiabDeliveryOffloadFee: "0.00", remainingHiabDeliveryOffloadFee: "0.00", allocatedProductPurchaseGbp: "0.00", allocatedProductCommercialGbp: "0.00", transportPurchaseGbp: "3145.71", transportCommercialGbp: "3145.71" },
  siteVisitTravel: { input: { allocation: "products" } as never, total: "35.00" } as never,
});

test("default EcoHaus import retains list Products, additive Extras/Transport and does not apply optional evidence", () => {
  const input = scenario();
  const result = deriveProjectCostingCommercialResult(input);
  assert.equal(input.products[0].totalPrice, "84367.41");
  assert.equal(result.grossBaseProductGbp, "84404.55");
  assert.equal(result.supplierProductDiscountGbp, "0.00");
  assert.equal(result.productGbp, "84404.55");
  assert.equal(result.extrasGbp, "2245.47");
  assert.equal(result.transportGbp, "3145.71");
  assert.equal(result.installationGbp, "0.00");
  assert.equal(result.projectCost, "89830.73");
  assert.equal(result.productSale, "118215.37");
  assert.equal(result.calculatedSale, "124819.31");
  assert.equal(result.applicableProductAdjustments.length, 0);
  assert.equal(result.productAdjustmentWarnings.length, 0);
});

test("explicit supplier discount action changes only the aggregate Products basis and remains reversible", () => {
  const applied = deriveProjectCostingCommercialResult(scenario("applied"));
  const removed = deriveProjectCostingCommercialResult(scenario("available_not_applied"));
  assert.equal(applied.supplierProductDiscountGbp, "16880.91");
  assert.equal(applied.baseProductGbp, "67523.64");
  assert.equal(applied.productSale, "94582.10");
  assert.equal(applied.projectCost, "72949.82");
  assert.equal(applied.calculatedSale, "101186.04");
  assert.equal(applied.profit, "28236.22");
  assert.equal(applied.includedProducts[0].originalAmount, "84367.41");
  assert.equal(applied.includedProductSupplyCosts[0].originalAmount, "37.14");
  assert.equal(removed.productGbp, "84404.55");
});

test("supplier installation and survey evidence do not overwrite an Estimate-owned installation programme", () => {
  const input = scenario();
  input.options = { ...input.options!, installationRequired: true, installationProfile: { enabled: true } };
  input.installationProgramme = { costs: { purchaseCost: "1000.00" } } as never;
  const result = deriveProjectCostingCommercialResult(input);
  assert.equal(result.supplierInstallationEvidence[0].includedInCurrentEstimate, false);
  assert.equal(result.supplierSurveyEvidence[0].includedInCurrentEstimate, false);
  assert.equal(result.installationGbp, "1000.00");
});

test("an applied discount with drifted Products evidence fails closed", () => {
  const input = scenario("applied");
  input.products[0].originalAmount = "84367.40";
  const result = deriveProjectCostingCommercialResult(input);
  assert.equal(result.applicableProductAdjustments.length, 0);
  assert.equal(result.baseProductGbp, "84404.55");
  assert.match(result.productAdjustmentWarnings[0], /no longer reconcile/);
});
