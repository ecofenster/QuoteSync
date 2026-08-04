import type { SupplierQuoteImportRunStatus, SupplierQuoteRevisionLifecycleStatus } from "./supplierQuote.types";

const REVISION_TRANSITIONS: Record<SupplierQuoteRevisionLifecycleStatus, readonly SupplierQuoteRevisionLifecycleStatus[]> = {
  uploaded: ["extracting", "archived", "failed"],
  extracting: ["extracted", "failed", "archived"],
  extracted: ["parsed", "failed", "archived"],
  parsed: ["review_required", "failed", "archived"],
  review_required: ["approved", "failed", "archived"],
  approved: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
  failed: ["extracting", "archived"],
};

export function canTransitionSupplierQuoteRevision(
  from: SupplierQuoteRevisionLifecycleStatus,
  to: SupplierQuoteRevisionLifecycleStatus
): boolean {
  return REVISION_TRANSITIONS[from].includes(to);
}

export function isTerminalImportRunStatus(status: SupplierQuoteImportRunStatus): boolean {
  return status === "completed" || status === "completed_with_warnings" || status === "failed" || status === "cancelled";
}
