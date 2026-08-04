import type { SupplierImportLabExtractedRow, SupplierImportLabRowDraft } from "./supplierImportLab.types";

export type ReviewField = Exclude<keyof SupplierImportLabRowDraft, "rowId">;
export type ReviewIssue = { field: ReviewField; message: string };
const decimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const integer = /^[1-9]\d*$/;

export function rowToDraft(row: SupplierImportLabExtractedRow): SupplierImportLabRowDraft {
  return { rowId: row.id, displayReference: row.displayReference ?? "", widthMm: row.widthMm == null ? "" : String(row.widthMm), heightMm: row.heightMm == null ? "" : String(row.heightMm), quantity: row.quantity == null ? "" : String(row.quantity), unitPrice: row.unitPrice ?? "", totalPrice: row.totalPrice ?? "", selectedForFutureUse: row.selectedForFutureUse && row.status !== "rejected" };
}
export function validateRowDraft(draft: SupplierImportLabRowDraft, status = "extracted"): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  if (!draft.displayReference.trim()) issues.push({ field: "displayReference", message: "Reference is required." });
  for (const [field, label] of [["widthMm", "Width"], ["heightMm", "Height"], ["quantity", "Quantity"]] as const) if (!integer.test(draft[field])) issues.push({ field, message: `${label} must be a positive whole number.` });
  for (const [field, label] of [["unitPrice", "Unit price"], ["totalPrice", "Total price"]] as const) if (!decimal.test(draft[field])) issues.push({ field, message: `${label} must be a non-negative decimal without exponent notation.` });
  if (status === "rejected" && draft.selectedForFutureUse) issues.push({ field: "selectedForFutureUse", message: "Rejected rows cannot be selected." });
  return issues;
}
export function changedFields(row: SupplierImportLabExtractedRow, draft: SupplierImportLabRowDraft): ReviewField[] {
  const saved = rowToDraft(row); return (["displayReference", "widthMm", "heightMm", "quantity", "unitPrice", "totalPrice", "selectedForFutureUse"] as ReviewField[]).filter((field) => saved[field] !== draft[field]);
}
export function exactTotalMatches(draft: SupplierImportLabRowDraft) {
  if (!decimal.test(draft.unitPrice) || !decimal.test(draft.totalPrice) || !integer.test(draft.quantity)) return true;
  const parts = (value: string) => { const [whole, fraction = ""] = value.split("."); return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length }; };
  const unit = parts(draft.unitPrice), total = parts(draft.totalPrice), scale = Math.max(unit.scale, total.scale);
  return unit.digits * BigInt(draft.quantity) * (10n ** BigInt(scale - unit.scale)) === total.digits * (10n ** BigInt(scale - total.scale));
}
export function friendlyRunStatus(status: string) { return ({ completed: "Completed", completed_with_warnings: "Completed with warnings", failed: "Failed", unsupported: "OCR required", queued: "Processing", running: "Processing" } as Record<string, string>)[status] ?? status; }
