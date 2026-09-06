import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/features/estimateCommercial/estimateCommercialWorkspace.css";
import EstimateSupplierCostImportControl from "../../src/features/estimateCommercial/EstimateSupplierCostImportControl";

function App() {
  return <main className="app-main-workspace"><section className="estimate-commercial"><div className="estimate-commercial__modal ui-card"><header><div><h2>Import Manufacturer Quote</h2><p>Upload once, confirm the detected quotation identity, review extraction, then approve the Project Costing import.</p></div></header><EstimateSupplierCostImportControl estimateId="estimate" scenarioId={import.meta.env.VITE_ACCEPTANCE_SCENARIO_ID} onLoaded={(message) => { document.documentElement.dataset.importResult = message ?? "loaded"; }}/></div></section></main>;
}

document.documentElement.dataset.theme = "dark";
createRoot(document.getElementById("root")!).render(<App />);
