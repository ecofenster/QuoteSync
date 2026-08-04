import React from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome } from "../../models/types";
import { estimateCostTotal, estimateTotals } from "../../domain/estimates/estimateCalculations";
import EstimatePositionsFeature from "../estimatePositions/EstimatePositionsFeature";
import {
  DisabledEstimateWorkflowProvider,
  useDisabledEstimateWorkflow,
} from "../estimateWorkflow/disabledWorkflowQuarantine";
import OrderInstallationsBlock from "../estimatePicker/tabs/OrderInstallationsBlock";
import { Button, Pill, Small } from "../estimatePicker/tabs/shared";
import EstimateCollectionActions from "./EstimateCollectionActions";
import type { EstimateCollectionItem } from "./EstimateCollectionItem";

const DISABLED_ESTIMATE_CONFIGURATOR_MESSAGE =
  "Estimate configurator flow is temporarily disabled while the Admin-led configurator is rebuilt.";

type Props = {
  item: EstimateCollectionItem;
  outcome: EstimateOutcome;
  currentTab: string;
  itemClient: Client;
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

function EstimateExpandedPanelContent(props: Props) {
  const {
    item,
    outcome,
    itemClient,
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

  const {
    currentEstimateId,
    currentConfiguredEstimateId,
    currentConfiguredPositionId,
    clearConfigurationTarget,
  } = useDisabledEstimateWorkflow();

  const activeEstimate = React.useMemo(
    () => (String(currentEstimateId || "") === String(item.id) ? item : null),
    [item, currentEstimateId]
  );

  const configuredEstimate = React.useMemo(
    () => (String(currentConfiguredEstimateId || "") === String(item.id) ? item : null),
    [item, currentConfiguredEstimateId]
  );

  const configuredPosition = React.useMemo(
    () =>
      configuredEstimate?.positions?.find(
        (position: any) => String(position?.id) === String(currentConfiguredPositionId || "")
      ) ?? null,
    [configuredEstimate, currentConfiguredPositionId]
  );

  const activeImportedFiles = React.useMemo(
    () => supplierEstimateFilesByEstimateId[item.id] ?? [],
    [item.id, supplierEstimateFilesByEstimateId]
  );

  function canUsePricingActions() {
    if (String(item?.id) !== String(activeEstimate?.id || "")) return false;
    return (activeEstimate?.positions ?? []).some((position: any) => {
      const raw = itemPriceByPositionId[position.id];
      const value = Number(raw);
      return raw != null && raw !== "" && Number.isFinite(value) && value > 0;
    });
  }

  function canUseOutputActions() {
    if (String(item?.id) !== String(activeEstimate?.id || "")) return false;
    const timeline = activeEstimate?.orderMeta?.timeline ?? [];
    const completedTimeline = timeline.some((timelineItem: any) => !!timelineItem?.completed);
    const hasOrderDates =
      !!activeEstimate?.orderMeta?.clientSignoffSentDate ||
      !!activeEstimate?.orderMeta?.clientSignoffReceivedDate ||
      !!activeEstimate?.orderMeta?.depositPaidDate ||
      !!activeEstimate?.orderMeta?.factoryOrderSignedOffDate ||
      !!activeEstimate?.orderMeta?.deliveryDate ||
      !!activeEstimate?.orderMeta?.installationDate;
    return completedTimeline || hasOrderDates;
  }

  async function updateEstimatePositions(updatedPositions: any[]) {
    await apiFetchJson(`/api/estimates/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: itemClient.id,
        estimate_ref: item.estimateRef,
        base_estimate_ref: item.baseEstimateRef,
        revision_no: item.revisionNo,
        status: item.status,
        estimated_order_month: item.estimatedOrderMonth,
        estimated_order_year: item.estimatedOrderYear,
        defaults_json: item.defaults,
        positions_json: updatedPositions,
        order_meta_json: item.orderMeta ?? {},
        outcome: item.outcome ?? outcome,
        project_address: item.projectAddress ?? "",
        project_address_json: item.projectAddressStructured ?? {},
        postcode: item.postcode ?? "",
        what3words: item.what3words ?? "",
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        createdByUserId: item.createdByUserId,
        createdByName: item.createdByName,
        createdByRole: item.createdByRole,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  if (configuredEstimate && configuredPosition) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#18181b" }}>Estimate Configurator Disabled</div>
        <Small>{DISABLED_ESTIMATE_CONFIGURATOR_MESSAGE}</Small>
        <div>
          <Button variant="secondary" onClick={() => clearConfigurationTarget()}>
            Back to Estimate
          </Button>
        </div>
      </div>
    );
  }

  const totals = estimateTotals(item);
  const estimateCost = estimateCostTotal(item, itemPriceByPositionId);
  const currentOutcome = ((item as any).outcome ?? outcome) as EstimateOutcome;

  return (
    <>
      <EstimateCollectionActions
        item={item}
        itemClient={itemClient}
        currentOutcome={currentOutcome}
        statusMenuForEstimateId={statusMenuForEstimateId}
        setStatusMenuForEstimateId={setStatusMenuForEstimateId}
        canUsePricingActions={canUsePricingActions()}
        canUseOutputActions={canUseOutputActions()}
        activeUserName={activeUserName}
        apiFetchJson={apiFetchJson}
        copyEstimateForClient={copyEstimateForClient}
        confirmDeleteEstimate={confirmDeleteEstimate}
        openEstimateFromPicker={openEstimateFromPicker}
        persistEstimateOutcome={persistEstimateOutcome}
        downloadEstimateWordDocService={downloadEstimateWordDocService}
        printEstimatePdfService={printEstimatePdfService}
        addFollowUpForEstimateService={addFollowUpForEstimateService}
        itemPriceByPositionId={itemPriceByPositionId}
        formatMeasure={formatMeasure}
        formatMoney={formatMoney}
        positionDescription={positionDescription}
        setSendModalEstimateId={setSendModalEstimateId}
        setSendModalOpen={setSendModalOpen}
        importSupplierEstimate={importSupplierEstimate}
      />

      {activeImportedFiles.length > 0 && (
        <div className="ep-estimate-files">
          {activeImportedFiles.map((name, idx) => (
            <Pill key={`${item.id}_${idx}`}>{name}</Pill>
          ))}
        </div>
      )}

      {outcome === "Order" && item.orderMeta?.timeline && (
        <OrderInstallationsBlock
          e={item}
          pickerClient={itemClient}
          selectedOrderForInstallations={selectedOrderForInstallations}
          rankedInstallers={rankedInstallers}
          selectedInstallerByEstimateId={selectedInstallerByEstimateId}
          timelineWithCompletion={timelineWithCompletion}
          openInstallations={openInstallations}
          installerLabel={installerLabel}
          selectInstallerForEstimate={selectInstallerForEstimate}
          setOrderMetaField={setOrderMetaField}
        />
      )}

      <div className="ep-estimate-address-card">
        <div className="ep-estimate-address-line">
          Project Address:{" "}
          <span className="ep-estimate-address-value">
            {(item.projectAddress || "")
              .split(/\r?\n/)
              .map((segment: string) => (segment || "").trim())
              .filter(Boolean)
              .join(", ") || "Address unavailable"}
          </span>
        </div>
        <div className="ep-estimate-address-line">
          what3words: <span className="ep-estimate-address-value">{item.what3words || "Not set"}</span>
        </div>
      </div>

      <div className="ep-estimate-stats-grid">
        <div className="ep-stat-card" data-testid="expanded-total-square-metres">
          <div className="ep-stat-label">Total m²</div>
          <div className="ep-stat-value">{formatMeasure(totals.totalSquareMetres)}</div>
        </div>
        <div className="ep-stat-card" data-testid="expanded-total-quantity">
          <div className="ep-stat-label">Linear metreage</div>
          <div className="ep-stat-value">{formatMeasure(totals.totalLinearMetres)}</div>
        </div>
        <div className="ep-stat-card">
          <div className="ep-stat-label">Total quantity</div>
          <div className="ep-stat-value">{totals.totalQty}</div>
        </div>
        <div className="ep-stat-card">
          <div className="ep-stat-label">Total cost</div>
          <div className="ep-stat-value">{formatMoney(estimateCost)}</div>
        </div>
      </div>

      <EstimatePositionsFeature
        e={item}
        clientId={itemClient.id}
        itemPriceByPositionId={itemPriceByPositionId}
        setItemPriceByPositionId={setItemPriceByPositionId}
        formatMoney={formatMoney}
        positionDescription={positionDescription}
        PositionPreview={PositionPreview}
        onUpdatePositions={updateEstimatePositions}
      />
    </>
  );
}

export default function EstimateExpandedPanel(props: Props) {
  const { item, currentTab, itemClient } = props;

  return (
    <DisabledEstimateWorkflowProvider
      currentTab={currentTab}
      currentClientId={itemClient.id}
      currentEstimateId={item.id}
      currentClient={itemClient}
      currentEstimate={item}
      workflowScope="position"
      workflowMode="edit"
    >
      <EstimateExpandedPanelContent {...props} />
    </DisabledEstimateWorkflowProvider>
  );
}
