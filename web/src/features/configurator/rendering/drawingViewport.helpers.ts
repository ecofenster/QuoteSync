import type { DrawingViewportPoint, DrawingScaleOption, DrawingScalePreset } from "./drawingViewport.types";

export const DRAWING_SCALE_OPTIONS: DrawingScaleOption[] = [
  { value: "auto", label: "Auto / Fit", ratio: null },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "1:2", label: "1:2", ratio: 0.5 },
  { value: "1:5", label: "1:5", ratio: 0.2 },
  { value: "1:10", label: "1:10", ratio: 0.1 },
  { value: "1:16", label: "1:16", ratio: 1 / 16 },
  { value: "1:20", label: "1:20", ratio: 0.05 },
  { value: "1:50", label: "1:50", ratio: 0.02 },
  { value: "1:100", label: "1:100", ratio: 0.01 },
];

const MIN_ZOOM_MULTIPLIER = 0.25;
const MAX_ZOOM_MULTIPLIER = 8;
const ZOOM_STEP = 1.2;

export function clampZoomMultiplier(value: number) {
  return Math.max(MIN_ZOOM_MULTIPLIER, Math.min(MAX_ZOOM_MULTIPLIER, Number(value || 1)));
}

export function getScaleRatioFromPreset(preset: DrawingScalePreset) {
  return DRAWING_SCALE_OPTIONS.find((option) => option.value === preset)?.ratio ?? null;
}

export function getEffectiveDisplayScale(input: {
  preset: DrawingScalePreset;
  zoomMultiplier: number;
  fitScale: number;
}) {
  const baseScale = input.preset === "auto" ? input.fitScale : (getScaleRatioFromPreset(input.preset) ?? input.fitScale);
  return Math.max(0.01, baseScale * clampZoomMultiplier(input.zoomMultiplier));
}

export function stepZoomMultiplier(current: number, direction: "in" | "out") {
  const next = direction === "in" ? current * ZOOM_STEP : current / ZOOM_STEP;
  return clampZoomMultiplier(next);
}

export function getModelPointFromViewportPoint(input: {
  clientX: number;
  clientY: number;
  viewportRect: DOMRect;
  contentRect: DOMRect;
  modelWidth: number;
  modelHeight: number;
}): DrawingViewportPoint | null {
  const { clientX, clientY, viewportRect, contentRect, modelWidth, modelHeight } = input;
  if (modelWidth <= 0 || modelHeight <= 0 || contentRect.width <= 0 || contentRect.height <= 0) return null;
  const x = clientX - viewportRect.left - (contentRect.left - viewportRect.left);
  const y = clientY - viewportRect.top - (contentRect.top - viewportRect.top);
  return {
    x: (x / contentRect.width) * modelWidth,
    y: (y / contentRect.height) * modelHeight,
  };
}
