# QuoteSync patch: Estimate "Send" modal + Add Follow Up (72h default) + status colours + Follow Ups details pane (Option B)
# - Adds Send button (opens modal) and Add Follow Up button to Estimates list.
# - Send modal prepares email (copy/open mail app) and optionally schedules follow-up (checkbox, default ON).
# - Follow-up is saved to localStorage key: qs_followups_v1 (used by FollowUpsFeature).
# - Outcome dropdown styling: Open=orange, Order=green, Lost=red.
# - FollowUpsFeature: selecting an item shows a details pane (Phase 1 scaffold).
#
# IMPORTANT: This script does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_estimate_send_modal_followups_phase1_optionB_20260304_111548.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_estimate_send_modal_followups_phase1_optionB_20260304_111548.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

# Target files
$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
$fuRel   = "src\features\followUps\FollowUpsFeature.tsx"

$tabsPath = Join-Path $webRoot $tabsRel
$fuPath   = Join-Path $webRoot $fuRel

if (-not (Test-Path $tabsPath)) { Fail "Missing file: $tabsPath" }
if (-not (Test-Path $fuPath))   { Fail "Missing file: $fuPath" }

Copy-Item -Force $tabsPath (Join-Path $backupDir "EstimatePickerTabs.tsx")
Ok ("Backed up " + $tabsRel)

Copy-Item -Force $fuPath (Join-Path $backupDir "FollowUpsFeature.tsx")
Ok ("Backed up " + $fuRel)

# Write updated files (SAFEWRITE)
$tabs = @'
﻿// Auto-generated extraction (Phase 2): Estimate Picker Tabs
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

export default function EstimatePickerTabs(props: Props) {
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

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

              <Button variant="outline" onClick={() => addFollowUpForEstimate(e.id, { days: 3, sendEmail: true, needsCall: true })}>
                Add Follow Up
              </Button>

              <select
                value={outcome}
                onChange={(ev) => {
                  const v = ev.currentTarget.value as EstimateOutcome;
                  setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: v }));
                }}
                style={{
                  ...getOutcomeStyles(outcome),
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid #e4e4e7",
                  padding: "0 10px",
                  background: "#fff",
                  fontSize: 14,
                }}
              >
                <option value="Open">Open</option>
                <option value="Lost">Lost</option>
                <option value="Order">Order</option>
              </select>

              <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                Open
              </Button>
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
      onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}
      dangerouslySetInnerHTML={{ __html: clientNoteDraftHtml }}
      style={{
        minHeight: 120,
        borderRadius: 14,
        border: "1px solid #e4e4e7",
        padding: 12,
        background: "#fff",
        outline: "none",
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
          <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: n.html }} />
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
Set-Content -Path $tabsPath -Value $tabs -Encoding UTF8
Ok ("Wrote " + $tabsRel)

$fu = @'
import React, { useEffect, useMemo, useState } from "react";
import type { Client } from "../../models/types";

/**
 * Phase 1 Follow Ups
 * - Left: lightweight calendar (month view)
 * - Right: follow-up list filtered by selected day
 * - Export .ics per follow-up so Outlook/Google/Apple can handle reminders + notifications.
 *
 * NOTE: Browser apps cannot trigger Outlook pop-up reminders directly.
 * Reminders must come from the user's actual calendar app (Outlook/Google), which is why we export .ics in Phase 1.
 */

type FollowUp = {
  id: string;
  clientId: string;
  clientName: string;
  clientRef?: string;
  estimateId?: string;
  estimateRef?: string;
  dueDateISO: string; // YYYY-MM-DD
  title: string;
  notes?: string;
  // For future: status, createdAt, updatedAt, owner, etc.
};

type Props = {
  clients: Client[];
  onOpenClient?: (clientId: string) => void;
};

const STORAGE_KEY = "qs_followups_v1";

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

function startOfWeekMon(d: Date) {
  // Monday = 0
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

function buildMonthGrid(month: Date) {
  const start = startOfWeekMon(startOfMonth(month));
  const end = endOfMonth(month);
  const endGrid = addDays(startOfWeekMon(addDays(end, 6)), 6); // ensure full weeks

  const days: Date[] = [];
  let cur = start;
  while (cur <= endGrid) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function icsEscape(s: string) {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Create an all-day calendar event for a follow-up date.
 * Many clients treat DTSTART;VALUE=DATE and DTEND;VALUE=DATE as all-day.
 * We include VALARM as a best-effort reminder; clients can adjust reminders after import.
 */
function buildICS(fu: FollowUp) {
  const dtStart = fu.dueDateISO.replaceAll("-", "");
  const due = new Date(fu.dueDateISO + "T00:00:00");
  const dtEnd = toISODate(addDays(due, 1)).replaceAll("-", "");

  const uid = `${fu.id}@quotesync.local`;
  const now = new Date();
  const dtStamp =
    `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}` +
    `T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;

  const summary = fu.title || `Follow up: ${fu.clientName}`;
  const descLines = [
    fu.clientRef ? `Client Ref: ${fu.clientRef}` : "",
    fu.estimateRef ? `Estimate: ${fu.estimateRef}` : "",
    fu.notes ? `Notes: ${fu.notes}` : "",
  ].filter(Boolean);

  const description = descLines.join("\n");

  // Default reminder: 30 minutes before (many clients will interpret for all-day as morning reminder)
  const ics =
    "BEGIN:VCALENDAR\r\n" +
    "VERSION:2.0\r\n" +
    "PRODID:-//QuoteSync//FollowUps//EN\r\n" +
    "CALSCALE:GREGORIAN\r\n" +
    "METHOD:PUBLISH\r\n" +
    "BEGIN:VEVENT\r\n" +
    `UID:${icsEscape(uid)}\r\n` +
    `DTSTAMP:${dtStamp}\r\n` +
    `DTSTART;VALUE=DATE:${dtStart}\r\n` +
    `DTEND;VALUE=DATE:${dtEnd}\r\n` +
    `SUMMARY:${icsEscape(summary)}\r\n` +
    `DESCRIPTION:${icsEscape(description)}\r\n` +
    "BEGIN:VALARM\r\n" +
    "ACTION:DISPLAY\r\n" +
    "DESCRIPTION:Reminder\r\n" +
    "TRIGGER:-PT30M\r\n" +
    "END:VALARM\r\n" +
    "END:VEVENT\r\n" +
    "END:VCALENDAR\r\n";

  return ics;
}

function loadFollowUps(): FollowUp[] {
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

function saveFollowUps(list: FollowUp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function FollowUpsFeature({ clients, onOpenClient }: Props) {
  const todayISO = toISODate(new Date());

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedISO, setSelectedISO] = useState<string>(todayISO);
  const [items, setItems] = useState<FollowUp[]>(() => loadFollowUps());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    saveFollowUps(items);
  }, [items]);

  // Future: follow-ups will be created from an estimate action. For Phase 1 we provide a tiny "demo add" for testing.
  const canDemoAdd = items.length === 0;

  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, FollowUp[]>();
    for (const fu of items) {
      const key = fu.dueDateISO;
      const arr = map.get(key) ?? [];
      arr.push(fu);
      map.set(key, arr);
    }
    // keep stable ordering: newest first
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => b.id.localeCompare(a.id));
      map.set(k, arr);
    }
    return map;
  }, [items]);

  const dayItems = itemsByDay.get(selectedISO) ?? [];

  useEffect(() => {
    // When changing day, default selection to first item (if any)
    setSelectedId((prev) => {
      if (prev && dayItems.some((x) => x.id === prev)) return prev;
      return dayItems[0]?.id ?? null;
    });
  }, [selectedISO, dayItems]);

  const selectedFollowUp = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const previousForClient = useMemo(() => {
    if (!selectedFollowUp) return [] as FollowUp[];
    return items
      .filter((x) => x.clientId === selectedFollowUp.clientId)
      .slice()
      .sort((a, b) => (a.dueDateISO < b.dueDateISO ? 1 : -1));
  }, [items, selectedFollowUp]);

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function demoAdd() {
    const c = clients[0];
    if (!c) return;

    const due = toISODate(addDays(new Date(), 7));
    const estimate = (c.estimates ?? [])[0] as any;

    const fu: FollowUp = {
      id: uid(),
      clientId: c.id,
      clientName: c.clientName ?? "Client",
      clientRef: (c as any).clientRef,
      estimateId: estimate?.id,
      estimateRef: estimate?.estimateRef,
      dueDateISO: due,
      title: `Follow up: ${c.clientName ?? "Client"}`,
      notes: "Demo follow-up (Phase 1).",
    };

    setItems((prev) => [fu, ...prev]);
    setSelectedISO(due);
    setMonth(startOfMonth(new Date(due + "T00:00:00")));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 520 }}>
      {/* Left: Calendar */}
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
            {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={prevMonth}
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                background: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ‹
            </button>
            <button
              onClick={nextMonth}
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                background: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ›
            </button>
          </div>
        </div>

        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} style={{ fontSize: 12, fontWeight: 900, color: "#6b7280", textAlign: "center" }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {monthDays.map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === month.getMonth();
              const isSelected = iso === selectedISO;
              const hasItems = (itemsByDay.get(iso)?.length ?? 0) > 0;
              const isToday = iso === todayISO;

              return (
                <button
                  key={iso}
                  onClick={() => setSelectedISO(iso)}
                  style={{
                    height: 40,
                    borderRadius: 12,
                    border: isSelected ? "2px solid #16a34a" : "1px solid #e4e4e7",
                    background: "#fff",
                    color: inMonth ? "#111827" : "#9ca3af",
                    fontWeight: 900,
                    cursor: "pointer",
                    position: "relative",
                    outline: "none",
                    boxShadow: "none",
                    opacity: inMonth ? 1 : 0.7,
                  }}
                  title={iso}
                >
                  {d.getDate()}
                  {hasItems && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 6,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "#16a34a",
                      }}
                    />
                  )}
                  {isToday && (
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "#111827",
                        opacity: 0.25,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Phase 1 uses <b>.ics export</b> so Outlook/Google can create reminders & pop-up notifications.
          </div>

          {canDemoAdd && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={demoAdd}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Add demo follow-up (Phase 1)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: List */}
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Follow Ups</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {selectedISO} • {dayItems.length} item{dayItems.length === 1 ? "" : "s"}
          </div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {dayItems.length === 0 && (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
              No follow-ups for this day yet. <br />
              In the next step we’ll add an “Add follow-up” button inside Estimates that schedules these automatically.
            </div>
          )}

          {dayItems.map((fu) => (
            <div key={fu.id} onClick={() => setSelectedId(fu.id)} style={{ border: selectedId === fu.id ? "2px solid #16a34a" : "1px solid #e4e4e7", borderRadius: 14, padding: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{fu.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {fu.clientRef ? <b>{fu.clientRef}</b> : null} {fu.clientRef ? "• " : ""}
                    {fu.clientName}
                    {fu.estimateRef ? ` • ${fu.estimateRef}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {onOpenClient && (
                    <button
                      onClick={() => onOpenClient(fu.clientId)}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid #e4e4e7",
                        background: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const ics = buildICS(fu);
                      downloadTextFile(`FollowUp_${fu.clientRef ?? fu.clientName}_${fu.dueDateISO}.ics`, ics, "text/calendar");
                    }}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Export .ics
                  </button>

                  <button
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== fu.id))}
                    style={{
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {fu.notes && <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>{fu.notes}</div>}
            </div>
          ))}

          {/* Details pane */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>Details</div>

            {!selectedFollowUp && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Select a follow-up to see details.</div>}

            {selectedFollowUp && (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <b>Client:</b> {selectedFollowUp.clientName} {selectedFollowUp.clientRef ? `• ${selectedFollowUp.clientRef}` : ""}
                  <br />
                  <b>Estimate:</b> {selectedFollowUp.estimateRef ?? "(linked)"} <br />
                  <b>Due:</b> {selectedFollowUp.dueDateISO}
                </div>

                {selectedFollowUp.notes && <div style={{ fontSize: 13, color: "#374151" }}><b>Follow up:</b> {selectedFollowUp.notes}</div>}

                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Last client note / cost overview will be shown here next (Phase 2 of Follow Ups).
                </div>

                {previousForClient.length > 0 && (
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    <b>Previous follow ups:</b>
                    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                      {previousForClient.slice(0, 5).map((x) => (
                        <div key={x.id} style={{ fontSize: 12, color: "#6b7280" }}>
                          {x.dueDateISO} • {x.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {onOpenClient && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onOpenClient(selectedFollowUp.clientId)}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid #e4e4e7",
                        background: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Open client
                    </button>

                    <button
                      onClick={() => {
                        const ics = buildICS(selectedFollowUp);
                        downloadTextFile(
                          `FollowUp_${selectedFollowUp.clientRef ?? selectedFollowUp.clientName}_${selectedFollowUp.dueDateISO}.ics`,
                          ics,
                          "text/calendar"
                        );
                      }}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid #e4e4e7",
                        background: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Export .ics
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}


'@
Set-Content -Path $fuPath -Value $fu -Encoding UTF8
Ok ("Wrote " + $fuRel)

Write-Host ""
Write-Host "DONE. Refresh the browser (dev server not restarted)." -ForegroundColor Cyan
Write-Host "Backup: $backupDir" -ForegroundColor Cyan
