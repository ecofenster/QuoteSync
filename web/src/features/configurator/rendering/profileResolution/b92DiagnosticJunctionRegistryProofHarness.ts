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

type DiagnosticJunctionIssueCode = Extract<
  B92SegmentResolutionIssue["code"],
  "diagnostic_junction_profile_mismatch" | "diagnostic_junction_unresolved"
>;

export type B92DiagnosticJunctionRegistryStaticProofCase = {
  id: string;
  label: string;
  operations: readonly [B92ResolvedFieldOperation, B92ResolvedFieldOperation];
  expectedRegistryProfile: B92RuleProfileId;
  expectedCurrentResolverProfile: B92RuleProfileId;
  expectedDiagnosticCodes: readonly DiagnosticJunctionIssueCode[];
  notes: readonly string[];
};

export type B92DiagnosticJunctionRegistryStaticProofResult = {
  caseId: string;
  label: string;
  expectedRegistryProfile: B92RuleProfileId;
  expectedCurrentResolverProfile: B92RuleProfileId;
  actualCurrentResolverProfile: B92RuleProfileId | null;
  expectedDiagnosticCodes: readonly DiagnosticJunctionIssueCode[];
  actualDiagnosticCodes: DiagnosticJunctionIssueCode[];
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
    expectedDiagnosticCodes: [],
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
    expectedDiagnosticCodes: [],
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
    expectedDiagnosticCodes: [],
    notes: ["Corrected 2-field fixed/TTR evidence matches the current generic fixed/tilt-turn resolver assignment."],
  },
  {
    id: "ttl-ttr-static",
    label: "2-field TTL/TTR static junction",
    operations: ["tt_left", "tt_right"],
    expectedRegistryProfile: "B92-15",
    expectedCurrentResolverProfile: "B92-15",
    expectedDiagnosticCodes: [],
    notes: ["Corrected 2-field TTL/TTR static evidence matches the current tilt-turn/tilt-turn resolver assignment."],
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
    view: "inside",
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
      allowOutsideView: false,
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

function diagnosticCodes(issues: readonly B92SegmentResolutionIssue[]): DiagnosticJunctionIssueCode[] {
  return issues
    .map((issue) => issue.code)
    .filter((code): code is DiagnosticJunctionIssueCode => {
      return code === "diagnostic_junction_profile_mismatch" || code === "diagnostic_junction_unresolved";
    });
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function runB92DiagnosticJunctionRegistryStaticProofHarness(): B92DiagnosticJunctionRegistryStaticProofResult[] {
  return B92_DIAGNOSTIC_JUNCTION_REGISTRY_STATIC_PROOF_CASES.map((proofCase) => {
    const result = resolveB92ProfileSegmentsFromSource(sourceForCase(proofCase));
    const verticalAssignment = result.verticalJunctionAssignments[0] ?? null;
    const actualCurrentResolverProfile = verticalAssignment?.profileId ?? null;
    const actualDiagnosticCodes = diagnosticCodes(result.issues);
    const passed =
      actualCurrentResolverProfile === proofCase.expectedCurrentResolverProfile &&
      arraysEqual(actualDiagnosticCodes, proofCase.expectedDiagnosticCodes);

    return {
      caseId: proofCase.id,
      label: proofCase.label,
      expectedRegistryProfile: proofCase.expectedRegistryProfile,
      expectedCurrentResolverProfile: proofCase.expectedCurrentResolverProfile,
      actualCurrentResolverProfile,
      expectedDiagnosticCodes: proofCase.expectedDiagnosticCodes,
      actualDiagnosticCodes,
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
        return `${failure.caseId}: expected resolver ${failure.expectedCurrentResolverProfile} with diagnostics [${failure.expectedDiagnosticCodes.join(
          ", "
        )}], received ${failure.actualCurrentResolverProfile ?? "(none)"} with diagnostics [${failure.actualDiagnosticCodes.join(
          ", "
        )}]`;
      })
      .join("; ");
    throw new Error(`B92 diagnostic junction registry static proof failed: ${summary}`);
  }
  return results;
}
