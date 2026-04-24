import React, { useEffect, useMemo } from "react";
import { buildWindowDrawingModel } from "../features/configurator/rendering/buildWindowDrawingModel";
import DrawingViewport from "../features/configurator/rendering/DrawingViewport";

type PosDraft = {
  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;
  insertion: string;
  cellInsertions?: Record<string, string>;
  colWidthsMm?: number[];
  rowHeightsMm?: number[];
  orientationView?: "inside" | "outside";
  windowConfiguration?: {
    junctions?: Array<{ key: string; type?: string }>;
  };
  resolvedProfiles?: any;
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
  return Array.from({ length: p }, (_, i) => base + (i < rem ? 1 : 0));
}

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizeCellInsertions(fieldsX: number, fieldsY: number, existing: Record<string, string> | undefined, fallback: string) {
  const out: Record<string, string> = {};
  for (let r = 0; r < fieldsY; r++) {
    for (let c = 0; c < fieldsX; c++) {
      out[keyForCell(c, r)] = existing?.[keyForCell(c, r)] ?? fallback;
    }
  }
  return out;
}

export default function GridEditor({
  pos,
  setPos,
  selectedCell,
  onSelectCell,
  view = "Inside",
  showDimensions = true,
}: {
  pos: PosDraft;
  setPos: React.Dispatch<React.SetStateAction<any>>;
  selectedCell?: { col: number; row: number } | null;
  onSelectCell?: (cell: { col: number; row: number } | null) => void;
  view?: "Inside" | "Outside";
  openingStd?: "DIN" | "UK";
  showDimensions?: boolean;
}) {
  const totalW = clamp(Math.round(pos.widthMm || 0), 300, 6000);
  const totalH = clamp(Math.round(pos.heightMm || 0), 300, 6000);
  const fx = clamp(Math.round(pos.fieldsX || 1), 1, 16);
  const fy = clamp(Math.round(pos.fieldsY || 1), 1, 16);

  const cols = useMemo(() => {
    const existing = Array.isArray(pos.colWidthsMm) ? pos.colWidthsMm.slice() : null;
    if (!existing || existing.length !== fx) return evenSplit(totalW, fx);
    const safe = existing.map((value) => Math.max(1, Math.round(value)));
    const safeSum = sum(safe);
    if (safeSum === totalW) return safe;
    return safe.map((value, index) => (index < safe.length - 1 ? Math.max(1, Math.round((value / safeSum) * totalW)) : Math.max(1, totalW - sum(safe.slice(0, -1).map((entry) => Math.max(1, Math.round((entry / safeSum) * totalW)))))));
  }, [fx, pos.colWidthsMm, totalW]);

  const rows = useMemo(() => {
    const existing = Array.isArray(pos.rowHeightsMm) ? pos.rowHeightsMm.slice() : null;
    if (!existing || existing.length !== fy) return evenSplit(totalH, fy);
    const safe = existing.map((value) => Math.max(1, Math.round(value)));
    const safeSum = sum(safe);
    if (safeSum === totalH) return safe;
    return safe.map((value, index) => (index < safe.length - 1 ? Math.max(1, Math.round((value / safeSum) * totalH)) : Math.max(1, totalH - sum(safe.slice(0, -1).map((entry) => Math.max(1, Math.round((entry / safeSum) * totalH)))))));
  }, [fy, pos.rowHeightsMm, totalH]);

  useEffect(() => {
    setPos((previous: any) => ({
      ...previous,
      widthMm: totalW,
      heightMm: totalH,
      fieldsX: fx,
      fieldsY: fy,
      colWidthsMm: cols,
      rowHeightsMm: rows,
      orientationView: view === "Outside" ? "outside" : "inside",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalW, totalH, fx, fy, view]);

  const removeVSplit = (splitIndex: number) => {
    if (fx <= 1) return;
    const i = clamp(splitIndex, 1, fx - 1);
    const next = cols.slice();
    next[i - 1] = next[i - 1] + next[i];
    next.splice(i, 1);
    setPos((previous: any) => {
      const existing = normalizeCellInsertions(previous.fieldsX, previous.fieldsY, previous.cellInsertions, previous.insertion);
      const merged: Record<string, string> = {};
      for (let row = 0; row < previous.fieldsY; row += 1) {
        for (let col = 0; col < previous.fieldsX - 1; col += 1) {
          const sourceCol = col < i ? col : col + 1;
          merged[keyForCell(col, row)] = existing[keyForCell(sourceCol, row)];
        }
      }
      return { ...previous, fieldsX: fx - 1, colWidthsMm: next, cellInsertions: merged };
    });
  };

  const removeHSplit = (splitIndex: number) => {
    if (fy <= 1) return;
    const i = clamp(splitIndex, 1, fy - 1);
    const next = rows.slice();
    next[i - 1] = next[i - 1] + next[i];
    next.splice(i, 1);
    setPos((previous: any) => {
      const existing = normalizeCellInsertions(previous.fieldsX, previous.fieldsY, previous.cellInsertions, previous.insertion);
      const merged: Record<string, string> = {};
      for (let row = 0; row < previous.fieldsY - 1; row += 1) {
        for (let col = 0; col < previous.fieldsX; col += 1) {
          const sourceRow = row < i ? row : row + 1;
          merged[keyForCell(col, row)] = existing[keyForCell(col, sourceRow)];
        }
      }
      return { ...previous, fieldsY: fy - 1, rowHeightsMm: next, cellInsertions: merged };
    });
  };

  const drawingModel = useMemo(
    () =>
      buildWindowDrawingModel({
        ...pos,
        widthMm: totalW,
        heightMm: totalH,
        fieldsX: fx,
        fieldsY: fy,
        colWidthsMm: cols,
        rowHeightsMm: rows,
        orientationView: view === "Outside" ? "outside" : "inside",
      }),
    [cols, fx, fy, pos, rows, totalH, totalW, view]
  );

  const selectedCellKey = selectedCell ? keyForCell(selectedCell.col, selectedCell.row) : "";

  return (
    <div style={{ display: "grid" }}>
      <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 8 }}>
        <DrawingViewport
          model={drawingModel}
          selectedCellKey={selectedCellKey}
          onSelectCell={onSelectCell}
          onRemoveVerticalJunction={removeVSplit}
          onRemoveHorizontalJunction={removeHSplit}
          minHeight={420}
          aspectRatio="16 / 9"
        />
      </div>
    </div>
  );
}
