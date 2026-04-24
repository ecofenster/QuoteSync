import type {
  DrawingMeasurementAnnotation,
  DrawingMeasurementPoint,
  DrawingSnapAnchor,
  DrawingViewportFrameRect,
  DrawingViewportPan,
  DrawingViewportPoint,
  DrawingScaleOption,
  DrawingScalePreset,
} from "./drawingViewport.types";
import type { DrawingModel } from "./drawingModel";

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

export function clampPan(value: DrawingViewportPan) {
  return {
    x: Math.max(0, Number(value.x || 0)),
    y: Math.max(0, Number(value.y || 0)),
  };
}

export function getFrameRectFromModel(model: DrawingModel): DrawingViewportFrameRect {
  const pad = 56;
  const availableWidth = model.viewBox.width - pad * 2;
  const availableHeight = model.viewBox.height - pad * 2;
  const ratio = Math.max(0.1, model.width / Math.max(1, model.height));

  let frameWidth = availableWidth;
  let frameHeight = frameWidth / ratio;
  if (frameHeight > availableHeight) {
    frameHeight = availableHeight;
    frameWidth = frameHeight * ratio;
  }

  const x0 = pad + (availableWidth - frameWidth) / 2;
  const y0 = pad + (availableHeight - frameHeight) / 2;
  return {
    x0,
    x1: x0 + frameWidth,
    y0,
    y1: y0 + frameHeight,
    width: frameWidth,
    height: frameHeight,
  };
}

export function clampPointToFrameRect(point: DrawingViewportPoint, frameRect: DrawingViewportFrameRect): DrawingViewportPoint {
  return {
    x: Math.max(frameRect.x0, Math.min(frameRect.x1, point.x)),
    y: Math.max(frameRect.y0, Math.min(frameRect.y1, point.y)),
  };
}

export function convertModelPointToItemMm(point: DrawingViewportPoint, frameRect: DrawingViewportFrameRect, model: DrawingModel): DrawingViewportPoint {
  return {
    x: ((point.x - frameRect.x0) / Math.max(1, frameRect.width)) * model.width,
    y: ((point.y - frameRect.y0) / Math.max(1, frameRect.height)) * model.height,
  };
}

export function getMeasurementPointFromClientEvent(input: {
  clientX: number;
  clientY: number;
  viewportRect: DOMRect;
  contentRect: DOMRect;
  model: DrawingModel;
  snapAnchors?: DrawingSnapAnchor[];
  snapDistanceModelUnits?: number;
}): DrawingMeasurementPoint | null {
  const modelPoint = getModelPointFromViewportPoint({
    clientX: input.clientX,
    clientY: input.clientY,
    viewportRect: input.viewportRect,
    contentRect: input.contentRect,
    modelWidth: input.model.viewBox.width,
    modelHeight: input.model.viewBox.height,
  });
  if (!modelPoint) return null;
  const frameRect = getFrameRectFromModel(input.model);
  const clampedModelPoint = clampPointToFrameRect(modelPoint, frameRect);
  const snappedPoint = getNearestSnapAnchorPoint(
    clampedModelPoint,
    input.snapAnchors ?? [],
    input.snapDistanceModelUnits ?? 10
  ) ?? clampedModelPoint;
  return {
    model: snappedPoint,
    mm: convertModelPointToItemMm(snappedPoint, frameRect, input.model),
  };
}

export function getMeasurementDistanceMm(a: DrawingMeasurementPoint, b: DrawingMeasurementPoint) {
  return Math.hypot(b.mm.x - a.mm.x, b.mm.y - a.mm.y);
}

export function getMeasurementAngleDeg(a: DrawingMeasurementPoint, b: DrawingMeasurementPoint) {
  const angle = (Math.atan2(b.mm.y - a.mm.y, b.mm.x - a.mm.x) * 180) / Math.PI;
  return (angle + 360) % 360;
}

function addAnchor(
  anchors: DrawingSnapAnchor[],
  seen: Set<string>,
  role: string,
  x: number,
  y: number
) {
  const key = `${role}:${x.toFixed(2)}:${y.toFixed(2)}`;
  if (seen.has(key)) return;
  seen.add(key);
  anchors.push({
    key,
    role,
    point: { x, y },
  });
}

function addRectAnchors(
  anchors: DrawingSnapAnchor[],
  seen: Set<string>,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const x0 = x;
  const x1 = x + width;
  const y0 = y;
  const y1 = y + height;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  addAnchor(anchors, seen, `${role}:corner`, x0, y0);
  addAnchor(anchors, seen, `${role}:corner`, x1, y0);
  addAnchor(anchors, seen, `${role}:corner`, x0, y1);
  addAnchor(anchors, seen, `${role}:corner`, x1, y1);
  addAnchor(anchors, seen, `${role}:mid`, cx, y0);
  addAnchor(anchors, seen, `${role}:mid`, cx, y1);
  addAnchor(anchors, seen, `${role}:mid`, x0, cy);
  addAnchor(anchors, seen, `${role}:mid`, x1, cy);
  addAnchor(anchors, seen, `${role}:center`, cx, cy);
}

function addLineAnchors(
  anchors: DrawingSnapAnchor[],
  seen: Set<string>,
  role: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  addAnchor(anchors, seen, `${role}:end`, x1, y1);
  addAnchor(anchors, seen, `${role}:end`, x2, y2);
  addAnchor(anchors, seen, `${role}:mid`, (x1 + x2) / 2, (y1 + y2) / 2);
}

export function collectDrawingSnapAnchors(model: DrawingModel): DrawingSnapAnchor[] {
  const anchors: DrawingSnapAnchor[] = [];
  const seen = new Set<string>();

  for (const shape of model.geometry.frame) {
    if (shape.kind === "rect") addRectAnchors(anchors, seen, shape.role || "frame", shape.x, shape.y, shape.width, shape.height);
    if (shape.kind === "polygon") {
      for (const point of shape.points) addAnchor(anchors, seen, `${shape.role || "frame"}:point`, point.x, point.y);
    }
    if (shape.kind === "line") addLineAnchors(anchors, seen, shape.role || "frame", shape.x1, shape.y1, shape.x2, shape.y2);
  }

  for (const shape of model.geometry.sash) {
    if (shape.kind === "rect" && shape.role?.includes("glazing_bead")) {
      addRectAnchors(anchors, seen, "bead", shape.x, shape.y, shape.width, shape.height);
    }
    if (shape.kind === "polygon" && shape.role?.includes("glazing_bead")) {
      for (const point of shape.points) addAnchor(anchors, seen, "bead:point", point.x, point.y);
    }
  }

  for (const shape of model.geometry.glass) {
    if (shape.kind === "rect") addRectAnchors(anchors, seen, shape.role || "glass", shape.x, shape.y, shape.width, shape.height);
  }

  for (const shape of model.geometry.junctions) {
    if (shape.kind === "rect") addRectAnchors(anchors, seen, shape.role || "junction", shape.x, shape.y, shape.width, shape.height);
    if (shape.kind === "line") addLineAnchors(anchors, seen, shape.role || "junction", shape.x1, shape.y1, shape.x2, shape.y2);
  }

  const cellBounds = model.interaction.cells;
  if (cellBounds.length > 0) {
    const x0 = Math.min(...cellBounds.map((cell) => cell.x));
    const y0 = Math.min(...cellBounds.map((cell) => cell.y));
    const x1 = Math.max(...cellBounds.map((cell) => cell.x + cell.width));
    const y1 = Math.max(...cellBounds.map((cell) => cell.y + cell.height));
    addRectAnchors(anchors, seen, "clear_opening", x0, y0, x1 - x0, y1 - y0);
  }

  for (const cell of model.interaction.cells) {
    addRectAnchors(anchors, seen, `cell:${cell.key}`, cell.x, cell.y, cell.width, cell.height);
  }

  for (const junction of model.interaction.verticalJunctions) {
    addLineAnchors(anchors, seen, `vertical_junction:${junction.index}`, junction.x, junction.y1, junction.x, junction.y2);
  }
  for (const junction of model.interaction.horizontalJunctions) {
    addLineAnchors(anchors, seen, `horizontal_junction:${junction.index}`, junction.x1, junction.y, junction.x2, junction.y);
  }

  return anchors;
}

export function getNearestSnapAnchorPoint(
  point: DrawingViewportPoint,
  anchors: DrawingSnapAnchor[],
  maxDistance: number
): DrawingViewportPoint | null {
  let nearest: DrawingSnapAnchor | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.point.x - point.x, anchor.point.y - point.y);
    if (distance <= maxDistance && distance < nearestDistance) {
      nearest = anchor;
      nearestDistance = distance;
    }
  }
  return nearest?.point ?? null;
}

export function buildMeasurementAnnotation(id: string, start: DrawingMeasurementPoint, end: DrawingMeasurementPoint): DrawingMeasurementAnnotation {
  return {
    id,
    start,
    end,
    distanceMm: getMeasurementDistanceMm(start, end),
    angleDeg: getMeasurementAngleDeg(start, end),
  };
}
