import React from "react";
import type { DrawingScalePreset, DrawingViewportTool } from "./drawingViewport.types";
import { DRAWING_SCALE_OPTIONS } from "./drawingViewport.helpers";

type Props = {
  scalePreset: DrawingScalePreset;
  tool: DrawingViewportTool;
  zoomMultiplier: number;
  measurementCount?: number;
  onScalePresetChange: (value: DrawingScalePreset) => void;
  onToolChange: (value: DrawingViewportTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onClearMeasurements?: () => void;
};

export default function DrawingPreviewToolbar(props: Props) {
  const {
    scalePreset,
    tool,
    zoomMultiplier,
    measurementCount = 0,
    onScalePresetChange,
    onToolChange,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onClearMeasurements,
  } = props;

  return (
    <div className="qs-migrated-229">
      <div className="qs-migrated-230">
        <label className="qs-migrated-10">
          <span className="qs-migrated-231">Tool</span>
          <select
            value={tool}
            onChange={(event) => onToolChange(event.currentTarget.value as DrawingViewportTool)} className="qs-migrated-232"
          >
            <option value="select">Select</option>
            <option value="pan">Pan</option>
            <option value="measure">Measure</option>
          </select>
        </label>
        <label className="qs-migrated-10">
          <span className="qs-migrated-231">Scale</span>
          <select
            value={scalePreset}
            onChange={(event) => onScalePresetChange(event.currentTarget.value as DrawingScalePreset)} className="qs-migrated-233"
          >
            {DRAWING_SCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onZoomOut} className="qs-migrated-234">
          -
        </button>
        <button type="button" onClick={onZoomIn} className="qs-migrated-234">
          +
        </button>
        <button type="button" onClick={onResetZoom} className="qs-migrated-235">
          Reset
        </button>
        {tool === "measure" ? (
          <button
            type="button"
            onClick={onClearMeasurements} className="qs-migrated-235"
            disabled={!measurementCount}
          >
            Clear Measurements
          </button>
        ) : null}
      </div>
      <div className="qs-migrated-236">
        {tool === "measure" ? `Measurements ${measurementCount} • ` : ""}Zoom {(zoomMultiplier * 100).toFixed(0)}%
      </div>
    </div>
  );
}
