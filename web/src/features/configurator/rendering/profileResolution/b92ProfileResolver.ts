import {
  B92_COUPLING_MAP,
  B92_CORNER_SYSTEM_MAP,
  B92_FIXED_PERIMETER_MAP,
  B92_HORIZONTAL_JOIN_CANDIDATES,
  B92_RENDER_ENGINE_DESIGN_RULE,
  B92_THRESHOLD_SYSTEMS,
  B92_TILT_TURN_PERIMETER_MAP,
  B92_TILT_TURN_SILL_VARIANTS,
  B92_VERTICAL_JOIN_CANDIDATES,
} from "./b92ProfileMaps";
import type {
  B92JoinCondition,
  B92ProfileId,
  B92ProfileReference,
  B92ResolverConstraint,
  B92ResolverFieldInput,
  B92ResolverHorizontalJoinInput,
  B92ResolverInput,
  B92ResolverOutput,
  B92ResolverVerticalJoinInput,
  B92ResolvedConstraint,
  B92ResolvedCoupling,
  B92ResolvedJunction,
  B92ResolvedPerimeterSide,
  B92Side,
} from "./b92ProfileTypes";

function isTiltTurnFamily(field: B92ResolverFieldInput): boolean {
  return field.type === "tilt_turn" || field.type === "turn_only" || field.openingType === "tilt_turn" || field.openingType === "turn_only";
}

function isFixedFamily(field: B92ResolverFieldInput): boolean {
  return field.type === "fixed" || field.type === "fixed_sash" || field.openingType === "fixed";
}

function reference(profileId: B92ProfileId, template: B92ProfileReference, source: B92ProfileReference["source"] = template.source): B92ProfileReference {
  return {
    ...template,
    profileId,
    source,
  };
}

function unresolvedConstraint(sourceId: string, note: string): B92ResolvedConstraint {
  return {
    sourceId,
    constraint: "unresolved_profile_choice",
    note,
  };
}

function resolveFixedPerimeter(field: B92ResolverFieldInput, side: B92Side): B92ProfileReference {
  if (side === "top" && field.hasTrickleVent) return B92_FIXED_PERIMETER_MAP.ventHead;
  if (side === "top") return B92_FIXED_PERIMETER_MAP.head;
  if (side === "bottom") return B92_FIXED_PERIMETER_MAP.sill;
  return B92_FIXED_PERIMETER_MAP.jamb;
}

function resolveTiltTurnHead(field: B92ResolverFieldInput): B92ProfileReference {
  if (field.hasTrickleVent) return B92_TILT_TURN_PERIMETER_MAP.ventHead;
  if (field.headExtension === "B92-7/100") return B92_TILT_TURN_PERIMETER_MAP.headExtension100;
  if (field.headExtension === "B92-7/120") return B92_TILT_TURN_PERIMETER_MAP.headExtension120;
  return B92_TILT_TURN_PERIMETER_MAP.head;
}

function resolveTiltTurnBottom(field: B92ResolverFieldInput): B92ProfileReference | null {
  if (field.thresholdSystem) {
    return null;
  }
  if (field.sillVariant && B92_TILT_TURN_SILL_VARIANTS.includes(field.sillVariant)) {
    return reference(field.sillVariant, B92_TILT_TURN_PERIMETER_MAP.sill, "explicit_option");
  }
  return B92_TILT_TURN_PERIMETER_MAP.sill;
}

function resolveTiltTurnJamb(field: B92ResolverFieldInput, side: Extract<B92Side, "left" | "right">): B92ProfileReference | null {
  if (field.hingeSide === side) return B92_TILT_TURN_PERIMETER_MAP.jambHingeSide;
  if (field.handleSide === side) return B92_TILT_TURN_PERIMETER_MAP.jambHandleSide;
  if (field.handing === side) return B92_TILT_TURN_PERIMETER_MAP.jambHingeSide;
  return null;
}

function resolvePerimeterSide(field: B92ResolverFieldInput, side: B92Side): B92ResolvedPerimeterSide {
  if (isFixedFamily(field)) {
    return { fieldId: field.id, side, reference: resolveFixedPerimeter(field, side) };
  }
  if (isTiltTurnFamily(field)) {
    if (side === "top") return { fieldId: field.id, side, reference: resolveTiltTurnHead(field) };
    if (side === "bottom") {
      const reference = resolveTiltTurnBottom(field);
      return {
        fieldId: field.id,
        side,
        reference,
        note: field.thresholdSystem
          ? `${field.thresholdSystem} replaces the normal bottom sill for now; detailed threshold geometry is held.`
          : undefined,
      };
    }
    const reference = resolveTiltTurnJamb(field, side);
    return {
      fieldId: field.id,
      side,
      reference,
      candidateProfileIds: reference ? undefined : ["B92-9", "B92-10"],
      note: reference ? undefined : "T&T jamb requires hinge/handle orientation before choosing B92-9 or B92-10.",
    };
  }
  return {
    fieldId: field.id,
    side,
    reference: null,
  };
}

function profileReferenceForJunction(profileId: B92ProfileId, condition: B92JoinCondition, axis: "vertical" | "horizontal"): B92ProfileReference {
  return {
    profileId,
    role: axis === "vertical" ? "vertical_mullion" : "horizontal_transom",
    source: "explicit_option",
    note: `Resolved from explicit ${axis} ${condition} profile option.`,
  };
}

function resolveJunction(input: {
  join: B92ResolverVerticalJoinInput | B92ResolverHorizontalJoinInput;
  axis: "vertical" | "horizontal";
}): B92ResolvedJunction {
  const candidateMap = input.axis === "vertical" ? B92_VERTICAL_JOIN_CANDIDATES : B92_HORIZONTAL_JOIN_CANDIDATES;
  const preferredProfileId = input.join.preferredProfileId ?? null;
  return {
    id: input.join.id,
    condition: input.join.condition,
    reference: preferredProfileId ? profileReferenceForJunction(preferredProfileId, input.join.condition, input.axis) : null,
    candidateProfileIds: candidateMap[input.join.condition],
    ownerFieldId: "ownerFieldId" in input.join ? input.join.ownerFieldId : undefined,
    note: preferredProfileId
      ? "Explicit profile option supplied by resolver input."
      : "Profile choice requires confirmation from candidateProfileIds; no universal default is inferred.",
  };
}

function constraintsForJunction(junction: B92ResolvedJunction): B92ResolvedConstraint[] {
  if (junction.reference) return [];
  return [unresolvedConstraint(junction.id, junction.note ?? "Junction profile pending confirmation.")];
}

function constraintsForUnknownFields(fields: B92ResolverFieldInput[]): B92ResolvedConstraint[] {
  return fields
    .filter((field) => !isFixedFamily(field) && !isTiltTurnFamily(field))
    .map((field) => unresolvedConstraint(field.id, `No B92 perimeter map for field type ${field.type}.`));
}

function constraintsForPerimeter(sides: B92ResolvedPerimeterSide[]): B92ResolvedConstraint[] {
  return sides
    .filter((side) => !side.reference && side.candidateProfileIds?.length)
    .map((side) => unresolvedConstraint(`${side.fieldId}:${side.side}`, side.note ?? "Perimeter profile choice pending confirmation."));
}

function resolveThresholds(fields: B92ResolverFieldInput[]) {
  return fields
    .filter((field) => field.thresholdSystem)
    .map((field) => {
      const system = field.thresholdSystem as keyof typeof B92_THRESHOLD_SYSTEMS;
      return {
        fieldId: field.id,
        system,
        note: B92_THRESHOLD_SYSTEMS[system].note,
      };
    });
}

function resolveCouplings(input: B92ResolverInput): B92ResolvedCoupling[] {
  return (input.couplings ?? []).map((coupling) => {
    const allowedSystems = B92_COUPLING_MAP[coupling.condition];
    const explicitSystem =
      coupling.preferredSystem && allowedSystems.includes(coupling.preferredSystem) ? coupling.preferredSystem : null;
    const isExplicitValid = explicitSystem !== null;
    const isConditionSpecific = coupling.condition !== "straight_coupling" && allowedSystems.length === 1;
    const conditionSystem = isConditionSpecific ? allowedSystems[0] ?? null : null;
    const system = explicitSystem ?? conditionSystem;
    return {
      id: coupling.id,
      system,
      condition: coupling.condition,
      candidateSystems: system ? undefined : allowedSystems,
      note: isExplicitValid
        ? "Preferred coupling system accepted when allowed by condition."
        : isConditionSpecific
          ? "Condition-specific coupling system selected from locked map."
          : "Coupling system requires preferredSystem or a condition-specific coupling; no broad straight_coupling default is inferred.",
    };
  });
}

function resolveCorners(input: B92ResolverInput) {
  return (input.corners ?? []).map((corner) => {
    const definition = B92_CORNER_SYSTEM_MAP[corner.system];
    return {
      id: corner.id,
      system: definition.system,
      angleDegrees: corner.angleDegrees,
      constraints: definition.constraints,
      note: definition.note,
    };
  });
}

function constraintsForCorners(
  corners: ReturnType<typeof resolveCorners>
): B92ResolvedConstraint[] {
  return corners.flatMap((corner) =>
    corner.constraints
      .filter((constraint): constraint is Exclude<B92ResolverConstraint, "none"> => constraint !== "none")
      .map((constraint) => ({
        sourceId: corner.id,
        constraint,
        note: corner.note,
      }))
  );
}

function constraintsForCouplings(couplings: B92ResolvedCoupling[]): B92ResolvedConstraint[] {
  return couplings
    .filter((coupling) => !coupling.system)
    .map((coupling) => unresolvedConstraint(coupling.id, coupling.note ?? "Coupling system pending confirmation."));
}

export function resolveB92Profiles(input: B92ResolverInput): B92ResolverOutput {
  const top = input.fields.map((field) => resolvePerimeterSide(field, "top"));
  const bottom = input.fields.map((field) => resolvePerimeterSide(field, "bottom"));
  const left = input.fields.map((field) => resolvePerimeterSide(field, "left"));
  const right = input.fields.map((field) => resolvePerimeterSide(field, "right"));
  const verticalJunctions = (input.verticalJoins ?? []).map((join) => resolveJunction({ join, axis: "vertical" }));
  const horizontalJunctions = (input.horizontalJoins ?? []).map((join) => resolveJunction({ join, axis: "horizontal" }));
  const couplings = resolveCouplings(input);
  const corners = resolveCorners(input);
  const thresholds = resolveThresholds(input.fields);
  const constraints = [
    ...constraintsForUnknownFields(input.fields),
    ...constraintsForPerimeter([...top, ...bottom, ...left, ...right]),
    ...verticalJunctions.flatMap(constraintsForJunction),
    ...horizontalJunctions.flatMap(constraintsForJunction),
    ...constraintsForCouplings(couplings),
    ...constraintsForCorners(corners),
  ];

  return {
    view: input.view,
    referenceView: "external",
    designRule: B92_RENDER_ENGINE_DESIGN_RULE,
    perimeter: {
      top,
      bottom,
      left,
      right,
    },
    verticalJunctions,
    horizontalJunctions,
    couplings,
    corners,
    thresholds,
    constraints,
  };
}
