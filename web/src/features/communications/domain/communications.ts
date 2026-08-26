export type CommunicationProviderId = "google_workspace" | "microsoft_365";
export type CommunicationEntityKind = "client" | "estimate" | "order" | "supplier_quotation" | "project";

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
