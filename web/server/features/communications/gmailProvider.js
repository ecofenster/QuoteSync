import { randomUUID } from "node:crypto";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const fromBase64Url = (value) => Buffer.from(String(value || "").replaceAll("-", "+").replaceAll("_", "/"), "base64");
const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const headerValue = (headers, name) => headers?.find((header) => String(header.name).toLowerCase() === name.toLowerCase())?.value ?? "";
const addresses = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const cleanHeader = (value) => String(value || "").replace(/[\r\n]+/g, " ").trim();

function collectParts(part, result) {
  if (!part) return;
  const mediaType = String(part.mimeType || "");
  if (part.filename && part.body?.attachmentId) result.attachments.push({ id: part.body.attachmentId, fileName: part.filename, mediaType: mediaType || "application/octet-stream", sizeBytes: Number(part.body.size || 0), providerAttachmentId: part.body.attachmentId });
  else if (part.body?.data && mediaType === "text/html") result.bodyHtml += fromBase64Url(part.body.data).toString("utf8");
  else if (part.body?.data && mediaType === "text/plain") result.bodyText += fromBase64Url(part.body.data).toString("utf8");
  for (const child of part.parts || []) collectParts(child, result);
}

export function mapGmailMessage(message, folder = "other") {
  const headers = message.payload?.headers || [], content = { bodyHtml: "", bodyText: "", attachments: [] };
  collectParts(message.payload, content);
  const labels = new Set(message.labelIds || []), resolvedFolder = labels.has("INBOX") ? "inbox" : labels.has("SENT") ? "sent" : labels.has("DRAFT") ? "drafts" : folder;
  return {
    provider: "google_workspace", providerMessageId: message.id, threadId: message.threadId ?? null, direction: resolvedFolder === "inbox" ? "inbound" : "outbound", folder: resolvedFolder,
    status: resolvedFolder === "drafts" ? "draft" : resolvedFolder === "sent" ? "sent" : "received", from: addresses(headerValue(headers, "From")), to: addresses(headerValue(headers, "To")), cc: addresses(headerValue(headers, "Cc")), bcc: addresses(headerValue(headers, "Bcc")),
    subject: headerValue(headers, "Subject"), bodyHtml: content.bodyHtml, bodyText: content.bodyText || String(message.snippet || ""), inReplyToProviderMessageId: headerValue(headers, "In-Reply-To") || null,
    attachments: content.attachments, sentAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
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
  async function readMessage(id, folder = "other") { return mapGmailMessage(await json(await googleWorkspace.googleFetch(`${API}/messages/${encodeURIComponent(id)}?format=full`)), folder); }
  async function list({ folder = "inbox", query = "", pageToken = null } = {}) {
    if (folder === "drafts") {
      const url = new URL(`${API}/drafts`); url.searchParams.set("maxResults", String(pageSize)); if (query) url.searchParams.set("q", query); if (pageToken) url.searchParams.set("pageToken", pageToken);
      const body = await json(await googleWorkspace.googleFetch(url));
      const messages = await Promise.all((body.drafts || []).map(async (draft) => ({ ...(await readMessage(draft.message?.id, "drafts")), providerDraftId: draft.id })));
      return { messages, nextPageToken: body.nextPageToken ?? null };
    }
    const label = folder === "sent" ? "SENT" : "INBOX", url = new URL(`${API}/messages`); url.searchParams.set("maxResults", String(pageSize)); url.searchParams.set("labelIds", label); if (query) url.searchParams.set("q", query); if (pageToken) url.searchParams.set("pageToken", pageToken);
    const body = await json(await googleWorkspace.googleFetch(url));
    return { messages: await Promise.all((body.messages || []).map((item) => readMessage(item.id, folder))), nextPageToken: body.nextPageToken ?? null };
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
  return { list, readMessage, send, createDraft, attachment };
}
