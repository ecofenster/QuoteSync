import type {
  DrawingDimension,
  DrawingHandle,
  DrawingLabel,
  DrawingLine,
  DrawingMarker,
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
import { formatB92ProjectionDebugReport, serializeB92ProjectionEngineResult } from "./b92ProjectionDebug";
import { projectB92DatumProjectionPlan } from "./b92ProjectionEngine";
import { validateB92ProjectionEngineResult } from "./b92ProjectionValidation";
import type { B92ProjectedDrawableRegionCategory } from "./b92DatumProjection.types";

const VIEW_BOX_WIDTH = 520;
const VIEW_BOX_HEIGHT = 520;
const VIEW_BOX_PAD = 56;

const B92_FIXED_INTERNAL_FRAME_MM = {
  top: 78,
  left: 78,
  right: 78,
  bottom: 93,
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

function buildSegmentedSillOverlayShapes(
  contract: WindowTypeRenderModel,
  frame: { x: number; y: number; width: number; height: number },
  scale: number
): DrawingShape[] {
  if (!shouldRenderSegmentedSillOverlay(contract)) return [];
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

function buildB92DatumProjectionDiagnostics(contract: WindowTypeRenderModel) {
  return {
    integration: "adapter_metadata_only",
    rendererIntegration: false,
    visualGeometryChanged: false,
    note:
      "Read-only B92 datum projection diagnostics. Projection output is metadata only and must not replace renderer geometry.",
    fields: contract.fields.map((field) => {
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
        : ["visible_frame_face"];

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

  const columnIndexes = Array.from(new Set(contract.fields.map((item) => item.column))).sort((a, b) => a - b);
  const rowIndexes = Array.from(new Set(contract.fields.map((item) => item.row))).sort((a, b) => a - b);
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
    profileVisibleDimensionMm(String(junction.profile.profileId))
  );
  const horizontalJunctionHeightsMm = horizontalJunctionsByRow.map(([, junction]) =>
    profileVisibleDimensionMm(String(junction.profile.profileId))
  );
  const clearWidthMm =
    widthMm -
    B92_FIXED_INTERNAL_FRAME_MM.left -
    B92_FIXED_INTERNAL_FRAME_MM.right -
    verticalJunctionWidthsMm.reduce((total, value) => total + value, 0);
  const clearHeightMm =
    heightMm -
    B92_FIXED_INTERNAL_FRAME_MM.top -
    B92_FIXED_INTERNAL_FRAME_MM.bottom -
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
      height: B92_FIXED_INTERNAL_FRAME_MM.top * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_top",
    }),
    rect({
      x: frame.x,
      y: frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale,
      width: B92_FIXED_INTERNAL_FRAME_MM.left * scale,
      height: (heightMm - B92_FIXED_INTERNAL_FRAME_MM.top - B92_FIXED_INTERNAL_FRAME_MM.bottom) * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_left",
    }),
    rect({
      x: frame.x + frame.width - B92_FIXED_INTERNAL_FRAME_MM.right * scale,
      y: frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale,
      width: B92_FIXED_INTERNAL_FRAME_MM.right * scale,
      height: (heightMm - B92_FIXED_INTERNAL_FRAME_MM.top - B92_FIXED_INTERNAL_FRAME_MM.bottom) * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_right",
    }),
    rect({
      x: frame.x,
      y: frame.y + frame.height - B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
      width: frame.width,
      height: B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_bottom",
    }),
  ];
  const segmentedSillOverlayShapes = buildSegmentedSillOverlayShapes(contract, frame, scale);
  frameShapes.push(...segmentedSillOverlayShapes);

  const columnBounds = new Map<number, { x: number; width: number }>();
  let xCursor = frame.x + B92_FIXED_INTERNAL_FRAME_MM.left * scale;
  for (let index = 0; index < columnIndexes.length; index += 1) {
    const width = normalizedColumnWidthsMm[index] * scale;
    columnBounds.set(columnIndexes[index], { x: xCursor, width });
    xCursor += width;
    if (index < verticalJunctionWidthsMm.length) xCursor += verticalJunctionWidthsMm[index] * scale;
  }

  const rowBounds = new Map<number, { y: number; height: number }>();
  let yCursor = frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale;
  for (let index = 0; index < rowIndexes.length; index += 1) {
    const height = normalizedRowHeightsMm[index] * scale;
    rowBounds.set(rowIndexes[index], { y: yCursor, height });
    yCursor += height;
    if (index < horizontalJunctionHeightsMm.length) yCursor += horizontalJunctionHeightsMm[index] * scale;
  }

  const junctionShapes: DrawingShape[] = [];
  xCursor = frame.x + B92_FIXED_INTERNAL_FRAME_MM.left * scale + normalizedColumnWidthsMm[0] * scale;
  for (let index = 0; index < verticalJunctionWidthsMm.length; index += 1) {
    const width = verticalJunctionWidthsMm[index] * scale;
    junctionShapes.push(
      rect({
        x: xCursor,
        y: frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale,
        width,
        height: (heightMm - B92_FIXED_INTERNAL_FRAME_MM.top - B92_FIXED_INTERNAL_FRAME_MM.bottom) * scale,
        stroke: "#111",
        strokeWidth: 1,
        fill: "#f4f4f5",
        role: `vertical_junction_${verticalJunctionsByColumn[index]?.[1].profile.profileId ?? "unknown"}`,
      })
    );
    xCursor += width + (normalizedColumnWidthsMm[index + 1] ?? 0) * scale;
  }

  yCursor = frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale + normalizedRowHeightsMm[0] * scale;
  for (let index = 0; index < horizontalJunctionHeightsMm.length; index += 1) {
    const height = horizontalJunctionHeightsMm[index] * scale;
    junctionShapes.push(
      rect({
        x: frame.x + B92_FIXED_INTERNAL_FRAME_MM.left * scale,
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
  const labels: DrawingLabel[] = [];
  const handles: DrawingHandle[] = [];
  const markers: DrawingMarker[] = [];

  contract.fields.forEach((item, index) => {
    const column = columnBounds.get(item.column);
    const row = rowBounds.get(item.row);
    assertCondition(!!column && !!row, `missing drawing bounds for field ${item.id}.`);

    if (isSashBasedField(item)) {
      const sashOverlap = shouldUseSashOverlapGeometry(contract) ? B92_SASH_OVERLAP_MM * scale : 0;
      const sashBounds = {
        x: column.x - sashOverlap,
        y: row.y - sashOverlap,
        width: column.width + sashOverlap * 2,
        height: row.height + sashOverlap * 2,
      };
      const glassBounds = {
        x: sashBounds.x + (B92_SASH_FACE_MM + B92_BEAD_FACE_MM) * scale,
        y: sashBounds.y + (B92_SASH_FACE_MM + B92_BEAD_FACE_MM) * scale,
        width: sashBounds.width - (B92_SASH_FACE_MM + B92_BEAD_FACE_MM) * 2 * scale,
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
          x: sashBounds.x + B92_SASH_FACE_MM * scale,
          y: sashBounds.y + B92_SASH_FACE_MM * scale,
          width: sashBounds.width - B92_SASH_FACE_MM * 2 * scale,
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
      glassShapes.push(
        rect({
          x: column.x,
          y: row.y,
          width: column.width,
          height: row.height,
          stroke: "#111",
          strokeWidth: 1,
          fill: "#b9d7f3",
          role: `b92_fixed_internal_visible_glass_${item.id}`,
        })
      );
      labels.push({
        x: column.x + 8,
        y: row.y + 16,
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

  const primaryVisibleGlassMm = {
    x: B92_FIXED_INTERNAL_FRAME_MM.left,
    y: B92_FIXED_INTERNAL_FRAME_MM.top,
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
  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: VIEW_BOX_WIDTH, height: VIEW_BOX_HEIGHT },
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
          visibleFrameMm: B92_FIXED_INTERNAL_FRAME_MM,
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
          note: "Isolated B92 fixed internal contract drawing adapter; pilot geometry is not used as authority.",
        },
        b92DatumProjectionDiagnostics: buildB92DatumProjectionDiagnostics(contract),
      },
    },
    interaction: {
      cells: interactionCells,
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}
