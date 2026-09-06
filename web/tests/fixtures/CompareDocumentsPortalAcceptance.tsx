import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "../../src/layout/AppShell";
import CompareQuotesWorkspace from "../../src/features/quoteComparisons/CompareQuotesWorkspace";
import AdminManufacturerDocuments from "../../src/features/admin/AdminManufacturerDocuments";
import ClientPortalPreview from "../../src/features/clientPortal/ClientPortalPreview";
import { applyQuoteSuiteVisualTheme, type QuoteSuiteVisualThemeId } from "../../src/theme/visualDesignV2";
import type { Client } from "../../src/models/types";
import "../../src/index.css";
import "../../src/layout/AppShell.css";
import "../../src/features/admin/AdminPlaceholderPage.css";

const positions=[{id:"position-a",positionRef:"001",roomName:"Kitchen",qty:1,widthMm:1200,heightMm:1400,fieldsX:1,fieldsY:1,insertion:"Fixed",cellInsertions:{},positionType:"Window",useEstimateDefaults:true,overrides:{}},{id:"position-b",positionRef:"002",roomName:"Hall",qty:2,widthMm:900,heightMm:2100,fieldsX:1,fieldsY:1,insertion:"Door",cellInsertions:{},positionType:"Door",useEstimateDefaults:true,overrides:{}}] as any;
const client={id:"test-client",type:"Individual",clientRef:"TEST-CL-001",clientName:"Foundation Review",email:"review@example.com",mobile:"",home:"",projectName:"Garden Room",customerAddress:"",projectAddress:"Edinburgh",invoiceAddress:"",estimates:[{id:"estimate-r2",projectId:"test-project",projectName:"Garden Room",estimateRef:"TEST-EST-001-R2",baseEstimateRef:"TEST-EST-001",revisionNo:2,status:"Draft",estimatedOrderMonth:"September",estimatedOrderYear:2026,defaults:{},positions,outcome:"Open"},{id:"estimate-r1",projectId:"test-project",projectName:"Garden Room",estimateRef:"TEST-EST-001",baseEstimateRef:"TEST-EST-001",revisionNo:1,status:"Completed",estimatedOrderMonth:"August",estimatedOrderYear:2026,defaults:{},positions,outcome:"Lost"}]} as Client;

type ProofWindow = Window & { __applyFoundationTheme?: (themeId: QuoteSuiteVisualThemeId) => void };

function Acceptance(){const [screen,setScreen]=useState<"compare"|"documents"|"portal">("compare");useEffect(()=>{applyQuoteSuiteVisualTheme("quotesuite-v2-dark",false);const proofWindow=window as ProofWindow;proofWindow.__applyFoundationTheme=(themeId)=>applyQuoteSuiteVisualTheme(themeId,false);return()=>{delete proofWindow.__applyFoundationTheme}},[]);return <AppShell title="QuoteSuite Foundation Review" activeNavKey="clients"><main className="app-main-workspace compare-foundation-acceptance"><nav className="ui-action-row" aria-label="Proof screens"><button className={screen==="compare"?"ui-button ui-button--primary":"ui-button ui-button--ghost"} onClick={()=>setScreen("compare")}>Compare Quotes</button><button className={screen==="documents"?"ui-button ui-button--primary":"ui-button ui-button--ghost"} onClick={()=>setScreen("documents")}>Manufacturer Documents</button><button className={screen==="portal"?"ui-button ui-button--primary":"ui-button ui-button--ghost"} onClick={()=>setScreen("portal")}>Portal Preview</button></nav><div data-proof-screen={screen}>{screen==="compare"?<CompareQuotesWorkspace client={client}/>:screen==="documents"?<AdminManufacturerDocuments/>:<ClientPortalPreview client={client} releasedEstimateIds={["estimate-r2"]} rejectedEstimateIds={["estimate-r1"]} releasedDocumentIds={["customer_quotation:issued"]} commercialByEstimateId={{"estimate-r2":{supplyOnly:10000,installation:2500,vat:2500,total:15000,currency:"GBP"}}}/>}</div></main></AppShell>}
if(typeof document!=="undefined")createRoot(document.getElementById("root")!).render(<Acceptance/>);
