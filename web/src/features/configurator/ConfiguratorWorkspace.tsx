import React, { useEffect, useMemo, useState } from "react";
import GridEditor from "../../components/GridEditor";
import WindowRenderer from "./components/WindowRenderer";
import { Button, H3, Small } from "../estimatePicker/tabs/shared";
import {
  getConfiguratorAssetMeta,
  resolveConfiguratorAssetKey,
} from "./configuratorAssetRegistry";
import { getAllSettings } from "../../services/settings/settingsService";

type Props = {
  estimate: any;
  position: any;
  onBack: () => void;
  onSavePosition: (updatedPosition: any) => Promise<void>;
};

type PositionType = "Window" | "Door";

type SettingsMap = Record<string, unknown>;

type DimensionDefaults = {
  width: number;
  height: number;
};

const WINDOW_INSERTIONS = ["Fixed", "Tilt & Turn", "Top Hung"];
const DOOR_INSERTIONS = ["Single Door", "French Door", "Sliding Door"];
const FALLBACK_DIMENSIONS: DimensionDefaults = { width: 1000, height: 1200 };

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #e4e4e7",
  padding: "0 12px",
  background: "#fff",
};

const previewCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid #e4e4e7",
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 12,
  alignContent: "start",
};

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizeCellInsertions(fieldsX: number, fieldsY: number, existing: Record<string, string> | undefined, fallback: string) {
  const out: Record<string, string> = {};
  for (let r = 0; r < fieldsY; r++) {
    for (let c = 0; c < fieldsX; c++) {
      const k = keyForCell(c, r);
      out[k] = existing?.[k] ?? fallback;
    }
  }
  return out;
}

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
    if (next === "true" || next === "1" || next === "yes" || next === "on") return true;
    if (next === "false" || next === "0" || next === "no" || next === "off") return false;
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

  if (typeof raw === "string") {
    const separators = ["x", "X", ",", "/", "|"];
    for (const separator of separators) {
      if (raw.includes(separator)) {
        const [left, right] = raw.split(separator).map((part) => part.trim());
        const width = clampDimensionValue(left, FALLBACK_DIMENSIONS.width);
        const height = clampDimensionValue(right, FALLBACK_DIMENSIONS.height);
        return { width, height };
      }
    }
  }

  return FALLBACK_DIMENSIONS;
}

export default function ConfiguratorWorkspace(props: Props) {
  const { estimate, position, onBack, onSavePosition } = props;

  const [draftPosition, setDraftPosition] = useState<any>(position);
  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number }>({ col: 0, row: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [settingsMap, setSettingsMap] = useState<SettingsMap | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const defaultDimensions = useMemo(() => getDefaultDimensions(settingsMap), [settingsMap]);
  const configuratorEnabled = useMemo(() => getBooleanSetting(settingsMap, "feature.configurator.enabled", true), [settingsMap]);
  const showDimensions = useMemo(() => getBooleanSetting(settingsMap, "configurator.showDimensions", true), [settingsMap]);

  const [widthInput, setWidthInput] = useState<string>(
    toEditableString(position?.widthMm ?? defaultDimensions.width)
  );
  const [heightInput, setHeightInput] = useState<string>(
    toEditableString(position?.heightMm ?? defaultDimensions.height)
  );

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
    const nextWidth = position?.widthMm ?? defaultDimensions.width;
    const nextHeight = position?.heightMm ?? defaultDimensions.height;

    setDraftPosition({
      ...position,
      widthMm: clampDimensionValue(nextWidth, defaultDimensions.width),
      heightMm: clampDimensionValue(nextHeight, defaultDimensions.height),
    });
    setSelectedCell({ col: 0, row: 0 });
    setWidthInput(toEditableString(nextWidth));
    setHeightInput(toEditableString(nextHeight));
  }, [defaultDimensions.height, defaultDimensions.width, position]);

  const availableInsertions = useMemo(
    () => ((draftPosition?.positionType as PositionType) === "Door" ? DOOR_INSERTIONS : WINDOW_INSERTIONS),
    [draftPosition?.positionType]
  );

  const selectedCellKey = keyForCell(selectedCell.col, selectedCell.row);
  const fieldsX = Math.max(1, Number(draftPosition?.fieldsX || 1));
  const fieldsY = Math.max(1, Number(draftPosition?.fieldsY || 1));
  const currentWidthMm = Math.max(300, Number(draftPosition?.widthMm || defaultDimensions.width));
  const currentHeightMm = Math.max(300, Number(draftPosition?.heightMm || defaultDimensions.height));

  const cellInsertions = useMemo(
    () =>
      normalizeCellInsertions(
        fieldsX,
        fieldsY,
        draftPosition?.cellInsertions,
        String(draftPosition?.insertion || availableInsertions[0] || "Fixed")
      ),
    [fieldsX, fieldsY, draftPosition?.cellInsertions, draftPosition?.insertion, availableInsertions]
  );

  const selectedCellInsertion = cellInsertions[selectedCellKey] ?? String(draftPosition?.insertion || availableInsertions[0] || "Fixed");

  const assetKey = useMemo(
    () =>
      resolveConfiguratorAssetKey({
        positionType: String(draftPosition?.positionType || "Window"),
        fieldsX,
        fieldsY,
        baseInsertion: String(draftPosition?.insertion || availableInsertions[0] || "Fixed"),
        cellInsertions,
      }),
    [availableInsertions, cellInsertions, draftPosition?.insertion, draftPosition?.positionType, fieldsX, fieldsY]
  );

  const assetMeta = useMemo(() => getConfiguratorAssetMeta(assetKey), [assetKey]);

  function updateSelectedCellInsertion(nextInsertion: string) {
    setDraftPosition((prev: any) => {
      const nextFieldsX = Math.max(1, Number(prev?.fieldsX || 1));
      const nextFieldsY = Math.max(1, Number(prev?.fieldsY || 1));
      const nextCellInsertions = normalizeCellInsertions(
        nextFieldsX,
        nextFieldsY,
        prev?.cellInsertions,
        String(prev?.insertion || nextInsertion)
      );
      nextCellInsertions[selectedCellKey] = nextInsertion;
      return {
        ...prev,
        insertion: nextInsertion,
        cellInsertions: nextCellInsertions,
      };
    });
  }

  function updateBaseInsertion(nextInsertion: string) {
    setDraftPosition((prev: any) => ({
      ...prev,
      insertion: nextInsertion,
      cellInsertions: normalizeCellInsertions(
        Math.max(1, Number(prev?.fieldsX || 1)),
        Math.max(1, Number(prev?.fieldsY || 1)),
        prev?.cellInsertions,
        nextInsertion
      ),
    }));
  }

  function updatePositionType(nextType: PositionType) {
    const nextInsertions = nextType === "Door" ? DOOR_INSERTIONS : WINDOW_INSERTIONS;
    const nextDefaultInsertion = nextInsertions[0] ?? "Fixed";
    setDraftPosition((prev: any) => ({
      ...prev,
      positionType: nextType,
      insertion: nextDefaultInsertion,
      cellInsertions: normalizeCellInsertions(
        Math.max(1, Number(prev?.fieldsX || 1)),
        Math.max(1, Number(prev?.fieldsY || 1)),
        undefined,
        nextDefaultInsertion
      ),
    }));
  }

  function commitWidth() {
    const fallback = Math.max(300, Number(draftPosition?.widthMm || defaultDimensions.width));
    const parsed = tryParseDimensionValue(widthInput);
    if (parsed === null) {
      setWidthInput(String(fallback));
      return;
    }
    const committed = Math.max(300, parsed);
    setDraftPosition((prev: any) => ({ ...prev, widthMm: committed }));
    setWidthInput(String(committed));
  }

  function commitHeight() {
    const fallback = Math.max(300, Number(draftPosition?.heightMm || defaultDimensions.height));
    const parsed = tryParseDimensionValue(heightInput);
    if (parsed === null) {
      setHeightInput(String(fallback));
      return;
    }
    const committed = Math.max(300, parsed);
    setDraftPosition((prev: any) => ({ ...prev, heightMm: committed }));
    setHeightInput(String(committed));
  }

  async function handleSave() {
    const committedWidth = clampCommittedDimension(widthInput, Math.max(300, Number(draftPosition?.widthMm || defaultDimensions.width)));
    const committedHeight = clampCommittedDimension(heightInput, Math.max(300, Number(draftPosition?.heightMm || defaultDimensions.height)));

    const nextDraft = {
      ...draftPosition,
      widthMm: committedWidth,
      heightMm: committedHeight,
      cellInsertions: normalizeCellInsertions(
        Math.max(1, Number(draftPosition?.fieldsX || 1)),
        Math.max(1, Number(draftPosition?.fieldsY || 1)),
        draftPosition?.cellInsertions,
        String(draftPosition?.insertion || availableInsertions[0] || "Fixed")
      ),
    };

    setDraftPosition(nextDraft);
    setWidthInput(String(committedWidth));
    setHeightInput(String(committedHeight));

    setIsSaving(true);
    try {
      await onSavePosition(nextDraft);
    } finally {
      setIsSaving(false);
    }
  }

  if (settingsLoaded && !configuratorEnabled) {
    return (
      <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 16, display: "grid", gap: 8 }}>
        <H3>Configurator unavailable</H3>
        <Small>The configurator is currently disabled in Admin settings.</Small>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onBack}>Back to Openings</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <H3>Configurator Workspace</H3>
          <Small>
            Estimate {estimate?.estimateRef || estimate?.id} • Position {draftPosition?.positionRef || draftPosition?.id}
          </Small>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onBack}>Back to Openings</Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Position"}
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) 320px", gap: 12, minHeight: 620 }}>
        <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 14, display: "grid", gap: 10, alignContent: "start" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a" }}>Workflow</div>
          {[
            { key: "project_setup", label: "1. Project Setup", active: false },
            { key: "openings", label: "2. Openings", active: false },
            { key: "configuration", label: "3. Configuration", active: true },
            { key: "pricing", label: "4. Pricing", active: false },
            { key: "review", label: "5. Review", active: false },
            { key: "output", label: "6. Output", active: false },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                borderRadius: 12,
                border: item.active ? "1px solid #18181b" : "1px solid #e4e4e7",
                background: item.active ? "#18181b" : "#fafafa",
                color: item.active ? "#fff" : "#18181b",
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 14, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Opening render</div>
                <Small>SVG asset registry now resolves the preview key before any wider geometry engine replacement.</Small>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Small>{fieldsX} × {fieldsY} fields</Small>
                <Small>{currentWidthMm} × {currentHeightMm} mm</Small>
              </div>
            </div>

            <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", padding: 12, minHeight: 560, display: "grid", placeItems: "center" }}>
              <WindowRenderer
                assetKey={assetKey}
                widthMm={currentWidthMm}
                heightMm={currentHeightMm}
              />
            </div>
          </div>

          <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 14, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Transitional layout editor</div>
              <Small>The existing layout editor remains below so you can compare the supplied SVG asset against the current editor flow.</Small>
            </div>

            <GridEditor
              pos={draftPosition}
              setPos={setDraftPosition}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
              view="Inside"
              openingStd="DIN"
              showDimensions={showDimensions}
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div style={previewCardStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>SVG asset in use</div>
              <Small>This now resolves through an asset key, so uploaded SVG combinations can be added cleanly instead of by hardcoded branching.</Small>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a" }}>Current asset key</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>{assetMeta.key}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#52525b" }}>{assetMeta.filename}</div>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a" }}>Selection rule</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                Element type + field count + field functions → asset key
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                Unsupported combinations safely fall back to legacy fixed / tilt-turn assets
              </div>
            </div>
          </div>

          <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 14, display: "grid", gap: 12, alignContent: "start" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Options</div>
              <Small>Dedicated configurator controls for this position.</Small>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Small>Main element type</Small>
              <select
                value={draftPosition?.positionType || "Window"}
                onChange={(e) => updatePositionType(e.currentTarget.value as PositionType)}
                style={inputStyle}
              >
                <option value="Window">Window</option>
                <option value="Door">Door</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Small>Base insertion</Small>
              <select
                value={draftPosition?.insertion || availableInsertions[0] || ""}
                onChange={(e) => updateBaseInsertion(e.currentTarget.value)}
                style={inputStyle}
              >
                {availableInsertions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Small>Selected field</Small>
              <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, fontSize: 13, fontWeight: 800, color: "#18181b" }}>
                Column {selectedCell.col + 1} • Row {selectedCell.row + 1}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Small>Selected field insertion</Small>
              <select
                value={selectedCellInsertion}
                onChange={(e) => updateSelectedCellInsertion(e.currentTarget.value)}
                style={inputStyle}
              >
                {availableInsertions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Small>Width (mm)</Small>
              <input
                type="number"
                value={widthInput}
                onChange={(e) => setWidthInput(e.currentTarget.value)}
                onBlur={commitWidth}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitWidth();
                }}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <Small>Height (mm)</Small>
              <input
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.currentTarget.value)}
                onBlur={commitHeight}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitHeight();
                }}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}