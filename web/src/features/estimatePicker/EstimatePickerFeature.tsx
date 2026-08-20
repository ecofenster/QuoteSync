import React, { useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome, EstimatePickerTab, ClientFile } from "../../models/types";
import { apiFetch } from "../../services/api/apiClient";
import { CURRENT_APP_USER } from "../../system/currentUser";
import EstimatePickerTabs from "./EstimatePickerTabs";
import "./EstimatePickerFeature.css";

type ApiNote = {
  id?: string;
  client_id?: string;
  estimate_id?: string | null;
  followup_id?: string | null;
  category?: string;
  note_text?: string;
  created_by?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type NoteCategory = "all" | "general" | "follow_up" | "service" | "installer" | "client_request";

type NoteEntry = {
  id: string;
  clientId: ClientId;
  estimateId?: string;
  followupId?: string;
  category: Exclude<NoteCategory, "all">;
  noteText: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
};

function normalizeNoteCategory(value: unknown): Exclude<NoteCategory, "all"> {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "follow_up" || normalized === "service" || normalized === "installer" || normalized === "client_request") {
    return normalized;
  }
  return "general";
}

function mapApiNote(row: ApiNote): NoteEntry {
  return {
    id: String(row.id || ""),
    clientId: String(row.client_id || "") as ClientId,
    estimateId: row.estimate_id ? String(row.estimate_id) : undefined,
    followupId: row.followup_id ? String(row.followup_id) : undefined,
    category: normalizeNoteCategory(row.category),
    noteText: String(row.note_text || ""),
    createdBy: String(row.created_by || "User"),
    createdAt: String(row.created_at || row.updated_at || new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export type EstimatePickerFeatureHandle = {
  open: (clientId: ClientId) => void;
  clear: () => void;
};

type Props = {
  clientId?: ClientId | null;
  clients: Client[];

  initialClientId?: ClientId | null;
  onConsumedInitialClientId?: () => void;
  initialEstimateId?: EstimateId | null;
  onConsumedInitialEstimateId?: () => void;

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;

  createEstimateForClient: (c: Client, options?: { openManufacturerImport?: boolean }) => void;
  copyEstimateForClient: (client: Client, sourceEstimateId: EstimateId) => void;
  deleteClientToRecycle: (clientId: ClientId) => void;
  deletedEstimatesForClient: { estimate: Client["estimates"][number]; deletedAt: string }[];
  deleteEstimatesForClient: (clientId: ClientId, estimateIds: EstimateId[]) => void;
  restoreDeletedEstimatesForClient: (clientId: ClientId, estimateIds: EstimateId[]) => void;
  purgeDeletedEstimatesForClient: (clientId: ClientId, estimateIds?: EstimateId[]) => void;
  setEstimateInstaller: (clientId: ClientId, estimateId: EstimateId, installerId: string) => void;
  updateEstimateOrderMeta: (clientId: ClientId, estimateId: EstimateId, patch: Record<string, any>) => void;
  updateEstimatePosition: (
    clientId: ClientId,
    estimateId: EstimateId,
    positionId: string,
    patch: {
      positionRef?: string;
      roomName?: string;
      qty?: number;
      widthMm?: number;
      heightMm?: number;
      insertion?: string;
      positionType?: "Window" | "Door";
    }
  ) => void;
  openEstimateDefaults: (clientId: ClientId, estimateId: EstimateId) => void;
  persistEstimateOutcome: (clientId: ClientId, estimateId: EstimateId, outcome: EstimateOutcome) => void;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`epf-card ui-card ui-card--pad-md ${className}`.trim()}>
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="epf-h2">{children}</h2>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <div className="epf-small">{children}</div>;
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
}) {
  const variantClassName =
    variant === "primary"
      ? "epf-button ui-button ui-button--primary"
      : "epf-button ui-button";

  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      className={`${variantClassName} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

const EstimatePickerFeature = React.forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const {
    clientId,
    clients,
    onBack,
    openEditClientPanel,
    createEstimateForClient,
    copyEstimateForClient,
    deleteClientToRecycle,
    deletedEstimatesForClient,
    deleteEstimatesForClient,
    restoreDeletedEstimatesForClient,
    purgeDeletedEstimatesForClient,
    setEstimateInstaller,
    updateEstimateOrderMeta,
    updateEstimatePosition,
    openEstimateDefaults,
  } = props;

  const [pickerClientId, setPickerClientId] = useState<ClientId | null>(null);

  useEffect(() => {
    if (typeof clientId === "undefined") return;
    setPickerClientId(clientId ?? null);
  }, [clientId]);

  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  useEffect(() => {
    if (clientId) setPickerClientId(clientId);
  }, [clientId]);

  const [initialExpandedEstimateId, setInitialExpandedEstimateId] = useState<EstimateId | null>(null);

  useEffect(() => {
    if (!props.initialEstimateId || !pickerClientId) return;
    setEstimatePickerTab("estimates");
    setInitialExpandedEstimateId(props.initialEstimateId);
    props.onConsumedInitialEstimateId?.();
  }, [pickerClientId, props.initialEstimateId]);

  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");

  const [accountNoteDraft, setAccountNoteDraft] = useState("");
  const [accountNoteCategory, setAccountNoteCategory] = useState<Exclude<NoteCategory, "all">>("general");
  const [accountNoteFilter, setAccountNoteFilter] = useState<NoteCategory>("all");
  const [accountNotes, setAccountNotes] = useState<NoteEntry[]>([]);
  const [accountNoteUpdatedAt, setAccountNoteUpdatedAt] = useState<string | null>(null);

  const [selectedEstimateNoteId, setSelectedEstimateNoteId] = useState<EstimateId | "">("");
  const [estimateNoteDraft, setEstimateNoteDraft] = useState("");
  const [estimateNoteCategory, setEstimateNoteCategory] = useState<Exclude<NoteCategory, "all">>("general");
  const [estimateNoteFilter, setEstimateNoteFilter] = useState<NoteCategory>("all");
  const [estimateNotes, setEstimateNotes] = useState<NoteEntry[]>([]);
  const [estimateNoteUpdatedAt, setEstimateNoteUpdatedAt] = useState<string | null>(null);

  const [notesSaving, setNotesSaving] = useState(false);

  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [clientFileLabel, setClientFileLabel] = useState<string>("");
  const [clientFileUrl, setClientFileUrl] = useState<string>("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const activeUserName = CURRENT_APP_USER.name;

  useImperativeHandle(
    ref,
    () => ({
      open: (clientId) => setPickerClientId(clientId),
      clear: () => setPickerClientId(null),
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAccountNotes(clientId: string) {
      try {
        const data = (await apiFetch(`/api/notes?client_id=${encodeURIComponent(clientId)}&limit=200`)) as ApiNote[] | null;
        if (cancelled) return;
        const rows = Array.isArray(data)
          ? data
              .map(mapApiNote)
              .filter((entry) => entry.id && !entry.estimateId && !entry.followupId)
              .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
          : [];
        setAccountNotes(rows);
        setAccountNoteUpdatedAt(rows[0]?.updatedAt || rows[0]?.createdAt || null);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load account notes", error);
        setAccountNotes([]);
        setAccountNoteUpdatedAt(null);
      }
    }

    if (!pickerClient?.id) {
      setAccountNotes([]);
      setAccountNoteDraft("");
      setAccountNoteUpdatedAt(null);
      return () => {
        cancelled = true;
      };
    }

    loadAccountNotes(String(pickerClient.id));

    return () => {
      cancelled = true;
    };
  }, [pickerClient?.id]);

  useEffect(() => {
    if (!pickerClient) {
      setSelectedEstimateNoteId("");
      return;
    }

    const estimateIds = (pickerClient.estimates ?? []).map((estimate) => estimate.id);
    if (!estimateIds.length) {
      setSelectedEstimateNoteId("");
      return;
    }

    setSelectedEstimateNoteId((current) => {
      if (current && estimateIds.includes(current as EstimateId)) return current;
      if (initialExpandedEstimateId && estimateIds.includes(initialExpandedEstimateId)) return initialExpandedEstimateId;
      return estimateIds[0];
    });
  }, [pickerClient, initialExpandedEstimateId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEstimateNotes(estimateId: string) {
      try {
        if (!pickerClient?.id) return;
        const data = (await apiFetch(
          `/api/notes?client_id=${encodeURIComponent(String(pickerClient.id))}&estimate_id=${encodeURIComponent(estimateId)}&limit=200`
        )) as ApiNote[] | null;
        if (cancelled) return;
        const rows = Array.isArray(data)
          ? data
              .map(mapApiNote)
              .filter((entry) => entry.id && String(entry.estimateId || "") === estimateId)
              .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
          : [];
        setEstimateNotes(rows);
        setEstimateNoteUpdatedAt(rows[0]?.updatedAt || rows[0]?.createdAt || null);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load estimate notes", error);
        setEstimateNotes([]);
        setEstimateNoteUpdatedAt(null);
      }
    }

    if (!selectedEstimateNoteId || !pickerClient?.id) {
      setEstimateNotes([]);
      setEstimateNoteDraft("");
      setEstimateNoteUpdatedAt(null);
      return () => {
        cancelled = true;
      };
    }

    loadEstimateNotes(String(selectedEstimateNoteId));

    return () => {
      cancelled = true;
    };
  }, [pickerClient?.id, selectedEstimateNoteId]);

  async function saveAccountNotes() {
    if (!pickerClient?.id || !accountNoteDraft.trim()) return;
    setNotesSaving(true);
    try {
      await apiFetch(`/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          client_id: String(pickerClient.id),
          estimate_id: null,
          followup_id: null,
          category: accountNoteCategory,
          note_text: accountNoteDraft.trim(),
          created_by: activeUserName,
        }),
      });

      const data = (await apiFetch(`/api/notes?client_id=${encodeURIComponent(String(pickerClient.id))}&limit=200`)) as ApiNote[] | null;
      const rows = Array.isArray(data)
        ? data
            .map(mapApiNote)
            .filter((entry) => entry.id && !entry.estimateId && !entry.followupId)
            .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
        : [];
      setAccountNotes(rows);
      setAccountNoteDraft("");
      setAccountNoteUpdatedAt(rows[0]?.updatedAt || rows[0]?.createdAt || new Date().toISOString());
    } finally {
      setNotesSaving(false);
    }
  }

  async function saveEstimateNotes() {
    if (!selectedEstimateNoteId || !pickerClient?.id || !estimateNoteDraft.trim()) return;
    setNotesSaving(true);
    try {
      await apiFetch(`/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          client_id: String(pickerClient.id),
          estimate_id: String(selectedEstimateNoteId),
          followup_id: null,
          category: estimateNoteCategory,
          note_text: estimateNoteDraft.trim(),
          created_by: activeUserName,
        }),
      });

      const data = (await apiFetch(
        `/api/notes?client_id=${encodeURIComponent(String(pickerClient.id))}&estimate_id=${encodeURIComponent(String(selectedEstimateNoteId))}&limit=200`
      )) as ApiNote[] | null;
      const rows = Array.isArray(data)
        ? data
            .map(mapApiNote)
            .filter((entry) => entry.id && String(entry.estimateId || "") === String(selectedEstimateNoteId))
            .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
        : [];
      setEstimateNotes(rows);
      setEstimateNoteDraft("");
      setEstimateNoteUpdatedAt(rows[0]?.updatedAt || rows[0]?.createdAt || new Date().toISOString());
    } finally {
      setNotesSaving(false);
    }
  }

  function confirmDeleteClient(client: Client) {
    const headline = client.type === "Business" ? (client.businessName || client.clientName) : client.clientName;
    const ok = window.confirm(`Send client ${headline} (${client.clientRef}) and all linked estimates to recycle bin?`);
    if (!ok) return;
    deleteClientToRecycle(client.id);
  }

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClientId) return;
    openEstimateDefaults(pickerClientId, estimateId);
  }

  if (!pickerClient) {
    return (
      <Card className="qs-migrated-242">
        <div className="epf-header">
          <div>
            <H2>Estimate Selection</H2>
            <Small>Select a client to view estimates, orders, notes and files.</Small>
          </div>

          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>

        <div className="epf-list">
          {clients.length === 0 && <Small>No clients yet.</Small>}

          {clients.map((c) => (
            <div key={c.id} className="epf-client-row" data-testid="client-picker-row" data-client-ref={c.clientRef}>
              <div className="epf-client-meta">
                <div className="epf-client-name">
                  {c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}
                </div>
                <Small>
                  {c.clientRef} • {c.estimates.length} estimates
                </Small>
              </div>

              <div className="epf-actions">
                <Button variant="secondary" onClick={() => openEditClientPanel(c)}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => confirmDeleteClient(c)}>
                  Delete Client
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
  }

  return (
    <Card className="qs-migrated-2">
      <div className="epf-card-body">
        <div className="epf-header">
          <div>
            <H2>Estimate Selection</H2>
            <Small>
              {pickerClient.clientName} • {pickerClient.clientRef}
            </Small>
          </div>

          <div className="epf-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                onBack();
              }}
            >
              Back
            </Button>
            <Button variant="secondary" onClick={() => confirmDeleteClient(pickerClient)}>
              Delete Client
            </Button>
          </div>
        </div>

        <EstimatePickerTabs
          estimatePickerTab={estimatePickerTab}
          initialExpandedEstimateId={initialExpandedEstimateId}
          onConsumedInitialExpandedEstimateId={() => setInitialExpandedEstimateId(null)}
          setEstimatePickerTab={setEstimatePickerTab}
          pickerClient={pickerClient}
          createEstimateForClient={createEstimateForClient}
          openEditClientPanel={openEditClientPanel}
          openEstimateFromPicker={openEstimateFromPicker}
          copyEstimateForClient={copyEstimateForClient}
          deletedEstimatesForClient={deletedEstimatesForClient}
          deleteEstimatesForClient={deleteEstimatesForClient}
          restoreDeletedEstimatesForClient={restoreDeletedEstimatesForClient}
          purgeDeletedEstimatesForClient={purgeDeletedEstimatesForClient}
          setEstimateInstaller={setEstimateInstaller}
          updateEstimateOrderMeta={updateEstimateOrderMeta}
          updateEstimatePosition={updateEstimatePosition}
          persistEstimateOutcome={props.persistEstimateOutcome}
          accountNoteDraft={accountNoteDraft}
          setAccountNoteDraft={setAccountNoteDraft}
          accountNotes={accountNotes}
          accountNoteCategory={accountNoteCategory}
          setAccountNoteCategory={setAccountNoteCategory}
          accountNoteFilter={accountNoteFilter}
          setAccountNoteFilter={setAccountNoteFilter}
          accountNoteUpdatedAt={accountNoteUpdatedAt}
          saveAccountNotes={saveAccountNotes}
          selectedEstimateNoteId={selectedEstimateNoteId}
          setSelectedEstimateNoteId={setSelectedEstimateNoteId}
          estimateNoteDraft={estimateNoteDraft}
          setEstimateNoteDraft={setEstimateNoteDraft}
          estimateNotes={estimateNotes}
          estimateNoteCategory={estimateNoteCategory}
          setEstimateNoteCategory={setEstimateNoteCategory}
          estimateNoteFilter={estimateNoteFilter}
          setEstimateNoteFilter={setEstimateNoteFilter}
          estimateNoteUpdatedAt={estimateNoteUpdatedAt}
          saveEstimateNotes={saveEstimateNotes}
          notesSaving={notesSaving}
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
