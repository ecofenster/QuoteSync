import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "../../src/layout/AppShell";
import ClientPortalPreview from "../../src/features/clientPortal/ClientPortalPreview";
import ClientInfoTab from "../../src/features/estimatePicker/tabs/ClientInfoTab";
import ClientPortalStaffWorkspace from "../../src/features/clientPortal/ClientPortalStaffWorkspace";
import EstimateProcurementActions from "../../src/features/estimateCommercial/EstimateProcurementActions";
import { applyQuoteSuiteVisualTheme } from "../../src/theme/visualDesignV2";
import "../../src/index.css";
import "../../src/layout/AppShell.css";

const client:any={id:"test-client",clientRef:"TEST-CL-PORTAL",clientName:"Disposable Portal Client",businessName:"",email:"contact@example.test",mobile:"",home:"",type:"Individual",projectName:"Security Test Project",customerAddress:"",projectAddress:"1 Test Street",invoiceAddress:"",contactPerson:"Alex Contact",estimates:[{id:"estimate-r1",projectId:"project-a1",estimateRef:"TEST-EST-PORTAL-01",baseEstimateRef:"TEST-EST-PORTAL-01",revisionNo:1,status:"Issued",outcome:"Open",estimatedOrderMonth:"",estimatedOrderYear:2026,defaults:{},positions:[{id:"position-a",positionRef:"W1",qty:1,widthMm:1000,heightMm:1200,roomName:"Kitchen"}]}]};

function Acceptance(){
  const [screen,setScreen]=useState<"portal"|"client"|"directory"|"direct"|"procurement">("portal");
  useEffect(()=>{applyQuoteSuiteVisualTheme("quotesuite-v2-dark",false)},[]);
  const navigation=(id:typeof screen,label:string)=><button className={screen===id?"ui-button ui-button--primary":"ui-button ui-button--ghost"} onClick={()=>setScreen(id)}>{label}</button>;
  return <AppShell title="Client Portal Security Foundation" activeNavKey="clients"><main className="app-main-workspace compare-foundation-acceptance"><nav className="ui-action-row" aria-label="Security proof screens">{navigation("portal","Portal")}{navigation("client","Client Info")}{navigation("directory","Portal Directory")}{navigation("direct","Direct Portal")}{navigation("procurement","Estimate Actions")}</nav><div data-security-proof={screen}>{screen==="portal"?<ClientPortalPreview client={client} enabledFeatures={["dashboard","estimates","orders","rejected","documents","review_estimate","request_amendments","decline_estimate","intent_to_proceed"]} releasedEstimateIds={["estimate-r1"]} releasedDocumentIds={["customer_quotation:issued"]} commercialByEstimateId={{"estimate-r1":{supplyOnly:1000,installation:250,vat:250,total:1500,currency:"GBP"}}} accessContext={{tenantLabel:"QuoteSuite Test Tenant",contactName:"Alex Contact",contactEmail:"contact@example.test",projectScope:"Security Test Project only",mode:"deterministic_test_adapter"}}/>:screen==="client"?<ClientInfoTab pickerClient={client} openEditClientPanel={()=>{}}/>:screen==="directory"?<ClientPortalStaffWorkspace clients={[client]}/>:screen==="direct"?<ClientPortalStaffWorkspace clients={[client]} initialClientId="test-client" initialProjectId="project-a1"/>:<section className="ui-card" style={{padding:"var(--space-5)",display:"grid",gap:"var(--space-4)"}}><span className="ui-eyebrow">Internal QuoteSuite actions</span><h2>Estimate procurement workflow</h2><EstimateProcurementActions estimateId="estimate-r1"/></section>}</div></main></AppShell>;
}

createRoot(document.getElementById("root")!).render(<Acceptance/>);
