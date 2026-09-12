import { useEffect, useRef, useState } from "react";
import { apiFetch, apiUrl } from "../../services/api/apiClient";

type SupportingFile={id:string;fileName:string;revision:string|null;openUrl:string};
type Draft = { id:string; communicationMessageId:string; status:string; recipient:string; subject:string; bodyText:string; needsPreparation:boolean; deliveryMode:string;delivery:null|{state:string;sent_at:string|null;error_message:string|null};additionalFiles:SupportingFile[];availableFiles:SupportingFile[];attachments:Array<{id:string;fileName:string;downloadUrl:string}> };

export default function FactoryDraftReview({orderId,onChanged}:{orderId:string;onChanged?:()=>Promise<void>}) {
  const [draft,setDraft]=useState<Draft|null>(null),[recipient,setRecipient]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const lock=useRef(false);
  const [selectedFiles,setSelectedFiles]=useState<string[]>([]),[documentsReviewed,setDocumentsReviewed]=useState(false);
  const [deliveryReviewed,setDeliveryReviewed]=useState(false);
  const load=async()=>{const result=await apiFetch(`/api/lifecycle/orders/${orderId}`) as {factoryDraft:Draft|null};setDraft(result.factoryDraft);setDeliveryReviewed(false);if(result.factoryDraft){setRecipient(result.factoryDraft.recipient);setSubject(result.factoryDraft.subject);setBody(result.factoryDraft.bodyText);setSelectedFiles(result.factoryDraft.additionalFiles.map(file=>file.id));setDocumentsReviewed(false)}};
  useEffect(()=>{void load().catch(reason=>setError(reason instanceof Error?reason.message:"The saved factory request could not be opened."))},[orderId]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=async(reprepare=false)=>{
    if(lock.current||!draft)return;lock.current=true;setBusy(true);setNotice("");setError("");
    let saved=false;
    try{await apiFetch(`/api/lifecycle/orders/${orderId}/factory-order`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(reprepare?{send:false}:{editDraft:true,expectedCommunicationId:draft.communicationMessageId,recipient,subject,bodyText:body,additionalDocumentIds:selectedFiles,documentsReviewed})});saved=true;await load();setNotice(reprepare?"Price-free schedule prepared. Open it below to review. Nothing was sent.":"Factory request saved, not sent. Review the saved schedule below.")}
    catch(reason){setError(saved?"The request was saved, but its refreshed view could not be loaded. Reopen the Order to review it. Nothing was sent.":reason instanceof Error?reason.message:"The request could not be saved. Your entered information is retained.")}
    finally{lock.current=false;setBusy(false)}
  };
  const send=async()=>{
    if(lock.current||!draft||!deliveryReviewed)return;lock.current=true;setBusy(true);setError("");setNotice("");
    try{await apiFetch(`/api/lifecycle/orders/${orderId}/factory-order`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({send:true,reviewed:true,expectedCommunicationId:draft.communicationMessageId})});setNotice("Factory request sent. Await the supplier confirmation for staff review.");await load();await onChanged?.()}
    catch(reason){setError(reason instanceof Error?reason.message:"Delivery could not be confirmed. Do not send another copy.");await load().catch(()=>{});await onChanged?.().catch(()=>{})}
    finally{lock.current=false;setBusy(false);setDeliveryReviewed(false)}
  };
  if(!draft)return <p role="status">{error||"Opening saved factory request…"}</p>;
  const deliveryBlocked=Boolean(draft.delivery&&["sending","uncertain","sent"].includes(draft.delivery.state));
  const editable=draft.status==="draft"&&!deliveryBlocked, fieldsEditable=editable&&!draft.needsPreparation;
  const dirty=recipient!==draft.recipient||subject!==draft.subject||body!==draft.bodyText||JSON.stringify([...selectedFiles].sort())!==JSON.stringify(draft.additionalFiles.map(file=>file.id).sort());
  const offeredFiles=[...draft.availableFiles,...draft.additionalFiles.filter(file=>!draft.availableFiles.some(current=>current.id===file.id))];
  return <fieldset className="factory-draft-review"><legend>Factory request · {draft.status==="sent"||draft.delivery?.state==="sent"?"Sent":draft.delivery?.state==="sending"||draft.delivery?.state==="uncertain"?"Delivery awaiting confirmation":"Prepared, not sent"}</legend>
    <p>{draft.needsPreparation?"Prepare the price-free schedule before editing this older request.":"The factory schedule is separate from the customer Order. Customer prices and terms are not included."}</p>
    <label>Recipient<input className="ui-input" type="email" value={recipient} readOnly={!fieldsEditable} onChange={event=>setRecipient(event.target.value)}/></label>
    <label>Subject<input className="ui-input" value={subject} readOnly={!fieldsEditable} onChange={event=>setSubject(event.target.value)}/></label>
    <label>Message<textarea className="ui-textarea" rows={6} value={body} readOnly={!fieldsEditable} onChange={event=>setBody(event.target.value)}/></label>
    {draft.needsPreparation?<p className="ui-status ui-status--warning">This older draft needs a new price-free schedule before it can be sent.</p>:draft.attachments.map(file=><p key={file.id}><a href={apiUrl(file.downloadUrl)} target="_blank" rel="noreferrer">Open {file.fileName}</a></p>)}
    {!draft.needsPreparation?<details><summary>Supporting Project files · {selectedFiles.length} selected</summary><p>Open each selected file and check its version and contents. Do not include customer prices, internal notes or another supplier’s private information. The schedule above is always included.</p>
      {offeredFiles.length?offeredFiles.map(file=><label key={file.id}><input type="checkbox" disabled={!fieldsEditable} checked={selectedFiles.includes(file.id)} onChange={event=>{setSelectedFiles(current=>event.target.checked?[...current,file.id]:current.filter(id=>id!==file.id));setDocumentsReviewed(false)}}/> {file.fileName} · {file.revision?`Revision ${file.revision}`:"Version not recorded"} {draft.availableFiles.some(current=>current.id===file.id)?<a href={file.openUrl} target="_blank" rel="noreferrer">Open file</a>:<span>Previously selected; not in the current list. Deselect it if no longer available.</span>}</label>):<p>No eligible files are available from the connected account for this Project. Files without a retained checksum or with customer/internal document classifications are not offered.</p>}
      <p>Up to 100 eligible files are shown; select no more than 20.</p>
      {fieldsEditable?<label><input type="checkbox" checked={documentsReviewed} onChange={event=>setDocumentsReviewed(event.target.checked)}/> I have reviewed these files and they are appropriate for this factory.</label>:null}
      {draft.additionalFiles.map(file=><p key={file.id}>Saved selection: {file.fileName} · {file.revision?`Revision ${file.revision}`:"Version not recorded"}</p>)}
    </details>:null}
    {editable?<button className="ui-button ui-button--primary" disabled={busy||!recipient.trim()||!subject.trim()||!body.trim()} onClick={()=>void save(draft.needsPreparation)}>{busy?"Saving factory request…":draft.needsPreparation?"Prepare price-free schedule":"Save factory request"}</button>:null}
    {draft.delivery?<p role="status">{draft.delivery.state==="sent"?`Sent ${draft.delivery.sent_at||"— provider confirmed"}. Await supplier confirmation.`:draft.delivery.state==="not_sent"?"Nothing was sent. Correct the reported issue, review and retry.":"Delivery is in progress or awaiting confirmation. Do not send another copy; check the mailbox evidence first."}</p>:null}
    {editable&&!draft.needsPreparation&&draft.deliveryMode==="test_allowlist"?<div><label><input type="checkbox" checked={deliveryReviewed} disabled={dirty||busy} onChange={event=>setDeliveryReviewed(event.target.checked)}/> I have reviewed the saved recipient, message and attachments for this factory.</label><button className="ui-button" disabled={busy||dirty||!deliveryReviewed} onClick={()=>void send()}>{busy?"Sending factory request…":"Send reviewed factory request"}</button>{dirty?<p>Save your changes before reviewing delivery.</p>:null}</div>:null}
    {notice?<p className="ui-status" role="status">{notice}</p>:null}{error?<p className="ui-status ui-status--error" role="alert">{error} Your entered information is retained.</p>:null}
    <p>Saving retains the selected files but does not send an email. Delivery remains limited to the configured test addresses.</p>
  </fieldset>;
}
