import type { CalculatorProductRow, CalculatorScenario } from "./projectCalculatorLab.types";
import {
  addDecimalAmounts,
  applyMarkupPercentage,
  calculateProductSelling,
  percentageRatio,
  subtractDecimalAmounts,
  type ProjectCostingMarkups,
} from "./projectCostingMarkup";
import { normalizeSupplierCostsForProjectCosting } from "./supplierCostClassification";

export type ProjectCostingScenarioView = CalculatorScenario & {
  estimateId?: string | null;
  estimateRef?: string | null;
  targetGrossMarginPercent?: string;
  customerPricing?: {
    discount?: { mode: "percentage" | "fixed"; percentage: string; amount: string };
    fixedSellingPrice?: { enabled: boolean; amount: string; currency: "GBP"; basis: "ex_vat" };
    displayPolicy?: Record<string, unknown>;
  };
  unpricedSupplierTotals?: Array<{ originalAmount: string; originalCurrency: string; purchaseAmountGbp: string | null; sellingAmountGbp: string | null }>;
  supplierPackageUplifts?: Array<{ label: string; category: string | null; originalAmount: string; originalCurrency: string; purchaseAmountGbp: string | null; sellingAmountGbp: string | null }>;
  transportCosting?: {
    currency: string; supplierTransportIncluded: boolean; originalSupplierTransport: string; allocatedOriginalAmount: string;
    remainingOriginalTransport: string; allocatedPurchaseGbp: string; allocatedCommercialGbp: string; remainingSupplierPurchaseGbp: string;
    remainingSupplierCommercialGbp: string; storageCosts: string; allocatedStorageCosts: string; remainingStorageCosts: string;
    hiabDeliveryOffloadFee: string; allocatedHiabDeliveryOffloadFee: string; remainingHiabDeliveryOffloadFee: string;
    allocatedProductPurchaseGbp: string; allocatedProductCommercialGbp: string; transportPurchaseGbp: string; transportCommercialGbp: string;
  };
  transportAllocation?: Array<{ productRowId: string; displayReference: string; amount: string; currency: string; purchaseGbpAmount: string; commercialGbpAmount: string }>;
  me508Calculation?: { totalCost: string | null } | null;
  installationProgramme?: { costs: { purchaseCost: string }; [key: string]: unknown } | null;
};

export type CustomerPricingInput = {
  discount: { mode: "percentage" | "fixed"; percentage: string; amount: string };
  fixedSellingPrice: { enabled: boolean; amount: string; currency: "GBP"; basis: "ex_vat" };
};

const gbp = (rows: Array<{ gbpAmount: string | null }>) => addDecimalAmounts(rows.map((row) => row.gbpAmount));
const commercialGbp = (rows: Array<{ commercialGbpAmount: string | null }>) => addDecimalAmounts(rows.map((row) => row.commercialGbpAmount));

export function percentageAmount(amount: string | null, percentage: string) {
  if (!amount) return "0";
  const parse = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return { value: BigInt(whole + fraction), scale: fraction.length };
  };
  const base = parse(amount);
  const rate = parse(percentage || "0");
  const denominator = 100n * 10n ** BigInt(base.scale + rate.scale);
  const cents = (base.value * rate.value * 100n + denominator / 2n) / denominator;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function deriveProjectCostingCommercialResult(
  scenario: ProjectCostingScenarioView,
  overrides: {
    markups?: ProjectCostingMarkups;
    productMarkupOverrides?: Record<string, string>;
    customerPricing?: CustomerPricingInput;
  } = {},
) {
  const markups = overrides.markups ?? scenario.markups;
  const rowOverrides = overrides.productMarkupOverrides ?? Object.fromEntries(scenario.products.map((row) => [row.id, row.markupOverridePercent ?? ""]));
  const customerPricing: CustomerPricingInput = overrides.customerPricing ?? {
    discount: scenario.customerPricing?.discount ?? { mode: "percentage", percentage: "0", amount: "0" },
    fixedSellingPrice: scenario.customerPricing?.fixedSellingPrice ?? { enabled: false, amount: "0", currency: "GBP", basis: "ex_vat" },
  };
  const transportOptions = scenario.options?.transportCosting ?? {
    supplierTransportIncluded: true, storageCostsEnabled: false, storageCosts: "0", storageAllocateToProducts: false,
    storageAllocationAmount: "0", hiabDeliveryOffloadFeeEnabled: false, hiabDeliveryOffloadFee: "0", hiabAllocateToProducts: false,
    hiabAllocationAmount: "0", allocateToProducts: false, allocationAmount: "0", allocationMethod: "equal_per_position" as const,
  };
  const transportModel = scenario.transportCosting ?? {
    currency: scenario.currency, supplierTransportIncluded: true, originalSupplierTransport: "0", allocatedOriginalAmount: "0",
    remainingOriginalTransport: "0", allocatedPurchaseGbp: "0", allocatedCommercialGbp: "0", remainingSupplierPurchaseGbp: "0",
    remainingSupplierCommercialGbp: "0", storageCosts: "0", allocatedStorageCosts: "0", remainingStorageCosts: "0",
    hiabDeliveryOffloadFee: "0", allocatedHiabDeliveryOffloadFee: "0", remainingHiabDeliveryOffloadFee: "0",
    allocatedProductPurchaseGbp: "0", allocatedProductCommercialGbp: "0", transportPurchaseGbp: "0", transportCommercialGbp: "0",
  };
  const transportAllocation = scenario.transportAllocation ?? [];
  const transportAllocationByProduct = new Map(transportAllocation.map((item) => [item.productRowId, item]));
  const includedProducts = scenario.products.filter((row) => row.includedInCurrentEstimate !== false && row.classification !== "alternative");
  const alternativeProducts = scenario.products.filter((row) => row.classification === "alternative");
  // Keep the pure commercial boundary safe for fixtures, previews and legacy
  // responses that may not have passed through the API client normaliser.
  const costs = normalizeSupplierCostsForProjectCosting(scenario.supplierCosts);
  const includedCosts = costs.filter((row) => row.includedInCurrentEstimate !== false);
  const productSupplyCosts = costs.filter((row) => row.category === "product_supply");
  const includedProductSupplyCosts = productSupplyCosts.filter((row) => includedCosts.includes(row));
  const transport = costs.filter((row) => row.category === "delivery");
  const installation = costs.filter((row) => ["labour", "travel", "accommodation", "supplier_installation"].includes(row.category));
  const survey = costs.filter((row) => ["survey", "supplier_survey"].includes(row.category));
  const supplierInstallationEvidence = costs.filter((row) => row.category === "supplier_installation");
  const supplierSurveyEvidence = costs.filter((row) => row.category === "supplier_survey");
  const fees = costs.filter((row) => /import|dut(y|ies)/i.test(`${row.category} ${row.label}`));
  const extras = costs.filter((row) => !productSupplyCosts.includes(row) && !transport.includes(row) && !installation.includes(row) && !survey.includes(row) && !fees.includes(row) && row.category !== "supplier_information" && row.category !== "supplier_discount");
  const includedInstallation = installation.filter((row) => includedCosts.includes(row));
  const includedSurvey = survey.filter((row) => includedCosts.includes(row));
  const includedInternalInstallation = includedInstallation.filter((row) => row.category !== "supplier_installation");
  const includedInternalSurvey = includedSurvey.filter((row) => row.category !== "supplier_survey");
  const supplierInstallationCandidates = supplierInstallationEvidence.filter((row) => row.includedInCurrentEstimate === true);
  const supplierInstallationSelectionConflict = supplierInstallationCandidates.length > 1;
  const selectedSupplierInstallation = supplierInstallationSelectionConflict ? [] : supplierInstallationCandidates;
  const selectedSupplierSurvey = supplierSurveyEvidence.filter((row) => row.includedInCurrentEstimate === true);
  const includedFees = fees.filter((row) => includedCosts.includes(row));
  const includedExtras = extras.filter((row) => includedCosts.includes(row));
  const selected = scenario.packageItems.filter((row) => row.included);
  const equipment = selected.filter((row) => /crane|lifter|robot|telehandler|skip/i.test(row.label));
  const materials = selected.filter((row) => /bracket|fixing|ME508|TP600|TP601|foam|membrane|tape|material/i.test(row.label));
  const unpricedTotals = scenario.unpricedSupplierTotals ?? [];
  const quotedProductAdjustments = scenario.supplierProductCommercialAdjustments ?? [];
  const applicableProductAdjustments = quotedProductAdjustments.filter((adjustment) => {
    if (adjustment.status !== "applied" || adjustment.netProductPurchaseGbp == null || adjustment.netProductCommercialGbp == null || adjustment.grossPositionAmount == null) return false;
    const sourceRows = includedProducts.filter((row) => row.sourceRevisionId === adjustment.sourceRevisionId);
    const sourceProductSupplyCosts = includedProductSupplyCosts.filter((row) => row.sourceRevisionId === adjustment.sourceRevisionId);
    return sourceRows.length > 0 && addDecimalAmounts([...sourceRows.map((row) => row.originalAmount), ...sourceProductSupplyCosts.map((row) => row.originalAmount)]) === addDecimalAmounts([adjustment.grossListAmount]);
  });
  const adjustedProductRevisionIds = new Set(applicableProductAdjustments.map((adjustment) => adjustment.sourceRevisionId));
  const productAdjustmentWarnings = quotedProductAdjustments.flatMap((adjustment) => {
    if (adjustment.status === "review_required") return adjustment.reasons;
    if (adjustment.status === "available_not_applied") return [];
    if (!applicableProductAdjustments.includes(adjustment)) return [`Quotation ${adjustment.quotationReference} product adjustment was not applied because its current Products / Supply rows no longer reconcile with the source list amount.`];
    if (includedProducts.some((row) => row.sourceRevisionId === adjustment.sourceRevisionId && (rowOverrides[row.id] ?? "") !== "")) return [`Quotation ${adjustment.quotationReference} has row-specific product markups; the source discount remains aggregate and is not allocated to positions.`];
    return [];
  });
  const packageUplifts = scenario.supplierPackageUplifts ?? [];
  const uplifts = (...categories: string[]) => packageUplifts.filter((item) => item.category != null && categories.includes(item.category));
  const installationPackageUplifts = uplifts("installation", "installation_support");
  const extraPackageUplifts = uplifts("extras", "other");
  const transportPackageUplifts = uplifts("transport");
  const equipmentPackageUplifts = uplifts("equipment");
  const materialsPackageUplifts = uplifts("materials");
  const dutyPackageUplifts = uplifts("duties");
  const grossBaseProductGbp = addDecimalAmounts([gbp(includedProducts), gbp(includedProductSupplyCosts), ...unpricedTotals.map((item) => item.purchaseAmountGbp)]);
  const supplierProductDiscountGbp = addDecimalAmounts(applicableProductAdjustments.map((item) => item.purchaseDiscountGbp));
  const baseProductGbp = subtractDecimalAmounts(grossBaseProductGbp, supplierProductDiscountGbp);
  const extrasGbp = addDecimalAmounts([gbp(includedExtras), ...extraPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const transportAllocated = transportModel.allocatedOriginalAmount;
  const transportGbp = addDecimalAmounts([transportModel.transportPurchaseGbp, ...transportPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const productGbp = addDecimalAmounts([baseProductGbp, transportModel.allocatedPurchaseGbp]);
  const calculatedInstallationCost = scenario.options?.installationRequired && scenario.options?.installationProfile && (scenario.options.installationProfile as Record<string, unknown>).enabled !== false ? scenario.installationProgramme?.costs.purchaseCost : null;
  const calculatedSurveyCost = calculatedInstallationCost ? scenario.installationProgramme?.costs.survey ?? "0" : "0";
  const calculatedInstallationWithoutSurvey = calculatedInstallationCost ? subtractDecimalAmounts(calculatedInstallationCost, calculatedSurveyCost) : "0";
  const internalInstallationGbp = addDecimalAmounts([gbp(includedInternalInstallation), ...installationPackageUplifts.map((item) => item.purchaseAmountGbp), calculatedInstallationWithoutSurvey]);
  const installationGbp = selectedSupplierInstallation.length ? gbp(selectedSupplierInstallation) : internalInstallationGbp;
  const internalSurveyGbp = addDecimalAmounts([gbp(includedInternalSurvey), calculatedSurveyCost]);
  const surveyGbp = selectedSupplierSurvey.length ? gbp(selectedSupplierSurvey) : internalSurveyGbp;
  const feeGbp = addDecimalAmounts([gbp(includedFees), ...dutyPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const extrasCommercialGbp = addDecimalAmounts([commercialGbp(includedExtras), ...extraPackageUplifts.map((item) => item.sellingAmountGbp)]);
  const transportCommercialGbp = addDecimalAmounts([transportModel.transportCommercialGbp, ...transportPackageUplifts.map((item) => item.sellingAmountGbp)]);
  const internalInstallationCommercialGbp = addDecimalAmounts([commercialGbp(includedInternalInstallation), ...installationPackageUplifts.map((item) => item.sellingAmountGbp), calculatedInstallationWithoutSurvey]);
  const installationCommercialGbp = selectedSupplierInstallation.length ? commercialGbp(selectedSupplierInstallation) : internalInstallationCommercialGbp;
  const internalSurveyCommercialGbp = addDecimalAmounts([commercialGbp(includedInternalSurvey), calculatedSurveyCost]);
  const surveyCommercialGbp = selectedSupplierSurvey.length ? commercialGbp(selectedSupplierSurvey) : internalSurveyCommercialGbp;
  const feeCommercialGbp = addDecimalAmounts([commercialGbp(includedFees), ...dutyPackageUplifts.map((item) => item.sellingAmountGbp)]);
  const equipmentCost = addDecimalAmounts([...equipment.map((row) => row.unitCost), ...equipmentPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const automaticMaterialsEnabled = (scenario.options?.installationMaterials as { enabled?: unknown } | undefined)?.enabled !== false;
  const materialsCost = addDecimalAmounts([...materials.map((row) => row.unitCost), ...materialsPackageUplifts.map((item) => item.purchaseAmountGbp), scenario.me508Calculation?.totalCost, automaticMaterialsEnabled ? scenario.installationMaterials?.purchaseCost : null]);
  const selling = (amount: string, category: keyof ProjectCostingMarkups) => applyMarkupPercentage(amount, markups[category])?.sellingPrice ?? "0";
  const priceProduct = (row: CalculatorProductRow, includeAllocatedTransport: boolean) => {
    const amount = addDecimalAmounts([row.commercialGbpAmount, includeAllocatedTransport ? transportAllocationByProduct.get(row.id)?.commercialGbpAmount : null]);
    const price = Number(amount) ? calculateProductSelling(amount, row.quantity, markups.product, (rowOverrides[row.id] ?? "") === "" ? null : rowOverrides[row.id]) : null;
    return { row, commercialAmountGbp: amount, unitSellingPrice: price?.unitSellingPrice ?? null, totalSellingPrice: price?.totalSellingPrice ?? null };
  };
  const productPricing = includedProducts.map((row) => priceProduct(row, true));
  const alternativeProductPricing = alternativeProducts.map((row) => priceProduct(row, false));
  const unadjustedProductSale = addDecimalAmounts(productPricing.filter(({ row }) => !adjustedProductRevisionIds.has(row.sourceRevisionId ?? "")).map((value) => value.totalSellingPrice));
  const unadjustedProductSupplySale = selling(commercialGbp(includedProductSupplyCosts.filter((row) => !adjustedProductRevisionIds.has(row.sourceRevisionId ?? ""))), "product");
  const adjustedProductSale = addDecimalAmounts(applicableProductAdjustments.map((item) => selling(item.netProductCommercialGbp!, "product")));
  const baseProductSale = addDecimalAmounts([unadjustedProductSale, unadjustedProductSupplySale, adjustedProductSale, unpricedTotals.length ? selling(addDecimalAmounts(unpricedTotals.map((item) => item.sellingAmountGbp)), "product") : null]);
  const extrasSale = selling(extrasCommercialGbp, "extras");
  const transportSale = selling(transportCommercialGbp, "transport");
  const supplierTransportSale = selling(transportModel.remainingSupplierPurchaseGbp, "transport");
  const storageTransportSale = selling(transportModel.remainingStorageCosts, "transport");
  const hiabTransportSale = selling(transportModel.remainingHiabDeliveryOffloadFee, "transport");
  const equipmentSale = selling(equipmentCost, "equipment");
  const installationSale = selling(installationCommercialGbp, "installation");
  const surveySale = selling(surveyCommercialGbp, "siteVisit");
  const materialsSale = selling(materialsCost, "materials");
  const feeSale = selling(feeCommercialGbp, "duties");
  const siteVisitCost = scenario.siteVisitTravel?.total ?? "0";
  const siteVisitAllocatedToProducts = scenario.siteVisitTravel?.input.allocation === "products";
  const siteVisitSale = applyMarkupPercentage(siteVisitCost, siteVisitAllocatedToProducts ? markups.product : markups.siteVisit)?.sellingPrice ?? siteVisitCost;
  const productSale = addDecimalAmounts([baseProductSale, siteVisitAllocatedToProducts ? siteVisitSale : null]);
  const customerDiscountAmount = customerPricing.discount.mode === "fixed" ? customerPricing.discount.amount : percentageAmount(productSale, customerPricing.discount.percentage);
  const customerDiscountPercentage = customerPricing.discount.mode === "fixed" && Number(productSale) ? percentageRatio(customerDiscountAmount, productSale) : customerPricing.discount.percentage;
  const discountedProductSale = subtractDecimalAmounts(productSale, customerDiscountAmount);
  const projectCost = addDecimalAmounts([productGbp, extrasGbp, transportGbp, equipmentCost, installationGbp, surveyGbp, materialsCost, feeGbp, siteVisitCost]);
  const calculatedSale = addDecimalAmounts([discountedProductSale, extrasSale, transportSale, equipmentSale, installationSale, surveySale, materialsSale, feeSale, siteVisitAllocatedToProducts ? null : siteVisitSale]);
  const actualSale = customerPricing.fixedSellingPrice.enabled ? customerPricing.fixedSellingPrice.amount : calculatedSale;
  const commercialAdjustment = subtractDecimalAmounts(actualSale, calculatedSale);
  const profit = subtractDecimalAmounts(actualSale, projectCost);

  return {
    markups, customerPricing, transportOptions, transportModel, transportAllocation, transportAllocationByProduct,
    includedProducts, alternativeProducts, costs, includedCosts, productSupplyCosts, includedProductSupplyCosts, transport, installation, survey, supplierInstallationEvidence, supplierSurveyEvidence, fees, extras,
    includedInstallation, includedSurvey, includedInternalInstallation, includedInternalSurvey, supplierInstallationCandidates, supplierInstallationSelectionConflict, selectedSupplierInstallation, selectedSupplierSurvey, includedFees, includedExtras, equipment, materials, unpricedTotals, packageUplifts,
    installationPackageUplifts, extraPackageUplifts, transportPackageUplifts, equipmentPackageUplifts, materialsPackageUplifts,
    dutyPackageUplifts, quotedProductAdjustments, applicableProductAdjustments, adjustedProductRevisionIds, productAdjustmentWarnings,
    grossBaseProductGbp, supplierProductDiscountGbp, baseProductGbp, extrasGbp, transportAllocated, transportGbp, productGbp, internalInstallationGbp, installationGbp, internalSurveyGbp, surveyGbp, feeGbp,
    extrasCommercialGbp, transportCommercialGbp, internalInstallationCommercialGbp, installationCommercialGbp, internalSurveyCommercialGbp, surveyCommercialGbp, feeCommercialGbp, equipmentCost, materialsCost,
    productPricing, alternativeProductPricing, unadjustedProductSale, unadjustedProductSupplySale, adjustedProductSale, baseProductSale, extrasSale, transportSale, supplierTransportSale, storageTransportSale, hiabTransportSale,
    equipmentSale, installationSale, surveySale, materialsSale, feeSale, siteVisitCost, siteVisitAllocatedToProducts, siteVisitSale,
    productSale, customerDiscountAmount, customerDiscountPercentage, discountedProductSale, projectCost, calculatedSale,
    actualSale, commercialAdjustment, profit,
  };
}

export function customerProductDescription(row: CalculatorProductRow) {
  const source = row.sourceSnapshot ?? {};
  const configured = source.configuredContract as { layout?: { columns?: number; rows?: number }; product?: { systemCode?: string; productFamily?: string } } | undefined;
  if (configured) return `${configured.product?.productFamily ?? configured.product?.systemCode ?? "B92"} configured ${configured.layout?.columns ?? 1} × ${configured.layout?.rows ?? 1} element`;
  if (row.productClass && row.productClass !== "Needs review") return row.productClass;
  return "Imported window / door position";
}
