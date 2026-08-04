import type {
  PilotConnectionAxis,
  ProfileResolutionView,
  ResolvedPilotConnection,
} from "./profileTypes";
import {
  lookupProfileRow,
  mapLayoutKind,
  type ProfileLookupContext,
} from "./profileLookupTable";
import {
  isTiltTurnFamily,
  type NormalizedField,
  type VerticalAdjacency,
} from "./fieldGrid";

function resolveLayoutKind(fieldsX: number, fieldsY: number) {
  return mapLayoutKind(fieldsX, fieldsY);
}

function resolveConnectionContext(input: {
  axis: PilotConnectionAxis;
  leftOrUpper: NormalizedField;
  rightOrLower: NormalizedField;
  isFlying: boolean;
}): ProfileLookupContext | null {
  const a = input.leftOrUpper.type;
  const b = input.rightOrLower.type;
  if (input.axis === "vertical") {
    if (input.isFlying) return "flyingMullion";
    if (a === "fixed" && b === "fixed") return "fixedFixed";
    if ((a === "fixed" && isTiltTurnFamily(b)) || (isTiltTurnFamily(a) && b === "fixed")) return "fixedTiltTurnHorizontal";
    if (isTiltTurnFamily(a) && isTiltTurnFamily(b)) return "tiltTurnTiltTurn";
    return null;
  }
  if (a === "fixed" && b === "fixed") return "fixedFixed";
  if (a === "fixed" && isTiltTurnFamily(b)) return "fixedOverTiltTurn";
  if (isTiltTurnFamily(a) && b === "fixed") return "tiltTurnOverFixed";
  if (isTiltTurnFamily(a) && isTiltTurnFamily(b)) return "tiltTurnTiltTurn";
  return null;
}

function lookupConnectionProfile(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  axis: PilotConnectionAxis;
  leftOrUpper: NormalizedField;
  rightOrLower: NormalizedField;
  hingeAtCentre?: boolean;
  isFlying: boolean;
}) {
  const context = resolveConnectionContext(input);
  if (!context) return null;
  const row = lookupProfileRow({
    view: input.view,
    layoutKind: resolveLayoutKind(input.fieldsX, input.fieldsY),
    position: input.axis === "vertical" ? "verticalConnection" : "horizontalConnection",
    context,
  });
  if (!row) return null;
  if (context === "fixedTiltTurnHorizontal" && input.axis === "vertical") {
    if (input.hingeAtCentre && row.profileRef !== "B92-13") return null;
    if (!input.hingeAtCentre && row.profileRef !== "B92-12") return null;
  }
  return row;
}

function unresolvedExternalConnection(input: {
  key: string;
  axis: PilotConnectionAxis;
  type: "static" | "flying";
  startKey: string;
  endKey: string;
  row?: number;
  col?: number;
  note: string;
}): ResolvedPilotConnection {
  return {
    key: input.key,
    axis: input.axis,
    type: input.type,
    startKey: input.startKey,
    endKey: input.endKey,
    row: input.row,
    col: input.col,
    profileRef: "REQUIRES_CONFIRMATION",
    requiresExternalMapping: true,
    note: input.note,
  };
}

function flyingMullionMetadata(ownerFieldId: string | null) {
  return {
    requiresOwnerField: true,
    ownerFieldId,
    ...(!ownerFieldId ? { warning: "Flying mullion requires owner field selection" } : {}),
  };
}

function unresolvedFlyingMullion(input: {
  key: string;
  row: number;
  leftField: NormalizedField;
  rightField: NormalizedField;
}): ResolvedPilotConnection {
  return {
    key: input.key,
    axis: "vertical",
    type: "flying",
    startKey: input.leftField.key,
    endKey: input.rightField.key,
    row: input.row,
    profileRef: "REQUIRES_CONFIRMATION",
    metadata: flyingMullionMetadata(null),
    note: "Flying mullion requires owner field selection",
  };
}

function resolveVerticalProfile(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  key: string;
  row: number;
  leftField: NormalizedField;
  rightField: NormalizedField;
  junctionType: "static" | "flying";
  ownerFieldId: string | null;
}): ResolvedPilotConnection {
  const { leftField, rightField } = input;
  const leftType = leftField.type;
  const rightType = rightField.type;
  if (input.junctionType === "flying" && !input.ownerFieldId) {
    return unresolvedFlyingMullion({
      key: input.key,
      row: input.row,
      leftField,
      rightField,
    });
  }
  const isFlying =
    input.junctionType === "flying" &&
    (input.ownerFieldId === leftField.key || input.ownerFieldId === rightField.key);
  const hingeAtCentreFixedTiltTurn = Boolean(
    leftType === "fixed" && isTiltTurnFamily(rightType)
      ? rightField.hingeSide === "left"
      : isTiltTurnFamily(leftType) && rightType === "fixed"
        ? leftField.hingeSide === "right"
        : false
  );
  const lookup = lookupConnectionProfile({
    view: input.view,
    fieldsX: input.fieldsX,
    fieldsY: input.fieldsY,
    axis: "vertical",
    leftOrUpper: leftField,
    rightOrLower: rightField,
    hingeAtCentre: hingeAtCentreFixedTiltTurn,
    isFlying,
  });
  if (lookup) {
    return {
      key: input.key,
      axis: "vertical",
      type: isFlying ? "flying" : "static",
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      profileRef: lookup.profileRef,
      mirrored: isFlying ? input.ownerFieldId === leftField.key : (isTiltTurnFamily(leftType) && rightType === "fixed") || !!lookup.mirrored,
      hingeAtCentre: isFlying ? undefined : hingeAtCentreFixedTiltTurn || undefined,
      note:
        lookup.notes ??
        (lookup.profileRef === "B92-14"
          ? "Solid Sash Bar / fixed-fixed 78mm internal centre vertical mullion. Structural split at centreline of 36mm core."
          : lookup.profileRef === "B92-18"
            ? `owner=${input.ownerFieldId ?? "unknown"}, 5mm sash gap, no static post`
            : lookup.profileRef === "B92-15"
              ? "T&T/T&T static mullion, 100mm centre, 19mm sash gap."
              : undefined),
      ...(lookup.profileRef === "B92-18" ? { metadata: flyingMullionMetadata(input.ownerFieldId) } : {}),
    };
  }
  if (input.view === "outside") {
    return unresolvedExternalConnection({
      key: input.key,
      axis: "vertical",
      type: input.junctionType,
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      note: `External vertical mapping requires CSV-backed rule for ${leftType} + ${rightType}.`,
    });
  }
  if (isFlying) {
    return {
      key: input.key,
      axis: "vertical",
      type: "flying",
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      profileRef: "B92-18",
      mirrored: input.ownerFieldId === leftField.key,
      note: `owner=${input.ownerFieldId ?? "unknown"}, 5mm sash gap, no static post`,
      metadata: flyingMullionMetadata(input.ownerFieldId),
    };
  }
  if (leftType === "fixed" && rightType === "fixed") {
    return {
      key: input.key,
      axis: "vertical",
      type: "static",
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      profileRef: "B92-14",
      note: "Solid Sash Bar / fixed-fixed 78mm internal centre vertical mullion. Structural split at centreline of 36mm core.",
    };
  }
  if (leftType === "fixed" && isTiltTurnFamily(rightType)) {
    const hingeAtCentre = rightField.hingeSide === "left";
    return {
      key: input.key,
      axis: "vertical",
      type: "static",
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      profileRef: hingeAtCentre ? "B92-13" : "B92-12",
      hingeAtCentre,
      mirrored: false,
      note: hingeAtCentre
        ? "Fixed left / T&T right, hinge at centre. B92 fixed/T&T hinge-centre mullion."
        : "Fixed left / T&T right, non-hinge-centre. Mixed centre vertical mullion reference requires confirmation because a later note mentioned B92-15 while earlier supplied section data used B92-12.",
    };
  }
  if (isTiltTurnFamily(leftType) && rightType === "fixed") {
    const hingeAtCentre = leftField.hingeSide === "right";
    return {
      key: input.key,
      axis: "vertical",
      type: "static",
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      profileRef: hingeAtCentre ? "B92-13" : "B92-12",
      hingeAtCentre,
      mirrored: true,
      note: hingeAtCentre
        ? "T&T left / fixed right, hinge at centre. B92 fixed/T&T hinge-centre mullion."
        : "T&T left / fixed right, mirrored mixed mullion. Mixed centre vertical mullion reference requires confirmation because a later note mentioned B92-15 while earlier supplied section data used B92-12.",
    };
  }
  if (isTiltTurnFamily(leftType) && isTiltTurnFamily(rightType)) {
    return {
      key: input.key,
      axis: "vertical",
      type: "static",
      startKey: leftField.key,
      endKey: rightField.key,
      row: input.row,
      profileRef: "B92-15",
      note: "T&T/T&T static mullion, 100mm centre, 19mm sash gap.",
    };
  }
  return {
    key: input.key,
    axis: "vertical",
    type: input.junctionType,
    startKey: leftField.key,
    endKey: rightField.key,
    row: input.row,
    profileRef: "REQUIRES_CONFIRMATION",
    note: `No vertical rule locked for ${leftType} + ${rightType}.`,
  };
}

export function resolveVerticalJunctions(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  adjacencies: VerticalAdjacency[];
}): ResolvedPilotConnection[] {
  return input.adjacencies.map((adjacency) =>
    resolveVerticalProfile({
      view: input.view,
      fieldsX: input.fieldsX,
      fieldsY: input.fieldsY,
      ...adjacency,
    })
  );
}
