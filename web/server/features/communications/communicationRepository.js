import { randomUUID } from "node:crypto";

const parse = (value, fallback = []) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const nowIso = () => new Date().toISOString();

export function createCommunicationRepository(db) {
  const map = (row, attachments = []) => row ? ({
    id: row.id, provider: row.provider, providerMessageId: row.provider_message_id, threadId: row.provider_thread_id, mailboxId: row.mailbox_id,
    direction: row.direction, folder: row.folder, status: row.status, from: parse(row.from_json), to: parse(row.to_json), cc: parse(row.cc_json), bcc: parse(row.bcc_json), subject: row.subject,
    bodyHtml: row.body_html, bodyText: row.body_text, inReplyToProviderMessageId: row.in_reply_to_provider_message_id, links: parse(row.links_json), error: row.error_message,
    sentAt: row.sent_at, createdAt: row.created_at, updatedAt: row.updated_at,
    attachments: attachments.map((item) => ({ id: item.id, fileName: item.file_name, mediaType: item.media_type, sizeBytes: item.size_bytes, storageKey: item.storage_key, providerAttachmentId: item.provider_attachment_id, driveFileId: item.drive_file_id, sha256: item.sha256 })),
  }) : null;

  async function get(id) {
    const row = await db.get("SELECT * FROM communication_messages WHERE id=?", id);
    if (!row) return null;
    return map(row, await db.all("SELECT * FROM communication_attachments WHERE communication_message_id=? ORDER BY created_at,id", id));
  }

  async function save(message) {
    const timestamp = nowIso(), id = String(message.id || randomUUID());
    await db.run(`INSERT INTO communication_messages(id,provider,provider_message_id,provider_thread_id,mailbox_id,direction,folder,status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider_message_id=excluded.provider_message_id,provider_thread_id=excluded.provider_thread_id,mailbox_id=excluded.mailbox_id,direction=excluded.direction,folder=excluded.folder,status=excluded.status,from_json=excluded.from_json,to_json=excluded.to_json,cc_json=excluded.cc_json,bcc_json=excluded.bcc_json,subject=excluded.subject,body_html=excluded.body_html,body_text=excluded.body_text,in_reply_to_provider_message_id=excluded.in_reply_to_provider_message_id,links_json=excluded.links_json,error_message=excluded.error_message,sent_at=excluded.sent_at,updated_at=excluded.updated_at`,
      id, message.provider, message.providerMessageId ?? null, message.threadId ?? null, message.mailboxId ?? null, message.direction ?? "outbound", message.folder ?? "other", message.status, JSON.stringify(message.from ?? []), JSON.stringify(message.to ?? []), JSON.stringify(message.cc ?? []), JSON.stringify(message.bcc ?? []), String(message.subject ?? ""), String(message.bodyHtml ?? ""), String(message.bodyText ?? ""), message.inReplyToProviderMessageId ?? null, JSON.stringify(message.links ?? []), message.error ?? null, message.sentAt ?? null, message.createdAt ?? timestamp, timestamp);
    if (Array.isArray(message.attachments)) for (const attachment of message.attachments) {
      const attachmentId = String(attachment.id || randomUUID());
      await db.run(`INSERT INTO communication_attachments(id,communication_message_id,file_name,media_type,size_bytes,storage_key,provider_attachment_id,drive_file_id,sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider_attachment_id=excluded.provider_attachment_id,drive_file_id=excluded.drive_file_id`, attachmentId, id, String(attachment.fileName || "attachment"), String(attachment.mediaType || "application/octet-stream"), Number(attachment.sizeBytes || 0), attachment.storageKey ?? null, attachment.providerAttachmentId ?? null, attachment.driveFileId ?? null, attachment.sha256 ?? null, timestamp);
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

  return { get, save, findByProviderId, list };
}
