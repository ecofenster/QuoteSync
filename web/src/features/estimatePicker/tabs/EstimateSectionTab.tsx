import React from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome } from "../../../models/types";
import EstimateCollectionView from "../../estimateCollection/EstimateCollectionView";

type Props = {
  currentTab: string;
  titleText: string;
  emptyText: string;
  estimates: Client["estimates"];
  outcome: EstimateOutcome;
  sectionTotals: { totalSquareMetres: number; totalLinearMetres: number; totalQty: number; totalCost: number };
  expandedEstimateId: EstimateId | null;
  setExpandedEstimateId: React.Dispatch<React.SetStateAction<EstimateId | null>>;
  statusMenuForEstimateId: string | null;
  setStatusMenuForEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedOrderForInstallations: string | null;
  rankedInstallers: any[];
  selectedInstallerByEstimateId: Record<string, string>;
  supplierEstimateFilesByEstimateId: Record<string, string[]>;
  itemPriceByPositionId: Record<string, string>;
  setItemPriceByPositionId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  pickerClient: Client;
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
  PositionPreview: React.ComponentType<{ position: any }>;
  timelineWithCompletion: (e: any) => any[];
  openInstallations: (e: any, pickerClient: any) => Promise<void>;
  installerLabel: (installerId: string) => string;
  selectInstallerForEstimate: (estimateId: EstimateId, installerId: string) => void;
  setOrderMetaField: (estimateId: EstimateId, key: string, value: any) => void;
  setSendModalEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSendModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importSupplierEstimate: (estimateId: EstimateId) => void;
};

export default function EstimateSectionTab(props: Props) {
  const {
    currentTab,
    titleText,
    emptyText,
    estimates,
    outcome,
    sectionTotals,
    expandedEstimateId,
    setExpandedEstimateId,
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
    pickerClient,
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
    <EstimateCollectionView
      currentTab={currentTab}
      titleText={titleText}
      emptyText={emptyText}
      items={estimates}
      outcome={outcome}
      sectionTotals={sectionTotals}
      expandedEstimateId={expandedEstimateId}
      onToggleEstimate={(estimateId) =>
        setExpandedEstimateId((prev) => (prev === estimateId ? null : estimateId))
      }
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
      pickerClient={pickerClient}
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
  );
}
