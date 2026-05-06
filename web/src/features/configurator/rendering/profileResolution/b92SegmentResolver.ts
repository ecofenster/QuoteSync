import type { WindowTypeSourceModel } from "../../../admin/windowTypes/windowTypeSourceModel.types";
import { normalizeB92FieldGrid } from "./b92GridNormalizer";
import { B92_PROFILE_RULE_REGISTER } from "./b92ProfileRuleRegister";
import type {
  B92HorizontalTransomRule,
  B92OuterEdgeRule,
  B92SillRule,
  B92VerticalMullionRule,
} from "./b92ProfileRuleModel.types";
import {
  buildB92HorizontalTransomSegments,
  buildB92OuterEdgeSegments,
  buildB92VerticalJunctionSegments,
} from "./b92SegmentBuilders";
import type {
  B92HorizontalTransomSegment,
  B92OuterEdgeSegment,
  B92ResolvedFieldOperation,
  B92ResolvedProfileAssignment,
  B92SegmentResolutionIssue,
  B92SegmentResolutionResult,
  B92SegmentResolverInput,
  B92VerticalJunctionSegment,
} from "./b92SegmentResolver.types";

type SegmentKind = B92ResolvedProfileAssignment["segmentKind"];

function ruleOperationFor(operation: B92ResolvedFieldOperation) {
  if (operation === "tt_left" || operation === "tt_right") return "tilt_turn";
  if (operation === "turn_left" || operation === "turn_right") return "turn_only";
  return operation;
}

function isOpeningFamilyOperation(operation: B92ResolvedFieldOperation) {
  return (
    operation === "tt_left" ||
    operation === "tt_right" ||
    operation === "turn_left" ||
    operation === "turn_right" ||
    operation === "tilt_only"
  );
}

function operationMatchesRule(ruleOperation: string, operation: B92ResolvedFieldOperation) {
  const normalizedOperation = ruleOperationFor(operation);
  if (ruleOperation === normalizedOperation) return true;

  // B92 register uses tilt_turn as the locked sash-family mullion/transom rule.
  return ruleOperation === "tilt_turn" && isOpeningFamilyOperation(operation);
}

function makeAssignment(input: {
  segmentId: string;
  segmentKind: SegmentKind;
  profileId: B92ResolvedProfileAssignment["profileId"];
  status: B92ResolvedProfileAssignment["status"];
  source?: B92ResolvedProfileAssignment["source"];
  ruleId?: string;
  segment?: B92ResolvedProfileAssignment["segment"];
  note?: string;
}): B92ResolvedProfileAssignment {
  return {
    id: `${input.segmentId}:${input.profileId}`,
    segmentId: input.segmentId,
    segmentKind: input.segmentKind,
    profileId: input.profileId,
    status: input.status,
    source: input.source ?? "rule_register",
    ruleId: input.ruleId,
    segment: input.segment,
    note: input.note,
  };
}

function unresolvedIssue(input: {
  segmentId: string;
  segmentKind: SegmentKind;
  message: string;
}): B92SegmentResolutionIssue {
  return {
    id: `${input.segmentId}:unresolved`,
    segmentId: input.segmentId,
    severity: "blocking",
    code: "unresolved_segment",
    message: `${input.segmentKind}: ${input.message}`,
  };
}

function candidateIssue(assignment: B92ResolvedProfileAssignment): B92SegmentResolutionIssue | null {
  if (assignment.status !== "candidate") return null;
  return {
    id: `${assignment.segmentId}:candidate-rule`,
    segmentId: assignment.segmentId,
    severity: "warning",
    code: "candidate_rule_only",
    message: `${assignment.segmentKind}: resolved with candidate rule ${assignment.ruleId ?? "(unknown rule)"}.`,
  };
}

function resolveSillSegment(
  segment: B92OuterEdgeSegment
): { assignment: B92ResolvedProfileAssignment | null; issues: B92SegmentResolutionIssue[] } {
  if (segment.edge !== "bottom") {
    return {
      assignment: null,
      issues: [
        unresolvedIssue({
          segmentId: segment.id,
          segmentKind: "sill",
          message: "sill resolver only accepts bottom outer edge segments.",
        }),
      ],
    };
  }

  const rule = B92_PROFILE_RULE_REGISTER.sillRules.find((item: B92SillRule) =>
    item.bottomFieldOperations.some((operation) => operationMatchesRule(operation, segment.fieldOperation))
  );
  if (!rule) {
    return {
      assignment: null,
      issues: [
        unresolvedIssue({
          segmentId: segment.id,
          segmentKind: "sill",
          message: `no sill rule matched operation ${segment.fieldOperation}.`,
        }),
      ],
    };
  }

  const assignment = makeAssignment({
    segmentId: segment.id,
    segmentKind: "sill",
    profileId: rule.profileId,
    status: rule.status,
    ruleId: rule.id,
    note: rule.notes?.join(" "),
  });
  return {
    assignment,
    issues: [candidateIssue(assignment)].filter((issue): issue is B92SegmentResolutionIssue => !!issue),
  };
}

function resolveOuterEdgeSegment(
  segment: B92OuterEdgeSegment
): { assignment: B92ResolvedProfileAssignment | null; issues: B92SegmentResolutionIssue[] } {
  if (segment.edge === "bottom") {
    return resolveSillSegment(segment);
  }

  const rule = B92_PROFILE_RULE_REGISTER.outerEdgeRules.find((item: B92OuterEdgeRule) => {
    if (item.edge !== segment.edge) return false;
    return item.fieldOperations.some((operation) => operationMatchesRule(operation, segment.fieldOperation));
  });
  if (!rule) {
    return {
      assignment: null,
      issues: [
        unresolvedIssue({
          segmentId: segment.id,
          segmentKind: "outer_edge",
          message: `no outer edge rule matched ${segment.edge} operation ${segment.fieldOperation}.`,
        }),
      ],
    };
  }

  const assignment = makeAssignment({
    segmentId: segment.id,
    segmentKind: "outer_edge",
    profileId: rule.profileId,
    status: rule.status,
    ruleId: rule.id,
    note: rule.notes?.join(" "),
  });
  return {
    assignment,
    issues: [candidateIssue(assignment)].filter((issue): issue is B92SegmentResolutionIssue => !!issue),
  };
}

function isTiltTurnOperation(operation: B92ResolvedFieldOperation) {
  return operation === "tt_left" || operation === "tt_right";
}

function findVerticalRule(
  segment: B92VerticalJunctionSegment,
  overrideCondition?: B92VerticalMullionRule["overrideCondition"]
) {
  return B92_PROFILE_RULE_REGISTER.verticalMullionRules.find((rule: B92VerticalMullionRule) => {
    if (rule.overrideCondition !== overrideCondition) return false;
    return (
      operationMatchesRule(rule.leftOperation, segment.leftOperation) &&
      operationMatchesRule(rule.rightOperation, segment.rightOperation)
    );
  });
}

function findMirroredVerticalRule(
  segment: B92VerticalJunctionSegment,
  overrideCondition?: B92VerticalMullionRule["overrideCondition"]
) {
  return (
    findVerticalRule(segment, overrideCondition) ??
    B92_PROFILE_RULE_REGISTER.verticalMullionRules.find((rule: B92VerticalMullionRule) => {
      if (rule.overrideCondition !== overrideCondition) return false;
      return (
        operationMatchesRule(rule.leftOperation, segment.rightOperation) &&
        operationMatchesRule(rule.rightOperation, segment.leftOperation)
      );
    }) ??
    null
  );
}

function verticalOverrideCondition(segment: B92VerticalJunctionSegment): B92VerticalMullionRule["overrideCondition"] | undefined {
  if (segment.junctionType === "flying") return "flying_mullion";
  if (isTiltTurnOperation(segment.leftOperation) && isTiltTurnOperation(segment.rightOperation)) {
    if (segment.leftField.hingeSide === "right" && segment.rightField.hingeSide === "left") {
      return "hinges_at_meeting";
    }
    if (
      (segment.leftField.hingeSide === "left" && segment.rightField.hingeSide === "left") ||
      (segment.leftField.hingeSide === "right" && segment.rightField.hingeSide === "right")
    ) {
      return "same_handing";
    }
  }
  return undefined;
}

function resolveVerticalJunctionSegment(
  segment: B92VerticalJunctionSegment
): { assignment: B92ResolvedProfileAssignment | null; issues: B92SegmentResolutionIssue[] } {
  const overrideCondition = verticalOverrideCondition(segment);
  const rule = findMirroredVerticalRule(segment, overrideCondition) ?? findMirroredVerticalRule(segment);
  if (!rule) {
    return {
      assignment: null,
      issues: [
        unresolvedIssue({
          segmentId: segment.id,
          segmentKind: "vertical_junction",
          message: `no vertical mullion rule matched ${segment.leftOperation} + ${segment.rightOperation}.`,
        }),
      ],
    };
  }

  const assignment = makeAssignment({
    segmentId: segment.id,
    segmentKind: "vertical_junction",
    profileId: rule.profileId,
    status: rule.status,
    ruleId: rule.id,
    segment,
    note: rule.notes?.join(" "),
  });
  return {
    assignment,
    issues: [candidateIssue(assignment)].filter((issue): issue is B92SegmentResolutionIssue => !!issue),
  };
}

function findHorizontalRule(segment: B92HorizontalTransomSegment) {
  if (segment.rowContext.totalColumns >= 3 && segment.rowContext.hasMixedOperations) {
    const mixedRowRule = B92_PROFILE_RULE_REGISTER.horizontalTransomRules.find(
      (rule: B92HorizontalTransomRule) => rule.profileId === "B92-24"
    );
    if (mixedRowRule) return mixedRowRule;
  }

  const matches = B92_PROFILE_RULE_REGISTER.horizontalTransomRules.filter((rule: B92HorizontalTransomRule) => {
    return (
      operationMatchesRule(rule.upperOperation, segment.topOperation) &&
      operationMatchesRule(rule.lowerOperation, segment.bottomOperation)
    );
  });
  return matches.find((rule) => rule.status === "confirmed" && rule.context === "standard") ?? matches[0] ?? null;
}

function resolveHorizontalTransomSegment(
  segment: B92HorizontalTransomSegment
): { assignment: B92ResolvedProfileAssignment | null; issues: B92SegmentResolutionIssue[] } {
  const rule = findHorizontalRule(segment);
  if (!rule) {
    return {
      assignment: null,
      issues: [
        unresolvedIssue({
          segmentId: segment.id,
          segmentKind: "horizontal_transom",
          message: `no horizontal transom rule matched ${segment.topOperation} over ${segment.bottomOperation}.`,
        }),
      ],
    };
  }

  const assignment = makeAssignment({
    segmentId: segment.id,
    segmentKind: "horizontal_transom",
    profileId: rule.profileId,
    status: rule.status,
    ruleId: rule.id,
    segment,
    note: rule.notes?.join(" "),
  });
  return {
    assignment,
    issues: [candidateIssue(assignment)].filter((issue): issue is B92SegmentResolutionIssue => !!issue),
  };
}

function resolverInputFromSource(source: WindowTypeSourceModel): B92SegmentResolverInput {
  return {
    systemCode: "B92",
    view: source.view,
    referenceView: "external",
    layout: {
      columns: source.layout.columns,
      rows: source.layout.rows,
    },
    fields: normalizeB92FieldGrid(source),
  };
}

export function resolveB92ProfileSegmentsFromSource(source: WindowTypeSourceModel): B92SegmentResolutionResult {
  const input = resolverInputFromSource(source);
  const outerEdgeSegments = buildB92OuterEdgeSegments(input.fields);
  const verticalJunctionSegments = buildB92VerticalJunctionSegments(input.fields);
  const horizontalTransomSegments = buildB92HorizontalTransomSegments(input.fields);

  const outerEdgeAssignments: B92ResolvedProfileAssignment[] = [];
  const sillAssignments: B92ResolvedProfileAssignment[] = [];
  const verticalJunctionAssignments: B92ResolvedProfileAssignment[] = [];
  const horizontalTransomAssignments: B92ResolvedProfileAssignment[] = [];
  const couplingCornerAssignments: B92ResolvedProfileAssignment[] = [];
  const thresholdAssignments: B92ResolvedProfileAssignment[] = [];
  const issues: B92SegmentResolutionIssue[] = [];

  for (const segment of outerEdgeSegments) {
    const result = segment.edge === "bottom" ? resolveSillSegment(segment) : resolveOuterEdgeSegment(segment);
    if (result.assignment) {
      if (segment.edge === "bottom") {
        sillAssignments.push(result.assignment);
      } else {
        outerEdgeAssignments.push(result.assignment);
      }
    }
    issues.push(...result.issues);
  }

  for (const segment of verticalJunctionSegments) {
    const result = resolveVerticalJunctionSegment(segment);
    if (result.assignment) verticalJunctionAssignments.push(result.assignment);
    issues.push(...result.issues);
  }

  for (const segment of horizontalTransomSegments) {
    const result = resolveHorizontalTransomSegment(segment);
    if (result.assignment) horizontalTransomAssignments.push(result.assignment);
    issues.push(...result.issues);
  }

  return {
    input,
    outerEdgeSegments,
    verticalJunctionSegments,
    horizontalTransomSegments,
    couplingCornerSegments: [],
    outerEdgeAssignments,
    sillAssignments,
    verticalJunctionAssignments,
    horizontalTransomAssignments,
    couplingCornerAssignments,
    thresholdAssignments,
    issues,
  };
}
