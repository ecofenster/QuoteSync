
import React, { useEffect, useMemo, useState } from "react";
import GridEditor from "./components/GridEditor";
import EstimatePickerTabs from "./features/estimatePicker/EstimatePickerTabs";
import * as Models from "./models/types";

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

const SUN_PROTECTION: EstimateDefaults["sunProtectionType"][] = ["Shutters", "Roller blinds", "Venetian blinds (external)", "Venetian blinds (internal)"];

function buildCillDepthOptions(): number[] {
  const out: number[] = [];
  for (let v = 50; v <= 110; v += 20) out.push(v);
  for (let v = 130; v <= 210; v += 15) out.push(v);
  for (let v = 230; v <= 400; v += 20) out.push(v);
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
      id: Models.asClientId(uid()),
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
      id: Models.asClientId(uid()),
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
  const [menu, setMenu] = useState<MenuKey>("client_database");
  const [view, setView] = useState<View>("customers");

  const [clientCounter, setClientCounter] = useState(3);
  const [estimateCounter, setEstimateCounter] = useState(1);

  const [clients, setClients] = useState<Client[]>(() => makeDefaultClients());

  const [selectedClientId, setSelectedClientId] = useState<Models.ClientId | null>(null);
  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) ?? null, [clients, selectedClientId]);

  const [selectedEstimateId, setSelectedEstimateId] = useState<Models.EstimateId | null>(null);
  const selectedEstimate = useMemo(() => {
    if (!selectedClient) return null;
    return selectedClient.estimates.find((e) => e.id === selectedEstimateId) ?? null;
  }, [selectedClient, selectedEstimateId]);

  // estimate picker
  const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>(null);
  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // estimate picker tabs (Estimate Picker only)


const [estimatePickerTab, setEstimatePickerTab] =
  useState<Models.EstimatePickerTab>("client_info");
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<Models.EstimateId, Models.EstimateOutcome>>({});
  const [clientNotes, setClientNotes] = useState<Models.ClientNote[]>([]);
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientFiles, setClientFiles] = useState<Models.ClientFile[]>([]);
  const [clientFileLabel, setClientFileLabel] = useState<string>("");
  const [clientFileUrl, setClientFileUrl] = useState<string>("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const activeUserName = "User";


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

  function selectMenu(k: MenuKey) {
    setMenu(k);
    setView("customers");
    setSelectedClientId(null);
    setSelectedEstimateId(null);
    setPickerClientId(null);
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

  // Open should show the client in the database flow (choose estimate),
  // not jump straight to Supplier & Product Defaults.
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
            {view === "estimate_picker" && pickerClient && (
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
                          setView("customers");
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
                  />                </div>
              </Card>
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
                                productType={(posDraft.overrides.productType as ProductType) || selectedEstimate.defaults.productType}
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




















