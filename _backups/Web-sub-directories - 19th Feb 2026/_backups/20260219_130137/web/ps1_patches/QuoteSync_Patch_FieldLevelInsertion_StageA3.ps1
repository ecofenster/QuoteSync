# QuoteSync - Stage A3: Field-level insertion + DIN/UK + Inside/Outside preview (LogiKal-style, CLOSED symbols)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$ProjectRoot = "C:\Github\QuoteSync\web"
Write-Host "Run directory: $ProjectRoot" -ForegroundColor Cyan
Set-Location $ProjectRoot

$backupDir = Join-Path $ProjectRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Backup-File($path){
  if (Test-Path $path) {
    $name = Split-Path $path -Leaf
    $dest = Join-Path $backupDir "$stamp`_$name.bak"
    Copy-Item $path $dest -Force
  }
}

$AppPath = Join-Path $ProjectRoot "src\App.tsx"
$GridPath = Join-Path $ProjectRoot "src\components\GridEditor.tsx"

Backup-File $AppPath
Backup-File $GridPath
Ok "Backups written to $backupDir"

$AppTsx = @'
import React, { useEffect, useMemo, useState } from "react";
import GridEditor from "./components/GridEditor";

/* =========================
   Types
========================= */

type MenuKey =
  | "customers_business"
  | "customers_individual"
  | "project_preferences"
  | "address_database"
  | "reports"
  | "cad_drawing"
  | "remote_support";

type ClientType = "Business" | "Individual";
type EstimateStatus = "Draft" | "Completed";

type ProductType =
  | "uPVC"
  | "uPVC Alu Clad"
  | "Timber"
  | "Timber Aluminium Clad"
  | "Aluminium"
  | "Steel";

type View =
  | "customers"
  | "estimate_picker"
  | "estimate_defaults"
  | "estimate_workspace";

type Client = {
  id: string;
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

type EstimateDefaults = {
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

type Estimate = {
  id: string;
  estimateRef: string;
  baseEstimateRef: string;
  revisionNo: number;
  status: EstimateStatus;
  defaults: EstimateDefaults;
  positions: Position[];
};

type Position = {
  id: string;
  positionRef: string;
  qty: number;
  roomName: string;

  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;

  insertion: string;
  cellInsertions: Record<string, string>; // key: \"col,row\"
  colWidthsMm?: number[];
  rowHeightsMm?: number[];

  positionType: "Window" | "Door";

  // per-position overrides (optional)
  useEstimateDefaults: boolean;
  overrides: Partial<EstimateDefaults>;
};

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

const PRODUCT_TYPES: ProductType[] = ["uPVC", "uPVC Alu Clad", "Timber", "Timber Aluminium Clad", "Aluminium", "Steel"];

type SupplierCatalog = {
  name: string;
  productsByType: Partial<Record<ProductType, string[]>>;
};

const SUPPLIERS: SupplierCatalog[] = [
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

function getSupplier(name: string) {
  return SUPPLIERS.find((s) => s.name === name) ?? null;
}

function allProductsForSupplier(name: string) {
  const s = getSupplier(name);
  if (!s) return [];
  const all = Object.values(s.productsByType).flat().filter(Boolean) as string[];
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
}

function firstProductForSupplier(name: string) {
  return allProductsForSupplier(name)[0] ?? "";
}

const WOOD_TYPES = ["Finger Jointed Pine", "Pine", "Spruce", "Larch", "Oak", "Accoya", "Meranti", "Mahogany"] as const;

function isTimberProductType(t: ProductType) {
  return t === "Timber" || t === "Timber Aluminium Clad";
}

/* --- finishes: typeahead dropdown via datalist --- */
const FINISHES_BY_TYPE: Record<ProductType, { external: string[]; internal: string[] }> = {
  uPVC: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  "uPVC Alu Clad": { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  Timber: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  "Timber Aluminium Clad": { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  Aluminium: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
  Steel: { external: ["Ext Type 1", "Ext Type 2"], internal: ["Int Type 1", "Int Type 2"] },
};

const HINGE_TYPES: EstimateDefaults["hingeType"][] = ["Concealed", "Exposed 130Kg", "Exposed 180Kg"];

const UG_DOUBLE = ["1.1", "1.2"];
const UG_TRIPLE = ["0.4", "0.5", "0.6", "0.7", "0.8"];

const HANDLE_TYPES: EstimateDefaults["windowHandleType"][] = ["Type 1", "Type 2", "Type 3", "Type 4", "Type 5"];

const SUN_PROTECTION: EstimateDefaults["sunProtectionType"][] = [
  "Shutters",
  "Roller blinds",
  "Venetian blinds (external)",
  "Venetian blinds (internal)",
];

function buildCillDepthOptions(): number[] {
  const out: number[] = [];
  for (let v = 50; v <= 110; v += 20) out.push(v);
  for (let v = 130; v <= 210; v += 15) out.push(v);
  for (let v = 230; v <= 400; v += 20) out.push(v);
  // ensure 210 included already; ensure 230+ is correct step from "210 up to 400 in 20mm"
  // (we start at 230 to avoid duplicating 210 and preserve 20mm increments)
  return out;
}

const CILL_DEPTHS = buildCillDepthOptions();
const FRAME_EXTS = [0, 25, 50, 75, 100];

function makeDefaultEstimateDefaults(): EstimateDefaults {
  const supplier = SUPPLIERS[0]?.name ?? "";
  const productType: ProductType = "uPVC";
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

const DEFAULT_CUSTOMER_ADDRESS = ["4 Glebe Road", "Cowdenbeath", "Fife", "KY4 9FA"].join("\n");

function makeDefaultClients(): Client[] {
  return [
    {
      id: uid(),
      type: "Business",
      clientRef: nextClientRef(1),
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
      id: uid(),
      type: "Individual",
      clientRef: nextClientRef(2),
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      list={list}
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

function SidebarItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
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
   Defaults Editor (Estimate-level + Position "Use estimate defaults")
========================= */

function DefaultsEditor({
  title,
  productType,
  value,
  onChange,
  showDoorOptions,
}: {
  title: string;
  productType: ProductType;
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
                onChange={(e) => onChange({ ...value, productType: e.target.value as ProductType })}
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
              <Input
                value={value.externalFinish}
                onChange={(v) => onChange({ ...value, externalFinish: v })}
                list={"ext-finish-" + title}
                placeholder="Select or type…"
              />
            </div>
            <div>
              <div style={labelStyle}>Internal finish</div>
              <Input
                value={value.internalFinish}
                onChange={(v) => onChange({ ...value, internalFinish: v })}
                list={"int-finish-" + title}
                placeholder="Select or type…"
              />
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
              <input
                type="checkbox"
                checked={value.internalCillRequired}
                onChange={(e) => onChange({ ...value, internalCillRequired: e.target.checked })}
              />
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
                <input
                  type="checkbox"
                  checked={value.doorMultipointLocking}
                  onChange={(e) => onChange({ ...value, doorMultipointLocking: e.target.checked })}
                />
                Multipoint locking
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={value.electricalOperation}
                  onChange={(e) => onChange({ ...value, electricalOperation: e.target.checked })}
                />
                Electrical operation
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={value.dayLatch}
                  onChange={(e) => onChange({ ...value, dayLatch: e.target.checked })}
                />
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
                <input
                  type="checkbox"
                  checked={value.internalCillRequired}
                  onChange={(e) => onChange({ ...value, internalCillRequired: e.target.checked })}
                />
                Window cill internally required
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={value.externalSillRequired}
                  onChange={(e) => onChange({ ...value, externalSillRequired: e.target.checked })}
                />
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
                <input
                  type="checkbox"
                  checked={value.sunProtectionRequired}
                  onChange={(e) => onChange({ ...value, sunProtectionRequired: e.target.checked })}
                />
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

/* =========================
   Main App
========================= */

export default function App() {
  const [menu, setMenu] = useState<MenuKey>("customers_business");
  const [view, setView] = useState<View>("customers");

  const [clientCounter, setClientCounter] = useState(3);
  const [estimateCounter, setEstimateCounter] = useState(1);

  const [clients, setClients] = useState<Client[]>(() => makeDefaultClients());

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) ?? null, [clients, selectedClientId]);

  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const selectedEstimate = useMemo(() => {
    if (!selectedClient) return null;
    return selectedClient.estimates.find((e) => e.id === selectedEstimateId) ?? null;
  }, [selectedClient, selectedEstimateId]);

  // estimate picker
  const [pickerClientId, setPickerClientId] = useState<string | null>(null);
  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // Add client UI (kept simple; your current add form can be re-merged if needed)
  const [showAddClient, setShowAddClient] = useState(false);
  const [draftClientName, setDraftClientName] = useState("");
  const [draftBusinessName, setDraftBusinessName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftMobile, setDraftMobile] = useState("");
  const [draftHome, setDraftHome] = useState("");

  // Position wizard (supplier/product removed from flow)
  const [showPositionWizard, setShowPositionWizard] = useState(false);
  const [posStep, setPosStep] = useState<1 | 2 | 3>(1); // 1 Position, 2 Dimensions, 3 Configuration
  const [posDraft, setPosDraft] = useState<Position>(() => ({
    id: uid(),
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

  // Add Position / Configuration step helpers
  const [draftSelectedCell, setDraftSelectedCell] = useState<{ col: number; row: number }>({ col: 0, row: 0 });
  const [previewView, setPreviewView] = useState<"Inside" | "Outside">("Inside");
  const [openingStd, setOpeningStd] = useState<"DIN" | "UK">("DIN");

  const activeClientType: ClientType = menu === "customers_business" ? "Business" : "Individual";
  const filteredClients = useMemo(() => clients.filter((c) => c.type === activeClientType), [clients, activeClientType]);

  function selectMenu(k: MenuKey) {
    setMenu(k);
    setView("customers");
    setSelectedClientId(null);
    setSelectedEstimateId(null);
    setPickerClientId(null);
    setShowAddClient(false);
    setShowPositionWizard(false);
  }

  function openEstimateWorkspace(clientId: string, estimateId: string) {
    setSelectedClientId(clientId);
    setSelectedEstimateId(estimateId);
    setView("estimate_workspace");
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
      id: uid(),
      estimateRef: base,
      baseEstimateRef: base,
      revisionNo: 0,
      status: "Draft",
      defaults: makeDefaultEstimateDefaults(),
      positions: [],
    };

    setEstimateCounter((n) => n + 1);

    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, estimates: [est, ...c.estimates] } : c))
    );

    // IMPORTANT: go to Supplier & Product Defaults screen immediately
    openEstimateDefaults(client.id, est.id);
  }

  function openClient(client: Client) {
    setSelectedClientId(client.id);

    if (client.estimates.length === 0) {
      createEstimateForClient(client);
      return;
    }

    if (client.estimates.length === 1) {
      openEstimateDefaults(client.id, client.estimates[0].id);
      return;
    }

    // multiple estimates => show picker list
    setPickerClientId(client.id);
    setView("estimate_picker");
  }

  function openEstimateFromPicker(estimateId: string) {
    if (!pickerClientId) return;
    openEstimateDefaults(pickerClientId, estimateId);
  }

  function startAddPosition() {
    if (!selectedEstimate) return;

    const nextIndex = (selectedEstimate.positions?.length ?? 0) + 1;

    setPosStep(1);
      setDraftSelectedCell({ col: 0, row: 0 });
    setPosDraft({
      id: uid(),
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
    });
    setShowPositionWizard(true);
  }

  function savePositionToEstimate() {
    if (!selectedClient || !selectedEstimate) return;

    const newPos: Position = {
      ...posDraft,
      id: uid(),
      widthMm: clampNum(Math.round(posDraft.widthMm || 0), 300, 6000),
      heightMm: clampNum(Math.round(posDraft.heightMm || 0), 300, 6000),
      fieldsX: clampNum(Math.round(posDraft.fieldsX || 1), 1, 16),
      fieldsY: clampNum(Math.round(posDraft.fieldsY || 1), 1, 16),
    };

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            return { ...e, positions: [newPos, ...e.positions] };
          }),
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
    // merge estimate defaults + overrides
    return { ...est.defaults, ...pos.overrides };
  }

  function setEstimateDefaults(next: EstimateDefaults) {
    if (!selectedClient || !selectedEstimate) return;
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => (e.id === selectedEstimate.id ? { ...e, defaults: next } : e)),
        };
      })
    );
  }

  function setPositionDefaultsOverride(next: EstimateDefaults) {
    // store only as overrides (differences are fine later; for now store full)
    setPosDraft((p) => ({
      ...p,
      overrides: {
        ...next,
      },
    }));
  }

  function createClient(type: ClientType) {
    const newClient: Client = {
      id: uid(),
      type,
      clientRef: nextClientRef(clientCounter),
      clientName: type === "Individual" ? draftClientName.trim() : draftBusinessName.trim(),
      email: draftEmail.trim(),
      mobile: draftMobile.trim(),
      home: draftHome.trim(),
      projectName: "",
      projectAddress: DEFAULT_CUSTOMER_ADDRESS,
      invoiceAddress: DEFAULT_CUSTOMER_ADDRESS,
      businessName: type === "Business" ? draftBusinessName.trim() : undefined,
      contactPerson: "",
      estimates: [],
    };

    setClients((prev) => [newClient, ...prev]);
    setClientCounter((n) => n + 1);

    setShowAddClient(false);
    setDraftClientName("");
    setDraftBusinessName("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
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
                <SidebarItem label="Business Customers" active={menu === "customers_business"} onClick={() => selectMenu("customers_business")} />
                <SidebarItem label="Individual Customers" active={menu === "customers_individual"} onClick={() => selectMenu("customers_individual")} />
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
            {(menu === "customers_business" || menu === "customers_individual") && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>{menu === "customers_business" ? "Business Customers" : "Individual Customers"}</H2>
                    <Small>Open a client to choose an estimate (or create one).</Small>
                  </div>

                  <Button variant="primary" onClick={() => setShowAddClient(true)}>
                    Add Client
                  </Button>
                </div>

                {showAddClient && (
                  <div style={{ marginTop: 14, borderRadius: 16, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                    <H3>Add {menu === "customers_business" ? "Business" : "Individual"} Client</H3>

                    <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                      {menu === "customers_business" ? (
                        <>
                          <div>
                            <div style={labelStyle}>Business name</div>
                            <Input value={draftBusinessName} onChange={setDraftBusinessName} placeholder="Ecofenster Ltd" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div style={labelStyle}>Client name</div>
                            <Input value={draftClientName} onChange={setDraftClientName} placeholder="Name" />
                          </div>
                        </>
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

                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <Button variant="secondary" onClick={() => setShowAddClient(false)}>
                          Cancel
                        </Button>
                        <Button variant="primary" onClick={() => createClient(menu === "customers_business" ? "Business" : "Individual")}>
                          Create Client
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
                          <H3>{c.clientName}</H3>
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

            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && pickerClient && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Choose an estimate</H2>
                    <Small>{pickerClient.clientName} • {pickerClient.clientRef}</Small>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" onClick={() => setView("customers")}>Back</Button>
                    <Button variant="primary" onClick={() => createEstimateForClient(pickerClient)}>New Estimate</Button>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
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

                      <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>Open</Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ESTIMATE DEFAULTS (Supplier & Product Defaults screen) */}
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
                    <Button variant="secondary" onClick={() => setView("customers")}>Back</Button>
                    <Button variant="primary" onClick={() => setView("estimate_workspace")}>Continue</Button>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
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
                    <Button variant="secondary" onClick={() => setView("estimate_defaults")}>Supplier & Product Defaults</Button>
                    <Button variant="secondary" onClick={() => setView("customers")}>Back</Button>
                  </div>
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
                      <div
                        key={p.id}
                        style={{
                          borderRadius: 14,
                          border: "1px solid #e4e4e7",
                          padding: 10,
                          background: "#fff",
                        }}
                      >
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
                              <Input
                                type="number"
                                value={String(posDraft.qty)}
                                onChange={(v) => setPosDraft((p) => ({ ...p, qty: Math.max(1, Math.min(999, Number(v || 1))) }))}
                              />
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
                                      colWidthsMm: scaleSplitsToTotal(p.widthMm, p.colWidthsMm ?? [], fx),
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
                                      rowHeightsMm: scaleSplitsToTotal(p.heightMm, p.rowHeightsMm ?? [], fy),
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
                          <div style={{ display: "grid", gap: 12 }}>
                            <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                              <H3>Insertion</H3>
                              <div style={{ marginTop: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontSize: 12, color: "#71717a" }}>
                                  Selected field: #{draftSelectedCell.row * posDraft.fieldsX + draftSelectedCell.col + 1}
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <select
                                    value={openingStd}
                                    onChange={(e) => setOpeningStd(e.target.value as any)}
                                    style={{ borderRadius: 10, border: "1px solid #e4e4e7", padding: "6px 10px", fontSize: 12 }}
                                    title="Opening convention"
                                  >
                                    <option value="DIN">DIN</option>
                                    <option value="UK">UK</option>
                                  </select>
                                  <select
                                    value={previewView}
                                    onChange={(e) => setPreviewView(e.target.value as any)}
                                    style={{ borderRadius: 10, border: "1px solid #e4e4e7", padding: "6px 10px", fontSize: 12 }}
                                    title="View"
                                  >
                                    <option value="Inside">Inside</option>
                                    <option value="Outside">Outside</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{ marginTop: 8 }}>
                                <select
                                  value={posDraft.cellInsertions[keyForCell(draftSelectedCell.col, draftSelectedCell.row)] ?? posDraft.insertion}
                                  onChange={(e) =>
                                    setPosDraft((p) => ({
                                      ...p,
                                      cellInsertions: {
                                        ...p.cellInsertions,
                                        [keyForCell(draftSelectedCell.col, draftSelectedCell.row)]: e.target.value,
                                      },
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
                                  <input
                                    type="checkbox"
                                    checked={posDraft.useEstimateDefaults}
                                    onChange={(e) => setPosDraft((p) => ({ ...p, useEstimateDefaults: e.target.checked }))}
                                  />
                                  Use estimate defaults for this position
                                </label>
                                <Small>
                                  When unticked, you can override the same defaults below (same option set as “Supplier & Product Defaults”).
                                </Small>
                              </div>
                            </div>

                            {!posDraft.useEstimateDefaults && (
                              <DefaultsEditor
                                title="Position Overrides"
                                productType={(posDraft.overrides.productType as ProductType) || selectedEstimate.defaults.productType}
                                value={{
                                  ...selectedEstimate.defaults,
                                  ...posDraft.overrides,
                                }}
                                onChange={(next) => setPositionDefaultsOverride(next)}
                                showDoorOptions={posDraft.positionType === "Door"}
                              />
                            )}
                          </div>

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
                                    // ensure new fields get a default insertion
                                    const cellInsertions = normalizeCellInsertions(
                                      next.fieldsX ?? p.fieldsX,
                                      next.fieldsY ?? p.fieldsY,
                                      next.cellInsertions ?? p.cellInsertions,
                                      (next.insertion ?? p.insertion) as any
                                    );
                                    return { ...p, ...next, cellInsertions };
                                  })
                                }
                              />
                            </div>

                            <div style={{ marginTop: 12, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
                              <H3>Summary</H3>
                              <Small>
                                Effective defaults:
                                {" "}
                                {(() => {
                                  const eff = effectiveDefaultsForPosition(selectedEstimate, posDraft);
                                  return `${eff.supplier || "—"} / ${eff.productType || "—"} / ${eff.product || "—"} • Hinge: ${eff.hingeType} • Glass: ${eff.glassType} Ug ${eff.ugValue} G ${eff.gValue}`;
                                })()}
                              </Small>
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
          </div>
        </div>
      </div>
    </div>
  );
}


'@

$GridTsx = @'
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

# Basic safety checks
if ($AppTsx -notmatch "cellInsertions") { Fail "App.tsx payload missing cellInsertions" }
if ($GridTsx -notmatch "normalizeCellInsertions") { Fail "GridEditor.tsx payload missing normalizeCellInsertions" }
if ($GridTsx -notmatch "selectedCell") { Fail "GridEditor.tsx payload missing selectedCell support" }

Set-Content -Path $AppPath -Value $AppTsx -Encoding UTF8
Ok "Wrote src\App.tsx (sha256 333bdda16278...)"

Set-Content -Path $GridPath -Value $GridTsx -Encoding UTF8
Ok "Wrote src\components\GridEditor.tsx (sha256 18cf20a0f646...)"

Ok "Patch applied. npm run dev will hot-reload (or run it if not running)."
