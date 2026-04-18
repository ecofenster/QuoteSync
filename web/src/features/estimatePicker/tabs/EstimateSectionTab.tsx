import React from "react";
import type { EstimateOutcome } from "../../../models/types";
import { estimateTotals, estimateCostTotal } from "../../../domain/estimates/estimateCalculations";
import { Button, Pill, Small, H3, qsOutcomeStyle } from "./shared";
import OrderInstallationsBlock from "./OrderInstallationsBlock";
import EstimatePositionsFeature from "../../estimatePositions/EstimatePositionsFeature";
import { useEstimateWorkflow } from "../../estimateWorkflow/useEstimateWorkflow";
import ExpandToggle from "../../../components/common/ExpandToggle";
import ConfiguratorWorkspace from "../../configurator/ConfiguratorWorkspace";

type Props = {
  titleText: string;
  emptyText: string;
  estimates: any[];
  outcome: EstimateOutcome;
  sectionTotals: { totalSquareMetres: number; totalLinearMetres: number; totalQty: number; totalCost: number };
  expandedEstimateId: string | null;
  setExpandedEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
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
  pickerClient: any;
  activeUserName: string;
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  copyEstimateForClient: (client: any, sourceEstimateId: string) => void;
  confirmDeleteEstimate: (estimateId: string) => void;
  openEstimateFromPicker: (estimateId: string) => void;
  persistEstimateOutcome: (clientId: string, estimateId: string, outcome: EstimateOutcome) => void;
  downloadEstimateWordDocService: (args: any) => void;
  printEstimatePdfService: (args: any) => void;
  addFollowUpForEstimateService: (args: any) => void;
  positionDescription: (p: any) => string;
  PositionPreview: React.ComponentType<{ position: any }>;
  timelineWithCompletion: (e: any) => any[];
  openInstallations: (e: any, pickerClient: any) => Promise<void>;
  installerLabel: (installerId: string) => string;
  selectInstallerForEstimate: (estimateId: string, installerId: string) => void;
  setOrderMetaField: (estimateId: string, key: string, value: any) => void;
  setSendModalEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSendModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importSupplierEstimate: (estimateId: string) => void;
};

export default function EstimateSectionTab(props: Props) {
  const {
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

  const {
    currentEstimateId,
    currentStepKey,
    currentConfiguredEstimateId,
    currentConfiguredPositionId,
    markStepComplete,
    setCurrentStepKey,
    clearConfigurationTarget,
  } = useEstimateWorkflow();

  const activeEstimate = React.useMemo(
    () => estimates.find((estimate) => String(estimate?.id) === String(currentEstimateId || "")) ?? null,
    [estimates, currentEstimateId]
  );

  const configuredEstimate = React.useMemo(
    () => estimates.find((estimate) => String(estimate?.id) === String(currentConfiguredEstimateId || "")) ?? null,
    [estimates, currentConfiguredEstimateId]
  );

  const configuredPosition = React.useMemo(
    () =>
      configuredEstimate?.positions?.find(
        (position: any) => String(position?.id) === String(currentConfiguredPositionId || "")
      ) ?? null,
    [configuredEstimate, currentConfiguredPositionId]
  );

  const activeImportedFiles = React.useMemo(
    () => (activeEstimate ? supplierEstimateFilesByEstimateId[activeEstimate.id] ?? [] : []),
    [activeEstimate, supplierEstimateFilesByEstimateId]
  );

  const activeHasOpenings = React.useMemo(
    () => !!activeEstimate && Array.isArray(activeEstimate.positions) && activeEstimate.positions.length > 0,
    [activeEstimate]
  );

  const activeHasExplicitPricing = React.useMemo(() => {
    if (!activeEstimate) return false;
    return (activeEstimate.positions ?? []).some((position: any) => {
      const raw = itemPriceByPositionId[position.id];
      const value = Number(raw);
      return raw != null && raw !== "" && Number.isFinite(value) && value > 0;
    });
  }, [activeEstimate, itemPriceByPositionId]);

  const activeHasConfigurationSignal = React.useMemo(
    () => activeHasOpenings && (activeImportedFiles.length > 0 || activeHasExplicitPricing),
    [activeHasOpenings, activeImportedFiles, activeHasExplicitPricing]
  );

  const activeHasReviewSignal = React.useMemo(() => {
    if (!activeEstimate) return false;
    const timeline = activeEstimate?.orderMeta?.timeline ?? [];
    const completedTimeline = timeline.some((item: any) => !!item?.completed);
    const hasOrderDates =
      !!activeEstimate?.orderMeta?.clientSignoffSentDate ||
      !!activeEstimate?.orderMeta?.clientSignoffReceivedDate ||
      !!activeEstimate?.orderMeta?.depositPaidDate ||
      !!activeEstimate?.orderMeta?.factoryOrderSignedOffDate ||
      !!activeEstimate?.orderMeta?.deliveryDate ||
      !!activeEstimate?.orderMeta?.installationDate;

    return completedTimeline || hasOrderDates;
  }, [activeEstimate]);

  React.useEffect(() => {
    markStepComplete("project_setup", !!activeEstimate);
    markStepComplete("openings", activeHasOpenings);
    markStepComplete("configuration", activeHasConfigurationSignal);
    markStepComplete("pricing", activeHasExplicitPricing);
    markStepComplete("review", activeHasReviewSignal);
    markStepComplete("output", false);
  }, [
    activeEstimate,
    activeHasOpenings,
    activeHasConfigurationSignal,
    activeHasExplicitPricing,
    activeHasReviewSignal,
    markStepComplete,
  ]);

  function canUseConfigurationActionsForEstimate(e: any) {
    return String(e?.id) === String(activeEstimate?.id || "") && activeHasConfigurationSignal;
  }

  function canUsePricingActionsForEstimate(e: any) {
    return String(e?.id) === String(activeEstimate?.id || "") && activeHasExplicitPricing;
  }

  function canUseOutputActionsForEstimate(e: any) {
    return String(e?.id) === String(activeEstimate?.id || "") && activeHasReviewSignal;
  }

  async function updateEstimatePositions(e: any, updatedPositions: any[]) {
    e.positions = updatedPositions;

    await apiFetchJson(`/api/estimates/${e.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: pickerClient.id,
        estimate_ref: e.estimateRef,
        base_estimate_ref: e.baseEstimateRef,
        revision_no: e.revisionNo,
        status: e.status,
        estimated_order_month: e.estimatedOrderMonth,
        estimated_order_year: e.estimatedOrderYear,
        defaults_json: e.defaults,
        positions_json: updatedPositions,
        order_meta_json: e.orderMeta ?? {},
        outcome: e.outcome ?? outcome,
        project_address: e.projectAddress ?? "",
        project_address_json: e.projectAddressStructured ?? {},
        postcode: e.postcode ?? "",
        what3words: e.what3words ?? "",
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        updated_at: new Date().toISOString(),
      }),
    });
  }


  async function saveConfiguredPosition(updatedPosition: any) {
    if (!configuredEstimate || !configuredPosition) return;

    const updatedPositions = (configuredEstimate.positions ?? []).map((position: any) =>
      String(position?.id) === String(configuredPosition.id) ? { ...updatedPosition } : position
    );

    await updateEstimatePositions(configuredEstimate, updatedPositions);
    markStepComplete("configuration", true);
  }

  if (currentStepKey === "configuration" && configuredEstimate && configuredPosition) {
    return (
      <ConfiguratorWorkspace
        estimate={configuredEstimate}
        position={configuredPosition}
        onBack={() => {
          clearConfigurationTarget();
          setCurrentStepKey("openings");
        }}
        onSavePosition={saveConfiguredPosition}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <H3>{titleText}</H3>
        <Small>Combined totals for all estimates in this section.</Small>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10 }}>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total m²</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(sectionTotals.totalSquareMetres)}</div>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Linear metreage</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(sectionTotals.totalLinearMetres)}</div>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{sectionTotals.totalQty}</div>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total cost</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(sectionTotals.totalCost)}</div>
          <Small style={{ marginTop: 4 }}>{estimates.length} estimate(s) in this section</Small>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {estimates.map((e) => {
          const currentOutcome = (((e as any).outcome ?? outcome) as EstimateOutcome);
          const totals = estimateTotals(e);
          const estimateCost = estimateCostTotal(e, itemPriceByPositionId);
          const isExpanded = expandedEstimateId === e.id;
          const canUseConfigurationActions = canUseConfigurationActionsForEstimate(e);
          const canUsePricingActions = canUsePricingActionsForEstimate(e);
          const canUseOutputActions = canUseOutputActionsForEstimate(e);

          return (
            <div
              key={e.id}
              style={{
                borderRadius: 16,
                border: isExpanded ? "2px solid #18181b" : "1px solid #e4e4e7",
                padding: 10,
                background: "#fff",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                onClick={() => setExpandedEstimateId((prev) => (prev === e.id ? null : e.id))}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <ExpandToggle expanded={isExpanded} />
                  <Pill>{e.estimateRef}</Pill>
                  <Small>{e.status}</Small>
                  <Small>{e.positions.length} positions</Small>
                  <Small>{formatMeasure(totals.totalSquareMetres)} m²</Small>
                  <Small>{formatMeasure(totals.totalLinearMetres)} lm</Small>
                  <Small>{formatMoney(estimateCost)}</Small>
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#3f3f46", whiteSpace: "nowrap" }}>
                  {isExpanded ? "Hide review" : "Review positions"}
                </div>
              </div>

              {isExpanded && (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Email</div>
                      <Button variant="outline" disabled={!canUseOutputActions} onClick={() => { setSendModalEstimateId(e.id); setSendModalOpen(true); }}>
                        Send
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Follow up</div>
                      <Button
                        variant="outline"
                        disabled={!canUseOutputActions}
                        onClick={() =>
                          addFollowUpForEstimateService({
                            pickerClient,
                            estimateId: e.id,
                            opts: { days: 3, sendEmail: true, needsCall: true },
                            apiFetchJson,
                            activeUserName,
                            alertFn: alert,
                            logError: console.error,
                          })
                        }
                      >
                        Add Follow Up
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Estimate status</div>
                      <div
                        role="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setStatusMenuForEstimateId((prev) => (prev === e.id ? null : e.id));
                        }}
                        style={{
                          ...(qsOutcomeStyle(currentOutcome)),
                          height: 38,
                          padding: "0 28px 0 14px",
                          borderRadius: 999,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          userSelect: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontWeight: 900 }}>{currentOutcome}</span>
                        <span style={{ fontWeight: 900, lineHeight: 1, transform: "translateY(-1px)" }}>▾</span>
                      </div>

                      {statusMenuForEstimateId === e.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            marginTop: 6,
                            minWidth: 140,
                            background: "#fff",
                            border: "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 10,
                            boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                            overflow: "hidden",
                            zIndex: 20,
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {(["Open", "Order", "Lost"] as EstimateOutcome[]).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                persistEstimateOutcome(pickerClient.id, e.id, opt);
                                setStatusMenuForEstimateId(null);
                              }}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                background: "#fff",
                                color: "#111827",
                                fontWeight: 800,
                                border: "none",
                                padding: "8px 10px",
                                cursor: "pointer",
                                borderBottom: opt === "Lost" ? "none" : "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Copy estimate</div>
                      <Button variant="outline" onClick={() => copyEstimateForClient(pickerClient, e.id)}>
                        Copy
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Delete estimate</div>
                      <Button variant="outline" onClick={() => confirmDeleteEstimate(e.id)}>
                        Delete
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Open estimate</div>
                      <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                        Open
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Print Word Doc</div>
                      <Button
                        variant="outline"
                        disabled={!canUseOutputActions}
                        onClick={() =>
                          downloadEstimateWordDocService({
                            pickerClient,
                            e,
                            itemPriceByPositionId,
                            formatMeasure,
                            formatMoney,
                            positionDescription,
                          })
                        }
                      >
                        Print Word Doc
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Print PDF</div>
                      <Button
                        variant="outline"
                        disabled={!canUseOutputActions}
                        onClick={() =>
                          printEstimatePdfService({
                            pickerClient,
                            e,
                            itemPriceByPositionId,
                            formatMeasure,
                            formatMoney,
                            positionDescription,
                            alertFn: alert,
                          })
                        }
                      >
                        Print PDF
                      </Button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Import Supplier Estimate</div>
                      <Button variant="outline" disabled={!canUsePricingActions} onClick={() => importSupplierEstimate(e.id)}>
                        Import Supplier Estimate
                      </Button>
                    </div>
                  </div>

                  {(supplierEstimateFilesByEstimateId[e.id] ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(supplierEstimateFilesByEstimateId[e.id] ?? []).map((name, idx) => (
                        <Pill key={`${e.id}_${idx}`}>{name}</Pill>
                      ))}
                    </div>
                  )}

                  {outcome === "Order" && e.orderMeta?.timeline && (
                    <OrderInstallationsBlock
                      e={e}
                      pickerClient={pickerClient}
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

                  <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa", display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                      Project Address:{" "}
                      <span style={{ fontWeight: 700 }}>
                        {(e.projectAddress || "")
                          .split(/\r?\n/)
                          .map((s: string) => (s || "").trim())
                          .filter(Boolean)
                          .join(", ") || "Address unavailable"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                      what3words: <span style={{ fontWeight: 700 }}>{e.what3words || "Not set"}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
                    <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total m²</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(totals.totalSquareMetres)}</div>
                    </div>
                    <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Linear metreage</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(totals.totalLinearMetres)}</div>
                    </div>
                    <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{totals.totalQty}</div>
                    </div>
                    <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total cost</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(estimateCost)}</div>
                    </div>
                  </div>

                  <EstimatePositionsFeature
                    e={e}
                    itemPriceByPositionId={itemPriceByPositionId}
                    setItemPriceByPositionId={setItemPriceByPositionId}
                    formatMoney={formatMoney}
                    positionDescription={positionDescription}
                    PositionPreview={PositionPreview}
                    onUpdatePositions={(updatedPositions) => updateEstimatePositions(e, updatedPositions)}
                  />
                </>
              )}
            </div>
          );
        })}

        {estimates.length === 0 && (
          <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
            <Small>{emptyText}</Small>
          </div>
        )}
      </div>
    </div>
  );
}
