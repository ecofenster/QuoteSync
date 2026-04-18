import React from "react";
import type { EstimateOutcome } from "../../../models/types";
import { Button, qsOutcomeStyle } from "../tabs/shared";

type Props = {
  e: any;
  pickerClient: any;
  currentOutcome: EstimateOutcome;
  canUsePricingActions: boolean;
  canUseOutputActions: boolean;
  statusMenuForEstimateId: string | null;
  setStatusMenuForEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSendModalEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSendModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeUserName: string;
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  copyEstimateForClient: (client: any, sourceEstimateId: string) => void;
  confirmDeleteEstimate: (estimateId: string) => void;
  openEstimateFromPicker: (estimateId: string) => void;
  persistEstimateOutcome: (clientId: string, estimateId: string, outcome: EstimateOutcome) => void;
  downloadEstimateWordDocService: (args: any) => void;
  printEstimatePdfService: (args: any) => void;
  addFollowUpForEstimateService: (args: any) => void;
  itemPriceByPositionId: Record<string, string>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
  importSupplierEstimate: (estimateId: string) => void;
};

export default function EstimateActionsBar(props: Props) {
  const {
    e,
    pickerClient,
    currentOutcome,
    canUsePricingActions,
    canUseOutputActions,
    statusMenuForEstimateId,
    setStatusMenuForEstimateId,
    setSendModalEstimateId,
    setSendModalOpen,
    activeUserName,
    apiFetchJson,
    copyEstimateForClient,
    confirmDeleteEstimate,
    openEstimateFromPicker,
    persistEstimateOutcome,
    downloadEstimateWordDocService,
    printEstimatePdfService,
    addFollowUpForEstimateService,
    itemPriceByPositionId,
    formatMeasure,
    formatMoney,
    positionDescription,
    importSupplierEstimate,
  } = props;

  return (
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
        <Button variant="outline" onClick={() => copyEstimateForClient(pickerClient, e.id)}>Copy</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Delete estimate</div>
        <Button variant="outline" onClick={() => confirmDeleteEstimate(e.id)}>Delete</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Open estimate</div>
        <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>Open</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Print Word Doc</div>
        <Button
          variant="outline"
          disabled={!canUseOutputActions}
          onClick={() =>
            downloadEstimateWordDocService({ pickerClient, e, itemPriceByPositionId, formatMeasure, formatMoney, positionDescription })
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
            printEstimatePdfService({ pickerClient, e, itemPriceByPositionId, formatMeasure, formatMoney, positionDescription, alertFn: alert })
          }
        >
          Print PDF
        </Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Import Supplier Estimate</div>
        <Button variant="outline" disabled={!canUsePricingActions} onClick={() => importSupplierEstimate(e.id)}>Import Supplier Estimate</Button>
      </div>
    </div>
  );
}
