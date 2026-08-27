const numericCursor = (value) => /^\d+$/.test(String(value || "")) ? BigInt(String(value)) : null;

export function compareProviderCursors(left, right) {
  const a = numericCursor(left), b = numericCursor(right);
  if (a !== null && b !== null) return a < b ? -1 : a > b ? 1 : 0;
  return String(left || "").localeCompare(String(right || ""));
}

export function decodeGmailNotification(envelope) {
  const message = envelope?.message;
  if (!message?.data || !message?.messageId) throw Object.assign(new Error("Invalid Gmail notification envelope."), { status: 400, code: "invalid_gmail_notification" });
  let payload;
  try { payload = JSON.parse(Buffer.from(String(message.data), "base64url").toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid Gmail notification payload."), { status: 400, code: "invalid_gmail_notification" }); }
  const emailAddress = String(payload?.emailAddress || "").trim().toLowerCase(), historyId = String(payload?.historyId || "").trim();
  if (!emailAddress || !numericCursor(historyId)) throw Object.assign(new Error("Gmail notification is missing its account or history position."), { status: 400, code: "invalid_gmail_notification" });
  return { notificationId: String(message.messageId), emailAddress, historyId, publishedAt: message.publishTime ? String(message.publishTime) : null };
}

export function resolveNotificationConfiguration(environment = process.env) {
  const topicName = String(environment.QUOTESUITE_GMAIL_PUBSUB_TOPIC || "").trim();
  const audience = String(environment.QUOTESUITE_GMAIL_PUSH_AUDIENCE || "").trim();
  const serviceAccountEmail = String(environment.QUOTESUITE_GMAIL_PUSH_SERVICE_ACCOUNT || "").trim().toLowerCase();
  const configured = Boolean(topicName && audience && serviceAccountEmail);
  return { mode: configured ? "push" : "bounded_reconciliation", configured, topicName: configured ? topicName : null, audienceConfigured: Boolean(audience), serviceAccountConfigured: Boolean(serviceAccountEmail) };
}

export function resolveWatchLifecycle(state, { now = Date.now(), renewalLeadMs = 24 * 60 * 60 * 1000, renewalIntervalMs = 24 * 60 * 60 * 1000 } = {}) {
  if (["stopped", "failed", "unregistered"].includes(String(state?.status || ""))) return { action: "register", state: String(state.status) };
  const expiration = Date.parse(String(state?.watch_expiration_at || ""));
  if (!Number.isFinite(expiration)) return { action: "register", state: "unregistered" };
  if (expiration <= now) return { action: "renew", state: "expired" };
  const registered = Date.parse(String(state?.watch_registered_at || ""));
  if (Number.isFinite(registered) && now - registered >= renewalIntervalMs) return { action: "renew", state: "renewal_due" };
  if (expiration - now <= renewalLeadMs) return { action: "renew", state: "renewal_due" };
  return { action: "none", state: "active" };
}

export function classifyNotification({ notificationIdSeen = false, incomingHistoryId, reconciledHistoryId }) {
  if (notificationIdSeen) return "duplicate";
  if (reconciledHistoryId && compareProviderCursors(incomingHistoryId, reconciledHistoryId) <= 0) return "out_of_order";
  return "reconcile";
}
