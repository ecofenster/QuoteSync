console.log("FULL import.meta.env", import.meta.env);
import React, { useEffect, useMemo, useRef, useState } from "react";

  
//
// ===== ESTIMATE API HELPERS =====
//
async function loadEstimates(clientId: string) {
  const res = await fetch(`http://localhost:3001/api/estimates?client_id=${clientId}`);
  if (!res.ok) throw new Error("Failed to load estimates");
  return res.json();
}

async function createEstimateAPI(payload: any) {
  const res = await fetch(`http://localhost:3001/api/estimates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create estimate");
  return res.json();
}

async function updateEstimateAPI(id: string, payload: any) {
  const res = await fetch(`http://localhost:3001/api/estimates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update estimate");
  return res.json();
}
import GridEditor from "./components/GridEditor";
import EstimatePickerFeature, { type EstimatePickerFeatureHandle } from "./features/estimatePicker/EstimatePickerFeature";
import DefaultsEditor from "./features/estimateDefaults/DefaultsEditor";
import { DEFAULT_CUSTOMER_ADDRESS, makeDefaultClients } from "./features/clients/defaultClients";
import * as Models from "./models/types";
import type { Address, Client, Estimate, Position, EstimateDefaults, ClientType } from "./models/types";
import {
  PRODUCT_TYPES,
  SUPPLIERS,
  WOOD_TYPES,
  FINISHES_BY_TYPE,
  getSupplier,
  allProductsForSupplier,
  firstProductForSupplier,
  isTimberProductType,
} from "./features/catalog/defaultCatalog";
import {
  HINGE_TYPES,
  UG_DOUBLE,
  UG_TRIPLE,
  HANDLE_TYPES,
  SUN_PROTECTION,
  CILL_DEPTHS,
  FRAME_EXTS,
  makeDefaultEstimateDefaults,
  makeBlankEstimateDefaults,
} from "./features/estimateDefaults/defaultEstimateDefaults";
import FollowUpsFeature from "./features/followUps/FollowUpsFeature";
import MainDashboard from "./dashboard/main/MainDashboard";
import Toggle from "./components/Toggle";
import GoogleMapPanel, { type GoogleMapMarkerItem } from "./components/GoogleMapPanel";
import { buildClientLocationLabel, convertCoordinatesToWhat3Words, resolveClientLocation, resolveEstimateLocation, type ResolvedClientLocation } from "./services/locationService";
import { loadSettings, saveSettings } from "./system/settings";


/* =========================
   Helpers
========================= */

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function pad3(n: number) {
  const s = String(n);
  return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
}

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizeCellInsertions(fieldsX: number, fieldsY: number, existing: Record<string, string> | undefined, fallback: string) {
  const out: Record<string, string> = {};
  for (let r = 0; r < fieldsY; r++) {
    for (let c = 0; c < fieldsX; c++) {
      const k = keyForCell(c, r);
      out[k] = existing?.[k] ?? fallback;
    }
  }
  return out;
}

function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nextClientRef(n: number) {
  return `EF-CL-${pad3(n)}`;
}

const DEFAULT_ESTIMATE_REF_PREFIX = "EF-EST";

/**
 * Estimate reference prefix.
 * Default aligns to EF-EST-YYYY-###.
 * Future: expose as an Admin setting.
 */
function getEstimateRefPrefix() {
  try {
    const v = localStorage.getItem("quotesync.estimateRefPrefix");
    if (v && /^[A-Z0-9-]+$/.test(v)) return v;
  } catch {
    // ignore storage errors (private mode / blocked)
  }
  return DEFAULT_ESTIMATE_REF_PREFIX;
}

function nextEstimateBaseRef(year: number, n: number) {
  return `${getEstimateRefPrefix()}-${year}-${pad3(n)}`;
}

function estimateRefWithRevision(base: string, revisionNo: number) {
  if (revisionNo <= 0) return base;
  return `${base}-${String(revisionNo).padStart(2, "0")}`;
}

const ORDER_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function estimatePotentialValue(est: Estimate) {
  return (est.positions ?? []).reduce((sum, pos) => {
    const qty = Number.isFinite(pos.qty) ? Number(pos.qty) : 0;
    const itemPrice = typeof pos.itemPrice === "number" && Number.isFinite(pos.itemPrice) ? pos.itemPrice : 0;
    return sum + qty * itemPrice;
  }, 0);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function monthYearLabel(month: string, year: number) {
  return month && year ? `${month} ${year}` : "Not set";
}

function next12ForecastBuckets(fromDate = new Date()) {
  const out: { key: string; month: string; year: number }[] = [];
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const month = ORDER_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    out.push({ key: `${month}-${year}`, month, year });
  }
  return out;
}

function extractPostcodeFromAddress(projectAddress: string) {
  const match = (projectAddress || "").match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? match[0].toUpperCase().replace(/\s+/, " ") : "";
}

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

function maxClientRefNumber(rows: Array<{ client_ref?: string | null }>) {
  return rows.reduce((max, row) => {
    const value = String(row?.client_ref || "");
    const digits = value.match(/\d+/g);
    const n = digits ? Number(digits.join("")) : 0;
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

function mapDbClientToClient(row: any): Client {
  const type: ClientType = row?.client_type === "Business" ? "Business" : "Individual";

  const customerStructured = resolveStructuredAddress(row?.customer_address_json, String(row?.customer_address || ""));
  const projectStructured = resolveStructuredAddress(row?.project_address_json, String(row?.project_address || ""));
  const invoiceStructured = resolveStructuredAddress(
    row?.invoice_address_json,
    String(row?.invoice_address || row?.project_address || "")
  );

  const customerAddress = buildAddressString(customerStructured);
  const projectAddress = buildAddressString(projectStructured);
  const invoiceAddress = buildAddressString(invoiceStructured);

  return {
    id: Models.asClientId(String(row?.id || uid())),
    type,
    clientRef: String(row?.client_ref || ""),
    clientName: String(row?.name || row?.company_name || "Client"),
    email: String(row?.email || ""),
    mobile: String(row?.mobile || row?.phone || ""),
    home: String(row?.home || ""),
    projectName: String(row?.project_name || ""),
    customerAddress,
    projectAddress,
    invoiceAddress,
    customerAddressStructured: customerStructured,
    projectAddressStructured: projectStructured,
    invoiceAddressStructured: invoiceStructured,
    postcode: extractPostcodeFromAddress(projectAddress),
    what3words: String(row?.what3words || ""),
    businessName: type === "Business" ? String(row?.company_name || "") : undefined,
    contactPerson: type === "Business" ? String(row?.contact_name || "") : undefined,
    estimates: [],
  };
}

function buildDbClientPayload(client: Client) {
  const customerStructured = resolveStructuredAddress(
    (client as any).customerAddressStructured,
    String((client as any).customerAddress || "")
  );
  const projectStructured = resolveStructuredAddress(client.projectAddressStructured, String(client.projectAddress || ""));
  const invoiceStructured = resolveStructuredAddress(client.invoiceAddressStructured, String(client.invoiceAddress || ""));

  const customerAddress = buildAddressString(customerStructured);
  const projectAddress = buildAddressString(projectStructured);
  const invoiceAddress = buildAddressString(invoiceStructured);

  return {
    id: client.id,
    name: client.clientName || "",
    email: client.email || "",
    phone: client.mobile || "",
    mobile: client.mobile || "",
    home: client.home || "",
    project_name: client.projectName || "",
    created_at: new Date().toISOString(),
    client_ref: client.clientRef || "",
    client_type: client.type || "Individual",
    contact_name: client.contactPerson || "",
    company_name: client.businessName || "",
    customer_address: customerAddress,
    project_address: projectAddress,
    invoice_address: invoiceAddress,
    invoice_same_as_customer: invoiceAddress.trim() === customerAddress.trim(),
    invoice_same_as_project: invoiceAddress.trim() === projectAddress.trim(),
    customer_address_json: customerStructured,
    project_address_json: projectStructured,
    invoice_address_json: invoiceStructured,
    what3words: client.what3words || "",
  };
}

function mergeEstimateLocationState(estimate: Estimate): Estimate {
  const location = estimate.location;
  const projectStructured = resolveStructuredAddress(
    estimate.projectAddressStructured ?? location?.projectAddressStructured,
    String(estimate.projectAddress ?? location?.projectAddress ?? "")
  );
  const projectAddress = buildAddressString(projectStructured);
  const postcode = String(estimate.postcode ?? location?.postcode ?? extractPostcodeFromAddress(projectAddress) ?? "");
  const what3words = String(estimate.what3words ?? location?.what3words ?? "");
  const latitudeValue = estimate.latitude ?? location?.latitude ?? null;
  const longitudeValue = estimate.longitude ?? location?.longitude ?? null;
  const latitude = latitudeValue == null || !Number.isFinite(Number(latitudeValue)) ? null : Number(latitudeValue);
  const longitude = longitudeValue == null || !Number.isFinite(Number(longitudeValue)) ? null : Number(longitudeValue);

  return {
    ...estimate,
    projectAddress,
    projectAddressStructured: projectStructured,
    postcode,
    what3words,
    latitude,
    longitude,
    location: {
      projectAddress,
      projectAddressStructured: projectStructured,
      postcode,
      what3words,
      latitude,
      longitude,
    },
  };
}

function buildDbEstimatePayload(clientId: string, estimate: Estimate) {
  const normalizedEstimate = mergeEstimateLocationState(estimate);

  return {
    id: normalizedEstimate.id,
    client_id: clientId,
    estimate_ref: normalizedEstimate.estimateRef || "",
    base_estimate_ref: normalizedEstimate.baseEstimateRef || normalizedEstimate.estimateRef || "",
    revision_no: Number.isFinite(Number(normalizedEstimate.revisionNo)) ? Number(normalizedEstimate.revisionNo) : 0,
    status: normalizedEstimate.status || "Draft",
    estimated_order_month: normalizedEstimate.estimatedOrderMonth || "",
    estimated_order_year: Number.isFinite(Number(normalizedEstimate.estimatedOrderYear)) ? Number(normalizedEstimate.estimatedOrderYear) : null,
    defaults_json: normalizedEstimate.defaults ?? {},
    positions_json: normalizedEstimate.positions ?? [],
    order_meta_json: normalizedEstimate.orderMeta ?? {},
    outcome: (normalizedEstimate as any).outcome ?? "Open",
    project_address: normalizedEstimate.projectAddress || "",
    project_address_json: normalizedEstimate.projectAddressStructured ?? emptyAddress(),
    postcode: normalizedEstimate.postcode || "",
    what3words: normalizedEstimate.what3words || "",
    latitude: normalizedEstimate.latitude ?? null,
    longitude: normalizedEstimate.longitude ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
function mapDbEstimateToEstimate(row: any): Estimate {
  const projectStructured = resolveStructuredAddress(row?.project_address_json, String(row?.project_address || ""));
  const projectAddress = buildAddressString(projectStructured);
  const postcode = String(row?.postcode || extractPostcodeFromAddress(projectAddress) || "");
  const what3words = String(row?.what3words || "");
  const latitude = row?.latitude == null || row?.latitude === "" || !Number.isFinite(Number(row?.latitude)) ? null : Number(row.latitude);
  const longitude = row?.longitude == null || row?.longitude === "" || !Number.isFinite(Number(row?.longitude)) ? null : Number(row.longitude);

  return {
    id: Models.asEstimateId(String(row?.id || uid())),
    estimateRef: String(row?.estimate_ref || ""),
    baseEstimateRef: String(row?.base_estimate_ref || row?.estimate_ref || ""),
    revisionNo: Number.isFinite(Number(row?.revision_no)) ? Number(row.revision_no) : 0,
    status: String(row?.status || "Draft"),
    estimatedOrderMonth: String(row?.estimated_order_month || ORDER_MONTHS[new Date().getMonth()]),
    estimatedOrderYear: Number.isFinite(Number(row?.estimated_order_year)) ? Number(row.estimated_order_year) : new Date().getFullYear(),
    defaults: (row?.defaults_json && typeof row.defaults_json === "object" ? row.defaults_json : makeBlankEstimateDefaults()) as EstimateDefaults,
    positions: Array.isArray(row?.positions_json) ? row.positions_json : [],
    orderMeta: row?.order_meta_json && typeof row.order_meta_json === "object" ? row.order_meta_json : undefined,
    projectAddress,
    projectAddressStructured: projectStructured,
    postcode,
    what3words,
    latitude,
    longitude,
    location: {
      projectAddress,
      projectAddressStructured: projectStructured,
      postcode,
      what3words,
      latitude,
      longitude,
    },
    outcome: String(row?.outcome || "Open"),
  } as Estimate;
}

async function loadClientEstimatesFromApi(clientId: string) {
  const data = await loadEstimates(clientId);
  return Array.isArray(data) ? data.map((row) => mapDbEstimateToEstimate(row)) : [];
}
const DEMO_FOLLOW_UP_COUNT = 10;
const DEMO_ORDER_COUNT = 15;
const DEMO_LOST_COUNT = 10;
const DEMO_INSTALLATION_COUNT = 17;
const QS_FOLLOWUPS_KEY = "qs_followups_v1";

function demoScenarioForIndex(index: number) {
  if (index < DEMO_FOLLOW_UP_COUNT) return "follow_up";
  if (index < DEMO_FOLLOW_UP_COUNT + DEMO_ORDER_COUNT) return "order";
  if (index < DEMO_FOLLOW_UP_COUNT + DEMO_ORDER_COUNT + DEMO_LOST_COUNT) return "lost";
  if (index < DEMO_FOLLOW_UP_COUNT + DEMO_ORDER_COUNT + DEMO_LOST_COUNT + DEMO_INSTALLATION_COUNT) return "installation";
  return "open";
}

function randomIsoDateFromToday(minDays: number, maxDays: number) {
  const d = new Date();
  const daysToAdd = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

function seedDemoEstimateOutcomesAndFollowUps(clients: Client[], enabled: boolean) {
  if (!enabled) return;

  const followUps: any[] = [];
  let globalEstimateIndex = 0;

  clients.forEach((client) => {
    const outcomes: Record<string, string> = {};

    (client.estimates ?? []).forEach((estimate) => {
      const scenario = demoScenarioForIndex(globalEstimateIndex);

      if (scenario === "lost") {
        outcomes[estimate.id] = "Lost";
        (estimate as any).outcome = "Lost";
      } else if (scenario === "order" || scenario === "installation") {
        outcomes[estimate.id] = "Order";
        (estimate as any).outcome = "Order";
      } else {
        outcomes[estimate.id] = "Open";
        (estimate as any).outcome = "Open";
      }

      if (scenario === "follow_up") {
        followUps.push({
          id: `demo-followup-${client.id}-${estimate.id}`,
          clientId: client.id,
          clientName: client.type === "Business" ? (client.businessName || client.clientName) : client.clientName,
          clientRef: client.clientRef,
          estimateId: estimate.id,
          estimateRef: estimate.estimateRef,
          dueDateISO: randomIsoDateFromToday(1, 60),
          title: `Follow up: ${(client.type === "Business" ? (client.businessName || client.clientName) : client.clientName)} ${estimate.estimateRef}`,
          notes: "Telephone call Follow-up email",
          status: "pending",
          type: "call",
          createdAt: new Date().toISOString(),
          sendEmail: true,
          needsCall: true,
        });
      }

      globalEstimateIndex += 1;
    });
  });

  try {
    localStorage.setItem(QS_FOLLOWUPS_KEY, JSON.stringify(followUps));
  } catch {}
}

type DeletedEstimateRecord = {
  estimate: Estimate;
  deletedAt: string;
};

function loadDeletedEstimatesBin(): Record<string, DeletedEstimateRecord[]> {
  try {
    const raw = localStorage.getItem("quotesync.deletedEstimatesBin.v1");
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const cleaned: Record<string, DeletedEstimateRecord[]> = {};

    for (const [clientId, list] of Object.entries(parsed as Record<string, any>)) {
      if (!Array.isArray(list)) continue;
      const kept = list.filter((item) => {
        const t = Date.parse(item?.deletedAt ?? "");
        return item && item.estimate && Number.isFinite(t) && t >= cutoff;
      });
      if (kept.length) cleaned[clientId] = kept;
    }

    return cleaned;
  } catch {
    return {};
  }
}

/* =========================
   UI primitives (inline only)
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

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
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

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  list,
  disabled,
  readOnly,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      list={list}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #e4e4e7",
        padding: "10px 12px",
        fontSize: 14,
        outline: "none",
      }}
    />
  );
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

function SidebarItem({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14,
        padding: "10px 12px",
        marginBottom: 6,
        cursor: "pointer",
        background: active ? "#18181b" : "transparent",
        color: active ? "#fff" : "#3f3f46",
        fontSize: 14,
        fontWeight: active ? 800 : 600,
      }}
    >
      {label}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#3f3f46", fontWeight: 700, marginBottom: 6 };


/* =========================
   Main App
========================= */

function scaleSplitsToTotal(splits: number[] | undefined, total: number, parts: number, minEach = 1): number[] {
  const safeParts = Math.max(1, Math.floor(parts || 1));
  const safeTotal = Math.max(minEach * safeParts, Math.floor(total || 0));

  // Start from provided splits or equal distribution
  let arr: number[] = Array.isArray(splits) ? splits.slice(0, safeParts) : [];
  while (arr.length < safeParts) arr.push(Math.floor(safeTotal / safeParts));

  // Sanitise numbers + enforce minimums
  arr = arr.map((v) => Math.max(minEach, Math.floor(Number.isFinite(v) ? v : minEach)));

  const sum = arr.reduce((a, b) => a + b, 0);

  // If sum is zero (shouldn''t happen), fall back
  if (sum <= 0) {
    const base = Math.floor(safeTotal / safeParts);
    arr = Array.from({ length: safeParts }, () => Math.max(minEach, base));
  }

  // Scale to total
  const sum2 = arr.reduce((a, b) => a + b, 0);
  let scaled = arr.map((v) => Math.max(minEach, Math.round((v / sum2) * safeTotal)));

  // Fix rounding drift by adjusting the largest element
  let drift = safeTotal - scaled.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let idx = 0;
    for (let i = 1; i < scaled.length; i++) if (scaled[i] > scaled[idx]) idx = i;
    scaled[idx] = Math.max(minEach, scaled[idx] + drift);
  }

  // Final ensure exact total (still possible if minEach clamps)
  let finalSum = scaled.reduce((a, b) => a + b, 0);
  if (finalSum !== safeTotal) {
    // distribute remaining drift across entries that can take it
    let d = safeTotal - finalSum;
    const step = d > 0 ? 1 : -1;
    d = Math.abs(d);

    let guard = 0;
    while (d > 0 && guard < 100000) {
      for (let i = 0; i < scaled.length && d > 0; i++) {
        const next = scaled[i] + step;
        if (next >= minEach) {
          scaled[i] = next;
          d--;
        }
      }
      guard++;
      if (guard > 1000) break;
    }
  }

  return scaled;
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

function ClientSummary({ c }: { c: Client }) {
  const headline = c.type === "Business" ? (c.businessName || c.clientName) : c.clientName;
  const sub = c.type === "Business" ? (c.contactPerson ? `Contact: ${c.contactPerson}` : "Contact: ") : "Individual";

  return (
    <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <H3>{headline}</H3>
            <Pill>{c.clientRef}</Pill>
            <Small>{c.type}</Small>
          </div>
          <Small>{sub}</Small>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {c.email ? <Pill>{c.email}</Pill> : <Pill>Email: </Pill>}
          {c.mobile ? <Pill>Mob: {c.mobile}</Pill> : <Pill>Mob: </Pill>}
          {c.home ? <Pill>Home: {c.home}</Pill> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const ENV = ((import.meta as any)?.env ?? {}) as Record<string, unknown>;


  const [menu, setMenu] = useState<Models.MenuKey>("dashboard");

  const [view, setView] = useState<Models.View>("customers");


  const estimatePickerRef = useRef<EstimatePickerFeatureHandle>(null);

  const [systemSettings, setSystemSettings] = useState(() => loadSettings());


  useEffect(() => {
    saveSettings(systemSettings);
  }, [systemSettings]);


  

  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);

  const [estimateCounter, setEstimateCounter] = useState(1);


const [clients, setClients] = useState<Client[]>([]);


  const [clientCounter, setClientCounter] = useState(() => (systemSettings.loadDemoClients ? 33 : 1));

  const [deletedEstimatesByClientId, setDeletedEstimatesByClientId] =
  useState<Record<string, DeletedEstimateRecord[]>>(() => loadDeletedEstimatesBin());


  useEffect(() => {
  try {
    localStorage.setItem("quotesync.deletedEstimatesBin.v1", JSON.stringify(deletedEstimatesByClientId));
  } catch {}
}, [deletedEstimatesByClientId]);

  useEffect(() => {
    async function syncClientsForSettings() {
      if (systemSettings.loadDemoClients || systemSettings.loadDemoEstimates) {
        const freshClients = makeDefaultClients({
          uid,
          nextClientRef,
          loadDemoClients: systemSettings.loadDemoClients,
          loadDemoEstimates: systemSettings.loadDemoEstimates,
        });

        seedDemoEstimateOutcomesAndFollowUps(
          freshClients,
          systemSettings.loadDemoClients && systemSettings.loadDemoEstimates
        );

        setClients(freshClients);
        setClientCounter(systemSettings.loadDemoClients ? 33 : 1);
      } else {
        try {
          const res = await fetch("http://localhost:3001/api/clients");
          const data = await res.json();
          const rows = Array.isArray(data) ? data : [];
          const baseClients = rows.map((row) => mapDbClientToClient(row));
          const hydratedClients = await Promise.all(
            baseClients.map(async (client) => {
              try {
                const estimates = await loadClientEstimatesFromApi(client.id);
                return { ...client, estimates };
              } catch {
                return client;
              }
            })
          );
          setClients(hydratedClients);
          const maxRef = maxClientRefNumber(rows);
          setClientCounter(Math.max(1, maxRef + 1));
        } catch {
          setClients([]);
          setClientCounter(1);
        }
      }

      setSelectedClientId(null);
      setSelectedEstimateId(null);
      setEstimatePickerClientId(null);
    }

    syncClientsForSettings();
  }, [systemSettings.loadDemoClients, systemSettings.loadDemoEstimates]);

  const [selectedClientId, setSelectedClientId] = useState<Models.ClientId | null>(null);

  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) ?? null, [clients, selectedClientId]);

  const [selectedEstimateId, setSelectedEstimateId] = useState<Models.EstimateId | null>(null);

  const selectedEstimate = useMemo(() => {
    if (!selectedClient) return null;
    return selectedClient.estimates.find((e) => e.id === selectedEstimateId) ?? null;
  }, [selectedClient, selectedEstimateId]);
  // Add client UI
  const [showAddClient, setShowAddClient] = useState(false);

  // client edit mode
  const [editingClientId, setEditingClientId] = useState<Models.ClientId | null>(null);


  function splitAddress7(addr: string): [string, string, string, string, string, string, string] {
    const parts = (addr || "")
      .split(/\r?\n/)
      .map((s) => (s || "").trim());
    while (parts.length < 7) parts.push("");
    return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || "", parts[4] || "", parts[5] || "", parts[6] || ""];
  }

 function openEditClientPanel(c: Client) {

  setView("customers");
  setEditingClientId(c.id);

  setDraftClientType(c.type === "Business" ? "Business" : "Individual");
  setDraftClientName(c.clientName || "");
  setDraftBusinessName(c.businessName || "");
  setDraftContactName(c.contactPerson || "");

  setDraftProjectName(c.projectName || "");

  setDraftEmail(c.email || "");
  setDraftMobile(c.mobile || "");
  setDraftHome(c.home || "");

  const [ca1, ca2, ca3, ct, cc, cco, cp] = splitAddress7((c as any).customerAddress || "");
  setDraftCustAddress1(ca1);
  setDraftCustAddress2(ca2);
  setDraftCustAddress3(ca3);
  setDraftCustTown(ct);
  setDraftCustCity(cc);
  setDraftCustCounty(cco);
  setDraftCustPostcode(cp);

  const [ia1, ia2, ia3, it, ic, ico, ip] = splitAddress7(c.invoiceAddress || "");
  setDraftInvAddress1(ia1);
  setDraftInvAddress2(ia2);
  setDraftInvAddress3(ia3);
  setDraftInvTown(it);
  setDraftInvCity(ic);
  setDraftInvCounty(ico);
  setDraftInvPostcode(ip);

  const invoiceText = (c.invoiceAddress || "").trim();
  const customerText = ((c as any).customerAddress || "").trim();

  if (invoiceText === customerText || invoiceText === "") setInvoiceAddressMode("customer");
  else setInvoiceAddressMode("custom");

  setCustomerAddressSectionOpen(false);
  setInvoiceAddressSectionOpen(false);
  setShowAddClient(true);
}


  function updateClient(type: ClientType) {
    if (!editingClientId) return;

    const customerAddressStructured: Address = {
      line1: (draftCustAddress1 || "").trim(),
      line2: (draftCustAddress2 || "").trim(),
      line3: (draftCustAddress3 || "").trim(),
      town: (draftCustTown || "").trim(),
      city: (draftCustCity || "").trim(),
      county: (draftCustCounty || "").trim(),
      postcode: (draftCustPostcode || "").trim(),
    };

    const customInvoiceAddressStructured: Address = {
      line1: (draftInvAddress1 || "").trim(),
      line2: (draftInvAddress2 || "").trim(),
      line3: (draftInvAddress3 || "").trim(),
      town: (draftInvTown || "").trim(),
      city: (draftInvCity || "").trim(),
      county: (draftInvCounty || "").trim(),
      postcode: (draftInvPostcode || "").trim(),
    };

    const customerAddress = buildAddressString(customerAddressStructured) || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddressStructured =
      invoiceAddressMode === "customer"
        ? { ...customerAddressStructured }
        : { ...customInvoiceAddressStructured };

    const invoiceAddress = buildAddressString(invoiceAddressStructured) || customerAddress;

    const businessName = (draftBusinessName || "").trim();
    const contactPerson = (draftContactName || "").trim();
    const clientName = type === "Business" ? (businessName || "Business") : ((draftClientName || "").trim() || "Client");

    const updatedClient = {
      ...(clients.find((c) => c.id === editingClientId) as Client),
      id: editingClientId,
      type,
      clientName,
      businessName: type === "Business" ? businessName : undefined,
      contactPerson: type === "Business" ? contactPerson : undefined,
      email: (draftEmail || "").trim(),
      mobile: (draftMobile || "").trim(),
      home: (draftHome || "").trim(),
      projectName: (draftProjectName || "").trim(),
      customerAddress,
      projectAddress: clients.find((c) => c.id === editingClientId)?.projectAddress || "",
      invoiceAddress,
      customerAddressStructured: resolveStructuredAddress(customerAddressStructured, customerAddress),
      projectAddressStructured: clients.find((c) => c.id === editingClientId)?.projectAddressStructured,
      invoiceAddressStructured: resolveStructuredAddress(invoiceAddressStructured, invoiceAddress),
      postcode: clients.find((c) => c.id === editingClientId)?.postcode || "",
      what3words: clients.find((c) => c.id === editingClientId)?.what3words || "",
      latitude: clients.find((c) => c.id === editingClientId)?.latitude ?? null,
      longitude: clients.find((c) => c.id === editingClientId)?.longitude ?? null,
      estimates: clients.find((c) => c.id === editingClientId)?.estimates ?? [],
      clientRef: clients.find((c) => c.id === editingClientId)?.clientRef || nextClientRef(clientCounter),
    } as Client;

    fetch(`http://localhost:3001/api/clients/${editingClientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDbClientPayload(updatedClient)),
    }).catch(() => {});

    setClients((prev) => prev.map((c) => (c.id !== editingClientId ? c : updatedClient)));

    setShowAddClient(false);
    setEditingClientId(null);
  }


  const [draftClientType, setDraftClientType] = useState<ClientType>("Individual");

  const [draftClientName, setDraftClientName] = useState("");

  const [draftBusinessName, setDraftBusinessName] = useState("");

  const [draftContactName, setDraftContactName] = useState("");

  const [draftProjectName, setDraftProjectName] = useState("");
  const [draftWhat3Words, setDraftWhat3Words] = useState("");

  const [draftEmail, setDraftEmail] = useState("");

  const [draftMobile, setDraftMobile] = useState("");

  const [draftHome, setDraftHome] = useState("");


  const [draftCustAddress1, setDraftCustAddress1] = useState("");

  const [draftCustAddress2, setDraftCustAddress2] = useState("");

  const [draftCustAddress3, setDraftCustAddress3] = useState("");

  const [draftCustTown, setDraftCustTown] = useState("");

  const [draftCustCity, setDraftCustCity] = useState("");

  const [draftCustCounty, setDraftCustCounty] = useState("");

  const [draftCustPostcode, setDraftCustPostcode] = useState("");


  // Add client: Project + Invoice addresses
  const [draftProjAddress1, setDraftProjAddress1] = useState("");

  const [draftProjAddress2, setDraftProjAddress2] = useState("");

  const [draftProjAddress3, setDraftProjAddress3] = useState("");

  const [draftProjTown, setDraftProjTown] = useState("");

  const [draftProjCity, setDraftProjCity] = useState("");

  const [draftProjCounty, setDraftProjCounty] = useState("");

  const [draftProjPostcode, setDraftProjPostcode] = useState("");


  const [invoiceAddressMode, setInvoiceAddressMode] = useState<"customer" | "custom">("customer");

  const [draftInvAddress1, setDraftInvAddress1] = useState("");

  const [draftInvAddress2, setDraftInvAddress2] = useState("");

  const [draftInvAddress3, setDraftInvAddress3] = useState("");

  const [draftInvTown, setDraftInvTown] = useState("");

  const [draftInvCity, setDraftInvCity] = useState("");

  const [draftInvCounty, setDraftInvCounty] = useState("");

  const [draftInvPostcode, setDraftInvPostcode] = useState("");

  const [customerAddressSectionOpen, setCustomerAddressSectionOpen] = useState(false);

  const [invoiceAddressSectionOpen, setInvoiceAddressSectionOpen] = useState(false);


  // Position wizard
  const [showPositionWizard, setShowPositionWizard] = useState(false);

  const [posStep, setPosStep] = useState<1 | 2 | 3>(1); // 1 Position, 2 Dimensions, 3 Configuration

  const [posDraft, setPosDraft] = useState<Position>(() => ({

    id: Models.asPositionId(uid()),
    positionRef: "W-001",
    qty: 1,
    roomName: "",
    widthMm: 1000,
    heightMm: 1200,
    fieldsX: 1,
    fieldsY: 1,
    insertion: "Fixed",
    cellInsertions: { "0,0": "Fixed" },
    positionType: "Window",
    useEstimateDefaults: true,
    overrides: {},
  }));

  const [draftSelectedCell, setDraftSelectedCell] = useState<{ col: number; row: number }>({ col: 0, row: 0 });

  const [previewView, setPreviewView] = useState<"Inside" | "Outside">("Inside");

  const [openingStd, setOpeningStd] = useState<"DIN" | "UK">("DIN");


  const [clientDbSearch, setClientDbSearch] = useState("");

  const [clientDbFilter, setClientDbFilter] = useState<"All" | "Open" | "Orders" | "Lost">("All");

  const [clientDbSort, setClientDbSort] = useState<"asc" | "desc">("asc");

  const [clientDbSortField, setClientDbSortField] = useState<"client_name" | "client_number" | "project_name">("client_name");


  const currentMonthName = ORDER_MONTHS[new Date().getMonth()];
  const monthFilterOptions = ["All", ...ORDER_MONTHS] as const;
  type GlobalMonthFilter = (typeof monthFilterOptions)[number];
  type GlobalSortField = "client_name" | "client_number" | "project_name" | "total_cost";

  const [globalSearch, setGlobalSearch] = useState("");

  const [globalSort, setGlobalSort] = useState<"asc" | "desc">("asc");

  const [globalSortField, setGlobalSortField] = useState<GlobalSortField>("client_number");

  const [globalMonthFilter, setGlobalMonthFilter] = useState<GlobalMonthFilter>("All");


  const [globalSelectModeByMenu, setGlobalSelectModeByMenu] = useState<Record<string, boolean>>({});

  const [globalSelectedEstimateIdsByMenu, setGlobalSelectedEstimateIdsByMenu] = useState<Record<string, Record<string, boolean>>>({});


  const [installationExpandedEstimateId, setInstallationExpandedEstimateId] = useState<Models.EstimateId | null>(null);

  const [installationTabByEstimateId, setInstallationTabByEstimateId] = useState<Record<string, "key_dates" | "order_copy" | "project_calculator">>({});

  const [selectedMapEstimateId, setSelectedMapEstimateId] = useState<Models.EstimateId | null>(null);

  const [resolvedLocationsByClientId, setResolvedLocationsByClientId] = useState<Record<string, ResolvedClientLocation | null | undefined>>({});

  const [mapsApiReady, setMapsApiReady] = useState(false);
  
  const [what3WordsPickerOpen, setWhat3WordsPickerOpen] = useState(false);
  const [what3WordsPickerLoading, setWhat3WordsPickerLoading] = useState(false);
  const [what3WordsPickerError, setWhat3WordsPickerError] = useState("");


  const googleMapsApiKey = String((ENV.VITE_GOOGLE_MAPS_API_KEY ?? "")).trim();
  const what3wordsApiKey = String((ENV.VITE_WHAT3WORDS_API_KEY ?? "")).trim();

async function handleWhat3WordsMapPick(lat: number, lng: number) {
  if (!selectedClient || !selectedEstimate) return;

  setWhat3WordsPickerLoading(true);
  setWhat3WordsPickerError("");

  let resolvedWords = "";

  try {
    if (what3wordsApiKey) {
      const words = await convertCoordinatesToWhat3Words(lat, lng, what3wordsApiKey);
      if (words === "__W3W_PAID_REQUIRED__") {
        setWhat3WordsPickerError("Auto-fill requires a paid what3words API plan. Please go to what3words and select the location, then copy the what3words address and paste it into the field manually. Coordinates were still captured and saved from this map click.");
      } else if (!words) {
        setWhat3WordsPickerError("No what3words address could be resolved for that map point. Coordinates were still captured and saved from this map click.");
      } else {
        resolvedWords = words;
      }
    } else {
      setWhat3WordsPickerError("what3words API key missing. Add VITE_WHAT3WORDS_API_KEY to .env.local. Coordinates were still captured and saved from this map click.");
    }

    const updatedEstimate: Estimate = mergeEstimateLocationState({
      ...selectedEstimate,
      what3words: resolvedWords || selectedEstimate.what3words || "",
      latitude: lat,
      longitude: lng,
    });

    setClients((prev) =>
      prev.map((c) =>
        c.id !== selectedClient.id
          ? c
          : {
              ...c,
              estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : updatedEstimate)),
            }
      )
    );

    updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch(() => {});
    setWhat3WordsPickerOpen(false);
  } catch {
    setWhat3WordsPickerError("Failed to resolve what3words for that map point. Coordinates were still captured and saved from this map click.");

    const updatedEstimate: Estimate = mergeEstimateLocationState({
      ...selectedEstimate,
      latitude: lat,
      longitude: lng,
    });

    setClients((prev) =>
      prev.map((c) =>
        c.id !== selectedClient.id
          ? c
          : {
              ...c,
              estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : updatedEstimate)),
            }
      )
    );

    updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch(() => {});
  } finally {
    setWhat3WordsPickerLoading(false);
  }
}



  function updateSelectedEstimateLocation(nextEstimate: Estimate) {
    if (!selectedClient || !selectedEstimate) return;

    const normalizedEstimate = mergeEstimateLocationState(nextEstimate);

    setClients((prev) => {
      const nextClients = prev.map((c) =>
        c.id !== selectedClient.id
          ? c
          : {
              ...c,
              estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : normalizedEstimate)),
            }
      );

      updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, normalizedEstimate)).catch((error) => {
        console.error("Failed to update estimate location", error);
      });

      return nextClients;
    });
  }

  function updateSelectedEstimateProjectAddress(patch: Partial<Address>) {
    if (!selectedEstimate) return;
    const currentStructured = resolveStructuredAddress(
      selectedEstimate.projectAddressStructured,
      selectedEstimate.projectAddress || ""
    );
    const nextStructured: Address = { ...currentStructured, ...patch };
    const nextProjectAddress = buildAddressString(nextStructured);
    const nextEstimate: Estimate = {
      ...selectedEstimate,
      projectAddressStructured: nextStructured,
      projectAddress: nextProjectAddress,
      postcode: nextStructured.postcode || extractPostcodeFromAddress(nextProjectAddress),
    };
    updateSelectedEstimateLocation(nextEstimate);
  }
  function clientMatchesFilter(c: Client): boolean {
    if (clientDbFilter === "All") return true;
    const wanted = clientDbFilter === "Orders" ? "Order" : clientDbFilter === "Lost" ? "Lost" : "Open";
    return (c.estimates ?? []).some((e) => (((e as any).outcome ?? "Open") as Models.EstimateOutcome) === wanted);
  }


  function persistEstimateOutcome(
    clientId: Models.ClientId,
    estimateId: Models.EstimateId,
    outcome: Models.EstimateOutcome
  ) {
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== estimateId) return e;
            updatedEstimate = { ...e, outcome } as Estimate;
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(estimateId, buildDbEstimatePayload(clientId, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate outcome", error);
        });
      }

      return nextClients;
    });
  }
  const filteredClients = useMemo(() => {
    const q = clientDbSearch.trim().toLowerCase();

    const list = clients.filter((c) => {
      if (!clientMatchesFilter(c)) return false;
      if (!q) return true;

      const name = (c.type === "Business" ? (c.businessName || c.clientName) : c.clientName) || "";
      const hay = [
        name,
        c.clientRef || "",
        c.projectName || "",
        c.projectAddress || "",
        c.email || "",
        c.mobile || "",
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    const clientRefNumber = (value: string) => {
      const digits = (value || "").match(/\d+/g);
      return digits ? Number(digits.join("")) : 0;
    };

    list.sort((a, b) => {
      const nameA = ((a.type === "Business" ? (a.businessName || a.clientName) : a.clientName) || "").toLowerCase();
      const nameB = ((b.type === "Business" ? (b.businessName || b.clientName) : b.clientName) || "").toLowerCase();
      const projectA = (a.projectName || "").toLowerCase();
      const projectB = (b.projectName || "").toLowerCase();
      const refA = clientRefNumber(a.clientRef || "");
      const refB = clientRefNumber(b.clientRef || "");

      let result = 0;
      if (clientDbSortField === "client_number") result = refA - refB;
      else if (clientDbSortField === "project_name") result = projectA.localeCompare(projectB);
      else result = nameA.localeCompare(nameB);

      return clientDbSort === "asc" ? result : -result;
    });

    return list;
  }, [clients, clientDbSearch, clientDbFilter, clientDbSort, clientDbSortField]);


  function selectMenu(k: Models.MenuKey) {
    setMenu(k);
    setView("customers");
    setSelectedClientId(null);
    setSelectedEstimateId(null);
    setEstimatePickerClientId(null);
    estimatePickerRef.current?.clear();
    setShowAddClient(false);
    setShowPositionWizard(false);
  }

  function openEstimateDefaults(clientId: string, estimateId: string) {
    setSelectedClientId(clientId);
    setSelectedEstimateId(estimateId);
    setView("estimate_defaults");
    setShowPositionWizard(false);
  }

  
function createEstimateForClient(client: Client) {
    const year = new Date().getFullYear();
    const base = nextEstimateBaseRef(year, estimateCounter);
    const estimateDefaults = systemSettings.loadDefaults ? makeDefaultEstimateDefaults() : makeBlankEstimateDefaults();

    const est: Estimate = mergeEstimateLocationState({
      id: Models.asEstimateId(uid()),
      estimateRef: estimateRefWithRevision(base, 0),
      baseEstimateRef: base,
      revisionNo: 0,
      status: "Draft",
      estimatedOrderMonth: ORDER_MONTHS[new Date().getMonth()],
      estimatedOrderYear: new Date().getFullYear(),
      defaults: estimateDefaults,
      positions: [],
      projectAddress: "",
      projectAddressStructured: emptyAddress(),
      postcode: "",
      what3words: "",
      latitude: null,
      longitude: null,
    });

    setEstimateCounter((n) => n + 1);

    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, estimates: [est, ...c.estimates] } : c)));

    createEstimateAPI(buildDbEstimatePayload(client.id, est)).catch((error) => {
      console.error("Failed to create estimate", error);
    });

    // go to Supplier & Product Defaults screen immediately
    openEstimateDefaults(client.id, est.id);
  }

  function copyEstimateForClient(client: Client, sourceEstimateId: Models.EstimateId) {
    const sourceEstimate = client.estimates.find((e) => e.id === sourceEstimateId);
    if (!sourceEstimate) return;

    const year = new Date().getFullYear();
    const base = nextEstimateBaseRef(year, estimateCounter);

    const copiedEstimate: Estimate = mergeEstimateLocationState({
      ...sourceEstimate,
      id: Models.asEstimateId(uid()),
      estimateRef: estimateRefWithRevision(base, 0),
      baseEstimateRef: base,
      revisionNo: 0,
      status: "Draft",
      defaults: { ...sourceEstimate.defaults },
      positions: (sourceEstimate.positions ?? []).map((p) => ({
        ...p,
        id: Models.asPositionId(uid()),
        cellInsertions: { ...(p.cellInsertions ?? {}) },
        overrides: { ...(p.overrides ?? {}) },
        colWidthsMm: p.colWidthsMm ? [...p.colWidthsMm] : undefined,
        rowHeightsMm: p.rowHeightsMm ? [...p.rowHeightsMm] : undefined,
      })),
    });

    setEstimateCounter((n) => n + 1);

    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, estimates: [copiedEstimate, ...c.estimates] } : c))
    );
  }
function deleteEstimatesForClient(clientId: Models.ClientId, estimateIds: Models.EstimateId[]) {
  if (!estimateIds.length) return;

  const deletedAt = new Date().toISOString();
  const estimatesToDelete =
    clients.find((c) => c.id === clientId)?.estimates.filter((e) => estimateIds.includes(e.id)) ?? [];

  if (!estimatesToDelete.length) return;

  setDeletedEstimatesByClientId((prev) => ({
    ...prev,
    [clientId]: [
      ...(prev[clientId] ?? []),
      ...estimatesToDelete.map((estimate) => ({ estimate, deletedAt })),
    ],
  }));

  setClients((prev) =>
    prev.map((c) =>
      c.id !== clientId ? c : { ...c, estimates: c.estimates.filter((e) => !estimateIds.includes(e.id)) }
    )
  );

  if (selectedClientId === clientId && selectedEstimateId && estimateIds.includes(selectedEstimateId)) {
    setSelectedEstimateId(null);
  }
}

function restoreDeletedEstimatesForClient(clientId: Models.ClientId, estimateIds: Models.EstimateId[]) {
  if (!estimateIds.length) return;

  const records = deletedEstimatesByClientId[clientId] ?? [];
  const toRestore = records.filter((r) => estimateIds.includes(r.estimate.id)).map((r) => r.estimate);

  if (!toRestore.length) return;

  setClients((prev) =>
    prev.map((c) => (c.id !== clientId ? c : { ...c, estimates: [...toRestore, ...c.estimates] }))
  );

  setDeletedEstimatesByClientId((prev) => ({
    ...prev,
    [clientId]: (prev[clientId] ?? []).filter((r) => !estimateIds.includes(r.estimate.id)),
  }));
}

function purgeDeletedEstimatesForClient(clientId: Models.ClientId, estimateIds?: Models.EstimateId[]) {
  setDeletedEstimatesByClientId((prev) => {
    const current = prev[clientId] ?? [];
    const next = estimateIds?.length ? current.filter((r) => !estimateIds.includes(r.estimate.id)) : [];
    return { ...prev, [clientId]: next };
  });
}

  function setEstimateInstaller(clientId: Models.ClientId, estimateId: Models.EstimateId, installerId: string) {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) =>
            e.id !== estimateId
              ? e
              : {
                  ...e,
                  orderMeta: {
                    ...(e.orderMeta ?? {}),
                    timeline: e.orderMeta?.timeline ?? [],
                    installerId,
                  },
                }
          ),
        };
      })
    );
  }

  function updateEstimateOrderMeta(clientId: Models.ClientId, estimateId: Models.EstimateId, patch: Record<string, any>) {
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== estimateId) return e;

            const currentMeta = {
              timeline: e.orderMeta?.timeline ?? [],
              ...(e.orderMeta ?? {}),
            } as any;

            const nextMeta = {
              ...currentMeta,
              ...patch,
            };

            if (typeof nextMeta.productionWeeks === "number" && nextMeta.productionStartDate) {
              const start = new Date(nextMeta.productionStartDate + "T00:00:00");
              if (!Number.isNaN(start.getTime())) {
                const end = new Date(start);
                end.setDate(end.getDate() + (nextMeta.productionWeeks * 7));
                nextMeta.productionEndDate = end.toISOString().slice(0, 10);

                const due = new Date(end);
                due.setDate(due.getDate() - 14);
                nextMeta.balanceInvoiceDueDate = due.toISOString().slice(0, 10);
              }
            }

            updatedEstimate = {
              ...e,
              orderMeta: nextMeta,
            };

            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(estimateId, buildDbEstimatePayload(clientId, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate order meta", error);
        });
      }

      return nextClients;
    });
  }


  function updateEstimatePosition(
    clientId: Models.ClientId,
    estimateId: Models.EstimateId,
    positionId: string,
    patch: {
      positionRef?: string;
      roomName?: string;
      qty?: number;
      itemPrice?: number;
      widthMm?: number;
      heightMm?: number;
      insertion?: string;
      positionType?: "Window" | "Door";
    }
  ) {
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== estimateId) return e;

            updatedEstimate = {
              ...e,
              positions: e.positions.map((p) => {
                if (p.id !== positionId) return p;
                const nextQty = patch.qty == null ? p.qty : Math.max(1, Math.round(patch.qty));
                const nextWidth = patch.widthMm == null ? p.widthMm : clampNum(Math.round(patch.widthMm), 300, 6000);
                const nextHeight = patch.heightMm == null ? p.heightMm : clampNum(Math.round(patch.heightMm), 300, 6000);
                return {
                  ...p,
                  ...patch,
                  qty: nextQty,
                  widthMm: nextWidth,
                  heightMm: nextHeight,
                };
              }),
            };

            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(estimateId, buildDbEstimatePayload(clientId, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate position", error);
        });
      }

      return nextClients;
    });
  }

  function estimateCommercialTotals(est: Estimate | null) {
    const positions = est?.positions ?? [];
    const totalSquareMetres = positions.reduce((sum, p) => sum + ((Number(p.widthMm || 0) * Number(p.heightMm || 0)) / 1000000) * Math.max(1, Number(p.qty || 1)), 0);
    const totalLinearMetres = positions.reduce((sum, p) => sum + (((2 * Number(p.widthMm || 0)) + (2 * Number(p.heightMm || 0))) / 1000) * Math.max(1, Number(p.qty || 1)), 0);
    const totalQty = positions.reduce((sum, p) => sum + Math.max(1, Number(p.qty || 1)), 0);
    const estimateTotal = positions.reduce((sum, p) => sum + (Number(p.itemPrice || 0) * Math.max(1, Number(p.qty || 1))), 0);
    return { totalSquareMetres, totalLinearMetres, totalQty, estimateTotal };
  }

  function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

  function formatMeasure(n: number) {
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function openClient(client: Client) {
  setSelectedClientId(client.id);

  // Store the selected client in App state first, then switch view.
  // (Fixes blank screen: ref isn''t mounted yet when called from Customers list)
  setEstimatePickerClientId(client.id);
  setView("estimate_picker");
}

function startAddPosition() {
    if (!selectedEstimate) return;

    const nextIndex = (selectedEstimate.positions?.length ?? 0) + 1;

    setPosStep(1);
    setDraftSelectedCell({ col: 0, row: 0 });
    setPosDraft({
      id: Models.asPositionId(uid()),
      positionRef: `W-${pad3(nextIndex)}`,
      qty: 1,
      roomName: "",
      widthMm: 1000,
      heightMm: 1200,
      fieldsX: 1,
      fieldsY: 1,
      insertion: "Fixed",
      positionType: "Window",
      useEstimateDefaults: true,
      overrides: {},
      cellInsertions: { "0,0": "Fixed" },
    });
    setShowPositionWizard(true);
  }

  function savePositionToEstimate() {
    if (!selectedClient || !selectedEstimate) return;

    const newPos: Position = {
      ...posDraft,
      id: Models.asPositionId(uid()),
      widthMm: clampNum(Math.round(posDraft.widthMm || 0), 300, 6000),
      heightMm: clampNum(Math.round(posDraft.heightMm || 0), 300, 6000),
      fieldsX: clampNum(Math.round(posDraft.fieldsX || 1), 1, 16),
      fieldsY: clampNum(Math.round(posDraft.fieldsY || 1), 1, 16),
      cellInsertions: normalizeCellInsertions(posDraft.fieldsX, posDraft.fieldsY, posDraft.cellInsertions, posDraft.insertion),
    };

    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            updatedEstimate = { ...e, positions: [newPos, ...e.positions] };
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch((error) => {
          console.error("Failed to save added position", error);
        });
      }

      return nextClients;
    });

    setShowPositionWizard(false);
    setPosStep(1);
  }

  function stepLabel(s: 1 | 2 | 3) {
    return s === 1 ? "Position" : s === 2 ? "Dimensions" : "Configuration";
  }

  function effectiveDefaultsForPosition(est: Estimate, pos: Position): EstimateDefaults {
    if (pos.useEstimateDefaults) return est.defaults;
    return { ...est.defaults, ...pos.overrides };
  }

  function setEstimateDefaults(next: EstimateDefaults) {
    if (!selectedClient || !selectedEstimate) return;
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            updatedEstimate = { ...e, defaults: next };
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate defaults", error);
        });
      }

      return nextClients;
    });
  }

  function setEstimateForecast(next: { estimatedOrderMonth?: string; estimatedOrderYear?: number }) {
    if (!selectedClient || !selectedEstimate) return;
    setClients((prev) => {
      let updatedEstimate: Estimate | null = null;

      const nextClients = prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            updatedEstimate = {
              ...e,
              estimatedOrderMonth: next.estimatedOrderMonth ?? e.estimatedOrderMonth,
              estimatedOrderYear: next.estimatedOrderYear ?? e.estimatedOrderYear,
            };
            return updatedEstimate;
          }),
        };
      });

      if (updatedEstimate) {
        updateEstimateAPI(selectedEstimate.id, buildDbEstimatePayload(selectedClient.id, updatedEstimate)).catch((error) => {
          console.error("Failed to update estimate forecast", error);
        });
      }

      return nextClients;
    });
  }

  function setPositionDefaultsOverride(next: EstimateDefaults) {
    setPosDraft((p) => ({ ...p, overrides: { ...next } }));
  }

  function createClient(type: ClientType) {
    const customerAddressStructured: Address = {
      line1: draftCustAddress1.trim(),
      line2: draftCustAddress2.trim(),
      line3: draftCustAddress3.trim(),
      town: draftCustTown.trim(),
      city: draftCustCity.trim(),
      county: draftCustCounty.trim(),
      postcode: draftCustPostcode.trim(),
    };

    const customInvoiceAddressStructured: Address = {
      line1: draftInvAddress1.trim(),
      line2: draftInvAddress2.trim(),
      line3: draftInvAddress3.trim(),
      town: draftInvTown.trim(),
      city: draftInvCity.trim(),
      county: draftInvCounty.trim(),
      postcode: draftInvPostcode.trim(),
    };

    const customerAddress = buildAddressString(customerAddressStructured) || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddressStructured =
      invoiceAddressMode === "customer"
        ? { ...customerAddressStructured }
        : { ...customInvoiceAddressStructured };

    const invoiceAddress = buildAddressString(invoiceAddressStructured) || customerAddress;

    const projectAddress = (() => {
      try {
        return localStorage.getItem("qs_project_address") || "";
      } catch {
        return "";
      }
    })();
    const projectAddressStructured = resolveStructuredAddress(undefined, projectAddress);

    const businessName = draftBusinessName.trim();
    const contactPerson = draftContactName.trim();
    const clientName = type === "Business" ? businessName || "Business" : draftClientName.trim() || "Client";

    const newClient: Client = {
      id: Models.asClientId(uid()),
      type,
      clientRef: nextClientRef(clientCounter),
      clientName,
      email: draftEmail.trim(),
      mobile: draftMobile.trim(),
      home: draftHome.trim(),
      projectName: draftProjectName.trim(),
      what3words: draftWhat3Words.trim(),
      customerAddress,
      projectAddress,
      invoiceAddress,
      customerAddressStructured: resolveStructuredAddress(customerAddressStructured, customerAddress),
      projectAddressStructured,
      invoiceAddressStructured: resolveStructuredAddress(invoiceAddressStructured, invoiceAddress),
      postcode: extractPostcodeFromAddress(projectAddress),
      businessName: type === "Business" ? businessName : undefined,
      contactPerson: type === "Business" ? contactPerson : undefined,
      estimates: [],
    };

    fetch("http://localhost:3001/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDbClientPayload(newClient)),
    })
      .then(() => {
        setClients((prev) => [newClient, ...prev]);
        setClientCounter((n) => n + 1);
        setClientDbSearch("");
      })
      .catch(() => {});

    setShowAddClient(false);
    setDraftClientType("Individual");
    setDraftClientName("");
    setDraftBusinessName("");
    setDraftContactName("");
    setDraftWhat3Words("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
    setDraftCustAddress1("");
    setDraftCustAddress2("");
    setDraftCustAddress3("");
    setDraftCustTown("");
    setDraftCustCity("");
    setDraftCustCounty("");
    setDraftCustPostcode("");
    setDraftProjAddress1("");
    setDraftProjAddress2("");
    setDraftProjAddress3("");
    setDraftProjTown("");
    setDraftProjCity("");
    setDraftProjCounty("");
    setDraftProjPostcode("");

    setInvoiceAddressMode("customer");
    setDraftInvAddress1("");
    setDraftInvAddress2("");
    setDraftInvAddress3("");
    setDraftInvTown("");
    setDraftInvCity("");
    setDraftInvCounty("");
    setDraftInvPostcode("");
    setCustomerAddressSectionOpen(false);
      setInvoiceAddressSectionOpen(false);
  }


  function openAddClientPanel() {
    setEditingClientId(null);
    setDraftClientType("Individual");
    setDraftClientName("");
    setDraftBusinessName("");
    setDraftContactName("");
    setDraftWhat3Words("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
    setDraftProjectName("");
    setDraftWhat3Words("");
    setDraftCustAddress1("");
    setDraftCustAddress2("");
    setDraftCustAddress3("");
    setDraftCustTown("");
    setDraftCustCity("");
    setDraftCustCounty("");
    setDraftCustPostcode("");
    setDraftProjAddress1("");
    setDraftProjAddress2("");
    setDraftProjAddress3("");
    setDraftProjTown("");
    setDraftProjCity("");
    setDraftProjCounty("");
    setDraftProjPostcode("");

    setInvoiceAddressMode("customer");
    setDraftInvAddress1("");
    setDraftInvAddress2("");
    setDraftInvAddress3("");
    setDraftInvTown("");
    setDraftInvCity("");
    setDraftInvCounty("");
    setDraftInvPostcode("");
    setCustomerAddressSectionOpen(false);
      setInvoiceAddressSectionOpen(false);
    setShowAddClient(true);
  }


  const globalEstimateRows = useMemo(() => {
    return clients.flatMap((client) =>
      client.estimates.map((estimate) => {
        const outcome = ((estimate as any).outcome ?? "Open") as Models.EstimateOutcome;
        const installerId = estimate.orderMeta?.installerId;
        return {
          client,
          estimate,
          outcome,
          installerId,
        };
      })
    );
  }, [clients]);

  function clientRefNumber(value: string) {
    const digits = (value || "").match(/\d+/g);
    return digits ? Number(digits.join("")) : 0;
  }

  function clientDisplayName(client: Client) {
    return client.type === "Business" ? (client.businessName || client.clientName) : client.clientName;
  }

  function matchesGlobalStatus(
    row: { client: Client; estimate: Estimate; outcome: Models.EstimateOutcome; installerId?: string },
    menuKey: "estimates" | "orders" | "lost" | "installation"
  ) {
    if (menuKey === "estimates") return row.outcome === "Open";
    if (menuKey === "orders") return row.outcome === "Order";
    if (menuKey === "lost") return row.outcome === "Lost";
    if (menuKey === "installation") return row.outcome === "Order" && !!row.installerId;
    return false;
  }

  function filteredGlobalRows(menuKey: "estimates" | "orders" | "lost" | "installation") {
      

    const q = globalSearch.trim().toLowerCase();

    const rows = globalEstimateRows.filter((row) => {
      if (!matchesGlobalStatus(row, menuKey)) return false;
      if (globalMonthFilter !== "All" && row.estimate.estimatedOrderMonth !== globalMonthFilter) return false;
      if (!q) return true;

      const totals = estimateCommercialTotals(row.estimate);
      const hay = [
        clientDisplayName(row.client),
        row.client.clientRef || "",
        row.client.projectName || "",
        row.client.mobile || "",
        row.client.home || "",
        row.estimate.estimateRef || "",
        row.estimate.estimatedOrderMonth || "",
        row.estimate.estimatedOrderYear ? String(row.estimate.estimatedOrderYear) : "",
        formatMoney(totals.estimateTotal),
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    rows.sort((a, b) => {
      const totalsA = estimateCommercialTotals(a.estimate);
      const totalsB = estimateCommercialTotals(b.estimate);

      let result = 0;
      if (globalSortField === "client_number") {
        result = clientRefNumber(a.client.clientRef || "") - clientRefNumber(b.client.clientRef || "");
      } else if (globalSortField === "project_name") {
        result = (a.client.projectName || "").localeCompare(b.client.projectName || "", undefined, { sensitivity: "base" });
      } else if (globalSortField === "total_cost") {
        result = totalsA.estimateTotal - totalsB.estimateTotal;
      } else {
        result = clientDisplayName(a.client).localeCompare(clientDisplayName(b.client), undefined, { sensitivity: "base" });
      }

      return globalSort === "asc" ? result : -result;
    });

    return rows;
  }

  const installationRowsForBoard = useMemo(() => filteredGlobalRows("installation"), [globalEstimateRows, globalSearch, globalSort, globalSortField, globalMonthFilter]);

  const estimateMapRowsForBoard = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    const rows = globalEstimateRows.filter((row) => {
      if (row.outcome !== "Open") return false;
      if (globalMonthFilter !== "All" && row.estimate.estimatedOrderMonth !== globalMonthFilter) return false;
      if (!q) return true;

      const totals = estimateCommercialTotals(row.estimate);
      const hay = [
        clientDisplayName(row.client),
        row.client.clientRef || "",
        row.client.projectName || "",
        row.client.mobile || "",
        row.client.home || "",
        row.estimate.postcode || "",
        row.estimate.what3words || "",
        row.estimate.projectAddress || "",
        row.estimate.estimateRef || "",
        row.estimate.estimatedOrderMonth || "",
        row.estimate.estimatedOrderYear ? String(row.estimate.estimatedOrderYear) : "",
        formatMoney(totals.estimateTotal),
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    rows.sort((a, b) => {
      const totalsA = estimateCommercialTotals(a.estimate);
      const totalsB = estimateCommercialTotals(b.estimate);

      let result = 0;
      if (globalSortField === "client_number") {
        result = clientRefNumber(a.client.clientRef || "") - clientRefNumber(b.client.clientRef || "");
      } else if (globalSortField === "project_name") {
        result = (a.client.projectName || "").localeCompare(b.client.projectName || "", undefined, { sensitivity: "base" });
      } else if (globalSortField === "total_cost") {
        result = totalsA.estimateTotal - totalsB.estimateTotal;
      } else {
        result = clientDisplayName(a.client).localeCompare(clientDisplayName(b.client), undefined, { sensitivity: "base" });
      }

      return globalSort === "asc" ? result : -result;
    });

    return rows;
  }, [globalEstimateRows, globalSearch, globalSort, globalSortField, globalMonthFilter]);

  useEffect(() => {
    if (!googleMapsApiKey || !mapsApiReady) return;

    const sourceRows = [...installationRowsForBoard, ...estimateMapRowsForBoard];

    let cancelled = false;

    async function loadResolvedLocations() {
      const nextEntries = await Promise.all(
        sourceRows.map(async ({ client, estimate }) => {
          if (resolvedLocationsByClientId[estimate.id] && resolvedLocationsByClientId[estimate.id] !== null) {
            return null;
          }

          try {
            const resolved = await resolveEstimateLocation(estimate, client, { googleMapsApiKey, what3wordsApiKey });
            return [estimate.id, resolved] as const;
          } catch (error) {
            console.error("Location resolution failed", estimate.id, error);
            return [estimate.id, null] as const;
          }
        })
      );

      if (cancelled) return;

      setResolvedLocationsByClientId((prev) => {
        const next = { ...prev };
        let changed = false;

        nextEntries.forEach((entry) => {
          if (!entry) return;
          const [estimateId, resolved] = entry;
          const current = prev[estimateId];
          const shouldWrite =
            resolved
              ? !current || current.lat !== resolved.lat || current.lng !== resolved.lng || current.label !== resolved.label
              : current === undefined;

          if (shouldWrite) {
            next[estimateId] = resolved;
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }

    loadResolvedLocations();

    return () => {
      cancelled = true;
    };
  }, [googleMapsApiKey, what3wordsApiKey, installationRowsForBoard, estimateMapRowsForBoard, mapsApiReady]);

  useEffect(() => {
    setSelectedMapEstimateId(null);
  }, [menu]);

  function globalSummaryForRows(rows: ReturnType<typeof filteredGlobalRows>) {
    return rows.reduce(
      (acc, row) => {
        const totals = estimateCommercialTotals(row.estimate);
        acc.count += 1;
        acc.totalSquareMetres += totals.totalSquareMetres;
        acc.totalLinearMetres += totals.totalLinearMetres;
        acc.totalQty += totals.totalQty;
        acc.totalCost += totals.estimateTotal;
        return acc;
      },
      { count: 0, totalSquareMetres: 0, totalLinearMetres: 0, totalQty: 0, totalCost: 0 }
    );
  }

  function toggleGlobalSelectMode(menuKey: "estimates" | "orders" | "lost") {
    setGlobalSelectModeByMenu((prev) => {
      const enabled = !prev[menuKey];
      return { ...prev, [menuKey]: enabled };
    });
    setGlobalSelectedEstimateIdsByMenu((prev) => ({
      ...prev,
      [menuKey]: {},
    }));
  }

  function toggleGlobalEstimateSelection(menuKey: "estimates" | "orders" | "lost", estimateId: Models.EstimateId, checked: boolean) {
    setGlobalSelectedEstimateIdsByMenu((prev) => ({
      ...prev,
      [menuKey]: {
        ...(prev[menuKey] ?? {}),
        [estimateId]: checked,
      },
    }));
  }

  function deleteSelectedGlobalEstimates(menuKey: "estimates" | "orders" | "lost") {
    const selectedMap = globalSelectedEstimateIdsByMenu[menuKey] ?? {};
    const rows = filteredGlobalRows(menuKey).filter((row) => !!selectedMap[row.estimate.id]);

    const idsByClient = rows.reduce((acc, row) => {
      const key = row.client.id;
      acc[key] = [...(acc[key] ?? []), row.estimate.id];
      return acc;
    }, {} as Record<string, Models.EstimateId[]>);

    Object.entries(idsByClient).forEach(([clientId, ids]) => {
      deleteEstimatesForClient(clientId as Models.ClientId, ids);
    });

    setGlobalSelectedEstimateIdsByMenu((prev) => ({
      ...prev,
      [menuKey]: {},
    }));
    setGlobalSelectModeByMenu((prev) => ({
      ...prev,
      [menuKey]: false,
    }));
  }

  const recycleBinRows = useMemo(() => {
    return clients.flatMap((client) =>
      (deletedEstimatesByClientId[client.id] ?? []).map((record) => ({
        client,
        estimate: record.estimate,
        deletedAt: record.deletedAt,
      }))
    );
  }, [clients, deletedEstimatesByClientId]);

  function renderRecycleBinMenu() {
    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <H2>Recycle Bin</H2>
              <Small>Deleted estimates are held here for up to 30 days unless purged sooner.</Small>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                clients.forEach((client) => purgeDeletedEstimatesForClient(client.id));
              }}
              disabled={recycleBinRows.length === 0}
            >
              Purge All
            </Button>
          </div>

          <div style={{ border: "1px solid #e4e4e7", borderRadius: 14, background: "#fff", overflow: "hidden", minHeight: 0 }}>
            <div style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    {[
						["Client Name", "left"],
						["Client Number", "left"],
						["Estimate Ref", "left"],
						["Project Name", "left"],
						["Deleted", "left"],
						["Restore", "right"],
						["Delete Permanently", "right"],
						].map(([label, align]) => (
                      <th
                        key={label}
                        style={{
                          textAlign: align as "left" | "right",
                          padding: 10,
                          fontSize: 12,
                          borderBottom: "1px solid #e4e4e7",
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          background: "#fafafa",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recycleBinRows.map(({ client, estimate, deletedAt }) => (
                    <tr key={`${client.id}_${estimate.id}`}>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", fontWeight: 700 }}>{clientDisplayName(client)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{client.clientRef}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{estimate.estimateRef}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{client.projectName || ""}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{new Date(deletedAt).toLocaleString()}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>
                        <Button variant="secondary" onClick={() => restoreDeletedEstimatesForClient(client.id, [estimate.id])}>Restore</Button>
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>
                        <Button variant="secondary" onClick={() => purgeDeletedEstimatesForClient(client.id, [estimate.id])}>Delete Permanently</Button>
                      </td>
                    </tr>
                  ))}
                  {recycleBinRows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 16 }}>
                        <Small>No deleted estimates.</Small>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  function openEstimateFromGlobalMenu(clientId: Models.ClientId, estimateId: Models.EstimateId) {
    setMenu("client_database");
    openEstimateDefaults(clientId, estimateId);
  }


  function installationKeyDate(date?: string) {
    return date || "";
  }

  function installationClientLocationLabel(client: Client) {
    if (client.what3words) return `what3words: ${client.what3words}`;
    if (client.postcode) return `Postcode: ${client.postcode}`;
    const firstLine = (client.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim())[0];
    return firstLine ? `Address: ${firstLine}` : "Address unavailable";
  }

  function installationProjectAddressLabel(client: Client) {
    const lines = (client.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
    if (!lines.length) return client.postcode || "Address unavailable";
    return lines.join(", ");
  }

  function installationWhat3WordsLabel(client: Client) {
    return client.what3words || "Not set";
  }

  function estimateLocationLabel(estimate: Estimate) {
    if (estimate.what3words) return `what3words: ${estimate.what3words}`;
    if (estimate.postcode) return `Postcode: ${estimate.postcode}`;
    const firstLine = (estimate.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean)[0];
    return firstLine ? `Address: ${firstLine}` : "Address unavailable";
  }

  function estimateProjectAddressLabel(estimate: Estimate) {
    const lines = (estimate.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
    if (!lines.length) return estimate.postcode || "Address unavailable";
    return lines.join(", ");
  }

  function scrollMapRowIntoView(prefix: "installation-row" | "estimate-map-row", estimateId: Models.EstimateId) {
    if (typeof document === "undefined") return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`${prefix}-${estimateId}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  
function renderInstallationBoard() {
    const rows = filteredGlobalRows("installation");
    const summary = globalSummaryForRows(rows);
    const mapItems: GoogleMapMarkerItem[] = rows.flatMap(({ client, estimate }) => {
      const resolved = resolvedLocationsByClientId[estimate.id];
      if (!resolved) return [];
      return [
        {
          id: estimate.id,
          lat: resolved.lat,
          lng: resolved.lng,
          title: clientDisplayName(client),
          subtitle: resolved.label,
          variant: "installation",
        },
      ];
    });

    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0, height: "100%", gridTemplateRows: "auto auto 1fr" }}>
          <div>
            <H2>Installation</H2>
            <Small>Operational installation view with expandable project detail on the left and live map on the right.</Small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Open installations</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{summary.count}</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total mÃƒâ€šÃ‚Â²</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(summary.totalSquareMetres)}</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{summary.totalQty}</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total order value</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(summary.totalCost)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>
            <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 10, alignContent: "start", paddingRight: 4 }}>
              {rows.map(({ client, estimate }) => {
                const isExpanded = installationExpandedEstimateId === estimate.id;
                const activeTab = installationTabByEstimateId[estimate.id] ?? "key_dates";
                const totals = estimateCommercialTotals(estimate);
                const keyDates = estimate.orderMeta ?? {};
                const headline = clientDisplayName(client);

                return (
                  <div
                    id={`installation-row-${estimate.id}`}
                    key={estimate.id}
                    style={{
                      borderRadius: 16,
                      border: isExpanded ? "2px solid #18181b" : "1px solid #e4e4e7",
                      background: "#fff",
                      padding: 12,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      
                      onClick={() => {
                        setSelectedMapEstimateId(estimate.id);
                        setInstallationExpandedEstimateId((prev) => (prev === estimate.id ? null : estimate.id));
                      }}
                      style={{ cursor: "pointer", display: "grid", gap: 10 }}
                    >
                      <div
                       style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr 1.15fr 1.2fr 88px", gap: 16, alignItems: "start" }}>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", marginBottom: 4 }}>Client Name</div>
                          <div
                       style={{ fontSize: 14, fontWeight: 900, color: "#18181b", lineHeight: 1.35 }}>{headline}</div>
                        </div>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", marginBottom: 4 }}>Order Ref</div>
                          <div
                       style={{ fontSize: 14, fontWeight: 800, color: "#18181b", lineHeight: 1.35 }}>{estimate.estimateRef}</div>
                        </div>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", marginBottom: 4 }}>Project Name</div>
                          <div
                       style={{ fontSize: 14, fontWeight: 700, color: "#18181b", lineHeight: 1.35 }}>{client.projectName || ""}</div>
                        </div>
                        <div
                      >
                          <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", marginBottom: 4 }}>Key Dates</div>
                          <div
                       style={{ fontSize: 12, color: "#3f3f46", lineHeight: 1.55 }}>
                            <div
                      >Dispatch Date<br />{installationKeyDate(keyDates.factoryDispatchDate)}</div>
                            <div
                       style={{ marginTop: 6 }}>Delivery Date<br />{installationKeyDate(keyDates.deliveryDate)}</div>
                            <div
                       style={{ marginTop: 6 }}>Installation Date<br />{installationKeyDate(keyDates.installationDate)}</div>
                          </div>
                        </div>
                        <div
                       style={{ alignSelf: "center", justifySelf: "end", fontSize: 12, fontWeight: 900, color: "#3f3f46", whiteSpace: "nowrap" }}>
                          {isExpanded ? "Hide detail" : "Expand"}
                        </div>
                      </div>

                      <div
                       style={{ display: "grid", gap: 6 }}>
                        <div
                       style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                          Project Address: <span style={{ fontWeight: 700 }}>{installationProjectAddressLabel(client)}</span>
                        </div>
                        <div
                       style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                          what3words: <span style={{ fontWeight: 700 }}>{installationWhat3WordsLabel(client)}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                       style={{ display: "grid", gap: 12 }}>
                        <div
                       style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {[
                            ["key_dates", "Key Dates"],
                            ["order_copy", "Confirmed Order"],
                            ["project_calculator", "Project Calculator"],
                          ].map(([tabKey, label]) => {
                            const active = activeTab === tabKey;
                            return (
                              <button
                                key={tabKey}
                                type="button"
                                onClick={() => setInstallationTabByEstimateId((prev) => ({ ...prev, [estimate.id]: tabKey as any }))}
                                style={{
                                  borderRadius: 999,
                                  border: active ? "none" : "1px solid #e4e4e7",
                                  background: active ? "#18181b" : "#fff",
                                  color: active ? "#fff" : "#18181b",
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {activeTab === "key_dates" && (
                          <div
                       style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 10 }}>
                            <div
                       style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10 }}>
                              {[
                                ["Client sign-off sent", keyDates.clientSignoffSentDate],
                                ["Client sign-off received", keyDates.clientSignoffReceivedDate],
                                ["Deposit paid", keyDates.depositPaidDate],
                                ["Factory order signed off", keyDates.factoryOrderSignedOffDate],
                                ["Factory invoice paid", keyDates.factoryInvoicePaidDate],
                                ["Production start", keyDates.productionStartDate],
                                ["Production end", keyDates.productionEndDate],
                                ["Balance invoice due", keyDates.balanceInvoiceDueDate],
                                ["Production completed", keyDates.productionCompletedDate],
                                ["Dispatch date", keyDates.factoryDispatchDate],
                                ["Delivery date", keyDates.deliveryDate],
                                ["Installation date", keyDates.installationDate],
                              ].map(([label, value]) => (
                                <div
                       key={String(label)} style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
                                  <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>{label}</div>
                                  <div
                       style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>{installationKeyDate(String(value || ""))}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeTab === "order_copy" && (
                          <div
                       style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", overflow: "hidden" }}>
                            <div
                       style={{ padding: 12, borderBottom: "1px solid #e4e4e7", display: "grid", gap: 4 }}>
                              <div
                       style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Confirmed order copy</div>
                              <Small>{estimate.positions.length} position(s) {formatMoney(totals.estimateTotal)}</Small>
                            </div>
                            <div
                       style={{ maxHeight: 320, overflow: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                                <thead>
                                  <tr style={{ background: "#fafafa" }}>
                                    {["Reference", "Room", "Description", "Qty", "Item price", "Quantity price"].map((label) => (
                                      <th key={label} style={{ textAlign: label === "Qty" || label === "Item price" || label === "Quantity price" ? "right" : "left", padding: 10, fontSize: 12, borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, background: "#fafafa" }}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {estimate.positions.map((position) => {
                                    const lineTotal = Number(position.itemPrice || 0) * Math.max(1, Number(position.qty || 1));
                                    return (
                                      <tr key={position.id}>
                                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", fontWeight: 800 }}>{position.positionRef}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{position.roomName || ""}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{position.positionType} {position.heightMm} mm</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>{position.qty}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>{formatMoney(Number(position.itemPrice || 0))}</td>
                                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right", fontWeight: 800 }}>{formatMoney(lineTotal)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {activeTab === "project_calculator" && (
                          <div
                       style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 10 }}>
                            <div
                       style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Project Calculator</div>
                            <Small>No saved project calculator payload exists in the current live data model yet, so this tab is reserved for the calculator integration phase.</Small>
                            <div
                       style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10 }}>
                              <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
                                <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Forecast</div>
                                <div
                       style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>{monthYearLabel(estimate.estimatedOrderMonth, estimate.estimatedOrderYear)}</div>
                              </div>
                              <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
                                <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total mÃƒâ€šÃ‚Â²</div>
                                <div
                       style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>{formatMeasure(totals.totalSquareMetres)}</div>
                              </div>
                              <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
                                <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
                                <div
                       style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>{totals.totalQty}</div>
                              </div>
                              <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
                                <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Order value</div>
                                <div
                       style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>{formatMoney(totals.estimateTotal)}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", background: "#fff", padding: 16 }}>
                  <Small>No installation items found.</Small>
                </div>
              )}
            </div>

            <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
              <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Installation Map</div>
                <Small>Google Maps view for all open installations using postcode, what3words, or project address fallback.</Small>
              </div>

              <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, minHeight: 0 }}>
                <GoogleMapPanel
                  apiKey={googleMapsApiKey}
                  items={mapItems}
                  selectedId={selectedMapEstimateId ?? installationExpandedEstimateId ?? undefined}
                  onSelect={(markerId) => {
                    const nextId = markerId as Models.EstimateId;
                    setSelectedMapEstimateId(nextId);
                    setInstallationExpandedEstimateId(nextId);
                    scrollMapRowIntoView("installation-row", nextId);
                  }}
                  onApiReady={() => setMapsApiReady(true)}
                  height={980}
                  emptyText="No installation locations could be resolved yet."
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }


function renderEstimateMapBoard() {
    const rows = estimateMapRowsForBoard;
    const summary = globalSummaryForRows(rows);
    const mapItems: GoogleMapMarkerItem[] = rows.flatMap(({ client, estimate }) => {
      const resolved = resolvedLocationsByClientId[estimate.id];
      if (!resolved) return [];
      return [
        {
          id: estimate.id,
          lat: resolved.lat,
          lng: resolved.lng,
          title: clientDisplayName(client),
          subtitle: resolved.label,
          variant: "open",
        },
      ];
    });

    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0, height: "100%", gridTemplateRows: "auto auto 1fr" }}>
          <div>
            <H2>Estimate Map</H2>
            <Small>All estimates plotted on Google Maps using postcode, what3words, or address fallback.</Small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Mapped estimates</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{mapItems.length}</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>All estimates</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{rows.length}</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total mÃƒâ€šÃ‚Â²</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(summary.totalSquareMetres)}</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total cost</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(summary.totalCost)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>
            <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 10, alignContent: "start", paddingRight: 4 }}>
              {rows.map(({ client, estimate, outcome, installerId }) => {
                const selected = selectedMapEstimateId === estimate.id;
                const totals = estimateCommercialTotals(estimate);
                return (
                  <button
                    id={`estimate-map-row-${estimate.id}`}
                    key={estimate.id}
                    type="button"
                    onClick={() => {
                      setSelectedMapEstimateId(estimate.id);
                      scrollMapRowIntoView("estimate-map-row", estimate.id);
                    }}
                    style={{
                      borderRadius: 16,
                      border: selected ? "2px solid #18181b" : "1px solid #e4e4e7",
                      background: "#fff",
                      padding: 12,
                      display: "grid",
                      gap: 10,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                       style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start" }}>
                      <div
                       style={{ display: "grid", gap: 4 }}>
                        <div
                       style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>{clientDisplayName(client)}</div>
                        <Small>{estimate.estimateRef} {client.clientRef}</Small>
                      </div>
                      <Pill>{installerId ? "Installation" : outcome}</Pill>
                    </div>
                    <div
                       style={{ display: "grid", gap: 4 }}>
                      <Small>{client.projectName || "No project name"}</Small>
                      <Small>{monthYearLabel(estimate.estimatedOrderMonth || "", estimate.estimatedOrderYear || 0)}</Small>
                      <Small>{estimateProjectAddressLabel(estimate)}</Small>
                      <Small>{estimateLocationLabel(estimate)}</Small>
                      <Small>{formatMeasure(totals.totalSquareMetres)} m {formatMoney(totals.estimateTotal)}</Small>
                    </div>
                    <div
                       style={{ display: "flex", justifyContent: "flex-start" }}>
                      <span
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEstimateFromGlobalMenu(client.id, estimate.id);
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
                        Open Estimate
                      </span>
                    </div>
                  </button>
                );
              })}

              {rows.length === 0 && (
                <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", background: "#fff", padding: 16 }}>
                  <Small>No estimates available for the map.</Small>
                </div>
              )}
            </div>

            <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
              <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Estimate Map</div>
                <Small>Marker colours reflect estimate outcome and installation allocation.</Small>
              </div>

              <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, minHeight: 0 }}>
                <GoogleMapPanel
                  apiKey={googleMapsApiKey}
                  items={mapItems}
                  selectedId={selectedMapEstimateId ?? undefined}
                  onSelect={(markerId) => {
                    const nextId = markerId as Models.EstimateId;
                    setSelectedMapEstimateId(nextId);
                    scrollMapRowIntoView("estimate-map-row", nextId);
                  }}
                  onApiReady={() => setMapsApiReady(true)}
                  height={980}
                  emptyText="No estimate locations could be resolved yet."
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  function renderGlobalEstimateMenu(
    title: string,
    menuKey: "estimates" | "orders" | "lost" | "installation",
    emptyText: string
  ) {
    const rows = filteredGlobalRows(menuKey);
    const summary = globalSummaryForRows(rows);

    return (
      <Card style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gap: 12, minHeight: 0, height: "100%", gridTemplateRows: "auto auto 1fr" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <H2>{title}</H2>
              <Small>Status-driven view across all clients and projects.</Small>
            </div>
            {menuKey !== "installation" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!globalSelectModeByMenu[menuKey] ? (
                  <Button variant="secondary" onClick={() => toggleGlobalSelectMode(menuKey)}>Select</Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => deleteSelectedGlobalEstimates(menuKey)}
                      disabled={!rows.some((row) => !!(globalSelectedEstimateIdsByMenu[menuKey] ?? {})[row.estimate.id])}
                    >
                      Delete Selected
                    </Button>
                    <Button variant="secondary" onClick={() => toggleGlobalSelectMode(menuKey)}>Cancel</Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px", maxWidth: 520 }}>
                <Input
                  value={globalSearch}
                  onChange={setGlobalSearch}
                  placeholder={`Search ${title.toLowerCase()}, client refs, project names, estimate refs or values`}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Small>Sort by</Small>
                <select
                  value={globalSortField}
                  onChange={(e) => setGlobalSortField(e.currentTarget.value as GlobalSortField)}
                  style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14, background: "#fff" }}
                >
                  <option value="client_number">Client Number</option>
                  <option value="client_name">Client Name</option>
                  <option value="project_name">Project Name</option>
                  <option value="total_cost">Total Cost</option>
                </select>
                <Button variant={globalSort === "asc" ? "primary" : "secondary"} onClick={() => setGlobalSort("asc")}>
                  Ascending
                </Button>
                <Button variant={globalSort === "desc" ? "primary" : "secondary"} onClick={() => setGlobalSort("desc")}>
                  Descending
                </Button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Small>Forecast month</Small>
              {monthFilterOptions.map((month) => {
                const isSelected = globalMonthFilter === month;
                const isCurrentMonth = month === currentMonthName;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => setGlobalMonthFilter(month)}
                    style={{
                      borderRadius: 999,
                      border: isSelected ? "none" : isCurrentMonth ? "2px solid #18181b" : "1px solid #e4e4e7",
                      background: isSelected ? "#18181b" : "#fff",
                      color: isSelected ? "#fff" : "#18181b",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {month}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: 10 }}>
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Items</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{summary.count}</div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total mÂ²</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(summary.totalSquareMetres)}</div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Linear metreage</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(summary.totalLinearMetres)}</div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{summary.totalQty}</div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total cost</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(summary.totalCost)}</div>
              </div>
            </div>
          </div>

          <div style={{ border: "1px solid #e4e4e7", borderRadius: 14, background: "#fff", overflow: "hidden", minHeight: 0 }}>
            <div style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1400 }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    {[
                      ...(menuKey !== "installation" ? [["", "left"] as const] : []),
                      ["Client Name", "left"],
                      ["Estimate Ref", "left"],
                      ["Client Number", "left"],
                      ["Project Name", "left"],
                      ["Contact Number", "left"],
                      ["Forecast", "left"],
                      ["Total MÂ²", "right"],
                      ["Linear Meterage", "right"],
                      ["Total Quantity", "right"],
                      ["Status", "left"],
                      ["Total Cost", "right"],
                      ["Action", "right"],
                    ].map(([label, align]) => (
                      <th
                        key={label}
                        style={{
                          textAlign: align as "left" | "right",
                          padding: 10,
                          fontSize: 12,
                          borderBottom: "1px solid #e4e4e7",
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          background: "#fafafa",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ client, estimate, outcome, installerId }) => {
                    const totals = estimateCommercialTotals(estimate);
                    const contactNumber = client.mobile || client.home || "";
                    const statusLabel = menuKey === "installation"
                      ? (installerId ? "Supply & Install" : "Supply Only")
                      : outcome;
                    return (
                      <tr key={
      
estimate.id}>
                        {menuKey !== "installation" && (
                          <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", width: 44 }}>
                            {globalSelectModeByMenu[menuKey] ? (
                              <input
                                type="checkbox"
                                checked={!!(globalSelectedEstimateIdsByMenu[menuKey] ?? {})[estimate.id]}
                                onChange={(ev) => toggleGlobalEstimateSelection(menuKey, estimate.id, ev.currentTarget.checked)}
                              />
                            ) : null}
                          </td>
                        )}
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", fontWeight: 700 }}>{clientDisplayName(client)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{estimate.estimateRef}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{client.clientRef}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{client.projectName || ""}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{contactNumber || ""}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{monthYearLabel(estimate.estimatedOrderMonth || "", estimate.estimatedOrderYear || 0)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>{formatMeasure(totals.totalSquareMetres)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>{formatMeasure(totals.totalLinearMetres)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>{totals.totalQty}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top" }}>{statusLabel}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right", fontWeight: 800 }}>{formatMoney(totals.estimateTotal)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f4f4f5", verticalAlign: "top", textAlign: "right" }}>
                          <Button variant="secondary" onClick={() => openEstimateFromGlobalMenu(client.id, estimate.id)}>
                            Open Estimate
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={menuKey !== "installation" ? 13 : 12} style={{ padding: 16 }}>
                        <Small>{emptyText}</Small>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", background: "#f4f4f5", minHeight: "100vh", height: "100vh", overflow: "hidden" }}>
      <div style={{ width: "100%", margin: "0", padding: 16, height: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, height: "calc(100vh - 32px)", alignItems: "start" }}>
          {/* Sidebar */}
          <Card style={{ padding: 12, position: "sticky", top: 16, alignSelf: "start", height: "calc(100vh - 32px)", overflowY: "auto" }}>
            <div style={{ padding: "6px 6px 12px 6px" }}>
              <img
                src="/quotesync-logo.png"
                alt="QuoteSync"
                style={{
                  width: "100%",
                  maxWidth: 260,
                  height: 78,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Dashboard</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Main Dashboard" active={menu === "dashboard"} onClick={() => selectMenu("dashboard")} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Customers</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Client Database" active={menu === "client_database"} onClick={() => selectMenu("client_database")} />
                <SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Estimate / Order Status</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Estimates" active={menu === "estimates"} onClick={() => selectMenu("estimates")} />
                <SidebarItem label="Orders" active={menu === "orders"} onClick={() => selectMenu("orders")} />
                <SidebarItem label="Lost" active={menu === "lost"} onClick={() => selectMenu("lost")} />
                <SidebarItem label="Installation" active={menu === "installation"} onClick={() => selectMenu("installation")} />
                <SidebarItem label="Estimate Map" active={menu === "estimate_map"} onClick={() => selectMenu("estimate_map")} />
                <SidebarItem label="Completed Projects" active={menu === "completed_projects"} onClick={() => selectMenu("completed_projects")} />
                <SidebarItem label="Recycle Bin" active={menu === "recycle_bin"} onClick={() => selectMenu("recycle_bin")} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Preferences</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Project Preferences" active={menu === "project_preferences"} onClick={() => selectMenu("project_preferences")} />
                <SidebarItem label="Address Database" active={menu === "address_database"} onClick={() => selectMenu("address_database")} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <H3>Tools</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Reports" active={menu === "reports"} onClick={() => selectMenu("reports")} />
                <SidebarItem label="CAD Drawing" active={menu === "cad_drawing"} onClick={() => selectMenu("cad_drawing")} />
                <SidebarItem label="Remote Support" active={menu === "remote_support"} onClick={() => selectMenu("remote_support")} />
              </div>
            </div>
          </Card>

          {/* Main */}
          <div style={{ display: "grid", gap: 16, minHeight: 0, height: "calc(100vh - 32px)", overflowY: "auto", paddingRight: 4, alignContent: "start" }}>
            {menu === "dashboard" && view === "customers" && (
              <MainDashboard
                clients={clients}
                activeUserName="User"
                onOpenMenu={(targetMenu) => selectMenu(targetMenu as Models.MenuKey)}
                onOpenEstimate={(clientId, estimateId) => openEstimateDefaults(clientId, estimateId)}
              />
            )}

{what3WordsPickerOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 80,
      background: "rgba(24,24,27,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}
  >
    <div
      style={{
        width: "min(1100px, 96vw)",
        maxHeight: "92vh",
        overflow: "auto",
        borderRadius: 18,
        border: "1px solid #e4e4e7",
        background: "#fff",
        padding: 16,
        boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <H3>Project what3words map picker</H3>
          <Small>Select the estimate project location on the map. The what3words field will auto-fill when available.</Small>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setWhat3WordsPickerOpen(false);
            setWhat3WordsPickerError("");
          }}
        >
          Close
        </Button>
      </div>

      {what3WordsPickerError ? (
        <div style={{ borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", padding: 12, color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
          {what3WordsPickerError}
        </div>
      ) : null}

      {what3WordsPickerLoading ? (
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12 }}>
          <Small>Resolving what3words for the selected map point...</Small>
        </div>
      ) : null}

      <GoogleMapPanel
        apiKey={googleMapsApiKey}
        items={[]}
        onApiReady={() => setMapsApiReady(true)}
        onMapClick={handleWhat3WordsMapPick}
        height={560}
        emptyText="Click the map to select the project location."
      />
    </div>
  </div>
)}

            {/* CUSTOMERS LIST */}
            {menu === "client_database" && view === "customers" && (
  <Card style={{ minHeight: 0, height: "100%", display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "#fff",
        paddingBottom: 12,
        borderBottom: "1px solid #e4e4e7",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <H2>Client Database</H2>
          <Small>Open a client to choose an estimate (or create one).</Small>
        </div>

        <Button variant="primary" onClick={openAddClientPanel}>
          Add new client
        </Button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", maxWidth: 520 }}>
            <Input
              value={clientDbSearch}
              onChange={setClientDbSearch}
              placeholder="Search clients, refs, project names or address"
              autoComplete="off"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Small>Sort by</Small>
            <select
              value={clientDbSortField}
              onChange={(e) => setClientDbSortField(e.currentTarget.value as "client_name" | "client_number" | "project_name")}
              style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14, background: "#fff" }}
            >
              <option value="client_name">Client Name</option>
              <option value="client_number">Client Number</option>
              <option value="project_name">Project Name</option>
            </select>
            <Button variant={clientDbSort === "asc" ? "primary" : "secondary"} onClick={() => setClientDbSort("asc")}>
              Ascending
            </Button>
            <Button variant={clientDbSort === "desc" ? "primary" : "secondary"} onClick={() => setClientDbSort("desc")}>
              Descending
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["All", "Open", "Orders", "Lost"] as const).map((opt) => (
            <Button
              key={opt}
              variant={clientDbFilter === opt ? "primary" : "secondary"}
              onClick={() => setClientDbFilter(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>
    </div>

                {showAddClient && (
                  <div style={{ marginTop: 14, borderRadius: 16, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                    <div
                       style={{ display: "grid", gap: 10 }}>
                      <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <H3>Client contact information</H3>

                        <div
                       style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={draftClientType === "Business"}
                              onChange={(e) => setDraftClientType(e.currentTarget.checked ? "Business" : "Individual")}
                            />
							
					<span style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>
					Business customer
					</span>
                          </label>

                          <Small>Type: {draftClientType}</Small>
                        </div>
                      </div>

                      {draftClientType === "Business" ? (
                        <>
                          <div
                      >
                            <div
                       style={labelStyle}>Business name</div>
                            <Input value={draftBusinessName} onChange={setDraftBusinessName} placeholder="Company Ltd" />
                          </div>

                          <div
                      >
                            <div
                       style={labelStyle}>Contact name</div>
                            <Input value={draftContactName} onChange={setDraftContactName} placeholder="Name" />
                          </div>
                        </>
                      ) : (
                        <div
                      >
                          <div
                       style={labelStyle}>Client name</div>
                          <Input value={draftClientName} onChange={setDraftClientName} placeholder="Name" />
                        </div>
                      )}

                      <div
                       style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div
                      >
                          <div
                       style={labelStyle}>Email</div>
                          <Input value={draftEmail} onChange={setDraftEmail} placeholder="email@example.com" />
                        </div>
                        <div
                      >
                          <div
                       style={labelStyle}>Mobile</div>
                          <Input value={draftMobile} onChange={setDraftMobile} placeholder="07..." />
                        </div>
                      </div>

                      <div
                      >
                        <div
                       style={labelStyle}>Home</div>
                        <Input value={draftHome} onChange={setDraftHome} placeholder="01..." />
                      </div>

                      <div
                      >
                        <div
                       style={labelStyle}>Project name</div>
                        <Input value={draftProjectName} onChange={setDraftProjectName} placeholder="Project name" />
                      </div>

                      <div
                       style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setCustomerAddressSectionOpen((prev) => !prev)}
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
                          <H3>{customerAddressSectionOpen ? "▼" : "▶"} Customer address</H3>
                        </button>

                        {customerAddressSectionOpen && (
                          <div
                           style={{ marginTop: 10, display: "grid", gap: 12 }}>
                            <div
                             style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <div style={labelStyle}>Address line 1</div>
                                <Input value={draftCustAddress1} onChange={setDraftCustAddress1} placeholder="Address line 1" />
                              </div>
                              <div>
                                <div style={labelStyle}>Address line 2</div>
                                <Input value={draftCustAddress2} onChange={setDraftCustAddress2} placeholder="Address line 2" />
                              </div>
                            </div>

                            <div>
                              <div style={labelStyle}>Address line 3</div>
                              <Input value={draftCustAddress3} onChange={setDraftCustAddress3} placeholder="Address line 3" />
                            </div>

                            <div
                             style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <div style={labelStyle}>Town</div>
                                <Input value={draftCustTown} onChange={setDraftCustTown} placeholder="Town" />
                              </div>
                              <div>
                                <div style={labelStyle}>City</div>
                                <Input value={draftCustCity} onChange={setDraftCustCity} placeholder="City" />
                              </div>
                            </div>

                            <div
                             style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <div style={labelStyle}>County/District</div>
                                <Input value={draftCustCounty} onChange={setDraftCustCounty} placeholder="County/District" />
                              </div>
                              <div>
                                <div style={labelStyle}>Postcode</div>
                                <Input value={draftCustPostcode} onChange={setDraftCustPostcode} placeholder="Postcode" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                       style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setInvoiceAddressSectionOpen((prev) => !prev)}
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
                          <H3>{invoiceAddressSectionOpen ? "▼" : "▶"} Invoice address</H3>
                        </button>

                        {invoiceAddressSectionOpen && (
                          <div
                           style={{ marginTop: 10, display: "grid", gap: 12 }}>
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                                <input
                                  type="radio"
                                  name="invoiceAddressMode"
                                  checked={invoiceAddressMode === "customer"}
                                  onChange={() => setInvoiceAddressMode("customer")}
                                />
                                Same as customer address
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                                <input
                                  type="radio"
                                  name="invoiceAddressMode"
                                  checked={invoiceAddressMode === "custom"}
                                  onChange={() => setInvoiceAddressMode("custom")}
                                />
                                Custom invoice address
                              </label>
                            </div>

                            {invoiceAddressMode === "custom" && (
                              <div
                               style={{ marginTop: 4, display: "grid", gap: 12 }}>
                                <div
                                 style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div>
                                    <div style={labelStyle}>Address line 1</div>
                                    <Input value={draftInvAddress1} onChange={setDraftInvAddress1} placeholder="Address line 1" />
                                  </div>
                                  <div>
                                    <div style={labelStyle}>Address line 2</div>
                                    <Input value={draftInvAddress2} onChange={setDraftInvAddress2} placeholder="Address line 2" />
                                  </div>
                                </div>

                                <div>
                                  <div style={labelStyle}>Address line 3</div>
                                  <Input value={draftInvAddress3} onChange={setDraftInvAddress3} placeholder="Address line 3" />
                                </div>

                                <div
                                 style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div>
                                    <div style={labelStyle}>Town</div>
                                    <Input value={draftInvTown} onChange={setDraftInvTown} placeholder="Town" />
                                  </div>
                                  <div>
                                    <div style={labelStyle}>City</div>
                                    <Input value={draftInvCity} onChange={setDraftInvCity} placeholder="City" />
                                  </div>
                                </div>

                                <div
                                 style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div>
                                    <div style={labelStyle}>County/District</div>
                                    <Input value={draftInvCounty} onChange={setDraftInvCounty} placeholder="County/District" />
                                  </div>
                                  <div>
                                    <div style={labelStyle}>Postcode</div>
                                    <Input value={draftInvPostcode} onChange={setDraftInvPostcode} placeholder="Postcode" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div
                       style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <Button variant="secondary" onClick={() => { setShowAddClient(false); setEditingClientId(null); }}>
                          Cancel
                        </Button>
                        <Button variant="primary" onClick={() => (editingClientId ? updateClient(draftClientType) : createClient(draftClientType))}>
                          {editingClientId ? "Save Changes" : "Create Client"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customers list */}
				<div style={{ marginTop: 12, display: "grid", gap: 12, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
                  {filteredClients.length === 0 && <div style={{ fontSize: 13, color: "#71717a" }}>No clients yet.</div>}

                  {filteredClients.map((c) => (
                    <div
                      
                      key={c.id}
                      style={{
                        borderRadius: 16,
                        border: "1px solid #e4e4e7",
                        padding: 12,
                        background: "#fff",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div
                       style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <H3>{c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}</H3>
                          <Pill>{c.clientRef}</Pill>
                          <Small>{c.estimates.length} estimates</Small>
                        </div>

                        <div
                       style={{ display: "flex", gap: 10 }}>
                          <Button variant="primary" onClick={() => openClient(c)}>
                            Open
                          </Button>
                          <Button variant="secondary" onClick={() => createEstimateForClient(c)}>
                            New Estimate
                          </Button>
                        </div>
                      </div>

                      <div
                       style={{ fontSize: 12, color: "#71717a" }}>
                        {c.projectName || "No project name"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

                        {menu === "follow_ups" && view === "customers" && (
              <FollowUpsFeature
                clients={clients}
                onOpenClient={(clientId) => {
                  setEstimatePickerClientId(clientId);
                  setView("estimate_picker");
                }}
              />
            )}

            {menu === "estimates" && view === "customers" && renderGlobalEstimateMenu(
              "Estimates",
              "estimates",
              "No estimates found."
            )}

            {menu === "orders" && view === "customers" && renderGlobalEstimateMenu(
              "Orders",
              "orders",
              "No orders found."
            )}

            {menu === "lost" && view === "customers" && renderGlobalEstimateMenu(
              "Lost",
              "lost",
              "No lost estimates found."
            )}

            {menu === "installation" && view === "customers" && renderInstallationBoard()}

            {menu === "estimate_map" && view === "customers" && renderEstimateMapBoard()}

            {menu === "completed_projects" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <H2>Completed Projects</H2>
                <Small>Completed projects workflow will be added in a later phase.</Small>
              </Card>
            )}

            {menu === "recycle_bin" && view === "customers" && renderRecycleBinMenu()}

            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && (
              <EstimatePickerFeature
				ref={estimatePickerRef}
				clientId={estimatePickerClientId}
				initialClientId={estimatePickerClientId}
				onConsumedInitialClientId={() => setEstimatePickerClientId(null)}
				clients={clients}
				onBack={() => {
				setEstimatePickerClientId(null);
				estimatePickerRef.current?.clear();
				setView("customers");
			}}
				openEditClientPanel={openEditClientPanel}
				createEstimateForClient={createEstimateForClient}
				copyEstimateForClient={copyEstimateForClient}
				deletedEstimatesForClient={estimatePickerClientId ? (deletedEstimatesByClientId[estimatePickerClientId] ?? []) : []}
				deleteEstimatesForClient={deleteEstimatesForClient}
				restoreDeletedEstimatesForClient={restoreDeletedEstimatesForClient}
				purgeDeletedEstimatesForClient={purgeDeletedEstimatesForClient}
				setEstimateInstaller={setEstimateInstaller}
				updateEstimateOrderMeta={updateEstimateOrderMeta}
				updateEstimatePosition={updateEstimatePosition}
				openEstimateDefaults={(clientId, estimateId) => openEstimateDefaults(clientId, estimateId)}
                persistEstimateOutcome={persistEstimateOutcome}
			/>
            )}
            {/* ESTIMATE DEFAULTS */}
            {view === "estimate_defaults" && selectedClient && selectedEstimate && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Supplier & Product Defaults</H2>
                    <div
                       style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill>{selectedClient.clientRef}</Pill>
                      <Pill>{selectedEstimate.estimateRef}</Pill>
                      <Small>{selectedClient.clientName}</Small>
                    </div>
                    <Small>Set estimate-level defaults here. Add Position will use these when is on.</Small>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" onClick={() => setView("customers")}>
                      Back
                    </Button>
                    <Button variant="primary" onClick={() => setView("estimate_workspace")}>
                      Continue
                    </Button>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <ClientSummary c={selectedClient} />

                  <Card style={{ padding: 14 }}>
                    <div
                       style={{ display: "grid", gap: 12 }}>
                      <div
                      >
                        <H3>Estimated Order Forecast</H3>
                        <Small>Select the expected order month and year for this estimate.</Small>
                      </div>

                      <div
                       style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div
                      >
                          <div
                       style={labelStyle}>Estimated order month</div>
                          <select
                            value={selectedEstimate.estimatedOrderMonth || ORDER_MONTHS[new Date().getMonth()]}
                            onChange={(e) => setEstimateForecast({ estimatedOrderMonth: e.currentTarget.value })}
                            style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff" }}
                          >
                            {ORDER_MONTHS.map((month) => (
                              <option key={month} value={month}>
                                {month}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div
                      >
                          <div
                       style={labelStyle}>Estimated order year</div>
                          <select
                            value={selectedEstimate.estimatedOrderYear || new Date().getFullYear()}
                            onChange={(e) => setEstimateForecast({ estimatedOrderYear: Number(e.currentTarget.value) })}
                            style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff" }}
                          >
                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div
                      
                        style={{
                          borderRadius: 14,
                          border: "1px solid #e4e4e7",
                          background: "#fafafa",
                          padding: 12,
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <div
                       style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a" }}>
                          Potential order raised
                        </div>
                        <div
                       style={{ fontSize: 22, fontWeight: 900, color: "#18181b" }}>
                          {monthYearLabel(selectedEstimate.estimatedOrderMonth, selectedEstimate.estimatedOrderYear)}
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card style={{ padding: 14 }}>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div>
                        <H3>Project Site Address</H3>
                        <Small>This address belongs to the estimate, not the client.</Small>
                      </div>

                      {(() => {
                        const projectStructured = resolveStructuredAddress(
                          selectedEstimate.projectAddressStructured,
                          selectedEstimate.projectAddress || ""
                        );
                        const [p1, p2, p3, pt, pc, pco, pp] = addressTuple(projectStructured);
                        return (
                          <div style={{ display: "grid", gap: 12 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <div style={labelStyle}>Address line 1</div>
                                <Input value={p1} onChange={(v) => updateSelectedEstimateProjectAddress({ line1: v })} placeholder="Address line 1" />
                              </div>
                              <div>
                                <div style={labelStyle}>Address line 2</div>
                                <Input value={p2} onChange={(v) => updateSelectedEstimateProjectAddress({ line2: v })} placeholder="Address line 2" />
                              </div>
                            </div>

                            <div>
                              <div style={labelStyle}>Address line 3</div>
                              <Input value={p3} onChange={(v) => updateSelectedEstimateProjectAddress({ line3: v })} placeholder="Address line 3" />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <div style={labelStyle}>Town</div>
                                <Input value={pt} onChange={(v) => updateSelectedEstimateProjectAddress({ town: v })} placeholder="Town" />
                              </div>
                              <div>
                                <div style={labelStyle}>City</div>
                                <Input value={pc} onChange={(v) => updateSelectedEstimateProjectAddress({ city: v })} placeholder="City" />
                              </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                              <div>
                                <div style={labelStyle}>County/District</div>
                                <Input value={pco} onChange={(v) => updateSelectedEstimateProjectAddress({ county: v })} placeholder="County/District" />
                              </div>
                              <div>
                                <div style={labelStyle}>Postcode</div>
                                <Input
                                  value={selectedEstimate.postcode || pp}
                                  onChange={(v) => {
                                    const structured = resolveStructuredAddress(
                                      selectedEstimate.projectAddressStructured,
                                      selectedEstimate.projectAddress || ""
                                    );
                                    const nextEstimate: Estimate = {
                                      ...selectedEstimate,
                                      projectAddressStructured: { ...structured, postcode: v },
                                      projectAddress: buildAddressString({ ...structured, postcode: v }),
                                      postcode: v,
                                    };
                                    updateSelectedEstimateLocation(nextEstimate);
                                  }}
                                  placeholder="Postcode"
                                />
                              </div>
                              <div>
                                <div style={labelStyle}>what3words</div>
                                <Input
                                  value={selectedEstimate.what3words || ""}
                                  onChange={(v) => updateSelectedEstimateLocation({ ...selectedEstimate, what3words: v })}
                                  placeholder="index.home.raft"
                                />
                              </div>
                              <div>
                                <div style={labelStyle}>Map</div>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setWhat3WordsPickerError("");
                                    setWhat3WordsPickerOpen(true);
                                  }}
                                  disabled={!googleMapsApiKey}
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  Pick on map
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Card>

                  <DefaultsEditor
                    title="Estimate Defaults"
                    productType={selectedEstimate.defaults.productType}
                    value={selectedEstimate.defaults}
                    onChange={setEstimateDefaults}
                    showDoorOptions={true}
                  />
                </div>
              </Card>
            )}

            {/* ESTIMATE WORKSPACE */}
            {view === "estimate_workspace" && selectedClient && selectedEstimate && (
              <Card style={{ minHeight: 520, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Estimate</H2>
                    <div
                       style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill>{selectedClient.clientRef}</Pill>
                      <Pill>{selectedEstimate.estimateRef}</Pill>
                      <Small>{selectedClient.clientName}</Small>
                    </div>
                    <Small>Supplier/Product Defaults are set separately. Add Position starts at Position Configuration.</Small>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" onClick={() => setView("estimate_defaults")}>
                      Supplier & Product Defaults
                    </Button>
                    <Button variant="secondary" onClick={() => setView("customers")}>
                      Back
                    </Button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <ClientSummary c={selectedClient} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <Button variant="primary" onClick={startAddPosition} style={{ width: "100%" }}>
                    Add Position
                  </Button>
                </div>

                <div style={{ marginTop: 16, borderTop: "1px solid #e4e4e7", paddingTop: 12, flex: 1 }}>
                  <H3>Positions</H3>
                  <Small>Positions added to this estimate appear below.</Small>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {selectedEstimate.positions.length === 0 && <div style={{ fontSize: 13, color: "#71717a" }}>No positions yet.</div>}

                    {(() => {
                    const totals = estimateCommercialTotals(selectedEstimate);
                    return (
                      <>
                        <div
                      
                          style={{
                            marginTop: 10,
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
                            gap: 10,
                          }}
                        >
                          <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                            <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total mÂ²</div>
                            <div
                       style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(totals.totalSquareMetres)}</div>
                          </div>
                          <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                            <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Linear metreage</div>
                            <div
                       style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMeasure(totals.totalLinearMetres)}</div>
                          </div>
                          <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                            <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Total quantity</div>
                            <div
                       style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{totals.totalQty}</div>
                          </div>
                          <div
                       style={{ borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                            <div
                       style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a", marginBottom: 4 }}>Estimate total</div>
                            <div
                       style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{formatMoney(totals.estimateTotal)}</div>
                          </div>
                        </div>

                        <div
                       style={{ marginTop: 10, display: "grid", gap: 10 }}>
                          {selectedEstimate.positions.map((p) => {
                            const lineTotal = Number(p.itemPrice || 0) * Math.max(1, Number(p.qty || 1));
                            return (
                              <div
                       key={p.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 10, background: "#fff" }}>
                                <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                  <div
                       style={{ fontWeight: 900, fontSize: 13 }}>{p.positionRef}</div>
                                  <div
                       style={{ fontSize: 12, color: "#71717a" }}>
                                    Qty {p.qty} {p.fieldsY}
                                  </div>
                                </div>
                                <div
                       style={{ marginTop: 4, fontSize: 12, color: "#71717a" }}>
                                  {p.roomName || (p.useEstimateDefaults ? "Using estimate defaults" : "Overrides")}
                                </div>

                                <div
                       style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 12, alignItems: "end" }}>
                                  <div
                       />
                                  <div
                      >
                                    <div
                       style={labelStyle}>Item price</div>
                                    <Input
                                      type="number"
                                      value={String(p.itemPrice ?? "")}
                                      onChange={(v) =>
                                        updateEstimatePosition(selectedClient.id, selectedEstimate.id, p.id, {
                                          itemPrice: v === "" ? 0 : Number(v || 0),
                                        })
                                      }
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <div
                      >
                                    <div
                       style={labelStyle}>Quantity price</div>
                                    <div
                      
                                      style={{
                                        width: "100%",
                                        borderRadius: 12,
                                        border: "1px solid #e4e4e7",
                                        padding: "10px 12px",
                                        fontSize: 14,
                                        background: "#fafafa",
                                        fontWeight: 800,
                                        textAlign: "right",
                                      }}
                                    >
                                      {formatMoney(lineTotal)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Position wizard */}
                {showPositionWizard && selectedEstimate && (
                  <div style={{ marginTop: 14, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                    <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <H3>Add Position</H3>
                      <Button variant="secondary" onClick={() => setShowPositionWizard(false)} style={{ borderRadius: 14, padding: "8px 10px" }}>
                        Close
                      </Button>
                    </div>

                    <div
                       style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[1, 2, 3].map((s) => (
                        <div
                      
                          key={s}
                          style={{
                            borderRadius: 14,
                            border: "1px solid " + (posStep === s ? "#18181b" : "#e4e4e7"),
                            background: posStep === s ? "#18181b" : "#fff",
                            color: posStep === s ? "#fff" : "#3f3f46",
                            padding: "8px 10px",
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {s}. {stepLabel(s as any)}
                        </div>
                      ))}
                    </div>

                    <div
                       style={{ marginTop: 12, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                      {posStep === 1 && (
                        <div
                       style={{ display: "grid", gap: 12 }}>
                          <div
                       style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div
                      >
                              <div
                       style={labelStyle}>Position reference</div>
                              <Input value={posDraft.positionRef} onChange={(v) => setPosDraft((p) => ({ ...p, positionRef: v }))} />
                            </div>
                            <div
                      >
                              <div
                       style={labelStyle}>Quantity</div>
                              <Input type="number" value={String(posDraft.qty)} onChange={(v) => setPosDraft((p) => ({ ...p, qty: Math.max(1, Math.min(999, Number(v || 1))) }))} />
                            </div>
                          </div>

                          <div
                      >
                            <div
                       style={labelStyle}>Room name</div>
                            <Input value={posDraft.roomName} onChange={(v) => setPosDraft((p) => ({ ...p, roomName: v }))} />
                          </div>

                          <div
                      >
                            <div
                       style={labelStyle}>Position type</div>
                            <select
                              value={posDraft.positionType}
                              onChange={(e) => setPosDraft((p) => ({ ...p, positionType: e.target.value as "Window" | "Door" }))}
                              style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                            >
                              <option value="Window">Window</option>
                              <option value="Door">Door</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {posStep === 2 && (
                        <div
                       style={{ display: "grid", gap: 12 }}>
                          <div
                       style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div
                      >
                              <div
                       style={labelStyle}>Total width (mm)</div>
                              <Input type="number" value={String(posDraft.widthMm)} onChange={(v) => setPosDraft((p) => ({ ...p, widthMm: Number(v || p.widthMm) }))} />
                            </div>
                            <div
                      >
                              <div
                       style={labelStyle}>Total height (mm)</div>
                              <Input type="number" value={String(posDraft.heightMm)} onChange={(v) => setPosDraft((p) => ({ ...p, heightMm: Number(v || p.heightMm) }))} />
                            </div>
                          </div>

                          <div
                       style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div
                      >
                              <div
                       style={labelStyle}>Fields (width)</div>
                              <Input
                                type="number"
                                value={String(posDraft.fieldsX)}
                                onChange={(v) =>
                                  setPosDraft((p) => {
                                    const fx = Math.max(1, Math.min(16, Number(v || 1)));
                                    return {
                                      ...p,
                                      fieldsX: fx,
                                      colWidthsMm: scaleSplitsToTotal(p.colWidthsMm, p.widthMm, fx),
                                      cellInsertions: normalizeCellInsertions(fx, p.fieldsY, p.cellInsertions, p.insertion),
                                    };
                                  })
                                }
                              />
                            </div>
                            <div
                      >
                              <div
                       style={labelStyle}>Fields (height)</div>
                              <Input
                                type="number"
                                value={String(posDraft.fieldsY)}
                                onChange={(v) =>
                                  setPosDraft((p) => {
                                    const fy = Math.max(1, Math.min(16, Number(v || 1)));
                                    return {
                                      ...p,
                                      fieldsY: fy,
                                      rowHeightsMm: scaleSplitsToTotal(p.rowHeightsMm, p.heightMm, fy),
                                      cellInsertions: normalizeCellInsertions(p.fieldsX, fy, p.cellInsertions, p.insertion),
                                    };
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {posStep === 3 && (
                        <div
                       style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16 }}>
                          {/* Left column */}
                          <div
                       style={{ display: "grid", gap: 12 }}>
                            <div
                       style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <H3>Insertion</H3>

                              <div
                       style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div
                       style={{ fontSize: 12, color: "#71717a" }}>
                                  Selected field: #{draftSelectedCell.row * posDraft.fieldsX + draftSelectedCell.col + 1}
                                </div>

                                <div
                       style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <select value={openingStd} onChange={(e) => setOpeningStd(e.target.value as any)} style={{ borderRadius: 10, border: "1px solid #e4e4e7", padding: "6px 10px", fontSize: 12 }} title="Opening convention">
                                    <option value="DIN">DIN</option>
                                    <option value="UK">UK</option>
                                  </select>

                                  <select value={previewView} onChange={(e) => setPreviewView(e.target.value as any)} style={{ borderRadius: 10, border: "1px solid #e4e4e7", padding: "6px 10px", fontSize: 12 }} title="View">
                                    <option value="Inside">Inside</option>
                                    <option value="Outside">Outside</option>
                                  </select>
                                </div>
                              </div>

                              <div
                       style={{ marginTop: 8 }}>
                                <select
                                  value={(posDraft.cellInsertions ?? {})[keyForCell(draftSelectedCell.col, draftSelectedCell.row)] ?? posDraft.insertion}
                                  onChange={(e) =>
                                    setPosDraft((p) => ({
                                      ...p,
                                      cellInsertions: { ...(p.cellInsertions ?? {}), [keyForCell(draftSelectedCell.col, draftSelectedCell.row)]: e.target.value },
                                    }))
                                  }
                                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                                >
                                  <option>Fixed</option>
                                  <option>Turn</option>
                                  <option>Tilt</option>
                                  <option>Tilt & Turn</option>
                                  <option>Top Hung</option>
                                  <option>Side Hung</option>
                                  <option>Reversible</option>
                                </select>
                              </div>
                            </div>

                            <div
                       style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <H3>Use estimate defaults</H3>
                              <div
                       style={{ marginTop: 10, display: "grid", gap: 10 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                                  <input type="checkbox" checked={posDraft.useEstimateDefaults} onChange={(e) => setPosDraft((p) => ({ ...p, useEstimateDefaults: e.target.checked }))} />
                                  Use estimate defaults for this position
                                </label>
                                <Small>When unticked, you can override the same defaults below (same option set as).</Small>
                              </div>
                            </div>

                            {!posDraft.useEstimateDefaults && (
                              <DefaultsEditor
                                title="Position Overrides"
                                productType={(posDraft.overrides.productType as Models.ProductType) || selectedEstimate.defaults.productType}
                                value={{ ...selectedEstimate.defaults, ...posDraft.overrides }}
                                onChange={(next) => setPositionDefaultsOverride(next)}
                                showDoorOptions={posDraft.positionType === "Door"}
                              />
                            )}
                          </div>

                          {/* Right column */}
                          <div
                       style={{ display: "grid", gap: 12 }}>
                            <div
                       style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <H3>Preview</H3>
                                <Pill>{posDraft.insertion}</Pill>
                              </div>

                              <div
                       style={{ marginTop: 12 }}>
                                <GridEditor
                                  pos={{
                                    widthMm: posDraft.widthMm,
                                    heightMm: posDraft.heightMm,
                                    fieldsX: posDraft.fieldsX,
                                    fieldsY: posDraft.fieldsY,
                                    insertion: posDraft.insertion,
                                    cellInsertions: posDraft.cellInsertions,
                                    colWidthsMm: posDraft.colWidthsMm,
                                    rowHeightsMm: posDraft.rowHeightsMm,
                                  }}
                                  selectedCell={draftSelectedCell}
                                  onSelectCell={setDraftSelectedCell}
                                  view={previewView}
                                  openingStd={openingStd}
                                  setPos={(fn: any) =>
                                    setPosDraft((p) => {
                                      const next = fn(p);
                                      const fx = next.fieldsX ?? p.fieldsX;
                                      const fy = next.fieldsY ?? p.fieldsY;
                                      const ins = (next.insertion ?? p.insertion) as any;
                                      const cellInsertions = normalizeCellInsertions(fx, fy, next.cellInsertions ?? p.cellInsertions, ins);
                                      return { ...p, ...next, cellInsertions };
                                    })
                                  }
                                />
                              </div>

                              <div
                       style={{ marginTop: 12, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
                                <H3>Summary</H3>
                                <Small>
                                  {(() => {
                                    const eff = effectiveDefaultsForPosition(selectedEstimate, posDraft);
                                    return eff.supplier
										? eff.supplier
										: `Glass: ${eff.glassType} Ug ${eff.ugValue} G ${eff.gValue}`;
                                  })()}
                                </Small>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                       style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Button variant="secondary" onClick={() => setPosStep((s) => (s === 1 ? 1 : ((s - 1) as any)))} disabled={posStep === 1}>
                        Back
                      </Button>

                      {posStep < 3 ? (
                        <Button variant="primary" onClick={() => setPosStep((s) => ((s + 1) as any))}>
                          Next
                        </Button>
                      ) : (
                        <Button variant="primary" onClick={savePositionToEstimate}>
                          Save Position
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                </div>
              </Card>
            )}

            {/* CLIENT DATABASE VIEW FALLBACK (Phase 4F) */}
            {menu === "client_database" && view !== "customers" && view !== "estimate_picker" && view !== "estimate_defaults" && view !== "estimate_workspace" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <H2>Client Database</H2>
                  <Small>
                    Main panel is blank because view is not recognised: <b>{String(view)}</b>
                  </Small>
                  <Small>Click reset to return to Customers.</Small>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={() => setView("customers")}>Reset to Customers</Button>
                    <Button variant="secondary" onClick={() => { setMenu("client_database"); setView("customers"); }}>Reset Menu + View</Button>
                  </div>
                </div>
              </Card>
            )}
            {menu === "project_preferences" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
                  <div>
                    <H2>Project Preferences</H2>
                    <Small>Configure default loading behaviour for QuoteSync.</Small>
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      border: "1px solid #e4e4e7",
                      background: "#fff",
                      padding: 16,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                       style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div
                      >
                        <H3>Load Defaults</H3>
                        <Small>
                          When enabled, new estimates start with the default supplier, product and technical settings.
                          When disabled, new estimates start blank.
                        </Small>
                      </div>

                      <Toggle
                        value={systemSettings.loadDefaults}
                        onChange={(checked) =>
                          setSystemSettings((prev) => ({
                            ...prev,
                            loadDefaults: checked,
                          }))
                        }
                      />
                    </div>

<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  <span style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Load Demo Clients</span>
  <Toggle
    value={systemSettings.loadDemoClients}
    onChange={(checked) =>
      setSystemSettings((prev) => ({
        ...prev,
        loadDemoClients: checked,
      }))
    }
  />
</div>

<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  <span style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Load Demo Estimates</span>
  <Toggle
    value={systemSettings.loadDemoEstimates}
    onChange={(checked) =>
      setSystemSettings((prev) => ({
        ...prev,
        loadDemoEstimates: checked,
      }))
    }
  />
</div>

                    <div
                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  <span style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Load Demo Forecast</span>
  <Toggle
    value={systemSettings.loadDemoForecast}
    onChange={(checked) =>
      setSystemSettings((prev) => ({
        ...prev,
        loadDemoForecast: checked,
      }))
    }
  />
</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Fallback for other menus */}
            {menu !== "dashboard" && menu !== "client_database" && menu !== "follow_ups" && menu !== "estimates" && menu !== "orders" && menu !== "lost" && menu !== "installation" && menu !== "estimate_map" && menu !== "completed_projects" && menu !== "recycle_bin" && menu !== "project_preferences" && (
              <Card style={{ minHeight: 520 }}>
                <H2>{menu.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}</H2>
                <Small>Placeholder screen.</Small>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


