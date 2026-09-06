import { useState } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "../../src/layout/AppShell";
import MainDashboard from "../../src/dashboard/main/MainDashboard";
import EstimateCommercialHeaderRows from "../../src/features/estimateCommercial/EstimateCommercialHeaderRows";
import type { EstimateCommercialView } from "../../src/features/estimateCommercial/EstimateCommercialViewSwitch";
import ScenarioCostingWorksheet from "../../src/features/projectCalculatorLab/ScenarioCostingWorksheet";
import AdminSupplierCommercialDefaults from "../../src/features/admin/AdminSupplierCommercialDefaults";
import { projectCostingSimpleScenario } from "./ProjectCostingSimpleAcceptance";
import type { Client } from "../../src/models/types";
import "../../src/index.css";
import "../../src/layout/AppShell.css";
import "../../src/features/estimateCommercial/estimateCommercialWorkspace.css";
import "../../src/features/projectCalculatorLab/projectCalculatorLab.css";
import "../../src/features/admin/AdminPlaceholderPage.css";
import "./VisualDesignV2Acceptance.css";

const dashboardClients = [{
  id: "v2-client",
  type: "Individual",
  clientRef: "EF-CL-V2",
  clientName: "Visual Design Laboratory",
  projectName: "Garden Room",
  projectAddress: "Edinburgh",
  estimates: [{
    id: "v2-estimate",
    estimateRef: "EF-EST-V2-LAB",
    projectName: "Garden Room",
    status: "Draft",
    positions: [{ id: "v2-position", positionRef: "001", roomName: "Kitchen", qty: 2, itemPrice: 7850 }],
  }],
}] as Client[];

function VisualDesignV2Acceptance() {
  const [scenario, setScenario] = useState(projectCostingSimpleScenario);
  const [commercialView, setCommercialView] = useState<EstimateCommercialView>("internal");

  return (
    <AppShell title="QuoteSuite Visual Design V2" activeNavKey="home">
      <main className="app-main-workspace visual-v2-acceptance">
        <section data-visual-lab-screen="dashboard">
          <MainDashboard clients={dashboardClients} activeUserName="User" onOpenMenu={() => {}} onOpenEstimate={() => {}} />
        </section>

        <section className="estimate-commercial" data-visual-lab-screen="project-costing">
          <EstimateCommercialHeaderRows
            clientRef="EF-CL-V2"
            estimateRef="EF-EST-V2-LAB"
            clientName="Visual Design Laboratory"
            commercialView={commercialView}
            onViewChange={setCommercialView}
            onBack={() => {}}
            scenarioId="fixture"
            supplierPolicies={[]}
            nextActionMessage="Review the current commercial worksheet."
            creatingRevision={false}
            onCreateRevision={() => {}}
            onOpenDocuments={() => {}}
            canReviewCustomerQuotation
            onReviewCustomerQuotation={() => {}}
          />
          <div className="estimate-commercial__content">
            <ScenarioCostingWorksheet
              commercialView={commercialView}
              scenario={scenario}
              estimateMetrics={{
                positions: 5,
                totalAreaSquareMetres: 18.42,
                totalLinearMetres: 47.65,
                totalQuantity: 7,
                customerEstimateValue: "158008.50",
              }}
              onSaveMarkups={async () => {}}
              onUpdateProduct={async () => {}}
              onUpdateSupplierCost={async (id, input) => {
                setScenario((current: any) => ({
                  ...current,
                  supplierCosts: current.supplierCosts.map((row: any) => row.id === id ? { ...row, ...input } : row),
                }));
                return scenario;
              }}
              onUpdateManualCost={async () => {}}
              onRefreshRate={async () => {}}
            />
          </div>
        </section>

        <section className="visual-v2-acceptance__admin" data-visual-lab-screen="administration">
          <header className="ui-page-header">
            <div><h1 className="ui-page-header__title">Administration</h1><p className="ui-page-header__copy">Real supplier defaults component used to assess forms, tables, tabs, toggles and modal-adjacent controls.</p></div>
            <span className="ui-status ui-status--warning">V2 visual test</span>
          </header>
          <AdminSupplierCommercialDefaults />
        </section>
      </main>
    </AppShell>
  );
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<VisualDesignV2Acceptance />);
