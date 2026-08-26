import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveManagedPath, resolveAttachmentRoot } from "../supplierQuotes/managedAttachmentStorage.js";
import { createCommunicationRepository } from "./communicationRepository.js";
import { createGmailProvider } from "./gmailProvider.js";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";

const decodeAttachment = (attachment, attachmentRoot) => {
  if (attachment.bytes) return Promise.resolve({ ...attachment, bytes: Buffer.from(attachment.bytes) });
  if (attachment.contentBase64) return Promise.resolve({ ...attachment, bytes: Buffer.from(attachment.contentBase64, "base64") });
  if (attachment.storageKey) return readFile(resolveManagedPath(attachment.storageKey, attachmentRoot)).then((bytes) => ({ ...attachment, bytes }));
  throw Object.assign(new Error(`Attachment ${attachment.fileName || "file"} has no content.`), { status: 400 });
};

export function preserveCommunicationLinks(existing, providerMessage) {
  return Array.isArray(existing?.links) ? existing.links : Array.isArray(providerMessage?.links) ? providerMessage.links : [];
}

const uniqueSuggestions = (suggestions) => [...new Map(suggestions.map((item) => [`${item.kind}:${item.id}`, item])).values()];

export async function findRelationshipSuggestions(db, message) {
  const text = `${message.subject}\n${message.bodyText}`, suggestions = [];
  const emails = [...new Set(message.from.map((value) => (String(value).match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase()).filter(Boolean))];
  if (emails.length) {
    const clients = await db.all(`SELECT id,name,email FROM clients WHERE deleted_at IS NULL AND lower(email) IN (${emails.map(() => "?").join(",")})`, ...emails);
    for (const client of clients) suggestions.push({ kind: "client", id: client.id, label: client.name, evidence: `Exact contact email: ${client.email}`, autoLinkAllowed: false });
  }
  const estimateReferences = [...new Set(text.match(/\bEF-EST-\d{4}-\d+\b/gi) || [])];
  if (estimateReferences.length) {
    const estimates = await db.all(`SELECT id,estimate_ref,outcome FROM estimates WHERE deleted_at IS NULL AND upper(estimate_ref) IN (${estimateReferences.map(() => "?").join(",")})`, ...estimateReferences.map((value) => value.toUpperCase()));
    for (const estimate of estimates) {
      suggestions.push({ kind: "estimate", id: estimate.id, label: estimate.estimate_ref, evidence: "Exact Estimate reference", autoLinkAllowed: false });
      if (estimate.outcome === "Order") suggestions.push({ kind: "order", id: estimate.id, label: estimate.estimate_ref, evidence: "Exact reference for an Estimate promoted to Order", autoLinkAllowed: false });
    }
  }
  const supplierReferences = [...new Set(text.match(/\b\d{5,}-\d+\b/g) || [])];
  if (supplierReferences.length) {
    const placeholders = supplierReferences.map(() => "?").join(",");
    const revisions = await db.all(`SELECT r.id,r.full_quotation_reference,q.supplier_code,q.supplier_name,d.supplier_code canonical_supplier_code,d.supplier_name canonical_supplier_name FROM supplier_quote_revisions r JOIN supplier_quotes q ON q.id=r.supplier_quote_id LEFT JOIN supplier_commercial_defaults d ON d.supplier_code=q.supplier_code AND d.active<>0 WHERE r.full_quotation_reference IN (${placeholders}) AND q.archived_at IS NULL`, ...supplierReferences).catch(() => []);
    for (const revision of revisions) {
      suggestions.push({ kind: "supplier_quotation", id: revision.id, label: `${revision.supplier_name} · ${revision.full_quotation_reference}`, evidence: "Exact supplier quotation reference", autoLinkAllowed: false });
      if (revision.canonical_supplier_code) suggestions.push({ kind: "supplier", id: revision.canonical_supplier_code, label: revision.canonical_supplier_name, evidence: "Canonical supplier on the exact quotation reference", autoLinkAllowed: false });
    }
  }
  return uniqueSuggestions(suggestions);
}

export async function resolveCanonicalRelationship(db, kind, id) {
  if (kind === "client") return db.get("SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", id);
  if (kind === "estimate") return db.get("SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL", id);
  if (kind === "order") return db.get("SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL AND outcome='Order'", id);
  if (kind === "supplier") return db.get("SELECT supplier_code id FROM supplier_commercial_defaults WHERE supplier_code=? AND active<>0", id);
  if (kind === "supplier_quotation") return db.get("SELECT r.id FROM supplier_quote_revisions r JOIN supplier_quotes q ON q.id=r.supplier_quote_id JOIN estimates e ON e.id=r.estimate_id WHERE r.id=? AND q.archived_at IS NULL AND e.deleted_at IS NULL", id);
  throw Object.assign(new Error("Unsupported canonical communication relationship."), { status: 400, code: "unsupported_communication_link" });
}

export function createCommunicationsService(db, options = {}) {
  const repository = createCommunicationRepository(db), workspace = createGoogleWorkspaceService(db, options), gmail = createGmailProvider(workspace, options.gmailOptions), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment);
  async function requireGmailCapability() {
    const status = await workspace.status();
    if (!status.connected) throw Object.assign(new Error("Google Workspace is not connected."), { status: 409, code: "provider_disconnected" });
    if (!status.capabilities.gmail.available) throw Object.assign(new Error("Reconnect Google Workspace and grant the required Gmail permissions."), { status: 409, code: "gmail_scope_required" });
  }

  async function persistProviderMessage(message) {
    const existing = message.providerMessageId ? await repository.findByProviderId("google_workspace", message.providerMessageId) : null;
    const saved = await repository.save({ ...message, id: existing?.id ?? randomUUID(), links: preserveCommunicationLinks(existing, message), mailboxId: "me", attachments: (message.attachments || []).map((attachment) => ({ ...attachment, id: `${existing?.id ?? message.providerMessageId}_${attachment.providerAttachmentId || attachment.id}` })) });
    return { ...saved, ...message, id: saved.id, links: saved.links, attachments: (message.attachments || []).map((attachment) => ({ ...attachment, id: `${saved.id}_${attachment.providerAttachmentId || attachment.id}` })) };
  }

  async function listMailbox(input) {
    if (String(input.folder || "").startsWith("quotesuite:")) {
      const view = String(input.folder).slice(11), all = await repository.list({ limit: 500 });
      const kinds = { clients: "client", estimates: "estimate", orders: "order", suppliers: "supplier" };
      const messages = view === "unlinked" ? all.filter((message) => !message.links.length) : view === "follow_up" ? all.filter((message) => message.links.some((link) => link.kind === "follow_up")) : all.filter((message) => message.links.some((link) => link.kind === kinds[view]));
      return { messages: messages.slice(0, 100).map((message) => ({ ...message, snippet: message.bodyText, unread: false, starred: false, important: false, labels: [], threadCount: 1 })), nextPageToken: null };
    }
    await requireGmailCapability();
    const result = await gmail.list(input);
    const messages = await Promise.all(result.messages.map(async (thread) => {
      const threadMessages = await Promise.all((thread.threadMessages || [thread]).map(persistProviderMessage)), latest = threadMessages.at(-1);
      return { ...latest, ...thread, id: latest.id, threadMessages, threadCount: threadMessages.length };
    }));
    return { ...result, messages };
  }

  async function readMessage(providerMessageId) { await requireGmailCapability(); return persistProviderMessage(await gmail.readMessage(providerMessageId)); }
  async function readThread(providerThreadId) {
    await requireGmailCapability();
    const thread = await gmail.readThread(providerThreadId), messages = await Promise.all(thread.threadMessages.map(persistProviderMessage)), latest = messages.at(-1);
    return { ...latest, ...thread, id: latest.id, threadMessages: messages, threadCount: messages.length };
  }
  async function mailbox() {
    await requireGmailCapability();
    return { provider: "google_workspace", labels: await gmail.labels(), capabilities: ["archive","trash","read_state","star","move","labels"].map((id) => ({ id, available: true })) };
  }
  async function command(input) {
    await requireGmailCapability();
    const threadIds = [...new Set((input.threadIds || []).map((id) => String(id).trim()).filter(Boolean))];
    if (!threadIds.length) throw Object.assign(new Error("Select at least one conversation."), { status: 400 });
    return gmail.command({ threadIds, command: String(input.command || ""), labelId: input.labelId ? String(input.labelId) : undefined });
  }
  async function relationshipContext(providerMessageId) {
    await requireGmailCapability();
    const message = await readMessage(providerMessageId);
    return { links: message.links || [], suggestions: await findRelationshipSuggestions(db, message) };
  }
  async function linkRelationship(providerMessageId, input) {
    await requireGmailCapability();
    const message = await readMessage(providerMessageId), kind = String(input.kind || "").trim(), id = String(input.id || "").trim();
    if (!id) throw Object.assign(new Error("Choose a canonical relationship before linking."), { status: 400, code: "invalid_communication_link" });
    const target = await resolveCanonicalRelationship(db, kind, id);
    if (!target) throw Object.assign(new Error("The selected canonical relationship is unavailable."), { status: 404, code: "communication_link_target_not_found" });
    const updated = await repository.addLink(message.id, { kind, id });
    return { links: updated.links, suggestions: await findRelationshipSuggestions(db, message) };
  }

  async function createDraft(input) {
    await requireGmailCapability();
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot)));
    const localId = String(input.id || randomUUID()), provider = await gmail.createDraft({ ...input, attachments });
    return repository.save({ ...input, id: localId, provider: "google_workspace", providerMessageId: provider.providerMessageId, threadId: provider.threadId, mailboxId: "me", direction: "outbound", folder: "drafts", status: "draft", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
  }

  async function sendMessage(input) {
    await requireGmailCapability();
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot))), id = String(input.id || randomUUID());
    await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "sending", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    try {
      const sent = await gmail.send({ ...input, attachments });
      return repository.save({ ...input, id, provider: "google_workspace", providerMessageId: sent.providerMessageId, threadId: sent.threadId, mailboxId: "me", direction: "outbound", folder: "sent", status: "sent", sentAt: new Date().toISOString(), attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    } catch (error) {
      await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "failed", error: error instanceof Error ? error.message : "Provider send failed.", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
      throw error;
    }
  }

  async function reply(input) {
    const original = await readMessage(input.providerMessageId);
    return sendMessage({ ...input, threadId: original.threadId, to: input.to?.length ? input.to : original.from, subject: /^re:/i.test(input.subject || "") ? input.subject : `Re: ${input.subject || original.subject}`, inReplyTo: original.providerMessageId, references: original.providerMessageId, inReplyToProviderMessageId: original.providerMessageId });
  }

  async function forward(input) {
    const original = await readMessage(input.providerMessageId);
    const forwarded = `<hr><p><strong>Forwarded message</strong></p><p>From: ${original.from.join(", ")}<br>Subject: ${original.subject}</p>${original.bodyHtml || `<pre>${original.bodyText}</pre>`}`;
    return sendMessage({ ...input, subject: /^fwd:/i.test(input.subject || "") ? input.subject : `Fwd: ${input.subject || original.subject}`, bodyHtml: `${input.bodyHtml || ""}${forwarded}` });
  }

  async function readAttachment(providerMessageId, attachmentId) { await requireGmailCapability(); return gmail.attachment(providerMessageId, attachmentId); }
  return { status: workspace.status, mailbox, listMailbox, readMessage, readThread, relationshipContext, linkRelationship, command, createDraft, sendMessage, reply, forward, readAttachment, repository };
}
