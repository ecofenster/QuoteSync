import { apiFetch } from "../api/apiClient";
import type { CustomerQuotationProjection } from "../../features/customerQuotation/customerQuotationProjection";
import type { CommunicationMessageView } from "../communications/communicationsApi";

export type IssuedQuotationView={id:string;status:"prepared_not_sent"|"issued"|"failed";clientId:string;estimateId:string;estimateRevision:number;quotationRevision:number;recipient:string;subject:string;provider:string|null;providerMessageId:string|null;communicationMessageId:string|null;preparedAt:string;issuedAt:string|null;failedAt:string|null;failureReason:string|null;commercialSnapshot:{subtotalExVatGbp:string;vatRatePercent:string;vatGbp:string;totalIncVatGbp:string};termsSnapshot:string|null;document:{id:string;fileName:string;mediaType:string;sizeBytes:number;sha256:string;downloadUrl:string}|null;communication:CommunicationMessageView|null};
export type EstimateWorkflowState={estimateId:string;manufacturerQuoteImported:boolean;costingReady:boolean;quotationReviewed:boolean;quotationPrepared:boolean;quotationStatus:string|null;quotationIssued:boolean;issuedQuotationId:string|null;followUpDue:boolean;followUpDueDate:string|null;followUpCompleted:boolean;followUpId:string|null;customerAccepted:boolean;orderCreated:boolean};
const json={"Content-Type":"application/json"};
export const quotationWorkflowApi={
  prepare:(input:{estimateId:string;clientId:string;estimateRevision:number;quotationRevision:number;projection:CustomerQuotationProjection;recipient:string;subject?:string;bodyHtml?:string;termsSnapshot?:string|null})=>apiFetch("/api/quotation-workflow/prepare",{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<IssuedQuotationView>,
  send:(id:string,input:{recipient:string;subject:string;bodyHtml:string})=>apiFetch(`/api/quotation-workflow/issued/${encodeURIComponent(id)}/send`,{method:"POST",headers:json,body:JSON.stringify(input)}) as Promise<IssuedQuotationView>,
  get:(id:string)=>apiFetch(`/api/quotation-workflow/issued/${encodeURIComponent(id)}`) as Promise<IssuedQuotationView>,
  state:(estimateId:string)=>apiFetch(`/api/quotation-workflow/estimates/${encodeURIComponent(estimateId)}/state`) as Promise<EstimateWorkflowState>,
};
