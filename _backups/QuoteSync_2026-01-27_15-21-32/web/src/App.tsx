import React, { useEffect, useMemo, useState } from "react";

/**
 * QuoteSync — LogiKal-style prototype (Canvas baseline)
 *
 * Supports:
 * - Multi-field grid (fieldsX × fieldsY)
 * - Per-cell insertion type
 * - Inside/Outside view flip (handle handing)
 * - Order-stage locking (qty locked), Fabrication/Frozen locking
 * - Technical schedule drawing (thin strokes, square corners)
 */

type Status = "Estimation" | "Quotation" | "Planning" | "Order" | "Fabrication" | "Frozen";

type Phase =
  | "Front Elevation"
  | "Rear Elevation"
  | "Side Elevation"
  | "Ground Floor"
  | "First Floor"
  | "Other";

type ViewSide = "Inside" | "Outside";

type InsertionType =
  | "Fixed"
  | "Turn"
  | "Tilt"
  | "Tilt+Turn (Left)"
  | "Tilt+Turn (Right)"
  | "Door (Left hinged)"
  | "Door (Right hinged)";

type CellKey = `${number},${number}`; // col,row

type Position = {
  id: string;
  positionRef: string;
  roomName: string;
  qty: number;
  brief: string;
  modelDesc: string;
  phase: Phase;
  status: Status;

  supplier: string;
  manufacturer: string;
  product: string;

  widthMm: number;
  heightMm: number;

  fieldsX: number;
  fieldsY: number;

  colWidthsMm: number[];
  rowHeightsMm: number[];

  cellInsertions: Record<CellKey, InsertionType>;

  notesInternal: string;
  notesCustomer: string;

  notesQuote: string;
  notesEstimate: string;
  notesClient: string;
};

const STATUS_OPTIONS: Status[] = ["Estimation", "Quotation", "Planning", "Order", "Fabrication", "Frozen"];

const PHASE_OPTIONS: Phase[] = [
  "Front Elevation",
  "Rear Elevation",
  "Side Elevation",
  "Ground Floor",
  "First Floor",
  "Other",
];

const SUPPLIERS = [
  {
    supplier: "Internorm",
    manufacturers: [
      { manufacturer: "KF", products: ["KF 410", "KF 520"] },
      { manufacturer: "HF", products: ["HF 410", "HF 520"] },
    ],
  },
  {
    supplier: "Eko Okna",
    manufacturers: [
      { manufacturer: "PVC", products: ["Veka 82", "Salamander 92"] },
      { manufacturer: "Alu", products: ["MB-86", "Schüco AWS"] },
    ],
  },
  {
    supplier: "Aluplast",
    manufacturers: [{ manufacturer: "Ideal", products: ["Ideal 8000", "Ideal 7000"] }],
  },
] as const;

const INSERTION_CHOICES: { label: string; value: InsertionType }[] = [
  { label: "Fixed", value: "Fixed" },
  { label: "Turn", value: "Turn" },
  { label: "Tilt", value: "Tilt" },
  { label: "Tilt+Turn (Left)", value: "Tilt+Turn (Left)" },
  { label: "Tilt+Turn (Right)", value: "Tilt+Turn (Right)" },
  { label: "Door (Left)", value: "Door (Left hinged)" },
  { label: "Door (Right)", value: "Door (Right hinged)" },
];

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function clampMm(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function keyOf(col: number, row: number): CellKey {
  return `${col},${row}` as CellKey;
}

function buildGridInsertions(
  fieldsX: number,
  fieldsY: number,
  existing?: Record<CellKey, InsertionType>
) {
  const out: Record<CellKey, InsertionType> = {} as any;
  for (let r = 0; r < fieldsY; r++) {
    for (let c = 0; c < fieldsX; c++) {
      const k = keyOf(c, r);
      out[k] = existing?.[k] ?? "Fixed";
    }
  }
  return out;
}

function evenSplit(total: number, n: number) {
  const nn = Math.max(1, Math.round(n));
  const base = Math.floor(total / nn);
  const rem = total - base * nn;
  return Array.from({ length: nn }, (_, i) => base + (i < rem ? 1 : 0));
}

function scaleSplitsToTotal(total: number, splits: number[], n: number) {
  const nn = Math.max(1, Math.round(n));
  let arr = splits.slice(0, nn);
  while (arr.length < nn) arr.push(0);

  const safe = arr.map((x) => (Number.isFinite(x) ? Math.max(0, x) : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) return evenSplit(total, nn);

  const scaled = safe.map((x) => (x / sum) * total);
  const rounded = scaled.map((x) => Math.round(x));

  const drift = total - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] = Math.max(0, rounded[rounded.length - 1] + drift);
  return rounded;
}

function applyRemainderToLast(total: number, splits: number[], minEach: number, n: number) {
  const nn = Math.max(1, Math.round(n));
  let arr = splits.slice(0, nn);
  while (arr.length < nn) arr.push(minEach);

  arr = arr.map((x) => clampMm(x, minEach, total));

  const sum = arr.reduce((a, b) => a + b, 0);
  const drift = total - sum;
  if (drift !== 0) {
    arr[nn - 1] = Math.max(minEach, arr[nn - 1] + drift);
  }

  const finalDrift = total - arr.reduce((a, b) => a + b, 0);
  arr[nn - 1] = Math.max(minEach, arr[nn - 1] + finalDrift);
  return arr;
}

function cumulativeFractions(splits: number[]) {
  const sum = splits.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const edges = [0];
  for (const s of splits) {
    acc += s;
    edges.push(acc / sum);
  }
  edges[edges.length - 1] = 1;
  return edges;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 8,
        border: "1px solid #e4e4e7",
        background: "#fff",
        padding: "2px 8px",
        fontSize: 11,
        color: "#3f3f46",
        boxShadow: "0 1px 2px rgba(0,0,0,.06)",
      }}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const bg =
    status === "Estimation"
      ? "#18181b"
      : status === "Quotation"
      ? "#3f3f46"
      : status === "Planning"
      ? "#52525b"
      : status === "Order"
      ? "#b45309"
      : status === "Fabrication"
      ? "#1d4ed8"
      : "#be123c";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        color: "#fff",
        background: bg,
      }}
    >
      {status}
    </span>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 4 }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          style={{
            border: "none",
            cursor: "pointer",
            borderRadius: 10,
            padding: "6px 10px",
            fontSize: 14,
            background: o === value ? "#18181b" : "transparent",
            color: o === value ? "#fff" : "#3f3f46",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  const bg = active ? "#18181b" : done ? "#71717a" : "#d4d4d8";
  return <span style={{ height: 10, width: 10, borderRadius: 999, background: bg, display: "inline-block" }} />;
}

function CellNumber({ n }: { n: number }) {
  return (
    <g>
      <rect x={0} y={0} width={22} height={22} rx={3} fill="white" stroke="#111" strokeWidth={1} />
      <text x={11} y={15} textAnchor="middle" fontSize={12} fill="#111" fontFamily="system-ui, -apple-system">
        {n}
      </text>
    </g>
  );
}

function cellIndex1Based(col: number, row: number, fieldsX: number) {
  return row * fieldsX + col + 1;
}

function drawInsertionSymbol(args: {
  insertion: InsertionType;
  view: ViewSide;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const { insertion, view, x, y, w, h } = args;

  const showTurn = insertion === "Turn" || insertion.startsWith("Tilt+Turn") || insertion.startsWith("Door");
  const showTilt = insertion === "Tilt" || insertion.startsWith("Tilt+Turn");

  const handleSide = (() => {
    const base: "Left" | "Right" | "None" = (() => {
      if (insertion === "Fixed") return "None";
      if (insertion.includes("(Left)")) return "Right";
      if (insertion.includes("(Right)")) return "Left";
      if (insertion.includes("Door (Left")) return "Right";
      if (insertion.includes("Door (Right")) return "Left";
      return "Right";
    })();
    if (base === "None") return "None";
    if (view === "Outside") return base === "Left" ? "Right" : "Left";
    return base;
  })();

  const nodes: React.ReactNode[] = [];

  if (insertion === "Fixed") {
    nodes.push(
      <g key="fixed" stroke="#111" strokeWidth={1.2}>
        <line x1={x + w / 2} y1={y + 10} x2={x + w / 2} y2={y + h - 10} />
        <line x1={x + 10} y1={y + h / 2} x2={x + w - 10} y2={y + h / 2} />
      </g>
    );
    return nodes;
  }

  // Turn triangle (EU rule)
  if (showTurn && handleSide !== "None") {
    const apexX = handleSide === "Left" ? x : x + w;
    const midY = y + h / 2;
    const oppX = handleSide === "Left" ? x + w : x;
    nodes.push(
      <g key="turn" stroke="#111" strokeWidth={1} fill="none">
        <line x1={apexX} y1={midY} x2={oppX} y2={y} />
        <line x1={apexX} y1={midY} x2={oppX} y2={y + h} />
      </g>
    );
  }

  // Tilt triangle (EU rule)
  if (showTilt) {
    const apex = { x: x + w / 2, y };
    const p1 = { x, y: y + h };
    const p2 = { x: x + w, y: y + h };
    nodes.push(
      <g key="tilt" stroke="#111" strokeWidth={1} fill="none">
        <line x1={apex.x} y1={apex.y} x2={p1.x} y2={p1.y} />
        <line x1={apex.x} y1={apex.y} x2={p2.x} y2={p2.y} />
      </g>
    );
  }

  // Handle mark
  if (handleSide !== "None") {
    const hx = handleSide === "Left" ? x - 1 : x + w + 1;
    const hy = y + h / 2;
    nodes.push(
      <g key="handle" stroke="#111" strokeWidth={1.8} strokeLinecap="round">
        <line x1={hx} y1={hy - 10} x2={hx} y2={hy + 10} />
      </g>
    );
  }

  return nodes;
}

function TechnicalWindowSVG({
  widthMm,
  heightMm,
  fieldsX,
  fieldsY,
  colWidthsMm,
  rowHeightsMm,
  cellInsertions,
  selected,
  onSelect,
  view,
  showDims,
  showScheduleMeta,
  positionRef,
  room,
  qty,
  status,
}: {
  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;
  colWidthsMm: number[];
  rowHeightsMm: number[];
  cellInsertions: Record<CellKey, InsertionType>;
  selected?: { col: number; row: number } | null;
  onSelect?: (col: number, row: number) => void;
  view: ViewSide;
  showDims: boolean;
  showScheduleMeta: boolean;
  positionRef: string;
  room: string;
  qty: number;
  status: Status;
}) {
  const vbW = 520;
  const vbH = 700;

  const pad = 60;
  const availW = vbW - pad * 2;
  const availH = vbH - pad * 2;
  const ratio = Math.max(0.1, widthMm / Math.max(1, heightMm));

  let frameW = availW;
  let frameH = frameW / ratio;
  if (frameH > availH) {
    frameH = availH;
    frameW = frameH * ratio;
  }

  const frameX = pad + (availW - frameW) / 2;
  const frameY = pad + (availH - frameH) / 2;

  const frameTh = 20;
  const sashInset = 28;

  const sashX = frameX + sashInset;
  const sashY = frameY + sashInset;
  const sashW = frameW - sashInset * 2;
  const sashH = frameH - sashInset * 2;

  const cols = applyRemainderToLast(widthMm, colWidthsMm, 100, fieldsX);
  const rows = applyRemainderToLast(heightMm, rowHeightsMm, 100, fieldsY);

  const colEdges = cumulativeFractions(cols).map((f) => sashX + f * sashW);
  const rowEdges = cumulativeFractions(rows).map((f) => sashY + f * sashH);

  const cellWAt = (col: number) => colEdges[col + 1] - colEdges[col];
  const cellHAt = (row: number) => rowEdges[row + 1] - rowEdges[row];

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ height: "100%", width: "100%" }} aria-label="Technical window drawing">
      <rect x={0} y={0} width={vbW} height={vbH} fill="#fff" />

      <rect x={frameX} y={frameY} width={frameW} height={frameH} fill="none" stroke="#111" strokeWidth={1.5} />
      <rect
        x={frameX + frameTh}
        y={frameY + frameTh}
        width={frameW - frameTh * 2}
        height={frameH - frameTh * 2}
        fill="none"
        stroke="#111"
        strokeWidth={1}
      />

      <rect x={sashX} y={sashY} width={sashW} height={sashH} fill="none" stroke="#111" strokeWidth={1.2} />

      <g stroke="#111" strokeWidth={1}>
        {Array.from({ length: Math.max(0, fieldsX - 1) }, (_, i) => {
          const x = colEdges[i + 1];
          return <line key={`v-${i}`} x1={x} y1={sashY} x2={x} y2={sashY + sashH} />;
        })}
        {Array.from({ length: Math.max(0, fieldsY - 1) }, (_, i) => {
          const y = rowEdges[i + 1];
          return <line key={`h-${i}`} x1={sashX} y1={y} x2={sashX + sashW} y2={y} />;
        })}
      </g>

      {Array.from({ length: fieldsY }, (_, row) =>
        Array.from({ length: fieldsX }, (_, col) => {
          const cx = colEdges[col];
          const cy = rowEdges[row];
          const cw = cellWAt(col);
          const ch = cellHAt(row);

          const k = keyOf(col, row);
          const ins = cellInsertions[k] ?? "Fixed";
          const isSel = !!selected && selected.col === col && selected.row === row;

          const inset = 10;
          const symX = cx + inset;
          const symY = cy + inset;
          const symW = cw - inset * 2;
          const symH = ch - inset * 2;

          return (
            <g key={k}>
              {isSel && <rect x={cx + 2} y={cy + 2} width={cw - 4} height={ch - 4} fill="none" stroke="#111" strokeWidth={2} />}
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                fill="transparent"
                pointerEvents="all"
                onPointerDown={() => onSelect?.(col, row)}
                onClick={() => onSelect?.(col, row)}
                style={{ cursor: onSelect ? "pointer" : "default" }}
              />
              {drawInsertionSymbol({ insertion: ins, view, x: symX, y: symY, w: symW, h: symH })}
              <g transform={`translate(${cx + 6}, ${cy + ch - 28})`}>
                <CellNumber n={cellIndex1Based(col, row, fieldsX)} />
              </g>
            </g>
          );
        })
      )}

      {showDims && (
        <g stroke="#111" strokeWidth={0.9} fill="none" fontFamily="system-ui, -apple-system" fontSize={14}>
          <line x1={frameX} y1={frameY + frameH + 26} x2={frameX + frameW} y2={frameY + frameH + 26} />
          <line x1={frameX} y1={frameY + frameH + 18} x2={frameX} y2={frameY + frameH + 34} />
          <line x1={frameX + frameW} y1={frameY + frameH + 18} x2={frameX + frameW} y2={frameY + frameH + 34} />
          <text x={frameX + frameW / 2} y={frameY + frameH + 52} textAnchor="middle" fill="#111">
            {widthMm}
          </text>

          <line x1={frameX + frameW + 26} y1={frameY} x2={frameX + frameW + 26} y2={frameY + frameH} />
          <line x1={frameX + frameW + 18} y1={frameY} x2={frameX + frameW + 34} y2={frameY} />
          <line x1={frameX + frameW + 18} y1={frameY + frameH} x2={frameX + frameW + 34} y2={frameY + frameH} />
          <text
            x={frameX + frameW + 50}
            y={frameY + frameH / 2}
            transform={`rotate(90 ${frameX + frameW + 50} ${frameY + frameH / 2})`}
            textAnchor="middle"
            fill="#111"
          >
            {heightMm}
          </text>
        </g>
      )}

      {showScheduleMeta && (
        <g fontFamily="system-ui, -apple-system" fontSize={12} fill="#111">
          <text x={frameX} y={24}>1 Ref: {positionRef}</text>
          <text x={frameX + frameW} y={24} textAnchor="end">2 Room: {room}</text>
          <text x={frameX} y={vbH - 18}>3 Qty: {qty}</text>
          <text x={frameX + frameW} y={vbH - 18} textAnchor="end">4 Status: {status}</text>
        </g>
      )}

      <g>
        <rect x={frameX} y={frameY - 34} width={86} height={24} rx={6} fill="#111" opacity={0.92} />
        <text x={frameX + 43} y={frameY - 18} textAnchor="middle" fontSize={12} fill="#fff" fontFamily="system-ui, -apple-system">
          {view}
        </text>
      </g>
    </svg>
  );
}

function isStepComplete(pos: Position, stepKey: string): boolean {
  switch (stepKey) {
    case "meta":
      return pos.positionRef.trim().length > 0 && pos.roomName.trim().length > 0 && pos.qty >= 1;
    case "system":
      return pos.supplier.trim().length > 0 && pos.manufacturer.trim().length > 0 && pos.product.trim().length > 0;
    case "dims": {
      const okWH = pos.widthMm >= 300 && pos.heightMm >= 300;
      const okGrid = pos.fieldsX >= 1 && pos.fieldsY >= 1;
      const sumCols = pos.colWidthsMm.reduce((a, b) => a + b, 0);
      const sumRows = pos.rowHeightsMm.reduce((a, b) => a + b, 0);
      return okWH && okGrid && sumCols === pos.widthMm && sumRows === pos.heightMm;
    }
    case "insert": {
      const total = pos.fieldsX * pos.fieldsY;
      const keys = Object.keys(pos.cellInsertions);
      if (keys.length < total) return false;
      for (let r = 0; r < pos.fieldsY; r++) {
        for (let c = 0; c < pos.fieldsX; c++) {
          const k = keyOf(c, r);
          if (!pos.cellInsertions[k]) return false;
        }
      }
      return true;
    }
    default:
      return true;
  }
}

function getEditMode(status: Status) {
  const isLockedAll = status === "Fabrication" || status === "Frozen";
  const isOrder = status === "Order";

  return {
    canEditCostDrivers: !(isLockedAll || isOrder),
    canEditMetaNonCost: !isLockedAll,
    canEditQty: !(isLockedAll || isOrder),
    canEditNotes: true,
    banner:
      status === "Order"
        ? "Locked at Order stage — only notes and non-cost metadata can be edited (quantity locked)."
        : status === "Fabrication" || status === "Frozen"
        ? "Locked — position is in production/frozen state."
        : "",
  };
}

function groupByPhase(positions: Position[]): Record<string, Position[]> {
  return positions.reduce((acc, p) => {
    (acc[p.phase] ||= []).push(p);
    return acc;
  }, {} as Record<string, Position[]>);
}

function defaultPosition(): Position {
  const fieldsX = 1;
  const fieldsY = 1;
  const widthMm = 1000;
  const heightMm = 1200;
  return {
    id: uid(),
    positionRef: "W-001",
    roomName: "Kitchen",
    qty: 1,
    brief: "Tilt and Turn",
    modelDesc: "",
    phase: "Rear Elevation",
    status: "Estimation",

    supplier: SUPPLIERS[0].supplier,
    manufacturer: SUPPLIERS[0].manufacturers[0].manufacturer,
    product: SUPPLIERS[0].manufacturers[0].products[0],

    widthMm,
    heightMm,

    fieldsX,
    fieldsY,
    colWidthsMm: evenSplit(widthMm, fieldsX),
    rowHeightsMm: evenSplit(heightMm, fieldsY),
    cellInsertions: buildGridInsertions(fieldsX, fieldsY),

    notesInternal: "",
    notesCustomer: "",
    notesQuote: "",
    notesEstimate: "",
    notesClient: "",
  };
}

export default function App() {
  const [screen, setScreen] = useState<"project" | "wizard">("project");
  const [positions, setPositions] = useState<Position[]>([defaultPosition()]);
  const [activeId, setActiveId] = useState<string>(positions[0]?.id);
  const [view, setView] = useState<ViewSide>("Inside");
  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number }>({ col: 0, row: 0 });

  const activePos = useMemo(
    () => positions.find((p) => p.id === activeId) ?? positions[0],
    [positions, activeId]
  );

  const steps = useMemo(
    () =>
      [
        { key: "meta", title: "Position" },
        { key: "system", title: "Supplier & Product" },
        { key: "dims", title: "Dimensions" },
        { key: "insert", title: "Insertion" },
      ] as const,
    []
  );

  const [step, setStep] = useState(0);
  const editMode = useMemo(() => getEditMode(activePos.status), [activePos.status]);

  const [widthDraft, setWidthDraft] = useState<string>(String(activePos.widthMm));
  const [heightDraft, setHeightDraft] = useState<string>(String(activePos.heightMm));

  const supplierNode = useMemo(
    () => SUPPLIERS.find((s) => s.supplier === activePos.supplier) ?? SUPPLIERS[0],
    [activePos.supplier]
  );
  const manufacturerOptions = supplierNode.manufacturers;
  const productOptions = useMemo(() => {
    const m =
      manufacturerOptions.find((x) => x.manufacturer === activePos.manufacturer) ?? manufacturerOptions[0];
    return m.products;
  }, [manufacturerOptions, activePos.manufacturer]);

  useEffect(() => {
    if (!positions.some((p) => p.id === activeId) && positions[0]) {
      setActiveId(positions[0].id);
    }
  }, [positions, activeId]);

  useEffect(() => {
    setWidthDraft(String(activePos.widthMm));
    setHeightDraft(String(activePos.heightMm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== activeId) return p;
        const s = SUPPLIERS.find((x) => x.supplier === p.supplier) ?? SUPPLIERS[0];
        const m = s.manufacturers.some((mm) => mm.manufacturer === p.manufacturer)
          ? p.manufacturer
          : s.manufacturers[0].manufacturer;
        const mNode = s.manufacturers.find((mm) => mm.manufacturer === m) ?? s.manufacturers[0];
        const prod = mNode.products.includes(p.product) ? p.product : mNode.products[0];
        if (m === p.manufacturer && prod === p.product) return p;
        return { ...p, manufacturer: m, product: prod };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activePos.supplier]);

  useEffect(() => {
    const c = Math.min(selectedCell.col, Math.max(0, activePos.fieldsX - 1));
    const r = Math.min(selectedCell.row, Math.max(0, activePos.fieldsY - 1));
    if (c !== selectedCell.col || r !== selectedCell.row) setSelectedCell({ col: c, row: r });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePos.fieldsX, activePos.fieldsY]);

  function updateActive(patch: Partial<Position>) {
    setPositions((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
  }

  function setGrid(fieldsX: number, fieldsY: number) {
    const fx = clampInt(fieldsX, 1, 8);
    const fy = clampInt(fieldsY, 1, 8);

    const nextInsertions = buildGridInsertions(fx, fy, activePos.cellInsertions);
    const nextCols = scaleSplitsToTotal(activePos.widthMm, activePos.colWidthsMm, fx);
    const nextRows = scaleSplitsToTotal(activePos.heightMm, activePos.rowHeightsMm, fy);

    updateActive({
      fieldsX: fx,
      fieldsY: fy,
      colWidthsMm: nextCols,
      rowHeightsMm: nextRows,
      cellInsertions: nextInsertions,
    });

    setSelectedCell({ col: 0, row: 0 });
  }

  function setCellInsertion(insertion: InsertionType) {
    const k = keyOf(selectedCell.col, selectedCell.row);
    updateActive({ cellInsertions: { ...activePos.cellInsertions, [k]: insertion } });
  }

  function createPosition() {
    const base = defaultPosition();
    const n = positions.length + 1;
    base.positionRef = `W-${String(n).padStart(3, "0")}`;
    base.roomName = "";
    base.brief = "";
    base.modelDesc = "";
    const next = [...positions, base];
    setPositions(next);
    setActiveId(base.id);
    setScreen("wizard");
    setStep(0);
    setSelectedCell({ col: 0, row: 0 });
  }

  function openWizard(id: string) {
    setActiveId(id);
    setScreen("wizard");
    setStep(0);
    setSelectedCell({ col: 0, row: 0 });
  }

  function backToProject() {
    setScreen("project");
  }

  function stepAllowed(targetIdx: number) {
    for (let i = 0; i < targetIdx; i++) {
      if (!isStepComplete(activePos, steps[i].key)) return false;
    }
    return true;
  }

  function next() {
    const curKey = steps[step].key;
    if (!isStepComplete(activePos, curKey)) return;
    const nextIdx = clampInt(step + 1, 0, steps.length - 1);
    if (stepAllowed(nextIdx)) setStep(nextIdx);
  }

  function back() {
    setStep((s) => clampInt(s - 1, 0, steps.length - 1));
  }

  const grouped = useMemo(() => groupByPhase(positions), [positions]);
  const selectedKey = keyOf(selectedCell.col, selectedCell.row);
  const selectedInsertion = activePos.cellInsertions[selectedKey] ?? "Fixed";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#fafafa", padding: 24 }}>
      <div style={{ width: "100%", margin: "0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: "#18181b" }}>
              QuoteSync — LogiKal-style prototype
            </h1>
            <p style={{ marginTop: 8, fontSize: 13, color: "#52525b" }}>
              Project Centre + Input of Elements wizard (multi-field + per-cell insertion + per-field splits).
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <Segmented<ViewSide> value={view} options={["Inside", "Outside"]} onChange={setView} />
            <div style={{ fontSize: 12, color: "#71717a" }}>Switch view to flip handle/handing.</div>
          </div>
        </div>

        {screen === "project" && (
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
              <div style={{ borderRadius: 18, border: "1px solid #e4e4e7", background: "#fff", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Project Centre</div>
                <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 14 }}>
                  <div style={{ borderRadius: 12, background: "#18181b", color: "#fff", padding: "10px 12px" }}>Positions</div>
                  <div style={{ borderRadius: 12, padding: "10px 12px", color: "#3f3f46" }}>Project preferences</div>
                  <div style={{ borderRadius: 12, padding: "10px 12px", color: "#3f3f46" }}>Address database</div>
                  <div style={{ borderRadius: 12, padding: "10px 12px", color: "#3f3f46" }}>Reports</div>
                  <div style={{ borderRadius: 12, padding: "10px 12px", color: "#3f3f46" }}>CAD drawing</div>
                  <div style={{ borderRadius: 12, padding: "10px 12px", color: "#3f3f46" }}>Remote support</div>
                </div>
              </div>

              <button
                type="button"
                onClick={createPosition}
                style={{
                  width: "100%",
                  borderRadius: 18,
                  background: "#18181b",
                  color: "#fff",
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + New position
              </button>

              <div style={{ borderRadius: 18, border: "1px solid #e4e4e7", background: "#fff", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: "#18181b" }}>Positions</h2>
                  <div style={{ fontSize: 12, color: "#71717a" }}>Grouped by phase</div>
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 18 }}>
                  {PHASE_OPTIONS.filter((p) => grouped[p]?.length).map((phase) => (
                    <div key={phase}>
                      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>{phase}</div>
                        <div style={{ fontSize: 12, color: "#71717a" }}>{grouped[phase].length} position(s)</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                        {grouped[phase].map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => openWizard(p.id)}
                            style={{
                              borderRadius: 18,
                              border: "1px solid #e4e4e7",
                              background: "#fff",
                              padding: 12,
                              textAlign: "left",
                              boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>{p.positionRef}</div>
                                  <StatusPill status={p.status} />
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: "#52525b" }}>
                                  {(p.roomName || "(no room)")} • Qty {p.qty} • {p.widthMm}×{p.heightMm} • {p.fieldsX}×{p.fieldsY}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: "#71717a" }}>
                                  {p.supplier} / {p.manufacturer} / {p.product}
                                </div>
                              </div>
                              <div style={{ height: 80, width: 64, borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", padding: 4 }}>
                                <TechnicalWindowSVG
                                  widthMm={p.widthMm}
                                  heightMm={p.heightMm}
                                  fieldsX={p.fieldsX}
                                  fieldsY={p.fieldsY}
                                  colWidthsMm={p.colWidthsMm}
                                  rowHeightsMm={p.rowHeightsMm}
                                  cellInsertions={p.cellInsertions}
                                  view={view}
                                  showDims={false}
                                  showScheduleMeta={false}
                                  positionRef={p.positionRef}
                                  room={p.roomName || ""}
                                  qty={p.qty}
                                  status={p.status}
                                />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {screen === "wizard" && (
          <div style={{ marginTop: 24, display: "grid", gap: 18 }}>
            <div style={{ borderRadius: 18, border: "1px solid #e4e4e7", background: "#fff", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Input of Elements</div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Badge>Ref: {activePos.positionRef}</Badge>
                    <Badge>Room: {activePos.roomName || "—"}</Badge>
                    <Badge>Qty: {activePos.qty}</Badge>
                    <Badge>{activePos.supplier} / {activePos.manufacturer} / {activePos.product}</Badge>
                    <Badge>Grid: {activePos.fieldsX}×{activePos.fieldsY}</Badge>
                    <StatusPill status={activePos.status} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={backToProject}
                  style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: "8px 10px", fontSize: 14, background: "#fff", cursor: "pointer", color: "#3f3f46" }}
                >
                  ← Project Centre
                </button>
              </div>

              {editMode.banner && (
                <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid #fde68a", background: "#fffbeb", padding: 12, fontSize: 14, color: "#92400e" }}>
                  {editMode.banner}
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {steps.map((s, idx) => {
                  const done = isStepComplete(activePos, s.key);
                  const allowed = stepAllowed(idx);
                  const active = idx === step;
                  return (
                    <button
                      type="button"
                      key={s.key}
                      onClick={() => allowed && setStep(idx)}
                      title={!allowed ? "Complete previous steps first" : done ? "Complete" : ""}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 14,
                        border: "1px solid " + (active ? "#18181b" : "#e4e4e7"),
                        background: active ? "#18181b" : allowed ? "#fff" : "#fafafa",
                        color: active ? "#fff" : allowed ? "#3f3f46" : "#a1a1aa",
                        padding: "8px 10px",
                        cursor: allowed ? "pointer" : "not-allowed",
                        fontSize: 14,
                      }}
                    >
                      <StepDot active={active} done={done} />
                      <span style={{ whiteSpace: "nowrap" }}>
                        {idx + 1}. {s.title}
                      </span>
                      <span style={{ fontSize: 12 }}>{done ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#71717a" }}>
                Gating: you can’t jump ahead until previous inputs are complete.
              </div>
            </div>

            <div style={{ borderRadius: 18, border: "1px solid #e4e4e7", background: "#fff", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#18181b" }}>{steps[step].title}</h3>
                <div style={{ fontSize: 12, color: "#71717a" }}>
                  Step {step + 1} / {steps.length}
                </div>
              </div>

              {steps[step].key === "meta" && (
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Position reference</div>
                      <input
                        value={activePos.positionRef}
                        onChange={(e) => updateActive({ positionRef: e.target.value })}
                        disabled={!editMode.canEditMetaNonCost}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Quantity</div>
                      <input
                        type="number"
                        value={activePos.qty}
                        onChange={(e) => updateActive({ qty: clampInt(Number(e.target.value || 1), 1, 999) })}
                        disabled={!editMode.canEditQty}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      />
                      {!editMode.canEditQty && <div style={{ marginTop: 6, fontSize: 12, color: "#71717a" }}>Quantity is locked at Order and beyond.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#3f3f46" }}>Room name</div>
                    <input
                      value={activePos.roomName}
                      onChange={(e) => updateActive({ roomName: e.target.value })}
                      disabled={!editMode.canEditMetaNonCost}
                      style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#3f3f46" }}>Brief description</div>
                    <input
                      value={activePos.brief}
                      onChange={(e) => updateActive({ brief: e.target.value })}
                      disabled={!editMode.canEditMetaNonCost}
                      style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#3f3f46" }}>Model description</div>
                    <input
                      value={activePos.modelDesc}
                      onChange={(e) => updateActive({ modelDesc: e.target.value })}
                      disabled={!editMode.canEditMetaNonCost}
                      placeholder="Optional"
                      style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Phase</div>
                      <select
                        value={activePos.phase}
                        onChange={(e) => updateActive({ phase: e.target.value as Phase })}
                        disabled={!editMode.canEditMetaNonCost}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      >
                        {PHASE_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Status</div>
                      <select
                        value={activePos.status}
                        onChange={(e) => updateActive({ status: e.target.value as Status })}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {steps[step].key === "system" && (
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#3f3f46" }}>Supplier</div>
                    <select
                      value={activePos.supplier}
                      onChange={(e) => updateActive({ supplier: e.target.value })}
                      disabled={!editMode.canEditCostDrivers}
                      style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                    >
                      {SUPPLIERS.map((s) => (
                        <option key={s.supplier} value={s.supplier}>{s.supplier}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#3f3f46" }}>Manufacturer</div>
                    <select
                      value={activePos.manufacturer}
                      onChange={(e) => updateActive({ manufacturer: e.target.value })}
                      disabled={!editMode.canEditCostDrivers}
                      style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                    >
                      {manufacturerOptions.map((m) => (
                        <option key={m.manufacturer} value={m.manufacturer}>{m.manufacturer}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#3f3f46" }}>Product/System</div>
                    <select
                      value={activePos.product}
                      onChange={(e) => updateActive({ product: e.target.value })}
                      disabled={!editMode.canEditCostDrivers}
                      style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                    >
                      {productOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {steps[step].key === "dims" && (
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Total width (mm)</div>
                      <input
                        inputMode="numeric"
                        value={widthDraft}
                        onChange={(e) => setWidthDraft(e.target.value)}
                        onBlur={() => {
                          if (!editMode.canEditCostDrivers) return;
                          const v = clampMm(Number(widthDraft), 300, 6000);
                          const nextCols = scaleSplitsToTotal(v, activePos.colWidthsMm, activePos.fieldsX);
                          updateActive({ widthMm: v, colWidthsMm: nextCols });
                          setWidthDraft(String(v));
                        }}
                        disabled={!editMode.canEditCostDrivers}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      />
                      <div style={{ marginTop: 6, fontSize: 12, color: "#71717a" }}>Clamps on blur (no snapping while typing).</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Total height (mm)</div>
                      <input
                        inputMode="numeric"
                        value={heightDraft}
                        onChange={(e) => setHeightDraft(e.target.value)}
                        onBlur={() => {
                          if (!editMode.canEditCostDrivers) return;
                          const v = clampMm(Number(heightDraft), 300, 6000);
                          const nextRows = scaleSplitsToTotal(v, activePos.rowHeightsMm, activePos.fieldsY);
                          updateActive({ heightMm: v, rowHeightsMm: nextRows });
                          setHeightDraft(String(v));
                        }}
                        disabled={!editMode.canEditCostDrivers}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Number of fields (width)</div>
                      <input
                        type="number"
                        value={activePos.fieldsX}
                        onChange={(e) => setGrid(Number(e.target.value || 1), activePos.fieldsY)}
                        disabled={!editMode.canEditCostDrivers}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>Number of fields (height)</div>
                      <input
                        type="number"
                        value={activePos.fieldsY}
                        onChange={(e) => setGrid(activePos.fieldsX, Number(e.target.value || 1))}
                        disabled={!editMode.canEditCostDrivers}
                        style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {steps[step].key === "insert" && (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 14, color: "#3f3f46" }}>
                    Selected cell: <span style={{ fontWeight: 700, color: "#18181b" }}>#{cellIndex1Based(selectedCell.col, selectedCell.row, activePos.fieldsX)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#3f3f46" }}>Insertion type</div>
                  <select
                    value={selectedInsertion}
                    onChange={(e) => setCellInsertion(e.target.value as InsertionType)}
                    style={{ marginTop: 6, width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px" }}
                  >
                    {INSERTION_CHOICES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: "#71717a" }}>Click a cell in the drawing to change selection.</div>
                </div>
              )}

              <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  type="button"
                  onClick={back}
                  disabled={step === 0}
                  style={{
                    borderRadius: 14,
                    border: "1px solid #e4e4e7",
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "#fff",
                    cursor: step === 0 ? "not-allowed" : "pointer",
                    color: step === 0 ? "#a1a1aa" : "#3f3f46",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={step === steps.length - 1 || !isStepComplete(activePos, steps[step].key)}
                  style={{
                    borderRadius: 14,
                    border: "none",
                    padding: "10px 12px",
                    fontSize: 14,
                    fontWeight: 700,
                    background: step === steps.length - 1 || !isStepComplete(activePos, steps[step].key) ? "#e4e4e7" : "#18181b",
                    cursor: step === steps.length - 1 || !isStepComplete(activePos, steps[step].key) ? "not-allowed" : "pointer",
                    color: step === steps.length - 1 || !isStepComplete(activePos, steps[step].key) ? "#71717a" : "#fff",
                  }}
                >
                  Next
                </button>
              </div>
            </div>

            <div style={{ borderRadius: 18, border: "1px solid #e4e4e7", background: "#fff", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Position & Preview</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#52525b" }}>
                  <Badge>W: {activePos.widthMm} mm</Badge>
                  <Badge>H: {activePos.heightMm} mm</Badge>
                  <Badge>Fields: {activePos.fieldsX}×{activePos.fieldsY}</Badge>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
                <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, height: 360 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Position information</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 14, color: "#3f3f46" }}>
                    <div><b>Ref:</b> {activePos.positionRef}</div>
                    <div><b>Room:</b> {activePos.roomName || "—"}</div>
                    <div><b>Qty:</b> {activePos.qty}</div>
                    <div><b>Phase:</b> {activePos.phase}</div>
                    <div><b>Status:</b> {activePos.status}</div>
                    <div><b>System:</b> {activePos.supplier} / {activePos.manufacturer} / {activePos.product}</div>
                    <div><b>Size:</b> {activePos.widthMm}×{activePos.heightMm}</div>
                    <div><b>Grid:</b> {activePos.fieldsX}×{activePos.fieldsY}</div>
                    <div><b>Selected cell:</b> #{cellIndex1Based(selectedCell.col, selectedCell.row, activePos.fieldsX)}</div>
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, height: 520 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>Technical drawing</div>
                    <StatusPill status={activePos.status} />
                  </div>
                  <div style={{ marginTop: 12, height: "calc(100% - 28px)", overflow: "hidden", borderRadius: 14, border: "1px solid #e4e4e7", padding: 8 }}>
                    <TechnicalWindowSVG
                      widthMm={activePos.widthMm}
                      heightMm={activePos.heightMm}
                      fieldsX={activePos.fieldsX}
                      fieldsY={activePos.fieldsY}
                      colWidthsMm={activePos.colWidthsMm}
                      rowHeightsMm={activePos.rowHeightsMm}
                      cellInsertions={activePos.cellInsertions}
                      selected={selectedCell}
                      onSelect={(c, r) => setSelectedCell({ col: c, row: r })}
                      view={view}
                      showDims
                      showScheduleMeta
                      positionRef={activePos.positionRef}
                      room={activePos.roomName}
                      qty={activePos.qty}
                      status={activePos.status}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#71717a" }}>
                    Click a cell to select it, then set its insertion type.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

