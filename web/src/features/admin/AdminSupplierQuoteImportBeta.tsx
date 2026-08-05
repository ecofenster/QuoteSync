import { useState } from "react";
import SupplierImportLabWorkspace from "../supplierImportLab/SupplierImportLabWorkspace";
import ProjectCalculatorLabWorkspace from "../projectCalculatorLab/ProjectCalculatorLabWorkspace";

export default function AdminSupplierQuoteImportBeta() {
  const [activeFeature, setActiveFeature] = useState<"supplier" | "calculator">("supplier");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="admin-page-title">Feature Controls</div>
        <div className="admin-body-copy" style={{ maxWidth: 900 }}>
          Development-only feature entry points. These tools do not define the final commercial workflow.
        </div>
      </div>
      <div className="admin-flex-row" role="tablist" aria-label="Feature Controls tools">
        <button type="button" role="tab" aria-selected={activeFeature === "supplier"} className={activeFeature === "supplier" ? "ui-button ui-button--primary" : "ui-button"} onClick={() => setActiveFeature("supplier")}>Supplier Quote Import</button>
        <button type="button" role="tab" aria-selected={activeFeature === "calculator"} className={activeFeature === "calculator" ? "ui-button ui-button--primary" : "ui-button"} onClick={() => setActiveFeature("calculator")}>Project Calculator</button>
      </div>
      {activeFeature === "supplier" ? <SupplierImportLabWorkspace /> : <ProjectCalculatorLabWorkspace />}
    </div>
  );
}
