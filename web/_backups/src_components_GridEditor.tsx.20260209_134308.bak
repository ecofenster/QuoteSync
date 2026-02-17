import React, { useEffect, useMemo, useState } from "react";

type PosDraft = {
  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;
  insertion: string;

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
  const items = s.split("/").map(x => x.trim()).filter(Boolean);
  if (!items.length) return null;
  const nums = items.map(x => Number(x));
  if (nums.some(n => !Number.isFinite(n) || n <= 0)) return null;
  return nums.map(n => Math.round(n));
}

function fmtSlash(arr: number[]) {
  return arr.map(n => String(Math.round(n))).join("/");
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

export default function GridEditor({
  pos,
  setPos,
}: {
  pos: PosDraft;
  setPos: React.Dispatch<React.SetStateAction<any>>;
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
      const scaled = existing.map(v => Math.max(1, Math.round((v / s) * totalW)));
      // fix rounding drift
      let drift = totalW - sum(scaled);
      for (let i = 0; i < scaled.length && drift !== 0; i++) {
        const step = drift > 0 ? 1 : -1;
        if (scaled[i] + step >= 1) { scaled[i] += step; drift -= step; }
      }
      return scaled;
    }
    return existing.map(v => Math.max(1, Math.round(v)));
  }, [pos.colWidthsMm, fx, totalW]);

  const rows = useMemo(() => {
    const existing = Array.isArray(pos.rowHeightsMm) ? pos.rowHeightsMm.slice() : null;
    if (!existing || existing.length !== fy) return evenSplit(totalH, fy);
    const s = sum(existing);
    if (s !== totalH) {
      const scaled = existing.map(v => Math.max(1, Math.round((v / s) * totalH)));
      let drift = totalH - sum(scaled);
      for (let i = 0; i < scaled.length && drift !== 0; i++) {
        const step = drift > 0 ? 1 : -1;
        if (scaled[i] + step >= 1) { scaled[i] += step; drift -= step; }
      }
      return scaled;
    }
    return existing.map(v => Math.max(1, Math.round(v)));
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
    if (!parsed) { setColStr(fmtSlash(cols)); setColDirty(false); return; }
    if (parsed.length !== fx) { setColStr(fmtSlash(cols)); setColDirty(false); return; }
    if (sum(parsed) !== totalW) { setColStr(fmtSlash(cols)); setColDirty(false); return; }
    setPos((p: any) => ({ ...p, colWidthsMm: parsed }));
    setColDirty(false);
  };

  const applyRows = () => {
    const parsed = parseSlashList(rowStr);
    if (!parsed) { setRowStr(fmtSlash(rows)); setRowDirty(false); return; }
    if (parsed.length !== fy) { setRowStr(fmtSlash(rows)); setRowDirty(false); return; }
    if (sum(parsed) !== totalH) { setRowStr(fmtSlash(rows)); setRowDirty(false); return; }
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
    setPos((p: any) => ({ ...p, fieldsX: fx - 1, colWidthsMm: next }));
    setColDirty(false);
  };

  const removeHSplit = (splitIndex: number) => {
    if (fy <= 1) return;
    const i = clamp(splitIndex, 1, fy - 1);
    const next = rows.slice();
    next[i - 1] = next[i - 1] + next[i];
    next.splice(i, 1);
    setPos((p: any) => ({ ...p, fieldsY: fy - 1, rowHeightsMm: next }));
    setRowDirty(false);
  };

  // SVG geometry
  const vw = 520;
  const vh = 320;
  const pad = 22;
  const innerW = vw - pad * 2;
  const innerH = vh - pad * 2;

  const xStops = useMemo(() => {
    const xs = [pad];
    let acc = 0;
    for (let i = 0; i < cols.length; i++) {
      acc += cols[i] / totalW;
      xs.push(pad + innerW * acc);
    }
    return xs;
  }, [cols, totalW]);

  const yStops = useMemo(() => {
    const ys = [pad];
    let acc = 0;
    for (let i = 0; i < rows.length; i++) {
      acc += rows[i] / totalH;
      ys.push(pad + innerH * acc);
    }
    return ys;
  }, [rows, totalH]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 10 }}>
        <div style={{ fontSize: 12, color: "#71717a", marginBottom: 8 }}>
          {labelForInsertion(pos.insertion)} • {fx}×{fy} • {totalW}×{totalH} mm
        </div>

        <div style={{ width: "100%", aspectRatio: "16/9" }}>
          <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" height="100%" style={{ display: "block" }}>
            <rect x={10} y={10} width={vw - 20} height={vh - 20} rx={18} fill="#fafafa" stroke="#e4e4e7" strokeWidth={3} />
            <rect x={pad} y={pad} width={innerW} height={innerH} rx={12} fill="#ffffff" stroke="#18181b" strokeWidth={4} />

            {/* grid lines */}
            {xStops.slice(1, -1).map((x, idx) => (
              <g key={"v" + idx}>
                <line x1={x} y1={pad} x2={x} y2={pad + innerH} stroke="#d4d4d8" strokeWidth={2} />
                {/* clickable zone */}
                <line
                  x1={x}
                  y1={pad}
                  x2={x}
                  y2={pad + innerH}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: "pointer" }}
                  onClick={() => removeVSplit(idx + 1)}
                />
              </g>
            ))}

            {yStops.slice(1, -1).map((y, idx) => (
              <g key={"h" + idx}>
                <line x1={pad} y1={y} x2={pad + innerW} y2={y} stroke="#d4d4d8" strokeWidth={2} />
                <line
                  x1={pad}
                  y1={y}
                  x2={pad + innerW}
                  y2={y}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: "pointer" }}
                  onClick={() => removeHSplit(idx + 1)}
                />
              </g>
            ))}

            {/* handle marker */}
            <circle cx={pad + innerW - 18} cy={pad + innerH / 2} r={6} fill="#16a34a" opacity={0.85} />
          </svg>
        </div>

        {/* sizing overrides */}
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {fx > 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Column widths (mm) — format: 1000/500 (must sum to {totalW})</div>
              <input
                value={colStr}
                onChange={(e) => { setColStr(e.target.value); setColDirty(true); }}
                onBlur={applyCols}
                onKeyDown={(e) => { if (e.key === "Enter") applyCols(); }}
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
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Row heights (mm) — format: 1200/900 (must sum to {totalH})</div>
              <input
                value={rowStr}
                onChange={(e) => { setRowStr(e.target.value); setRowDirty(true); }}
                onBlur={applyRows}
                onKeyDown={(e) => { if (e.key === "Enter") applyRows(); }}
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
