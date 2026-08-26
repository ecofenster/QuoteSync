import { createHash, randomUUID } from "node:crypto";
import { createCustomerQuotationDocumentService } from "./customerQuotationDocumentService.js";
import { createCommunicationsService } from "../communications/communicationsService.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const parse = (value, fallback = null) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const plusDays = (value, days) => { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const requiredText = (value, label) => { const text = String(value || "").trim(); if (!text) throw Object.assign(new Error(`${label} is required.`), { status: 400 }); return text; };

export function createIssuedQuotationService(db, options = {}) {
  const documents = createCustomerQuotationDocumentService(db, options), communications = createCommunicationsService(db, options);

  async function mapIssued(row) {
    if (!row) return null;
    const document = await documents.get(row.document_id), communication = row.communication_message_id ? await communications.repository.get(row.communication_message_id) : null;
    return { id: row.id, status: row.status, clientId: row.client_id, estimateId: row.estimate_id, estimateRevision: row.estimate_revision, quotationRevision: row.quotation_revision, recipient: row.recipient, subject: row.subject, provider: row.provider, providerMessageId: row.provider_message_id, communicationMessageId: row.communication_message_id, preparedAt: row.prepared_at, issuedAt: row.issued_at, failedAt: row.failed_at, failureReason: row.failure_reason, commercialSnapshot: parse(row.commercial_snapshot_json, {}), termsSnapshot: row.terms_snapshot, document: document ? { ...document, downloadUrl: `/api/quotation-workflow/issued/${row.id}/document` } : null, communication };
  }
  async function get(id) { return mapIssued(await db.get("SELECT * FROM issued_quotations WHERE id=?", id)); }

  async function prepare(input) {
    const estimateId = requiredText(input.estimateId, "Estimate ID"), clientId = requiredText(input.clientId, "Client ID"), recipient = requiredText(input.recipient, "Recipient"), projection = input.projection;
    const aggregate = await db.get(`SELECT e.id,e.client_id,e.estimate_ref,e.revision_no,c.name client_name,c.email FROM estimates e JOIN clients c ON c.id=e.client_id WHERE e.id=? AND e.client_id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL`, estimateId, clientId);
    if (!aggregate) throw Object.assign(new Error("Active Client and Estimate relationship was not found."), { status: 404 });
    const estimateRevision = Number(input.estimateRevision), quotationRevision = Number(input.quotationRevision);
    if (!Number.isInteger(estimateRevision) || estimateRevision !== Number(aggregate.revision_no)) throw Object.assign(new Error("Estimate revision changed; review the current quotation before sending."), { status: 409, code: "estimate_revision_changed" });
    if (!Number.isInteger(quotationRevision) || Number(projection?.commercialRevision) !== quotationRevision || String(projection?.estimateReference) !== String(aggregate.estimate_ref)) throw Object.assign(new Error("Canonical quotation revision/reference does not match the Estimate."), { status: 409, code: "quotation_revision_changed" });
    const subject = requiredText(input.subject || `Quotation ${aggregate.estimate_ref} from Ecofenster`, "Subject"), total = String(projection.totalIncVatGbp), bodyHtml = String(input.bodyHtml || `<p>Dear ${aggregate.client_name},</p><p>Please find attached quotation <strong>${aggregate.estimate_ref}</strong> for your review.</p><p><strong>Total including VAT: GBP ${Number(total).toFixed(2)}</strong></p><p>Please contact us if you would like to discuss the quotation.</p><p>Kind regards,<br>Ecofenster</p>`);
    const commercialSnapshot = { subtotalExVatGbp: String(projection.subtotalExVatGbp), vatRatePercent: String(projection.vatRatePercent), vatGbp: String(projection.vatGbp), totalIncVatGbp: total };
    const idempotencyKey = hash(JSON.stringify({ estimateId, estimateRevision, quotationRevision, projection, recipient, termsSnapshot: input.termsSnapshot ?? null }));
    const existing = await db.get("SELECT * FROM issued_quotations WHERE idempotency_key=?", idempotencyKey); if (existing) return mapIssued(existing);
    const document = await documents.createImmutablePdf({ estimateId, quotationRevision, projection }), issuedQuotationId = randomUUID(), communicationMessageId = randomUUID(), timestamp = new Date().toISOString();
    const communication = await communications.repository.save({ id: communicationMessageId, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "drafts", status: "draft", from: [], to: [recipient], cc: [], bcc: [], subject, bodyHtml, bodyText: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), links: [{ kind: "client", id: clientId }, { kind: "estimate", id: estimateId }, { kind: "issued_quotation", id: issuedQuotationId }], attachments: [{ id: randomUUID(), fileName: document.fileName, mediaType: document.mediaType, sizeBytes: document.sizeBytes, storageKey: document.storageKey, sha256: document.sha256 }] });
    await db.run(`INSERT INTO issued_quotations(id,idempotency_key,client_id,estimate_id,estimate_revision,quotation_revision,document_id,status,recipient,subject,provider,provider_message_id,communication_message_id,prepared_at,issued_at,failed_at,failure_reason,commercial_snapshot_json,terms_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, issuedQuotationId, idempotencyKey, clientId, estimateId, estimateRevision, quotationRevision, document.id, "prepared_not_sent", recipient, subject, null, null, communication.id, timestamp, null, null, null, JSON.stringify(commercialSnapshot), input.termsSnapshot ?? null, timestamp, timestamp);
    return get(issuedQuotationId);
  }

  async function finalize(row, communication) {
    const issuedAt = communication.sentAt || new Date().toISOString(), eventId = `quotation-issued-${row.id}`, followUpId = `quotation-followup-${row.id}`;
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run("UPDATE issued_quotations SET status='issued',provider='google_workspace',provider_message_id=?,communication_message_id=?,issued_at=?,failed_at=NULL,failure_reason=NULL,updated_at=? WHERE id=? AND status<>'issued'", communication.providerMessageId, communication.id, issuedAt, issuedAt, row.id);
      await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING`, eventId, "quotation.issued", row.id, issuedAt, JSON.stringify([{ kind: "client", id: row.client_id }, { kind: "estimate", id: row.estimate_id }, { kind: "issued_quotation", id: row.id }]), issuedAt);
      await db.run(`INSERT INTO followups(id,client_id,estimate_id,title,notes,due_at,status,issued_quotation_id,communication_message_id,origin_event_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, followUpId, row.client_id, row.estimate_id, `Follow up: ${row.subject}`, "Call / email customer regarding issued quotation", plusDays(issuedAt, 3), "pending", row.id, communication.id, eventId, issuedAt, issuedAt);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return get(row.id);
  }

  async function send(id, overrides = {}) {
    const row = await db.get("SELECT * FROM issued_quotations WHERE id=?", id); if (!row) throw Object.assign(new Error("Issued quotation preparation was not found."), { status: 404 });
    if (row.status === "issued") return mapIssued(row);
    const existingCommunication = await communications.repository.get(row.communication_message_id);
    if (existingCommunication?.status === "sent" && existingCommunication.providerMessageId) return finalize(row, existingCommunication);
    const document = await documents.get(row.document_id), recipient = requiredText(overrides.recipient ?? row.recipient, "Recipient"), subject = requiredText(overrides.subject ?? row.subject, "Subject"), bodyHtml = requiredText(overrides.bodyHtml ?? existingCommunication?.bodyHtml, "Email body");
    try {
      const communication = await communications.sendMessage({ ...existingCommunication, id: row.communication_message_id, to: [recipient], subject, bodyHtml, bodyText: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), folder: "sent", links: existingCommunication.links, attachments: [{ ...(existingCommunication.attachments?.[0] || {}), fileName: document.fileName, mediaType: document.mediaType, sizeBytes: document.sizeBytes, storageKey: document.storageKey, sha256: document.sha256 }] });
      await db.run("UPDATE issued_quotations SET recipient=?,subject=?,updated_at=? WHERE id=?", recipient, subject, new Date().toISOString(), id);
      return finalize({ ...row, recipient, subject }, communication);
    } catch (error) {
      const failedAt = new Date().toISOString(), reason = error instanceof Error ? error.message : "Provider send failed.";
      await db.run("UPDATE issued_quotations SET status='failed',provider='google_workspace',failed_at=?,failure_reason=?,updated_at=? WHERE id=? AND status<>'issued'", failedAt, reason, failedAt, id);
      throw Object.assign(new Error(reason), { status: Number(error?.status) || 502, issuedQuotationId: id });
    }
  }

  async function estimateState(estimateId) {
    const issue = await db.get("SELECT * FROM issued_quotations WHERE estimate_id=? ORDER BY created_at DESC LIMIT 1", estimateId);
    const followUp = issue ? await db.get("SELECT * FROM followups WHERE issued_quotation_id=? ORDER BY created_at DESC LIMIT 1", issue.id) : null;
    const productCount = (await db.get(`SELECT COUNT(*) count FROM project_calculator_lab_scenarios s JOIN project_calculator_estimate_product_rows p ON p.scenario_id=s.id WHERE s.estimate_id=?`, estimateId))?.count ?? 0;
    return { estimateId, manufacturerQuoteImported: productCount > 0, costingReady: productCount > 0, quotationReviewed: Boolean(issue), quotationPrepared: issue?.status === "prepared_not_sent" || issue?.status === "failed", quotationStatus: issue?.status ?? null, quotationIssued: issue?.status === "issued", issuedQuotationId: issue?.id ?? null, followUpDue: followUp?.status !== "done" && Boolean(followUp?.due_at), followUpDueDate: followUp?.due_at ?? null, followUpCompleted: followUp?.status === "done", followUpId: followUp?.id ?? null, customerAccepted: false, orderCreated: false };
  }
  return { prepare, get, send, estimateState, documents, communications };
}
