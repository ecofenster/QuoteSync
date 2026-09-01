import type { ManufacturerSourceSpecification, ManufacturerSourceVisual } from "../../supplierImportLab/domain/supplierImportLab.types";

export type SupplierImportDiagnostics = {
  status: string;
  message: string;
  counts: {
    sourcePositions: number;
    rawBlocks: number;
    candidatePositionBlocks: number;
    parsedPositions: number;
    selectedPositions: number;
    validCanonicalPositions: number;
    reviewRequiredPositions: number;
    persistedPositions: number;
    productsSupplyRows: number;
    projectCostingRows: number;
    includedRows: number;
    alternativeRows: number;
    excludedRows: number;
    visualEvidence: number;
    ambiguousVisualEvidence: number;
  };
};

export type CanonicalManufacturerOption = {
  manufacturerId: string;
  manufacturerName: string;
  manufacturerCode: string;
  updatedAt: string;
};

export type CommercialSupplierOption = {
  supplierCode: string;
  supplierName: string;
  pricingMethod: string | null;
  pricingPolicyAvailable: boolean;
  policyUpdatedAt: string;
};

export type ManufacturerImportReviewRow = {
  rowKey: string;
  include: boolean;
  technicallySelectable: boolean;
  commerciallyReady: boolean;
  commercialReadiness: string;
  manufacturerName: string | null;
  manufacturerItemNumber: string | null;
  customerReference: string | null;
  roomLocation: string | null;
  product: string | null;
  productSystem: string | null;
  configurationDescription: string | null;
  widthMm: number | null;
  heightMm: number | null;
  areaSquareMetres: string | null;
  weightKg: string | null;
  glassSpecification: string | null;
  fittingsSpecification: string | null;
  quantity: number | null;
  currency: string | null;
  unitPrice: string | null;
  totalPrice: string | null;
  manufacturerQuotedUg: string | null;
  manufacturerQuotedUw: string | null;
  sourceSpecification: ManufacturerSourceSpecification | null;
  canonicalSpecification: Record<string, unknown> | null;
  sourceVisuals: ManufacturerSourceVisual[];
  sourceVisual: ManufacturerSourceVisual & {
    originalAsset?: { mediaType?: string; sourceFormat?: string; storageKey?: string; attachmentId?: string; sha256?: string; sourcePage?: number; boundingRegion?: { x: number; y: number; width: number; height: number } };
    renderParameters?: { status?: string; renderVersion?: string };
  };
  warnings: string[];
};

export type SupplierQuotationCommercialEvidence = {
  version: string;
  currency: string | null;
  categories: {
    productsSupply: { amount: string; automaticImport: true };
    extras: { amount: string; automaticImport: true };
    transport: { amount: string; automaticImport: true };
    installation: { amount: string; automaticImport: false; decision: string };
    survey: { amount: string; automaticImport: false; decision: string };
    discount: { percentage: string; amount: string; quotedNetProductAmount: string; automaticImport: false; decision: string } | null;
  };
  defaultImportedCost: string;
  supplierQuotedTotal: string | null;
  sourceReconciliation: Record<string, unknown> | null;
  productSupplyReconciliation: {
    version: string;
    status: "reconciled_exact" | "reconciled_rounding_variance" | "review_required" | "not_available";
    blocking: boolean;
    expectedSubtotal: string | null;
    extractedSubtotal: string;
    variance: string | null;
    tolerance: string;
    contributors: Array<Record<string, unknown>>;
    excludedItems: Array<Record<string, unknown>>;
    reviewReasons: string[];
  };
};

export type ManufacturerImportReview = {
  estimateId: string;
  positionCount: number;
  metadata: {
    recognizedSupplierName: string;
    recognizedDealerName: string;
    recognizedManufacturerName: string;
    supplierIdentityRole: "quotation_issuer";
    manufacturerIdentityRole: "product_manufacturer";
    storedSupplierName: string;
    supplierResolutionStatus: "resolved" | "ambiguous" | "not_configured";
    supplierResolutionMethod: string | null;
    dealerResolutionStatus: "resolved" | "ambiguous" | "not_configured";
    dealerResolutionMethod: string | null;
    supplierName: string;
    supplierCode: string | null;
    manufacturerResolutionStatus: "resolved" | "ambiguous" | "not_configured" | "not_recognized";
    manufacturerResolutionMethod: string | null;
    manufacturerId: string | null;
    manufacturerName: string;
    manufacturerCode: string | null;
    supplierManufacturerRelationship: Record<string, unknown>;
    quotationNumber: string | null;
    quotationReferenceAuthority: string | null;
    reviewedQuotationReference: string | null;
    sourceQuotationReference: string | null;
    sourceQuotationReferenceAuthority: string | null;
    documentMetadataReference: string | null;
    revision: string | null;
    currency: string;
  };
  canonicalManufacturers: CanonicalManufacturerOption[];
  commercialSuppliers: CommercialSupplierOption[];
  canonicalSuppliers: CommercialSupplierOption[];
  documents: Array<{ quoteId: string; revisionId: string; attachmentId: string; adapter: string | null; diagnostics: SupplierImportDiagnostics; commercialEvidence: SupplierQuotationCommercialEvidence | null; rows: ManufacturerImportReviewRow[] }>;
};

const objectValue = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const stringValue = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const arrayValue = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

function normalizeSupplierOptions(value: unknown): CommercialSupplierOption[] {
  return arrayValue(value).flatMap((candidate) => {
    const item = objectValue(candidate);
    const supplierCode = stringValue(item?.supplierCode);
    const supplierName = stringValue(item?.supplierName);
    if (!supplierCode || !supplierName) return [];
    const pricingMethod = stringValue(item?.pricingMethod);
    return [{ supplierCode, supplierName, pricingMethod, pricingPolicyAvailable: pricingMethod !== null, policyUpdatedAt: stringValue(item?.policyUpdatedAt) ?? "" }];
  });
}

function normalizeManufacturerOptions(value: unknown): CanonicalManufacturerOption[] {
  return arrayValue(value).flatMap((candidate) => {
    const item = objectValue(candidate);
    const manufacturerId = stringValue(item?.manufacturerId);
    const manufacturerName = stringValue(item?.manufacturerName);
    if (!manufacturerId || !manufacturerName) return [];
    return [{ manufacturerId, manufacturerName, manufacturerCode: stringValue(item?.manufacturerCode) ?? "", updatedAt: stringValue(item?.updatedAt) ?? "" }];
  });
}

function normalizeCommercialEvidence(value: unknown): SupplierQuotationCommercialEvidence | null {
  const item = objectValue(value), categories = objectValue(item?.categories);
  if (!item || !categories) return null;
  const rawReconciliation = objectValue(item.productSupplyReconciliation);
  const category = (key: string, automaticImport: boolean, decision?: string) => {
    const source = objectValue(categories[key]);
    return { amount: stringValue(source?.amount) ?? "0.00", automaticImport, ...(decision ? { decision: stringValue(source?.decision) ?? decision } : {}) };
  };
  const rawDiscount = objectValue(categories.discount);
  return {
    version: stringValue(item.version) ?? "unknown",
    currency: stringValue(item.currency),
    categories: {
      productsSupply: category("productsSupply", true) as SupplierQuotationCommercialEvidence["categories"]["productsSupply"],
      extras: category("extras", true) as SupplierQuotationCommercialEvidence["categories"]["extras"],
      transport: category("transport", true) as SupplierQuotationCommercialEvidence["categories"]["transport"],
      installation: category("installation", false, "evidence_only") as SupplierQuotationCommercialEvidence["categories"]["installation"],
      survey: category("survey", false, "review_required") as SupplierQuotationCommercialEvidence["categories"]["survey"],
      discount: rawDiscount ? { percentage: stringValue(rawDiscount.percentage) ?? "0", amount: stringValue(rawDiscount.amount) ?? "0.00", quotedNetProductAmount: stringValue(rawDiscount.quotedNetProductAmount) ?? "0.00", automaticImport: false, decision: stringValue(rawDiscount.decision) ?? "available_not_applied" } : null,
    },
    defaultImportedCost: stringValue(item.defaultImportedCost) ?? "0.00",
    supplierQuotedTotal: stringValue(item.supplierQuotedTotal),
    sourceReconciliation: objectValue(item.sourceReconciliation),
    productSupplyReconciliation: {
      version: stringValue(rawReconciliation?.version) ?? "unknown",
      status: ["reconciled_exact", "reconciled_rounding_variance", "review_required", "not_available"].includes(String(rawReconciliation?.status)) ? rawReconciliation?.status as SupplierQuotationCommercialEvidence["productSupplyReconciliation"]["status"] : "not_available",
      blocking: rawReconciliation?.blocking === true,
      expectedSubtotal: stringValue(rawReconciliation?.expectedSubtotal),
      extractedSubtotal: stringValue(rawReconciliation?.extractedSubtotal) ?? "0.00",
      variance: stringValue(rawReconciliation?.variance),
      tolerance: stringValue(rawReconciliation?.tolerance) ?? "0.01",
      contributors: arrayValue(rawReconciliation?.contributors).flatMap((entry) => objectValue(entry) ? [objectValue(entry)!] : []),
      excludedItems: arrayValue(rawReconciliation?.excludedItems).flatMap((entry) => objectValue(entry) ? [objectValue(entry)!] : []),
      reviewReasons: arrayValue(rawReconciliation?.reviewReasons).filter((reason): reason is string => typeof reason === "string"),
    },
  };
}

function defaultCounts(rows: ManufacturerImportReviewRow[], value: unknown): SupplierImportDiagnostics["counts"] {
  const counts = objectValue(value);
  const parsed = rows.length;
  const ready = rows.filter((row) => row.include).length;
  return {
    sourcePositions: numberValue(counts?.sourcePositions, parsed),
    rawBlocks: numberValue(counts?.rawBlocks),
    candidatePositionBlocks: numberValue(counts?.candidatePositionBlocks, parsed),
    parsedPositions: numberValue(counts?.parsedPositions, parsed),
    selectedPositions: numberValue(counts?.selectedPositions),
    validCanonicalPositions: numberValue(counts?.validCanonicalPositions, ready),
    reviewRequiredPositions: numberValue(counts?.reviewRequiredPositions, parsed - ready),
    persistedPositions: numberValue(counts?.persistedPositions),
    productsSupplyRows: numberValue(counts?.productsSupplyRows),
    projectCostingRows: numberValue(counts?.projectCostingRows),
    includedRows: numberValue(counts?.includedRows, ready),
    alternativeRows: numberValue(counts?.alternativeRows),
    excludedRows: numberValue(counts?.excludedRows),
    visualEvidence: numberValue(counts?.visualEvidence),
    ambiguousVisualEvidence: numberValue(counts?.ambiguousVisualEvidence),
  };
}

const unavailableVisual = (): ManufacturerImportReviewRow["sourceVisual"] => ({
  kind: "manufacturer_document_region",
  role: "other_source",
  primary: true,
  status: "unavailable",
  reason: "No mapped manufacturer visual.",
} as ManufacturerImportReviewRow["sourceVisual"]);

function normalizeRows(value: unknown): ManufacturerImportReviewRow[] {
  return arrayValue(value).flatMap((candidate, index) => {
    const item = objectValue(candidate);
    if (!item) return [];
    const sourceVisual = objectValue(item.sourceVisual) as ManufacturerImportReviewRow["sourceVisual"] | null;
    return [{
      ...item,
      rowKey: stringValue(item.rowKey) ?? `review-row-${index}`,
      include: item.include === true,
      technicallySelectable: item.technicallySelectable === true || item.include === true,
      commerciallyReady: item.commerciallyReady === true || item.commercialReadiness === "canonical_ready",
      commercialReadiness: stringValue(item.commercialReadiness) ?? (item.commerciallyReady === true ? "canonical_ready" : "review_required"),
      manufacturerName: stringValue(item.manufacturerName),
      manufacturerItemNumber: stringValue(item.manufacturerItemNumber),
      customerReference: stringValue(item.customerReference),
      roomLocation: stringValue(item.roomLocation),
      product: stringValue(item.product),
      productSystem: stringValue(item.productSystem),
      configurationDescription: stringValue(item.configurationDescription),
      widthMm: typeof item.widthMm === "number" ? item.widthMm : null,
      heightMm: typeof item.heightMm === "number" ? item.heightMm : null,
      areaSquareMetres: stringValue(item.areaSquareMetres),
      weightKg: stringValue(item.weightKg),
      glassSpecification: stringValue(item.glassSpecification),
      fittingsSpecification: stringValue(item.fittingsSpecification),
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      currency: stringValue(item.currency),
      unitPrice: stringValue(item.unitPrice),
      totalPrice: stringValue(item.totalPrice),
      manufacturerQuotedUg: stringValue(item.manufacturerQuotedUg),
      manufacturerQuotedUw: stringValue(item.manufacturerQuotedUw),
      sourceSpecification: objectValue(item.sourceSpecification) as ManufacturerSourceSpecification | null,
      canonicalSpecification: objectValue(item.canonicalSpecification),
      sourceVisuals: arrayValue(item.sourceVisuals) as ManufacturerSourceVisual[],
      sourceVisual: sourceVisual ?? unavailableVisual(),
      warnings: arrayValue(item.warnings).filter((warning): warning is string => typeof warning === "string"),
    } as ManufacturerImportReviewRow];
  });
}

function normalizeDocuments(value: unknown): ManufacturerImportReview["documents"] {
  return arrayValue(value).flatMap((candidate) => {
    const item = objectValue(candidate);
    if (!item) return [];
    const rows = normalizeRows(item.rows);
    const diagnostics = objectValue(item.diagnostics);
    const commercialEvidence = normalizeCommercialEvidence(item.commercialEvidence);
    return [{
      quoteId: stringValue(item.quoteId) ?? "",
      revisionId: stringValue(item.revisionId) ?? "",
      attachmentId: stringValue(item.attachmentId) ?? "",
      adapter: stringValue(item.adapter),
      diagnostics: {
        status: stringValue(diagnostics?.status) ?? "review_required",
        message: stringValue(diagnostics?.message) ?? "Supplier review evidence requires confirmation.",
        counts: defaultCounts(rows, diagnostics?.counts),
      },
      commercialEvidence,
      rows,
    }];
  });
}

export function normalizeManufacturerImportReview(value: unknown): ManufacturerImportReview {
  const response = objectValue(value);
  const metadata = objectValue(response?.metadata);
  if (!response || !metadata) throw new Error("Supplier review response was incomplete. No commercial rows were changed; restart the current API and retry extraction.");

  const canonicalSuppliers = normalizeSupplierOptions(response.canonicalSuppliers);
  const commercialSuppliers = normalizeSupplierOptions(response.commercialSuppliers ?? response.canonicalSuppliers);
  const canonicalManufacturers = normalizeManufacturerOptions(response.canonicalManufacturers);
  const documents = normalizeDocuments(response.documents);
  const recognizedSupplierName = stringValue(metadata.recognizedSupplierName) ?? stringValue(metadata.supplierName) ?? "Supplier not recognised";
  const recognizedDealerName = stringValue(metadata.recognizedDealerName) ?? recognizedSupplierName;
  const recognizedManufacturerName = stringValue(metadata.recognizedManufacturerName) ?? stringValue(metadata.manufacturerName) ?? recognizedSupplierName;
  const supplierStatus = metadata.supplierResolutionStatus === "resolved" || metadata.supplierResolutionStatus === "ambiguous" ? metadata.supplierResolutionStatus : "not_configured";
  const manufacturerStatus = metadata.manufacturerResolutionStatus === "resolved" || metadata.manufacturerResolutionStatus === "ambiguous" || metadata.manufacturerResolutionStatus === "not_recognized" ? metadata.manufacturerResolutionStatus : "not_configured";

  return {
    estimateId: stringValue(response.estimateId) ?? "",
    positionCount: numberValue(response.positionCount, documents.reduce((total, document) => total + document.rows.length, 0)),
    metadata: {
      recognizedSupplierName,
      recognizedDealerName,
      recognizedManufacturerName,
      supplierIdentityRole: "quotation_issuer",
      manufacturerIdentityRole: "product_manufacturer",
      storedSupplierName: stringValue(metadata.storedSupplierName) ?? recognizedDealerName,
      supplierResolutionStatus: supplierStatus,
      supplierResolutionMethod: stringValue(metadata.supplierResolutionMethod),
      dealerResolutionStatus: metadata.dealerResolutionStatus === "resolved" || metadata.dealerResolutionStatus === "ambiguous" ? metadata.dealerResolutionStatus : supplierStatus,
      dealerResolutionMethod: stringValue(metadata.dealerResolutionMethod) ?? stringValue(metadata.supplierResolutionMethod),
      supplierName: stringValue(metadata.supplierName) ?? recognizedDealerName,
      supplierCode: stringValue(metadata.supplierCode),
      manufacturerResolutionStatus: manufacturerStatus,
      manufacturerResolutionMethod: stringValue(metadata.manufacturerResolutionMethod),
      manufacturerId: stringValue(metadata.manufacturerId),
      manufacturerName: stringValue(metadata.manufacturerName) ?? recognizedManufacturerName,
      manufacturerCode: stringValue(metadata.manufacturerCode),
      supplierManufacturerRelationship: objectValue(metadata.supplierManufacturerRelationship) ?? {},
      quotationNumber: stringValue(metadata.quotationNumber),
      quotationReferenceAuthority: stringValue(metadata.quotationReferenceAuthority),
      reviewedQuotationReference: stringValue(metadata.reviewedQuotationReference),
      sourceQuotationReference: stringValue(metadata.sourceQuotationReference),
      sourceQuotationReferenceAuthority: stringValue(metadata.sourceQuotationReferenceAuthority),
      documentMetadataReference: stringValue(metadata.documentMetadataReference),
      revision: stringValue(metadata.revision),
      currency: stringValue(metadata.currency)?.toUpperCase() ?? "GBP",
    },
    canonicalManufacturers,
    commercialSuppliers,
    canonicalSuppliers,
    documents,
  };
}
