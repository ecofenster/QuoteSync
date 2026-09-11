import { useState } from "react";
import { createRoot } from "react-dom/client";
import SupplierRfqDialog from "../../src/features/estimateCommercial/SupplierRfqDialog";
import "../../src/styles/tokens.css";
import "../../src/styles/base.css";
import "../../src/styles/ui.css";
import "../../src/features/estimateCommercial/estimateCommercialWorkspace.css";

function Acceptance(){const [open,setOpen]=useState(false);return <main data-testid="supplier-rfq-acceptance"><button className="ui-button ui-button--primary" onClick={()=>setOpen(true)}>Request supplier quote</button>{open?<SupplierRfqDialog projectId="project-1" estimateId="estimate-1" estimateRef="TEST-EST-1" onClose={()=>setOpen(false)}/>:null}</main>}
createRoot(document.getElementById("root")!).render(<Acceptance/>);
