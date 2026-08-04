import type { DrawingDimension, DrawingLabel, DrawingMarker, DrawingModel, DrawingRect, DrawingShape } from "../drawingModel";
import { buildFixedInternalFieldRectangleLayer } from "../buildFixedInternalRectanglePilot";
import { buildProfilePilotAnnotations } from "./profilePilotAnnotations";
import type { ProfileResolutionResult } from "./profileTypes";

type Input = {
  widthMm: number;
  heightMm: number;
  frameFill: string;
  frameRal?: string | null;
  structuralColWidthsMm: number[];
  resolution: ProfileResolutionResult;
  hasAstragalBars: boolean;
  astragalCols: number;
  astragalRows: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
      line: {
        kind: "line",
        x1: frame.x,
        y1: frame.y + frame.height + 26,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + 26,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line",
        x1: frame.x,
        y1: frame.y + frame.height + 20,
        x2: frame.x,
        y2: frame.y + frame.height + 32,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line",
        x1: frame.x + frame.width,
        y1: frame.y + frame.height + 20,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + 32,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      text: {
        x: frame.x + frame.width / 2,
        y: frame.y + frame.height + 46,
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
      line: {
        kind: "line",
        x1: frame.x + frame.width + 26,
        y1: frame.y,
        x2: frame.x + frame.width + 26,
        y2: frame.y + frame.height,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line",
        x1: frame.x + frame.width + 20,
        y1: frame.y,
        x2: frame.x + frame.width + 32,
        y2: frame.y,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line",
        x1: frame.x + frame.width + 20,
        y1: frame.y + frame.height,
        x2: frame.x + frame.width + 32,
        y2: frame.y + frame.height,
        stroke: "#111",
        strokeWidth: 0.9,
      },
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

function buildStructuralSplitDimensions(input: {
  frame: { x: number; y: number; width: number; height: number };
  columnBounds: Array<{ start: number; end: number }>;
  columnWidthsMm: number[];
}) {
  const { frame, columnBounds, columnWidthsMm } = input;
  return columnBounds.map((bounds, index) => {
    const y = frame.y + frame.height + 58;
    return {
      id: `structural-col-width-${index}`,
      role: "structural-col-width",
      axis: "x" as const,
      index,
      valueMm: columnWidthsMm[index],
      editable: true,
      value: String(columnWidthsMm[index]),
      line: {
        kind: "line" as const,
        x1: bounds.start,
        y1: y,
        x2: bounds.end,
        y2: y,
        stroke: "#2563eb",
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line" as const,
        x1: bounds.start,
        y1: y - 6,
        x2: bounds.start,
        y2: y + 6,
        stroke: "#2563eb",
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line" as const,
        x1: bounds.end,
        y1: y - 6,
        x2: bounds.end,
        y2: y + 6,
        stroke: "#2563eb",
        strokeWidth: 0.9,
      },
      text: {
        x: (bounds.start + bounds.end) / 2,
        y: y + 16,
        value: String(columnWidthsMm[index]),
        fontSize: 10,
        fill: "#1d4ed8",
        anchor: "middle" as const,
      },
    };
  });
}

function buildDivisionCentreAnnotation(input: {
  frame: { x: number; y: number; width: number; height: number };
  centrelineX: number;
  splitMm: number;
}): DrawingDimension {
  const y = input.frame.y + input.frame.height + 82;
  return {
    id: "structural-division-centre-0",
    role: "structural-division-centre",
    axis: "x",
    index: 0,
    valueMm: input.splitMm,
    editable: false,
    value: String(input.splitMm),
    line: {
      kind: "line",
      x1: input.frame.x,
      y1: y,
      x2: input.centrelineX,
      y2: y,
      stroke: "#7c3aed",
      strokeWidth: 1,
    },
    tickA: {
      kind: "line",
      x1: input.frame.x,
      y1: y - 6,
      x2: input.frame.x,
      y2: y + 6,
      stroke: "#7c3aed",
      strokeWidth: 1,
    },
    tickB: {
      kind: "line",
      x1: input.centrelineX,
      y1: y - 6,
      x2: input.centrelineX,
      y2: y + 6,
      stroke: "#7c3aed",
      strokeWidth: 1,
    },
    text: {
      x: input.frame.x + (input.centrelineX - input.frame.x) / 2,
      y: y + 16,
      value: String(input.splitMm),
      fontSize: 10,
      fill: "#6d28d9",
      anchor: "middle",
    },
  };
}

function addReferenceLabels(labels: DrawingLabel[], input: {
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
  leftFieldBounds: { x0: number; x1: number; y0: number; y1: number };
  rightFieldBounds: { x0: number; x1: number; y0: number; y1: number };
  mullionBounds: { x0: number; x1: number; y0: number; y1: number };
}) {
  labels.push(
    {
      x: input.frameX + input.frameWidth / 2,
      y: input.frameY + 18,
      value: "B92-1 head 57/21=78",
      fontSize: 9,
      fill: "#111827",
      anchor: "middle",
      role: "profile_ref_head",
    },
    {
      x: input.leftFieldBounds.x0 - 24,
      y: (input.leftFieldBounds.y0 + input.leftFieldBounds.y1) / 2,
      value: "B92-2",
      fontSize: 9,
      fill: "#111827",
      anchor: "middle",
      rotate: -90,
      role: "profile_ref_jamb_left",
    },
    {
      x: input.rightFieldBounds.x1 + 24,
      y: (input.rightFieldBounds.y0 + input.rightFieldBounds.y1) / 2,
      value: "B92-2 mirrored",
      fontSize: 9,
      fill: "#111827",
      anchor: "middle",
      rotate: 90,
      role: "profile_ref_jamb_right",
    },
    {
      x: input.frameX + input.frameWidth / 2,
      y: input.frameY + input.frameHeight - 8,
      value: "B92-3 sill",
      fontSize: 9,
      fill: "#111827",
      anchor: "middle",
      role: "profile_ref_sill",
    },
    {
      x: (input.mullionBounds.x0 + input.mullionBounds.x1) / 2,
      y: input.mullionBounds.y0 + 18,
      value: "Solid Sash Bar / B92-14 21/36/21",
      fontSize: 9,
      fill: "#111827",
      anchor: "middle",
      role: "profile_ref_mullion",
    }
  );
}

export function buildFixedFixedB9214ProfilePilot(input: Input): DrawingModel {
  const widthMm = clamp(Math.round(input.widthMm || 0), 300, 6000);
  const heightMm = clamp(Math.round(input.heightMm || 0), 300, 6000);
  const viewBoxWidth = 520;
  const viewBoxHeight = 520;
  const pad = 56;
  const availableWidth = viewBoxWidth - pad * 2;
  const availableHeight = viewBoxHeight - pad * 2;
  const ratio = Math.max(0.1, widthMm / Math.max(1, heightMm));

  let frameWidth = availableWidth;
  let frameHeight = frameWidth / ratio;
  if (frameHeight > availableHeight) {
    frameHeight = availableHeight;
    frameWidth = frameHeight * ratio;
  }

  const frameX = pad + (availableWidth - frameWidth) / 2;
  const frameY = pad + (availableHeight - frameHeight) / 2;
  const scale = Math.min(frameWidth / widthMm, frameHeight / heightMm);

  const headMm = 78;
  const leftJambMm = 78;
  const rightJambMm = 78;
  const bottomMm = 93;
  const mullionTotalMm = 78;
  const mullionOuterFaceMm = 21;
  const mullionCoreMm = 36;

  const headPx = headMm * scale;
  const leftJambPx = leftJambMm * scale;
  const rightJambPx = rightJambMm * scale;
  const bottomPx = bottomMm * scale;
  const mullionTotalPx = mullionTotalMm * scale;
  const mullionFacePx = mullionOuterFaceMm * scale;
  const mullionCorePx = mullionCoreMm * scale;

  const structuralLeftMmRaw = input.structuralColWidthsMm[0] ?? Math.round(widthMm / 2);
  const structuralTotalMm = Math.max(1, input.structuralColWidthsMm.reduce((sum, value) => sum + Math.max(1, value), 0));
  const structuralSplitMm =
    input.structuralColWidthsMm.length === 2
      ? Math.round((structuralLeftMmRaw / structuralTotalMm) * widthMm)
      : Math.round(widthMm / 2);
  const splitRatio = structuralSplitMm / widthMm;
  const centrelineX = frameX + frameWidth * splitRatio;
  const mullionX0 = centrelineX - mullionTotalPx / 2;
  const mullionX1 = centrelineX + mullionTotalPx / 2;
  const openingY0 = frameY + headPx;
  const openingY1 = frameY + frameHeight - bottomPx;

  const leftFieldBounds = {
    key: "0,0",
    x0: frameX + leftJambPx,
    x1: mullionX0,
    y0: openingY0,
    y1: openingY1,
  };
  const rightFieldBounds = {
    key: "1,0",
    x0: mullionX1,
    x1: frameX + frameWidth - rightJambPx,
    y0: openingY0,
    y1: openingY1,
  };

  const frameShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: headPx,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "profile_pilot_frame_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: openingY1,
      width: frameWidth,
      height: bottomPx,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "profile_pilot_frame_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: openingY0,
      width: leftJambPx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "profile_pilot_frame_left_jamb",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX + frameWidth - rightJambPx,
      y: openingY0,
      width: rightJambPx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "profile_pilot_frame_right_jamb",
    } satisfies DrawingRect,
    {
      kind: "line",
      x1: frameX,
      y1: frameY + 57 * scale,
      x2: frameX + frameWidth,
      y2: frameY + 57 * scale,
      stroke: "#334155",
      strokeWidth: 0.9,
      role: "profile_pilot_head_break",
    },
    {
      kind: "line",
      x1: frameX + 57 * scale,
      y1: openingY0,
      x2: frameX + 57 * scale,
      y2: openingY1,
      stroke: "#334155",
      strokeWidth: 0.9,
      role: "profile_pilot_left_jamb_break",
    },
    {
      kind: "line",
      x1: frameX + frameWidth - 21 * scale,
      y1: openingY0,
      x2: frameX + frameWidth - 21 * scale,
      y2: openingY1,
      stroke: "#334155",
      strokeWidth: 0.9,
      role: "profile_pilot_right_jamb_break",
    },
    {
      kind: "line",
      x1: frameX,
      y1: openingY1 + 72 * scale,
      x2: frameX + frameWidth,
      y2: openingY1 + 72 * scale,
      stroke: "#334155",
      strokeWidth: 0.9,
      role: "profile_pilot_sill_break",
    },
  ];

  const junctionShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: mullionX0,
      y: openingY0,
      width: mullionFacePx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "profile_pilot_mullion_face_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: mullionX0 + mullionFacePx,
      y: openingY0,
      width: mullionCorePx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: "#d4d4d8",
      role: "profile_pilot_mullion_core",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: mullionX0 + mullionFacePx + mullionCorePx,
      y: openingY0,
      width: mullionFacePx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "profile_pilot_mullion_face_right",
    } satisfies DrawingRect,
  ];

  const leftFieldLayer = buildFixedInternalFieldRectangleLayer({
    fieldKey: "0,0",
    fieldBoundsPx: leftFieldBounds,
    scale,
    frameFill: input.frameFill,
    frameRal: input.frameRal ?? null,
    rebateMode: "both",
    hasAstragalBars: input.hasAstragalBars,
    astragalCols: input.astragalCols,
    astragalRows: input.astragalRows,
  });
  const rightFieldLayer = buildFixedInternalFieldRectangleLayer({
    fieldKey: "1,0",
    fieldBoundsPx: rightFieldBounds,
    scale,
    frameFill: input.frameFill,
    frameRal: input.frameRal ?? null,
    rebateMode: "both",
    hasAstragalBars: input.hasAstragalBars,
    astragalCols: input.astragalCols,
    astragalRows: input.astragalRows,
  });

  const glassShapes = [...leftFieldLayer.glassShapes, ...rightFieldLayer.glassShapes];
  const labels: DrawingLabel[] = [];
  const markers: DrawingMarker[] = [];
  addReferenceLabels(labels, {
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    leftFieldBounds,
    rightFieldBounds,
    mullionBounds: { x0: mullionX0, x1: mullionX1, y0: openingY0, y1: openingY1 },
  });

  const pilotAnnotations = buildProfilePilotAnnotations({
    resolution: input.resolution,
    fieldBounds: [leftFieldBounds, rightFieldBounds],
    verticalConnectionBounds: [
      {
        key: "vertical-1-row-0",
        x: centrelineX,
        y: (openingY0 + openingY1) / 2,
      },
    ],
    horizontalConnectionBounds: [],
    hasInternalAstragals: input.hasAstragalBars,
    astragalCols: input.astragalCols,
    astragalRows: input.astragalRows,
  });
  labels.push(...pilotAnnotations.labels);
  markers.push(...pilotAnnotations.markers);

  const columnBounds = [
    { start: frameX, end: centrelineX },
    { start: centrelineX, end: frameX + frameWidth },
  ];
  const dimensions = buildDimensionAnnotations(
    { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
    widthMm,
    heightMm
  );
  dimensions.push(
    ...buildStructuralSplitDimensions({
      frame: { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
      columnBounds,
      columnWidthsMm: [structuralSplitMm, widthMm - structuralSplitMm],
    })
  );
  dimensions.push(
    buildDivisionCentreAnnotation({
      frame: { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
      centrelineX,
      splitMm: structuralSplitMm,
    })
  );

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: glassShapes },
      { id: "junctions", role: "junctions", shapes: junctionShapes },
    ],
    geometry: {
      frame: frameShapes,
      sash: [],
      glass: glassShapes,
      junctions: junctionShapes,
    },
    annotations: {
      dimensions,
      labels,
      handles: [],
      markers,
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: "fixed",
      sectionReferences: Array.from(new Set(input.resolution.sectionReferences)),
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "glass", "junctions", "dimensions", "annotations"],
    },
    interaction: {
      cells: [
        { key: "0,0", x: leftFieldBounds.x0, y: leftFieldBounds.y0, width: Math.max(1, leftFieldBounds.x1 - leftFieldBounds.x0), height: Math.max(1, leftFieldBounds.y1 - leftFieldBounds.y0) },
        { key: "1,0", x: rightFieldBounds.x0, y: rightFieldBounds.y0, width: Math.max(1, rightFieldBounds.x1 - rightFieldBounds.x0), height: Math.max(1, rightFieldBounds.y1 - rightFieldBounds.y0) },
      ],
      verticalJunctions: [{ index: 1, x: centrelineX, y1: openingY0, y2: openingY1 }],
      horizontalJunctions: [],
    },
  };
}
