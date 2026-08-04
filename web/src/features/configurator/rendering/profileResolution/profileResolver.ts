import type {
  PilotConnectionAxis,
  ProfileEdge,
  ProfileResolutionInput,
  ProfileResolutionResult,
  ProfileResolutionView,
  ProfileRefId,
  ResolvedPilotConnection,
  ResolvedPilotField,
  ResolvedProfileEdge,
} from "./profileTypes";
import { lookupProfileRow, mapEdgeToLookupPosition, mapLayoutKind, type ProfileLookupContext } from "./profileLookupTable";
import {
  buildGridModel,
  getHorizontalAdjacencies,
  getVerticalAdjacencies,
  isTiltTurnFamily,
  keyForCell,
  type NormalizedField,
} from "./fieldGrid";
import { resolveVerticalJunctions } from "./junctionResolver";
import { resolveHorizontalTransoms } from "./transomResolver";
import { resolveSystemConnections } from "./systemResolver";

function resolveLayoutKind(fieldsX: number, fieldsY: number) {
  return mapLayoutKind(fieldsX, fieldsY);
}

function externalLayerNotesForField(field: NormalizedField) {
  if (field.baseType === "tiltTurn" || field.baseType === "turnOnly") {
    return {
      aluminiumCladding: true,
      shadowGapApproxMm: 4.81,
      sashCladdingApproxMm: 32.7,
      frameDepthApproxMm: 78,
    };
  }
  if (field.baseType === "fixed" || field.baseType === "fixedSash") {
    return {
      aluminiumCladding: true,
      frameDepthApproxMm: 78,
    };
  }
  return undefined;
}

function externalLayerNotesForFields(fields: NormalizedField[]) {
  const hasTiltTurn = fields.some((field) => field.baseType === "tiltTurn" || field.baseType === "turnOnly");
  const hasKnownExternal = fields.some(
    (field) => field.baseType === "fixed" || field.baseType === "fixedSash" || field.baseType === "tiltTurn" || field.baseType === "turnOnly"
  );
  if (hasTiltTurn) {
    return {
      aluminiumCladding: true,
      shadowGapApproxMm: 4.81,
      sashCladdingApproxMm: 32.7,
      frameDepthApproxMm: 78,
    };
  }
  if (hasKnownExternal) {
    return {
      aluminiumCladding: true,
      frameDepthApproxMm: 78,
    };
  }
  return undefined;
}

function lookupEdgeProfile(input: {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  field: NormalizedField;
  edge: ProfileEdge;
  fieldsByKey: Map<string, NormalizedField>;
}): ResolvedProfileEdge | null {
  const position = mapEdgeToLookupPosition(input.edge);
  if (input.field.baseType === "fixed" || input.field.baseType === "fixedSash") {
    const inMixedTiltTurnContext = hasImmediateTiltTurnNeighbour(input.field, input.fieldsByKey);
    const context: ProfileLookupContext =
      input.fieldsX === 2 && input.fieldsY === 1 && !inMixedTiltTurnContext
        ? "fixedFixed"
        : inMixedTiltTurnContext
          ? "fixedTiltTurnHorizontal"
          : "standardFixed";
    const row = lookupProfileRow({
      view: input.view,
      layoutKind: resolveLayoutKind(input.fieldsX, input.fieldsY),
      fieldType: "fixed",
      position,
      context,
      handing: input.edge === "left" ? "left" : input.edge === "right" ? "right" : null,
    });
    if (!row) return null;
    return {
      edge: input.edge,
      profileRef: row.profileRef,
      mirrored: !!row.mirrored,
      note: row.notes,
      ...(input.view === "outside" ? { externalLayerNotes: externalLayerNotesForField(input.field) } : {}),
    };
  }
  if (input.field.baseType === "tiltTurn" || input.field.baseType === "turnOnly") {
    const row = lookupProfileRow({
      view: input.view,
      layoutKind: "oneField",
      fieldType: "tiltTurn",
      position,
      context: "standardTiltTurn",
      handing: input.field.hingeSide,
    });
    if (!row) return null;
    return {
      edge: input.edge,
      profileRef: row.profileRef,
      mirrored: !!row.mirrored,
      note:
        input.edge === "top" && input.field.trickleVentActive
          ? "Trickle vent active: visible top 59.5."
          : row.notes,
      ...(input.view === "outside" ? { externalLayerNotes: externalLayerNotesForField(input.field) } : {}),
    };
  }
  return null;
}

function hasImmediateTiltTurnNeighbour(
  field: NormalizedField,
  fieldsByKey: Map<string, NormalizedField>
) {
  const neighbourKeys = [
    keyForCell(field.col - 1, field.row),
    keyForCell(field.col + 1, field.row),
    keyForCell(field.col, field.row - 1),
    keyForCell(field.col, field.row + 1),
  ];
  return neighbourKeys.some((key) => {
    const neighbour = fieldsByKey.get(key);
    return neighbour ? isTiltTurnFamily(neighbour.type) : false;
  });
}

function uniqueRefs(
  fields: ResolvedPilotField[],
  verticalConnections: ResolvedPilotConnection[],
  horizontalConnections: ResolvedPilotConnection[]
): ProfileRefId[] {
  const refs = new Set<ProfileRefId>();
  for (const field of fields) {
    (Object.values(field.edges) as ResolvedProfileEdge[]).forEach((edge) => {
      if (edge.profileRef && edge.profileRef !== "REQUIRES_CONFIRMATION") refs.add(edge.profileRef);
    });
  }
  for (const connection of [...verticalConnections, ...horizontalConnections]) {
    if (connection.profileRef && connection.profileRef !== "REQUIRES_CONFIRMATION") refs.add(connection.profileRef);
  }
  return Array.from(refs).sort();
}

function buildConnectionLookup(connections: ResolvedPilotConnection[], axis: PilotConnectionAxis) {
  const map = new Map<string, ResolvedPilotConnection>();
  for (const connection of connections) {
    map.set(`${axis}:${connection.startKey}:${connection.endKey}`, connection);
    map.set(`${axis}:${connection.endKey}:${connection.startKey}`, connection);
  }
  return map;
}

function resolveOuterOrConnectionEdge(input: {
  view: ProfileResolutionView;
  field: NormalizedField;
  edge: ProfileEdge;
  fieldsX: number;
  fieldsY: number;
  fieldsByKey: Map<string, NormalizedField>;
  verticalConnections: Map<string, ResolvedPilotConnection>;
  horizontalConnections: Map<string, ResolvedPilotConnection>;
}): ResolvedProfileEdge {
  const { field, edge } = input;
  const isOuterTop = field.row === 0;
  const isOuterBottom = field.row === input.fieldsY - 1;
  const isOuterLeft = field.col === 0;
  const isOuterRight = field.col === input.fieldsX - 1;

  if (edge === "left" && !isOuterLeft) {
    const neighbour = input.fieldsByKey.get(keyForCell(field.col - 1, field.row));
    const connection = neighbour ? input.verticalConnections.get(`vertical:${field.key}:${neighbour.key}`) : null;
    return {
      edge,
      profileRef: connection?.profileRef ?? null,
      mirrored: true,
      note: connection?.note,
      ...(connection?.requiresExternalMapping ? { requiresExternalMapping: true } : {}),
      ...(connection?.externalLayerNotes ? { externalLayerNotes: connection.externalLayerNotes } : {}),
    };
  }
  if (edge === "right" && !isOuterRight) {
    const neighbour = input.fieldsByKey.get(keyForCell(field.col + 1, field.row));
    const connection = neighbour ? input.verticalConnections.get(`vertical:${field.key}:${neighbour.key}`) : null;
    return {
      edge,
      profileRef: connection?.profileRef ?? null,
      mirrored: false,
      note: connection?.note,
      ...(connection?.requiresExternalMapping ? { requiresExternalMapping: true } : {}),
      ...(connection?.externalLayerNotes ? { externalLayerNotes: connection.externalLayerNotes } : {}),
    };
  }
  if (edge === "top" && !isOuterTop) {
    const neighbour = input.fieldsByKey.get(keyForCell(field.col, field.row - 1));
    const connection = neighbour ? input.horizontalConnections.get(`horizontal:${field.key}:${neighbour.key}`) : null;
    return {
      edge,
      profileRef: connection?.profileRef ?? null,
      mirrored: true,
      note: connection?.note,
      ...(connection?.requiresExternalMapping ? { requiresExternalMapping: true } : {}),
      ...(connection?.externalLayerNotes ? { externalLayerNotes: connection.externalLayerNotes } : {}),
    };
  }
  if (edge === "bottom" && !isOuterBottom) {
    const neighbour = input.fieldsByKey.get(keyForCell(field.col, field.row + 1));
    const connection = neighbour ? input.horizontalConnections.get(`horizontal:${field.key}:${neighbour.key}`) : null;
    return {
      edge,
      profileRef: connection?.profileRef ?? null,
      mirrored: false,
      note: connection?.note,
      ...(connection?.requiresExternalMapping ? { requiresExternalMapping: true } : {}),
      ...(connection?.externalLayerNotes ? { externalLayerNotes: connection.externalLayerNotes } : {}),
    };
  }

  if (field.baseType === "fixed" || field.baseType === "fixedSash") {
    const lookup = lookupEdgeProfile({
      view: input.view,
      fieldsX: input.fieldsX,
      fieldsY: input.fieldsY,
      field,
      edge,
      fieldsByKey: input.fieldsByKey,
    });
    if (lookup) return lookup;

    if (input.view === "outside") {
      return {
        edge,
        profileRef: "REQUIRES_CONFIRMATION",
        requiresExternalMapping: true,
        externalLayerNotes: externalLayerNotesForField(field),
        note: `External fixed ${edge} mapping requires CSV-backed rule.`,
      };
    }

    const inMixedTiltTurnContext = hasImmediateTiltTurnNeighbour(field, input.fieldsByKey);
    if (edge === "top") return { edge, profileRef: inMixedTiltTurnContext && input.fieldsX > 1 ? "B92-4" : "B92-1" };
    if (edge === "bottom") return { edge, profileRef: inMixedTiltTurnContext && input.fieldsX > 1 ? "B92-5" : "B92-3" };
    if (edge === "left" || edge === "right") return { edge, profileRef: inMixedTiltTurnContext ? "B92-6" : "B92-2", mirrored: edge === "right" };
  }

  if (field.baseType === "tiltTurn" || field.baseType === "turnOnly") {
    const lookup = lookupEdgeProfile({
      view: input.view,
      fieldsX: input.fieldsX,
      fieldsY: input.fieldsY,
      field,
      edge,
      fieldsByKey: input.fieldsByKey,
    });
    if (lookup) return lookup;

    if (input.view === "outside") {
      return {
        edge,
        profileRef: "REQUIRES_CONFIRMATION",
        requiresExternalMapping: true,
        externalLayerNotes: externalLayerNotesForField(field),
        note: `External T&T ${edge} mapping requires CSV-backed rule.`,
      };
    }

    if (edge === "top") {
      return {
        edge,
        profileRef: "B92-7",
        note: field.trickleVentActive ? "Trickle vent active: visible top 59.5." : "Visible top 37.5.",
      };
    }
    if (edge === "bottom") return { edge, profileRef: "B92-8" };
    if (edge === "left") return { edge, profileRef: field.hingeSide === "left" ? "B92-10" : "B92-9" };
    if (edge === "right") return { edge, profileRef: field.hingeSide === "right" ? "B92-10" : "B92-9" };
  }

  return {
    edge,
    profileRef: "REQUIRES_CONFIRMATION",
    note: `No locked outer-edge rule for ${field.type} ${edge}.`,
  };
}

export function resolvePilotProfiles(input: ProfileResolutionInput): ProfileResolutionResult {
  const view = input.view;
  const grid = buildGridModel(input);
  const verticalConnections = resolveVerticalJunctions({
    view,
    fieldsX: input.fieldsX,
    fieldsY: input.fieldsY,
    adjacencies: getVerticalAdjacencies({
      fieldsX: input.fieldsX,
      fieldsY: input.fieldsY,
      grid,
    }),
  });
  const horizontalConnections = resolveHorizontalTransoms({
    view,
    fieldsX: input.fieldsX,
    fieldsY: input.fieldsY,
    grid,
    adjacencies: getHorizontalAdjacencies({
      fieldsX: input.fieldsX,
      fieldsY: input.fieldsY,
      grid,
    }),
  });
  const systemConnections = resolveSystemConnections(input.systems ?? []);

  const verticalLookup = buildConnectionLookup(verticalConnections, "vertical");
  const horizontalLookup = buildConnectionLookup(horizontalConnections, "horizontal");

  const fields: ResolvedPilotField[] = grid.normalizedFields.map((field) => ({
    ...field,
    edges: {
      top: resolveOuterOrConnectionEdge({
        view,
        field,
        edge: "top",
        fieldsX: input.fieldsX,
        fieldsY: input.fieldsY,
        fieldsByKey: grid.fieldsByKey,
        verticalConnections: verticalLookup,
        horizontalConnections: horizontalLookup,
      }),
      right: resolveOuterOrConnectionEdge({
        view,
        field,
        edge: "right",
        fieldsX: input.fieldsX,
        fieldsY: input.fieldsY,
        fieldsByKey: grid.fieldsByKey,
        verticalConnections: verticalLookup,
        horizontalConnections: horizontalLookup,
      }),
      bottom: resolveOuterOrConnectionEdge({
        view,
        field,
        edge: "bottom",
        fieldsX: input.fieldsX,
        fieldsY: input.fieldsY,
        fieldsByKey: grid.fieldsByKey,
        verticalConnections: verticalLookup,
        horizontalConnections: horizontalLookup,
      }),
      left: resolveOuterOrConnectionEdge({
        view,
        field,
        edge: "left",
        fieldsX: input.fieldsX,
        fieldsY: input.fieldsY,
        fieldsByKey: grid.fieldsByKey,
        verticalConnections: verticalLookup,
        horizontalConnections: horizontalLookup,
      }),
    },
  }));

  const placeholders = [
    ...verticalConnections
      .filter((item) => item.profileRef === "REQUIRES_CONFIRMATION" || item.requiresExternalMapping)
      .map((item) => item.key),
    ...horizontalConnections
      .filter((item) => item.profileRef === "REQUIRES_CONFIRMATION" || item.requiresExternalMapping)
      .map((item) => item.key),
    ...fields.flatMap((field) =>
      (Object.values(field.edges) as ResolvedProfileEdge[])
        .filter((edge) => edge.profileRef === "REQUIRES_CONFIRMATION" || edge.requiresExternalMapping)
        .map((edge) => `${field.key}:${edge.edge}`)
    ),
  ];
  const requiresExternalMapping =
    view === "outside" &&
    ([...verticalConnections, ...horizontalConnections].some((item) => item.requiresExternalMapping) ||
      fields.some((field) =>
        (Object.values(field.edges) as ResolvedProfileEdge[]).some((edge) => edge.requiresExternalMapping)
      ));

  return {
    view,
    fields,
    verticalConnections,
    horizontalConnections,
    systemConnections,
    sectionReferences: uniqueRefs(fields, verticalConnections, horizontalConnections),
    placeholders,
    ...(requiresExternalMapping ? { requiresExternalMapping } : {}),
    ...(view === "outside" ? { externalLayerNotes: externalLayerNotesForFields(grid.normalizedFields) } : {}),
  };
}
