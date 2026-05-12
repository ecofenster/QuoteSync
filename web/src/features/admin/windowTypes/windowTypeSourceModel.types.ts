export type WindowTypeSourceModelView = "inside" | "outside";

export type WindowTypeSourceModelReferenceView = "external" | "internal";

export type WindowTypeSourceModelStatus = "draft" | "approved" | "deprecated";

export type WindowTypeSourceModelProvenance = {
  source: "admin_seed" | "admin_catalog" | "imported_reference" | "manual";
  sourceId?: string;
  version?: string;
  notes?: string[];
};

export type WindowTypeSourceModelLayout = {
  columns: number;
  rows: number;
};

export type WindowTypeSourceModelFieldSelector = {
  row: number;
  column: number;
  fieldKey?: string;
};

export type WindowTypeSourceModelOperationType =
  | "fixed"
  | "fixed_sash"
  | "tilt_turn"
  | "turn_only"
  | "tilt_only"
  | "outward_opening"
  | "door"
  | "sliding"
  | "lift_slide";

export type WindowTypeSourceModelFieldOperation =
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

export type WindowTypeSourceModelProfileRole =
  | "head"
  | "left_jamb"
  | "right_jamb"
  | "sill"
  | "sash_head"
  | "sash_left_jamb"
  | "sash_right_jamb"
  | "sash_bottom"
  | "fixed_internal_interface"
  | "glazing_bead_head"
  | "glazing_bead_left"
  | "glazing_bead_right"
  | "glazing_bead_bottom"
  | "glass_order_rule";

export type WindowTypeSourceModelProfileRef = {
  profileCode: string;
  role: WindowTypeSourceModelProfileRole;
  required: boolean;
  mirrored?: boolean;
  sectionProfileId?: string | null;
  sectionDrawingId?: string | null;
  notes?: string;
};

export type WindowTypeSourceModelPerimeterProfiles = {
  top: WindowTypeSourceModelProfileRef;
  left: WindowTypeSourceModelProfileRef;
  right: WindowTypeSourceModelProfileRef;
  bottom: WindowTypeSourceModelProfileRef;
};

export type WindowTypeSourceModelSashProfiles = {
  top?: WindowTypeSourceModelProfileRef;
  left?: WindowTypeSourceModelProfileRef;
  right?: WindowTypeSourceModelProfileRef;
  bottom?: WindowTypeSourceModelProfileRef;
};

export type WindowTypeSourceModelBeadProfiles = {
  top?: WindowTypeSourceModelProfileRef;
  left?: WindowTypeSourceModelProfileRef;
  right?: WindowTypeSourceModelProfileRef;
  bottom?: WindowTypeSourceModelProfileRef;
};

export type WindowTypeSourceModelInterfaceProfiles = {
  fixedInternal?: WindowTypeSourceModelProfileRef;
};

export type WindowTypeSourceModelVisibleFrameRule = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export type WindowTypeSourceModelSashVisibleFaceRule = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};

export type WindowTypeSourceModelSashInsetOverlapRule = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  formula?: "frame_opening_offset" | "explicit_per_side";
  notes?: string[];
};

export type WindowTypeSourceModelSashGeometryRules = {
  visibleFaceMm?: WindowTypeSourceModelSashVisibleFaceRule;
  insetMm?: WindowTypeSourceModelSashInsetOverlapRule;
  overlapMm?: WindowTypeSourceModelSashInsetOverlapRule;
};

export type WindowTypeSourceModelBeadVisibleFaceRule = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};

export type WindowTypeSourceModelBeadGeometryRules = {
  visibleFaceMm?: WindowTypeSourceModelBeadVisibleFaceRule;
  biteBehindBeadMm?: number;
  notes?: string[];
};

export type WindowTypeSourceModelGlassOrderRule = {
  biteBehindBeadMm: number;
  widthDeltaMm: number;
  heightDeltaMm: number;
  formula: "visible_glass_plus_2x_bite";
};

export type WindowTypeSourceModelGeometryRules = {
  visibleFrameMm: WindowTypeSourceModelVisibleFrameRule;
  sashGeometryRules?: WindowTypeSourceModelSashGeometryRules;
  beadGeometryRules?: WindowTypeSourceModelBeadGeometryRules;
  glassOrderRule: WindowTypeSourceModelGlassOrderRule;
};

export type WindowTypeSourceModelFieldRule = {
  fieldSelector: WindowTypeSourceModelFieldSelector;
  operationType: WindowTypeSourceModelOperationType | string;
  operation?: WindowTypeSourceModelFieldOperation | string;
  excludedOperationTypes?: Array<WindowTypeSourceModelOperationType | string>;
  perimeterProfiles: WindowTypeSourceModelPerimeterProfiles;
  sashProfiles?: WindowTypeSourceModelSashProfiles;
  beadProfiles?: WindowTypeSourceModelBeadProfiles;
  interfaceProfiles?: WindowTypeSourceModelInterfaceProfiles;
  geometryRules: WindowTypeSourceModelGeometryRules;
};

export type WindowTypeSourceModelBlockingIssue = {
  key: string;
  reason: string;
  severity: "blocking";
};

export type WindowTypeSourceModelConstraints = {
  allowFixedSash: boolean;
  allowMultiField: boolean;
  allowOutsideView: boolean;
  blockingIssues?: WindowTypeSourceModelBlockingIssue[];
};

export type WindowTypeSourceModelDevDivisionRule = {
  axis: "vertical" | "horizontal";
  index: number;
  row?: number | null;
  type: "static" | "flying";
  ownerFieldKey?: string | null;
};

export type WindowTypeSourceModel = {
  id: string;
  manufacturerId?: string | null;
  productId?: string | null;
  windowTypeId?: string | null;
  systemCode: string;
  view: WindowTypeSourceModelView;
  referenceView: WindowTypeSourceModelReferenceView;
  layout: WindowTypeSourceModelLayout;
  fieldRules: WindowTypeSourceModelFieldRule[];
  constraints: WindowTypeSourceModelConstraints;
  status: WindowTypeSourceModelStatus;
  provenance: WindowTypeSourceModelProvenance;
  dev?: {
    b92SegmentResolverValidation?: boolean | null;
    b92UseSegmentResolver?: boolean | null;
    b92UseDiagnosticJunctionRegistry?: boolean | null;
    b92UseDiagnosticJunctionRegistryCorrections?: boolean | null;
    b92SegmentResolverDivisions?: WindowTypeSourceModelDevDivisionRule[];
    b92RenderSegmentedSillOverlay?: boolean | null;
  };
};
