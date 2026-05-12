import type {
  B92CornerSystem,
  B92CouplingSystem,
  B92FieldType,
  B92JoinCondition,
  B92ProfileId,
  B92ResolverConstraint,
  B92ThresholdSystem,
} from "./b92ProfileTypes";
import type {
  B92ResolvedProfileAssignment,
  B92SegmentResolutionIssue,
} from "./b92SegmentResolver.types";

export type WindowTypeRenderSystem = "B92";

export type WindowTypeRenderReferenceView = "external";

export type WindowTypeRenderValidationMode = "external_refs_internal_validation";

export type WindowTypeRenderB92SegmentResolverDiagnostics = {
  diagnosticOnly: true;
  visualGeometryChanged: false;
  verticalJunctionAssignments: B92ResolvedProfileAssignment[];
  horizontalTransomAssignments: B92ResolvedProfileAssignment[];
  outerEdgeAssignments: B92ResolvedProfileAssignment[];
  sillAssignments: B92ResolvedProfileAssignment[];
  issues: B92SegmentResolutionIssue[];
};

export type WindowTypeRenderMeta = {
  system: WindowTypeRenderSystem;
  referenceView: WindowTypeRenderReferenceView;
  validationMode?: WindowTypeRenderValidationMode;
  source: "resolver_contract";
  designRule: string;
  notes?: string[];
  dev?: {
    b92RenderSegmentedSillOverlay?: boolean | null;
    b92SegmentResolverDiagnostics?: WindowTypeRenderB92SegmentResolverDiagnostics | null;
  };
};

export type WindowTypeRenderOverall = {
  widthMm: number;
  heightMm: number;
};

export type WindowTypeRenderProfileRef = {
  profileId: B92ProfileId | null;
  candidateProfileIds?: B92ProfileId[];
  source: "resolved" | "explicit_option" | "candidate_required" | "not_applicable";
  note?: string;
};

export type WindowTypeRenderPerimeter = {
  top: WindowTypeRenderProfileRef;
  bottom: WindowTypeRenderProfileRef;
  left: WindowTypeRenderProfileRef;
  right: WindowTypeRenderProfileRef;
};

export type WindowTypeRenderGlass = {
  widthMm: number;
  heightMm: number;
  source: "validation_example" | "resolved";
  note?: string;
};

export type WindowTypeRenderFieldOperation =
  | "fixed"
  | "fixed_sash"
  | "tt_left"
  | "tt_right"
  | "turn_left"
  | "turn_right"
  | "tilt_only"
  | "top_hung"
  | "reversible"
  | "pivot"
  | "inward_opening_left"
  | "inward_opening_right"
  | "outward_opening_left"
  | "outward_opening_right"
  | "slide_left"
  | "slide_right"
  | "lift_slide_left"
  | "lift_slide_right";

export type WindowTypeRenderSashGeometry = {
  visibleFaceMm?: Partial<Record<"top" | "bottom" | "left" | "right", number>>;
  insetMm?: Partial<Record<"top" | "bottom" | "left" | "right", number>>;
  overlapMm?: Partial<Record<"top" | "bottom" | "left" | "right", number>>;
  beadVisibleFaceMm?: Partial<Record<"top" | "bottom" | "left" | "right", number>>;
  glassOrderRule?: {
    biteBehindBeadMm: number;
    widthDeltaMm: number;
    heightDeltaMm: number;
    formula: "visible_glass_plus_2x_bite";
  };
};

export type WindowTypeRenderSash = {
  openingType: Extract<B92FieldType, "fixed_sash" | "tilt_turn" | "turn_only">;
  operation?: WindowTypeRenderFieldOperation | string;
  hingeSide?: "left" | "right" | null;
  handleSide?: "left" | "right" | null;
  profiles?: Partial<Record<"top" | "bottom" | "left" | "right", WindowTypeRenderProfileRef>>;
  geometry?: WindowTypeRenderSashGeometry;
};

export type WindowTypeRenderField = {
  id: string;
  row: number;
  column: number;
  type: B92FieldType;
  operation?: WindowTypeRenderFieldOperation | string;
  /**
   * Field dimensions must come from Window Type layout geometry.
   * They cannot be derived from resolveB92Profiles() output alone.
   */
  dimensionsMm: {
    width: number;
    height: number;
  };
  perimeter: WindowTypeRenderPerimeter;
  glass?: WindowTypeRenderGlass;
  sash?: WindowTypeRenderSash;
  constraints?: WindowTypeRenderConstraint[];
};

export type WindowTypeRenderJunction = {
  id: string;
  axis: "vertical" | "horizontal";
  condition: B92JoinCondition;
  betweenFieldIds: [string, string];
  profile: WindowTypeRenderProfileRef;
  ownerFieldId?: string | null;
  constraints?: WindowTypeRenderConstraint[];
};

export type WindowTypeRenderCorner = {
  id: string;
  system: B92CornerSystem;
  angleDegrees?: number | null;
  category: "corner90" | "bay" | "glass";
  planViewOnly: true;
  block?: {
    blockLabel?: string;
    blockSource?: "locked_map" | "pending_confirmation";
    widthMm?: number;
    depthMm?: number;
    steppedBaseMm?: [number, number];
    note?: string;
  };
  behaviourConstraints?: WindowTypeRenderConstraint[];
  involvedFieldIds: string[];
  note?: string;
};

export type WindowTypeRenderCoupling = {
  id: string;
  condition: B92JoinCondition;
  system: B92CouplingSystem | null;
  candidateSystems?: B92CouplingSystem[];
  constraints?: WindowTypeRenderConstraint[];
  note?: string;
};

export type WindowTypeRenderThreshold = {
  id: string;
  fieldId: string;
  system: B92ThresholdSystem;
  replacesBottomSill: true;
  note?: string;
};

export type WindowTypeRenderOuterEdgeSegment = {
  edge: "top" | "bottom" | "left" | "right";
  segmentIndex: number;
  row?: number;
  column?: number;
  fieldId: string;
  profile: {
    profileId: string;
  };
};

export type WindowTypeRenderSillSegment = {
  column: number;
  segmentIndex: number;
  fieldId: string;
  profile: {
    profileId: string;
  };
};

export type WindowTypeRenderConstraint = {
  sourceId: string;
  constraint:
    | B92ResolverConstraint
    | "orientation_required";
  severity: "info" | "warning" | "blocking";
  note?: string;
};

export type WindowTypeRenderModel = {
  meta: WindowTypeRenderMeta;
  overall: WindowTypeRenderOverall;
  fields: WindowTypeRenderField[];
  verticalJunctions: WindowTypeRenderJunction[];
  horizontalJunctions: WindowTypeRenderJunction[];
  outerEdgeSegments?: WindowTypeRenderOuterEdgeSegment[];
  sillSegments?: WindowTypeRenderSillSegment[];
  couplings: WindowTypeRenderCoupling[];
  corners: WindowTypeRenderCorner[];
  thresholds: WindowTypeRenderThreshold[];
  constraints: WindowTypeRenderConstraint[];
};

export const fixed_single_internal_validation_contract: WindowTypeRenderModel = {
  meta: {
    system: "B92",
    referenceView: "external",
    validationMode: "external_refs_internal_validation",
    source: "resolver_contract",
    designRule:
      "Renderer must not decide profiles. Window Type render engine becomes the source of truth for admin configurator preview and front-end estimate configurator.",
    notes: [
      "All numbered B92 elevation references are external-view references.",
      "Glass size is validation example data only, not global sizing logic.",
    ],
  },
  overall: {
    widthMm: 1000,
    heightMm: 1000,
  },
  fields: [
    {
      id: "fixed-1",
      row: 0,
      column: 0,
      type: "fixed",
      dimensionsMm: {
        width: 1000,
        height: 1000,
      },
      perimeter: {
        top: { profileId: "B92-1", source: "resolved" },
        left: { profileId: "B92-2", source: "resolved" },
        right: { profileId: "B92-2", source: "resolved" },
        bottom: { profileId: "B92-3", source: "resolved" },
      },
      glass: {
        widthMm: 870,
        heightMm: 855,
        source: "validation_example",
        note: "Supplied drawing validation example for 1000 x 1000 fixed only.",
      },
    },
  ],
  verticalJunctions: [],
  horizontalJunctions: [],
  couplings: [],
  corners: [],
  thresholds: [],
  constraints: [],
};
