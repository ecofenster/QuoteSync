import { useEffect, useRef, useState } from "react";
import { apiFetch, apiUrl } from "../../services/api/apiClient";

type Draft = { id:string; communicationMessageId:string; status:string; recipient:string; subject:string; bodyText:string; needsPreparation:boolean; attachments:Array<{id:string;fileName:string;downloadUrl:string}> };

export default function FactoryDraftReview({orderId}:{orderId:string}) {
  const [draft,setDraft]=useState<Draft|null>(null),[recipient,setRecipient]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const lock=useRef(false);
  const load=async()=>{const result=await apiFetch(`/api/lifecycle/orders/${orderId}`) as {factoryDraft:Draft|null};setDraft(result.factoryDraft);if(result.factoryDraft){setRecipient(result.factoryDraft.recipient);setSubject(result.factoryDraft.subject);setBody(result.factoryDraft.bodyText)}};
  useEffect(()=>{void load().catch(reason=>setError(reason instanceof Error?reason.message:"The saved factory request could not be opened."))},[orderId]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=async(reprepare=false)=>{
    if(lock.current||!draft)return;lock.current=true;setBusy(true);setNotice("");setError("");
    let saved=false;
    try{await apiFetch(`/api/lifecycle/orders/${orderId}/factory-order`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(reprepare?{send:false}:{editDraft:true,expectedCommunicationId:draft.communicationMessageId,recipient,subject,bodyText:body})});saved=true;await load();setNotice(reprepare?"Price-free schedule prepared. Open it below to review. Nothing was sent.":"Factory request saved, not sent. Review the saved schedule below.")}
    catch(reason){setError(saved?"The request was saved, but its refreshed view could not be loaded. Reopen the Order to review it. Nothing was sent.":reason instanceof Error?reason.message:"The request could not be saved. Your entered information is retained.")}
    finally{lock.current=false;setBusy(false)}
  };
  if(!draft)return <p role="status">{error||"Opening saved factory request…"}</p>;
  const editable=draft.status==="draft", fieldsEditable=editable&&!draft.needsPreparation;
  return <fieldset className="factory-draft-review"><legend>Factory request · {draft.status==="sent"?"Sent":"Prepared, not sent"}</legend>
    <p>{draft.needsPreparation?"Prepare the price-free schedule before editing this older request.":"The factory schedule is separate from the customer Order. Customer prices and terms are not included."}</p>
    <label>Recipient<input className="ui-input" type="email" value={recipient} readOnly={!fieldsEditable} onChange={event=>setRecipient(event.target.value)}/></label>
    <label>Subject<input className="ui-input" value={subject} readOnly={!fieldsEditable} onChange={event=>setSubject(event.target.value)}/></label>
    <label>Message<textarea className="ui-textarea" rows={6} value={body} readOnly={!fieldsEditable} onChange={event=>setBody(event.target.value)}/></label>
    {draft.needsPreparation?<p className="ui-status ui-status--warning">This older draft needs a new price-free schedule before it can be sent.</p>:draft.attachments.map(file=><p key={file.id}><a href={apiUrl(file.downloadUrl)} target="_blank" rel="noreferrer">Open {file.fileName}</a></p>)}
    {editable?<button className="ui-button ui-button--primary" disabled={busy||!recipient.trim()||!subject.trim()||!body.trim()} onClick={()=>void save(draft.needsPreparation)}>{busy?"Saving factory request…":draft.needsPreparation?"Prepare price-free schedule":"Save factory request"}</button>:null}
    {notice?<p className="ui-status" role="status">{notice}</p>:null}{error?<p className="ui-status ui-status--error" role="alert">{error} Your entered information is retained.</p>:null}
    <p>Sending and additional factory attachments require the separately reviewed delivery step. Saving does not send an email.</p>
  </fieldset>;
}
