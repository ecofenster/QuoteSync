import { apiFetch, apiUrl } from "../api/apiClient";

export type CanonicalDocumentRecord = {
  id:string;provider:string;providerAccountId:string|null;providerFileId:string|null;providerFolderId:string|null;
  enquiryId?:string|null;clientId:string|null;projectId:string|null;estimateId:string|null;orderId:string|null;supplierId:string|null;supplierQuotationId?:string|null;supplierName:string|null;
  documentType:string;revision:string;reference:string;fileName:string;mediaType:string;sizeBytes:number;sha256:string|null;
  estimateRef:string;projectName:string;folder:string;status:string;createdAt:string;modifiedAt:string;providerVersion?:string|null;removedAt?:string|null;downloadUrl:string|null;openUrl?:string|null;
};
export type CanonicalFolderRecord = {id:string;provider:string;providerAccountId:string|null;providerFolderId:string;parentLogicalKey:string|null;logicalKey:string;name:string;clientId:string|null;projectId:string|null;estimateId:string|null;estimateRef:string;projectName:string;modifiedAt:string;folderPath?:string;removedAt?:string|null};
export type DocumentSyncState = {state:"idle"|"syncing"|"synced"|"failed";strategy:string;lastAttemptAt:string|null;lastSuccessAt:string|null;error:string|null;cached:true};
export type DocumentRecordsResult = {scope:{enquiryId?:string;clientId?:string;projectId?:string;estimateId?:string};documents:CanonicalDocumentRecord[];folders:CanonicalFolderRecord[];sync:DocumentSyncState};

const sync = (body:{enquiry_id?:string;client_id?:string;project_id?:string;estimate_id?:string}) => apiFetch("/api/documents/sync", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

export const documentRecordsApi = {
  listClient:(clientId:string)=>apiFetch(`/api/documents?client_id=${encodeURIComponent(clientId)}`) as Promise<DocumentRecordsResult>,
  listProject:(projectId:string)=>apiFetch(`/api/documents?project_id=${encodeURIComponent(projectId)}`) as Promise<DocumentRecordsResult>,
  listEnquiry:(enquiryId:string)=>apiFetch(`/api/documents?enquiry_id=${encodeURIComponent(enquiryId)}`) as Promise<DocumentRecordsResult>,
  listEstimate:(estimateId:string)=>apiFetch(`/api/documents?estimate_id=${encodeURIComponent(estimateId)}`) as Promise<DocumentRecordsResult>,
  syncClient:(clientId:string)=>sync({client_id:clientId}),
  syncEnquiry:(enquiryId:string)=>sync({enquiry_id:enquiryId}),
  syncProject:(projectId:string)=>sync({project_id:projectId}),
  syncEstimate:(estimateId:string)=>sync({estimate_id:estimateId}),
  downloadUrl:(path:string)=>apiUrl(path),
};
