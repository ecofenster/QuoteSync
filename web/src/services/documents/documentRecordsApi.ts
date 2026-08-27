import { apiFetch, apiUrl } from "../api/apiClient";

export type CanonicalDocumentRecord = {
  id:string;provider:string;providerAccountId:string|null;providerFileId:string|null;providerFolderId:string|null;
  enquiryId?:string|null;clientId:string|null;projectId:string|null;estimateId:string|null;orderId:string|null;supplierId:string|null;supplierQuotationId?:string|null;supplierName:string|null;
  documentType:string;revision:string;reference:string;fileName:string;mediaType:string;sizeBytes:number;sha256:string|null;
  estimateRef:string;projectName:string;folder:string;status:string;createdAt:string;modifiedAt:string;providerVersion?:string|null;removedAt?:string|null;downloadUrl:string|null;openUrl?:string|null;
};
export type FolderUploadCapabilityState = "loading"|"absent"|"disconnected"|"read_only"|"writable";
export type CanonicalFolderRecord = {id:string;provider:string;providerAccountId:string|null;providerFolderId:string;providerParentFolderId:string|null;entityKind:"enquiry"|"client"|"project"|"estimate"|"order";entityId:string|null;parentLogicalKey:string|null;logicalKey:string;name:string;clientId:string|null;projectId:string|null;estimateId:string|null;estimateRef:string;projectName:string;provenance:string;modifiedAt:string;folderPath?:string;removedAt?:string|null;openUrl?:string|null;capabilities?:{upload?:boolean;uploadState?:FolderUploadCapabilityState}};
export type DocumentSyncStatus = "idle"|"syncing"|"synced"|"synced_no_files"|"client_folder_not_matched"|"project_assignment_pending"|"failed";
export type DocumentSyncState = {state:DocumentSyncStatus;strategy:string;lastAttemptAt:string|null;lastSuccessAt:string|null;error:string|null;details?:{filesDiscovered?:number}|null;cached:true};
export type DocumentRecordsResult = {scope:{enquiryId?:string;clientId?:string;projectId?:string;estimateId?:string};documents:CanonicalDocumentRecord[];folders:CanonicalFolderRecord[];sync:DocumentSyncState};
export type DocumentSyncResult = {scope:{enquiryId?:string;clientId?:string;projectId?:string;estimateId?:string};status:Exclude<DocumentSyncStatus,"idle"|"syncing"|"failed">;filesDiscovered:number;results:Array<{status:string;filesDiscovered?:number;foldersVisited?:number}>};
export type DocumentUploadResult = {duplicateName:boolean;duplicatePolicy:"provider_creates_separate_file";binaryStoredByQuoteSuite:false;document:CanonicalDocumentRecord|null;records:DocumentRecordsResult};

export function normaliseDocumentRecordsResult(value:unknown):DocumentRecordsResult {
  const result=value as DocumentRecordsResult;
  return {...result,documents:Array.isArray(result?.documents)?result.documents:[],folders:(Array.isArray(result?.folders)?result.folders:[]).map(folder=>{const upload=folder.capabilities?.upload===true;return {...folder,capabilities:{upload,uploadState:folder.capabilities?.uploadState||(upload?"writable":"absent")}}})};
}

const sync = (body:{enquiry_id?:string;client_id?:string;project_id?:string;estimate_id?:string}) => apiFetch("/api/documents/sync", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}) as Promise<DocumentSyncResult>;
const upload = (file:File,folder:CanonicalFolderRecord,scope:DocumentRecordsResult["scope"]) => { const body=new FormData(); body.set("file",file); body.set("provider",folder.provider); body.set("provider_account_id",folder.providerAccountId||""); body.set("provider_folder_id",folder.providerFolderId); if(scope.enquiryId)body.set("enquiry_id",scope.enquiryId); if(scope.clientId)body.set("client_id",scope.clientId); if(scope.projectId)body.set("project_id",scope.projectId); if(scope.estimateId)body.set("estimate_id",scope.estimateId); return apiFetch("/api/documents/upload",{method:"POST",body}) as Promise<DocumentUploadResult>; };

export const documentRecordsApi = {
  listClient:(clientId:string)=>apiFetch(`/api/documents?client_id=${encodeURIComponent(clientId)}`).then(normaliseDocumentRecordsResult),
  listProject:(projectId:string)=>apiFetch(`/api/documents?project_id=${encodeURIComponent(projectId)}`).then(normaliseDocumentRecordsResult),
  listEnquiry:(enquiryId:string)=>apiFetch(`/api/documents?enquiry_id=${encodeURIComponent(enquiryId)}`).then(normaliseDocumentRecordsResult),
  listEstimate:(estimateId:string)=>apiFetch(`/api/documents?estimate_id=${encodeURIComponent(estimateId)}`).then(normaliseDocumentRecordsResult),
  syncClient:(clientId:string)=>sync({client_id:clientId}),
  syncEnquiry:(enquiryId:string)=>sync({enquiry_id:enquiryId}),
  syncProject:(projectId:string)=>sync({project_id:projectId}),
  syncEstimate:(estimateId:string)=>sync({estimate_id:estimateId}),
  upload,
  downloadUrl:(path:string)=>apiUrl(path),
};
