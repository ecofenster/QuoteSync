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
  type GridModel,
  type HorizontalAdjacency,
  type NormalizedField,
  type RowModel,
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

function findRow(grid: GridModel, row: number): RowModel | null {
  return grid.rows.find((item) => item.row === row) ?? null;
}

function lookupRowAwareTransomProfile(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  context: "topFixedBottomMixed" | "topMixedBottomFixed";
}) {
  return lookupProfileRow({
    view: input.view,
    layoutKind: resolveLayoutKind(input.fieldsX, input.fieldsY),
    position: "horizontalConnection",
    context: input.context,
  });
}

function resolveHorizontalProfile(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  grid: GridModel;
  key: string;
  col: number;
  upperField: NormalizedField;
  lowerField: NormalizedField;
}): ResolvedPilotConnection {
  const { upperField, lowerField } = input;
  const upperType = upperField.type;
  const lowerType = lowerField.type;
  const lookup = lookupConnectionProfile({
    view: input.view,
    fieldsX: input.fieldsX,
    fieldsY: input.fieldsY,
    axis: "horizontal",
    leftOrUpper: upperField,
    rightOrLower: lowerField,
    isFlying: false,
  });
  if (lookup) {
    return {
      key: input.key,
      axis: "horizontal",
      type: "static",
      startKey: upperField.key,
      endKey: lowerField.key,
      col: input.col,
      profileRef: lookup.profileRef,
      mirrored: !!lookup.mirrored,
      note: lookup.notes,
    };
  }
  if (input.view === "outside") {
    return unresolvedExternalConnection({
      key: input.key,
      axis: "horizontal",
      type: "static",
      startKey: upperField.key,
      endKey: lowerField.key,
      col: input.col,
      note: `External horizontal mapping requires CSV-backed rule for ${upperType} over ${lowerType}.`,
    });
  }
  if (upperType === "fixed" && lowerType === "fixed") {
    const topRow = findRow(input.grid, upperField.row);
    const bottomRow = findRow(input.grid, lowerField.row);
    if (topRow?.composition.hasOnlyFixed && bottomRow?.composition.isMixedFixedTiltTurn) {
      const rowAwareProfile = lookupRowAwareTransomProfile({
        view: input.view,
        fieldsX: input.fieldsX,
        fieldsY: input.fieldsY,
        context: "topFixedBottomMixed",
      });
      if (rowAwareProfile) {
        return {
          key: input.key,
          axis: "horizontal",
          type: "static",
          startKey: upperField.key,
          endKey: lowerField.key,
          col: input.col,
          profileRef: rowAwareProfile.profileRef,
          mirrored: !!rowAwareProfile.mirrored,
          note: rowAwareProfile.notes,
        };
      }
      return {
        key: input.key,
        axis: "horizontal",
        type: "static",
        startKey: upperField.key,
        endKey: lowerField.key,
        col: input.col,
        profileRef: "B92-23",
        note: "Fixed over fixed centre transom.",
      };
    }
    if (topRow?.composition.isMixedFixedTiltTurn && bottomRow?.composition.hasOnlyFixed) {
      const rowAwareProfile = lookupRowAwareTransomProfile({
        view: input.view,
        fieldsX: input.fieldsX,
        fieldsY: input.fieldsY,
        context: "topMixedBottomFixed",
      });
      if (rowAwareProfile) {
        return {
          key: input.key,
          axis: "horizontal",
          type: "static",
          startKey: upperField.key,
          endKey: lowerField.key,
          col: input.col,
          profileRef: rowAwareProfile.profileRef,
          mirrored: !!rowAwareProfile.mirrored,
          note: rowAwareProfile.notes,
        };
      }
      return {
        key: input.key,
        axis: "horizontal",
        type: "static",
        startKey: upperField.key,
        endKey: lowerField.key,
        col: input.col,
        profileRef: "B92-24",
        note: "Row-aware fixed/fixed transom: top row mixed fixed/T&T, bottom row fixed.",
      };
    }
    return {
      key: input.key,
      axis: "horizontal",
      type: "static",
      startKey: upperField.key,
      endKey: lowerField.key,
      col: input.col,
      profileRef: "B92-23",
      note: "Fixed over fixed centre transom.",
    };
  }
  if (upperType === "fixed" && isTiltTurnFamily(lowerType)) {
    return {
      key: input.key,
      axis: "horizontal",
      type: "static",
      startKey: upperField.key,
      endKey: lowerField.key,
      col: input.col,
      profileRef: "B92-21",
      note: "Fixed over T&T mixed transom.",
    };
  }
  if (isTiltTurnFamily(upperType) && lowerType === "fixed") {
    return {
      key: input.key,
      axis: "horizontal",
      type: "static",
      startKey: upperField.key,
      endKey: lowerField.key,
      col: input.col,
      profileRef: "B92-20",
      note: "T&T over fixed mixed transom.",
    };
  }
  if (isTiltTurnFamily(upperType) && isTiltTurnFamily(lowerType)) {
    return {
      key: input.key,
      axis: "horizontal",
      type: "static",
      startKey: upperField.key,
      endKey: lowerField.key,
      col: input.col,
      profileRef: "REQUIRES_CONFIRMATION",
      note: "T&T over T&T horizontal detail requires CAD confirmation.",
    };
  }
  return {
    key: input.key,
    axis: "horizontal",
    type: "static",
    startKey: upperField.key,
    endKey: lowerField.key,
    col: input.col,
    profileRef: "REQUIRES_CONFIRMATION",
    note: `No horizontal rule locked for ${upperType} over ${lowerType}.`,
  };
}

export function resolveHorizontalTransoms(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  grid: GridModel;
  adjacencies: HorizontalAdjacency[];
}): ResolvedPilotConnection[] {
  return input.adjacencies.map((adjacency) =>
    resolveHorizontalProfile({
      view: input.view,
      fieldsX: input.fieldsX,
      fieldsY: input.fieldsY,
      grid: input.grid,
      ...adjacency,
    })
  );
}
