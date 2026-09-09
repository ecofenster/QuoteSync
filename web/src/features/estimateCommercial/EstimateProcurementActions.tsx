import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";

type Availability={requestSupplierRevision:{available:boolean;reasons:string[];supplier:{supplier_name?:string;supplierName?:string;supplier_quotation_number?:string}|null;customerReviewAvailable:boolean};raiseOrderToFactory:{available:boolean;reasons:string[];customerIntentRecorded:boolean;positionAcceptanceComplete:boolean;signedAcceptanceComplete:boolean;internalApprovalComplete:boolean}};

export default function EstimateProcurementActions({estimateId}:{estimateId:string}){
  const [state,setState]=useState<Availability|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;apiFetch(`/api/estimates/${encodeURIComponent(estimateId)}/procurement-actions`).then(value=>{if(active)setState(value as Availability)}).catch(reason=>{if(active)setMessage(reason instanceof Error?reason.message:"Procurement actions could not be loaded.")});return()=>{active=false}},[estimateId]);
  async function requestRevision(){if(!state?.requestSupplierRevision.available||busy)return;setBusy(true);setMessage("Preparing staff-reviewed supplier revision request…");try{const result=await apiFetch(`/api/estimates/${encodeURIComponent(estimateId)}/procurement-actions/request-supplier-revision`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({affectedPositionIds:[],requestedChanges:"",supportingDocumentIds:[]})}) as {status:string};setMessage(result.status==="draft_staff_review"?"Supplier revision request prepared for staff review. No email was sent.":"Supplier revision request prepared.")}catch(reason){setMessage(reason instanceof Error?reason.message:"Supplier revision request could not be prepared.")}finally{setBusy(false)}}
  if(!state)return message?<small role="status">{message}</small>:null;
  const showSupplierRevision=Boolean(state.requestSupplierRevision.supplier),showFactory=state.raiseOrderToFactory.customerIntentRecorded;
  if(!showSupplierRevision&&!showFactory)return null;
  const requestReason=state?.requestSupplierRevision.reasons.join(" ")||"Creates a reviewed draft only; customer comments are never forwarded automatically.";
  const factoryReason=state?.raiseOrderToFactory.reasons.join(" ")||"Acceptance and internal approval are complete.";
  return <div className="estimate-procurement-actions" aria-label="Internal staff supplier and factory actions">{showSupplierRevision?<button type="button" className="ui-button" disabled={!state.requestSupplierRevision.available||busy} title={requestReason} onClick={()=>void requestRevision()}>Request Supplier Revision</button>:null}{showFactory?<button type="button" className="ui-button ui-button--primary" disabled={!state.raiseOrderToFactory.available} title={factoryReason}>Raise Order to Factory</button>:null}{message?<small role="status">{message}</small>:null}</div>;
}
