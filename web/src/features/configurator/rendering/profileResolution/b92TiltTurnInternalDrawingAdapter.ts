import type {
  DrawingHandle,
  DrawingLabel,
  DrawingLine,
  DrawingMarker,
  DrawingModel,
  DrawingPolygon,
  DrawingRect,
  DrawingShape,
} from "../drawingModel";
import { buildB92FixedSashInternalDrawingModelFromContract } from "./b92FixedSashInternalDrawingAdapter";
import type {
  WindowTypeRenderConstraint,
  WindowTypeRenderField,
  WindowTypeRenderFieldOperation,
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
  WindowTypeRenderSash,
} from "./windowTypeRenderContract";

const REQUIRED_B92_TILT_TURN_PERIMETER_PROFILES = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

const REQUIRED_B92_TILT_TURN_SASH_PROFILES = {
  top: "B92-7",
  left: "B92-9",
  right: "B92-10",
  bottom: "B92-8",
} as const;

type Side = "top" | "left" | "right" | "bottom";
type Bounds = { left: number; top: number; right: number; bottom: number };
type TiltTurnFieldOperation = Extract<
  WindowTypeRenderFieldOperation,
  "tt_left" | "tt_right" | "turn_left" | "turn_right" | "tilt_only"
>;

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid B92 tilt & turn internal drawing contract: ${message}`);
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
  assertResolvedProfileRef("top perimeter", perimeter.top, REQUIRED_B92_TILT_TURN_PERIMETER_PROFILES.top);
  assertResolvedProfileRef("left perimeter", perimeter.left, REQUIRED_B92_TILT_TURN_PERIMETER_PROFILES.left);
  assertResolvedProfileRef("right perimeter", perimeter.right, REQUIRED_B92_TILT_TURN_PERIMETER_PROFILES.right);
  assertResolvedProfileRef("bottom perimeter", perimeter.bottom, REQUIRED_B92_TILT_TURN_PERIMETER_PROFILES.bottom);
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

function resolveTiltTurnOperation(field: WindowTypeRenderField, sash: WindowTypeRenderSash): TiltTurnFieldOperation {
  const operation = field.operation ?? sash.operation;
  if (operation !== undefined) {
    assertCondition(
      operation === "tt_left" ||
        operation === "tt_right" ||
        operation === "turn_left" ||
        operation === "turn_right" ||
        operation === "tilt_only",
      `field.operation must be tt_left, tt_right, turn_left, turn_right, or tilt_only for this adapter; received ${operation}.`
    );
    return operation;
  }

  if (sash.hingeSide === "right" && sash.handleSide === "left") return "tt_right";
  return "tt_left";
}

function expectedSidesForOperation(operation: TiltTurnFieldOperation) {
  if (operation === "tilt_only") return { hingeSide: null, handleSide: null };
  return operation === "tt_right" || operation === "turn_right"
    ? { hingeSide: "right" as const, handleSide: "left" as const }
    : { hingeSide: "left" as const, handleSide: "right" as const };
}

function assertSash(field: WindowTypeRenderField): { sash: WindowTypeRenderSash; operation: TiltTurnFieldOperation } {
  const sash = field.sash;
  assertCondition(!!sash, "tilt_turn field requires sash metadata.");
  assertCondition(sash.openingType === "tilt_turn", "sash.openingType must be tilt_turn.");
  const operation = resolveTiltTurnOperation(field, sash);
  const expectedSides = expectedSidesForOperation(operation);
  if (operation !== "tilt_only") {
    assertCondition(sash.hingeSide === expectedSides.hingeSide, `${operation} requires ${expectedSides.hingeSide} hinge side.`);
    assertCondition(sash.handleSide === expectedSides.handleSide, `${operation} requires ${expectedSides.handleSide} handle side.`);
  }

  assertResolvedProfileRef("top sash", sash.profiles?.top, REQUIRED_B92_TILT_TURN_SASH_PROFILES.top);
  assertResolvedProfileRef("left sash", sash.profiles?.left, REQUIRED_B92_TILT_TURN_SASH_PROFILES.left);
  assertResolvedProfileRef("right sash", sash.profiles?.right, REQUIRED_B92_TILT_TURN_SASH_PROFILES.right);
  assertResolvedProfileRef("bottom sash", sash.profiles?.bottom, REQUIRED_B92_TILT_TURN_SASH_PROFILES.bottom);

  assertNumberBySide("sash.geometry.visibleFaceMm", sash.geometry?.visibleFaceMm, {
    top: 57,
    left: 57,
    right: 57,
    bottom: 57,
  });
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
  assertNumberBySide("sash.geometry.beadVisibleFaceMm", sash.geometry?.beadVisibleFaceMm, {
    top: 21,
    left: 21,
    right: 21,
    bottom: 21,
  });

  const glassOrderRule = sash.geometry?.glassOrderRule;
  assertCondition(!!glassOrderRule, "sash.geometry.glassOrderRule is required.");
  assertCondition(glassOrderRule.biteBehindBeadMm === 13, "glass order biteBehindBeadMm must be 13mm.");
  assertCondition(glassOrderRule.widthDeltaMm === 26, "glass order widthDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.heightDeltaMm === 26, "glass order heightDeltaMm must be 26mm.");
  assertCondition(
    glassOrderRule.formula === "visible_glass_plus_2x_bite",
    "glass order formula must be visible_glass_plus_2x_bite."
  );

  return { sash, operation };
}

function assertB92TiltTurnInternalContract(contract: WindowTypeRenderModel): {
  field: WindowTypeRenderField;
  operation: TiltTurnFieldOperation;
} {
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
  assertCondition(field.type === "tilt_turn", "field type must be tilt_turn.");
  assertCondition(field.row === 0 && field.column === 0, "field must be positioned at row 0, column 0.");

  assertFinitePositiveMm(contract.overall.widthMm, "overall.widthMm");
  assertFinitePositiveMm(contract.overall.heightMm, "overall.heightMm");
  assertFinitePositiveMm(field.dimensionsMm.width, "field.dimensionsMm.width");
  assertFinitePositiveMm(field.dimensionsMm.height, "field.dimensionsMm.height");
  assertCondition(field.dimensionsMm.width === contract.overall.widthMm, "field width must match overall width.");
  assertCondition(field.dimensionsMm.height === contract.overall.heightMm, "field height must match overall height.");

  assertPerimeter(field.perimeter);
  const { operation } = assertSash(field);
  assertNoBlockingUnresolvedConstraints(contract, field);

  return { field, operation };
}

function toFixedSashContract(contract: WindowTypeRenderModel): WindowTypeRenderModel {
  const field = contract.fields[0];
  assertCondition(field !== undefined, "single field is missing.");

  return {
    ...contract,
    fields: [
      {
        ...field,
        type: "fixed_sash",
        sash: field.sash
          ? {
              ...field.sash,
              openingType: "fixed_sash",
              hingeSide: null,
              handleSide: null,
            }
          : field.sash,
      },
    ],
  };
}

function boundsForShapes(shapes: DrawingShape[]): Bounds {
  const bounds = shapes.map((shape) => {
    if (shape.kind === "rect") {
      return {
        left: shape.x,
        top: shape.y,
        right: shape.x + shape.width,
        bottom: shape.y + shape.height,
      };
    }
    if (shape.kind === "polygon") {
      return {
        left: Math.min(...shape.points.map((point) => point.x)),
        top: Math.min(...shape.points.map((point) => point.y)),
        right: Math.max(...shape.points.map((point) => point.x)),
        bottom: Math.max(...shape.points.map((point) => point.y)),
      };
    }
    return {
      left: Math.min(shape.x1, shape.x2),
      top: Math.min(shape.y1, shape.y2),
      right: Math.max(shape.x1, shape.x2),
      bottom: Math.max(shape.y1, shape.y2),
    };
  });

  return {
    left: Math.min(...bounds.map((bound) => bound.left)),
    top: Math.min(...bounds.map((bound) => bound.top)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
  };
}

function rectForRole(model: DrawingModel, role: string): DrawingRect {
  const match = model.elements.flatMap((element) => element.shapes).find(
    (shape): shape is DrawingRect => shape.kind === "rect" && shape.role === role
  );
  assertCondition(!!match, `expected rectangle role ${role} is missing from fixed sash base drawing.`);
  return match;
}

function beadOuterBounds(model: DrawingModel): Bounds {
  const beadShapes = model.geometry.sash.filter((shape): shape is DrawingPolygon =>
    shape.kind === "polygon" && !!shape.role?.includes("glazing_bead")
  );
  assertCondition(beadShapes.length === 4, "expected four mitred bead polygons in fixed sash base drawing.");
  return boundsForShapes(beadShapes);
}

function dashedLine(input: Omit<DrawingLine, "kind" | "dashed" | "stroke" | "strokeWidth">): DrawingLine {
  return {
    kind: "line",
    dashed: true,
    stroke: "#111",
    strokeWidth: 1.1,
    ...input,
  };
}

function buildTiltTurnOpeningLines(bead: Bounds, operation: TiltTurnFieldOperation): DrawingLine[] {
  const isRightHung = operation === "tt_right" || operation === "turn_right";
  const hingeX = isRightHung ? bead.right : bead.left;
  const handleX = isRightHung ? bead.left : bead.right;
  const rolePrefix =
    operation === "turn_left"
      ? "turn_left"
      : operation === "turn_right"
        ? "turn_right"
        : operation === "tilt_only"
          ? "tilt_only"
          : isRightHung
            ? "tilt_turn_right"
            : "tilt_turn";
  const centerHandle = {
    x: handleX,
    y: (bead.top + bead.bottom) / 2,
  };
  const topCenter = {
    x: (bead.left + bead.right) / 2,
    y: bead.top,
  };

  const sideOpeningTriangle = [
    dashedLine({
      x1: hingeX,
      y1: bead.top,
      x2: centerHandle.x,
      y2: centerHandle.y,
      role: `${rolePrefix}_opening_top_hinge_to_handle_center`,
    }),
    dashedLine({
      x1: hingeX,
      y1: bead.bottom,
      x2: centerHandle.x,
      y2: centerHandle.y,
      role: `${rolePrefix}_opening_bottom_hinge_to_handle_center`,
    }),
  ];

  const topTiltTriangle = [
    dashedLine({
      x1: hingeX,
      y1: bead.bottom,
      x2: topCenter.x,
      y2: topCenter.y,
      role: `${rolePrefix}_opening_bottom_hinge_to_top_center`,
    }),
    dashedLine({
      x1: topCenter.x,
      y1: topCenter.y,
      x2: handleX,
      y2: bead.bottom,
      role: `${rolePrefix}_opening_top_center_to_bottom_handle`,
    }),
  ];

  if (operation === "turn_left" || operation === "turn_right") return sideOpeningTriangle;
  if (operation === "tilt_only") return topTiltTriangle;
  return [...sideOpeningTriangle, ...topTiltTriangle];
}

export function buildB92TiltTurnInternalDrawingModelFromContract(contract: WindowTypeRenderModel): DrawingModel {
  const { field, operation } = assertB92TiltTurnInternalContract(contract);
  const baseModel = buildB92FixedSashInternalDrawingModelFromContract(toFixedSashContract(contract));
  const frameOuter = rectForRole(baseModel, "frame_outer");
  const sashOuter = rectForRole(baseModel, "b92_fixed_sash_internal_sash_outer");
  const glass = rectForRole(baseModel, "b92_fixed_sash_internal_visible_glass");
  const bead = beadOuterBounds(baseModel);
  const openingLines = buildTiltTurnOpeningLines(bead, operation);
  const scale = frameOuter.width / baseModel.width;
  const handleSide = operation === "tt_right" || operation === "turn_right" ? "left" : operation === "tilt_only" ? null : "right";
  const handle: DrawingHandle | null =
    handleSide === null
      ? null
      : {
          x:
            handleSide === "right"
              ? sashOuter.x + sashOuter.width - 57 * scale * 0.55
              : sashOuter.x + 57 * scale * 0.55,
          y: sashOuter.y + sashOuter.height / 2,
          size: 10,
          role: "handle",
        };
  const labelValue =
    operation === "tt_right"
      ? "Tilt & Turn Right"
      : operation === "turn_left"
        ? "Turn Left"
        : operation === "turn_right"
          ? "Turn Right"
          : operation === "tilt_only"
            ? "Tilt Only"
            : "Tilt & Turn Left";
  const label: DrawingLabel = {
    x: glass.x + 8,
    y: glass.y + 16,
    value: labelValue,
    fontSize: 9,
    fill: "#3f3f46",
    anchor: "start",
    role: "field_label",
  };
  const marker: DrawingMarker = {
    x: baseModel.interaction.cells[0]?.x ?? 0 + (baseModel.interaction.cells[0]?.width ?? 0) / 2,
    y: baseModel.interaction.cells[0]?.y ?? 0 + (baseModel.interaction.cells[0]?.height ?? 0) / 2,
    radius: 16,
    value: "1",
    role: "field_marker",
  };
  const correctedMarker = baseModel.interaction.cells[0]
    ? {
        ...marker,
        x: baseModel.interaction.cells[0].x + baseModel.interaction.cells[0].width / 2,
        y: baseModel.interaction.cells[0].y + baseModel.interaction.cells[0].height / 2,
      }
    : marker;

  return {
    ...baseModel,
    elements: baseModel.elements.map((element) =>
      element.id === "glass"
        ? {
            ...element,
            shapes: [...element.shapes, ...openingLines],
          }
        : element
    ),
    geometry: {
      ...baseModel.geometry,
      glass: [...baseModel.geometry.glass, ...openingLines],
    },
    annotations: {
      ...baseModel.annotations,
      labels: [...baseModel.annotations.labels, label],
      handles: handle ? [...baseModel.annotations.handles, handle] : baseModel.annotations.handles,
      markers: [...baseModel.annotations.markers, correctedMarker],
    },
    metadata: {
      ...baseModel.metadata,
      operationType: "tilt_turn",
      devReports: {
        ...baseModel.metadata.devReports,
        b92TiltTurnInternalContractDrawingAdapter: {
          adapterName: "buildB92TiltTurnInternalDrawingModelFromContract",
          fieldId: field.id,
          baseAdapter: "buildB92FixedSashInternalDrawingModelFromContract",
          openingType: "tilt_turn",
          operation,
          hingeSide:
            operation === "tt_right" || operation === "turn_right"
              ? "right"
              : operation === "tilt_only"
                ? null
                : "left",
          handleSide,
          openingLineAnchor: "beadOuter",
          beadOuterSvg: bead,
          note: "Isolated B92 Tilt & Turn internal adapter; closed geometry reuses the approved fixed sash adapter and adds dashed opening, handle, label, and marker overlays only.",
        },
      },
    },
  };
}
