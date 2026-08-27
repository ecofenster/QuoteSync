export type CommunicationProviderId = "google_workspace" | "microsoft_365";
export type CommunicationFolder = "inbox" | "sent" | "drafts" | "trash" | "spam" | "other";
export type CommunicationMailboxView = "inbox" | "sent" | "drafts" | "starred" | "snoozed" | "important" | "all" | "spam" | "trash" | "social" | "updates" | "forums" | "promotions" | `label:${string}` | `quotesuite:${string}`;
export type CommunicationEntityKind = "enquiry" | "client" | "project" | "estimate" | "issued_quotation" | "order" | "supplier" | "supplier_quotation";

export type CommunicationEntityLink = {
  kind: CommunicationEntityKind;
  id: string;
};

export type CommunicationAttachment = {
  id: string;
  fileName: string;
  mediaType: string;
  providerFileId: string | null;
  driveFileId: string | null;
  links: CommunicationEntityLink[];
};

export type CommunicationDraft = {
  provider: CommunicationProviderId | null;
  mailboxId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string;
  attachments: CommunicationAttachment[];
  links: CommunicationEntityLink[];
  status: "draft";
};

export type CommunicationProviderContract = {
  id: CommunicationProviderId;
  label: string;
  capabilities: readonly string[];
  delegatedScopes: readonly string[];
  configurationState: "planned";
};

export const COMMUNICATION_PROVIDER_CONTRACTS: readonly CommunicationProviderContract[] = [
  {
    id: "google_workspace",
    label: "Gmail / Google Workspace",
    capabilities: ["Inbox", "Sent", "Drafts", "Labels", "Search", "Compose", "Reply", "Forward", "Attachments"],
    delegatedScopes: ["gmail.readonly", "gmail.modify", "gmail.compose", "gmail.send"],
    configurationState: "planned",
  },
  {
    id: "microsoft_365",
    label: "Microsoft 365 / Outlook",
    capabilities: ["Inbox", "Sent", "Drafts", "Folders", "Search", "Compose", "Reply", "Forward", "Attachments"],
    delegatedScopes: ["Mail.Read", "Mail.ReadWrite", "Mail.Send", "offline_access"],
    configurationState: "planned",
  },
] as const;
