import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  communicationsApi,
  type CommunicationAssignmentOptions,
  type CommunicationAssignmentReview,
  type CommunicationAssignmentResult,
  type CommunicationFileDecision,
  type CommunicationAttachmentView,
  type CommunicationContextResult,
  type CommunicationContextSuggestion,
  type CommunicationMailboxView,
  type CommunicationMessageView,
  type GoogleWorkspaceStatus,
  type MailboxLabelView,
  type MailboxMetadata,
} from "../../services/communications/communicationsApi";
import { ApiRequestError } from "../../services/api/apiClient";
import {
  buildContextActions,
  deriveMailboxNavigation,
  formatMailboxDateTime,
  projectMailboxRow,
  resolveContextMenuAction,
  sanitizeEmailHtml,
  type MailContextAction,
} from "./domain/emailPresentation";
import "./emailWorkspace.css";

type ComposeMode = "compose" | "reply" | "reply_all" | "forward";
type AssignmentFeedback = {
  state: "saving" | "failed" | "partial";
  message: string;
  details?: {
    fileName?: string;
    folderPath?: string;
    webViewLink?: string | null;
    eligibleFileNames?: string[];
    conflict?: { message?: string; evidence?: string; recommendedDecision?: string };
  };
};
export type EnquiryIntakeFeedback = { state:"creating"|"linking"|"failed";message:string };
type Composer = {
  mode: ComposeMode;
  providerMessageId?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  attachments: CommunicationAttachmentView[];
};
type ContextMenu = {
  x: number;
  y: number;
  message: CommunicationMessageView;
  submenu: null | "move" | "label";
};
type EmailLayoutMode = "list" | "right" | "bottom";
type EmailReadingMode = "message" | "conversation";
type MailboxSyncState = "idle" | "syncing" | "synced" | "failed" | "offline";
export type EnquiryIntake = {
  providerMessageId: string;
  displayName: string;
  email: string;
  projectName: string;
  brief: string;
  likelyMatches: Array<{
    kind: "enquiry" | "client" | "project";
    id: string;
    label: string;
    evidence: string;
    conflict: string | null;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    mediaType: string;
    sizeBytes: number;
  }>;
};

const mailboxMemoryCache = new Map<
  string,
  { messages: CommunicationMessageView[]; nextPageToken: string | null }
>();
const EMAIL_LAYOUT_KEY = "quotesuite.email.layout.v1",
  EMAIL_READING_MODE_KEY = "quotesuite.email.reading-mode.v1",
  EMAIL_RIGHT_SIZE_KEY = "quotesuite.email.right-size.v1",
  EMAIL_BOTTOM_SIZE_KEY = "quotesuite.email.bottom-size.v1";
const emptyComposer = (): Composer => ({
  mode: "compose",
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  bodyHtml: "",
  attachments: [],
});
const fileAttachment = (file: File) =>
  new Promise<CommunicationAttachmentView>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Attachment could not be read."));
    reader.onload = () =>
      resolve({
        fileName: file.name,
        mediaType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        contentBase64: String(reader.result || "").split(",", 2)[1] || "",
      });
    reader.readAsDataURL(file);
  });
const address = (value: string) => value.match(/<([^>]+)>/)?.[1] || value;
const splitAddresses = (value: string) =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
const mailboxFolder = (id: string): CommunicationMailboxView =>
  (({
    INBOX: "inbox",
    STARRED: "starred",
    SENT: "sent",
    DRAFT: "drafts",
    SNOOZED: "snoozed",
    IMPORTANT: "important",
    ALL: "all",
    SPAM: "spam",
    TRASH: "trash",
    CATEGORY_SOCIAL: "social",
    CATEGORY_UPDATES: "updates",
    CATEGORY_FORUMS: "forums",
    CATEGORY_PROMOTIONS: "promotions",
  })[id] || `label:${id}`) as CommunicationMailboxView;
const iconButton = (
  label: string,
  icon: string,
  onClick: () => void,
  disabled = false,
) => (
  <button
    type="button"
    className="ui-button ui-button--icon ui-button--ghost email-toolbar__button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
  </button>
);
const readPreference = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
};

function MailContextMenu({
  menu,
  actions,
  labels,
  onAction,
  onClose,
}: {
  menu: ContextMenu;
  actions: MailContextAction[];
  labels: MailboxLabelView[];
  onAction: (action: MailContextAction, labelId?: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = [
            ...(ref.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) || []),
          ],
          active = items.indexOf(document.activeElement as HTMLButtonElement),
          next =
            event.key === "ArrowDown"
              ? (active + 1) % items.length
              : (active - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", keyboard);
    requestAnimationFrame(() =>
      ref.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus(),
    );
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", keyboard);
    };
  }, [onClose]);
  const position = {
      left: Math.min(menu.x, Math.max(8, window.innerWidth - 286)),
      top: Math.min(menu.y, Math.max(8, window.innerHeight - 520)),
    },
    submenuAction = menu.submenu
      ? actions.find((item) => item.id === menu.submenu)
      : null;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Message actions"
      className="email-context-menu ui-card"
      style={position}
    >
      {submenuAction ? (
        <>
          <button
            role="menuitem"
            type="button"
            onClick={() =>
              onAction({ id: "submenu_back", label: "Back", group: "organise" })
            }
          >
            ← Back
          </button>
          <div className="email-context-menu__heading">
            {submenuAction.label.replace("…", "")}
          </div>
          {labels
            .filter((label) => label.type === "user")
            .map((label) => (
              <button
                role="menuitem"
                type="button"
                key={label.id}
                onClick={() => onAction(submenuAction, label.id)}
              >
                <span
                  className="email-label-indent"
                  style={
                    {
                      "--label-depth": String(label.name.split("/").length - 1),
                    } as React.CSSProperties
                  }
                >
                  {label.name.split("/").at(-1)}
                </span>
              </button>
            ))}
        </>
      ) : (
        actions.map((action, index) => (
          <div key={action.id}>
            {index > 0 && actions[index - 1].group !== action.group ? (
              <div className="email-context-menu__divider" role="separator" />
            ) : null}
            <button
              role="menuitem"
              type="button"
              disabled={action.disabled}
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function MessageBody({ message }: { message: CommunicationMessageView }) {
  const [allowRemote, setAllowRemote] = useState(false),
    [inlineImages, setInlineImages] = useState<Record<string, string>>({}),
    [inlineFailure, setInlineFailure] = useState(false),
    hasRemote = /<img\b[^>]+src\s*=\s*["']https?:/i.test(
      message.bodyHtml || "",
    );
  useEffect(() => {
    let cancelled = false;
    setAllowRemote(false);
    setInlineImages({});
    setInlineFailure(false);
    const retained = message.attachments.filter(
      (item) =>
        item.contentId &&
        item.providerAttachmentId &&
        message.providerMessageId,
    );
    void Promise.all(
      retained.map(async (attachment) => {
        const response = await fetch(
          communicationsApi.attachmentUrl(
            message.providerMessageId!,
            attachment.providerAttachmentId!,
            attachment,
          ),
          { credentials: "same-origin" },
        );
        if (!response.ok)
          throw new Error("Retained inline image could not be read.");
        const blob = await response.blob();
        return [
          attachment.contentId!.toLowerCase(),
          await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(blob);
          }),
        ] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setInlineImages(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setInlineFailure(true);
      });
    return () => {
      cancelled = true;
    };
  }, [message.id, message.providerMessageId, message.attachments]);
  const content = useMemo(
    () =>
      sanitizeEmailHtml(message.bodyHtml, {
        allowRemoteImages: allowRemote,
        resolveCid: (contentId) =>
          inlineImages[contentId.toLowerCase()] || null,
      }),
    [message.bodyHtml, allowRemote, inlineImages],
  );
  if (!message.bodyHtml)
    return (
      <pre className="email-reader__plain">
        {message.bodyText || "No message body was returned."}
      </pre>
    );
  return (
    <div className="email-reader__body">
      {inlineFailure ? (
        <div className="email-reader__privacy" role="status">
          <span>
            A retained inline image could not be loaded. Attachments remain
            available below.
          </span>
        </div>
      ) : null}
      {hasRemote && !allowRemote ? (
        <div className="email-reader__privacy">
          <span>Remote images are hidden to protect your privacy.</span>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => setAllowRemote(true)}
          >
            Load remote images
          </button>
        </div>
      ) : null}
      <iframe
        sandbox=""
        referrerPolicy="no-referrer"
        title={`Email content: ${message.subject || "No subject"}`}
        srcDoc={content}
      />
    </div>
  );
}

function AttachmentList({ message }: { message: CommunicationMessageView }) {
  const [showAll, setShowAll] = useState(false);
  const downloadable = message.attachments.filter(
    (attachment) => !attachment.inline,
  );
  if (!downloadable.length) return null;
  const previewLimit = 8,
    visible = showAll ? downloadable : downloadable.slice(0, previewLimit),
    remaining = downloadable.length - visible.length;
  return (
    <section className="email-attachments" aria-label="Attachments">
      <div className="email-attachments__heading">
        <h4>Attachments ({downloadable.length})</h4>
        {downloadable.length > previewLimit ? (
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? "Show fewer" : `Show ${remaining} more`}
          </button>
        ) : null}
      </div>
      <div className="email-attachments__grid">
        {visible.map((attachment, index) => (
          <article
            key={`${attachment.id || attachment.providerAttachmentId || attachment.fileName}-${index}`}
            className="email-attachment"
          >
            <span aria-hidden="true">▧</span>
            <div>
              <strong>{attachment.fileName}</strong>
              <small>
                {attachment.mediaType} ·{" "}
                {attachment.sizeBytes
                  ? `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB`
                  : "Size unavailable"}
              </small>
            </div>
            {message.providerMessageId && attachment.providerAttachmentId ? (
              <div className="ui-action-row">
                <a
                  className="ui-button ui-button--ghost"
                  target="_blank"
                  rel="noreferrer"
                  href={communicationsApi.attachmentUrl(
                    message.providerMessageId,
                    attachment.providerAttachmentId,
                    attachment,
                  )}
                >
                  Open
                </a>
                <a
                  className="ui-button ui-button--ghost"
                  download={attachment.fileName}
                  href={communicationsApi.attachmentUrl(
                    message.providerMessageId,
                    attachment.providerAttachmentId,
                    attachment,
                    true,
                  )}
                >
                  Download
                </a>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ConversationMessage({
  message,
  initiallyOpen,
  onReply,
}: {
  message: CommunicationMessageView;
  initiallyOpen: boolean;
  onReply: (message: CommunicationMessageView, mode: ComposeMode) => void;
}) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  return (
    <details
      className="email-reader__message"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span className="email-reader__expander" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="email-avatar" aria-hidden="true">
          {(message.from[0] || "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="email-reader__message-addresses">
          <strong>{message.from.join(", ") || "Unknown sender"}</strong>
          <small>to {message.to.join(", ") || "—"}</small>
        </span>
        <time dateTime={message.sentAt || undefined}>
          {formatMailboxDateTime(message.sentAt)}
        </time>
      </summary>
      {expanded ? (
        <div className="email-reader__message-content">
          <div className="email-reader__recipients">
            From: {message.from.join(", ") || "—"}
            <br />
            To: {message.to.join(", ") || "—"}
            {message.cc.length ? (
              <>
                <br />
                Cc: {message.cc.join(", ")}
              </>
            ) : null}
          </div>
          <MessageBody message={message} />
          <AttachmentList message={message} />
          <footer className="ui-action-row email-reader__reply-actions">
            <button
              className="ui-button ui-button--ghost"
              onClick={() => onReply(message, "reply")}
            >
              ↩ Reply
            </button>
            <button
              className="ui-button ui-button--ghost"
              onClick={() => onReply(message, "reply_all")}
            >
              ↩ Reply all
            </button>
            <button
              className="ui-button ui-button--ghost"
              onClick={() => onReply(message, "forward")}
            >
              ↪ Forward
            </button>
          </footer>
        </div>
      ) : null}
    </details>
  );
}

function SelectedMessage({
  message,
  onReply,
}: {
  message: CommunicationMessageView;
  onReply: (message: CommunicationMessageView, mode: ComposeMode) => void;
}) {
  return (
    <section
      className="email-reader__selected-message"
      aria-label="Selected message"
    >
      <header>
        <span className="email-avatar" aria-hidden="true">
          {(message.from[0] || "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="email-reader__message-addresses">
          <span>{message.from.join(", ") || "Unknown sender"}</span>
          <small>to {message.to.join(", ") || "—"}</small>
        </span>
        <time dateTime={message.sentAt || undefined}>
          {formatMailboxDateTime(message.sentAt)}
        </time>
      </header>
      <div className="email-reader__recipients">
        From: {message.from.join(", ") || "—"}
        <br />
        To: {message.to.join(", ") || "—"}
        {message.cc.length ? (
          <>
            <br />
            Cc: {message.cc.join(", ")}
          </>
        ) : null}
      </div>
      <MessageBody message={message} />
      <AttachmentList message={message} />
      <footer className="ui-action-row email-reader__reply-actions">
        <button
          className="ui-button ui-button--ghost"
          onClick={() => onReply(message, "reply")}
        >
          ↩ Reply
        </button>
        <button
          className="ui-button ui-button--ghost"
          onClick={() => onReply(message, "reply_all")}
        >
          ↩ Reply all
        </button>
        <button
          className="ui-button ui-button--ghost"
          onClick={() => onReply(message, "forward")}
        >
          ↪ Forward
        </button>
      </footer>
    </section>
  );
}

function ConversationReader({
  thread,
  activeMessage,
  relationship,
  readingMode,
  busy,
  onBack,
  onOpenFull,
  onMore,
  onCommand,
  onReply,
  onLink,
  onUnlink,
  onAddEnquiry,
  onLinkExisting,
  onReadingMode,
}: {
  thread: CommunicationMessageView;
  activeMessage: CommunicationMessageView;
  relationship: CommunicationContextResult | null;
  readingMode: EmailReadingMode;
  busy: boolean;
  onBack: () => void;
  onOpenFull?: () => void;
  onMore: () => void;
  onCommand: (command: string) => void;
  onReply: (message: CommunicationMessageView, mode: ComposeMode) => void;
  onLink: (suggestion: CommunicationContextSuggestion) => void;
  onUnlink: (link: { kind: string; id: string }) => void;
  onAddEnquiry: () => void;
  onLinkExisting: () => void;
  onReadingMode: (mode: EmailReadingMode) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  return (
    <div className="email-reader-pane">
      <div className="email-reader__toolbar">
        <button
          type="button"
          className="ui-button ui-button--ghost"
          onClick={onBack}
        >
          ← Back
        </button>
        <div className="email-toolbar__actions">
          <div
            className="email-reading-mode"
            role="group"
            aria-label="Reading mode"
          >
            <button
              type="button"
              className={`ui-button ui-button--ghost${readingMode === "message" ? " is-active" : ""}`}
              aria-pressed={readingMode === "message"}
              onClick={() => onReadingMode("message")}
            >
              Message
            </button>
            <button
              type="button"
              className={`ui-button ui-button--ghost${readingMode === "conversation" ? " is-active" : ""}`}
              aria-pressed={readingMode === "conversation"}
              onClick={() => onReadingMode("conversation")}
            >
              Conversation
            </button>
          </div>
          {onOpenFull ? (
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={onOpenFull}
            >
              Open full reader
            </button>
          ) : null}
          {iconButton(
            "Archive conversation",
            "▱",
            () => onCommand("archive"),
            busy,
          )}
          {iconButton(
            "Delete conversation",
            "⌫",
            () => onCommand("trash"),
            busy,
          )}
          {iconButton(
            activeMessage.unread ? "Mark read" : "Mark unread",
            activeMessage.unread ? "○" : "●",
            () => onCommand(activeMessage.unread ? "mark_read" : "mark_unread"),
            busy,
          )}
          {iconButton("More actions", "⋮", onMore)}
        </div>
      </div>
      <article
        className="email-reader"
        aria-label={
          readingMode === "message" ? "Selected message" : "Conversation"
        }
      >
        <header>
          <h3>{activeMessage.subject || thread.subject || "(No subject)"}</h3>
          <div className="email-reader__labels">
            {activeMessage.labels
              .filter((label) => !label.system)
              .map((label) => (
                <span className="ui-chip" key={label.id}>
                  {label.name}
                </span>
              ))}
          </div>
        </header>
        <aside className="email-context-panel">
          <div className="email-context-panel__heading">
            <strong>QuoteSuite context</strong>
            <div className="ui-action-row">
              <button
                type="button"
                className="ui-button ui-button--primary"
                disabled={busy || !activeMessage.providerMessageId}
                onClick={onAddEnquiry}
              >
                Add Enquiry
              </button>
              <button
                type="button"
                className="ui-button ui-button--ghost"
                disabled={busy || !relationship}
                onClick={onLinkExisting}
              >
                Link existing
              </button>
            </div>
          </div>
          {relationship ? (
            <>
              <div className="email-context-panel__links">
                {relationship.links.length ? (
                  relationship.links.map((link) => (
                    <span
                      className="ui-chip email-context-panel__link"
                      key={`${link.kind}-${link.id}`}
                    >
                      {link.kind.replaceAll("_", " ")} · {link.id}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setReviewing(true)}
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${link.kind} relationship`}
                        disabled={busy}
                        onClick={() => onUnlink(link)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <small>
                    Unlinked — choose an existing Client, Project and Estimate,
                    or add a new Enquiry.
                  </small>
                )}
              </div>
              {reviewing ? (
                <div className="email-context-panel__suggestions">
                  {relationship.suggestions.length ? (
                    relationship.suggestions.map((item) => {
                      const linked = relationship.links.some(
                        (link) =>
                          link.kind === item.kind && link.id === item.id,
                      );
                      return (
                        <div key={`${item.kind}-${item.id}`}>
                          <span>
                            <strong>{item.kind.replaceAll("_", " ")}</strong> ·{" "}
                            {item.label}
                          </span>
                          <small>
                            {item.evidence} · explicit confirmation required.
                          </small>
                          <button
                            type="button"
                            className="ui-button ui-button--ghost"
                            disabled={busy || linked}
                            onClick={() => onLink(item)}
                          >
                            {linked ? "Linked" : "Confirm relationship"}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <small>
                      No exact-evidence suggestion was found. The
                      existing-record picker remains available.
                    </small>
                  )}
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={onLinkExisting}
                  >
                    Open existing-record picker
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <small>Loading canonical relationship context…</small>
          )}
        </aside>
        {readingMode === "message" ? (
          <SelectedMessage message={activeMessage} onReply={onReply} />
        ) : (
          (thread.threadMessages || [thread]).map((message, index, array) => (
            <ConversationMessage
              key={message.id}
              message={message}
              initiallyOpen={
                message.id === activeMessage.id || index === array.length - 1
              }
              onReply={onReply}
            />
          ))
        )}
      </article>
    </div>
  );
}

export function EnquiryIntakeDialog({
  draft,
  busy,
  feedback,
  onClose,
  onSubmit,
  onLinkExisting,
}: {
  draft: EnquiryIntake;
  busy: boolean;
  feedback: EnquiryIntakeFeedback | null;
  onClose: () => void;
  onSubmit: (draft: EnquiryIntake, selected: string[], createNewConfirmed: boolean) => void;
  onLinkExisting: (match: EnquiryIntake["likelyMatches"][number]) => void;
}) {
  const [value, setValue] = useState(draft),
    [selected, setSelected] = useState(
      () => new Set(draft.attachments.map((item) => item.id)),
    ),
    [createNewConfirmed, setCreateNewConfirmed] = useState(false);
  return (
    <div className="ui-modal-backdrop" role="presentation">
      <section
        className="ui-modal email-enquiry-intake"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-enquiry-title"
      >
        <header>
          <div>
            <span className="ui-eyebrow">Reviewed Gmail intake</span>
            <h3 id="email-enquiry-title">Add Enquiry</h3>
            <small>
              Review extracted details and choose the attachments QuoteSuite
              should retain.
            </small>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        {feedback ? <p className={`ui-status${feedback.state === "failed" ? " ui-status--error" : ""}`} role={feedback.state === "failed" ? "alert" : "status"}>{feedback.message}{feedback.state === "failed" ? " Your entries are preserved; review the options and retry safely." : ""}</p> : null}
        {value.likelyMatches.length ? (
          <section className="email-enquiry-intake__matches" aria-label="Likely existing records">
            <h4>Possible existing records</h4>
            <p>QuoteSuite found supporting evidence. Link the email to the right record, or confirm that this is a separate Enquiry.</p>
            {value.likelyMatches.map((match) => <article key={`${match.kind}:${match.id}`}>
              <div><span>{match.kind === "enquiry" ? "Enquiry" : match.kind === "client" ? "Client" : "Project"} · {match.label}</span><small>{match.evidence}</small>{match.conflict ? <small className="ui-status ui-status--error">{match.conflict} Review the difference before continuing.</small> : null}</div>
              <button type="button" className="ui-button ui-button--ghost" disabled={busy} onClick={() => onLinkExisting(match)}>Link this record</button>
            </article>)}
            <label><input type="checkbox" checked={createNewConfirmed} disabled={busy} onChange={(event) => setCreateNewConfirmed(event.currentTarget.checked)} /> Create a separate Enquiry despite these possible matches.</label>
          </section>
        ) : <p className="ui-status">No likely existing Enquiry, Client or Project was found from the email address or canonical references.</p>}
        <div className="email-enquiry-intake__grid">
          <label>
            Contact name
            <input
              className="ui-input"
              value={value.displayName}
              onChange={(event) =>
                setValue({ ...value, displayName: event.currentTarget.value })
              }
            />
          </label>
          <label>
            Email
            <input
              className="ui-input"
              type="email"
              value={value.email}
              onChange={(event) =>
                setValue({ ...value, email: event.currentTarget.value })
              }
            />
          </label>
          <label className="email-enquiry-intake__wide">
            Project / site name
            <input
              className="ui-input"
              value={value.projectName}
              onChange={(event) =>
                setValue({ ...value, projectName: event.currentTarget.value })
              }
            />
          </label>
          <label className="email-enquiry-intake__wide">
            Reviewed project brief
            <textarea
              className="ui-textarea"
              rows={6}
              value={value.brief}
              onChange={(event) =>
                setValue({ ...value, brief: event.currentTarget.value })
              }
            />
          </label>
        </div>
        <fieldset>
          <legend>Attachments to retain</legend>
          {value.attachments.length ? (
            value.attachments.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSelected((current) => {
                      const next = new Set(current);
                      if (checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    });
                  }}
                />
                <span>{item.fileName}</span>
              </label>
            ))
          ) : (
            <small>No attachments were supplied.</small>
          )}
        </fieldset>
        <footer>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary"
            disabled={
              busy || !value.displayName.trim() || !value.projectName.trim() || (value.likelyMatches.length > 0 && !createNewConfirmed)
            }
            onClick={() => onSubmit(value, [...selected], createNewConfirmed)}
          >
            {busy ? "Creating Enquiry…" : "Create Enquiry"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function AssignmentDialog({
  options,
  result,
  saving,
  feedback,
  onClose,
  onSubmit,
  onOpenFiles,
  onImport,
}: {
  options: CommunicationAssignmentOptions;
  result: CommunicationAssignmentResult | null;
  saving: boolean;
  feedback: AssignmentFeedback | null;
  onClose: () => void;
  onSubmit: (value: {
    clientId: string;
    projectId: string;
    estimateId: string;
    supplierId: string;
    supplierEnquiryId?: string;
    attachmentId: string;
    conflictsReviewed: boolean;
    fileDecision: CommunicationFileDecision;
  }) => void;
  onOpenFiles: (result: CommunicationAssignmentResult) => void;
  onImport: (result: CommunicationAssignmentResult) => void;
}) {
  const [clientId, setClientId] = useState(options.proposed.clientId || ""),
    [projectId, setProjectId] = useState(options.proposed.projectId || ""),
    [estimateId, setEstimateId] = useState(options.proposed.estimateId || ""),
    [supplierId, setSupplierId] = useState(options.proposed.supplierId || ""),
    [supplierEnquiryId, setSupplierEnquiryId] = useState(options.proposed.supplierEnquiryId || ""),
    [attachmentId, setAttachmentId] = useState(
      options.proposed.attachmentId || "",
    ),
    [conflictsReviewed, setConflictsReviewed] = useState(false),
    [review, setReview] = useState<CommunicationAssignmentReview | null>(null),
    [reviewState, setReviewState] = useState<"idle" | "checking" | "checked" | "failed">("idle"),
    [reviewError, setReviewError] = useState(""),
    [fileDecision, setFileDecision] = useState<CommunicationFileDecision | "">("");
  const projects = options.projects.filter(
      (item) => item.client_id === clientId,
    ),
    estimates = options.estimates.filter(
      (item) => item.project_id === projectId,
    ),
    supplierEnquiries = options.supplierEnquiries.filter((item) => item.projectId === projectId && item.estimateId === estimateId && item.supplierId === supplierId),
    hasBlockingConflict = options.conflicts.some((item) => item.blocking),
    selectionComplete = Boolean(clientId && projectId && estimateId && supplierId && attachmentId);
  useEffect(() => {
    if (!selectionComplete || saving || result) {
      if (!selectionComplete) {
        setReview(null);
        setReviewState("idle");
        setFileDecision("");
      }
      return;
    }
    let current = true;
    setReview(null);
    setReviewState("checking");
    setReviewError("");
    setFileDecision("");
    void communicationsApi.reviewAssignment(options.providerMessageId, { clientId, projectId, estimateId, supplierId, attachmentId })
      .then((next) => {
        if (!current) return;
        setReview(next);
        setReviewState("checked");
        const needsChoice = next.conflict.decisions.length > 1 || next.conflict.kind.startsWith("same_name_");
        setFileDecision(needsChoice ? "" : next.conflict.recommendedDecision);
      })
      .catch((reason) => {
        if (!current) return;
        setReviewState("failed");
        setReviewError(reason instanceof Error ? reason.message : "The filing destination could not be checked.");
      });
    return () => { current = false; };
  }, [attachmentId, clientId, estimateId, options.providerMessageId, projectId, result, saving, selectionComplete, supplierId]);
  return (
    <div className="ui-modal-backdrop" role="presentation">
      <section
        className="ui-modal email-assignment"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-assignment-title"
      >
        <header>
          <div>
            <span className="ui-eyebrow">Existing Client filing</span>
            <h3 id="email-assignment-title">Link and file supplier document</h3>
            <small>
              Review the canonical path. No new Enquiry will be created.
            </small>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            disabled={saving}
            onClick={onClose}
          >
            Close
          </button>
        </header>
        {result ? (
          <div className="email-assignment__result">
            <p className="ui-status ui-status--success">
              {result.decision === "reuse_identical"
                ? "An identical Drive file was reused and linked successfully."
                : result.duplicate
                  ? "This exact attachment was already filed; the existing file was reused."
                  : result.decision === "save_new_revision"
                    ? "The attachment was saved safely as a new revision."
                    : "The retained document was filed successfully."}
            </p>
            <p>
              <strong>Filename</strong>
              <br />
              {result.fileName}
            </p>
            <p>
              <strong>Destination</strong>
              <br />
              {result.folderPath}
            </p>
            {result.manufacturerResponse ? <p className="ui-status"><strong>Quote Returned recorded</strong><br />Linked to supplier request revision {options.supplierEnquiries.find(item=>item.id===result.manufacturerResponse?.supplierEnquiryId)?.revisionNo??"current"}. Next: review this saved document with Manufacturer Import.</p> : null}
            <div className="ui-action-row">
              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={() => onOpenFiles(result)}
              >
                Open Files
              </button>
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={() => onImport(result)}
              >
                Import Manufacturer Estimate
              </button>
              {result.webViewLink ? (
                <a
                  className="ui-button ui-button--ghost"
                  href={result.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open saved file
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {feedback ? (
              <div
                className={`email-assignment__feedback ui-status${
                  feedback.state === "saving"
                    ? ""
                    : " ui-status--error"
                }`}
                role={feedback.state === "saving" ? "status" : "alert"}
                aria-live="polite"
              >
                <strong>{feedback.message}</strong>
                {feedback.details?.fileName || feedback.details?.folderPath || feedback.details?.eligibleFileNames?.length || feedback.details?.conflict ? (
                  <details>
                    <summary>View details</summary>
                    {feedback.details?.fileName ? <span>File: {feedback.details.fileName}</span> : null}
                    {feedback.details?.folderPath ? <span>Destination: {feedback.details.folderPath}</span> : null}
                    {feedback.details?.eligibleFileNames?.length ? <span>Eligible documents: {feedback.details.eligibleFileNames.join(", ")}</span> : null}
                    {feedback.details?.conflict?.message ? <span>{feedback.details.conflict.message}</span> : null}
                    {feedback.details?.conflict?.evidence ? <span>{feedback.details.conflict.evidence}</span> : null}
                  </details>
                ) : null}
                {feedback.state === "partial" ? (
                  <span>
                    The saved file is preserved. Retry will reuse it and will not
                    create another copy.
                  </span>
                ) : feedback.state === "failed" ? (
                  <span>No successful filing was confirmed. It is safe to retry.</span>
                ) : null}
              </div>
            ) : null}
            <div className="email-assignment__grid">
              <label>
                Client
                <select
                  className="ui-input"
                  value={clientId}
                  disabled={saving}
                  onChange={(event) => {
                    setClientId(event.currentTarget.value);
                    setProjectId("");
                    setEstimateId("");
                    setSupplierEnquiryId("");
                  }}
                >
                  <option value="">Choose Client</option>
                  {options.clients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.client_ref} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <select
                  className="ui-input"
                  value={projectId}
                  disabled={saving || !clientId}
                  onChange={(event) => {
                    setProjectId(event.currentTarget.value);
                    setEstimateId("");
                    setSupplierEnquiryId("");
                  }}
                >
                  <option value="">Choose Project</option>
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estimate
                <select
                  className="ui-input"
                  value={estimateId}
                  disabled={saving || !projectId}
                  onChange={(event) => { setEstimateId(event.currentTarget.value); setSupplierEnquiryId(""); }}
                >
                  <option value="">Choose Estimate</option>
                  {estimates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.estimate_ref}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supplier
                <select
                  className="ui-input"
                  value={supplierId}
                  disabled={saving}
                  onChange={(event) => { setSupplierId(event.currentTarget.value); setSupplierEnquiryId(""); }}
                >
                  <option value="">Choose Supplier</option>
                  {options.suppliers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {supplierEnquiries.length ? <label className="email-assignment__wide">
                Related supplier request
                <select className="ui-input" value={supplierEnquiryId} disabled={saving} onChange={event=>setSupplierEnquiryId(event.currentTarget.value)}>
                  <option value="">Not linked to a previous request</option>
                  {supplierEnquiries.map(item=><option key={item.id} value={item.id}>{item.supplierName||"Supplier"} · revision {item.revisionNo} · {item.subject}</option>)}
                </select>
                <small>Choose the request this reply answers. QuoteSuite will record Quote Returned and keep the same working Estimate.</small>
              </label>:null}
              <label className="email-assignment__wide">
                Document
                <select
                  className="ui-input"
                  value={attachmentId}
                  disabled={saving}
                  onChange={(event) =>
                    setAttachmentId(event.currentTarget.value)
                  }
                >
                  <option value="">Choose retained document</option>
                  {options.attachments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fileName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selectionComplete ? (
              <section className="email-assignment__conflicts" aria-label="File check">
                <h4>File check</h4>
                {reviewState === "checking" ? <p className="ui-status" role="status">Checking the Drive destination…</p> : null}
                {reviewState === "failed" ? (
                  <p className="ui-status ui-status--error" role="alert">
                    {reviewError} Nothing has been saved. Change a selection or close and reopen the picker to retry safely.
                  </p>
                ) : null}
                {review ? (
                  <>
                    <p className={review.conflict.kind.startsWith("same_name_") ? "ui-status ui-status--error" : "ui-status"}>{review.conflict.message}</p>
                    <small>{review.conflict.evidence}</small>
                    <details>
                      <summary>View details</summary>
                      <span>Destination: {review.folderPath}</span>
                      <span>{review.destinationExists ? "The destination folder already exists." : "The destination will be created when you save."}</span>
                    </details>
                    {review.conflict.decisions.length > 1 || review.conflict.kind.startsWith("same_name_") ? (
                      <fieldset className="email-assignment__decisions">
                        <legend>Choose how to continue</legend>
                        {review.conflict.decisions.map((decision) => (
                          <label key={decision}>
                            <input type="radio" name="file-decision" value={decision} checked={fileDecision === decision} disabled={saving} onChange={() => setFileDecision(decision)} />
                            <span>{decision === "reuse_identical" ? "Use the existing identical file" : "Save this attachment as a new revision"}</span>
                          </label>
                        ))}
                      </fieldset>
                    ) : null}
                  </>
                ) : null}
              </section>
            ) : null}
            {options.conflicts.length ? (
              <section
                className="email-assignment__conflicts"
                aria-label="Reference conflicts"
              >
                <h4>Reference review</h4>
                {options.conflicts.map((item) => (
                  <p
                    className={
                      item.blocking ? "ui-status ui-status--error" : "ui-status"
                    }
                    key={item.code}
                  >
                    {item.message}
                  </p>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={conflictsReviewed}
                    disabled={saving}
                    onChange={(event) =>
                      setConflictsReviewed(event.currentTarget.checked)
                    }
                  />{" "}
                  I reviewed these differences against the canonical records.
                </label>
              </section>
            ) : null}
            <footer>
              <button
                type="button"
                className="ui-button ui-button--ghost"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-button ui-button--primary"
                disabled={
                  saving ||
                  hasBlockingConflict ||
                  !clientId ||
                  !projectId ||
                  !estimateId ||
                  !supplierId ||
                  !attachmentId ||
                  reviewState !== "checked" ||
                  !fileDecision ||
                  (options.conflicts.length > 0 && !conflictsReviewed)
                }
                onClick={() => {
                  if (!fileDecision) return;
                  onSubmit({
                    clientId,
                    projectId,
                    estimateId,
                    supplierId,
                    supplierEnquiryId: supplierEnquiryId || undefined,
                    attachmentId,
                    conflictsReviewed,
                    fileDecision,
                  });
                }}
              >
                {saving
                  ? "Saving document…"
                  : feedback
                    ? "Retry filing"
                    : "File selected document"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default function EmailWorkspace({
  onOpenIntegrations,
  onOpenFollowUps,
  onOpenEstimateFiles,
  onImportManufacturerEstimate,
}: {
  onOpenIntegrations: () => void;
  onOpenFollowUps?: () => void;
  onOpenEstimateFiles?: (clientId: string, estimateId: string) => void;
  onImportManufacturerEstimate?: (
    clientId: string,
    estimateId: string,
    documentId: string,
  ) => void;
}) {
  const initialCached = mailboxMemoryCache.get("inbox||");
  const [status, setStatus] = useState<GoogleWorkspaceStatus | null>(null),
    [mailbox, setMailbox] = useState<MailboxMetadata | null>(null),
    [folder, setFolder] = useState<CommunicationMailboxView>("inbox"),
    [folderLabel, setFolderLabel] = useState("Inbox"),
    [query, setQuery] = useState(""),
    [unreadOnly, setUnreadOnly] = useState(false),
    [messages, setMessages] = useState<CommunicationMessageView[]>(
      initialCached?.messages || [],
    ),
    [thread, setThread] = useState<CommunicationMessageView | null>(null),
    [selectedMessage, setSelectedMessage] =
      useState<CommunicationMessageView | null>(null),
    [relationship, setRelationship] =
      useState<CommunicationContextResult | null>(null),
    [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()),
    [composer, setComposer] = useState<Composer | null>(null),
    [enquiryIntake, setEnquiryIntake] = useState<EnquiryIntake | null>(null),
    [enquiryFeedback, setEnquiryFeedback] = useState<EnquiryIntakeFeedback | null>(null),
    [assignment, setAssignment] =
      useState<CommunicationAssignmentOptions | null>(null),
    [assignmentResult, setAssignmentResult] =
      useState<CommunicationAssignmentResult | null>(null),
    [assignmentFeedback, setAssignmentFeedback] =
      useState<AssignmentFeedback | null>(null),
    [assignmentSaving, setAssignmentSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [mailboxLoading, setMailboxLoading] = useState(
      !initialCached?.messages.length,
    ),
    [syncState, setSyncState] = useState<MailboxSyncState>("idle"),
    [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null),
    [error, setError] = useState(""),
    [moreOpen, setMoreOpen] = useState(false),
    [navOpen, setNavOpen] = useState(false),
    [pageToken, setPageToken] = useState<string | null>(null),
    [pageHistory, setPageHistory] = useState<Array<string | null>>([]),
    [nextPageToken, setNextPageToken] = useState<string | null>(
      initialCached?.nextPageToken || null,
    ),
    [contextMenu, setContextMenu] = useState<ContextMenu | null>(null),
    [contextNotice, setContextNotice] = useState(""),
    [layoutMode, setLayoutMode] = useState<EmailLayoutMode>(() =>
      readPreference(EMAIL_LAYOUT_KEY, "list"),
    ),
    [readingMode, setReadingMode] = useState<EmailReadingMode>(() =>
      readPreference(EMAIL_READING_MODE_KEY, "message"),
    ),
    [rightSize, setRightSize] = useState(() =>
      readPreference(EMAIL_RIGHT_SIZE_KEY, 440),
    ),
    [bottomSize, setBottomSize] = useState(() =>
      readPreference(EMAIL_BOTTOM_SIZE_KEY, 320),
    ),
    [fullReader, setFullReader] = useState(false),
    [compact, setCompact] = useState(
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 760px)").matches,
    );
  const latestRightSize = useRef(rightSize),
    latestBottomSize = useRef(bottomSize),
    queryRef = useRef(query),
    backgroundSyncing = useRef(false),
    projectionVersion = useRef(0),
    assignmentSubmitting = useRef(false),
    enquirySubmitting = useRef(false);
  latestRightSize.current = rightSize;
  latestBottomSize.current = bottomSize;
  queryRef.current = query;
  const refreshStatus = useCallback(
    () =>
      communicationsApi
        .status()
        .then(setStatus)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Email status could not be loaded.",
          ),
        ),
    [],
  );
  const labelMap = useMemo(
    () => new Map((mailbox?.labels || []).map((label) => [label.id, label])),
    [mailbox],
  );
  const enrich = useCallback(
    (message: CommunicationMessageView): CommunicationMessageView => ({
      ...message,
      labels: (message.labels || []).map((label) => {
        const known = labelMap.get(label.id);
        return known
          ? {
              ...label,
              name: known.name,
              system: known.type === "system",
              colour: known.colour?.backgroundColor,
            }
          : label;
      }),
      threadMessages: message.threadMessages?.map((item) => enrich(item)),
    }),
    [labelMap],
  );
  const applyProjection = useCallback(
    (
      key: string,
      result: {
        messages: CommunicationMessageView[];
        nextPageToken: string | null;
      },
    ) => {
      const projected = result.messages.map(enrich);
      mailboxMemoryCache.set(key, {
        messages: projected,
        nextPageToken: result.nextPageToken,
      });
      setMessages(projected);
      setNextPageToken(result.nextPageToken);
    },
    [enrich],
  );
  const load = useCallback(
    async (
      nextFolder: CommunicationMailboxView,
      nextQuery: string,
      token: string | null = null,
      refresh = true,
    ) => {
      const providerQuery = [nextQuery.trim(), unreadOnly ? "is:unread" : ""]
          .filter(Boolean)
          .join(" "),
        key = `${nextFolder}|${providerQuery}|${token || ""}`,
        memory = mailboxMemoryCache.get(key);
      setError("");
      if (memory) applyProjection(key, memory);
      else {
        setMessages([]);
        setMailboxLoading(true);
      }
      try {
        const cached = await communicationsApi.list(
          nextFolder,
          providerQuery,
          token,
        );
        applyProjection(key, cached);
        setMailboxLoading(false);
        if (!refresh) return;
        setSyncState("syncing");
        try {
          const reconciled = await communicationsApi.sync(
            nextFolder,
            providerQuery,
            token,
          );
          applyProjection(key, reconciled);
          setLastSyncedAt(
            reconciled.sync?.lastSuccessAt || new Date().toISOString(),
          );
          setSyncState("synced");
        } catch (reason) {
          setSyncState(
            typeof navigator !== "undefined" && !navigator.onLine
              ? "offline"
              : "failed",
          );
          setError(
            `${reason instanceof Error ? reason.message : "Mailbox refresh failed."} Cached mail remains available.`,
          );
        }
      } catch (reason) {
        setMailboxLoading(false);
        setError(
          reason instanceof Error
            ? reason.message
            : "Mailbox could not be loaded.",
        );
      }
    },
    [applyProjection, unreadOnly],
  );
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)"),
      change = () => setCompact(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (status?.connected && status.capabilities.gmail.available)
      void communicationsApi
        .mailbox()
        .then(setMailbox)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Mailbox navigation could not be loaded.",
          ),
        );
  }, [status?.connected, status?.capabilities.gmail.available]);
  useEffect(() => {
    if (status?.connected && status.capabilities.gmail.available)
      void loadRef.current(folder, queryRef.current, null);
  }, [
    folder,
    unreadOnly,
    status?.connected,
    status?.capabilities.gmail.available,
  ]);
  useEffect(() => {
    if (!status?.connected || !status.capabilities.gmail.available) return;
    const refresh = async () => {
        if (backgroundSyncing.current || document.visibilityState !== "visible")
          return;
        backgroundSyncing.current = true;
        try {
          await loadRef.current(folder, query, pageToken);
          setMailbox(await communicationsApi.mailbox());
        } finally {
          backgroundSyncing.current = false;
        }
      },
      onFocus = () => void refresh(),
      onOnline = () => void refresh(),
      onVisible = () => {
        if (document.visibilityState === "visible") void refresh();
      };
    const fallback = window.setInterval(() => void refresh(), 90000),
      signals = window.setInterval(
        () =>
          void communicationsApi
            .changeState()
            .then((state) => {
              if (state.projectionVersion > projectionVersion.current) {
                projectionVersion.current = state.projectionVersion;
                void loadRef.current(folder, query, pageToken, false);
                void communicationsApi.mailbox().then(setMailbox);
              }
            })
            .catch(() => {}),
        15000,
      );
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(fallback);
      window.clearInterval(signals);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    folder,
    pageToken,
    query,
    status?.connected,
    status?.capabilities.gmail.available,
  ]);
  useEffect(() => {
    setMessages((current) => current.map(enrich));
    setThread((current) => (current ? enrich(current) : current));
    setSelectedMessage((current) => (current ? enrich(current) : current));
  }, [enrich]);
  const navigation = useMemo(
    () =>
      deriveMailboxNavigation(
        mailbox?.labels || [],
        mailbox?.capabilities || [],
      ),
    [mailbox],
  );
  const chooseFolder = (id: string, label: string) => {
    setFolder(mailboxFolder(id));
    setFolderLabel(label);
    setPageToken(null);
    setPageHistory([]);
    setThread(null);
    setSelectedMessage(null);
    setRelationship(null);
    setFullReader(false);
    setSelectedIds(new Set());
    setNavOpen(false);
  };
  const openThread = async (message: CommunicationMessageView) => {
    setThread(enrich(message));
    setSelectedMessage(enrich(message));
    setFullReader(compact || layoutMode === "list");
    setBusy(true);
    setError("");
    setEnquiryFeedback(null);
    setRelationship(null);
    try {
      const exact = message.providerMessageId
        ? await communicationsApi.read(message.providerMessageId)
        : message;
      let openedMessage = exact;
      if (
        exact.unread &&
        exact.threadId &&
        (mailbox?.capabilities || []).some(
          (capability) => capability.id === "read_state" && capability.available,
        )
      ) {
        try {
          await communicationsApi.command([exact.threadId], "mark_read");
          openedMessage = { ...exact, unread: false };
          setMessages((current) =>
            current.map((item) =>
              item.threadId === exact.threadId ? { ...item, unread: false } : item,
            ),
          );
        } catch (reason) {
          setError(
            `Message opened, but it could not be marked read. ${
              reason instanceof Error ? reason.message : "Provider request failed."
            }`,
          );
        }
      }
      setSelectedMessage(enrich(openedMessage));
      if (readingMode === "conversation" && message.threadId)
        setThread(enrich(await communicationsApi.thread(message.threadId)));
      else setThread(enrich(openedMessage));
      if (exact.providerMessageId)
        setRelationship(
          await communicationsApi.context(exact.providerMessageId),
        );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Message could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  };
  const beginEnquiryIntake = async () => {
    const providerMessageId = activeMessage?.providerMessageId;
    if (!providerMessageId) return;
    setBusy(true);
    setError("");
    setEnquiryFeedback(null);
    try {
      const draft = await communicationsApi.enquiryIntake(providerMessageId);
      if (draft.existing) {
        setContextNotice(`Already linked to ${draft.existing.enquiryRef}.`);
        return;
      }
      setEnquiryIntake({ ...draft, providerMessageId });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Enquiry details could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  };
  const beginAssignment = async () => {
    const providerMessageId = activeMessage?.providerMessageId;
    if (!providerMessageId) return;
    setBusy(true);
    setError("");
    setAssignmentResult(null);
    setAssignmentFeedback(null);
    try {
      setAssignment(
        await communicationsApi.assignmentOptions(providerMessageId),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The existing-record picker could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submitAssignment = async (value: {
    clientId: string;
    projectId: string;
    estimateId: string;
    supplierId: string;
    attachmentId: string;
    conflictsReviewed: boolean;
    fileDecision: CommunicationFileDecision;
  }) => {
    const providerMessageId = activeMessage?.providerMessageId;
    if (!providerMessageId || assignmentSubmitting.current) return;
    assignmentSubmitting.current = true;
    setAssignmentSaving(true);
    setAssignmentFeedback({
      state: "saving",
      message: "Saving document…",
    });
    setError("");
    try {
      const result = await communicationsApi.assignDocument(
        providerMessageId,
        value,
      );
      setAssignmentResult(result);
      setRelationship(await communicationsApi.context(providerMessageId));
      setContextNotice(
        result.decision === "reuse_identical"
          ? "The identical Drive file was reused and linked; no duplicate was created."
          : result.duplicate
            ? "The exact attachment was already filed and has been linked."
            : result.decision === "save_new_revision"
              ? "Supplier document saved as a new revision and linked to the selected records."
              : "Supplier document filed and linked to the selected canonical records.",
      );
    } catch (reason) {
      let code = "",
        details: AssignmentFeedback["details"];
      if (reason instanceof ApiRequestError && reason.body) {
        try {
          const parsed = JSON.parse(reason.body);
          code = typeof parsed?.code === "string" ? parsed.code : "";
          details =
            parsed?.details && typeof parsed.details === "object"
              ? parsed.details
              : undefined;
        } catch {
          // The ordinary error message below remains safe for non-JSON responses.
        }
      }
      const partial = code === "communication_assignment_partial_success";
      setAssignmentFeedback({
        state: partial ? "partial" : "failed",
        message: partial
          ? "The document was saved, but QuoteSuite could not finish linking it."
          : reason instanceof Error
            ? reason.message
            : "The supplier document could not be filed.",
        details,
      });
    } finally {
      assignmentSubmitting.current = false;
      setAssignmentSaving(false);
    }
  };
  const submitEnquiryIntake = async (
    draft: EnquiryIntake,
    selectedAttachmentIds: string[],
    createNewConfirmed: boolean,
  ) => {
    if (enquirySubmitting.current) return;
    enquirySubmitting.current = true;
    setBusy(true);
    setEnquiryFeedback({ state:"creating", message:"Creating Enquiry…" });
    setError("");
    try {
      const result = await communicationsApi.createEnquiry(
        draft.providerMessageId,
        {
          displayName: draft.displayName,
          email: draft.email,
          projectName: draft.projectName,
          brief: draft.brief,
          selectedAttachmentIds,
          existingRecordsReviewed: true,
          createNewConfirmed,
        },
      );
      setEnquiryIntake(null);
      setEnquiryFeedback(null);
      setContextNotice(
        `${result.enquiryRef} ${result.resumedIncomplete ? "resumed and linked" : "created"}. ${result.selectedAttachmentCount} reviewed attachment(s) retained for the Client / Project file handoff. Next: review the Enquiry and connect it to the right Client and Project.`,
      );
      setRelationship(await communicationsApi.context(draft.providerMessageId));
    } catch (reason) {
      setEnquiryFeedback({ state:"failed", message:reason instanceof Error ? reason.message : "Enquiry could not be created." });
    } finally {
      enquirySubmitting.current = false;
      setBusy(false);
    }
  };
  const linkEnquiryIntakeExisting = async (draft: EnquiryIntake, match: EnquiryIntake["likelyMatches"][number]) => {
    if (enquirySubmitting.current) return;
    enquirySubmitting.current = true;
    setBusy(true);
    setEnquiryFeedback({ state:"linking", message:"Linking existing record…" });
    setError("");
    try {
      const next = await communicationsApi.link(draft.providerMessageId, { kind:match.kind, id:match.id });
      setRelationship(next);
      setEnquiryIntake(null);
      setEnquiryFeedback(null);
      setContextNotice(`Email linked to existing ${match.kind}: ${match.label}. No new Enquiry was created.`);
    } catch (reason) {
      setEnquiryFeedback({ state:"failed", message:reason instanceof Error ? reason.message : "The existing record could not be linked." });
    } finally {
      enquirySubmitting.current = false;
      setBusy(false);
    }
  };
  const activeMessage = selectedMessage || thread;
  const linkSuggestion = async (suggestion: CommunicationContextSuggestion) => {
    const providerMessageId = activeMessage?.providerMessageId;
    if (!providerMessageId) return;
    setBusy(true);
    setError("");
    try {
      setRelationship(
        await communicationsApi.link(providerMessageId, {
          kind: suggestion.kind,
          id: suggestion.id,
        }),
      );
      setContextNotice(`${suggestion.label} linked after explicit review.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Relationship could not be linked.",
      );
    } finally {
      setBusy(false);
    }
  };
  const unlinkRelationship = async (link: { kind: string; id: string }) => {
    const providerMessageId = activeMessage?.providerMessageId;
    if (!providerMessageId) return;
    setBusy(true);
    setError("");
    try {
      setRelationship(await communicationsApi.unlink(providerMessageId, link));
      setContextNotice(
        `${link.kind.replaceAll("_", " ")} relationship removed.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Relationship could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const beginReply = (message: CommunicationMessageView, mode: ComposeMode) => {
    const recipients =
      mode === "reply_all"
        ? [...message.from, ...message.to, ...message.cc].filter(
            (value) => address(value) !== status?.account?.email,
          )
        : message.from;
    setComposer({
      mode,
      providerMessageId: message.providerMessageId || undefined,
      to: mode === "forward" ? "" : recipients.join(", "),
      cc: "",
      bcc: "",
      subject:
        mode === "forward"
          ? `Fwd: ${message.subject.replace(/^Fwd:\s*/i, "")}`
          : `Re: ${message.subject.replace(/^Re:\s*/i, "")}`,
      bodyHtml: "",
      attachments: [],
    });
  };
  const submit = async (kind: "draft" | "send") => {
    if (!composer) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        providerMessageId: composer.providerMessageId,
        to: splitAddresses(composer.to),
        cc: splitAddresses(composer.cc),
        bcc: splitAddresses(composer.bcc),
        subject: composer.subject,
        bodyHtml: composer.bodyHtml,
        attachments: composer.attachments,
      };
      if (kind === "draft") await communicationsApi.draft(payload);
      else if (composer.mode === "reply" || composer.mode === "reply_all")
        await communicationsApi.reply(payload);
      else if (composer.mode === "forward")
        await communicationsApi.forward(payload);
      else await communicationsApi.send(payload);
      setComposer(null);
      chooseFolder(
        kind === "draft" ? "DRAFT" : "SENT",
        kind === "draft" ? "Drafts" : "Sent",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Email could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const runCommand = async (
    command: string,
    targets = selectedIds,
    labelId?: string,
  ) => {
    const threadIds = [...targets]
      .map(
        (id) =>
          messages.find((item) => item.id === id)?.threadId ||
          (activeMessage?.id === id ? activeMessage.threadId : null),
      )
      .filter((id): id is string => Boolean(id));
    if (!threadIds.length) return;
    if (
      command === "trash" &&
      !window.confirm(
        `Move ${threadIds.length} conversation${threadIds.length === 1 ? "" : "s"} to Bin?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await communicationsApi.command(threadIds, command, labelId);
      await load(folder, query, pageToken, false);
      if (mailbox) setMailbox(await communicationsApi.mailbox());
    } catch (reason) {
      const detail =
        reason instanceof Error ? reason.message : "Provider request failed.";
      setError(`Mailbox action could not be completed. ${detail} Try again.`);
    } finally {
      setBusy(false);
    }
  };
  const handleContextAction = (action: MailContextAction, labelId?: string) => {
    if (!contextMenu) return;
    if (action.id === "submenu_back") {
      setContextMenu({ ...contextMenu, submenu: null });
      return;
    }
    const resolution = resolveContextMenuAction(action, labelId);
    if (resolution?.type === "submenu") {
      setContextMenu({ ...contextMenu, submenu: resolution.submenu });
      return;
    }
    const message = contextMenu.message;
    if (resolution?.type === "command") {
      void runCommand(
        resolution.command,
        new Set([message.id]),
        resolution.labelId,
      );
      setContextMenu(null);
      return;
    }
    if (
      action.id === "reply" ||
      action.id === "reply_all" ||
      action.id === "forward"
    )
      beginReply(message, action.id);
    else if (action.id === "find_sender") {
      const sender = address(message.from[0] || "");
      setQuery(`from:${sender}`);
      void load(folder, `from:${sender}`);
    } else if (action.id === "find_subject") {
      const next = `subject:${JSON.stringify(message.subject)}`;
      setQuery(next);
      void load(folder, next);
    } else if (action.id === "open_window") {
      const popup = window.open(
        "",
        "quotesuite-mail-reader",
        "popup=yes,width=900,height=720",
      );
      if (popup) {
        popup.opener = null;
        popup.document.write(
          sanitizeEmailHtml(
            message.bodyHtml || `<pre>${message.bodyText}</pre>`,
            { allowRemoteImages: false },
          ),
        );
        popup.document.close();
      }
    } else if (action.id.startsWith("link_")) {
      setContextNotice(
        "Review exact-evidence suggestions in QuoteSuite context; nothing is linked automatically.",
      );
      void openThread(message);
    } else if (action.id === "follow_up" && onOpenFollowUps) onOpenFollowUps();
    setContextMenu(null);
  };
  const setLayout = (mode: EmailLayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem(EMAIL_LAYOUT_KEY, JSON.stringify(mode));
    setFullReader(false);
    if (mode === "list") {
      setThread(null);
      setSelectedMessage(null);
      setRelationship(null);
    }
  };
  const changeReadingMode = async (mode: EmailReadingMode) => {
    setReadingMode(mode);
    localStorage.setItem(EMAIL_READING_MODE_KEY, JSON.stringify(mode));
    if (mode === "conversation" && activeMessage?.threadId) {
      setBusy(true);
      try {
        setThread(
          enrich(await communicationsApi.thread(activeMessage.threadId)),
        );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Conversation could not be loaded.",
        );
      } finally {
        setBusy(false);
      }
    } else if (activeMessage) setThread(activeMessage);
  };
  const beginResize =
    (axis: "right" | "bottom") =>
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const start = axis === "right" ? event.clientX : event.clientY,
        initial = axis === "right" ? rightSize : bottomSize,
        container = event.currentTarget.parentElement?.getBoundingClientRect();
      const move = (next: PointerEvent) => {
        const delta = (axis === "right" ? next.clientX : next.clientY) - start,
          max =
            axis === "right"
              ? Math.max(360, (container?.width || 1000) - 360)
              : Math.max(260, (container?.height || 700) - 260),
          bounded = Math.min(
            max,
            Math.max(axis === "right" ? 320 : 220, initial + delta),
          );
        if (axis === "right") setRightSize(bounded);
        else setBottomSize(bounded);
      };
      const stop = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", stop);
        localStorage.setItem(
          axis === "right" ? EMAIL_RIGHT_SIZE_KEY : EMAIL_BOTTOM_SIZE_KEY,
          JSON.stringify(
            axis === "right"
              ? latestRightSize.current
              : latestBottomSize.current,
          ),
        );
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop);
    };
  const resetDivider = (axis: "right" | "bottom") => {
    if (axis === "right") {
      setRightSize(440);
      localStorage.setItem(EMAIL_RIGHT_SIZE_KEY, "440");
    } else {
      setBottomSize(320);
      localStorage.setItem(EMAIL_BOTTOM_SIZE_KEY, "320");
    }
  };
  const keyResize =
    (axis: "right" | "bottom") =>
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const decrease =
          axis === "right"
            ? event.key === "ArrowLeft"
            : event.key === "ArrowUp",
        increase =
          axis === "right"
            ? event.key === "ArrowRight"
            : event.key === "ArrowDown";
      if (!decrease && !increase) return;
      event.preventDefault();
      const next = Math.max(
        axis === "right" ? 320 : 220,
        (axis === "right" ? rightSize : bottomSize) + (increase ? 24 : -24),
      );
      if (axis === "right") {
        setRightSize(next);
        localStorage.setItem(EMAIL_RIGHT_SIZE_KEY, JSON.stringify(next));
      } else {
        setBottomSize(next);
        localStorage.setItem(EMAIL_BOTTOM_SIZE_KEY, JSON.stringify(next));
      }
    };
  if (!status)
    return (
      <section className="email-workspace ui-card">
        <p>{error || "Loading Email connection…"}</p>
      </section>
    );
  if (!status.connected || !status.capabilities.gmail.available) {
    const infrastructureUnavailable =
      status.state === "configured_encryption_unavailable";
    return (
      <section className="email-workspace email-workspace--disconnected ui-card">
        <div>
          <h2>Email</h2>
          <p>
            {infrastructureUnavailable
              ? "Google Workspace configuration is retained. Email will recover automatically when the server encryption service is restored."
              : status.connected
                ? "Reconnect Google Workspace to grant the Gmail capability required for Inbox, Sent, Drafts, search, compose, reply, forward and attachments."
                : status.state === "reconnect_required"
                  ? "Google Workspace requires administrator review before Email can resume."
                  : "Connect Google Workspace once to enable Gmail and Google Drive. QuoteSuite does not show sample or fake mailbox data."}
          </p>
          {status.error ? <p role="alert">{status.error}</p> : null}
        </div>
        <button
          type="button"
          className="ui-button ui-button--primary"
          onClick={onOpenIntegrations}
        >
          Administration → Integrations
          {infrastructureUnavailable ? "" : " → Google Workspace"}
        </button>
      </section>
    );
  }
  const allSelected =
      Boolean(messages.length) && selectedIds.size === messages.length,
    effectiveLayout = compact ? "list" : layoutMode,
    syncLabel =
      syncState === "syncing"
        ? "Syncing…"
        : syncState === "offline"
          ? `Offline — showing mail synced at ${lastSyncedAt ? formatMailboxDateTime(lastSyncedAt) : "the last successful sync"}`
          : syncState === "failed"
            ? "Sync delayed — showing cached mail"
            : syncState === "synced"
              ? lastSyncedAt
                ? "Synced just now"
                : "Synced"
              : "Cached mail";
  const qsViews: Array<{ id: CommunicationMailboxView; label: string }> = [
    { id: "quotesuite:clients", label: "Clients" },
    { id: "quotesuite:projects", label: "Projects" },
    { id: "quotesuite:estimates", label: "Estimates" },
    { id: "quotesuite:orders", label: "Orders" },
    { id: "quotesuite:suppliers", label: "Suppliers" },
    { id: "quotesuite:unlinked", label: "Unlinked" },
    { id: "quotesuite:follow_up", label: "Follow Up" },
  ];
  const layoutControls = (
    <>
      <div
        className="email-layout-controls"
        role="group"
        aria-label="Email reading layout"
      >
        <button
          type="button"
          className="ui-button ui-button--ghost"
          aria-pressed={layoutMode === "list"}
          onClick={() => setLayout("list")}
          title="List / full reader"
        >
          ☷ <span>List</span>
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost"
          aria-pressed={layoutMode === "right"}
          disabled={compact}
          onClick={() => setLayout("right")}
          title="Right preview"
        >
          ◫ <span>Right</span>
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost"
          aria-pressed={layoutMode === "bottom"}
          disabled={compact}
          onClick={() => setLayout("bottom")}
          title="Bottom preview"
        >
          ⬒ <span>Bottom</span>
        </button>
      </div>
      <button
        type="button"
        className={
          unreadOnly
            ? "ui-button ui-button--primary email-unread-filter"
            : "ui-button ui-button--ghost email-unread-filter"
        }
        aria-pressed={unreadOnly}
        onClick={() => {
          setUnreadOnly((value) => !value);
          setPageToken(null);
          setPageHistory([]);
          setThread(null);
          setSelectedIds(new Set());
        }}
      >
        {unreadOnly ? "✓ Unread · Show All" : "Unread"}
      </button>
    </>
  );
  const listPane = (
    <div className="email-list-pane">
      <div className="email-list-toolbar">
        <form
          className="email-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPageToken(null);
            setPageHistory([]);
            void load(folder, query);
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search email"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search mail"
          />
          <button
            type="submit"
            className="ui-button ui-button--ghost"
            disabled={busy}
          >
            Search
          </button>
        </form>
        <div className="email-list-toolbar__actions">
          {layoutControls}
          <label className="email-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              aria-label="Select all messages"
              onChange={(event) =>
                setSelectedIds(
                  event.currentTarget.checked
                    ? new Set(messages.map((item) => item.id))
                    : new Set(),
                )
              }
            />
          </label>
          {iconButton(
            "Refresh mailbox",
            "↻",
            () => void load(folder, query, pageToken),
            busy || syncState === "syncing",
          )}
          {selectedIds.size ? (
            <>
              {iconButton(
                "Archive selected",
                "▱",
                () => void runCommand("archive"),
                busy,
              )}
              {iconButton(
                "Delete selected",
                "⌫",
                () => void runCommand("trash"),
                busy,
              )}
              {iconButton(
                "Mark selected read",
                "○",
                () => void runCommand("mark_read"),
                busy,
              )}
              {iconButton(
                "Mark selected unread",
                "●",
                () => void runCommand("mark_unread"),
                busy,
              )}
              {iconButton(
                "Star selected",
                "☆",
                () => void runCommand("star"),
                busy,
              )}
            </>
          ) : null}
          <span className="email-list-toolbar__range">
            {selectedIds.size ? `${selectedIds.size} selected` : folderLabel}
          </span>
          {iconButton(
            "Previous page",
            "‹",
            () => {
              const history = [...pageHistory],
                previous = history.pop() ?? null;
              setPageHistory(history);
              setPageToken(previous);
              void load(folder, query, previous);
            },
            busy || !pageHistory.length,
          )}
          {iconButton(
            "Next page",
            "›",
            () => {
              setPageHistory((history) => [...history, pageToken]);
              setPageToken(nextPageToken);
              void load(folder, query, nextPageToken);
            },
            busy || !nextPageToken,
          )}
        </div>
      </div>
      <div
        className="email-mailbox-status"
        role="status"
        data-sync-state={syncState}
      >
        {syncLabel}
      </div>
      {error ? (
        <p
          className="ui-status ui-status--error email-workspace__error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {contextNotice ? (
        <div className="email-context-notice ui-status" role="status">
          {contextNotice}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setContextNotice("")}
          >
            ×
          </button>
        </div>
      ) : null}
      <div
        className="email-message-list"
        role="listbox"
        aria-label={`${folderLabel} messages`}
        aria-multiselectable="true"
      >
        {mailboxLoading && !messages.length ? (
          <div className="ui-empty-state">
            Loading messages…
          </div>
        ) : messages.length ? (
          messages.map((message) => {
            const row = projectMailboxRow(message, folder),
              selected = selectedIds.has(message.id),
              previewSelected =
                selectedMessage?.id === message.id ||
                Boolean(
                  selectedMessage?.providerMessageId &&
                    selectedMessage.providerMessageId ===
                      message.providerMessageId,
                );
            return (
              <div
                role="option"
                tabIndex={0}
                aria-selected={selected || previewSelected}
                aria-label={`${row.unread ? "Unread" : "Read"}: ${row.sender}, ${row.subject}, ${row.dateTime}`}
                data-message-id={message.providerMessageId || ""}
                data-thread-id={message.threadId || ""}
                key={message.id}
                className={`email-message-row ui-interactive-row${row.unread ? " is-unread" : ""}${selected ? " is-selected" : ""}${previewSelected ? " is-preview-selected" : ""}`}
                onClick={() => void openThread(message)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void openThread(message);
                  }
                  if (event.key === " ") {
                    event.preventDefault();
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(message.id)) next.delete(message.id);
                      else next.add(message.id);
                      return next;
                    });
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    message,
                    submenu: null,
                  });
                }}
              >
                <label
                  className="email-message-row__select"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    aria-label={`Select ${row.subject}`}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (checked) next.add(message.id);
                        else next.delete(message.id);
                        return next;
                      });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={`email-message-row__star${row.starred ? " is-starred" : ""}`}
                  aria-label={
                    row.starred ? "Unstar conversation" : "Star conversation"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    void runCommand(
                      row.starred ? "unstar" : "star",
                      new Set([message.id]),
                    );
                  }}
                >
                  {row.starred ? "★" : "☆"}
                </button>
                <span className="email-message-row__sender">{row.sender}</span>
                <span className="email-message-row__labels">
                  {row.labels.slice(0, 2).map((label) => (
                    <span key={label}>{label.split("/").at(-1)}</span>
                  ))}
                </span>
                <span className="email-message-row__content">
                  <span className="email-message-row__subject">
                    {row.subject}
                  </span>
                  <small> — {row.snippet}</small>
                </span>
                <span className="email-message-row__meta">
                  {row.attachmentCount ? (
                    <span
                      title={`${row.attachmentCount} attachment${row.attachmentCount === 1 ? "" : "s"}`}
                    >
                      ⌕{row.attachmentCount}
                    </span>
                  ) : null}
                  {row.threadCount > 1 ? (
                    <span title={`${row.threadCount} messages`}>
                      {row.threadCount}
                    </span>
                  ) : null}
                </span>
                <time dateTime={message.sentAt || undefined}>
                  {row.dateTime}
                </time>
                <button
                  type="button"
                  className="email-message-row__more"
                  aria-label="More conversation actions"
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      x: rect.right,
                      y: rect.bottom,
                      message,
                      submenu: null,
                    });
                  }}
                >
                  ⋮
                </button>
              </div>
            );
          })
        ) : (
          <div className="ui-empty-state">
            No messages returned by this mailbox view.
          </div>
        )}
      </div>
    </div>
  );
  const readerPane =
    thread && activeMessage ? (
      <ConversationReader
        thread={thread}
        activeMessage={activeMessage}
        relationship={relationship}
        readingMode={readingMode}
        busy={busy}
        onBack={() => {
          setFullReader(false);
          if (effectiveLayout === "list") {
            setThread(null);
            setSelectedMessage(null);
            setRelationship(null);
          }
        }}
        onOpenFull={
          effectiveLayout !== "list" && !fullReader
            ? () => setFullReader(true)
            : undefined
        }
        onMore={() =>
          setContextMenu({
            x: window.innerWidth - 300,
            y: 100,
            message: activeMessage,
            submenu: null,
          })
        }
        onCommand={(command) =>
          void runCommand(command, new Set([activeMessage.id]))
        }
        onReply={beginReply}
        onLink={(item) => void linkSuggestion(item)}
        onUnlink={(link) => void unlinkRelationship(link)}
        onAddEnquiry={() => void beginEnquiryIntake()}
        onLinkExisting={() => void beginAssignment()}
        onReadingMode={(mode) => void changeReadingMode(mode)}
      />
    ) : (
      <div className="email-preview-empty">
        <strong>Select a message</strong>
        <span>The selected message will open here.</span>
      </div>
    );
  const mainContent =
    fullReader || (effectiveLayout === "list" && thread) ? (
      readerPane
    ) : effectiveLayout === "list" ? (
      listPane
    ) : (
      <div
        className={`email-preview-layout email-preview-layout--${effectiveLayout}`}
        style={
          {
            "--email-right-size": `${rightSize}px`,
            "--email-bottom-size": `${bottomSize}px`,
          } as React.CSSProperties
        }
      >
        {listPane}
        <div
          className="email-preview-divider"
          role="separator"
          aria-orientation={
            effectiveLayout === "right" ? "vertical" : "horizontal"
          }
          aria-label="Resize email preview"
          tabIndex={0}
          onPointerDown={beginResize(effectiveLayout)}
          onKeyDown={keyResize(effectiveLayout)}
          onDoubleClick={() => resetDivider(effectiveLayout)}
          title="Drag to resize; double-click to reset"
        />
        <div className="email-preview-reader">{readerPane}</div>
      </div>
    );
  return (
    <section className="email-workspace" aria-label="Email workspace">
      <header className="email-workspace__header">
        <div className="email-workspace__identity">
          <button
            type="button"
            className="ui-button ui-button--icon ui-button--ghost email-workspace__nav-toggle"
            aria-label="Toggle mail navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            ☰
          </button>
          <div>
            <h2>Email</h2>
            <small>
              {status.account?.name || status.account?.email} · Google Workspace
            </small>
          </div>
        </div>
        <button
          className="ui-button ui-button--primary email-workspace__compose-mobile"
          onClick={() => setComposer(emptyComposer())}
        >
          ＋ Compose
        </button>
      </header>
      <div className="email-workspace__layout">
        <nav
          className={`email-mailnav ui-card${navOpen ? " is-open" : ""}`}
          aria-label="Mailbox navigation"
        >
          <button
            className="ui-button ui-button--primary email-mailnav__compose"
            onClick={() => setComposer(emptyComposer())}
          >
            ＋ Compose
          </button>
          <div className="email-mailnav__group">
            {navigation.primary.map((item) => (
              <button
                type="button"
                key={item.id}
                className={folder === mailboxFolder(item.id) ? "is-active" : ""}
                aria-current={
                  folder === mailboxFolder(item.id) ? "page" : undefined
                }
                onClick={() => chooseFolder(item.id, item.label)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {item.count ? <strong>{item.count}</strong> : null}
              </button>
            ))}
          </div>
          {navigation.category.length ? (
            <div className="email-mailnav__group email-mailnav__group--categories">
              <small>Categories</small>
              {navigation.category.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    folder === mailboxFolder(item.id) ? "is-active" : ""
                  }
                  onClick={() => chooseFolder(item.id, item.label)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count ? <strong>{item.count}</strong> : null}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="email-mailnav__more"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
          >
            {moreOpen ? "⌃ Less" : "⌄ More"}
          </button>
          {moreOpen ? (
            <>
              <div className="email-mailnav__group">
                {navigation.more.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={
                      folder === mailboxFolder(item.id) ? "is-active" : ""
                    }
                    onClick={() => chooseFolder(item.id, item.label)}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.count ? <strong>{item.count}</strong> : null}
                  </button>
                ))}
              </div>
              {navigation.userLabels.length ? (
                <div className="email-mailnav__group">
                  <small>Labels</small>
                  {navigation.userLabels.map((label) => (
                    <button
                      type="button"
                      key={label.id}
                      className={
                        folder === mailboxFolder(label.id) ? "is-active" : ""
                      }
                      onClick={() => chooseFolder(label.id, label.name)}
                    >
                      <span aria-hidden="true">▰</span>
                      <span
                        className="email-label-indent"
                        style={
                          {
                            "--label-depth": String(
                              label.name.split("/").length - 1,
                            ),
                          } as React.CSSProperties
                        }
                      >
                        {label.name.split("/").at(-1)}
                      </span>
                      {label.messagesUnread ? (
                        <strong>{label.messagesUnread}</strong>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          <div className="email-mailnav__divider" />
          <div className="email-mailnav__group">
            <small>QuoteSuite</small>
            {qsViews.map((item) => (
              <button
                type="button"
                key={item.id}
                className={folder === item.id ? "is-active" : ""}
                onClick={() => {
                  setFolder(item.id);
                  setFolderLabel(item.label);
                  setThread(null);
                  setNavOpen(false);
                }}
              >
                <span aria-hidden="true">◇</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <main className="email-main ui-card">{mainContent}</main>
      </div>
      {contextMenu ? (
        <MailContextMenu
          menu={contextMenu}
          actions={buildContextActions(
            contextMenu.message,
            mailbox?.capabilities || [],
          )}
          labels={mailbox?.labels || []}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      {enquiryIntake ? (
        <EnquiryIntakeDialog
          draft={enquiryIntake}
          busy={busy}
          feedback={enquiryFeedback}
          onClose={() => { setEnquiryIntake(null); setEnquiryFeedback(null); }}
          onSubmit={(draft, selected, createNewConfirmed) =>
            void submitEnquiryIntake(draft, selected, createNewConfirmed)
          }
          onLinkExisting={(match) => void linkEnquiryIntakeExisting(enquiryIntake, match)}
        />
      ) : null}
      {assignment ? (
        <AssignmentDialog
          options={assignment}
          result={assignmentResult}
          saving={assignmentSaving}
          feedback={assignmentFeedback}
          onClose={() => {
            setAssignment(null);
            setAssignmentResult(null);
            setAssignmentFeedback(null);
          }}
          onSubmit={(value) => void submitAssignment(value)}
          onOpenFiles={(result) => {
            setAssignment(null);
            onOpenEstimateFiles?.(
              result.navigation.clientId,
              result.navigation.estimateId,
            );
          }}
          onImport={(result) => {
            setAssignment(null);
            onImportManufacturerEstimate?.(
              result.navigation.clientId,
              result.navigation.estimateId,
              result.documentId,
            );
          }}
        />
      ) : null}
      {composer ? (
        <div className="ui-modal-backdrop" role="presentation">
          <form
            className="ui-modal email-composer"
            role="dialog"
            aria-modal="true"
            aria-label="Email composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submit("send");
            }}
          >
            <header>
              <div>
                <h3>
                  {composer.mode === "compose"
                    ? "Compose Email"
                    : composer.mode === "forward"
                      ? "Forward"
                      : "Reply"}
                </h3>
                <small>
                  Provider-neutral composer · Google Workspace delivery
                </small>
              </div>
              <button
                type="button"
                className="ui-button ui-button--icon ui-button--ghost"
                aria-label="Close composer"
                onClick={() => setComposer(null)}
              >
                ×
              </button>
            </header>
            {(["to", "cc", "bcc"] as const).map((field) => (
              <label key={field}>
                <span>{field.toUpperCase()}</span>
                <input
                  className="ui-input"
                  value={composer[field]}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setComposer((current) =>
                      current ? { ...current, [field]: value } : current,
                    );
                  }}
                />
              </label>
            ))}
            <label>
              <span>Subject</span>
              <input
                className="ui-input"
                value={composer.subject}
                onChange={(event) => {
                  const subject = event.currentTarget.value;
                  setComposer((current) =>
                    current ? { ...current, subject } : current,
                  );
                }}
              />
            </label>
            <label>
              <span>Message</span>
              <textarea
                className="ui-textarea"
                rows={11}
                value={composer.bodyHtml}
                onChange={(event) => {
                  const bodyHtml = event.currentTarget.value;
                  setComposer((current) =>
                    current ? { ...current, bodyHtml } : current,
                  );
                }}
              />
            </label>
            <label className="email-composer__file">
              <span>Attachments</span>
              <input
                type="file"
                multiple
                onChange={(event) => {
                  const files = [...(event.currentTarget.files || [])];
                  void Promise.all(files.map(fileAttachment)).then(
                    (attachments) =>
                      setComposer((current) =>
                        current
                          ? {
                              ...current,
                              attachments: [
                                ...current.attachments,
                                ...attachments,
                              ],
                            }
                          : current,
                      ),
                  );
                }}
              />
            </label>
            {composer.attachments.map((item, index) => (
              <div
                className="email-composer__attachment"
                key={`${item.fileName}-${index}`}
              >
                <span>▧ {item.fileName}</span>
                <button
                  type="button"
                  className="ui-button ui-button--ghost"
                  onClick={() =>
                    setComposer((current) =>
                      current
                        ? {
                            ...current,
                            attachments: current.attachments.filter(
                              (_, at) => at !== index,
                            ),
                          }
                        : current,
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <footer>
              <button
                type="button"
                className="ui-button ui-button--danger"
                onClick={() => setComposer(null)}
              >
                Discard
              </button>
              <span />
              <button
                type="button"
                className="ui-button ui-button--ghost"
                disabled={busy}
                onClick={() => void submit("draft")}
              >
                Save Draft
              </button>
              <button
                type="submit"
                className="ui-button ui-button--primary"
                disabled={
                  busy || !composer.to.trim() || !composer.subject.trim()
                }
              >
                Send
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
