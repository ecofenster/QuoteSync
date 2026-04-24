import React from "react";
import type { DrawingScalePreset } from "./drawingViewport.types";
import { DRAWING_SCALE_OPTIONS } from "./drawingViewport.helpers";

type Props = {
  scalePreset: DrawingScalePreset;
  zoomMultiplier: number;
  onScalePresetChange: (value: DrawingScalePreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
};

const controlStyle: React.CSSProperties = {
  height: 32,
  borderRadius: 10,
  border: "1px solid #d4d4d8",
  background: "#fff",
  color: "#18181b",
};

export default function DrawingPreviewToolbar(props: Props) {
  const { scalePreset, zoomMultiplier, onScalePresetChange, onZoomIn, onZoomOut, onResetZoom } = props;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#52525b" }}>Scale</span>
          <select
            value={scalePreset}
            onChange={(event) => onScalePresetChange(event.currentTarget.value as DrawingScalePreset)}
            style={{ ...controlStyle, minWidth: 112, padding: "0 10px" }}
          >
            {DRAWING_SCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onZoomOut} style={{ ...controlStyle, width: 32, fontSize: 18, fontWeight: 700 }}>
          -
        </button>
        <button type="button" onClick={onZoomIn} style={{ ...controlStyle, width: 32, fontSize: 18, fontWeight: 700 }}>
          +
        </button>
        <button type="button" onClick={onResetZoom} style={{ ...controlStyle, padding: "0 10px", fontWeight: 600 }}>
          Reset
        </button>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>
        Zoom {(zoomMultiplier * 100).toFixed(0)}%
      </div>
    </div>
  );
}
