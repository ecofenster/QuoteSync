// QuoteSync - Estimate Picker Feature (fixed/clean build)
// Purpose: isolated "Choose estimate" flow used from Customers -> Open button.
// - Supports optional prop `clientId` (preferred), and also an imperative ref `.open(id)` for backward compatibility.
// - No layout/styling changes intended; uses existing EstimatePickerTabs component.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import * as Models from "../../models/types";
import type { Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

export type EstimatePickerFeatureHandle = {
  open: (clientId: Models.ClientId) => void;
  clear: () => void;
  getClientId: () => Models.ClientId | null;
};

type Props = {
  // Preferred control: pass clientId from parent
  clientId?: Models.ClientId | null;

  clients: Client[];

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;
  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: string, estimateId: string) => void;
};

const DEFAULT_TAB: EstimatePickerTab = "client_info";

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>(null);

  // Sync selected client from parent (fixes blank screen when switching views)
  useEffect(() => {
    if (typeof clientId === "undefined") return; // allow imperative mode if parent doesn't pass it
    setPickerClientId(clientId ?? null);
  }, [clientId]);

  useImperativeHandle(
    ref,
    () => ({
      open: (id) => setPickerClientId(id),
      clear: () => setPickerClientId(null),
      getClientId: () => pickerClientId,
    }),
    [pickerClientId]
  );

  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // Local tab state + related stores
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>(DEFAULT_TAB);
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});

  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [activeUserName] = useState<string>("User");

  const [clientFileLabel, setClientFileLabel] = useState("");
  const [clientFileUrl, setClientFileUrl] = useState("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);

  // Reset tab + local UI when switching client
  useEffect(() => {
    setEstimatePickerTab(DEFAULT_TAB);
    setClientNoteDraftHtml("");
    setClientNotes([]);
    setClientFiles([]);
    setClientFileLabel("");
    setClientFileUrl("");
    setClientFileNames([]);
    setEstimateOutcomeById({});
  }, [pickerClientId]);

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClient) return;
    openEstimateDefaults(pickerClient.id, estimateId);
  }

  if (!pickerClient) {
    return (
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 13, color: "#71717a" }}>Select a client to view estimates.</div>
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              borderRadius: 18,
              border: "1px solid #e4e4e7",
              background: "#fff",
              color: "#3f3f46",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "#18181b" }}>Choose an estimate</div>
          <div style={{ fontSize: 12, color: "#71717a", marginTop: 6 }}>
            {pickerClient.clientName} • {pickerClient.clientRef}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setEstimatePickerTab(DEFAULT_TAB);
              onBack();
            }}
            style={{
              borderRadius: 18,
              border: "1px solid #e4e4e7",
              background: "#fff",
              color: "#3f3f46",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={() => {
              setEstimatePickerTab(DEFAULT_TAB);
              createEstimateForClient(pickerClient);
            }}
            style={{
              borderRadius: 18,
              border: "none",
              background: "#18181b",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            New Estimate
          </button>
        </div>
      </div>

      <EstimatePickerTabs
        estimatePickerTab={estimatePickerTab}
        setEstimatePickerTab={setEstimatePickerTab}
        pickerClient={pickerClient}
        openEditClientPanel={openEditClientPanel}
        openEstimateFromPicker={openEstimateFromPicker}
        estimateOutcomeById={estimateOutcomeById}
        setEstimateOutcomeById={setEstimateOutcomeById}
        clientNoteDraftHtml={clientNoteDraftHtml}
        setClientNoteDraftHtml={setClientNoteDraftHtml}
        clientNotes={clientNotes}
        setClientNotes={setClientNotes}
        activeUserName={activeUserName}
        clientFileLabel={clientFileLabel}
        setClientFileLabel={setClientFileLabel}
        clientFileUrl={clientFileUrl}
        setClientFileUrl={setClientFileUrl}
        clientFileNames={clientFileNames}
        setClientFileNames={setClientFileNames}
        clientFiles={clientFiles}
        setClientFiles={setClientFiles}
      />
    </div>
  );
});

export default EstimatePickerFeature;

