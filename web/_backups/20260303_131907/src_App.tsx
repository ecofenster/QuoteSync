
import React, { useEffect, useMemo, useRef, useState } from "react";
import GridEditor from "./components/GridEditor";
import EstimatePickerFeature, { type EstimatePickerFeatureHandle } from "./features/estimatePicker/EstimatePickerFeature";
import DefaultsEditor from "./features/estimateDefaults/DefaultsEditor";
import { DEFAULT_CUSTOMER_ADDRESS, makeDefaultClients } from "./features/clients/defaultClients";
import * as Models from "./models/types";
import type { Client, Estimate, Position, EstimateDefaults, ClientType } from "./models/types";
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
} from "./features/estimateDefaults/defaultEstimateDefaults";

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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      list={list}
      disabled={disabled}
      readOnly={readOnly}
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

  // If sum is zero (shouldn't happen), fall back
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

function ClientSummary({ c }: { c: Client }) {
  const headline = c.type === "Business" ? (c.businessName || c.clientName) : c.clientName;
  const sub = c.type === "Business" ? (c.contactPerson ? `Contact: ${c.contactPerson}` : "Contact: —") : "Individual";

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
          {c.email ? <Pill>{c.email}</Pill> : <Pill>Email: —</Pill>}
          {c.mobile ? <Pill>Mob: {c.mobile}</Pill> : <Pill>Mob: —</Pill>}
          {c.home ? <Pill>Home: {c.home}</Pill> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [menu, setMenu] = useState<Models.MenuKey>("client_database");
  const [view, setView] = useState<Models.View>("customers");

  const estimatePickerRef = useRef<EstimatePickerFeatureHandle>(null);


  


  const [pendingEstimatePickerClientId, setPendingEstimatePickerClientId] = useState<Models.ClientId | null>(null);
  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);
const [clientCounter, setClientCounter] = useState(3);
  const [estimateCounter, setEstimateCounter] = useState(1);

  const [clients, setClients] = useState<Client[]>(() => makeDefaultClients({ uid, nextClientRef }));

  const [selectedClientId, setSelectedClientId] = useState<Models.ClientId | null>(null);
  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) ?? null, [clients, selectedClientId]);

  const [selectedEstimateId, setSelectedEstimateId] = useState<Models.EstimateId | null>(null);
  const selectedEstimate = useMemo(() => {
    if (!selectedClient) return null;
    return selectedClient.estimates.find((e) => e.id === selectedEstimateId) ?? null;
  }, [selectedClient, selectedEstimateId]);

  // Fix: when clicking "Open" from Client Database, the EstimatePickerFeature is not mounted yet.
  // We queue the client id, switch view, then open once the feature ref exists.
  useEffect(() => {
    if (view !== "estimate_picker") return;
    if (!pendingEstimatePickerClientId) return;
    estimatePickerRef.current?.open(pendingEstimatePickerClientId);
    setPendingEstimatePickerClientId(null);
  }, [view, pendingEstimatePickerClientId]);

  // Add client UI
  const [showAddClient, setShowAddClient] = useState(false);
  // client edit mode
  const [editingClientId, setEditingClientId] = useState<Models.ClientId | null>(null);

  function splitAddress7(addr: string): [string, string, string, string, string, string, string] {
    const parts = (addr || "")
      .split(/\r?\n/)
      .map((s) => (s || "").trim())
      .filter(Boolean);
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

    const [pa1, pa2, pa3, pt, pc, pco, pp] = splitAddress7(c.projectAddress || "");
    setDraftProjAddress1(pa1);
    setDraftProjAddress2(pa2);
    setDraftProjAddress3(pa3);
    setDraftProjTown(pt);
    setDraftProjCity(pc);
    setDraftProjCounty(pco);
    setDraftProjPostcode(pp);

    const invoiceDifferentNow = ((c.invoiceAddress || "").trim() !== (c.projectAddress || "").trim());
    setInvoiceDifferent(invoiceDifferentNow);

    const [ia1, ia2, ia3, it, ic, ico, ip] = splitAddress7(c.invoiceAddress || "");
    setDraftInvAddress1(ia1);
    setDraftInvAddress2(ia2);
    setDraftInvAddress3(ia3);
    setDraftInvTown(it);
    setDraftInvCity(ic);
    setDraftInvCounty(ico);
    setDraftInvPostcode(ip);

    setShowAddClient(true);
  }

  function updateClient(type: ClientType) {
    if (!editingClientId) return;

    const projectAddress =
      [
        draftProjAddress1,
        draftProjAddress2,
        draftProjAddress3,
        draftProjTown,
        draftProjCity,
        draftProjCounty,
        draftProjPostcode,
      ]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join("\n") || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddress = invoiceDifferent
      ? ([
          draftInvAddress1,
          draftInvAddress2,
          draftInvAddress3,
          draftInvTown,
          draftInvCity,
          draftInvCounty,
          draftInvPostcode,
        ]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join("\n") || projectAddress)
      : projectAddress;

    const businessName = (draftBusinessName || "").trim();
    const contactPerson = (draftContactName || "").trim();
    const clientName = type === "Business" ? (businessName || "Business") : ((draftClientName || "").trim() || "Client");

    setClients((prev) =>
      prev.map((c) =>
        c.id !== editingClientId
          ? c
          : {
              ...c,
              type,
              clientName,
              businessName: type === "Business" ? businessName : undefined,
              contactPerson: type === "Business" ? contactPerson : undefined,
              email: (draftEmail || "").trim(),
              mobile: (draftMobile || "").trim(),
              home: (draftHome || "").trim(),
              projectName: (draftProjectName || "").trim(),
              projectAddress,
              invoiceAddress,
            }
      )
    );

    setShowAddClient(false);
    setEditingClientId(null);
  }

  const [draftClientType, setDraftClientType] = useState<ClientType>("Individual");
  const [draftClientName, setDraftClientName] = useState("");
  const [draftBusinessName, setDraftBusinessName] = useState("");
  const [draftContactName, setDraftContactName] = useState("");
  const [draftProjectName, setDraftProjectName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftMobile, setDraftMobile] = useState("");
  const [draftHome, setDraftHome] = useState("");
  // Add client: Project + Invoice addresses
  const [draftProjAddress1, setDraftProjAddress1] = useState("");
  const [draftProjAddress2, setDraftProjAddress2] = useState("");
  const [draftProjAddress3, setDraftProjAddress3] = useState("");
  const [draftProjTown, setDraftProjTown] = useState("");
  const [draftProjCity, setDraftProjCity] = useState("");
  const [draftProjCounty, setDraftProjCounty] = useState("");
  const [draftProjPostcode, setDraftProjPostcode] = useState("");

  const [invoiceDifferent, setInvoiceDifferent] = useState(false);
  const [draftInvAddress1, setDraftInvAddress1] = useState("");
  const [draftInvAddress2, setDraftInvAddress2] = useState("");
  const [draftInvAddress3, setDraftInvAddress3] = useState("");
  const [draftInvTown, setDraftInvTown] = useState("");
  const [draftInvCity, setDraftInvCity] = useState("");
  const [draftInvCounty, setDraftInvCounty] = useState("");
  const [draftInvPostcode, setDraftInvPostcode] = useState("");


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

  const filteredClients = useMemo(() => clients, [clients]);

  function selectMenu(k: Models.MenuKey) {
    setMenu(k);
    setView("customers");
    setSelectedClientId(null);
    setSelectedEstimateId(null);
            setEstimatePickerClientId(null);
setPendingPickerClientId(null);
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

    const est: Estimate = {
      id: Models.asEstimateId(uid()),
      estimateRef: estimateRefWithRevision(base, 0),
      baseEstimateRef: base,
      revisionNo: 0,
      status: "Draft",
      defaults: makeDefaultEstimateDefaults(),
      positions: [],
    };

    setEstimateCounter((n) => n + 1);

    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, estimates: [est, ...c.estimates] } : c)));

    // go to Supplier & Product Defaults screen immediately
    openEstimateDefaults(client.id, est.id);
  }

  function openClient(client: Client) {
  setSelectedClientId(client.id);

  // Queue open until the Estimate Picker view is mounted.
  setPendingEstimatePickerClientId(client.id);
  setView("estimate_picker");
}


