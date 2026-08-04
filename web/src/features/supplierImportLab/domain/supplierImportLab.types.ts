import type { CurrencyCode, ISODate, ISODateTime } from "../../commercial/domain/commercial.types";

export type SupplierImportLabSessionStatus = "draft" | "uploaded" | "extraction_pending" | "extracted" | "failed" | "archived";
export type SupplierImportLabAttachmentRole = "original_quote" | "supporting_document" | "supplier_drawing";

export type SupplierImportLabSession = {
  id: string;
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
export type SupplierImportLabExtractionRun = { id: string; sessionId: string; attachmentId: string; attachmentFileName: string | null; rowCount: number; selectedRowCount: number; warningCount: number; extractorName: string; extractorVersion: string; fieldParserName: string; fieldParserVersion: string; status: SupplierImportLabExtractionStatus; startedAt: ISODateTime; completedAt: ISODateTime | null; warnings: string[]; errorCode: string | null; errorMessage: string | null; quotationProposal: { supplierQuotationNumber: string | null; supplierRevision: string | null; fullQuotationReference: string | null; warnings: string[] }; selected: boolean; createdAt: ISODateTime };
export type SupplierImportLabExtractedRowStatus = "extracted" | "needs_review" | "corrected" | "rejected";
export type SupplierImportLabExtractedRow = { id: string; sessionId: string; extractionRunId: string; attachmentId: string; ordinal: number; displayReference: string | null; originalReferenceText: string | null; supplierReferenceTokens: string[]; quantity: number | null; widthMm: number | null; heightMm: number | null; originalDimensionsText: string | null; unitPrice: string | null; totalPrice: string | null; currency: CurrencyCode; sourcePages: number[]; sourceTrace: SourceTrace[]; confidence: number | null; warnings: string[]; reviewWarnings: string[]; selectedForFutureUse: boolean; status: SupplierImportLabExtractedRowStatus; createdAt: ISODateTime; correctedAt: ISODateTime | null; correctedBy: string | null; originalExtractedSnapshot: Record<string, unknown> };
export type SupplierImportLabRowDraft = { rowId: string; displayReference: string; widthMm: string; heightMm: string; quantity: string; unitPrice: string; totalPrice: string; selectedForFutureUse: boolean };
