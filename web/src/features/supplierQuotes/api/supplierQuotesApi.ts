import { apiFetch, apiUrl, extractApiErrorMessage } from "../../../services/api/apiClient";
import type { SupplierQuote, SupplierQuoteAttachment, SupplierQuoteRevision } from "../../supplierQuoteImport/domain/supplierQuote.types";

const base = (estimateId: string) => `/api/estimates/${encodeURIComponent(estimateId)}/supplier-quotes`;
export const supplierQuotesApi = {
  listQuotes: (estimateId: string) => apiFetch(base(estimateId)) as Promise<SupplierQuote[]>,
  createQuote: (estimateId: string, input: { supplierCode: string; supplierName: string }) => apiFetch(base(estimateId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) as Promise<SupplierQuote>,
  listRevisions: (estimateId: string, quoteId: string) => apiFetch(`${base(estimateId)}/${quoteId}/revisions`) as Promise<SupplierQuoteRevision[]>,
  createRevision: (estimateId: string, quoteId: string, input: Record<string, string>) => apiFetch(`${base(estimateId)}/${quoteId}/revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) as Promise<SupplierQuoteRevision>,
  listAttachments: (estimateId: string, quoteId: string, revisionId: string) => apiFetch(`${base(estimateId)}/${quoteId}/revisions/${revisionId}/attachments`) as Promise<SupplierQuoteAttachment[]>,
  uploadAttachments: (estimateId: string, quoteId: string, revisionId: string, files: readonly File[], role = "original_quote") => { const body = new FormData(); files.forEach((file) => body.append("files", file)); body.append("role", role); return apiFetch(`${base(estimateId)}/${quoteId}/revisions/${revisionId}/attachments`, { method: "POST", body }) as Promise<{ attachments: SupplierQuoteAttachment[] }>; },
  removeAttachment: (estimateId: string, quoteId: string, revisionId: string, attachmentId: string) => apiFetch(`${base(estimateId)}/${quoteId}/revisions/${revisionId}/attachments/${attachmentId}`, { method: "DELETE" }),
  downloadAttachment: async (estimateId: string, quoteId: string, revisionId: string, attachment: SupplierQuoteAttachment) => { const path = `${base(estimateId)}/${quoteId}/revisions/${revisionId}/attachments/${attachment.id}/download`; const response = await fetch(apiUrl(path)); if (!response.ok) { const body = await response.text().catch(() => ""); throw new Error(extractApiErrorMessage(response.status, body)); } const blob = await response.blob(); const url = URL.createObjectURL(blob); try { const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.originalFileName; anchor.click(); } finally { URL.revokeObjectURL(url); } },
};
