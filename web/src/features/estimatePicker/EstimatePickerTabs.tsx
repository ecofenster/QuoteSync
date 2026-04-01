// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React, { useState } from "react";
import { rankInstallersByDistance } from "../../services/distance";
import { getInstallers } from "../../data/installers";
import { loadSettings } from "../../system/settings";
import { createDefaultTimeline } from "../../system/orderTimeline";
import type { Address, Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import ProjectCalculatorWizard from "../../project calculator/ProjectCalculatorWizard";

type Props = {
  estimatePickerTab: EstimatePickerTab;
  setEstimatePickerTab: (t: EstimatePickerTab) => void;

  pickerClient: Client | null;
  openEditClientPanel: (c: Client) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;
  copyEstimateForClient: (client: Client, sourceEstimateId: EstimateId) => void;
  setEstimateInstaller: (clientId: string, estimateId: string, installerId: string) => void;
  updateEstimateOrderMeta: (clientId: string, estimateId: string, patch: Record<string, any>) => void;
  persistEstimateOutcome: (clientId: string, estimateId: EstimateId, outcome: EstimateOutcome) => void;

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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
  marginBottom: 6,
};

function emptyAddress(): Address {
  return {
    line1: "",
    line2: "",
    line3: "",
    town: "",
    city: "",
    county: "",
    postcode: "",
  };
}

function parseAddressString(value: string): Address {
  const parts = (value || "").split(/\r?\n/).map((s) => (s || "").trim());
  while (parts.length < 7) parts.push("");
  return {
    line1: parts[0] || "",
    line2: parts[1] || "",
    line3: parts[2] || "",
    town: parts[3] || "",
    city: parts[4] || "",
    county: parts[5] || "",
    postcode: parts[6] || "",
  };
}

function buildAddressString(address: Address | undefined) {
  const safe = address ?? emptyAddress();
  return [
    safe.line1,
    safe.line2,
    safe.line3,
    safe.town,
    safe.city,
    safe.county,
    safe.postcode,
  ]
    .map((s) => (s || "").trim())
    .join("\n");
}

function resolveStructuredAddress(address: Address | undefined, fallbackString: string) {
  return address ? { ...emptyAddress(), ...address } : parseAddressString(fallbackString || "");
}

function addressTuple(address: Address): [string, string, string, string, string, string, string] {
  return [
    address.line1 || "",
    address.line2 || "",
    address.line3 || "",
    address.town || "",
    address.city || "",
    address.county || "",
    address.postcode || "",
  ];
}

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

  React.useEffect(() => {
    setSelectedInstallerByEstimateId(loadSelectedInstallerMapSafe());
  }, []);

  const {
    estimatePickerTab,
    setEstimatePickerTab,
    pickerClient,
    openEditClientPanel,
    openEstimateFromPicker,
    copyEstimateForClient,
    setEstimateInstaller,
    updateEstimateOrderMeta,
	persistEstimateOutcome,
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
  const [sendModalAddFollowUp, setSendModalAddFollowUp] = useState(true);
  const [sendModalFollowUpDays, setSendModalFollowUpDays] = useState(3);
  const [sendModalPhoneCall, setSendModalPhoneCall] = useState(true);
  const [expandedEstimateId, setExpandedEstimateId] = useState<EstimateId | null>(null);
  const [itemPriceByPositionId, setItemPriceByPositionId] = useState<Record<string, string>>({});
  const [projectCalculatorEstimateId, setProjectCalculatorEstimateId] = useState<string | null>(null);
  const [supplierEstimateFilesByEstimateId, setSupplierEstimateFilesByEstimateId] = useState<Record<string, string[]>>({});

  const QS_FOLLOWUPS_KEY = "qs_followups_v1";
  const QS_ORDER_INSTALLER_KEY = "qs_order_installer_selection_v1";

  function loadSelectedInstallerMapSafe(): Record<string, string> {
    try {
      const raw = localStorage.getItem(QS_ORDER_INSTALLER_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
    } catch {
      return {};
    }
  }

  function saveSelectedInstallerMapSafe(map: Record<string, string>) {
    try {
      localStorage.setItem(QS_ORDER_INSTALLER_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }


  if (!pickerClient) return null;

  function isoDatePlusDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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
      sendEmail: opts?.sendEmail ?? true,
      needsCall: opts?.needsCall ?? true,
    };

    const list = loadFollowUpsSafe();
    list.unshift(followUp);
    saveFollowUpsSafe(list);

    alert(`Follow-up added for ${dueDateISO}. Open Customers -> Follow Ups to export .ics if needed.`);
  }

  function buildSendEmailText(estimateId: string) {
    const e = pickerClient.estimates.find((x) => x.id === estimateId);
    const estimateRef = (e as any)?.estimateRef ?? "";
    const clientRef = (pickerClient as any)?.clientRef ?? "";
    const clientName = pickerClient.clientName ?? "Client";
    const itemsCount = e?.positions?.length ?? 0;

    const subject = `Your quotation ${clientRef || clientName}${estimateRef ? "" + estimateRef : ""}`.trim();

    const bodyLines = [
      `Dear ${clientName},`,
      ``,
      `Please find our quotation attached / linked below.`,
      ``,
      `Estimate: ${estimateRef || "(ref)"}  (${itemsCount} item${itemsCount === 1 ? "" : "s"})`,
      ``,
      `Summary (to be expanded):`,
      `Materials/finishes: (later)`,
      `Quantity: ${itemsCount}`,
      `Area (m²) and linear metres: (later)`,
      ``,
      `Kind regards,`,
      `Ecofenster Ltd`,
    ];

    return { subject, body: bodyLines.join("\n") };
  }

  function openMailClient(subject: string, body: string) {
    const to = (pickerClient as any)?.email ?? "";
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  function formatMeasure(n: number) {
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number.isFinite(n) ? n : 0);
}

  function estimateTotals(e: Client["estimates"][number]) {
    const positions = e.positions ?? [];
    const totalSquareMetres = positions.reduce(
      (sum, p) => sum + ((Number(p.widthMm || 0) * Number(p.heightMm || 0)) / 1000000) * Math.max(1, Number(p.qty || 1)),
      0
    );
    const totalLinearMetres = positions.reduce(
      (sum, p) => sum + (((2 * Number(p.widthMm || 0)) + (2 * Number(p.heightMm || 0))) / 1000) * Math.max(1, Number(p.qty || 1)),
      0
    );
    const totalQty = positions.reduce((sum, p) => sum + Math.max(1, Number(p.qty || 1)), 0);
    return { totalSquareMetres, totalLinearMetres, totalQty };
  }

  function estimateCostTotal(e: Client["estimates"][number]) {
    return (e.positions ?? []).reduce((sum, p) => {
      const raw = itemPriceByPositionId[p.id] ?? String(p.itemPrice ?? "");
      const value = Number(raw || 0);
      return sum + (Number.isFinite(value) ? value : 0) * Math.max(1, Number(p.qty || 1));
    }, 0);
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
        acc.totalCost += estimateCostTotal(e);
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
      saveSelectedInstallerMapSafe(next);
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

  function estimateDocumentTitle(e: Client["estimates"][number]) {
    return `Estimate ${e.estimateRef} - ${pickerClient.clientName}`;
  }

  function buildEstimateHtml(e: Client["estimates"][number]) {
    const totals = estimateTotals(e);
    const estimateCost = estimateCostTotal(e);
    const rows = (e.positions ?? []).map((p) => {
      const pricing = estimateCostLine(e, p);
      return `
        <tr>
          <td style="padding:8px;border:1px solid #d4d4d8;">${p.positionRef}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;">${p.roomName || ""}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;">${positionDescription(p)}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${p.qty}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${formatMoney(pricing.itemPrice)}</td>
          <td style="padding:8px;border:1px solid #d4d4d8;text-align:right;">${formatMoney(pricing.quantityPrice)}</td>
        </tr>
      `;
    }).join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${estimateDocumentTitle(e)}</title>
  <style>
    body { font-family: Arial, sans-serif; color:#18181b; padding:32px; }
    h1, h2, h3 { margin:0 0 8px 0; }
    .muted { color:#52525b; font-size:12px; }
    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin:16px 0 24px; }
    .card { border:1px solid #d4d4d8; border-radius:12px; padding:12px; background:#fafafa; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th { text-align:left; background:#f4f4f5; }
    th, td { font-size:12px; }
    .note { margin-top:20px; padding:12px; border:1px dashed #d4d4d8; border-radius:12px; background:#fff; }
    @media print { body { padding: 12mm; } .no-print { display:none; } }
  </style>
</head>
<body>
  <h1>${estimateDocumentTitle(e)}</h1>
  <div class="muted">Client: ${pickerClient.clientName} • Ref: ${(pickerClient as any).clientRef ?? ""} • Estimate: ${e.estimateRef}</div>
  <div class="muted">This draft uses the uploaded estimate template as the basis for future positioning/layout work.</div>

  <div class="grid">
    <div class="card"><div class="muted">Total m²</div><div><strong>${formatMeasure(totals.totalSquareMetres)}</strong></div></div>
    <div class="card"><div class="muted">Linear metreage</div><div><strong>${formatMeasure(totals.totalLinearMetres)}</strong></div></div>
    <div class="card"><div class="muted">Total quantity</div><div><strong>${totals.totalQty}</strong></div></div>
    <div class="card"><div class="muted">Estimate total</div><div><strong>${formatMoney(estimateCost)}</strong></div></div>
  </div>

  <h2>Positions</h2>
  <table>
    <thead>
      <tr>
        <th style="padding:8px;border:1px solid #d4d4d8;">Reference</th>
        <th style="padding:8px;border:1px solid #d4d4d8;">Room</th>
        <th style="padding:8px;border:1px solid #d4d4d8;">Description</th>
        <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Qty</th>
        <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Item price</th>
        <th style="padding:8px;border:1px solid #d4d4d8;text-align:right;">Quantity price</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="note">
    <strong>Template note:</strong> final Word/PDF content positioning will be aligned to the uploaded estimate template in the next stage.
  </div>
</body>
</html>`;
  }

  function openPrintWindow(html: string) {
    const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
    if (!win) {
      alert("Popup blocked. Please allow popups and try again.");
      return null;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return win;
  }

  function printEstimatePdf(e: Client["estimates"][number]) {
    const win = openPrintWindow(buildEstimateHtml(e));
    if (!win) return;
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  function downloadEstimateWordDoc(e: Client["estimates"][number]) {
    const html = buildEstimateHtml(e);
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${estimateDocumentTitle(e).replace(/[^a-z0-9-_]+/gi, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  function renderEstimateSection(outcome: EstimateOutcome, titleText: string, emptyText: string) {
    const estimates = getFilteredEstimates(outcome);
    if (outcome === "Order") {
      estimates.forEach((e) => ensureOrderMeta(e));
    }
    const sectionTotals = sectionCombinedTotals(outcome);

    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <H3>{titleText}</H3>
          <Small>Combined totals for all estimates in this section.</Small>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10 }}>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total m²</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(sectionTotals.totalSquareMetres)}</div>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Linear metreage</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(sectionTotals.totalLinearMetres)}</div>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{sectionTotals.totalQty}</div>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total cost</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(sectionTotals.totalCost)}</div>
            <Small style={{ marginTop: 4 }}>{estimates.length} estimate(s) in this section</Small>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {estimates.map((e) => {
            const currentOutcome = (((e as any).outcome ?? outcome) as EstimateOutcome);
            const totals = estimateTotals(e);
            const estimateCost = estimateCostTotal(e);
            const isExpanded = expandedEstimateId === e.id;

            return (
              <div key={e.id} style={{ borderRadius: 16, border: isExpanded ? "2px solid #18181b" : "1px solid #e4e4e7", padding: 10, background: "#fff", display: "grid", gap: 12 }}>
                <div
                  onClick={() => setExpandedEstimateId((prev) => (prev === e.id ? null : e.id))}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Pill>{e.estimateRef}</Pill>
                    <Small>{e.status}</Small>
                    <Small>{e.positions.length} positions</Small>
                    <Small>{formatMeasure(totals.totalSquareMetres)} m²</Small>
                    <Small>{formatMeasure(totals.totalLinearMetres)} lm</Small>
                    <Small>{formatMoney(estimateCost)}</Small>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#3f3f46", whiteSpace: "nowrap" }}>
                    {isExpanded ? "Hide review" : "Review positions"}
                  </div>
                </div>

                {isExpanded && (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Email</div>
                        <Button variant="outline" onClick={() => { setSendModalEstimateId(e.id); setSendModalOpen(true); }}>Send</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Follow up</div>
                        <Button variant="outline" onClick={() => addFollowUpForEstimate(e.id, { days: 3, sendEmail: true, needsCall: true })}>Add Follow Up</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Estimate status</div>
                        <div
                          role="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setStatusMenuForEstimateId((prev) => (prev === e.id ? null : e.id));
                          }}
                          style={{
                            ...(qsOutcomeStyle(currentOutcome)),
                            height: 38,
                            padding: "0 28px 0 14px",
                            borderRadius: 999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            userSelect: "none",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontWeight: 900 }}>{currentOutcome}</span>
                          <span style={{ fontWeight: 900, lineHeight: 1, transform: "translateY(-1px)" }}>▾</span>
                        </div>

                        {statusMenuForEstimateId === e.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: 6,
                              minWidth: 140,
                              background: "#fff",
                              border: "1px solid rgba(0,0,0,0.12)",
                              borderRadius: 10,
                              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                              overflow: "hidden",
                              zIndex: 20,
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {(["Open", "Order", "Lost"] as EstimateOutcome[]).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  persistEstimateOutcome(pickerClient.id, e.id, opt);
                                  setStatusMenuForEstimateId(null);
                                }}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  textAlign: "left",
                                  background: "#fff",
                                  color: "#111827",
                                  fontWeight: 800,
                                  border: "none",
                                  padding: "8px 10px",
                                  cursor: "pointer",
                                  borderBottom: opt === "Lost" ? "none" : "1px solid rgba(0,0,0,0.08)",
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Copy estimate</div>
                        <Button variant="outline" onClick={() => copyEstimateForClient(pickerClient, e.id)}>Copy</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Open estimate</div>
                        <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>Open</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Print Word Doc</div>
                        <Button variant="outline" onClick={() => downloadEstimateWordDoc(e)}>Print Word Doc</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Print PDF</div>
                        <Button variant="outline" onClick={() => printEstimatePdf(e)}>Print PDF</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Project Calculator</div>
                        <Button variant="outline" onClick={() => setProjectCalculatorEstimateId(e.id)}>Project Calculator</Button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Import Supplier Estimate</div>
                        <Button variant="outline" onClick={() => importSupplierEstimate(e.id)}>Import Supplier Estimate</Button>
                      </div>
                    </div>

                    {(supplierEstimateFilesByEstimateId[e.id] ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {(supplierEstimateFilesByEstimateId[e.id] ?? []).map((name, idx) => (
                          <Pill key={`${e.id}_${idx}`}>{name}</Pill>
                        ))}
                      </div>
                    )}

                    {outcome === "Order" && e.orderMeta?.timeline && (
                      <>
                        <OrderTimelineBar timeline={timelineWithCompletion(e)} />

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <Button variant="secondary" onClick={() => openInstallations(e, pickerClient)}>Installations</Button>
                          <Button variant="secondary">Materials</Button>
                          <Button variant="secondary">Hire Equipment</Button>
                        </div>

                        {selectedOrderForInstallations === e.id && (
                          <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa", display: "grid", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Installations</div>
                                <div style={{ fontSize: 12, color: "#71717a" }}>Installers ranked by route where provider/API is available.</div>
                              </div>
                              <Small>{rankedInstallers.length} installer result(s)</Small>
                            </div>

                            {(e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id]) ? (
                              <div style={{ borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#166534", marginBottom: 4 }}>
                                  Selected installer
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: "#14532d" }}>
                                  {installerLabel(e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id])}
                                </div>
                              </div>
                            ) : (
                              <div style={{ borderRadius: 12, border: "1px dashed #d4d4d8", background: "#fff", padding: 12 }}>
                                <Small>No installer selected yet.</Small>
                              </div>
                            )}

                            {rankedInstallers.length === 0 ? (
                              <div style={{ borderRadius: 12, border: "1px dashed #d4d4d8", padding: 12, background: "#fff" }}>
                                <Small>No installer results yet.</Small>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 8 }}>
                                {rankedInstallers.map((r, i) => {
                                  const isSelected = (e.orderMeta?.installerId || selectedInstallerByEstimateId[e.id]) === r.installerId;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => selectInstallerForEstimate(e.id, r.installerId)}
                                      style={{
                                        borderRadius: 12,
                                        border: isSelected ? "2px solid #22c55e" : "1px solid #e4e4e7",
                                        padding: 12,
                                        background: isSelected ? "#f0fdf4" : "#fff",
                                        display: "grid",
                                        gap: 4,
                                        textAlign: "left",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                        <div style={{ fontWeight: 800, color: "#18181b" }}>{installerLabel(r.installerId)}</div>
                                        <Small>{isSelected ? "Selected" : r.provider}</Small>
                                      </div>
                                      <div style={{ fontSize: 12, color: "#52525b" }}>
                                        {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "Distance unavailable"} • {r.durationMinutes != null ? `${r.durationMinutes} mins` : "Time unavailable"}
                                      </div>
                                      {r.reason ? <Small>{r.reason}</Small> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff", display: "grid", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Order scheduling</div>
                            <div style={{ fontSize: 12, color: "#71717a" }}>Set milestone dates and production weeks. Production end and balance due auto-calculate from production start + weeks.</div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>Client sign-off sent</div>
                              <Input type="date" value={e.orderMeta?.clientSignoffSentDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "clientSignoffSentDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Client sign-off received</div>
                              <Input type="date" value={e.orderMeta?.clientSignoffReceivedDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "clientSignoffReceivedDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Deposit paid</div>
                              <Input type="date" value={e.orderMeta?.depositPaidDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "depositPaidDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Factory order signed off</div>
                              <Input type="date" value={e.orderMeta?.factoryOrderSignedOffDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryOrderSignedOffDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Factory invoice paid</div>
                              <Input type="date" value={e.orderMeta?.factoryInvoicePaidDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryInvoicePaidDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Production weeks</div>
                              <Input type="number" value={String(e.orderMeta?.productionWeeks ?? "")} onChange={(ev) => setOrderMetaField(e.id, "productionWeeks", ev.target.value === "" ? undefined : Number(ev.target.value))} />
                            </div>
                            <div>
                              <div style={labelStyle}>Production start</div>
                              <Input type="date" value={e.orderMeta?.productionStartDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "productionStartDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Production end</div>
                              <Input type="date" value={e.orderMeta?.productionEndDate ?? ""} onChange={() => {}} disabled />
                            </div>
                            <div>
                              <div style={labelStyle}>Balance invoice due</div>
                              <Input type="date" value={e.orderMeta?.balanceInvoiceDueDate ?? ""} onChange={() => {}} disabled />
                            </div>
                            <div>
                              <div style={labelStyle}>Production completed</div>
                              <Input type="date" value={e.orderMeta?.productionCompletedDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "productionCompletedDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Factory dispatch</div>
                              <Input type="date" value={e.orderMeta?.factoryDispatchDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "factoryDispatchDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Delivery date</div>
                              <Input type="date" value={e.orderMeta?.deliveryDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "deliveryDate", ev.target.value)} />
                            </div>
                            <div>
                              <div style={labelStyle}>Installation date</div>
                              <Input type="date" value={e.orderMeta?.installationDate ?? ""} onChange={(ev) => setOrderMetaField(e.id, "installationDate", ev.target.value)} />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa", display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                        Project Address: <span style={{ fontWeight: 700 }}>{(e.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean).join(", ") || "Address unavailable"}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                        what3words: <span style={{ fontWeight: 700 }}>{e.what3words || "Not set"}</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
                      <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total m²</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(totals.totalSquareMetres)}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Linear metreage</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(totals.totalLinearMetres)}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{totals.totalQty}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total cost</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(estimateCost)}</div>
                      </div>
                    </div>

                    <div style={{ 
  border: "1px solid #e4e4e7", 
  borderRadius: 14, 
  background: "#fff", 
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0
}}>
                      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, background: "#fff" }}>
                        <thead>
                          <tr style={{ background: "#fafafa" }}>
                            <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Reference</th>
                            <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Room</th>
                            <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Picture</th>
                            <th style={{ textAlign: "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Brief description</th>
                            <th style={{ textAlign: "right", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Qty</th>
                            <th style={{ textAlign: "right", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Item price</th>
                            <th style={{ textAlign: "right", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 2, background: "#fafafa" }}>Quantity price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.positions.map((p) => {
                            const itemPriceRaw = itemPriceByPositionId[p.id] ?? String(p.itemPrice ?? "");
                            const itemPrice = Number(itemPriceRaw || 0);
                            const quantityPrice = (Number.isFinite(itemPrice) ? itemPrice : 0) * Math.max(1, Number(p.qty || 1));

                            return (
                              <tr key={p.id}>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", fontWeight: 800 }}>{p.positionRef}</td>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{p.roomName || "—"}</td>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}><PositionPreview position={p} /></td>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <div style={{ fontWeight: 700 }}>{positionDescription(p)}</div>
                                    <div style={{ fontSize: 12, color: "#71717a" }}>{p.fieldsX}w × {p.fieldsY}h</div>
                                  </div>
                                </td>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right", fontWeight: 800 }}>{p.qty}</td>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right", width: 140 }}>
                                  <Input
                                    value={itemPriceRaw}
                                    onChange={(ev) => setItemPriceByPositionId((prev) => ({ ...prev, [p.id]: ev.target.value }))}
                                    placeholder=""
                                    inputMode="decimal"
                                    style={{ textAlign: "right" }}
                                  />
                                </td>
                                <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right", fontWeight: 800 }}>{formatMoney(quantityPrice)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
				  </>
                )}
              </div>
            );
          })}

          {estimates.length === 0 && (
            <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
              <Small>{emptyText}</Small>
            </div>
          )}
        </div>
      </div>
    );
  }


  const totalClientEstimateCount = pickerClient.estimates.length;
  const clientOrderCount = pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === "Order").length;
  const clientLostCount = pickerClient.estimates.filter((e) => (((e as any).outcome ?? "Open") as EstimateOutcome) === "Lost").length;
  const orderConversionPct = totalClientEstimateCount ? Math.round((clientOrderCount / totalClientEstimateCount) * 100) : 0;
  const lostConversionPct = totalClientEstimateCount ? Math.round((clientLostCount / totalClientEstimateCount) * 100) : 0;

  const sendEmailDraft = sendModalEstimateId ? buildSendEmailText(sendModalEstimateId) : { subject: "", body: "" };

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 10 }}>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Client Estimates</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{totalClientEstimateCount}</div>
          <Small>Total estimates created for this client.</Small>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Orders Conversion</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{orderConversionPct}%</div>
          <Small>{clientOrderCount} of {totalClientEstimateCount} marked as Order.</Small>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Lost Conversion</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{lostConversionPct}%</div>
          <Small>{clientLostCount} of {totalClientEstimateCount} marked as Lost.</Small>
        </div>
      </div>

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

      {estimatePickerTab === "estimates" && renderEstimateSection("Open", "Client Estimates", "No open estimates yet.")}
      {estimatePickerTab === "orders" && renderEstimateSection("Order", "Client Orders", "No orders yet. Mark an estimate as \"Order\" in the Client Estimates tab.")}
      {estimatePickerTab === "lost" && renderEstimateSection("Lost", "Client Lost", "No lost estimates yet. Mark an estimate as \"Lost\" in the Client Estimates tab.")}

      {estimatePickerTab === "client_notes" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <H3>Client Notes</H3>
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

      {estimatePickerTab === "files" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <H3>Files</H3>
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

      {projectCalculatorEstimateId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            padding: 16,
            zIndex: 9998,
          }}
        >
          <div style={{ width: "min(1200px, 100%)", background: "#fff", borderRadius: 16, border: "1px solid #e4e4e7", overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Project Calculator</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {pickerClient.clientName} • {(pickerClient as any).clientRef ?? ""} • {pickerClient.estimates.find((x) => x.id === projectCalculatorEstimateId)?.estimateRef ?? ""}
                </div>
              </div>
              <Button variant="outline" onClick={() => setProjectCalculatorEstimateId(null)}>Close</Button>
            </div>
            <div style={{ overflow: "auto", background: "#f8fafc" }}>
              <ProjectCalculatorWizard />
            </div>
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

                    <Button variant="secondary" onClick={() => printEstimatePdf(pickerClient.estimates.find((x) => x.id === sendModalEstimateId)!)}>
                      Generate PDF
                    </Button>

                    <Button variant="primary" onClick={() => openMailClient(sendEmailDraft.subject, sendEmailDraft.body)}>
                      Open email app
                    </Button>
                  </div>

                  <Small style={{ color: "#6b7280" }}>
                    Use “Print PDF” to generate the customer-facing estimate PDF, then attach that PDF in your email app. Direct file attachment from the browser send flow is not wired yet.
                  </Small>
                </div>
              </div>

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
                    Phase 1: Follow-ups are stored locally and appear in Customers - Follow Ups. Export .ics there for Outlook/Google reminders.
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
                    printEstimatePdf(pickerClient.estimates.find((x) => x.id === sendModalEstimateId)!);
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

