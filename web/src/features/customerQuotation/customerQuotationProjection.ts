import type { Client, Estimate, Position } from "../../models/types";
import { getConfiguredPositionContract } from "../configurator/configuredPositionContract.utils";
import { configuratorDocumentDrawingRegistry } from "../configurator/documentDrawing";
import { deriveProjectCostingCommercialResult, customerProductDescription, percentageAmount, type ProjectCostingScenarioView } from "../projectCalculatorLab/domain/projectCostingCommercialResult";
import { addDecimalAmounts } from "../projectCalculatorLab/domain/projectCostingMarkup";
import { resolveVatTreatment } from "../projectCalculatorLab/domain/vatTreatment";
import { CUSTOMER_QUOTATION_POLICY } from "./quotationPolicy";
import { DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS, type CustomerQuotationDisplayOptions, type CustomerQuotationPositionThermal } from "./customerQuotationDisplay";
import { ECOFENSTER_DEVELOPMENT_DOCUMENT_BRAND, type CustomerDocumentBrand } from "./documentBrand";

export type CustomerQuotationDrawing =
  | { source: "configurator"; available: true; insideAvailable: boolean; outsideAvailable: boolean }
  | { source: "manufacturer"; available: true; imageUrl: string; mediaType: string | null; orientation: "inside" | "outside" | "unknown" }
  | { source: "unavailable"; available: false; reason: string };

export type CustomerQuotationPosition = {
  sequence: number;
  id: string;
  manufacturerItemNumber: string | null;
  customerReference: string;
  reference: string;
  roomName: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  description: string;
  productSystem: string;
  configurationDescription: string;
  specification: Array<{ label: string; value: string }>;
  drawing: CustomerQuotationDrawing;
  unitSellingPriceGbp: string | null;
  totalSellingPriceGbp: string | null;
  estimatePosition: Position | null;
  hasConfiguredDrawing: boolean;
  thermal: CustomerQuotationPositionThermal | null;
  sectionDetailIds: string[];
};

export type CustomerQuotationCharge = { id: string; label: string; amountGbp: string };
export type CustomerQuotationSupplySummary = { reference: string; description: string; quantity: number; dimensions: string; amountGbp: string | null };

export type CustomerQuotationProjection = {
  brand: CustomerDocumentBrand;
  displayOptions: CustomerQuotationDisplayOptions;
  estimateReference: string;
  commercialRevision: number;
  previewDate: string;
  clientName: string;
  projectName: string;
  projectAddress: string;
  currency: "GBP";
  positions: CustomerQuotationPosition[];
  productsSupplyTotalGbp: string;
  productSupplySummary: CustomerQuotationSupplySummary[];
  installationInclusions: string[];
  alternatives: Array<Pick<CustomerQuotationPosition, "id" | "reference" | "quantity" | "widthMm" | "heightMm" | "description">>;
  charges: CustomerQuotationCharge[];
  customerDiscountGbp: string;
  showCustomerDiscount: boolean;
  fixedPriceAdjustmentGbp: string;
  fixedSellingPriceEnabled: boolean;
  subtotalExVatGbp: string;
  vatRatePercent: string;
  vatGbp: string;
  totalIncVatGbp: string;
  limitations: string[];
};

export type CustomerQuotationDocumentModel = CustomerQuotationProjection;

const nonZero = (value: string | null | undefined) => Math.abs(Number(value ?? 0)) >= 0.005;
const safeSpecificationLabels = new Set(["product", "system", "alu cladded", "timber", "surface finishing", "glass unit", "fittings", "trickle ventilator", "drip rail", "sash sealing", "glass sealing", "routing", "opening", "threshold", "locking", "weight"]);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const textValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

function manufacturerEvidenceFor(row: { sourceSnapshot: Record<string, unknown> | null }) {
  const snapshot = record(row.sourceSnapshot);
  return record(snapshot.manufacturerEvidence);
}

function customerSafeSpecification(evidence: Record<string, unknown>) {
  return (Array.isArray(evidence.customerSafeSpecification) ? evidence.customerSafeSpecification : []).flatMap((value) => {
    const item = record(value); const label = textValue(item.label); const content = textValue(item.value);
    return label && content && safeSpecificationLabels.has(label.toLowerCase()) ? [{ label, value: content }] : [];
  });
}

function drawingForPosition(estimatePosition: Position | null, evidence: Record<string, unknown>): CustomerQuotationDrawing {
  if (estimatePosition) {
    const inside = configuratorDocumentDrawingRegistry.resolve(estimatePosition, "inside");
    const outside = configuratorDocumentDrawingRegistry.resolve(estimatePosition, "outside");
    if (inside.available || outside.available) return { source: "configurator", available: true, insideAvailable: inside.available, outsideAvailable: outside.available };
  }
  const visual = record(evidence.sourceVisual); const imageUrl = textValue(visual.url);
  const orientationText = `${textValue(evidence.configurationDescription)} ${textValue(visual.orientation)}`;
  const orientation = /view from inside|\binside\b/i.test(orientationText) ? "inside" : /view from outside|\boutside\b/i.test(orientationText) ? "outside" : "unknown";
  if (visual.status === "available" && imageUrl) return { source: "manufacturer", available: true, imageUrl, mediaType: textValue(visual.mediaType) || null, orientation };
  return { source: "unavailable", available: false, reason: textValue(visual.reason) || "No trusted drawing is available for this position." };
}

function installationInclusions(scenario: ProjectCostingScenarioView) {
  const programme = record(scenario.installationProgramme);
  const costs = record(programme.costs);
  const allowances = record(programme.allowances);
  const included = (value: unknown) => Number(value ?? 0) > 0;
  const lines: string[] = [];
  if (included(costs.labour)) lines.push("Installation labour");
  if (included(costs.mileage)) lines.push("Travel to site");
  if (included(costs.food)) lines.push("Food and subsistence");
  if (included(costs.accommodation)) lines.push(`Accommodation · ${Number(allowances.nights ?? 0)} night(s)`);
  if (included(costs.cillInstallation)) lines.push(`Cill installation for ${Number(allowances.cillApplicableQuantity ?? 0)} applicable window(s)`);
  if (included(costs.survey)) lines.push(`Retrofit survey · ${Number(allowances.surveyDays ?? 0)} day(s)`);
  if (included(costs.support)) lines.push(`Installation support · ${Number(allowances.supportDays ?? 0)} day(s)`);
  return lines;
}

export function buildCustomerQuotationProjection(input: {
  scenario: ProjectCostingScenarioView;
  client: Pick<Client, "clientName" | "projectName" | "projectAddress">;
  estimate: Pick<Estimate, "id" | "estimateRef" | "positions" | "projectAddress">;
  previewDate?: string;
  brand?: CustomerDocumentBrand;
  displayOptions?: CustomerQuotationDisplayOptions;
}): CustomerQuotationProjection {
  const result = deriveProjectCostingCommercialResult(input.scenario);
  const estimateById = new Map(input.estimate.positions.map((position) => [String(position.id), position]));
  const positions = result.productPricing.map(({ row, unitSellingPrice, totalSellingPrice }, index): CustomerQuotationPosition => {
    const estimatePosition = row.estimatePositionId ? estimateById.get(String(row.estimatePositionId)) ?? null : null;
    const evidence = manufacturerEvidenceFor(row);
    const configured = estimatePosition ? getConfiguredPositionContract(estimatePosition) : null;
    const manufacturerUg = textValue(evidence.manufacturerQuotedUg);
    const manufacturerUw = textValue(evidence.manufacturerQuotedUw);
    const productSystem = textValue(evidence.productSystem) || textValue(evidence.product) || configured?.product.productFamily || row.productClass;
    const drawing = drawingForPosition(estimatePosition, evidence);
    return {
      sequence: index + 1,
      id: row.id,
      manufacturerItemNumber: textValue(evidence.manufacturerItemNumber) || null,
      customerReference: textValue(evidence.customerReference) || row.displayReference,
      reference: row.displayReference,
      roomName: estimatePosition?.roomName || textValue(evidence.roomLocation) || String((row.sourceSnapshot as { roomName?: unknown } | null)?.roomName ?? ""),
      quantity: row.quantity,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      description: estimatePosition && getConfiguredPositionContract(estimatePosition)
        ? customerProductDescription({ ...row, sourceSnapshot: { ...row.sourceSnapshot, configuredContract: estimatePosition.configuredContract } })
        : customerProductDescription(row),
      productSystem,
      configurationDescription: textValue(evidence.configurationDescription),
      specification: customerSafeSpecification(evidence),
      drawing,
      unitSellingPriceGbp: unitSellingPrice,
      totalSellingPriceGbp: totalSellingPrice,
      estimatePosition,
      hasConfiguredDrawing: drawing.source === "configurator",
      thermal: manufacturerUg || manufacturerUw ? { ...(manufacturerUg ? { ug: manufacturerUg } : {}), ...(manufacturerUw ? { manufacturerQuotedUw: manufacturerUw } : {}) } : null,
      sectionDetailIds: [],
    };
  });
  const alternatives = result.alternativeProducts.map((row) => ({
    id: row.id, reference: row.displayReference, quantity: row.quantity, widthMm: row.widthMm, heightMm: row.heightMm,
    description: customerProductDescription(row),
  }));
  const charges: CustomerQuotationCharge[] = [];
  charges.push({ id: "products", label: "Products / Supply Only", amountGbp: result.productSale });
  const extraRows = [
    ...result.includedExtras.filter((row) => nonZero(row.markedUpAmount)).map((row) => ({ id: `extra-${row.id}`, label: row.label || "Additional item", amountGbp: row.markedUpAmount ?? "0.00" })),
    ...result.extraPackageUplifts.filter((row) => nonZero(row.sellingAmountGbp)).map((row, index) => ({ id: `extra-package-${index}`, label: row.label || "Additional item", amountGbp: row.sellingAmountGbp ?? "0.00" })),
  ];
  charges.push(...extraRows);
  if (nonZero(result.transportSale)) charges.push({ id: "transport", label: "Delivery and transport", amountGbp: result.transportSale });
  if (!result.siteVisitAllocatedToProducts && nonZero(result.siteVisitSale)) charges.push({ id: "site-visit", label: "Site visit and travel", amountGbp: result.siteVisitSale });
  if (nonZero(result.equipmentSale)) charges.push({ id: "equipment", label: "Equipment hire", amountGbp: result.equipmentSale });
  if (nonZero(result.installationSale)) charges.push({ id: "installation", label: "Installation", amountGbp: result.installationSale });
  if (nonZero(result.materialsSale)) charges.push({ id: "materials", label: "Installation materials", amountGbp: result.materialsSale });
  if (nonZero(result.feeSale)) charges.push({ id: "duties", label: "Import fees and duties", amountGbp: result.feeSale });
  const vatTreatment=resolveVatTreatment(input.scenario.options?.vatTreatment,input.scenario.options?.projectType),vatGbp = percentageAmount(result.actualSale, vatTreatment.percentage);
  const limitations: string[] = [];
  if (positions.some((position) => !position.drawing.available)) limitations.push("Positions without a trusted native or manufacturer drawing are shown with a clean unavailable state; no drawing is fabricated.");
  if (result.unpricedTotals.length) limitations.push("Supplier totals without safe position allocation are presented as a project-level Products / Supply Only balance.");

  return {
    brand: input.brand ?? ECOFENSTER_DEVELOPMENT_DOCUMENT_BRAND,
    displayOptions: input.displayOptions ?? DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS,
    estimateReference: input.estimate.estimateRef,
    commercialRevision: input.scenario.revisionNumber,
    previewDate: input.previewDate ?? new Date().toISOString(),
    clientName: input.client.clientName,
    projectName: input.client.projectName,
    projectAddress: input.estimate.projectAddress || input.client.projectAddress,
    currency: CUSTOMER_QUOTATION_POLICY.currency,
    positions,
    productsSupplyTotalGbp: result.productSale,
    productSupplySummary: positions.map((position) => ({ reference: position.customerReference, description: position.productSystem || position.description, quantity: position.quantity, dimensions: `${position.widthMm} × ${position.heightMm} mm`, amountGbp: position.totalSellingPriceGbp })),
    installationInclusions: installationInclusions(input.scenario),
    alternatives,
    charges,
    customerDiscountGbp: result.customerDiscountAmount,
    showCustomerDiscount: nonZero(result.customerDiscountAmount),
    fixedPriceAdjustmentGbp: result.commercialAdjustment,
    fixedSellingPriceEnabled: result.customerPricing.fixedSellingPrice.enabled,
    subtotalExVatGbp: result.actualSale,
    vatRatePercent: vatTreatment.percentage,
    vatGbp,
    totalIncVatGbp: addDecimalAmounts([result.actualSale, vatGbp]),
    limitations,
  };
}
