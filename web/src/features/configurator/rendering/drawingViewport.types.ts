import type React from "react";
import type { DrawingModel } from "./drawingModel";

export type DrawingScalePreset = "auto" | "1:1" | "1:2" | "1:5" | "1:10" | "1:16" | "1:20" | "1:50" | "1:100";

export type DrawingScaleOption = {
  value: DrawingScalePreset;
  label: string;
  ratio: number | null;
};

export type DrawingViewportTool = "select" | "pan" | "measure";

export type DrawingViewportInteractionProps = {
  selectedCellKey?: string;
  onSelectCell?: (cell: { col: number; row: number }) => void;
  onCellContextMenu?: (
    cell: { col: number; row: number; key: string },
    event: React.MouseEvent<SVGRectElement>
  ) => void;
  onRemoveVerticalJunction?: (index: number) => void;
  onRemoveHorizontalJunction?: (index: number) => void;
};

export type DrawingViewportProps = DrawingViewportInteractionProps & {
  model: DrawingModel;
  height?: number | string;
  minHeight?: number;
  maxHeight?: number | string;
  maxWidth?: number | string;
  aspectRatio?: string;
  fitPadding?: number | { x: number; y: number };
  initialScalePreset?: DrawingScalePreset;
  initialTool?: DrawingViewportTool;
  showToolbar?: boolean;
  overlay?: React.ReactNode;
  onViewportStateChange?: (state: DrawingViewportState) => void;
};

export type DrawingViewportState = {
  scalePreset: DrawingScalePreset;
  tool: DrawingViewportTool;
  zoomMultiplier: number;
};

export type DrawingViewportHandle = {
  fitToView: () => void;
  setOneToOne: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  setTool: (tool: DrawingViewportTool) => void;
};

export type DrawingViewportPoint = {
  x: number;
  y: number;
};

export type DrawingViewportPan = {
  x: number;
  y: number;
};

export type DrawingViewportFrameRect = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  width: number;
  height: number;
};

export type DrawingMeasurementPoint = {
  model: DrawingViewportPoint;
  mm: DrawingViewportPoint;
};

export type DrawingSnapAnchor = {
  key: string;
  role: string;
  point: DrawingViewportPoint;
};

export type DrawingMeasurementAnnotation = {
  id: string;
  start: DrawingMeasurementPoint;
  end: DrawingMeasurementPoint;
  distanceMm: number;
  angleDeg: number;
};

export type DrawingMeasurementLabelPlacement = {
  x: number;
  y: number;
};
