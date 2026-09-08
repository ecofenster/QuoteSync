import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "../../src/layout/AppShell";
import CompareQuotesWorkspace from "../../src/features/quoteComparisons/CompareQuotesWorkspace";
import { applyQuoteSuiteVisualTheme } from "../../src/theme/visualDesignV2";
import type { Client } from "../../src/models/types";
import "../../src/index.css";
import "../../src/layout/AppShell.css";

const parameters=new URLSearchParams(window.location.search);
const client={id:parameters.get("clientId")||"test-client",type:"Individual",clientRef:parameters.get("clientRef")||"TEST-CL-TY-CLAI",clientName:"Disposable comparison acceptance",email:"test@example.invalid",mobile:"",home:"",projectName:"Comparison acceptance",customerAddress:"",projectAddress:"Disposable evidence only",invoiceAddress:"",estimates:[]} as unknown as Client;

function Acceptance(){
  useEffect(()=>{applyQuoteSuiteVisualTheme("quotesuite-v2-dark",false);const timer=window.setInterval(()=>{const button=[...document.querySelectorAll("button")].find(item=>item.textContent==="New comparison") as HTMLButtonElement|undefined;if(button){button.click();window.clearInterval(timer)}},25);return()=>window.clearInterval(timer)},[]);
  return <AppShell title="Compare Quotes extraction-first acceptance" activeNavKey="clients"><main className="app-main-workspace compare-foundation-acceptance"><CompareQuotesWorkspace client={client}/></main></AppShell>;
}

createRoot(document.getElementById("root")!).render(<Acceptance/>);
