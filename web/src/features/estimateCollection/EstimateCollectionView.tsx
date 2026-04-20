import type { ComponentType, Dispatch, SetStateAction } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome } from "../../models/types";
import { H3, Small } from "../estimatePicker/tabs/shared";
import EstimateCollectionRow from "./EstimateCollectionRow";
import EstimateExpandedPanel from "./EstimateExpandedPanel";
import type { EstimateCollectionItem } from "./EstimateCollectionItem";

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
              <Small style={{ marginTop: 4 }}>{items.length} estimate(s) in this section</Small>
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
              style={{
                border: isExpanded ? "2px solid #18181b" : "1px solid #e4e4e7",
                gridColumn: viewMode === "grid" && isExpanded ? "1 / -1" : undefined,
              }}
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
          <div className="ep-empty-state" style={{ gridColumn: viewMode === "grid" ? "1 / -1" : undefined }}>
            <Small>{emptyText}</Small>
          </div>
        )}
      </div>
    </div>
  );
}
