# =========================
# QuoteSync Phase 4G - Fix "Open" (Estimate Picker) + null-guard tabs
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"

function Ok($m) { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m) { Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = $null
if ($runDir -match '[\\/]ps1_patches$') {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = $runDir
} else {
  Fail "Please run from: PS C:\Github\QuoteSync\web\ps1_patches>  (or from the web root)."
}

if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) {
  Fail "Could not detect web root. Expected src\App.tsx under: $webRoot"
}
Ok "Detected web root: $webRoot"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\20260303_phase4G_" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel) {
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "Missing file: $rel (looked in $src)" }
  $dstName = ($rel -replace '[\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

# Targets
$appRel  = "src\App.tsx"
$featRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"

Backup-File $appRel
Backup-File $featRel
Backup-File $tabsRel

# Ensure folders exist
$featDir = Split-Path (Join-Path $webRoot $featRel) -Parent
$tabsDir = Split-Path (Join-Path $webRoot $tabsRel) -Parent
New-Item -ItemType Directory -Path $featDir -Force | Out-Null
New-Item -ItemType Directory -Path $tabsDir -Force | Out-Null

# Write files (exact contents)
$appContent = @'

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


'@

$featContent = @'
// QuoteSync - Estimate Picker Feature (fixed/clean build)
// Purpose: isolated "Choose estimate" flow used from Customers -> Open button.
// - Supports optional prop `clientId` (preferred), and also an imperative ref `.open(id)` for backward compatibility.
// - No layout/styling changes intended; uses existing EstimatePickerTabs component.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import * as Models from "../../models/types";
import type { Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

export type EstimatePickerFeatureHandle = {
  open: (clientId: Models.ClientId) => void;
  clear: () => void;
  getClientId: () => Models.ClientId | null;
};

type Props = {
  // Preferred control: pass clientId from parent
  clientId?: Models.ClientId | null;

  clients: Client[];

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;
  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: string, estimateId: string) => void;
};

const DEFAULT_TAB: EstimatePickerTab = "client_info";

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>(null);

  // Sync selected client from parent (fixes blank screen when switching views)
  useEffect(() => {
    if (typeof clientId === "undefined") return; // allow imperative mode if parent doesn't pass it
    setPickerClientId(clientId ?? null);
  }, [clientId]);

  useImperativeHandle(
    ref,
    () => ({
      open: (id) => setPickerClientId(id),
      clear: () => setPickerClientId(null),
      getClientId: () => pickerClientId,
    }),
    [pickerClientId]
  );

  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // Local tab state + related stores
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>(DEFAULT_TAB);
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});

  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [activeUserName] = useState<string>("User");

  const [clientFileLabel, setClientFileLabel] = useState("");
  const [clientFileUrl, setClientFileUrl] = useState("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);

  // Reset tab + local UI when switching client
  useEffect(() => {
    setEstimatePickerTab(DEFAULT_TAB);
    setClientNoteDraftHtml("");
    setClientNotes([]);
    setClientFiles([]);
    setClientFileLabel("");
    setClientFileUrl("");
    setClientFileNames([]);
    setEstimateOutcomeById({});
  }, [pickerClientId]);

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClient) return;
    openEstimateDefaults(pickerClient.id, estimateId);
  }

  if (!pickerClient) {
    return (
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 13, color: "#71717a" }}>Select a client to view estimates.</div>
        <div style={{ marginTop: 10 }}>
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
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "#18181b" }}>Choose an estimate</div>
          <div style={{ fontSize: 12, color: "#71717a", marginTop: 6 }}>
            {pickerClient.clientName} • {pickerClient.clientRef}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setEstimatePickerTab(DEFAULT_TAB);
              onBack();
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
            Back
          </button>

          <button
            type="button"
            onClick={() => {
              setEstimatePickerTab(DEFAULT_TAB);
              createEstimateForClient(pickerClient);
            }}
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
  );
});

export default EstimatePickerFeature;

'@

$tabsContent = @'
// Auto-generated extraction (Phase 2): Estimate Picker Tabs
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
  return <div style={{ fontSize: 12, color: "#71717a", ...(style ?? {}) }}>{children}</div>;
}

function H3({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b", ...(style ?? {}) }}>{children}</h3>;
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
      <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14, background: "#fff" }}>
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

Set-Content -Path (Join-Path $webRoot $appRel)  -Value $appContent  -Encoding UTF8
Ok "Wrote $appRel"

Set-Content -Path (Join-Path $webRoot $featRel) -Value $featContent -Encoding UTF8
Ok "Wrote $featRel"

Set-Content -Path (Join-Path $webRoot $tabsRel) -Value $tabsContent -Encoding UTF8
Ok "Wrote $tabsRel"

# Quick sanity: ensure App now queues the open
$appNow = Get-Content (Join-Path $webRoot $appRel) -Raw -Encoding UTF8
if ($appNow -notmatch 'pendingEstimatePickerClientId') {
  Warn "Sanity check: pendingEstimatePickerClientId not found in App.tsx (unexpected)."
} else {
  Ok "Sanity check: App.tsx contains pendingEstimatePickerClientId."
}

Ok "DONE. Next: run npm run dev from: $webRoot"
try {
  Set-Location $webRoot
  npm run dev
} catch {
  Warn "npm run dev failed or was cancelled. You can run it manually from: $webRoot"
}
