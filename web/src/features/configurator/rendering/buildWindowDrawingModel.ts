import type {
  DrawingDimension,
  DrawingHandle,
  DrawingLabel,
  DrawingLine,
  DrawingMarker,
  DrawingModel,
  DrawingPolygon,
  DrawingRect,
  DrawingShape,
} from "./drawingModel";
import type { ResolvedSectionProfileSet } from "./profileSectionMapping";

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
  resolvedProfiles?: ResolvedSectionProfileSet | null;
  windowConfiguration?: {
    junctions?: Array<{ key: string; type?: string }>;
    fields?: Array<{
      key: string;
      type?: string;
      handleHeightMm?: number | null;
      hingeType?: string | null;
      handleAxisOffsetMm?: number | null;
      hingePivotOffsetMm?: number | null;
    }>;
    hardware?: { defaultHandleHeightMm?: number | null; defaultHingeType?: string | null };
    frame?: { finishMode?: "single" | "dual"; internalColour?: string | null; externalColour?: string | null };
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function evenSplit(total: number, parts: number) {
  const safeParts = clamp(Math.round(parts), 1, 16);
  const base = Math.floor(total / safeParts);
  const remainder = total - base * safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function normalizeSplits(total: number, parts: number, existing: number[] | undefined) {
  if (!Array.isArray(existing) || existing.length !== parts) return evenSplit(total, parts);
  const safe = existing.map((value) => Math.max(1, Math.round(Number(value || 0))));
  const safeSum = sum(safe);
  if (safeSum === total) return safe;
  return safe.map((value, index, values) => {
    const scaled = Math.max(1, Math.round((value / safeSum) * total));
    if (index < values.length - 1) return scaled;
    return Math.max(
      1,
      total -
        sum(
          values
            .slice(0, -1)
            .map((current) => Math.max(1, Math.round((current / safeSum) * total)))
        )
    );
  });
}

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function insetBounds(
  bounds: { x0: number; x1: number; y0: number; y1: number },
  insets: { left: number; right: number; top: number; bottom: number }
) {
  return {
    x0: bounds.x0 + insets.left,
    x1: bounds.x1 - insets.right,
    y0: bounds.y0 + insets.top,
    y1: bounds.y1 - insets.bottom,
  };
}

function normalizeCellInsertions(
  fieldsX: number,
  fieldsY: number,
  existing: Record<string, string> | undefined,
  fallback: string
) {
  const output: Record<string, string> = {};
  for (let row = 0; row < fieldsY; row += 1) {
    for (let col = 0; col < fieldsX; col += 1) {
      const key = keyForCell(col, row);
      output[key] = existing?.[key] ?? fallback;
    }
  }
  return output;
}

function mmToPx(mm: number, scale: number, minimum = 3, maximum = 40) {
  return clamp(Number(mm || 0) * scale, minimum, maximum);
}

function resolveFrameFinishColour(
  finishMode: "single" | "dual" | undefined,
  internalColour: string | null | undefined,
  externalColour: string | null | undefined,
  view: "inside" | "outside"
) {
  const selected =
    view === "outside" && finishMode === "dual"
      ? externalColour ?? internalColour ?? "White"
      : internalColour ?? externalColour ?? "White";
  const normalized = String(selected || "White").trim().toLowerCase();
  if (normalized.includes("anthracite")) return "#4b5563";
  if (normalized.includes("black")) return "#18181b";
  if (normalized.includes("cream")) return "#f5e9c9";
  if (normalized.includes("green")) return "#7d9b76";
  if (normalized.includes("silver")) return "#9ca3af";
  return "#f4f4f5";
}

const INTERNAL_VISIBLE_FRAME_FACE_RATIO = 37.5 / 63;

function resolveInternalFrameFaceMetrics(
  frameProfile: ResolvedSectionProfileSet["frame"]["head"] | ResolvedSectionProfileSet["frame"]["jambLeft"] | ResolvedSectionProfileSet["frame"]["jambRight"] | ResolvedSectionProfileSet["frame"]["bottom"] | null | undefined,
  sashProfile: ResolvedSectionProfileSet["sash"]["head"] | ResolvedSectionProfileSet["sash"]["jambLeft"] | ResolvedSectionProfileSet["sash"]["jambRight"] | ResolvedSectionProfileSet["sash"]["bottom"] | null | undefined,
  scale: number
) {
  const frameBandMm = Math.max(1, Number(frameProfile?.visibleFaceWidthMm || frameProfile?.depthMm || 63));
  const frameDepthMm = Math.max(frameBandMm, Number(frameProfile?.depthMm || frameBandMm));
  const configuredSashOverlapMm = Number(sashProfile?.overlapMm || 0);
  const explicitVisibleInternalFaceMm = Number(frameProfile?.visibleInternalFaceMm || 0);
  const derivedVisibleInternalFaceMm =
    explicitVisibleInternalFaceMm > 0
      ? explicitVisibleInternalFaceMm
      : configuredSashOverlapMm > frameDepthMm * 0.2
        ? frameDepthMm - configuredSashOverlapMm
        : frameDepthMm * INTERNAL_VISIBLE_FRAME_FACE_RATIO;
  const visibleInternalFaceMm = clamp(
    derivedVisibleInternalFaceMm,
    8,
    Math.min(frameBandMm, frameDepthMm)
  );
  const frameBandPx = mmToPx(frameBandMm, scale);
  const visibleInternalFacePx = mmToPx(visibleInternalFaceMm, scale, 2, frameBandPx);
  return {
    frameBandPx,
    frameDepthMm,
    visibleInternalFacePx,
    sashOverlapPx: Math.max(0, frameBandPx - visibleInternalFacePx),
  };
}

function normalizedInsertion(insertion: string) {
  return String(insertion || "").trim().toLowerCase();
}

function isFixedInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("fixed");
}

function isFixedSashInsertion(insertion: string) {
  const normalized = normalizedInsertion(insertion);
  return normalized.includes("fixed sash");
}

function supportsTrickleVentInsertion(insertion: string) {
  const normalized = normalizedInsertion(insertion);
  if (normalized.includes("fixed sash") || normalized === "fixed") return true;
  return normalized.includes("tilt") || normalized.includes("turn");
}

function isTiltAndTurnInsertion(insertion: string) {
  const normalized = normalizedInsertion(insertion);
  return normalized.includes("tilt") && normalized.includes("turn");
}

function isLeftHandInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("left");
}

function isRightHandInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("right");
}

function isTurnOnlyInsertion(insertion: string) {
  const normalized = normalizedInsertion(insertion);
  return normalized.includes("turn") && !normalized.includes("tilt");
}

function isTopHungInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("top hung");
}

function isReversibleInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("reversible");
}

function getHingeMode(rawHingeType: string | null | undefined): "concealed" | "exposed" {
  const normalized = String(rawHingeType || "").trim().toLowerCase();
  if (normalized.includes("exposed") || normalized.includes("heavy")) return "exposed";
  return "concealed";
}

type FieldMechanics = {
  hingeSide: "left" | "right";
  openingSide: "left" | "right";
  openingKind: "turn" | "tilt" | "tiltTurn" | "reversible" | "fixed";
  showHandle: boolean;
  handleSide: "left" | "right" | null;
  hingeMode: "concealed" | "exposed";
};

function resolveFieldMechanics(input: {
  insertion: string;
  view: "inside" | "outside";
  col: number;
  isFlyingPair: boolean;
  flyingMasterCol: number | null;
  hingeType?: string | null;
}): FieldMechanics {
  const normalized = normalizedInsertion(input.insertion);
  const hingeMode = getHingeMode(input.hingeType);

  if (isFixedSashInsertion(input.insertion)) {
    return {
      hingeSide: "left",
      openingSide: "right",
      openingKind: "fixed",
      showHandle: false,
      handleSide: null,
      hingeMode,
    };
  }

  if (input.view === "outside" && isTiltAndTurnInsertion(input.insertion)) {
    return {
      hingeSide: "left",
      openingSide: "right",
      openingKind: "fixed",
      showHandle: false,
      handleSide: null,
      hingeMode,
    };
  }

  if (normalized.includes("fixed")) {
    return {
      hingeSide: "left",
      openingSide: "right",
      openingKind: "fixed",
      showHandle: false,
      handleSide: null,
      hingeMode,
    };
  }

  let hingeSide: "left" | "right";
  if (isLeftHandInsertion(input.insertion)) {
    hingeSide = "left";
  } else if (isRightHandInsertion(input.insertion)) {
    hingeSide = "right";
  } else {
    hingeSide = input.view === "inside" ? "left" : "right";
  }

  let openingKind: FieldMechanics["openingKind"] = "turn";
  if (isTiltAndTurnInsertion(input.insertion)) openingKind = "tiltTurn";
  else if (normalized.includes("tilt") || isTopHungInsertion(input.insertion)) openingKind = "tilt";
  else if (isReversibleInsertion(input.insertion)) openingKind = "reversible";

  let openingSide: "left" | "right" = hingeSide === "left" ? "right" : "left";
  let showHandle = true;
  let handleSide: "left" | "right" | null = openingSide;

  if (input.isFlyingPair) {
    const isMaster = input.col === input.flyingMasterCol;
    if (isMaster) {
      hingeSide = input.col === 0 ? "left" : "right";
      openingSide = hingeSide === "left" ? "right" : "left";
      handleSide = openingSide;
      showHandle = true;
    } else {
      showHandle = false;
      handleSide = null;
    }
  }

  return { hingeSide, openingSide, openingKind, showHandle, handleSide, hingeMode };
}

type SashGeometry = {
  outer: { x0: number; x1: number; y0: number; y1: number };
  inner: { x0: number; x1: number; y0: number; y1: number };
  leftFace: number;
  rightFace: number;
  topFace: number;
  bottomFace: number;
  beadAnchors?: {
    topCenter: { x: number; y: number };
    bottomCenter: { x: number; y: number };
    leftCenter: { x: number; y: number };
    rightCenter: { x: number; y: number };
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
  mitreCorners?: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
};

function buildHandle(
  geometry: SashGeometry,
  mechanics: FieldMechanics,
  handleHeightMm: number | null | undefined,
  scale: number,
  handleAxisOffsetMm?: number | null
): DrawingHandle | null {
  if (!mechanics.showHandle || !mechanics.handleSide) return null;
  const explicitHandleOffsetPx =
    Number.isFinite(Number(handleAxisOffsetMm)) && Number(handleAxisOffsetMm) > 0
      ? Number(handleAxisOffsetMm) * scale
      : null;

  const x =
    mechanics.handleSide === "left"
      ? geometry.outer.x0 + (explicitHandleOffsetPx ?? geometry.leftFace * 0.55)
      : geometry.outer.x1 - (explicitHandleOffsetPx ?? geometry.rightFace * 0.55);
  const requestedOffsetPx = Number.isFinite(Number(handleHeightMm))
    ? Number(handleHeightMm) * scale
    : (geometry.outer.y1 - geometry.outer.y0) / 2;
  const y = clamp(
    geometry.outer.y0 + requestedOffsetPx,
    geometry.outer.y0 + geometry.topFace + 12,
    geometry.outer.y1 - geometry.bottomFace - 12
  );

  return {
    x,
    y,
    size: 10,
    role: "handle",
  };
}

function buildOpeningSymbol(
  geometry: SashGeometry,
  mechanics: FieldMechanics,
  hingePivotOffsetMm: number | null | undefined,
  scale: number
): DrawingLine[] {
  if (mechanics.openingKind === "fixed") return [];

  const dash = (line: Omit<DrawingLine, "kind">): DrawingLine => ({
    kind: "line",
    dashed: true,
    stroke: "#111",
    strokeWidth: 1.1,
    ...line,
  });

  const pivotInset =
    Number.isFinite(Number(hingePivotOffsetMm)) && Number(hingePivotOffsetMm) >= 0
      ? Number(hingePivotOffsetMm) * scale
      : mechanics.hingeMode === "exposed"
        ? Math.max(3, Math.min(mechanics.hingeSide === "left" ? geometry.leftFace : geometry.rightFace, 10))
        : 0;
  const pivotX =
    mechanics.hingeSide === "left" ? geometry.outer.x0 + pivotInset : geometry.outer.x1 - pivotInset;
  const innerPadding = 10;
  const topPivotY = geometry.inner.y0 + innerPadding;
  const bottomPivotY = geometry.inner.y1 - innerPadding;
  const bottomPivotLeftX = geometry.inner.x0 + innerPadding;
  const bottomPivotRightX = geometry.inner.x1 - innerPadding;
  const defaultBeadAnchors = {
    topCenter: { x: (geometry.inner.x0 + geometry.inner.x1) / 2, y: geometry.inner.y0 },
    bottomCenter: { x: (geometry.inner.x0 + geometry.inner.x1) / 2, y: geometry.inner.y1 },
    leftCenter: { x: geometry.inner.x0, y: (geometry.inner.y0 + geometry.inner.y1) / 2 },
    rightCenter: { x: geometry.inner.x1, y: (geometry.inner.y0 + geometry.inner.y1) / 2 },
    topLeft: { x: geometry.inner.x0, y: geometry.inner.y0 },
    topRight: { x: geometry.inner.x1, y: geometry.inner.y0 },
    bottomLeft: { x: geometry.inner.x0, y: geometry.inner.y1 },
    bottomRight: { x: geometry.inner.x1, y: geometry.inner.y1 },
  };
  const beadAnchors = geometry.beadAnchors ?? defaultBeadAnchors;
  const defaultCorners = {
    topLeft: beadAnchors.topLeft,
    topRight: beadAnchors.topRight,
    bottomLeft: beadAnchors.bottomLeft,
    bottomRight: beadAnchors.bottomRight,
  };
  const mitreCorners = geometry.mitreCorners ?? defaultCorners;
  const openingSideMidpoint = mechanics.openingSide === "left" ? beadAnchors.leftCenter : beadAnchors.rightCenter;
  const topOuterEdgeCenter = beadAnchors.topCenter;
  const openingTopCorner = mechanics.openingSide === "left" ? mitreCorners.topLeft : mitreCorners.topRight;
  const openingBottomCorner = mechanics.openingSide === "left" ? mitreCorners.bottomLeft : mitreCorners.bottomRight;

  if (mechanics.openingKind === "tiltTurn") {
    const glassPoints = {
      topLeft: { x: geometry.inner.x0, y: geometry.inner.y0 },
      topRight: { x: geometry.inner.x1, y: geometry.inner.y0 },
      bottomLeft: { x: geometry.inner.x0, y: geometry.inner.y1 },
      bottomRight: { x: geometry.inner.x1, y: geometry.inner.y1 },
      topCenter: { x: (geometry.inner.x0 + geometry.inner.x1) / 2, y: geometry.inner.y0 },
      leftCenter: { x: geometry.inner.x0, y: (geometry.inner.y0 + geometry.inner.y1) / 2 },
      rightCenter: { x: geometry.inner.x1, y: (geometry.inner.y0 + geometry.inner.y1) / 2 },
    };
    if (mechanics.hingeSide === "left") {
      return [
        dash({ x1: glassPoints.topLeft.x, y1: glassPoints.topLeft.y, x2: glassPoints.rightCenter.x, y2: glassPoints.rightCenter.y }),
        dash({ x1: glassPoints.bottomLeft.x, y1: glassPoints.bottomLeft.y, x2: glassPoints.rightCenter.x, y2: glassPoints.rightCenter.y }),
        dash({ x1: glassPoints.bottomLeft.x, y1: glassPoints.bottomLeft.y, x2: glassPoints.topCenter.x, y2: glassPoints.topCenter.y }),
        dash({ x1: glassPoints.topCenter.x, y1: glassPoints.topCenter.y, x2: glassPoints.bottomRight.x, y2: glassPoints.bottomRight.y }),
      ];
    }
    return [
      dash({ x1: glassPoints.topRight.x, y1: glassPoints.topRight.y, x2: glassPoints.leftCenter.x, y2: glassPoints.leftCenter.y }),
      dash({ x1: glassPoints.bottomRight.x, y1: glassPoints.bottomRight.y, x2: glassPoints.leftCenter.x, y2: glassPoints.leftCenter.y }),
      dash({ x1: glassPoints.bottomRight.x, y1: glassPoints.bottomRight.y, x2: glassPoints.topCenter.x, y2: glassPoints.topCenter.y }),
      dash({ x1: glassPoints.topCenter.x, y1: glassPoints.topCenter.y, x2: glassPoints.bottomLeft.x, y2: glassPoints.bottomLeft.y }),
    ];
  }
  if (mechanics.openingKind === "tilt") {
    return [
      dash({ x1: bottomPivotLeftX, y1: geometry.outer.y1, x2: topOuterEdgeCenter.x, y2: topOuterEdgeCenter.y }),
      dash({ x1: bottomPivotRightX, y1: geometry.outer.y1, x2: topOuterEdgeCenter.x, y2: topOuterEdgeCenter.y }),
    ];
  }
  if (mechanics.openingKind === "reversible") {
    const cx = (geometry.inner.x0 + geometry.inner.x1) / 2;
    const cy = (geometry.inner.y0 + geometry.inner.y1) / 2;
    return [
      dash({ x1: cx, y1: geometry.outer.y0, x2: geometry.outer.x0, y2: cy }),
      dash({ x1: cx, y1: geometry.outer.y0, x2: geometry.outer.x1, y2: cy }),
      dash({ x1: cx, y1: geometry.outer.y1, x2: geometry.outer.x0, y2: cy }),
      dash({ x1: cx, y1: geometry.outer.y1, x2: geometry.outer.x1, y2: cy }),
    ];
  }
  return [
    dash({ x1: pivotX, y1: topPivotY, x2: openingSideMidpoint.x, y2: openingSideMidpoint.y }),
    dash({ x1: pivotX, y1: bottomPivotY, x2: openingSideMidpoint.x, y2: openingSideMidpoint.y }),
  ];
}

function buildExternalTiltTurnShortcutSymbol(
  glassBounds: { x0: number; x1: number; y0: number; y1: number },
  insertion: string
): DrawingLine[] {
  const dash = (line: Omit<DrawingLine, "kind">): DrawingLine => ({
    kind: "line",
    dashed: true,
    stroke: "#111",
    strokeWidth: 1.1,
    ...line,
  });
  const internalHingeSide =
    isRightHandInsertion(insertion) ? "right" : "left";
  const mirroredHingeSide = internalHingeSide === "left" ? "right" : "left";
  const glassPoints = {
    topLeft: { x: glassBounds.x0, y: glassBounds.y0 },
    topRight: { x: glassBounds.x1, y: glassBounds.y0 },
    bottomLeft: { x: glassBounds.x0, y: glassBounds.y1 },
    bottomRight: { x: glassBounds.x1, y: glassBounds.y1 },
    topCenter: { x: (glassBounds.x0 + glassBounds.x1) / 2, y: glassBounds.y0 },
    leftCenter: { x: glassBounds.x0, y: (glassBounds.y0 + glassBounds.y1) / 2 },
    rightCenter: { x: glassBounds.x1, y: (glassBounds.y0 + glassBounds.y1) / 2 },
  };
  if (mirroredHingeSide === "left") {
    return [
      dash({ x1: glassPoints.topLeft.x, y1: glassPoints.topLeft.y, x2: glassPoints.rightCenter.x, y2: glassPoints.rightCenter.y }),
      dash({ x1: glassPoints.bottomLeft.x, y1: glassPoints.bottomLeft.y, x2: glassPoints.rightCenter.x, y2: glassPoints.rightCenter.y }),
      dash({ x1: glassPoints.bottomLeft.x, y1: glassPoints.bottomLeft.y, x2: glassPoints.topCenter.x, y2: glassPoints.topCenter.y }),
      dash({ x1: glassPoints.topCenter.x, y1: glassPoints.topCenter.y, x2: glassPoints.bottomRight.x, y2: glassPoints.bottomRight.y }),
    ];
  }
  return [
    dash({ x1: glassPoints.topRight.x, y1: glassPoints.topRight.y, x2: glassPoints.leftCenter.x, y2: glassPoints.leftCenter.y }),
    dash({ x1: glassPoints.bottomRight.x, y1: glassPoints.bottomRight.y, x2: glassPoints.leftCenter.x, y2: glassPoints.leftCenter.y }),
    dash({ x1: glassPoints.bottomRight.x, y1: glassPoints.bottomRight.y, x2: glassPoints.topCenter.x, y2: glassPoints.topCenter.y }),
    dash({ x1: glassPoints.topCenter.x, y1: glassPoints.topCenter.y, x2: glassPoints.bottomLeft.x, y2: glassPoints.bottomLeft.y }),
  ];
}

function resolveVisibleBeadPx(
  beadVisibleFaceMm: number | null | undefined,
  glassInsetMm: number | null | undefined,
  scale: number
) {
  const source =
    Number.isFinite(Number(beadVisibleFaceMm)) && Number(beadVisibleFaceMm) > 0
      ? Number(beadVisibleFaceMm)
      : Number.isFinite(Number(glassInsetMm)) && Number(glassInsetMm) > 0
        ? Number(glassInsetMm)
        : null;
  return source === null ? null : mmToPx(source, scale, 0, 18);
}

function buildMitredLoop(bounds: { x0: number; x1: number; y0: number; y1: number }, widths: { left: number; right: number; top: number; bottom: number }, fill: string, role: string): { shapes: DrawingPolygon[]; innerBounds: { x0: number; x1: number; y0: number; y1: number } } {
  const innerBounds = insetBounds(bounds, widths);
  const safeInnerBounds = {
    x0: Math.min(innerBounds.x0, bounds.x1 - 1),
    x1: Math.max(innerBounds.x1, bounds.x0 + 1),
    y0: Math.min(innerBounds.y0, bounds.y1 - 1),
    y1: Math.max(innerBounds.y1, bounds.y0 + 1),
  };
  return {
    innerBounds: safeInnerBounds,
    shapes: [
      {
        kind: "polygon",
        points: [
          { x: bounds.x0, y: bounds.y0 },
          { x: bounds.x1, y: bounds.y0 },
          { x: safeInnerBounds.x1, y: safeInnerBounds.y0 },
          { x: safeInnerBounds.x0, y: safeInnerBounds.y0 },
        ],
        stroke: "#111",
        strokeWidth: 1,
        fill,
        role: `${role}_top`,
      },
      {
        kind: "polygon",
        points: [
          { x: bounds.x1, y: bounds.y0 },
          { x: bounds.x1, y: bounds.y1 },
          { x: safeInnerBounds.x1, y: safeInnerBounds.y1 },
          { x: safeInnerBounds.x1, y: safeInnerBounds.y0 },
        ],
        stroke: "#111",
        strokeWidth: 1,
        fill,
        role: `${role}_right`,
      },
      {
        kind: "polygon",
        points: [
          { x: bounds.x0, y: bounds.y1 },
          { x: bounds.x1, y: bounds.y1 },
          { x: safeInnerBounds.x1, y: safeInnerBounds.y1 },
          { x: safeInnerBounds.x0, y: safeInnerBounds.y1 },
        ],
        stroke: "#111",
        strokeWidth: 1,
        fill,
        role: `${role}_bottom`,
      },
      {
        kind: "polygon",
        points: [
          { x: bounds.x0, y: bounds.y0 },
          { x: safeInnerBounds.x0, y: safeInnerBounds.y0 },
          { x: safeInnerBounds.x0, y: safeInnerBounds.y1 },
          { x: bounds.x0, y: bounds.y1 },
        ],
        stroke: "#111",
        strokeWidth: 1,
        fill,
        role: `${role}_left`,
      },
    ],
  };
}

function resolveFixedCellEdgeBeadPx(input: {
  side: "left" | "right" | "top" | "bottom";
  col: number;
  row: number;
  fieldsX: number;
  fieldsY: number;
  scale: number;
  junctionTypeByKey: Map<string, string>;
  profiles: ResolvedSectionProfileSet | null;
}) {
  const { side, col, row, fieldsX, fieldsY, scale, junctionTypeByKey, profiles } = input;
  const fallbackProfile =
    side === "left"
      ? profiles?.frame.jambLeft
      : side === "right"
        ? profiles?.frame.jambRight
        : side === "top"
          ? profiles?.frame.head
          : profiles?.frame.bottom;
  const fallbackBeadPx = resolveVisibleBeadPx(
    fallbackProfile?.beadVisibleFaceMm,
    fallbackProfile?.glassInsetMm,
    scale
  );

  if (fieldsX <= 1 && fieldsY <= 1) return fallbackBeadPx;

  const sourceProfile =
    side === "left" && col > 0 && junctionTypeByKey.get(`vertical-${col}`) === "static"
      ? profiles?.mullion
      : side === "right" && col < fieldsX - 1 && junctionTypeByKey.get(`vertical-${col + 1}`) === "static"
        ? profiles?.mullion
        : side === "top" && row > 0 && junctionTypeByKey.get(`horizontal-${row}`) === "static"
          ? profiles?.transom
          : side === "bottom" && row < fieldsY - 1 && junctionTypeByKey.get(`horizontal-${row + 1}`) === "static"
            ? profiles?.transom
            : fallbackProfile;

  const nextBeadPx = resolveVisibleBeadPx(
    sourceProfile?.beadVisibleFaceMm,
    sourceProfile?.glassInsetMm,
    scale
  );
  return nextBeadPx ?? fallbackBeadPx;
}

function buildFixedFieldUnit(
  fieldBounds: { x0: number; x1: number; y0: number; y1: number },
  frameInsets: { left: number; right: number; top: number; bottom: number },
  beadInsets: { left: number | null; right: number | null; top: number | null; bottom: number | null },
  frameFinishFill: string
) {
  const frameOpeningBounds = insetBounds(fieldBounds, frameInsets);
  let previewBounds = frameOpeningBounds;
  const frameShapes: DrawingShape[] = [];

  const hasVisibleBead =
    beadInsets.left !== null &&
    beadInsets.right !== null &&
    beadInsets.top !== null &&
    beadInsets.bottom !== null;

  if (hasVisibleBead) {
    const beadLoop = buildMitredLoop(
      frameOpeningBounds,
      {
        left: beadInsets.left ?? 0,
        right: beadInsets.right ?? 0,
        top: beadInsets.top ?? 0,
        bottom: beadInsets.bottom ?? 0,
      },
      frameFinishFill,
      "glazing_bead"
    );
    frameShapes.push(...beadLoop.shapes);
    previewBounds = beadLoop.innerBounds;
  }

  const glassShape: DrawingShape = {
    kind: "rect",
    x: previewBounds.x0,
    y: previewBounds.y0,
    width: Math.max(1, previewBounds.x1 - previewBounds.x0),
    height: Math.max(1, previewBounds.y1 - previewBounds.y0),
    stroke: "#111",
    strokeWidth: 1,
    fill: "#b9d7f3",
    role: "glass_fixed",
  };

  return {
    frameShapes,
    glassShape,
    previewBounds,
  };
}

function buildTrickleVentSlotRects(
  fieldBounds: { x0: number; x1: number; y0: number; y1: number },
  frameTopY: number,
  trickleVent: NonNullable<ResolvedSectionProfileSet["trickleVent"]>,
  scale: number
): DrawingRect[] {
  const slotWidthsPx = trickleVent.slotWidthsMm.map((width) => Math.max(1, mmToPx(width, scale, 0, 240)));
  const slotGapsPx = trickleVent.slotGapsMm.map((gap) => Math.max(0, mmToPx(gap, scale, 0, 60)));
  if (!slotWidthsPx.length) return [];
  const slotHeightPx = Math.max(1, mmToPx(trickleVent.slotHeightMm, scale, 0, 40));
  const totalWidthPx =
    sum(slotWidthsPx) + sum(slotGapsPx);
  const startX = (fieldBounds.x0 + fieldBounds.x1 - totalWidthPx) / 2;
  const y = frameTopY + mmToPx(trickleVent.slotTopOffsetMm, scale, 0, 80);
  const slots: DrawingRect[] = [];
  let cursorX = startX;
  slotWidthsPx.forEach((widthPx, index) => {
    slots.push({
      kind: "rect",
      x: cursorX,
      y,
      width: widthPx,
      height: slotHeightPx,
      stroke: "#111",
      strokeWidth: 1,
      fill: "transparent",
      role: "trickle_vent_slot",
    });
    cursorX += widthPx + (slotGapsPx[index] ?? 0);
  });
  return slots;
}

function buildInternalSashJoinLines(
  frameBounds: { x0: number; x1: number; y0: number; y1: number },
  sashOuter: { x0: number; x1: number; y0: number; y1: number },
  beadOuterBounds: { x0: number; x1: number; y0: number; y1: number },
  scale: number,
  topJoinReferencePx: number
): DrawingLine[] {
  const topJoinY = frameBounds.y0 + topJoinReferencePx;
  const bottomJoinY = frameBounds.y1 - mmToPx(63, scale, 0, 80);
  const verticalJoinInset = mmToPx(57, scale, 0, 80);
  const topVerticalBottomY = Math.min(beadOuterBounds.y0, sashOuter.y0 + verticalJoinInset);
  const bottomVerticalTopY = Math.max(beadOuterBounds.y1, sashOuter.y1 - verticalJoinInset);
  const stroke = "#111";
  const strokeWidth = 1;
  return [
    { kind: "line", x1: frameBounds.x0, y1: topJoinY, x2: sashOuter.x0, y2: topJoinY, stroke, strokeWidth, role: "frame_sash_join_top_left" },
    { kind: "line", x1: sashOuter.x1, y1: topJoinY, x2: frameBounds.x1, y2: topJoinY, stroke, strokeWidth, role: "frame_sash_join_top_right" },
    { kind: "line", x1: frameBounds.x0, y1: bottomJoinY, x2: sashOuter.x0, y2: bottomJoinY, stroke, strokeWidth, role: "frame_sash_join_bottom_left" },
    { kind: "line", x1: sashOuter.x1, y1: bottomJoinY, x2: frameBounds.x1, y2: bottomJoinY, stroke, strokeWidth, role: "frame_sash_join_bottom_right" },
    { kind: "line", x1: sashOuter.x0 + verticalJoinInset, y1: sashOuter.y0, x2: sashOuter.x0 + verticalJoinInset, y2: topVerticalBottomY, stroke, strokeWidth, role: "sash_join_top_left" },
    { kind: "line", x1: sashOuter.x1 - verticalJoinInset, y1: sashOuter.y0, x2: sashOuter.x1 - verticalJoinInset, y2: topVerticalBottomY, stroke, strokeWidth, role: "sash_join_top_right" },
    { kind: "line", x1: sashOuter.x0 + verticalJoinInset, y1: bottomVerticalTopY, x2: sashOuter.x0 + verticalJoinInset, y2: sashOuter.y1, stroke, strokeWidth, role: "sash_join_bottom_left" },
    { kind: "line", x1: sashOuter.x1 - verticalJoinInset, y1: bottomVerticalTopY, x2: sashOuter.x1 - verticalJoinInset, y2: sashOuter.y1, stroke, strokeWidth, role: "sash_join_bottom_right" },
  ];
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
        y: frame.y + frame.height + 46,
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

export function buildWindowDrawingModel(pos: PosDraft): DrawingModel {
  const widthMm = clamp(Math.round(pos.widthMm || 0), 300, 6000);
  const heightMm = clamp(Math.round(pos.heightMm || 0), 300, 6000);
  const fieldsX = clamp(Math.round(pos.fieldsX || 1), 1, 16);
  const fieldsY = clamp(Math.round(pos.fieldsY || 1), 1, 16);
  const profiles = pos.resolvedProfiles ?? null;
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

  const frameLeftMetrics = resolveInternalFrameFaceMetrics(profiles?.frame.jambLeft, profiles?.sash.jambLeft, scale);
  const frameRightMetrics = resolveInternalFrameFaceMetrics(profiles?.frame.jambRight, profiles?.sash.jambRight, scale);
  const frameTopMetrics = resolveInternalFrameFaceMetrics(profiles?.frame.head, profiles?.sash.head, scale);
  const frameBottomMetrics = resolveInternalFrameFaceMetrics(profiles?.frame.bottom, profiles?.sash.bottom, scale);
  const frameLeft = frameLeftMetrics.frameBandPx;
  const frameRight = frameRightMetrics.frameBandPx;
  const frameTop = frameTopMetrics.frameBandPx;
  const frameBottom = frameBottomMetrics.frameBandPx;
  const cillHeight = profiles?.cill ? mmToPx(profiles.cill.visibleFaceWidthMm, scale, 0, 30) : 0;

  const clearX = frameX + frameLeft;
  const clearY = frameY + frameTop;
  const clearWidth = Math.max(1, frameWidth - frameLeft - frameRight);
  const clearHeight = Math.max(1, frameHeight - frameTop - frameBottom);

  const columnSplits = normalizeSplits(widthMm, fieldsX, pos.colWidthsMm);
  const rowSplits = normalizeSplits(heightMm, fieldsY, pos.rowHeightsMm);
  const insertions = normalizeCellInsertions(fieldsX, fieldsY, pos.cellInsertions, pos.insertion);
  const view = pos.orientationView ?? "inside";
  const frameFinishFill = resolveFrameFinishColour(
    pos.windowConfiguration?.frame?.finishMode,
    pos.windowConfiguration?.frame?.internalColour,
    pos.windowConfiguration?.frame?.externalColour,
    view
  );
  const junctionTypeByKey = new Map(
    (pos.windowConfiguration?.junctions ?? []).map((junction) => [junction.key, String(junction.type || "static")])
  );
  const fieldConfigByKey = new Map(
    (pos.windowConfiguration?.fields ?? []).map((field) => [field.key, field])
  );
  const defaultHandleHeightMm = pos.windowConfiguration?.hardware?.defaultHandleHeightMm ?? 1050;
  const defaultHingeType = pos.windowConfiguration?.hardware?.defaultHingeType ?? "Standard";
  const isFlyingPair = fieldsX === 2 && fieldsY === 1 && junctionTypeByKey.get("vertical-1") === "flying";
  const leftInsertion = insertions[keyForCell(0, 0)] ?? pos.insertion;
  const rightInsertion = insertions[keyForCell(1, 0)] ?? pos.insertion;
  const flyingMasterCol =
    isFlyingPair && isTurnOnlyInsertion(leftInsertion) && isTiltAndTurnInsertion(rightInsertion)
      ? 0
      : isFlyingPair && isTiltAndTurnInsertion(leftInsertion) && isTurnOnlyInsertion(rightInsertion)
        ? 1
        : null;
  const configuredMeetingGapMm = Number(profiles?.flyingMullion.meetingGapMm || 5);
  const flyingGapPx = mmToPx(configuredMeetingGapMm, scale, 1, 12);
  const verticalJunctionWidths = Array.from({ length: Math.max(0, fieldsX - 1) }, (_, index) => {
    const key = `vertical-${index + 1}`;
    const usesFlying = junctionTypeByKey.get(key) === "flying";
    return usesFlying ? flyingGapPx : mmToPx(profiles?.mullion.visibleFaceWidthMm ?? 76, scale);
  });
  const horizontalJunctionWidths = Array.from({ length: Math.max(0, fieldsY - 1) }, () =>
    mmToPx(profiles?.transom.visibleFaceWidthMm ?? 76, scale)
  );

  const usableFieldWidth = Math.max(1, clearWidth - sum(verticalJunctionWidths));
  const usableFieldHeight = Math.max(1, clearHeight - sum(horizontalJunctionWidths));
  const totalColumnMm = sum(columnSplits);
  const totalRowMm = sum(rowSplits);

  const columnWidthsPx = columnSplits.map((value, index, values) => {
    if (index < values.length - 1) return Math.max(1, (value / totalColumnMm) * usableFieldWidth);
    return Math.max(1, usableFieldWidth - sum(values.slice(0, -1).map((current) => (current / totalColumnMm) * usableFieldWidth)));
  });
  const rowHeightsPx = rowSplits.map((value, index, values) => {
    if (index < values.length - 1) return Math.max(1, (value / totalRowMm) * usableFieldHeight);
    return Math.max(1, usableFieldHeight - sum(values.slice(0, -1).map((current) => (current / totalRowMm) * usableFieldHeight)));
  });

  const columnBounds: Array<{ start: number; end: number }> = [];
  const rowBounds: Array<{ start: number; end: number }> = [];
  const verticalJunctionRects: Array<{ index: number; x: number; y: number; width: number; height: number; type: "static" | "flying" }> = [];
  const horizontalJunctionRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];

  let xCursor = clearX;
  for (let index = 0; index < columnWidthsPx.length; index += 1) {
    const width = columnWidthsPx[index];
    columnBounds.push({ start: xCursor, end: xCursor + width });
    xCursor += width;
    if (index < verticalJunctionWidths.length) {
      const widthPx = verticalJunctionWidths[index];
      verticalJunctionRects.push({
        index: index + 1,
        x: xCursor,
        y: clearY,
        width: widthPx,
        height: clearHeight,
        type: junctionTypeByKey.get(`vertical-${index + 1}`) === "flying" ? "flying" : "static",
      });
      xCursor += widthPx;
    }
  }

  let yCursor = clearY;
  for (let index = 0; index < rowHeightsPx.length; index += 1) {
    const height = rowHeightsPx[index];
    rowBounds.push({ start: yCursor, end: yCursor + height });
    yCursor += height;
    if (index < horizontalJunctionWidths.length) {
      const heightPx = horizontalJunctionWidths[index];
      horizontalJunctionRects.push({
        index: index + 1,
        x: clearX,
        y: yCursor,
        width: clearWidth,
        height: heightPx,
      });
      yCursor += heightPx;
    }
  }

  const frameShapes: DrawingShape[] = [
    {
      kind: "rect",
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      stroke: "#111",
      strokeWidth: 1.6,
      fill: frameFinishFill,
      role: "frame_outer",
    },
  ];

  if (cillHeight > 0) {
    frameShapes.push({
      kind: "rect",
      x: frameX,
      y: frameY + frameHeight,
      width: frameWidth,
      height: cillHeight,
      stroke: "#111",
      strokeWidth: 1,
      fill: frameFinishFill,
      role: "cill",
    });
  }

  const sashShapes: DrawingShape[] = [];
  const glassShapes: DrawingShape[] = [];
  const junctionShapes: DrawingShape[] = [];
  const labels: DrawingLabel[] = [];
  const handles: DrawingHandle[] = [];
  const markers: DrawingMarker[] = [];
  const interactionCells: Array<{ key: string; x: number; y: number; width: number; height: number }> = [];

  for (const rect of verticalJunctionRects) {
    if (rect.type === "flying") continue;
    junctionShapes.push({
      kind: "rect",
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      stroke: "#111",
      strokeWidth: 1,
      fill: frameFinishFill,
      role: "vertical_junction",
    });
  }

  for (const rect of horizontalJunctionRects) {
    junctionShapes.push({
      kind: "rect",
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      stroke: "#111",
      strokeWidth: 1,
      fill: frameFinishFill,
      role: "horizontal_junction",
    });
  }

  let markerIndex = 1;
  for (let row = 0; row < fieldsY; row += 1) {
    for (let col = 0; col < fieldsX; col += 1) {
      const x0 = columnBounds[col].start;
      const x1 = columnBounds[col].end;
      const y0 = rowBounds[row].start;
      const y1 = rowBounds[row].end;
      const key = keyForCell(col, row);
      const insertion = insertions[key] ?? pos.insertion;
      const cellBounds = { x0, x1, y0, y1 };
      interactionCells.push({ key, x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) });

      const hasSashCell = !isFixedInsertion(insertion) || isFixedSashInsertion(insertion);
      const openingCell = !isFixedInsertion(insertion) && !isFixedSashInsertion(insertion);
      if (view === "inside" && profiles?.trickleVent && supportsTrickleVentInsertion(insertion)) {
        frameShapes.push(
          ...buildTrickleVentSlotRects(
            cellBounds,
            frameY,
            profiles.trickleVent,
            scale
          )
        );
      }
      if (view === "outside" && fieldsX === 1 && fieldsY === 1 && (!openingCell || isTiltAndTurnInsertion(insertion))) {
        const isSashBasedExternal = hasSashCell;
        const frameOuterBounds = { x0: frameX, x1: frameX + frameWidth, y0: frameY, y1: frameY + frameHeight };
        const frameCladdingLeftMm = isSashBasedExternal ? profiles?.sash.jambLeft?.visibleFaceWidthMm ?? 78 : 78;
        const frameCladdingRightMm = isSashBasedExternal ? profiles?.sash.jambRight?.visibleFaceWidthMm ?? frameCladdingLeftMm : 78;
        const frameCladdingTopMm = isSashBasedExternal ? profiles?.sash.head?.visibleFaceWidthMm ?? frameCladdingLeftMm : 78;
        const frameCladdingBottomMm = isSashBasedExternal ? profiles?.sash.bottom?.visibleFaceWidthMm ?? 78 : 78;
        const configuredFrameInsetLeftPx = mmToPx(profiles?.frame.jambLeft.insetMm ?? 0, scale, 0, 60);
        const configuredFrameInsetRightPx = mmToPx(profiles?.frame.jambRight.insetMm ?? 0, scale, 0, 60);
        const configuredFrameInsetTopPx = mmToPx(profiles?.frame.head.insetMm ?? 0, scale, 0, 60);
        const configuredFrameInsetBottomPx = mmToPx(profiles?.frame.bottom.insetMm ?? 0, scale, 0, 60);
        const frameRevealLeftPx = Math.max(configuredFrameInsetLeftPx, frameLeft - mmToPx(frameCladdingLeftMm, scale, 0, 120));
        const frameRevealRightPx = Math.max(configuredFrameInsetRightPx, frameRight - mmToPx(frameCladdingRightMm, scale, 0, 120));
        const frameRevealTopPx = Math.max(configuredFrameInsetTopPx, frameTop - mmToPx(frameCladdingTopMm, scale, 0, 120));
        const frameRevealBottomPx = Math.max(configuredFrameInsetBottomPx, frameBottom - mmToPx(frameCladdingBottomMm, scale, 0, 120));
        const frameCladdingOuterBounds = insetBounds(frameOuterBounds, {
          left: frameRevealLeftPx,
          right: frameRevealRightPx,
          top: frameRevealTopPx,
          bottom: frameRevealBottomPx,
        });
        const frameCladdingLoop = buildMitredLoop(
          frameCladdingOuterBounds,
          {
            left: mmToPx(frameCladdingLeftMm, scale, 0, 120),
            right: mmToPx(frameCladdingRightMm, scale, 0, 120),
            top: mmToPx(frameCladdingTopMm, scale, 0, 120),
            bottom: mmToPx(frameCladdingBottomMm, scale, 0, 120),
          },
          frameFinishFill,
          "frame_cladding"
        );
        frameShapes.push(...frameCladdingLoop.shapes);

        const glassBounds = isSashBasedExternal
          ? (() => {
              const sashGapPx = mmToPx(4.81, scale, 0, 40);
              const sashCladdingOuterBounds = insetBounds(frameCladdingLoop.innerBounds, {
                left: sashGapPx,
                right: sashGapPx,
                top: sashGapPx,
                bottom: sashGapPx,
              });
              const sashCladdingLoop = buildMitredLoop(
                sashCladdingOuterBounds,
                {
                  left: mmToPx(32.7, scale, 0, 120),
                  right: mmToPx(32.7, scale, 0, 120),
                  top: mmToPx(32.7, scale, 0, 120),
                  bottom: mmToPx(32.5, scale, 0, 120),
                },
                frameFinishFill,
                "sash_cladding"
              );
              sashShapes.push(...sashCladdingLoop.shapes);
              return sashCladdingLoop.innerBounds;
            })()
          : frameCladdingLoop.innerBounds;

        glassShapes.push({
          kind: "rect",
          x: glassBounds.x0,
          y: glassBounds.y0,
          width: Math.max(1, glassBounds.x1 - glassBounds.x0),
          height: Math.max(1, glassBounds.y1 - glassBounds.y0),
          stroke: "#111",
          strokeWidth: 1,
          fill: "#b9d7f3",
          role: isSashBasedExternal ? "glass_opening" : "glass_fixed",
        });
        if (openingCell && isTiltAndTurnInsertion(insertion)) {
          glassShapes.push(...buildExternalTiltTurnShortcutSymbol(glassBounds, insertion));
        }

        labels.push({
          x: glassBounds.x0 + 8,
          y: glassBounds.y0 + 16,
          value: insertion,
          fontSize: 9,
          fill: "#3f3f46",
          anchor: "start",
          role: "field_label",
        });
        markers.push({
          x: (x0 + x1) / 2,
          y: (y0 + y1) / 2,
          radius: 16,
          value: String(markerIndex),
          role: "field_marker",
        });
        markerIndex += 1;
        continue;
      }
      let previewBounds = cellBounds;
      if (hasSashCell && profiles?.sash.head && profiles?.sash.jambLeft && profiles?.sash.jambRight && profiles?.sash.bottom) {
        const fieldConfig = fieldConfigByKey.get(key);
        const mechanics = resolveFieldMechanics({
          insertion,
          view,
          col,
          isFlyingPair,
          flyingMasterCol,
          hingeType: fieldConfig?.hingeType ?? defaultHingeType,
        });
        const sashLeftInset = mmToPx(profiles.sash.jambLeft.insetMm, scale, 0, 18);
        const sashRightInset = mmToPx(profiles.sash.jambRight.insetMm, scale, 0, 18);
        const sashTopInset = mmToPx(profiles.sash.head.insetMm, scale, 0, 18);
        const sashBottomInset = mmToPx(profiles.sash.bottom.insetMm, scale, 0, 18);
        const sashLeftFace = mmToPx(profiles.sash.jambLeft.visibleFaceWidthMm, scale, 3, 24);
        const sashRightFace = mmToPx(profiles.sash.jambRight.visibleFaceWidthMm, scale, 3, 24);
        const sashTopFace = mmToPx(profiles.sash.head.visibleFaceWidthMm, scale, 3, 24);
        const sashBottomFace = mmToPx(profiles.sash.bottom.visibleFaceWidthMm, scale, 3, 24);
        const leftOverlapPx = view === "inside" && col === 0 ? frameLeftMetrics.sashOverlapPx : 0;
        const rightOverlapPx = view === "inside" && col === fieldsX - 1 ? frameRightMetrics.sashOverlapPx : 0;
        const topOverlapPx = view === "inside" && row === 0 ? frameTopMetrics.sashOverlapPx : 0;
        const bottomOverlapPx = view === "inside" && row === fieldsY - 1 ? frameBottomMetrics.sashOverlapPx : 0;
        const sashRect: DrawingRect = {
          kind: "rect",
          x: x0 + sashLeftInset - leftOverlapPx,
          y: y0 + sashTopInset - topOverlapPx,
          width: Math.max(1, x1 - x0 - sashLeftInset - sashRightInset + leftOverlapPx + rightOverlapPx),
          height: Math.max(1, y1 - y0 - sashTopInset - sashBottomInset + topOverlapPx + bottomOverlapPx),
          stroke: "#111",
          strokeWidth: 1.2,
          fill: frameFinishFill,
          role: "sash_outer",
        };
        const beadOuterBounds = {
          x0: sashRect.x + sashLeftFace,
          x1: sashRect.x + sashRect.width - sashRightFace,
          y0: sashRect.y + sashTopFace,
          y1: sashRect.y + sashRect.height - sashBottomFace,
        };
        const beadLeft = resolveVisibleBeadPx(profiles.sash.jambLeft.beadVisibleFaceMm, profiles.sash.jambLeft.glassInsetMm, scale);
        const beadRight = resolveVisibleBeadPx(profiles.sash.jambRight.beadVisibleFaceMm, profiles.sash.jambRight.glassInsetMm, scale);
        const beadTop = resolveVisibleBeadPx(profiles.sash.head.beadVisibleFaceMm, profiles.sash.head.glassInsetMm, scale);
        const beadBottom = resolveVisibleBeadPx(profiles.sash.bottom.beadVisibleFaceMm, profiles.sash.bottom.glassInsetMm, scale);
        const hasVisibleBead = beadLeft !== null && beadRight !== null && beadTop !== null && beadBottom !== null;
        sashShapes.push(sashRect);
        if (view === "outside") {
          const sashCladdingInsetBounds = insetBounds(
            {
              x0: sashRect.x,
              x1: sashRect.x + sashRect.width,
              y0: sashRect.y,
              y1: sashRect.y + sashRect.height,
            },
            {
              left: sashLeftInset,
              right: sashRightInset,
              top: sashTopInset,
              bottom: sashBottomInset,
            }
          );
          if (sashCladdingInsetBounds.x1 > sashCladdingInsetBounds.x0 && sashCladdingInsetBounds.y1 > sashCladdingInsetBounds.y0) {
            sashShapes.push({
              kind: "rect",
              x: sashCladdingInsetBounds.x0,
              y: sashCladdingInsetBounds.y0,
              width: sashCladdingInsetBounds.x1 - sashCladdingInsetBounds.x0,
              height: sashCladdingInsetBounds.y1 - sashCladdingInsetBounds.y0,
              stroke: "#111",
              strokeWidth: 0.9,
              fill: "transparent",
              role: "sash_cladding_edge",
            });
          }
        }
        if (hasVisibleBead) {
          if (view === "inside") {
            const beadLoop = buildMitredLoop(
              beadOuterBounds,
              {
                left: beadLeft ?? 0,
                right: beadRight ?? 0,
                top: beadTop ?? 0,
                bottom: beadBottom ?? 0,
              },
              frameFinishFill,
              "glazing_bead"
            );
            sashShapes.push(...beadLoop.shapes);
          } else {
            const beadRect: DrawingRect = {
              kind: "rect",
              x: beadOuterBounds.x0,
              y: beadOuterBounds.y0,
              width: Math.max(1, beadOuterBounds.x1 - beadOuterBounds.x0),
              height: Math.max(1, beadOuterBounds.y1 - beadOuterBounds.y0),
              stroke: "#111",
              strokeWidth: 1,
              fill: frameFinishFill,
              role: "glazing_bead",
            };
            sashShapes.push(beadRect);
          }
        }
        const sashGeometry: SashGeometry = {
          outer: {
            x0: sashRect.x,
            x1: sashRect.x + sashRect.width,
            y0: sashRect.y,
            y1: sashRect.y + sashRect.height,
          },
          inner: insetBounds(beadOuterBounds, {
            left: beadLeft ?? 0,
            right: beadRight ?? 0,
            top: beadTop ?? 0,
            bottom: beadBottom ?? 0,
          }),
          leftFace: sashLeftFace,
          rightFace: sashRightFace,
          topFace: sashTopFace,
          bottomFace: sashBottomFace,
          beadAnchors: {
            topCenter: { x: (beadOuterBounds.x0 + beadOuterBounds.x1) / 2, y: beadOuterBounds.y0 },
            bottomCenter: { x: (beadOuterBounds.x0 + beadOuterBounds.x1) / 2, y: beadOuterBounds.y1 },
            leftCenter: { x: beadOuterBounds.x0, y: (beadOuterBounds.y0 + beadOuterBounds.y1) / 2 },
            rightCenter: { x: beadOuterBounds.x1, y: (beadOuterBounds.y0 + beadOuterBounds.y1) / 2 },
            topLeft: { x: beadOuterBounds.x0, y: beadOuterBounds.y0 },
            topRight: { x: beadOuterBounds.x1, y: beadOuterBounds.y0 },
            bottomLeft: { x: beadOuterBounds.x0, y: beadOuterBounds.y1 },
            bottomRight: { x: beadOuterBounds.x1, y: beadOuterBounds.y1 },
          },
          mitreCorners: {
            topLeft: { x: beadOuterBounds.x0, y: beadOuterBounds.y0 },
            topRight: { x: beadOuterBounds.x1, y: beadOuterBounds.y0 },
            bottomLeft: { x: beadOuterBounds.x0, y: beadOuterBounds.y1 },
            bottomRight: { x: beadOuterBounds.x1, y: beadOuterBounds.y1 },
          },
        };
        if (view === "inside" && fieldsX === 1 && fieldsY === 1) {
          const topJoinReferencePx = profiles?.trickleVent ? frameTop : mmToPx(63, scale, 0, 80);
          sashShapes.push(
            ...buildInternalSashJoinLines(
              { x0: frameX, x1: frameX + frameWidth, y0: frameY, y1: frameY + frameHeight },
              sashGeometry.outer,
              beadOuterBounds,
              scale,
              topJoinReferencePx
            )
          );
        }
        previewBounds = sashGeometry.inner;
      } else {
        previewBounds = cellBounds;
        const useEdgeAwareFixedCellBeads = fieldsX > 1 || fieldsY > 1;
        const beadLeft = useEdgeAwareFixedCellBeads
          ? resolveFixedCellEdgeBeadPx({ side: "left", col, row, fieldsX, fieldsY, scale, junctionTypeByKey, profiles })
          : resolveVisibleBeadPx(profiles?.frame.jambLeft.beadVisibleFaceMm, profiles?.frame.jambLeft.glassInsetMm, scale);
        const beadRight = useEdgeAwareFixedCellBeads
          ? resolveFixedCellEdgeBeadPx({ side: "right", col, row, fieldsX, fieldsY, scale, junctionTypeByKey, profiles })
          : resolveVisibleBeadPx(profiles?.frame.jambRight.beadVisibleFaceMm, profiles?.frame.jambRight.glassInsetMm, scale);
        const beadTop = useEdgeAwareFixedCellBeads
          ? resolveFixedCellEdgeBeadPx({ side: "top", col, row, fieldsX, fieldsY, scale, junctionTypeByKey, profiles })
          : resolveVisibleBeadPx(profiles?.frame.head.beadVisibleFaceMm, profiles?.frame.head.glassInsetMm, scale);
        const beadBottom = useEdgeAwareFixedCellBeads
          ? resolveFixedCellEdgeBeadPx({ side: "bottom", col, row, fieldsX, fieldsY, scale, junctionTypeByKey, profiles })
          : resolveVisibleBeadPx(profiles?.frame.bottom.beadVisibleFaceMm, profiles?.frame.bottom.glassInsetMm, scale);
        const hasVisibleBead = beadLeft !== null && beadRight !== null && beadTop !== null && beadBottom !== null;
        if (hasVisibleBead) {
          if (view === "inside") {
            const beadLoop = buildMitredLoop(
              previewBounds,
              {
                left: beadLeft ?? 0,
                right: beadRight ?? 0,
                top: beadTop ?? 0,
                bottom: beadBottom ?? 0,
              },
              frameFinishFill,
              "glazing_bead"
            );
            frameShapes.push(...beadLoop.shapes);
            previewBounds = beadLoop.innerBounds;
          } else {
            frameShapes.push({
              kind: "rect",
              x: previewBounds.x0,
              y: previewBounds.y0,
              width: Math.max(1, previewBounds.x1 - previewBounds.x0),
              height: Math.max(1, previewBounds.y1 - previewBounds.y0),
              stroke: "#111",
              strokeWidth: 1,
              fill: frameFinishFill,
              role: "glazing_bead",
            });
            previewBounds = insetBounds(previewBounds, {
              left: beadLeft ?? 0,
              right: beadRight ?? 0,
              top: beadTop ?? 0,
              bottom: beadBottom ?? 0,
            });
          }
        }
      }

      glassShapes.push({
        kind: "rect",
        x: previewBounds.x0,
        y: previewBounds.y0,
        width: Math.max(1, previewBounds.x1 - previewBounds.x0),
        height: Math.max(1, previewBounds.y1 - previewBounds.y0),
        stroke: "#111",
        strokeWidth: 1,
        fill: "#b9d7f3",
        role: openingCell ? "glass_opening" : "glass_fixed",
      });
      if (openingCell && profiles?.sash.head && profiles?.sash.jambLeft && profiles?.sash.jambRight && profiles?.sash.bottom) {
        const fieldConfig = fieldConfigByKey.get(key);
        const mechanics = resolveFieldMechanics({
          insertion,
          view,
          col,
          isFlyingPair,
          flyingMasterCol,
          hingeType: fieldConfig?.hingeType ?? defaultHingeType,
        });
        const sashLeftInset = mmToPx(profiles.sash.jambLeft.insetMm, scale, 0, 18);
        const sashRightInset = mmToPx(profiles.sash.jambRight.insetMm, scale, 0, 18);
        const sashTopInset = mmToPx(profiles.sash.head.insetMm, scale, 0, 18);
        const sashBottomInset = mmToPx(profiles.sash.bottom.insetMm, scale, 0, 18);
        const sashLeftFace = mmToPx(profiles.sash.jambLeft.visibleFaceWidthMm, scale, 3, 24);
        const sashRightFace = mmToPx(profiles.sash.jambRight.visibleFaceWidthMm, scale, 3, 24);
        const sashTopFace = mmToPx(profiles.sash.head.visibleFaceWidthMm, scale, 3, 24);
        const sashBottomFace = mmToPx(profiles.sash.bottom.visibleFaceWidthMm, scale, 3, 24);
        const leftOverlapPx = view === "inside" && col === 0 ? frameLeftMetrics.sashOverlapPx : 0;
        const rightOverlapPx = view === "inside" && col === fieldsX - 1 ? frameRightMetrics.sashOverlapPx : 0;
        const topOverlapPx = view === "inside" && row === 0 ? frameTopMetrics.sashOverlapPx : 0;
        const bottomOverlapPx = view === "inside" && row === fieldsY - 1 ? frameBottomMetrics.sashOverlapPx : 0;
        const sashOuter = {
          x0: x0 + sashLeftInset - leftOverlapPx,
          x1: x1 - sashRightInset + rightOverlapPx,
          y0: y0 + sashTopInset - topOverlapPx,
          y1: y1 - sashBottomInset + bottomOverlapPx,
        };
        const sashInner = {
          x0: sashOuter.x0 + sashLeftFace,
          x1: sashOuter.x1 - sashRightFace,
          y0: sashOuter.y0 + sashTopFace,
          y1: sashOuter.y1 - sashBottomFace,
        };
        const sashGeometry: SashGeometry = {
          outer: sashOuter,
          inner: sashInner,
          leftFace: sashLeftFace,
          rightFace: sashRightFace,
          topFace: sashTopFace,
          bottomFace: sashBottomFace,
        };
        glassShapes.push(
          ...buildOpeningSymbol(
            sashGeometry,
            mechanics,
            fieldConfig?.hingePivotOffsetMm ?? profiles.sash.jambLeft.hingePivotOffsetMm ?? profiles.sash.jambRight.hingePivotOffsetMm,
            scale
          )
        );
        const handle = buildHandle(
          sashGeometry,
          mechanics,
          fieldConfig?.handleHeightMm ?? defaultHandleHeightMm,
          scale,
          profiles.sash.jambLeft.handleAxisOffsetMm ?? profiles.sash.jambRight.handleAxisOffsetMm
        );
        if (handle) handles.push(handle);
      }

      labels.push({
        x: previewBounds.x0 + 8,
        y: previewBounds.y0 + 16,
        value: insertion,
        fontSize: 9,
        fill: "#3f3f46",
        anchor: "start",
        role: "field_label",
      });
      markers.push({
        x: (x0 + x1) / 2,
        y: (y0 + y1) / 2,
        radius: 16,
        value: String(markerIndex),
        role: "field_marker",
      });
      markerIndex += 1;
    }
  }

  const dimensions = buildDimensionAnnotations(
    { x: frameX, y: frameY, width: frameWidth, height: frameHeight + cillHeight },
    widthMm,
    heightMm
  );

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: sashShapes },
      { id: "glass", role: "glass", shapes: glassShapes },
      { id: "junctions", role: "junctions", shapes: junctionShapes },
    ],
    geometry: {
      frame: frameShapes,
      sash: sashShapes,
      glass: glassShapes,
      junctions: junctionShapes,
    },
    annotations: {
      dimensions,
      labels,
      handles,
      markers,
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: profiles?.operationType ?? "fixed",
      sectionReferences: profiles?.sectionReferenceIds ?? [],
      referenceInputs: profiles?.referenceInputs ?? [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "sash", "glass", "junctions", "dimensions", "annotations", "cill"],
    },
    interaction: {
      cells: interactionCells,
      verticalJunctions: verticalJunctionRects.map((rect) => ({
        index: rect.index,
        x: rect.x + rect.width / 2,
        y1: rect.y,
        y2: rect.y + rect.height,
      })),
      horizontalJunctions: horizontalJunctionRects.map((rect) => ({
        index: rect.index,
        y: rect.y + rect.height / 2,
        x1: rect.x,
        x2: rect.x + rect.width,
      })),
    },
  };
}
