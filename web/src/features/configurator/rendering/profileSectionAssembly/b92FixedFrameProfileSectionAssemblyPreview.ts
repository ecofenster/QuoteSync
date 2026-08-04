import type { DrawingDimension, DrawingLabel, DrawingLine, DrawingMarker, DrawingModel, DrawingRect, DrawingShape } from "../drawingModel";
import type { WindowTypeRenderModel, WindowTypeRenderProfileRef } from "../profileResolution/windowTypeRenderContract";

const WIDTH_MM = 2000;
const HEIGHT_MM = 1800;
const STROKE = "#111827";
const FRAME_ROLE = "b92-profile-section-assembly";
const VIEW_BOX_WIDTH = 520;
const VIEW_BOX_HEIGHT = 520;
const VIEW_BOX_PAD = 24;
const DIMENSION_STACK_SPACING = 32;
// Reuse this equal-spacing rule for future vertical split dimensions:
// frame edge -> split dimension == split dimension -> overall dimension.
const VIEW_BOX_DIMENSION_MARGIN = 96;
const WIDTH_DIMENSION_LINE_OFFSET = DIMENSION_STACK_SPACING * 2;
const WIDTH_DIMENSION_TEXT_OFFSET = WIDTH_DIMENSION_LINE_OFFSET + 20;
const WIDTH_DIMENSION_TICK_START_OFFSET = WIDTH_DIMENSION_LINE_OFFSET - 6;
const WIDTH_DIMENSION_TICK_END_OFFSET = WIDTH_DIMENSION_LINE_OFFSET + 6;
const FRAME_FILL = "#f4f4f5";
const GLASS_FILL = "#b9d7f3";

export const B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM = 2000;
export const B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MIN_MM = 200;
export const B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MAX_MM = 1800;

export function clampB92ProfileSectionAssemblySplitLeftMm(value: number): number {
  if (!Number.isFinite(value)) return 1000;
  return Math.min(B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MAX_MM, Math.max(B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MIN_MM, Math.round(value)));
}

type SourceProfileId =
  | "B92-1_HEAD"
  | "B92-2_LEFT_JAMB"
  | "B92-2_RIGHT_JAMB"
  | "B92-3_SILL"
  | "B92-11_CENTRE_MULLION";

type SourceLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

type AssembledProfile = {
  id: SourceProfileId;
  sourcePath: string;
  bounds: Bounds;
  shapes: DrawingLine[];
};

const B92_1_HEAD_LINES: SourceLine[] = [
  { layer: "Medis hatch", x1: 1352.27510594428, y1: 1826.23023861155, x2: 2196.27510594429, y2: 1826.23023861156 },
  { layer: "MATMENYS", x1: 1352.27510594428, y1: 1826.23023861155, x2: 1331.27510594429, y2: 1847.23023861155 },
  { layer: "MATMENYS", x1: 2196.27510594429, y1: 1826.23023861156, x2: 2217.27510594428, y2: 1847.23023861156 },
  { layer: "Medis hatch", x1: 1772.30001760098, y1: 1826.23023861156, x2: 1772.27510594429, y2: 1826.23023861156 },
  { layer: "Medis hatch", x1: 2274.30001760098, y1: 1847.23023861156, x2: 1274.30001760098, y2: 1847.23023861155 },
  { layer: "Medis hatch", x1: 1772.30001760098, y1: 1847.23023861156, x2: 1772.27510594429, y2: 1847.23023861156 },
  { layer: "Medis hatch", x1: 1274.30001760098, y1: 1904.20532695485, x2: 2274.30001760098, y2: 1904.20532695485 },
  { layer: "MATMENYS", x1: 1274.30001760098, y1: 1904.20532695485, x2: 1274.30001760098, y2: 1847.23023861155 },
  { layer: "MATMENYS", x1: 2274.30001760098, y1: 1904.20532695485, x2: 2274.30001760098, y2: 1847.23023861156 },
];

const B92_2_LEFT_JAMB_LINES: SourceLine[] = [
  { layer: "Medis hatch", x1: 1133.50731021446, y1: 1381.82910787965, x2: 1133.50731021446, y2: 2249.32910787963 },
  { layer: "MATMENYS", x1: 1133.50731021446, y1: 1381.82910787965, x2: 1190.48239855777, y2: 1381.82910787965 },
  { layer: "Medis hatch", x1: 1190.48239855777, y1: 1381.82910787965, x2: 1190.48239855777, y2: 2249.32910787963 },
  { layer: "MATMENYS", x1: 1190.48239855777, y1: 1381.82910787965, x2: 1211.48239855777, y2: 1402.82910787965 },
  { layer: "Medis hatch", x1: 1211.48239855777, y1: 2228.32910787964, x2: 1211.48239855777, y2: 1402.82910787965 },
  { layer: "MATMENYS", x1: 1133.50731021446, y1: 2249.32910787963, x2: 1190.48239855777, y2: 2249.32910787963 },
  { layer: "MATMENYS", x1: 1190.48239855777, y1: 2249.32910787963, x2: 1211.48239855777, y2: 2228.32910787964 },
];

const B92_2_RIGHT_JAMB_LINES: SourceLine[] = [
  { layer: "Medis hatch", x1: 1606.61574645709, y1: 1445.19338096411, x2: 1606.61574645709, y2: 2312.69338096422 },
  { layer: "MATMENYS", x1: 1663.59074480038, y1: 1445.19338096411, x2: 1606.61574645709, y2: 1445.19338096411 },
  { layer: "Medis hatch", x1: 1585.56583314358, y1: 1466.19338096411, x2: 1585.56583314358, y2: 2291.69338096423 },
  { layer: "Medis hatch", x1: 1585.61574645709, y1: 1466.19338096411, x2: 1606.61574645709, y2: 1445.19338096411 },
  { layer: "Medis hatch", x1: 1663.59074480038, y1: 2312.69338096422, x2: 1663.59074480038, y2: 1445.19338096411 },
  { layer: "MATMENYS", x1: 1663.59074480038, y1: 2312.69338096422, x2: 1606.56583314358, y2: 2312.69338096422 },
  { layer: "Medis hatch", x1: 1606.56583314358, y1: 2312.69338096422, x2: 1585.56583314358, y2: 2291.69338096423 },
];

const B92_3_SILL_LINES: SourceLine[] = [
  { layer: "Medis hatch", x1: 2427.67737917836, y1: 1873.5780165294, x2: 1427.67737917836, y2: 1873.5780165294 },
  { layer: "Medis hatch", x1: 1427.67737917836, y1: 1945.55310487271, x2: 2427.67737917836, y2: 1945.55310487271 },
  { layer: "MATMENYS", x1: 1427.67737917836, y1: 1945.55310487271, x2: 1427.67737917836, y2: 1873.5780165294 },
  { layer: "MATMENYS", x1: 1484.65246752167, y1: 1945.55310487271, x2: 1505.65246752167, y2: 1966.55310487271 },
  { layer: "MATMENYS", x1: 2427.67737917836, y1: 1945.55310487271, x2: 2427.67737917836, y2: 1873.5780165294 },
  { layer: "MATMENYS", x1: 2370.65246752167, y1: 1945.60301818622, x2: 2349.65246752167, y2: 1966.55310487271 },
  { layer: "Medis hatch", x1: 1505.65246752167, y1: 1966.55310487271, x2: 2349.65246752167, y2: 1966.55310487271 },
];

const B92_11_CENTRE_MULLION_LINES: SourceLine[] = [
  { layer: "Medis hatch", x1: 2098.18680100002, y1: 2274.82698085963, x2: 2098.18680100002, y2: 1388.82698085963 },
  { layer: "Medis hatch", x1: 2062.18680100002, y1: 1388.82698085963, x2: 2062.18680100002, y2: 2274.82698085963 },
  { layer: "Medis hatch", x1: 2062.18680100002, y1: 1388.87689417314, x2: 2062.18680100002, y2: 2274.82698085963 },
  { layer: "Medis hatch", x1: 2041.18680100002, y1: 1409.87689417314, x2: 2041.18680100002, y2: 2253.82698085963 },
  { layer: "Medis hatch", x1: 2098.18680100002, y1: 1388.87689417314, x2: 2098.18680100002, y2: 2274.82698085963 },
  { layer: "Medis hatch", x1: 2119.18680100002, y1: 2253.82698085963, x2: 2119.18680100002, y2: 1409.87689417314 },
  { layer: "MATMENYS", x1: 2041.18680100002, y1: 1409.87689417314, x2: 2062.18680100002, y2: 1388.87689417314 },
  { layer: "MATMENYS", x1: 2062.18680100002, y1: 1388.87689417314, x2: 2098.18680100002, y2: 1388.82698085963 },
  { layer: "MATMENYS", x1: 2098.18680100002, y1: 1388.82698085963, x2: 2119.18680100002, y2: 1409.87689417314 },
  { layer: "MATMENYS", x1: 2041.18680100002, y1: 2253.82698085963, x2: 2062.18680100002, y2: 2274.82698085963 },
  { layer: "MATMENYS", x1: 2062.18680100002, y1: 2274.82698085963, x2: 2098.18680100002, y2: 2274.82698085963 },
  { layer: "MATMENYS", x1: 2098.18680100002, y1: 2274.82698085963, x2: 2119.18680100002, y2: 2253.82698085963 },
];

const SOURCE_PATHS: Record<SourceProfileId, string> = {
  "B92-1_HEAD": "_project/Test/Europa 92 Alu Clad/Frame_sections/B92-1_Internal_Top.dxf",
  "B92-2_LEFT_JAMB": "_project/Test/Europa 92 Alu Clad/Frame_sections/B92-2_Internal_Left.dxf",
  "B92-2_RIGHT_JAMB": "_project/Test/Europa 92 Alu Clad/Frame_sections/B92-2_Internal_Right.dxf",
  "B92-3_SILL": "_project/Test/Europa 92 Alu Clad/Frame_sections/B92-3_Internal_Bottom.dxf",
  "B92-11_CENTRE_MULLION": "_project/Test/Europa 92 Alu Clad/Frame_sections/B92-11_Mullion_Centre.dxf",
};

function line(input: Omit<DrawingLine, "kind">): DrawingLine {
  return {
    kind: "line",
    stroke: input.stroke ?? STROKE,
    strokeWidth: input.strokeWidth ?? 1.4,
    ...input,
  };
}

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return {
    kind: "rect",
    stroke: input.stroke ?? STROKE,
    strokeWidth: input.strokeWidth ?? 1,
    fill: input.fill ?? "none",
    ...input,
  };
}

function getDrawingViewBox(widthMm: number, heightMm: number) {
  const ratio = Math.max(0.1, widthMm / heightMm);
  if (ratio > 1.05) {
    return {
      width: VIEW_BOX_WIDTH,
      height: Math.max(320, Math.min(VIEW_BOX_HEIGHT, Math.round(VIEW_BOX_WIDTH / ratio + VIEW_BOX_DIMENSION_MARGIN * 2))),
    };
  }
  if (ratio < 0.95) {
    return {
      width: Math.max(320, Math.min(VIEW_BOX_WIDTH, Math.round(VIEW_BOX_HEIGHT * ratio + VIEW_BOX_DIMENSION_MARGIN * 2))),
      height: VIEW_BOX_HEIGHT,
    };
  }
  return { width: VIEW_BOX_WIDTH, height: VIEW_BOX_HEIGHT };
}

function getFrameRect(widthMm: number, heightMm: number) {
  const viewBox = getDrawingViewBox(widthMm, heightMm);
  const availableWidth = viewBox.width - VIEW_BOX_PAD - VIEW_BOX_DIMENSION_MARGIN;
  const availableHeight = viewBox.height - VIEW_BOX_PAD - VIEW_BOX_DIMENSION_MARGIN;
  const ratio = Math.max(0.1, widthMm / heightMm);

  let width = availableWidth;
  let height = width / ratio;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * ratio;
  }

  return {
    x: VIEW_BOX_PAD + (availableWidth - width) / 2,
    y: VIEW_BOX_PAD + (availableHeight - height) / 2,
    width,
    height,
    viewBox,
    scale: Math.min(width / widthMm, height / heightMm),
  };
}

function buildDimensionAnnotations(
  frame: { x: number; y: number; width: number; height: number },
  widthMm: number,
  heightMm: number
): DrawingDimension[] {
  return [
    {
      id: "overall-width",
      role: "overall-width",
      axis: "x",
      index: 0,
      valueMm: widthMm,
      editable: false,
      value: String(widthMm),
      line: line({
        x1: frame.x,
        y1: frame.y + frame.height + WIDTH_DIMENSION_LINE_OFFSET,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + WIDTH_DIMENSION_LINE_OFFSET,
        stroke: "#111",
        strokeWidth: 0.9,
      }),
      tickA: line({
        x1: frame.x,
        y1: frame.y + frame.height + WIDTH_DIMENSION_TICK_START_OFFSET,
        x2: frame.x,
        y2: frame.y + frame.height + WIDTH_DIMENSION_TICK_END_OFFSET,
        stroke: "#111",
        strokeWidth: 0.9,
      }),
      tickB: line({
        x1: frame.x + frame.width,
        y1: frame.y + frame.height + WIDTH_DIMENSION_TICK_START_OFFSET,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + WIDTH_DIMENSION_TICK_END_OFFSET,
        stroke: "#111",
        strokeWidth: 0.9,
      }),
      text: {
        x: frame.x + frame.width / 2,
        y: frame.y + frame.height + WIDTH_DIMENSION_TEXT_OFFSET,
        value: String(widthMm),
        fontSize: 12,
        fill: "#111",
        anchor: "middle",
      },
    },
    {
      id: "overall-height",
      role: "overall-height",
      axis: "y",
      index: 0,
      valueMm: heightMm,
      editable: false,
      value: String(heightMm),
      line: line({ x1: frame.x + frame.width + 26, y1: frame.y, x2: frame.x + frame.width + 26, y2: frame.y + frame.height, stroke: "#111", strokeWidth: 0.9 }),
      tickA: line({ x1: frame.x + frame.width + 20, y1: frame.y, x2: frame.x + frame.width + 32, y2: frame.y, stroke: "#111", strokeWidth: 0.9 }),
      tickB: line({ x1: frame.x + frame.width + 20, y1: frame.y + frame.height, x2: frame.x + frame.width + 32, y2: frame.y + frame.height, stroke: "#111", strokeWidth: 0.9 }),
      text: {
        x: frame.x + frame.width + 46,
        y: frame.y + frame.height / 2,
        value: String(heightMm),
        fontSize: 12,
        fill: "#111",
        anchor: "middle",
        rotate: 90,
      },
    },
  ];
}

function transformLineworkToFrame(shapes: DrawingLine[], frame: { x: number; y: number; height: number; scale: number }, heightMm: number): DrawingLine[] {
  return shapes.map((shape) =>
    line({
      x1: frame.x + shape.x1 * frame.scale,
      y1: frame.y + (heightMm - shape.y1) * frame.scale,
      x2: frame.x + shape.x2 * frame.scale,
      y2: frame.y + (heightMm - shape.y2) * frame.scale,
      stroke: "#111",
      strokeWidth: 1,
      dashed: shape.dashed,
      role: shape.role,
    })
  );
}

function profileBoundsToVisualRect(bounds: Bounds, frame: { x: number; y: number; scale: number }, heightMm: number, role: string): DrawingRect {
  return rect({
    x: frame.x + bounds.minX * frame.scale,
    y: frame.y + (heightMm - bounds.maxY) * frame.scale,
    width: bounds.width * frame.scale,
    height: bounds.height * frame.scale,
    stroke: "none",
    strokeWidth: 0,
    fill: FRAME_FILL,
    role,
  });
}

function boundsToVisualRect(bounds: Bounds, frame: { x: number; y: number; scale: number }, heightMm: number, input: Partial<DrawingRect>): DrawingRect {
  return rect({
    x: frame.x + bounds.minX * frame.scale,
    y: frame.y + (heightMm - bounds.maxY) * frame.scale,
    width: bounds.width * frame.scale,
    height: bounds.height * frame.scale,
    ...input,
  });
}

function mmCellToVisualRect(input: { x: number; y: number; width: number; height: number }, frame: { x: number; y: number; scale: number }, heightMm: number) {
  return {
    x: frame.x + input.x * frame.scale,
    y: frame.y + (heightMm - input.y - input.height) * frame.scale,
    width: input.width * frame.scale,
    height: input.height * frame.scale,
  };
}

function insetBounds(bounds: Bounds, insetMm: number): Bounds {
  const minX = bounds.minX + insetMm;
  const minY = bounds.minY + insetMm;
  const maxX = bounds.maxX - insetMm;
  const maxY = bounds.maxY - insetMm;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function boundsOf(shapes: DrawingLine[]): Bounds {
  const xs = shapes.flatMap((shape) => [shape.x1, shape.x2]);
  const ys = shapes.flatMap((shape) => [shape.y1, shape.y2]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function roundBounds(bounds: Bounds): Bounds {
  const round = (value: number) => Number(value.toFixed(3));
  return {
    minX: round(bounds.minX),
    minY: round(bounds.minY),
    maxX: round(bounds.maxX),
    maxY: round(bounds.maxY),
    width: round(bounds.width),
    height: round(bounds.height),
  };
}

function mapFixedMiddle(value: number, sourceMin: number, fixedStart: number, fixedEnd: number, sourceMax: number, targetMin: number, targetMax: number): number {
  const leftFixedLength = fixedStart - sourceMin;
  const rightFixedLength = sourceMax - fixedEnd;
  const targetFixedStart = targetMin + leftFixedLength;
  const targetFixedEnd = targetMax - rightFixedLength;

  if (value <= fixedStart) return targetMin + (value - sourceMin);
  if (value >= fixedEnd) return targetFixedEnd + (value - fixedEnd);

  const sourceMiddleLength = fixedEnd - fixedStart;
  const targetMiddleLength = targetFixedEnd - targetFixedStart;
  return targetFixedStart + ((value - fixedStart) / sourceMiddleLength) * targetMiddleLength;
}

function assembleHorizontalProfile(input: {
  id: SourceProfileId;
  sourceLines: SourceLine[];
  targetWidth?: number;
  sourceMinX: number;
  sourceMaxX: number;
  fixedStartX: number;
  fixedEndX: number;
  sourceReferenceY: number;
  targetReferenceY: number;
  beadInterruption?: { minX: number; maxX: number; sourceY: number };
}): AssembledProfile {
  const yOffset = input.targetReferenceY - input.sourceReferenceY;
  const targetWidth = input.targetWidth ?? WIDTH_MM;
  const shapes = input.sourceLines.flatMap((source) => {
    const x1 = mapFixedMiddle(source.x1, input.sourceMinX, input.fixedStartX, input.fixedEndX, input.sourceMaxX, 0, targetWidth);
    const y1 = source.y1 + yOffset;
    const x2 = mapFixedMiddle(source.x2, input.sourceMinX, input.fixedStartX, input.fixedEndX, input.sourceMaxX, 0, targetWidth);
    const y2 = source.y2 + yOffset;
    const isInterruptedBead =
      !!input.beadInterruption &&
      source.layer === "Medis hatch" &&
      Math.abs(source.y1 - input.beadInterruption.sourceY) < 0.001 &&
      Math.abs(source.y2 - input.beadInterruption.sourceY) < 0.001 &&
      Math.abs(source.x1 - input.fixedStartX) < 0.001 &&
      Math.abs(source.x2 - input.fixedEndX) < 0.001;

    if (!isInterruptedBead || !input.beadInterruption) {
      return [
        line({
          x1,
          y1,
          x2,
          y2,
          role: `${input.id}:${source.layer}`,
        }),
      ];
    }

    return [
      line({
        x1,
        y1,
        x2: input.beadInterruption.minX,
        y2,
        role: `${input.id}:segmented-glazing-bead-left`,
      }),
      line({
        x1: input.beadInterruption.maxX,
        y1,
        x2,
        y2,
        role: `${input.id}:segmented-glazing-bead-right`,
      }),
    ];
  });

  return {
    id: input.id,
    sourcePath: SOURCE_PATHS[input.id],
    bounds: boundsOf(shapes),
    shapes,
  };
}

function assembleVerticalProfile(input: {
  id: SourceProfileId;
  sourceLines: SourceLine[];
  sourceMinX: number;
  sourceMaxX: number;
  targetMinX: number;
  sourceMinY: number;
  sourceMaxY: number;
  fixedStartY: number;
  fixedEndY: number;
  targetMinY: number;
  targetMaxY: number;
}): AssembledProfile {
  const xOffset = input.targetMinX - input.sourceMinX;
  const shapes = input.sourceLines.map((source) =>
    line({
      x1: source.x1 + xOffset,
      y1: mapFixedMiddle(source.y1, input.sourceMinY, input.fixedStartY, input.fixedEndY, input.sourceMaxY, input.targetMinY, input.targetMaxY),
      x2: source.x2 + xOffset,
      y2: mapFixedMiddle(source.y2, input.sourceMinY, input.fixedStartY, input.fixedEndY, input.sourceMaxY, input.targetMinY, input.targetMaxY),
      role: `${input.id}:${source.layer}`,
    })
  );

  return {
    id: input.id,
    sourcePath: SOURCE_PATHS[input.id],
    bounds: boundsOf(shapes),
    shapes,
  };
}

function buildProfiles(): AssembledProfile[] {
  const sillReferenceY = 1945.55310487271 - 1873.5780165294;
  const headReferenceY = HEIGHT_MM - (1904.20532695485 - 1847.23023861155);

  const head = assembleHorizontalProfile({
    id: "B92-1_HEAD",
    sourceLines: B92_1_HEAD_LINES,
    sourceMinX: 1274.30001760098,
    sourceMaxX: 2274.30001760098,
    fixedStartX: 1352.27510594428,
    fixedEndX: 2196.27510594429,
    sourceReferenceY: 1847.23023861155,
    targetReferenceY: headReferenceY,
  });

  const sill = assembleHorizontalProfile({
    id: "B92-3_SILL",
    sourceLines: B92_3_SILL_LINES,
    sourceMinX: 1427.67737917836,
    sourceMaxX: 2427.67737917836,
    fixedStartX: 1505.65246752167,
    fixedEndX: 2349.65246752167,
    sourceReferenceY: 1945.55310487271,
    targetReferenceY: sillReferenceY,
  });

  const leftJamb = assembleVerticalProfile({
    id: "B92-2_LEFT_JAMB",
    sourceLines: B92_2_LEFT_JAMB_LINES,
    sourceMinX: 1133.50731021446,
    sourceMaxX: 1211.48239855777,
    targetMinX: 0,
    sourceMinY: 1381.82910787965,
    sourceMaxY: 2249.32910787963,
    fixedStartY: 1402.82910787965,
    fixedEndY: 2228.32910787964,
    targetMinY: sillReferenceY,
    targetMaxY: headReferenceY,
  });

  const rightJamb = assembleVerticalProfile({
    id: "B92-2_RIGHT_JAMB",
    sourceLines: B92_2_RIGHT_JAMB_LINES,
    sourceMinX: 1585.56583314358,
    sourceMaxX: 1663.59074480038,
    targetMinX: WIDTH_MM - (1663.59074480038 - 1585.56583314358),
    sourceMinY: 1445.19338096411,
    sourceMaxY: 2312.69338096422,
    fixedStartY: 1466.19338096411,
    fixedEndY: 2291.69338096423,
    targetMinY: sillReferenceY,
    targetMaxY: headReferenceY,
  });

  return [head, sill, leftJamb, rightJamb];
}

function buildFixedFixedProfiles(splitLeftMm: number): AssembledProfile[] {
  const targetWidth = B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM;
  const targetHeight = 2000;
  const mullionCentrelineX = clampB92ProfileSectionAssemblySplitLeftMm(splitLeftMm);
  const sillReferenceY = 1945.55310487271 - 1873.5780165294;
  const headReferenceY = targetHeight - (1904.20532695485 - 1847.23023861155);
  const mullionWidth = 2119.18680100002 - 2041.18680100002;
  const mullionMinX = mullionCentrelineX - mullionWidth / 2;
  const beadInterruption = { minX: mullionMinX, maxX: mullionMinX + mullionWidth };

  const head = assembleHorizontalProfile({
    id: "B92-1_HEAD",
    sourceLines: B92_1_HEAD_LINES,
    targetWidth,
    sourceMinX: 1274.30001760098,
    sourceMaxX: 2274.30001760098,
    fixedStartX: 1352.27510594428,
    fixedEndX: 2196.27510594429,
    sourceReferenceY: 1847.23023861155,
    targetReferenceY: headReferenceY,
    beadInterruption: {
      ...beadInterruption,
      sourceY: 1826.23023861155,
    },
  });

  const sill = assembleHorizontalProfile({
    id: "B92-3_SILL",
    sourceLines: B92_3_SILL_LINES,
    targetWidth,
    sourceMinX: 1427.67737917836,
    sourceMaxX: 2427.67737917836,
    fixedStartX: 1505.65246752167,
    fixedEndX: 2349.65246752167,
    sourceReferenceY: 1945.55310487271,
    targetReferenceY: sillReferenceY,
    beadInterruption: {
      ...beadInterruption,
      sourceY: 1966.55310487271,
    },
  });

  const leftJamb = assembleVerticalProfile({
    id: "B92-2_LEFT_JAMB",
    sourceLines: B92_2_LEFT_JAMB_LINES,
    sourceMinX: 1133.50731021446,
    sourceMaxX: 1211.48239855777,
    targetMinX: 0,
    sourceMinY: 1381.82910787965,
    sourceMaxY: 2249.32910787963,
    fixedStartY: 1402.82910787965,
    fixedEndY: 2228.32910787964,
    targetMinY: sillReferenceY,
    targetMaxY: headReferenceY,
  });

  const rightJamb = assembleVerticalProfile({
    id: "B92-2_RIGHT_JAMB",
    sourceLines: B92_2_RIGHT_JAMB_LINES,
    sourceMinX: 1585.56583314358,
    sourceMaxX: 1663.59074480038,
    targetMinX: targetWidth - (1663.59074480038 - 1585.56583314358),
    sourceMinY: 1445.19338096411,
    sourceMaxY: 2312.69338096422,
    fixedStartY: 1466.19338096411,
    fixedEndY: 2291.69338096423,
    targetMinY: sillReferenceY,
    targetMaxY: headReferenceY,
  });

  const centreMullion = assembleVerticalProfile({
    id: "B92-11_CENTRE_MULLION",
    sourceLines: B92_11_CENTRE_MULLION_LINES,
    sourceMinX: 2041.18680100002,
    sourceMaxX: 2119.18680100002,
    targetMinX: mullionMinX,
    sourceMinY: 1388.82698085963,
    sourceMaxY: 2274.82698085963,
    fixedStartY: 1409.87689417314,
    fixedEndY: 2253.82698085963,
    targetMinY: sillReferenceY,
    targetMaxY: headReferenceY,
  });

  return [head, sill, leftJamb, rightJamb, centreMullion];
}

export function canShowB92ProfileSectionAssemblyPreviewToggle(input: {
  categoryLabel: string;
  designId: string;
  view: "internal" | "external";
}): boolean {
  const supportedDesign =
    input.designId === "windows-1-timber-inward-opening" ||
    input.designId === "windows-2-fixed-fixed-static";

  return (
    input.categoryLabel === "Windows" &&
    supportedDesign &&
    input.view === "internal"
  );
}

export function shouldRenderB92ProfileSectionAssemblyPreview(input: {
  categoryLabel: string;
  designId: string;
  view: "internal" | "external";
  toggleEnabled: boolean;
}): boolean {
  return input.toggleEnabled && canShowB92ProfileSectionAssemblyPreviewToggle(input);
}

export function getB92ProfileSectionAssemblyPreviewTitle(designId: string): string {
  if (designId === "windows-2-fixed-fixed-static") {
    return "B92 Profile-Section Assembly Proof — Fixed/Fixed B92-11 Centred";
  }
  return "B92 Profile-Section Assembly Proof — 1 Field Fixed";
}

function buildVisualWrappedProfileSectionDrawingModel(input: {
  widthMm: number;
  heightMm: number;
  profiles: AssembledProfile[];
  operationType: string;
  sectionReferences: string[];
  labels: Array<{ value: string; bounds: Bounds }>;
  markers: Array<{ value: string; bounds: Bounds }>;
  cells: Array<{ key: string; bounds: Bounds }>;
  verticalJunctions?: Array<{ index: number; xMm: number; y1Mm: number; y2Mm: number }>;
  layerHints: string[];
  devReports: Record<string, unknown>;
}): DrawingModel {
  const frame = getFrameRect(input.widthMm, input.heightMm);
  const profileBounds = Object.fromEntries(
    input.profiles.map((profile) => [profile.id, roundBounds(profile.bounds)])
  ) as Record<SourceProfileId, Bounds>;
  const allMmLinework = input.profiles.flatMap((profile) => profile.shapes);
  const overallBounds = boundsOf(allMmLinework);
  const lineworkByProfile = new Map(
    input.profiles.map((profile) => [profile.id, transformLineworkToFrame(profile.shapes, frame, input.heightMm)])
  );
  const head = profileBounds["B92-1_HEAD"];
  const sill = profileBounds["B92-3_SILL"];
  const left = profileBounds["B92-2_LEFT_JAMB"];
  const right = profileBounds["B92-2_RIGHT_JAMB"];
  const frameUnderlayShapes: DrawingShape[] = [
    profileBoundsToVisualRect(head, frame, input.heightMm, "frame_top"),
    profileBoundsToVisualRect(sill, frame, input.heightMm, "frame_bottom"),
    profileBoundsToVisualRect(left, frame, input.heightMm, "frame_left"),
    profileBoundsToVisualRect(right, frame, input.heightMm, "frame_right"),
  ];
  const centreMullion = profileBounds["B92-11_CENTRE_MULLION"];
  const junctionUnderlayShapes: DrawingShape[] = centreMullion
    ? [profileBoundsToVisualRect(centreMullion, frame, input.heightMm, "b92_11_centre_mullion")]
    : [];
  const frameLinework = [
    ...(lineworkByProfile.get("B92-1_HEAD") ?? []),
    ...(lineworkByProfile.get("B92-3_SILL") ?? []),
    ...(lineworkByProfile.get("B92-2_LEFT_JAMB") ?? []),
    ...(lineworkByProfile.get("B92-2_RIGHT_JAMB") ?? []),
  ];
  const junctionLinework = lineworkByProfile.get("B92-11_CENTRE_MULLION") ?? [];

  const glassShapes = input.labels.map((label, index) =>
    boundsToVisualRect(insetBounds(label.bounds, 4), frame, input.heightMm, {
      stroke: "none",
      strokeWidth: 0,
      fill: GLASS_FILL,
      role: `b92_profile_section_visible_glass_${index + 1}`,
    })
  );
  const labels: DrawingLabel[] = input.labels.map((label) => {
    const visual = mmCellToVisualRect(
      { x: label.bounds.minX, y: label.bounds.minY, width: label.bounds.width, height: label.bounds.height },
      frame,
      input.heightMm
    );
    return {
      x: visual.x + 8,
      y: visual.y + 16,
      value: label.value,
      fontSize: 9,
      fill: "#3f3f46",
      anchor: "start",
      role: "field_label",
    };
  });
  const markers: DrawingMarker[] = input.markers.map((marker) => {
    const visual = mmCellToVisualRect(
      { x: marker.bounds.minX, y: marker.bounds.minY, width: marker.bounds.width, height: marker.bounds.height },
      frame,
      input.heightMm
    );
    return {
      x: visual.x + visual.width / 2,
      y: visual.y + visual.height / 2,
      radius: 16,
      value: marker.value,
      role: "field_marker",
    };
  });

  return {
    width: input.widthMm,
    height: input.heightMm,
    viewBox: frame.viewBox,
    elements: [
      { id: "frame", role: "frame", shapes: [...frameUnderlayShapes, ...frameLinework] },
      { id: "junctions", role: "junctions", shapes: [...junctionUnderlayShapes, ...junctionLinework] },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: glassShapes },
    ],
    geometry: {
      frame: [...frameUnderlayShapes, ...frameLinework],
      sash: [],
      glass: glassShapes,
      junctions: [...junctionUnderlayShapes, ...junctionLinework],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(frame, input.widthMm, input.heightMm),
      labels,
      handles: [],
      markers,
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: input.operationType,
      sectionReferences: input.sectionReferences,
      referenceInputs: input.profiles.map((profile) => ({
        drawingId: profile.id,
        title: profile.id,
        purpose: "Profile-section source linework assembled in millimetres, then projected into normal QuoteSync DrawingModel preview coordinates.",
        sourceDxfPath: profile.sourcePath,
        sourceSvgPath: null,
      })),
      renderSource: "native_drawing_model",
      layerHints: input.layerHints,
      devReports: {
        ...input.devReports,
        profileSectionAssemblyVisualWrapper: {
          viewBox: frame.viewBox,
          frameRect: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
          scale: frame.scale,
          overallBoundsMm: roundBounds(overallBounds),
          profileBoundsMm: profileBounds,
          usesExistingDrawingViewportSvgPipeline: true,
        },
      },
    },
    interaction: {
      cells: input.cells.map((cell) => ({
        key: cell.key,
        ...mmCellToVisualRect(
          { x: cell.bounds.minX, y: cell.bounds.minY, width: cell.bounds.width, height: cell.bounds.height },
          frame,
          input.heightMm
        ),
      })),
      verticalJunctions: (input.verticalJunctions ?? []).map((junction) => ({
        index: junction.index,
        x: frame.x + junction.xMm * frame.scale,
        y1: frame.y + (input.heightMm - junction.y1Mm) * frame.scale,
        y2: frame.y + (input.heightMm - junction.y2Mm) * frame.scale,
      })),
      horizontalJunctions: [],
    },
  };
}

export function buildB92FixedFrameProfileSectionAssemblyDrawingModel(): DrawingModel {
  const profiles = buildProfiles();
  const overallBounds = boundsOf(profiles.flatMap((profile) => profile.shapes));

  const profileBounds = Object.fromEntries(
    profiles.map((profile) => [profile.id, roundBounds(profile.bounds)])
  ) as Record<SourceProfileId, Bounds>;

  const glassBounds: Bounds = {
    minX: profileBounds["B92-2_LEFT_JAMB"].maxX,
    minY: profileBounds["B92-3_SILL"].maxY,
    maxX: profileBounds["B92-2_RIGHT_JAMB"].minX,
    maxY: profileBounds["B92-1_HEAD"].minY,
    width: profileBounds["B92-2_RIGHT_JAMB"].minX - profileBounds["B92-2_LEFT_JAMB"].maxX,
    height: profileBounds["B92-1_HEAD"].minY - profileBounds["B92-3_SILL"].maxY,
  };

  return buildVisualWrappedProfileSectionDrawingModel({
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    profiles,
    operationType: "fixed",
    sectionReferences: ["B92-1", "B92-2", "B92-3"],
    labels: [{ value: "Fixed", bounds: glassBounds }],
    markers: [{ value: "1", bounds: glassBounds }],
    cells: [{ key: "0,0", bounds: glassBounds }],
    layerHints: ["frame", "junctions", "sash", "glass", "dimensions", "annotations", "profile-section-assembly"],
    devReports: {
      profileSectionAssembly: {
        guard: "local Admin preview toggle",
        requestedSizeMm: { width: WIDTH_MM, height: HEIGHT_MM },
        overallBounds: roundBounds(overallBounds),
        profileBounds,
        assemblyRules: {
          headAndSillFullWidth: true,
          jambsButtBetweenHeadAndSillReferenceEdges: true,
          noTwentyOneMmCornerGap: true,
          fixedEndZonesRigid: true,
          straightMiddleRunsOnlyResize: true,
          wholeProfileScaling: false,
          dxfParsedInBrowser: false,
        },
        mitreCheck: {
          expectedGlazingBeadMitresDegrees: 45,
          preservedBy: "45-degree diagonal endpoints are inside rigid fixed end/corner zones; only horizontal/vertical straight middle runs are resized.",
        },
      },
    },
  });
}

export function buildB92ProfileSectionAssemblyPreviewDrawingModel(
  designId: string,
  splitLeftMm = 1000
): DrawingModel {
  if (designId !== "windows-2-fixed-fixed-static") {
    return buildB92FixedFrameProfileSectionAssemblyDrawingModel();
  }

  const widthMm = B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM;
  const heightMm = 2000;
  const mullionCentrelineX = clampB92ProfileSectionAssemblySplitLeftMm(splitLeftMm);
  const profiles = buildFixedFixedProfiles(mullionCentrelineX);
  const overallBounds = boundsOf(profiles.flatMap((profile) => profile.shapes));
  const profileBounds = Object.fromEntries(
    profiles.map((profile) => [profile.id, roundBounds(profile.bounds)])
  ) as Record<SourceProfileId, Bounds>;

  const leftGlassBounds: Bounds = {
    minX: profileBounds["B92-2_LEFT_JAMB"].maxX,
    minY: profileBounds["B92-3_SILL"].maxY,
    maxX: profileBounds["B92-11_CENTRE_MULLION"].minX,
    maxY: profileBounds["B92-1_HEAD"].minY,
    width: profileBounds["B92-11_CENTRE_MULLION"].minX - profileBounds["B92-2_LEFT_JAMB"].maxX,
    height: profileBounds["B92-1_HEAD"].minY - profileBounds["B92-3_SILL"].maxY,
  };
  const rightGlassBounds: Bounds = {
    minX: profileBounds["B92-11_CENTRE_MULLION"].maxX,
    minY: profileBounds["B92-3_SILL"].maxY,
    maxX: profileBounds["B92-2_RIGHT_JAMB"].minX,
    maxY: profileBounds["B92-1_HEAD"].minY,
    width: profileBounds["B92-2_RIGHT_JAMB"].minX - profileBounds["B92-11_CENTRE_MULLION"].maxX,
    height: profileBounds["B92-1_HEAD"].minY - profileBounds["B92-3_SILL"].maxY,
  };

  return buildVisualWrappedProfileSectionDrawingModel({
    widthMm,
    heightMm,
    profiles,
    operationType: "fixed",
    sectionReferences: ["B92-1", "B92-2", "B92-3", "B92-11"],
    labels: [
      { value: "Fixed", bounds: leftGlassBounds },
      { value: "Fixed", bounds: rightGlassBounds },
    ],
    markers: [
      { value: "1", bounds: leftGlassBounds },
      { value: "2", bounds: rightGlassBounds },
    ],
    cells: [
      { key: "0,0", bounds: leftGlassBounds },
      { key: "1,0", bounds: rightGlassBounds },
    ],
    verticalJunctions: [{ index: 1, xMm: mullionCentrelineX, y1Mm: profileBounds["B92-11_CENTRE_MULLION"].minY, y2Mm: profileBounds["B92-11_CENTRE_MULLION"].maxY }],
    layerHints: ["frame", "junctions", "sash", "glass", "dimensions", "annotations", "profile-section-assembly", "bead-segmented-at-b92-11"],
    devReports: {
      profileSectionAssembly: {
        guard: "local Admin preview toggle",
        requestedSizeMm: { width: widthMm, height: heightMm },
        intendedSplitMm: { left: mullionCentrelineX, right: widthMm - mullionCentrelineX },
        b92_11: {
          centrelineX: mullionCentrelineX,
          sourceBounds: { minX: 2041.187, minY: 1388.827, maxX: 2119.187, maxY: 2274.827, width: 78, height: 886 },
          finalBounds: profileBounds["B92-11_CENTRE_MULLION"],
          placementReference: `source bounding centreline placed at X=${mullionCentrelineX}; vertical profile butts between sill/head reference edges`,
        },
        overallBounds: roundBounds(overallBounds),
        profileBounds,
        assemblyRules: {
          headAndSillFrameBodyContinuous: true,
          beadSegmentedAtB92_11: true,
          artificialFrameSplitLine: false,
          noTwentyOneMmCornerGap: true,
          fixedEndZonesRigid: true,
          straightMiddleRunsOnlyResize: true,
          wholeProfileScaling: false,
          dxfParsedInBrowser: false,
        },
        beadClassification: {
          headSegmentedLine: "B92-1 Medis hatch line at source Y=1826.23023861155",
          sillSegmentedLine: "B92-3 Medis hatch line at source Y=1966.55310487271",
          frameBodyLines: "All other B92-1/B92-3 lines remain continuous; no visible vertical cut line is added.",
        },
        mitreCheck: {
          expectedGlazingBeadMitresDegrees: 45,
          preservedBy: "Mitre endpoints are inside rigid fixed end/corner zones; B92-11 interruption splits only straight bead runs.",
        },
      },
    },
  });
}

const resolved = (profileId: NonNullable<WindowTypeRenderProfileRef["profileId"]>): WindowTypeRenderProfileRef => ({
  profileId,
  source: "resolved",
});

export function buildB92ProfileSectionAssemblyPreviewMeasurementContract(
  designId: string,
  splitLeftMm = 1000
): WindowTypeRenderModel {
  const isFixedFixed = designId === "windows-2-fixed-fixed-static";
  const widthMm = B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM;
  const heightMm = isFixedFixed ? 2000 : 1800;
  const leftFieldWidth = isFixedFixed ? clampB92ProfileSectionAssemblySplitLeftMm(splitLeftMm) : widthMm;
  const rightFieldWidth = isFixedFixed ? widthMm - leftFieldWidth : 0;
  const baseField = (id: string, column: number, width: number) => ({
    id,
    row: 0,
    column,
    type: "fixed" as const,
    operation: "fixed",
    dimensionsMm: { width, height: heightMm },
    perimeter: {
      top: resolved("B92-1"),
      bottom: resolved("B92-3"),
      left: resolved("B92-2"),
      right: resolved("B92-2"),
    },
    glass: {
      widthMm: Math.max(1, width - 156),
      heightMm: Math.max(1, heightMm - 171),
      source: "resolved" as const,
      note: "Profile-section assembly proof measurement metadata.",
    },
    constraints: [],
  });

  return {
    meta: {
      system: "B92",
      referenceView: "external",
      validationMode: "external_refs_internal_validation",
      source: "resolver_contract",
      designRule: "Local Admin profile-section assembly proof measurement contract.",
      notes: ["Dev-only measurement metadata for profile-section assembly DrawingModel preview."],
    },
    overall: { widthMm, heightMm },
    fields: isFixedFixed ? [baseField("0,0", 0, leftFieldWidth), baseField("1,0", 1, rightFieldWidth)] : [baseField("0,0", 0, widthMm)],
    verticalJunctions: isFixedFixed
      ? [
          {
            id: "b92-11-centre",
            axis: "vertical",
            condition: "fixed_to_fixed",
            betweenFieldIds: ["0,0", "1,0"],
            profile: resolved("B92-11"),
            constraints: [],
          },
        ]
      : [],
    horizontalJunctions: [],
    outerEdgeSegments: [],
    sillSegments: isFixedFixed
      ? [
          { column: 0, segmentIndex: 0, fieldId: "0,0", profile: { profileId: "B92-3" } },
          { column: 1, segmentIndex: 1, fieldId: "1,0", profile: { profileId: "B92-3" } },
        ]
      : [{ column: 0, segmentIndex: 0, fieldId: "0,0", profile: { profileId: "B92-3" } }],
    couplings: [],
    corners: [],
    thresholds: [],
    constraints: [],
  };
}
