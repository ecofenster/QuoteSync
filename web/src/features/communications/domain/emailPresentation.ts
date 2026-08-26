import type { CommunicationMessageView, MailboxCapability, MailboxLabelView } from "../../../services/communications/communicationsApi";

export type MailboxRowProjection = {
  sender: string;
  subject: string;
  snippet: string;
  dateTime: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  attachmentCount: number;
  threadCount: number;
};

export type MailContextAction = {
  id: string;
  label: string;
  group: "message" | "organise" | "search" | "quotesuite";
  command?: string;
  disabled?: boolean;
};

export type MailContextResolution =
  | { type: "submenu"; submenu: "move" | "label" }
  | { type: "command"; command: string; labelId?: string };

export type RelationshipSuggestion = {
  kind: "estimate_reference" | "supplier_quotation_reference" | "provider_label";
  label: string;
  evidence: string;
  autoLinkAllowed: false;
};

const stripMarkup = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function formatMailboxDateTime(value: string | null, locale = "en-GB") {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} · ${time}`;
}

export function projectMailboxRow(message: CommunicationMessageView, folder: string): MailboxRowProjection {
  const sender = (folder === "sent" || folder === "drafts" ? message.to : message.from).join(", ") || "Unknown sender";
  return {
    sender,
    subject: message.subject || "(No subject)",
    snippet: stripMarkup(message.snippet || message.bodyText || message.bodyHtml || "No preview available"),
    dateTime: formatMailboxDateTime(message.sentAt),
    unread: message.unread,
    starred: message.starred,
    labels: message.labels.filter((label) => !label.system).map((label) => label.name),
    attachmentCount: message.attachments.length,
    threadCount: Math.max(1, message.threadCount || message.threadMessages?.length || 1),
  };
}

export function sanitizeEmailHtml(input: string, options: { allowRemoteImages?: boolean; resolveCid?: (contentId: string) => string | null } = {}) {
  let output = String(input || "");
  output = output.replace(/<!--([\s\S]*?)-->/g, "");
  output = output.replace(/<(script|style|iframe|object|embed|form|svg|math|video|audio|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  output = output.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|option|base|meta|link|source|track)\b[^>]*\/?\s*>/gi, "");
  output = output.replace(/\s(?:on[a-z]+|srcdoc|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  output = output.replace(/\s(?:srcset|background|poster|ping|action|data|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  output = output.replace(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, doubleQuoted, singleQuoted, bare) => {
    const style = String(doubleQuoted ?? singleQuoted ?? bare ?? "");
    if (/(?:expression\s*\(|url\s*\(|@import|behavior\s*:|-moz-binding|position\s*:\s*(?:fixed|sticky))/i.test(style)) return "";
    return ` style="${escapeAttribute(style)}"`;
  });
  output = output.replace(/\s(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, attribute, doubleQuoted, singleQuoted, bare) => {
    const raw = String(doubleQuoted ?? singleQuoted ?? bare ?? "").trim();
    const lower = raw.toLowerCase();
    if (attribute.toLowerCase() === "href") {
      if (/^(https?:|mailto:|tel:|#)/i.test(raw)) return ` href="${escapeAttribute(raw)}" target="_blank" rel="noopener noreferrer"`;
      return "";
    }
    if (lower.startsWith("cid:")) {
      const resolved = options.resolveCid?.(raw.slice(4).replace(/^<|>$/g, "")) ?? null;
      return resolved ? ` src="${escapeAttribute(resolved)}" referrerpolicy="no-referrer"` : ' data-qs-inline-image="unavailable"';
    }
    if (/^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(raw)) return ` src="${escapeAttribute(raw)}"`;
    if (/^https?:/i.test(raw)) return options.allowRemoteImages ? ` src="${escapeAttribute(raw)}" referrerpolicy="no-referrer"` : ' data-qs-remote-image="blocked"';
    return "";
  });
  const remoteImageSources = options.allowRemoteImages ? " https: http:" : "";
  const policy = `default-src 'none'; img-src 'self' data:${remoteImageSources}; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'; media-src 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>html{color-scheme:light}body{margin:0;padding:16px;background:#fff;color:#202124;font:14px/1.5 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%;border-collapse:collapse}pre{white-space:pre-wrap}blockquote{margin-left:12px;padding-left:12px;border-left:3px solid #d0d5dd}a{color:#1769aa}</style></head><body>${output}</body></html>`;
}

export function resolveContextMenuAction(action: MailContextAction, labelId?: string): MailContextResolution | null {
  if (action.disabled) return null;
  if (action.id === "move" || action.id === "label") {
    if (!labelId) return { type: "submenu", submenu: action.id };
    return { type: "command", command: action.id, labelId };
  }
  return action.command ? { type: "command", command: action.command } : null;
}

export function deriveMailboxNavigation(labels: MailboxLabelView[], capabilities: MailboxCapability[]) {
  const supported = new Set(capabilities.filter((item) => item.available).map((item) => item.id));
  const byId = new Map(labels.map((label) => [label.id, label]));
  const item = (id: string, label: string, icon: string, group: "primary" | "more" | "category") => ({ id, label, icon, group, count: id === "DRAFT" ? byId.get(id)?.messagesTotal : byId.get(id)?.messagesUnread });
  const primary = [item("INBOX", "Inbox", "▣", "primary"), item("STARRED", "Starred", "☆", "primary"), item("SENT", "Sent", "➤", "primary"), item("DRAFT", "Drafts", "▤", "primary")];
  const more = [["SNOOZED", "Snoozed", "◷"], ["IMPORTANT", "Important", "!"], ["ALL", "All Mail", "▦"], ["SPAM", "Spam", "⚠"], ["TRASH", "Bin", "⌫"]].filter(([id]) => id === "ALL" || byId.has(id)).map(([id, label, icon]) => item(id, label, icon, "more"));
  const category = [["CATEGORY_SOCIAL", "Social"], ["CATEGORY_UPDATES", "Updates"], ["CATEGORY_FORUMS", "Forums"], ["CATEGORY_PROMOTIONS", "Promotions"]].filter(([id]) => byId.has(id)).map(([id, label]) => item(id, label, "•", "category"));
  const scheduled = byId.has("SCHEDULED") && supported.has("scheduled") ? [item("SCHEDULED", "Scheduled", "◴", "primary")] : [];
  return { primary: [...primary, ...scheduled], more, category, userLabels: labels.filter((label) => label.type === "user").sort((a, b) => a.name.localeCompare(b.name)) };
}

export function buildContextActions(message: CommunicationMessageView, capabilities: MailboxCapability[]): MailContextAction[] {
  const supported = new Set(capabilities.filter((item) => item.available).map((item) => item.id));
  const actions: MailContextAction[] = [
    { id: "reply", label: "Reply", group: "message" },
    { id: "reply_all", label: "Reply all", group: "message", disabled: message.to.length + message.cc.length < 2 },
    { id: "forward", label: "Forward", group: "message" },
    { id: "archive", label: "Archive", group: "organise", command: "archive", disabled: !supported.has("archive") },
    { id: "trash", label: "Delete", group: "organise", command: "trash", disabled: !supported.has("trash") },
    { id: message.unread ? "mark_read" : "mark_unread", label: message.unread ? "Mark read" : "Mark unread", group: "organise", command: message.unread ? "mark_read" : "mark_unread", disabled: !supported.has("read_state") },
    { id: message.starred ? "unstar" : "star", label: message.starred ? "Unstar" : "Star", group: "organise", command: message.starred ? "unstar" : "star", disabled: !supported.has("star") },
    { id: "move", label: "Move to…", group: "organise", disabled: !supported.has("move") },
    { id: "label", label: "Label as…", group: "organise", disabled: !supported.has("labels") },
    { id: "find_sender", label: "Find emails from sender", group: "search" },
    { id: "find_subject", label: "Find emails with subject", group: "search" },
    { id: "open_window", label: "Open in new window", group: "search" },
    { id: "link_client", label: "Review Client link suggestions…", group: "quotesuite" },
    { id: "link_estimate", label: "Review Estimate link suggestions…", group: "quotesuite" },
    { id: "link_order", label: "Review Order link suggestions…", group: "quotesuite" },
    { id: "link_supplier", label: "Review Supplier link suggestions…", group: "quotesuite" },
    { id: "link_supplier_quotation", label: "Review Supplier Quotation link suggestions…", group: "quotesuite" },
    { id: "follow_up", label: "Open Follow Ups (manual)", group: "quotesuite" },
    { id: "save_attachments", label: "Save attachments to Client Files (not yet available)", group: "quotesuite", disabled: true },
    { id: "import_supplier_quote", label: "Import Supplier Quote (not yet available)", group: "quotesuite", disabled: true },
  ];
  return actions;
}

export function deriveRelationshipSuggestions(message: CommunicationMessageView): RelationshipSuggestion[] {
  const evidence = `${message.subject}\n${message.bodyText}`;
  const estimates = [...new Set(evidence.match(/\bEF-EST-\d{4}-\d+\b/gi) || [])];
  const supplierReferences = [...new Set(evidence.match(/\b\d{5,}-\d+\b/g) || [])];
  const labels = message.labels.filter((label) => !label.system && /^(suppliers?|clients?|estimates?)\//i.test(label.name));
  return [
    ...estimates.map((reference) => ({ kind: "estimate_reference" as const, label: `Possible Estimate ${reference.toUpperCase()}`, evidence: "Exact Estimate reference", autoLinkAllowed: false as const })),
    ...supplierReferences.map((reference) => ({ kind: "supplier_quotation_reference" as const, label: `Possible supplier quotation ${reference}`, evidence: "Exact quotation-style reference", autoLinkAllowed: false as const })),
    ...labels.map((label) => ({ kind: "provider_label" as const, label: `Provider label: ${label.name}`, evidence: "Label suggestion only", autoLinkAllowed: false as const })),
  ];
}
