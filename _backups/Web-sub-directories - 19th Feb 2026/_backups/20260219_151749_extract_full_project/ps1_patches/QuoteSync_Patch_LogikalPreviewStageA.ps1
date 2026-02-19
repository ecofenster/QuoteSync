# QuoteSync Patch — Stage A (LogiKal-style technical preview drawing)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# This patch updates: web\src\components\GridEditor.tsx
$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$expectedRunDir = "C:\Github\QuoteSync\web\ps1_patches"
try {
  if ((Get-Location).Path -ne $expectedRunDir) {
    Set-Location $expectedRunDir
  }
} catch {
  Fail "Could not Set-Location to $expectedRunDir. Create the folder or adjust the path in this script."
}

Write-Host ("Run directory: " + (Get-Location).Path)

$webDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Ok ("Web dir: " + $webDir.Path)

$target = Join-Path $webDir.Path "src\components\GridEditor.tsx"
if (!(Test-Path $target)) { Fail "Target file not found: $target" }

# Backup
$backupDir = Join-Path $webDir.Path "_backups\ps1_patches"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $backupDir ("GridEditor.tsx.bak_" + $ts)
Copy-Item -Force $target $backup
Ok ("Backup created: " + $backup)

# New file content
$NewGridEditorTsx = @'
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
  const sashInset = 24;

  const sashX = frameX + sashInset;
  const sashY = frameY + sashInset;
  const sashW = frameW - sashInset * 2;
  const sashH = frameH - sashInset * 2;

  const xStops = useMemo(() => {
    const xs: number[] = [sashX];
    let acc = 0;
    for (let i = 0; i < cols.length; i++) {
      acc += cols[i] / totalW;
      xs.push(sashX + sashW * acc);
    }
    xs[xs.length - 1] = sashX + sashW;
    return xs;
  }, [cols, totalW, sashX, sashW]);

  const yStops = useMemo(() => {
    const ys: number[] = [sashY];
    let acc = 0;
    for (let i = 0; i < rows.length; i++) {
      acc += rows[i] / totalH;
      ys.push(sashY + sashH * acc);
    }
    ys[ys.length - 1] = sashY + sashH;
    return ys;
  }, [rows, totalH, sashY, sashH]);

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

            {/* Sash boundary */}
            <rect x={sashX} y={sashY} width={sashW} height={sashH} fill="none" stroke="#111" strokeWidth={1.2} />

            {/* Grid lines */}
            {xStops.slice(1, -1).map((x, idx) => (
              <g key={"v" + idx}>
                <line x1={x} y1={sashY} x2={x} y2={sashY + sashH} stroke="#111" strokeWidth={1} />
                {/* clickable zone */}
                <line
                  x1={x}
                  y1={sashY}
                  x2={x}
                  y2={sashY + sashH}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: "pointer" }}
                  onClick={() => removeVSplit(idx + 1)}
                />
              </g>
            ))}

            {yStops.slice(1, -1).map((y, idx) => (
              <g key={"h" + idx}>
                <line x1={sashX} y1={y} x2={sashX + sashW} y2={y} stroke="#111" strokeWidth={1} />
                <line
                  x1={sashX}
                  y1={y}
                  x2={sashX + sashW}
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

                const boxW = 22;
                const boxH = 22;
                const bx = x0 + 6;
                const by = y1 - boxH - 6;

                return (
                  <g key={`c-${col}-${row}`}>
                    <rect x={bx} y={by} width={boxW} height={boxH} rx={2} fill="#fff" stroke="#111" strokeWidth={1} />
                    <text
                      x={bx + boxW / 2}
                      y={by + 15}
                      textAnchor="middle"
                      fontSize={12}
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

# Write
Set-Content -Path $target -Value $NewGridEditorTsx -Encoding UTF8
Ok "Updated GridEditor.tsx"

# Quick verify: ensure key markers exist
$txt = Get-Content -Path $target -Raw
if ($txt -notmatch "LogiKal-style technical preview") { Warn "Marker comment not found (still OK if formatting changed)." }
if ($txt -notmatch "export default function GridEditor") { Fail "Sanity check failed: export default function GridEditor missing." }

# Hash (for traceability)
$hash = Get-FileHash -Path $target -Algorithm SHA256
Ok ("SHA256 GridEditor.tsx: " + $hash.Hash)
Ok "Stage A patch complete. Hard refresh your dev server page if needed."
