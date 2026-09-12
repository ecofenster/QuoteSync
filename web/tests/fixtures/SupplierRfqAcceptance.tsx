import { useState } from "react";
import { createRoot } from "react-dom/client";
import SupplierRfqDialog from "../../src/features/estimateCommercial/SupplierRfqDialog";
import EstimateSupplierCostImportControl from "../../src/features/estimateCommercial/EstimateSupplierCostImportControl";
import { ChangeReview } from "../../src/features/clientPortal/ClientPortalStaffWorkspace";
import "../../src/styles/tokens.css";
import "../../src/styles/base.css";
import "../../src/styles/ui.css";
import "../../src/features/estimateCommercial/estimateCommercialWorkspace.css";

function Acceptance(){const [open,setOpen]=useState(true);return <main data-testid="supplier-rfq-acceptance"><button className="ui-button ui-button--primary" onClick={()=>setOpen(true)}>Request supplier estimate / revision</button>{open?<SupplierRfqDialog projectId="project-1" estimateId="estimate-1" estimateRef="TEST-EST-1" onClose={()=>setOpen(false)}/>:null}</main>}
function ReviewAcceptance(){
  const [selected,setSelected]=useState<string|null>(null);
  const detail:Parameters<typeof ChangeReview>[0]["detail"]={reviewSubmissionId:selected||"review-1",estimateRevision:1,clientId:"client-1",clientReference:"TEST-CL-1",clientName:"Disposable Client",projectId:"project-1",projectName:"Disposable Project",generalComment:"Review finish",generalResponse:"amendment_requested",submittedAt:"2026-09-12T10:00:00Z",positions:[],documents:[],supplierRevision:{id:"history-request",status:"approved",recipient:"",subject:"",bodyText:"",successorEstimateId:"estimate-1",returnedDocumentId:"document-1",returnedRevision:"3",verifiedAt:null},checks:[{estimate_position_id:null,field_key:"finish",requested_change:"Review finish",before_value:"White",expected_value:"Green",after_value:selected==="review-2"?"Blue":"Green",before_source_reference:"Issued page 1",after_source_reference:"Supplier page 2",resolution_note:"Saved evidence note",status:"implemented",change_kind:"requested"}]};
  return <section><button onClick={()=>setSelected("review-1")}>Open saved review</button><button onClick={()=>setSelected("review-2")}>Open other review</button><button onClick={()=>setSelected(null)}>Close review</button>{selected?<ChangeReview detail={detail} reload={async()=>{}}/>:null}</section>;
}
function SavedDocumentAcceptance(){const [selected,setSelected]=useState<string|null>(null);return <section><button onClick={()=>setSelected("changed-source")}>Review changed saved source</button><button onClick={()=>setSelected("supplier-conflict")}>Review supplier conflict</button><button onClick={()=>setSelected("temporary-source")}>Review temporary failure</button>{selected?<EstimateSupplierCostImportControl key={selected} estimateId="estimate-1" scenarioId="scenario-1" canonicalDocumentId={selected} onLoaded={()=>{throw new Error("Recovery must not import")}}/>:null}</section>}
createRoot(document.getElementById("root")!).render(<><Acceptance/><ReviewAcceptance/><SavedDocumentAcceptance/></>);
