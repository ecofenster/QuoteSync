import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveManagedPath, resolveAttachmentRoot } from "../supplierQuotes/managedAttachmentStorage.js";
import { createCommunicationRepository } from "./communicationRepository.js";
import { createGmailProvider } from "./gmailProvider.js";
import { createGoogleWorkspaceService, GMAIL_MODIFY_SCOPE } from "../integrations/googleWorkspaceService.js";
import { classifyNotification, decodeGmailNotification, resolveNotificationConfiguration, resolveWatchLifecycle } from "./communicationLiveSync.js";

const MUTATING_MAILBOX_CAPABILITIES = Object.freeze(["archive", "trash", "read_state", "star", "move", "labels"]);
const COMMAND_CAPABILITIES = Object.freeze({ archive: "archive", trash: "trash", mark_read: "read_state", mark_unread: "read_state", star: "star", unstar: "star", move: "move", label: "labels" });

export function resolveMailboxCapabilities(workspaceStatus) {
  const granted = new Set(workspaceStatus?.scopes || []);
  const canModify = Boolean(workspaceStatus?.connected) && granted.has(GMAIL_MODIFY_SCOPE);
  return MUTATING_MAILBOX_CAPABILITIES.map((id) => ({ id, available: canModify }));
}

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
    if (clients.length === 1) {
      const projects = await db.all("SELECT id,name FROM projects WHERE client_id=? AND deleted_at IS NULL ORDER BY name,id", clients[0].id).catch(() => []);
      if (projects.length === 1) suggestions.push({ kind: "project", id: projects[0].id, label: projects[0].name, evidence: "Only active Project for the exact Client email match; explicit confirmation still required", autoLinkAllowed: false });
    }
    const enquiries = await db.all(`SELECT id,enquiry_ref,display_name,email FROM enquiries WHERE deleted_at IS NULL AND status='new' AND lower(email) IN (${emails.map(() => "?").join(",")})`, ...emails).catch(() => []);
    for (const enquiry of enquiries) suggestions.push({ kind: "enquiry", id: enquiry.id, label: `${enquiry.enquiry_ref} · ${enquiry.display_name}`, evidence: `Exact Enquiry contact email: ${enquiry.email}`, autoLinkAllowed: false });
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
    const revisions = await db.all(`SELECT r.id,r.full_quotation_reference,q.supplier_code,q.supplier_name,d.supplier_code canonical_supplier_code,d.supplier_name canonical_supplier_name FROM supplier_quote_revisions r JOIN supplier_quotes q ON q.id=r.supplier_quote_id LEFT JOIN supplier_commercial_defaults d ON d.supplier_code=q.supplier_code AND d.active<>0 WHERE r.full_quotation_reference IN (${placeholders}) AND q.archived_at IS NULL`, ...supplierReferences).catch(() => []);
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
  if (kind === "supplier") return db.get("SELECT supplier_code id FROM supplier_commercial_defaults WHERE supplier_code=? AND active<>0", id);
  if (kind === "supplier_quotation") return db.get("SELECT r.id FROM supplier_quote_revisions r JOIN supplier_quotes q ON q.id=r.supplier_quote_id JOIN estimates e ON e.id=r.estimate_id WHERE r.id=? AND q.archived_at IS NULL AND e.deleted_at IS NULL", id);
  throw Object.assign(new Error("Unsupported canonical communication relationship."), { status: 400, code: "unsupported_communication_link" });
}

export function createCommunicationsService(db, options = {}) {
  const repository = createCommunicationRepository(db), workspace = options.workspace || createGoogleWorkspaceService(db, options), gmail = options.gmail || createGmailProvider(workspace, options.gmailOptions), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment), notificationConfig = options.notificationConfig || resolveNotificationConfiguration(options.environment);
  async function requireGmailCapability() {
    const status = await workspace.status();
    if (status.state === "reconnect_required") throw Object.assign(new Error("Reconnect Google Workspace to grant the required Gmail permissions."), { status: 409, code: "gmail_scope_required" });
    if (!status.connected) throw Object.assign(new Error("Google Workspace is not connected."), { status: 409, code: "provider_disconnected" });
    if (!status.capabilities.gmail.available) throw Object.assign(new Error("Reconnect Google Workspace and grant the required Gmail permissions."), { status: 409, code: "gmail_scope_required" });
    return status;
  }

  async function persistProviderMessage(message) {
    const existing = message.providerMessageId ? await repository.findByProviderId("google_workspace", message.providerMessageId) : null;
    const saved = await repository.save({ ...message, id: existing?.id ?? randomUUID(), links: preserveCommunicationLinks(existing, message), mailboxId: "me", attachments: (message.attachments || []).map((attachment) => ({ ...attachment, id: `${existing?.id ?? message.providerMessageId}_${attachment.providerAttachmentId || attachment.id}` })) });
    return { ...saved, ...message, id: saved.id, links: saved.links, attachments: (message.attachments || []).map((attachment) => ({ ...attachment, id: `${saved.id}_${attachment.providerAttachmentId || attachment.id}` })) };
  }

  const parseCacheOffset = (token) => String(token || "").startsWith("cache:") ? Math.max(0, Number(String(token).slice(6)) || 0) : 0;

  async function listCachedMailbox(input) {
    if (String(input.folder || "").startsWith("quotesuite:")) {
      const view = String(input.folder).slice(11), all = await repository.list({ limit: 500 });
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
    const status = await requireGmailCapability();
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot)));
    const localId = String(input.id || randomUUID()), provider = await gmail.createDraft({ ...input, attachments });
    const saved = await repository.save({ ...input, id: localId, provider: "google_workspace", providerMessageId: provider.providerMessageId, threadId: provider.threadId, mailboxId: "me", direction: "outbound", folder: "drafts", status: "draft", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    await bumpProjection(String(status.account?.id || status.account?.email || "me"), { lastReconciledAt: new Date().toISOString(), error: null });
    return saved;
  }

  async function sendMessage(input) {
    const status = await requireGmailCapability();
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot))), id = String(input.id || randomUUID());
    await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "sending", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    try {
      const sent = await gmail.send({ ...input, attachments });
      const saved = await repository.save({ ...input, id, provider: "google_workspace", providerMessageId: sent.providerMessageId, threadId: sent.threadId, mailboxId: "me", direction: "outbound", folder: "sent", status: "sent", sentAt: new Date().toISOString(), attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
      await bumpProjection(String(status.account?.id || status.account?.email || "me"), { lastReconciledAt: new Date().toISOString(), error: null });
      return saved;
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
  return { status: workspace.status, mailbox, listMailbox, syncMailbox, readMessage, readThread, relationshipContext, linkRelationship, unlinkRelationship, changeState, maintainWatch, stopWatch, receiveNotification, command, createDraft, sendMessage, reply, forward, readAttachment, repository };
}
