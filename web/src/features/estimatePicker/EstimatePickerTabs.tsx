// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React, { useState } from "react";
import { resolveStructuredAddress, addressTuple } from "../../domain/address";
import { rankInstallersByDistance } from "../../services/distance";
import { getInstallers } from "../../data/installers";
import { loadSettings } from "../../system/settings";
import { createDefaultTimeline } from "../../system/orderTimeline";
import type { Address, Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientFile } from "../../models/types";
import { estimateTotals, estimateCostTotal } from '../../domain/estimates/estimateCalculations';
import { addFollowUpForEstimate as addFollowUpForEstimateService } from '../../services/followups/followupService';
import { buildSendEmailText as buildSendEmailTextService, openMailClient as openMailClientService } from '../../services/email/emailService';
import { printEstimatePdf as printEstimatePdfService, downloadEstimateWordDoc as downloadEstimateWordDocService } from '../../services/documents/estimateDocumentService';
import ClientInfoTab from './tabs/ClientInfoTab';
import NotesTab from './tabs/NotesTab';
import FilesTab from './tabs/FilesTab';
import EstimateSectionTab from './tabs/EstimateSectionTab';
import './tabs/shared.css';

type Props = {
  estimatePickerTab: EstimatePickerTab;
  setEstimatePickerTab: (t: EstimatePickerTab) => void;

  pickerClient: Client | null;
  openEditClientPanel: (c: Client) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;
  copyEstimateForClient: (client: Client, sourceEstimateId: EstimateId) => void;
  deletedEstimatesForClient: { estimate: Client["estimates"][number]; deletedAt: string }[];
  deleteEstimatesForClient: (clientId: string, estimateIds: EstimateId[]) => void;
  restoreDeletedEstimatesForClient: (clientId: string, estimateIds: EstimateId[]) => void;
  purgeDeletedEstimatesForClient: (clientId: string, estimateIds?: EstimateId[]) => void;
  setEstimateInstaller: (clientId: string, estimateId: string, installerId: string) => void;
  updateEstimateOrderMeta: (clientId: string, estimateId: string, patch: Record<string, any>) => void;
  persistEstimateOutcome: (clientId: string, estimateId: EstimateId, outcome: EstimateOutcome) => void;

  accountNoteDraft: string;
  setAccountNoteDraft: (value: string) => void;
  accountNotes: Array<{
    id: string;
    category: "general" | "follow_up" | "service" | "installer" | "client_request";
    noteText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string | null;
  }>;
  accountNoteCategory: "general" | "follow_up" | "service" | "installer" | "client_request";
  setAccountNoteCategory: React.Dispatch<React.SetStateAction<"general" | "follow_up" | "service" | "installer" | "client_request">>;
  accountNoteFilter: "all" | "general" | "follow_up" | "service" | "installer" | "client_request";
  setAccountNoteFilter: React.Dispatch<React.SetStateAction<"all" | "general" | "follow_up" | "service" | "installer" | "client_request">>;
  accountNoteUpdatedAt: string | null;
  saveAccountNotes: () => void | Promise<void>;

  selectedEstimateNoteId: EstimateId | "";
  setSelectedEstimateNoteId: React.Dispatch<React.SetStateAction<EstimateId | "">>;
  estimateNoteDraft: string;
  setEstimateNoteDraft: (value: string) => void;
  estimateNotes: Array<{
    id: string;
    category: "general" | "follow_up" | "service" | "installer" | "client_request";
    noteText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string | null;
  }>;
  estimateNoteCategory: "general" | "follow_up" | "service" | "installer" | "client_request";
  setEstimateNoteCategory: React.Dispatch<React.SetStateAction<"general" | "follow_up" | "service" | "installer" | "client_request">>;
  estimateNoteFilter: "all" | "general" | "follow_up" | "service" | "installer" | "client_request";
  setEstimateNoteFilter: React.Dispatch<React.SetStateAction<"all" | "general" | "follow_up" | "service" | "installer" | "client_request">>;
  estimateNoteUpdatedAt: string | null;
  saveEstimateNotes: () => void | Promise<void>;

  notesSaving: boolean;
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

function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, color: "#71717a", ...(style || {}) }}>{children}</div>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
}

function noteCategoryLabel(category: "general" | "follow_up" | "service" | "installer" | "client_request") {
  if (category === "follow_up") return "Follow Up";
  if (category === "client_request") return "Client Request";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function noteCategoryPillStyle(category: "general" | "follow_up" | "service" | "installer" | "client_request"): React.CSSProperties {
  if (category === "follow_up") return { background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" };
  if (category === "service") return { background: "#ecfeff", color: "#155e75", border: "1px solid #a5f3fc" };
  if (category === "installer") return { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" };
  if (category === "client_request") return { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
  return { background: "#f4f4f5", color: "#18181b", border: "1px solid #e4e4e7" };
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
  marginBottom: 6,
};

function qsOutcomeStyle(outcome: string): React.CSSProperties {
  const o = (outcome || "").toLowerCase();
  if (o === "order") return { background: "#22c55e", color: "#000", fontWeight: 800, border: "1px solid #22c55e" };
  if (o === "lost") return { background: "#ef4444", color: "#fff", fontWeight: 800, border: "1px solid #ef4444" };
  return { background: "#f59e0b", color: "#000", fontWeight: 800, border: "1px solid #f59e0b" };
}

function ensureOrderMeta(e: any) {
  if (!e.orderMeta) {
    e.orderMeta = {
      timeline: createDefaultTimeline(),
    };
  }
}

function stageLabel(stage: string) {
  if (stage === "signoff_sent") return "Sign-off sent";
  if (stage === "signoff_received") return "Sign-off received";
  if (stage === "factory_order") return "Factory order";
  if (stage === "in_production") return "Production start";
  if (stage === "pre_dispatch_invoice") return "Balance due";
  if (stage === "production_complete") return "Production complete";
  if (stage === "factory_dispatch") return "Dispatch";
  if (stage === "delivery") return "Delivery";
  if (stage === "installation") return "Installation";
  return stage;
}

function OrderTimelineBar({ timeline }: { timeline: any[] }) {
  const completedCount = timeline.filter((t) => t.completed).length;
  const percent = timeline.length ? Math.round((completedCount / timeline.length) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>Order timeline</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>{completedCount}/{timeline.length} complete ({percent}%)</div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#e4e4e7", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: "#22c55e" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {timeline.map((t, i) => (
          <div key={i} style={{ borderRadius: 10, border: "1px solid #e4e4e7", padding: 8, background: t.completed ? "#f0fdf4" : "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.completed ? "#166534" : "#52525b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {t.completed ? "Complete" : "Pending"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#18181b", marginTop: 4 }}>{stageLabel(t.stage)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function ClientDetailsReadonly({ c, onEdit }: { c: Client; onEdit: () => void }) {
  const [customerAddressOpen, setCustomerAddressOpen] = useState(false);
  const [invoiceAddressOpen, setInvoiceAddressOpen] = useState(false);

  const customerStructured = resolveStructuredAddress((c as any).customerAddressStructured, (c as any).customerAddress || "");
  const [ca1, ca2, ca3, ct, cc, cco, cp] = addressTuple(customerStructured);

  const invoiceStructured = resolveStructuredAddress(c.invoiceAddressStructured, c.invoiceAddress || "");
  const [i1, i2, i3, it, ic, ico, ip] = addressTuple(invoiceStructured);

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
          <button
            type="button"
            onClick={() => setCustomerAddressOpen((prev) => !prev)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "inherit",
              color: "#18181b",
            }}
          >
            <H3>{customerAddressOpen ? "▼" : "▶"} Customer address</H3>
          </button>

          {customerAddressOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Address line 1</div>
                  <Input value={ca1} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Address line 2</div>
                  <Input value={ca2} onChange={() => {}} disabled />
                </div>
              </div>

              <div>
                <div style={labelStyle}>Address line 3</div>
                <Input value={ca3} onChange={() => {}} disabled />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Town</div>
                  <Input value={ct} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>City</div>
                  <Input value={cc} onChange={() => {}} disabled />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={labelStyle}>County/District</div>
                  <Input value={cco} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Postcode</div>
                  <Input value={cp} onChange={() => {}} disabled />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setInvoiceAddressOpen((prev) => !prev)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "inherit",
              color: "#18181b",
            }}
          >
            <H3>{invoiceAddressOpen ? "▼" : "▶"} Invoice address</H3>
          </button>

          {invoiceAddressOpen && (
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
                  <div style={labelStyle}>County/District</div>
                  <Input value={ico} onChange={() => {}} disabled />
                </div>
                <div>
                  <div style={labelStyle}>Postcode</div>
                  <Input value={ip} onChange={() => {}} disabled />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EstimatePickerTabs(props: Props) {
  const [statusMenuForEstimateId, setStatusMenuForEstimateId] = React.useState<string | null>(null);
  const [selectedOrderForInstallations, setSelectedOrderForInstallations] = useState<string | null>(null);
  const [rankedInstallers, setRankedInstallers] = useState<any[]>([]);
  const [selectedInstallerByEstimateId, setSelectedInstallerByEstimateId] = useState<Record<string, string>>({});

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
    copyEstimateForClient,
    deletedEstimatesForClient,
    deleteEstimatesForClient,
    restoreDeletedEstimatesForClient,
    purgeDeletedEstimatesForClient,
    setEstimateInstaller,
    updateEstimateOrderMeta,
    persistEstimateOutcome,
    accountNoteDraft,
    setAccountNoteDraft,
    accountNotes,
    accountNoteCategory,
    setAccountNoteCategory,
    accountNoteFilter,
    setAccountNoteFilter,
    accountNoteUpdatedAt,
    saveAccountNotes,
    selectedEstimateNoteId,
    setSelectedEstimateNoteId,
    estimateNoteDraft,
    setEstimateNoteDraft,
    estimateNotes,
    estimateNoteCategory,
    setEstimateNoteCategory,
    estimateNoteFilter,
    setEstimateNoteFilter,
    estimateNoteUpdatedAt,
    saveEstimateNotes,
    notesSaving,
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
  const [sendModalAddFollowUp, setSendModalAddFollowUp] = useState(true);
  const [sendModalFollowUpDays, setSendModalFollowUpDays] = useState(3);
  const [sendModalPhoneCall, setSendModalPhoneCall] = useState(true);
  const [expandedEstimateId, setExpandedEstimateId] = useState<EstimateId | null>(null);
  const [itemPriceByPositionId, setItemPriceByPositionId] = useState<Record<string, string>>({});
  const [supplierEstimateFilesByEstimateId, setSupplierEstimateFilesByEstimateId] = useState<Record<string, string[]>>({});
  const [notesScope, setNotesScope] = useState<"account" | "estimate">("account");

  const QS_FOLLOWUPS_KEY = "qs_followups_v1";

  if (!pickerClient) return null;

  async function apiFetchJson(path: string, options?: RequestInit) {
    const res = await fetch(`http://localhost:3001${path}`, options);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(body || `API request failed: ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  function formatMeasure(n: number) {
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number.isFinite(n) ? n : 0);
}

      function getFilteredEstimates(outcome: EstimateOutcome) {
    return pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === outcome);
  }

  function sectionCombinedTotals(outcome: EstimateOutcome) {
    const estimates = getFilteredEstimates(outcome);
    if (outcome === "Order") {
      estimates.forEach((e) => ensureOrderMeta(e));
    }
    return estimates.reduce(
      (acc, e) => {
        const totals = estimateTotals(e);
        acc.totalSquareMetres += totals.totalSquareMetres;
        acc.totalLinearMetres += totals.totalLinearMetres;
        acc.totalQty += totals.totalQty;
        acc.totalCost += estimateCostTotal(e, itemPriceByPositionId);
        return acc;
      },
      { totalSquareMetres: 0, totalLinearMetres: 0, totalQty: 0, totalCost: 0 }
    );
  }

  async function openInstallations(e: any, pickerClient: any) {
    setSelectedOrderForInstallations(e.id);

    const settings = loadSettings();
    const installers = getInstallers();

    const projectAddressText = String(e.projectAddress || "");
    const postcodeMatch = projectAddressText.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    const sitePostcode = String(e.postcode || (postcodeMatch ? postcodeMatch[0] : ""));

    const provider = settings.mapsProvider === "none" ? "manual" : settings.mapsProvider;
    const apiKey =
      settings.mapsProvider === "google"
        ? settings.googleMapsApiKey
        : settings.mapsProvider === "azure"
        ? settings.azureMapsApiKey
        : "";

    const results = await rankInstallersByDistance({
      sitePostcode,
      installers,
      provider,
      apiKey,
    });

    setRankedInstallers(results);
  }

  function installerLabel(installerId: string) {
    const installer = getInstallers().find((x) => x.id === installerId);
    return installer?.companyName ?? installerId;
  }

  function selectInstallerForEstimate(estimateId: string, installerId: string) {
    setSelectedInstallerByEstimateId((prev) => {
      const next = { ...prev, [estimateId]: installerId };
      return next;
    });
    setEstimateInstaller(pickerClient.id, estimateId, installerId);
  }

  function setOrderMetaField(estimateId: string, key: string, value: any) {
    updateEstimateOrderMeta(pickerClient.id, estimateId, { [key]: value });
  }

  function stageDateValue(e: any, stage: string): string {
    const m = e.orderMeta ?? {};
    if (stage === "signoff_sent") return m.clientSignoffSentDate ?? "";
    if (stage === "signoff_received") return m.clientSignoffReceivedDate ?? "";
    if (stage === "factory_order") return m.factoryOrderSignedOffDate ?? "";
    if (stage === "in_production") return m.productionStartDate ?? "";
    if (stage === "pre_dispatch_invoice") return m.balanceInvoiceDueDate ?? "";
    if (stage === "production_complete") return m.productionCompletedDate ?? m.productionEndDate ?? "";
    if (stage === "factory_dispatch") return m.factoryDispatchDate ?? "";
    if (stage === "delivery") return m.deliveryDate ?? "";
    if (stage === "installation") return m.installationDate ?? "";
    return "";
  }

  function timelineWithCompletion(e: any) {
    const base = e.orderMeta?.timeline ?? [];
    return base.map((t: any) => ({
      ...t,
      completed: !!stageDateValue(e, t.stage),
    }));
  }

  function positionDescription(p: Client["estimates"][number]["positions"][number]) {
    return `${p.positionType} • ${p.insertion} • ${p.widthMm} × ${p.heightMm} mm`;
  }

  function PositionPreview({ position }: { position: Client["estimates"][number]["positions"][number] }) {
    return (
      <div style={{ width: 48, height: 54, borderRadius: 12, border: "1px solid #d4d4d8", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: position.positionType === "Door" ? 18 : 28, height: 38, borderRadius: 3, border: "2px solid #52525b", position: "relative", background: "#fff" }}>
          <div style={{ position: "absolute", inset: 4, border: "1px solid #a1a1aa", borderRadius: 2 }} />
        </div>
      </div>
    );
  }

  function estimateCostLine(e: Client["estimates"][number], p: Client["estimates"][number]["positions"][number]) {
    const raw = itemPriceByPositionId[p.id] ?? String(p.itemPrice ?? "");
    const itemPrice = Number(raw || 0);
    const quantityPrice = (Number.isFinite(itemPrice) ? itemPrice : 0) * Math.max(1, Number(p.qty || 1));
    return { itemPrice, quantityPrice };
  }

  function importSupplierEstimate(estimateId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp";
    input.onchange = () => {
      const names = Array.from(input.files ?? []).map((f) => f.name);
      if (!names.length) return;
      setSupplierEstimateFilesByEstimateId((prev) => ({
        ...prev,
        [estimateId]: [...(prev[estimateId] ?? []), ...names],
      }));
    };
    input.click();
  }

  function confirmDeleteEstimate(estimateId: EstimateId) {
    const estimate = pickerClient.estimates.find((x) => x.id === estimateId);
    if (!estimate) return;
    const ok = window.confirm(`Send estimate ${estimate.estimateRef} to recycle bin?`);
    if (!ok) return;
    if (expandedEstimateId === estimateId) {
      setExpandedEstimateId(null);
    }
    deleteEstimatesForClient(pickerClient.id, [estimateId]);
  }

  function renderEstimateSection(outcome: EstimateOutcome, titleText: string, emptyText: string) {
    const estimates = getFilteredEstimates(outcome);
    if (outcome === "Order") {
      estimates.forEach((e) => ensureOrderMeta(e));
    }
    const sectionTotals = sectionCombinedTotals(outcome);

    return (
      <EstimateSectionTab
        titleText={titleText}
        emptyText={emptyText}
        estimates={estimates}
        outcome={outcome}
        sectionTotals={sectionTotals}
        expandedEstimateId={expandedEstimateId}
        setExpandedEstimateId={setExpandedEstimateId}
        statusMenuForEstimateId={statusMenuForEstimateId}
        setStatusMenuForEstimateId={setStatusMenuForEstimateId}
        selectedOrderForInstallations={selectedOrderForInstallations}
        rankedInstallers={rankedInstallers}
        selectedInstallerByEstimateId={selectedInstallerByEstimateId}
        supplierEstimateFilesByEstimateId={supplierEstimateFilesByEstimateId}
        itemPriceByPositionId={itemPriceByPositionId}
        setItemPriceByPositionId={setItemPriceByPositionId}
        formatMeasure={formatMeasure}
        formatMoney={formatMoney}
        pickerClient={pickerClient}
        activeUserName={activeUserName}
        apiFetchJson={apiFetchJson}
        copyEstimateForClient={copyEstimateForClient}
        confirmDeleteEstimate={confirmDeleteEstimate}
        openEstimateFromPicker={openEstimateFromPicker}
        persistEstimateOutcome={persistEstimateOutcome}
        downloadEstimateWordDocService={downloadEstimateWordDocService}
        printEstimatePdfService={printEstimatePdfService}
        addFollowUpForEstimateService={addFollowUpForEstimateService}
        positionDescription={positionDescription}
        PositionPreview={PositionPreview}
        timelineWithCompletion={timelineWithCompletion}
        openInstallations={openInstallations}
        installerLabel={installerLabel}
        selectInstallerForEstimate={selectInstallerForEstimate}
        setOrderMetaField={setOrderMetaField}
        setSendModalEstimateId={setSendModalEstimateId}
        setSendModalOpen={setSendModalOpen}
        importSupplierEstimate={importSupplierEstimate}
      />
    );
  }

  const totalClientEstimateCount = pickerClient.estimates.length;
  const clientOrderCount = pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === "Order").length;
  const clientLostCount = pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === "Lost").length;
  const orderConversionPct = totalClientEstimateCount ? Math.round((clientOrderCount / totalClientEstimateCount) * 100) : 0;
  const lostConversionPct = totalClientEstimateCount ? Math.round((clientLostCount / totalClientEstimateCount) * 100) : 0;

  const sendEmailDraft = sendModalEstimateId ? buildSendEmailTextService({ pickerClient, estimateId: sendModalEstimateId }) : { subject: "", body: "" };

  const filteredAccountNotes = (accountNotes ?? []).filter((note) => accountNoteFilter === "all" || note.category === accountNoteFilter);
  const filteredEstimateNotes = (estimateNotes ?? []).filter((note) => estimateNoteFilter === "all" || note.category === estimateNoteFilter);
  const isEstimateNotesScope = notesScope === "estimate";
  const activeNoteCategory = isEstimateNotesScope ? estimateNoteCategory : accountNoteCategory;
  const activeNoteFilter = isEstimateNotesScope ? estimateNoteFilter : accountNoteFilter;
  const activeNoteDraft = isEstimateNotesScope ? estimateNoteDraft : accountNoteDraft;
  const activeNoteUpdatedAt = isEstimateNotesScope ? estimateNoteUpdatedAt : accountNoteUpdatedAt;
  const activeFilteredNotes = isEstimateNotesScope ? filteredEstimateNotes : filteredAccountNotes;

  return (
    <>
      <div className="ep-tab-list">
        <Button variant={estimatePickerTab === "client_info" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_info")}>
          Client Info
        </Button>
        <Button variant={estimatePickerTab === "estimates" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("estimates")}>
          Client Estimates
        </Button>
        <Button variant={estimatePickerTab === "orders" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("orders")}>
          Client Orders
        </Button>
        <Button variant={estimatePickerTab === "lost" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("lost")}>
          Client Lost
        </Button>
        <Button variant={estimatePickerTab === "client_notes" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_notes")}>
          Client Notes
        </Button>
        <Button variant={estimatePickerTab === "files" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("files")}>
          Files
        </Button>
      </div>

      <div className="ep-stats-grid">
        <div className="ep-stat-card">
          <div className="ep-stat-label">Client Estimates</div>
          <div className="ep-stat-value">{totalClientEstimateCount}</div>
          <Small>Total estimates created for this client.</Small>
        </div>
        <div className="ep-stat-card">
          <div className="ep-stat-label">Orders Conversion</div>
          <div className="ep-stat-value">{orderConversionPct}%</div>
          <Small>{clientOrderCount} of {totalClientEstimateCount} marked as Order.</Small>
        </div>
        <div className="ep-stat-card">
          <div className="ep-stat-label">Lost Conversion</div>
          <div className="ep-stat-value">{lostConversionPct}%</div>
          <Small>{clientLostCount} of {totalClientEstimateCount} marked as Lost.</Small>
        </div>
      </div>

      {estimatePickerTab === "client_info" && (
        <ClientInfoTab
          pickerClient={pickerClient}
          openEditClientPanel={openEditClientPanel}
          confirmDeleteEstimate={confirmDeleteEstimate}
          openEstimateFromPicker={openEstimateFromPicker}
        />
      )}

      {estimatePickerTab === "estimates" && renderEstimateSection("Open", "Client Estimates", "No open estimates yet.")}
      {estimatePickerTab === "orders" && renderEstimateSection("Order", "Client Orders", "No orders yet. Mark an estimate as \"Order\" in the Client Estimates tab.")}
      {estimatePickerTab === "lost" && renderEstimateSection("Lost", "Client Lost", "No lost estimates yet. Mark an estimate as \"Lost\" in the Client Estimates tab.")}

      {estimatePickerTab === "client_notes" && (
        <NotesTab
          pickerClient={pickerClient}
          notesScope={notesScope}
          setNotesScope={setNotesScope}
          accountNotes={accountNotes}
          accountNoteFilter={accountNoteFilter}
          setAccountNoteFilter={setAccountNoteFilter}
          accountNoteCategory={accountNoteCategory}
          setAccountNoteCategory={setAccountNoteCategory}
          accountNoteDraft={accountNoteDraft}
          setAccountNoteDraft={setAccountNoteDraft}
          accountNoteUpdatedAt={accountNoteUpdatedAt}
          selectedEstimateNoteId={selectedEstimateNoteId}
          setSelectedEstimateNoteId={setSelectedEstimateNoteId}
          estimateNotes={estimateNotes}
          estimateNoteFilter={estimateNoteFilter}
          setEstimateNoteFilter={setEstimateNoteFilter}
          estimateNoteCategory={estimateNoteCategory}
          setEstimateNoteCategory={setEstimateNoteCategory}
          estimateNoteDraft={estimateNoteDraft}
          setEstimateNoteDraft={setEstimateNoteDraft}
          estimateNoteUpdatedAt={estimateNoteUpdatedAt}
          notesSaving={notesSaving}
          saveAccountNotes={saveAccountNotes}
          saveEstimateNotes={saveEstimateNotes}
        />
      )}

      {estimatePickerTab === "files" && (
        <FilesTab
          clientFileLabel={clientFileLabel}
          setClientFileLabel={setClientFileLabel}
          clientFileUrl={clientFileUrl}
          setClientFileUrl={setClientFileUrl}
          clientFileNames={clientFileNames}
          setClientFileNames={setClientFileNames}
          clientFiles={clientFiles}
          setClientFiles={setClientFiles}
          activeUserName={activeUserName}
        />
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
          <div className="ep-send-modal-card">
            <div className="ep-send-modal-header">
              <div>
                <div className="ep-send-modal-title">Send estimate</div>
                <div className="ep-send-modal-meta">
                  {pickerClient.clientName} • {(pickerClient as any).clientRef ?? ""} •{" "}
                  {pickerClient.estimates.find((x) => x.id === sendModalEstimateId)?.estimateRef ?? ""}
                </div>
              </div>

              <div className="ep-send-modal-close">
                <Button variant="outline" onClick={() => setSendModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="ep-send-modal-body">
              <div className="ep-send-section">
                <div className="ep-send-section-title">Send email</div>

                <div className="ep-send-stack">
                  <div className="ep-send-field">
                    <Small>Subject</Small>
                    <input
                      className="ep-send-input"
                      value={sendEmailDraft.subject}
                      readOnly
                    />
                  </div>

                  <div className="ep-send-field">
                    <Small>Body</Small>
                    <textarea
                      className="ep-send-textarea"
                      value={sendEmailDraft.body}
                      readOnly
                      rows={8}
                    />
                  </div>

                  <div className="ep-send-inline-actions">
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

                    <Button variant="secondary" onClick={() => printEstimatePdfService({ pickerClient, e: pickerClient.estimates.find((x) => x.id === sendModalEstimateId)!, itemPriceByPositionId, formatMeasure, formatMoney, positionDescription, alertFn: alert })}>
                      Generate PDF
                    </Button>

                    <Button variant="primary" onClick={() => openMailClientService((pickerClient as any)?.email ?? "", sendEmailDraft.subject, sendEmailDraft.body)}>
                      Open email app
                    </Button>
                  </div>

                  <Small style={{ color: "#6b7280" }}>
                    Use “Print PDF” to generate the customer-facing estimate PDF, then attach that PDF in your email app. Direct file attachment from the browser send flow is not wired yet.
                  </Small>
                </div>
              </div>

              <div className="ep-send-section">
                <div className="ep-send-section-title">Add follow up</div>

                <div className="ep-send-stack" style={{ gap: 10 }}>
                  <label className="ep-send-checkbox">
                    <input type="checkbox" checked={sendModalAddFollowUp} onChange={(e) => setSendModalAddFollowUp(e.currentTarget.checked)} />
                    <span className="ep-send-checkbox-text">
                      Create follow-up (default {sendModalFollowUpDays} days / 72 hours)
                    </span>
                  </label>

                  <div className="ep-send-inline-row">
                    <Small>Follow up in (days)</Small>
                    <input
                      className="ep-send-input ep-send-input--days"
                      type="number"
                      min={0}
                      value={sendModalFollowUpDays}
                      onChange={(e) => setSendModalFollowUpDays(Math.max(0, Number(e.currentTarget.value || 0)))}
                    />

                    <label className="ep-send-checkbox">
                      <input type="checkbox" checked={sendModalPhoneCall} onChange={(e) => setSendModalPhoneCall(e.currentTarget.checked)} />
                      <span className="ep-send-checkbox-text">Telephone call</span>
                    </label>
                  </div>

                  <Small style={{ color: "#6b7280" }}>
                    Follow-ups are saved to the database and appear in Customers - Follow Ups on the scheduled due date.
                  </Small>
                </div>
              </div>

              <div className="ep-send-footer">
                <Button variant="outline" onClick={() => setSendModalOpen(false)}>
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    printEstimatePdfService({ pickerClient, e: pickerClient.estimates.find((x) => x.id === sendModalEstimateId)!, itemPriceByPositionId, formatMeasure, formatMoney, positionDescription, alertFn: alert });
                    openMailClientService((pickerClient as any)?.email ?? "", sendEmailDraft.subject, sendEmailDraft.body);
                    if (sendModalAddFollowUp) {
                      addFollowUpForEstimateService({ pickerClient, estimateId: sendModalEstimateId, opts: {
                        days: sendModalFollowUpDays,
                        sendEmail: true,
                        needsCall: sendModalPhoneCall,
                      }, apiFetchJson, activeUserName, alertFn: alert, logError: console.error });
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


