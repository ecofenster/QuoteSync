import type { CurrencyCode, ISODate, ISODateTime } from "../../commercial/domain/commercial.types";

export type SupplierImportLabSessionStatus = "draft" | "uploaded" | "extraction_pending" | "extracted" | "failed" | "archived";
export type SupplierImportLabAttachmentRole = "original_quote" | "supporting_document" | "supplier_drawing";

export type SupplierImportLabSession = {
  id: string;
  estimateId?: string | null;
  supplierCode: string | null;
  supplierName: string;
  supplierQuotationNumber: string | null;
  supplierRevision: string | null;
  fullQuotationReference: string | null;
  quotationDate: ISODate | null;
  currency: CurrencyCode;
  status: SupplierImportLabSessionStatus;
  attachmentCount: number;
  extractedRowCount: number;
  selectedRowCount: number;
  additionalCostCount: number;
  productSubtotal: string | null;
  deliveryTotal: string | null;
  finalSupplierTotal: string | null;
  summaryStatus: SupplierImportLabExtractedRowStatus | null;
  latestExtractionStatus: SupplierImportLabExtractionStatus | null;
  lastExtractionAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt: ISODateTime | null;
};

export type SupplierImportLabAttachment = {
  id: string;
  sessionId: string;
  role: SupplierImportLabAttachmentRole;
  originalFileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  parserEligible: boolean;
  uploadOrder?: number;
  createdAt: ISODateTime;
};

export type SourceBoundingBox = { x: number; y: number; width: number; height: number };
export type SourceTrace = { attachmentId: string; pageNumber: number | null; blockId: string; boundingBox: SourceBoundingBox | null; coordinateSpace: "pdf_points" | null; extractedText: string };
export type ExtractedTextBlock = { id: string; text: string; pageNumber: number | null; boundingBox: SourceBoundingBox | null; readingOrder: number; sourceType: "positioned_text" | "paragraph" | "table_cell" };
export type ExtractedCell = { row: number; column: number; text: string; boundingBox: SourceBoundingBox | null };
export type ExtractedTable = { id: string; pageNumber: number | null; rows: ExtractedCell[][]; sourceTrace: SourceTrace[] };
export type ExtractedPage = { pageNumber: number | null; pageLabel: string; width: number | null; height: number | null; text: string; blocks: ExtractedTextBlock[]; tables: ExtractedTable[] };
export type ExtractedDocument = { attachmentId: string; sessionId: string; mediaType: string; extractorName: string; extractorVersion: string; createdAt: ISODateTime; pages: ExtractedPage[]; warnings: string[]; textAvailable: boolean; extractionStatus: "completed" | "unsupported" };
export type SupplierImportLabExtractionStatus = "queued" | "running" | "completed" | "completed_with_warnings" | "failed" | "unsupported";
export type SupplierImportLabExtractionRun = { id: string; sessionId: string; attachmentId: string; attachmentFileName: string | null; rowCount: number; selectedRowCount: number; additionalCostCount: number; productSubtotal: string | null; deliveryTotal: string | null; finalSupplierTotal: string | null; summaryStatus: SupplierImportLabExtractedRowStatus | null; reconciliationStatus: "reconciled" | "review_required" | null; warningCount: number; extractorName: string; extractorVersion: string; fieldParserName: string; fieldParserVersion: string; status: SupplierImportLabExtractionStatus; startedAt: ISODateTime; completedAt: ISODateTime | null; warnings: string[]; errorCode: string | null; errorMessage: string | null; quotationProposal: { supplierQuotationNumber: string | null; supplierRevision: string | null; fullQuotationReference: string | null; warnings: string[] }; selected: boolean; createdAt: ISODateTime };
export type SupplierImportLabExtractedRowStatus = "extracted" | "needs_review" | "corrected" | "rejected";
export type ManufacturerSourceSpecificationField = { id: string; ordinal: number; section: string; label: string; rawValue: string; normalizedValue: unknown; sourcePage: number | null; boundingRegion: SourceBoundingBox | null; coordinateSpace: "pdf_points" | null; evidenceClass: "explicit" | "normalised" | "derived" | "ocr" | "reviewed"; confidence: "strong" | "review"; reviewStatus: "mapped_automatic" | "needs_review" | "reviewed"; sourceElementReference?: string | null };
export type ManufacturerSourceSpecification = { version: "manufacturer-source-specification-v1"; supplierInterpretation: string; sourceAttachmentId: string; sourceAttachmentHash?: string | null; sourcePage: number; sourcePages?: number[]; coordinateSpace: "pdf_points"; fieldCount: number; sections: Array<{ name: string; fields: ManufacturerSourceSpecificationField[] }>; canonical: Record<string, unknown> };
export type ManufacturerSourceVisual = { kind: "manufacturer_document_image" | "manufacturer_document_region"; role?: "inside" | "outside" | "combined_source" | "other_source"; primary?: boolean; primaryUse?: "products_supply" | null; status: "available" | "unavailable"; sourceFormat?: string | null; sourcePage?: number | null; boundingRegion?: SourceBoundingBox | null; coordinateSpace?: "pdf_points" | null; mappingMethod?: string; mappingConfidence?: "strong" | "review"; mappingReviewStatus?: "mapped_automatic" | "needs_review" | "review_required" | "unavailable"; mediaType?: string; url?: string; reason?: string | null; renderedDerivative?: { mediaType: string; url: string; widthPx: number | null; heightPx: number | null; dpi?: number | null; purpose: string; role?: string; renderVersion?: string } | null };
export type ManufacturerPositionEvidence = { manufacturerItemNumber: string | null; customerReference: string | null; roomLocation: string | null; product: string | null; productSystem: string | null; productType: "Window" | "Door" | null; configurationDescription: string | null; areaSquareMetres: string | null; weightKg: string | null; glassSpecification: string | null; fittingsSpecification: string | null; manufacturerQuotedUg: string | null; manufacturerQuotedUw: string | null; customerSafeSpecification: Array<{ ordinal: number; label: string; value: string }>; sourceSpecification?: ManufacturerSourceSpecification | null; canonicalSpecification?: Record<string, unknown>; sourceVisuals?: ManufacturerSourceVisual[]; sourceVisual: ManufacturerSourceVisual };
export type SupplierImportLabExtractedRow = { id: string; sessionId: string; extractionRunId: string; attachmentId: string; ordinal: number; classification: "standard" | "alternative" | "excluded"; includedInSupplierTotal: boolean; alternativeTo: string | null; classificationEvidence: string | null; displayReference: string | null; originalReferenceText: string | null; supplierReferenceTokens: string[]; quantity: number | null; widthMm: number | null; heightMm: number | null; originalDimensionsText: string | null; unitPrice: string | null; totalPrice: string | null; currency: CurrencyCode; manufacturerEvidence: ManufacturerPositionEvidence | null; sourcePages: number[]; sourceTrace: SourceTrace[]; confidence: number | null; warnings: string[]; reviewWarnings: string[]; selectedForFutureUse: boolean; status: SupplierImportLabExtractedRowStatus; createdAt: ISODateTime; correctedAt: ISODateTime | null; correctedBy: string | null; originalExtractedSnapshot: Record<string, unknown> };
export type SupplierImportLabRowDraft = { rowId: string; displayReference: string; widthMm: string; heightMm: string; quantity: string; unitPrice: string; totalPrice: string; isAlternative: boolean; selectedForFutureUse: boolean };
export type SupplierImportLabCommercialSummary = { id: string; sessionId: string; extractionRunId: string; attachmentId: string; currency: CurrencyCode | null; totalQuantity: string | null; totalQuantityUnit: string | null; totalAreaSquareMetres: string | null; productSubtotal: string | null; additionalItemsSubtotal: string | null; deliveryTotal: string | null; vatTotal: string | null; finalSupplierTotal: string | null; comparisonTotals: Array<{ classification: "alternative_supplier_subtotal" | "alternative_final_total" | "package_option"; label: string; amount: string; currency: CurrencyCode; includedInSupplierTotal: boolean; selected?: boolean; sourceTrace: SourceTrace[] }>; averageUValue: string | null; totalWeightKg: string | null; closingNotes: string | null; sourceTrace: SourceTrace[]; warnings: string[]; reconciliation: { positionSubtotal?: string | null; additionalSubtotal?: string | null; deliverySubtotal?: string | null; expectedFinal?: string | null; reconciled?: boolean; warnings?: string[] }; confidence: number | null; status: SupplierImportLabExtractedRowStatus; createdAt: ISODateTime; correctedAt: ISODateTime | null; correctedBy: string | null; originalExtractedSnapshot: Record<string, unknown> };
export type SupplierImportLabAdditionalCostCategory = "delivery" | "sill" | "flashing" | "trim" | "accessory" | "packaging" | "surcharge" | "discount" | "other";
export type SupplierImportLabAdditionalCostItem = { id: string; summaryId: string; sessionId: string; extractionRunId: string; ordinal: number; category: SupplierImportLabAdditionalCostCategory; originalDescription: string; normalizedLabel: string | null; quantity: string | null; quantityUnit: string | null; unitPrice: string | null; totalPrice: string | null; currency: CurrencyCode | null; includedInSupplierTotal: boolean; inclusionEvidence: string | null; sourceTrace: SourceTrace[]; warnings: string[]; confidence: number | null; status: SupplierImportLabExtractedRowStatus; selectedForFutureUse: boolean; createdAt: ISODateTime; correctedAt: ISODateTime | null; correctedBy: string | null; originalExtractedSnapshot: Record<string, unknown> };
export type SupplierImportLabSummaryResult = { summary: SupplierImportLabCommercialSummary | null; additionalItems: SupplierImportLabAdditionalCostItem[] };
