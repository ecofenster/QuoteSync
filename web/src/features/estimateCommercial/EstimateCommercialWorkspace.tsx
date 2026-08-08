import { useState } from "react";
import ProjectCalculatorLabWorkspace from "../projectCalculatorLab/ProjectCalculatorLabWorkspace";
import EstimateSupplierDocuments from "./EstimateSupplierDocuments";
import "./estimateCommercialWorkspace.css";

type CommercialTab = "costing" | "import";

export default function EstimateCommercialWorkspace({ estimateId, estimateRef }: { estimateId: string; estimateRef: string }) {
  const [tab, setTab] = useState<CommercialTab>("costing");
  return <section className="estimate-commercial" data-testid="estimate-commercial-workspace">
    <div className="estimate-commercial__breadcrumb"><strong>{estimateRef}</strong><b>›</b><span>{tab === "costing" ? "Project Costing" : "Import Supplier Costs"}</span></div>
    <nav className="estimate-commercial__nav" aria-label="Estimate commercial workflow">
      <button className={tab === "costing" ? "is-active" : ""} onClick={() => setTab("costing")}>Project Costing</button>
      <button className={tab === "import" ? "is-active" : ""} onClick={() => setTab("import")}>Import Supplier Costs</button>
    </nav>
    <div className="estimate-commercial__content">
      {tab === "costing"
        ? <ProjectCalculatorLabWorkspace estimateId={estimateId} estimateRef={estimateRef} />
        : <EstimateSupplierDocuments estimateId={estimateId} estimateRef={estimateRef} />}
    </div>
  </section>;
}
