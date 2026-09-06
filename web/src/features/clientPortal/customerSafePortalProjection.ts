import type { Client, Estimate } from "../../models/types";
import type { CanonicalDocumentRecord } from "../../services/documents/documentRecordsApi";

export type CustomerSafeCommercial = { supplyOnly:number|null; installation:number|null; vat:number|null; total:number|null; currency:string };
export type ClientPortalEstimate = {id:string;estimateRef:string;revisionNo:number;status:"current"|"superseded"|"awaiting_review"|"accepted_order"|"declined_rejected"|"expired";commercial:CustomerSafeCommercial};
export type ClientPortalProjection = {
  client:{id:string;reference:string;displayName:string;projectName:string};
  currentStatus:string;nextAction:string|null;latestEstimate:ClientPortalEstimate|null;
  estimates:ClientPortalEstimate[];orders:ClientPortalEstimate[];rejected:ClientPortalEstimate[];
  documents:Array<{id:string;fileName:string;documentType:string;revision:string;modifiedAt:string;openUrl:string|null}>;
};

const customerDocumentTypes = new Set(["customer_quotation","issued_estimate","accepted_order","order_confirmation","project_drawing","approved_customer_document"]);
const safeMoney = (value:unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

function commercialFor(estimate:Estimate, commercialByEstimateId:Record<string,Partial<CustomerSafeCommercial>>):CustomerSafeCommercial {
  const input=commercialByEstimateId[String(estimate.id)]||{};
  return {supplyOnly:safeMoney(input.supplyOnly),installation:safeMoney(input.installation),vat:safeMoney(input.vat),total:safeMoney(input.total),currency:String(input.currency||"GBP")};
}

export function buildCustomerSafePortalProjection(input:{client:Client;documents?:CanonicalDocumentRecord[];commercialByEstimateId?:Record<string,Partial<CustomerSafeCommercial>>;releasedEstimateIds?:string[];orderEstimateIds?:string[];rejectedEstimateIds?:string[];releasedDocumentIds?:string[]}):ClientPortalProjection {
  const commercial=input.commercialByEstimateId||{};
  const released=new Set(input.releasedEstimateIds||[]),ordersReleased=new Set(input.orderEstimateIds||[]),rejectedReleased=new Set(input.rejectedEstimateIds||[]);
  const estimates=(input.client.estimates||[]).filter((estimate)=>released.has(String(estimate.id))||ordersReleased.has(String(estimate.id))||rejectedReleased.has(String(estimate.id))).map((estimate,index):ClientPortalEstimate=>({
    id:String(estimate.id),estimateRef:estimate.estimateRef,revisionNo:estimate.revisionNo,
    status:ordersReleased.has(String(estimate.id))?"accepted_order":rejectedReleased.has(String(estimate.id))?"declined_rejected":index===0?"current":"superseded",
    commercial:commercialFor(estimate,commercial),
  }));
  const latestEstimate=estimates.find((estimate)=>estimate.status==="current")||estimates.find((estimate)=>estimate.status==="accepted_order")||estimates[0]||null;
  const releasedDocuments=new Set(input.releasedDocumentIds||[]);
  const documents=(input.documents||[]).filter((document)=>releasedDocuments.has(document.id)&&customerDocumentTypes.has(document.documentType)&&!document.removedAt&&document.status!=="trashed").map((document)=>({id:document.id,fileName:document.fileName,documentType:document.documentType,revision:document.revision,modifiedAt:document.modifiedAt,openUrl:document.downloadUrl||document.openUrl||null}));
  const orders=estimates.filter((estimate)=>estimate.status==="accepted_order"),rejected=estimates.filter((estimate)=>estimate.status==="declined_rejected");
  return {
    client:{id:String(input.client.id),reference:input.client.clientRef,displayName:input.client.businessName||input.client.clientName,projectName:input.client.projectName},
    currentStatus:orders.length?"Order in progress":latestEstimate?"Estimate in review":"Enquiry / project preparation",
    nextAction:orders.length?"Review order progress":latestEstimate?"Review latest Estimate":null,
    latestEstimate,estimates:estimates.filter((estimate)=>estimate.status!=="declined_rejected"),orders,rejected,documents,
  };
}

export const CLIENT_PORTAL_FORBIDDEN_FIELDS = ["supplierPurchaseCost","margin","markup","estimateRate","liveRate","supplierDiscount","internalNotes","extractionConfidence"] as const;
