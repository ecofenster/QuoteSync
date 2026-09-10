import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { ensureManagedParent, resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";
import { renderCustomerLifecyclePdf } from "../customerQuotations/customerLifecycleDocumentRenderer.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const parse = (value, fallback = null) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const clean = (value) => String(value ?? "").trim();
const safeName = (value) => clean(value).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "QuoteSuite";
const fail = (message, status = 422, code = "customer_document_invalid") => Object.assign(new Error(message), { status, code });

export function createCustomerLifecycleDocumentService(db, { attachmentRoot = resolveAttachmentRoot() } = {}) {
  async function get(id) {
    const row = await db.get("SELECT * FROM customer_lifecycle_documents WHERE id=?", id);
    return row ? { id: row.id, kind: row.document_kind, ownerId: row.owner_id, clientId: row.client_id, projectId: row.project_id, orderId: row.order_id, revision: row.revision, fileName: row.file_name, mediaType: row.media_type, storageKey: row.storage_key, sizeBytes: Number(row.size_bytes), sha256: row.sha256, sourceEstimateDocumentId: row.source_estimate_document_id, projectionSha256: row.projection_sha256, projection: parse(row.projection_json, {}), context: parse(row.context_json, {}), createdAt: row.created_at } : null;
  }

  async function read(id) {
    const document = await get(id);
    if (!document) return null;
    return { document, bytes: await readFile(resolveManagedPath(document.storageKey, attachmentRoot)) };
  }

  async function acceptedOrderSource(orderId) {
    const row = await db.get(`SELECT o.*,a.accepted_at,a.id acceptance_id,r.id release_id,r.estimate_id,r.estimate_revision,r.document_id source_estimate_document_id,
      r.customer_projection_json,r.release_sha256,sa.approved_at staff_approved_at
      FROM orders o JOIN portal_estimate_acceptances a ON a.order_id=o.id
      JOIN estimate_revision_releases r ON r.id=a.estimate_release_id
      LEFT JOIN order_staff_approvals sa ON sa.order_id=o.id WHERE o.id=?`, orderId);
    if (!row) throw fail("Accepted Order source evidence was not found.", 404, "accepted_order_source_not_found");
    return row;
  }

  async function persist({ kind, ownerId, orderId, revision, projection, context, source }) {
    const existing = await db.get("SELECT id FROM customer_lifecycle_documents WHERE document_kind=? AND owner_id=? AND revision=?", kind, ownerId, revision);
    if (existing) return get(existing.id);
    const projectionJson = JSON.stringify(projection), contextJson = JSON.stringify(context), projectionSha256 = sha256(`${projectionJson}\n${contextJson}`);
    const id = randomUUID(), bytes = await renderCustomerLifecyclePdf({ kind, projection, context, attachmentRoot }), documentSha = sha256(bytes);
    const title = kind === "order" ? "Order" : "Final-Confirmation";
    const fileName = `${safeName(context.reference)}-${title}-R${safeName(revision)}.pdf`;
    const storageKey = `orders/${safeName(orderId)}/customer-documents/${id}.pdf`;
    const target = await ensureManagedParent(storageKey, attachmentRoot);
    await writeFile(target, bytes, { flag: "wx" });
    await db.run(`INSERT INTO customer_lifecycle_documents(id,document_kind,owner_id,client_id,project_id,order_id,revision,file_name,media_type,storage_key,size_bytes,sha256,source_estimate_document_id,projection_sha256,projection_json,context_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, kind, ownerId, source.client_id, source.project_id, orderId, revision, fileName, "application/pdf", storageKey, bytes.length, documentSha, source.source_estimate_document_id, projectionSha256, projectionJson, contextJson, new Date().toISOString());
    return get(id);
  }

  async function createOrderDocument(orderId, { revision = "customer-accepted" } = {}) {
    const source = await acceptedOrderSource(orderId), projection = parse(source.customer_projection_json, null);
    if (!projection) throw fail("The immutable Estimate projection for this Order is unavailable.", 409, "order_projection_unavailable");
    if (revision === "staff-approved" && !source.staff_approved_at) throw fail("Staff approval is required for the factory Order document.", 409, "order_staff_approval_required");
    const context = { reference: source.order_ref, revision, documentDate: revision === "staff-approved" ? source.staff_approved_at : source.accepted_at, acceptedAt: source.accepted_at, estimateReference: projection.estimateReference, estimateRevision: Number(source.estimate_revision), staffApprovedAt: revision === "staff-approved" ? source.staff_approved_at : null, sourceEstimateReleaseId: source.release_id, sourceEstimateDocumentId: source.source_estimate_document_id };
    return persist({ kind: "order", ownerId: source.id, orderId: source.id, revision, projection, context, source });
  }

  async function createFinalConfirmationDocument(factoryConfirmationId) {
    const confirmation = await db.get(`SELECT fc.*,o.order_ref,o.client_id,o.project_id FROM factory_confirmations fc JOIN orders o ON o.id=fc.order_id WHERE fc.id=?`, factoryConfirmationId);
    if (!confirmation) throw fail("Factory confirmation was not found.", 404, "factory_confirmation_not_found");
    const source = await acceptedOrderSource(confirmation.order_id), projection = parse(source.customer_projection_json, null);
    if (!projection) throw fail("The accepted Estimate projection for this confirmation is unavailable.", 409, "confirmation_projection_unavailable");
    const rows = await db.all("SELECT * FROM factory_confirmation_checks WHERE factory_confirmation_id=? ORDER BY estimate_position_id,field_key", factoryConfirmationId);
    const positionChecks = rows.map((row) => ({ estimatePositionId: row.estimate_position_id, fieldKey: row.field_key, approvedValue: row.approved_value, confirmedValue: row.confirmed_value, status: row.status, approvedSourceReference: row.approved_source_reference, confirmationSourceReference: row.confirmation_source_reference, resolutionNote: row.resolution_note }));
    const context = { reference: confirmation.order_ref, revision: confirmation.revision, documentDate: confirmation.created_at, estimateReference: projection.estimateReference, estimateRevision: Number(source.estimate_revision), factoryConfirmationId, factorySourceDocumentId: confirmation.canonical_document_id, positionChecks };
    return persist({ kind: "final_confirmation", ownerId: confirmation.id, orderId: confirmation.order_id, revision: confirmation.revision, projection, context, source });
  }

  return { get, read, createOrderDocument, createFinalConfirmationDocument };
}
