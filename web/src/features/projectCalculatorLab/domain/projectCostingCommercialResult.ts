import type { CalculatorProductRow, CalculatorScenario } from "./projectCalculatorLab.types";
import {
  addDecimalAmounts,
  applyMarkupPercentage,
  calculateProductSelling,
  percentageRatio,
  subtractDecimalAmounts,
  type ProjectCostingMarkups,
} from "./projectCostingMarkup";

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
  const costs = scenario.supplierCosts;
  const includedCosts = costs.filter((row) => row.includedInCurrentEstimate !== false);
  const transport = costs.filter((row) => row.category === "delivery");
  const installation = costs.filter((row) => ["labour", "travel", "accommodation", "survey"].includes(row.category));
  const fees = costs.filter((row) => /import|dut(y|ies)/i.test(`${row.category} ${row.label}`));
  const extras = costs.filter((row) => !transport.includes(row) && !installation.includes(row) && !fees.includes(row));
  const includedInstallation = installation.filter((row) => includedCosts.includes(row));
  const includedFees = fees.filter((row) => includedCosts.includes(row));
  const includedExtras = extras.filter((row) => includedCosts.includes(row));
  const selected = scenario.packageItems.filter((row) => row.included);
  const equipment = selected.filter((row) => /crane|lifter|robot|telehandler|skip/i.test(row.label));
  const materials = selected.filter((row) => /bracket|fixing|ME508|TP600|TP601|foam|membrane|tape|material/i.test(row.label));
  const unpricedTotals = scenario.unpricedSupplierTotals ?? [];
  const packageUplifts = scenario.supplierPackageUplifts ?? [];
  const uplifts = (...categories: string[]) => packageUplifts.filter((item) => item.category != null && categories.includes(item.category));
  const installationPackageUplifts = uplifts("installation", "installation_support");
  const extraPackageUplifts = uplifts("extras", "other");
  const transportPackageUplifts = uplifts("transport");
  const equipmentPackageUplifts = uplifts("equipment");
  const materialsPackageUplifts = uplifts("materials");
  const dutyPackageUplifts = uplifts("duties");
  const baseProductGbp = addDecimalAmounts([gbp(includedProducts), ...unpricedTotals.map((item) => item.purchaseAmountGbp)]);
  const extrasGbp = addDecimalAmounts([gbp(includedExtras), ...extraPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const transportAllocated = transportModel.allocatedOriginalAmount;
  const transportGbp = addDecimalAmounts([transportModel.transportPurchaseGbp, ...transportPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const productGbp = addDecimalAmounts([baseProductGbp, transportModel.allocatedPurchaseGbp]);
  const calculatedInstallationCost = scenario.options?.installationRequired && scenario.options?.installationProfile && (scenario.options.installationProfile as Record<string, unknown>).enabled !== false ? scenario.installationProgramme?.costs.purchaseCost : null;
  const installationGbp = addDecimalAmounts([gbp(includedInstallation), ...installationPackageUplifts.map((item) => item.purchaseAmountGbp), calculatedInstallationCost]);
  const feeGbp = addDecimalAmounts([gbp(includedFees), ...dutyPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const extrasCommercialGbp = addDecimalAmounts([commercialGbp(includedExtras), ...extraPackageUplifts.map((item) => item.sellingAmountGbp)]);
  const transportCommercialGbp = addDecimalAmounts([transportModel.transportCommercialGbp, ...transportPackageUplifts.map((item) => item.sellingAmountGbp)]);
  const installationCommercialGbp = addDecimalAmounts([commercialGbp(includedInstallation), ...installationPackageUplifts.map((item) => item.sellingAmountGbp), calculatedInstallationCost]);
  const feeCommercialGbp = addDecimalAmounts([commercialGbp(includedFees), ...dutyPackageUplifts.map((item) => item.sellingAmountGbp)]);
  const equipmentCost = addDecimalAmounts([...equipment.map((row) => row.unitCost), ...equipmentPackageUplifts.map((item) => item.purchaseAmountGbp)]);
  const materialsCost = addDecimalAmounts([...materials.map((row) => row.unitCost), ...materialsPackageUplifts.map((item) => item.purchaseAmountGbp), scenario.me508Calculation?.totalCost, scenario.installationMaterials?.purchaseCost]);
  const selling = (amount: string, category: keyof ProjectCostingMarkups) => applyMarkupPercentage(amount, markups[category])?.sellingPrice ?? "0";
  const productPricing = includedProducts.map((row) => {
    const amount = addDecimalAmounts([row.commercialGbpAmount, transportAllocationByProduct.get(row.id)?.commercialGbpAmount]);
    const price = Number(amount) ? calculateProductSelling(amount, row.quantity, markups.product, (rowOverrides[row.id] ?? "") === "" ? null : rowOverrides[row.id]) : null;
    return { row, commercialAmountGbp: amount, unitSellingPrice: price?.unitSellingPrice ?? null, totalSellingPrice: price?.totalSellingPrice ?? null };
  });
  const baseProductSale = addDecimalAmounts([...productPricing.map((value) => value.totalSellingPrice), unpricedTotals.length ? selling(addDecimalAmounts(unpricedTotals.map((item) => item.sellingAmountGbp)), "product") : null]);
  const extrasSale = selling(extrasCommercialGbp, "extras");
  const transportSale = selling(transportCommercialGbp, "transport");
  const supplierTransportSale = selling(transportModel.remainingSupplierPurchaseGbp, "transport");
  const storageTransportSale = selling(transportModel.remainingStorageCosts, "transport");
  const hiabTransportSale = selling(transportModel.remainingHiabDeliveryOffloadFee, "transport");
  const equipmentSale = selling(equipmentCost, "equipment");
  const installationSale = selling(installationCommercialGbp, "installation");
  const materialsSale = selling(materialsCost, "materials");
  const feeSale = selling(feeCommercialGbp, "duties");
  const siteVisitCost = scenario.siteVisitTravel?.total ?? "0";
  const siteVisitAllocatedToProducts = scenario.siteVisitTravel?.input.allocation === "products";
  const siteVisitSale = applyMarkupPercentage(siteVisitCost, siteVisitAllocatedToProducts ? markups.product : markups.siteVisit)?.sellingPrice ?? siteVisitCost;
  const productSale = addDecimalAmounts([baseProductSale, siteVisitAllocatedToProducts ? siteVisitSale : null]);
  const customerDiscountAmount = customerPricing.discount.mode === "fixed" ? customerPricing.discount.amount : percentageAmount(productSale, customerPricing.discount.percentage);
  const customerDiscountPercentage = customerPricing.discount.mode === "fixed" && Number(productSale) ? percentageRatio(customerDiscountAmount, productSale) : customerPricing.discount.percentage;
  const discountedProductSale = subtractDecimalAmounts(productSale, customerDiscountAmount);
  const projectCost = addDecimalAmounts([productGbp, extrasGbp, transportGbp, equipmentCost, installationGbp, materialsCost, feeGbp, siteVisitCost]);
  const calculatedSale = addDecimalAmounts([discountedProductSale, extrasSale, transportSale, equipmentSale, installationSale, materialsSale, feeSale, siteVisitAllocatedToProducts ? null : siteVisitSale]);
  const actualSale = customerPricing.fixedSellingPrice.enabled ? customerPricing.fixedSellingPrice.amount : calculatedSale;
  const commercialAdjustment = subtractDecimalAmounts(actualSale, calculatedSale);
  const profit = subtractDecimalAmounts(actualSale, projectCost);

  return {
    markups, customerPricing, transportOptions, transportModel, transportAllocation, transportAllocationByProduct,
    includedProducts, alternativeProducts, costs, includedCosts, transport, installation, fees, extras,
    includedInstallation, includedFees, includedExtras, equipment, materials, unpricedTotals, packageUplifts,
    installationPackageUplifts, extraPackageUplifts, transportPackageUplifts, equipmentPackageUplifts, materialsPackageUplifts,
    dutyPackageUplifts, baseProductGbp, extrasGbp, transportAllocated, transportGbp, productGbp, installationGbp, feeGbp,
    extrasCommercialGbp, transportCommercialGbp, installationCommercialGbp, feeCommercialGbp, equipmentCost, materialsCost,
    productPricing, baseProductSale, extrasSale, transportSale, supplierTransportSale, storageTransportSale, hiabTransportSale,
    equipmentSale, installationSale, materialsSale, feeSale, siteVisitCost, siteVisitAllocatedToProducts, siteVisitSale,
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
