import { useEffect, useState } from "react";
import ProjectCalculatorLabWorkspace from "../projectCalculatorLab/ProjectCalculatorLabWorkspace";
import EstimateSupplierDocuments from "./EstimateSupplierDocuments";
import "./estimateCommercialWorkspace.css";
import EstimatePositionBridge from "./EstimatePositionBridge";
import EstimateSupplierCostImportControl from "./EstimateSupplierCostImportControl";
import { projectCalculatorLabApi } from "../projectCalculatorLab/api/projectCalculatorLabApi";
import {EstimateCommercialActionsProvider} from "./EstimateCommercialActionsContext";

type CommercialTab = "costing" | "import";

export default function EstimateCommercialWorkspace({ estimateId, estimateRef }: { estimateId: string; estimateRef: string }) {
  const [tab, setTab] = useState<CommercialTab>("costing");
  const [positionRevision,setPositionRevision]=useState(0);
  const addPositionRequest=0;
  const [scenarioId,setScenarioId]=useState("");
  useEffect(()=>{const openImport=()=>setTab("import");window.addEventListener("quotesuite:import-manufacturer-quote",openImport);return()=>window.removeEventListener("quotesuite:import-manufacturer-quote",openImport)},[]);
  useEffect(()=>{void projectCalculatorLabApi.listScenarios(estimateId).then(items=>setScenarioId(items[0]?.id??""))},[estimateId,positionRevision]);
  return <section className="estimate-commercial" data-testid="estimate-commercial-workspace">
    <div className="estimate-commercial__breadcrumb"><strong>{estimateRef}</strong><b>›</b><span>Project Costing</span></div>
    <div className="estimate-commercial__content" onClickCapture={event=>{const button=(event.target as HTMLElement).closest("button");if(button?.textContent?.trim()==="Import Manufacturer Quote")setTab("import")}}>
      <EstimateCommercialActionsProvider value={{openManufacturerImport:()=>setTab("import")}}><EstimatePositionBridge estimateId={estimateId} addRequest={addPositionRequest} onChanged={()=>setPositionRevision(value=>value+1)}>{()=><ProjectCalculatorLabWorkspace key={positionRevision} estimateId={estimateId} estimateRef={estimateRef} />}</EstimatePositionBridge></EstimateCommercialActionsProvider>
    </div>
    {tab==="import"?<div className="estimate-commercial__modal-scrim" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setTab("costing")}}><section className="estimate-commercial__modal ui-card" role="dialog" aria-modal="true" aria-labelledby="manufacturer-import-title"><header><div><h2 id="manufacturer-import-title">Import Manufacturer Quote</h2><p>Upload, review and import supplier evidence without leaving Project Costing.</p></div><button className="ui-button" onClick={()=>setTab("costing")}>Close</button></header><EstimateSupplierDocuments estimateId={estimateId} estimateRef={estimateRef} />{scenarioId?<EstimateSupplierCostImportControl estimateId={estimateId} scenarioId={scenarioId} onLoaded={()=>{setTab("costing");setPositionRevision(value=>value+1)}}/>:null}</section></div>:null}
  </section>;
}
