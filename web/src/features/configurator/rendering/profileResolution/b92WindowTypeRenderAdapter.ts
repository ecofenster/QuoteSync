import { B92_CORNER_SYSTEM_MAP } from "./b92ProfileMaps";
import type {
  B92ResolverInput,
  B92ResolverOutput,
  B92ResolvedConstraint,
  B92ResolvedPerimeterSide,
} from "./b92ProfileTypes";
import type {
  WindowTypeRenderConstraint,
  WindowTypeRenderCorner,
  WindowTypeRenderField,
  WindowTypeRenderGlass,
  WindowTypeRenderJunction,
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
  WindowTypeRenderSash,
  WindowTypeRenderValidationMode,
} from "./windowTypeRenderContract";

export type B92WindowTypeRenderAdapterInput = {
  resolverInput: B92ResolverInput;
  resolverOutput: B92ResolverOutput;
  overallDimensionsMm: {
    width: number;
    height: number;
  };
  fieldDimensionsMm: Record<string, { width: number; height: number }>;
  glassDimensionsMm?: Record<string, { width: number; height: number; source?: WindowTypeRenderGlass["source"]; note?: string }>;
  sashMetadataByFieldId?: Record<string, WindowTypeRenderSash>;
  validationMode?: WindowTypeRenderValidationMode;
};

function contractConstraintFromResolver(constraint: B92ResolvedConstraint): WindowTypeRenderConstraint {
  return {
    sourceId: constraint.sourceId,
    constraint: constraint.constraint,
    severity:
      constraint.constraint === "unresolved_profile_choice" || constraint.constraint === "pending_confirmation"
        ? "blocking"
        : constraint.constraint === "tilt_conflict" || constraint.constraint === "sash_opening_conflict"
          ? "warning"
          : "info",
    note: constraint.note,
  };
}

function blockingConstraint(sourceId: string, note: string): WindowTypeRenderConstraint {
  return {
    sourceId,
    constraint: "pending_confirmation",
    severity: "blocking",
    note,
  };
}

function constraintsForSource(
  constraints: B92ResolvedConstraint[],
  sourceId: string
): WindowTypeRenderConstraint[] | undefined {
  const matches = constraints.filter((constraint) => constraint.sourceId === sourceId);
  return matches.length ? matches.map(contractConstraintFromResolver) : undefined;
}

function constraintsForField(
  constraints: B92ResolvedConstraint[],
  fieldId: string
): WindowTypeRenderConstraint[] | undefined {
  const matches = constraints.filter((constraint) => constraint.sourceId === fieldId || constraint.sourceId.startsWith(`${fieldId}:`));
  return matches.length ? matches.map(contractConstraintFromResolver) : undefined;
}

function profileRefFromPerimeter(side: B92ResolvedPerimeterSide): WindowTypeRenderProfileRef {
  if (side.reference) {
    return {
      profileId: side.reference.profileId,
      source: side.reference.source === "explicit_option" ? "explicit_option" : "resolved",
      note: side.reference.note ?? side.note,
    };
  }
  return {
    profileId: null,
    candidateProfileIds: side.candidateProfileIds,
    source: side.candidateProfileIds?.length ? "candidate_required" : "not_applicable",
    note: side.note,
  };
}

function profileRefSourceFromResolver(source: NonNullable<B92ResolvedPerimeterSide["reference"]>["source"]): WindowTypeRenderProfileRef["source"] {
  return source === "explicit_option" ? "explicit_option" : "resolved";
}

function buildPerimeterForField(
  resolverOutput: B92ResolverOutput,
  fieldId: string
): WindowTypeRenderPerimeter {
  const findSide = (side: keyof WindowTypeRenderPerimeter) => {
    const resolved = resolverOutput.perimeter[side].find((item) => item.fieldId === fieldId);
    return resolved
      ? profileRefFromPerimeter(resolved)
      : {
          profileId: null,
          source: "not_applicable" as const,
          note: `No ${side} perimeter reference returned for field ${fieldId}.`,
        };
  };
  return {
    top: findSide("top"),
    bottom: findSide("bottom"),
    left: findSide("left"),
    right: findSide("right"),
  };
}

export function buildB92WindowTypeRenderModel(input: B92WindowTypeRenderAdapterInput): WindowTypeRenderModel {
  const constraints = input.resolverOutput.constraints.map(contractConstraintFromResolver);
  const fields: WindowTypeRenderField[] = input.resolverInput.fields.map((field) => {
    const glassDimensions = input.glassDimensionsMm?.[field.id];
    const dimensionsMm = input.fieldDimensionsMm[field.id];
    const fieldConstraints = constraintsForField(input.resolverOutput.constraints, field.id) ?? [];
    if (!dimensionsMm) {
      fieldConstraints.push(blockingConstraint(field.id, `Missing fieldDimensionsMm for field ${field.id}.`));
    }
    return {
      id: field.id,
      row: field.row,
      column: field.column,
      type: field.type,
      dimensionsMm: dimensionsMm ?? { width: 0, height: 0 },
      perimeter: buildPerimeterForField(input.resolverOutput, field.id),
      glass: glassDimensions
        ? {
            widthMm: glassDimensions.width,
            heightMm: glassDimensions.height,
            source: glassDimensions.source ?? "resolved",
            note: glassDimensions.note,
          }
        : undefined,
      sash: input.sashMetadataByFieldId?.[field.id],
      constraints: fieldConstraints.length ? fieldConstraints : undefined,
    };
  });

  const verticalJoinInputsById = new Map((input.resolverInput.verticalJoins ?? []).map((join) => [join.id, join]));
  const horizontalJoinInputsById = new Map((input.resolverInput.horizontalJoins ?? []).map((join) => [join.id, join]));

  const verticalJunctions: WindowTypeRenderJunction[] = input.resolverOutput.verticalJunctions.map((junction) => {
    const joinInput = verticalJoinInputsById.get(junction.id);
    const constraints = constraintsForSource(input.resolverOutput.constraints, junction.id) ?? [];
    if (!joinInput?.leftFieldId || !joinInput?.rightFieldId) {
      constraints.push(blockingConstraint(junction.id, `Missing vertical join field IDs for junction ${junction.id}.`));
    }
    return {
      id: junction.id,
      axis: "vertical",
      condition: junction.condition,
      betweenFieldIds: [joinInput?.leftFieldId ?? `missing:${junction.id}:left`, joinInput?.rightFieldId ?? `missing:${junction.id}:right`],
      profile: {
        profileId: junction.reference?.profileId ?? null,
        candidateProfileIds: junction.candidateProfileIds,
        source: junction.reference ? profileRefSourceFromResolver(junction.reference.source) : "candidate_required",
        note: junction.reference?.note ?? junction.note,
      },
      ownerFieldId: junction.ownerFieldId,
      constraints: constraints.length ? constraints : undefined,
    };
  });

  const horizontalJunctions: WindowTypeRenderJunction[] = input.resolverOutput.horizontalJunctions.map((junction) => {
    const joinInput = horizontalJoinInputsById.get(junction.id);
    const constraints = constraintsForSource(input.resolverOutput.constraints, junction.id) ?? [];
    if (!joinInput?.topFieldId || !joinInput?.bottomFieldId) {
      constraints.push(blockingConstraint(junction.id, `Missing horizontal join field IDs for junction ${junction.id}.`));
    }
    return {
      id: junction.id,
      axis: "horizontal",
      condition: junction.condition,
      betweenFieldIds: [joinInput?.topFieldId ?? `missing:${junction.id}:top`, joinInput?.bottomFieldId ?? `missing:${junction.id}:bottom`],
      profile: {
        profileId: junction.reference?.profileId ?? null,
        candidateProfileIds: junction.candidateProfileIds,
        source: junction.reference ? profileRefSourceFromResolver(junction.reference.source) : "candidate_required",
        note: junction.reference?.note ?? junction.note,
      },
      ownerFieldId: junction.ownerFieldId,
      constraints: constraints.length ? constraints : undefined,
    };
  });

  const couplings = input.resolverOutput.couplings.map((coupling) => ({
    id: coupling.id,
    condition: coupling.condition,
    system: coupling.system,
    candidateSystems: coupling.candidateSystems,
    constraints: constraintsForSource(input.resolverOutput.constraints, coupling.id),
    note: coupling.note,
  }));

  const cornerInputsById = new Map((input.resolverInput.corners ?? []).map((corner) => [corner.id, corner]));
  const corners = input.resolverOutput.corners.map((corner) => {
    const definition = B92_CORNER_SYSTEM_MAP[corner.system];
    const cornerInput = cornerInputsById.get(corner.id);
    return {
      id: corner.id,
      system: corner.system,
      angleDegrees: corner.angleDegrees,
      category: definition.category,
      planViewOnly: true,
      block: definition.block,
      behaviourConstraints: constraintsForSource(input.resolverOutput.constraints, corner.id),
      involvedFieldIds: cornerInput?.involvedFieldIds ?? [],
      note: corner.note,
    } satisfies WindowTypeRenderCorner;
  });

  const thresholds = input.resolverOutput.thresholds.map((threshold) => ({
    id: `${threshold.fieldId}:${threshold.system}`,
    fieldId: threshold.fieldId,
    system: threshold.system,
    replacesBottomSill: true as const,
    note: threshold.note,
  }));

  return {
    meta: {
      system: "B92",
      referenceView: "external",
      validationMode: input.validationMode,
      source: "resolver_contract",
      designRule: input.resolverOutput.designRule,
      notes: ["Renderer must not decide profiles; profile refs are supplied by resolver output and this contract adapter."],
    },
    overall: {
      widthMm: input.overallDimensionsMm.width,
      heightMm: input.overallDimensionsMm.height,
    },
    fields,
    verticalJunctions,
    horizontalJunctions,
    couplings,
    corners,
    thresholds,
    constraints,
  };
}
