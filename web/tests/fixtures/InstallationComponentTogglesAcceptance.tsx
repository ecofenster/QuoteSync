import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/features/projectCalculatorLab/projectCalculatorLab.css";
import ScenarioCostingWorksheet from "../../src/features/projectCalculatorLab/ScenarioCostingWorksheet";
import type { CalculatorScenario } from "../../src/features/projectCalculatorLab/domain/projectCalculatorLab.types";
import { RuntimeHealthProvider } from "../../src/features/runtimeHealth/RuntimeHealthContext";

const apiBase = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function AcceptanceApp() {
  const [scenario, setScenario] = useState<CalculatorScenario | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`${apiBase}/fixture/scenario`).then(async (response) => {
      if (!response.ok) throw new Error(`Fixture scenario failed: ${response.status}`);
      setScenario(await response.json());
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Fixture scenario failed."));
    const update = (event: Event) => setScenario((event as CustomEvent<CalculatorScenario>).detail);
    window.addEventListener("quotesuite:costing-updated", update);
    return () => window.removeEventListener("quotesuite:costing-updated", update);
  }, []);
  if (error) return <main role="alert">{error}</main>;
  if (!scenario) return <main>Loading Project Costing…</main>;
  return <main className="app-main-workspace"><ScenarioCostingWorksheet scenario={scenario} onSaveMarkups={async()=>{}} onUpdateProduct={async()=>{}} onUpdateSupplierCost={async()=>{}} onUpdateManualCost={async()=>{}} onRefreshRate={async()=>{}} /></main>;
}

document.documentElement.dataset.theme = "light";
createRoot(document.getElementById("root")!).render(<React.StrictMode><RuntimeHealthProvider><AcceptanceApp /></RuntimeHealthProvider></React.StrictMode>);
