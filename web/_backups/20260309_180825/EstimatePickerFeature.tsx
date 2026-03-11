import React, { useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";
import { loadClientNotes, saveClientNotes, subscribeClientNotes } from "../../services/clientNotesStore";

export type EstimatePickerFeatureHandle = {
  open: (clientId: ClientId) => void;
  clear: () => void;
};

type Props = {
  clients: Client[];

  // App can pass a client to open after mount (prevents ref timing issues)
  initialClientId?: ClientId | null;
  onConsumedInitialClientId?: () => void;

  // Optional external clientId control (kept for compatibility)
  clientId?: ClientId | null;

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;
  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: ClientId, estimateId: EstimateId) => void;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Remove any bidi control chars (prevents “typing backwards” bugs when these leak into HTML)
function stripBidiControls(s: string) {
  return (s ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const NOTES_DRAFT_KEY_PREFIX = "qs_client_notes_draft_v1_";

function draftKey(clientId: ClientId) {
  return `${NOTES_DRAFT_KEY_PREFIX}${clientId}`;
}

const OUTCOMES_KEY_PREFIX = "qs_estimate_outcomes_v1_";
function outcomesKey(clientId: ClientId) {
  return `${OUTCOMES_KEY_PREFIX}${clientId}`;
}

function loadOutcomes(clientId: ClientId): Record<EstimateId, EstimateOutcome> {
  try {
    const raw = localStorage.getItem(outcomesKey(clientId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? (parsed as any) : {};
  } catch {
    return {};
  }
}
function saveOutcomes(clientId: ClientId, v: Record<EstimateId, EstimateOutcome>) {
  try {
    localStorage.setItem(outcomesKey(clientId), JSON.stringify(v ?? {}));
  } catch {
    // ignore
  }
}

export default React.forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  const [pickerClientId, setPickerClientId] = useState<ClientId | null>(null);

  // Tabs
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");

  // Client notes (client specific)
  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");

  // Files (Phase 1 lightweight)
  const [clientFileLabel, setClientFileLabel] = useState("");
  const [clientFileUrl, setClientFileUrl] = useState("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);

  // Outcomes
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});

  const activeUserName = "User";

  // imperative api
  useImperativeHandle(
    ref,
    () => ({
      open: (clientId: ClientId) => {
        setPickerClientId(clientId);
        setEstimatePickerTab("client_info");
      },
      clear: () => {
        setPickerClientId(null);
      },
    }),
    []
  );

  // Open client after mount (if App passes initialClientId)
  useEffect(() => {
    const initial = props.initialClientId ?? props.clientId ?? null;
    if (!initial) return;
    setPickerClientId(initial);
    setEstimatePickerTab("client_info");
    props.onConsumedInitialClientId?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep pickerClientId in sync with clientId prop if supplied
  useEffect(() => {
    if (props.clientId === undefined) return;
    setPickerClientId(props.clientId ?? null);
  }, [props.clientId]);

  // Load per-client stores when client changes
  useEffect(() => {
    if (!pickerClientId) {
      setClientNotes([]);
      setClientNoteDraftHtml("");
      setEstimateOutcomeById({});
      return;
    }

    // outcomes
    setEstimateOutcomeById(loadOutcomes(pickerClientId));

    // notes
    setClientNotes(loadClientNotes(pickerClientId));
    try {
      setClientNoteDraftHtml(localStorage.getItem(draftKey(pickerClientId)) ?? "");
    } catch {
      setClientNoteDraftHtml("");
    }

    // subscribe to notes updates (from FollowUps)
    const unsub = subscribeClientNotes(pickerClientId, (notes) => setClientNotes(notes));
    return () => unsub();
  }, [pickerClientId]);

  // Persist outcomes when changed
  useEffect(() => {
    if (!pickerClientId) return;
    saveOutcomes(pickerClientId, estimateOutcomeById);
  }, [pickerClientId, estimateOutcomeById]);

  // Persist notes when user adds/removes notes in EstimatePicker tab
  useEffect(() => {
    if (!pickerClientId) return;
    saveClientNotes(pickerClientId, clientNotes);
  }, [pickerClientId, clientNotes]);

  // Persist draft html (so switching tabs doesn't lose draft)
  useEffect(() => {
    if (!pickerClientId) return;
    try {
      localStorage.setItem(draftKey(pickerClientId), clientNoteDraftHtml ?? "");
    } catch {
      // ignore
    }
  }, [pickerClientId, clientNoteDraftHtml]);

  // When switching to client_notes, refresh from store (so follow-ups added notes appear on first view)
  useEffect(() => {
    if (!pickerClientId) return;
    if (estimatePickerTab !== "client_notes") return;
    setClientNotes(loadClientNotes(pickerClientId));
  }, [estimatePickerTab, pickerClientId]);

  const openEstimateFromPicker = (estimateId: EstimateId) => {
    if (!pickerClient) return;
    openEstimateDefaults(pickerClient.id, estimateId);
  };

  if (!pickerClient) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Estimate Picker</div>
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

        <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 12 }}>
          <div style={{ fontSize: 13, color: "#6b7280" }}>No client selected.</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {clients.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPickerClientId(c.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 14,
                  border: "1px solid #e4e4e7",
                  background: "#fff",
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                {(c as any).clientRef ? `${(c as any).clientRef} • ` : ""}{c.clientName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <EstimatePickerTabs
      estimatePickerTab={estimatePickerTab}
      setEstimatePickerTab={setEstimatePickerTab}
      pickerClient={pickerClient}
      openEditClientPanel={openEditClientPanel}
      openEstimateFromPicker={openEstimateFromPicker}
      estimateOutcomeById={estimateOutcomeById}
      setEstimateOutcomeById={setEstimateOutcomeById as any}
      clientNoteDraftHtml={clientNoteDraftHtml}
      setClientNoteDraftHtml={(html) => setClientNoteDraftHtml(stripBidiControls(html))}
      clientNotes={clientNotes.map((n) => ({ ...n, html: stripBidiControls(n.html) }))}
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
  );
});

