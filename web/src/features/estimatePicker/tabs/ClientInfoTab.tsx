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
    <div className="ep-section-shell">
      <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />

      <div className="ep-client-info-list">
        {pickerClient.estimates.map((e) => (
          <div
            key={e.id}
            className="ep-client-info-estimate"
          >
            <div className="ep-client-info-meta">
              <Pill>{e.estimateRef}</Pill>
              <Small>{e.status}</Small>
              <Small>{e.positions.length} positions</Small>
            </div>

            <div className="ep-tab-list">
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
