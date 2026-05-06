import type {
  DrawingDimension,
  DrawingModel,
  DrawingPolygon,
  DrawingRect,
  DrawingShape,
} from "../drawingModel";
import type {
  WindowTypeRenderConstraint,
  WindowTypeRenderField,
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
  WindowTypeRenderSash,
} from "./windowTypeRenderContract";

const VIEW_BOX_WIDTH = 520;
const VIEW_BOX_HEIGHT = 520;
const VIEW_BOX_PAD = 56;

// B92 internal datum note:
// For Tilt & Turn / Fixed Sash top, left, and right, 57mm is the true structural
// frame reference line. The adapter uses 37.5mm because that is the visible frame
// after sash overlay; 19.5mm is hidden behind the sash. Bottom visible frame
// differs by rebate: Fixed no-sash bottom visible is 72mm, while Tilt & Turn /
// Fixed Sash bottom visible is 52.5mm. This drawing adapter intentionally uses
// visible dimensions only. Do not refactor to hidden/structural geometry unless
// explicitly approved.
const B92_FIXED_SASH_INTERNAL_FRAME_MM = {
  top: 37.5,
  left: 37.5,
  right: 37.5,
  bottom: 52.5,
} as const;

const B92_FIXED_SASH_INTERNAL_SASH_FACE_MM = {
  top: 57,
  left: 57,
  right: 57,
  bottom: 57,
} as const;

const B92_FIXED_SASH_INTERNAL_BEAD_MM = {
  top: 21,
  left: 21,
  right: 21,
  bottom: 21,
} as const;

const B92_FIXED_SASH_INTERNAL_GLASS_ORDER_MM = {
  biteBehindBeadMm: 13,
  widthDeltaMm: 26,
  heightDeltaMm: 26,
  formula: "visible_glass_plus_2x_bite",
} as const;

const REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

const REQUIRED_B92_FIXED_SASH_PROFILES = {
  top: "B92-7",
  left: "B92-9",
  right: "B92-10",
  bottom: "B92-8",
} as const;

type Side = "top" | "left" | "right" | "bottom";

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid B92 fixed sash internal drawing contract: ${message}`);
}

function assertFinitePositiveMm(value: number, label: string) {
  assertCondition(Number.isFinite(value) && value > 0, `${label} must be a finite positive millimetre value.`);
}

function hasBlockingUnresolvedConstraint(constraint: WindowTypeRenderConstraint) {
  return (
    constraint.severity === "blocking" ||
    constraint.constraint === "unresolved_profile_choice" ||
    constraint.constraint === "pending_confirmation"
  );
}

function assertNoBlockingUnresolvedConstraints(contract: WindowTypeRenderModel, field: WindowTypeRenderField) {
  const constraints = [...contract.constraints, ...(field.constraints ?? [])];
  const blocking = constraints.find(hasBlockingUnresolvedConstraint);
  assertCondition(
    !blocking,
    `blocking unresolved constraint found at ${blocking?.sourceId ?? "unknown"}: ${blocking?.constraint ?? "unknown"}.`
  );
}

function assertResolvedProfileRef(side: string, ref: WindowTypeRenderProfileRef | undefined, expectedProfileId: string) {
  assertCondition(!!ref, `${side} profile is required.`);
  assertCondition(ref.profileId === expectedProfileId, `${side} profile must be ${expectedProfileId}.`);
  assertCondition(ref.source === "resolved", `${side} profile ${expectedProfileId} must be resolved.`);
  assertCondition(
    !ref.candidateProfileIds || ref.candidateProfileIds.length === 0,
    `${side} profile ${expectedProfileId} must not contain unresolved candidates.`
  );
}

function assertPerimeter(perimeter: WindowTypeRenderPerimeter) {
  assertResolvedProfileRef("top perimeter", perimeter.top, REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.top);
  assertResolvedProfileRef("left perimeter", perimeter.left, REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.left);
  assertResolvedProfileRef("right perimeter", perimeter.right, REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.right);
  assertResolvedProfileRef("bottom perimeter", perimeter.bottom, REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.bottom);
}

function assertNumberBySide(
  label: string,
  actual: Partial<Record<Side, number>> | undefined,
  expected: Record<Side, number>
) {
  assertCondition(!!actual, `${label} is required.`);
  for (const side of ["top", "left", "right", "bottom"] as const) {
    assertCondition(actual[side] === expected[side], `${label}.${side} must be ${expected[side]}mm.`);
  }
}

function assertSash(sash: WindowTypeRenderSash | undefined): WindowTypeRenderSash {
  assertCondition(!!sash, "fixed_sash field requires sash metadata.");
  assertCondition(sash.openingType === "fixed_sash", "sash.openingType must be fixed_sash.");
  assertCondition(sash.hingeSide === undefined || sash.hingeSide === null, "fixed_sash must not define hingeSide.");
  assertCondition(sash.handleSide === undefined || sash.handleSide === null, "fixed_sash must not define handleSide.");

  assertResolvedProfileRef("top sash", sash.profiles?.top, REQUIRED_B92_FIXED_SASH_PROFILES.top);
  assertResolvedProfileRef("left sash", sash.profiles?.left, REQUIRED_B92_FIXED_SASH_PROFILES.left);
  assertResolvedProfileRef("right sash", sash.profiles?.right, REQUIRED_B92_FIXED_SASH_PROFILES.right);
  assertResolvedProfileRef("bottom sash", sash.profiles?.bottom, REQUIRED_B92_FIXED_SASH_PROFILES.bottom);

  assertNumberBySide("sash.geometry.visibleFaceMm", sash.geometry?.visibleFaceMm, B92_FIXED_SASH_INTERNAL_SASH_FACE_MM);
  assertNumberBySide("sash.geometry.insetMm", sash.geometry?.insetMm, {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  assertNumberBySide("sash.geometry.overlapMm", sash.geometry?.overlapMm, {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  assertNumberBySide("sash.geometry.beadVisibleFaceMm", sash.geometry?.beadVisibleFaceMm, B92_FIXED_SASH_INTERNAL_BEAD_MM);

  const glassOrderRule = sash.geometry?.glassOrderRule;
  assertCondition(!!glassOrderRule, "sash.geometry.glassOrderRule is required.");
  assertCondition(glassOrderRule.biteBehindBeadMm === 13, "glass order biteBehindBeadMm must be 13mm.");
  assertCondition(glassOrderRule.widthDeltaMm === 26, "glass order widthDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.heightDeltaMm === 26, "glass order heightDeltaMm must be 26mm.");
  assertCondition(
    glassOrderRule.formula === "visible_glass_plus_2x_bite",
    "glass order formula must be visible_glass_plus_2x_bite."
  );

  return sash;
}

function assertB92FixedSashInternalContract(contract: WindowTypeRenderModel): WindowTypeRenderField {
  assertCondition(contract.meta.system === "B92", "contract.meta.system must be B92.");
  assertCondition(
    contract.meta.validationMode === "external_refs_internal_validation",
    "contract.meta.validationMode must be external_refs_internal_validation."
  );
  assertCondition(contract.fields.length === 1, "exactly one field is required.");
  assertCondition(contract.verticalJunctions.length === 0, "vertical junctions are not supported.");
  assertCondition(contract.horizontalJunctions.length === 0, "horizontal junctions are not supported.");
  assertCondition(contract.couplings.length === 0, "couplings are not supported.");
  assertCondition(contract.corners.length === 0, "corners are not supported.");
  assertCondition(contract.thresholds.length === 0, "thresholds are not supported.");

  const field = contract.fields[0];
  assertCondition(field !== undefined, "single field is missing.");
  assertCondition(field.type === "fixed_sash", "field type must be fixed_sash.");
  assertCondition(field.row === 0 && field.column === 0, "field must be positioned at row 0, column 0.");

  assertFinitePositiveMm(contract.overall.widthMm, "overall.widthMm");
  assertFinitePositiveMm(contract.overall.heightMm, "overall.heightMm");
  assertFinitePositiveMm(field.dimensionsMm.width, "field.dimensionsMm.width");
  assertFinitePositiveMm(field.dimensionsMm.height, "field.dimensionsMm.height");
  assertCondition(field.dimensionsMm.width === contract.overall.widthMm, "field width must match overall width.");
  assertCondition(field.dimensionsMm.height === contract.overall.heightMm, "field height must match overall height.");

  assertPerimeter(field.perimeter);
  assertSash(field.sash);
  assertNoBlockingUnresolvedConstraints(contract, field);

  return field;
}

function getFrameRect(widthMm: number, heightMm: number) {
  const availableWidth = VIEW_BOX_WIDTH - VIEW_BOX_PAD * 2;
  const availableHeight = VIEW_BOX_HEIGHT - VIEW_BOX_PAD * 2;
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
    scale: Math.min(width / widthMm, height / heightMm),
  };
}

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return {
    kind: "rect",
    ...input,
  };
}

function polygon(input: Omit<DrawingPolygon, "kind">): DrawingPolygon {
  return {
    kind: "polygon",
    ...input,
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

export function buildB92FixedSashInternalDrawingModelFromContract(contract: WindowTypeRenderModel): DrawingModel {
  const field = assertB92FixedSashInternalContract(contract);
  const widthMm = contract.overall.widthMm;
  const heightMm = contract.overall.heightMm;

  const sashOuterMm = {
    x: B92_FIXED_SASH_INTERNAL_FRAME_MM.left,
    y: B92_FIXED_SASH_INTERNAL_FRAME_MM.top,
    width: widthMm - B92_FIXED_SASH_INTERNAL_FRAME_MM.left - B92_FIXED_SASH_INTERNAL_FRAME_MM.right,
    height: heightMm - B92_FIXED_SASH_INTERNAL_FRAME_MM.top - B92_FIXED_SASH_INTERNAL_FRAME_MM.bottom,
  };
  assertCondition(sashOuterMm.width > 0 && sashOuterMm.height > 0, "visible frame faces leave no sash area.");

  const beadOuterMm = {
    x: sashOuterMm.x + B92_FIXED_SASH_INTERNAL_SASH_FACE_MM.left,
    y: sashOuterMm.y + B92_FIXED_SASH_INTERNAL_SASH_FACE_MM.top,
    width: sashOuterMm.width - B92_FIXED_SASH_INTERNAL_SASH_FACE_MM.left - B92_FIXED_SASH_INTERNAL_SASH_FACE_MM.right,
    height: sashOuterMm.height - B92_FIXED_SASH_INTERNAL_SASH_FACE_MM.top - B92_FIXED_SASH_INTERNAL_SASH_FACE_MM.bottom,
  };
  assertCondition(beadOuterMm.width > 0 && beadOuterMm.height > 0, "sash faces leave no bead area.");

  const visibleGlassMm = {
    x: beadOuterMm.x + B92_FIXED_SASH_INTERNAL_BEAD_MM.left,
    y: beadOuterMm.y + B92_FIXED_SASH_INTERNAL_BEAD_MM.top,
    width: beadOuterMm.width - B92_FIXED_SASH_INTERNAL_BEAD_MM.left - B92_FIXED_SASH_INTERNAL_BEAD_MM.right,
    height: beadOuterMm.height - B92_FIXED_SASH_INTERNAL_BEAD_MM.top - B92_FIXED_SASH_INTERNAL_BEAD_MM.bottom,
  };
  assertCondition(visibleGlassMm.width > 0 && visibleGlassMm.height > 0, "bead faces leave no visible glass area.");

  const glassOrderMm = {
    width: visibleGlassMm.width + B92_FIXED_SASH_INTERNAL_GLASS_ORDER_MM.widthDeltaMm,
    height: visibleGlassMm.height + B92_FIXED_SASH_INTERNAL_GLASS_ORDER_MM.heightDeltaMm,
  };
  const frame = getFrameRect(widthMm, heightMm);
  const scale = frame.scale;

  const frameShapes: DrawingShape[] = [
    rect({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: B92_FIXED_SASH_INTERNAL_FRAME_MM.top * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_frame_top",
    }),
    rect({
      x: frame.x,
      y: frame.y + B92_FIXED_SASH_INTERNAL_FRAME_MM.top * scale,
      width: B92_FIXED_SASH_INTERNAL_FRAME_MM.left * scale,
      height: sashOuterMm.height * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_frame_left",
    }),
    rect({
      x: frame.x + frame.width - B92_FIXED_SASH_INTERNAL_FRAME_MM.right * scale,
      y: frame.y + B92_FIXED_SASH_INTERNAL_FRAME_MM.top * scale,
      width: B92_FIXED_SASH_INTERNAL_FRAME_MM.right * scale,
      height: sashOuterMm.height * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_frame_right",
    }),
    rect({
      x: frame.x,
      y: frame.y + frame.height - B92_FIXED_SASH_INTERNAL_FRAME_MM.bottom * scale,
      width: frame.width,
      height: B92_FIXED_SASH_INTERNAL_FRAME_MM.bottom * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_frame_bottom",
    }),
  ];

  const beadOuterSvg = {
    left: frame.x + beadOuterMm.x * scale,
    top: frame.y + beadOuterMm.y * scale,
    right: frame.x + (beadOuterMm.x + beadOuterMm.width) * scale,
    bottom: frame.y + (beadOuterMm.y + beadOuterMm.height) * scale,
  };
  const visibleGlassSvg = {
    left: frame.x + visibleGlassMm.x * scale,
    top: frame.y + visibleGlassMm.y * scale,
    right: frame.x + (visibleGlassMm.x + visibleGlassMm.width) * scale,
    bottom: frame.y + (visibleGlassMm.y + visibleGlassMm.height) * scale,
  };

  const beadShapes: DrawingShape[] = [
    polygon({
      points: [
        { x: beadOuterSvg.left, y: beadOuterSvg.top },
        { x: beadOuterSvg.right, y: beadOuterSvg.top },
        { x: visibleGlassSvg.right, y: visibleGlassSvg.top },
        { x: visibleGlassSvg.left, y: visibleGlassSvg.top },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_glazing_bead_top_mitred",
    }),
    polygon({
      points: [
        { x: beadOuterSvg.right, y: beadOuterSvg.top },
        { x: beadOuterSvg.right, y: beadOuterSvg.bottom },
        { x: visibleGlassSvg.right, y: visibleGlassSvg.bottom },
        { x: visibleGlassSvg.right, y: visibleGlassSvg.top },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_glazing_bead_right_mitred",
    }),
    polygon({
      points: [
        { x: beadOuterSvg.right, y: beadOuterSvg.bottom },
        { x: beadOuterSvg.left, y: beadOuterSvg.bottom },
        { x: visibleGlassSvg.left, y: visibleGlassSvg.bottom },
        { x: visibleGlassSvg.right, y: visibleGlassSvg.bottom },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_glazing_bead_bottom_mitred",
    }),
    polygon({
      points: [
        { x: beadOuterSvg.left, y: beadOuterSvg.bottom },
        { x: beadOuterSvg.left, y: beadOuterSvg.top },
        { x: visibleGlassSvg.left, y: visibleGlassSvg.top },
        { x: visibleGlassSvg.left, y: visibleGlassSvg.bottom },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_glazing_bead_left_mitred",
    }),
  ];

  const sashShapes: DrawingShape[] = [
    rect({
      x: frame.x + sashOuterMm.x * scale,
      y: frame.y + sashOuterMm.y * scale,
      width: sashOuterMm.width * scale,
      height: sashOuterMm.height * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_sash_internal_sash_outer",
    }),
    ...beadShapes,
  ];

  const glassShapes: DrawingShape[] = [
    rect({
      x: frame.x + visibleGlassMm.x * scale,
      y: frame.y + visibleGlassMm.y * scale,
      width: visibleGlassMm.width * scale,
      height: visibleGlassMm.height * scale,
      stroke: "#111",
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "b92_fixed_sash_internal_visible_glass",
    }),
  ];

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: VIEW_BOX_WIDTH, height: VIEW_BOX_HEIGHT },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: sashShapes },
      { id: "glass", role: "glass", shapes: glassShapes },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: sashShapes,
      glass: glassShapes,
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(frame, widthMm, heightMm),
      labels: [],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: "fixed_sash",
      sectionReferences: [
        REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.top,
        REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.left,
        REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES.bottom,
        REQUIRED_B92_FIXED_SASH_PROFILES.top,
        REQUIRED_B92_FIXED_SASH_PROFILES.left,
        REQUIRED_B92_FIXED_SASH_PROFILES.right,
        REQUIRED_B92_FIXED_SASH_PROFILES.bottom,
      ],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "sash", "glass", "dimensions", "annotations"],
      devReports: {
        b92FixedSashInternalContractDrawingAdapter: {
          adapterName: "buildB92FixedSashInternalDrawingModelFromContract",
          fieldId: field.id,
          validationMode: contract.meta.validationMode,
          requiredPerimeterProfiles: REQUIRED_B92_FIXED_SASH_PERIMETER_PROFILES,
          requiredSashProfiles: REQUIRED_B92_FIXED_SASH_PROFILES,
          visibleFrameMm: B92_FIXED_SASH_INTERNAL_FRAME_MM,
          sashVisibleFaceMm: B92_FIXED_SASH_INTERNAL_SASH_FACE_MM,
          beadVisibleFaceMm: B92_FIXED_SASH_INTERNAL_BEAD_MM,
          visibleGlassMm,
          glassOrderMm,
          note: "Isolated B92 fixed sash internal contract drawing adapter; no opening hardware, pilot geometry, or renderer wiring is used.",
        },
      },
    },
    interaction: {
      cells: [
        {
          key: "0,0",
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}
