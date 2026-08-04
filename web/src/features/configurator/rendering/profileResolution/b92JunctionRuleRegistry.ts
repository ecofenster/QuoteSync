import type {
  B92JunctionRule,
  B92JunctionRuleDiagnostic,
  B92JunctionRuleKey,
  B92JunctionRuleLookup,
  B92JunctionRuleOwnerSide,
  B92JunctionRuleResult,
  B92VerticalJunctionAssignmentComparisonInput,
} from "./b92JunctionRuleRegistry.types";
import type {
  B92ResolvedFieldOperation,
  B92ResolvedProfileAssignment,
  B92VerticalJunctionSegment,
} from "./b92SegmentResolver.types";

const EUROPA_92_ALU_CLAD_SUMMARY =
  "_project/Test/Europa 92 Alu Clad/generated-summary.md";

const EUROPA_92_ALU_CLAD_2_FIELD_NOTES =
  "_project/Test/Europa 92 Alu Clad/2 Field/generated-notes.md";

const EUROPA_92_ALU_CLAD_EVIDENCE_REFS = [
  EUROPA_92_ALU_CLAD_SUMMARY,
  EUROPA_92_ALU_CLAD_2_FIELD_NOTES,
];

const STATIC_SHARED_ANCHORS = [
  "junction:centerline",
  "junction:visible-left-face",
  "junction:visible-right-face",
  "junction:top-termination",
  "junction:bottom-termination",
];

const FLYING_MULLION_ANCHORS = [
  "junction:centerline",
  "flying_mullion:owner-side",
  "flying_mullion:sash-gap",
  "junction:top-termination",
  "junction:bottom-termination",
];

function rule(input: B92JunctionRule): B92JunctionRule {
  return input;
}

export const B92_TWO_FIELD_VERTICAL_JUNCTION_RULES = [
  rule({
    id: "b92-2field-fixed-fixed-static-centre",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "inside",
    leftOperation: "fixed",
    rightOperation: "fixed",
    junctionType: "static",
    leftHanding: null,
    rightHanding: null,
    ownerSide: "shared",
    profileRef: "B92-11",
    role: "fixed_fixed_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "Europa 92 Alu Clad fixed/fixed internal evidence calls out B92-11 at the centre junction.",
      "Diagnostic-only until fixed/fixed section anchors and projection ownership are promoted into render rules.",
      "This rule is for the simple 2-field fixed/fixed context; B92-14 may still be valid in separate compound/grid fixed/fixed contexts.",
    ],
  }),
  rule({
    id: "b92-2field-fixed-fixed-static-centre-outside",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "outside",
    leftOperation: "fixed",
    rightOperation: "fixed",
    junctionType: "static",
    leftHanding: null,
    rightHanding: null,
    ownerSide: "shared",
    profileRef: "B92-11",
    role: "fixed_fixed_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "Europa 92 Alu Clad fixed/fixed external evidence also calls out B92-11 at the centre junction.",
      "External cladding/mitre ownership remains diagnostic-only.",
      "This rule is for the simple 2-field fixed/fixed context; B92-14 may still be valid in separate compound/grid fixed/fixed contexts.",
    ],
  }),
  rule({
    id: "b92-2field-fixed-ttl-static-centre",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "inside",
    leftOperation: "fixed",
    rightOperation: "tt_left",
    junctionType: "static",
    leftHanding: null,
    rightHanding: "left",
    ownerSide: "shared",
    profileRef: "B92-13",
    role: "fixed_tilt_turn_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "Corrected Europa 92 Alu Clad fixed/TTL evidence calls out B92-13 at the centre junction.",
      "B92-13 is treated as the fixed/TTL hinge-accommodation centre case; do not resolve fixed/TTL to B92-15.",
      "B92-12 remains the fixed/T&T family ref for the corrected fixed/TTR case.",
    ],
  }),
  rule({
    id: "b92-2field-fixed-ttl-static-centre-outside",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "outside",
    leftOperation: "fixed",
    rightOperation: "tt_left",
    junctionType: "static",
    leftHanding: null,
    rightHanding: "left",
    ownerSide: "shared",
    profileRef: "B92-13",
    role: "fixed_tilt_turn_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "Corrected Europa 92 Alu Clad fixed/TTL external evidence calls out B92-13.",
      "External projection/cladding details remain diagnostic-only.",
      "Do not resolve fixed/TTL to B92-15; B92-15 is reserved here for the TTL/TTR static centre case.",
    ],
  }),
  rule({
    id: "b92-2field-fixed-ttr-static-centre",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "inside",
    leftOperation: "fixed",
    rightOperation: "tt_right",
    junctionType: "static",
    leftHanding: null,
    rightHanding: "right",
    ownerSide: "shared",
    profileRef: "B92-12",
    role: "fixed_tilt_turn_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "Fixed/TTR selects B92-12 in the Europa 92 Alu Clad 2-field evidence.",
      "This intentionally differs from corrected fixed/TTL, which selects B92-13.",
    ],
  }),
  rule({
    id: "b92-2field-fixed-ttr-static-centre-outside",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "outside",
    leftOperation: "fixed",
    rightOperation: "tt_right",
    junctionType: "static",
    leftHanding: null,
    rightHanding: "right",
    ownerSide: "shared",
    profileRef: "B92-12",
    role: "fixed_tilt_turn_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "Fixed/TTR external evidence calls out B92-12.",
      "External projection/cladding details remain diagnostic-only.",
    ],
  }),
  rule({
    id: "b92-2field-ttl-ttr-static-centre",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "inside",
    leftOperation: "tt_left",
    rightOperation: "tt_right",
    junctionType: "static",
    leftHanding: "left",
    rightHanding: "right",
    ownerSide: "shared",
    profileRef: "B92-15",
    role: "tilt_turn_tilt_turn_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "TTL/TTR static centre evidence calls out B92-15.",
      "Same-handing and hinge-at-meeting variants are not inferred by this rule.",
    ],
  }),
  rule({
    id: "b92-2field-ttl-ttr-static-centre-outside",
    systemCode: "B92",
    axis: "vertical",
    viewSide: "outside",
    leftOperation: "tt_left",
    rightOperation: "tt_right",
    junctionType: "static",
    leftHanding: "left",
    rightHanding: "right",
    ownerSide: "shared",
    profileRef: "B92-15",
    role: "tilt_turn_tilt_turn_centre",
    mirrored: false,
    requiredAnchors: STATIC_SHARED_ANCHORS,
    projectionStatus: "diagnostic_only",
    confidence: "confirmed",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      "TTL/TTR external static centre evidence calls out B92-15.",
      "External projection/cladding details remain diagnostic-only.",
    ],
  }),
  ...([
    ["turn_left", "tt_right"],
    ["tt_left", "turn_right"],
  ] as const).map(([leftOperation, rightOperation]) =>
    rule({
      id: `b92-2field-${leftOperation}-${rightOperation}-flying-centre-inside`,
      systemCode: "B92",
      axis: "vertical",
      viewSide: "inside",
      leftOperation,
      rightOperation,
      junctionType: "flying",
      leftHanding: handingForOperation(leftOperation),
      rightHanding: handingForOperation(rightOperation),
      ownerSide: "requires_owner",
      profileRef: "B92-18",
      role: "flying_mullion_centre",
      mirrored: false,
      requiredAnchors: FLYING_MULLION_ANCHORS,
      projectionStatus: "requires_section_dxf",
      confidence: "confirmed",
      evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
      notes: [
        "Turn/TT flying mullion is confirmed internally as B92-18 only when both fields meet on their opening side.",
        "Owner field selection is still required before production geometry can use this rule.",
        "No outside rule is marked confirmed because external evidence did not clearly call out B92-18.",
      ],
    })
  ),
] as const satisfies readonly B92JunctionRule[];

function handingForOperation(operation: B92ResolvedFieldOperation): "left" | "right" | null {
  if (operation === "tt_left" || operation === "turn_left") return "left";
  if (operation === "tt_right" || operation === "turn_right") return "right";
  return null;
}

function ownerSideFromFieldKey(input: {
  ownerFieldKey?: string | null;
  leftFieldKey: string;
  rightFieldKey: string;
  junctionType: "static" | "flying";
}): B92JunctionRuleOwnerSide {
  if (input.junctionType === "static") return "shared";
  if (!input.ownerFieldKey) return "requires_owner";
  if (input.ownerFieldKey === input.leftFieldKey) return "left";
  if (input.ownerFieldKey === input.rightFieldKey) return "right";
  return "requires_owner";
}

function keyMatches(ruleKey: B92JunctionRuleKey, lookupKey: B92JunctionRuleKey): boolean {
  return (
    ruleKey.systemCode === lookupKey.systemCode &&
    ruleKey.axis === lookupKey.axis &&
    ruleKey.viewSide === lookupKey.viewSide &&
    ruleKey.leftOperation === lookupKey.leftOperation &&
    ruleKey.rightOperation === lookupKey.rightOperation &&
    ruleKey.junctionType === lookupKey.junctionType &&
    ruleKey.leftHanding === lookupKey.leftHanding &&
    ruleKey.rightHanding === lookupKey.rightHanding &&
    (ruleKey.ownerSide === lookupKey.ownerSide ||
      (ruleKey.ownerSide === "requires_owner" &&
        (lookupKey.ownerSide === "left" ||
          lookupKey.ownerSide === "right" ||
          lookupKey.ownerSide === "requires_owner")))
  );
}

function unresolvedResult(key: B92JunctionRuleKey): B92JunctionRuleResult {
  return {
    profileRef: null,
    role: "unresolved",
    ownerSide: key.ownerSide,
    mirrored: false,
    requiredAnchors: [],
    projectionStatus: "unresolved",
    confidence: "unresolved",
    evidenceRefs: EUROPA_92_ALU_CLAD_EVIDENCE_REFS,
    notes: [
      `No diagnostic B92 2-field vertical junction rule matched ${key.leftOperation} + ${key.rightOperation}.`,
      "Missing rules are intentionally unresolved; do not mirror or guess profile refs.",
    ],
  };
}

export function buildB92JunctionRuleKeyFromVerticalSegment(input: {
  viewSide: "inside" | "outside";
  segment: B92VerticalJunctionSegment;
}): B92JunctionRuleKey {
  return {
    systemCode: "B92",
    axis: "vertical",
    viewSide: input.viewSide,
    leftOperation: input.segment.leftOperation,
    rightOperation: input.segment.rightOperation,
    junctionType: input.segment.junctionType,
    leftHanding: input.segment.leftField.hingeSide ?? handingForOperation(input.segment.leftOperation),
    rightHanding: input.segment.rightField.hingeSide ?? handingForOperation(input.segment.rightOperation),
    ownerSide: ownerSideFromFieldKey({
      ownerFieldKey: input.segment.ownerFieldKey,
      leftFieldKey: input.segment.leftField.key,
      rightFieldKey: input.segment.rightField.key,
      junctionType: input.segment.junctionType,
    }),
  };
}

export function lookupB92TwoFieldVerticalJunctionRule(key: B92JunctionRuleKey): B92JunctionRuleLookup {
  const matchedRule =
    B92_TWO_FIELD_VERTICAL_JUNCTION_RULES.find((item) => keyMatches(item, key)) ?? null;

  if (!matchedRule) {
    return {
      key,
      matched: false,
      ruleId: null,
      result: unresolvedResult(key),
    };
  }

  const {
    id: ruleId,
    systemCode: _systemCode,
    axis: _axis,
    viewSide: _viewSide,
    leftOperation: _leftOperation,
    rightOperation: _rightOperation,
    junctionType: _junctionType,
    leftHanding: _leftHanding,
    rightHanding: _rightHanding,
    ...result
  } = matchedRule;

  return {
    key,
    matched: true,
    ruleId,
    result,
  };
}

function diagnosticForAssignment(input: {
  viewSide: "inside" | "outside";
  assignment: B92ResolvedProfileAssignment;
}): B92JunctionRuleDiagnostic {
  if (input.assignment.segment?.kind !== "vertical_junction") {
    const unsupportedKey: B92JunctionRuleKey = {
      systemCode: "B92",
      axis: "vertical",
      viewSide: input.viewSide,
      leftOperation: "fixed",
      rightOperation: "fixed",
      junctionType: "static",
      leftHanding: null,
      rightHanding: null,
      ownerSide: null,
    };
    const lookup = {
      key: unsupportedKey,
      matched: false,
      ruleId: null,
      result: unresolvedResult(unsupportedKey),
    };
    return {
      id: `${input.assignment.segmentId}:unsupported-segment`,
      severity: "warning",
      code: "unsupported_segment",
      segmentId: input.assignment.segmentId,
      assignmentProfileRef: input.assignment.profileId,
      registryProfileRef: null,
      lookup,
      message: `Assignment ${input.assignment.segmentId} is not a vertical junction segment.`,
    };
  }

  const key = buildB92JunctionRuleKeyFromVerticalSegment({
    viewSide: input.viewSide,
    segment: input.assignment.segment,
  });
  const lookup = lookupB92TwoFieldVerticalJunctionRule(key);
  const registryProfileRef = lookup.result.profileRef;

  if (!lookup.matched) {
    return {
      id: `${input.assignment.segmentId}:unresolved-b92-junction-rule`,
      severity: "warning",
      code: "unresolved",
      segmentId: input.assignment.segmentId,
      assignmentProfileRef: input.assignment.profileId,
      registryProfileRef,
      lookup,
      message: `No diagnostic B92 junction rule matched ${key.leftOperation} + ${key.rightOperation}.`,
    };
  }

  if (registryProfileRef !== input.assignment.profileId) {
    return {
      id: `${input.assignment.segmentId}:b92-junction-profile-mismatch`,
      severity: "warning",
      code: "profile_mismatch",
      segmentId: input.assignment.segmentId,
      assignmentProfileRef: input.assignment.profileId,
      registryProfileRef,
      lookup,
      message: `Current segment resolver assigned ${input.assignment.profileId}; diagnostic registry expects ${registryProfileRef}.`,
    };
  }

  return {
    id: `${input.assignment.segmentId}:b92-junction-profile-match`,
    severity: "info",
    code: "matched",
    segmentId: input.assignment.segmentId,
    assignmentProfileRef: input.assignment.profileId,
    registryProfileRef,
    lookup,
    message: `Current segment resolver matches diagnostic registry profile ${registryProfileRef}.`,
  };
}

export function compareB92VerticalJunctionAssignmentsToRegistry(
  input: B92VerticalJunctionAssignmentComparisonInput
): B92JunctionRuleDiagnostic[] {
  return input.assignments.map((assignment) =>
    diagnosticForAssignment({
      viewSide: input.viewSide,
      assignment,
    })
  );
}
