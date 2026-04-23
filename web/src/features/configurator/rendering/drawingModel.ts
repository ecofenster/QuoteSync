export type DrawingLine = {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  role?: string;
};

export type DrawingRect = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  role?: string;
};

export type DrawingPolygon = {
  kind: "polygon";
  points: Array<{ x: number; y: number }>;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  role?: string;
};

export type DrawingText = {
  x: number;
  y: number;
  value: string;
  fontSize?: number;
  fontWeight?: number;
  fill?: string;
  rotate?: number;
  anchor?: "start" | "middle" | "end";
};

export type DrawingDimension = {
  axis: "horizontal" | "vertical";
  value: string;
  line: DrawingLine;
  tickA: DrawingLine;
  tickB: DrawingLine;
  text: DrawingText;
};

export type DrawingLabel = DrawingText & { role?: string };
export type DrawingHandle = { x: number; y: number; size: number; role?: string };
export type DrawingMarker = { x: number; y: number; radius: number; value: string; role?: string };

export type DrawingShape = DrawingLine | DrawingRect | DrawingPolygon;

export type DrawingModel = {
  width: number;
  height: number;
  viewBox: { width: number; height: number };
  elements: Array<{ id: string; role: string; shapes: DrawingShape[] }>;
  geometry: {
    frame: DrawingShape[];
    sash: DrawingShape[];
    glass: DrawingShape[];
    junctions: DrawingShape[];
  };
  annotations: {
    dimensions: DrawingDimension[];
    labels: DrawingLabel[];
    handles: DrawingHandle[];
    markers: DrawingMarker[];
  };
  metadata: {
    systemType: string;
    openingDirection: "inward" | "outward";
    operationType: string;
    sectionReferences: string[];
    referenceInputs: Array<{
      drawingId: string;
      title: string;
      purpose: string;
      sourceDxfPath: string | null;
      sourceSvgPath: string | null;
    }>;
    renderSource: "native_drawing_model";
    layerHints: string[];
  };
  interaction: {
    cells: Array<{ key: string; x: number; y: number; width: number; height: number }>;
    verticalJunctions: Array<{ index: number; x: number; y1: number; y2: number }>;
    horizontalJunctions: Array<{ index: number; y: number; x1: number; x2: number }>;
  };
};
