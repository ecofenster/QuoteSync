param(
  [string]$Note = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

Write-Host ("Run directory: " + (Get-Location).Path)

# Must run from ps1_patches
if ((Split-Path -Leaf (Get-Location).Path) -ne "ps1_patches") {
  Warn "Recommended: run from PS C:\Github\QuoteSync\web\ps1_patches>"
}

function Find-WebRoot {
  $p = (Get-Location).Path
  for($i=0;$i -lt 8;$i++){
    if(Test-Path (Join-Path $p "package.json")) { return $p }
    $parent = Split-Path -Parent $p
    if($parent -eq $p) { break }
    $p = $parent
  }
  return $null
}

$webRoot = Find-WebRoot
if(-not $webRoot){ Fail "Could not detect web root (package.json not found in parents)." }
Ok "Detected web root: $webRoot"

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot ("_backups\" + $ts)
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup dir: $backupDir"

function Backup-File([string]$rel){
  $src = Join-Path $webRoot $rel
  if(Test-Path $src){
    $dst = Join-Path $backupDir ($rel -replace '[\\/:*?"<>|]', '_')
    Copy-Item $src $dst -Force
    Ok "Backed up: $rel"
  } else {
    Warn "File not found (skip backup): $rel"
  }
}

$targets = @(
  "src\services\clientNotesStore.ts",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx",
  "src\features\followUps\FollowUpsFeature.tsx"
)

$targets | ForEach-Object { Backup-File $_ }

function Ensure-DirFor([string]$rel){
  $full = Join-Path $webRoot $rel
  $dir = Split-Path -Parent $full
  if(-not (Test-Path $dir)){
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Ok "Created dir: $dir"
  }
}

function Write-UTF8([string]$rel, [string]$content){
  Ensure-DirFor $rel
  $full = Join-Path $webRoot $rel
  # Ensure stable LF/CRLF: keep as provided (PowerShell writes CRLF)
  Set-Content -Path $full -Value $content -Encoding UTF8
  Ok "Wrote: $rel"
}

# --- Write files ---
$clientNotesStore = @'
import type { ClientId, ClientNote } from "../models/types";

/**
 * Client Notes Store (Phase 1)
 * - Client-specific notes (NOT estimate/project specific)
 * - Stored in localStorage per client
 * - Simple pub/sub so FollowUps + EstimatePicker stay consistent
 */

const KEY_PREFIX = "qs_client_notes_v1_";

function keyForClient(clientId: ClientId) {
  return `${KEY_PREFIX}${clientId}`;
}

function safeParse(raw: string | null): ClientNote[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ClientNote[];
  } catch {
    return [];
  }
}

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return "[]";
  }
}

type Listener = (notes: ClientNote[]) => void;
const listenersByClient = new Map<string, Set<Listener>>();

function emit(clientId: ClientId, notes: ClientNote[]) {
  const set = listenersByClient.get(String(clientId));
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(notes);
    } catch {
      // ignore listener errors
    }
  }
}

export function loadClientNotes(clientId: ClientId): ClientNote[] {
  try {
    return safeParse(localStorage.getItem(keyForClient(clientId)));
  } catch {
    return [];
  }
}

export function saveClientNotes(clientId: ClientId, notes: ClientNote[]) {
  try {
    localStorage.setItem(keyForClient(clientId), safeStringify(notes ?? []));
  } catch {
    // ignore storage errors
  }
  emit(clientId, notes ?? []);
}

export function appendClientNote(clientId: ClientId, note: ClientNote) {
  const list = loadClientNotes(clientId);
  const next = [note, ...list];
  saveClientNotes(clientId, next);
  return next;
}

export function subscribeClientNotes(clientId: ClientId, listener: Listener) {
  const k = String(clientId);
  const set = listenersByClient.get(k) ?? new Set<Listener>();
  set.add(listener);
  listenersByClient.set(k, set);

  // fire immediately with current value
  try {
    listener(loadClientNotes(clientId));
  } catch {
    // ignore
  }

  return () => {
    const s = listenersByClient.get(k);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listenersByClient.delete(k);
  };
}

'@

$estimatePickerFeature = @'
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

'@

$estimatePickerTabs = @'
// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React, { useState } from "react";
import type { Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";

type Props = {
  estimatePickerTab: EstimatePickerTab;
  setEstimatePickerTab: (t: EstimatePickerTab) => void;

  pickerClient: Client | null;
  openEditClientPanel: (c: Client) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;

  estimateOutcomeById: Record<EstimateId, EstimateOutcome | undefined>;
  setEstimateOutcomeById: React.Dispatch<React.SetStateAction<Record<EstimateId, EstimateOutcome>>>;

  clientNoteDraftHtml: string;
  setClientNoteDraftHtml: (html: string) => void;
  clientNotes: ClientNote[];
  setClientNotes: React.Dispatch<React.SetStateAction<ClientNote[]>>;

  activeUserName: string;

  clientFileLabel: string;
  setClientFileLabel: (v: string) => void;
  clientFileUrl: string;
  setClientFileUrl: (v: string) => void;
  clientFileNames: string[];
  setClientFileNames: (v: string[]) => void;
  clientFiles: ClientFile[];
  setClientFiles: React.Dispatch<React.SetStateAction<ClientFile[]>>;
};

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, disabled, ...rest } = props;

  // Minimal local primitive; matches existing file's inline styling approach.
  const base: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e4e4e7",
    background: disabled ? "#f4f4f5" : "#ffffff",
    color: "#111827",
    fontSize: 14,
    outline: "none",
  };

  return <input {...rest} disabled={disabled} style={{ ...base, ...(style as any) }} />;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 800,
        background: "#f4f4f5",
        color: "#18181b",
        border: "1px solid #e4e4e7",
      }}
    >
      {children}
    </span>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
  marginBottom: 6,
};

function ClientDetailsReadonly({ c, onEdit }: { c: Client; onEdit: () => void }) {
  const partsP = (c.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
  while (partsP.length < 7) partsP.push("");
  const [p1, p2, p3, pt, pc, pco, pp] = [partsP[0] || "", partsP[1] || "", partsP[2] || "", partsP[3] || "", partsP[4] || "", partsP[5] || "", partsP[6] || ""];

  const invDifferent = ((c.invoiceAddress || "").trim() !== (c.projectAddress || "").trim());
  const partsI = (c.invoiceAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
  while (partsI.length < 7) partsI.push("");
  const [i1, i2, i3, it, ic, ico, ip] = [partsI[0] || "", partsI[1] || "", partsI[2] || "", partsI[3] || "", partsI[4] || "", partsI[5] || "", partsI[6] || ""];

  return (
    <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <H3>Client contact information</H3>
        <Button variant="secondary" onClick={onEdit}>Edit</Button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={c.type === "Business"} disabled />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>Business customer</span>
          </label>
          <Small>Type: {c.type}</Small>
        </div>

        {c.type === "Business" ? (
          <>
            <div>
              <div style={labelStyle}>Business name</div>
              <Input value={c.businessName || c.clientName || ""} onChange={() => {}} disabled />
            </div>
            <div>
              <div style={labelStyle}>Contact name</div>
              <Input value={c.contactPerson || ""} onChange={() => {}} disabled />
            </div>
          </>
        ) : (
          <div>
            <div style={labelStyle}>Client name</div>
            <Input value={c.clientName || ""} onChange={() => {}} disabled />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={labelStyle}>Email</div>
            <Input value={c.email || ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div style={labelStyle}>Mobile</div>
            <Input value={c.mobile || ""} onChange={() => {}} disabled />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Home</div>
          <Input value={c.home || ""} onChange={() => {}} disabled />
        </div>

        <div style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
          <H3>Project site address</H3>

          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Address line 1</div>
                <Input value={p1} onChange={() => {}} disabled />
              </div>
              <div>
                <div style={labelStyle}>Address line 2</div>
                <Input value={p2} onChange={() => {}} disabled />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Address line 3</div>
              <Input value={p3} onChange={() => {}} disabled />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Town</div>
                <Input value={pt} onChange={() => {}} disabled />
              </div>
              <div>
                <div style={labelStyle}>City</div>
                <Input value={pc} onChange={() => {}} disabled />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>County</div>
                <Input value={pco} onChange={() => {}} disabled />
              </div>
              <div>
                <div style={labelStyle}>Postcode</div>
                <Input value={pp} onChange={() => {}} disabled />
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
                <input type="checkbox" checked={invDifferent} disabled />
                Invoice address if different
              </label>
            </div>

            {invDifferent && (
              <div style={{ marginTop: 10, borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <H3>Invoice address</H3>

                <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Address line 1</div>
                      <Input value={i1} onChange={() => {}} disabled />
                    </div>
                    <div>
                      <div style={labelStyle}>Address line 2</div>
                      <Input value={i2} onChange={() => {}} disabled />
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle}>Address line 3</div>
                    <Input value={i3} onChange={() => {}} disabled />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Town</div>
                      <Input value={it} onChange={() => {}} disabled />
                    </div>
                    <div>
                      <div style={labelStyle}>City</div>
                      <Input value={ic} onChange={() => {}} disabled />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>County</div>
                      <Input value={ico} onChange={() => {}} disabled />
                    </div>
                    <div>
                      <div style={labelStyle}>Postcode</div>
                      <Input value={ip} onChange={() => {}} disabled />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function qsOutcomeStyle(outcome: string): any {
  const o = (outcome || "").toLowerCase();
  if (o === "order") return { background: "#22c55e", color: "#000", fontWeight: 800, border: "1px solid #22c55e" };
  if (o === "lost") return { background: "#ef4444", color: "#fff", fontWeight: 800, border: "1px solid #ef4444" };
  return { background: "#f59e0b", color: "#000", fontWeight: 800, border: "1px solid #f59e0b" };
}

export default function EstimatePickerTabs(props: Props) {
  const [statusMenuForEstimateId, setStatusMenuForEstimateId] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onDocClick() {
      setStatusMenuForEstimateId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const {
    estimatePickerTab,
    setEstimatePickerTab,
    pickerClient,
    openEditClientPanel,
    openEstimateFromPicker,
    estimateOutcomeById,
    setEstimateOutcomeById,
    clientNoteDraftHtml,
    setClientNoteDraftHtml,
    clientNotes,
    setClientNotes,
    activeUserName,
    clientFileLabel,
    setClientFileLabel,
    clientFileUrl,
    setClientFileUrl,
    clientFileNames,
    setClientFileNames,
    clientFiles,
    setClientFiles,
  } = props;

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendModalEstimateId, setSendModalEstimateId] = useState<string | null>(null);
  const [sendModalAddFollowUp, setSendModalAddFollowUp] = useState(true); // Option B: user can untick
  const [sendModalFollowUpDays, setSendModalFollowUpDays] = useState(3); // default 72h
  const [sendModalPhoneCall, setSendModalPhoneCall] = useState(true);

  const QS_FOLLOWUPS_KEY = "qs_followups_v1";

  function isoDatePlusDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getOutcomeStyles(outcome: EstimateOutcome) {
    if (outcome === "Order") {
      return { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
    }
    if (outcome === "Lost") {
      return { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" };
    }
    // Open
    return { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" };
  }

  function loadFollowUpsSafe(): any[] {
    try {
      const raw = localStorage.getItem(QS_FOLLOWUPS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFollowUpsSafe(list: any[]) {
    try {
      localStorage.setItem(QS_FOLLOWUPS_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function addFollowUpForEstimate(estimateId: string, opts?: { days?: number; sendEmail?: boolean; needsCall?: boolean }) {
    const e = pickerClient.estimates.find((x) => x.id === estimateId);
    if (!e) return;

    const dueDateISO = isoDatePlusDays(opts?.days ?? 3);

    const followUp = {
      id: uid(),
      clientId: pickerClient.id,
      clientName: pickerClient.clientName,
      clientRef: (pickerClient as any).clientRef,
      estimateId: e.id,
      estimateRef: (e as any).estimateRef,
      dueDateISO,
      title: `Follow up: ${pickerClient.clientName} • ${(e as any).estimateRef ?? ""}`.trim(),
      notes: [
        (opts?.needsCall ?? true) ? "Telephone call" : null,
        (opts?.sendEmail ?? true) ? "Follow-up email" : null,
      ].filter(Boolean).join(" • "),
      status: "pending",
      type: "call",
      createdAt: new Date().toISOString(),
      sendEmail: (opts?.sendEmail ?? true),
      needsCall: (opts?.needsCall ?? true),
    };

    const list = loadFollowUpsSafe();
    list.unshift(followUp);
    saveFollowUpsSafe(list);

    alert(`Follow-up added for ${dueDateISO}. Open Customers → Follow Ups to export .ics if needed.`);
  }

  function buildSendEmailText(estimateId: string) {
    const e = pickerClient.estimates.find((x) => x.id === estimateId);
    const estimateRef = (e as any)?.estimateRef ?? "";
    const clientRef = (pickerClient as any)?.clientRef ?? "";
    const clientName = pickerClient.clientName ?? "Client";
    const itemsCount = e?.positions?.length ?? 0;

    const subject = `Your quotation – ${clientRef || clientName} ${estimateRef ? "• " + estimateRef : ""}`.trim();

    const bodyLines = [
      `Dear ${clientName},`,
      ``,
      `Please find our quotation attached / linked below.`,
      ``,
      `Estimate: ${estimateRef || "(ref)"}  (${itemsCount} item${itemsCount === 1 ? "" : "s"})`,
      ``,
      `Summary (to be expanded):`,
      `• Materials/finishes: (later)`,
      `• Quantity: ${itemsCount}`,
      `• Area (m²) and linear metres: (later)`,
      ``,
      `Kind regards,`,
      `Ecofenster Ltd`,
    ];

    const body = bodyLines.join("\n");
    return { subject, body };
  }

  function openMailClient(subject: string, body: string) {
    const to = (pickerClient as any)?.email ?? "";
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  const sendEmailDraft = sendModalEstimateId ? buildSendEmailText(sendModalEstimateId) : { subject: "", body: "" };

  return (
    <>
{/* Tabs (Estimate Picker only) */}
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <Button variant={estimatePickerTab === "client_info" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_info")}>
    Client Info
  </Button>
  <Button variant={estimatePickerTab === "estimates" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("estimates")}>
    Estimates
  </Button>
  <Button variant={estimatePickerTab === "orders" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("orders")}>
    Orders
  </Button>
  <Button variant={estimatePickerTab === "client_notes" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_notes")}>
    Client Notes
  </Button>
  <Button variant={estimatePickerTab === "files" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("files")}>
    Files
  </Button>
</div>

{/* CLIENT INFO (default landing tab) */}
{estimatePickerTab === "client_info" && (
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

          <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
            Open
          </Button>
        </div>
      ))}
    </div>
  </div>
)}

{/* ESTIMATES (with outcome dropdown) */}
{estimatePickerTab === "estimates" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Estimates</H3>
      <Small>Set outcome per estimate.</Small>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {pickerClient.estimates.map((e) => {
        const outcome = estimateOutcomeById[e.id] ?? "Open";
        return (
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

            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Email</div>
    <Button
                variant="outline"
                onClick={() => {
                  setSendModalEstimateId(e.id);
                  setSendModalOpen(true);
                  setSendModalAddFollowUp(true);
                  setSendModalFollowUpDays(3);
                  setSendModalPhoneCall(true);
                }}
              >
                Send
              </Button>
  </div>

  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Follow up</div>
    <Button variant="outline" onClick={() => addFollowUpForEstimate(e.id, { days: 3, sendEmail: true, needsCall: true })}>
                Add Follow Up
              </Button>
  </div>

  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Estimate status</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      

                      <div style={{ position: "relative", display: "inline-block" }}>
                        <div
                          role="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setStatusMenuForEstimateId((prev) => (prev === String(e.id) ? null : String(e.id)));
                          }}
                          style={{
                            ...(statusMenuForEstimateId === String(e.id)
                              ? { background: "#fff", color: "#111827", fontWeight: 800, border: "1px solid #e4e4e7" }
                              : qsOutcomeStyle(outcome)),
                            height: 38,
                            padding: "0 28px 0 14px",
                            borderRadius: 999,
                            outline: "none",
        direction: "ltr",
        unicodeBidi: "plaintext",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            userSelect: "none",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontWeight: 900, lineHeight: 1 }}>{outcome}</span>
                          <span style={{ fontWeight: 900, lineHeight: 1 }}>▾</span>
                        </div>

                        {statusMenuForEstimateId === String(e.id) && (
                          <div
                            style={{
                              position: "absolute",
                              top: 40,
                              left: 0,
                              minWidth: 120,
                              borderRadius: 12,
                              border: "1px solid #e4e4e7",
                              overflow: "hidden",
                              background: "#fff",
                              zIndex: 50,
                              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {(["Open", "Order", "Lost"] as EstimateOutcome[]).map((opt) => (
                              <div
                                key={opt}
                                role="option"
                                aria-selected={opt === outcome}
                                onClick={() => {
                                  setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: opt }));
                                  setStatusMenuForEstimateId(null);
                                }}
                                style={{
                                background: "#fff",
                                color: "#111827",
                                fontWeight: 800,
                                border: "1px solid transparent",
                                  padding: "8px 10px",
                                  cursor: "pointer",
                                  borderBottom: opt === "Lost" ? "none" : "1px solid rgba(0,0,0,0.08)",
                                }}
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
  </div>

  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Open estimate</div>
    <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                Open
              </Button>
  </div>
</div>
          </div>
        );
      })}
    </div>
  </div>
)}

{/* ORDERS (estimates marked "Order") */}
{estimatePickerTab === "orders" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Orders</H3>
      <Small>Only estimates marked “Order”.</Small>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {pickerClient.estimates
        .filter((e) => (estimateOutcomeById[e.id] ?? "") === "Order")
        .map((e) => (
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

            <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
              Open
            </Button>
          </div>
        ))}

      {pickerClient.estimates.filter((e) => (estimateOutcomeById[e.id] ?? "") === "Order").length === 0 && (
        <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
          <Small>No orders yet. Mark an estimate as “Order” in the Estimates tab.</Small>
        </div>
      )}
    </div>
  </div>
)}

{/* CLIENT NOTES (WYSIWYG comment area, timestamp + user) */}
{estimatePickerTab === "client_notes" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Client Notes</H3>
      <Small>Notes are stored locally for now.</Small>
    </div>

    <div
      contentEditable
      suppressContentEditableWarning
      dir="ltr"
      onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}
      dangerouslySetInnerHTML={{ __html: clientNoteDraftHtml }}
      style={{
        minHeight: 120,
        borderRadius: 14,
        border: "1px solid #e4e4e7",
        padding: 12,
        background: "#fff",
        outline: "none",
        direction: "ltr",
        unicodeBidi: "plaintext",
      }}
    />

    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <Button
        variant="primary"
        onClick={() => {
          const html = (clientNoteDraftHtml ?? "").trim();
          if (!html) return;
          const createdAt = new Date().toISOString();
          setClientNotes((prev) => [{ id: "note_" + createdAt, html, createdAt, createdBy: activeUserName }, ...prev]);
          setClientNoteDraftHtml("");
        }}
      >
        Add Note
      </Button>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {clientNotes.map((n) => (
        <div key={n.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <Small>{new Date(n.createdAt).toLocaleString()}</Small>
            <Small>By: {n.createdBy}</Small>
          </div>
          <div dir="ltr" style={{ marginTop: 8, direction: "ltr", unicodeBidi: "plaintext" }} dangerouslySetInnerHTML={{ __html: n.html }} />
        </div>
      ))}
      {clientNotes.length === 0 && (
        <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
          <Small>No notes yet.</Small>
        </div>
      )}
    </div>
  </div>
)}

{/* FILES (URLs + local selection list) */}
{estimatePickerTab === "files" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Files</H3>
      <Small>Links to SharePoint/Drive/OneDrive/local paths.</Small>
    </div>

    <div style={{ display: "grid", gap: 10, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
      <div style={{ display: "grid", gap: 6 }}>
        <Small>Label</Small>
        <input
          value={clientFileLabel}
          onChange={(e) => setClientFileLabel(e.currentTarget.value)}
          placeholder="e.g. Site photos / Survey PDF / CAD"
          style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px" }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Small>URL / Path</Small>
        <input
          value={clientFileUrl}
          onChange={(e) => setClientFileUrl(e.currentTarget.value)}
          placeholder="https://...  or  C:\path\file.pdf"
          style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px" }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Small>Attach files (optional)</Small>
        <input
          type="file"
          multiple
          accept=".dwg,.dxf,.xls,.xlsx,.doc,.docx,.pdf,.skp,.png,.jpg,.jpeg,.webp,.txt"
          onChange={(e) => {
            const names = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
            setClientFileNames(names);
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          onClick={() => {
            if (!clientFileUrl.trim()) return;
            window.open(clientFileUrl, "_blank");
          }}
        >
          Open link
        </Button>

        <Button
          variant="primary"
          onClick={() => {
            const url = clientFileUrl.trim();
            if (!url) return;
            const addedAt = new Date().toISOString();
            setClientFiles((prev) => [
              { id: "file_" + addedAt, label: (clientFileLabel || "File").trim(), url, addedAt, addedBy: activeUserName, fileNames: clientFileNames },
              ...prev,
            ]);
            setClientFileLabel("");
            setClientFileUrl("");
            setClientFileNames([]);
          }}
        >
          Add
        </Button>
      </div>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {clientFiles.map((f) => (
        <div key={f.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 800 }}>{f.label}</div>
              <Small style={{ wordBreak: "break-all" }}>{f.url}</Small>
            </div>
            <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
              <Small>{new Date(f.addedAt).toLocaleString()}</Small>
              <Small>By: {f.addedBy}</Small>
            </div>
          </div>

          {!!(f.fileNames && f.fileNames.length) && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {f.fileNames.map((n) => (
                <Pill key={n}>{n}</Pill>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => window.open(f.url, "_blank")}>
              Open link
            </Button>
          </div>
        </div>
      ))}
      {clientFiles.length === 0 && (
        <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
          <Small>No files yet.</Small>
        </div>
      )}
    </div>
  </div>
)}
          {sendModalOpen && sendModalEstimateId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div style={{ width: "min(820px, 100%)", background: "#fff", borderRadius: 16, border: "1px solid #e4e4e7" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Send estimate</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {pickerClient.clientName} • {(pickerClient as any).clientRef ?? ""} •{" "}
                  {pickerClient.estimates.find((x) => x.id === sendModalEstimateId)?.estimateRef ?? ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="outline" onClick={() => setSendModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 14 }}>
              {/* Send email */}
              <div style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Send email</div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <Small>Subject</Small>
                    <input
                      value={sendEmailDraft.subject}
                      readOnly
                      style={{
                        height: 36,
                        borderRadius: 10,
                        border: "1px solid #e4e4e7",
                        padding: "0 10px",
                        background: "#fff",
                        fontSize: 14,
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <Small>Body</Small>
                    <textarea
                      value={sendEmailDraft.body}
                      readOnly
                      rows={8}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #e4e4e7",
                        padding: 10,
                        background: "#fff",
                        fontSize: 14,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`Subject: ${sendEmailDraft.subject}\n\n${sendEmailDraft.body}`);
                          alert("Email text copied.");
                        } catch {
                          alert("Could not copy to clipboard.");
                        }
                      }}
                    >
                      Copy email text
                    </Button>

                    <Button variant="primary" onClick={() => openMailClient(sendEmailDraft.subject, sendEmailDraft.body)}>
                      Open email app
                    </Button>
                  </div>

                  <Small style={{ color: "#6b7280" }}>
                    Attachments/brochures and full summaries (sqm/linear m/materials) will be added later.
                  </Small>
                </div>
              </div>

              {/* Follow up */}
              <div style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Add follow up</div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="checkbox" checked={sendModalAddFollowUp} onChange={(e) => setSendModalAddFollowUp(e.currentTarget.checked)} />
                    <span style={{ fontSize: 13, color: "#111827", fontWeight: 800 }}>
                      Create follow-up (default {sendModalFollowUpDays} days / 72 hours)
                    </span>
                  </label>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <Small>Follow up in (days)</Small>
                    <input
                      type="number"
                      min={0}
                      value={sendModalFollowUpDays}
                      onChange={(e) => setSendModalFollowUpDays(Math.max(0, Number(e.currentTarget.value || 0)))}
                      style={{
                        width: 90,
                        height: 36,
                        borderRadius: 10,
                        border: "1px solid #e4e4e7",
                        padding: "0 10px",
                        background: "#fff",
                        fontSize: 14,
                      }}
                    />

                    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input type="checkbox" checked={sendModalPhoneCall} onChange={(e) => setSendModalPhoneCall(e.currentTarget.checked)} />
                      <span style={{ fontSize: 13, color: "#111827", fontWeight: 800 }}>Telephone call</span>
                    </label>
                  </div>

                  <Small style={{ color: "#6b7280" }}>
                    Phase 1: Follow-ups are stored locally and appear in Customers → Follow Ups. Export .ics there for Outlook/Google reminders.
                  </Small>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button variant="outline" onClick={() => setSendModalOpen(false)}>
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    // Phase 1: "Send" = open mail app; optionally schedule follow-up (Option B checkbox)
                    openMailClient(sendEmailDraft.subject, sendEmailDraft.body);
                    if (sendModalAddFollowUp) {
                      addFollowUpForEstimate(sendModalEstimateId, {
                        days: sendModalFollowUpDays,
                        sendEmail: true,
                        needsCall: sendModalPhoneCall,
                      });
                    }
                    setSendModalOpen(false);
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
</>
  );
}












'@

$followUpsFeature = @'
import React, { useEffect, useMemo, useState } from "react";
import type { Client, ClientId } from "../../models/types";
import { appendClientNote } from "../../services/clientNotesStore";
import * as Models from "../../models/types";

type FollowUp = {
  id: string;
  clientId: ClientId;
  clientName: string;
  clientRef?: string;
  estimateId?: string;
  estimateRef?: string;
  dueDateISO: string; // YYYY-MM-DD
  title: string;
  notes?: string;
  status?: "pending" | "done";
  type?: "call" | "email";
  createdAt: string;
  sendEmail?: boolean;
  needsCall?: boolean;
};

const STORAGE_KEY = "qs_followups_v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function loadFollowUpsSafe(): FollowUp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FollowUp[];
  } catch {
    return [];
  }
}

function saveFollowUpsSafe(list: FollowUp[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list ?? []));
  } catch {
    // ignore
  }
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function FollowUpsFeature({
  clients,
  onOpenClient,
}: {
  clients: Client[];
  onOpenClient: (clientId: ClientId) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [selectedDateISO, setSelectedDateISO] = useState(() => toISODate(new Date()));
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [noteSavedToast, setNoteSavedToast] = useState<string | null>(null);

  // Keep clock fresh for "today" highlight (not critical)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const followUps = useMemo(() => loadFollowUpsSafe(), [noteSavedToast]); // re-load after save note toast
  const followUpsByDate = useMemo(() => {
    const m = new Map<string, FollowUp[]>();
    for (const fu of followUps) {
      const k = fu.dueDateISO;
      const arr = m.get(k) ?? [];
      arr.push(fu);
      m.set(k, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      m.set(k, arr);
    }
    return m;
  }, [followUps]);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthDays = useMemo(() => {
    // Build a simple 7-column grid, starting Monday
    const start = new Date(monthStart);
    const day = start.getDay(); // 0 Sun..6 Sat
    const mondayIndex = (day + 6) % 7;
    const gridStart = addDays(start, -mondayIndex);

    const end = new Date(monthEnd);
    const endDay = end.getDay();
    const endMondayIndex = (endDay + 6) % 7;
    const gridEnd = addDays(end, (6 - endMondayIndex));

    const out: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [monthStart.getTime(), monthEnd.getTime()]);

  const selectedList = followUpsByDate.get(selectedDateISO) ?? [];
  const selectedFollowUp = selectedList.find((x) => x.id === selectedFollowUpId) ?? null;

  useEffect(() => {
    // If date changes, select first item
    setSelectedFollowUpId((prev) => {
      if (!selectedList.length) return null;
      if (prev && selectedList.some((x) => x.id === prev)) return prev;
      return selectedList[0].id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateISO]);

  useEffect(() => {
    setNoteText("");
    setNoteSavedToast(null);
  }, [selectedFollowUpId]);

  function gotoPrevMonth() {
    setNow((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function gotoNextMonth() {
    setNow((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function markDone(id: string) {
    const list = loadFollowUpsSafe();
    const next = list.map((x) => (x.id !== id ? x : { ...x, status: "done" as const }));
    saveFollowUpsSafe(next);
    setNoteSavedToast("Updated follow-up.");
    setTimeout(() => setNoteSavedToast(null), 1500);
  }

  function addClientNoteFromFollowUp() {
    if (!selectedFollowUp) return;
    const txt = (noteText ?? "").trim();
    if (!txt) return;

    const html = `<div dir="ltr">${escapeHtml(txt).replace(/\r?\n/g, "<br/>")}</div>`;
    appendClientNote(selectedFollowUp.clientId, {
      id: Models.asNoteId(uid()),
      html,
      createdAt: new Date().toISOString(),
      createdBy: "User",
    });

    setNoteText("");
    setNoteSavedToast("Saved client note.");
    setTimeout(() => setNoteSavedToast(null), 1500);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Follow Ups</div>
          <div style={{ fontSize: 12, color: "#71717a" }}>By date • click a follow-up to view details.</div>
        </div>

        {noteSavedToast ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: "#16a34a" }}>{noteSavedToast}</div>
        ) : (
          <div style={{ fontSize: 12, color: "#71717a" }}>{selectedDateISO}</div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "360px 260px",
          gap: 12,
        }}
      >
        {/* Top-left: Calendar */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={gotoPrevMonth}
              style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: "8px 10px", cursor: "pointer", fontWeight: 900 }}
            >
              ←
            </button>
            <div style={{ fontWeight: 900 }}>
              {now.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              onClick={gotoNextMonth}
              style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: "8px 10px", cursor: "pointer", fontWeight: 900 }}
            >
              →
            </button>
          </div>

          <div style={{ padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", textAlign: "center" }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {monthDays.map((d) => {
                const iso = toISODate(d);
                const inMonth = d.getMonth() === now.getMonth();
                const count = (followUpsByDate.get(iso) ?? []).length;
                const isSelected = iso === selectedDateISO;
                const isToday = iso === toISODate(new Date());
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDateISO(iso)}
                    style={{
                      borderRadius: 12,
                      border: isSelected ? "2px solid #18181b" : "1px solid #e4e4e7",
                      background: isSelected ? "#18181b" : "#fff",
                      color: isSelected ? "#fff" : "#111827",
                      padding: "10px 0",
                      cursor: "pointer",
                      opacity: inMonth ? 1 : 0.4,
                      position: "relative",
                      fontWeight: 900,
                    }}
                    title={iso}
                  >
                    {d.getDate()}
                    {isToday && !isSelected && (
                      <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "#16a34a" }} />
                    )}
                    {count > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: 10,
                          fontWeight: 900,
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: isSelected ? "1px solid rgba(255,255,255,0.35)" : "1px solid #e4e4e7",
                          background: isSelected ? "rgba(255,255,255,0.18)" : "#f4f4f5",
                          color: isSelected ? "#fff" : "#111827",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top-right: List */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>Follow-ups on {selectedDateISO}</div>
          <div style={{ padding: 12, display: "grid", gap: 10, maxHeight: 360, overflow: "auto" }}>
            {selectedList.length === 0 && <div style={{ fontSize: 12, color: "#71717a" }}>No follow-ups for this date.</div>}
            {selectedList.map((fu) => {
              const active = fu.id === selectedFollowUpId;
              return (
                <div
                  key={fu.id}
                  onClick={() => setSelectedFollowUpId(fu.id)}
                  style={{
                    borderRadius: 14,
                    border: active ? "2px solid #18181b" : "1px solid #e4e4e7",
                    background: active ? "#18181b" : "#fff",
                    color: active ? "#fff" : "#111827",
                    padding: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{fu.title || "Follow-up"}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.9 }}>
                      {fu.status === "done" ? "Done" : "Pending"}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                    {(fu.clientRef ? `${fu.clientRef} • ` : "")}{fu.clientName}
                    {fu.estimateRef ? ` • ${fu.estimateRef}` : ""}
                  </div>
                  {fu.notes ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{fu.notes}</div> : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom-left: Details */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>Selected follow-up</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {!selectedFollowUp && <div style={{ fontSize: 12, color: "#71717a" }}>Select a follow-up.</div>}
            {selectedFollowUp && (
              <>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{selectedFollowUp.title}</div>
                <div style={{ fontSize: 12, color: "#71717a" }}>
                  Client: {(selectedFollowUp.clientRef ? `${selectedFollowUp.clientRef} • ` : "")}{selectedFollowUp.clientName}
                </div>
                <div style={{ fontSize: 12, color: "#71717a" }}>
                  Due: {selectedFollowUp.dueDateISO} • Created: {new Date(selectedFollowUp.createdAt).toLocaleString()}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => onOpenClient(selectedFollowUp.clientId)}
                    style={{
                      borderRadius: 16,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Open client
                  </button>
                  <button
                    type="button"
                    onClick={() => markDone(selectedFollowUp.id)}
                    style={{
                      borderRadius: 16,
                      border: "none",
                      background: "#18181b",
                      color: "#fff",
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Mark done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom-right: Add Note (client notes) */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>Add client note</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#71717a" }}>
              This note is saved against the client (not project/estimate specific).
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={selectedFollowUp ? "Type a client note..." : "Select a follow-up first."}
              disabled={!selectedFollowUp}
              dir="ltr"
              style={{
                width: "100%",
                minHeight: 120,
                resize: "vertical",
                borderRadius: 14,
                border: "1px solid #e4e4e7",
                padding: 12,
                fontSize: 14,
                outline: "none",
                direction: "ltr",
                unicodeBidi: "plaintext",
              }}
            />

            <button
              type="button"
              onClick={addClientNoteFromFollowUp}
              disabled={!selectedFollowUp || !noteText.trim()}
              style={{
                borderRadius: 16,
                border: "none",
                background: "#18181b",
                color: "#fff",
                padding: "10px 14px",
                cursor: (!selectedFollowUp || !noteText.trim()) ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: (!selectedFollowUp || !noteText.trim()) ? 0.55 : 1,
                justifySelf: "end",
              }}
            >
              Save note to client
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'@

Write-UTF8 "src\services\clientNotesStore.ts" $clientNotesStore
Write-UTF8 "src\features\estimatePicker\EstimatePickerFeature.tsx" $estimatePickerFeature
Write-UTF8 "src\features\estimatePicker\EstimatePickerTabs.tsx" $estimatePickerTabs
Write-UTF8 "src\features\followUps\FollowUpsFeature.tsx" $followUpsFeature

Ok "Done."

if($Note -and $Note.Trim().Length -gt 0){
  try {
    $handover = Join-Path $webRoot "HANDOVER.md"
    if(Test-Path $handover){
      Add-Content -Path $handover -Encoding UTF8 -Value ("`r`n## " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "`r`n- " + $Note.Trim() + "`r`n")
      Ok "Appended note to HANDOVER.md"
    } else {
      Warn "HANDOVER.md not found (skip note append)."
    }
  } catch {
    Warn ("Could not append note: " + $_.Exception.Message)
  }
}
