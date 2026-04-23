import React, { useEffect, useMemo, useState } from "react";
import GridEditor from "../../components/GridEditor";
import { Button, H3, Small } from "../estimatePicker/tabs/shared";
import { getAllSettings } from "../../services/settings/settingsService";
import { useEstimateWorkflow } from "../estimateWorkflow/useEstimateWorkflow";
import { getConfiguratorCatalogBootstrap } from "../admin/configuratorCatalogService";
import type {
  ConfiguratorConfigurationSectionId,
  WindowFieldDefinition,
  WindowFieldType,
  WindowJunctionDefinition,
  WindowMullionType,
} from "../estimateWorkflow/workflow.types";
import type { ConfiguratorCatalogBootstrap } from "../admin/configuratorCatalog.types";
import {
  CONFIGURATION_SECTION_OPTIONS,
  WINDOW_FIELD_TYPE_OPTIONS,
  WINDOW_FRAME_COLOUR_OPTIONS,
  WINDOW_GLASS_PRESETS,
  WINDOW_HANDLE_OPTIONS,
  WINDOW_HINGE_OPTIONS,
  WINDOW_LAYOUT_PRESETS,
  applyPositionToWorkflowDraft,
  buildFieldKey,
  buildPositionFromWorkflowDraft,
  deriveCompositionMode,
  getLayoutLabel,
  isFlyingMullionAllowedForJunction,
  normalizeConfigurationState,
  normalizeLayoutDefinition,
} from "./configuratorWorkflow.helpers";
import {
  buildRenderDefinitionContextKey,
  findExactRenderProfileForContext,
  resolveSectionProfileSet,
} from "./rendering/profileSectionMapping";

type Props = {
  estimate: any;
  position: any;
  onBack: () => void;
  onSavePosition: (updatedPosition: any) => Promise<void>;
  embeddedInWorkflowShell?: boolean;
  onExitWorkflow?: () => void;
};

type SettingsMap = Record<string, unknown>;
type DimensionDefaults = { width: number; height: number };
type GlassPresetOption = { id: string; label: string; spec: string };
const EMPTY_CATALOG_BOOTSTRAP: ConfiguratorCatalogBootstrap = {
  manufacturers: [],
  products: [],
  windowTypes: [],
  sectionProfiles: [],
  profileMappings: [],
  renderProfiles: [],
  sectionDrawings: [],
  materials: [],
  colours: [],
  hardware: [],
  glass: [],
};

const FALLBACK_DIMENSIONS: DimensionDefaults = { width: 1000, height: 1200 };

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #e4e4e7",
  padding: "0 12px",
  background: "#fff",
};

const sectionButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e4e4e7",
  background: "#fff",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 800,
  color: "#18181b",
  cursor: "pointer",
};

const activeSectionButtonStyle: React.CSSProperties = {
  ...sectionButtonStyle,
  border: "1px solid #18181b",
  background: "#18181b",
  color: "#fff",
};

function toEditableString(value: unknown) {
  if (value === null || value === undefined) return "";
  const next = Number(value);
  return Number.isFinite(next) ? String(next) : "";
}

function tryParseDimensionValue(raw: string) {
  if (raw.trim() === "") return null;
  const next = Number(raw);
  if (!Number.isFinite(next)) return null;
  return Math.round(next);
}

function clampCommittedDimension(raw: string, fallback: number) {
  const parsed = tryParseDimensionValue(raw);
  if (parsed === null) return Math.max(300, Math.round(fallback));
  return Math.max(300, parsed);
}

function clampDimensionValue(value: unknown, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return Math.max(300, Math.round(fallback));
  return Math.max(300, Math.round(next));
}

function normalizeSettingKey(value: unknown) {
  return String(value || "").trim();
}

function parseSettingValue(raw: unknown) {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const lowered = trimmed.toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return numeric;
  return raw;
}

function buildSettingsMap(rows: any[]): SettingsMap {
  return rows.reduce((acc, row) => {
    const key = normalizeSettingKey(row?.key ?? row?.setting_key ?? row?.name);
    if (!key) return acc;
    const rawValue = row?.value_json ?? row?.json_value ?? row?.value ?? row?.setting_value ?? row?.raw_value;
    acc[key] = parseSettingValue(rawValue);
    return acc;
  }, {} as SettingsMap);
}

function getBooleanSetting(settingsMap: SettingsMap | null, key: string, fallback: boolean) {
  const raw = settingsMap?.[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const next = raw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(next)) return true;
    if (["false", "0", "no", "off"].includes(next)) return false;
  }
  return fallback;
}

function getDefaultDimensions(settingsMap: SettingsMap | null): DimensionDefaults {
  const raw = settingsMap?.["configurator.defaultDimensions"];
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    return {
      width: clampDimensionValue(value.width ?? value.widthMm, FALLBACK_DIMENSIONS.width),
      height: clampDimensionValue(value.height ?? value.heightMm, FALLBACK_DIMENSIONS.height),
    };
  }
  return FALLBACK_DIMENSIONS;
}

function clampSelectedCell(selectedCell: { col: number; row: number } | null, columns: number, rows: number) {
  if (!selectedCell) return null;
  return {
    col: Math.max(0, Math.min(columns - 1, selectedCell.col)),
    row: Math.max(0, Math.min(rows - 1, selectedCell.row)),
  };
}

function formatSplitList(values: number[] | undefined) {
  return Array.isArray(values) && values.length > 0 ? values.map((value) => String(Math.round(Number(value || 0)))).join("/") : "";
}

function parseSplitList(raw: string, expectedCount: number) {
  const values = raw
    .split("/")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value));
  return values.length === expectedCount ? values : null;
}

function fieldLabel(field: WindowFieldDefinition | null | undefined) {
  if (!field) return "No field selected";
  return `Column ${field.col + 1} • Row ${field.row + 1}`;
}

function appendPlaceholderEntry<T extends Record<string, unknown>>(items: T[] | undefined, patch: T) {
  return [...(items ?? []), patch];
}

function resolveColourSwatch(colour: string | null | undefined) {
  const normalized = String(colour || "White").trim().toLowerCase();
  if (normalized.includes("anthracite")) return "#4b5563";
  if (normalized.includes("black")) return "#18181b";
  if (normalized.includes("cream")) return "#f5e9c9";
  if (normalized.includes("green")) return "#7d9b76";
  if (normalized.includes("silver")) return "#9ca3af";
  return "#f4f4f5";
}

type PatternFamilyId = "single" | "doubleHorizontal" | "doubleVertical";
type PatternQuantityId =
  | "oneField"
  | "twoFields"
  | "threeFields"
  | "fourFields"
  | "fiveFields"
  | "sixFields";
type FieldPatternCardDefinition = {
  id: string;
  familyId: PatternFamilyId;
  label: string;
  helperText: string;
  rows: number;
  columns: number;
  fieldTypes: WindowFieldType[];
  junctionType?: WindowMullionType;
};

const FIELD_PATTERN_QUANTITIES: Array<{ id: PatternQuantityId; label: string; fieldCount: number; helperText: string }> = [
  { id: "oneField", label: "1 field", fieldCount: 1, helperText: "Single light patterns" },
  { id: "twoFields", label: "2 fields", fieldCount: 2, helperText: "Paired and stacked patterns" },
  { id: "threeFields", label: "3 fields", fieldCount: 3, helperText: "Triple compositions" },
  { id: "fourFields", label: "4 fields", fieldCount: 4, helperText: "Four-light compositions" },
  { id: "fiveFields", label: "5 fields", fieldCount: 5, helperText: "Five-light compositions" },
  { id: "sixFields", label: "6 fields", fieldCount: 6, helperText: "Six-light compositions" },
];

const FIELD_PATTERN_CARDS: FieldPatternCardDefinition[] = [
  {
    id: "single-fixed",
    familyId: "single",
    label: "Fixed",
    helperText: "Single fixed light",
    rows: 1,
    columns: 1,
    fieldTypes: ["fixed"],
  },
  {
    id: "single-tilt",
    familyId: "single",
    label: "Tilt",
    helperText: "Top-hung tilt opening",
    rows: 1,
    columns: 1,
    fieldTypes: ["topHung"],
  },
  {
    id: "single-tilt-turn-left",
    familyId: "single",
    label: "Tilt & Turn Left",
    helperText: "Left-handed inward opening",
    rows: 1,
    columns: 1,
    fieldTypes: ["tiltAndTurnLeft"],
  },
  {
    id: "single-tilt-turn-right",
    familyId: "single",
    label: "Tilt & Turn Right",
    helperText: "Right-handed inward opening",
    rows: 1,
    columns: 1,
    fieldTypes: ["tiltAndTurnRight"],
  },
  {
    id: "single-turn-left",
    familyId: "single",
    label: "Turn Left",
    helperText: "Left hinge, inward turn",
    rows: 1,
    columns: 1,
    fieldTypes: ["turnLeft"],
  },
  {
    id: "single-turn-right",
    familyId: "single",
    label: "Turn Right",
    helperText: "Right hinge, inward turn",
    rows: 1,
    columns: 1,
    fieldTypes: ["turnRight"],
  },
  {
    id: "double-fixed-fixed",
    familyId: "doubleHorizontal",
    label: "Fixed + Fixed",
    helperText: "Twin fixed lights",
    rows: 1,
    columns: 2,
    fieldTypes: ["fixed", "fixed"],
    junctionType: "static",
  },
  {
    id: "double-fixed-ttl",
    familyId: "doubleHorizontal",
    label: "Fixed + Tilt & Turn Left",
    helperText: "Operable right light",
    rows: 1,
    columns: 2,
    fieldTypes: ["fixed", "tiltAndTurnLeft"],
    junctionType: "static",
  },
  {
    id: "double-fixed-ttr",
    familyId: "doubleHorizontal",
    label: "Fixed + Tilt & Turn Right",
    helperText: "Operable right light",
    rows: 1,
    columns: 2,
    fieldTypes: ["fixed", "tiltAndTurnRight"],
    junctionType: "static",
  },
  {
    id: "double-ttl-fixed",
    familyId: "doubleHorizontal",
    label: "Tilt & Turn Left + Fixed",
    helperText: "Operable left light",
    rows: 1,
    columns: 2,
    fieldTypes: ["tiltAndTurnLeft", "fixed"],
    junctionType: "static",
  },
  {
    id: "double-ttr-fixed",
    familyId: "doubleHorizontal",
    label: "Tilt & Turn Right + Fixed",
    helperText: "Operable left light",
    rows: 1,
    columns: 2,
    fieldTypes: ["tiltAndTurnRight", "fixed"],
    junctionType: "static",
  },
  {
    id: "double-turnleft-tiltright-flying",
    familyId: "doubleHorizontal",
    label: "Turn Left + Tilt & Turn Right",
    helperText: "Valid flying mullion pair",
    rows: 1,
    columns: 2,
    fieldTypes: ["turnLeft", "tiltAndTurnRight"],
    junctionType: "flying",
  },
  {
    id: "double-tiltleft-turnright-flying",
    familyId: "doubleHorizontal",
    label: "Tilt & Turn Left + Turn Right",
    helperText: "Valid flying mullion pair",
    rows: 1,
    columns: 2,
    fieldTypes: ["tiltAndTurnLeft", "turnRight"],
    junctionType: "flying",
  },
  {
    id: "double-tiltleft-tiltright",
    familyId: "doubleHorizontal",
    label: "Tilt & Turn Left + Tilt & Turn Right",
    helperText: "Dual operable with fixed mullion",
    rows: 1,
    columns: 2,
    fieldTypes: ["tiltAndTurnLeft", "tiltAndTurnRight"],
    junctionType: "static",
  },
  {
    id: "double-turnleft-turnright",
    familyId: "doubleHorizontal",
    label: "Turn Left + Turn Right",
    helperText: "Dual turn sashes with fixed mullion",
    rows: 1,
    columns: 2,
    fieldTypes: ["turnLeft", "turnRight"],
    junctionType: "static",
  },
  {
    id: "double-vertical-fixed-fixed",
    familyId: "doubleVertical",
    label: "Fixed over Fixed",
    helperText: "Two stacked fixed lights",
    rows: 2,
    columns: 1,
    fieldTypes: ["fixed", "fixed"],
    junctionType: "static",
  },
  {
    id: "double-vertical-fixed-ttl",
    familyId: "doubleVertical",
    label: "Fixed over Tilt & Turn Left",
    helperText: "Lower operable light",
    rows: 2,
    columns: 1,
    fieldTypes: ["fixed", "tiltAndTurnLeft"],
    junctionType: "static",
  },
  {
    id: "double-vertical-ttl-fixed",
    familyId: "doubleVertical",
    label: "Tilt & Turn Left over Fixed",
    helperText: "Upper operable light",
    rows: 2,
    columns: 1,
    fieldTypes: ["tiltAndTurnLeft", "fixed"],
    junctionType: "static",
  },
];

function getPatternQuantityId(rows: number, columns: number): PatternQuantityId {
  const count = rows * columns;
  if (count <= 1) return "oneField";
  if (count === 2) return "twoFields";
  if (count === 3) return "threeFields";
  if (count === 4) return "fourFields";
  if (count === 5) return "fiveFields";
  return "sixFields";
}

function getPatternsForQuantity(quantityId: PatternQuantityId) {
  const count = FIELD_PATTERN_QUANTITIES.find((quantity) => quantity.id === quantityId)?.fieldCount ?? 1;
  const builtIn = FIELD_PATTERN_CARDS.filter((pattern) => pattern.fieldTypes.length === count);
  if (builtIn.length > 0) return builtIn;

  return [
    {
      id: `${count}-horizontal-fixed`,
      familyId: "doubleHorizontal" as PatternFamilyId,
      label: `${count} field horizontal`,
      helperText: "Baseline fixed arrangement",
      rows: 1,
      columns: count,
      fieldTypes: Array.from({ length: count }, () => "fixed" as WindowFieldType),
      junctionType: "static" as WindowMullionType,
    },
    {
      id: `${count}-vertical-fixed`,
      familyId: "doubleVertical" as PatternFamilyId,
      label: `${count} field vertical`,
      helperText: "Baseline stacked arrangement",
      rows: count,
      columns: 1,
      fieldTypes: Array.from({ length: count }, () => "fixed" as WindowFieldType),
      junctionType: "static" as WindowMullionType,
    },
  ];
}

function buildPatternJunctions(rows: number, columns: number, junctionType: WindowMullionType | undefined): WindowJunctionDefinition[] {
  const junctions: WindowJunctionDefinition[] = [];
  for (let index = 1; index < columns; index += 1) {
    junctions.push({
      key: `vertical-${index}`,
      axis: "vertical",
      index,
      type: junctionType ?? "static",
      startCol: index - 1,
      endCol: index,
      startRow: 0,
      endRow: rows - 1,
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
    });
  }
  return junctions;
}

function fieldTypeShortLabel(fieldType: WindowFieldType) {
  return WINDOW_FIELD_TYPE_OPTIONS.find((option) => option.id === fieldType)?.label ?? fieldType;
}

function renderPatternPreview(pattern: FieldPatternCardDefinition) {
  const boxWidth = 96;
  const boxHeight = 64;
  const padding = 8;
  const cellWidth = (boxWidth - padding * 2) / pattern.columns;
  const cellHeight = (boxHeight - padding * 2) / pattern.rows;

  function renderFieldGlyph(fieldType: WindowFieldType, x: number, y: number, width: number, height: number) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const stroke = "#18181b";
    const common = { stroke, strokeWidth: 1.2, fill: "none" as const };
    if (fieldType === "fixed") {
      return (
        <g>
          <line x1={centerX - width * 0.18} y1={centerY} x2={centerX + width * 0.18} y2={centerY} {...common} />
          <line x1={centerX} y1={centerY - height * 0.18} x2={centerX} y2={centerY + height * 0.18} {...common} />
        </g>
      );
    }
    const leftHand =
      fieldType === "turnLeft" ||
      fieldType === "tiltAndTurnLeft" ||
      fieldType === "turnTiltLeft";
    const hingeX = leftHand ? x + 4 : x + width - 4;
    const openX = leftHand ? x + width - 8 : x + 8;
    const turnLines = (
      <g>
        <line x1={hingeX} y1={y + 6} x2={openX} y2={centerY} stroke={stroke} strokeWidth={1.1} strokeDasharray="4 3" />
        <line x1={hingeX} y1={y + height - 6} x2={openX} y2={centerY} stroke={stroke} strokeWidth={1.1} strokeDasharray="4 3" />
      </g>
    );
    const tiltLines = (
      <g>
        <line x1={x + 8} y1={y + height - 6} x2={centerX} y2={y + 6} stroke={stroke} strokeWidth={1.1} strokeDasharray="4 3" />
        <line x1={x + width - 8} y1={y + height - 6} x2={centerX} y2={y + 6} stroke={stroke} strokeWidth={1.1} strokeDasharray="4 3" />
      </g>
    );
    if (fieldType === "topHung") return tiltLines;
    if (fieldType === "tiltAndTurn" || fieldType === "tiltAndTurnLeft" || fieldType === "tiltAndTurnRight" || fieldType === "turnTiltLeft" || fieldType === "turnTiltRight") {
      return (
        <g>
          {turnLines}
          {tiltLines}
        </g>
      );
    }
    if (fieldType === "reversible") {
      return (
        <g>
          <line x1={centerX} y1={y + 6} x2={x + 8} y2={centerY} stroke={stroke} strokeWidth={1.1} strokeDasharray="4 3" />
          <line x1={centerX} y1={y + 6} x2={x + width - 8} y2={centerY} stroke={stroke} strokeWidth={1.1} strokeDasharray="4 3" />
        </g>
      );
    }
    return turnLines;
  }

  return (
    <svg viewBox={`0 0 ${boxWidth} ${boxHeight}`} width="100%" height="68" style={{ display: "block" }}>
      <rect x={padding} y={padding} width={boxWidth - padding * 2} height={boxHeight - padding * 2} rx={6} fill="#fff" stroke="#18181b" strokeWidth={1.2} />
      {pattern.fieldTypes.map((fieldType, index) => {
        const row = Math.floor(index / pattern.columns);
        const col = index % pattern.columns;
        const x = padding + col * cellWidth;
        const y = padding + row * cellHeight;
        return (
          <g key={`${pattern.id}-${fieldType}-${index}`}>
            <rect x={x} y={y} width={cellWidth} height={cellHeight} fill="#eef2ff" stroke="#cbd5e1" strokeWidth={0.8} />
            {renderFieldGlyph(fieldType, x, y, cellWidth, cellHeight)}
          </g>
        );
      })}
      {pattern.columns > 1 && pattern.junctionType === "static" && (
        <rect
          x={padding + cellWidth - 3}
          y={padding}
          width={6}
          height={boxHeight - padding * 2}
          fill="#e5e7eb"
          stroke="#18181b"
          strokeWidth={0.8}
        />
      )}
      {pattern.columns > 1 && pattern.junctionType === "flying" && (
        <line
          x1={padding + cellWidth}
          y1={padding + 2}
          x2={padding + cellWidth}
          y2={boxHeight - padding - 2}
          stroke="#18181b"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      {pattern.rows > 1 && (
        <rect
          x={padding}
          y={padding + cellHeight - 3}
          width={boxWidth - padding * 2}
          height={6}
          fill="#e5e7eb"
          stroke="#18181b"
          strokeWidth={0.8}
        />
      )}
    </svg>
  );
}

function describeJunction(junction: WindowJunctionDefinition) {
  if (junction.axis === "vertical") {
    return `Between column ${junction.startCol + 1} and ${junction.endCol + 1}`;
  }
  return `Between row ${junction.startRow + 1} and ${junction.endRow + 1}`;
}

function deriveConfiguratorRenderOperationType(
  layout: { rows: number; columns: number; freehand?: { enabled?: boolean } | undefined },
  fields: WindowFieldDefinition[] | undefined
) {
  if (layout.freehand?.enabled) return null;
  if (layout.rows !== 1 || layout.columns !== 1) return null;
  const field = (fields ?? [])[0];
  switch (field?.type) {
    case "fixed":
      return "fixed";
    case "tiltAndTurn":
    case "tiltAndTurnLeft":
    case "tiltAndTurnRight":
    case "turnTiltLeft":
    case "turnTiltRight":
      return "tilt_turn";
    case "topHung":
      return "top_hung";
    case "sideHung":
      return "side_hung";
    case "reversible":
      return "reversible";
    default:
      return null;
  }
}

function renderJunctionRow(
  junction: WindowJunctionDefinition,
  flyingAllowed: boolean,
  onChange: (junctionKey: string, nextType: WindowMullionType) => void
) {
  const isVertical = junction.axis === "vertical";
  return (
    <div
      key={junction.key}
      style={{
        borderRadius: 12,
        border: "1px solid #e4e4e7",
        background: "#fafafa",
        padding: 12,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#18181b" }}>
        {isVertical ? "Vertical mullion" : "Horizontal transom"} {junction.index}
      </div>
      <Small>{describeJunction(junction)}</Small>
      <select
        value={junction.type}
        onChange={(event) => onChange(junction.key, event.currentTarget.value as WindowMullionType)}
        style={inputStyle}
      >
        <option value="static">{isVertical ? "Fixed mullion" : "Fixed transom"}</option>
        {isVertical && (
          <option value="flying" disabled={!flyingAllowed}>
            Flying mullion
          </option>
        )}
      </select>
      {isVertical && !flyingAllowed && (
        <Small>Flying mullion is only valid here when one field is Turn and the other is Tilt & Turn.</Small>
      )}
    </div>
  );
}

export default function ConfiguratorWorkspace(props: Props) {
  const { estimate, position, onBack, onSavePosition, embeddedInWorkflowShell = false, onExitWorkflow } = props;
  const { draft, setDraft, saveDraft, workflowMode } = useEstimateWorkflow();

  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsMap, setSettingsMap] = useState<SettingsMap | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [glassPresetOptions, setGlassPresetOptions] = useState<GlassPresetOption[]>(WINDOW_GLASS_PRESETS);
  const [catalogBootstrap, setCatalogBootstrap] =
    useState<ConfiguratorCatalogBootstrap>(EMPTY_CATALOG_BOOTSTRAP);
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [manualColumnsInput, setManualColumnsInput] = useState("");
  const [manualRowsInput, setManualRowsInput] = useState("");
  const [patternModalQuantityId, setPatternModalQuantityId] = useState<PatternQuantityId | null>(null);

  const defaultDimensions = useMemo(() => getDefaultDimensions(settingsMap), [settingsMap]);
  const configuratorEnabled = useMemo(() => getBooleanSetting(settingsMap, "feature.configurator.enabled", true), [settingsMap]);
  const showDimensions = useMemo(() => getBooleanSetting(settingsMap, "configurator.showDimensions", true), [settingsMap]);

  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const rows = await getAllSettings();
        if (!isMounted) return;
        setSettingsMap(buildSettingsMap(rows));
      } catch (error) {
        console.error("Failed to load configurator settings", error);
        if (!isMounted) return;
        setSettingsMap({});
      } finally {
        if (isMounted) setSettingsLoaded(true);
      }
    }
    void loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadCatalogBootstrap() {
      try {
        const bootstrap = await getConfiguratorCatalogBootstrap();
        if (!isMounted) return;
        setCatalogBootstrap(bootstrap);
        if (Array.isArray(bootstrap.glass) && bootstrap.glass.length > 0) {
          setGlassPresetOptions(
            bootstrap.glass.map((row) => ({
              id: String(row.id || row.code || ""),
              label: String(row.name || row.code || "Glass preset"),
              spec: String(row.specification || row.name || ""),
            }))
          );
        }
      } catch {
        // Keep built-in presets when admin catalog is unavailable.
      }
    }
    void loadCatalogBootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  const workflowPosition = useMemo(() => buildPositionFromWorkflowDraft(position, draft), [draft, position]);
  const configuration = useMemo(() => normalizeConfigurationState(draft.configuration, workflowPosition), [draft.configuration, workflowPosition]);
  const layout = useMemo(() => normalizeLayoutDefinition(configuration.layout, workflowPosition), [configuration.layout, workflowPosition]);
  const defaultsSnapshot = draft.estimateDefaults.defaultsSnapshot ?? {};
  const selectedManufacturerId = String(
    draft.estimateDefaults.manufacturerId ?? defaultsSnapshot.manufacturerId ?? ""
  ).trim();
  const selectedProductId = String(draft.estimateDefaults.productId ?? defaultsSnapshot.productId ?? "").trim();
  const selectedWindowTypeId = String(
    draft.estimateDefaults.windowTypeId ?? defaultsSnapshot.windowTypeId ?? ""
  ).trim();
  const exactRenderOperationType = useMemo(
    () => deriveConfiguratorRenderOperationType(layout, configuration.fields),
    [configuration.fields, layout]
  );
  const exactRenderContextKey = useMemo(() => {
    if (!exactRenderOperationType) return null;
    const fieldCount = layout.rows * layout.columns;
    if (fieldCount < 1 || fieldCount > 6) return null;
    const windowTab = `${fieldCount}field`;
    const viewCode = configuration.orientationView === "outside" ? "EV" : "IV";
    return buildRenderDefinitionContextKey("windows", windowTab, exactRenderOperationType, viewCode);
  }, [configuration.orientationView, exactRenderOperationType, layout.columns, layout.rows]);
  const exactRenderProfile = useMemo(() => {
    if (!exactRenderContextKey || !exactRenderOperationType) return null;
    return findExactRenderProfileForContext({
      renderProfiles: catalogBootstrap.renderProfiles,
      contextKey: exactRenderContextKey,
      operationType: exactRenderOperationType,
      view: configuration.orientationView === "outside" ? "outside" : "inside",
      manufacturerId: selectedManufacturerId || null,
      productId: selectedProductId || null,
      windowTypeId: selectedWindowTypeId || null,
    });
  }, [
    catalogBootstrap.renderProfiles,
    configuration.orientationView,
    exactRenderContextKey,
    exactRenderOperationType,
    selectedManufacturerId,
    selectedProductId,
    selectedWindowTypeId,
  ]);
  const resolvedProfiles = useMemo(
    () =>
      resolveSectionProfileSet({
        bootstrap: catalogBootstrap,
        productName: workflowPosition.product,
        productTypeName: workflowPosition.productType,
        view: configuration.orientationView ?? "inside",
        fields: configuration.fields,
        exactRenderProfile,
      }),
    [
      catalogBootstrap,
      configuration.fields,
      configuration.orientationView,
      exactRenderProfile,
      workflowPosition.product,
      workflowPosition.productType,
    ]
  );
  const filteredColourOptions = useMemo(() => {
    const colours = catalogBootstrap.colours.filter((colour) => {
      if (selectedProductId && colour.product_id && String(colour.product_id) !== selectedProductId) return false;
      if (selectedManufacturerId && colour.manufacturer_id && String(colour.manufacturer_id) !== selectedManufacturerId) return false;
      return colour.is_active !== false;
    });
    return colours.length > 0 ? colours.map((colour) => colour.name) : WINDOW_FRAME_COLOUR_OPTIONS;
  }, [catalogBootstrap.colours, selectedManufacturerId, selectedProductId]);
  const filteredGlassOptions = useMemo(() => {
    const glass = catalogBootstrap.glass.filter((row) => {
      if (selectedProductId && row.product_id && String(row.product_id) !== selectedProductId) return false;
      if (selectedManufacturerId && row.manufacturer_id && String(row.manufacturer_id) !== selectedManufacturerId) return false;
      return row.is_active !== false;
    });
    return glass.length > 0
      ? glass.map((row) => ({
          id: String(row.id || row.code || ""),
          label: String(row.name || row.code || "Glass preset"),
          spec: String(row.specification || row.name || ""),
        }))
      : glassPresetOptions;
  }, [catalogBootstrap.glass, glassPresetOptions, selectedManufacturerId, selectedProductId]);
  const filteredHardwareOptions = useMemo(() => {
    return catalogBootstrap.hardware.filter((row) => {
      if (selectedProductId && row.product_id && String(row.product_id) !== selectedProductId) return false;
      if (selectedManufacturerId && row.manufacturer_id && String(row.manufacturer_id) !== selectedManufacturerId) return false;
      if (selectedWindowTypeId && row.window_type_id && String(row.window_type_id) !== selectedWindowTypeId) return false;
      return row.is_active !== false;
    });
  }, [catalogBootstrap.hardware, selectedManufacturerId, selectedProductId, selectedWindowTypeId]);
  const handleOptions = useMemo(() => {
    const options = filteredHardwareOptions
      .filter((item) => String(item.hardware_type || "").toLowerCase().includes("handle"))
      .map((item) => item.name);
    return options.length > 0 ? options : WINDOW_HANDLE_OPTIONS;
  }, [filteredHardwareOptions]);
  const hingeOptions = useMemo(() => {
    const options = filteredHardwareOptions
      .filter((item) => String(item.hardware_type || "").toLowerCase().includes("hinge"))
      .map((item) => item.name);
    return options.length > 0 ? options : WINDOW_HINGE_OPTIONS;
  }, [filteredHardwareOptions]);
  const fieldsX = layout.columns;
  const fieldsY = layout.rows;

  useEffect(() => {
    setSelectedCell((previous) => clampSelectedCell(previous, fieldsX, fieldsY));
  }, [fieldsX, fieldsY]);

  useEffect(() => {
    setWidthInput(toEditableString(workflowPosition.widthMm ?? defaultDimensions.width));
    setHeightInput(toEditableString(workflowPosition.heightMm ?? defaultDimensions.height));
  }, [workflowPosition.widthMm, workflowPosition.heightMm, defaultDimensions.width, defaultDimensions.height]);

  useEffect(() => {
    setManualColumnsInput(formatSplitList(configuration.manualVerticalSplitsMm));
    setManualRowsInput(formatSplitList(configuration.manualHorizontalSplitsMm));
  }, [configuration.manualVerticalSplitsMm, configuration.manualHorizontalSplitsMm]);

  const selectedFieldKey = selectedCell ? buildFieldKey(selectedCell.col, selectedCell.row) : "";
  const selectedField = selectedCell
    ? configuration.fields?.find((field) => field.key === selectedFieldKey) ?? null
    : null;

  function updateWorkflowDraftPosition(updatedPositionOrUpdater: any) {
    setDraft((previousDraft) => {
      if (!previousDraft) return previousDraft;
      const currentPosition = buildPositionFromWorkflowDraft(position, previousDraft);
      const nextPosition = typeof updatedPositionOrUpdater === "function" ? updatedPositionOrUpdater(currentPosition) : updatedPositionOrUpdater;
      return applyPositionToWorkflowDraft(previousDraft, nextPosition);
    });
  }

  function updateConfiguration(mutator: (current: ReturnType<typeof normalizeConfigurationState>) => ReturnType<typeof normalizeConfigurationState>) {
    setDraft((previousDraft) => {
      if (!previousDraft) return previousDraft;
      const nextConfiguration = mutator(normalizeConfigurationState(previousDraft.configuration, workflowPosition));
      return {
        ...previousDraft,
        configuration: normalizeConfigurationState(nextConfiguration, {
          ...workflowPosition,
          windowConfiguration: nextConfiguration,
        }),
        isDirty: true,
      };
    });
  }

  function updateCurrentJunction(junctionKey: string, nextType: WindowMullionType) {
    updateConfiguration((current) => ({
      ...current,
      junctions: (current.junctions ?? []).map((junction) =>
        junction.key === junctionKey
          ? {
              ...junction,
              type:
                nextType === "flying" &&
                !isFlyingMullionAllowedForJunction(current.layout ?? layout, current.fields ?? [], junction)
                  ? "static"
                  : nextType,
            }
          : junction
      ),
    }));
  }

  function commitWidth() {
    const fallback = Math.max(300, Number(workflowPosition.widthMm || defaultDimensions.width));
    const committed = clampCommittedDimension(widthInput, fallback);
    setWidthInput(String(committed));
    setDraft((previousDraft) =>
      previousDraft
        ? { ...previousDraft, dimensions: { ...previousDraft.dimensions, widthMm: committed }, isDirty: true }
        : previousDraft
    );
  }

  function commitHeight() {
    const fallback = Math.max(300, Number(workflowPosition.heightMm || defaultDimensions.height));
    const committed = clampCommittedDimension(heightInput, fallback);
    setHeightInput(String(committed));
    setDraft((previousDraft) =>
      previousDraft
        ? { ...previousDraft, dimensions: { ...previousDraft.dimensions, heightMm: committed }, isDirty: true }
        : previousDraft
    );
  }

  function applyManualSplits(axis: "vertical" | "horizontal") {
    const expectedCount = axis === "vertical" ? layout.columns : layout.rows;
    if (expectedCount <= 1) return;
    const raw = axis === "vertical" ? manualColumnsInput : manualRowsInput;
    const parsed = parseSplitList(raw, expectedCount);
    if (!parsed) {
      if (axis === "vertical") setManualColumnsInput(formatSplitList(configuration.manualVerticalSplitsMm));
      if (axis === "horizontal") setManualRowsInput(formatSplitList(configuration.manualHorizontalSplitsMm));
      return;
    }
    updateConfiguration((current) => ({
      ...current,
      splitMode: "manual",
      manualVerticalSplitsMm: axis === "vertical" ? parsed : current.manualVerticalSplitsMm,
      manualHorizontalSplitsMm: axis === "horizontal" ? parsed : current.manualHorizontalSplitsMm,
    }));
  }

  async function handleSave() {
    const committedWidth = clampCommittedDimension(widthInput, Math.max(300, Number(workflowPosition.widthMm || defaultDimensions.width)));
    const committedHeight = clampCommittedDimension(heightInput, Math.max(300, Number(workflowPosition.heightMm || defaultDimensions.height)));
    let positionToSave = workflowPosition;
    if (committedWidth !== workflowPosition.widthMm || committedHeight !== workflowPosition.heightMm) {
      const nextPosition = { ...workflowPosition, widthMm: committedWidth, heightMm: committedHeight };
      updateWorkflowDraftPosition(nextPosition);
      positionToSave = nextPosition;
    }
    setIsSaving(true);
    try {
      await onSavePosition(positionToSave);
      setDraft((previousDraft) => (previousDraft ? applyPositionToWorkflowDraft(previousDraft, positionToSave) : previousDraft));
      if (embeddedInWorkflowShell && workflowMode === "edit") {
        onExitWorkflow?.();
      }
    } finally {
      setIsSaving(false);
    }
  }

  function renderLayoutSection() {
    const horizontalPresets = WINDOW_LAYOUT_PRESETS.filter((preset) => preset.rows === 1).slice(0, 6);
    const verticalPresets = WINDOW_LAYOUT_PRESETS.filter((preset) => preset.columns === 1).slice(0, 6);
    const gridPresets = WINDOW_LAYOUT_PRESETS.filter((preset) => preset.rows > 1 && preset.columns > 1);
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Small>Horizontal series</Small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {horizontalPresets.map((preset) => {
              const active = layout.presetKey === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  style={active ? activeSectionButtonStyle : sectionButtonStyle}
                  onClick={() =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        rows: preset.rows,
                        columns: preset.columns,
                        capacity: preset.rows * preset.columns,
                        compositionMode: deriveCompositionMode(preset.rows, preset.columns),
                        presetKey: preset.id,
                      }),
                    }))
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Vertical series</Small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {verticalPresets.map((preset) => {
              const active = layout.presetKey === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  style={active ? activeSectionButtonStyle : sectionButtonStyle}
                  onClick={() =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        rows: preset.rows,
                        columns: preset.columns,
                        capacity: preset.rows * preset.columns,
                        compositionMode: deriveCompositionMode(preset.rows, preset.columns),
                        presetKey: preset.id,
                      }),
                    }))
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Grid series</Small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {gridPresets.map((preset) => {
              const active = layout.presetKey === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  style={active ? activeSectionButtonStyle : sectionButtonStyle}
                  onClick={() =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        rows: preset.rows,
                        columns: preset.columns,
                        capacity: preset.rows * preset.columns,
                        compositionMode: deriveCompositionMode(preset.rows, preset.columns),
                        presetKey: preset.id,
                      }),
                    }))
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Rows</Small>
            <input
              type="number"
              min={1}
              max={12}
              value={String(layout.rows)}
              onChange={(event) => {
                const rows = Math.max(1, Math.min(12, Number(event.currentTarget.value || 1)));
                updateConfiguration((current) => ({
                  ...current,
                  layout: normalizeLayoutDefinition({
                    rows,
                    columns: current.layout?.columns ?? layout.columns,
                    capacity: rows * (current.layout?.columns ?? layout.columns),
                    compositionMode: deriveCompositionMode(rows, current.layout?.columns ?? layout.columns),
                    presetKey: null,
                  }),
                }));
              }}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Columns</Small>
            <input
              type="number"
              min={1}
              max={12}
              value={String(layout.columns)}
              onChange={(event) => {
                const columns = Math.max(1, Math.min(12, Number(event.currentTarget.value || 1)));
                updateConfiguration((current) => ({
                  ...current,
                  layout: normalizeLayoutDefinition({
                    rows: current.layout?.rows ?? layout.rows,
                    columns,
                    capacity: (current.layout?.rows ?? layout.rows) * columns,
                    compositionMode: deriveCompositionMode(current.layout?.rows ?? layout.rows, columns),
                    presetKey: null,
                  }),
                }));
              }}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>{getLayoutLabel(layout)}</div>
          <Small>Capacity {layout.capacity} fields • Composition {layout.compositionMode}</Small>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <Small>Advanced composition</Small>
          <button
            type="button"
            style={layout.freehand?.enabled ? activeSectionButtonStyle : sectionButtonStyle}
            onClick={() =>
              updateConfiguration((current) => ({
                ...current,
                layout: normalizeLayoutDefinition({
                  ...(current.layout ?? layout),
                  presetKey: "freehand",
                  freehand: {
                    enabled: true,
                    isGridBased: current.layout?.freehand?.isGridBased ?? true,
                    allowEmptyFields: current.layout?.freehand?.allowEmptyFields ?? true,
                    cutEmptyFields: current.layout?.freehand?.cutEmptyFields ?? false,
                    glassCorner: current.layout?.freehand?.glassCorner ?? false,
                  },
                }),
              }))
            }
          >
            Freehand
          </button>
          {layout.freehand?.enabled && (
            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                <input
                  type="checkbox"
                  checked={!!layout.freehand?.isGridBased}
                  onChange={(event) =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        ...(current.layout ?? layout),
                        freehand: {
                          ...(current.layout?.freehand ?? layout.freehand ?? {}),
                          enabled: true,
                          isGridBased: event.currentTarget.checked,
                        },
                      }),
                    }))
                  }
                />
                <span>Treat this as a grid-based composition</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                <input
                  type="checkbox"
                  checked={!!layout.freehand?.allowEmptyFields}
                  onChange={(event) =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        ...(current.layout ?? layout),
                        freehand: {
                          ...(current.layout?.freehand ?? layout.freehand ?? {}),
                          enabled: true,
                          allowEmptyFields: event.currentTarget.checked,
                        },
                      }),
                    }))
                  }
                />
                <span>Allow intentionally empty fields</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                <input
                  type="checkbox"
                  checked={!!layout.freehand?.cutEmptyFields}
                  onChange={(event) =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        ...(current.layout ?? layout),
                        freehand: {
                          ...(current.layout?.freehand ?? layout.freehand ?? {}),
                          enabled: true,
                          cutEmptyFields: event.currentTarget.checked,
                        },
                      }),
                    }))
                  }
                />
                <span>Cut empty fields from the final composition</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                <input
                  type="checkbox"
                  checked={!!layout.freehand?.glassCorner}
                  onChange={(event) =>
                    updateConfiguration((current) => ({
                      ...current,
                      layout: normalizeLayoutDefinition({
                        ...(current.layout ?? layout),
                        freehand: {
                          ...(current.layout?.freehand ?? layout.freehand ?? {}),
                          enabled: true,
                          glassCorner: event.currentTarget.checked,
                        },
                      }),
                    }))
                  }
                />
                <span>Prepare glass corner handling for coupled fields</span>
              </label>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Orientation hook</Small>
          <select
            value={configuration.orientationView ?? "inside"}
            onChange={(event) => {
              const nextOrientationView = event.currentTarget.value as "inside" | "outside";
              updateConfiguration((current) => ({
                ...current,
                orientationView: nextOrientationView,
              }));
            }}
            style={inputStyle}
          >
            <option value="inside">Inside view</option>
            <option value="outside">Outside view</option>
          </select>
        </div>
      </div>
    );
  }

  function renderFieldsSection() {
    const activeQuantityId = getPatternQuantityId(layout.rows, layout.columns);
    const activeFieldCount = layout.rows * layout.columns;
    const visiblePatterns = getPatternsForQuantity(activeQuantityId).filter(
      (pattern) => pattern.fieldTypes.length === activeFieldCount
    );
    const modalPatterns =
      patternModalQuantityId === null
        ? []
        : getPatternsForQuantity(patternModalQuantityId);
    const activePatternId =
      visiblePatterns.find((pattern) => {
        if (pattern.rows !== layout.rows || pattern.columns !== layout.columns) return false;
        const currentTypes = (configuration.fields ?? []).map((field) => field.type);
        if (currentTypes.length !== pattern.fieldTypes.length) return false;
        if (!currentTypes.every((type, index) => type === pattern.fieldTypes[index])) return false;
        const activeJunctionType = (configuration.junctions ?? []).find((junction) => junction.axis === "vertical")?.type ?? "static";
        return (pattern.junctionType ?? "static") === activeJunctionType;
      })?.id ?? null;

    function applyPattern(pattern: FieldPatternCardDefinition) {
      updateConfiguration((current) => ({
        ...current,
        layout: normalizeLayoutDefinition({
          rows: pattern.rows,
          columns: pattern.columns,
          capacity: pattern.rows * pattern.columns,
          compositionMode: deriveCompositionMode(pattern.rows, pattern.columns),
          presetKey: `${pattern.rows}x${pattern.columns}`,
        }),
        fields: pattern.fieldTypes.map((fieldType, index) => ({
          key: buildFieldKey(index % pattern.columns, Math.floor(index / pattern.columns)),
          col: index % pattern.columns,
          row: Math.floor(index / pattern.columns),
          type: fieldType,
          handleType: current.fields?.[index]?.handleType ?? null,
          handleHeightMm: current.fields?.[index]?.handleHeightMm ?? null,
          hingeType: current.fields?.[index]?.hingeType ?? null,
        })),
        junctions: buildPatternJunctions(pattern.rows, pattern.columns, pattern.junctionType),
      }));
      setSelectedCell({ col: 0, row: 0 });
      setPatternModalQuantityId(null);
    }

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Small>Field quantity</Small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {FIELD_PATTERN_QUANTITIES.map((quantity) => {
              const active = quantity.id === activeQuantityId;
              return (
                <button
                  key={quantity.id}
                  type="button"
                  style={active ? activeSectionButtonStyle : sectionButtonStyle}
                  onClick={() => setPatternModalQuantityId(quantity.id)}
                >
                  {quantity.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Arrangement</Small>
          <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                  {FIELD_PATTERN_QUANTITIES.find((quantity) => quantity.id === activeQuantityId)?.label ?? "Pattern"}
                </div>
                <Small>
                  {visiblePatterns.find((pattern) => pattern.id === activePatternId)?.label ??
                    "Choose a valid predefined arrangement for this field quantity."}
                </Small>
              </div>
              <Button variant="secondary" onClick={() => setPatternModalQuantityId(activeQuantityId)}>
                Choose arrangement
              </Button>
            </div>
            {visiblePatterns.find((pattern) => pattern.id === activePatternId) && (
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 10, display: "grid", gap: 8 }}>
                {renderPatternPreview(visiblePatterns.find((pattern) => pattern.id === activePatternId)!)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Selected field</Small>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 10, fontSize: 13, fontWeight: 800, color: "#18181b" }}>
            {fieldLabel(selectedField)}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <Small>Fine tune fields</Small>
          {(configuration.fields ?? []).map((field) => (
            <div
              key={field.key}
              style={{
                borderRadius: 12,
                border: field.key === selectedFieldKey ? "1px solid #18181b" : "1px solid #e4e4e7",
                background: field.key === selectedFieldKey ? "#fafafa" : "#fff",
                padding: 12,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#18181b" }}>
                  Field {field.col + 1},{field.row + 1}
                </div>
                <Button variant="secondary" onClick={() => setSelectedCell({ col: field.col, row: field.row })}>
                  Select in editor
                </Button>
              </div>
              <select
                value={field.type}
                onChange={(event) => {
                  const nextFieldType = event.currentTarget.value as WindowFieldType;
                  updateConfiguration((current) => ({
                    ...current,
                    fields: (current.fields ?? []).map((entry) =>
                      entry.key === field.key ? { ...entry, type: nextFieldType } : entry
                    ),
                  }));
                }}
                style={inputStyle}
              >
                {WINDOW_FIELD_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Small>{fieldTypeShortLabel(field.type)}</Small>
            </div>
          ))}
        </div>

        {patternModalQuantityId && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(24,24,27,0.38)",
              display: "grid",
              placeItems: "center",
              padding: 24,
              zIndex: 1000,
            }}
            onClick={() => setPatternModalQuantityId(null)}
          >
            <div
              style={{
                width: "min(920px, 100%)",
                maxHeight: "min(80vh, 760px)",
                overflow: "auto",
                borderRadius: 18,
                border: "1px solid #e4e4e7",
                background: "#fff",
                padding: 18,
                display: "grid",
                gap: 14,
                boxShadow: "0 25px 80px rgba(24,24,27,0.16)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#18181b" }}>
                    {FIELD_PATTERN_QUANTITIES.find((quantity) => quantity.id === patternModalQuantityId)?.label}
                  </div>
                  <Small>
                    Pick a valid predefined arrangement first, then fine-tune individual fields if needed.
                  </Small>
                </div>
                <Button variant="secondary" onClick={() => setPatternModalQuantityId(null)}>
                  Close
                </Button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                {modalPatterns.map((pattern) => {
                  const active = activePatternId === pattern.id;
                  return (
                    <button
                      key={pattern.id}
                      type="button"
                      style={{
                        borderRadius: 14,
                        border: active ? "1px solid #18181b" : "1px solid #e4e4e7",
                        background: active ? "#f8fafc" : "#fff",
                        padding: 12,
                        display: "grid",
                        gap: 8,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                      onClick={() => applyPattern(pattern)}
                    >
                      {renderPatternPreview(pattern)}
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>{pattern.label}</div>
                        <Small>{pattern.helperText}</Small>
                        <Small>
                          {pattern.familyId === "doubleVertical"
                            ? "Stacked arrangement"
                            : pattern.familyId === "doubleHorizontal"
                              ? "Side-by-side arrangement"
                              : "Single field arrangement"}
                        </Small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMullionsAndSplitsSection() {
    const systemOptions = configuration.systemOptions ?? {};
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 10 }}>
          <Small>System-level overrides</Small>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#18181b" }}>
            <input
              type="checkbox"
              checked={!!systemOptions.frameExtensionsEnabled}
              onChange={(event) =>
                updateConfiguration((current) => ({
                  ...current,
                  systemOptions: {
                    ...(current.systemOptions ?? {}),
                    frameExtensionsEnabled: event.currentTarget.checked,
                  },
                }))
              }
            />
            <span>Frame extensions enabled</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#18181b" }}>
            <input
              type="checkbox"
              checked={!!systemOptions.widerFrameEnabled}
              onChange={(event) =>
                updateConfiguration((current) => ({
                  ...current,
                  systemOptions: {
                    ...(current.systemOptions ?? {}),
                    widerFrameEnabled: event.currentTarget.checked,
                  },
                }))
              }
            />
            <span>Wider frame / wider section override</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <Small>Rebate override</Small>
              <select
                value={systemOptions.rebateMode ?? "none"}
                onChange={(event) =>
                  updateConfiguration((current) => ({
                    ...current,
                    systemOptions: {
                      ...(current.systemOptions ?? {}),
                      rebateMode: event.currentTarget.value as "none" | "internal" | "external" | "both",
                    },
                  }))
                }
                style={inputStyle}
              >
                <option value="none">Standard rebate</option>
                <option value="internal">Internal only</option>
                <option value="external">External only</option>
                <option value="both">Both sides</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <Small>Centre mullion width override (mm)</Small>
              <input
                type="number"
                step={5}
                value={String(systemOptions.customMullionWidthMm ?? "")}
                onChange={(event) =>
                  updateConfiguration((current) => ({
                    ...current,
                    systemOptions: {
                      ...(current.systemOptions ?? {}),
                      customMullionWidthMm: Number(event.currentTarget.value || 0) || null,
                    },
                  }))
                }
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Division basis</Small>
          <select
            value={configuration.divisionBasis ?? "frame"}
            onChange={(event) => {
              const nextDivisionBasis = event.currentTarget.value as "frame" | "glass";
              updateConfiguration((current) => ({
                ...current,
                divisionBasis: nextDivisionBasis,
              }));
            }}
            style={inputStyle}
          >
            <option value="frame">Frame division</option>
            <option value="glass">Glass division</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Split mode</Small>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={configuration.splitMode === "equal" ? activeSectionButtonStyle : sectionButtonStyle}
              onClick={() => updateConfiguration((current) => ({ ...current, splitMode: "equal" }))}
            >
              Equal split
            </button>
            <button
              type="button"
              style={configuration.splitMode === "manual" ? activeSectionButtonStyle : sectionButtonStyle}
              onClick={() => updateConfiguration((current) => ({ ...current, splitMode: "manual" }))}
            >
              Manual split
            </button>
          </div>
        </div>

        {(configuration.junctions ?? []).length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {(configuration.junctions ?? []).map((junction) =>
              renderJunctionRow(
                junction,
                isFlyingMullionAllowedForJunction(configuration.layout ?? layout, configuration.fields ?? [], junction),
                updateCurrentJunction
              )
            )}
          </div>
        )}

        {configuration.splitMode === "manual" && fieldsX > 1 && (
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Manual column splits (mm)</Small>
            <input
              value={manualColumnsInput}
              onChange={(event) => setManualColumnsInput(event.currentTarget.value)}
              onBlur={() => applyManualSplits("vertical")}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyManualSplits("vertical");
              }}
              style={inputStyle}
            />
          </div>
        )}

        {configuration.splitMode === "manual" && fieldsY > 1 && (
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Manual row splits (mm)</Small>
            <input
              value={manualRowsInput}
              onChange={(event) => setManualRowsInput(event.currentTarget.value)}
              onBlur={() => applyManualSplits("horizontal")}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyManualSplits("horizontal");
              }}
              style={inputStyle}
            />
          </div>
        )}

      </div>
    );
  }

  function renderFrameAndRebateSection() {
    const frame = configuration.frame ?? {};
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Small>Finish mode</Small>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={frame.finishMode !== "dual" ? activeSectionButtonStyle : sectionButtonStyle}
              onClick={() =>
                updateConfiguration((current) => ({
                  ...current,
                  frame: {
                    ...(current.frame ?? {}),
                    finishMode: "single",
                    externalColour: current.frame?.internalColour ?? frame.internalColour ?? WINDOW_FRAME_COLOUR_OPTIONS[0],
                  },
                }))
              }
            >
              Single colour
            </button>
            <button
              type="button"
              style={frame.finishMode === "dual" ? activeSectionButtonStyle : sectionButtonStyle}
              onClick={() =>
                updateConfiguration((current) => ({
                  ...current,
                  frame: {
                    ...(current.frame ?? {}),
                    finishMode: "dual",
                    externalColour: current.frame?.externalColour ?? current.frame?.internalColour ?? frame.externalColour ?? frame.internalColour ?? WINDOW_FRAME_COLOUR_OPTIONS[0],
                  },
                }))
              }
            >
              Dual colour
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Internal colour</Small>
            <select
              value={frame.internalColour ?? WINDOW_FRAME_COLOUR_OPTIONS[0]}
              onChange={(event) => {
                const nextInternalColour = event.currentTarget.value;
                updateConfiguration((current) => ({
                  ...current,
                  frame: {
                    ...(current.frame ?? {}),
                    internalColour: nextInternalColour,
                    externalColour:
                      current.frame?.finishMode === "dual"
                        ? current.frame?.externalColour ?? nextInternalColour
                        : nextInternalColour,
                  },
                }));
              }}
              style={inputStyle}
            >
              {filteredColourOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>External colour</Small>
            <select
              value={(frame.finishMode === "dual" ? frame.externalColour : frame.internalColour) ?? WINDOW_FRAME_COLOUR_OPTIONS[0]}
              disabled={frame.finishMode !== "dual"}
              onChange={(event) => {
                const nextExternalColour = event.currentTarget.value;
                updateConfiguration((current) => ({
                  ...current,
                  frame: {
                    ...(current.frame ?? {}),
                    externalColour: nextExternalColour,
                  },
                }));
              }}
              style={{
                ...inputStyle,
                background: frame.finishMode === "dual" ? "#fff" : "#fafafa",
                color: frame.finishMode === "dual" ? "#18181b" : "#a1a1aa",
              }}
            >
              {filteredColourOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 10, display: "grid", gap: 4 }}>
            <Small>Internal finish preview</Small>
            <div style={{ height: 28, borderRadius: 8, border: "1px solid #d4d4d8", background: resolveColourSwatch(frame.internalColour ?? WINDOW_FRAME_COLOUR_OPTIONS[0]) }} />
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 10, display: "grid", gap: 4 }}>
            <Small>External finish preview</Small>
            <div style={{ height: 28, borderRadius: 8, border: "1px solid #d4d4d8", background: resolveColourSwatch((frame.finishMode === "dual" ? frame.externalColour : frame.internalColour) ?? WINDOW_FRAME_COLOUR_OPTIONS[0]) }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {[
            { key: "leftMm", label: "Left frame dimension" },
            { key: "rightMm", label: "Right frame dimension" },
            { key: "topMm", label: "Top frame dimension" },
            { key: "bottomMm", label: "Bottom frame dimension" },
          ].map((item) => (
            <div key={item.key} style={{ display: "grid", gap: 6 }}>
              <Small>{item.label} (mm)</Small>
              <input
                type="number"
                step={25}
                value={String((frame as any)[item.key] ?? 0)}
                onChange={(event) => {
                  const nextValue = Number(event.currentTarget.value || 0);
                  updateConfiguration((current) => ({
                    ...current,
                    frame: {
                      ...(current.frame ?? {}),
                      [item.key]: nextValue,
                    },
                  }));
                }}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Bottom frame rebate</Small>
          <select
            value={frame.bottomRebate ?? ""}
            onChange={(event) => {
              const nextBottomRebate = (event.currentTarget.value || null) as "inside" | "outside" | null;
              updateConfiguration((current) => ({
                ...current,
                frame: {
                  ...(current.frame ?? {}),
                  bottomRebate: nextBottomRebate,
                },
              }));
            }}
            style={inputStyle}
          >
            <option value="">None</option>
            <option value="inside">Inside</option>
            <option value="outside">Outside</option>
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: "#18181b" }}>
          <input
            type="checkbox"
            checked={!!frame.bottomRebateDashed}
            onChange={(event) => {
              const nextChecked = event.currentTarget.checked;
              updateConfiguration((current) => ({
                ...current,
                frame: {
                  ...(current.frame ?? {}),
                  bottomRebateDashed: nextChecked,
                },
              }));
            }}
          />
          <span>Reserve dashed-line rebate hook for later rendering correction.</span>
        </label>
      </div>
    );
  }

  function renderGlassSection() {
    const glass = configuration.glass ?? {};
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Small>Glass preset</Small>
          <select
            value={glass.presetId ?? glassPresetOptions[0]?.id ?? WINDOW_GLASS_PRESETS[0].id}
            onChange={(event) => {
              const nextPresetId = event.currentTarget.value;
              const preset =
                filteredGlassOptions.find((option) => option.id === nextPresetId) ??
                filteredGlassOptions[0] ??
                WINDOW_GLASS_PRESETS[0];
              updateConfiguration((current) => ({
                ...current,
                glass: {
                  presetId: preset.id,
                  presetLabel: preset.label,
                  presetSpec: preset.spec,
                },
              }));
            }}
            style={inputStyle}
          >
            {filteredGlassOptions.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, fontSize: 13, color: "#18181b" }}>
          {glass.presetSpec}
        </div>
      </div>
    );
  }

  function renderBarsSection() {
    const bars = configuration.bars ?? {};
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Horizontal bars</Small>
            <input
              type="number"
              value={String(bars.horizontalCount ?? 0)}
              onChange={(event) => {
                const nextHorizontalCount = Number(event.currentTarget.value || 0);
                updateConfiguration((current) => ({
                  ...current,
                  bars: { ...(current.bars ?? {}), horizontalCount: nextHorizontalCount },
                }));
              }}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Vertical bars</Small>
            <input
              type="number"
              value={String(bars.verticalCount ?? 0)}
              onChange={(event) => {
                const nextVerticalCount = Number(event.currentTarget.value || 0);
                updateConfiguration((current) => ({
                  ...current,
                  bars: { ...(current.bars ?? {}), verticalCount: nextVerticalCount },
                }));
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {[
          { key: "duplex", label: "Duplex" },
          { key: "insideBars", label: "Inside bars" },
          { key: "outsideBars", label: "Outside bars" },
          { key: "withinGlassBars", label: "Within-glass bars" },
        ].map((toggle) => (
          <label key={toggle.key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: "#18181b" }}>
            <input
              type="checkbox"
              checked={!!(bars as any)[toggle.key]}
              onChange={(event) => {
                const nextChecked = event.currentTarget.checked;
                updateConfiguration((current) => ({
                  ...current,
                  bars: {
                    ...(current.bars ?? {}),
                    [toggle.key]: nextChecked,
                  },
                }));
              }}
            />
            <span>{toggle.label}</span>
          </label>
        ))}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={() =>
              updateConfiguration((current) => ({
                ...current,
                bars: {
                  ...(current.bars ?? {}),
                  manualBars: appendPlaceholderEntry(current.bars?.manualBars, {
                    axis: "vertical",
                    offsetMm: null,
                    location: "withinGlass",
                  }),
                },
              }))
            }
          >
            Add manual bar foundation
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              updateConfiguration((current) => ({
                ...current,
                bars: {
                  ...(current.bars ?? {}),
                  astragals: appendPlaceholderEntry(current.bars?.astragals, {
                    axis: "horizontal",
                    offsetMm: null,
                  }),
                },
              }))
            }
          >
            Add astragal foundation
          </Button>
        </div>
      </div>
    );
  }

  function renderHardwareSection() {
    const hardware = configuration.hardware ?? {};
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Default handle</Small>
            <select
              value={hardware.defaultHandleType ?? WINDOW_HANDLE_OPTIONS[0]}
              onChange={(event) => {
                const nextHandleType = event.currentTarget.value;
                updateConfiguration((current) => ({
                  ...current,
                  hardware: {
                    ...(current.hardware ?? {}),
                    defaultHandleType: nextHandleType,
                  },
                }));
              }}
              style={inputStyle}
            >
              {handleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Small>Default hinge</Small>
            <select
              value={hardware.defaultHingeType ?? WINDOW_HINGE_OPTIONS[0]}
              onChange={(event) => {
                const nextHingeType = event.currentTarget.value;
                updateConfiguration((current) => ({
                  ...current,
                  hardware: {
                    ...(current.hardware ?? {}),
                    defaultHingeType: nextHingeType,
                  },
                }));
              }}
              style={inputStyle}
            >
              {hingeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <Small>Default handle height (mm)</Small>
          <input
            type="number"
            step={25}
            value={String(hardware.defaultHandleHeightMm ?? 1050)}
            onChange={(event) => {
              const nextHandleHeight = Number(event.currentTarget.value || 0);
              updateConfiguration((current) => ({
                ...current,
                hardware: {
                  ...(current.hardware ?? {}),
                  defaultHandleHeightMm: nextHandleHeight,
                },
              }));
            }}
            style={inputStyle}
          />
        </div>

        {selectedField ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <Small>Selected field handle override</Small>
              <select
                value={selectedField.handleType ?? hardware.defaultHandleType ?? WINDOW_HANDLE_OPTIONS[0]}
                onChange={(event) => {
                  const nextHandleType = event.currentTarget.value;
                  updateConfiguration((current) => ({
                    ...current,
                    fields: (current.fields ?? []).map((field) =>
                      field.key === selectedFieldKey ? { ...field, handleType: nextHandleType } : field
                    ),
                  }));
                }}
                style={inputStyle}
              >
                {handleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <Small>Selected field handle height (mm)</Small>
                <input
                  type="number"
                  step={25}
                  value={String(selectedField.handleHeightMm ?? hardware.defaultHandleHeightMm ?? 1050)}
                  onChange={(event) => {
                    const nextHandleHeight = Number(event.currentTarget.value || 0);
                    updateConfiguration((current) => ({
                      ...current,
                      fields: (current.fields ?? []).map((field) =>
                        field.key === selectedFieldKey ? { ...field, handleHeightMm: nextHandleHeight } : field
                      ),
                    }));
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <Small>Selected field hinge</Small>
                <select
                  value={selectedField.hingeType ?? hardware.defaultHingeType ?? WINDOW_HINGE_OPTIONS[0]}
                  onChange={(event) => {
                    const nextHingeType = event.currentTarget.value;
                    updateConfiguration((current) => ({
                      ...current,
                      fields: (current.fields ?? []).map((field) =>
                        field.key === selectedFieldKey ? { ...field, hingeType: nextHingeType } : field
                      ),
                    }));
                  }}
                  style={inputStyle}
                >
                  {hingeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <Small>Select a field in the editor or field list to edit field-specific hardware.</Small>
        )}
      </div>
    );
  }

  function renderSection(sectionId: ConfiguratorConfigurationSectionId) {
    if (sectionId === "layout") return renderLayoutSection();
    if (sectionId === "fields") return renderFieldsSection();
    if (sectionId === "mullionsSplits") return renderMullionsAndSplitsSection();
    if (sectionId === "frameRebate") return renderFrameAndRebateSection();
    if (sectionId === "glass") return renderGlassSection();
    if (sectionId === "barsAstragalsDuplex") return renderBarsSection();
    return renderHardwareSection();
  }

  if (settingsLoaded && !configuratorEnabled) {
    return (
      <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 16, display: "grid", gap: 8 }}>
        <H3>Configurator unavailable</H3>
        <Small>The configurator is currently disabled in Admin settings.</Small>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onBack}>Back to workflow</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: embeddedInWorkflowShell ? 10 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2 }}>
          {!embeddedInWorkflowShell && <H3>Configuration</H3>}
          <Small>
            Estimate {estimate?.estimateRef || estimate?.id} • Position {workflowPosition?.positionRef || workflowPosition?.id}
          </Small>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={saveDraft}>Save draft</Button>
          {embeddedInWorkflowShell && onExitWorkflow ? (
            <Button variant="secondary" onClick={onExitWorkflow}>Exit workflow</Button>
          ) : (
            <Button variant="secondary" onClick={onBack}>Exit workflow</Button>
          )}
          <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Position"}
          </Button>
        </div>
      </div>

      <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 10, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
          {CONFIGURATION_SECTION_OPTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              style={configuration.activeSectionId === section.id ? activeSectionButtonStyle : sectionButtonStyle}
              onClick={() =>
                updateConfiguration((current) => ({
                  ...current,
                  activeSectionId: section.id,
                }))
              }
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 12, minHeight: 620, alignItems: "start" }}>
        <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <Small>
              {getLayoutLabel(layout)} • {workflowPosition.widthMm} × {workflowPosition.heightMm} mm • {configuration.orientationView === "outside" ? "Outside" : "Inside"} view
            </Small>
            <Small>{selectedField ? `Selected: ${fieldLabel(selectedField)}` : "Select a field to edit field-specific options"}</Small>
          </div>

          <GridEditor
            pos={{ ...workflowPosition, resolvedProfiles, windowConfiguration: configuration }}
            setPos={updateWorkflowDraftPosition}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            view={configuration.orientationView === "outside" ? "Outside" : "Inside"}
            openingStd="DIN"
            showDimensions={showDimensions}
          />
        </div>

        <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 12, display: "grid", gap: 10, alignContent: "start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <Small>Position reference</Small>
                <input
                  value={draft.addPosition.positionReference ?? ""}
                  onChange={(event) =>
                    setDraft((previousDraft) =>
                      previousDraft
                        ? {
                            ...previousDraft,
                            addPosition: {
                              ...previousDraft.addPosition,
                              positionReference: event.currentTarget.value,
                            },
                            isDirty: true,
                          }
                        : previousDraft
                    )
                  }
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <Small>Quantity</Small>
                <input
                  type="number"
                  min={1}
                  value={String(draft.addPosition.quantity ?? 1)}
                  onChange={(event) =>
                    setDraft((previousDraft) =>
                      previousDraft
                        ? {
                            ...previousDraft,
                            addPosition: {
                              ...previousDraft.addPosition,
                              quantity: Math.max(1, Number(event.currentTarget.value || 1)),
                            },
                            isDirty: true,
                          }
                        : previousDraft
                    )
                  }
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <Small>Room name</Small>
              <input
                value={draft.addPosition.roomName ?? ""}
                onChange={(event) =>
                  setDraft((previousDraft) =>
                    previousDraft
                      ? {
                          ...previousDraft,
                          addPosition: {
                            ...previousDraft.addPosition,
                            roomName: event.currentTarget.value,
                          },
                          isDirty: true,
                        }
                      : previousDraft
                  )
                }
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <Small>Width (mm)</Small>
              <input
                type="number"
                value={widthInput}
                onChange={(event) => setWidthInput(event.currentTarget.value)}
                onBlur={commitWidth}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitWidth();
                }}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <Small>Height (mm)</Small>
              <input
                type="number"
                value={heightInput}
                onChange={(event) => setHeightInput(event.currentTarget.value)}
                onBlur={commitHeight}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitHeight();
                }}
                style={inputStyle}
              />
            </div>
          </div>

          {renderSection(configuration.activeSectionId ?? "layout")}
        </div>
      </div>
    </div>
  );
}
