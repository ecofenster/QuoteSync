import { randomUUID } from "node:crypto";
import { normalizeCommunicationFolder } from "./communicationFolder.js";

const parse = (value, fallback = []) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const nowIso = () => new Date().toISOString();

export function createCommunicationRepository(db) {
  const map = (row, attachments = []) => row ? ({
    id: row.id, provider: row.provider, providerMessageId: row.provider_message_id, threadId: row.provider_thread_id, mailboxId: row.mailbox_id,
    direction: row.direction, folder: row.folder, status: row.status, from: parse(row.from_json), to: parse(row.to_json), cc: parse(row.cc_json), bcc: parse(row.bcc_json), subject: row.subject,
    bodyHtml: row.body_html, bodyText: row.body_text, inReplyToProviderMessageId: row.in_reply_to_provider_message_id, links: parse(row.links_json), error: row.error_message,
    sentAt: row.sent_at, createdAt: row.created_at, updatedAt: row.updated_at,
    ...parse(row.provider_state_json, {}),
    attachments: attachments.map((item) => ({ id: item.id, fileName: item.file_name, mediaType: item.media_type, sizeBytes: item.size_bytes, storageKey: item.storage_key, providerAttachmentId: item.provider_attachment_id, driveFileId: item.drive_file_id, sha256: item.sha256, contentId: item.content_id || null, inline: Boolean(item.is_inline) })),
  }) : null;

  async function get(id) {
    const row = await db.get("SELECT * FROM communication_messages WHERE id=?", id);
    if (!row) return null;
    return map(row, await db.all("SELECT * FROM communication_attachments WHERE communication_message_id=? ORDER BY created_at,id", id));
  }

  async function save(message) {
    const timestamp = nowIso(), id = String(message.id || randomUUID()), folder = normalizeCommunicationFolder(message.folder, { strict: true });
    const providerState = { snippet: String(message.snippet ?? message.bodyText ?? ""), unread: Boolean(message.unread), starred: Boolean(message.starred), important: Boolean(message.important), labels: message.labels ?? [], threadCount: Number(message.threadCount || 1), providerRemoved: Boolean(message.providerRemoved) };
    await db.run(`INSERT INTO communication_messages(id,provider,provider_message_id,provider_thread_id,mailbox_id,direction,folder,status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at,provider_state_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider_message_id=excluded.provider_message_id,provider_thread_id=excluded.provider_thread_id,mailbox_id=excluded.mailbox_id,direction=excluded.direction,folder=excluded.folder,status=excluded.status,from_json=excluded.from_json,to_json=excluded.to_json,cc_json=excluded.cc_json,bcc_json=excluded.bcc_json,subject=excluded.subject,body_html=excluded.body_html,body_text=excluded.body_text,in_reply_to_provider_message_id=excluded.in_reply_to_provider_message_id,links_json=excluded.links_json,error_message=excluded.error_message,sent_at=excluded.sent_at,updated_at=excluded.updated_at,provider_state_json=excluded.provider_state_json`,
      id, message.provider, message.providerMessageId ?? null, message.threadId ?? null, message.mailboxId ?? null, message.direction ?? "outbound", folder, message.status, JSON.stringify(message.from ?? []), JSON.stringify(message.to ?? []), JSON.stringify(message.cc ?? []), JSON.stringify(message.bcc ?? []), String(message.subject ?? ""), String(message.bodyHtml ?? ""), String(message.bodyText ?? ""), message.inReplyToProviderMessageId ?? null, JSON.stringify(message.links ?? []), message.error ?? null, message.sentAt ?? null, message.createdAt ?? timestamp, timestamp, JSON.stringify(providerState));
    if (Array.isArray(message.attachments)) for (const attachment of message.attachments) {
      const attachmentId = String(attachment.id || randomUUID());
      await db.run(`INSERT INTO communication_attachments(id,communication_message_id,file_name,media_type,size_bytes,storage_key,provider_attachment_id,drive_file_id,sha256,created_at,content_id,is_inline) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider_attachment_id=excluded.provider_attachment_id,drive_file_id=excluded.drive_file_id,content_id=excluded.content_id,is_inline=excluded.is_inline`, attachmentId, id, String(attachment.fileName || "attachment"), String(attachment.mediaType || "application/octet-stream"), Number(attachment.sizeBytes || 0), attachment.storageKey ?? null, attachment.providerAttachmentId ?? null, attachment.driveFileId ?? null, attachment.sha256 ?? null, timestamp, attachment.contentId ?? null, attachment.inline ? 1 : 0);
    }
    return get(id);
  }

  async function findByProviderId(provider, providerMessageId) {
    const row = await db.get("SELECT id FROM communication_messages WHERE provider=? AND provider_message_id=?", provider, providerMessageId);
    return row ? get(row.id) : null;
  }

  async function list({ folder, status, estimateId, limit = 100 } = {}) {
    const clauses = [], params = [];
    if (folder) { clauses.push("folder=?"); params.push(folder); }
    if (status) { clauses.push("status=?"); params.push(status); }
    if (estimateId) { clauses.push("links_json LIKE ?"); params.push(`%\"id\":\"${String(estimateId).replaceAll("%", "")}\"%`); }
    params.push(Math.min(500, Math.max(1, Number(limit) || 100)));
    const rows = await db.all(`SELECT id FROM communication_messages${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY updated_at DESC LIMIT ?`, ...params);
    return Promise.all(rows.map((row) => get(row.id)));
  }

  async function listMailbox({ folder = "inbox", query = "", offset = 0, limit = 30 } = {}) {
    const rows = await db.all("SELECT id FROM communication_messages WHERE provider='google_workspace' ORDER BY COALESCE(sent_at,updated_at) DESC LIMIT 1000");
    const messages = await Promise.all(rows.map((row) => get(row.id))), normalizedQuery = String(query || "").trim().toLowerCase();
    const labelId = String(folder).startsWith("label:") ? String(folder).slice(6) : null;
    const matchesFolder = (message) => {
      if (message.providerRemoved) return false;
      const labels = new Set((message.labels || []).map((label) => label.id));
      if (labelId) return labels.has(labelId);
      if (folder === "starred") return message.starred;
      if (folder === "important") return message.important;
      if (folder === "all") return !["trash", "spam"].includes(message.folder);
      if (["social", "updates", "forums", "promotions", "snoozed"].includes(folder)) return labels.has(folder === "snoozed" ? "SNOOZED" : `CATEGORY_${folder.toUpperCase()}`);
      return message.folder === folder;
    };
    const matchesQuery = (message) => {
      if (!normalizedQuery) return true;
      const subject = String(message.subject || "").toLowerCase(), sender = (message.from || []).join(" ").toLowerCase(), text = `${sender} ${subject} ${message.bodyText || ""}`.toLowerCase();
      if (normalizedQuery.startsWith("from:")) return sender.includes(normalizedQuery.slice(5).replaceAll('"', "").trim());
      if (normalizedQuery.startsWith("subject:")) return subject.includes(normalizedQuery.slice(8).replaceAll('"', "").trim());
      return text.includes(normalizedQuery);
    };
    const grouped = new Map();
    for (const message of messages.filter((item) => matchesFolder(item) && matchesQuery(item))) {
      const key = message.threadId || message.providerMessageId || message.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(message);
    }
    const conversations = [...grouped.values()].map((items) => {
      items.sort((left, right) => String(left.sentAt || left.updatedAt).localeCompare(String(right.sentAt || right.updatedAt)));
      const latest = items.at(-1);
      return { ...latest, unread: items.some((item) => item.unread), starred: items.some((item) => item.starred), important: items.some((item) => item.important), threadMessages: items, threadCount: items.length };
    }).sort((left, right) => String(right.sentAt || right.updatedAt).localeCompare(String(left.sentAt || left.updatedAt)));
    const start = Math.max(0, Number(offset) || 0), size = Math.min(100, Math.max(1, Number(limit) || 30));
    return { messages: conversations.slice(start, start + size), nextPageToken: start + size < conversations.length ? `cache:${start + size}` : null };
  }

  async function markProviderRemoved(provider, providerMessageIds) {
    const ids = [...new Set((providerMessageIds || []).filter(Boolean))];
    for (const providerMessageId of ids) {
      const row = await db.get("SELECT id,provider_state_json FROM communication_messages WHERE provider=? AND provider_message_id=?", provider, providerMessageId);
      if (row) await db.run("UPDATE communication_messages SET provider_state_json=?,updated_at=? WHERE id=?", JSON.stringify({ ...parse(row.provider_state_json, {}), providerRemoved: true }), nowIso(), row.id);
    }
  }

  async function getSyncState(provider, providerAccountId, mailboxView) { return db.get("SELECT * FROM communication_provider_sync_states WHERE provider=? AND provider_account_id=? AND mailbox_view=?", provider, providerAccountId, mailboxView); }
  async function saveSyncState(provider, providerAccountId, mailboxView, input) {
    const timestamp = nowIso();
    await db.run(`INSERT INTO communication_provider_sync_states(provider,provider_account_id,mailbox_view,provider_cursor,status,last_attempt_at,last_success_at,error_message,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,provider_account_id,mailbox_view) DO UPDATE SET provider_cursor=COALESCE(excluded.provider_cursor,communication_provider_sync_states.provider_cursor),status=excluded.status,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,error_message=excluded.error_message,updated_at=excluded.updated_at`, provider, providerAccountId, mailboxView, input.cursor ?? null, input.status, input.lastAttemptAt ?? timestamp, input.lastSuccessAt ?? null, input.error ?? null, timestamp);
    return getSyncState(provider, providerAccountId, mailboxView);
  }

  async function addLink(id, link) {
    const current = await get(id);
    if (!current) return null;
    const normalized = { kind: String(link?.kind || "").trim(), id: String(link?.id || "").trim() };
    if (!normalized.kind || !normalized.id) throw Object.assign(new Error("A canonical relationship kind and ID are required."), { status: 400, code: "invalid_communication_link" });
    const links = [...current.links.filter((item) => !(item.kind === normalized.kind && item.id === normalized.id)), normalized];
    await db.run("UPDATE communication_messages SET links_json=?,updated_at=? WHERE id=?", JSON.stringify(links), nowIso(), id);
    return get(id);
  }

  async function removeLink(id, link) {
    const current = await get(id);
    if (!current) return null;
    const kind = String(link?.kind || "").trim(), targetId = String(link?.id || "").trim();
    if (!kind || !targetId) throw Object.assign(new Error("A canonical relationship kind and ID are required."), { status: 400, code: "invalid_communication_link" });
    await db.run("UPDATE communication_messages SET links_json=?,updated_at=? WHERE id=?", JSON.stringify(current.links.filter((item) => !(item.kind === kind && item.id === targetId))), nowIso(), id);
    return get(id);
  }

  async function getWatchState(provider, providerAccountId) { return db.get("SELECT * FROM communication_provider_watch_states WHERE provider=? AND provider_account_id=?", provider, providerAccountId); }
  async function saveWatchState(provider, providerAccountId, input) {
    const timestamp = nowIso(), current = await getWatchState(provider, providerAccountId);
    await db.run(`INSERT INTO communication_provider_watch_states(provider,provider_account_id,mode,status,watch_history_id,watch_registered_at,watch_expiration_at,last_reconciled_history_id,last_notification_at,last_reconciled_at,projection_version,error_message,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,provider_account_id) DO UPDATE SET mode=excluded.mode,status=excluded.status,watch_history_id=COALESCE(excluded.watch_history_id,communication_provider_watch_states.watch_history_id),watch_registered_at=COALESCE(excluded.watch_registered_at,communication_provider_watch_states.watch_registered_at),watch_expiration_at=COALESCE(excluded.watch_expiration_at,communication_provider_watch_states.watch_expiration_at),last_reconciled_history_id=COALESCE(excluded.last_reconciled_history_id,communication_provider_watch_states.last_reconciled_history_id),last_notification_at=COALESCE(excluded.last_notification_at,communication_provider_watch_states.last_notification_at),last_reconciled_at=COALESCE(excluded.last_reconciled_at,communication_provider_watch_states.last_reconciled_at),projection_version=excluded.projection_version,error_message=excluded.error_message,updated_at=excluded.updated_at`, provider, providerAccountId, input.mode ?? current?.mode ?? "bounded_reconciliation", input.status ?? current?.status ?? "unregistered", input.watchHistoryId ?? null, input.watchRegisteredAt ?? null, input.watchExpirationAt ?? null, input.lastReconciledHistoryId ?? null, input.lastNotificationAt ?? null, input.lastReconciledAt ?? null, Number(input.projectionVersion ?? current?.projection_version ?? 0), input.error ?? null, timestamp);
    return getWatchState(provider, providerAccountId);
  }

  async function recordNotification(provider, providerAccountId, input) {
    const timestamp = nowIso();
    const result = await db.run("INSERT OR IGNORE INTO communication_provider_notifications(provider,provider_account_id,notification_id,provider_cursor,received_at,outcome) VALUES(?,?,?,?,?,'received')", provider, providerAccountId, input.notificationId, input.providerCursor, timestamp);
    await db.run("DELETE FROM communication_provider_notifications WHERE rowid IN (SELECT rowid FROM communication_provider_notifications WHERE provider=? AND provider_account_id=? ORDER BY received_at DESC LIMIT -1 OFFSET 1000)", provider, providerAccountId);
    return { inserted: Number(result.changes || 0) === 1, receivedAt: timestamp };
  }
  async function finishNotification(provider, providerAccountId, notificationId, outcome) { await db.run("UPDATE communication_provider_notifications SET outcome=?,processed_at=? WHERE provider=? AND provider_account_id=? AND notification_id=?", outcome, nowIso(), provider, providerAccountId, notificationId); }

  return { get, save, findByProviderId, list, listMailbox, markProviderRemoved, getSyncState, saveSyncState, addLink, removeLink, getWatchState, saveWatchState, recordNotification, finishNotification };
}
