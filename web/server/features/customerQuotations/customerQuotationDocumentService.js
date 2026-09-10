import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { ensureManagedParent, resolveManagedPath, resolveAttachmentRoot } from "../supplierQuotes/managedAttachmentStorage.js";
import { renderCustomerLifecyclePdf } from "./customerLifecycleDocumentRenderer.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const safeId = (value, label) => {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw Object.assign(new Error(`${label} is invalid.`), { status: 400 });
  return id;
};
const ascii = (value) => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
function validateProjection(projection) {
  if (!projection || typeof projection !== "object") throw Object.assign(new Error("Canonical Customer Quotation projection is required."), { status: 400 });
  for (const field of ["estimateReference", "clientName", "subtotalExVatGbp", "vatRatePercent", "vatGbp", "totalIncVatGbp"]) if (projection[field] == null || String(projection[field]).trim() === "") throw Object.assign(new Error(`Quotation projection ${field} is required.`), { status: 400 });
  if (!Array.isArray(projection.positions) || !Array.isArray(projection.charges)) throw Object.assign(new Error("Quotation projection positions and charges are required."), { status: 400 });
}

export function createCustomerQuotationDocumentService(db, { attachmentRoot = resolveAttachmentRoot() } = {}) {
  return {
    async createImmutablePdf({ estimateId, quotationRevision, projection }) {
      validateProjection(projection);
      const safeEstimateId = safeId(estimateId, "Estimate ID");
      const projectionJson = JSON.stringify(projection), projectionSha256 = sha256(projectionJson);
      const existing = await db.get("SELECT id FROM customer_quotation_documents WHERE estimate_id=? AND quotation_revision=? AND projection_sha256=? ORDER BY created_at LIMIT 1", safeEstimateId, Number(quotationRevision), projectionSha256);
      if (existing) return this.get(existing.id);
      const documentId = randomUUID();
      const bytes = await renderCustomerLifecyclePdf({ kind: "estimate", projection, context: { reference: projection.estimateReference, revision: quotationRevision, documentDate: projection.previewDate }, attachmentRoot }), documentSha256 = sha256(bytes);
      const fileName = `${ascii(projection.estimateReference).replace(/[^A-Za-z0-9_-]+/g, "-") || "estimate"}-Estimate-R${Number(quotationRevision)}.pdf`;
      const storageKey = `estimates/${safeEstimateId}/customer-quotations/${documentId}.pdf`;
      const target = await ensureManagedParent(storageKey, attachmentRoot);
      await writeFile(target, bytes, { flag: "wx" });
      await db.run(`INSERT INTO customer_quotation_documents(id,estimate_id,quotation_revision,file_name,media_type,storage_key,size_bytes,sha256,projection_sha256,projection_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, documentId, safeEstimateId, Number(quotationRevision), fileName, "application/pdf", storageKey, bytes.length, documentSha256, projectionSha256, projectionJson, new Date().toISOString());
      return { id: documentId, estimateId: safeEstimateId, quotationRevision: Number(quotationRevision), fileName, mediaType: "application/pdf", storageKey, sizeBytes: bytes.length, sha256: documentSha256, projectionSha256 };
    },
    async get(documentId) {
      const row = await db.get("SELECT * FROM customer_quotation_documents WHERE id=?", documentId);
      return row ? { id: row.id, estimateId: row.estimate_id, quotationRevision: row.quotation_revision, fileName: row.file_name, mediaType: row.media_type, storageKey: row.storage_key, sizeBytes: row.size_bytes, sha256: row.sha256, projectionSha256: row.projection_sha256, projection: JSON.parse(row.projection_json), createdAt: row.created_at } : null;
    },
    async read(documentId) {
      const document = await this.get(documentId);
      if (!document) return null;
      return { document, bytes: await readFile(resolveManagedPath(document.storageKey, attachmentRoot)) };
    },
  };
}
