import type {
  B92ConfiguratorFieldOperation,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";

export function getB92OperationKey(operation: B92ConfiguratorFieldOperation) {
  if (operation === "tilt-turn-left") return "ttl";
  if (operation === "tilt-turn-right") return "ttr";
  if (operation === "turn-left") return "turn-left";
  if (operation === "turn-right") return "turn-right";
  if (operation === "tilt") return "tilt";
  if (operation === "fixed-sash") return "fixed-sash";
  return "fixed";
}

export function getB92OperationsKey(structure: B92ConfiguratorStructureState) {
  return structure.fields
    .slice()
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .map((field) => getB92OperationKey(field.operation))
    .join("|");
}

export function findB92ApprovedProofFamilyForStructure(structure: B92ConfiguratorStructureState): string | null {
  const key = getB92OperationsKey(structure);

  if (structure.rows === 1 && structure.columns === 1) {
    if (key === "fixed") return "b92-1-field-fixed";
    if (key === "ttl" || key === "ttr") return "b92-1-field-tilt-turn";
    return null;
  }

  if (structure.rows === 1 && structure.columns === 2) {
    if (key === "fixed|fixed") return "b92-2-field-fixed-fixed";
    if (key === "fixed|ttl") return "b92-2-field-fixed-tilt-turn-left";
    if (key === "fixed|ttr") return "b92-2-field-fixed-tilt-turn-right";
    if (key === "ttl|ttr") return "b92-2-field-tilt-turn-left-right";
    if (key === "ttr|ttl") return "b92-2-field-tilt-turn-right-left";
    if (key === "turn-left|ttr" || key === "turn-right|ttl") return "b92-2-field-turn-tilt-turn";
    return null;
  }

  if (structure.rows === 2 && structure.columns === 1) {
    if (key === "fixed|fixed") return "b92-2-field-fixed-bottom-fixed-top";
    if (key === "ttl|fixed" || key === "ttr|fixed") return "b92-2-field-tilt-turn-bottom-fixed-top";
    if (key === "fixed|ttl" || key === "fixed|ttr") return "b92-2-field-fixed-bottom-tilt-turn-top";
    return null;
  }

  if (structure.rows === 1 && structure.columns === 3) {
    if (key === "fixed|fixed|fixed") return "b92-3-field-fixed-fixed-fixed";
    if (key === "ttl|fixed|ttr") return "b92-3-field-tilt-turn-left-fixed-tilt-turn-right";
    if (key === "ttr|fixed|ttl") return "b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference";
    return null;
  }

  return null;
}
