import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/features/admin/AdminPlaceholderPage.css";
import "../../src/features/projectCalculatorLab/projectCalculatorLab.css";
import AdminImportCustomsDefaults from "../../src/features/admin/AdminImportCustomsDefaults";
import AdminSupplierCommercialDefaults from "../../src/features/admin/AdminSupplierCommercialDefaults";

function App() {
  return <main className="app-main-workspace"><div className="admin-page-stack"><AdminImportCustomsDefaults /><AdminSupplierCommercialDefaults /></div></main>;
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<App />);
