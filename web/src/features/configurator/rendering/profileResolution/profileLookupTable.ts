import type {
  PilotFieldBaseType,
  PilotFieldHanding,
  PilotProfileSelection,
  ProfileEdge,
  ProfileRefId,
  ProfileResolutionView,
} from "./profileTypes";

export type ProfileLookupView = ProfileResolutionView;
export type ProfileLookupLayoutKind = "oneField" | "twoFieldHorizontal" | "twoFieldVertical" | "grid";
export type ProfileLookupPosition =
  | "head"
  | "sill"
  | "leftJamb"
  | "rightJamb"
  | "verticalConnection"
  | "horizontalConnection";
export type ProfileLookupContext =
  | "standardFixed"
  | "standardTiltTurn"
  | "fixedFixed"
  | "fixedTiltTurnHorizontal"
  | "fixedOverTiltTurn"
  | "tiltTurnOverFixed"
  | "topFixedBottomMixed"
  | "topMixedBottomFixed"
  | "tiltTurnTiltTurn"
  | "flyingMullion";
export type ProfileLookupRowColumnRole = "top" | "middle" | "bottom" | "left" | "right";
export type SystemLookupRole =
  | "straightCoupler"
  | "corner90"
  | "angledBay_fixed"
  | "angledBay_fixed_wide"
  | "angledBay_tilt"
  | "angledBay_tilt_wide"
  | "glassToGlass";

export type ProfileLookupRow = {
  id: string;
  view: ProfileLookupView;
  systemFamily: string;
  layoutKind: ProfileLookupLayoutKind;
  fieldType?: PilotFieldBaseType | "fixedHandle" | "fixedHinge";
  position: ProfileLookupPosition;
  context: ProfileLookupContext;
  rowRole?: ProfileLookupRowColumnRole | null;
  columnRole?: ProfileLookupRowColumnRole | null;
  handing?: PilotFieldHanding | "handle" | "hinge" | null;
  neighbourType?: PilotFieldBaseType | null;
  profileRef: PilotProfileSelection;
  sectionName: string;
  dimensionStack: string;
  mirrored?: boolean;
  requiresConfirmation?: boolean;
  notes?: string;
};

export type SystemLookupRow = {
  id: string;
  systemFamily: string;
  role: SystemLookupRole;
  profileRef: PilotProfileSelection;
  profileOptions?: ProfileRefId[];
  notes?: string;
};

export const PROFILE_LOOKUP_TABLE: ProfileLookupRow[] = [
  {
    id: "fixed-standard-head-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "head",
    context: "standardFixed",
    profileRef: "B92-1",
    sectionName: "Standard fixed head",
    dimensionStack: "57/21",
  },
  {
    id: "fixed-standard-left-jamb-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "leftJamb",
    context: "standardFixed",
    profileRef: "B92-2",
    sectionName: "Standard fixed jamb",
    dimensionStack: "57/21",
  },
  {
    id: "fixed-standard-right-jamb-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "rightJamb",
    context: "standardFixed",
    profileRef: "B92-2",
    sectionName: "Standard fixed jamb mirrored",
    dimensionStack: "21/57",
    mirrored: true,
  },
  {
    id: "fixed-standard-sill-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "sill",
    context: "standardFixed",
    profileRef: "B92-3",
    sectionName: "Standard fixed sill",
    dimensionStack: "72/21",
  },
  {
    id: "fixed-standard-head-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "head",
    context: "standardFixed",
    profileRef: "B92-1",
    sectionName: "Standard fixed head outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external geometry remains renderer-owned.",
  },
  {
    id: "fixed-standard-left-jamb-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "leftJamb",
    context: "standardFixed",
    profileRef: "B92-2",
    sectionName: "Standard fixed jamb outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external geometry remains renderer-owned.",
  },
  {
    id: "fixed-standard-right-jamb-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "rightJamb",
    context: "standardFixed",
    profileRef: "B92-2",
    sectionName: "Standard fixed jamb outside mirrored",
    dimensionStack: "external-ref-only",
    mirrored: true,
    notes: "Outside profile ref known; external geometry remains renderer-owned.",
  },
  {
    id: "fixed-standard-sill-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "fixed",
    position: "sill",
    context: "standardFixed",
    profileRef: "B92-3",
    sectionName: "Standard fixed sill outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external geometry remains renderer-owned.",
  },
  {
    id: "fixed-fixed-head-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    fieldType: "fixed",
    position: "head",
    context: "fixedFixed",
    profileRef: "B92-1",
    sectionName: "Fixed/fixed outer head",
    dimensionStack: "57/21",
  },
  {
    id: "fixed-fixed-left-jamb-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    fieldType: "fixed",
    position: "leftJamb",
    context: "fixedFixed",
    profileRef: "B92-2",
    sectionName: "Fixed/fixed outer left jamb",
    dimensionStack: "57/21",
  },
  {
    id: "fixed-fixed-right-jamb-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    fieldType: "fixed",
    position: "rightJamb",
    context: "fixedFixed",
    profileRef: "B92-2",
    sectionName: "Fixed/fixed outer right jamb mirrored",
    dimensionStack: "21/57",
    mirrored: true,
  },
  {
    id: "fixed-fixed-sill-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    fieldType: "fixed",
    position: "sill",
    context: "fixedFixed",
    profileRef: "B92-3",
    sectionName: "Fixed/fixed outer sill",
    dimensionStack: "72/21",
  },
  {
    id: "fixed-fixed-vertical-connection-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    position: "verticalConnection",
    context: "fixedFixed",
    profileRef: "B92-14",
    sectionName: "Solid Sash Bar / fixed-fixed centre vertical mullion",
    dimensionStack: "21/36/21",
    notes: "78mm internal centre vertical mullion.",
  },
  {
    id: "tiltturn-standard-head-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "head",
    context: "standardTiltTurn",
    profileRef: "B92-7",
    sectionName: "Standard Tilt & Turn head",
    dimensionStack: "37.5",
  },
  {
    id: "tiltturn-standard-sill-inside",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "sill",
    context: "standardTiltTurn",
    profileRef: "B92-8",
    sectionName: "Standard Tilt & Turn sill",
    dimensionStack: "standard",
  },
  {
    id: "tiltturn-standard-left-hinge",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "leftJamb",
    context: "standardTiltTurn",
    handing: "left",
    profileRef: "B92-10",
    sectionName: "Tilt & Turn hinge-side jamb",
    dimensionStack: "37.5",
  },
  {
    id: "tiltturn-standard-right-handle",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "rightJamb",
    context: "standardTiltTurn",
    handing: "left",
    profileRef: "B92-9",
    sectionName: "Tilt & Turn handle-side jamb",
    dimensionStack: "37.5",
  },
  {
    id: "tiltturn-standard-left-handle",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "leftJamb",
    context: "standardTiltTurn",
    handing: "right",
    profileRef: "B92-9",
    sectionName: "Tilt & Turn handle-side jamb",
    dimensionStack: "37.5",
  },
  {
    id: "tiltturn-standard-right-hinge",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "rightJamb",
    context: "standardTiltTurn",
    handing: "right",
    profileRef: "B92-10",
    sectionName: "Tilt & Turn hinge-side jamb",
    dimensionStack: "37.5",
  },
  {
    id: "tiltturn-standard-head-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "head",
    context: "standardTiltTurn",
    profileRef: "B92-7",
    sectionName: "Standard Tilt & Turn head outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external layered geometry remains renderer-owned.",
  },
  {
    id: "tiltturn-standard-sill-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "sill",
    context: "standardTiltTurn",
    profileRef: "B92-8",
    sectionName: "Standard Tilt & Turn sill outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external layered geometry remains renderer-owned.",
  },
  {
    id: "tiltturn-standard-left-hinge-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "leftJamb",
    context: "standardTiltTurn",
    handing: "left",
    profileRef: "B92-10",
    sectionName: "Tilt & Turn hinge-side jamb outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external layered geometry remains renderer-owned.",
  },
  {
    id: "tiltturn-standard-right-handle-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "rightJamb",
    context: "standardTiltTurn",
    handing: "left",
    profileRef: "B92-9",
    sectionName: "Tilt & Turn handle-side jamb outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external layered geometry remains renderer-owned.",
  },
  {
    id: "tiltturn-standard-left-handle-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "leftJamb",
    context: "standardTiltTurn",
    handing: "right",
    profileRef: "B92-9",
    sectionName: "Tilt & Turn handle-side jamb outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external layered geometry remains renderer-owned.",
  },
  {
    id: "tiltturn-standard-right-hinge-outside",
    view: "outside",
    systemFamily: "europa92_alu",
    layoutKind: "oneField",
    fieldType: "tiltTurn",
    position: "rightJamb",
    context: "standardTiltTurn",
    handing: "right",
    profileRef: "B92-10",
    sectionName: "Tilt & Turn hinge-side jamb outside",
    dimensionStack: "external-ref-only",
    notes: "Outside profile ref known; external layered geometry remains renderer-owned.",
  },
  {
    id: "flying-mullion-standard",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    position: "verticalConnection",
    context: "flyingMullion",
    profileRef: "B92-18",
    sectionName: "Flying mullion",
    dimensionStack: "5mm gap",
  },
  {
    id: "tiltturn-static-mullion-standard",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    position: "verticalConnection",
    context: "tiltTurnTiltTurn",
    profileRef: "B92-15",
    sectionName: "T&T/T&T static mullion",
    dimensionStack: "100mm / 19mm gap",
  },
  {
    id: "fixed-over-tiltturn-transom",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldVertical",
    position: "horizontalConnection",
    context: "fixedOverTiltTurn",
    profileRef: "B92-21",
    sectionName: "Fixed over T&T transom",
    dimensionStack: "asymmetric",
  },
  {
    id: "tiltturn-over-fixed-transom",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldVertical",
    position: "horizontalConnection",
    context: "tiltTurnOverFixed",
    profileRef: "B92-20",
    sectionName: "T&T over fixed transom",
    dimensionStack: "asymmetric",
    notes: "Keep B92-7 as confirmed T&T head/top; later B92-8 head note requires confirmation.",
  },
  {
    id: "tiltturn-over-tiltturn-transom",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldVertical",
    position: "horizontalConnection",
    context: "tiltTurnTiltTurn",
    profileRef: "B92-22",
    sectionName: "T&T over T&T transom",
    dimensionStack: "asymmetric",
  },
  {
    id: "fixed-fixed-top-fixed-bottom-mixed-transom",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "grid",
    position: "horizontalConnection",
    context: "topFixedBottomMixed",
    profileRef: "B92-23",
    sectionName: "Row-aware fixed/fixed transom, top fixed bottom mixed",
    dimensionStack: "row-composition-aware",
    notes: "B92 horizontal transom where top row has only fixed cells and bottom row is mixed fixed/T&T.",
  },
  {
    id: "fixed-fixed-top-mixed-bottom-fixed-transom",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "grid",
    position: "horizontalConnection",
    context: "topMixedBottomFixed",
    profileRef: "B92-24",
    sectionName: "Row-aware fixed/fixed transom, top mixed bottom fixed",
    dimensionStack: "row-composition-aware",
    notes: "B92 horizontal transom where top row is mixed fixed/T&T and bottom row has only fixed cells.",
  },
  {
    id: "fixed-tiltturn-horizontal-non-hinge-centre",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    position: "verticalConnection",
    context: "fixedTiltTurnHorizontal",
    profileRef: "B92-12",
    sectionName: "Fixed/T&T mixed centre vertical mullion",
    dimensionStack: "asymmetric",
    requiresConfirmation: true,
    notes: "B92 fixed/T&T handle-centre mullion.",
  },
  {
    id: "fixed-tiltturn-horizontal-hinge-centre",
    view: "inside",
    systemFamily: "europa92_alu",
    layoutKind: "twoFieldHorizontal",
    position: "verticalConnection",
    context: "fixedTiltTurnHorizontal",
    profileRef: "B92-13",
    sectionName: "Fixed/T&T mixed hinge-at-centre mullion",
    dimensionStack: "asymmetric",
    requiresConfirmation: true,
    notes: "B92 fixed/T&T hinge-centre mullion.",
  },
];

export const SYSTEM_LOOKUP_TABLE: SystemLookupRow[] = [
  {
    id: "b92-straight-coupler-options",
    systemFamily: "europa92_alu",
    role: "straightCoupler",
    profileRef: "REQUIRES_CONFIRMATION",
    profileOptions: ["B92-C01", "B92-C02", "B92-C03", "B92-C04", "B92-C05", "B92-C06"],
    notes: "Straight coupled-window connection requires C01-C06 option selection.",
  },
  {
    id: "b92-corner90-options",
    systemFamily: "europa92_alu",
    role: "corner90",
    profileRef: "REQUIRES_CONFIRMATION",
    profileOptions: ["B92-C07", "B92-C08", "B92-C09", "B92-C10", "B92-C11", "B92-C12"],
    notes: "90 degree corner post requires C07-C12 option selection.",
  },
  {
    id: "b92-angled-bay-fixed-91-140",
    systemFamily: "europa92_alu",
    role: "angledBay_fixed",
    profileRef: "B92-C13",
  },
  {
    id: "b92-angled-bay-fixed-141-179",
    systemFamily: "europa92_alu",
    role: "angledBay_fixed_wide",
    profileRef: "B92-C14",
  },
  {
    id: "b92-angled-bay-tilt-91-140",
    systemFamily: "europa92_alu",
    role: "angledBay_tilt",
    profileRef: "B92-C15",
    notes: "Single tilt only constraint is metadata-only at resolver level.",
  },
  {
    id: "b92-angled-bay-tilt-141-179",
    systemFamily: "europa92_alu",
    role: "angledBay_tilt_wide",
    profileRef: "B92-C16",
    notes: "Single tilt only constraint is metadata-only at resolver level.",
  },
  {
    id: "b92-glass-to-glass-corner",
    systemFamily: "europa92_alu",
    role: "glassToGlass",
    profileRef: "B92-C17",
    notes: "Structural glazing / glass-to-glass corner, site glazed, no corner post.",
  },
];

type LookupMatchInput = {
  view: ProfileLookupView;
  systemFamily?: string;
  layoutKind: ProfileLookupLayoutKind;
  fieldType?: PilotFieldBaseType;
  position: ProfileLookupPosition;
  context: ProfileLookupContext;
  handing?: PilotFieldHanding | null;
};

export function lookupProfileRow(input: LookupMatchInput): ProfileLookupRow | null {
  const systemFamily = input.systemFamily ?? "europa92_alu";
  return (
    PROFILE_LOOKUP_TABLE.find((row) => {
      if (row.view !== input.view) return false;
      if (row.systemFamily !== systemFamily) return false;
      if (row.layoutKind !== input.layoutKind) return false;
      if (row.position !== input.position) return false;
      if (row.context !== input.context) return false;
      if (typeof row.fieldType !== "undefined" && row.fieldType !== input.fieldType) return false;
      if (typeof row.handing !== "undefined" && row.handing !== input.handing) return false;
      return true;
    }) ?? null
  );
}

export function lookupSystemProfile(input: {
  systemFamily?: string;
  role: SystemLookupRole;
}): SystemLookupRow | null {
  const systemFamily = input.systemFamily ?? "europa92_alu";
  return (
    SYSTEM_LOOKUP_TABLE.find((row) => {
      if (row.systemFamily !== systemFamily) return false;
      if (row.role !== input.role) return false;
      return true;
    }) ?? null
  );
}

export function mapEdgeToLookupPosition(edge: ProfileEdge): ProfileLookupPosition {
  if (edge === "top") return "head";
  if (edge === "bottom") return "sill";
  if (edge === "left") return "leftJamb";
  return "rightJamb";
}

export function mapLayoutKind(fieldsX: number, fieldsY: number): ProfileLookupLayoutKind {
  if (fieldsX === 1 && fieldsY === 1) return "oneField";
  if (fieldsX === 2 && fieldsY === 1) return "twoFieldHorizontal";
  if (fieldsX === 1 && fieldsY === 2) return "twoFieldVertical";
  return "grid";
}
