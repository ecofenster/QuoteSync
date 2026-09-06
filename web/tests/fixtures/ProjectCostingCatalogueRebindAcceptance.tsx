import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/features/projectCalculatorLab/projectCalculatorLab.css";
import ScenarioCostingWorksheet from "../../src/features/projectCalculatorLab/ScenarioCostingWorksheet";
import { projectCalculatorLabApi } from "../../src/features/projectCalculatorLab/api/projectCalculatorLabApi";
import type { CalculatorScenario } from "../../src/features/projectCalculatorLab/domain/projectCalculatorLab.types";
import { setApiMutationSafety } from "../../src/services/api/apiClient";

(window as typeof window & { setFixtureMutationSafety?: (allowed: boolean, state?: string) => void }).setFixtureMutationSafety = (allowed, state = "fixture") => {
  setApiMutationSafety({ allowed, state });
};

function Acceptance() {
  const [scenario, setScenario] = useState<CalculatorScenario | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = (event: Event) => setScenario((event as CustomEvent<CalculatorScenario>).detail);
    window.addEventListener("quotesuite:costing-updated", update);
    void projectCalculatorLabApi.getScenario("installation-catalogue-rebind").then(setScenario).catch((reason) => setError(reason instanceof Error ? reason.message : "Scenario unavailable"));
    return () => window.removeEventListener("quotesuite:costing-updated", update);
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!scenario) return <p role="status">Loading Project Costing…</p>;
  return <main className="app-main-workspace"><ScenarioCostingWorksheet scenario={scenario} onSaveMarkups={async()=>{}} onUpdateProduct={async()=>{}} onUpdateSupplierCost={async(rowId,input)=>setScenario(await projectCalculatorLabApi.updateSupplierCost(scenario.id,rowId,input))} onUpdateManualCost={async()=>{}} onRefreshRate={async()=>{}} /></main>;
}

document.documentElement.dataset.theme = "dark";
createRoot(document.getElementById("root")!).render(<Acceptance />);
