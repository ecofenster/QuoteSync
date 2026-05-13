import type {
  DrawingDimension,
  DrawingHandle,
  DrawingLabel,
  DrawingLine,
  DrawingMarker,
  DrawingPolygon,
  DrawingModel,
  DrawingRect,
  DrawingShape,
} from "../drawingModel";
import type {
  WindowTypeRenderConstraint,
  WindowTypeRenderField,
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
} from "./windowTypeRenderContract";
import { B92_PROFILE_RULE_REGISTER } from "./b92ProfileRuleRegister";
import {
  createB92FixedNoSashDatumProjectionFixture,
  createB92SashFieldDatumProjectionFixture,
} from "./b92DatumProjectionFixture";
import {
  buildB92InternalSectionAuthorityProjectionDiagnostics,
  formatB92ProjectionDebugReport,
  formatB92SectionAuthorityProjectionDebugReport,
  serializeB92ProjectionEngineResult,
  summarizeB92SectionAuthorityProjectionDiagnostics,
} from "./b92ProjectionDebug";
import { projectB92DatumProjectionPlan } from "./b92ProjectionEngine";
import {
  validateB92ProjectionEngineResult,
  validateB92SectionAuthorityProjectionDiagnostics,
} from "./b92ProjectionValidation";
import { buildB92ProjectionRendererLikeDiagnosticModel } from "./b92ProjectionRendererLikeAdapter";
import { buildB92FixedNoSashProjectionPilotDrawingModel } from "./b92FixedNoSashProjectionDrawingPilot";
import { buildB92FixedFixedEvidenceLineworkPilotDrawingModel } from "./b92FixedFixedEvidenceLineworkPilot";
import { withB92FixedNoSashProjectionParityDiagnostics } from "./b92FixedNoSashProjectionParity";
import type { B92ProjectedDrawableRegionCategory } from "./b92DatumProjection.types";
import {
  getB92AssemblyComponentWidthMm,
  getB92InternalFlyingVerticalAssembly,
  getB92SimpleFixedFixedVerticalAssembly,
  resolveB92FlyingAssemblyOrientation,
  type B92FlyingAssemblyOrientation,
  type B92ProfileAssemblyComposition,
} from "./b92ProfileAssemblyComposition";

const VIEW_BOX_WIDTH = 520;
const VIEW_BOX_HEIGHT = 520;
const VIEW_BOX_PAD = 24;
const VIEW_BOX_DIMENSION_MARGIN = 64;

const B92_FIXED_INTERNAL_FRAME_MM = {
  top: 78,
  left: 78,
  right: 78,
  bottom: 93,
};

const B92_FIXED_NO_SASH_DATUM_RENDERER_FRAME_MM = {
  top: 57,
  left: 57,
  right: 57,
  bottom: 72,
};

const B92_SASH_CONDITION_STRUCTURAL_FRAME_MM = {
  top: 57,
  left: 57,
  right: 57,
  bottom: 72,
};

const REQUIRED_B92_FIXED_INTERNAL_PROFILES = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

const B92_SASH_FACE_MM = 57;
const B92_BEAD_FACE_MM = 21;
const B92_SASH_OVERLAP_MM = 19.5;
const B92_INTERNAL_FLYING_GAP_TOP_TERMINATION_MM = 4.5;
const B92_INTERNAL_FLYING_GAP_BOTTOM_TERMINATION_MM = 19.5;

const B92_FIXED_NO_SASH_BEAD_FACE_MM = {
  top: 21,
  left: 21,
  right: 21,
  bottom: 21,
} as const;

type B92DatumFixedNoSashRendererPromotionDevFlags = WindowTypeRenderModel["meta"]["dev"] & {
  b92UseDatumFixedNoSashRenderer?: boolean | null;
  b92UseProjectionFixedNoSashDrawingPilot?: boolean | null;
};

type B92DatumFixedNoSashRendererPromotionResult = {
  enabled: boolean;
  eligible: boolean;
  reasons: string[];
  model: DrawingModel | null;
};

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid B92 fixed internal drawing contract: ${message}`);
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

function assertResolvedProfileRef(
  side: keyof WindowTypeRenderPerimeter,
  ref: WindowTypeRenderProfileRef,
  expectedProfileId: typeof REQUIRED_B92_FIXED_INTERNAL_PROFILES[keyof typeof REQUIRED_B92_FIXED_INTERNAL_PROFILES]
) {
  assertCondition(ref.profileId === expectedProfileId, `${side} profile must be ${expectedProfileId}.`);
  assertCondition(ref.source === "resolved", `${side} profile ${expectedProfileId} must be resolved.`);
  assertCondition(
    !ref.candidateProfileIds || ref.candidateProfileIds.length === 0,
    `${side} profile ${expectedProfileId} must not contain unresolved candidates.`
  );
}

function assertB92FixedInternalContract(contract: WindowTypeRenderModel): WindowTypeRenderField {
  assertCondition(contract.meta.system === "B92", "contract.meta.system must be B92.");
  assertCondition(
    contract.meta.validationMode === "external_refs_internal_validation",
    "contract.meta.validationMode must be external_refs_internal_validation."
  );
  assertCondition(contract.fields.length >= 1, "at least one field is required.");
  assertCondition(contract.couplings.length === 0, "couplings are not supported.");
  assertCondition(contract.corners.length === 0, "corners are not supported.");
  assertCondition(contract.thresholds.length === 0, "thresholds are not supported.");

  assertFinitePositiveMm(contract.overall.widthMm, "overall.widthMm");
  assertFinitePositiveMm(contract.overall.heightMm, "overall.heightMm");

  for (const field of contract.fields) {
    assertCondition(
      field.type === "fixed" || field.type === "fixed_sash" || field.type === "tilt_turn" || field.type === "turn_only",
      "fields must be fixed, fixed_sash, tilt_turn, or turn_only."
    );
    if (field.type !== "fixed") {
      assertCondition(!!field.sash, "sash metadata is required for sash-based field operations.");
    }
    assertFinitePositiveMm(field.dimensionsMm.width, "field.dimensionsMm.width");
    assertFinitePositiveMm(field.dimensionsMm.height, "field.dimensionsMm.height");

    assertResolvedProfileRef("top", field.perimeter.top, REQUIRED_B92_FIXED_INTERNAL_PROFILES.top);
    assertResolvedProfileRef("left", field.perimeter.left, REQUIRED_B92_FIXED_INTERNAL_PROFILES.left);
    assertResolvedProfileRef("right", field.perimeter.right, REQUIRED_B92_FIXED_INTERNAL_PROFILES.right);
    assertResolvedProfileRef("bottom", field.perimeter.bottom, REQUIRED_B92_FIXED_INTERNAL_PROFILES.bottom);
    assertNoBlockingUnresolvedConstraints(contract, field);
  }

  return contract.fields[0];
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

function line(input: Omit<DrawingLine, "kind">): DrawingLine {
  return {
    kind: "line",
    ...input,
  };
}

function dashedLine(input: Omit<DrawingLine, "kind" | "dashed" | "stroke" | "strokeWidth">): DrawingLine {
  return line({
    dashed: true,
    stroke: "#111",
    strokeWidth: 1.1,
    ...input,
  });
}

function profileVisibleDimensionMm(profileId: string): number {
  const profile = B92_PROFILE_RULE_REGISTER.profiles[profileId as keyof typeof B92_PROFILE_RULE_REGISTER.profiles];
  const dimension = profile?.dimensions?.visibleFaceMm?.left ?? profile?.dimensions?.depthMm;
  assertCondition(
    Number.isFinite(dimension) && Number(dimension) > 0,
    `profile ${profileId} must define an authoritative visible/depth dimension.`
  );
  return Number(dimension);
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

function shouldRenderSegmentedSillOverlay(contract: WindowTypeRenderModel) {
  return contract.meta.dev?.b92RenderSegmentedSillOverlay === true;
}

function shouldUseSashOverlapGeometry(contract: WindowTypeRenderModel) {
  return contract.meta.dev?.b92UseSashOverlapGeometry === true;
}

function shouldUseJunctionGeometryVisualPilot(contract: WindowTypeRenderModel) {
  return contract.meta.dev?.b92UseJunctionGeometryVisualPilot === true;
}

function buildSegmentedSillOverlayShapes(
  contract: WindowTypeRenderModel,
  frame: { x: number; y: number; width: number; height: number },
  scale: number,
  options?: { continuousFixedNoSashSill?: boolean }
): DrawingShape[] {
  if (!shouldRenderSegmentedSillOverlay(contract)) return [];
  if (options?.continuousFixedNoSashSill) return [];
  if (!contract.sillSegments || contract.sillSegments.length === 0) return [];

  const fieldsByColumn = new Map(contract.fields.map((field) => [field.column, field]));
  const columns = Array.from(new Set(contract.fields.map((field) => field.column))).sort((a, b) => a - b);
  const columnWidthsMm = new Map<number, number>();
  let totalWidthMm = 0;

  for (const column of columns) {
    const field = fieldsByColumn.get(column);
    if (!field) {
      console.warn("B92 segmented sill overlay skipped: missing field bounds for column.", { column });
      return [];
    }
    columnWidthsMm.set(column, field.dimensionsMm.width);
    totalWidthMm += field.dimensionsMm.width;
  }

  if (totalWidthMm <= 0 || Math.abs(totalWidthMm - contract.overall.widthMm) > 0.01) {
    console.warn("B92 segmented sill overlay skipped: field widths do not match overall width.", {
      totalFieldWidthMm: totalWidthMm,
      overallWidthMm: contract.overall.widthMm,
    });
    return [];
  }

  let xCursor = frame.x;
  const columnStarts = new Map<number, number>();
  for (const column of columns) {
    columnStarts.set(column, xCursor);
    xCursor += (columnWidthsMm.get(column) ?? 0) * scale;
  }

  return contract.sillSegments
    .map((segment) => {
      const x = columnStarts.get(segment.column);
      const widthMm = columnWidthsMm.get(segment.column);
      if (x === undefined || widthMm === undefined) {
        console.warn("B92 segmented sill overlay skipped: sill segment has no matching column bounds.", segment);
        return null;
      }

      return rect({
        x,
        y: frame.y + frame.height - B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
        width: widthMm * scale,
        height: B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
        stroke: "#111",
        strokeWidth: 1.3,
        fill: "rgba(244, 244, 245, 0.72)",
        role: `sill_segment_${segment.profile.profileId}`,
      });
    })
    .filter((shape): shape is DrawingRect => !!shape);
}

function isSashBasedField(field: WindowTypeRenderField) {
  return field.type === "fixed_sash" || field.type === "tilt_turn" || field.type === "turn_only";
}

function fieldOperationLabel(field: WindowTypeRenderField) {
  if (field.operation === "tt_right") return "Tilt & Turn Right";
  if (field.operation === "tt_left") return "Tilt & Turn Left";
  if (field.operation === "turn_left") return "Turn Left";
  if (field.operation === "turn_right") return "Turn Right";
  if (field.operation === "tilt_only") return "Tilt Only";
  if (field.operation === "fixed_sash" || field.type === "fixed_sash") return "Fixed Sash";
  return "Fixed";
}

function buildFieldOpeningLines(
  field: WindowTypeRenderField,
  glassBounds: { x: number; y: number; width: number; height: number }
): DrawingLine[] {
  const operation = field.operation ?? field.sash?.operation;
  const left = glassBounds.x;
  const right = glassBounds.x + glassBounds.width;
  const top = glassBounds.y;
  const bottom = glassBounds.y + glassBounds.height;
  const centerY = top + glassBounds.height / 2;
  const topCenterX = left + glassBounds.width / 2;

  if (operation === "tt_left") {
    return [
      dashedLine({ x1: left, y1: top, x2: right, y2: centerY, role: "tt_left_opening_top" }),
      dashedLine({ x1: left, y1: bottom, x2: right, y2: centerY, role: "tt_left_opening_bottom" }),
      dashedLine({ x1: left, y1: bottom, x2: topCenterX, y2: top, role: "tt_left_tilt_left" }),
      dashedLine({ x1: topCenterX, y1: top, x2: right, y2: bottom, role: "tt_left_tilt_right" }),
    ];
  }
  if (operation === "tt_right") {
    return [
      dashedLine({ x1: right, y1: top, x2: left, y2: centerY, role: "tt_right_opening_top" }),
      dashedLine({ x1: right, y1: bottom, x2: left, y2: centerY, role: "tt_right_opening_bottom" }),
      dashedLine({ x1: right, y1: bottom, x2: topCenterX, y2: top, role: "tt_right_tilt_right" }),
      dashedLine({ x1: topCenterX, y1: top, x2: left, y2: bottom, role: "tt_right_tilt_left" }),
    ];
  }
  if (operation === "turn_left") {
    return [
      dashedLine({ x1: left, y1: top, x2: right, y2: centerY, role: "turn_left_opening_top" }),
      dashedLine({ x1: left, y1: bottom, x2: right, y2: centerY, role: "turn_left_opening_bottom" }),
    ];
  }
  if (operation === "turn_right") {
    return [
      dashedLine({ x1: right, y1: top, x2: left, y2: centerY, role: "turn_right_opening_top" }),
      dashedLine({ x1: right, y1: bottom, x2: left, y2: centerY, role: "turn_right_opening_bottom" }),
    ];
  }
  if (operation === "tilt_only") {
    return [
      dashedLine({ x1: left, y1: bottom, x2: topCenterX, y2: top, role: "tilt_only_left" }),
      dashedLine({ x1: topCenterX, y1: top, x2: right, y2: bottom, role: "tilt_only_right" }),
    ];
  }
  return [];
}

function buildFieldHandle(
  field: WindowTypeRenderField,
  sashBounds: { x: number; y: number; width: number; height: number },
  scale: number
): DrawingHandle | null {
  const operation = field.operation ?? field.sash?.operation;
  if (operation === "fixed" || operation === "fixed_sash" || operation === "tilt_only" || field.type === "fixed_sash") {
    return null;
  }
  const handleSide = operation === "tt_right" || operation === "turn_right" ? "left" : "right";
  return {
    x: handleSide === "left" ? sashBounds.x + B92_SASH_FACE_MM * scale * 0.55 : sashBounds.x + sashBounds.width - B92_SASH_FACE_MM * scale * 0.55,
    y: sashBounds.y + sashBounds.height / 2,
    size: 10,
    role: "handle",
  };
}

function buildFixedNoSashNestedFieldGeometry(input: {
  fieldId: string;
  bounds: { x: number; y: number; width: number; height: number };
  scale: number;
}): { beadShapes: DrawingShape[]; glassShape: DrawingRect; glassBounds: { x: number; y: number; width: number; height: number } } {
  const bead = {
    top: B92_FIXED_NO_SASH_BEAD_FACE_MM.top * input.scale,
    left: B92_FIXED_NO_SASH_BEAD_FACE_MM.left * input.scale,
    right: B92_FIXED_NO_SASH_BEAD_FACE_MM.right * input.scale,
    bottom: B92_FIXED_NO_SASH_BEAD_FACE_MM.bottom * input.scale,
  };
  const outer = {
    left: input.bounds.x,
    top: input.bounds.y,
    right: input.bounds.x + input.bounds.width,
    bottom: input.bounds.y + input.bounds.height,
  };
  const glassBounds = {
    x: outer.left + bead.left,
    y: outer.top + bead.top,
    width: input.bounds.width - bead.left - bead.right,
    height: input.bounds.height - bead.top - bead.bottom,
  };
  assertCondition(glassBounds.width > 0 && glassBounds.height > 0, `fixed field ${input.fieldId} leaves no visible glass area.`);

  const glassRight = glassBounds.x + glassBounds.width;
  const glassBottom = glassBounds.y + glassBounds.height;
  const beadShapes: DrawingShape[] = [
    polygon({
      points: [
        { x: outer.left, y: outer.top },
        { x: outer.right, y: outer.top },
        { x: glassRight, y: glassBounds.y },
        { x: glassBounds.x, y: glassBounds.y },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_fixed_no_sash_glazing_bead_top_${input.fieldId}`,
    }),
    polygon({
      points: [
        { x: outer.right, y: outer.top },
        { x: outer.right, y: outer.bottom },
        { x: glassRight, y: glassBottom },
        { x: glassRight, y: glassBounds.y },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_fixed_no_sash_glazing_bead_right_${input.fieldId}`,
    }),
    polygon({
      points: [
        { x: outer.right, y: outer.bottom },
        { x: outer.left, y: outer.bottom },
        { x: glassBounds.x, y: glassBottom },
        { x: glassRight, y: glassBottom },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_fixed_no_sash_glazing_bead_bottom_${input.fieldId}`,
    }),
    polygon({
      points: [
        { x: outer.left, y: outer.bottom },
        { x: outer.left, y: outer.top },
        { x: glassBounds.x, y: glassBounds.y },
        { x: glassBounds.x, y: glassBottom },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_fixed_no_sash_glazing_bead_left_${input.fieldId}`,
    }),
  ];
  return {
    beadShapes,
    glassBounds,
    glassShape: rect({
      x: glassBounds.x,
      y: glassBounds.y,
      width: glassBounds.width,
      height: glassBounds.height,
      stroke: "#111",
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: `b92_fixed_internal_visible_glass_${input.fieldId}`,
    }),
  };
}

type B92FixedFixedJunctionLayout = {
  junction: WindowTypeRenderModel["verticalJunctions"][number];
  x: number;
  y: number;
  height: number;
  scale: number;
  assembly: B92ProfileAssemblyComposition | null;
  flyingAssembly: {
    composition: B92ProfileAssemblyComposition;
    orientation: B92FlyingAssemblyOrientation;
  } | null;
};

function b92AssemblyWidthMm(assembly: B92ProfileAssemblyComposition, componentKey: string) {
  return getB92AssemblyComponentWidthMm(assembly, componentKey);
}

function b92InternalFlyingAssembly(junction: WindowTypeRenderModel["verticalJunctions"][number]) {
  const composition = getB92InternalFlyingVerticalAssembly(String(junction.profile.profileId));
  if (!composition || junction.condition !== "flying_mullion") return null;
  const orientation = resolveB92FlyingAssemblyOrientation({
    ownerFieldId: junction.ownerFieldId,
    leftFieldId: junction.betweenFieldIds[0],
    rightFieldId: junction.betweenFieldIds[1],
  });
  if (!orientation) return null;
  return { composition, orientation };
}

function b92BlockedInternalFlyingAssembly(junction: WindowTypeRenderModel["verticalJunctions"][number]) {
  const composition = getB92InternalFlyingVerticalAssembly(String(junction.profile.profileId));
  if (!composition || junction.condition !== "flying_mullion" || b92InternalFlyingAssembly(junction)) return null;
  return {
    junctionId: junction.id,
    profileRef: composition.profileRef,
    totalMm: composition.totalMm,
    components: composition.components,
    datum: composition.datum,
    orientation: null,
    renderGeometry: false,
    blocker: "B92-18 owner/master side is missing or does not match the joined fields.",
  };
}

function profileAssemblyVisibleDimensionMm(junction: WindowTypeRenderModel["verticalJunctions"][number]) {
  const flyingAssembly = b92InternalFlyingAssembly(junction);
  if (flyingAssembly) return flyingAssembly.composition.totalMm;
  return profileVisibleDimensionMm(String(junction.profile.profileId));
}

function buildB92FlyingMeetingAssemblyShapes(
  layout: B92FixedFixedJunctionLayout,
  sashOverlap: number
): DrawingShape[] {
  if (!layout.flyingAssembly) return [];
  const { composition, orientation } = layout.flyingAssembly;
  const beadMm = b92AssemblyWidthMm(composition, "passive_side_bead");
  const slaveSashMm = b92AssemblyWidthMm(composition, "slave_sash");
  const gapMm = b92AssemblyWidthMm(composition, "meeting_gap");
  const masterSashMm = b92AssemblyWidthMm(composition, "master_sash");
  const assemblyStart = layout.x;
  const assemblyEnd = layout.x + composition.totalMm * layout.scale;
  const y = layout.y - sashOverlap;
  const height = layout.height + sashOverlap * 2;
  const leftSashMm = orientation.masterSide === "left" ? slaveSashMm : masterSashMm;
  const rightSashMm = orientation.masterSide === "left" ? masterSashMm : slaveSashMm;
  const leftSideMm = beadMm + leftSashMm;
  const rightSideMm = rightSashMm + beadMm;
  const gapStart = layout.x + leftSideMm * layout.scale;
  const gapWidth = gapMm * layout.scale;
  const gapEnd = gapStart + gapWidth;
  const gapVisibleTop = y + B92_INTERNAL_FLYING_GAP_TOP_TERMINATION_MM * layout.scale;
  const gapVisibleBottom = y + height - B92_INTERNAL_FLYING_GAP_BOTTOM_TERMINATION_MM * layout.scale;
  const leftBeadBoundary = layout.x + beadMm * layout.scale;
  const rightBeadBoundary = assemblyEnd - beadMm * layout.scale;
  const sashFaceTop = y + B92_SASH_FACE_MM * layout.scale;
  const glassTop = sashFaceTop + beadMm * layout.scale;
  const sashFaceBottom = y + height - B92_SASH_FACE_MM * layout.scale;
  const glassBottom = sashFaceBottom - beadMm * layout.scale;

  const verticalBoundary = (x: number, role: string, strokeWidth = 1): DrawingShape =>
    line({
      x1: x,
      y1: y,
      x2: x,
      y2: y + height,
      stroke: "#111",
      strokeWidth,
      role,
    });

  return [
    rect({
      x: leftBeadBoundary,
      y,
      width: leftSashMm * layout.scale,
      height,
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_18_flying_${orientation.masterSide}_left_sash_side_fill`,
    }),
    rect({
      x: gapStart,
      y,
      width: gapWidth,
      height: gapVisibleTop - y,
      fill: "#f4f4f5",
      role: `b92_18_flying_${orientation.masterSide}_meeting_gap_top_termination_fill`,
    }),
    rect({
      x: gapStart,
      y: gapVisibleTop,
      width: gapWidth,
      height: gapVisibleBottom - gapVisibleTop,
      fill: "#ffffff",
      role: `b92_18_flying_${orientation.masterSide}_meeting_gap_visible_fill`,
    }),
    rect({
      x: gapStart,
      y: gapVisibleBottom,
      width: gapWidth,
      height: y + height - gapVisibleBottom,
      fill: "#f4f4f5",
      role: `b92_18_flying_${orientation.masterSide}_meeting_gap_bottom_termination_fill`,
    }),
    rect({
      x: gapEnd,
      y,
      width: rightSashMm * layout.scale,
      height,
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_18_flying_${orientation.masterSide}_right_sash_side_fill`,
    }),
    polygon({
      points: [
        { x: leftBeadBoundary, y: sashFaceTop },
        { x: assemblyStart, y: glassTop },
        { x: assemblyStart, y: glassBottom },
        { x: leftBeadBoundary, y: sashFaceBottom },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_18_flying_${orientation.masterSide}_left_bead_mitred`,
    }),
    polygon({
      points: [
        { x: rightBeadBoundary, y: sashFaceTop },
        { x: assemblyEnd, y: glassTop },
        { x: assemblyEnd, y: glassBottom },
        { x: rightBeadBoundary, y: sashFaceBottom },
      ],
      stroke: "#111",
      strokeWidth: 1,
      fill: "#f4f4f5",
      role: `b92_18_flying_${orientation.masterSide}_right_bead_mitred`,
    }),
    verticalBoundary(gapStart, `b92_18_flying_${orientation.masterSide}_left_meeting_face`, 1.2),
    verticalBoundary(gapEnd, `b92_18_flying_${orientation.masterSide}_right_meeting_face`, 1.2),
    line({
      x1: gapStart,
      y1: gapVisibleTop,
      x2: gapEnd,
      y2: gapVisibleTop,
      stroke: "#111",
      strokeWidth: 1,
      role: `b92_18_flying_${orientation.masterSide}_gap_top_termination`,
    }),
    line({
      x1: gapStart,
      y1: gapVisibleBottom,
      x2: gapEnd,
      y2: gapVisibleBottom,
      stroke: "#111",
      strokeWidth: 1,
      role: `b92_18_flying_${orientation.masterSide}_gap_bottom_termination`,
    }),
  ];
}

function b92FlyingSideComponentsMm(layout: B92FixedFixedJunctionLayout | undefined, fieldId: string) {
  if (!layout?.flyingAssembly) return null;
  const { composition, orientation } = layout.flyingAssembly;
  const beadMm = b92AssemblyWidthMm(composition, "passive_side_bead");
  const masterSashMm = b92AssemblyWidthMm(composition, "master_sash");
  const slaveSashMm = b92AssemblyWidthMm(composition, "slave_sash");
  const leftFieldId = layout.junction.betweenFieldIds[0];
  const rightFieldId = layout.junction.betweenFieldIds[1];
  const isLeftSide = fieldId === leftFieldId;
  const isRightSide = fieldId === rightFieldId;
  if (!isLeftSide && !isRightSide) return null;
  const sashMm =
    orientation.masterSide === "left"
      ? isLeftSide
        ? slaveSashMm
        : masterSashMm
      : isLeftSide
        ? masterSashMm
        : slaveSashMm;
  return {
    sashMm,
    beadMm,
    totalMm: sashMm + beadMm,
  };
}

function buildB92VerticalJunctionShapes(input: {
  layout: B92FixedFixedJunctionLayout;
  width: number;
  showJunctionVisualPilotMarker: boolean;
}): DrawingShape[] {
  const profileId = String(input.layout.junction.profile.profileId);
  // Flying mullions are layer-2 sash-meeting assemblies, not layer-1 static junction rectangles.
  if (input.layout.flyingAssembly || b92BlockedInternalFlyingAssembly(input.layout.junction)) return [];
  const common = {
    y: input.layout.y,
    height: input.layout.height,
    stroke: input.showJunctionVisualPilotMarker ? "#dc2626" : "#111",
    strokeWidth: input.showJunctionVisualPilotMarker ? 2.6 : 1,
    fill: input.showJunctionVisualPilotMarker ? "rgba(254, 226, 226, 0.9)" : "#f4f4f5",
  };

  if (!input.layout.assembly) {
    return [
      rect({
        ...common,
        x: input.layout.x,
        width: input.width,
        role: `vertical_junction_${profileId}`,
      }),
    ];
  }

  const assembly = input.layout.assembly;
  return [
    rect({
      ...common,
      x: input.layout.x + b92AssemblyWidthMm(assembly, "left_bead") * input.layout.scale,
      width: b92AssemblyWidthMm(assembly, "structural_core") * input.layout.scale,
      role: `vertical_junction_${profileId}_structural_core`,
    }),
  ];
}

function datumFixedNoSashRendererPromotionEnabled(contract: WindowTypeRenderModel): boolean {
  const dev = contract.meta.dev as B92DatumFixedNoSashRendererPromotionDevFlags | undefined;
  return dev?.b92UseDatumFixedNoSashRenderer === true;
}

function buildB92DatumFixedNoSashRendererPromotion(
  contract: WindowTypeRenderModel
): B92DatumFixedNoSashRendererPromotionResult {
  const enabled = datumFixedNoSashRendererPromotionEnabled(contract);
  if (!enabled) {
    return {
      enabled,
      eligible: false,
      reasons: ["datum renderer promotion flag is off"],
      model: null,
    };
  }

  const promotedContract: WindowTypeRenderModel = {
    ...contract,
    meta: {
      ...contract.meta,
      dev: {
        ...contract.meta.dev,
        b92UseProjectionFixedNoSashDrawingPilot: true,
      } as WindowTypeRenderModel["meta"]["dev"],
    },
  };
  const pilot = buildB92FixedNoSashProjectionPilotDrawingModel(promotedContract);

  return {
    enabled,
    eligible: pilot.eligibility.eligible,
    reasons: pilot.eligibility.reasons,
    model: pilot.model,
  };
}

function buildB92DatumFixedNoSashRendererPromotionReport(input: {
  promotion: B92DatumFixedNoSashRendererPromotionResult;
  usedAsDrawingModel: boolean;
  fallbackToExistingRenderer: boolean;
  promotedModel?: DrawingModel | null;
}) {
  const pilotReport =
    input.promotedModel?.metadata.devReports?.b92FixedNoSashProjectionDrawingPilot ?? null;

  return {
    flag: "contract.meta.dev.b92UseDatumFixedNoSashRenderer",
    enabled: input.promotion.enabled,
    eligible: input.promotion.eligible,
    usedAsDrawingModel: input.usedAsDrawingModel,
    fallbackToExistingRenderer: input.fallbackToExistingRenderer,
    rendererAuthority: input.usedAsDrawingModel ? "confirmed_b92_fixed_no_sash_datum_projection" : "legacy_b92_fixed_internal_adapter",
    scope: "B92 internal 1-field fixed no-sash only",
    eligibilityChecks: [
      "system B92",
      "internal validation drawing path",
      "exactly 1 field",
      "fixed field",
      "no sash metadata",
      "no vertical junctions",
      "no horizontal junctions",
      "no couplings",
      "no corners",
      "no thresholds",
      "finite positive overall dimensions",
    ],
    reasons: input.promotion.reasons,
    confirmedStructuralFrameDatumMm: B92_FIXED_NO_SASH_DATUM_RENDERER_FRAME_MM,
    legacyFixedInternalFrameMm: B92_FIXED_INTERNAL_FRAME_MM,
    pilotProjectionReport: pilotReport,
    note: input.usedAsDrawingModel
      ? "Explicit dev-gated datum renderer promotion used confirmed fixed no-sash datum projection as drawing output."
      : "Datum renderer promotion was not used; existing legacy B92 fixed internal adapter output remains authoritative.",
  };
}

function withB92DatumFixedNoSashRendererPromotionReport(input: {
  model: DrawingModel;
  promotion: B92DatumFixedNoSashRendererPromotionResult;
  usedAsDrawingModel: boolean;
  fallbackToExistingRenderer: boolean;
  promotedModel?: DrawingModel | null;
}): DrawingModel {
  if (!input.promotion.enabled) return input.model;

  return {
    ...input.model,
    metadata: {
      ...input.model.metadata,
      devReports: {
        ...input.model.metadata.devReports,
        b92DatumFixedNoSashRendererPromotion: buildB92DatumFixedNoSashRendererPromotionReport({
          promotion: input.promotion,
          usedAsDrawingModel: input.usedAsDrawingModel,
          fallbackToExistingRenderer: input.fallbackToExistingRenderer,
          promotedModel: input.promotedModel,
        }),
      },
    },
  };
}

function buildB92DatumProjectionDiagnostics(contract: WindowTypeRenderModel) {
  const sectionAuthorityProjection = buildB92InternalSectionAuthorityProjectionDiagnostics();
  const fieldProjectionDiagnostics = contract.fields.map((field) => {
    const plan = isSashBasedField(field)
      ? createB92SashFieldDatumProjectionFixture(field.id)
      : createB92FixedNoSashDatumProjectionFixture(field.id);
    const projected = projectB92DatumProjectionPlan({
      plan,
      fieldBoundsById: {
        [field.id]: {
          x: 0,
          y: 0,
          width: field.dimensionsMm.width,
          height: field.dimensionsMm.height,
        },
      },
    });
    const expectedCategories: B92ProjectedDrawableRegionCategory[] = isSashBasedField(field)
      ? [
          "structural_frame_datum",
          "visible_frame_face",
          "hidden_frame_rebate",
          "visible_sash_body",
          "bead",
          "daylight_opening",
          "glass_order",
        ]
      : ["structural_frame_datum", "daylight_opening", "glass_order"];

    return {
      field,
      projected,
      expectedCategories,
    };
  });

  return {
    integration: "adapter_metadata_only",
    rendererIntegration: false,
    visualGeometryChanged: false,
    note:
      "Read-only B92 datum projection diagnostics. Projection output is metadata only and must not replace renderer geometry.",
    geometrySemantics: {
      structuralFrame:
        "B92 structural outer frame remains the source datum. Head and sill own full spans; jambs continue structurally between head and sill.",
      exposedFrame:
        "37.5mm is a sash/opening exposed-frame result after sash overlap. It is not the fixed no-sash frame datum.",
      sashOverlap:
        "Sash/opening conditions retain the 57mm structural frame and expose 37.5mm top/side plus 52.5mm bottom where confirmed.",
      glazingBeadMitres:
        "B92 glazing bead diagnostics use continuous bead segments with 45 degree mitred corner joins; bead geometry must not be read as square-ended overlapping rectangles.",
    },
    sectionAuthorityProjection: {
      diagnosticOnly: true,
      drawableGeometry: false,
      diagnostics: sectionAuthorityProjection,
      summary: summarizeB92SectionAuthorityProjectionDiagnostics(sectionAuthorityProjection),
      validation: validateB92SectionAuthorityProjectionDiagnostics(sectionAuthorityProjection),
      debugReport: formatB92SectionAuthorityProjectionDebugReport(sectionAuthorityProjection),
    },
    rendererLikeDiagnosticModel: buildB92ProjectionRendererLikeDiagnosticModel({
      fields: fieldProjectionDiagnostics.map(({ field, projected }) => ({
        fieldId: field.id,
        fieldType: field.type,
        projection: projected,
      })),
      sectionAuthorityProjection,
    }),
    fields: fieldProjectionDiagnostics.map(({ field, projected, expectedCategories }) => {
      return {
        fieldId: field.id,
        fieldType: field.type,
        serializedProjection: serializeB92ProjectionEngineResult(projected),
        validation: validateB92ProjectionEngineResult(
          `b92-adapter-projection:${field.id}`,
          projected,
          expectedCategories
        ),
        debugReport: formatB92ProjectionDebugReport(projected),
        unresolvedReasons: projected.unresolved,
      };
    }),
  };
}

export function buildB92FixedInternalDrawingModelFromContract(contract: WindowTypeRenderModel): DrawingModel {
  const field = assertB92FixedInternalContract(contract);
  const widthMm = contract.overall.widthMm;
  const heightMm = contract.overall.heightMm;
  const fixedFixedEvidenceLineworkPilot = buildB92FixedFixedEvidenceLineworkPilotDrawingModel(contract);
  if (fixedFixedEvidenceLineworkPilot) {
    return fixedFixedEvidenceLineworkPilot;
  }

  const datumRendererPromotion = buildB92DatumFixedNoSashRendererPromotion(contract);
  const fixedNoSashProjectionPilot = buildB92FixedNoSashProjectionPilotDrawingModel(contract);

  if (fixedNoSashProjectionPilot.model && !datumRendererPromotion.enabled) {
    return {
      ...fixedNoSashProjectionPilot.model,
      metadata: {
        ...fixedNoSashProjectionPilot.model.metadata,
        devReports: {
          ...fixedNoSashProjectionPilot.model.metadata.devReports,
          b92DatumProjectionDiagnostics: buildB92DatumProjectionDiagnostics(contract),
        },
      },
    };
  }

  const columnIndexes = Array.from(new Set(contract.fields.map((item) => item.column))).sort((a, b) => a - b);
  const rowIndexes = Array.from(new Set(contract.fields.map((item) => item.row))).sort((a, b) => a - b);
  const allFieldsFixedNoSash = contract.fields.every((item) => item.type === "fixed" && !item.sash);
  const visibleFrameMm = allFieldsFixedNoSash ? B92_FIXED_NO_SASH_DATUM_RENDERER_FRAME_MM : B92_SASH_CONDITION_STRUCTURAL_FRAME_MM;
  const columnWidthsMm = columnIndexes.map((column) => {
    const fieldInColumn = contract.fields.find((item) => item.column === column);
    assertCondition(!!fieldInColumn, `column ${column} is missing a field.`);
    return fieldInColumn.dimensionsMm.width;
  });
  const rowHeightsMm = rowIndexes.map((row) => {
    const fieldInRow = contract.fields.find((item) => item.row === row);
    assertCondition(!!fieldInRow, `row ${row} is missing a field.`);
    return fieldInRow.dimensionsMm.height;
  });
  const fieldById = new Map(contract.fields.map((item) => [item.id, item]));
  const verticalJunctionsByColumn = Array.from(
    contract.verticalJunctions
      .reduce((map, junction) => {
        const leftField = fieldById.get(junction.betweenFieldIds[0]);
        if (leftField && !map.has(leftField.column)) map.set(leftField.column, junction);
        return map;
      }, new Map<number, typeof contract.verticalJunctions[number]>())
      .entries()
  ).sort(([a], [b]) => a - b);
  const horizontalJunctionsByRow = Array.from(
    contract.horizontalJunctions
      .reduce((map, junction) => {
        const topField = fieldById.get(junction.betweenFieldIds[0]);
        if (topField && !map.has(topField.row)) map.set(topField.row, junction);
        return map;
      }, new Map<number, typeof contract.horizontalJunctions[number]>())
      .entries()
  ).sort(([a], [b]) => a - b);
  const verticalJunctionWidthsMm = verticalJunctionsByColumn.map(([, junction]) =>
    profileAssemblyVisibleDimensionMm(junction)
  );
  const horizontalJunctionHeightsMm = horizontalJunctionsByRow.map(([, junction]) =>
    profileVisibleDimensionMm(String(junction.profile.profileId))
  );
  const clearWidthMm =
    widthMm -
    visibleFrameMm.left -
    visibleFrameMm.right -
    verticalJunctionWidthsMm.reduce((total, value) => total + value, 0);
  const clearHeightMm =
    heightMm -
    visibleFrameMm.top -
    visibleFrameMm.bottom -
    horizontalJunctionHeightsMm.reduce((total, value) => total + value, 0);
  assertCondition(
    clearWidthMm > 0 && clearHeightMm > 0,
    "visible frame faces leave no visible glass area."
  );

  const totalColumnWidthMm = columnWidthsMm.reduce((total, value) => total + value, 0);
  const totalRowHeightMm = rowHeightsMm.reduce((total, value) => total + value, 0);
  const normalizedColumnWidthsMm = columnWidthsMm.map((value, index) => {
    if (index < columnWidthsMm.length - 1) return (value / totalColumnWidthMm) * clearWidthMm;
    return clearWidthMm - columnWidthsMm.slice(0, -1).reduce((total, current) => total + (current / totalColumnWidthMm) * clearWidthMm, 0);
  });
  const normalizedRowHeightsMm = rowHeightsMm.map((value, index) => {
    if (index < rowHeightsMm.length - 1) return (value / totalRowHeightMm) * clearHeightMm;
    return clearHeightMm - rowHeightsMm.slice(0, -1).reduce((total, current) => total + (current / totalRowHeightMm) * clearHeightMm, 0);
  });
  const frame = getFrameRect(widthMm, heightMm);
  const scale = frame.scale;

  const frameShapes: DrawingShape[] = [
    rect({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: visibleFrameMm.top * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_top",
    }),
    rect({
      x: frame.x,
      y: frame.y + visibleFrameMm.top * scale,
      width: visibleFrameMm.left * scale,
      height: (heightMm - visibleFrameMm.top - visibleFrameMm.bottom) * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_left",
    }),
    rect({
      x: frame.x + frame.width - visibleFrameMm.right * scale,
      y: frame.y + visibleFrameMm.top * scale,
      width: visibleFrameMm.right * scale,
      height: (heightMm - visibleFrameMm.top - visibleFrameMm.bottom) * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_right",
    }),
    rect({
      x: frame.x,
      y: frame.y + frame.height - visibleFrameMm.bottom * scale,
      width: frame.width,
      height: visibleFrameMm.bottom * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_bottom",
    }),
  ];
  const segmentedSillOverlayShapes = buildSegmentedSillOverlayShapes(contract, frame, scale, {
    continuousFixedNoSashSill: allFieldsFixedNoSash,
  });
  frameShapes.push(...segmentedSillOverlayShapes);

  const columnBounds = new Map<number, { x: number; width: number }>();
  let xCursor = frame.x + visibleFrameMm.left * scale;
  for (let index = 0; index < columnIndexes.length; index += 1) {
    const width = normalizedColumnWidthsMm[index] * scale;
    columnBounds.set(columnIndexes[index], { x: xCursor, width });
    xCursor += width;
    if (index < verticalJunctionWidthsMm.length) xCursor += verticalJunctionWidthsMm[index] * scale;
  }

  const rowBounds = new Map<number, { y: number; height: number }>();
  let yCursor = frame.y + visibleFrameMm.top * scale;
  for (let index = 0; index < rowIndexes.length; index += 1) {
    const height = normalizedRowHeightsMm[index] * scale;
    rowBounds.set(rowIndexes[index], { y: yCursor, height });
    yCursor += height;
    if (index < horizontalJunctionHeightsMm.length) yCursor += horizontalJunctionHeightsMm[index] * scale;
  }

  const junctionShapes: DrawingShape[] = [];
  const flyingAssemblyShapes: DrawingShape[] = [];
  const junctionLabels: DrawingLabel[] = [];
  const blockedFlyingAssemblies: ReturnType<typeof b92BlockedInternalFlyingAssembly>[] = [];
  const renderedFlyingAssemblies: Array<{
    junctionId: string;
    profileRef: string;
    totalMm: number;
    components: B92ProfileAssemblyComposition["components"];
    datum: B92ProfileAssemblyComposition["datum"];
    orientation: B92FlyingAssemblyOrientation;
    renderGeometry: true;
  }> = [];
  const showJunctionVisualPilotMarker = shouldUseJunctionGeometryVisualPilot(contract);
  const sashOverlapGeometryEnabled = shouldUseSashOverlapGeometry(contract);
  const baseSashOverlap = sashOverlapGeometryEnabled ? B92_SASH_OVERLAP_MM * scale : 0;
  const verticalJunctionLayouts: B92FixedFixedJunctionLayout[] = [];
  const rightJunctionByFieldId = new Map<string, B92FixedFixedJunctionLayout>();
  const leftJunctionByFieldId = new Map<string, B92FixedFixedJunctionLayout>();
  xCursor = frame.x + visibleFrameMm.left * scale + normalizedColumnWidthsMm[0] * scale;
  for (let index = 0; index < verticalJunctionWidthsMm.length; index += 1) {
    const width = verticalJunctionWidthsMm[index] * scale;
    const junction = verticalJunctionsByColumn[index]?.[1];
    assertCondition(!!junction, `vertical junction ${index} is missing contract metadata.`);
    const profileId = String(junction.profile.profileId);
    const flyingAssembly = b92InternalFlyingAssembly(junction);
    const layout: B92FixedFixedJunctionLayout = {
      junction,
      x: xCursor,
      y: frame.y + visibleFrameMm.top * scale,
      height: (heightMm - visibleFrameMm.top - visibleFrameMm.bottom) * scale,
      scale,
      assembly: allFieldsFixedNoSash ? getB92SimpleFixedFixedVerticalAssembly(profileId) : null,
      flyingAssembly,
    };
    if (flyingAssembly) {
      flyingAssemblyShapes.push(...buildB92FlyingMeetingAssemblyShapes(layout, baseSashOverlap));
      renderedFlyingAssemblies.push({
        junctionId: junction.id,
        profileRef: flyingAssembly.composition.profileRef,
        totalMm: flyingAssembly.composition.totalMm,
        components: flyingAssembly.composition.components,
        datum: flyingAssembly.composition.datum,
        orientation: flyingAssembly.orientation,
        renderGeometry: true,
      });
    }
    const blockedFlyingAssembly = b92BlockedInternalFlyingAssembly(junction);
    if (blockedFlyingAssembly) blockedFlyingAssemblies.push(blockedFlyingAssembly);
    verticalJunctionLayouts.push(layout);
    rightJunctionByFieldId.set(junction.betweenFieldIds[0], layout);
    leftJunctionByFieldId.set(junction.betweenFieldIds[1], layout);
    junctionShapes.push(
      ...buildB92VerticalJunctionShapes({
        layout,
        width,
        showJunctionVisualPilotMarker,
      })
    );
    if (showJunctionVisualPilotMarker) {
      junctionLabels.push({
        x: xCursor + width / 2,
        y: frame.y + visibleFrameMm.top * scale + 20,
        value: String(profileId),
        fontSize: 11,
        fontWeight: 800,
        fill: "#991b1b",
        anchor: "middle",
        role: "b92_junction_visual_pilot_label",
      });
    }
    xCursor += width + (normalizedColumnWidthsMm[index + 1] ?? 0) * scale;
  }

  yCursor = frame.y + visibleFrameMm.top * scale + normalizedRowHeightsMm[0] * scale;
  for (let index = 0; index < horizontalJunctionHeightsMm.length; index += 1) {
    const height = horizontalJunctionHeightsMm[index] * scale;
    junctionShapes.push(
      rect({
        x: frame.x + visibleFrameMm.left * scale,
        y: yCursor,
        width: clearWidthMm * scale,
        height,
        stroke: "#111",
        strokeWidth: 1,
        fill: "#f4f4f5",
        role: `horizontal_junction_${horizontalJunctionsByRow[index]?.[1].profile.profileId ?? "unknown"}`,
      })
    );
    yCursor += height + (normalizedRowHeightsMm[index + 1] ?? 0) * scale;
  }

  const sashShapes: DrawingShape[] = [];
  const glassShapes: DrawingShape[] = [];
  const labels: DrawingLabel[] = [...junctionLabels];
  const handles: DrawingHandle[] = [];
  const markers: DrawingMarker[] = [];

  contract.fields.forEach((item, index) => {
    const column = columnBounds.get(item.column);
    const row = rowBounds.get(item.row);
    assertCondition(!!column && !!row, `missing drawing bounds for field ${item.id}.`);

    if (isSashBasedField(item)) {
      const leftJunction = leftJunctionByFieldId.get(item.id);
      const rightJunction = rightJunctionByFieldId.get(item.id);
      const leftFlyingSide = b92FlyingSideComponentsMm(leftJunction, item.id);
      const rightFlyingSide = b92FlyingSideComponentsMm(rightJunction, item.id);
      const sashOverlapLeft = leftFlyingSide ? leftFlyingSide.totalMm * scale : baseSashOverlap;
      const sashOverlapRight = rightFlyingSide ? rightFlyingSide.totalMm * scale : baseSashOverlap;
      const sashFaceLeft = (leftFlyingSide?.sashMm ?? B92_SASH_FACE_MM) * scale;
      const sashFaceRight = (rightFlyingSide?.sashMm ?? B92_SASH_FACE_MM) * scale;
      const glassInsetLeft = ((leftFlyingSide?.sashMm ?? B92_SASH_FACE_MM) + (leftFlyingSide?.beadMm ?? B92_BEAD_FACE_MM)) * scale;
      const glassInsetRight = ((rightFlyingSide?.sashMm ?? B92_SASH_FACE_MM) + (rightFlyingSide?.beadMm ?? B92_BEAD_FACE_MM)) * scale;
      const sashBounds = {
        x: column.x - sashOverlapLeft,
        y: row.y - baseSashOverlap,
        width: column.width + sashOverlapLeft + sashOverlapRight,
        height: row.height + baseSashOverlap * 2,
      };
      const glassBounds = {
        x: sashBounds.x + glassInsetLeft,
        y: sashBounds.y + (B92_SASH_FACE_MM + B92_BEAD_FACE_MM) * scale,
        width: sashBounds.width - glassInsetLeft - glassInsetRight,
        height: sashBounds.height - (B92_SASH_FACE_MM + B92_BEAD_FACE_MM) * 2 * scale,
      };
      assertCondition(glassBounds.width > 0 && glassBounds.height > 0, `sash field ${item.id} leaves no visible glass area.`);

      sashShapes.push(
        rect({
          x: sashBounds.x,
          y: sashBounds.y,
          width: sashBounds.width,
          height: sashBounds.height,
          stroke: "#111",
          strokeWidth: 1.1,
          fill: "#f4f4f5",
          role: `b92_field_sash_${item.id}`,
        }),
        rect({
          x: sashBounds.x + sashFaceLeft,
          y: sashBounds.y + B92_SASH_FACE_MM * scale,
          width: sashBounds.width - sashFaceLeft - sashFaceRight,
          height: sashBounds.height - B92_SASH_FACE_MM * 2 * scale,
          stroke: "#111",
          strokeWidth: 1,
          fill: "#f4f4f5",
          role: `b92_field_bead_${item.id}`,
        })
      );

      glassShapes.push(
        rect({
          x: glassBounds.x,
          y: glassBounds.y,
          width: glassBounds.width,
          height: glassBounds.height,
          stroke: "#111",
          strokeWidth: 1,
          fill: "#b9d7f3",
          role: `b92_fixed_internal_visible_glass_${item.id}`,
        }),
        ...buildFieldOpeningLines(item, glassBounds)
      );
      const handle = buildFieldHandle(item, sashBounds, scale);
      if (handle) handles.push(handle);
      labels.push({
        x: glassBounds.x + 8,
        y: glassBounds.y + 16,
        value: fieldOperationLabel(item),
        fontSize: 9,
        fill: "#3f3f46",
        anchor: "start",
        role: "field_label",
      });
    } else {
      const rightJunction = rightJunctionByFieldId.get(item.id);
      const leftJunction = leftJunctionByFieldId.get(item.id);
      const leftBeadInset = leftJunction?.assembly
        ? b92AssemblyWidthMm(leftJunction.assembly, "right_bead") * scale
        : 0;
      const rightBeadInset = rightJunction?.assembly
        ? b92AssemblyWidthMm(rightJunction.assembly, "left_bead") * scale
        : 0;
      const fixedGeometry = buildFixedNoSashNestedFieldGeometry({
        fieldId: item.id,
        bounds: {
          x: column.x - leftBeadInset,
          y: row.y,
          width: column.width + leftBeadInset + rightBeadInset,
          height: row.height,
        },
        scale,
      });
      glassShapes.push(...fixedGeometry.beadShapes, fixedGeometry.glassShape);
      labels.push({
        x: fixedGeometry.glassBounds.x + 8,
        y: fixedGeometry.glassBounds.y + 16,
        value: "Fixed",
        fontSize: 9,
        fill: "#3f3f46",
        anchor: "start",
        role: "field_label",
      });
    }

    markers.push({
      x: column.x + column.width / 2,
      y: row.y + row.height / 2,
      radius: 16,
      value: String(index + 1),
      role: "field_marker",
    });
  });
  sashShapes.push(...flyingAssemblyShapes);

  const primaryVisibleGlassMm = {
    x: visibleFrameMm.left,
    y: visibleFrameMm.top,
    width: clearWidthMm,
    height: clearHeightMm,
  };
  const glassOrderMm = {
    width: clearWidthMm + 26,
    height: clearHeightMm + 26,
  };
  const interactionCells = contract.fields.map((item) => {
    const column = columnBounds.get(item.column);
    const row = rowBounds.get(item.row);
    assertCondition(!!column && !!row, `missing interaction bounds for field ${item.id}.`);
    return {
      key: item.id,
      x: column.x,
      y: row.y,
      width: column.width,
      height: row.height,
    };
  });
  const interactionVerticalJunctions = verticalJunctionLayouts.map((layout, index) => {
    const assembly = layout.assembly ?? layout.flyingAssembly?.composition;
    const x = assembly
      ? layout.x + assembly.datum.offsetFromAssemblyStartMm * layout.scale
      : layout.x + (verticalJunctionWidthsMm[index] * layout.scale) / 2;
    return {
      index: index + 1,
      x,
      y1: layout.y,
      y2: layout.y + layout.height,
    };
  });
  const legacyModelWithDiagnostics = withB92FixedNoSashProjectionParityDiagnostics({
    contract,
    model: {
      width: widthMm,
      height: heightMm,
      viewBox: frame.viewBox,
      elements: [
        { id: "frame", role: "frame", shapes: frameShapes },
        { id: "junctions", role: "junctions", shapes: junctionShapes },
        { id: "sash", role: "sash", shapes: sashShapes },
        { id: "glass", role: "glass", shapes: glassShapes },
      ],
      geometry: {
        frame: frameShapes,
        sash: sashShapes,
        glass: glassShapes,
        junctions: junctionShapes,
      },
      annotations: {
        dimensions: buildDimensionAnnotations(frame, widthMm, heightMm),
        labels,
        handles,
        markers,
      },
      metadata: {
        systemType: "window",
        openingDirection: "inward",
        operationType: "fixed",
        sectionReferences: [
          REQUIRED_B92_FIXED_INTERNAL_PROFILES.top,
          REQUIRED_B92_FIXED_INTERNAL_PROFILES.left,
          REQUIRED_B92_FIXED_INTERNAL_PROFILES.bottom,
        ],
        referenceInputs: [],
        renderSource: "native_drawing_model",
        layerHints: ["frame", "glass", "dimensions", "annotations"],
        devReports: {
          b92FixedInternalContractDrawingAdapter: {
            fieldId: field.id,
            validationMode: contract.meta.validationMode,
            requiredProfiles: REQUIRED_B92_FIXED_INTERNAL_PROFILES,
            visibleFrameMm,
            visibleGlassMm: primaryVisibleGlassMm,
            glassOrderNoteMm: glassOrderMm,
            fieldCount: contract.fields.length,
            segmentedSillOverlay: {
              enabled: shouldRenderSegmentedSillOverlay(contract),
              shapeCount: segmentedSillOverlayShapes.length,
            },
            sashOverlapGeometry: {
              enabled: shouldUseSashOverlapGeometry(contract),
              overlapMm: shouldUseSashOverlapGeometry(contract) ? B92_SASH_OVERLAP_MM : 0,
            },
            junctionGeometryVisualPilot: {
              enabled: showJunctionVisualPilotMarker,
              marker: showJunctionVisualPilotMarker ? "red centre-junction rect stroke and profile label" : "off",
            },
            ...(blockedFlyingAssemblies.length > 0
              ? {
                  b92BlockedFlyingAssemblies: blockedFlyingAssemblies,
                }
              : {}),
            ...(renderedFlyingAssemblies.length > 0
              ? {
                  b92RenderedFlyingAssemblies: renderedFlyingAssemblies,
                }
              : {}),
            ...(fixedNoSashProjectionPilot.eligibility.enabled
              ? {
                  fixedNoSashProjectionPilot: {
                    enabled: fixedNoSashProjectionPilot.eligibility.enabled,
                    eligible: fixedNoSashProjectionPilot.eligibility.eligible,
                    fallbackToExistingRenderer: true,
                    reasons: fixedNoSashProjectionPilot.eligibility.reasons,
                  },
                }
              : {}),
            note: "Isolated B92 fixed internal contract drawing adapter; pilot geometry is not used as authority.",
          },
          b92DatumProjectionDiagnostics: buildB92DatumProjectionDiagnostics(contract),
        },
      },
      interaction: {
        cells: interactionCells,
        verticalJunctions: interactionVerticalJunctions,
        horizontalJunctions: [],
      },
    },
  });

  if (datumRendererPromotion.model) {
    return {
      ...datumRendererPromotion.model,
      metadata: {
        ...datumRendererPromotion.model.metadata,
        devReports: {
          ...datumRendererPromotion.model.metadata.devReports,
          b92DatumProjectionDiagnostics: buildB92DatumProjectionDiagnostics(contract),
          ...(legacyModelWithDiagnostics.metadata.devReports?.b92FixedNoSashProjectionParity
            ? {
                b92FixedNoSashProjectionParity:
                  legacyModelWithDiagnostics.metadata.devReports.b92FixedNoSashProjectionParity,
              }
            : {}),
          b92DatumFixedNoSashRendererPromotion: buildB92DatumFixedNoSashRendererPromotionReport({
            promotion: datumRendererPromotion,
            usedAsDrawingModel: true,
            fallbackToExistingRenderer: false,
            promotedModel: datumRendererPromotion.model,
          }),
        },
      },
    };
  }

  return withB92DatumFixedNoSashRendererPromotionReport({
    model: legacyModelWithDiagnostics,
    promotion: datumRendererPromotion,
    usedAsDrawingModel: false,
    fallbackToExistingRenderer: true,
    promotedModel: null,
  });
}
