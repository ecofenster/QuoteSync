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

export type WindowTypeSourceModelProfileRole =
  | "head"
  | "left_jamb"
  | "right_jamb"
  | "sill"
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

export type WindowTypeSourceModelInterfaceProfiles = {
  fixedInternal?: WindowTypeSourceModelProfileRef;
};

export type WindowTypeSourceModelVisibleFrameRule = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export type WindowTypeSourceModelGlassOrderRule = {
  biteBehindBeadMm: number;
  widthDeltaMm: number;
  heightDeltaMm: number;
  formula: "visible_glass_plus_2x_bite";
};

export type WindowTypeSourceModelGeometryRules = {
  visibleFrameMm: WindowTypeSourceModelVisibleFrameRule;
  glassOrderRule: WindowTypeSourceModelGlassOrderRule;
};

export type WindowTypeSourceModelFieldRule = {
  fieldSelector: WindowTypeSourceModelFieldSelector;
  operationType: string;
  excludedOperationTypes?: string[];
  perimeterProfiles: WindowTypeSourceModelPerimeterProfiles;
  interfaceProfiles?: WindowTypeSourceModelInterfaceProfiles;
  geometryRules: WindowTypeSourceModelGeometryRules;
};

export type WindowTypeSourceModelConstraints = {
  allowFixedSash: boolean;
  allowMultiField: boolean;
  allowOutsideView: boolean;
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
};
