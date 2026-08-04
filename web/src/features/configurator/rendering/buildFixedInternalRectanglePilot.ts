import type {
  DrawingDimension,
  DrawingModel,
  DrawingPolygon,
  DrawingRect,
  DrawingShape,
} from "./drawingModel";

type Input = {
  widthMm: number;
  heightMm: number;
  frameFill: string;
  claddingFill?: string | null;
  frameRal?: string | null;
  claddingRal?: string | null;
  hasAstragalBars?: boolean | null;
  astragalCols?: number | null;
  astragalRows?: number | null;
  rebateMode?: "internal" | "external" | "both" | "none" | null;
};

type FieldLayerInput = {
  fieldKey: string;
  fieldBoundsPx: { x0: number; x1: number; y0: number; y1: number };
  scale: number;
  frameFill: string;
  frameRal?: string | null;
  rebateMode?: "internal" | "external" | "both" | "none" | null;
  hasAstragalBars?: boolean | null;
  astragalCols?: number | null;
  astragalRows?: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function resolvePilotStrokeColourFromRal(ral: string | null | undefined) {
  const normalized = String(ral || "").trim().toUpperCase();
  const ralNumber = normalized.match(/\b(\d{4})\b/)?.[1] ?? normalized;
  if (ralNumber === "9005") return "#3b3b3b";
  return "#111";
}

function buildDimensionAnnotations(
  frame: { x: number; y: number; width: number; height: number },
  widthMm: number,
  heightMm: number
): DrawingDimension[] {
  return [
    {
      axis: "horizontal",
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
        y: frame.y + frame.height + 44,
        value: String(widthMm),
        fontSize: 12,
        fill: "#111",
        anchor: "middle",
      },
    },
    {
      axis: "vertical",
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

export function buildFixedInternalFieldRectangleLayer(input: FieldLayerInput): {
  glassShapes: DrawingShape[];
  visibleGlassBounds: { x0: number; x1: number; y0: number; y1: number };
} {
  void input.fieldKey;
  void input.rebateMode;
  const beadMm = 21;
  const astragalBarMm = 20;
  const beadPx = beadMm * input.scale;
  const astragalBarPx = astragalBarMm * input.scale;
  const hasAstragalBars = input.hasAstragalBars === true;
  const astragalCols = clamp(Math.round(input.astragalCols || 2), 1, 6);
  const astragalRows = clamp(Math.round(input.astragalRows || 2), 1, 6);
  const strokeColour = resolvePilotStrokeColourFromRal(input.frameRal);
  const outer = input.fieldBoundsPx;
  const visibleGlassBounds = {
    x0: outer.x0 + beadPx,
    x1: outer.x1 - beadPx,
    y0: outer.y0 + beadPx,
    y1: outer.y1 - beadPx,
  };

  const glassShapes: DrawingShape[] = [
    {
      kind: "polygon",
      points: [
        { x: outer.x0, y: outer.y0 },
        { x: outer.x1, y: outer.y0 },
        { x: outer.x1 - beadPx, y: outer.y0 + beadPx },
        { x: outer.x0 + beadPx, y: outer.y0 + beadPx },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_head",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: outer.x0 + beadPx, y: outer.y1 - beadPx },
        { x: outer.x1 - beadPx, y: outer.y1 - beadPx },
        { x: outer.x1, y: outer.y1 },
        { x: outer.x0, y: outer.y1 },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_bottom",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: outer.x0, y: outer.y0 },
        { x: outer.x0 + beadPx, y: outer.y0 + beadPx },
        { x: outer.x0 + beadPx, y: outer.y1 - beadPx },
        { x: outer.x0, y: outer.y1 },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_left",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: outer.x1 - beadPx, y: outer.y0 + beadPx },
        { x: outer.x1, y: outer.y0 },
        { x: outer.x1, y: outer.y1 },
        { x: outer.x1 - beadPx, y: outer.y1 - beadPx },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_right",
    } satisfies DrawingPolygon,
    {
      kind: "rect",
      x: visibleGlassBounds.x0,
      y: visibleGlassBounds.y0,
      width: Math.max(1, visibleGlassBounds.x1 - visibleGlassBounds.x0),
      height: Math.max(1, visibleGlassBounds.y1 - visibleGlassBounds.y0),
      stroke: strokeColour,
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "visible_glass_fixed",
    } satisfies DrawingRect,
  ];

  if (hasAstragalBars) {
    const glassWidth = Math.max(1, visibleGlassBounds.x1 - visibleGlassBounds.x0);
    const glassHeight = Math.max(1, visibleGlassBounds.y1 - visibleGlassBounds.y0);
    for (let col = 1; col < astragalCols; col += 1) {
      const centerX = visibleGlassBounds.x0 + (glassWidth * col) / astragalCols;
      glassShapes.push({
        kind: "rect",
        x: centerX - astragalBarPx / 2,
        y: visibleGlassBounds.y0,
        width: astragalBarPx,
        height: glassHeight,
        stroke: strokeColour,
        strokeWidth: 1,
        fill: input.frameFill,
        role: "glazing_bar_vertical",
      } satisfies DrawingRect);
    }
    for (let row = 1; row < astragalRows; row += 1) {
      const centerY = visibleGlassBounds.y0 + (glassHeight * row) / astragalRows;
      glassShapes.push({
        kind: "rect",
        x: visibleGlassBounds.x0,
        y: centerY - astragalBarPx / 2,
        width: glassWidth,
        height: astragalBarPx,
        stroke: strokeColour,
        strokeWidth: 1,
        fill: input.frameFill,
        role: "glazing_bar_horizontal",
      } satisfies DrawingRect);
    }
  }

  return { glassShapes, visibleGlassBounds };
}

export function buildFixedInternalRectanglePilot(input: Input): DrawingModel {
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

  const headMm = 57;
  const jambMm = 57;
  const bottomMm = 72;
  const beadMm = 21;
  const glassBiteMm = 13;
  const astragalBarMm = 20;
  const rebateMode = input.rebateMode ?? "both";
  const hasAstragalBars = input.hasAstragalBars === true;
  const astragalCols = clamp(Math.round(input.astragalCols || 2), 1, 4);
  const astragalRows = clamp(Math.round(input.astragalRows || 2), 1, 4);

  const headPx = headMm * scale;
  const jambPx = jambMm * scale;
  const bottomPx = bottomMm * scale;
  const beadPx = beadMm * scale;
  const astragalBarPx = astragalBarMm * scale;
  const rebateOffsetPx = 30 * scale;
  const strokeColour = resolvePilotStrokeColourFromRal(input.frameRal);

  const centerX0 = frameX + jambPx;
  const centerX1 = frameX + frameWidth - jambPx;
  const centerY0 = frameY + headPx;
  const centerY1 = frameY + frameHeight - bottomPx;
  const visibleGlassX0 = centerX0 + beadPx;
  const visibleGlassX1 = centerX1 - beadPx;
  const visibleGlassY0 = centerY0 + beadPx;
  const visibleGlassY1 = centerY1 - beadPx;

  const frameShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: headPx,
      stroke: strokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: centerY1,
      width: frameWidth,
      height: bottomPx,
      stroke: strokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: centerY0,
      width: jambPx,
      height: Math.max(1, centerY1 - centerY0),
      stroke: strokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_jamb_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: centerX1,
      y: centerY0,
      width: jambPx,
      height: Math.max(1, centerY1 - centerY0),
      stroke: strokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_jamb_right",
    } satisfies DrawingRect,
  ];
  if (rebateMode === "internal" || rebateMode === "both") {
    frameShapes.push({
      kind: "line",
      x1: frameX,
      y1: centerY1 + bottomPx - rebateOffsetPx,
      x2: frameX + frameWidth,
      y2: centerY1 + bottomPx - rebateOffsetPx,
      stroke: strokeColour,
      strokeWidth: 1,
      dashed: true,
      role: "frame_bottom_rebate_line",
    });
  }

  const beadShapes: DrawingShape[] = [
    {
      kind: "polygon",
      points: [
        { x: centerX0, y: centerY0 },
        { x: centerX1, y: centerY0 },
        { x: centerX1 - beadPx, y: centerY0 + beadPx },
        { x: centerX0 + beadPx, y: centerY0 + beadPx },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_head",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: centerX0 + beadPx, y: centerY1 - beadPx },
        { x: centerX1 - beadPx, y: centerY1 - beadPx },
        { x: centerX1, y: centerY1 },
        { x: centerX0, y: centerY1 },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_bottom",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: centerX0, y: centerY0 },
        { x: centerX0 + beadPx, y: centerY0 + beadPx },
        { x: centerX0 + beadPx, y: centerY1 - beadPx },
        { x: centerX0, y: centerY1 },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_left",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: centerX1 - beadPx, y: centerY0 + beadPx },
        { x: centerX1, y: centerY0 },
        { x: centerX1, y: centerY1 },
        { x: centerX1 - beadPx, y: centerY1 - beadPx },
      ],
      stroke: strokeColour,
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_right",
    } satisfies DrawingPolygon,
  ];

  const glassShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: visibleGlassX0,
      y: visibleGlassY0,
      width: Math.max(1, visibleGlassX1 - visibleGlassX0),
      height: Math.max(1, visibleGlassY1 - visibleGlassY0),
      stroke: strokeColour,
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "visible_glass_fixed",
    } satisfies DrawingRect,
  ];

  if (hasAstragalBars) {
    const glassWidth = Math.max(1, visibleGlassX1 - visibleGlassX0);
    const glassHeight = Math.max(1, visibleGlassY1 - visibleGlassY0);
    for (let col = 1; col < astragalCols; col += 1) {
      const centerX = visibleGlassX0 + (glassWidth * col) / astragalCols;
      glassShapes.push({
        kind: "rect",
        x: centerX - astragalBarPx / 2,
        y: visibleGlassY0,
        width: astragalBarPx,
        height: glassHeight,
        stroke: strokeColour,
        strokeWidth: 1,
        fill: input.frameFill,
        role: "glazing_bar_vertical",
      } satisfies DrawingRect);
    }
    for (let row = 1; row < astragalRows; row += 1) {
      const centerY = visibleGlassY0 + (glassHeight * row) / astragalRows;
      glassShapes.push({
        kind: "rect",
        x: visibleGlassX0,
        y: centerY - astragalBarPx / 2,
        width: glassWidth,
        height: astragalBarPx,
        stroke: strokeColour,
        strokeWidth: 1,
        fill: input.frameFill,
        role: "glazing_bar_horizontal",
      } satisfies DrawingRect);
    }
  }

  const actualGlassWidthMm = Math.max(1, widthMm - jambMm - jambMm - beadMm - beadMm + glassBiteMm * 2);
  const actualGlassHeightMm = Math.max(1, heightMm - headMm - bottomMm - beadMm - beadMm + glassBiteMm * 2);

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: [...beadShapes, ...glassShapes] },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: [],
      glass: [...beadShapes, ...glassShapes],
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(
        { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        widthMm,
        heightMm
      ),
      labels: [
        {
          x: visibleGlassX0 + 8,
          y: visibleGlassY0 + 16,
          value: `Actual glass order: ${actualGlassWidthMm} x ${actualGlassHeightMm}`,
          fontSize: 9,
          fill: "#3f3f46",
          anchor: "start",
          role: "actual_glass_order_size",
        },
      ],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: "fixed",
      sectionReferences: [],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "glass", "dimensions", "annotations"],
    },
    interaction: {
      cells: [
        {
          key: "0,0",
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}

export function buildFixedExternalRectanglePilot(input: Omit<Input, "rebateMode">): DrawingModel {
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

  const headMm = 3;
  const jambMm = 3;
  const bottomMm = 18;
  const claddingMm = 78;
  const astragalBarMm = 26;

  const headPx = headMm * scale;
  const jambPx = jambMm * scale;
  const bottomPx = bottomMm * scale;
  const claddingPx = claddingMm * scale;
  const astragalBarPx = astragalBarMm * scale;
  const claddingFill = input.claddingFill ?? input.frameFill;
  const hasAstragalBars = input.hasAstragalBars === true;
  const astragalCols = clamp(Math.round(input.astragalCols || 2), 1, 4);
  const astragalRows = clamp(Math.round(input.astragalRows || 2), 1, 4);
  const frameStrokeColour = resolvePilotStrokeColourFromRal(input.frameRal);
  const claddingStrokeColour = resolvePilotStrokeColourFromRal(input.claddingRal);

  const openingX0 = frameX + jambPx;
  const openingX1 = frameX + frameWidth - jambPx;
  const openingY0 = frameY + headPx;
  const openingY1 = frameY + frameHeight - bottomPx;
  const glassX0 = openingX0 + claddingPx;
  const glassX1 = openingX1 - claddingPx;
  const glassY0 = openingY0 + claddingPx;
  const glassY1 = openingY1 - claddingPx;

  const frameShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: headPx,
      stroke: frameStrokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: openingY1,
      width: frameWidth,
      height: bottomPx,
      stroke: frameStrokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: openingY0,
      width: jambPx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: frameStrokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_jamb_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: openingX1,
      y: openingY0,
      width: jambPx,
      height: Math.max(1, openingY1 - openingY0),
      stroke: frameStrokeColour,
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_jamb_right",
    } satisfies DrawingRect,
  ];

  const claddingShapes: DrawingShape[] = [
    {
      kind: "polygon",
      points: [
        { x: openingX0, y: openingY0 },
        { x: openingX1, y: openingY0 },
        { x: openingX1 - claddingPx, y: openingY0 + claddingPx },
        { x: openingX0 + claddingPx, y: openingY0 + claddingPx },
      ],
      stroke: claddingStrokeColour,
      strokeWidth: 1,
      fill: claddingFill,
      role: "external_cladding_head",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: openingX0 + claddingPx, y: openingY1 - claddingPx },
        { x: openingX1 - claddingPx, y: openingY1 - claddingPx },
        { x: openingX1, y: openingY1 },
        { x: openingX0, y: openingY1 },
      ],
      stroke: claddingStrokeColour,
      strokeWidth: 1,
      fill: claddingFill,
      role: "external_cladding_bottom",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: openingX0, y: openingY0 },
        { x: openingX0 + claddingPx, y: openingY0 + claddingPx },
        { x: openingX0 + claddingPx, y: openingY1 - claddingPx },
        { x: openingX0, y: openingY1 },
      ],
      stroke: claddingStrokeColour,
      strokeWidth: 1,
      fill: claddingFill,
      role: "external_cladding_left",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: openingX1 - claddingPx, y: openingY0 + claddingPx },
        { x: openingX1, y: openingY0 },
        { x: openingX1, y: openingY1 },
        { x: openingX1 - claddingPx, y: openingY1 - claddingPx },
      ],
      stroke: claddingStrokeColour,
      strokeWidth: 1,
      fill: claddingFill,
      role: "external_cladding_right",
    } satisfies DrawingPolygon,
  ];

  const glassShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: glassX0,
      y: glassY0,
      width: Math.max(1, glassX1 - glassX0),
      height: Math.max(1, glassY1 - glassY0),
      stroke: claddingStrokeColour,
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "external_visible_glass_fixed",
    } satisfies DrawingRect,
  ];

  if (hasAstragalBars) {
    const glassWidth = Math.max(1, glassX1 - glassX0);
    const glassHeight = Math.max(1, glassY1 - glassY0);
    for (let col = 1; col < astragalCols; col += 1) {
      const centerX = glassX0 + (glassWidth * col) / astragalCols;
      glassShapes.push({
        kind: "rect",
        x: centerX - astragalBarPx / 2,
        y: glassY0,
        width: astragalBarPx,
        height: glassHeight,
        stroke: claddingStrokeColour,
        strokeWidth: 1,
        fill: claddingFill,
        role: "external_glazing_bar_vertical",
      } satisfies DrawingRect);
    }
    for (let row = 1; row < astragalRows; row += 1) {
      const centerY = glassY0 + (glassHeight * row) / astragalRows;
      glassShapes.push({
        kind: "rect",
        x: glassX0,
        y: centerY - astragalBarPx / 2,
        width: glassWidth,
        height: astragalBarPx,
        stroke: claddingStrokeColour,
        strokeWidth: 1,
        fill: claddingFill,
        role: "external_glazing_bar_horizontal",
      } satisfies DrawingRect);
    }
  }

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: [...claddingShapes, ...glassShapes] },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: [],
      glass: [...claddingShapes, ...glassShapes],
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(
        { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        widthMm,
        heightMm
      ),
      labels: [],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "outward",
      operationType: "fixed",
      sectionReferences: [],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "glass", "dimensions", "annotations"],
    },
    interaction: {
      cells: [
        {
          key: "0,0",
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}

export function buildFixedSashInternalRectanglePilot(input: Input): DrawingModel {
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

  const headMm = 57;
  const jambMm = 57;
  const bottomMm = 72;
  const sashFaceMm = 57;
  const beadMm = 21;
  const glassBiteMm = 13;
  const rebateMode = input.rebateMode ?? "both";

  const headPx = headMm * scale;
  const jambPx = jambMm * scale;
  const bottomPx = bottomMm * scale;
  const sashFacePx = sashFaceMm * scale;
  const beadPx = beadMm * scale;
  const rebateOffsetPx = 30 * scale;

  const sashOuterX0 = frameX + jambPx;
  const sashOuterX1 = frameX + frameWidth - jambPx;
  const sashOuterY0 = frameY + headPx;
  const sashOuterY1 = frameY + frameHeight - bottomPx;
  const beadOuterX0 = sashOuterX0 + sashFacePx;
  const beadOuterX1 = sashOuterX1 - sashFacePx;
  const beadOuterY0 = sashOuterY0 + sashFacePx;
  const beadOuterY1 = sashOuterY1 - sashFacePx;
  const visibleGlassX0 = beadOuterX0 + beadPx;
  const visibleGlassX1 = beadOuterX1 - beadPx;
  const visibleGlassY0 = beadOuterY0 + beadPx;
  const visibleGlassY1 = beadOuterY1 - beadPx;

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
      role: "frame_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: sashOuterY1,
      width: frameWidth,
      height: bottomPx,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: sashOuterY0,
      width: jambPx,
      height: Math.max(1, sashOuterY1 - sashOuterY0),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_jamb_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: sashOuterX1,
      y: sashOuterY0,
      width: jambPx,
      height: Math.max(1, sashOuterY1 - sashOuterY0),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "frame_jamb_right",
    } satisfies DrawingRect,
  ];
  if (rebateMode === "internal" || rebateMode === "both") {
    frameShapes.push({
      kind: "line",
      x1: frameX,
      y1: sashOuterY1 + bottomPx - rebateOffsetPx,
      x2: frameX + frameWidth,
      y2: sashOuterY1 + bottomPx - rebateOffsetPx,
      stroke: "#111",
      strokeWidth: 1,
      dashed: true,
      role: "frame_bottom_rebate_line",
    });
  }

  const sashShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: sashOuterX0,
      y: sashOuterY0,
      width: Math.max(1, sashOuterX1 - sashOuterX0),
      height: sashFacePx,
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "sash_overlay_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: sashOuterX0,
      y: beadOuterY1,
      width: Math.max(1, sashOuterX1 - sashOuterX0),
      height: sashFacePx,
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "sash_overlay_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: sashOuterX0,
      y: beadOuterY0,
      width: sashFacePx,
      height: Math.max(1, beadOuterY1 - beadOuterY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "sash_overlay_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: beadOuterX1,
      y: beadOuterY0,
      width: sashFacePx,
      height: Math.max(1, beadOuterY1 - beadOuterY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "sash_overlay_right",
    } satisfies DrawingRect,
  ];

  const beadShapes: DrawingShape[] = [
    {
      kind: "polygon",
      points: [
        { x: beadOuterX0, y: beadOuterY0 },
        { x: beadOuterX1, y: beadOuterY0 },
        { x: beadOuterX1 - beadPx, y: beadOuterY0 + beadPx },
        { x: beadOuterX0 + beadPx, y: beadOuterY0 + beadPx },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_head",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: beadOuterX0 + beadPx, y: beadOuterY1 - beadPx },
        { x: beadOuterX1 - beadPx, y: beadOuterY1 - beadPx },
        { x: beadOuterX1, y: beadOuterY1 },
        { x: beadOuterX0, y: beadOuterY1 },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_bottom",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: beadOuterX0, y: beadOuterY0 },
        { x: beadOuterX0 + beadPx, y: beadOuterY0 + beadPx },
        { x: beadOuterX0 + beadPx, y: beadOuterY1 - beadPx },
        { x: beadOuterX0, y: beadOuterY1 },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_left",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: beadOuterX1 - beadPx, y: beadOuterY0 + beadPx },
        { x: beadOuterX1, y: beadOuterY0 },
        { x: beadOuterX1, y: beadOuterY1 },
        { x: beadOuterX1 - beadPx, y: beadOuterY1 - beadPx },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "glazing_bead_right",
    } satisfies DrawingPolygon,
  ];

  const glassShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: visibleGlassX0,
      y: visibleGlassY0,
      width: Math.max(1, visibleGlassX1 - visibleGlassX0),
      height: Math.max(1, visibleGlassY1 - visibleGlassY0),
      stroke: "#111",
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "visible_glass_fixed_sash",
    } satisfies DrawingRect,
  ];

  const actualGlassWidthMm = Math.max(
    1,
    widthMm - jambMm - jambMm - sashFaceMm - sashFaceMm - beadMm - beadMm + glassBiteMm * 2
  );
  const actualGlassHeightMm = Math.max(
    1,
    heightMm - headMm - bottomMm - sashFaceMm - sashFaceMm - beadMm - beadMm + glassBiteMm * 2
  );

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: sashShapes },
      { id: "glass", role: "glass", shapes: [...beadShapes, ...glassShapes] },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: sashShapes,
      glass: [...beadShapes, ...glassShapes],
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(
        { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        widthMm,
        heightMm
      ),
      labels: [
        {
          x: visibleGlassX0 + 8,
          y: visibleGlassY0 + 16,
          value: `Pilot sash face: ${sashFaceMm}mm`,
          fontSize: 9,
          fill: "#3f3f46",
          anchor: "start",
          role: "fixed_sash_pilot_note",
        },
        {
          x: visibleGlassX0 + 8,
          y: visibleGlassY0 + 30,
          value: `Actual glass order: ${actualGlassWidthMm} x ${actualGlassHeightMm}`,
          fontSize: 9,
          fill: "#3f3f46",
          anchor: "start",
          role: "actual_glass_order_size",
        },
      ],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: "fixed_sash",
      sectionReferences: [],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "sash", "glass", "dimensions", "annotations"],
    },
    interaction: {
      cells: [
        {
          key: "0,0",
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}

export function buildFixedSashExternalRectanglePilot(input: Omit<Input, "rebateMode">): DrawingModel {
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

  const headMm = 3;
  const jambMm = 3;
  const bottomMm = 18;
  const sashOverlayHeadMm = 32.7;
  const sashOverlaySideMm = 32.7;
  const sashOverlayBottomMm = 32.5;
  const innerCladdingHeadMm = 45.3;
  const innerCladdingSideMm = 45.3;
  const innerCladdingBottomMm = 45.5;

  const headPx = headMm * scale;
  const jambPx = jambMm * scale;
  const bottomPx = bottomMm * scale;
  const sashOverlayHeadPx = sashOverlayHeadMm * scale;
  const sashOverlaySidePx = sashOverlaySideMm * scale;
  const sashOverlayBottomPx = sashOverlayBottomMm * scale;
  const innerCladdingHeadPx = innerCladdingHeadMm * scale;
  const innerCladdingSidePx = innerCladdingSideMm * scale;
  const innerCladdingBottomPx = innerCladdingBottomMm * scale;

  const sashOuterX0 = frameX + jambPx;
  const sashOuterX1 = frameX + frameWidth - jambPx;
  const sashOuterY0 = frameY + headPx;
  const sashOuterY1 = frameY + frameHeight - bottomPx;
  const claddingOuterX0 = sashOuterX0 + sashOverlaySidePx;
  const claddingOuterX1 = sashOuterX1 - sashOverlaySidePx;
  const claddingOuterY0 = sashOuterY0 + sashOverlayHeadPx;
  const claddingOuterY1 = sashOuterY1 - sashOverlayBottomPx;
  const visibleGlassX0 = claddingOuterX0 + innerCladdingSidePx;
  const visibleGlassX1 = claddingOuterX1 - innerCladdingSidePx;
  const visibleGlassY0 = claddingOuterY0 + innerCladdingHeadPx;
  const visibleGlassY1 = claddingOuterY1 - innerCladdingBottomPx;

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
      role: "external_frame_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: sashOuterY1,
      width: frameWidth,
      height: bottomPx,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: frameX,
      y: sashOuterY0,
      width: jambPx,
      height: Math.max(1, sashOuterY1 - sashOuterY0),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_jamb_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: sashOuterX1,
      y: sashOuterY0,
      width: jambPx,
      height: Math.max(1, sashOuterY1 - sashOuterY0),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: input.frameFill,
      role: "external_frame_jamb_right",
    } satisfies DrawingRect,
  ];

  const sashShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: sashOuterX0,
      y: sashOuterY0,
      width: Math.max(1, sashOuterX1 - sashOuterX0),
      height: sashOverlayHeadPx,
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "external_sash_overlay_head",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: sashOuterX0,
      y: claddingOuterY1,
      width: Math.max(1, sashOuterX1 - sashOuterX0),
      height: sashOverlayBottomPx,
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "external_sash_overlay_bottom",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: sashOuterX0,
      y: claddingOuterY0,
      width: sashOverlaySidePx,
      height: Math.max(1, claddingOuterY1 - claddingOuterY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "external_sash_overlay_left",
    } satisfies DrawingRect,
    {
      kind: "rect",
      x: claddingOuterX1,
      y: claddingOuterY0,
      width: sashOverlaySidePx,
      height: Math.max(1, claddingOuterY1 - claddingOuterY0),
      stroke: "#111",
      strokeWidth: 1.1,
      fill: input.frameFill,
      role: "external_sash_overlay_right",
    } satisfies DrawingRect,
  ];

  const claddingShapes: DrawingShape[] = [
    {
      kind: "polygon",
      points: [
        { x: claddingOuterX0, y: claddingOuterY0 },
        { x: claddingOuterX1, y: claddingOuterY0 },
        { x: claddingOuterX1 - innerCladdingSidePx, y: claddingOuterY0 + innerCladdingHeadPx },
        { x: claddingOuterX0 + innerCladdingSidePx, y: claddingOuterY0 + innerCladdingHeadPx },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "external_cladding_head",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: claddingOuterX0 + innerCladdingSidePx, y: claddingOuterY1 - innerCladdingBottomPx },
        { x: claddingOuterX1 - innerCladdingSidePx, y: claddingOuterY1 - innerCladdingBottomPx },
        { x: claddingOuterX1, y: claddingOuterY1 },
        { x: claddingOuterX0, y: claddingOuterY1 },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "external_cladding_bottom",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: claddingOuterX0, y: claddingOuterY0 },
        { x: claddingOuterX0 + innerCladdingSidePx, y: claddingOuterY0 + innerCladdingHeadPx },
        { x: claddingOuterX0 + innerCladdingSidePx, y: claddingOuterY1 - innerCladdingBottomPx },
        { x: claddingOuterX0, y: claddingOuterY1 },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "external_cladding_left",
    } satisfies DrawingPolygon,
    {
      kind: "polygon",
      points: [
        { x: claddingOuterX1 - innerCladdingSidePx, y: claddingOuterY0 + innerCladdingHeadPx },
        { x: claddingOuterX1, y: claddingOuterY0 },
        { x: claddingOuterX1, y: claddingOuterY1 },
        { x: claddingOuterX1 - innerCladdingSidePx, y: claddingOuterY1 - innerCladdingBottomPx },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: input.frameFill,
      role: "external_cladding_right",
    } satisfies DrawingPolygon,
  ];

  const glassShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: visibleGlassX0,
      y: visibleGlassY0,
      width: Math.max(1, visibleGlassX1 - visibleGlassX0),
      height: Math.max(1, visibleGlassY1 - visibleGlassY0),
      stroke: "#111",
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "external_visible_glass_fixed_sash",
    } satisfies DrawingRect,
  ];

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: sashShapes },
      { id: "glass", role: "glass", shapes: [...claddingShapes, ...glassShapes] },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: sashShapes,
      glass: [...claddingShapes, ...glassShapes],
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(
        { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        widthMm,
        heightMm
      ),
      labels: [
        {
          x: visibleGlassX0 + 8,
          y: visibleGlassY0 + 16,
          value: `Pilot sash overlay: ${sashOverlaySideMm} / cladding: ${innerCladdingSideMm}mm`,
          fontSize: 9,
          fill: "#3f3f46",
          anchor: "start",
          role: "fixed_sash_pilot_note",
        },
      ],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "outward",
      operationType: "fixed_sash",
      sectionReferences: [],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "sash", "glass", "dimensions", "annotations"],
    },
    interaction: {
      cells: [
        {
          key: "0,0",
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}
