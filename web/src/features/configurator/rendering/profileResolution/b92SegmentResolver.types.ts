import type {
  B92ProfileRuleStatus,
  B92RuleEdge,
  B92RuleProfileId,
} from "./b92ProfileRuleModel.types";

export type B92ResolvedFieldOperation =
  | "fixed"
  | "fixed_sash"
  | "tt_left"
  | "tt_right"
  | "turn_left"
  | "turn_right"
  | "tilt_only";

export type B92OperationFamily =
  | "fixed"
  | "fixed_sash"
  | "tilt_turn"
  | "turn_only"
  | "tilt_only";

export type B92NormalizedField = {
  id: string;
  row: number;
  column: number;
  key: string;
  operation: B92ResolvedFieldOperation;
  operationFamily: B92OperationFamily;
  hingeSide?: "left" | "right" | null;
  handleSide?: "left" | "right" | null;
};

export type B92DivisionRule = {
  axis: "vertical" | "horizontal";
  index: number;
  row?: number | null;
  type: "static" | "flying";
  ownerFieldKey?: string | null;
  status?: B92ProfileRuleStatus;
  note?: string;
};

export type B92SegmentOverride = {
  segmentId: string;
  profileId: B92RuleProfileId;
  reason: string;
  status: Extract<B92ProfileRuleStatus, "candidate" | "confirmed">;
  note?: string;
};

export type B92SegmentResolverInput = {
  systemCode: "B92";
  view: "inside" | "outside";
  referenceView: "external";
  layout: {
    columns: number;
    rows: number;
  };
  fields: B92NormalizedField[];
  divisions?: B92DivisionRule[];
  overrides?: B92SegmentOverride[];
};

export type B92OuterEdgeSegment = {
  id: string;
  kind: "outer_edge";
  edge: B92RuleEdge;
  row: number;
  column: number;
  segmentIndex: number;
  field: B92NormalizedField;
  fieldOperation: B92ResolvedFieldOperation;
};

export type B92VerticalJunctionSegment = {
  id: string;
  kind: "vertical_junction";
  axis: "vertical";
  row: number;
  column: number;
  segmentIndex: number;
  leftField: B92NormalizedField;
  rightField: B92NormalizedField;
  leftOperation: B92ResolvedFieldOperation;
  rightOperation: B92ResolvedFieldOperation;
  junctionType: "static" | "flying";
  ownerFieldKey?: string | null;
};

export type B92HorizontalTransomSegment = {
  id: string;
  kind: "horizontal_transom";
  axis: "horizontal";
  row: number;
  column: number;
  segmentIndex: number;
  topField: B92NormalizedField;
  bottomField: B92NormalizedField;
  topOperation: B92ResolvedFieldOperation;
  bottomOperation: B92ResolvedFieldOperation;
  rowContext: {
    rowIndex: number;
    totalColumns: number;
    operations: B92ResolvedFieldOperation[];
    operationFamilies: B92OperationFamily[];
    hasMixedOperations: boolean;
    allFixed: boolean;
    allSash: boolean;
  };
};

export type B92CouplingCornerSegment = {
  id: string;
  kind: "coupling_corner";
  role: "straight_coupling" | "corner" | "angled_bay" | "glass_corner";
  involvedFieldKeys: string[];
  selectedProfileId?: B92RuleProfileId | null;
  angleDegrees?: number | null;
};

export type B92ResolvedProfileAssignment = {
  id: string;
  segmentId: string;
  segmentKind:
    | B92OuterEdgeSegment["kind"]
    | B92VerticalJunctionSegment["kind"]
    | B92HorizontalTransomSegment["kind"]
    | B92CouplingCornerSegment["kind"]
    | "sill"
    | "threshold";
  profileId: B92RuleProfileId;
  status: B92ProfileRuleStatus;
  source: "rule_register" | "explicit_override";
  ruleId?: string;
  segment?:
    | B92OuterEdgeSegment
    | B92VerticalJunctionSegment
    | B92HorizontalTransomSegment
    | B92CouplingCornerSegment;
  note?: string;
};

export type B92SegmentResolutionIssue = {
  id: string;
  segmentId?: string;
  severity: "info" | "warning" | "blocking";
  code:
    | "unresolved_segment"
    | "multiple_matching_rules"
    | "missing_field"
    | "missing_division_owner"
    | "unsupported_operation"
    | "unsupported_layout"
    | "candidate_rule_only"
    | "blocked_rule"
    | "diagnostic_junction_profile_mismatch"
    | "diagnostic_junction_unresolved";
  message: string;
};

export type B92SegmentResolutionResult = {
  input: B92SegmentResolverInput;
  outerEdgeSegments: B92OuterEdgeSegment[];
  verticalJunctionSegments: B92VerticalJunctionSegment[];
  horizontalTransomSegments: B92HorizontalTransomSegment[];
  couplingCornerSegments: B92CouplingCornerSegment[];
  outerEdgeAssignments: B92ResolvedProfileAssignment[];
  sillAssignments: B92ResolvedProfileAssignment[];
  verticalJunctionAssignments: B92ResolvedProfileAssignment[];
  horizontalTransomAssignments: B92ResolvedProfileAssignment[];
  couplingCornerAssignments: B92ResolvedProfileAssignment[];
  thresholdAssignments: B92ResolvedProfileAssignment[];
  issues: B92SegmentResolutionIssue[];
};
