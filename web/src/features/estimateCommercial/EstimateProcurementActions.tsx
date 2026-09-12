import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";

type Availability={requestSupplierRevision:{available:boolean;reasons:string[];supplier:{supplier_name?:string;supplierName?:string;supplier_quotation_number?:string}|null;customerReviewAvailable:boolean};raiseOrderToFactory:{available:boolean;reasons:string[];customerIntentRecorded:boolean;positionAcceptanceComplete:boolean;signedAcceptanceComplete:boolean;internalApprovalComplete:boolean}};

export default function EstimateProcurementActions({estimateId}:{estimateId:string}){
  const [state,setState]=useState<Availability|null>(null),[message,setMessage]=useState("");
  useEffect(()=>{let active=true;apiFetch(`/api/estimates/${encodeURIComponent(estimateId)}/procurement-actions`).then(value=>{if(active)setState(value as Availability)}).catch(reason=>{if(active)setMessage(reason instanceof Error?reason.message:"Procurement actions could not be loaded.")});return()=>{active=false}},[estimateId]);
  if(!state)return message?<small role="status">{message}</small>:null;
  const showFactory=state.raiseOrderToFactory.customerIntentRecorded;
  if(!showFactory)return null;
  const factoryReason=state?.raiseOrderToFactory.reasons.join(" ")||"Acceptance and internal approval are complete.";
  return <div className="estimate-procurement-actions" aria-label="Internal staff factory actions">{showFactory?<button type="button" className="ui-button ui-button--primary" disabled={!state.raiseOrderToFactory.available} title={factoryReason}>Raise Order to Factory</button>:null}{message?<small role="status">{message}</small>:null}</div>;
}
