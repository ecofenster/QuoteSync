import type { DrawingLine, DrawingModel, DrawingRect, DrawingShape } from "../drawingModel";
import type { AuthorityFixtureRenderResult } from "./authorityFixture.types";
import { EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE } from "./europa92Type5Internal.fixture";

const STROKE = "#111827";
const FRAME_FILL = "#f8fafc";
const SASH_FILL = "#ffffff";
const GLASS_FILL = "#ffffff";
const PROFILE_EDGE = "#334155";
const OPENING_STROKE = "#111827";

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return {
    kind: "rect",
    stroke: input.stroke ?? STROKE,
    strokeWidth: input.strokeWidth ?? 1,
    fill: input.fill ?? "none",
    ...input,
  };
}

function line(input: Omit<DrawingLine, "kind">): DrawingLine {
  return {
    kind: "line",
    stroke: input.stroke ?? STROKE,
    strokeWidth: input.strokeWidth ?? 1,
    ...input,
  };
}

function addProfileBandLines(bounds: { x: number; y: number; width: number; height: number }): DrawingLine[] {
  return [
    line({ x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.width, y2: bounds.y + bounds.height, stroke: PROFILE_EDGE, strokeWidth: 0.8 }),
    line({ x1: bounds.x + bounds.width, y1: bounds.y, x2: bounds.x, y2: bounds.y + bounds.height, stroke: PROFILE_EDGE, strokeWidth: 0.8 }),
  ];
}

function buildTurnLeftOpeningLines(bounds: { x: number; y: number; width: number; height: number }): DrawingLine[] {
  const hingeX = bounds.x;
  const targetX = bounds.x + bounds.width;
  const midY = bounds.y + bounds.height / 2;
  return [
    line({ x1: hingeX, y1: bounds.y, x2: targetX, y2: midY, stroke: OPENING_STROKE, strokeWidth: 0.9, dashed: true }),
    line({ x1: hingeX, y1: bounds.y + bounds.height, x2: targetX, y2: midY, stroke: OPENING_STROKE, strokeWidth: 0.9, dashed: true }),
  ];
}

function buildTiltTurnRightOpeningLines(bounds: { x: number; y: number; width: number; height: number }): DrawingLine[] {
  const hingeX = bounds.x + bounds.width;
  const targetX = bounds.x;
  const midY = bounds.y + bounds.height / 2;
  const topCentreX = bounds.x + bounds.width / 2;
  return [
    line({ x1: hingeX, y1: bounds.y, x2: targetX, y2: midY, stroke: OPENING_STROKE, strokeWidth: 0.9, dashed: true }),
    line({ x1: hingeX, y1: bounds.y + bounds.height, x2: targetX, y2: midY, stroke: OPENING_STROKE, strokeWidth: 0.9, dashed: true }),
    line({ x1: bounds.x, y1: bounds.y + bounds.height, x2: topCentreX, y2: bounds.y, stroke: OPENING_STROKE, strokeWidth: 0.9, dashed: true }),
    line({ x1: bounds.x + bounds.width, y1: bounds.y + bounds.height, x2: topCentreX, y2: bounds.y, stroke: OPENING_STROKE, strokeWidth: 0.9, dashed: true }),
  ];
}

export function buildEuropa92Type5InternalAuthorityDrawingModel(): AuthorityFixtureRenderResult {
  const fixture = EUROPA92_TYPE5_INTERNAL_AUTHORITY_FIXTURE;

  // Fixed authority geometry derived from the approved DXF proportions:
  // 2000 x 1000 overall, 1 row x 2 columns, B92-18 flying mullion at centre,
  // and a visible 5mm centre gap. This is not DXF entity replay.
  const overallWidthMm = 2000;
  const overallHeightMm = 1000;
  const viewBox = { width: 760, height: 420 };
  const frame = { x: 40, y: 34, width: 680, height: 340 };
  const scale = frame.width / overallWidthMm;

  const headMm = 58;
  const jambMm = 37.5;
  const sillMm = 58;
  const sashFaceMm = 57;
  const beadFaceMm = 21;
  const centreAssemblyMm = 100;
  const gapMm = fixture.centreJunction.intentionalGapMm;

  const head = headMm * scale;
  const jamb = jambMm * scale;
  const sill = sillMm * scale;
  const sashFace = sashFaceMm * scale;
  const beadFace = beadFaceMm * scale;
  const centreAssembly = centreAssemblyMm * scale;
  const gap = gapMm * scale;
  const centreX = frame.x + frame.width / 2;
  const mullionLeft = centreX - centreAssembly / 2;
  const mullionRight = centreX + centreAssembly / 2;
  const gapLeft = centreX - gap / 2;
  const gapRight = centreX + gap / 2;

  const frameOpeningTop = frame.y + head;
  const frameOpeningBottom = frame.y + frame.height - sill;
  const leftOuter = {
    x: frame.x + jamb,
    y: frameOpeningTop,
    width: mullionLeft - (frame.x + jamb),
    height: frameOpeningBottom - frameOpeningTop,
  };
  const rightOuter = {
    x: mullionRight,
    y: frameOpeningTop,
    width: frame.x + frame.width - jamb - mullionRight,
    height: frameOpeningBottom - frameOpeningTop,
  };

  const leftSash = {
    x: leftOuter.x + sashFace,
    y: leftOuter.y + sashFace,
    width: leftOuter.width - sashFace * 2,
    height: leftOuter.height - sashFace * 2,
  };
  const rightSash = {
    x: rightOuter.x + sashFace,
    y: rightOuter.y + sashFace,
    width: rightOuter.width - sashFace * 2,
    height: rightOuter.height - sashFace * 2,
  };
  const leftGlass = {
    x: leftSash.x + beadFace,
    y: leftSash.y + beadFace,
    width: leftSash.width - beadFace * 2,
    height: leftSash.height - beadFace * 2,
  };
  const rightGlass = {
    x: rightSash.x + beadFace,
    y: rightSash.y + beadFace,
    width: rightSash.width - beadFace * 2,
    height: rightSash.height - beadFace * 2,
  };

  const frameShapes: DrawingShape[] = [
    rect({ x: frame.x, y: frame.y, width: frame.width, height: head, fill: FRAME_FILL, role: fixture.profiles.head }),
    rect({ x: frame.x, y: frame.y + frame.height - sill, width: frame.width, height: sill, fill: FRAME_FILL, role: fixture.profiles.sill }),
    rect({ x: frame.x, y: frameOpeningTop, width: jamb, height: frameOpeningBottom - frameOpeningTop, fill: FRAME_FILL, role: fixture.profiles.sideJamb }),
    rect({ x: frame.x + frame.width - jamb, y: frameOpeningTop, width: jamb, height: frameOpeningBottom - frameOpeningTop, fill: FRAME_FILL, role: fixture.profiles.sideJamb }),
    ...addProfileBandLines({ x: frame.x, y: frame.y, width: frame.width, height: head }),
    ...addProfileBandLines({ x: frame.x, y: frame.y + frame.height - sill, width: frame.width, height: sill }),
  ];

  const junctionShapes: DrawingShape[] = [
    rect({ x: mullionLeft, y: frameOpeningTop, width: gapLeft - mullionLeft, height: frameOpeningBottom - frameOpeningTop, fill: FRAME_FILL, role: fixture.profiles.centre }),
    rect({ x: gapRight, y: frameOpeningTop, width: mullionRight - gapRight, height: frameOpeningBottom - frameOpeningTop, fill: FRAME_FILL, role: fixture.profiles.centre }),
    line({ x1: gapLeft, y1: frameOpeningTop, x2: gapLeft, y2: frameOpeningBottom, stroke: STROKE, strokeWidth: 0.8 }),
    line({ x1: gapRight, y1: frameOpeningTop, x2: gapRight, y2: frameOpeningBottom, stroke: STROKE, strokeWidth: 0.8 }),
    ...addProfileBandLines({ x: mullionLeft, y: frameOpeningTop, width: gapLeft - mullionLeft, height: frameOpeningBottom - frameOpeningTop }),
    ...addProfileBandLines({ x: gapRight, y: frameOpeningTop, width: mullionRight - gapRight, height: frameOpeningBottom - frameOpeningTop }),
  ];

  const sashShapes: DrawingShape[] = [
    rect({ ...leftOuter, fill: SASH_FILL, role: "field-1-turn-left-slave" }),
    rect({ ...rightOuter, fill: SASH_FILL, role: "field-2-tilt-turn-right-master" }),
    rect({ ...leftSash, fill: SASH_FILL, role: "field-1-sash" }),
    rect({ ...rightSash, fill: SASH_FILL, role: "field-2-sash" }),
    ...addProfileBandLines(leftOuter),
    ...addProfileBandLines(rightOuter),
    ...addProfileBandLines(leftSash),
    ...addProfileBandLines(rightSash),
  ];

  const glassShapes: DrawingShape[] = [
    rect({ ...leftGlass, fill: GLASS_FILL, stroke: PROFILE_EDGE, strokeWidth: 0.8, role: "field-1-visible-glass" }),
    rect({ ...rightGlass, fill: GLASS_FILL, stroke: PROFILE_EDGE, strokeWidth: 0.8, role: "field-2-visible-glass" }),
  ];

  const openingShapes: DrawingShape[] = [
    ...buildTurnLeftOpeningLines(leftSash),
    ...buildTiltTurnRightOpeningLines(rightSash),
  ];

  const model: DrawingModel = {
    width: overallWidthMm,
    height: overallHeightMm,
    viewBox,
    elements: [
      { id: "authority-system-frame", role: "frame", shapes: frameShapes },
      { id: "authority-system-sashes", role: "sash", shapes: sashShapes },
      { id: "authority-system-glass", role: "glass", shapes: glassShapes },
      { id: "authority-system-flying-mullion", role: "junctions", shapes: junctionShapes },
      { id: "authority-system-opening-lines", role: "opening-lines", shapes: openingShapes },
    ],
    geometry: {
      frame: frameShapes,
      sash: sashShapes,
      glass: glassShapes,
      junctions: [...junctionShapes, ...openingShapes],
    },
    annotations: {
      dimensions: [],
      labels: [],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: `${fixture.manufacturer} ${fixture.system}`,
      openingDirection: "inward",
      operationType: fixture.genericType,
      sectionReferences: [fixture.profiles.head, fixture.profiles.sideJamb, fixture.profiles.sill, fixture.profiles.centre],
      referenceInputs: [
        {
          drawingId: fixture.fixtureId,
          title: fixture.genericType,
          purpose: "Guarded Admin-only system render derived from approved authority fixture metadata and proportions",
          sourceDxfPath: fixture.sources.dxf,
          sourceSvgPath: fixture.sources.svg,
        },
      ],
      renderSource: "native_drawing_model",
      layerHints: ["authority-system-render", "frame", "sash", "glass", "flying-mullion", "opening-lines"],
      devReports: {
        authorityFixture: fixture,
        authorityGeometry: {
          source: "approved DXF fixture used as reference only; DXF entities are not rendered directly",
          overallWidthMm,
          overallHeightMm,
          visibleProfiles: fixture.profiles,
          centreGapMm: gapMm,
        },
      },
    },
    interaction: {
      cells: [],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };

  return { model, fixture };
}
