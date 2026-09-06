import type { CalculatorScenario, InstallationMaterialsResult, SupplierFxSnapshot } from "./projectCalculatorLab.types";
import { resolveManufacturerVisualAssetUrl } from "../../manufacturerVisuals/manufacturerVisualAssetUrl";
import { normalizeSupplierCostsForProjectCosting } from "./supplierCostClassification";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function normalizeSupplierFxSnapshot(value: SupplierFxSnapshot): SupplierFxSnapshot {
  const liveMarketRate = value.liveMarketRate ?? value.supplierToGbpLiveRate;
  const protectiveAdjustedRate = value.protectiveAdjustedRate ?? value.supplierToGbpSellingRate;
  const costingRateBasis = value.costingRateBasis === "estimate_fixed" ? "estimate_fixed" : "legacy_live_market";
  return {
    ...value,
    liveMarketRate,
    protectiveAdjustedRate,
    costingRateBasis,
    estimateFixedRate: value.estimateFixedRate ?? (costingRateBasis === "estimate_fixed" ? protectiveAdjustedRate : liveMarketRate),
  };
}

const neutralPurchasingRow = () => ({
  requiredQuantity: null,
  packsRequired: null,
  purchaseQuantity: null,
  unusedAllowance: null,
  purchaseCost: null,
  status: "Review required",
});

function normalizeInstallationMaterials(value: unknown): InstallationMaterialsResult | null {
  if (!isRecord(value)) return null;
  const purchasing = isRecord(value.purchasing) ? value.purchasing : {};
  const totals = isRecord(value.totals) ? value.totals : {};
  const packers = isRecord(value.packers) ? value.packers : {};
  const normalizePurchasingRow = (row: unknown) => ({
    ...neutralPurchasingRow(),
    ...(isRecord(row) ? row : {}),
  });

  // Result collections are computed response structure, not persisted commercial
  // decisions. Older APIs and saved snapshots may not expose the newer arrays.
  return {
    ...value,
    status: value.status === "available" ? "available" : "review_required",
    fixingMethod: typeof value.fixingMethod === "string" ? value.fixingMethod : "",
    bracketLengthMm: typeof value.bracketLengthMm === "number" ? value.bracketLengthMm : null,
    buildingType: typeof value.buildingType === "string" ? value.buildingType : null,
    contingencyPercent: typeof value.contingencyPercent === "number" ? value.contingencyPercent : null,
    linearMaterialContingencyPercent: typeof value.linearMaterialContingencyPercent === "number" ? value.linearMaterialContingencyPercent : null,
    totalPerimeterM: typeof value.totalPerimeterM === "number" ? value.totalPerimeterM : null,
    perimeterStatus: value.perimeterStatus === "available" ? "available" : "review_required",
    frameScrewsPerBracket: typeof value.frameScrewsPerBracket === "number" ? value.frameScrewsPerBracket : null,
    purchaseCost: typeof value.purchaseCost === "string" ? value.purchaseCost : null,
    priceStatus: value.priceStatus === "priced" || value.priceStatus === "not_required" ? value.priceStatus : "review_required",
    reviewRequiredMaterials: Array.isArray(value.reviewRequiredMaterials) ? value.reviewRequiredMaterials : [],
    positionCalculations: Array.isArray(value.positionCalculations) ? value.positionCalculations : [],
    simpleMaterials: Array.isArray(value.simpleMaterials) ? value.simpleMaterials : [],
    sealing: isRecord(value.sealing) ? value.sealing as InstallationMaterialsResult["sealing"] : {},
    sealingPurchasing: isRecord(value.sealingPurchasing) ? value.sealingPurchasing as InstallationMaterialsResult["sealingPurchasing"] : {},
    purchasing: {
      ...purchasing,
      brackets: normalizePurchasingRow(purchasing.brackets),
      frameScrews: normalizePurchasingRow(purchasing.frameScrews),
      substrateFixings: normalizePurchasingRow(purchasing.substrateFixings),
    } as InstallationMaterialsResult["purchasing"],
    packers: {
      status: "review_required",
      reason: "Installation Materials calculation review required",
      calculatedQuantity: null,
      manualAdjustment: null,
      finalRequiredQuantity: null,
      allocatedQuantity: null,
      purchaseCost: null,
      ...packers,
      mix: Array.isArray(packers.mix) ? packers.mix : [],
    } as InstallationMaterialsResult["packers"],
    totals: {
      brackets: typeof totals.brackets === "number" ? totals.brackets : null,
      frameScrews: typeof totals.frameScrews === "number" ? totals.frameScrews : null,
      substrateFixings: typeof totals.substrateFixings === "number" ? totals.substrateFixings : null,
      fixingPositions: typeof totals.fixingPositions === "number" ? totals.fixingPositions : null,
      frames: typeof totals.frames === "number" ? totals.frames : null,
    },
  } as InstallationMaterialsResult;
}

export function normalizeCalculatorScenario(value: CalculatorScenario): CalculatorScenario {
  const valueWithHistory = value as CalculatorScenario & { exchangeRateHistory?: SupplierFxSnapshot[] };
  const rawImportCustoms: unknown = value.importCustoms;
  const importCustomsValue = isRecord(rawImportCustoms) && Array.isArray(rawImportCustoms.entries)
    ? rawImportCustoms.entries.find(isRecord) ?? null
    : rawImportCustoms;
  const exchangeRates = Array.isArray(value.exchangeRates) ? value.exchangeRates.map(normalizeSupplierFxSnapshot) : [];
  const normalized = {
    ...value,
    products: Array.isArray(value.products) ? value.products.map(normalizeProductVisual) : [],
    supplierCosts: normalizeSupplierCostsForProjectCosting(value.supplierCosts),
    supplierProductCommercialAdjustments: Array.isArray(value.supplierProductCommercialAdjustments) ? value.supplierProductCommercialAdjustments : [],
    supplierCommercialClassifications: Array.isArray(value.supplierCommercialClassifications) ? value.supplierCommercialClassifications : [],
    packageItems: Array.isArray(value.packageItems) ? value.packageItems : [],
    routeSnapshots: Array.isArray(value.routeSnapshots) ? value.routeSnapshots : [],
    exchangeRates,
    exchangeRateHistory: Array.isArray(valueWithHistory.exchangeRateHistory) ? valueWithHistory.exchangeRateHistory.map(normalizeSupplierFxSnapshot) : exchangeRates,
    revisions: Array.isArray(value.revisions) ? value.revisions : [],
    importCustoms: isRecord(importCustomsValue)
      ? { ...importCustomsValue, id: "global-import-customs" } as NonNullable<CalculatorScenario["importCustoms"]>
      : null,
    installationMaterials: normalizeInstallationMaterials(value.installationMaterials),
    supplierSummary: value.supplierSummary ? {
      ...value.supplierSummary,
      productSubtotalGbp: value.supplierSummary.productSubtotalGbp ?? null,
      deliveryTotalGbp: value.supplierSummary.deliveryTotalGbp ?? null,
      finalSupplierTotalGbp: value.supplierSummary.finalSupplierTotalGbp ?? null,
      quotations: Array.isArray(value.supplierSummary.quotations) ? value.supplierSummary.quotations : [],
    } : null,
  } as CalculatorScenario & { exchangeRateHistory: SupplierFxSnapshot[] };
  return normalized;
}
