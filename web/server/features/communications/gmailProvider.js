import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { normalizeCommunicationFolder } from "./communicationFolder.js";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const fromBase64Url = (value) => Buffer.from(String(value || "").replaceAll("-", "+").replaceAll("_", "/"), "base64");
const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const headerValue = (headers, name) => headers?.find((header) => String(header.name).toLowerCase() === name.toLowerCase())?.value ?? "";
const addresses = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const cleanHeader = (value) => String(value || "").replace(/[\r\n]+/g, " ").trim();

function collectParts(part, result) {
  if (!part) return;
  const mediaType = String(part.mimeType || ""), contentId = headerValue(part.headers, "Content-ID").replace(/^<|>$/g, "") || null, disposition = headerValue(part.headers, "Content-Disposition");
  if (part.body?.attachmentId) result.attachments.push({ id: part.body.attachmentId, fileName: part.filename || contentId || "inline-image", mediaType: mediaType || "application/octet-stream", sizeBytes: Number(part.body.size || 0), providerAttachmentId: part.body.attachmentId, contentId, inline: /^inline/i.test(disposition) || Boolean(contentId) });
  else if (part.body?.data && mediaType === "text/html") result.bodyHtml += fromBase64Url(part.body.data).toString("utf8");
  else if (part.body?.data && mediaType === "text/plain") result.bodyText += fromBase64Url(part.body.data).toString("utf8");
  for (const child of part.parts || []) collectParts(child, result);
}

export function mapGmailMessage(message, folder = "other", labelNames = new Map()) {
  const headers = message.payload?.headers || [], content = { bodyHtml: "", bodyText: "", attachments: [] };
  collectParts(message.payload, content);
  const labels = new Set(message.labelIds || []), resolvedFolder = labels.has("TRASH") ? "trash" : labels.has("SPAM") ? "spam" : labels.has("INBOX") ? "inbox" : labels.has("SENT") ? "sent" : labels.has("DRAFT") ? "drafts" : normalizeCommunicationFolder(folder);
  return {
    provider: "google_workspace", providerMessageId: message.id, threadId: message.threadId ?? null, direction: labels.has("SENT") || labels.has("DRAFT") ? "outbound" : "inbound", folder: resolvedFolder,
    status: resolvedFolder === "drafts" ? "draft" : resolvedFolder === "sent" ? "sent" : "received", from: addresses(headerValue(headers, "From")), to: addresses(headerValue(headers, "To")), cc: addresses(headerValue(headers, "Cc")), bcc: addresses(headerValue(headers, "Bcc")),
    subject: headerValue(headers, "Subject"), snippet: String(message.snippet || ""), bodyHtml: content.bodyHtml, bodyText: content.bodyText || String(message.snippet || ""), inReplyToProviderMessageId: headerValue(headers, "In-Reply-To") || null,
    attachments: content.attachments, sentAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    unread: labels.has("UNREAD"), starred: labels.has("STARRED"), important: labels.has("IMPORTANT"), labels: [...labels].map((id) => ({ id, name: labelNames.get(id) || id, system: !String(id).startsWith("Label_") })), threadCount: 1, links: [],
  };
}

function buildMime(input) {
  const boundary = `quotesuite_${randomUUID().replaceAll("-", "")}`;
  const headers = [`To: ${(input.to || []).map(cleanHeader).join(", ")}`, input.cc?.length ? `Cc: ${input.cc.map(cleanHeader).join(", ")}` : null, input.bcc?.length ? `Bcc: ${input.bcc.map(cleanHeader).join(", ")}` : null, `Subject: ${cleanHeader(input.subject)}`, "MIME-Version: 1.0", input.inReplyTo ? `In-Reply-To: ${cleanHeader(input.inReplyTo)}` : null, input.references ? `References: ${cleanHeader(input.references)}` : null, `Content-Type: multipart/mixed; boundary=\"${boundary}\"`].filter(Boolean);
  const parts = [`--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", String(input.bodyHtml || "")];
  for (const attachment of input.attachments || []) parts.push(`--${boundary}`, `Content-Type: ${cleanHeader(attachment.mediaType || "application/octet-stream")}; name=\"${cleanHeader(attachment.fileName)}\"`, `Content-Disposition: attachment; filename=\"${cleanHeader(attachment.fileName)}\"`, "Content-Transfer-Encoding: base64", "", Buffer.from(attachment.bytes).toString("base64").replace(/.{1,76}/g, "$&\r\n").trim());
  parts.push(`--${boundary}--`, "");
  return toBase64Url(`${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`);
}

export function createGmailProvider(googleWorkspace, { pageSize = 30 } = {}) {
  async function json(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || "Gmail request failed."), { status: response.status >= 500 ? 502 : response.status, providerBody: body });
    return body;
  }
  async function labels() {
    const listed = await json(await googleWorkspace.googleFetch(`${API}/labels`));
    const labels = listed.labels || [], detailed = new Array(labels.length); let cursor = 0;
    const load = async (label) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try { return await json(await googleWorkspace.googleFetch(`${API}/labels/${encodeURIComponent(label.id)}`)); }
        catch (error) {
          if (error?.status !== 429) throw error;
          if (attempt < 2) await delay(150 * (2 ** attempt));
        }
      }
      return label;
    };
    const worker = async () => { while (cursor < labels.length) { const index = cursor; cursor += 1; detailed[index] = await load(labels[index]); } };
    await Promise.all(Array.from({ length: Math.min(4, labels.length) }, worker));
    return detailed.map((label) => ({ id: label.id, name: label.name, type: String(label.type || "system").toLowerCase(), messagesTotal: Number(label.messagesTotal || 0), messagesUnread: Number(label.messagesUnread || 0), colour: label.color ?? null }));
  }
  async function readMessage(id, folder = "other", names = new Map()) { return mapGmailMessage(await json(await googleWorkspace.googleFetch(`${API}/messages/${encodeURIComponent(id)}?format=full`)), folder, names); }
  async function readThread(id, folder = "other", names) {
    const body = await json(await googleWorkspace.googleFetch(`${API}/threads/${encodeURIComponent(id)}?format=full`)), labelNames = names ?? new Map();
    const messages = (body.messages || []).map((message) => mapGmailMessage(message, folder, labelNames)).sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
    const latest = messages.at(-1);
    if (!latest) throw Object.assign(new Error("Gmail thread contains no messages."), { status: 404 });
    return { ...latest, threadId: body.id || latest.threadId, threadMessages: messages, threadCount: messages.length };
  }
  const mailboxLabels = Object.freeze({ inbox: "INBOX", sent: "SENT", drafts: "DRAFT", starred: "STARRED", snoozed: "SNOOZED", important: "IMPORTANT", all: null, spam: "SPAM", trash: "TRASH", social: "CATEGORY_SOCIAL", updates: "CATEGORY_UPDATES", forums: "CATEGORY_FORUMS", promotions: "CATEGORY_PROMOTIONS" });
  const folderLabel = (folder) => {
    const view = String(folder || "").trim();
    if (Object.hasOwn(mailboxLabels, view)) return mailboxLabels[view];
    if (view.startsWith("label:") && view.slice(6)) return view.slice(6);
    throw Object.assign(new Error("Unsupported mailbox view."), { status: 400, code: "invalid_mailbox_view" });
  };
  async function list({ folder = "inbox", query = "", pageToken = null } = {}) {
    const label = folderLabel(folder), url = new URL(`${API}/threads`); url.searchParams.set("maxResults", String(pageSize)); if (label) url.searchParams.set("labelIds", label); if (query) url.searchParams.set("q", query); if (pageToken) url.searchParams.set("pageToken", pageToken); if (folder === "spam" || folder === "trash") url.searchParams.set("includeSpamTrash", "true");
    const body = await json(await googleWorkspace.googleFetch(url));
    return { messages: await Promise.all((body.threads || []).map((item) => readThread(item.id, folder))), nextPageToken: body.nextPageToken ?? null };
  }
  async function currentHistoryId() {
    const profile = await json(await googleWorkspace.googleFetch(`${API}/profile`));
    return profile.historyId ? String(profile.historyId) : null;
  }
  async function watch({ topicName, labelIds = [] }) {
    const body = await json(await googleWorkspace.googleFetch(`${API}/watch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicName, ...(labelIds.length ? { labelIds } : {}) }) }));
    return { historyId: body.historyId ? String(body.historyId) : null, expirationAt: body.expiration ? new Date(Number(body.expiration)).toISOString() : null };
  }
  async function stopWatch() { await json(await googleWorkspace.googleFetch(`${API}/stop`, { method: "POST" })); return { ok: true }; }
  async function history({ startHistoryId, pageToken = null } = {}) {
    const url = new URL(`${API}/history`);
    url.searchParams.set("startHistoryId", String(startHistoryId));
    url.searchParams.set("maxResults", "500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    try {
      return await json(await googleWorkspace.googleFetch(url));
    } catch (error) {
      if (error?.status === 404) error.historyExpired = true;
      throw error;
    }
  }
  async function listHistory({ startHistoryId }) {
    const changedThreadIds = new Set(), deletedMessageIds = new Set();
    let pageToken = null, historyId = String(startHistoryId);
    do {
      const page = await history({ startHistoryId, pageToken });
      historyId = page.historyId ? String(page.historyId) : historyId;
      for (const event of page.history || []) {
        for (const item of [...(event.messages || []), ...(event.messagesAdded || []).map((entry) => entry.message), ...(event.labelsAdded || []).map((entry) => entry.message), ...(event.labelsRemoved || []).map((entry) => entry.message)]) if (item?.threadId) changedThreadIds.add(String(item.threadId));
        for (const entry of event.messagesDeleted || []) {
          if (entry.message?.id) deletedMessageIds.add(String(entry.message.id));
          if (entry.message?.threadId) changedThreadIds.add(String(entry.message.threadId));
        }
      }
      pageToken = page.nextPageToken ?? null;
    } while (pageToken);
    return { historyId, changedThreadIds:[...changedThreadIds], deletedMessageIds:[...deletedMessageIds] };
  }
  async function command({ threadIds, command, labelId }) {
    const changes = { archive: { removeLabelIds: ["INBOX"] }, mark_read: { removeLabelIds: ["UNREAD"] }, mark_unread: { addLabelIds: ["UNREAD"] }, star: { addLabelIds: ["STARRED"] }, unstar: { removeLabelIds: ["STARRED"] }, label: { addLabelIds: [labelId] }, move: { addLabelIds: [labelId], removeLabelIds: ["INBOX"] } };
    for (const threadId of threadIds || []) {
      if (command === "trash") await json(await googleWorkspace.googleFetch(`${API}/threads/${encodeURIComponent(threadId)}/trash`, { method: "POST" }));
      else {
        const change = changes[command];
        if (!change || ((command === "label" || command === "move") && !labelId)) throw Object.assign(new Error("Unsupported mailbox command."), { status: 400 });
        await json(await googleWorkspace.googleFetch(`${API}/threads/${encodeURIComponent(threadId)}/modify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) }));
      }
    }
    return { ok: true };
  }
  async function send(input) {
    const payload = { raw: buildMime(input), ...(input.threadId ? { threadId: input.threadId } : {}) };
    const sent = await json(await googleWorkspace.googleFetch(`${API}/messages/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    return { providerMessageId: sent.id, threadId: sent.threadId ?? input.threadId ?? null };
  }
  async function createDraft(input) {
    const payload = { message: { raw: buildMime(input), ...(input.threadId ? { threadId: input.threadId } : {}) } };
    const draft = await json(await googleWorkspace.googleFetch(`${API}/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    return { providerDraftId: draft.id, providerMessageId: draft.message?.id ?? null, threadId: draft.message?.threadId ?? input.threadId ?? null };
  }
  async function attachment(messageId, attachmentId) { const body = await json(await googleWorkspace.googleFetch(`${API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`)); return fromBase64Url(body.data); }
  return { labels, list, readMessage, readThread, currentHistoryId, listHistory, watch, stopWatch, command, send, createDraft, attachment };
}
