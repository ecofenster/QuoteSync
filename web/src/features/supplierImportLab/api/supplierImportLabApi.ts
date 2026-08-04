import { apiFetch, apiUrl, extractApiErrorMessage } from "../../../services/api/apiClient";
import type { SupplierImportLabAttachment, SupplierImportLabAttachmentRole, SupplierImportLabSession } from "../domain/supplierImportLab.types";

const base = "/api/admin/supplier-import-lab/sessions";
export type CreateLabSessionInput = { supplierName: string; supplierCode?: string; supplierQuotationNumber?: string; supplierRevision?: string; fullQuotationReference?: string; quotationDate?: string; currency: string };

export const supplierImportLabApi = {
  listSessions: (includeArchived = false) => apiFetch(`${base}?include_archived=${includeArchived}`) as Promise<SupplierImportLabSession[]>,
  createSession: (input: CreateLabSessionInput) => apiFetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) as Promise<SupplierImportLabSession>,
  updateSession: (sessionId: string, input: Partial<CreateLabSessionInput>) => apiFetch(`${base}/${encodeURIComponent(sessionId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) as Promise<SupplierImportLabSession>,
  archiveSession: (sessionId: string) => apiFetch(`${base}/${encodeURIComponent(sessionId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archive: true }) }) as Promise<SupplierImportLabSession>,
  deleteSession: (sessionId: string) => apiFetch(`${base}/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
  listAttachments: (sessionId: string) => apiFetch(`${base}/${encodeURIComponent(sessionId)}/attachments`) as Promise<SupplierImportLabAttachment[]>,
  uploadAttachments: (sessionId: string, files: readonly File[], role: SupplierImportLabAttachmentRole) => { const body = new FormData(); files.forEach((file) => body.append("files", file)); body.append("role", role); return apiFetch(`${base}/${encodeURIComponent(sessionId)}/attachments`, { method: "POST", body }) as Promise<{ attachments: SupplierImportLabAttachment[] }>; },
  removeAttachment: (sessionId: string, attachmentId: string) => apiFetch(`${base}/${encodeURIComponent(sessionId)}/attachments/${encodeURIComponent(attachmentId)}`, { method: "DELETE" }),
  downloadAttachment: async (sessionId: string, attachment: SupplierImportLabAttachment) => { const response = await fetch(apiUrl(`${base}/${encodeURIComponent(sessionId)}/attachments/${encodeURIComponent(attachment.id)}/download`)); if (!response.ok) { const body = await response.text().catch(() => ""); throw new Error(extractApiErrorMessage(response.status, body)); } const blob = await response.blob(); const url = URL.createObjectURL(blob); try { const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.originalFileName; anchor.click(); } finally { URL.revokeObjectURL(url); } },
};
