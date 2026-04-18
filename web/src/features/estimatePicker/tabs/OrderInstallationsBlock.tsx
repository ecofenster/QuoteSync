import React from "react";
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
  selectInstallerForEstimate: (estimateId: string, installerId: string) => void;
  setOrderMetaField: (estimateId: string, key: string, value: any) => void;
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={() => openInstallations(e, pickerClient)}>Installations</Button>
        <Button variant="secondary">Materials</Button>
        <Button variant="secondary">Hire Equipment</Button>
      </div>

      {selectedOrderForInstallations === e.id && (
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Installations</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>Installers ranked by route where provider/API is available.</div>
            </div>
            <Small>{rankedInstallers.length} installer result(s)</Small>
          </div>

          {(e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id]) ? (
            <div style={{ borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#166534", marginBottom: 4 }}>
                Selected installer
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#14532d" }}>
                {installerLabel(e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id])}
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: "1px dashed #d4d4d8", background: "#fff", padding: 12 }}>
              <Small>No installer selected yet.</Small>
            </div>
          )}

          {rankedInstallers.length === 0 ? (
            <div style={{ borderRadius: 12, border: "1px dashed #d4d4d8", padding: 12, background: "#fff" }}>
              <Small>No installer results yet.</Small>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {rankedInstallers.map((r, i) => {
                const isSelected = (e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id]) === r.installerId;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectInstallerForEstimate(e.id, r.installerId)}
                    style={{
                      borderRadius: 12,
                      border: isSelected ? "2px solid #22c55e" : "1px solid #e4e4e7",
                      padding: 12,
                      background: isSelected ? "#f0fdf4" : "#fff",
                      display: "grid",
                      gap: 4,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#18181b" }}>{installerLabel(r.installerId)}</div>
                      <Small>{isSelected ? "Selected" : r.provider}</Small>
                    </div>
                    <div style={{ fontSize: 12, color: "#52525b" }}>
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

      <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff", display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Order scheduling</div>
          <div style={{ fontSize: 12, color: "#71717a" }}>Set milestone dates and production weeks. Production end and balance due auto-calculate from production start + weeks.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <div style={labelStyle}>Client sign-off sent</div>
            <Input type="date" value={e.orderMeta?.clientSignoffSentDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "clientSignoffSentDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Client sign-off received</div>
            <Input type="date" value={e.orderMeta?.clientSignoffReceivedDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "clientSignoffReceivedDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Deposit paid</div>
            <Input type="date" value={e.orderMeta?.depositPaidDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "depositPaidDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Factory order signed off</div>
            <Input type="date" value={e.orderMeta?.factoryOrderSignedOffDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryOrderSignedOffDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Factory invoice paid</div>
            <Input type="date" value={e.orderMeta?.factoryInvoicePaidDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryInvoicePaidDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Production weeks</div>
            <Input type="number" value={String(e.orderMeta?.productionWeeks ?? "")} onChange={(ev) => setOrderMetaField(e.id, "productionWeeks", ev.target.value === "" ? undefined : Number(ev.target.value))} />
          </div>
          <div>
            <div style={labelStyle}>Production start</div>
            <Input type="date" value={e.orderMeta?.productionStartDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "productionStartDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Production end</div>
            <Input type="date" value={e.orderMeta?.productionEndDate ?? ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div style={labelStyle}>Balance invoice due</div>
            <Input type="date" value={e.orderMeta?.balanceInvoiceDueDate ?? ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div style={labelStyle}>Production completed</div>
            <Input type="date" value={e.orderMeta?.productionCompletedDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "productionCompletedDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Factory dispatch</div>
            <Input type="date" value={e.orderMeta?.factoryDispatchDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryDispatchDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Delivery date</div>
            <Input type="date" value={e.orderMeta?.deliveryDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "deliveryDate", ev.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Installation date</div>
            <Input type="date" value={e.orderMeta?.installationDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "installationDate", ev.target.value)} />
          </div>
        </div>
      </div>
    </>
  );
}
