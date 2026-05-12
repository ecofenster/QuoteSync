import type { B92RuleProfileId } from "./b92ProfileRuleModel.types";
import type {
  B92ResolvedFieldOperation,
  B92ResolvedProfileAssignment,
} from "./b92SegmentResolver.types";

export type B92JunctionRuleSystemCode = "B92";

export type B92JunctionRuleAxis = "vertical" | "horizontal";

export type B92JunctionRuleViewSide = "inside" | "outside";

export type B92JunctionRuleType = "static" | "flying";

export type B92JunctionRuleHanding = "left" | "right" | null;

export type B92JunctionRuleOwnerSide =
  | "left"
  | "right"
  | "shared"
  | "none"
  | "requires_owner"
  | null;

export type B92JunctionRuleOperation = B92ResolvedFieldOperation;

export type B92JunctionRuleRole =
  | "fixed_fixed_centre"
  | "fixed_tilt_turn_centre"
  | "tilt_turn_tilt_turn_centre"
  | "flying_mullion_centre";

export type B92JunctionRuleProjectionStatus =
  | "confirmed"
  | "diagnostic_only"
  | "requires_section_dxf"
  | "unresolved";

export type B92JunctionRuleConfidence =
  | "confirmed"
  | "candidate"
  | "blocked"
  | "unresolved";

export type B92JunctionRuleKey = {
  systemCode: B92JunctionRuleSystemCode;
  axis: B92JunctionRuleAxis;
  viewSide: B92JunctionRuleViewSide;
  leftOperation: B92JunctionRuleOperation;
  rightOperation: B92JunctionRuleOperation;
  junctionType: B92JunctionRuleType;
  leftHanding: B92JunctionRuleHanding;
  rightHanding: B92JunctionRuleHanding;
  ownerSide: B92JunctionRuleOwnerSide;
};

export type B92JunctionRuleResult = {
  profileRef: B92RuleProfileId | null;
  role: B92JunctionRuleRole | "unresolved";
  ownerSide: B92JunctionRuleOwnerSide;
  mirrored: boolean;
  requiredAnchors: string[];
  projectionStatus: B92JunctionRuleProjectionStatus;
  confidence: B92JunctionRuleConfidence;
  evidenceRefs: string[];
  notes: string[];
};

export type B92JunctionRule = B92JunctionRuleKey & B92JunctionRuleResult & {
  id: string;
};

export type B92JunctionRuleLookup = {
  key: B92JunctionRuleKey;
  matched: boolean;
  ruleId: string | null;
  result: B92JunctionRuleResult;
};

export type B92JunctionRuleDiagnosticSeverity =
  | "info"
  | "warning"
  | "blocking";

export type B92JunctionRuleDiagnosticCode =
  | "matched"
  | "unresolved"
  | "profile_mismatch"
  | "unsupported_segment";

export type B92JunctionRuleDiagnostic = {
  id: string;
  severity: B92JunctionRuleDiagnosticSeverity;
  code: B92JunctionRuleDiagnosticCode;
  segmentId?: string;
  assignmentProfileRef?: B92RuleProfileId | string | null;
  registryProfileRef?: B92RuleProfileId | null;
  lookup: B92JunctionRuleLookup;
  message: string;
};

export type B92VerticalJunctionAssignmentComparisonInput = {
  viewSide: B92JunctionRuleViewSide;
  assignments: B92ResolvedProfileAssignment[];
};
