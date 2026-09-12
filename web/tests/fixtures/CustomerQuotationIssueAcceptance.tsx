import { createRoot } from "react-dom/client";
import CustomerQuotationPreview from "../../src/features/customerQuotation/CustomerQuotationPreview";
import { reviewedEmailText, reviewedEmailHtml } from "../../src/services/quotations/reviewedEmailBody";
import "../../src/styles/tokens.css";
import "../../src/styles/base.css";
import "../../src/styles/ui.css";

const client={id:"client-1",clientName:"Disposable Customer",clientRef:"TEST-CL-1",projectName:"Disposable Project",projectAddress:"1 Test Street",email:"customer@example.test"} as any;
Object.assign(window,{reviewedEmailText,reviewedEmailHtml});
const estimate={id:"estimate-1",estimateRef:"TEST-EST-1",revisionNo:2,projectName:"Disposable Project",projectAddress:"1 Test Street",positions:[]} as any;

createRoot(document.getElementById("root")!).render(<CustomerQuotationPreview client={client} estimate={estimate} onClose={()=>undefined}/>);
