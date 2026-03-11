# =========================
# QuoteSync - Stabilise & Save Point (writes known-good files + backup + zip)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = $null
if (Test-Path (Join-Path $runDir "..\src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = (Resolve-Path $runDir).Path
} else {
  Fail "Could not detect web root. Expected src\App.tsx in current dir or parent of ps1_patches."
}
Ok "Detected web root: $webRoot"

# Backup folder
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp + "_stabilise_savepoint")
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Warn "Backup skip (missing): $rel"; return }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

function Write-File($rel, [string]$content){
  $path = Join-Path $webRoot $rel
  $dir = Split-Path $path -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  # Write as UTF8 (no BOM)
  [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))
  Ok "Wrote $rel"
}

# Files to stabilise
$targets = @(
  "src\App.tsx",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx",
  "src\components\GridEditor.tsx",
  "src\features\estimateDefaults\DefaultsEditor.tsx",
  "src\features\estimateDefaults\defaultEstimateDefaults.ts",
  "src\features\clients\defaultClients.ts",
  "src\features\catalog\defaultCatalog.ts",
  "src\models\types.ts"
)

foreach ($t in $targets) { Backup-File $t }

# -------------------------
# Write known-good file contents (as supplied in chat)
# -------------------------

$content_1579088500749802243 = @'

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

  // Store the selected client in App state first, then switch view.
  // (Fixes blank screen: ref isn't mounted yet when called from Customers list)
  setEstimatePickerClientId(client.id);
  setView("estimate_picker");
}function startAddPosition() {
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
                initialClientId={pendingPickerClientId}
                onConsumedInitialClientId={() => setPendingPickerClientId(null)}
                clients={clients}
                onBack={() => { setEstimatePickerClientId(null); estimatePickerRef.current?.clear(); setView("customers"); }}
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
Write-File "src\App.tsx" $content_1579088500749802243

$content_161403774974342219 = @'
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

export type EstimatePickerFeatureHandle = {
  open: (clientId: ClientId) => void;
  clear: () => void;
};

type Props = {
  
  clientId?: Models.ClientId | null;
clients: Client[];

  // When App switches to this view, it passes the client id here so we can open reliably after mount.
  initialClientId?: ClientId | null;
  onConsumedInitialClientId?: () => void;

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;

  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: ClientId, estimateId: EstimateId) => void;
};

/* =========================
   UI primitives (duplicated to avoid UI drift)
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

/* =========================
   Feature container
========================= */

const EstimatePickerFeature = React.forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  // estimate picker (moved from App.tsx)
  const [pickerClientId, setPickerClientId] = useState<ClientId | null>(null);

  // Sync selected client from parent (fixes blank screen when switching views)
  useEffect(() => {
    if (typeof clientId === "undefined") return;
    setPickerClientId(clientId ?? null);
  }, [clientId]);
  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // Sync from App-controlled clientId to avoid ref timing race (Open -> view switch).
  useEffect(() => {
    if (clientId) setPickerClientId(clientId);
  }, [clientId]);

  // estimate picker tabs (Estimate Picker only)
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [clientFileLabel, setClientFileLabel] = useState<string>("");
  const [clientFileUrl, setClientFileUrl] = useState<string>("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const activeUserName = "User";

  useImperativeHandle(
    ref,
    () => ({
      open: (clientId) => setPickerClientId(clientId),
      clear: () => setPickerClientId(null),
    }),
    []
  );

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClientId) return;
    openEstimateDefaults(pickerClientId, estimateId);
  }

    if (!pickerClient) {
    return (
      <Card style={{ minHeight: 520 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <H2>Estimate Picker</H2>
            <Small>Select a client to view estimates/orders/notes/files.</Small>
          </div>

          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {clients.length === 0 && <Small>No clients yet.</Small>}

          {clients.map((c) => (
            <div
              key={c.id}
              style={{
                borderRadius: 16,
                border: "1px solid #e4e4e7",
                padding: 12,
                background: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>
                  {c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}
                </div>
                <Small>
                  {c.clientRef} • {c.estimates.length} estimates
                </Small>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={() => openEditClientPanel(c)}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => createEstimateForClient(c)}>
                  New Estimate
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
  }return (
    <Card style={{ minHeight: 520 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <H2>Choose an estimate</H2>
            <Small>
              {pickerClient.clientName} • {pickerClient.clientRef}
            </Small>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                onBack();
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                createEstimateForClient(pickerClient);
              }}
            >
              New Estimate
            </Button>
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
    </Card>
  );
});

export default EstimatePickerFeature;




'@
Write-File "src\features\estimatePicker\EstimatePickerFeature.tsx" $content_161403774974342219

$content_1972108844492933285 = @'
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
Write-File "src\features\estimatePicker\EstimatePickerTabs.tsx" $content_1972108844492933285

$content_641223992292276793 = @'
import React, { useEffect, useMemo, useState } from "react";

type PosDraft = {
  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;
  insertion: string;
  cellInsertions?: Record<string, string>; // key: "col,row"

  // optional, persisted per position
  colWidthsMm?: number[];
  rowHeightsMm?: number[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function evenSplit(total: number, parts: number) {
  const p = clamp(Math.round(parts), 1, 16);
  const base = Math.floor(total / p);
  const rem = total - base * p;
  const out: number[] = [];
  for (let i = 0; i < p; i++) out.push(base + (i < rem ? 1 : 0));
  return out;
}

function parseSlashList(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const items = s.split("/").map((x) => x.trim()).filter(Boolean);
  if (!items.length) return null;
  const nums = items.map((x) => Number(x));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return nums.map((n) => Math.round(n));
}

function fmtSlash(arr: number[]) {
  return arr.map((n) => String(Math.round(n))).join("/");
}

function labelForInsertion(ins: string) {
  const t = (ins || "").toLowerCase();
  if (t.includes("entrance")) return "Entrance Door";
  if (t.includes("lift") || t.includes("slide")) return "Lift & Slide";
  if (t.includes("french")) return "French Doors";
  if (t.includes("single door")) return "Single Door";
  if (t.includes("door")) return "Door";
  if (t.includes("window")) return "Window";
  return ins || "Insertion";
}

function cellIndex1Based(col: number, row: number, fieldsX: number) {
  return row * fieldsX + col + 1;

}

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizeCellInsertions(
  fieldsX: number,
  fieldsY: number,
  existing: Record<string, string> | undefined,
  fallback: string
) {
  const out: Record<string, string> = {};
  for (let r = 0; r < fieldsY; r++) {
    for (let c = 0; c < fieldsX; c++) {
      const k = keyForCell(c, r);
      out[k] = existing?.[k] ?? fallback;
    }
  }
  return out;
}

function isFixedInsertion(ins: string) {
  return (ins || "").toLowerCase().includes("fixed");
}

function makeDashProps(dashed: boolean) {
  return dashed ? { strokeDasharray: "6 6" } : {};
}


export default function GridEditor({
  pos,
  setPos,
  selectedCell,
  onSelectCell,
  view = "Inside",
  openingStd = "DIN",
}: {
  pos: PosDraft;
  setPos: React.Dispatch<React.SetStateAction<any>>;
  selectedCell?: { col: number; row: number };
  onSelectCell?: (cell: { col: number; row: number }) => void;
  view?: "Inside" | "Outside";
  openingStd?: "DIN" | "UK";
}) {
  const totalW = clamp(Math.round(pos.widthMm || 0), 300, 6000);
  const totalH = clamp(Math.round(pos.heightMm || 0), 300, 6000);
  const fx = clamp(Math.round(pos.fieldsX || 1), 1, 16);
  const fy = clamp(Math.round(pos.fieldsY || 1), 1, 16);


  const cellInsertions = useMemo(
    () => normalizeCellInsertions(fx, fy, pos.cellInsertions, pos.insertion),
    [fx, fy, pos.cellInsertions, pos.insertion]
  );
  const allFixed = useMemo(() => Object.values(cellInsertions).every(isFixedInsertion), [cellInsertions]);
  // Keep local edit strings for slash input UX
  const [colStr, setColStr] = useState("");
  const [rowStr, setRowStr] = useState("");
  const [colDirty, setColDirty] = useState(false);
  const [rowDirty, setRowDirty] = useState(false);

  // Initialise / repair widths/heights
  const cols = useMemo(() => {
    const existing = Array.isArray(pos.colWidthsMm) ? pos.colWidthsMm.slice() : null;
    if (!existing || existing.length !== fx) return evenSplit(totalW, fx);
    const s = sum(existing);
    if (s !== totalW) {
      // scale roughly to fit total
      const scaled = existing.map((v) => Math.max(1, Math.round((v / s) * totalW)));
      // fix rounding drift
      let drift = totalW - sum(scaled);
      for (let i = 0; i < scaled.length && drift !== 0; i++) {
        const step = drift > 0 ? 1 : -1;
        if (scaled[i] + step >= 1) {
          scaled[i] += step;
          drift -= step;
        }
      }
      return scaled;
    }
    return existing.map((v) => Math.max(1, Math.round(v)));
  }, [pos.colWidthsMm, fx, totalW]);

  const rows = useMemo(() => {
    const existing = Array.isArray(pos.rowHeightsMm) ? pos.rowHeightsMm.slice() : null;
    if (!existing || existing.length !== fy) return evenSplit(totalH, fy);
    const s = sum(existing);
    if (s !== totalH) {
      const scaled = existing.map((v) => Math.max(1, Math.round((v / s) * totalH)));
      let drift = totalH - sum(scaled);
      for (let i = 0; i < scaled.length && drift !== 0; i++) {
        const step = drift > 0 ? 1 : -1;
        if (scaled[i] + step >= 1) {
          scaled[i] += step;
          drift -= step;
        }
      }
      return scaled;
    }
    return existing.map((v) => Math.max(1, Math.round(v)));
  }, [pos.rowHeightsMm, fy, totalH]);

  // Keep posDraft in sync with computed arrays (symmetry by default)
  useEffect(() => {
    setPos((p: any) => ({
      ...p,
      widthMm: totalW,
      heightMm: totalH,
      fieldsX: fx,
      fieldsY: fy,
      colWidthsMm: cols,
      rowHeightsMm: rows,
    }));
    // keep input strings reflecting current values unless user is editing
    setColStr((s) => (colDirty ? s : fmtSlash(cols)));
    setRowStr((s) => (rowDirty ? s : fmtSlash(rows)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalW, totalH, fx, fy]);

  // Apply slash list on blur/enter
  const applyCols = () => {
    const parsed = parseSlashList(colStr);
    if (!parsed) {
      setColStr(fmtSlash(cols));
      setColDirty(false);
      return;
    }
    if (parsed.length !== fx) {
      setColStr(fmtSlash(cols));
      setColDirty(false);
      return;
    }
    if (sum(parsed) !== totalW) {
      setColStr(fmtSlash(cols));
      setColDirty(false);
      return;
    }
    setPos((p: any) => ({ ...p, colWidthsMm: parsed }));
    setColDirty(false);
  };

  const applyRows = () => {
    const parsed = parseSlashList(rowStr);
    if (!parsed) {
      setRowStr(fmtSlash(rows));
      setRowDirty(false);
      return;
    }
    if (parsed.length !== fy) {
      setRowStr(fmtSlash(rows));
      setRowDirty(false);
      return;
    }
    if (sum(parsed) !== totalH) {
      setRowStr(fmtSlash(rows));
      setRowDirty(false);
      return;
    }
    setPos((p: any) => ({ ...p, rowHeightsMm: parsed }));
    setRowDirty(false);
  };

  // Remove split by clicking divider -> merge two adjacent parts and reduce count
  const removeVSplit = (splitIndex: number) => {
    // splitIndex is boundary between col[splitIndex-1] and col[splitIndex]
    if (fx <= 1) return;
    const i = clamp(splitIndex, 1, fx - 1);
    const next = cols.slice();
    next[i - 1] = next[i - 1] + next[i];
    next.splice(i, 1);
    setPos((p: any) => {
      const existing = normalizeCellInsertions(p.fieldsX, p.fieldsY, p.cellInsertions, p.insertion);
      const merged: Record<string, string> = {};
      for (let r = 0; r < p.fieldsY; r++) {
        for (let c = 0; c < p.fieldsX - 1; c++) {
          // columns >= i shift left by 1; merged cell takes left insertion
          const srcC = c < i ? c : c + 1;
          const k = keyForCell(c, r);
          const srcKey = keyForCell(srcC, r);
          merged[k] = existing[srcKey];
        }
      }
      return { ...p, fieldsX: fx - 1, colWidthsMm: next, cellInsertions: merged };
    });
    setColDirty(false);
  };

  const removeHSplit = (splitIndex: number) => {
    if (fy <= 1) return;
    const i = clamp(splitIndex, 1, fy - 1);
    const next = rows.slice();
    next[i - 1] = next[i - 1] + next[i];
    next.splice(i, 1);
    setPos((p: any) => {
      const existing = normalizeCellInsertions(p.fieldsX, p.fieldsY, p.cellInsertions, p.insertion);
      const merged: Record<string, string> = {};
      for (let r = 0; r < p.fieldsY - 1; r++) {
        for (let c = 0; c < p.fieldsX; c++) {
          const srcR = r < i ? r : r + 1;
          const k = keyForCell(c, r);
          const srcKey = keyForCell(c, srcR);
          merged[k] = existing[srcKey];
        }
      }
      return { ...p, fieldsY: fy - 1, rowHeightsMm: next, cellInsertions: merged };
    });
    setRowDirty(false);
  };

  // --- LogiKal-style technical preview geometry ---
  const vbW = 520;
  const vbH = 520;

  const pad = 56; // outer padding around drawing + dimension space
  const availW = vbW - pad * 2;
  const availH = vbH - pad * 2;

  const ratio = Math.max(0.1, totalW / Math.max(1, totalH));
  let frameW = availW;
  let frameH = frameW / ratio;
  if (frameH > availH) {
    frameH = availH;
    frameW = frameH * ratio;
  }

  const frameX = pad + (availW - frameW) / 2;
  const frameY = pad + (availH - frameH) / 2;

  const frameTh = 18;

// LogiKal-like: frame -> gap -> sash profile -> glass area
const sashGap = 6;
const sashOuterX = frameX + frameTh + sashGap;
const sashOuterY = frameY + frameTh + sashGap;
const sashOuterW = frameW - (frameTh + sashGap) * 2;
const sashOuterH = frameH - (frameTh + sashGap) * 2;

const sashProfile = 16;
const glassX = sashOuterX + sashProfile;
const glassY = sashOuterY + sashProfile;
const glassW = sashOuterW - sashProfile * 2;
const glassH = sashOuterH - sashProfile * 2;

  const xStops = useMemo(() => {
    const xs: number[] = [glassX];
    let acc = 0;
    for (let i = 0; i < cols.length; i++) {
      acc += cols[i] / totalW;
      xs.push(glassX + glassW * acc);
    }
    xs[xs.length - 1] = glassX + glassW;
    return xs;
  }, [cols, totalW, glassX, glassW]);

  const yStops = useMemo(() => {
    const ys: number[] = [glassY];
    let acc = 0;
    for (let i = 0; i < rows.length; i++) {
      acc += rows[i] / totalH;
      ys.push(glassY + glassH * acc);
    }
    ys[ys.length - 1] = glassY + glassH;
    return ys;
  }, [rows, totalH, glassY, glassH]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
        <div style={{ fontSize: 12, color: "#71717a", marginBottom: 8 }}>
          {labelForInsertion(pos.insertion)} • {fx}×{fy} • {totalW}×{totalH} mm
        </div>

        <div style={{ width: "100%", aspectRatio: "16/9" }}>
          <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height="100%" style={{ display: "block" }}>
            <rect x={0} y={0} width={vbW} height={vbH} fill="#ffffff" />

            {/* Frame (technical, square corners) */}
            <rect x={frameX} y={frameY} width={frameW} height={frameH} fill="none" stroke="#111" strokeWidth={1.6} />
            <rect
              x={frameX + frameTh}
              y={frameY + frameTh}
              width={frameW - frameTh * 2}
              height={frameH - frameTh * 2}
              fill="none"
              stroke="#111"
              strokeWidth={1}
            />

            {/* Sash (profile) + Glass (LogiKal-like) */}
            {!allFixed && view === "Inside" ? (
              <rect x={sashOuterX} y={sashOuterY} width={sashOuterW} height={sashOuterH} fill="#e6e9ee" stroke="#111" strokeWidth={1.2} />
            ) : null}
            <rect x={glassX} y={glassY} width={glassW} height={glassH} fill="#b9d7f3" stroke="#111" strokeWidth={1} />

            {/* Grid lines */}
            {xStops.slice(1, -1).map((x, idx) => (
              <g key={"v" + idx}>
                <line x1={x} y1={glassY} x2={x} y2={glassY + glassH} stroke="#111" strokeWidth={1} />
                {/* clickable zone */}
                <line
                  x1={x}
                  y1={glassY}
                  x2={x}
                  y2={glassY + glassH}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: "pointer" }}
                  onClick={() => removeVSplit(idx + 1)}
                />
              </g>
            ))}

            {yStops.slice(1, -1).map((y, idx) => (
              <g key={"h" + idx}>
                <line x1={glassX} y1={y} x2={glassX + glassW} y2={y} stroke="#111" strokeWidth={1} />
                <line
                  x1={glassX}
                  y1={y}
                  x2={glassX + glassW}
                  y2={y}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: "pointer" }}
                  onClick={() => removeHSplit(idx + 1)}
                />
              </g>
            ))}

            {/* Cell numbers (LogiKal-like field labels) */}
            {Array.from({ length: fy }, (_, row) =>
              Array.from({ length: fx }, (_, col) => {
                const x0 = xStops[col];
                const x1 = xStops[col + 1];
                const y0 = yStops[row];
                const y1 = yStops[row + 1];
                const n = cellIndex1Based(col, row, fx);

                // Centered hex label (matches LogiKal-like schedule labels)
                const cx = (x0 + x1) / 2;
                const cy = (y0 + y1) / 2;
                const r = 16; // radius
                const pts = Array.from({ length: 6 }, (_, i) => {
                  const a = (Math.PI / 3) * i - Math.PI / 6; // flat-top
                  return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
                }).join(" ");

                const key = keyForCell(col, row);
                const ins = cellInsertions[key] ?? pos.insertion;
                const isSel = selectedCell && selectedCell.col === col && selectedCell.row === row;

                // convention/view: we keep a single handedness model for now (handle side derived from std + view)
                const swap = (view === "Outside") !== (openingStd === "UK");
                const hingeLeft = !swap; // DIN+Inside => hinge left; flipped otherwise
                const hx = hingeLeft ? x0 : x1;
                const ox = hingeLeft ? x1 : x0;

                const dash = { stroke: "#111", strokeWidth: 1.1, ...makeDashProps(true) };
                const solid = { stroke: "#111", strokeWidth: 1.1 };

                const drawTurn = () => (
                  <>
                    <line x1={hx} y1={y0} x2={ox} y2={cy} {...dash} />
                    <line x1={hx} y1={y1} x2={ox} y2={cy} {...dash} />
                  </>
                );

                const drawTilt = () => (
                  <>
                    <line x1={x0} y1={y1} x2={cx} y2={y0} {...dash} />
                    <line x1={x1} y1={y1} x2={cx} y2={y0} {...dash} />
                  </>
                );

                const drawTopHung = () => (
                  <>
                    <line x1={x0} y1={y0} x2={cx} y2={y1} {...dash} />
                    <line x1={x1} y1={y0} x2={cx} y2={y1} {...dash} />
                  </>
                );

                const drawReversible = () => (
                  <>
                    <line x1={cx} y1={y0} x2={x0} y2={cy} {...dash} />
                    <line x1={cx} y1={y0} x2={x1} y2={cy} {...dash} />
                    <line x1={cx} y1={y1} x2={x0} y2={cy} {...dash} />
                    <line x1={cx} y1={y1} x2={x1} y2={cy} {...dash} />
                  </>
                );

                const drawFixed = () => (
                  <>
                    <line x1={cx - (x1 - x0) * 0.18} y1={cy} x2={cx + (x1 - x0) * 0.18} y2={cy} {...solid} />
                    <line x1={cx} y1={cy - (y1 - y0) * 0.18} x2={cx} y2={cy + (y1 - y0) * 0.18} {...solid} />
                  </>
                );

                const drawSymbol = () => {
                  const t = (ins || "").toLowerCase();
                  if (t.includes("tilt") && t.includes("turn")) return (<>{drawTurn()}{drawTilt()}</>);
                  if (t.includes("top hung")) return drawTopHung();
                  if (t.includes("tilt")) return drawTilt();
                  if (t.includes("reversible")) return drawReversible();
                  if (t.includes("side hung") || t.includes("turn")) return drawTurn();
                  if (t.includes("fixed")) return drawFixed();
                  return null;
                };

                return (
                  <g key={`c-${col}-${row}`}>
                    {/* click target */}
                    <rect
                      x={x0}
                      y={y0}
                      width={x1 - x0}
                      height={y1 - y0}
                      fill="transparent"
                      style={{ cursor: onSelectCell ? "pointer" : "default" }}
                      onClick={() => onSelectCell?.({ col, row })}
                    />
                    {/* selection highlight */}
                    {isSel ? (
                      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke="#22c55e" strokeWidth={2} />
                    ) : null}

                    {/* operation symbol (closed) */}
                    {drawSymbol()}

                    {/* hex field label */}
                    <polygon points={pts} fill="#fff" stroke="#111" strokeWidth={1} />
                    <text
                      x={cx}
                      y={cy + 4}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={600}
                      fill="#111"
                      fontFamily="ui-sans-serif, system-ui, -apple-system"
                    >
                      {n}
                    </text>
                  </g>
                );
              })
            )}
{/* Dimensions (simple technical) */}
            <g stroke="#111" strokeWidth={0.9} fill="none" fontFamily="ui-sans-serif, system-ui, -apple-system" fontSize={12}>
              {/* width line below */}
              <line x1={frameX} y1={frameY + frameH + 26} x2={frameX + frameW} y2={frameY + frameH + 26} />
              <line x1={frameX} y1={frameY + frameH + 20} x2={frameX} y2={frameY + frameH + 32} />
              <line x1={frameX + frameW} y1={frameY + frameH + 20} x2={frameX + frameW} y2={frameY + frameH + 32} />
              <text x={frameX + frameW / 2} y={frameY + frameH + 46} textAnchor="middle" fill="#111">
                {totalW}
              </text>

              {/* height line to right */}
              <line x1={frameX + frameW + 26} y1={frameY} x2={frameX + frameW + 26} y2={frameY + frameH} />
              <line x1={frameX + frameW + 20} y1={frameY} x2={frameX + frameW + 32} y2={frameY} />
              <line x1={frameX + frameW + 20} y1={frameY + frameH} x2={frameX + frameW + 32} y2={frameY + frameH} />
              <text
                x={frameX + frameW + 46}
                y={frameY + frameH / 2}
                transform={`rotate(90 ${frameX + frameW + 46} ${frameY + frameH / 2})`}
                textAnchor="middle"
                fill="#111"
              >
                {totalH}
              </text>
            </g>

            {/* Handle marker (neutral, technical) */}
            <g stroke="#111" strokeWidth={1.6} strokeLinecap="round">
              <line x1={frameX + frameW + 2} y1={frameY + frameH / 2 - 10} x2={frameX + frameW + 2} y2={frameY + frameH / 2 + 10} />
            </g>
          </svg>
        </div>

        {/* sizing overrides */}
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {fx > 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Column widths (mm) — format: 1000/500 (must sum to {totalW})
              </div>
              <input
                value={colStr}
                onChange={(e) => {
                  setColStr(e.target.value);
                  setColDirty(true);
                }}
                onBlur={applyCols}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCols();
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  outline: "none",
                  fontSize: 14,
                }}
              />
            </div>
          )}

          {fy > 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Row heights (mm) — format: 1200/900 (must sum to {totalH})
              </div>
              <input
                value={rowStr}
                onChange={(e) => {
                  setRowStr(e.target.value);
                  setRowDirty(true);
                }}
                onBlur={applyRows}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyRows();
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  outline: "none",
                  fontSize: 14,
                }}
              />
            </div>
          )}

          <div style={{ fontSize: 12, color: "#71717a" }}>
            Tip: click a vertical or horizontal split line in the drawing to remove that split (e.g. 2×2 → remove one split → 3 sections).
          </div>
        </div>
      </div>
    </div>
  );
}







'@
Write-File "src\components\GridEditor.tsx" $content_641223992292276793

$content_3475381355397726571 = @'
﻿// Auto-generated by QuoteSync Phase 4B extraction patch.
// Moved from src/App.tsx (no UI/layout/logic changes).
import React, { useEffect } from "react";
import * as Models from "../../models/types";
import type { EstimateDefaults } from "../../models/types";
import { PRODUCT_TYPES, SUPPLIERS, WOOD_TYPES, FINISHES_BY_TYPE, allProductsForSupplier, firstProductForSupplier, isTimberProductType } from "../catalog/defaultCatalog";
import { HINGE_TYPES, UG_DOUBLE, UG_TRIPLE, HANDLE_TYPES, SUN_PROTECTION, CILL_DEPTHS, FRAME_EXTS } from "./defaultEstimateDefaults";

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
}
function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;
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

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#3f3f46", fontWeight: 700, marginBottom: 6 };
/* =========================
   Defaults Editor (Estimate-level + Position "Use estimate defaults")
========================= */

export default function DefaultsEditor({
  title,
  productType,
  value,
  onChange,
  showDoorOptions,
}: {
  title: string;
  productType: Models.ProductType;
  value: EstimateDefaults;
  onChange: (next: EstimateDefaults) => void;
  showDoorOptions: boolean;
}) {
  const finishes = FINISHES_BY_TYPE[productType];

  // keep G fixed at 0.53 for now (per your instruction)
  useEffect(() => {
    if (value.gValue !== "0.53") onChange({ ...value, gValue: "0.53" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.ugValue, value.glassType]);

  const ugOptions = value.glassType === "Double" ? UG_DOUBLE : UG_TRIPLE;

  return (
    <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
      <H3>{title}</H3>

      <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
        {/* Supplier & Product */}
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
          <H3>Supplier & Product</H3>

          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div>
              <div style={labelStyle}>Supplier</div>
              <select
                value={value.supplier}
                onChange={(e) => {
                  const supplier = e.target.value;
                  const nextProd = supplier ? firstProductForSupplier(supplier) : "";
                  onChange({ ...value, supplier, product: nextProd });
                }}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
              >
                <option value="">Select supplier…</option>
                {SUPPLIERS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Product type</div>
              <select
                value={value.productType}
                onChange={(e) => onChange({ ...value, productType: e.target.value as Models.ProductType })}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Product</div>
              <select
                value={value.product}
                onChange={(e) => onChange({ ...value, product: e.target.value })}
                disabled={!value.supplier}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  padding: "10px 12px",
                  fontSize: 14,
                  background: !value.supplier ? "#fafafa" : "#fff",
                  color: !value.supplier ? "#a1a1aa" : "#18181b",
                }}
              >
                <option value="">{value.supplier ? "Select product…" : "Select supplier first…"}</option>
                {allProductsForSupplier(value.supplier).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Finishes */}
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
          <H3>Finishes</H3>

          <datalist id={"ext-finish-" + title}>
            {finishes.external.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id={"int-finish-" + title}>
            {finishes.internal.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>External finish</div>
              <Input value={value.externalFinish} onChange={(v) => onChange({ ...value, externalFinish: v })} list={"ext-finish-" + title} placeholder="Select or type…" />
            </div>
            <div>
              <div style={labelStyle}>Internal finish</div>
              <Input value={value.internalFinish} onChange={(v) => onChange({ ...value, internalFinish: v })} list={"int-finish-" + title} placeholder="Select or type…" />
            </div>
          </div>
        </div>

        {/* Hinges + Wood */}
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
          <H3>Hardware</H3>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Hinges</div>
              <select
                value={value.hingeType}
                onChange={(e) => onChange({ ...value, hingeType: e.target.value as any })}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
              >
                {HINGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {isTimberProductType(value.productType) ? (
              <div>
                <div style={labelStyle}>Wood type</div>
                <select
                  value={value.woodType}
                  onChange={(e) => onChange({ ...value, woodType: e.target.value })}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                >
                  {WOOD_TYPES.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Glazing */}
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
          <H3>Glazing</H3>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Glass</div>
              <select
                value={value.glassType}
                onChange={(e) => {
                  const glassType = e.target.value as "Double" | "Triple";
                  const nextUg = glassType === "Double" ? "1.1" : "0.4";
                  onChange({ ...value, glassType, ugValue: nextUg, gValue: "0.53" });
                }}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
              >
                <option value="Double">Double</option>
                <option value="Triple">Triple</option>
              </select>
            </div>

            <div>
              <div style={labelStyle}>Ug value required</div>
              <select
                value={value.ugValue}
                onChange={(e) => onChange({ ...value, ugValue: e.target.value, gValue: "0.53" })}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
              >
                {ugOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>G value</div>
              <Input value={value.gValue} onChange={(v) => onChange({ ...value, gValue: v })} />
              <Small>Placeholder: fixed at 0.53 for now</Small>
            </div>
          </div>
        </div>

        {/* Window Handle */}
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
          <H3>Window Handle</H3>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, alignItems: "center" }}>
            <div>
              <div style={labelStyle}>Handle type</div>
              <select
                value={value.windowHandleType}
                onChange={(e) => onChange({ ...value, windowHandleType: e.target.value as any })}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
              >
                {HANDLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                height: 96,
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#71717a",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              Handle image
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
              <input type="checkbox" checked={value.internalCillRequired} onChange={(e) => onChange({ ...value, internalCillRequired: e.target.checked })} />
              Lockable handle
            </label>
            <Small>This was previously “door multipoint locking” — now aligned to your “lockable handle” wording.</Small>
          </div>
        </div>

        {/* Door options */}
        {showDoorOptions && (
          <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
            <H3>Door options</H3>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={value.doorMultipointLocking} onChange={(e) => onChange({ ...value, doorMultipointLocking: e.target.checked })} />
                Multipoint locking
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={value.electricalOperation} onChange={(e) => onChange({ ...value, electricalOperation: e.target.checked })} />
                Electrical operation
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={value.dayLatch} onChange={(e) => onChange({ ...value, dayLatch: e.target.checked })} />
                Day latch
              </label>
            </div>
          </div>
        )}

        {/* Accessories */}
        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
          <H3>Accessories</H3>

          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={value.internalCillRequired} onChange={(e) => onChange({ ...value, internalCillRequired: e.target.checked })} />
                Window cill internally required
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={value.externalSillRequired} onChange={(e) => onChange({ ...value, externalSillRequired: e.target.checked })} />
                Window sill externally required
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Window cill depth</div>
                <select
                  value={String(value.cillDepthMm)}
                  onChange={(e) => onChange({ ...value, cillDepthMm: Number(e.target.value) })}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                >
                  {CILL_DEPTHS.map((d) => (
                    <option key={d} value={d}>
                      {d} mm
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Cill end cap type</div>
                <select
                  value={value.cillEndCapType}
                  onChange={(e) => onChange({ ...value, cillEndCapType: e.target.value as any })}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                >
                  <option value="Cladding/Render End Cap">Cladding/Render End Cap</option>
                  <option value="Brick Type End Cap">Brick Type End Cap</option>
                </select>
              </div>
            </div>

            <div>
              <H3>Frame extensions</H3>
              <Small>Set each side independently.</Small>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                {[
                  ["Left", "frameExtLeftMm"],
                  ["Right", "frameExtRightMm"],
                  ["Top", "frameExtTopMm"],
                  ["Bottom", "frameExtBottomMm"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <div style={labelStyle}>{label}</div>
                    <select
                      value={String((value as any)[key])}
                      onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) } as any)}
                      style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                    >
                      {FRAME_EXTS.map((mm) => (
                        <option key={mm} value={mm}>
                          {mm} mm
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={value.sunProtectionRequired} onChange={(e) => onChange({ ...value, sunProtectionRequired: e.target.checked })} />
                Sun protection required
              </label>

              {value.sunProtectionRequired && (
                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Type</div>
                  <select
                    value={value.sunProtectionType}
                    onChange={(e) => onChange({ ...value, sunProtectionType: e.target.value as any })}
                    style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                  >
                    {SUN_PROTECTION.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



'@
Write-File "src\features\estimateDefaults\DefaultsEditor.tsx" $content_3475381355397726571

$content_1461431185241909749 = @'
﻿// Auto-generated by QuoteSync Phase 4A extraction patch.
// Source of truth for estimate-level defaults (data + builders).
import * as Models from "../../models/types";
import type { EstimateDefaults } from "../../models/types";
import { SUPPLIERS, WOOD_TYPES, firstProductForSupplier } from "../catalog/defaultCatalog";
export const HINGE_TYPES: EstimateDefaults["hingeType"][] = ["Concealed", "Exposed 130Kg", "Exposed 180Kg"];

export const UG_DOUBLE = ["1.1", "1.2"];
export const UG_TRIPLE = ["0.4", "0.5", "0.6", "0.7", "0.8"];

export const HANDLE_TYPES: EstimateDefaults["windowHandleType"][] = ["Type 1", "Type 2", "Type 3", "Type 4", "Type 5"];

export const SUN_PROTECTION: EstimateDefaults["sunProtectionType"][] = ["Shutters", "Roller blinds", "Venetian blinds (external)", "Venetian blinds (internal)"];

function buildCillDepthOptions(): number[] {
  const out: number[] = [];
  for (let v = 50; v <= 110; v += 20) out.push(v);
  for (let v = 130; v <= 210; v += 15) out.push(v);
  for (let v = 230; v <= 400; v += 20) out.push(v);
  return out;
}

export const CILL_DEPTHS = buildCillDepthOptions();
export const FRAME_EXTS = [0, 25, 50, 75, 100];

export function makeDefaultEstimateDefaults(): EstimateDefaults {
  const supplier = SUPPLIERS[0]?.name ?? "";
    const productType: Models.ProductType = "uPVC";
  const product = supplier ? firstProductForSupplier(supplier) : "";
  return {
    supplier,
    productType,
    product,

    woodType: WOOD_TYPES[0],

    externalFinish: "",
    internalFinish: "",

    hingeType: "Concealed",

    glassType: "Double",
    ugValue: "1.1",
    gValue: "0.53",

    windowHandleType: "Type 1",

    doorMultipointLocking: false,
    electricalOperation: false,
    dayLatch: false,

    internalCillRequired: false,
    externalSillRequired: false,
    cillDepthMm: 50,
    cillEndCapType: "Cladding/Render End Cap",

    frameExtLeftMm: 0,
    frameExtRightMm: 0,
    frameExtTopMm: 0,
    frameExtBottomMm: 0,

    sunProtectionRequired: false,
    sunProtectionType: "Shutters",
  };
}



'@
Write-File "src\features\estimateDefaults\defaultEstimateDefaults.ts" $content_1461431185241909749

$content_6971491563499245779 = @'
﻿// Auto-generated by QuoteSync Phase 4C extraction patch.
// Seed/demo clients moved out of src/App.tsx (no logic changes).
import * as Models from "../../models/types";
import type { Client } from "../../models/types";
export const DEFAULT_CUSTOMER_ADDRESS = ["4 Glebe Road", "Cowdenbeath", "Fife", "KY4 9FA"].join("\n");

export function makeDefaultClients(opts: { uid: () => string; nextClientRef: (n: number) => string }): Client[]  {
  return [
    {
      id: Models.asClientId(opts.uid()),
      type: "Business",
      clientRef: opts.nextClientRef(1),
      clientName: "Ecofenster Ltd",
      businessName: "Ecofenster Ltd",
      contactPerson: "",
      email: "",
      mobile: "07882 809 453",
      home: "",
      projectName: "",
      projectAddress: DEFAULT_CUSTOMER_ADDRESS,
      invoiceAddress: DEFAULT_CUSTOMER_ADDRESS,
      estimates: [],
    },
    {
      id: Models.asClientId(opts.uid()),
      type: "Individual",
      clientRef: opts.nextClientRef(2),
      clientName: "Craig Ferguson",
      businessName: "",
      contactPerson: "",
      email: "",
      mobile: "07882 809 453",
      home: "",
      projectName: "",
      projectAddress: DEFAULT_CUSTOMER_ADDRESS,
      invoiceAddress: DEFAULT_CUSTOMER_ADDRESS,
      estimates: [],
    },
  ];
}



'@
Write-File "src\features\clients\defaultClients.ts" $content_6971491563499245779

$content_5060711469034103180 = @'
﻿// Auto-generated by Phase 4 extraction patch.
// Source of truth for Supplier/Product defaults (moved out of App.tsx).
import * as Models from "../../models/types";
export const PRODUCT_TYPES: Models.ProductType[] = ["uPVC", "uPVC Alu Clad", "Timber", "Timber Aluminium Clad", "Aluminium", "Steel"];

export type SupplierCatalog = {
  name: string;
  productsByType: Partial<Record<Models.ProductType, string[]>>;
};

export const SUPPLIERS: SupplierCatalog[] = [
  {
    name: "Internorm",
    productsByType: {
      uPVC: ["KF520", "KF410", "KF320", "KF310"],
      "uPVC Alu Clad": ["KV440", "KV350", "KF520", "KF310", "KF320"],
      "Timber Aluminium Clad": ["HV450", "HF410", "HF510", "HT410", "HT400", "HT310", "HS330"],
      Aluminium: ["AT500", "AT510", "AT520", "AT530", "AT540"],
    },
  },
  {
    name: "Eko Okna",
    productsByType: {
      uPVC: ["Synego", "Ideal 4000", "Ideal 70", "BluEvolution 82", "Ideal 8000", "Nordline", "S9000"],
      Timber: ["Naturo 68", "Naturo 80", "Naturo 92"],
      "Timber Aluminium Clad": ["Naturo 68 Alu", "Naturo 80 Alu"],
      Aluminium: ["MB-79N", "MB-86 Casement", "MB-104 Passive", "Genesis", "Imperial"],
      Steel: ["Unico XS", "Presto", "Unico"],
    },
  },
];

export function getSupplier(name: string) {
  return SUPPLIERS.find((s) => s.name === name) ?? null;
}

export function allProductsForSupplier(name: string) {
  const s = getSupplier(name);
  if (!s) return [];
  const all = Object.values(s.productsByType).flat().filter(Boolean) as string[];
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
}

export function firstProductForSupplier(name: string) {
  return allProductsForSupplier(name)[0] ?? "";
}

export const WOOD_TYPES = ["Finger Jointed Pine", "Pine", "Spruce", "Larch", "Oak", "Accoya", "Meranti", "Mahogany"] as const;

export function isTimberProductType(t: Models.ProductType) {
  return t === "Timber" || t === "Timber Aluminium Clad";
}

/* --- finishes: typeahead dropdown via datalist --- */
export const FINISHES_BY_TYPE: Record<Models.ProductType, { external: string[]; internal: string[] }> = {
  uPVC: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  "uPVC Alu Clad": { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  Timber: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  "Timber Aluminium Clad": { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  Aluminium: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  Steel: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
};


'@
Write-File "src\features\catalog\defaultCatalog.ts" $content_5060711469034103180

$content_7116773865536064282 = @'
﻿/**
 * QuoteSync — Centralised Types
 * Generated: 2026-02-20 14:28:25
 */

export type Brand<K, T> = K & { readonly __brand: T };

export type ClientId = Brand<string, "ClientId">;
export type EstimateId = Brand<string, "EstimateId">;
export type PositionId = Brand<string, "PositionId">;
export type NoteId = Brand<string, "NoteId">;
export type FileId = Brand<string, "FileId">;
export type FollowUpId = Brand<string, "FollowUpId">;

export const asClientId = (v: string) => v as ClientId;
export const asEstimateId = (v: string) => v as EstimateId;
export const asPositionId = (v: string) => v as PositionId;
export const asNoteId = (v: string) => v as NoteId;
export const asFileId = (v: string) => v as FileId;
export const asFollowUpId = (v: string) => v as FollowUpId;

export type MenuKey =
  | "client_database"
  | "project_preferences"
  | "address_database"
  | "reports"
  | "cad_drawing"
  | "remote_support";
export type ClientType = "Business" | "Individual";
export type EstimateStatus = "Draft" | "Completed";
export type ProductType =
  | "uPVC"
  | "uPVC Alu Clad"
  | "Timber"
  | "Timber Aluminium Clad"
  | "Aluminium"
  | "Steel";
export type EstimateOutcome = "Open" | "Lost" | "Order";
export type EstimatePickerTab = "client_info" | "estimates" | "orders" | "client_notes" | "files";

export type View = "customers" | "estimate_picker" | "estimate_defaults" | "estimate_workspace";
export type Client = {
  id: ClientId;
  type: ClientType;
  clientRef: string; // EF-CL-001
  clientName: string;
  email: string;
  mobile: string;
  home: string;

  projectName: string;
  projectAddress: string;
  invoiceAddress: string;

  businessName?: string;
  contactPerson?: string;

  estimates: Estimate[];
};
export type EstimateDefaults = {
  supplier: string;
  productType: ProductType;
  product: string;

  woodType: string;

  externalFinish: string;
  internalFinish: string;

  hingeType: "Concealed" | "Exposed 130Kg" | "Exposed 180Kg";

  glassType: "Double" | "Triple";
  ugValue: string; // renamed from U to Ug
  gValue: string;

  windowHandleType: "Type 1" | "Type 2" | "Type 3" | "Type 4" | "Type 5";

  // door-only
  doorMultipointLocking: boolean;
  electricalOperation: boolean;
  dayLatch: boolean;

  // accessories
  internalCillRequired: boolean;
  externalSillRequired: boolean;
  cillDepthMm: number;
  cillEndCapType: "Cladding/Render End Cap" | "Brick Type End Cap";

  frameExtLeftMm: number;
  frameExtRightMm: number;
  frameExtTopMm: number;
  frameExtBottomMm: number;

  sunProtectionRequired: boolean;
  sunProtectionType: "Shutters" | "Roller blinds" | "Venetian blinds (external)" | "Venetian blinds (internal)";
};
export type Estimate = {
  id: EstimateId;
  estimateRef: string;
  baseEstimateRef: string;
  revisionNo: number;
  status: EstimateStatus;
  defaults: EstimateDefaults;
  positions: Position[];
};
export type Position = {
  id: PositionId;
  positionRef: string;
  qty: number;
  roomName: string;

  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;

  insertion: string;
  cellInsertions: Record<string, string>; // key: "col,row"
  colWidthsMm?: number[];
  rowHeightsMm?: number[];

  positionType: "Window" | "Door";

  // per-position overrides (optional)
  useEstimateDefaults: boolean;
  overrides: Partial<EstimateDefaults>;
};

export type ClientNote = {
  id: NoteId;
  html: string;
  createdAt: string;
  createdBy: string;
};

export type ClientFile = {
  id: FileId;
  label: string;
  url: string;
  addedAt: string;
  addedBy: string;
  fileNames?: string[];
};

export type FollowUp = {
  id: FollowUpId;
  dueAt: string;
  note: string;
  createdAt: string;
  createdBy: string;
};
'@
Write-File "src\models\types.ts" $content_7116773865536064282


# -------------------------
# Quick sanity checks (prevent truncated writes)
# -------------------------
function Assert-NonTrivial($rel, $minBytes){
  $p = Join-Path $webRoot $rel
  if (!(Test-Path $p)) { Fail "Missing after write: $rel" }
  $len = (Get-Item $p).Length
  if ($len -lt $minBytes) { Fail "File too small (possible truncation): $rel ($len bytes)" }
}

Assert-NonTrivial "src\App.tsx" 20000
Assert-NonTrivial "src\features\estimatePicker\EstimatePickerFeature.tsx" 2000
Assert-NonTrivial "src\features\estimatePicker\EstimatePickerTabs.tsx" 2000
Ok "Sanity checks passed."

# -------------------------
# Create savepoint ZIP (exclude node_modules + _backups + dist)
# -------------------------
$zipPath = Join-Path $backup ("web_" + $stamp + "_savepoint.zip")

$items = Get-ChildItem -LiteralPath $webRoot -Force | Where-Object {
  $_.Name -ne "node_modules" -and $_.Name -ne "_backups" -and $_.Name -ne "dist"
}

if ($items.Count -eq 0) { Fail "Nothing to zip under $webRoot (unexpected)." }

Compress-Archive -Path $items.FullName -DestinationPath $zipPath -Force
Ok "Created ZIP: $zipPath"

$hash = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash
Ok ("SHA256: " + $hash)

# Write a small savepoint note
$note = @"
# QuoteSync Savepoint

Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Web root: $webRoot
Backup folder: $backup
ZIP: $zipPath
SHA256: $hash

Files stabilised:
$(($targets | ForEach-Object { " - " + $_ }) -join "`r`n")
"@

[System.IO.File]::WriteAllText((Join-Path $backup "SAVEPOINT.md"), $note, (New-Object System.Text.UTF8Encoding($false)))
Ok "Wrote SAVEPOINT.md"

Ok "DONE. Your app should be in a stable, known-good state. (No npm commands were run.)"
