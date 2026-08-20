import { useCallback, useEffect, useState, type ComponentType } from "react";
import ProjectCalculatorLabWorkspace, { ensureEstimateCosting } from "../projectCalculatorLab/ProjectCalculatorLabWorkspace";
import EstimateSupplierDocuments from "./EstimateSupplierDocuments";
import "./estimateCommercialWorkspace.css";
import EstimatePositionBridge from "./EstimatePositionBridge";
import EstimateSupplierCostImportControl from "./EstimateSupplierCostImportControl";
import {EstimateCommercialActionsProvider} from "./EstimateCommercialActionsContext";
import type {Client,Estimate,Position} from "../../models/types";
import CustomerQuotationPreview from "../customerQuotation/CustomerQuotationPreview";

type CommercialTab = "costing" | "import";

export default function EstimateCommercialWorkspace({ estimateId, estimateRef, client, estimate, PositionPreview }: { estimateId: string; estimateRef: string; client?:Client; estimate?:Estimate; PositionPreview?:ComponentType<{position:Position}> }) {
  const [tab, setTab] = useState<CommercialTab>("costing");
  const [positionRevision,setPositionRevision]=useState(0);
  const addPositionRequest=0;
  const [scenarioId,setScenarioId]=useState("");
  const [quotationOpen,setQuotationOpen]=useState(false);
  const [handoffMessage,setHandoffMessage]=useState("");
  const openImport=useCallback(()=>{setTab("import");void ensureEstimateCosting(estimateId,estimateRef).then(scenario=>setScenarioId(scenario.id))},[estimateId,estimateRef]);
  useEffect(()=>{const handleOpenImport=()=>openImport();window.addEventListener("quotesuite:import-manufacturer-quote",handleOpenImport);return()=>window.removeEventListener("quotesuite:import-manufacturer-quote",handleOpenImport)},[openImport]);
  useEffect(()=>{void ensureEstimateCosting(estimateId,estimateRef).then(scenario=>setScenarioId(scenario.id))},[estimateId,estimateRef,positionRevision]);
  return <section className="estimate-commercial" data-testid="estimate-commercial-workspace">
    <div className="estimate-commercial__breadcrumb"><span><strong>{estimateRef}</strong><b>›</b><span>Project Costing</span></span>{client&&estimate?<button type="button" className="ui-button ui-button--primary" onClick={()=>setQuotationOpen(true)}>Customer Quotation</button>:null}</div>
    <div className="estimate-commercial__content" onClickCapture={event=>{const button=(event.target as HTMLElement).closest("button");if(button?.textContent?.trim()==="Import Manufacturer Quote")setTab("import")}}>
      {handoffMessage?<p role="status" className="calculator-lab__message calculator-lab__message--success">{handoffMessage}</p>:null}
      <EstimateCommercialActionsProvider value={{openManufacturerImport:openImport}}><EstimatePositionBridge estimateId={estimateId} addRequest={addPositionRequest} onChanged={()=>setPositionRevision(value=>value+1)}>{()=><ProjectCalculatorLabWorkspace key={positionRevision} estimateId={estimateId} estimateRef={estimateRef} />}</EstimatePositionBridge></EstimateCommercialActionsProvider>
    </div>
    {tab==="import"?<div className="estimate-commercial__modal-scrim" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setTab("costing")}}><section className="estimate-commercial__modal ui-card" role="dialog" aria-modal="true" aria-labelledby="manufacturer-import-title"><header><div><h2 id="manufacturer-import-title">Import Manufacturer Quote</h2><p>Upload, review and import supplier evidence without leaving Project Costing.</p></div><button className="ui-button" onClick={()=>setTab("costing")}>Close</button></header><EstimateSupplierDocuments estimateId={estimateId} estimateRef={estimateRef} />{scenarioId?<EstimateSupplierCostImportControl estimateId={estimateId} scenarioId={scenarioId} onLoaded={message=>{setHandoffMessage(message??"Manufacturer quotation loaded to Products / Supply Only.");setTab("costing");setPositionRevision(value=>value+1)}}/>:null}</section></div>:null}
    {quotationOpen&&client&&estimate?<CustomerQuotationPreview client={client} estimate={estimate} PositionPreview={PositionPreview} onClose={()=>setQuotationOpen(false)}/>:null}
  </section>;
}
