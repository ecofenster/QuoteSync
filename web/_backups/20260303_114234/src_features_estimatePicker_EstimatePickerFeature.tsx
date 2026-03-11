import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

export type EstimatePickerFeatureHandle = {
  open: (clientId: ClientId) => void;
  clear: () => void;
};

type Props = {
  clients: Client[];

  // When App switches to this view, it passes the client id here so we can open reliably after mount.
  initialClientId?: ClientId | null;
  onConsumedInitialClientId?: () => void;

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;

  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: ClientId, estimateId: EstimateId) => void;
};

/* =========================
   UI primitives (duplicated to avoid UI drift)
========================= */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e4e4e7",
        background: "#fff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h2>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      style={{
        borderRadius: 18,
        border: isPrimary ? "none" : "1px solid #e4e4e7",
        background: isPrimary ? "#18181b" : "#fff",
        color: isPrimary ? "#fff" : "#3f3f46",
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* =========================
   Feature container
========================= */

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, clientId, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  // estimate picker (moved from App.tsx)
  const [pickerClientId, setPickerClientId] = useState<ClientId | null>(null);

  // Sync selected client from parent (fixes blank screen when switching views)
  useEffect(() => {
    if (typeof clientId === "undefined") return;
    setPickerClientId(clientId ?? null);
  }, [clientId]);
  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // Sync from App-controlled clientId to avoid ref timing race (Open -> view switch).
  useEffect(() => {
    if (clientId) setPickerClientId(clientId);
  }, [clientId]);

  // estimate picker tabs (Estimate Picker only)
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [clientFileLabel, setClientFileLabel] = useState<string>("");
  const [clientFileUrl, setClientFileUrl] = useState<string>("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const activeUserName = "User";

  useImperativeHandle(
    ref,
    () => ({
      open: (clientId) => setPickerClientId(clientId),
      clear: () => setPickerClientId(null),
    }),
    []
  );

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClientId) return;
    openEstimateDefaults(pickerClientId, estimateId);
  }

    if (!pickerClient) {
    return (
      <Card style={{ minHeight: 520 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <H2>Estimate Picker</H2>
            <Small>Select a client to view estimates/orders/notes/files.</Small>
          </div>

          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {clients.length === 0 && <Small>No clients yet.</Small>}

          {clients.map((c) => (
            <div
              key={c.id}
              style={{
                borderRadius: 16,
                border: "1px solid #e4e4e7",
                padding: 12,
                background: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>
                  {c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}
                </div>
                <Small>
                  {c.clientRef} • {c.estimates.length} estimates
                </Small>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={() => openEditClientPanel(c)}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => createEstimateForClient(c)}>
                  New Estimate
                </Button>
                <Button variant="primary" onClick={() => setPickerClientId(c.id)}>
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }return (
    <Card style={{ minHeight: 520 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <H2>Choose an estimate</H2>
            <Small>
              {pickerClient.clientName} • {pickerClient.clientRef}
            </Small>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                onBack();
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                createEstimateForClient(pickerClient);
              }}
            >
              New Estimate
            </Button>
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
    </Card>
  );
});

export default EstimatePickerFeature;

