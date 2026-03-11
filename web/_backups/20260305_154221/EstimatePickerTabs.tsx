// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React, { useEffect, useRef, useState } from "react";
import type { Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";

function stripBidiControls(html: string): string {
  // Remove Unicode bidi control characters that can cause "backwards" text.
  return (html ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}


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
        direction: "ltr",
        unicodeBidi: "plaintext",
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

  const clientNotesEditorRef = useRef<HTMLDivElement | null>(null);

  // When Client Notes tab opens (or draft is cleared), set editor HTML once (avoid controlled contentEditable issues).
  useEffect(() => {
    if (estimatePickerTab !== "client_notes") return;
    const el = clientNotesEditorRef.current;
    if (!el) return;
    const desired = (clientNoteDraftHtml ?? "");
    if (el.innerHTML !== desired) el.innerHTML = desired;
  }, [estimatePickerTab, pickerClient?.id, clientNoteDraftHtml]);

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

            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
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
                          <span style={{ fontWeight: 900 }}>{outcome}</span>
                          <span style={{ fontWeight: 900, lineHeight: 1, transform: "translateY(-1px)" }}>▾</span>
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

    <div`r`n      ref={clientNotesEditorRef}`r`n      dir="ltr"`r`n      contentEditable
      suppressContentEditableWarning
      onInput={(e) => setClientNoteDraftHtml(stripBidiControls((e.currentTarget as HTMLDivElement).innerHTML))}
      
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
          const htmlRaw = (clientNoteDraftHtml ?? "").trim();
          const html = stripBidiControls(htmlRaw);
if (!html) return;
          const createdAt = new Date().toISOString();
          const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;
          setClientNotes((prev) => [{ id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: activeUserName }, ...prev]);
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














