import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EnquiryIntakeDialog, type EnquiryIntake, type EnquiryIntakeFeedback } from "../../src/features/communications/EmailWorkspace";
import { communicationsApi } from "../../src/services/communications/communicationsApi";

function Acceptance() {
  const [draft,setDraft]=useState<EnquiryIntake|null>(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState<EnquiryIntakeFeedback|null>(null),[notice,setNotice]=useState("");
  const submitting=useRef(false);
  const open=async()=>{setNotice("");setFeedback(null);setDraft(await communicationsApi.enquiryIntake("disposable-intake-message") as EnquiryIntake)};
  const link=async(match:EnquiryIntake["likelyMatches"][number])=>{if(submitting.current)return;submitting.current=true;setBusy(true);setFeedback({state:"linking",message:"Linking existing record…"});try{await communicationsApi.link("disposable-intake-message",{kind:match.kind,id:match.id});setDraft(null);setFeedback(null);setNotice(`Email linked to existing ${match.kind}: ${match.label}. No new Enquiry was created.`)}catch(reason){setFeedback({state:"failed",message:reason instanceof Error?reason.message:"Link failed."})}finally{submitting.current=false;setBusy(false)}};
  const create=async(value:EnquiryIntake,selectedAttachmentIds:string[],createNewConfirmed:boolean)=>{if(submitting.current)return;submitting.current=true;setBusy(true);setFeedback({state:"creating",message:"Creating Enquiry…"});try{const result=await communicationsApi.createEnquiry("disposable-intake-message",{displayName:value.displayName,email:value.email,projectName:value.projectName,brief:value.brief,selectedAttachmentIds,existingRecordsReviewed:true,createNewConfirmed});setDraft(null);setFeedback(null);setNotice(`${result.enquiryRef} created. Next: review the Enquiry and connect it to the right Client and Project.`)}catch(reason){setFeedback({state:"failed",message:reason instanceof Error?reason.message:"Create failed."})}finally{submitting.current=false;setBusy(false)}};
  return <main data-testid="email-enquiry-intake-acceptance"><button type="button" onClick={()=>void open()}>Open Email intake</button>{notice?<p role="status">{notice}</p>:null}{draft?<EnquiryIntakeDialog draft={draft} busy={busy} feedback={feedback} onClose={()=>setDraft(null)} onSubmit={(value,selected,confirmed)=>void create(value,selected,confirmed)} onLinkExisting={(match)=>void link(match)}/>:null}</main>;
}

createRoot(document.getElementById("root")!).render(<Acceptance/>);
