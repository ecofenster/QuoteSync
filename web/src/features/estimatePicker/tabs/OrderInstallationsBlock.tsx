import React from "react";
import type { EstimateId } from "../../../models/types";
import { Button, Input, Small, OrderTimelineBar } from "./shared";

type Props = {
  e: any;
  pickerClient: any;
  selectedOrderForInstallations: string | null;
  rankedInstallers: any[];
  selectedInstallerByEstimateId: Record<string, string>;
  timelineWithCompletion: (e: any) => any[];
  openInstallations: (e: any, pickerClient: any) => Promise<void>;
  installerLabel: (installerId: string) => string;
  selectInstallerForEstimate: (estimateId: EstimateId, installerId: string) => void;
  setOrderMetaField: (estimateId: EstimateId, key: string, value: any) => void;
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
  marginBottom: 6,
};

export default function OrderInstallationsBlock(props: Props) {
  const {
    e,
    pickerClient,
    selectedOrderForInstallations,
    rankedInstallers,
    selectedInstallerByEstimateId,
    timelineWithCompletion,
    openInstallations,
    installerLabel,
    selectInstallerForEstimate,
    setOrderMetaField,
  } = props;

  return (
    <>
      <OrderTimelineBar timeline={timelineWithCompletion(e)} />

      <div className="ep-actions">
        <Button variant="secondary" onClick={() => openInstallations(e, pickerClient)}>Installations</Button>
        <Button variant="secondary">Materials</Button>
        <Button variant="secondary">Hire Equipment</Button>
      </div>

      {selectedOrderForInstallations === e.id && (
        <div className="ep-order-card ep-order-card--muted">
          <div className="ep-pane-header" style={{ gap: 12 }}>
            <div>
              <div className="ep-order-title">Installations</div>
              <div className="ep-order-subtitle">Installers ranked by route where provider/API is available.</div>
            </div>
            <Small>{rankedInstallers.length} installer result(s)</Small>
          </div>

          {(e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id]) ? (
            <div className="ep-order-selected-card" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4" }}>
              <div className="ep-order-selected-label" style={{ color: "#166534" }}>
                Selected installer
              </div>
              <div className="ep-order-selected-value" style={{ color: "#14532d" }}>
                {installerLabel(e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id])}
              </div>
            </div>
          ) : (
            <div className="ep-empty-state" style={{ background: "#fff", borderColor: "#d4d4d8" }}>
              <Small>No installer selected yet.</Small>
            </div>
          )}

          {rankedInstallers.length === 0 ? (
            <div className="ep-empty-state" style={{ padding: 12, background: "#fff", borderColor: "#d4d4d8" }}>
              <Small>No installer results yet.</Small>
            </div>
          ) : (
            <div className="ep-order-results">
              {rankedInstallers.map((r, i) => {
                const isSelected = (e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id]) === r.installerId;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectInstallerForEstimate(e.id, r.installerId)}
                    className="ep-order-result-button"
                    style={{
                      border: isSelected ? "2px solid #22c55e" : "1px solid #e4e4e7",
                      background: isSelected ? "#f0fdf4" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div className="ep-order-result-header">
                      <div className="ep-order-result-title">{installerLabel(r.installerId)}</div>
                      <Small>{isSelected ? "Selected" : r.provider}</Small>
                    </div>
                    <div className="ep-order-result-meta">
                      {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "Distance unavailable"} • {r.durationMinutes != null ? `${r.durationMinutes} mins` : "Time unavailable"}
                    </div>
                    {r.reason ? <Small>{r.reason}</Small> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="ep-order-card">
        <div>
          <div className="ep-order-title">Order scheduling</div>
          <div className="ep-order-subtitle">Set milestone dates and production weeks. Production end and balance due auto-calculate from production start + weeks.</div>
        </div>

        <div className="ep-order-schedule-grid">
          <div className="ep-order-field">
            <div style={labelStyle}>Client sign-off sent</div>
            <Input type="date" value={e.orderMeta?.clientSignoffSentDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "clientSignoffSentDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Client sign-off received</div>
            <Input type="date" value={e.orderMeta?.clientSignoffReceivedDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "clientSignoffReceivedDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Deposit paid</div>
            <Input type="date" value={e.orderMeta?.depositPaidDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "depositPaidDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Factory order signed off</div>
            <Input type="date" value={e.orderMeta?.factoryOrderSignedOffDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryOrderSignedOffDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Factory invoice paid</div>
            <Input type="date" value={e.orderMeta?.factoryInvoicePaidDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryInvoicePaidDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Production weeks</div>
            <Input type="number" value={String(e.orderMeta?.productionWeeks ?? "")} onChange={(ev) => setOrderMetaField(e.id, "productionWeeks", ev.target.value === "" ? undefined : Number(ev.target.value))} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Production start</div>
            <Input type="date" value={e.orderMeta?.productionStartDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "productionStartDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Production end</div>
            <Input type="date" value={e.orderMeta?.productionEndDate ?? ""} onChange={() => {}} disabled />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Balance invoice due</div>
            <Input type="date" value={e.orderMeta?.balanceInvoiceDueDate ?? ""} onChange={() => {}} disabled />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Production completed</div>
            <Input type="date" value={e.orderMeta?.productionCompletedDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "productionCompletedDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Factory dispatch</div>
            <Input type="date" value={e.orderMeta?.factoryDispatchDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryDispatchDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Delivery date</div>
            <Input type="date" value={e.orderMeta?.deliveryDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "deliveryDate", ev.target.value)} />
          </div>
          <div className="ep-order-field">
            <div style={labelStyle}>Installation date</div>
            <Input type="date" value={e.orderMeta?.installationDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "installationDate", ev.target.value)} />
          </div>
        </div>
      </div>
    </>
  );
}
