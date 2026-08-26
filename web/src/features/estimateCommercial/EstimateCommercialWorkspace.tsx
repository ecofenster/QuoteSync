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

type CommercialTab = "costing" | "import";
type CommercialView = "internal" | "customer";

export default function EstimateCommercialWorkspace({
  estimateId,
  estimateRef,
  client,
  estimate,
  PositionPreview,
  initialCommercialView = "internal",
  onOpenFollowUps,onStatus,onCopy,onDelete,
}: {
  estimateId: string;
  estimateRef: string;
  client?: Client;
  estimate?: Estimate;
  PositionPreview?: ComponentType<{ position: Position }>;
  initialCommercialView?: CommercialView;
  onOpenFollowUps?:()=>void;onStatus?:(status:"Open"|"Order"|"Lost")=>void;onCopy?:()=>void;onDelete?:()=>void;
}) {
  const [tab, setTab] = useState<CommercialTab>("costing");
  const [positionRevision, setPositionRevision] = useState(0);
  const addPositionRequest = 0;
  const [scenarioId, setScenarioId] = useState("");
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [commercialView, setCommercialView] =
    useState<CommercialView>(initialCommercialView);
  const [customerViewPolicy,setCustomerViewPolicy]=useState<CustomerViewPolicy>(DEFAULT_CUSTOMER_VIEW_POLICY);
  const [customerValue,setCustomerValue]=useState("0");
  const [currentScenario,setCurrentScenario]=useState<CalculatorScenario|null>(null);
  const [quotationReviewed,setQuotationReviewed]=useState(false);
  const [workflowState,setWorkflowState]=useState<EstimateWorkflowState|null>(null);
  const refreshWorkflow=useCallback(()=>quotationWorkflowApi.state(estimateId).then(setWorkflowState).catch(()=>setWorkflowState(null)),[estimateId]);
  useEffect(()=>{void apiFetch("/api/settings/projectPreferences").then(rows=>{const row=(Array.isArray(rows)?rows:[]).find((item:any)=>item.key==="estimate.customerViewPolicy");if(row)setCustomerViewPolicy({...DEFAULT_CUSTOMER_VIEW_POLICY,...row.value})}).catch(()=>{})},[]);
  useEffect(()=>{void apiFetch(`/api/admin/project-calculator-lab/scenarios?estimate_id=${encodeURIComponent(estimateId)}`).then(async rows=>{const first=Array.isArray(rows)?rows[0]:null;if(!first)return;const scenario=await apiFetch(`/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(first.id)}?estimate_id=${encodeURIComponent(estimateId)}`) as CalculatorScenario;setCurrentScenario(scenario);setCustomerValue(deriveProjectCostingCommercialResult(scenario).actualSale)}).catch(()=>{})},[estimateId,positionRevision]);
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
  return (
    <section
      className="estimate-commercial"
      data-testid="estimate-commercial-workspace"
    >
      <div className="estimate-commercial__breadcrumb">
        <span>
          <strong>{estimateRef}</strong>
          <b>›</b>
          <span>Project Costing</span>
        </span>
        <div className="estimate-commercial__view-switch" role="group" aria-label="Commercial view">
          <button type="button" className={`ui-button${commercialView === "internal" ? " ui-button--selected" : ""}`} aria-pressed={commercialView === "internal"} onClick={() => setCommercialView("internal")}>Internal View</button>
          <button type="button" className={`ui-button${commercialView === "customer" ? " ui-button--selected" : ""}`} aria-pressed={commercialView === "customer"} onClick={() => setCommercialView("customer")}>Customer View</button>
        </div>
        {commercialView==="internal"||customerViewPolicy.manufacturerImport?<button type="button" className="ui-button" onClick={openImport}>Import Manufacturer Quote</button>:null}
        <button type="button" className="ui-button" onClick={()=>setDocumentsOpen(true)}>Files / Documents</button>
        {client && estimate && (commercialView==="internal"||customerViewPolicy.customerQuotation) ? (
          <button
            type="button"
            className="ui-button ui-button--primary estimate-commercial__document-action"
            onClick={() => { setQuotationReviewed(true); setQuotationOpen(true); }}
          >
            Customer Quotation
          </button>
        ) : null}
      </div>
      {nextAction ? <aside className="estimate-commercial__next-action"><div><strong>Next Action</strong><span>{nextAction.reason}</span></div><button type="button" className="ui-button ui-button--primary" onClick={() => { if(nextAction.id==="import_manufacturer_quote")openImport(); else if(nextAction.id==="review_customer_quotation"||nextAction.id==="send_to_client"||nextAction.id==="complete_send_quotation"){setQuotationReviewed(true);setQuotationOpen(true);} else if(nextAction.id==="complete_follow_up"||nextAction.id==="schedule_next_follow_up")onOpenFollowUps?.(); else setTab("costing"); }}>{nextAction.label}</button></aside> : null}
      <div
        className="estimate-commercial__content"
        onClickCapture={(event) => {
          const button = (event.target as HTMLElement).closest("button");
          if (button?.textContent?.trim() === "Import Manufacturer Quote")
            setTab("import");
        }}
      >
        {handoffMessage ? (
          <p
            role="status"
            className="calculator-lab__message calculator-lab__message--success"
          >
            {handoffMessage}
          </p>
        ) : null}
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
                <p>
                  Upload, review and import supplier evidence without leaving
                  Project Costing.
                </p>
              </div>
              <button className="ui-button" onClick={() => setTab("costing")}>
                Close
              </button>
            </header>
            <EstimateSupplierDocuments
              estimateId={estimateId}
              estimateRef={estimateRef}
            />
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
      {documentsOpen ? <div className="estimate-commercial__modal-scrim" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setDocumentsOpen(false)}}><section className="estimate-commercial__modal ui-card" role="dialog" aria-modal="true" aria-label="Estimate Files and Documents"><header><div><h2>Files / Documents</h2><p>Canonical document records linked to {estimateRef}.</p></div><button className="ui-button" onClick={()=>setDocumentsOpen(false)}>Close</button></header><CanonicalDocumentsPanel estimateId={estimateId}/></section></div> : null}
    </section>
  );
}
