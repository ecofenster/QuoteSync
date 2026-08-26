import { apiFetch, apiUrl } from "../api/apiClient";

export type CanonicalDocumentRecord = {
  id:string;provider:string;providerAccountId:string|null;providerFileId:string|null;providerFolderId:string|null;
  clientId:string;projectId:string|null;estimateId:string|null;orderId:string|null;supplierId:string|null;supplierName:string|null;
  documentType:string;revision:string;reference:string;fileName:string;mediaType:string;sizeBytes:number;sha256:string;
  estimateRef:string;projectName:string;folder:string;status:string;createdAt:string;modifiedAt:string;downloadUrl:string|null;
};
export type CanonicalFolderRecord = {id:string;provider:string;providerAccountId:string|null;providerFolderId:string;parentLogicalKey:string|null;logicalKey:string;name:string;clientId:string;projectId:string;estimateId:string;estimateRef:string;projectName:string;modifiedAt:string};
export type DocumentRecordsResult = {scope:{clientId?:string;estimateId?:string};documents:CanonicalDocumentRecord[];folders:CanonicalFolderRecord[]};

export const documentRecordsApi = {
  listClient:(clientId:string)=>apiFetch(`/api/documents?client_id=${encodeURIComponent(clientId)}`) as Promise<DocumentRecordsResult>,
  listEstimate:(estimateId:string)=>apiFetch(`/api/documents?estimate_id=${encodeURIComponent(estimateId)}`) as Promise<DocumentRecordsResult>,
  downloadUrl:(path:string)=>apiUrl(path),
};
