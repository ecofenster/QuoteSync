import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import * as Models from "../../models/types";
import type { Client, Estimate } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

/**
 * EstimatePickerFeature
 * Purpose: isolated "Estimate Picker" screen extracted from App.tsx.
 * Notes:
 * - Layout/styles preserved (inline styles).
 * - Parent can optionally pass clientId to open a specific client without needing the ref to be mounted.
 */

export type EstimatePickerFeatureHandle = {
  open: (clientId: Models.ClientId) => void;
  clear: () => void;
};

type Props = {
  clientId?: Models.ClientId | null;

  clients: Client[];
  onBack: () => void;

  openEditClientPanel: (c: Client) => void;
  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: Models.ClientId, estimateId: Models.EstimateId) => void;
};

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  // Tabs
  const [estimatePickerTab, setEstimatePickerTab] = useState<Models.EstimatePickerTab>("client_info");

  // Selected client inside the picker
  const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>(null);

  // Allow parent to drive which client is open (fixes blank screen when "Open" switches view before ref is mounted)
  useEffect(() => {
    if (typeof clientId === "undefined") return;
    setPickerClientId(clientId ?? null);
    setEstimatePickerTab("client_info");
  }, [clientId]);

  const pickerClient: Client | null = useMemo(() => {
    if (!pickerClientId) return null;
    return clients.find((c) => c.id === pickerClientId) ?? null;
  }, [clients, pickerClientId]);

  // Outcomes (Open/Lost/Order) stored locally for now
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<Models.EstimateId, Models.EstimateOutcome>>({});

  // Notes (simple local WYSIWYG)
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<Models.ClientNote[]>([]);

  // Files (links + optional picked file names)
  const [clientFileLabel, setClientFileLabel] = useState("");
  const [clientFileUrl, setClientFileUrl] = useState("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const [clientFiles, setClientFiles] = useState<Models.ClientFile[]>([]);

  const activeUserName = "User"; // TODO: wire to auth/profile later

  useImperativeHandle(ref, () => ({
    open: (id: Models.ClientId) => {
      setPickerClientId(id);
      setEstimatePickerTab("client_info");
    },
    clear: () => {
      setPickerClientId(null);
      setEstimatePickerTab("client_info");
    },
  }));

  function openEstimateFromPicker(estimateId: Models.EstimateId) {
    if (!pickerClient) return;
    openEstimateDefaults(pickerClient.id, estimateId);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#18181b" }}>Estimate Picker</div>
          <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
            Select a client, then pick an estimate (or create one).
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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

      {!pickerClient ? (
        <div style={{ borderRadius: 16, border: "1px dashed #e4e4e7", padding: 14, background: "#fff" }}>
          <div style={{ fontSize: 13, color: "#71717a" }}>No client selected. Go back and click “Open” on a client.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => createEstimateForClient(pickerClient)}
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

            <button
              type="button"
              onClick={() => openEditClientPanel(pickerClient)}
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
              Edit Client
            </button>
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
      )}
    </div>
  );
});

export default EstimatePickerFeature;

