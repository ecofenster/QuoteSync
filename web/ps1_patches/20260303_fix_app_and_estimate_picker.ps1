# QuoteSync Phase 4 - Fix App.tsx compile + Estimate Picker Open flow (no layout changes)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

function Find-WebRoot([string]$start) {
  $p = Resolve-Path $start | Select-Object -ExpandProperty Path
  for ($i=0; $i -lt 8; $i++) {
    if (Test-Path (Join-Path $p "src\App.tsx")) { return $p }
    if ($p -match 'ps1_patches$') {
      $parent = Split-Path $p -Parent
      if (Test-Path (Join-Path $parent "src\App.tsx")) { return $parent }
    }
    $parent = Split-Path $p -Parent
    if ($parent -eq $p) { break }
    $p = $parent
  }
  return $null
}

$webRoot = Find-WebRoot $runDir
if (-not $webRoot) { Fail "Could not locate web root (folder containing src\App.tsx) from: $runDir" }
Ok "Detected web root: $webRoot"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel) {
  $src = Join-Path $webRoot $rel
  if (Test-Path $src) {
    $dstName = ($rel -replace '[\\/:]', '_')
    $dst = Join-Path $backup $dstName
    Copy-Item $src $dst -Force
    Ok "Backed up $rel -> $dst"
  } else {
    Ok "Skip backup (file not found): $rel"
  }
}

# Target files
$appRel = "src\App.tsx"
$featRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"

Backup-File $appRel
Backup-File $featRel
Backup-File $tabsRel

# Ensure folders exist
New-Item -ItemType Directory -Force -Path (Join-Path $webRoot "src\features\estimatePicker") | Out-Null

$content_app = @'

import React, { useEffect, useMemo, useRef, useState } from "react";
import GridEditor from "./components/GridEditor";
import EstimatePickerFeature, { type EstimatePickerFeatureHandle } from "./features/estimatePicker/EstimatePickerFeature";
import DefaultsEditor from "./features/estimateDefaults/DefaultsEditor";
import { DEFAULT_CUSTOMER_ADDRESS, makeDefaultClients } from "./features/clients/defaultClients";
import * as Models from "./models/types";
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

  // Store selected client for the picker, then switch view.
  // (Ref may not be mounted yet, so avoid calling ref.open() here.)
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

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => (e.id !== selectedEstimate.id ? e : { ...e, positions: [newPos, ...e.positions] })),
        };
      })
    );

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
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return { ...c, estimates: c.estimates.map((e) => (e.id === selectedEstimate.id ? { ...e, defaults: next } : e)) };
      })
    );
  }

  function setPositionDefaultsOverride(next: EstimateDefaults) {
    setPosDraft((p) => ({ ...p, overrides: { ...next } }));
  }

  function createClient(type: ClientType) {
    const projectAddressStr = [
      draftProjAddress1.trim(),
      draftProjAddress2.trim(),
      draftProjAddress3.trim(),
      draftProjTown.trim(),
      draftProjCity.trim(),
      draftProjCounty.trim(),
      draftProjPostcode.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const invoiceAddressStr = invoiceDifferent
      ? [
          draftInvAddress1.trim(),
          draftInvAddress2.trim(),
          draftInvAddress3.trim(),
          draftInvTown.trim(),
          draftInvCity.trim(),
          draftInvCounty.trim(),
          draftInvPostcode.trim(),
        ]
          .filter(Boolean)
          .join("\n")
      : projectAddressStr;
    const projectAddress = [
      draftProjAddress1, draftProjAddress2, draftProjAddress3,
      draftProjTown, draftProjCity, draftProjCounty, draftProjPostcode,
    ].map((s) => (s || "").trim()).filter(Boolean).join("\n") || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddress = invoiceDifferent
      ? ([
          draftInvAddress1, draftInvAddress2, draftInvAddress3,
          draftInvTown, draftInvCity, draftInvCounty, draftInvPostcode,
        ].map((s) => (s || "").trim()).filter(Boolean).join("\n") || projectAddress)
      : projectAddress;

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
      projectName: "",
      projectAddress,
      invoiceAddress,
      businessName: type === "Business" ? businessName : undefined,
      contactPerson: type === "Business" ? contactPerson : undefined,
      estimates: [],
    };

    setClients((prev) => [newClient, ...prev]);
    setClientCounter((n) => n + 1);

    setShowAddClient(false);
    setDraftClientType("Individual");
    setDraftClientName("");
    setDraftBusinessName("");
    setDraftContactName("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
    setDraftProjAddress1("");
    setDraftProjAddress2("");
    setDraftProjAddress3("");
    setDraftProjTown("");
    setDraftProjCity("");
    setDraftProjCounty("");
    setDraftProjPostcode("");

    setInvoiceDifferent(false);
    setDraftInvAddress1("");
    setDraftInvAddress2("");
    setDraftInvAddress3("");
    setDraftInvTown("");
    setDraftInvCity("");
    setDraftInvCounty("");
    setDraftInvPostcode("");
  }

  function openAddClientPanel() {
    setEditingClientId(null);
    setDraftClientType("Individual");
    setDraftClientName("");
    setDraftBusinessName("");
    setDraftContactName("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
    setDraftProjectName("");
    setDraftProjAddress1("");
    setDraftProjAddress2("");
    setDraftProjAddress3("");
    setDraftProjTown("");
    setDraftProjCity("");
    setDraftProjCounty("");
    setDraftProjPostcode("");

    setInvoiceDifferent(false);
    setDraftInvAddress1("");
    setDraftInvAddress2("");
    setDraftInvAddress3("");
    setDraftInvTown("");
    setDraftInvCity("");
    setDraftInvCounty("");
    setDraftInvPostcode("");
    setShowAddClient(true);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", background: "#f4f4f5", minHeight: "100vh" }}>
      <div style={{ width: "100%", margin: "0", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
          {/* Sidebar */}
          <Card style={{ padding: 12 }}>
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
              <H3>Customers</H3>
              <div style={{ marginTop: 8 }}>
                <SidebarItem label="Client Database" active={menu === "client_database"} onClick={() => selectMenu("client_database")} />
                <SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />
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
          <div style={{ display: "grid", gap: 16 }}>
            {/* CUSTOMERS LIST */}
            {menu === "client_database" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Client Database</H2>
                    <Small>Open a client to choose an estimate (or create one).</Small>
                  </div>

                  <Button variant="primary" onClick={openAddClientPanel}>
                    Add new client
                  </Button>
                </div>

                {showAddClient && (
                  <div style={{ marginTop: 14, borderRadius: 16, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <H3>Client contact information</H3>

                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                          <div>
                            <div style={labelStyle}>Business name</div>
                            <Input value={draftBusinessName} onChange={setDraftBusinessName} placeholder="Company Ltd" />
                          </div>

                          <div>
                            <div style={labelStyle}>Contact name</div>
                            <Input value={draftContactName} onChange={setDraftContactName} placeholder="Name" />
                          </div>
                        </>
                      ) : (
                        <div>
                          <div style={labelStyle}>Client name</div>
                          <Input value={draftClientName} onChange={setDraftClientName} placeholder="Name" />
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={labelStyle}>Email</div>
                          <Input value={draftEmail} onChange={setDraftEmail} placeholder="email@example.com" />
                        </div>
                        <div>
                          <div style={labelStyle}>Mobile</div>
                          <Input value={draftMobile} onChange={setDraftMobile} placeholder="07..." />
                        </div>
                      </div>

                      <div>
                        <div style={labelStyle}>Home</div>
                        <Input value={draftHome} onChange={setDraftHome} placeholder="01..." />
                      </div>

                      <div>
                        <div style={labelStyle}>Project name</div>
                        <Input value={draftProjectName} onChange={setDraftProjectName} placeholder="Project name" />
                      </div>
                      <div style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
                        <H3>Project site address</H3>

                        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>Address line 1</div>
                              <Input value={draftProjAddress1} onChange={setDraftProjAddress1} placeholder="Address line 1" />
                            </div>
                            <div>
                              <div style={labelStyle}>Address line 2</div>
                              <Input value={draftProjAddress2} onChange={setDraftProjAddress2} placeholder="Address line 2" />
                            </div>
                          </div>

                          <div>
                            <div style={labelStyle}>Address line 3</div>
                            <Input value={draftProjAddress3} onChange={setDraftProjAddress3} placeholder="Address line 3" />
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>Town</div>
                              <Input value={draftProjTown} onChange={setDraftProjTown} placeholder="Town" />
                            </div>
                            <div>
                              <div style={labelStyle}>City</div>
                              <Input value={draftProjCity} onChange={setDraftProjCity} placeholder="City" />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>County</div>
                              <Input value={draftProjCounty} onChange={setDraftProjCounty} placeholder="County" />
                            </div>
                            <div>
                              <div style={labelStyle}>Postcode</div>
                              <Input value={draftProjPostcode} onChange={setDraftProjPostcode} placeholder="Postcode" />
                            </div>
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
                              <input
                                type="checkbox"
                                checked={invoiceDifferent}
                                onChange={(e) => setInvoiceDifferent(e.currentTarget.checked)}
                              />
                              Invoice address if different
                            </label>
                          </div>

                          {invoiceDifferent && (
                            <div style={{ marginTop: 10, borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                              <H3>Invoice address</H3>

                              <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div>
                                    <div style={labelStyle}>Town</div>
                                    <Input value={draftInvTown} onChange={setDraftInvTown} placeholder="Town" />
                                  </div>
                                  <div>
                                    <div style={labelStyle}>City</div>
                                    <Input value={draftInvCity} onChange={setDraftInvCity} placeholder="City" />
                                  </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div>
                                    <div style={labelStyle}>County</div>
                                    <Input value={draftInvCounty} onChange={setDraftInvCounty} placeholder="County" />
                                  </div>
                                  <div>
                                    <div style={labelStyle}>Postcode</div>
                                    <Input value={draftInvPostcode} onChange={setDraftInvPostcode} placeholder="Postcode" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
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
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <H3>{c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}</H3>
                          <Pill>{c.clientRef}</Pill>
                          <Small>{c.estimates.length} estimates</Small>
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <Button variant="primary" onClick={() => openClient(c)}>
                            Open
                          </Button>
                          <Button variant="secondary" onClick={() => createEstimateForClient(c)}>
                            New Estimate
                          </Button>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: "#71717a" }}>
                        {c.projectName || "No project name"} • {c.projectAddress ? c.projectAddress.split("\n")[0] : "No project address"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

                        {menu === "follow_ups" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ padding: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming soon.</Small>
                </div>
              </Card>
            )}

                                    {/* ESTIMATE PICKER */}

            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && (
              <EstimatePickerFeature
                ref={estimatePickerRef}
                clientId={estimatePickerClientId}
                clients={clients}
                onBack={() => { setEstimatePickerClientId(null); setView("customers"); }}
                openEditClientPanel={openEditClientPanel}
                createEstimateForClient={createEstimateForClient}
                openEstimateDefaults={(clientId, estimateId) => openEstimateDefaults(clientId, estimateId)}
              />
            )}
            {/* ESTIMATE DEFAULTS */}
            {view === "estimate_defaults" && selectedClient && selectedEstimate && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Supplier & Product Defaults</H2>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill>{selectedClient.clientRef}</Pill>
                      <Pill>{selectedEstimate.estimateRef}</Pill>
                      <Small>{selectedClient.clientName}</Small>
                    </div>
                    <Small>Set estimate-level defaults here. Add Position will use these when “Use estimate defaults” is on.</Small>
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
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill>{selectedClient.clientRef}</Pill>
                      <Pill>{selectedEstimate.estimateRef}</Pill>
                      <Small>{selectedClient.clientName}</Small>
                    </div>
                    <Small>Supplier/Product Defaults are set separately. Add Position starts at Position → Dimensions → Configuration.</Small>
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

                    {selectedEstimate.positions.map((p) => (
                      <div key={p.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 10, background: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{p.positionRef}</div>
                          <div style={{ fontSize: 12, color: "#71717a" }}>
                            Qty {p.qty} • {p.widthMm}×{p.heightMm} • {p.fieldsX}×{p.fieldsY}
                          </div>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#71717a" }}>
                          {p.roomName || "—"} • {p.positionType} • {p.useEstimateDefaults ? "Using estimate defaults" : "Overrides"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Position wizard */}
                {showPositionWizard && selectedEstimate && (
                  <div style={{ marginTop: 14, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <H3>Add Position</H3>
                      <Button variant="secondary" onClick={() => setShowPositionWizard(false)} style={{ borderRadius: 14, padding: "8px 10px" }}>
                        Close
                      </Button>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
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

                    <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                      {posStep === 1 && (
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>Position reference</div>
                              <Input value={posDraft.positionRef} onChange={(v) => setPosDraft((p) => ({ ...p, positionRef: v }))} />
                            </div>
                            <div>
                              <div style={labelStyle}>Quantity</div>
                              <Input type="number" value={String(posDraft.qty)} onChange={(v) => setPosDraft((p) => ({ ...p, qty: Math.max(1, Math.min(999, Number(v || 1))) }))} />
                            </div>
                          </div>

                          <div>
                            <div style={labelStyle}>Room name</div>
                            <Input value={posDraft.roomName} onChange={(v) => setPosDraft((p) => ({ ...p, roomName: v }))} />
                          </div>

                          <div>
                            <div style={labelStyle}>Position type</div>
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
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>Total width (mm)</div>
                              <Input type="number" value={String(posDraft.widthMm)} onChange={(v) => setPosDraft((p) => ({ ...p, widthMm: Number(v || p.widthMm) }))} />
                            </div>
                            <div>
                              <div style={labelStyle}>Total height (mm)</div>
                              <Input type="number" value={String(posDraft.heightMm)} onChange={(v) => setPosDraft((p) => ({ ...p, heightMm: Number(v || p.heightMm) }))} />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={labelStyle}>Fields (width)</div>
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
                            <div>
                              <div style={labelStyle}>Fields (height)</div>
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
                        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16 }}>
                          {/* Left column */}
                          <div style={{ display: "grid", gap: 12 }}>
                            <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <H3>Insertion</H3>

                              <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontSize: 12, color: "#71717a" }}>
                                  Selected field: #{draftSelectedCell.row * posDraft.fieldsX + draftSelectedCell.col + 1}
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

                              <div style={{ marginTop: 8 }}>
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

                            <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <H3>Use estimate defaults</H3>
                              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                                  <input type="checkbox" checked={posDraft.useEstimateDefaults} onChange={(e) => setPosDraft((p) => ({ ...p, useEstimateDefaults: e.target.checked }))} />
                                  Use estimate defaults for this position
                                </label>
                                <Small>When unticked, you can override the same defaults below (same option set as “Supplier & Product Defaults”).</Small>
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
                          <div style={{ display: "grid", gap: 12 }}>
                            <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <H3>Preview</H3>
                                <Pill>{posDraft.insertion}</Pill>
                              </div>

                              <div style={{ marginTop: 12 }}>
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

                              <div style={{ marginTop: 12, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
                                <H3>Summary</H3>
                                <Small>
                                  {(() => {
                                    const eff = effectiveDefaultsForPosition(selectedEstimate, posDraft);
                                    return `${eff.supplier || "—"} / ${eff.productType || "—"} / ${eff.product || "—"} • Hinge: ${eff.hingeType} • Glass: ${eff.glassType} Ug ${eff.ugValue} G ${eff.gValue}`;
                                  })()}
                                </Small>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              </Card>
            )}

            {/* Fallback for other menus */}
            {menu !== "client_database" && (
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





















'@

$content_feat = @'
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import * as Models from "../../models/types";
import type { Client, Estimate } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

/**
 * EstimatePickerFeature
 * Purpose: isolated "Estimate Picker" screen extracted from App.tsx.
 * Notes:
 * - Layout/styles preserved (inline styles).
 * - Parent can optionally pass clientId to open a specific client without needing the ref to be mounted.
 */

export type EstimatePickerFeatureHandle = {
  open: (clientId: Models.ClientId) => void;
  clear: () => void;
};

type Props = {
  clientId?: Models.ClientId | null;

  clients: Client[];
  onBack: () => void;

  openEditClientPanel: (c: Client) => void;
  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: Models.ClientId, estimateId: Models.EstimateId) => void;
};

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  // Tabs
  const [estimatePickerTab, setEstimatePickerTab] = useState<Models.EstimatePickerTab>("client_info");

  // Selected client inside the picker
  const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>(null);

  // Allow parent to drive which client is open (fixes blank screen when "Open" switches view before ref is mounted)
  useEffect(() => {
    if (typeof clientId === "undefined") return;
    setPickerClientId(clientId ?? null);
    setEstimatePickerTab("client_info");
  }, [clientId]);

  const pickerClient: Client | null = useMemo(() => {
    if (!pickerClientId) return null;
    return clients.find((c) => c.id === pickerClientId) ?? null;
  }, [clients, pickerClientId]);

  // Outcomes (Open/Lost/Order) stored locally for now
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<Models.EstimateId, Models.EstimateOutcome>>({});

  // Notes (simple local WYSIWYG)
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<Models.ClientNote[]>([]);

  // Files (links + optional picked file names)
  const [clientFileLabel, setClientFileLabel] = useState("");
  const [clientFileUrl, setClientFileUrl] = useState("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const [clientFiles, setClientFiles] = useState<Models.ClientFile[]>([]);

  const activeUserName = "User"; // TODO: wire to auth/profile later

  useImperativeHandle(ref, () => ({
    open: (id: Models.ClientId) => {
      setPickerClientId(id);
      setEstimatePickerTab("client_info");
    },
    clear: () => {
      setPickerClientId(null);
      setEstimatePickerTab("client_info");
    },
  }));

  function openEstimateFromPicker(estimateId: Models.EstimateId) {
    if (!pickerClient) return;
    openEstimateDefaults(pickerClient.id, estimateId);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#18181b" }}>Estimate Picker</div>
          <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
            Select a client, then pick an estimate (or create one).
          </div>
        </div>

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

      {!pickerClient ? (
        <div style={{ borderRadius: 16, border: "1px dashed #e4e4e7", padding: 14, background: "#fff" }}>
          <div style={{ fontSize: 13, color: "#71717a" }}>No client selected. Go back and click “Open” on a client.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => createEstimateForClient(pickerClient)}
              style={{
                borderRadius: 18,
                border: "none",
                background: "#18181b",
                color: "#fff",
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              New Estimate
            </button>

            <button
              type="button"
              onClick={() => openEditClientPanel(pickerClient)}
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
              Edit Client
            </button>
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
      )}
    </div>
  );
});

export default EstimatePickerFeature;

'@

$content_tabs = @'
﻿// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React from "react";
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

function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, color: "#71717a", ...(style || {}) }}>{children}</div>;
}}>{children}</div>;
}

function H3({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b", ...(style || {}) }}>{children}</h3>;
}}>{children}</h3>;
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

  if (!pickerClient) {
    return (
      <div style={{ borderRadius: 16, border: "1px dashed #e4e4e7", padding: 14, background: "#fff" }}>
        <Small>No client selected.</Small>
      </div>
    );
  }

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
              <select
                value={outcome}
                onChange={(ev) => {
                  const v = ev.currentTarget.value as EstimateOutcome;
                  setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: v }));
                }}
                style={{
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
    </>
  );
}


'@


Set-Content -Path (Join-Path $webRoot $appRel) -Value $content_app -Encoding UTF8
Ok "Wrote $appRel"

Set-Content -Path (Join-Path $webRoot $featRel) -Value $content_feat -Encoding UTF8
Ok "Wrote $featRel"

Set-Content -Path (Join-Path $webRoot $tabsRel) -Value $content_tabs -Encoding UTF8
Ok "Wrote $tabsRel"

Ok "DONE. Refresh the browser, then click Open on a client. If anything is still blank, send the first red error line from the Vite terminal."
