import { useCallback, useEffect, useState, type ComponentType } from "react";
import ProjectCalculatorLabWorkspace, {
  ensureEstimateCosting,
} from "../projectCalculatorLab/ProjectCalculatorLabWorkspace";
import EstimateSupplierDocuments from "./EstimateSupplierDocuments";
import "./estimateCommercialWorkspace.css";
import EstimatePositionBridge from "./EstimatePositionBridge";
import EstimateSupplierCostImportControl from "./EstimateSupplierCostImportControl";
import { EstimateCommercialActionsProvider } from "./EstimateCommercialActionsContext";
import type { Client, Estimate, Position } from "../../models/types";
import CustomerQuotationPreview from "../customerQuotation/CustomerQuotationPreview";
import { apiFetch } from "../../services/api/apiClient";
import { CustomerViewPolicyProvider,DEFAULT_CUSTOMER_VIEW_POLICY,type CustomerViewPolicy } from "./customerViewPolicy";
import { estimateTotals } from "../../domain/estimates/estimateCalculations";
import { deriveProjectCostingCommercialResult } from "../projectCalculatorLab/domain/projectCostingCommercialResult";
import type { CalculatorScenario } from "../projectCalculatorLab/domain/projectCalculatorLab.types";
import { deriveNextAction } from "../workflow/workflowFoundation";
import { quotationWorkflowApi, type EstimateWorkflowState } from "../../services/quotations/quotationWorkflowApi";
import CanonicalDocumentsPanel from "../documents/CanonicalDocumentsPanel";
import type { EstimateCommercialView } from "./EstimateCommercialViewSwitch";
import type { SupplierCommercialResult } from "../projectCalculatorLab/SupplierCommercialReview";
import EstimateCommercialHeaderRows from "./EstimateCommercialHeaderRows";
import { projectCalculatorLabApi } from "../projectCalculatorLab/api/projectCalculatorLabApi";

type CommercialTab = "costing" | "import";

export default function EstimateCommercialWorkspace({
  estimateId,
  estimateRef,
  client,
  estimate,
  PositionPreview,
  initialCommercialView = "internal",
  onBack,onStatus,onCopy,onDelete,
}: {
  estimateId: string;
  estimateRef: string;
  client?: Client;
  estimate?: Estimate;
  PositionPreview?: ComponentType<{ position: Position }>;
  initialCommercialView?: EstimateCommercialView;
  onBack?:()=>void;
  onStatus?:(status:"Open"|"Order"|"Lost")=>void;onCopy?:()=>void;onDelete?:()=>void;
}) {
  const [tab, setTab] = useState<CommercialTab>("costing");
  const [positionRevision, setPositionRevision] = useState(0);
  const addPositionRequest = 0;
  const [scenarioId, setScenarioId] = useState("");
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [commercialView, setCommercialView] =
    useState<EstimateCommercialView>(initialCommercialView);
  const [customerViewPolicy,setCustomerViewPolicy]=useState<CustomerViewPolicy>(DEFAULT_CUSTOMER_VIEW_POLICY);
  const [customerValue,setCustomerValue]=useState("0");
  const [currentScenario,setCurrentScenario]=useState<CalculatorScenario|null>(null);
  const [quotationReviewed,setQuotationReviewed]=useState(false);
  const [workflowState,setWorkflowState]=useState<EstimateWorkflowState|null>(null);
  const [revisionStatus,setRevisionStatus]=useState("");
  const [creatingRevision,setCreatingRevision]=useState(false);
  const refreshWorkflow=useCallback(()=>quotationWorkflowApi.state(estimateId).then(setWorkflowState).catch(()=>setWorkflowState(null)),[estimateId]);
  useEffect(()=>{void apiFetch("/api/settings/projectPreferences").then(rows=>{const row=(Array.isArray(rows)?rows:[]).find((item:any)=>item.key==="estimate.customerViewPolicy");if(row)setCustomerViewPolicy({...DEFAULT_CUSTOMER_VIEW_POLICY,...row.value})}).catch(()=>{})},[]);
  useEffect(()=>{void apiFetch(`/api/admin/project-calculator-lab/scenarios?estimate_id=${encodeURIComponent(estimateId)}`).then(async rows=>{const first=Array.isArray(rows)?rows[0]:null;if(!first)return;const scenario=await apiFetch(`/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(first.id)}?estimate_id=${encodeURIComponent(estimateId)}`) as CalculatorScenario;setCurrentScenario(scenario);setCustomerValue(deriveProjectCostingCommercialResult(scenario).actualSale)}).catch(()=>{})},[estimateId,positionRevision]);
  useEffect(()=>{const update=(event:Event)=>{const scenario=(event as CustomEvent<CalculatorScenario>).detail;if(!scenario)return;setCurrentScenario(scenario);setCustomerValue(deriveProjectCostingCommercialResult(scenario).actualSale)};window.addEventListener("quotesuite:costing-updated",update);return()=>window.removeEventListener("quotesuite:costing-updated",update)},[]);
  useEffect(()=>{void refreshWorkflow()},[refreshWorkflow,positionRevision]);
  const totals=estimate?estimateTotals(estimate):{totalSquareMetres:0,totalLinearMetres:0,totalQty:0};
  const nextAction=deriveNextAction({manufacturerQuoteImported:workflowState?.manufacturerQuoteImported??Boolean(currentScenario&&currentScenario.origin==="supplier_import"&&currentScenario.products.length),costingReady:workflowState?.costingReady??Boolean(currentScenario?.products.length),quotationReviewed:workflowState?.quotationReviewed??quotationReviewed,quotationPrepared:workflowState?.quotationPrepared,quotationIssued:workflowState?.quotationIssued??false,followUpDue:workflowState?.followUpDue??false,followUpDueDate:workflowState?.followUpDueDate,followUpCompleted:workflowState?.followUpCompleted??false,customerAccepted:workflowState?.customerAccepted??false,orderCreated:workflowState?.orderCreated??false});
  const openImport = useCallback(() => {
    setTab("import");
    void ensureEstimateCosting(estimateId, estimateRef).then((scenario) =>
      setScenarioId(scenario.id),
    );
  }, [estimateId, estimateRef]);
  useEffect(() => {
    const handleOpenImport = () => openImport();
    window.addEventListener(
      "quotesuite:import-manufacturer-quote",
      handleOpenImport,
    );
    return () =>
      window.removeEventListener(
        "quotesuite:import-manufacturer-quote",
        handleOpenImport,
      );
  }, [openImport]);
  useEffect(() => {
    void ensureEstimateCosting(estimateId, estimateRef).then((scenario) =>
      setScenarioId(scenario.id),
    );
  }, [estimateId, estimateRef, positionRevision]);
  const createRevision=async()=>{if(!currentScenario||creatingRevision)return;setCreatingRevision(true);setRevisionStatus("");try{const updated=await projectCalculatorLabApi.createRevision(currentScenario.id);setCurrentScenario(updated);setCustomerValue(deriveProjectCostingCommercialResult(updated).actualSale);window.dispatchEvent(new CustomEvent("quotesuite:costing-updated",{detail:updated}));setRevisionStatus("Revision created.")}catch(error){setRevisionStatus(error instanceof Error?error.message:"Revision could not be created.")}finally{setCreatingRevision(false)}};
  const supplierPolicies=((currentScenario as (CalculatorScenario & {supplierCommercialPolicies?:SupplierCommercialResult[]})|null)?.supplierCommercialPolicies??[]);
  const reviewCustomerQuotation=()=>{if(!client||!estimate)return;setQuotationReviewed(true);setQuotationOpen(true)};
  return (
    <section
      className="estimate-commercial"
      data-testid="estimate-commercial-workspace"
    >
      <EstimateCommercialHeaderRows
        clientRef={client?.clientRef ?? "Client"}
        estimateRef={estimateRef}
        clientName={client?.clientName ?? "Client name unavailable"}
        commercialView={commercialView}
        onViewChange={setCommercialView}
        onBack={onBack}
        scenarioId={currentScenario?.id ?? ""}
        supplierPolicies={supplierPolicies}
        nextActionMessage={nextAction?.reason ?? "Review the current commercial worksheet."}
        revisionStatus={revisionStatus}
        creatingRevision={creatingRevision}
        onCreateRevision={() => void createRevision()}
        onOpenDocuments={() => setDocumentsOpen(true)}
        canReviewCustomerQuotation={Boolean(client && estimate)}
        onReviewCustomerQuotation={reviewCustomerQuotation}
      />
      <div
        className="estimate-commercial__content"
        onClickCapture={(event) => {
          const button = (event.target as HTMLElement).closest("button");
          if (button?.textContent?.trim() === "Import Manufacturer Quote")
            setTab("import");
        }}
      >
        <EstimateCommercialActionsProvider
          value={{ openManufacturerImport: openImport }}
        >
          <EstimatePositionBridge
            estimateId={estimateId}
            addRequest={addPositionRequest}
            refreshRequest={positionRevision}
            onChanged={() => setPositionRevision((value) => value + 1)}
          >
            {(positionControls) => (
              <EstimateCommercialActionsProvider value={{openManufacturerImport:openImport,configurePosition:positionControls.startConfigure,positionAction:positionControls.positionAction}}><CustomerViewPolicyProvider value={customerViewPolicy}><ProjectCalculatorLabWorkspace
                key={positionRevision}
                estimateId={estimateId}
                estimateRef={estimateRef}
                commercialView={commercialView}
                estimateMetrics={{
                  positions: estimate?.positions.length ?? 0,
                  totalAreaSquareMetres: totals.totalSquareMetres,
                  totalLinearMetres: totals.totalLinearMetres,
                  totalQuantity: totals.totalQty,
                  customerEstimateValue: customerValue,
                }}
              /></CustomerViewPolicyProvider></EstimateCommercialActionsProvider>
            )}
          </EstimatePositionBridge>
        </EstimateCommercialActionsProvider>
        {handoffMessage ? (
          <p
            role="status"
            className="calculator-lab__message calculator-lab__message--success"
          >
            {handoffMessage}
          </p>
        ) : null}
      </div>
      {tab === "import" ? (
        <div
          className="estimate-commercial__modal-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTab("costing");
          }}
        >
          <section
            className="estimate-commercial__modal ui-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manufacturer-import-title"
          >
            <header>
              <div>
                <h2 id="manufacturer-import-title">
                  Import Manufacturer Quote
                </h2>
                <p>Upload once, confirm the detected quotation identity, review extraction, then approve the Project Costing import.</p>
              </div>
              <button className="ui-button" onClick={() => setTab("costing")}>
                Close
              </button>
            </header>
            {scenarioId ? (
              <EstimateSupplierCostImportControl
                estimateId={estimateId}
                scenarioId={scenarioId}
                onLoaded={(message) => {
                  setHandoffMessage(
                    message ??
                      "Manufacturer quotation loaded to Products / Supply Only.",
                  );
                  setTab("costing");
                  setPositionRevision((value) => value + 1);
                }}
              />
            ) : null}
          </section>
        </div>
      ) : null}
      {quotationOpen && client && estimate ? (
        <CustomerQuotationPreview
          client={client}
          estimate={estimate}
          PositionPreview={PositionPreview}
          onClose={() => setQuotationOpen(false)}
          onWorkflowChanged={()=>void refreshWorkflow()}
        />
      ) : null}
      {documentsOpen ? <div className="estimate-commercial__modal-scrim" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setDocumentsOpen(false)}}><section className="estimate-commercial__modal ui-card" role="dialog" aria-modal="true" aria-label="Estimate Files and Documents"><header><div><h2>Files / Documents</h2><p>Canonical documents and retained supplier quotation evidence linked to {estimateRef}.</p></div><button className="ui-button" onClick={()=>setDocumentsOpen(false)}>Close</button></header><CanonicalDocumentsPanel estimateId={estimateId}/><details><summary>Supplier quotation evidence</summary><EstimateSupplierDocuments estimateId={estimateId} estimateRef={estimateRef}/></details></section></div> : null}
    </section>
  );
}
