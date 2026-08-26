import { apiFetch, apiUrl } from "../api/apiClient";

export type CommunicationAttachmentView = { id?:string;fileName:string;mediaType:string;sizeBytes?:number;contentBase64?:string;storageKey?:string|null;providerAttachmentId?:string|null };
export type CommunicationMessageView = { id:string;providerMessageId:string|null;threadId:string|null;direction:"inbound"|"outbound";folder:"inbox"|"sent"|"drafts"|"other";status:string;from:string[];to:string[];cc:string[];bcc:string[];subject:string;bodyHtml:string;bodyText:string;attachments:CommunicationAttachmentView[];sentAt:string|null;error:string|null };
export type GoogleWorkspaceStatus = { provider:"google_workspace";configured:boolean;encryptionConfigured:boolean;connected:boolean;connectionStatus:string;account:{id:string;email:string;name:string}|null;scopes:string[];redirectUri:string|null;clientIdHint:string|null;estimatesRootFolderId:string|null;ordersRootFolderId:string|null;folderTemplate:Record<string,string>;error:string|null };

const json = { "Content-Type": "application/json" };
export const communicationsApi = {
  status:()=>apiFetch("/api/communications/status") as Promise<GoogleWorkspaceStatus>,
  list:(folder:string,q="")=>apiFetch(`/api/communications/messages?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(q)}`) as Promise<{messages:CommunicationMessageView[];nextPageToken:string|null}>,
  read:(id:string)=>apiFetch(`/api/communications/messages/${encodeURIComponent(id)}`) as Promise<CommunicationMessageView>,
  draft:(input:Record<string,unknown>)=>apiFetch("/api/communications/drafts",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  send:(input:Record<string,unknown>)=>apiFetch("/api/communications/send",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  reply:(input:Record<string,unknown>)=>apiFetch("/api/communications/reply",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  forward:(input:Record<string,unknown>)=>apiFetch("/api/communications/forward",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<CommunicationMessageView>,
  attachmentUrl:(messageId:string,attachmentId:string)=>apiUrl(`/api/communications/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`),
};
