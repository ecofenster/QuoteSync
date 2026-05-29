import type { DrawingRect, DrawingShape } from "../../configurator/rendering/drawingModel";
import type {
  B92ProfileSectionProofBounds,
  B92ProfileSectionProofView,
  B92ProfileSectionProofViewGeometry,
} from "./b92ProfileSectionProofGeometry";

export type B92ProfileSectionProofSemanticOverlay = {
  styledFamily: boolean;
  frameRegions: DrawingShape[];
  profileRegions: DrawingShape[];
  glassRegions: DrawingShape[];
  notes: string[];
};

const FRAME_FILL = "#f4f4f5";
const PROFILE_FILL = FRAME_FILL;
const GLASS_FILL = "#b9d7f3";
const GLASS_STROKE = "#64748b";
const FILL_SEAM_OVERLAP = 0.75;

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return {
    kind: "rect",
    strokeWidth: 0,
    ...input,
  };
}

function translateBounds(bounds: B92ProfileSectionProofBounds, geometry: B92ProfileSectionProofViewGeometry, pad: number) {
  return {
    x: bounds.x + pad - geometry.bounds.x,
    y: bounds.y + pad - geometry.bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function derivedRect(
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fill: string,
  role: string,
  stroke = "none",
  strokeWidth = 0
) {
  return rect({
    ...translateBounds(
      {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      },
      geometry,
      pad
    ),
    fill,
    stroke,
    strokeWidth,
    role,
  });
}

function derivedFillRect(
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fill: string,
  role: string
) {
  return derivedRect(geometry, pad, x1, y1, x2, y2, fill, role, "none", 0);
}

function derivedCentreProfileFill(
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  return derivedFillRect(
    geometry,
    pad,
    x1,
    y1 - FILL_SEAM_OVERLAP,
    x2,
    y2 + FILL_SEAM_OVERLAP,
    PROFILE_FILL,
    "b92-proof-derived-centre-profile"
  );
}

function frameFill(geometry: B92ProfileSectionProofViewGeometry, pad: number) {
  return rect({
    ...translateBounds(geometry.bounds, geometry, pad),
    fill: FRAME_FILL,
    stroke: "none",
    role: "b92-proof-derived-frame-body-fill",
  });
}

function buildSingleFieldFixedOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  const glass =
    view === "internal"
      ? derivedRect(geometry, pad, 77.975, 77.975, 921.975, 906.975, GLASS_FILL, "b92-proof-derived-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 80.975, 80.975, 918.975, 903.975, GLASS_FILL, "b92-proof-derived-glass", GLASS_STROKE, 0.7);
  return {
    styledFamily: true,
    frameRegions: [frameFill(geometry, pad)],
    profileRegions: [],
    glassRegions: [glass],
    notes: ["Frame and glass fill are bounded by repeated approved proof coordinates."],
  };
}

function buildSingleFieldTiltTurnOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  const glass =
    view === "internal"
      ? derivedRect(geometry, pad, 145.475, 145.476, 914.475, 899.476, GLASS_FILL, "b92-proof-derived-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 148.575, 148.575, 911.35, 896.375, GLASS_FILL, "b92-proof-derived-glass", GLASS_STROKE, 0.7);
  return {
    styledFamily: true,
    frameRegions: [frameFill(geometry, pad)],
    profileRegions: [],
    glassRegions: [glass],
    notes: ["Tilt-turn glass fill uses the approved inner sash/profile coordinate rectangle."],
  };
}

function buildTwoFieldFixedFixedOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  const leftGlass =
    view === "internal"
      ? derivedRect(geometry, pad, 108, 108, 991, 952, GLASS_FILL, "b92-proof-derived-left-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 111, 111, 988, 934, GLASS_FILL, "b92-proof-derived-left-glass", GLASS_STROKE, 0.7);
  const rightGlass =
    view === "internal"
      ? derivedRect(geometry, pad, 1069, 108, 1952, 952, GLASS_FILL, "b92-proof-derived-right-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 1072, 111, 1949, 934, GLASS_FILL, "b92-proof-derived-right-glass", GLASS_STROKE, 0.7);
  const centreProfile =
    view === "internal"
      ? derivedCentreProfileFill(geometry, pad, 991, 87, 1069, 973)
      : derivedCentreProfileFill(geometry, pad, 988, 87, 1072, 973);
  return {
    styledFamily: true,
    frameRegions: [frameFill(geometry, pad)],
    profileRegions: [centreProfile],
    glassRegions: [leftGlass, rightGlass],
    notes: ["Two glass fills and centre profile fill are bounded by approved fixed/fixed proof coordinates."],
  };
}

function buildTwoFieldFixedTiltTurnLeftOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  const leftGlass =
    view === "internal"
      ? derivedRect(geometry, pad, 108, 108, 972.25, 900, GLASS_FILL, "b92-proof-derived-left-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 1072, 111, 1949, 934, GLASS_FILL, "b92-proof-derived-left-glass", GLASS_STROKE, 0.7);
  const rightGlass =
    view === "internal"
      ? derivedRect(geometry, pad, 1087.75, 145.5, 1914.5, 899.5, GLASS_FILL, "b92-proof-derived-right-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 148.5, 148.5, 950.5, 896.5, GLASS_FILL, "b92-proof-derived-right-glass", GLASS_STROKE, 0.7);
  const centreProfile =
    view === "internal"
      ? derivedCentreProfileFill(geometry, pad, 972.25, 67.5, 1087.75, 977.5)
      : derivedCentreProfileFill(geometry, pad, 950.5, 111, 1072, 934);
  return {
    styledFamily: true,
    frameRegions: [frameFill(geometry, pad)],
    profileRegions: [centreProfile],
    glassRegions: [leftGlass, rightGlass],
    notes: ["Fixed/tilt-turn-left glass and centre profile fills use approved proof coordinate bands."],
  };
}

function buildTwoFieldTurnTiltTurnOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  const leftGlass =
    view === "internal"
      ? derivedRect(geometry, pad, 145.5, 140, 964.5, 899.5, GLASS_FILL, "b92-proof-derived-left-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 148.2, 148.6, 944.5, 896.4, GLASS_FILL, "b92-proof-derived-left-glass", GLASS_STROKE, 0.7);
  const rightGlass =
    view === "internal"
      ? derivedRect(geometry, pad, 1095.5, 140, 1914.5, 899.5, GLASS_FILL, "b92-proof-derived-right-glass", GLASS_STROKE, 0.7)
      : derivedRect(geometry, pad, 1081.476, 148.6, 1911.502, 896.4, GLASS_FILL, "b92-proof-derived-right-glass", GLASS_STROKE, 0.7);
  const centreProfile =
    view === "internal"
      ? derivedCentreProfileFill(geometry, pad, 985.5, 67.5, 1074.5, 977.5)
      : derivedCentreProfileFill(geometry, pad, 977.2, 87, 1081.476, 973);
  return {
    styledFamily: true,
    frameRegions: [frameFill(geometry, pad)],
    profileRegions: [centreProfile],
    glassRegions: [leftGlass, rightGlass],
    notes: ["Turn/tilt-turn glass and centre profile fills use repeated approved proof coordinate bands."],
  };
}

type AxisInterval = { start: number; end: number; size: number };

function clusterPositions(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: { sum: number; count: number }[] = [];

  for (const value of sorted) {
    const last = clusters.at(-1);
    if (last && Math.abs(last.sum / last.count - value) <= 2.5) {
      last.sum += value;
      last.count += 1;
    } else {
      clusters.push({ sum: value, count: 1 });
    }
  }

  return clusters.map((cluster) => cluster.sum / cluster.count);
}

function largestInteriorGaps(positions: number[], expectedCount: number, minGap: number): AxisInterval[] {
  const gaps: AxisInterval[] = [];

  for (let index = 0; index < positions.length - 1; index += 1) {
    const start = positions[index];
    const end = positions[index + 1];
    const size = end - start;
    if (size >= minGap) gaps.push({ start, end, size });
  }

  return gaps
    .sort((a, b) => b.size - a.size)
    .slice(0, expectedCount)
    .sort((a, b) => a.start - b.start);
}

function lineOverlapsInterval(lineStart: number, lineEnd: number, interval: AxisInterval) {
  const start = Math.min(lineStart, lineEnd);
  const end = Math.max(lineStart, lineEnd);
  return Math.min(end, interval.end) - Math.max(start, interval.start);
}

function deriveHorizontalGlassRegions(
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number,
  fieldCount: number
) {
  const verticalPositions = clusterPositions(
    geometry.lines.flatMap((line) => {
      const dx = Math.abs(line.x2 - line.x1);
      const dy = Math.abs(line.y2 - line.y1);
      return dx <= 3 && dy >= geometry.bounds.height * 0.35 ? [line.x1, line.x2] : [];
    })
  );
  const xIntervals = largestInteriorGaps(verticalPositions, fieldCount, Math.max(220, geometry.bounds.width / (fieldCount * 4)));

  return xIntervals.flatMap((xInterval, index) => {
    const horizontalPositions = clusterPositions(
      geometry.lines.flatMap((line) => {
        const dx = Math.abs(line.x2 - line.x1);
        const dy = Math.abs(line.y2 - line.y1);
        const overlap = lineOverlapsInterval(line.x1, line.x2, xInterval);
        return dy <= 3 && dx >= xInterval.size * 0.45 && overlap >= xInterval.size * 0.45 ? [line.y1, line.y2] : [];
      })
    );
    const [yInterval] = largestInteriorGaps(horizontalPositions, 1, Math.max(220, geometry.bounds.height * 0.28));

    if (!yInterval) return [];

    return [
      derivedRect(
        geometry,
        pad,
        xInterval.start,
        yInterval.start,
        xInterval.end,
        yInterval.end,
        GLASS_FILL,
        `b92-proof-derived-bead-bounded-glass-${index + 1}`,
        GLASS_STROKE,
        0.7
      ),
    ];
  });
}

function deriveVerticalGlassRegions(
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number,
  fieldCount: number
) {
  const horizontalPositions = clusterPositions(
    geometry.lines.flatMap((line) => {
      const dx = Math.abs(line.x2 - line.x1);
      const dy = Math.abs(line.y2 - line.y1);
      return dy <= 3 && dx >= geometry.bounds.width * 0.35 ? [line.y1, line.y2] : [];
    })
  );
  const yIntervals = largestInteriorGaps(horizontalPositions, fieldCount, Math.max(220, geometry.bounds.height / (fieldCount * 4)));

  return yIntervals.flatMap((yInterval, index) => {
    const verticalPositions = clusterPositions(
      geometry.lines.flatMap((line) => {
        const dx = Math.abs(line.x2 - line.x1);
        const dy = Math.abs(line.y2 - line.y1);
        const overlap = lineOverlapsInterval(line.y1, line.y2, yInterval);
        return dx <= 3 && dy >= yInterval.size * 0.45 && overlap >= yInterval.size * 0.45 ? [line.x1, line.x2] : [];
      })
    );
    const [xInterval] = largestInteriorGaps(verticalPositions, 1, Math.max(220, geometry.bounds.width * 0.28));

    if (!xInterval) return [];

    return [
      derivedRect(
        geometry,
        pad,
        xInterval.start,
        yInterval.start,
        xInterval.end,
        yInterval.end,
        GLASS_FILL,
        `b92-proof-derived-bead-bounded-glass-${index + 1}`,
        GLASS_STROKE,
        0.7
      ),
    ];
  });
}

function buildDerivedBeadBoundedOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number,
  fieldCount: number,
  orientation: "horizontal" | "vertical"
): B92ProfileSectionProofSemanticOverlay {
  const glassRegions =
    orientation === "vertical"
      ? deriveVerticalGlassRegions(geometry, pad, fieldCount)
      : deriveHorizontalGlassRegions(geometry, pad, fieldCount);

  return {
    styledFamily: glassRegions.length === fieldCount,
    frameRegions: [frameFill(geometry, pad)],
    profileRegions: [],
    glassRegions,
    notes:
      glassRegions.length === fieldCount
        ? ["Glass fill is derived from large glazing-bead boundary gaps in the approved proof line geometry."]
        : ["Glass fill derivation did not find the expected glazing-bead boundary count for this proof view."],
  };
}

function buildTwoFieldTiltTurnLeftRightOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  void view;
  return buildDerivedBeadBoundedOverlay(geometry, pad, 2, "horizontal");
}

function buildTwoFieldTiltTurnRightLeftOverlay(
  geometry: B92ProfileSectionProofViewGeometry,
  view: B92ProfileSectionProofView,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  void view;
  return buildDerivedBeadBoundedOverlay(geometry, pad, 2, "horizontal");
}

export function buildB92ProfileSectionProofSemanticOverlay(
  familyId: string,
  view: B92ProfileSectionProofView,
  geometry: B92ProfileSectionProofViewGeometry,
  pad: number
): B92ProfileSectionProofSemanticOverlay {
  if (familyId === "b92-1-field-fixed") return buildSingleFieldFixedOverlay(geometry, view, pad);
  if (familyId === "b92-1-field-tilt-turn") return buildSingleFieldTiltTurnOverlay(geometry, view, pad);
  if (familyId === "b92-2-field-fixed-fixed") return buildTwoFieldFixedFixedOverlay(geometry, view, pad);
  if (familyId === "b92-2-field-fixed-tilt-turn-left") return buildTwoFieldFixedTiltTurnLeftOverlay(geometry, view, pad);
  if (familyId === "b92-2-field-turn-tilt-turn") return buildTwoFieldTurnTiltTurnOverlay(geometry, view, pad);
  if (familyId === "b92-2-field-tilt-turn-left-right") return buildTwoFieldTiltTurnLeftRightOverlay(geometry, view, pad);
  if (familyId === "b92-2-field-tilt-turn-right-left") return buildTwoFieldTiltTurnRightLeftOverlay(geometry, view, pad);
  if (familyId === "b92-2-field-fixed-tilt-turn-right") return buildDerivedBeadBoundedOverlay(geometry, pad, 2, "horizontal");
  if (familyId === "b92-2-field-fixed-bottom-fixed-top") return buildDerivedBeadBoundedOverlay(geometry, pad, 2, "vertical");
  if (familyId === "b92-2-field-tilt-turn-bottom-fixed-top") return buildDerivedBeadBoundedOverlay(geometry, pad, 2, "vertical");
  if (familyId === "b92-2-field-fixed-bottom-tilt-turn-top") return buildDerivedBeadBoundedOverlay(geometry, pad, 2, "vertical");
  if (familyId === "b92-3-field-fixed-fixed-fixed") return buildDerivedBeadBoundedOverlay(geometry, pad, 3, "horizontal");
  if (familyId === "b92-3-field-tilt-turn-left-fixed-tilt-turn-right") {
    return buildDerivedBeadBoundedOverlay(geometry, pad, 3, "horizontal");
  }
  if (familyId === "b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference") {
    return buildDerivedBeadBoundedOverlay(geometry, pad, 3, "horizontal");
  }
  return buildDerivedBeadBoundedOverlay(geometry, pad, 1, "horizontal");
}
