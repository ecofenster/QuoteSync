import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveManagedPath, resolveAttachmentRoot } from "../supplierQuotes/managedAttachmentStorage.js";
import { createCommunicationRepository } from "./communicationRepository.js";
import { createCommercialIdentityService } from "../commercialIdentity/commercialIdentityService.js";
import { createCommercialDriveService } from "../documents/commercialDriveService.js";
import { createGmailProvider } from "./gmailProvider.js";
import { createGoogleWorkspaceService, GMAIL_MODIFY_SCOPE } from "../integrations/googleWorkspaceService.js";
import { classifyNotification, decodeGmailNotification, resolveNotificationConfiguration, resolveWatchLifecycle } from "./communicationLiveSync.js";
import { createTestDeliveryPolicy } from "../lifecycle/testDeliveryPolicy.js";
import { createSupplierQuotesService } from "../supplierQuotes/supplierQuotesService.js";
import { recordSupplierResponseState } from "../lifecycle/supplierResponseState.js";
import {factoryManifest,verifyFactoryReceipt} from './factoryReceipt.js';

const MUTATING_MAILBOX_CAPABILITIES = Object.freeze(["archive", "trash", "read_state", "star", "move", "labels"]);
const COMMAND_CAPABILITIES = Object.freeze({ archive: "archive", trash: "trash", mark_read: "read_state", mark_unread: "read_state", star: "star", unstar: "star", move: "move", label: "labels" });

export function resolveMailboxCapabilities(workspaceStatus) {
  const granted = new Set(workspaceStatus?.scopes || []);
  const canModify = Boolean(workspaceStatus?.connected) && granted.has(GMAIL_MODIFY_SCOPE);
  return MUTATING_MAILBOX_CAPABILITIES.map((id) => ({ id, available: canModify }));
}

export async function decodeCommunicationAttachment(attachment, attachmentRoot, workspace) {
  let bytes;
  if (attachment.bytes) bytes = Buffer.from(attachment.bytes);
  else if (attachment.contentBase64) bytes = Buffer.from(attachment.contentBase64, "base64");
  else if (attachment.storageKey) bytes = await readFile(resolveManagedPath(attachment.storageKey, attachmentRoot));
  else if (attachment.driveFileId) {
    const response = await workspace.googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(attachment.driveFileId)}?alt=media&supportsAllDrives=true`);
    if (!response.ok) throw Object.assign(new Error(`Attachment ${attachment.fileName || "file"} could not be read from connected storage.`), { status: response.status >= 500 ? 502 : response.status, code: "provider_attachment_unavailable" });
    bytes = Buffer.from(await response.arrayBuffer());
  } else throw Object.assign(new Error(`Attachment ${attachment.fileName || "file"} has no content.`), { status: 400 });
  const expected = String(attachment.sha256 || '').trim().toLowerCase();
  // Legacy canonical Drive records passed their MD5 checksum in this field.
  // Verify that evidence using its actual algorithm, then retain a SHA-256.
  if (expected) {
    const algorithm = /^[a-f0-9]{64}$/.test(expected) ? 'sha256' : /^[a-f0-9]{32}$/.test(expected) ? 'md5' : null;
    if (!algorithm || createHash(algorithm).update(bytes).digest('hex') !== expected) throw Object.assign(new Error(`Attachment ${attachment.fileName || 'file'} no longer matches the reviewed document. Nothing was sent. Reopen the document and review its current version before preparing the email again.`), { status: 409, code: 'communication_attachment_changed' });
  }
  return { ...attachment, bytes, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const decodeAttachment = decodeCommunicationAttachment;

export function preserveCommunicationLinks(existing, providerMessage) {
  return Array.isArray(existing?.links) ? existing.links : Array.isArray(providerMessage?.links) ? providerMessage.links : [];
}

export function communicationAttachmentRecordId(messageId, attachment, index) {
  const sourceIdentity = attachment.sourcePartId
    ? `part:${attachment.sourcePartId}`
    : `ordinal:${index}|content:${attachment.contentId || ""}|name:${attachment.fileName || ""}|type:${attachment.mediaType || ""}`;
  const digest = createHash("sha256").update(sourceIdentity).digest("hex").slice(0, 24);
  return `${messageId}_attachment_${digest}`;
}

const uniqueSuggestions = (suggestions) => [...new Map(suggestions.map((item) => [`${item.kind}:${item.id}`, item])).values()];

export async function findRelationshipSuggestions(db, message) {
  const text = `${message.subject}\n${message.bodyText}`, suggestions = [];
  const emails = [...new Set(message.from.map((value) => (String(value).match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase()).filter(Boolean))];
  if (emails.length) {
    const clients = await db.all(`SELECT id,name,email FROM clients WHERE deleted_at IS NULL AND lower(email) IN (${emails.map(() => "?").join(",")})`, ...emails);
    for (const client of clients) suggestions.push({ kind: "client", id: client.id, label: client.name, evidence: `Exact contact email: ${client.email}`, autoLinkAllowed: false });
    if (clients.length === 1) {
      const projects = await db.all("SELECT id,name FROM projects WHERE client_id=? AND deleted_at IS NULL ORDER BY name,id", clients[0].id).catch(() => []);
      if (projects.length === 1) suggestions.push({ kind: "project", id: projects[0].id, label: projects[0].name, evidence: "Only active Project for the exact Client email match; explicit confirmation still required", autoLinkAllowed: false });
    }
    const enquiries = await db.all(`SELECT id,enquiry_ref,display_name,email FROM enquiries WHERE deleted_at IS NULL AND status='new' AND lower(email) IN (${emails.map(() => "?").join(",")})`, ...emails).catch(() => []);
    for (const enquiry of enquiries) suggestions.push({ kind: "enquiry", id: enquiry.id, label: `${enquiry.enquiry_ref} · ${enquiry.display_name}`, evidence: `Exact Enquiry contact email: ${enquiry.email}`, autoLinkAllowed: false });
  }
  const clientReferences = [...new Set(text.match(/\bEF-CL-\d{3}\b/gi) || [])];
  if (clientReferences.length) {
    const clients = await db.all(`SELECT id,client_ref,name FROM clients WHERE deleted_at IS NULL AND upper(client_ref) IN (${clientReferences.map(() => "?").join(",")})`, ...clientReferences.map((value) => value.toUpperCase())).catch(() => []);
    for (const client of clients) {
      suggestions.push({ kind: "client", id: client.id, label: `${client.client_ref} · ${client.name}`, evidence: "Exact Client reference", autoLinkAllowed: false });
      const projects = await db.all("SELECT id,name FROM projects WHERE client_id=? AND deleted_at IS NULL ORDER BY context_year DESC,name,id", client.id).catch(() => []);
      for (const project of projects) suggestions.push({ kind: "project", id: project.id, label: project.name, evidence: `Canonical Project for exact Client reference ${client.client_ref}; selection required`, autoLinkAllowed: false });
      const estimates = await db.all("SELECT e.id,e.estimate_ref,e.project_id FROM estimates e JOIN projects p ON p.id=e.project_id WHERE p.client_id=? AND e.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY e.created_at DESC,e.id", client.id).catch(() => []);
      for (const estimate of estimates) suggestions.push({ kind: "estimate", id: estimate.id, label: estimate.estimate_ref, evidence: `Canonical Estimate for exact Client reference ${client.client_ref}; selection required`, autoLinkAllowed: false });
    }
  }
  const enquiryReferences = [...new Set(text.match(/\bEF-ENQ-\d{3}\b/gi) || [])];
  if (enquiryReferences.length) {
    const enquiries = await db.all(`SELECT id,enquiry_ref,display_name FROM enquiries WHERE deleted_at IS NULL AND upper(enquiry_ref) IN (${enquiryReferences.map(() => "?").join(",")})`, ...enquiryReferences.map((value) => value.toUpperCase())).catch(() => []);
    for (const enquiry of enquiries) suggestions.push({ kind: "enquiry", id: enquiry.id, label: `${enquiry.enquiry_ref} · ${enquiry.display_name}`, evidence: "Exact Enquiry reference", autoLinkAllowed: false });
  }
  const estimateReferences = [...new Set(text.match(/\bEF-EST-\d{4}-\d+\b/gi) || [])];
  if (estimateReferences.length) {
    const estimateParams = estimateReferences.map((value) => value.toUpperCase());
    const estimates = await db.all(`SELECT id,project_id,estimate_ref,outcome FROM estimates WHERE deleted_at IS NULL AND upper(estimate_ref) IN (${estimateReferences.map(() => "?").join(",")})`, ...estimateParams)
      .catch(async () => (await db.all(`SELECT id,estimate_ref,outcome FROM estimates WHERE deleted_at IS NULL AND upper(estimate_ref) IN (${estimateReferences.map(() => "?").join(",")})`, ...estimateParams)).map((row) => ({ ...row, project_id: null })));
    for (const estimate of estimates) {
      suggestions.push({ kind: "estimate", id: estimate.id, label: estimate.estimate_ref, evidence: "Exact Estimate reference", autoLinkAllowed: false });
      if (estimate.project_id) suggestions.push({ kind: "project", id: estimate.project_id, label: estimate.estimate_ref, evidence: "Canonical Project owning the exact Estimate reference", autoLinkAllowed: false });
      if (estimate.outcome === "Order") suggestions.push({ kind: "order", id: estimate.id, label: estimate.estimate_ref, evidence: "Exact reference for an Estimate promoted to Order", autoLinkAllowed: false });
    }
  }
  const orderReferences = [...new Set(text.match(/\bEF-ORD-\d{4}-\d{3}\b/gi) || [])];
  if (orderReferences.length) {
    const orders = await db.all(`SELECT id,order_ref FROM orders WHERE upper(order_ref) IN (${orderReferences.map(() => "?").join(",")})`, ...orderReferences.map((value) => value.toUpperCase())).catch(() => []);
    for (const order of orders) suggestions.push({ kind: "order", id: order.id, label: order.order_ref, evidence: "Exact Order reference", autoLinkAllowed: false });
  }
  const supplierReferences = [...new Set(text.match(/\b\d{5,}-\d+\b/g) || [])];
  if (supplierReferences.length) {
    const placeholders = supplierReferences.map(() => "?").join(",");
    const revisions = await db.all(`SELECT r.id,r.full_quotation_reference,q.supplier_code,q.supplier_name,d.supplier_code canonical_supplier_code,d.supplier_name canonical_supplier_name FROM supplier_quote_revisions r JOIN supplier_quotes q ON q.id=r.supplier_quote_id LEFT JOIN supplier_commercial_defaults d ON d.supplier_code=q.supplier_code AND NOT (upper(trim(d.supplier_name))='ANY' AND upper(trim(d.supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT')) WHERE r.full_quotation_reference IN (${placeholders}) AND q.archived_at IS NULL`, ...supplierReferences).catch(() => []);
    for (const revision of revisions) {
      suggestions.push({ kind: "supplier_quotation", id: revision.id, label: `${revision.supplier_name} · ${revision.full_quotation_reference}`, evidence: "Exact supplier quotation reference", autoLinkAllowed: false });
      if (revision.canonical_supplier_code) suggestions.push({ kind: "supplier", id: revision.canonical_supplier_code, label: revision.canonical_supplier_name, evidence: "Canonical supplier on the exact quotation reference", autoLinkAllowed: false });
    }
  }
  return uniqueSuggestions(suggestions);
}

export async function resolveCanonicalRelationship(db, kind, id) {
  if (kind === "enquiry") return db.get("SELECT id FROM enquiries WHERE id=? AND deleted_at IS NULL", id);
  if (kind === "client") return db.get("SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", id);
  if (kind === "project") return db.get("SELECT id FROM projects WHERE id=? AND deleted_at IS NULL", id);
  if (kind === "estimate") return db.get("SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL", id);
  if (kind === "order") {
    const order = await db.get("SELECT id FROM orders WHERE id=?", id).catch(() => null);
    return order || db.get("SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL AND outcome='Order'", id);
  }
  if (kind === "supplier") return db.get("SELECT supplier_code id FROM supplier_commercial_defaults WHERE supplier_code=? AND NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT'))", id);
  if (kind === "supplier_quotation") return db.get("SELECT r.id FROM supplier_quote_revisions r JOIN supplier_quotes q ON q.id=r.supplier_quote_id JOIN estimates e ON e.id=r.estimate_id WHERE r.id=? AND q.archived_at IS NULL AND e.deleted_at IS NULL", id);
  throw Object.assign(new Error("Unsupported canonical communication relationship."), { status: 400, code: "unsupported_communication_link" });
}

export function createCommunicationsService(db, options = {}) {
  const repository = createCommunicationRepository(db), workspace = options.workspace || createGoogleWorkspaceService(db, options), gmail = options.gmail || createGmailProvider(workspace, options.gmailOptions), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment), notificationConfig = options.notificationConfig || resolveNotificationConfiguration(options.environment), deliveryPolicy = options.deliveryPolicy || createTestDeliveryPolicy(options.environment);
  const guardTestRecipients = (input) => deliveryPolicy.assertAllRecipients?.([...(input.to || []), ...(input.cc || []), ...(input.bcc || [])]);
  async function requireGmailCapability() {
    const status = await workspace.status();
    if (status.state === "reconnect_required") throw Object.assign(new Error("Reconnect Google Workspace to grant the required Gmail permissions."), { status: 409, code: "gmail_scope_required" });
    if (!status.connected) throw Object.assign(new Error("Google Workspace is not connected."), { status: 409, code: "provider_disconnected" });
    if (!status.capabilities.gmail.available) throw Object.assign(new Error("Reconnect Google Workspace and grant the required Gmail permissions."), { status: 409, code: "gmail_scope_required" });
    return status;
  }

  async function persistProviderMessage(message) {
    const existing = message.providerMessageId ? await repository.findByProviderId("google_workspace", message.providerMessageId) : null;
    const messageId = existing?.id ?? randomUUID();
    const providerAttachments = (message.attachments || []).map((attachment, index) => ({ ...attachment, id: communicationAttachmentRecordId(messageId, attachment, index) }));
    const saved = await repository.save({ ...message, id: messageId, links: preserveCommunicationLinks(existing, message), mailboxId: "me", attachments: providerAttachments });
    const savedById = new Map(saved.attachments.map((attachment) => [attachment.id, attachment]));
    return {
      ...saved,
      ...message,
      id: saved.id,
      links: saved.links,
      // Gmail's opaque providerAttachmentId changes across full-message reads.
      // The canonical ID is instead derived from the exact message and MIME part,
      // while the refreshed provider ID is retained only for the subsequent GET.
      attachments: providerAttachments.map((attachment) => ({ ...attachment, ...savedById.get(attachment.id), id: attachment.id, providerAttachmentId: attachment.providerAttachmentId })),
    };
  }

  const parseCacheOffset = (token) => String(token || "").startsWith("cache:") ? Math.max(0, Number(String(token).slice(6)) || 0) : 0;

  async function listCachedMailbox(input) {
    if (String(input.folder || "").startsWith("quotesuite:")) {
      const view = String(input.folder).slice(11), all = await repository.listSummaries({ limit: 500 });
      const kinds = { enquiries: "enquiry", clients: "client", projects: "project", estimates: "estimate", orders: "order", suppliers: "supplier" };
      const messages = view === "unlinked" ? all.filter((message) => !message.links.length) : view === "follow_up" ? all.filter((message) => message.links.some((link) => link.kind === "follow_up")) : all.filter((message) => message.links.some((link) => link.kind === kinds[view]));
      return { messages: messages.slice(0, 100).map((message) => ({ ...message, snippet: message.bodyText, unread: false, starred: false, important: false, labels: [], threadCount: 1 })), nextPageToken: null, source: "cache" };
    }
    const cached = await repository.listMailbox({ folder: input.folder, query: input.query, offset: parseCacheOffset(input.pageToken), limit: options.gmailOptions?.pageSize || 30 });
    return { ...cached, source: "cache" };
  }

  async function persistThreads(threads) {
    for (const thread of threads) for (const message of thread.threadMessages || [thread]) await persistProviderMessage(message);
  }

  async function bumpProjection(accountId, input = {}) {
    const current = await repository.getWatchState("google_workspace", accountId);
    return repository.saveWatchState("google_workspace", accountId, { mode: notificationConfig.mode, status: current?.status || "unregistered", projectionVersion: Number(current?.projection_version || 0) + 1, ...input });
  }

  async function reconcileHistory(accountId, startHistoryId) {
    const delta = await gmail.listHistory({ startHistoryId });
    await repository.markProviderRemoved("google_workspace", delta.deletedMessageIds);
    const changed = [];
    for (const threadId of delta.changedThreadIds) {
      try { changed.push(await gmail.readThread(threadId)); }
      catch (error) { if (error?.status !== 404) throw error; }
    }
    await persistThreads(changed);
    const historyId = delta.historyId || await gmail.currentHistoryId(), reconciledAt = new Date().toISOString();
    await repository.saveSyncState("google_workspace", accountId, "__account__", { status: "synced", cursor: historyId, lastAttemptAt: reconciledAt, lastSuccessAt: reconciledAt, error: null });
    await bumpProjection(accountId, { lastReconciledHistoryId: historyId, lastReconciledAt: reconciledAt, error: null });
    return { historyId, changedThreadCount: delta.changedThreadIds.length, removedMessageCount: delta.deletedMessageIds.length };
  }

  async function controlledAccountResync(accountId) {
    const views = ["inbox", "sent", "drafts", "trash", "spam"];
    for (const view of views) {
      const result = await gmail.list({ folder: view, query: "", pageToken: null });
      await persistThreads(result.messages);
    }
    const historyId = await gmail.currentHistoryId(), reconciledAt = new Date().toISOString();
    for (const view of [...views, "__account__"]) await repository.saveSyncState("google_workspace", accountId, view, { status: "synced", cursor: historyId, lastAttemptAt: reconciledAt, lastSuccessAt: reconciledAt, error: null });
    await bumpProjection(accountId, { lastReconciledHistoryId: historyId, lastReconciledAt: reconciledAt, error: null });
    return { historyId, strategy: "expired_history_full_sync" };
  }

  async function syncMailbox(input) {
    const status = await requireGmailCapability(), accountId = String(status.account?.id || status.account?.email || "me"), view = String(input.folder || "inbox"), attemptAt = new Date().toISOString();
    if (view.startsWith("quotesuite:")) return { ...(await listCachedMailbox(input)), sync:{ state:"synced", strategy:"local_projection", lastSuccessAt:attemptAt } };
    if (input.query || parseCacheOffset(input.pageToken)) {
      const result = await gmail.list({ folder:view, query:input.query || "", pageToken:null });
      await persistThreads(result.messages);
      return { ...(await listCachedMailbox(input)), sync:{ state:"synced", strategy:input.query ? "provider_search" : "cached_page", lastSuccessAt:attemptAt } };
    }
    const state = await repository.getSyncState("google_workspace", accountId, view);
    await repository.saveSyncState("google_workspace", accountId, view, { status:"syncing", cursor:state?.provider_cursor || null, lastAttemptAt:attemptAt, lastSuccessAt:state?.last_success_at || null });
    let strategy = state?.provider_cursor ? "gmail_history" : "controlled_full_sync", cursor = state?.provider_cursor || null;
    try {
      if (cursor) {
        try {
          const delta = await gmail.listHistory({ startHistoryId:cursor });
          await repository.markProviderRemoved("google_workspace", delta.deletedMessageIds);
          const changed = [];
          for (const threadId of delta.changedThreadIds) {
            try { changed.push(await gmail.readThread(threadId)); }
            catch (error) { if (error?.status !== 404) throw error; }
          }
          await persistThreads(changed);
          cursor = delta.historyId || await gmail.currentHistoryId();
        } catch (error) {
          if (!error?.historyExpired) throw error;
          strategy = "expired_history_full_sync";
          cursor = null;
        }
      }
      if (!cursor) {
        const result = await gmail.list({ folder:view, query:"", pageToken:null });
        await persistThreads(result.messages);
        cursor = await gmail.currentHistoryId();
      }
      const successAt = new Date().toISOString();
      await repository.saveSyncState("google_workspace", accountId, view, { status:"synced", cursor, lastAttemptAt:attemptAt, lastSuccessAt:successAt, error:null });
      await repository.saveSyncState("google_workspace", accountId, "__account__", { status:"synced", cursor, lastAttemptAt:attemptAt, lastSuccessAt:successAt, error:null });
      await bumpProjection(accountId, { lastReconciledHistoryId: cursor, lastReconciledAt: successAt, error: null });
      return { ...(await listCachedMailbox(input)), sync:{ state:"synced", strategy, lastSuccessAt:successAt, cursorStored:Boolean(cursor) } };
    } catch (error) {
      await repository.saveSyncState("google_workspace", accountId, view, { status:"failed", cursor:state?.provider_cursor || cursor, lastAttemptAt:attemptAt, lastSuccessAt:state?.last_success_at || null, error:error instanceof Error ? error.message : "Mailbox refresh failed." });
      throw error;
    }
  }

  async function listMailbox(input) {
    return listCachedMailbox(input);
  }

  async function readMessage(providerMessageId) { await requireGmailCapability(); return persistProviderMessage(await gmail.readMessage(providerMessageId)); }
  async function readThread(providerThreadId) {
    await requireGmailCapability();
    const thread = await gmail.readThread(providerThreadId), messages = await Promise.all(thread.threadMessages.map(persistProviderMessage)), latest = messages.at(-1);
    return { ...latest, ...thread, id: latest.id, threadMessages: messages, threadCount: messages.length };
  }
  async function mailbox() {
    const status = await requireGmailCapability();
    return { provider: "google_workspace", labels: await gmail.labels(), capabilities: resolveMailboxCapabilities(status) };
  }
  async function command(input) {
    const status = await requireGmailCapability();
    const threadIds = [...new Set((input.threadIds || []).map((id) => String(id).trim()).filter(Boolean))];
    if (!threadIds.length) throw Object.assign(new Error("Select at least one conversation."), { status: 400 });
    const command = String(input.command || ""), capabilityId = COMMAND_CAPABILITIES[command];
    if (!capabilityId) throw Object.assign(new Error("Unsupported mailbox command."), { status: 400, code: "unsupported_mailbox_command" });
    if (!resolveMailboxCapabilities(status).some((capability) => capability.id === capabilityId && capability.available)) throw Object.assign(new Error("Reconnect Google Workspace to grant mailbox modification permission."), { status: 409, code: "gmail_modify_scope_required" });
    const result = await gmail.command({ threadIds, command, labelId: input.labelId ? String(input.labelId) : undefined });
    for (const threadId of threadIds) await persistThreads([await gmail.readThread(threadId)]);
    await bumpProjection(String(status.account?.id || status.account?.email || "me"), { lastReconciledAt: new Date().toISOString(), error: null });
    return result;
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
  async function unlinkRelationship(providerMessageId, input) {
    await requireGmailCapability();
    const message = await readMessage(providerMessageId), updated = await repository.removeLink(message.id, input);
    return { links: updated?.links || [], suggestions: await findRelationshipSuggestions(db, message) };
  }

  async function assignmentOptions(providerMessageId) {
    await requireGmailCapability();
    const message = await readMessage(providerMessageId), text = `${message.subject}\n${message.bodyText}`, reference = (text.match(/\bEF-CL-\d{3}\b/i) || [])[0]?.toUpperCase() || null;
    const clients = await db.all("SELECT id,client_ref,name FROM clients WHERE deleted_at IS NULL ORDER BY client_ref,name");
    const projects = await db.all("SELECT id,client_id,name,context_year FROM projects WHERE deleted_at IS NULL ORDER BY context_year DESC,name,id").catch(() => []);
    const estimates = await db.all("SELECT id,project_id,estimate_ref,created_at FROM estimates WHERE deleted_at IS NULL ORDER BY created_at DESC,id");
    const suppliers = await db.all(`SELECT supplier_code id,supplier_name name FROM supplier_commercial_defaults WHERE NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT')) ORDER BY supplier_name,supplier_code`);
    const attachments = (message.attachments || []).filter((item) => !item.inline && item.providerAttachmentId).map((item) => ({ id: item.id, providerAttachmentId: item.providerAttachmentId, fileName: item.fileName, mediaType: item.mediaType, sizeBytes: item.sizeBytes || 0 }));
    const referenceClients = reference ? clients.filter((client) => String(client.client_ref).toUpperCase() === reference) : [];
    const selectedClient = referenceClients.length === 1 ? referenceClients[0] : null, clientProjects = selectedClient ? projects.filter((project) => project.client_id === selectedClient.id) : [], projectIds = new Set(clientProjects.map((project) => project.id)), clientEstimates = estimates.filter((estimate) => projectIds.has(estimate.project_id));
    const sender = String(message.from?.[0] || "").toLowerCase(), supplierMatches = suppliers.filter((supplier) => (/zylefenster/.test(sender) && /zyle\s*fenster/i.test(supplier.name)) || sender.includes(String(supplier.name).toLowerCase().replace(/\s+/g, "")));
    const supplierEnquiries = (await db.all(`SELECT se.id,se.project_id,se.estimate_id,se.supplier_id,se.recipient,se.subject,se.status,se.revision_no,se.created_at,s.supplier_name
      FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id
      WHERE se.status IN ('draft','approved','sent') ORDER BY se.created_at DESC LIMIT 100`).catch(() => [])).map((item) => ({ id: item.id, projectId: item.project_id, estimateId: item.estimate_id, supplierId: item.supplier_id, supplierName: item.supplier_name || null, recipient: item.recipient, subject: item.subject, status: item.status, revisionNo: Number(item.revision_no || 1), createdAt: item.created_at }));
    const conflicts = [];
    if (reference && referenceClients.length === 0) conflicts.push({ code: "client_reference_unresolved", message: `${reference} does not resolve to an active canonical Client.`, blocking: true });
    if (referenceClients.length > 1) conflicts.push({ code: "client_reference_ambiguous", message: `${reference} resolves to more than one active Client.`, blocking: true });
    if (selectedClient) {
      const subjectName = String(message.subject || "").split(new RegExp(`${reference}\\s*:\\s*`, "i"))[1]?.trim();
      if (subjectName && subjectName.localeCompare(selectedClient.name, undefined, { sensitivity: "base" }) !== 0) conflicts.push({ code: "client_name_variance", message: `Email reference ${reference} names “${subjectName}”; canonical Client is “${selectedClient.name}”. Review before filing.`, blocking: false });
    }
    const proposedProjectId = clientProjects.length === 1 ? clientProjects[0].id : null, proposedEstimateId = clientEstimates.length === 1 ? clientEstimates[0].id : null, proposedSupplierId = supplierMatches.length === 1 ? supplierMatches[0].id : null;
    const relatedSupplierEnquiries = supplierEnquiries.filter((item) => item.projectId === proposedProjectId && item.estimateId === proposedEstimateId && item.supplierId === proposedSupplierId);
    return { providerMessageId, communicationMessageId: message.id, reference, clients, projects, estimates, suppliers, supplierEnquiries, attachments, conflicts, proposed: { clientId: selectedClient?.id || null, projectId: proposedProjectId, estimateId: proposedEstimateId, supplierId: proposedSupplierId, attachmentId: attachments.length === 1 ? attachments[0].id : null, supplierEnquiryId: relatedSupplierEnquiries.length === 1 ? relatedSupplierEnquiries[0].id : null } };
  }

  async function resolveAssignmentSelection(providerMessageId, input = {}) {
    const optionsView = await assignmentOptions(providerMessageId), attachment = optionsView.attachments.find((item) => item.id === String(input.attachmentId || ""));
    if (!attachment) {
      const available = optionsView.attachments.map((item) => item.fileName);
      throw Object.assign(new Error(available.length
        ? `The selected document identity is no longer current. Reopen Link existing and choose ${available.length === 1 ? `“${available[0]}”` : "one of the currently listed documents"} from this exact message.`
        : "This exact message has no eligible retained document to file."), {
        status: 409,
        code: "communication_assignment_attachment_stale",
        details: { eligibleFileNames: available },
      });
    }
    const clientId = String(input.clientId || ""), projectId = String(input.projectId || ""), estimateId = String(input.estimateId || ""), supplierCode = String(input.supplierId || ""), supplierEnquiryId = String(input.supplierEnquiryId || "") || null;
    if (!optionsView.clients.some((item) => item.id === clientId) || !optionsView.projects.some((item) => item.id === projectId && item.client_id === clientId) || !optionsView.estimates.some((item) => item.id === estimateId && item.project_id === projectId) || !optionsView.suppliers.some((item) => item.id === supplierCode)) throw Object.assign(new Error("Review a canonical Client → Project → Estimate → Supplier filing path."), { status: 422, code: "communication_assignment_path_conflict" });
    if (supplierEnquiryId && !optionsView.supplierEnquiries.some((item) => item.id === supplierEnquiryId && item.projectId === projectId && item.estimateId === estimateId && item.supplierId === supplierCode)) throw Object.assign(new Error("The selected supplier request does not belong to this Project, Estimate and supplier. Choose the matching request or leave it unlinked."), { status: 422, code: "communication_assignment_supplier_enquiry_conflict" });
    return { optionsView, attachment, clientId, projectId, estimateId, supplierCode, supplierEnquiryId };
  }

  async function reviewSupplierDocumentAssignment(providerMessageId, input = {}) {
    const selection = await resolveAssignmentSelection(providerMessageId, input);
    const bytes = await gmail.attachment(providerMessageId, selection.attachment.providerAttachmentId), drive = options.drive || createCommercialDriveService(db, options.driveServiceOptions);
    return drive.reviewCommunicationSupplierDocument({ clientId: selection.clientId, projectId: selection.projectId, estimateId: selection.estimateId, supplierCode: selection.supplierCode, communicationAttachmentId: selection.attachment.id, providerMessageId, providerAttachmentId: selection.attachment.providerAttachmentId, fileName: selection.attachment.fileName, mediaType: selection.attachment.mediaType, sizeBytes: selection.attachment.sizeBytes, bytes });
  }

  async function assignSupplierDocument(providerMessageId, input = {}) {
    const { optionsView, attachment, clientId, projectId, estimateId, supplierCode, supplierEnquiryId } = await resolveAssignmentSelection(providerMessageId, input);
    if (optionsView.conflicts.length && input.conflictsReviewed !== true) throw Object.assign(new Error("Review the reference conflict before filing this document."), { status: 409, code: "communication_assignment_conflict_review_required" });
    const bytes = await gmail.attachment(providerMessageId, attachment.providerAttachmentId), drive = options.drive || createCommercialDriveService(db, options.driveServiceOptions);
    const stored = await drive.storeCommunicationSupplierDocument({ clientId, projectId, estimateId, supplierCode, communicationAttachmentId: attachment.id, providerMessageId, providerAttachmentId: attachment.providerAttachmentId, fileName: attachment.fileName, mediaType: attachment.mediaType, sizeBytes: attachment.sizeBytes, bytes, fileDecision: input.fileDecision });
    if (stored.status !== "stored") throw Object.assign(new Error("The provider folder or document is not available yet; no filing relationship was recorded."), { status: 409, code: stored.status || "communication_assignment_storage_pending", details: stored });
    const message = await repository.findByProviderId("google_workspace", providerMessageId);
    let manufacturerResponse = null;
    try {
      for (const link of [{ kind: "client", id: clientId }, { kind: "project", id: projectId }, { kind: "estimate", id: estimateId }, { kind: "supplier", id: supplierCode }]) await repository.addLink(message.id, link);
      if (supplierEnquiryId) {
        if (message.direction !== "inbound") throw Object.assign(new Error("Only an inbound supplier message can be recorded as a returned quote."), { status: 422, code: "supplier_response_inbound_required" });
        let response = await db.get("SELECT * FROM manufacturer_response_links WHERE project_id=? AND communication_message_id=? AND canonical_document_id=?", projectId, message.id, stored.documentId);
        const idempotentReplay = Boolean(response);
        if (response && (response.supplier_enquiry_id !== supplierEnquiryId || response.estimate_id !== estimateId)) throw Object.assign(new Error('The saved document is already linked to a different supplier request or Estimate. Review its existing relationship.'), { code: 'manufacturer_response_link_conflict' });
        if (!response) {
          const id = randomUUID(), at = new Date().toISOString();
          await db.run("INSERT INTO manufacturer_response_links(id,project_id,estimate_id,supplier_enquiry_id,communication_message_id,canonical_document_id,status,created_by,created_at) VALUES(?,?,?,?,?,?,'ready_for_import',?,?)", id, projectId, estimateId, supplierEnquiryId, message.id, stored.documentId, String(input.createdBy || "user-1"), at);
          response = await db.get("SELECT * FROM manufacturer_response_links WHERE id=?", id);
          for (const eventName of ["supplier.response.linked", "supplier.quote_returned"]) await db.run("INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING", randomUUID(), eventName, id, at, JSON.stringify([{ kind: "supplier_enquiry", id: supplierEnquiryId }, { kind: "communication", id: message.id }, { kind: "document", id: stored.documentId }, { kind: "estimate", id: estimateId }]), at);
        }
        await recordSupplierResponseState(db,{supplierEnquiryId,documentId:stored.documentId,receivedAt:response.created_at});
        manufacturerResponse = { id: response.id, supplierEnquiryId, status: "ready_for_import", event: "supplier.quote_returned", nextAction: "Review the saved document with Manufacturer Import", idempotentReplay };
      }
    } catch (cause) {
      throw Object.assign(new Error(`The provider file was saved, but ${supplierEnquiryId ? "its supplier-request / Quote Returned evidence" : "its QuoteSuite relationships"} is incomplete. Retry safely to reuse the saved file and finish linking.`), { status: 409, code: "communication_assignment_partial_success", cause, details: stored });
    }
    return { ...stored, links: (await repository.get(message.id)).links, ...(manufacturerResponse ? { manufacturerResponse } : {}), navigation: { clientId, projectId, estimateId, destination: "supplier-documents", openFilesLabel: "Open Files", importLabel: "Import Manufacturer Estimate" } };
  }

  async function prepareAssignedDocumentImport(documentId, estimateId) {
    const status = await workspace.status();
    if (!status.connected || !status.capabilities?.drive?.available) throw Object.assign(new Error("Google Drive is unavailable. The filed document remains saved; reconnect and retry the import handoff."), { status: 409, code: "provider_disconnected" });
    const document = await db.get("SELECT * FROM canonical_documents WHERE id=? AND estimate_id=? AND document_type='supplier_quotation' AND removed_at IS NULL AND trashed=0", String(documentId || ""), String(estimateId || ""));
    if (!document) throw Object.assign(new Error("The saved supplier document is not available against the selected working Estimate."), { status: 404, code: "canonical_supplier_document_not_found" });
    const response = await workspace.googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(document.provider_file_id)}?alt=media&supportsAllDrives=true`);
    if (!response.ok) throw Object.assign(new Error("The saved provider document could not be read. It remains filed; retry after checking the Drive connection."), { status: response.status >= 500 ? 502 : response.status, code: "canonical_supplier_document_read_failed" });
    const supplierQuotes = options.supplierQuotes || createSupplierQuotesService(db, { attachmentRoot, ...(options.supplierServiceOptions || {}) });
    return supplierQuotes.stageCanonicalDocumentForReview({ canonicalDocumentId: document.id, estimateId: document.estimate_id, supplierCode: document.supplier_id, fileName: document.file_name, mediaType: document.mime_type, sizeBytes: document.size_bytes, bytes: Buffer.from(await response.arrayBuffer()) });
  }

  async function changeState() {
    const status = await workspace.status(), accountId = String(status.account?.id || status.account?.email || "me"), state = await repository.getWatchState("google_workspace", accountId);
    return { mode: notificationConfig.mode, pushConfigured: notificationConfig.configured, projectionVersion: Number(state?.projection_version || 0), watchStatus: state?.status || "unregistered", watchExpirationAt: state?.watch_expiration_at || null, lastNotificationAt: state?.last_notification_at || null, lastReconciledAt: state?.last_reconciled_at || null };
  }

  async function maintainWatch() {
    const status = await requireGmailCapability(), accountId = String(status.account?.id || status.account?.email || "me"), current = await repository.getWatchState("google_workspace", accountId);
    if (!notificationConfig.configured) return repository.saveWatchState("google_workspace", accountId, { mode: "bounded_reconciliation", status: "unregistered", projectionVersion: current?.projection_version || 0, error: null });
    const lifecycle = resolveWatchLifecycle(current);
    if (lifecycle.action === "none") return current;
    try {
      const registered = await gmail.watch({ topicName: notificationConfig.topicName });
      return repository.saveWatchState("google_workspace", accountId, { mode: "push", status: "active", watchHistoryId: registered.historyId, watchRegisteredAt: new Date().toISOString(), watchExpirationAt: registered.expirationAt, lastReconciledHistoryId: current?.last_reconciled_history_id || registered.historyId, projectionVersion: current?.projection_version || 0, error: null });
    } catch (error) {
      await repository.saveWatchState("google_workspace", accountId, { mode: "push", status: "failed", projectionVersion: current?.projection_version || 0, error: error instanceof Error ? error.message : "Gmail watch registration failed." });
      throw error;
    }
  }

  async function stopWatch() {
    const status = await workspace.status(), accountId = String(status.account?.id || status.account?.email || "me"), current = await repository.getWatchState("google_workspace", accountId);
    if (status.connected && current?.status === "active" && typeof gmail.stopWatch === "function") await gmail.stopWatch();
    return repository.saveWatchState("google_workspace", accountId, { mode: notificationConfig.mode, status: "stopped", projectionVersion: current?.projection_version || 0, error: null });
  }

  async function receiveNotification(envelope, request = {}) {
    if (!notificationConfig.configured || typeof options.verifyNotification !== "function") throw Object.assign(new Error("Gmail push delivery is not configured on this deployment."), { status: 503, code: "gmail_push_not_configured" });
    await options.verifyNotification(request, notificationConfig);
    const notification = decodeGmailNotification(envelope), status = await requireGmailCapability(), accountEmail = String(status.account?.email || "").trim().toLowerCase();
    if (!accountEmail || accountEmail !== notification.emailAddress) throw Object.assign(new Error("Gmail notification account does not match the connected provider account."), { status: 403, code: "gmail_notification_account_mismatch" });
    const accountId = String(status.account?.id || status.account?.email || "me"), recorded = await repository.recordNotification("google_workspace", accountId, { notificationId: notification.notificationId, providerCursor: notification.historyId });
    const current = await repository.getWatchState("google_workspace", accountId), classification = classifyNotification({ notificationIdSeen: !recorded.inserted, incomingHistoryId: notification.historyId, reconciledHistoryId: current?.last_reconciled_history_id });
    if (classification !== "reconcile") {
      if (recorded.inserted) await repository.finishNotification("google_workspace", accountId, notification.notificationId, classification);
      return { accepted: true, outcome: classification, projectionVersion: Number(current?.projection_version || 0) };
    }
    const notifiedAt = new Date().toISOString();
    await repository.saveWatchState("google_workspace", accountId, { mode: "push", status: current?.status || "active", lastNotificationAt: notifiedAt, projectionVersion: current?.projection_version || 0, error: null });
    const startHistoryId = current?.last_reconciled_history_id || current?.watch_history_id || (await repository.getSyncState("google_workspace", accountId, "__account__"))?.provider_cursor;
    try {
      if (!startHistoryId) {
        const recovered = await controlledAccountResync(accountId);
        await repository.finishNotification("google_workspace", accountId, notification.notificationId, "processed");
        return { accepted: true, outcome: "controlled_reconciliation", strategy: recovered.strategy, projectionVersion: Number((await repository.getWatchState("google_workspace", accountId))?.projection_version || 0) };
      }
      let result;
      try { result = await reconcileHistory(accountId, startHistoryId); }
      catch (error) {
        if (!error?.historyExpired) throw error;
        const recovered = await controlledAccountResync(accountId);
        result = { historyId: recovered.historyId, changedThreadCount: 0, removedMessageCount: 0, strategy: recovered.strategy };
      }
      await repository.finishNotification("google_workspace", accountId, notification.notificationId, "processed");
      return { accepted: true, outcome: "processed", ...result, projectionVersion: Number((await repository.getWatchState("google_workspace", accountId))?.projection_version || 0) };
    } catch (error) {
      await repository.finishNotification("google_workspace", accountId, notification.notificationId, "failed");
      await repository.saveWatchState("google_workspace", accountId, { mode: "push", status: current?.status || "active", projectionVersion: current?.projection_version || 0, error: error instanceof Error ? error.message : "Gmail notification reconciliation failed." });
      throw error;
    }
  }

  async function createDraft(input) {
    guardTestRecipients(input);
    const status = await requireGmailCapability();
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot, workspace)));
    const localId = String(input.id || randomUUID()), provider = await gmail.createDraft({ ...input, attachments, factoryReceipt:null });
    const saved = await repository.save({ ...input, id: localId, provider: "google_workspace", providerMessageId: provider.providerMessageId, threadId: provider.threadId, mailboxId: "me", direction: "outbound", folder: "drafts", status: "draft", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    await bumpProjection(String(status.account?.id || status.account?.email || "me"), { lastReconciledAt: new Date().toISOString(), error: null });
    return saved;
  }

  async function sendMessage(input, commandContext = {}) {
    let status,attachments,sent,factoryReceipt;
    const id = String(input.id || randomUUID());
    try {
      guardTestRecipients(input);
      const factorySchema=await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='factory_order_requests'");
      if(factorySchema){
        const factoryMessage=await db.get(`SELECT id FROM factory_order_requests WHERE communication_message_id=?
          UNION SELECT order_id FROM factory_attachment_reviews WHERE communication_message_id=?
          UNION SELECT evidence_id FROM workflow_events WHERE event_name LIKE 'factory.order.%' AND EXISTS(SELECT 1 FROM json_each(links_json) WHERE json_extract(value,'$.kind')='communication' AND json_extract(value,'$.id')=?) LIMIT 1`,id,id,id);
        if(factoryMessage&&!await db.get("SELECT id FROM factory_delivery_attempts WHERE id=? AND communication_message_id=? AND state='sending'",commandContext.factoryDeliveryAttemptId||'',id))throw Object.assign(new Error('Send this saved factory request from its reviewed Order journey so its delivery and duplicate protection are retained.'),{status:409,code:'factory_delivery_context_required'});
      }
      status = await requireGmailCapability();
      attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot, workspace)));
      if(commandContext.factoryDeliveryAttemptId){
        const accountId=status.account?.id||status.account?.email;
        if(!accountId)throw new Error('The connected mailbox account identity is unavailable. Reconnect before sending.');
        factoryReceipt={messageId:`<quotesuite-factory-${commandContext.factoryDeliveryAttemptId}@delivery.quotesuite.invalid>`,manifestSha256:factoryManifest(input)};
        const retained=await db.run("UPDATE factory_delivery_attempts SET receipt_message_id=?,receipt_manifest_sha256=?,provider_account_id=? WHERE id=? AND communication_message_id=? AND state='sending'",factoryReceipt.messageId,factoryReceipt.manifestSha256,accountId,commandContext.factoryDeliveryAttemptId,id);
        if(!retained.changes)throw new Error('The factory delivery claim changed. Reopen the request before sending.');
      }
      await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "sending", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    } catch(error) { error.deliveryOutcome='not_sent'; throw error; }
    try {
      sent = await gmail.send({ ...input, attachments, factoryReceipt });
      if(!sent?.providerMessageId)throw Object.assign(new Error('Gmail did not return a confirmed message identity.'),{code:'provider_delivery_unconfirmed'});
      const saved = await repository.save({ ...input, id, provider: "google_workspace", providerMessageId: sent.providerMessageId, threadId: sent.threadId, mailboxId: "me", direction: "outbound", folder: "sent", status: "sent", sentAt: new Date().toISOString(), attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
      await bumpProjection(String(status.account?.id || status.account?.email || "me"), { lastReconciledAt: new Date().toISOString(), error: null });
      return saved;
    } catch (error) {
      error.deliveryOutcome=sent?.providerMessageId?'sent':'uncertain';
      if(sent?.providerMessageId)error.providerMessageId=sent.providerMessageId;
      else if(!commandContext.factoryDeliveryAttemptId)await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "failed", error: error instanceof Error ? error.message : "Provider send failed.", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) }).catch(()=>{});
      // Factory uncertainty belongs to its persistent attempt. A late error must
      // not overwrite a message concurrently confirmed by receipt reconciliation.
      throw error;
    }
  }

  async function reply(input) {
    const original = await readMessage(input.providerMessageId);
    return sendMessage({ ...input, threadId: original.threadId, to: input.to?.length ? input.to : original.from, subject: /^re:/i.test(input.subject || "") ? input.subject : `Re: ${input.subject || original.subject}`, inReplyTo: original.providerMessageId, references: original.providerMessageId, inReplyToProviderMessageId: original.providerMessageId });
  }

  async function reconcileFactoryDelivery(attempt){
    const status=await requireGmailCapability();
    if(!attempt.receipt_message_id||!attempt.receipt_manifest_sha256||!attempt.provider_account_id||attempt.provider_account_id!==(status.account?.id||status.account?.email))return null;
    const saved=await repository.get(attempt.communication_message_id);if(!saved)return null;
    const raw=await gmail.findFactoryReceipt(attempt.receipt_message_id);
    return verifyFactoryReceipt({raw,attempt,saved,readAttachment:gmail.attachment});
  }

  async function forward(input) {
    const original = await readMessage(input.providerMessageId);
    const forwarded = `<hr><p><strong>Forwarded message</strong></p><p>From: ${original.from.join(", ")}<br>Subject: ${original.subject}</p>${original.bodyHtml || `<pre>${original.bodyText}</pre>`}`;
    return sendMessage({ ...input, subject: /^fwd:/i.test(input.subject || "") ? input.subject : `Fwd: ${input.subject || original.subject}`, bodyHtml: `${input.bodyHtml || ""}${forwarded}` });
  }

  async function readAttachment(providerMessageId, attachmentId) { await requireGmailCapability(); return gmail.attachment(providerMessageId, attachmentId); }

  async function enquiryIntake(providerMessageId) {
    const message = await repository.findByProviderId("google_workspace", providerMessageId) || await readMessage(providerMessageId);
    if (!message) throw Object.assign(new Error("The selected message is unavailable."), { status: 404, code: "communication_message_not_found" });
    const existing = await db.get("SELECT i.*,e.enquiry_ref FROM enquiry_email_intakes i JOIN enquiries e ON e.id=i.enquiry_id WHERE i.communication_message_id=?", message.id).catch(() => null);
    const sender = String(message.from?.[0] || ""), email = /<([^>]+)>/.exec(sender)?.[1] || (sender.includes("@") ? sender : ""), displayName = sender.replace(/<[^>]+>/g, "").replace(/^['\"]|['\"]$/g, "").trim();
    const suggestions = (await findRelationshipSuggestions(db, message)).filter((item) => ["enquiry", "client", "project"].includes(item.kind));
    const subjectReference = /\b(EF-CL-\d{3})\b\s*:?\s*(.*)$/i.exec(String(message.subject || ""));
    const likelyMatches = await Promise.all(suggestions.map(async (item) => {
      let conflict = null;
      if (item.kind === "client") {
        const client = await db.get("SELECT client_ref,name,email FROM clients WHERE id=? AND deleted_at IS NULL", item.id);
        const subjectName = subjectReference?.[2]?.trim();
        if (client && subjectName && subjectReference?.[1]?.toUpperCase() === String(client.client_ref || "").toUpperCase() && subjectName.localeCompare(String(client.name || ""), undefined, { sensitivity: "base" }) !== 0) conflict = `The email names “${subjectName}”; the canonical Client is “${client.name}”.`;
        else if (client?.email && email && String(client.email).toLowerCase() === email.trim().toLowerCase() && displayName && displayName.localeCompare(String(client.name || ""), undefined, { sensitivity: "base" }) !== 0) conflict = `This email address belongs to “${client.name}”, while the sender is shown as “${displayName}”.`;
      }
      return { kind: item.kind, id: item.id, label: item.label, evidence: item.evidence, conflict };
    }));
    return { existing: existing ? { enquiryId: existing.enquiry_id, enquiryRef: existing.enquiry_ref } : null, communicationMessageId: message.id, providerMessageId, displayName, email: email.trim(), projectName: String(message.subject || "").replace(/^(?:re|fwd?):\s*/i, "").trim(), brief: String(message.bodyText || message.snippet || "").replace(/\s+/g, " ").trim().slice(0, 2400), likelyMatches, attachments: (message.attachments || []).filter(item => !item.inline).map(item => ({ id: item.id, fileName: item.fileName, mediaType: item.mediaType, sizeBytes: item.sizeBytes })) };
  }

  async function createEnquiryFromMessage(providerMessageId, input = {}) {
    const draft = await enquiryIntake(providerMessageId);
    if (draft.existing) return { ...draft.existing, idempotentReplay: true, storageStatus: "retained" };
    if (draft.likelyMatches.length && (input.existingRecordsReviewed !== true || input.createNewConfirmed !== true)) throw Object.assign(new Error("Review the likely existing records before creating a separate Enquiry."), { status: 409, code: "enquiry_existing_record_review_required", details: { likelyMatches: draft.likelyMatches } });
    const selectedIds = new Set((input.selectedAttachmentIds || []).map(String)), attachments = draft.attachments.filter(item => selectedIds.has(item.id));
    if (selectedIds.size !== attachments.length) throw Object.assign(new Error("Every selected attachment must belong to the reviewed message."), { status: 422, code: "enquiry_attachment_invalid" });
    const drive = createCommercialDriveService(db, options.driveServiceOptions);
    const identities = createCommercialIdentityService(db, { driveTransitions: drive });
    const stableEnquiryId = `email-enquiry-${createHash("sha256").update(`google_workspace:${providerMessageId}`).digest("hex").slice(0, 24)}`;
    const priorEnquiry = await db.get("SELECT id,enquiry_ref,drive_transition_status,deleted_at FROM enquiries WHERE id=?", stableEnquiryId);
    if (priorEnquiry?.deleted_at) throw Object.assign(new Error("This email's earlier Enquiry is no longer active. Restore or review that record before retrying; QuoteSuite will not create a duplicate."), { status: 409, code: "enquiry_intake_prior_record_inactive", details: { enquiryId: priorEnquiry.id, enquiryRef: priorEnquiry.enquiry_ref } });
    const resumedIncomplete = Boolean(priorEnquiry);
    const enquiry = priorEnquiry ? { id: priorEnquiry.id, enquiryRef: priorEnquiry.enquiry_ref, driveTransitionStatus: priorEnquiry.drive_transition_status } : await identities.createEnquiry({ id: stableEnquiryId, source: "gmail", leadSource: "email", displayName: input.displayName || draft.displayName, companyName: input.companyName, email: input.email || draft.email, telephone: input.telephone, projectName: input.projectName || draft.projectName, siteAddress: input.siteAddress, notes: input.brief || draft.brief });
    const intakeId = randomUUID(), at = new Date().toISOString();
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run("INSERT INTO enquiry_email_intakes(id,enquiry_id,communication_message_id,provider_message_id,reviewed_brief,created_by,created_at) VALUES(?,?,?,?,?,?,?)", intakeId, enquiry.id, draft.communicationMessageId, providerMessageId, String(input.brief || draft.brief), String(input.createdBy || "user-1"), at);
      for (const attachment of attachments) await db.run("INSERT INTO enquiry_intake_attachments(id,enquiry_email_intake_id,communication_attachment_id,file_name,storage_status) VALUES(?,?,?,?, 'pending')", randomUUID(), intakeId, attachment.id, attachment.fileName);
      await repository.addLink(draft.communicationMessageId, { kind: "enquiry", id: enquiry.id });
      await db.exec("COMMIT");
    } catch (cause) {
      await db.exec("ROLLBACK").catch(() => {});
      throw Object.assign(new Error(`${enquiry.enquiryRef} was created, but its Email relationship is incomplete. Retry safely to resume this Enquiry; QuoteSuite will not create another one.`), { status: 409, code: "enquiry_intake_partial_success", cause, details: { enquiryId: enquiry.id, enquiryRef: enquiry.enquiryRef } });
    }
    return { enquiryId: enquiry.id, enquiryRef: enquiry.enquiryRef, idempotentReplay: false, resumedIncomplete, selectedAttachmentCount: attachments.length, storageStatus: attachments.length ? "pending_reviewed_storage" : "no_attachments_selected", driveStatus: enquiry.driveTransitionStatus };
  }

  return { reconcileFactoryDelivery, status: workspace.status, mailbox, listMailbox, syncMailbox, readMessage, readThread, relationshipContext, linkRelationship, unlinkRelationship, assignmentOptions, reviewSupplierDocumentAssignment, assignSupplierDocument, prepareAssignedDocumentImport, changeState, maintainWatch, stopWatch, receiveNotification, command, createDraft, sendMessage, reply, forward, readAttachment, enquiryIntake, createEnquiryFromMessage, repository };
}
