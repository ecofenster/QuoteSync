import type {
  WindowTypeSourceModel,
  WindowTypeSourceModelFieldOperation,
  WindowTypeSourceModelOperationType,
  WindowTypeSourceModelProfileRef,
} from "../../../admin/windowTypes/windowTypeSourceModel.types";
import type { B92RuleProfileId } from "./b92ProfileRuleModel.types";
import { resolveB92ProfileSegmentsFromSource } from "./b92SegmentResolver";
import type {
  B92ResolvedFieldOperation,
  B92SegmentResolutionIssue,
  B92SegmentResolutionResult,
} from "./b92SegmentResolver.types";

type ProofIssueCode = B92SegmentResolutionIssue["code"];

export type B92DiagnosticJunctionRegistryStaticProofCase = {
  id: string;
  label: string;
  operations: readonly [B92ResolvedFieldOperation, B92ResolvedFieldOperation];
  view?: WindowTypeSourceModel["view"];
  divisions?: NonNullable<WindowTypeSourceModel["dev"]>["b92SegmentResolverDivisions"];
  expectedRegistryProfile: B92RuleProfileId | null;
  expectedCurrentResolverProfile: B92RuleProfileId | null;
  expectedIssueCodes: readonly ProofIssueCode[];
  notes: readonly string[];
};

export type B92DiagnosticJunctionRegistryStaticProofResult = {
  caseId: string;
  label: string;
  expectedRegistryProfile: B92RuleProfileId | null;
  expectedCurrentResolverProfile: B92RuleProfileId | null;
  actualCurrentResolverProfile: B92RuleProfileId | null;
  expectedIssueCodes: readonly ProofIssueCode[];
  actualIssueCodes: ProofIssueCode[];
  passed: boolean;
  issues: B92SegmentResolutionIssue[];
  result: B92SegmentResolutionResult;
};

export const B92_DIAGNOSTIC_JUNCTION_REGISTRY_STATIC_PROOF_CASES: readonly B92DiagnosticJunctionRegistryStaticProofCase[] = [
  {
    id: "fixed-fixed-static",
    label: "simple 2-field fixed/fixed static junction",
    operations: ["fixed", "fixed"],
    expectedRegistryProfile: "B92-11",
    expectedCurrentResolverProfile: "B92-11",
    expectedIssueCodes: [],
    notes: [
      "Simple 2-field fixed/fixed evidence expects B92-11.",
      "The dev-flag correction may replace the current B92-14 assignment only in this simple 2-field context.",
      "B92-14 remains valid for separate compound/grid fixed/fixed contexts.",
    ],
  },
  {
    id: "fixed-ttl-static",
    label: "2-field fixed/TTL static junction",
    operations: ["fixed", "tt_left"],
    expectedRegistryProfile: "B92-13",
    expectedCurrentResolverProfile: "B92-13",
    expectedIssueCodes: [],
    notes: [
      "Corrected 2-field fixed/TTL evidence expects B92-13.",
      "The dev-flag correction may replace the current generic fixed/tilt-turn B92-12 assignment only for fixed/TTL.",
    ],
  },
  {
    id: "fixed-ttr-static",
    label: "2-field fixed/TTR static junction",
    operations: ["fixed", "tt_right"],
    expectedRegistryProfile: "B92-12",
    expectedCurrentResolverProfile: "B92-12",
    expectedIssueCodes: [],
    notes: ["Corrected 2-field fixed/TTR evidence matches the current generic fixed/tilt-turn resolver assignment."],
  },
  {
    id: "ttl-ttr-static",
    label: "2-field TTL/TTR static junction",
    operations: ["tt_left", "tt_right"],
    expectedRegistryProfile: "B92-15",
    expectedCurrentResolverProfile: "B92-15",
    expectedIssueCodes: [],
    notes: ["Corrected 2-field TTL/TTR static evidence matches the current tilt-turn/tilt-turn resolver assignment."],
  },
  {
    id: "turn-tt-flying-internal",
    label: "2-field turn/TT internal flying junction",
    operations: ["turn_left", "tt_right"],
    view: "inside",
    divisions: [
      {
        axis: "vertical",
        index: 1,
        type: "flying",
        ownerFieldKey: "0:0",
      },
    ],
    expectedRegistryProfile: "B92-18",
    expectedCurrentResolverProfile: "B92-18",
    expectedIssueCodes: [],
    notes: [
      "Internal turn/TT flying mullion evidence expects B92-18.",
      "The dev-only division metadata marks the centre vertical junction as flying and supplies the owner field.",
    ],
  },
  {
    id: "turn-tt-flying-external",
    label: "2-field turn/TT external flying junction",
    operations: ["turn_left", "tt_right"],
    view: "outside",
    divisions: [
      {
        axis: "vertical",
        index: 1,
        type: "flying",
        ownerFieldKey: "0:0",
      },
    ],
    expectedRegistryProfile: null,
    expectedCurrentResolverProfile: null,
    expectedIssueCodes: ["unresolved_segment"],
    notes: [
      "External flying mullion remains unresolved because outside B92-18 evidence is not confirmed.",
      "This proof must not assign or confirm B92-18 externally.",
    ],
  },
  {
    id: "turn-tt-flying-missing-owner",
    label: "2-field turn/TT flying junction missing owner",
    operations: ["turn_left", "tt_right"],
    view: "inside",
    divisions: [
      {
        axis: "vertical",
        index: 1,
        type: "flying",
      },
    ],
    expectedRegistryProfile: null,
    expectedCurrentResolverProfile: null,
    expectedIssueCodes: ["missing_division_owner"],
    notes: [
      "Flying mullion metadata requires ownerFieldKey.",
      "The resolver must not guess master/owner side from operations alone.",
    ],
  },
];

const PROFILE_REFS = {
  top: profileRef("B92-1", "head"),
  left: profileRef("B92-2", "left_jamb"),
  right: profileRef("B92-2", "right_jamb", true),
  bottom: profileRef("B92-3", "sill"),
} as const;

function profileRef(
  profileCode: B92RuleProfileId,
  role: WindowTypeSourceModelProfileRef["role"],
  mirrored = false
): WindowTypeSourceModelProfileRef {
  return {
    profileCode,
    role,
    required: true,
    mirrored: mirrored || undefined,
  };
}

function operationTypeFor(operation: B92ResolvedFieldOperation): WindowTypeSourceModelOperationType {
  if (operation === "tt_left" || operation === "tt_right") return "tilt_turn";
  if (operation === "turn_left" || operation === "turn_right") return "turn_only";
  return operation;
}

function sourceForCase(proofCase: B92DiagnosticJunctionRegistryStaticProofCase): WindowTypeSourceModel {
  const [leftOperation, rightOperation] = proofCase.operations;

  return {
    id: `b92-diagnostic-junction-registry-proof-${proofCase.id}`,
    manufacturerId: null,
    productId: null,
    windowTypeId: null,
    systemCode: "B92",
    view: proofCase.view ?? "inside",
    referenceView: "external",
    layout: {
      columns: 2,
      rows: 1,
    },
    fieldRules: [
      fieldRule(0, 0, leftOperation),
      fieldRule(0, 1, rightOperation),
    ],
    constraints: {
      allowFixedSash: true,
      allowMultiField: true,
      allowOutsideView: proofCase.view === "outside",
    },
    status: "draft",
    provenance: {
      source: "manual",
      sourceId: proofCase.id,
      version: "diagnostic-only",
      notes: [
        "Diagnostic-only B92 junction registry proof harness.",
        "Does not feed production renderer assignments or SVG output.",
      ],
    },
    dev: {
      b92UseSegmentResolver: true,
      b92UseDiagnosticJunctionRegistry: true,
      b92UseDiagnosticJunctionRegistryCorrections: true,
      b92SegmentResolverDivisions: proofCase.divisions,
    },
  };
}

function fieldRule(row: number, column: number, operation: B92ResolvedFieldOperation): WindowTypeSourceModel["fieldRules"][number] {
  return {
    fieldSelector: {
      row,
      column,
      fieldKey: `${row}:${column}`,
    },
    operationType: operationTypeFor(operation),
    operation: operation satisfies WindowTypeSourceModelFieldOperation,
    perimeterProfiles: PROFILE_REFS,
    geometryRules: {
      visibleFrameMm: {
        top: 78,
        left: 78,
        right: 78,
        bottom: 93,
      },
      glassOrderRule: {
        biteBehindBeadMm: 13,
        widthDeltaMm: 26,
        heightDeltaMm: 26,
        formula: "visible_glass_plus_2x_bite",
      },
    },
  };
}

function issueCodes(issues: readonly B92SegmentResolutionIssue[]): ProofIssueCode[] {
  return issues
    .filter((issue) => issue.segmentId?.startsWith("vertical-row-"))
    .map((issue) => issue.code);
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function runB92DiagnosticJunctionRegistryStaticProofHarness(): B92DiagnosticJunctionRegistryStaticProofResult[] {
  return B92_DIAGNOSTIC_JUNCTION_REGISTRY_STATIC_PROOF_CASES.map((proofCase) => {
    const result = resolveB92ProfileSegmentsFromSource(sourceForCase(proofCase));
    const verticalAssignment = result.verticalJunctionAssignments[0] ?? null;
    const actualCurrentResolverProfile = verticalAssignment?.profileId ?? null;
    const actualIssueCodes = issueCodes(result.issues);
    const passed =
      actualCurrentResolverProfile === proofCase.expectedCurrentResolverProfile &&
      arraysEqual(actualIssueCodes, proofCase.expectedIssueCodes);

    return {
      caseId: proofCase.id,
      label: proofCase.label,
      expectedRegistryProfile: proofCase.expectedRegistryProfile,
      expectedCurrentResolverProfile: proofCase.expectedCurrentResolverProfile,
      actualCurrentResolverProfile,
      expectedIssueCodes: proofCase.expectedIssueCodes,
      actualIssueCodes,
      passed,
      issues: result.issues,
      result,
    };
  });
}

export function assertB92DiagnosticJunctionRegistryStaticProofHarness(): B92DiagnosticJunctionRegistryStaticProofResult[] {
  const results = runB92DiagnosticJunctionRegistryStaticProofHarness();
  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    const summary = failures
      .map((failure) => {
        return `${failure.caseId}: expected resolver ${failure.expectedCurrentResolverProfile ?? "(none)"} with issues [${failure.expectedIssueCodes.join(
          ", "
        )}], received ${failure.actualCurrentResolverProfile ?? "(none)"} with issues [${failure.actualIssueCodes.join(
          ", "
        )}]`;
      })
      .join("; ");
    throw new Error(`B92 diagnostic junction registry static proof failed: ${summary}`);
  }
  return results;
}
