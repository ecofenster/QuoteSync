import type {
  ConfiguratorConfigurationSectionId,
  ConfiguratorWorkflowDraft,
  DivisionBasis,
  OrientationView,
  SplitMode,
  WindowBarsDefinition,
  WindowCompositionMode,
  WindowFieldDefinition,
  WindowFieldType,
  WindowFrameDefinition,
  WindowGlassDefinition,
  WindowHardwareDefinition,
  WindowJunctionDefinition,
  WindowLayoutDefinition,
  WindowMullionType,
  WindowSystemOptionsDefinition,
} from "../estimateWorkflow/workflow.types";
import { getLegacyWindowConfiguration } from "./legacyWindowConfigurationAdapter";

export const WINDOW_LAYOUT_PRESETS: Array<{
  id: string;
  label: string;
  rows: number;
  columns: number;
}> = [
  { id: "1x1", label: "1 field", rows: 1, columns: 1 },
  { id: "1x2", label: "2 field horizontal", rows: 1, columns: 2 },
  { id: "1x3", label: "3 field horizontal", rows: 1, columns: 3 },
  { id: "1x4", label: "4 field horizontal", rows: 1, columns: 4 },
  { id: "1x5", label: "5 field horizontal", rows: 1, columns: 5 },
  { id: "1x6", label: "6 field horizontal", rows: 1, columns: 6 },
  { id: "2x1", label: "2 field vertical", rows: 2, columns: 1 },
  { id: "3x1", label: "3 field vertical", rows: 3, columns: 1 },
  { id: "4x1", label: "4 field vertical", rows: 4, columns: 1 },
  { id: "5x1", label: "5 field vertical", rows: 5, columns: 1 },
  { id: "6x1", label: "6 field vertical", rows: 6, columns: 1 },
  { id: "2x2", label: "2 × 2 grid", rows: 2, columns: 2 },
  { id: "2x3", label: "2 × 3 grid", rows: 2, columns: 3 },
  { id: "2x4", label: "2 × 4 grid", rows: 2, columns: 4 },
  { id: "3x2", label: "3 × 2 grid", rows: 3, columns: 2 },
  { id: "3x3", label: "3 × 3 grid", rows: 3, columns: 3 },
  { id: "3x4", label: "3 × 4 grid", rows: 3, columns: 4 },
  { id: "4x2", label: "4 × 2 grid", rows: 4, columns: 2 },
  { id: "4x3", label: "4 × 3 grid", rows: 4, columns: 3 },
  { id: "4x4", label: "4 × 4 grid", rows: 4, columns: 4 },
  { id: "5x2", label: "5 × 2 grid", rows: 5, columns: 2 },
  { id: "5x3", label: "5 × 3 grid", rows: 5, columns: 3 },
  { id: "5x4", label: "5 × 4 grid", rows: 5, columns: 4 },
];

export const CONFIGURATION_SECTION_OPTIONS: Array<{
  id: ConfiguratorConfigurationSectionId;
  label: string;
}> = [
  { id: "layout", label: "Layout" },
  { id: "fields", label: "Fields" },
  { id: "mullionsSplits", label: "System Options" },
  { id: "frameRebate", label: "Frame" },
  { id: "glass", label: "Glass" },
  { id: "barsAstragalsDuplex", label: "Accessories" },
  { id: "hardware", label: "Hardware" },
];

export const WINDOW_FIELD_TYPE_OPTIONS: Array<{ id: WindowFieldType; label: string; insertion: string }> = [
  { id: "fixed", label: "Fixed", insertion: "Fixed" },
  { id: "tiltAndTurn", label: "Tilt and turn", insertion: "Tilt & Turn" },
  { id: "tiltAndTurnLeft", label: "Tilt & Turn Left", insertion: "Tilt & Turn Left" },
  { id: "tiltAndTurnRight", label: "Tilt & Turn Right", insertion: "Tilt & Turn Right" },
  { id: "turnTiltLeft", label: "Turn & Tilt Left", insertion: "Turn & Tilt Left" },
  { id: "turnTiltRight", label: "Turn & Tilt Right", insertion: "Turn & Tilt Right" },
  { id: "turnLeft", label: "Turn left", insertion: "Turn Left" },
  { id: "turnRight", label: "Turn right", insertion: "Turn Right" },
  { id: "topHung", label: "Top hung", insertion: "Top Hung" },
  { id: "sideHung", label: "Side hung", insertion: "Side Hung" },
  { id: "reversible", label: "Reversible", insertion: "Reversible" },
];

export const WINDOW_GLASS_PRESETS: Array<{ id: string; label: string; spec: string }> = [
  { id: "triple_glazing", label: "Triple glazing", spec: "Triple glazing" },
  { id: "preset_4lowe_18ar_4_18ar_lowe4", label: "4Lowe / 18Ar 4 / 18Ar Lowe/4", spec: "4Lowe / 18Ar 4 / 18Ar Lowe/4" },
  { id: "preset_4tsglowe_18ar_4_18ar_lowe_4tsg", label: "4tsgLowe / 18Ar 4 / 18Ar Lowe/4tsg", spec: "4tsgLowe / 18Ar 4 / 18Ar Lowe/4tsg" },
  { id: "preset_4tsglowe_18ar_4tsg_18ar_lowe_4tsg", label: "4tsgLowe / 18Ar 4tsg / 18Ar Lowe/4tsg", spec: "4tsgLowe / 18Ar 4tsg / 18Ar Lowe/4tsg" },
  { id: "preset_6tsglowe_16ar_6_16ar_lowe_6tsg", label: "6tsgLowe / 16Ar 6 / 16Ar Lowe/6tsg", spec: "6tsgLowe / 16Ar 6 / 16Ar Lowe/6tsg" },
  { id: "preset_6tsglowe_16ar_6tsg_16ar_lowe_6tsg", label: "6tsgLowe / 16Ar 6tsg / 16Ar Lowe/6tsg", spec: "6tsgLowe / 16Ar 6tsg / 16Ar Lowe/6tsg" },
  { id: "preset_8tsglowe_16ar_8_16ar_lowe_8tsg", label: "8tsgLowe / 16Ar 8 / 16Ar Lowe/8tsg", spec: "8tsgLowe / 16Ar 8 / 16Ar Lowe/8tsg" },
];

export const WINDOW_HANDLE_OPTIONS = ["Standard", "Espag", "Offset", "Cranked"];
export const WINDOW_HINGE_OPTIONS = ["Standard", "Heavy duty"];
export const WINDOW_FRAME_COLOUR_OPTIONS = [
  "White",
  "Anthracite Grey",
  "Black",
  "Cream",
  "Chartwell Green",
  "Silver Grey",
];

const DEFAULT_FRAME_DIMENSION_MM = 70;
const DEFAULT_HANDLE_HEIGHT_MM = 1050;
const MAX_LAYOUT_DIMENSION = 12;

function clampLayoutDimension(value: unknown, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(MAX_LAYOUT_DIMENSION, Math.round(next)));
}
export function deriveCompositionMode(rows: number, columns: number): WindowCompositionMode {
  if (rows <= 1 && columns <= 1) return "single";
  if (rows <= 1) return "linearHorizontal";
  if (columns <= 1) return "linearVertical";
  return "grid";
}

export function getLayoutPresetDefinition(presetKey?: string | null) {
  return WINDOW_LAYOUT_PRESETS.find((preset) => preset.id === presetKey) ?? null;
}

export function getLayoutLabel(layout: WindowLayoutDefinition) {
  if (layout.freehand?.enabled) return "Freehand layout";
  if (layout.compositionMode === "single") return "1 field";
  if (layout.compositionMode === "linearHorizontal") return `${layout.columns} field horizontal`;
  if (layout.compositionMode === "linearVertical") return `${layout.rows} field vertical`;
  return `${layout.rows} × ${layout.columns} grid`;
}

function inferLegacyRowsAndColumns(layoutFamilyId: unknown, fieldsX: number, fieldsY: number) {
  const raw = String(layoutFamilyId || "");
  const horizontalMatch = raw.match(/^horizontal_(\d+)$/);
  const verticalMatch = raw.match(/^vertical_(\d+)$/);
  if (horizontalMatch) {
    return { rows: 1, columns: clampLayoutDimension(horizontalMatch[1], Math.max(1, fieldsX || 1)), presetKey: raw };
  }
  if (verticalMatch) {
    return { rows: clampLayoutDimension(verticalMatch[1], Math.max(1, fieldsY || 1)), columns: 1, presetKey: raw };
  }
  if (raw === "single_1") {
    return { rows: 1, columns: 1, presetKey: raw };
  }
  return {
    rows: clampLayoutDimension(fieldsY, 1),
    columns: clampLayoutDimension(fieldsX, 1),
    presetKey: null,
  };
}

export function normalizeLayoutDefinition(
  layout: WindowLayoutDefinition | undefined,
  basePosition?: unknown
): WindowLayoutDefinition {
  const storedConfiguration = getLegacyWindowConfiguration(basePosition);
  const storedLayout: Partial<WindowLayoutDefinition> = storedConfiguration.layout ?? {};
  const inferredLegacy = inferLegacyRowsAndColumns(
    layout?.presetKey ?? storedLayout?.presetKey ?? storedConfiguration.layoutFamilyId,
    Math.max(1, Number((basePosition as { fieldsX?: unknown } | null | undefined)?.fieldsX || 1)),
    Math.max(1, Number((basePosition as { fieldsY?: unknown } | null | undefined)?.fieldsY || 1))
  );
  const rows = clampLayoutDimension(layout?.rows ?? storedLayout?.rows ?? inferredLegacy.rows, inferredLegacy.rows);
  const columns = clampLayoutDimension(
    layout?.columns ?? storedLayout?.columns ?? inferredLegacy.columns,
    inferredLegacy.columns
  );
  const matchedPreset = getLayoutPresetDefinition(layout?.presetKey ?? storedLayout?.presetKey ?? inferredLegacy.presetKey);
  return {
    rows,
    columns,
    capacity: rows * columns,
    compositionMode:
      layout?.freehand?.enabled || storedLayout?.freehand?.enabled
        ? "freehand"
        : deriveCompositionMode(rows, columns),
    presetKey: matchedPreset?.id ?? null,
    freehand: {
      enabled: !!(layout?.freehand?.enabled ?? storedLayout?.freehand?.enabled),
      isGridBased: layout?.freehand?.isGridBased ?? storedLayout?.freehand?.isGridBased ?? true,
      allowEmptyFields:
        layout?.freehand?.allowEmptyFields ?? storedLayout?.freehand?.allowEmptyFields ?? false,
      cutEmptyFields: layout?.freehand?.cutEmptyFields ?? storedLayout?.freehand?.cutEmptyFields ?? false,
      glassCorner: layout?.freehand?.glassCorner ?? storedLayout?.freehand?.glassCorner ?? false,
    },
  };
}

function normalizeFieldType(value: unknown): WindowFieldType {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "tiltandturnleft" || raw === "tilt_and_turn_left" || raw === "tilt & turn left") return "tiltAndTurnLeft";
  if (raw === "tiltandturnright" || raw === "tilt_and_turn_right" || raw === "tilt & turn right") return "tiltAndTurnRight";
  if (raw === "turntiltleft" || raw === "turn_tilt_left" || raw === "turn & tilt left") return "turnTiltLeft";
  if (raw === "turntiltright" || raw === "turn_tilt_right" || raw === "turn & tilt right") return "turnTiltRight";
  if (raw === "tiltandturn" || raw === "tilt_and_turn" || raw === "tilt & turn") return "tiltAndTurn";
  if (raw === "turnleft" || raw === "turn left") return "turnLeft";
  if (raw === "turnright" || raw === "turn right") return "turnRight";
  if (raw === "tophung" || raw === "top hung") return "topHung";
  if (raw === "sidehung" || raw === "side hung") return "sideHung";
  if (raw === "reversible") return "reversible";
  return "fixed";
}

function isTurnOnlyFieldType(fieldType: WindowFieldType | undefined) {
  return fieldType === "turnLeft" || fieldType === "turnRight";
}

function isTiltAndTurnFieldType(fieldType: WindowFieldType | undefined) {
  return (
    fieldType === "tiltAndTurn" ||
    fieldType === "tiltAndTurnLeft" ||
    fieldType === "tiltAndTurnRight" ||
    fieldType === "turnTiltLeft" ||
    fieldType === "turnTiltRight"
  );
}

export function insertionToFieldType(insertion: unknown): WindowFieldType {
  const raw = String(insertion || "").trim().toLowerCase();
  if (raw.includes("tilt") && raw.includes("turn") && raw.includes("left") && raw.indexOf("tilt") < raw.indexOf("turn")) return "tiltAndTurnLeft";
  if (raw.includes("tilt") && raw.includes("turn") && raw.includes("right") && raw.indexOf("tilt") < raw.indexOf("turn")) return "tiltAndTurnRight";
  if (raw.includes("turn") && raw.includes("tilt") && raw.includes("left") && raw.indexOf("turn") < raw.indexOf("tilt")) return "turnTiltLeft";
  if (raw.includes("turn") && raw.includes("tilt") && raw.includes("right") && raw.indexOf("turn") < raw.indexOf("tilt")) return "turnTiltRight";
  if (raw.includes("tilt") && raw.includes("turn")) return "tiltAndTurn";
  if (raw.includes("turn left")) return "turnLeft";
  if (raw.includes("turn right")) return "turnRight";
  if (raw.includes("top hung")) return "topHung";
  if (raw.includes("side hung")) return "sideHung";
  if (raw.includes("reversible")) return "reversible";
  return "fixed";
}

export function buildFieldKey(col: number, row: number) {
  return `${col},${row}`;
}

function buildDefaultFields(rows: number, columns: number, fallbackType: WindowFieldType): WindowFieldDefinition[] {
  const fields: WindowFieldDefinition[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      fields.push({
        key: buildFieldKey(col, row),
        row,
        col,
        type: fallbackType,
        handleType: null,
        handleHeightMm: null,
        hingeType: null,
      });
    }
  }
  return fields;
}

function buildDefaultJunctions(rows: number, columns: number): WindowJunctionDefinition[] {
  const junctions: WindowJunctionDefinition[] = [];
  for (let index = 1; index < columns; index += 1) {
    junctions.push({
      key: `vertical-${index}`,
      axis: "vertical",
      index,
      type: "static",
      startCol: index - 1,
      endCol: index,
      startRow: 0,
      endRow: rows - 1,
      ownerFieldId: null,
    });
  }
  for (let index = 1; index < rows; index += 1) {
    junctions.push({
      key: `horizontal-${index}`,
      axis: "horizontal",
      index,
      type: "static",
      startCol: 0,
      endCol: columns - 1,
      startRow: index - 1,
      endRow: index,
      ownerFieldId: null,
    });
  }
  return junctions;
}

function normalizeFields(
  rows: number,
  columns: number,
  existingFields: WindowFieldDefinition[] | undefined,
  fallbackType: WindowFieldType
) {
  const existingByKey = new Map((existingFields ?? []).map((field) => [field.key, field]));
  return buildDefaultFields(rows, columns, fallbackType).map((field) => {
    const existing = existingByKey.get(field.key);
    return existing
      ? {
          ...field,
          ...existing,
          type: normalizeFieldType(existing.type),
        }
      : field;
  });
}

function normalizeJunctions(
  rows: number,
  columns: number,
  fields: WindowFieldDefinition[],
  existingJunctions: WindowJunctionDefinition[] | undefined,
  legacyMullions: any[] | undefined
) {
  const mergedExisting = [...(existingJunctions ?? []), ...(legacyMullions ?? [])];
  const existingByKey = new Map(mergedExisting.map((junction) => [junction.key, junction]));
  return buildDefaultJunctions(rows, columns).map((junction) => {
    const existing = existingByKey.get(junction.key);
    const merged = existing ? { ...junction, ...existing } : junction;
    return {
      ...merged,
      type: normalizeJunctionType(rows, columns, fields, merged),
    };
  });
}

function getFieldAt(fields: WindowFieldDefinition[], row: number, col: number) {
  return fields.find((field) => field.row === row && field.col === col) ?? null;
}

export function isFlyingMullionAllowedForJunction(
  layout: Pick<WindowLayoutDefinition, "rows" | "columns">,
  fields: WindowFieldDefinition[] | undefined,
  junction: WindowJunctionDefinition | null | undefined
) {
  if (!junction || junction.axis !== "vertical") return false;
  if (layout.rows !== 1 || layout.columns !== 2) return false;
  if (junction.startRow !== 0 || junction.endRow !== 0) return false;
  if (junction.startCol !== 0 || junction.endCol !== 1) return false;

  const leftField = getFieldAt(fields ?? [], 0, 0);
  const rightField = getFieldAt(fields ?? [], 0, 1);
  if (!leftField || !rightField) return false;

  return (
    (isTurnOnlyFieldType(leftField.type) && isTiltAndTurnFieldType(rightField.type)) ||
    (isTiltAndTurnFieldType(leftField.type) && isTurnOnlyFieldType(rightField.type))
  );
}

function normalizeJunctionType(
  rows: number,
  columns: number,
  fields: WindowFieldDefinition[],
  junction: WindowJunctionDefinition
): WindowMullionType {
  if (junction.type !== "flying") return "static";
  return isFlyingMullionAllowedForJunction({ rows, columns }, fields, junction) ? "flying" : "static";
}

function normalizeFrame(frame: WindowFrameDefinition | undefined): WindowFrameDefinition {
  const finishMode = frame?.finishMode === "dual" ? "dual" : "single";
  const internalColour = frame?.internalColour ?? WINDOW_FRAME_COLOUR_OPTIONS[0];
  const externalColour = finishMode === "dual" ? frame?.externalColour ?? internalColour : internalColour;
  return {
    leftMm: Number(frame?.leftMm || DEFAULT_FRAME_DIMENSION_MM),
    rightMm: Number(frame?.rightMm || DEFAULT_FRAME_DIMENSION_MM),
    topMm: Number(frame?.topMm || DEFAULT_FRAME_DIMENSION_MM),
    bottomMm: Number(frame?.bottomMm || DEFAULT_FRAME_DIMENSION_MM),
    finishMode,
    internalColour,
    externalColour,
    bottomRebate: frame?.bottomRebate ?? null,
    bottomRebateDashed: !!frame?.bottomRebateDashed,
  };
}

function normalizeGlass(glass: WindowGlassDefinition | undefined): WindowGlassDefinition {
  const fallbackPreset = WINDOW_GLASS_PRESETS[0];
  return {
    presetId: glass?.presetId ?? fallbackPreset.id,
    presetLabel: glass?.presetLabel ?? fallbackPreset.label,
    presetSpec: glass?.presetSpec ?? fallbackPreset.spec,
  };
}

function normalizeBars(bars: WindowBarsDefinition | undefined): WindowBarsDefinition {
  return {
    duplex: !!bars?.duplex,
    horizontalCount: Number.isFinite(Number(bars?.horizontalCount)) ? Number(bars?.horizontalCount) : 0,
    verticalCount: Number.isFinite(Number(bars?.verticalCount)) ? Number(bars?.verticalCount) : 0,
    insideBars: !!bars?.insideBars,
    outsideBars: !!bars?.outsideBars,
    withinGlassBars: !!bars?.withinGlassBars,
    astragals: bars?.astragals ?? [],
    manualBars: bars?.manualBars ?? [],
  };
}

function normalizeHardware(hardware: WindowHardwareDefinition | undefined): WindowHardwareDefinition {
  return {
    defaultHandleType: hardware?.defaultHandleType ?? WINDOW_HANDLE_OPTIONS[0],
    defaultHandleHeightMm: Number(hardware?.defaultHandleHeightMm || DEFAULT_HANDLE_HEIGHT_MM),
    defaultHingeType: hardware?.defaultHingeType ?? WINDOW_HINGE_OPTIONS[0],
  };
}

function normalizeSystemOptions(
  systemOptions: WindowSystemOptionsDefinition | undefined
): WindowSystemOptionsDefinition {
  return {
    frameExtensionsEnabled: !!systemOptions?.frameExtensionsEnabled,
    widerFrameEnabled: !!systemOptions?.widerFrameEnabled,
    rebateMode: systemOptions?.rebateMode ?? "none",
    customMullionWidthMm:
      Number.isFinite(Number(systemOptions?.customMullionWidthMm)) && Number(systemOptions?.customMullionWidthMm) > 0
        ? Number(systemOptions?.customMullionWidthMm)
        : null,
  };
}

function normalizeSplitMode(value: unknown): SplitMode {
  return value === "manual" ? "manual" : "equal";
}

function normalizeDivisionBasis(value: unknown): DivisionBasis {
  return value === "glass" ? "glass" : "frame";
}

function normalizeOrientationView(value: unknown): OrientationView {
  return value === "outside" ? "outside" : "inside";
}
export function normalizeConfigurationState(
  configuration: ConfiguratorWorkflowDraft["configuration"] | undefined,
  basePosition?: unknown
): NonNullable<ConfiguratorWorkflowDraft["configuration"]> {
  const storedConfiguration = getLegacyWindowConfiguration(basePosition);
  const layout = normalizeLayoutDefinition(configuration?.layout ?? storedConfiguration?.layout, basePosition);
  const fallbackType = insertionToFieldType((basePosition as { insertion?: unknown } | null | undefined)?.insertion ?? "Fixed");
  const fields = normalizeFields(
    layout.rows,
    layout.columns,
    configuration?.fields ?? storedConfiguration?.fields,
    fallbackType
  );

  return {
    activeSectionId: configuration?.activeSectionId ?? storedConfiguration?.activeSectionId ?? "layout",
    layout,
    fields,
    junctions: normalizeJunctions(
      layout.rows,
      layout.columns,
      fields,
      configuration?.junctions ?? storedConfiguration?.junctions,
      configuration?.mullions ?? storedConfiguration?.mullions
    ),
    splitMode: normalizeSplitMode(configuration?.splitMode ?? storedConfiguration?.splitMode),
    divisionBasis: normalizeDivisionBasis(configuration?.divisionBasis ?? storedConfiguration?.divisionBasis),
    manualVerticalSplitsMm:
      configuration?.manualVerticalSplitsMm ??
      storedConfiguration?.manualVerticalSplitsMm ??
      (Array.isArray((basePosition as { colWidthsMm?: unknown } | null | undefined)?.colWidthsMm)
        ? (basePosition as { colWidthsMm: number[] }).colWidthsMm
        : []),
    manualHorizontalSplitsMm:
      configuration?.manualHorizontalSplitsMm ??
      storedConfiguration?.manualHorizontalSplitsMm ??
      (Array.isArray((basePosition as { rowHeightsMm?: unknown } | null | undefined)?.rowHeightsMm)
        ? (basePosition as { rowHeightsMm: number[] }).rowHeightsMm
        : []),
    orientationView: normalizeOrientationView(
      configuration?.orientationView ?? storedConfiguration?.orientationView
    ),
    frame: normalizeFrame(configuration?.frame ?? storedConfiguration?.frame),
    glass: normalizeGlass(configuration?.glass ?? storedConfiguration?.glass),
    bars: normalizeBars(configuration?.bars ?? storedConfiguration?.bars),
    hardware: normalizeHardware(configuration?.hardware ?? storedConfiguration?.hardware),
    systemOptions: normalizeSystemOptions(configuration?.systemOptions ?? storedConfiguration?.systemOptions),
    renderDefinitionContextKey:
      configuration?.renderDefinitionContextKey ?? storedConfiguration?.renderDefinitionContextKey ?? null,
    internalRenderProfileId:
      configuration?.internalRenderProfileId ?? storedConfiguration?.internalRenderProfileId ?? null,
    externalRenderProfileId:
      configuration?.externalRenderProfileId ?? storedConfiguration?.externalRenderProfileId ?? null,
  };
}
