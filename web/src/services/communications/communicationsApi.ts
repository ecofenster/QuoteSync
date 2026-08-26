import { apiFetch, apiUrl } from "../api/apiClient";

export type CommunicationLabelView = { id:string;name:string;system:boolean;colour?:string|null };
export type CommunicationAttachmentView = { id?:string;fileName:string;mediaType:string;sizeBytes?:number;contentBase64?:string;storageKey?:string|null;providerAttachmentId?:string|null;contentId?:string|null;inline?:boolean };
export type CommunicationLinkView = { kind:string;id:string };
export type CanonicalCommunicationFolder = "inbox"|"sent"|"drafts"|"trash"|"spam"|"other";
export type CommunicationMailboxView = "inbox"|"sent"|"drafts"|"starred"|"snoozed"|"important"|"all"|"spam"|"trash"|"social"|"updates"|"forums"|"promotions"|`label:${string}`|`quotesuite:${string}`;
export type CommunicationMessageView = { id:string;providerMessageId:string|null;threadId:string|null;direction:"inbound"|"outbound";folder:CanonicalCommunicationFolder;status:string;from:string[];to:string[];cc:string[];bcc:string[];subject:string;snippet:string;bodyHtml:string;bodyText:string;attachments:CommunicationAttachmentView[];sentAt:string|null;error:string|null;unread:boolean;starred:boolean;important:boolean;labels:CommunicationLabelView[];threadCount:number;threadMessages?:CommunicationMessageView[];links:CommunicationLinkView[] };
export type MailboxLabelView = { id:string;name:string;type:"system"|"user";messagesTotal?:number;messagesUnread?:number;colour?:{textColor?:string;backgroundColor?:string}|null };
export type MailboxCapability = { id:"archive"|"trash"|"read_state"|"star"|"move"|"labels"|"scheduled";available:boolean };
export type MailboxMetadata = { provider:"google_workspace"|"microsoft_365";labels:MailboxLabelView[];capabilities:MailboxCapability[] };
export type CommunicationContextSuggestion = { kind:"client"|"estimate"|"order"|"supplier"|"supplier_quotation";id:string;label:string;evidence:string;autoLinkAllowed:false };
export type CommunicationContextResult = { links:CommunicationLinkView[];suggestions:CommunicationContextSuggestion[] };
export type GoogleWorkspaceCapability = { available:boolean;missingScopes:string[];rootConfigured?:boolean };
export type GoogleWorkspaceState = "not_configured"|"configured_encryption_unavailable"|"configured_disconnected"|"connected"|"reconnect_required";
export type GoogleWorkspaceEncryptionState = "available"|"missing"|"invalid"|"decryption_failed";
export type GoogleWorkspaceStatus = { provider:"google_workspace";state:GoogleWorkspaceState;configured:boolean;configurationStored:boolean;encryptionConfigured:boolean;encryptionState:GoogleWorkspaceEncryptionState;connected:boolean;connectionStatus:string;account:{id:string|null;email:string|null;name:string|null}|null;scopes:string[];capabilities:{gmail:GoogleWorkspaceCapability;drive:GoogleWorkspaceCapability};clientId:string|null;redirectUri:string|null;clientIdHint:string|null;estimatesRootFolderId:string|null;ordersRootFolderId:string|null;folderTemplate:Record<string,string>;infrastructureMessage:string|null;error:string|null };

const json = { "Content-Type": "application/json" };
export const communicationsApi = {
  status:()=>apiFetch("/api/communications/status") as Promise<GoogleWorkspaceStatus>,
  mailbox:()=>apiFetch("/api/communications/mailbox") as Promise<MailboxMetadata>,
  list:(folder:CommunicationMailboxView,q="",pageToken:string|null=null)=>apiFetch(`/api/communications/messages?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(q)}${pageToken?`&page_token=${encodeURIComponent(pageToken)}`:""}`) as Promise<{messages:CommunicationMessageView[];nextPageToken:string|null}>,
  read:(id:string)=>apiFetch(`/api/communications/messages/${encodeURIComponent(id)}`) as Promise<CommunicationMessageView>,
  thread:(id:string)=>apiFetch(`/api/communications/threads/${encodeURIComponent(id)}`) as Promise<CommunicationMessageView>,
  context:(id:string)=>apiFetch(`/api/communications/messages/${encodeURIComponent(id)}/context`) as Promise<CommunicationContextResult>,
  link:(id:string,input:Pick<CommunicationContextSuggestion,"kind"|"id">)=>apiFetch(`/api/communications/messages/${encodeURIComponent(id)}/links`,{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationContextResult>,
  command:(threadIds:string[],command:string,labelId?:string)=>apiFetch("/api/communications/commands",{method:"POST",headers:json,body:JSON.stringify({threadIds,command,labelId})}) as Promise<{ok:true}>,
  draft:(input:Record<string,unknown>)=>apiFetch("/api/communications/drafts",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  send:(input:Record<string,unknown>)=>apiFetch("/api/communications/send",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  reply:(input:Record<string,unknown>)=>apiFetch("/api/communications/reply",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  forward:(input:Record<string,unknown>)=>apiFetch("/api/communications/forward",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  attachmentUrl:(messageId:string,attachmentId:string,attachment?:Pick<CommunicationAttachmentView,"fileName"|"mediaType">,download=false)=>apiUrl(`/api/communications/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}?name=${encodeURIComponent(attachment?.fileName||"attachment")}&type=${encodeURIComponent(attachment?.mediaType||"application/octet-stream")}${download?"&download=1":""}`),
};
