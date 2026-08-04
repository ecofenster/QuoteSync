import type {
  ConfiguratorApprovedOneFieldInternalDefinitionKey,
  ConfiguratorFieldDefinitionV2,
  ConfiguratorFieldOpeningDefinition,
  ConfiguratorFieldRenderDefinitionRef,
  ConfiguratorJunctionDefinitionV2,
  ConfiguratorLayoutDefinitionV2,
  ConfiguratorLayoutMode,
  ConfiguratorStaticMullionDefinition,
  ConfiguratorStaticMullionWidth,
} from "./configuratorSchema.types";
import type {
  WindowFieldDefinition,
  WindowFieldType,
  WindowJunctionDefinition,
  WindowLayoutDefinition,
} from "../estimateWorkflow/workflow.types";
import type { ResolvedSectionProfileSet } from "./rendering/profileSectionMapping";

function mapLayoutMode(layout: Pick<WindowLayoutDefinition, "compositionMode" | "freehand">): ConfiguratorLayoutMode {
  if (layout.freehand?.enabled || layout.compositionMode === "freehand") return "freehand";
  if (layout.compositionMode === "linearHorizontal") return "linear_horizontal";
  if (layout.compositionMode === "linearVertical") return "linear_vertical";
  if (layout.compositionMode === "grid") return "grid";
  return "single";
}

export function mapLegacyWindowFieldTypeToConfiguratorOpening(
  fieldType: WindowFieldType
): ConfiguratorFieldOpeningDefinition {
  switch (fieldType) {
    case "fixed":
      return {
        operationType: "fixed",
        openingDirection: "neutral",
        handing: "center",
        sequence: null,
        sourceFieldType: fieldType,
      };
    case "tiltAndTurn":
      return {
        operationType: "tilt_turn",
        openingDirection: "inward",
        handing: "center",
        sequence: "tilt_first",
        sourceFieldType: fieldType,
      };
    case "tiltAndTurnLeft":
      return {
        operationType: "tilt_turn",
        openingDirection: "inward",
        handing: "left",
        sequence: "tilt_first",
        sourceFieldType: fieldType,
      };
    case "tiltAndTurnRight":
      return {
        operationType: "tilt_turn",
        openingDirection: "inward",
        handing: "right",
        sequence: "tilt_first",
        sourceFieldType: fieldType,
      };
    case "turnTiltLeft":
      return {
        operationType: "tilt_turn",
        openingDirection: "inward",
        handing: "left",
        sequence: "turn_first",
        sourceFieldType: fieldType,
      };
    case "turnTiltRight":
      return {
        operationType: "tilt_turn",
        openingDirection: "inward",
        handing: "right",
        sequence: "turn_first",
        sourceFieldType: fieldType,
      };
    case "turnLeft":
      return {
        operationType: "turn",
        openingDirection: "inward",
        handing: "left",
        sequence: null,
        sourceFieldType: fieldType,
      };
    case "turnRight":
      return {
        operationType: "turn",
        openingDirection: "inward",
        handing: "right",
        sequence: null,
        sourceFieldType: fieldType,
      };
    case "topHung":
      return {
        operationType: "tilt",
        openingDirection: "outward",
        handing: "center",
        sequence: null,
        sourceFieldType: fieldType,
      };
    case "sideHung":
      return {
        operationType: "side_hung",
        openingDirection: "outward",
        handing: "center",
        sequence: null,
        sourceFieldType: fieldType,
      };
    case "reversible":
      return {
        operationType: "reversible",
        openingDirection: "outward",
        handing: "center",
        sequence: null,
        sourceFieldType: fieldType,
      };
    default:
      return {
        operationType: "fixed",
        openingDirection: "neutral",
        handing: "center",
        sequence: null,
        sourceFieldType: fieldType,
      };
  }
}

export function getApprovedOneFieldInternalDefinitionKey(
  opening: ConfiguratorFieldOpeningDefinition
): ConfiguratorApprovedOneFieldInternalDefinitionKey | null {
  if (opening.openingDirection !== "inward" && opening.operationType !== "fixed") return null;
  if (opening.operationType === "fixed") return "windows:1field:fixed:IV";
  if (opening.operationType === "tilt") return "windows:1field:tilt:IV";
  if (opening.operationType === "turn" && opening.handing === "left") return "windows:1field:turn_left:IV";
  if (opening.operationType === "turn" && opening.handing === "right") return "windows:1field:turn_right:IV";
  if (opening.operationType === "tilt_turn" && opening.handing === "left") {
    return "windows:1field:tilt_turn_left:IV";
  }
  if (opening.operationType === "tilt_turn" && opening.handing === "right") {
    return "windows:1field:tilt_turn_right:IV";
  }
  return null;
}

export function buildApprovedOneFieldInternalRenderRef(
  opening: ConfiguratorFieldOpeningDefinition
): ConfiguratorFieldRenderDefinitionRef | null {
  const contextKey = getApprovedOneFieldInternalDefinitionKey(opening);
  return contextKey ? { renderDefinitionContextKey: contextKey } : null;
}

export function buildFixedSashOneFieldInternalRenderRef(): ConfiguratorFieldRenderDefinitionRef {
  return {
    renderDefinitionContextKey: "windows:1field:fixed_sash:IV",
  };
}

export function mapLegacyFieldToConfiguratorFieldDefinition(
  field: WindowFieldDefinition
): ConfiguratorFieldDefinitionV2 {
  return {
    key: field.key,
    row: field.row,
    col: field.col,
    opening: mapLegacyWindowFieldTypeToConfiguratorOpening(field.type),
    glass: null,
    renderDefinition: null,
  };
}

export function mapLegacyJunctionToConfiguratorJunctionDefinition(
  junction: WindowJunctionDefinition
): ConfiguratorJunctionDefinitionV2 {
  return {
    key: junction.key,
    axis: junction.axis,
    index: junction.index,
    type: junction.type,
    startCol: junction.startCol,
    endCol: junction.endCol,
    startRow: junction.startRow,
    endRow: junction.endRow,
    ownerFieldId: junction.ownerFieldId ?? null,
    staticMullion: null,
  };
}

export function buildStaticMullionDefinition(
  totalWidthMm: ConfiguratorStaticMullionWidth
): ConfiguratorStaticMullionDefinition {
  return {
    type: "static",
    totalWidthMm,
    internal: {
      beadLeftVisibleMm: 21,
      beadRightVisibleMm: 21,
      centerProfileVisibleMm: totalWidthMm - 42,
    },
    external: {
      visibleWidthMm: totalWidthMm,
    },
  };
}

export function buildTwoFieldFixedStaticMullionLayoutDefinition(
  mullionWidth: ConfiguratorStaticMullionWidth = 78
): ConfiguratorLayoutDefinitionV2 {
  return {
    rows: 1,
    columns: 2,
    capacity: 2,
    mode: "linear_horizontal",
    presetKey: "two-field-fixed-static-mullion",
    fields: [
      {
        key: "0,0",
        row: 0,
        col: 0,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
      {
        key: "1,0",
        row: 0,
        col: 1,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
    ],
    junctions: [
      {
        key: "vertical-1",
        axis: "vertical",
        index: 1,
        type: "static",
        startCol: 0,
        endCol: 1,
        startRow: 0,
        endRow: 0,
        staticMullion: buildStaticMullionDefinition(mullionWidth),
      },
    ],
  };
}

export function buildThreeFieldFixedStaticMullionLayoutDefinition(
  mullionWidth: ConfiguratorStaticMullionWidth = 78
): ConfiguratorLayoutDefinitionV2 {
  return {
    rows: 1,
    columns: 3,
    capacity: 3,
    mode: "linear_horizontal",
    presetKey: "three-field-fixed-static-mullion",
    fields: [
      {
        key: "0,0",
        row: 0,
        col: 0,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
      {
        key: "1,0",
        row: 0,
        col: 1,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
      {
        key: "2,0",
        row: 0,
        col: 2,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
    ],
    junctions: [
      {
        key: "vertical-1",
        axis: "vertical",
        index: 1,
        type: "static",
        startCol: 0,
        endCol: 1,
        startRow: 0,
        endRow: 0,
        staticMullion: buildStaticMullionDefinition(mullionWidth),
      },
      {
        key: "vertical-2",
        axis: "vertical",
        index: 2,
        type: "static",
        startCol: 1,
        endCol: 2,
        startRow: 0,
        endRow: 0,
        staticMullion: buildStaticMullionDefinition(mullionWidth),
      },
    ],
  };
}

export function buildFourFieldFixedStaticMullionLayoutDefinition(
  mullionWidth: ConfiguratorStaticMullionWidth = 78
): ConfiguratorLayoutDefinitionV2 {
  return {
    rows: 1,
    columns: 4,
    capacity: 4,
    mode: "linear_horizontal",
    presetKey: "four-field-fixed-static-mullion",
    fields: [
      {
        key: "0,0",
        row: 0,
        col: 0,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
      {
        key: "1,0",
        row: 0,
        col: 1,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
      {
        key: "2,0",
        row: 0,
        col: 2,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
      {
        key: "3,0",
        row: 0,
        col: 3,
        opening: {
          operationType: "fixed",
          openingDirection: "neutral",
          handing: "center",
          sequence: null,
          sourceFieldType: "fixed",
        },
        glass: null,
        renderDefinition: null,
      },
    ],
    junctions: [
      {
        key: "vertical-1",
        axis: "vertical",
        index: 1,
        type: "static",
        startCol: 0,
        endCol: 1,
        startRow: 0,
        endRow: 0,
        staticMullion: buildStaticMullionDefinition(mullionWidth),
      },
      {
        key: "vertical-2",
        axis: "vertical",
        index: 2,
        type: "static",
        startCol: 1,
        endCol: 2,
        startRow: 0,
        endRow: 0,
        staticMullion: buildStaticMullionDefinition(mullionWidth),
      },
      {
        key: "vertical-3",
        axis: "vertical",
        index: 3,
        type: "static",
        startCol: 2,
        endCol: 3,
        startRow: 0,
        endRow: 0,
        staticMullion: buildStaticMullionDefinition(mullionWidth),
      },
    ],
  };
}

export type ConfiguratorLayoutAdminPreviewInput = {
  fieldsX: number;
  fieldsY: number;
  insertion: string;
  cellInsertions: Record<string, string>;
  adminPreviewConfiguration: {
    junctions: Array<{ key: string; type?: string; ownerFieldId?: string | null }>;
  };
};

export function mapConfiguratorOpeningToRendererInsertion(
  opening: ConfiguratorFieldOpeningDefinition
): string {
  if (opening.operationType === "fixed") return "Fixed";
  if (opening.operationType === "fixed_sash") return "Fixed Sash";
  if (opening.operationType === "tilt") return "Tilt";
  if (opening.operationType === "turn" && opening.handing === "left") return "Turn Left";
  if (opening.operationType === "turn" && opening.handing === "right") return "Turn Right";
  if (opening.operationType === "tilt_turn" && opening.handing === "left") return "Tilt & Turn Left";
  if (opening.operationType === "tilt_turn" && opening.handing === "right") return "Tilt & Turn Right";
  if (opening.operationType === "tilt_turn") return "Tilt & Turn";
  if (opening.operationType === "top_hung") return "Top Hung";
  if (opening.operationType === "side_hung") return "Side Hung";
  if (opening.operationType === "reversible") return "Reversible";
  if (opening.operationType === "sliding") return "Sliding";
  if (opening.operationType === "pivot") return "Pivot";
  return "Fixed";
}

export function buildAdminPreviewInputFromConfiguratorLayoutDefinition(
  layout: ConfiguratorLayoutDefinitionV2
): ConfiguratorLayoutAdminPreviewInput {
  const cellInsertions = Object.fromEntries(
    layout.fields.map((field) => [field.key, mapConfiguratorOpeningToRendererInsertion(field.opening)])
  );
  const fallbackInsertion =
    cellInsertions[layout.fields[0]?.key ?? "0,0"] ?? "Fixed";

  return {
    fieldsX: layout.columns,
    fieldsY: layout.rows,
    insertion: fallbackInsertion,
    cellInsertions,
    adminPreviewConfiguration: {
      junctions: layout.junctions.map((junction) => ({
        key: junction.key,
        type: junction.type,
        ownerFieldId: junction.ownerFieldId ?? null,
      })),
    },
  };
}

export function applyLayoutDefinitionOverridesToResolvedProfiles(
  layout: ConfiguratorLayoutDefinitionV2,
  resolvedProfiles: ResolvedSectionProfileSet | null | undefined
): ResolvedSectionProfileSet | null | undefined {
  if (!resolvedProfiles) return resolvedProfiles;
  const staticMullion = layout.junctions.find((junction) => junction.staticMullion)?.staticMullion ?? null;
  if (!staticMullion) return resolvedProfiles;

  return {
    ...resolvedProfiles,
    mullion: {
      ...resolvedProfiles.mullion,
      visibleFaceWidthMm: staticMullion.totalWidthMm,
    },
  };
}

export function mapLegacyLayoutToConfiguratorLayoutDefinition(
  layout: WindowLayoutDefinition,
  fields: WindowFieldDefinition[] | undefined,
  junctions: WindowJunctionDefinition[] | undefined
): ConfiguratorLayoutDefinitionV2 {
  return {
    rows: layout.rows,
    columns: layout.columns,
    capacity: layout.capacity,
    mode: mapLayoutMode(layout),
    presetKey: layout.presetKey ?? null,
    freehand: layout.freehand
      ? {
          enabled: !!layout.freehand.enabled,
          isGridBased: layout.freehand.isGridBased,
          allowEmptyFields: layout.freehand.allowEmptyFields,
          cutEmptyFields: layout.freehand.cutEmptyFields,
          glassCorner: layout.freehand.glassCorner,
        }
      : undefined,
    fields: (fields ?? []).map(mapLegacyFieldToConfiguratorFieldDefinition),
    junctions: (junctions ?? []).map(mapLegacyJunctionToConfiguratorJunctionDefinition),
  };
}
