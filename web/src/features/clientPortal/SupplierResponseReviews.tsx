import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";

type Check={estimatePositionId:string|null;fieldKey:string;beforeValue:string;expectedValue:string;afterValue:string;beforeSourceReference:string;afterSourceReference:string;resolutionNote:string;approvedDifference:boolean};
type Supplier={id:string;supplier_name:string;reviewRequired:boolean;documents:Array<{id:string;file_name:string;provider_revision:string|null}>;review:null|{id:string;canonicalDocumentId:string;checks:Check[];reviewedAt:string}};
const blank=():Check=>({estimatePositionId:null,fieldKey:"",beforeValue:"",expectedValue:"",afterValue:"",beforeSourceReference:"",afterSourceReference:"",resolutionNote:"",approvedDifference:false});

export default function SupplierResponseReviews({requestId,positions,onSaved}:{requestId:string;positions:Array<{estimatePositionId:string;reference:string}>;onSaved:()=>Promise<void>}){
  const [suppliers,setSuppliers]=useState<Supplier[]>([]),[selected,setSelected]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function load(){setBusy(true);setError("");try{setSuppliers(await apiFetch(`/api/lifecycle/supplier-revisions/${requestId}/supplier-reviews`) as Supplier[])}catch(reason){setError(reason instanceof Error?reason.message:"Supplier reviews could not be opened.")}finally{setBusy(false)}}
  useEffect(()=>{void load()},[requestId]); // eslint-disable-line react-hooks/exhaustive-deps
  const supplier=suppliers.find(item=>item.id===selected);
  if(!suppliers.length&&!error&&!busy)return null;
  return <fieldset><legend>Supplier response reviews</legend><p>Review each supplier’s returned fields first. Then complete the overall customer-change verification below. Acknowledgements do not replace revised documents.</p>
    {busy?<p role="status">Loading supplier reviews…</p>:null}
    {error?<p role="alert">{error} <button className="ui-button" onClick={()=>void load()}>Retry supplier reviews</button></p>:null}
    <label>Supplier request<select className="ui-select" value={selected} onChange={event=>setSelected(event.currentTarget.value)}><option value="">Choose a supplier response</option>{suppliers.map(item=><option key={item.id} value={item.id}>{item.supplier_name} · {item.reviewRequired?"Review required":"Review saved"}</option>)}</select></label>
    {supplier?<ReviewForm key={supplier.id} supplier={supplier} requestId={requestId} positions={positions} onSaved={async()=>{await load();await onSaved()}}/>:null}
  </fieldset>;
}

function ReviewForm({supplier,requestId,positions,onSaved}:{supplier:Supplier;requestId:string;positions:Array<{estimatePositionId:string;reference:string}>;onSaved:()=>Promise<void>}){
  const [documentId,setDocumentId]=useState(supplier.review?.canonicalDocumentId||supplier.documents[0]?.id||"");
  const [checks,setChecks]=useState<Check[]>(supplier.review?.checks||[blank()]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const saving=useRef(false),retryKey=useRef(crypto.randomUUID());
  function update(index:number,patch:Partial<Check>){retryKey.current=crypto.randomUUID();setChecks(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row))}
  async function save(){if(saving.current)return;saving.current=true;setBusy(true);setError("");setNotice("Saving supplier review…");try{
    const result=await apiFetch(`/api/lifecycle/supplier-revisions/${requestId}/supplier-reviews/${supplier.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({canonicalDocumentId:documentId,checks,idempotencyKey:retryKey.current})}) as {unresolved:number};
    setNotice(result.unresolved?`Review saved. ${result.unresolved} field(s) still need resolution.`:"Supplier review saved. Complete the remaining supplier reviews, then verify the overall customer changes.");
    retryKey.current=crypto.randomUUID();await onSaved();
  }catch(reason){setNotice("");setError(reason instanceof Error?reason.message:"Review was not saved. Your entries are retained; try again.")}finally{setBusy(false);saving.current=false}}
  if(!supplier.documents.length)return <p className="ui-status ui-status--warning">No retained revised document is linked to this supplier request. Open the working Estimate’s supplier request and review/file the exact supplier reply first.</p>;
  return <div>
    <label>Returned supplier document<select className="ui-select" disabled={busy} value={documentId} onChange={event=>{setDocumentId(event.currentTarget.value);retryKey.current=crypto.randomUUID()}}>{supplier.documents.map(doc=><option key={doc.id} value={doc.id}>{doc.file_name} · {doc.provider_revision||"Revision not recorded"}</option>)}</select></label>
    {supplier.review?<p className="ui-status">Previous values are shown for reference. Check them against the selected response before saving again.</p>:null}
    {checks.map((check,index)=><article className="portal-operation-detail__check" key={index}><div className="portal-operation-detail__fields">
      <label>Position<select className="ui-select" disabled={busy} value={check.estimatePositionId||""} onChange={event=>update(index,{estimatePositionId:event.currentTarget.value||null})}><option value="">General / project</option>{positions.map(item=><option key={item.estimatePositionId} value={item.estimatePositionId}>{item.reference}</option>)}</select></label>
      {([['fieldKey','Field'],['beforeValue','Before'],['expectedValue','Requested'],['afterValue','Returned'],['beforeSourceReference','Before source / page'],['afterSourceReference','Returned source / page'],['resolutionNote','Review note']] as const).map(([field,label])=><label key={field}>{label}<input className="ui-input" disabled={busy} value={check[field]} onChange={event=>update(index,{[field]:event.currentTarget.value})}/></label>)}
    </div><label><input type="checkbox" disabled={busy} checked={check.approvedDifference} onChange={event=>update(index,{approvedDifference:event.currentTarget.checked})}/> Approve an evidenced difference with a review note</label>
      {checks.length>1?<button className="ui-button ui-button--ghost" disabled={busy} onClick={()=>{retryKey.current=crypto.randomUUID();setChecks(rows=>rows.filter((_,i)=>i!==index))}}>Remove field</button>:null}
    </article>)}
    <div className="ui-action-row"><button className="ui-button" disabled={busy} onClick={()=>{retryKey.current=crypto.randomUUID();setChecks(rows=>[...rows,blank()])}}>Add field</button><button className="ui-button ui-button--primary" disabled={busy||!documentId} onClick={()=>void save()}>{busy?"Saving supplier review…":"Save supplier review"}</button></div>
    {notice?<p role="status">{notice}</p>:null}{error?<p role="alert">{error}</p>:null}
  </div>;
}
