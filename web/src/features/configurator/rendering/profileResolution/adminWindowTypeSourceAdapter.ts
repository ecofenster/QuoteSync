import type { WindowTypeSourceModel } from "../../../admin/windowTypes/windowTypeSourceModel.types";
import type { B92JoinCondition, B92ProfileId } from "./b92ProfileTypes";
import { resolveB92ProfileSegmentsFromSource } from "./b92SegmentResolver";
import type {
  B92HorizontalTransomSegment,
  B92ResolvedFieldOperation,
  B92ResolvedProfileAssignment,
  B92SegmentResolutionResult,
  B92VerticalJunctionSegment,
} from "./b92SegmentResolver.types";
import type {
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
  WindowTypeRenderFieldOperation,
  WindowTypeRenderJunction,
} from "./windowTypeRenderContract";

type RuntimeDimensionsMm = {
  widthMm: number;
  heightMm: number;
};

type B92SegmentResolverDevSource = WindowTypeSourceModel & {
  dev?: {
    b92UseSegmentResolver?: boolean | null;
    b92ExposeSegmentResolverDiagnostics?: boolean | null;
    b92UseJunctionGeometryVisualPilot?: boolean | null;
    b92RenderSegmentedSillOverlay?: boolean | null;
  };
};

const B92_FIXED_INTERNAL_DESIGN_RULE =
  "Admin WindowTypeSourceModel supplies the B92 fixed internal section mapping; drawing geometry remains downstream.";

const B92_FIXED_SASH_INTERNAL_DESIGN_RULE =
  "Admin WindowTypeSourceModel supplies the B92 fixed sash internal section mapping; drawing geometry remains downstream.";

type Side = "top" | "left" | "right" | "bottom";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid WindowTypeSourceModel: ${message}`);
  }
}

function assertFinitePositiveDimension(value: number, label: string): void {
  assertCondition(Number.isFinite(value) && value > 0, `${label} must be a finite positive number.`);
}

function assertProfileCode(value: string, expected: B92ProfileId, label: string): void {
  assertCondition(value === expected, `${label} profile must be ${expected}.`);
}

function assertNoBlockingSourceIssues(source: WindowTypeSourceModel): void {
  const blockingIssues = source.constraints.blockingIssues ?? [];
  assertCondition(blockingIssues.length === 0, `blocking source issue found: ${blockingIssues[0]?.key ?? "unknown"}.`);
}

function assertNumberBySide(
  label: string,
  actual: Partial<Record<Side, number>> | undefined,
  expected: Record<Side, number>
): void {
  assertCondition(!!actual, `${label} is required.`);
  for (const side of ["top", "left", "right", "bottom"] as const) {
    assertCondition(actual[side] === expected[side], `${label}.${side} must be ${expected[side]}mm.`);
  }
}

function resolvedProfile(profileId: B92ProfileId, note?: string): WindowTypeRenderProfileRef {
  return {
    profileId,
    source: "resolved",
    note,
  };
}

function sourceFieldOperation(operation: string | undefined): WindowTypeRenderFieldOperation | string | undefined {
  return operation;
}

function shouldUseB92SegmentResolver(source: WindowTypeSourceModel): source is B92SegmentResolverDevSource {
  return (source as B92SegmentResolverDevSource).dev?.b92UseSegmentResolver === true;
}

function shouldExposeB92SegmentResolverDiagnostics(source: WindowTypeSourceModel): source is B92SegmentResolverDevSource {
  return (source as B92SegmentResolverDevSource).dev?.b92ExposeSegmentResolverDiagnostics === true;
}

function shouldUseB92JunctionGeometryVisualPilot(source: WindowTypeSourceModel): source is B92SegmentResolverDevSource {
  return (source as B92SegmentResolverDevSource).dev?.b92UseJunctionGeometryVisualPilot === true;
}

function isRenderContractProfileId(profileId: string): profileId is B92ProfileId {
  return (
    profileId === "B92-1" ||
    profileId === "B92-1/78V" ||
    profileId === "B92-2" ||
    profileId === "B92-3" ||
    profileId === "B92-4/100V" ||
    profileId === "B92-6" ||
    profileId === "B92-7" ||
    profileId === "B92-7/100" ||
    profileId === "B92-7/120" ||
    profileId === "B92-7/100V" ||
    profileId === "B92-8" ||
    profileId === "B92-8A" ||
    profileId === "B92-8B" ||
    profileId === "B92-8C" ||
    profileId === "B92-8D" ||
    profileId === "B92-8E" ||
    profileId === "B92-8F" ||
    profileId === "B92-8G" ||
    profileId === "B92-9" ||
    profileId === "B92-10" ||
    profileId === "B92-11" ||
    profileId === "B92-12" ||
    profileId === "B92-13" ||
    profileId === "B92-14" ||
    profileId === "B92-15" ||
    profileId === "B92-16" ||
    profileId === "B92-17" ||
    profileId === "B92-18" ||
    profileId === "B92-19" ||
    profileId === "B92-20" ||
    profileId === "B92-21" ||
    profileId === "B92-22" ||
    profileId === "B92-23" ||
    profileId === "B92-24"
  );
}

const B92_INTERNAL_1X2_VERTICAL_JUNCTION_VISUAL_PROFILE_REFS = new Set<string>([
  "B92-11",
  "B92-12",
  "B92-13",
  "B92-15",
  "B92-18",
]);

function sourceWithB92JunctionVisualPilotCorrections(source: WindowTypeSourceModel): WindowTypeSourceModel {
  return {
    ...source,
    dev: {
      ...source.dev,
      b92UseDiagnosticJunctionRegistryCorrections: true,
    },
  };
}

function isB92Internal1x2JunctionVisualPilotEligible(source: WindowTypeSourceModel): boolean {
  return source.systemCode === "B92" && source.view === "inside" && source.layout.rows === 1 && source.layout.columns === 2;
}

function profileRefFromSegmentAssignment(assignment: B92ResolvedProfileAssignment): WindowTypeRenderProfileRef | null {
  if (!isRenderContractProfileId(assignment.profileId)) return null;
  return {
    profileId: assignment.profileId,
    source: assignment.status === "confirmed" ? "resolved" : "candidate_required",
    note: assignment.note,
  };
}

function operationFamilyForJoin(operation: B92ResolvedFieldOperation): "fixed" | "sash" {
  return operation === "fixed" ? "fixed" : "sash";
}

function joinConditionForOperations(
  first: B92ResolvedFieldOperation,
  second: B92ResolvedFieldOperation,
  flying: boolean
): B92JoinCondition {
  if (flying) return "flying_mullion";
  const firstFamily = operationFamilyForJoin(first);
  const secondFamily = operationFamilyForJoin(second);
  if (firstFamily === "fixed" && secondFamily === "fixed") return "fixed_to_fixed";
  if (firstFamily === "fixed" && secondFamily === "sash") return "fixed_to_tilt_turn";
  if (firstFamily === "sash" && secondFamily === "fixed") return "tilt_turn_to_fixed";
  return "tilt_turn_to_tilt_turn";
}

function verticalJunctionFromAssignment(assignment: B92ResolvedProfileAssignment): WindowTypeRenderJunction | null {
  if (assignment.segment?.kind !== "vertical_junction") return null;
  const segment: B92VerticalJunctionSegment = assignment.segment;
  const profile = profileRefFromSegmentAssignment(assignment);
  if (!profile) return null;
  return {
    id: assignment.segmentId,
    axis: "vertical",
    condition: joinConditionForOperations(segment.leftOperation, segment.rightOperation, segment.junctionType === "flying"),
    betweenFieldIds: [segment.leftField.id, segment.rightField.id],
    profile,
    ownerFieldId: segment.ownerFieldKey ?? null,
  };
}

function horizontalJunctionFromAssignment(assignment: B92ResolvedProfileAssignment): WindowTypeRenderJunction | null {
  if (assignment.segment?.kind !== "horizontal_transom") return null;
  const segment: B92HorizontalTransomSegment = assignment.segment;
  const profile = profileRefFromSegmentAssignment(assignment);
  if (!profile) return null;
  return {
    id: assignment.segmentId,
    axis: "horizontal",
    condition: joinConditionForOperations(segment.topOperation, segment.bottomOperation, false),
    betweenFieldIds: [segment.topField.id, segment.bottomField.id],
    profile,
  };
}

function outerEdgeDifferences(contract: WindowTypeRenderModel, segmentResult: B92SegmentResolutionResult) {
  return segmentResult.outerEdgeAssignments
    .map((assignment) => {
      if (assignment.segment?.kind !== "outer_edge") return null;
      const field = contract.fields.find((item) => item.id === assignment.segment?.field.id);
      if (!field) {
        return {
          segmentId: assignment.segmentId,
          edge: assignment.segment.edge,
          contractProfileId: null,
          resolverProfileId: assignment.profileId,
          reason: "field not found in render contract",
        };
      }
      const contractProfileId = field.perimeter[assignment.segment.edge]?.profileId ?? null;
      if (contractProfileId === assignment.profileId) return null;
      return {
        segmentId: assignment.segmentId,
        edge: assignment.segment.edge,
        contractProfileId,
        resolverProfileId: assignment.profileId,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
}

function applyB92SegmentResolverToContract(
  source: WindowTypeSourceModel,
  contract: WindowTypeRenderModel
): WindowTypeRenderModel {
  const useResolverAssignments = shouldUseB92SegmentResolver(source);
  const exposeResolverDiagnostics = shouldExposeB92SegmentResolverDiagnostics(source);
  const useJunctionVisualPilot = shouldUseB92JunctionGeometryVisualPilot(source);
  const useJunctionVisualPilotGeometry =
    useJunctionVisualPilot && isB92Internal1x2JunctionVisualPilotEligible(source);
  if (!useResolverAssignments && !exposeResolverDiagnostics && !useJunctionVisualPilot) return contract;

  const resolverSource = useJunctionVisualPilotGeometry ? sourceWithB92JunctionVisualPilotCorrections(source) : source;
  const segmentResult = resolveB92ProfileSegmentsFromSource(resolverSource);
  const diagnosticsMetadata = exposeResolverDiagnostics
    ? {
        diagnosticOnly: true as const,
        visualGeometryChanged: false as const,
        verticalJunctionAssignments: segmentResult.verticalJunctionAssignments,
        horizontalTransomAssignments: segmentResult.horizontalTransomAssignments,
        outerEdgeAssignments: segmentResult.outerEdgeAssignments,
        sillAssignments: segmentResult.sillAssignments,
        issues: segmentResult.issues,
      }
    : contract.meta.dev?.b92SegmentResolverDiagnostics;
  const appliedVertical = segmentResult.verticalJunctionAssignments
    .map((assignment) => {
      if (!useJunctionVisualPilotGeometry) {
        return verticalJunctionFromAssignment(assignment);
      }
      if (!B92_INTERNAL_1X2_VERTICAL_JUNCTION_VISUAL_PROFILE_REFS.has(assignment.profileId)) {
        console.warn("B92 junction geometry visual pilot skipped unmapped profile ref.", {
          segmentId: assignment.segmentId,
          profileId: assignment.profileId,
        });
        return null;
      }
      return verticalJunctionFromAssignment(assignment);
    })
    .filter((item): item is WindowTypeRenderJunction => !!item);

  if (useJunctionVisualPilot && !isB92Internal1x2JunctionVisualPilotEligible(source)) {
    console.warn("B92 junction geometry visual pilot skipped: only B92 inside 1x2 sources are supported.", {
      systemCode: source.systemCode,
      view: source.view,
      rows: source.layout.rows,
      columns: source.layout.columns,
    });
  }

  if (!useResolverAssignments) {
    return {
      ...contract,
      meta: {
        ...contract.meta,
        dev: {
          ...contract.meta.dev,
          b92SegmentResolverDiagnostics: diagnosticsMetadata,
        },
      },
      verticalJunctions: useJunctionVisualPilotGeometry ? appliedVertical : contract.verticalJunctions,
    };
  }

  const appliedHorizontal = segmentResult.horizontalTransomAssignments
    .map(horizontalJunctionFromAssignment)
    .filter((item): item is WindowTypeRenderJunction => !!item);
  const outerEdgeSegments = segmentResult.outerEdgeAssignments
    .map((assignment) => {
      if (assignment.segment?.kind !== "outer_edge") return null;
      return {
        edge: assignment.segment.edge,
        segmentIndex: assignment.segment.segmentIndex,
        row: assignment.segment.row,
        column: assignment.segment.column,
        fieldId: assignment.segment.field.id,
        profile: {
          profileId: assignment.profileId,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
  const sillSegments = segmentResult.sillAssignments
    .map((assignment) => {
      if (assignment.segment?.kind !== "outer_edge") return null;
      return {
        column: assignment.segment.column,
        segmentIndex: assignment.segment.segmentIndex,
        fieldId: assignment.segment.field.id,
        profile: {
          profileId: assignment.profileId,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
  const outerEdgesReadOnly = outerEdgeDifferences(contract, segmentResult);

  if (segmentResult.issues.length > 0) {
    console.warn("B92 Resolver Issues", segmentResult.issues);
  }
  if (segmentResult.sillAssignments.length > 0) {
    console.warn(
      "B92 Resolver segmented sill assignments are read-only; existing bottom frame remains unchanged.",
      segmentResult.sillAssignments
    );
  }

  console.group("B92 Resolver Integration");
  console.log({
    appliedVertical,
    appliedHorizontal,
    outerEdgeSegments,
    sillSegments,
    outerEdgesReadOnly,
    unresolved: segmentResult.issues,
  });
  console.groupEnd();

  return {
    ...contract,
    meta: {
      ...contract.meta,
      dev: {
        ...contract.meta.dev,
        b92RenderSegmentedSillOverlay: source.dev?.b92RenderSegmentedSillOverlay === true,
        b92SegmentResolverDiagnostics: diagnosticsMetadata,
      },
    },
    verticalJunctions: appliedVertical,
    horizontalJunctions: appliedHorizontal,
    outerEdgeSegments,
    sillSegments,
  };
}

function buildPerimeter(source: WindowTypeSourceModel): WindowTypeRenderPerimeter {
  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");

  const { perimeterProfiles } = fieldRule;
  assertProfileCode(perimeterProfiles.top.profileCode, "B92-1", "top");
  assertProfileCode(perimeterProfiles.left.profileCode, "B92-2", "left");
  assertProfileCode(perimeterProfiles.right.profileCode, "B92-2", "right");
  assertProfileCode(perimeterProfiles.bottom.profileCode, "B92-3", "bottom");

  return {
    top: resolvedProfile("B92-1", perimeterProfiles.top.notes),
    left: resolvedProfile("B92-2", perimeterProfiles.left.notes),
    right: resolvedProfile("B92-2", perimeterProfiles.right.notes),
    bottom: resolvedProfile("B92-3", perimeterProfiles.bottom.notes),
  };
}

function validateB92FixedInternalSource(source: WindowTypeSourceModel, dimensions: RuntimeDimensionsMm): void {
  assertFinitePositiveDimension(dimensions.widthMm, "widthMm");
  assertFinitePositiveDimension(dimensions.heightMm, "heightMm");

  assertCondition(source.status === "approved", "status must be approved.");
  assertCondition(source.systemCode === "B92", "systemCode must be B92.");
  assertCondition(source.view === "inside", "view must be inside.");
  assertCondition(source.referenceView === "external", "referenceView must be external.");
  assertCondition(source.layout.columns === 1 && source.layout.rows === 1, "layout must be 1x1.");
  assertCondition(source.fieldRules.length === 1, "exactly one field rule is required.");

  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");
  assertCondition(fieldRule.fieldSelector.row === 0, "field rule row must be 0.");
  assertCondition(fieldRule.fieldSelector.column === 0, "field rule column must be 0.");
  assertCondition(fieldRule.operationType === "fixed", "operationType must be fixed.");
  assertCondition(fieldRule.excludedOperationTypes?.includes("fixed_sash"), "fixed_sash must be excluded.");

  assertProfileCode(fieldRule.perimeterProfiles.top.profileCode, "B92-1", "top");
  assertProfileCode(fieldRule.perimeterProfiles.left.profileCode, "B92-2", "left");
  assertProfileCode(fieldRule.perimeterProfiles.right.profileCode, "B92-2", "right");
  assertProfileCode(fieldRule.perimeterProfiles.bottom.profileCode, "B92-3", "bottom");

  const { visibleFrameMm, glassOrderRule } = fieldRule.geometryRules;
  assertCondition(visibleFrameMm.top === 78, "visible frame top must be 78mm.");
  assertCondition(visibleFrameMm.left === 78, "visible frame left must be 78mm.");
  assertCondition(visibleFrameMm.right === 78, "visible frame right must be 78mm.");
  assertCondition(visibleFrameMm.bottom === 93, "visible frame bottom must be 93mm.");

  assertCondition(glassOrderRule.biteBehindBeadMm === 13, "glass order biteBehindBeadMm must be 13mm.");
  assertCondition(glassOrderRule.widthDeltaMm === 26, "glass order widthDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.heightDeltaMm === 26, "glass order heightDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.formula === "visible_glass_plus_2x_bite", "glass order formula is unsupported.");
}

function validateB92FixedSashInternalSource(source: WindowTypeSourceModel, dimensions: RuntimeDimensionsMm): void {
  assertFinitePositiveDimension(dimensions.widthMm, "widthMm");
  assertFinitePositiveDimension(dimensions.heightMm, "heightMm");

  assertCondition(source.status === "approved", "status must be approved.");
  assertCondition(source.systemCode === "B92", "systemCode must be B92.");
  assertCondition(source.view === "inside", "view must be inside.");
  assertCondition(source.referenceView === "external", "referenceView must be external.");
  assertCondition(source.layout.columns === 1 && source.layout.rows === 1, "layout must be 1x1.");
  assertCondition(source.fieldRules.length === 1, "exactly one field rule is required.");
  assertNoBlockingSourceIssues(source);

  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");
  assertCondition(fieldRule.fieldSelector.row === 0, "field rule row must be 0.");
  assertCondition(fieldRule.fieldSelector.column === 0, "field rule column must be 0.");
  assertCondition(fieldRule.operationType === "fixed_sash", "operationType must be fixed_sash.");

  assertProfileCode(fieldRule.perimeterProfiles.top.profileCode, "B92-1", "top");
  assertProfileCode(fieldRule.perimeterProfiles.left.profileCode, "B92-2", "left");
  assertProfileCode(fieldRule.perimeterProfiles.right.profileCode, "B92-2", "right");
  assertProfileCode(fieldRule.perimeterProfiles.bottom.profileCode, "B92-3", "bottom");

  assertCondition(!!fieldRule.sashProfiles, "sashProfiles are required.");
  assertProfileCode(fieldRule.sashProfiles.top?.profileCode ?? "", "B92-7", "sash top");
  assertProfileCode(fieldRule.sashProfiles.left?.profileCode ?? "", "B92-9", "sash left");
  assertProfileCode(fieldRule.sashProfiles.right?.profileCode ?? "", "B92-10", "sash right");
  assertProfileCode(fieldRule.sashProfiles.bottom?.profileCode ?? "", "B92-8", "sash bottom");

  const { visibleFrameMm, sashGeometryRules, beadGeometryRules, glassOrderRule } = fieldRule.geometryRules;
  assertCondition(visibleFrameMm.top === 37.5, "visible frame top must be 37.5mm.");
  assertCondition(visibleFrameMm.left === 37.5, "visible frame left must be 37.5mm.");
  assertCondition(visibleFrameMm.right === 37.5, "visible frame right must be 37.5mm.");
  assertCondition(visibleFrameMm.bottom === 52.5, "visible frame bottom must be 52.5mm.");

  assertNumberBySide("sashGeometryRules.visibleFaceMm", sashGeometryRules?.visibleFaceMm, {
    top: 57,
    left: 57,
    right: 57,
    bottom: 57,
  });
  assertNumberBySide("sashGeometryRules.insetMm", sashGeometryRules?.insetMm, {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  assertNumberBySide("sashGeometryRules.overlapMm", sashGeometryRules?.overlapMm, {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  assertNumberBySide("beadGeometryRules.visibleFaceMm", beadGeometryRules?.visibleFaceMm, {
    top: 21,
    left: 21,
    right: 21,
    bottom: 21,
  });
  assertCondition(beadGeometryRules?.biteBehindBeadMm === 13, "bead biteBehindBeadMm must be 13mm.");

  assertCondition(glassOrderRule.biteBehindBeadMm === 13, "glass order biteBehindBeadMm must be 13mm.");
  assertCondition(glassOrderRule.widthDeltaMm === 26, "glass order widthDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.heightDeltaMm === 26, "glass order heightDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.formula === "visible_glass_plus_2x_bite", "glass order formula is unsupported.");
}

function metadataNotesFromSource(source: WindowTypeSourceModel): string[] {
  const fieldRule = source.fieldRules[0];
  const notes = [
    "Generated from Admin WindowTypeSourceModel infrastructure; not wired into renderer.",
    `sourceModelId=${source.id}`,
    `source=${source.provenance.source}`,
  ];

  if (source.provenance.sourceId) {
    notes.push(`sourceId=${source.provenance.sourceId}`);
  }
  if (source.provenance.version) {
    notes.push(`sourceVersion=${source.provenance.version}`);
  }
  if (fieldRule) {
    notes.push(
      `visibleFrameMm=${fieldRule.geometryRules.visibleFrameMm.top}/${fieldRule.geometryRules.visibleFrameMm.left}/${fieldRule.geometryRules.visibleFrameMm.right}/${fieldRule.geometryRules.visibleFrameMm.bottom}`
    );
    notes.push(
      `glassOrderRuleMm=bite:${fieldRule.geometryRules.glassOrderRule.biteBehindBeadMm},widthDelta:${fieldRule.geometryRules.glassOrderRule.widthDeltaMm},heightDelta:${fieldRule.geometryRules.glassOrderRule.heightDeltaMm}`
    );
    if (fieldRule.interfaceProfiles?.fixedInternal?.profileCode) {
      notes.push(`fixedInternalInterface=${fieldRule.interfaceProfiles.fixedInternal.profileCode}`);
    }
  }

  return [...notes, ...(source.provenance.notes ?? [])];
}

function buildB92FixedInternalRenderModelFromSource(
  source: WindowTypeSourceModel,
  dimensions: RuntimeDimensionsMm
): WindowTypeRenderModel {
  validateB92FixedInternalSource(source, dimensions);

  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");

  const fieldId = fieldRule.fieldSelector.fieldKey ?? "fixed-1";

  const contract: WindowTypeRenderModel = {
    meta: {
      system: "B92",
      referenceView: "external",
      validationMode: "external_refs_internal_validation",
      source: "resolver_contract",
      designRule: B92_FIXED_INTERNAL_DESIGN_RULE,
      notes: metadataNotesFromSource(source),
    },
    overall: {
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
    },
    fields: [
      {
        id: fieldId,
        row: fieldRule.fieldSelector.row,
        column: fieldRule.fieldSelector.column,
        type: "fixed",
        operation: sourceFieldOperation(fieldRule.operation),
        dimensionsMm: {
          width: dimensions.widthMm,
          height: dimensions.heightMm,
        },
        perimeter: buildPerimeter(source),
      },
    ],
    verticalJunctions: [],
    horizontalJunctions: [],
    couplings: [],
    corners: [],
    thresholds: [],
    constraints: [],
  };

  return applyB92SegmentResolverToContract(source, contract);
}

function buildB92FixedSashInternalRenderModelFromSource(
  source: WindowTypeSourceModel,
  dimensions: RuntimeDimensionsMm
): WindowTypeRenderModel {
  validateB92FixedSashInternalSource(source, dimensions);

  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");
  assertCondition(fieldRule.sashProfiles, "sashProfiles are required.");

  const fieldId = fieldRule.fieldSelector.fieldKey ?? "fixed-sash-1";
  const { sashGeometryRules, beadGeometryRules, glassOrderRule } = fieldRule.geometryRules;

  const contract: WindowTypeRenderModel = {
    meta: {
      system: "B92",
      referenceView: "external",
      validationMode: "external_refs_internal_validation",
      source: "resolver_contract",
      designRule: B92_FIXED_SASH_INTERNAL_DESIGN_RULE,
      notes: metadataNotesFromSource(source),
    },
    overall: {
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
    },
    fields: [
      {
        id: fieldId,
        row: fieldRule.fieldSelector.row,
        column: fieldRule.fieldSelector.column,
        type: "fixed_sash",
        operation: sourceFieldOperation(fieldRule.operation ?? "fixed_sash"),
        dimensionsMm: {
          width: dimensions.widthMm,
          height: dimensions.heightMm,
        },
        perimeter: buildPerimeter(source),
        sash: {
          openingType: "fixed_sash",
          operation: sourceFieldOperation(fieldRule.operation ?? "fixed_sash"),
          hingeSide: null,
          handleSide: null,
          profiles: {
            top: resolvedProfile("B92-7", fieldRule.sashProfiles.top?.notes),
            left: resolvedProfile("B92-9", fieldRule.sashProfiles.left?.notes),
            right: resolvedProfile("B92-10", fieldRule.sashProfiles.right?.notes),
            bottom: resolvedProfile("B92-8", fieldRule.sashProfiles.bottom?.notes),
          },
          geometry: {
            visibleFaceMm: sashGeometryRules?.visibleFaceMm,
            insetMm: sashGeometryRules?.insetMm,
            overlapMm: sashGeometryRules?.overlapMm,
            beadVisibleFaceMm: beadGeometryRules?.visibleFaceMm,
            glassOrderRule,
          },
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

  return applyB92SegmentResolverToContract(source, contract);
}

export function buildWindowTypeRenderModelFromSource(
  source: WindowTypeSourceModel,
  dimensions: RuntimeDimensionsMm
): WindowTypeRenderModel {
  const operationType = source.fieldRules[0]?.operationType;
  if (operationType === "fixed_sash") {
    return buildB92FixedSashInternalRenderModelFromSource(source, dimensions);
  }

  return buildB92FixedInternalRenderModelFromSource(source, dimensions);
}
