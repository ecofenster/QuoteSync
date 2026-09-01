import type { EstimateId } from "../../../models/types";
import type { CurrencyCode, DecimalString, ISODate, ISODateTime, JsonValue, Money } from "../../commercial/domain/commercial.types";

export type SupplierQuoteId = string;
export type SupplierQuoteRevisionId = string;
export type SupplierQuoteAttachmentId = string;
export type SupplierQuotePositionId = string;
export type SupplierSpecificationItemId = string;
export type SupplierQuoteExtraId = string;
export type SupplierQuoteImportRunId = string;
export type SupplierQuoteReviewDecisionId = string;

export type SourceCoordinateSpace = "pdf_points" | "pixels" | "normalized";

export type SourceTrace = {
  attachmentId: SupplierQuoteAttachmentId;
  /** Zero-based source page index when supplied by the extractor. */
  pageNumber?: number;
  pageLabel?: string;
  blockId?: string;
  characterRange?: { start: number; end: number };
  boundingBox?: { x: number; y: number; width: number; height: number; coordinateSpace: SourceCoordinateSpace };
  extractedText?: string;
};

export type SupplierQuote = {
  id: SupplierQuoteId;
  estimateId: EstimateId;
  supplierCode: string;
  supplierName: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt: ISODateTime | null;
};

export type SupplierQuoteRevisionLifecycleStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "parsed"
  | "review_required"
  | "approved"
  | "superseded"
  | "archived"
  | "failed";

export type VatStatus = "exclusive" | "inclusive" | "zero_rated" | "not_applicable" | "unknown";

/** Revisions are immutable evidence. Supersession creates links; it never overwrites history. */
export type SupplierQuoteRevision = Readonly<{
  id: SupplierQuoteRevisionId;
  supplierQuoteId: SupplierQuoteId;
  estimateId: EstimateId;
  revisionSequence: number;
  supplierQuotationNumber: string;
  supplierRevision: string | null;
  fullQuotationReference: string;
  quotationDate: ISODate | null;
  supplierCustomer?: string | null;
  projectReference?: string | null;
  customerReference: string | null;
  currency: CurrencyCode;
  vatStatus: VatStatus;
  productSubtotal: Money | null;
  extrasTotal: Money | null;
  deliveryTotal: Money | null;
  vatTotal: Money | null;
  finalSupplierTotal: Money | null;
  comparisonTotals?: ReadonlyArray<{ classification: "alternative_supplier_subtotal" | "alternative_final_total" | "package_option"; label: string; amount: string; currency: CurrencyCode; includedInSupplierTotal: boolean; selected?: boolean }>;
  lifecycleStatus: SupplierQuoteRevisionLifecycleStatus;
  confirmationStatus?: "uploaded" | "extracting" | "extracted" | "review_required" | "ready_to_confirm" | "confirming" | "confirmed" | "partial_recovery_required" | "failed_recoverable" | null;
  confirmationOperationId?: string | null;
  confirmationUpdatedAt?: ISODateTime | null;
  projectionStatus?: "current" | "projection_drift" | null;
  projectionCounts?: { expected: number; supplierPositions: number; productsSupplyRows: number; projectCostingRows: number } | null;
  isLatest: boolean;
  createdAt: ISODateTime;
  supersededAt: ISODateTime | null;
  supersededByRevisionId: SupplierQuoteRevisionId | null;
}>;

export type SupplierQuoteAttachmentRole = "original_quote" | "supplier_drawing" | "supporting_document" | "derived_artifact";
export type SupplierQuoteDocumentKind = "complete_quotation" | "window_schedule" | "quotation_letter" | "installation_pricing" | "supporting_document";
export type SupplierQuoteArtifactType = "extracted_text" | "page_image" | "position_drawing" | "normalized_document" | "other";

export type SupplierQuoteAttachment = {
  id: SupplierQuoteAttachmentId;
  estimateId: EstimateId;
  revisionId: SupplierQuoteRevisionId;
  role: SupplierQuoteAttachmentRole;
  documentKind: SupplierQuoteDocumentKind;
  originalFileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  parserEligible: boolean;
  uploadedBy: string;
  uploadOrder: number;
  createdAt: ISODateTime;
  derivedFromAttachmentId: SupplierQuoteAttachmentId | null;
  artifactType: SupplierQuoteArtifactType | null;
  extractorVersion: string | null;
};

export type SupplierQuoteImportRunStatus = "queued" | "running" | "completed" | "completed_with_warnings" | "failed" | "cancelled";

export type SupplierQuoteImportRun = {
  id: SupplierQuoteImportRunId;
  estimateId: EstimateId;
  revisionId: SupplierQuoteRevisionId;
  attachmentIds: SupplierQuoteAttachmentId[];
  extractorName: string;
  extractorVersion: string;
  adapterCode: string;
  adapterVersion: string;
  recognitionVersion: string;
  startedAt: ISODateTime;
  completedAt: ISODateTime | null;
  status: SupplierQuoteImportRunStatus;
  warnings: string[];
  errorCode: string | null;
  errorMessage: string | null;
  rawResultAttachmentId: SupplierQuoteAttachmentId | null;
};

export type SupplierSpecificationItem = {
  id: SupplierSpecificationItemId;
  supplierPositionId: SupplierQuotePositionId;
  /** Zero-based extraction order. suppliedNumber is evidence and does not control ordering. */
  ordinal: number;
  suppliedNumber: string | null;
  originalText: string;
  normalizedLabel: string | null;
  normalizedValue: string | null;
  trace: SourceTrace[];
};

export type SupplierQuotePositionReviewStatus = "unreviewed" | "accepted" | "corrected" | "rejected" | "deferred";

/**
 * Supplier evidence, not a ConfiguredPositionContract. Tokens are parser metadata:
 * token count never derives or validates quantity and never expands this business row.
 */
export type SupplierQuotePosition = {
  id: SupplierQuotePositionId;
  estimateId: EstimateId;
  revisionId: SupplierQuoteRevisionId;
  /** Immutable zero-based order in the authoritative supplier document. */
  sourceSequence?: number;
  classification?: "standard" | "alternative" | "excluded";
  includedInSupplierTotal?: boolean;
  alternativeToReference?: string | null;
  classificationEvidence?: string | null;
  displayReference: string;
  supplierReferenceTokens: string[];
  quantity: number;
  product: string | null;
  productSystem: string | null;
  originalSpecificationText: string;
  specifications: SupplierSpecificationItem[];
  widthMm: number | null;
  heightMm: number | null;
  supplierAreaSquareMetres: DecimalString | null;
  calculatedAreaSquareMetres: DecimalString | null;
  unitPurchasePrice: Money | null;
  totalPurchasePrice: Money | null;
  supplierDrawingAttachmentId: SupplierQuoteAttachmentId | null;
  openingDirection: string | null;
  viewDirection: "inside" | "outside" | "unknown";
  proposedWindowTypeId: string | null;
  proposedProofFamilyId: string | null;
  recognitionConfidence: number | null;
  recognitionReasons: string[];
  sourcePages: number[];
  trace: SourceTrace[];
  reviewStatus: SupplierQuotePositionReviewStatus;
};

export type SupplierQuoteExtraCategory = "delivery" | "sill" | "flashing" | "trim" | "accessory" | "packaging" | "surcharge" | "discount" | "other";

export type SupplierQuoteExtra = {
  id: SupplierQuoteExtraId;
  estimateId: EstimateId;
  revisionId: SupplierQuoteRevisionId;
  category: SupplierQuoteExtraCategory;
  label: string;
  originalText: string;
  quantity: DecimalString | null;
  unitPrice: Money | null;
  totalPrice: Money | null;
  trace: SourceTrace[];
};

export type ProposedPositionMatch = {
  proposalKey: string;
  estimateId: EstimateId;
  supplierPositionId: SupplierQuotePositionId;
  proposedWindowTypeId: string | null;
  proposedProofFamilyId: string | null;
  score: number;
  confidence: number;
  reasons: string[];
  normalizedEvidence: JsonValue;
  recognitionVersion: string;
  createdAt: ISODateTime;
  supportedByProductionManifest: boolean;
  blockingIssues: string[];
};

export type SupplierQuoteReviewDecisionValue = "accepted" | "corrected" | "rejected" | "deferred";

export type SupplierQuoteReviewDecision = Readonly<{
  id: SupplierQuoteReviewDecisionId;
  estimateId: EstimateId;
  supplierPositionId: SupplierQuotePositionId;
  importRunId: SupplierQuoteImportRunId;
  reviewVersion: string;
  decision: SupplierQuoteReviewDecisionValue;
  selectedProposalKey: string | null;
  proposedConfigurationSnapshot: JsonValue;
  approvedConfigurationSnapshot: JsonValue | null;
  resultingPositionId: string | null;
  resultingContractSchemaVersion: number | null;
  reviewerId: string;
  reviewedAt: ISODateTime;
  note: string | null;
}>;

export type SupplierQuoteDuplicationPolicy = "do_not_copy" | "copy_as_reference" | "copy_full_history" | "copy_latest_revision_only";
