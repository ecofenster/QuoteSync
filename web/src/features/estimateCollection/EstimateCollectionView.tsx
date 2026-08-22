import { useEffect, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome } from "../../models/types";
import { H3, Small } from "../estimatePicker/tabs/shared";
import EstimateCollectionRow from "./EstimateCollectionRow";
import EstimateExpandedPanel from "./EstimateExpandedPanel";
import type { EstimateCollectionItem } from "./EstimateCollectionItem";
import { apiFetch } from "../../services/api/apiClient";
import { deriveProjectCostingCommercialResult } from "../projectCalculatorLab/domain/projectCostingCommercialResult";
import type { CalculatorScenario } from "../projectCalculatorLab/domain/projectCalculatorLab.types";
import { estimateTotals } from "../../domain/estimates/estimateCalculations";

export type EstimateCollectionViewMode = "list" | "grid";

type Props = {
  currentTab: string;
  titleText: string;
  emptyText: string;
  items: EstimateCollectionItem[];
  showSectionSummary?: boolean;
  viewMode?: EstimateCollectionViewMode;
  outcome: EstimateOutcome;
  sectionTotals: { totalSquareMetres: number; totalLinearMetres: number; totalQty: number; totalCost: number };
  expandedEstimateId: EstimateId | null;
  onToggleEstimate: (estimateId: EstimateId) => void;
  statusMenuForEstimateId: string | null;
  setStatusMenuForEstimateId: Dispatch<SetStateAction<string | null>>;
  selectedOrderForInstallations: string | null;
  rankedInstallers: any[];
  selectedInstallerByEstimateId: Record<string, string>;
  supplierEstimateFilesByEstimateId: Record<string, string[]>;
  itemPriceByPositionId: Record<string, string>;
  setItemPriceByPositionId: Dispatch<SetStateAction<Record<string, string>>>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  getClientForItem: (item: EstimateCollectionItem) => Client;
  activeUserName: string;
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  copyEstimateForClient: (client: Client, sourceEstimateId: EstimateId) => void;
  confirmDeleteEstimate: (estimateId: EstimateId) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;
  persistEstimateOutcome: (clientId: ClientId, estimateId: EstimateId, outcome: EstimateOutcome) => void;
  downloadEstimateWordDocService: (args: any) => void;
  printEstimatePdfService: (args: any) => void;
  addFollowUpForEstimateService: (args: any) => void;
  positionDescription: (p: any) => string;
  PositionPreview: ComponentType<{ position: any }>;
  timelineWithCompletion: (e: any) => any[];
  openInstallations: (e: any, pickerClient: any) => Promise<void>;
  installerLabel: (installerId: string) => string;
  selectInstallerForEstimate: (estimateId: EstimateId, installerId: string) => void;
  setOrderMetaField: (estimateId: EstimateId, key: string, value: any) => void;
  setSendModalEstimateId: Dispatch<SetStateAction<string | null>>;
  setSendModalOpen: Dispatch<SetStateAction<boolean>>;
  importSupplierEstimate: (estimateId: EstimateId) => void;
};

export default function EstimateCollectionView(props: Props) {
  const {
    currentTab,
    titleText,
    emptyText,
    items,
    showSectionSummary = true,
    viewMode = "list",
    outcome,
    sectionTotals,
    expandedEstimateId,
    onToggleEstimate,
    statusMenuForEstimateId,
    setStatusMenuForEstimateId,
    selectedOrderForInstallations,
    rankedInstallers,
    selectedInstallerByEstimateId,
    supplierEstimateFilesByEstimateId,
    itemPriceByPositionId,
    setItemPriceByPositionId,
    formatMeasure,
    formatMoney,
    getClientForItem,
    activeUserName,
    apiFetchJson,
    copyEstimateForClient,
    confirmDeleteEstimate,
    openEstimateFromPicker,
    persistEstimateOutcome,
    downloadEstimateWordDocService,
    printEstimatePdfService,
    addFollowUpForEstimateService,
    positionDescription,
    PositionPreview,
    timelineWithCompletion,
    openInstallations,
    installerLabel,
    selectInstallerForEstimate,
    setOrderMetaField,
    setSendModalEstimateId,
    setSendModalOpen,
    importSupplierEstimate,
  } = props;
  const [customerValues, setCustomerValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (currentTab !== "estimates") return;
    let cancelled = false;
    void Promise.all(items.map(async (item) => {
      const scenarios = await apiFetch(`/api/admin/project-calculator-lab/scenarios?estimate_id=${encodeURIComponent(item.id)}`) as Array<{ id: string }>;
      if (!scenarios[0]) return [item.id, "0"] as const;
      const scenario = await apiFetch(`/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(scenarios[0].id)}?estimate_id=${encodeURIComponent(item.id)}`) as CalculatorScenario;
      return [item.id, deriveProjectCostingCommercialResult(scenario).actualSale] as const;
    })).then((entries) => { if (!cancelled) setCustomerValues(Object.fromEntries(entries)); }).catch(() => { if (!cancelled) setCustomerValues({}); });
    return () => { cancelled = true; };
  }, [currentTab, items]);

  if (currentTab === "estimates") {
    return <div className="ep-section-shell"><div className="estimate-index-table-wrap"><table className="estimate-index-table"><thead><tr><th>Estimate</th><th>Client</th><th className="estimate-index-secondary-column">Project</th><th>Positions</th><th>Area</th><th>Linear Metres</th><th>Qty</th><th>Value</th><th className="estimate-index-secondary-column">Updated</th><th className="estimate-index-actions-cell"><span className="estimate-index-action-headings"><span>Email</span><span>Follow Up</span><span>Status</span><span>Copy</span><span>Delete</span><span>Open</span></span></th></tr></thead><tbody>{items.map((item) => { const totals = estimateTotals(item),itemClient=getClientForItem(item); return <tr key={item.id} data-estimate-ref={item.estimateRef}><td><strong>{item.estimateRef}</strong></td><td>{item.clientName || item.clientReference || "—"}</td><td className="estimate-index-secondary-column">{item.projectAddress || "—"}</td><td>{item.positions.length}</td><td>{formatMeasure(totals.totalSquareMetres)} m²</td><td>{formatMeasure(totals.totalLinearMetres)} lm</td><td>{totals.totalQty}</td><td>{formatMoney(Number(customerValues[item.id] || 0))}</td><td className="estimate-index-secondary-column">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("en-GB") : "—"}</td><td className="estimate-index-actions-cell"><span className="estimate-index-actions"><button type="button" className="ui-button" aria-label={`Email ${item.estimateRef}`} title="Email" onClick={()=>{setSendModalEstimateId(item.id);setSendModalOpen(true)}}>✉</button><button type="button" className="ui-button" aria-label={`Follow up ${item.estimateRef}`} title="Follow Up" onClick={()=>addFollowUpForEstimateService({pickerClient:itemClient,estimateId:item.id,opts:{days:3,sendEmail:true,needsCall:true},apiFetchJson,activeUserName,alertFn:alert,logError:console.error})}>◷</button><select className="ui-input" aria-label={`Estimate Status ${item.estimateRef}`} value={item.outcome??"Open"} onChange={event=>persistEstimateOutcome(itemClient.id,item.id,event.currentTarget.value as EstimateOutcome)}><option>Open</option><option>Order</option><option>Lost</option></select><button type="button" className="ui-button" aria-label={`Copy ${item.estimateRef}`} title="Copy Estimate" onClick={()=>copyEstimateForClient(itemClient,item.id)}>⧉</button><button type="button" className="ui-button" aria-label={`Delete ${item.estimateRef}`} title="Delete Estimate" onClick={()=>confirmDeleteEstimate(item.id)}>×</button><button type="button" className="ui-button ui-button--primary" aria-label={`Open ${item.estimateRef}`} title="Open Estimate" onClick={() => onToggleEstimate(item.id)}>Open</button></span></td></tr>; })}</tbody></table>{items.length === 0 ? <div className="ep-empty-state"><Small>{emptyText}</Small></div> : null}</div></div>;
  }

  return (
    <div className="ep-section-shell">
      {showSectionSummary && (
        <>
          <div className="ep-section-header">
            <H3>{titleText}</H3>
            <Small>Combined totals for all estimates in this section.</Small>
          </div>

          <div className="ep-section-stats-grid">
            <div className="ep-stat-card">
              <div className="ep-stat-label">Total m²</div>
              <div className="ep-stat-value">{formatMeasure(sectionTotals.totalSquareMetres)}</div>
            </div>
            <div className="ep-stat-card">
              <div className="ep-stat-label">Linear metreage</div>
              <div className="ep-stat-value">{formatMeasure(sectionTotals.totalLinearMetres)}</div>
            </div>
            <div className="ep-stat-card">
              <div className="ep-stat-label">Total quantity</div>
              <div className="ep-stat-value">{sectionTotals.totalQty}</div>
            </div>
            <div className="ep-stat-card">
              <div className="ep-stat-label">Total cost</div>
              <div className="ep-stat-value">{formatMoney(sectionTotals.totalCost)}</div>
              <Small className="qs-migrated-239">{items.length} estimate(s) in this section</Small>
            </div>
          </div>
        </>
      )}

      <div className={`ep-section-estimates ep-section-estimates--${viewMode}`}>
        {items.map((item) => {
          const isExpanded = expandedEstimateId === item.id;
          const itemClient = getClientForItem(item);

          return (
            <div
              key={item.id}
              className={`ep-estimate-card ep-estimate-card--${viewMode} ${isExpanded ? "ep-estimate-card--expanded" : ""}`}
              data-span={viewMode === "grid" && isExpanded ? "full" : "normal"}
            >
              <EstimateCollectionRow
                item={item}
                isExpanded={isExpanded}
                onToggle={() => onToggleEstimate(item.id)}
                viewMode={viewMode}
                formatMeasure={formatMeasure}
                formatMoney={formatMoney}
                itemPriceByPositionId={itemPriceByPositionId}
              />

              {isExpanded && (
                <EstimateExpandedPanel
                  item={item}
                  outcome={outcome}
                  currentTab={currentTab}
                  itemClient={itemClient}
                  statusMenuForEstimateId={statusMenuForEstimateId}
                  setStatusMenuForEstimateId={setStatusMenuForEstimateId}
                  selectedOrderForInstallations={selectedOrderForInstallations}
                  rankedInstallers={rankedInstallers}
                  selectedInstallerByEstimateId={selectedInstallerByEstimateId}
                  supplierEstimateFilesByEstimateId={supplierEstimateFilesByEstimateId}
                  itemPriceByPositionId={itemPriceByPositionId}
                  setItemPriceByPositionId={setItemPriceByPositionId}
                  formatMeasure={formatMeasure}
                  formatMoney={formatMoney}
                  activeUserName={activeUserName}
                  apiFetchJson={apiFetchJson}
                  copyEstimateForClient={copyEstimateForClient}
                  confirmDeleteEstimate={confirmDeleteEstimate}
                  openEstimateFromPicker={openEstimateFromPicker}
                  persistEstimateOutcome={persistEstimateOutcome}
                  downloadEstimateWordDocService={downloadEstimateWordDocService}
                  printEstimatePdfService={printEstimatePdfService}
                  addFollowUpForEstimateService={addFollowUpForEstimateService}
                  positionDescription={positionDescription}
                  PositionPreview={PositionPreview}
                  timelineWithCompletion={timelineWithCompletion}
                  openInstallations={openInstallations}
                  installerLabel={installerLabel}
                  selectInstallerForEstimate={selectInstallerForEstimate}
                  setOrderMetaField={setOrderMetaField}
                  setSendModalEstimateId={setSendModalEstimateId}
                  setSendModalOpen={setSendModalOpen}
                  importSupplierEstimate={importSupplierEstimate}
                />
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="ep-empty-state" data-span={viewMode === "grid" ? "full" : "normal"}>
            <Small>{emptyText}</Small>
          </div>
        )}
      </div>
    </div>
  );
}
