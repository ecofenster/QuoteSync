import React from "react";
import type { Client, EstimateId } from "../../../models/types";
import { Button, Pill, Small, ClientDetailsReadonly } from "./shared";

export default function ClientInfoTab({
  pickerClient,
  openEditClientPanel,
  confirmDeleteEstimate,
  openEstimateFromPicker,
}: {
  pickerClient: Client;
  openEditClientPanel: (c: Client) => void;
  confirmDeleteEstimate: (estimateId: EstimateId) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />

      <div style={{ marginTop: 2, display: "grid", gap: 10 }}>
        {pickerClient.estimates.map((e) => (
          <div
            key={e.id}
            style={{
              borderRadius: 14,
              border: "1px solid #e4e4e7",
              padding: 10,
              background: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pill>{e.estimateRef}</Pill>
              <Small>{e.status}</Small>
              <Small>{e.positions.length} positions</Small>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => confirmDeleteEstimate(e.id)}>
                Delete
              </Button>
              <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                Open
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
