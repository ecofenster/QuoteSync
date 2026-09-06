import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CalculatorAdminCatalogue from "../../src/features/projectCalculatorLab/CalculatorAdminCatalogue";
import ProjectCostingFeatureBoundary from "../../src/features/projectCalculatorLab/ProjectCostingFeatureBoundary";
import ScenarioCostingWorksheet from "../../src/features/projectCalculatorLab/ScenarioCostingWorksheet";
import { projectCalculatorLabApi } from "../../src/features/projectCalculatorLab/api/projectCalculatorLabApi";
import { normalizeCalculatorScenario } from "../../src/features/projectCalculatorLab/domain/normalizeCalculatorScenario";
import type { CalculatorAdminConfiguration, CalculatorScenario } from "../../src/features/projectCalculatorLab/domain/projectCalculatorLab.types";
import "../../src/index.css";
import "../../src/features/projectCalculatorLab/projectCalculatorLab.css";

type AcceptanceState = { scenario: CalculatorScenario; admin: CalculatorAdminConfiguration; estimateRef: string };

function App() {
  const [state, setState] = useState<AcceptanceState | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"costing" | "admin">("costing");

  useEffect(() => {
    void fetch("/acceptance-state")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Acceptance state failed (${response.status})`);
        return response.json() as Promise<AcceptanceState>;
      })
      .then((value) => {
        projectCalculatorLabApi.getAdminConfiguration = async () => value.admin;
        projectCalculatorLabApi.getInstallationWorkforce = async () => ({ companies: [], installers: [], teams: [], capabilities: [] });
        projectCalculatorLabApi.updateRule = async (_key, ruleValue) => ({ ...value.admin, rules: { ...value.admin.rules, installation_materials_v1: { value: ruleValue, version: 2 } } });
        projectCalculatorLabApi.createCatalogueItem = async () => value.admin;
        projectCalculatorLabApi.updateCatalogueItem = async () => value.admin;
        projectCalculatorLabApi.removeCatalogueItem = async (id) => ({ configuration: value.admin, disposition: "deleted", dependencies: { itemId: id, snapshotReferenceCount: 0, scenarioIds: [], snapshotsAreSelfContained: true, liveForeignKeyReferenceCount: 0 } });
        setState({ ...value, scenario: normalizeCalculatorScenario(value.scenario) });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Acceptance state unavailable"));
  }, []);

  if (error) return <main className="app-main-workspace"><p role="alert">{error}</p></main>;
  if (!state) return <main className="app-main-workspace"><p role="status">Loading read-only Project Costing acceptance…</p></main>;
  return <main className="app-main-workspace">
    <nav className="calculator-lab__tabs" aria-label="Read-only acceptance workspace">
      <button type="button" className={`ui-button${view === "costing" ? " ui-button--primary" : ""}`} onClick={() => setView("costing")}>Project Costing</button>
      <button type="button" className={`ui-button${view === "admin" ? " ui-button--primary" : ""}`} onClick={() => setView("admin")}>Administration → Installation</button>
    </nav>
    {view === "costing" ? <section data-estimate-ref={state.estimateRef}>
      <ProjectCostingFeatureBoundary resetKey={`${state.scenario.id}:${state.scenario.revisionNumber}`}>
        <ScenarioCostingWorksheet scenario={state.scenario} onSaveMarkups={async()=>{}} onUpdateProduct={async()=>{}} onUpdateSupplierCost={async()=>{}} onUpdateManualCost={async()=>{}} onRefreshRate={async()=>{}} />
      </ProjectCostingFeatureBoundary>
    </section> : <CalculatorAdminCatalogue />}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
