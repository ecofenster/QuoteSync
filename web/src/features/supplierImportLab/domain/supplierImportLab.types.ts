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
