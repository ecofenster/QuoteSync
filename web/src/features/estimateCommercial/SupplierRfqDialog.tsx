import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";
import "./supplierRfqDialog.css";

type RfqDocument = { id:string; fileName:string; mediaType:string; sizeBytes:number; documentType:string; providerRevision:string|null; folderPath:string|null };
type RfqRecord = { id:string; supplierName:string|null; recipient:string; subject:string; status:string; revisionNo:number; documentSnapshot:RfqDocument[]; communicationMessageId:string; createdAt:string; nextAction?:string; idempotentReplay?:boolean };
type RfqContext = {
  project:{id:string;clientId:string;clientName:string;clientReference:string;name:string};
  selectedEstimateId:string|null;
  estimates:Array<{id:string;estimateRef:string;revisionNo:number;status:string}>;
  suppliers:Array<{id:string;name:string}>;
  documents:RfqDocument[];
  enquiries:RfqRecord[];
  delivery:{deliveryMode:string;factoryConfigured:boolean};
};

const json={"Content-Type":"application/json"};
const makeKey=()=>globalThis.crypto?.randomUUID?.()||`rfq-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function SupplierRfqDialog({projectId,estimateId,estimateRef,onClose}:{projectId:string;estimateId:string;estimateRef:string;onClose:()=>void}){
  const [context,setContext]=useState<RfqContext|null>(null),[supplierId,setSupplierId]=useState(""),[recipient,setRecipient]=useState(""),[subject,setSubject]=useState(`Request for quotation · ${estimateRef}`),[bodyText,setBodyText]=useState("Please review the selected project documents and provide your quotation."),[documentIds,setDocumentIds]=useState<string[]>([]),[sendNow,setSendNow]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<RfqRecord|null>(null);
  const idempotencyKey=useRef(makeKey()),submitting=useRef(false);
  const selectedSupplier=useMemo(()=>context?.suppliers.find(item=>item.id===supplierId)||null,[context,supplierId]);
  const load=async()=>{setLoading(true);setError("");try{const value=await apiFetch(`/api/lifecycle/projects/${encodeURIComponent(projectId)}/supplier-enquiries?estimate_id=${encodeURIComponent(estimateId)}`) as RfqContext;setContext(value);if(!supplierId&&value.suppliers.length===1)setSupplierId(value.suppliers[0].id)}catch(reason){setError(reason instanceof Error?reason.message:"Supplier quote details could not be loaded.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[projectId,estimateId]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleDocument=(id:string,checked:boolean)=>setDocumentIds(current=>checked?[...new Set([...current,id])]:current.filter(item=>item!==id));
  const submit=async()=>{if(submitting.current||saving||!supplierId||!recipient.trim()||!subject.trim()||!bodyText.trim())return;submitting.current=true;setSaving(true);setError("");try{const value=await apiFetch(`/api/lifecycle/projects/${encodeURIComponent(projectId)}/supplier-enquiries`,{method:"POST",headers:json,body:JSON.stringify({estimateId,supplierId,recipient,subject,bodyText,documentIds,idempotencyKey:idempotencyKey.current,send:sendNow})}) as RfqRecord;setResult(value);setContext(current=>current?{...current,enquiries:[value,...current.enquiries.filter(item=>item.id!==value.id)]}:current)}catch(reason){setError(reason instanceof Error?reason.message:"The supplier quote request could not be prepared. Your selections are still here; retry safely.")}finally{setSaving(false);submitting.current=false}};
  return <div className="estimate-commercial__modal-scrim" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose()}}>
    <section className="estimate-commercial__modal supplier-rfq ui-card" role="dialog" aria-modal="true" aria-labelledby="supplier-rfq-title" aria-busy={loading||saving}>
      <header><div><span className="ui-eyebrow">Supplier quotation</span><h2 id="supplier-rfq-title">Request supplier quote</h2><p>{context?`${context.project.clientReference} · ${context.project.clientName} · ${context.project.name}`:`${estimateRef} · loading Project context…`}</p></div><button className="ui-button" disabled={saving} onClick={onClose}>Close</button></header>
      {loading?<p className="ui-status" role="status">Loading current Project files and suppliers…</p>:null}
      {error?<div className="ui-status ui-status--error" role="alert"><strong>{error}</strong><span>No completed work will be repeated. Check the details and retry.</span></div>:null}
      {result?<section className="supplier-rfq__result" aria-live="polite"><span className="ui-status">{result.status==="sent"?"Supplier quote request sent":"Email draft prepared"}</span><h3>{result.subject}</h3><p>{result.supplierName} · revision {result.revisionNo}</p><p>{result.nextAction||"Review the saved Email draft before sending."}</p><div className="ui-action-row"><button className="ui-button ui-button--primary" onClick={onClose}>Done</button></div><details><summary>View details</summary><dl><div><dt>Recipient</dt><dd>{result.recipient}</dd></div><div><dt>Files</dt><dd>{result.documentSnapshot.length?result.documentSnapshot.map(item=>item.fileName).join(", "):"No files attached"}</dd></div><div><dt>Saved Email</dt><dd>{result.communicationMessageId}</dd></div></dl></details></section>:context?<>
        <div className="supplier-rfq__step"><span>1</span><div><h3>Choose supplier and recipient</h3><p>The request stays linked to this exact working Estimate.</p></div></div>
        <div className="supplier-rfq__fields"><label>Supplier<select className="ui-select" value={supplierId} onChange={event=>setSupplierId(event.currentTarget.value)}><option value="">Choose supplier</option>{context.suppliers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Email address<input className="ui-input" type="email" value={recipient} onChange={event=>setRecipient(event.currentTarget.value)} placeholder={selectedSupplier?`${selectedSupplier.name} recipient`:"Supplier recipient"}/></label></div>
        <div className="supplier-rfq__step"><span>2</span><div><h3>Choose Project files</h3><p>Only the files selected here will be attached.</p></div></div>
        <div className="supplier-rfq__documents">{context.documents.length?context.documents.map(document=><label key={document.id}><input type="checkbox" checked={documentIds.includes(document.id)} onChange={event=>toggleDocument(document.id,event.currentTarget.checked)}/><span><strong>{document.fileName}</strong><small>{document.documentType.replaceAll("_"," ")}</small></span></label>):<p className="ui-empty-state">No current Project files are available. You can prepare the message without an attachment or add files first.</p>}</div>
        <div className="supplier-rfq__step"><span>3</span><div><h3>Review the message</h3><p>Nothing is sent until you choose the sending option.</p></div></div>
        <div className="supplier-rfq__fields"><label className="supplier-rfq__wide">Subject<input className="ui-input" value={subject} onChange={event=>setSubject(event.currentTarget.value)}/></label><label className="supplier-rfq__wide">Message<textarea className="ui-textarea" rows={6} value={bodyText} onChange={event=>setBodyText(event.currentTarget.value)}/></label></div>
        {context.delivery.deliveryMode==="test_allowlist"?<label className="supplier-rfq__send"><input type="checkbox" checked={sendNow} onChange={event=>setSendNow(event.currentTarget.checked)}/> Send now to the configured factory test address</label>:<p className="ui-status ui-status--warning">Preview only. QuoteSuite will save an Email draft; sending is not enabled in this workspace.</p>}
        {context.enquiries.length?<details><summary>View previous requests ({context.enquiries.length})</summary><div className="supplier-rfq__history">{context.enquiries.map(item=><article key={item.id}><strong>{item.supplierName||"Supplier"} · revision {item.revisionNo}</strong><span>{item.subject}</span><small>{new Date(item.createdAt).toLocaleString("en-GB")} · {item.status}</small></article>)}</div></details>:null}
        <footer><button className="ui-button" disabled={saving} onClick={onClose}>Cancel</button><button className="ui-button ui-button--primary" disabled={saving||!supplierId||!recipient.trim()||!subject.trim()||!bodyText.trim()} onClick={()=>void submit()}>{saving?(sendNow?"Sending request…":"Saving Email draft…"):(sendNow?"Send supplier quote request":"Prepare Email draft")}</button></footer>
      </>:null}
    </section>
  </div>;
}
