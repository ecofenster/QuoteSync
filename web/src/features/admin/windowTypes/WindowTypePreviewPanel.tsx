import React, { useMemo, useState } from "react";
import DrawingViewport from "../../configurator/rendering/DrawingViewport";
import { buildWindowDrawingModel } from "../../configurator/rendering/buildWindowDrawingModel";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";
import B92ProfileSectionAssemblyPreview from "./B92ProfileSectionAssemblyPreview";
import {
  getB92ProfileSectionProofById,
  getB92ProfileSectionProofForDesignId,
} from "./b92ProfileSectionProofRegistry";

const TEMP_RAL_OPTIONS = [
  { value: "9016", label: "9016 Traffic White" },
  { value: "9005", label: "9005 Jet Black" },
  { value: "7016", label: "7016 Anthracite Grey" },
  { value: "9006", label: "9006 White Aluminium" },
  { value: "7035", label: "7035 Light Grey" },
  { value: "8017", label: "8017 Chocolate Brown" },
  { value: "6009", label: "6009 Fir Green" },
];

type Props = {
  selectedDesign: WindowTypeDesignListItem | null;
};

type WindowDrawingModelInput = Parameters<typeof buildWindowDrawingModel>[0];

type PreviewLayout = {
  fieldsX: number;
  fieldsY: number;
  widthMm: number;
  heightMm: number;
  insertion: string;
  cellInsertions: Record<string, string>;
  junctions: Array<{ key: string; type?: string; ownerFieldId?: string | null }>;
};

function evenSplitTotal(total: number, parts: number) {
  const safeParts = Math.max(1, Math.min(16, Math.round(parts || 1)));
  const base = Math.floor(total / safeParts);
  const remainder = total - base * safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function updateSplitAtIndex(current: number[], index: number, nextValue: number, total: number, minimum: number) {
  if (!current.length) return current;
  const safe = [...current];
  if (safe.length === 1) return [total];
  const targetIndex = index < safe.length - 1 ? index + 1 : index - 1;
  const boundedNext = Math.max(minimum, Math.min(total - minimum * (safe.length - 1), Math.round(nextValue || minimum)));
  const delta = boundedNext - safe[index];
  const available = safe[targetIndex] - minimum;
  const appliedDelta = delta > 0 ? Math.min(delta, available) : Math.max(delta, -Math.max(0, total));
  safe[index] += appliedDelta;
  safe[targetIndex] -= appliedDelta;
  const normalized = safe.map((value) => Math.max(minimum, Math.round(value)));
  const remainder = total - normalized.reduce((sum, value) => sum + value, 0);
  normalized[normalized.length - 1] += remainder;
  return normalized;
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildPreviewLayoutFromSelectedDesign(selectedDesign: WindowTypeDesignListItem | null): PreviewLayout {
  const designId = selectedDesign?.id ?? "";
  if (designId === "windows-1-tilt-turn") {
    return {
      fieldsX: 1,
      fieldsY: 1,
      widthMm: 1000,
      heightMm: 1000,
      insertion: "Tilt & Turn Left",
      cellInsertions: { "0,0": "Tilt & Turn Left" },
      junctions: [],
    };
  }
  if (designId === "windows-1-tilt-turn-left") {
    return {
      fieldsX: 1,
      fieldsY: 1,
      widthMm: 1000,
      heightMm: 1000,
      insertion: "Tilt & Turn Left",
      cellInsertions: { "0,0": "Tilt & Turn Left" },
      junctions: [],
    };
  }
  if (designId === "windows-1-tilt-turn-right") {
    return {
      fieldsX: 1,
      fieldsY: 1,
      widthMm: 1000,
      heightMm: 1000,
      insertion: "Tilt & Turn Right",
      cellInsertions: { "0,0": "Tilt & Turn Right" },
      junctions: [],
    };
  }
  if (designId === "windows-1-fixed-sash") {
    return {
      fieldsX: 1,
      fieldsY: 1,
      widthMm: 1000,
      heightMm: 1000,
      insertion: "Fixed Sash",
      cellInsertions: { "0,0": "Fixed Sash" },
      junctions: [],
    };
  }
  if (designId === "windows-2-fixed-fixed-static") {
    return {
      fieldsX: 2,
      fieldsY: 1,
      widthMm: 2000,
      heightMm: 1000,
      insertion: "Fixed",
      cellInsertions: { "0,0": "Fixed", "1,0": "Fixed" },
      junctions: [{ key: "vertical-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-2-fixed-tiltturn-handle-centre") {
    return {
      fieldsX: 2,
      fieldsY: 1,
      widthMm: 2000,
      heightMm: 1000,
      insertion: "Fixed",
      cellInsertions: { "0,0": "Fixed", "1,0": "Tilt & Turn Right" },
      junctions: [{ key: "vertical-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-2-fixed-tiltturn-hinge-centre") {
    return {
      fieldsX: 2,
      fieldsY: 1,
      widthMm: 2000,
      heightMm: 1000,
      insertion: "Fixed",
      cellInsertions: { "0,0": "Fixed", "1,0": "Tilt & Turn Left" },
      junctions: [{ key: "vertical-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-2-tiltturn-tiltturn-static") {
    return {
      fieldsX: 2,
      fieldsY: 1,
      widthMm: 2000,
      heightMm: 1000,
      insertion: "Tilt & Turn Left",
      cellInsertions: { "0,0": "Tilt & Turn Left", "1,0": "Tilt & Turn Right" },
      junctions: [{ key: "vertical-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-2-slave-master-flying") {
    return {
      fieldsX: 2,
      fieldsY: 1,
      widthMm: 2000,
      heightMm: 1000,
      insertion: "Tilt & Turn Left",
      cellInsertions: { "0,0": "Tilt & Turn Left", "1,0": "Tilt & Turn Right" },
      junctions: [{ key: "vertical-1", type: "flying", ownerFieldId: "1,0" }],
    };
  }
  if (designId === "windows-2-fixed-over-fixed-vertical") {
    return {
      fieldsX: 1,
      fieldsY: 2,
      widthMm: 1000,
      heightMm: 2000,
      insertion: "Fixed",
      cellInsertions: { "0,0": "Fixed", "0,1": "Fixed" },
      junctions: [{ key: "horizontal-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-2-fixed-over-tiltturn-vertical") {
    return {
      fieldsX: 1,
      fieldsY: 2,
      widthMm: 1000,
      heightMm: 2000,
      insertion: "Fixed",
      cellInsertions: { "0,0": "Fixed", "0,1": "Tilt & Turn Left" },
      junctions: [{ key: "horizontal-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-2-tiltturn-over-fixed-vertical") {
    return {
      fieldsX: 1,
      fieldsY: 2,
      widthMm: 1000,
      heightMm: 2000,
      insertion: "Tilt & Turn Left",
      cellInsertions: { "0,0": "Tilt & Turn Left", "0,1": "Fixed" },
      junctions: [{ key: "horizontal-1", type: "static", ownerFieldId: null }],
    };
  }
  if (designId === "windows-grid-2x2-mixed-profile-pilot") {
    return {
      fieldsX: 2,
      fieldsY: 2,
      widthMm: 2000,
      heightMm: 2000,
      insertion: "Fixed",
      cellInsertions: {
        "0,0": "Fixed",
        "1,0": "Fixed",
        "0,1": "Fixed",
        "1,1": "Tilt & Turn Right",
      },
      junctions: [
        { key: "vertical-1", type: "static", ownerFieldId: null },
        { key: "horizontal-1", type: "static", ownerFieldId: null },
      ],
    };
  }
  return {
    fieldsX: 1,
    fieldsY: 1,
    widthMm: 1000,
    heightMm: 1000,
    insertion: "Fixed",
    cellInsertions: { "0,0": "Fixed" },
    junctions: [],
  };
}

export default function WindowTypePreviewPanel(props: Props) {
  const { selectedDesign } = props;
  const previewLayout = useMemo(() => buildPreviewLayoutFromSelectedDesign(selectedDesign), [selectedDesign]);
  const [useRectanglePilot, setUseRectanglePilot] = useState(false);
  const [useMultiFieldRectanglePilot, setUseMultiFieldRectanglePilot] = useState(false);
  const [useInternalProfileResolutionPilot, setUseInternalProfileResolutionPilot] = useState(true);
  const [useAstragalBars, setUseAstragalBars] = useState(false);
  const [astragalCols, setAstragalCols] = useState(2);
  const [astragalRows, setAstragalRows] = useState(2);
  const [useExternalAstragalBars, setUseExternalAstragalBars] = useState(false);
  const [externalAstragalCols, setExternalAstragalCols] = useState(2);
  const [externalAstragalRows, setExternalAstragalRows] = useState(2);
  const [useFixedSashRectanglePilot, setUseFixedSashRectanglePilot] = useState(false);
  const [previewView, setPreviewView] = useState<"internal" | "external">("internal");
  const [rebateMode, setRebateMode] = useState<"internal" | "external" | "both" | "none">("both");
  const [internalFrameRal, setInternalFrameRal] = useState("9016");
  const [externalCladdingRal, setExternalCladdingRal] = useState("7016");
  const [previewSourceMode, setPreviewSourceMode] = useState<"native" | "b92">("native");
  const [selectedB92ProofFamilyId, setSelectedB92ProofFamilyId] = useState<string | null>(null);
  const [draftDimensionInputs, setDraftDimensionInputs] = useState<Record<string, string>>({});
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [committedDivisionCentreMm, setCommittedDivisionCentreMm] = useState<number | null>(null);
  const isFixedSashDesign = previewLayout.insertion === "Fixed Sash";
  const mappedB92ProofFamily = useMemo(
    () => getB92ProfileSectionProofForDesignId(selectedDesign?.id),
    [selectedDesign?.id]
  );
  const manuallySelectedB92ProofFamily = getB92ProfileSectionProofById(selectedB92ProofFamilyId);
  const selectedB92ProofFamily = mappedB92ProofFamily ?? manuallySelectedB92ProofFamily;
  const requiresManualB92ProofFamilySelection = !mappedB92ProofFamily;

  React.useEffect(() => {
    setSelectedB92ProofFamilyId(null);
  }, [selectedDesign?.id]);
  const previewInsertion = previewLayout.insertion;
  const parsedFieldCount = previewLayout.fieldsX;
  const previewWidthMm = previewLayout.widthMm;
  const previewHeightMm = previewLayout.heightMm;
  const showMultiFieldRectanglePilot =
    !isFixedSashDesign && previewView === "internal" && previewLayout.fieldsX === 2 && previewLayout.fieldsY === 1;
  const [colWidthsMm, setColWidthsMm] = useState<number[]>(() => evenSplitTotal(previewWidthMm, previewLayout.fieldsX));
  const [rowHeightsMm, setRowHeightsMm] = useState<number[]>(() => evenSplitTotal(previewHeightMm, previewLayout.fieldsY));

  React.useEffect(() => {
    setColWidthsMm(evenSplitTotal(previewWidthMm, previewLayout.fieldsX));
  }, [previewLayout.fieldsX, previewWidthMm]);

  React.useEffect(() => {
    setRowHeightsMm(evenSplitTotal(previewHeightMm, previewLayout.fieldsY));
  }, [previewHeightMm, previewLayout.fieldsY]);

  React.useEffect(() => {
    setCommittedDivisionCentreMm(null);
  }, [parsedFieldCount, previewWidthMm, previewView, selectedDesign?.id]);

  const previewModel = useMemo(
    () =>
      buildWindowDrawingModel({
        widthMm: previewWidthMm,
        heightMm: previewHeightMm,
        fieldsX: previewLayout.fieldsX,
        fieldsY: previewLayout.fieldsY,
        insertion: previewInsertion,
        cellInsertions: previewLayout.cellInsertions,
        colWidthsMm,
        rowHeightsMm,
        orientationView: previewView === "external" ? "outside" : "inside",
        windowConfiguration: (
          ((useRectanglePilot || useMultiFieldRectanglePilot) && !isFixedSashDesign) ||
          (useFixedSashRectanglePilot && isFixedSashDesign) ||
          (useInternalProfileResolutionPilot && previewView === "internal")
            ? {
                junctions: previewLayout.junctions,
                dev: isFixedSashDesign
                  ? previewView === "internal"
                    ? { fixedSashInternalRectanglePilot: true }
                    : { fixedSashExternalRectanglePilot: true }
                  : previewView === "internal"
                    ? {
                        fixedInternalRectanglePilot: useRectanglePilot,
                        fixedMultiFieldRectanglePilot: useMultiFieldRectanglePilot,
                        internalProfileResolutionPilot: useInternalProfileResolutionPilot,
                        fixedInternalHasAstragalBars: useAstragalBars,
                        fixedInternalAstragalCols: astragalCols,
                        fixedInternalAstragalRows: astragalRows,
                        internalFrameRal,
                        externalCladdingRal,
                      }
                    : {
                        fixedExternalRectanglePilot: true,
                        fixedExternalHasAstragalBars: useExternalAstragalBars,
                        fixedExternalAstragalCols: externalAstragalCols,
                        fixedExternalAstragalRows: externalAstragalRows,
                        internalFrameRal,
                        externalCladdingRal,
                      },
              }
            : undefined
        ) as WindowDrawingModelInput["windowConfiguration"],
      }),
    [
      externalCladdingRal,
      externalAstragalCols,
      externalAstragalRows,
      internalFrameRal,
      isFixedSashDesign,
      colWidthsMm,
      parsedFieldCount,
      previewLayout,
      previewInsertion,
      previewHeightMm,
      previewView,
      previewWidthMm,
      rebateMode,
      rowHeightsMm,
      astragalCols,
      astragalRows,
      useExternalAstragalBars,
      useAstragalBars,
      useFixedSashRectanglePilot,
      useInternalProfileResolutionPilot,
      useMultiFieldRectanglePilot,
      useRectanglePilot,
    ]
  );
  const divisionCentreDimension = previewModel.annotations.dimensions.find(
    (dimension) => dimension.role === "structural-division-centre"
  );
  const renderedDivisionCentreMm = Number(divisionCentreDimension?.valueMm ?? 0);
  const derivedDivisionCentreMm =
    colWidthsMm.length === 2 ? Math.round(colWidthsMm[0]) : renderedDivisionCentreMm;
  const divisionCentreMm = committedDivisionCentreMm ?? derivedDivisionCentreMm;
  const minDivisionCentreMm = 200;
  const maxDivisionCentreMm = previewWidthMm - 200;

  function beginDraft(id: string, committedValue: number) {
    setActiveDraftId(id);
    setDraftDimensionInputs((current) => ({
      ...current,
      [id]: current[id] ?? String(committedValue),
    }));
  }

  function updateDraft(id: string, value: string) {
    setDraftDimensionInputs((current) => ({ ...current, [id]: value }));
  }

  function endDraft(id: string) {
    setActiveDraftId((current) => (current === id ? null : current));
    setDraftDimensionInputs((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function getDisplayValue(id: string, committedValue: number) {
    if (activeDraftId === id) return draftDimensionInputs[id] ?? String(committedValue);
    return String(committedValue);
  }

  function commitColumnWidth(index: number) {
    const id = `col-width-${index}`;
    const parsed = Number(draftDimensionInputs[id]);
    if (!Number.isFinite(parsed)) {
      endDraft(id);
      return;
    }
    setColWidthsMm((current) => updateSplitAtIndex(current, index, parsed, previewWidthMm, 200));
    endDraft(id);
  }

  function commitRowHeight(index: number) {
    const id = `row-height-${index}`;
    const parsed = Number(draftDimensionInputs[id]);
    if (!Number.isFinite(parsed)) {
      endDraft(id);
      return;
    }
    setRowHeightsMm((current) => updateSplitAtIndex(current, index, parsed, previewHeightMm, 200));
    endDraft(id);
  }

  function commitDivisionCentre() {
    const id = "division-centre";
    const parsed = Number(draftDimensionInputs[id]);
    if (!Number.isFinite(parsed)) {
      endDraft(id);
      return;
    }
    const clampedCentre = clampValue(parsed, minDivisionCentreMm, maxDivisionCentreMm);
    const leftWidth = Math.round(clampedCentre);
    const rightWidth = Math.round(previewWidthMm - clampedCentre);
    if (!Number.isFinite(leftWidth) || !Number.isFinite(rightWidth)) {
      endDraft(id);
      return;
    }
    if (leftWidth < 200 || rightWidth < 200) {
      endDraft(id);
      return;
    }
    setColWidthsMm([leftWidth, rightWidth]);
    setCommittedDivisionCentreMm(Math.round(clampedCentre));
    endDraft(id);
  }

  return (
    <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 10, minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div className="admin-group-title">Preview</div>
        <div className="admin-body-copy">
          {selectedDesign ? selectedDesign.label : "No design selected"}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(180px, 1fr)) repeat(2, minmax(140px, 0.85fr))",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Rectangle Geometry (Pilot)</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <input
              type="checkbox"
              checked={useRectanglePilot}
              onChange={(event) => setUseRectanglePilot(event.currentTarget.checked)}
              disabled={isFixedSashDesign}
            />
            <span className="admin-body-copy">Use guarded fixed internal rectangle path</span>
          </label>
        </div>
        {showMultiFieldRectanglePilot ? (
          <div style={{ display: "grid", gap: 6 }}>
            <span className="admin-setting-label">Multi-field Rectangle Pilot</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
              <input
                type="checkbox"
                checked={useMultiFieldRectanglePilot}
                onChange={(event) => setUseMultiFieldRectanglePilot(event.currentTarget.checked)}
              />
              <span className="admin-body-copy">Use field-local fixed rectangle rendering per field</span>
            </label>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Fixed Sash Geometry (Pilot)</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <input
              type="checkbox"
              checked={useFixedSashRectanglePilot}
              onChange={(event) => setUseFixedSashRectanglePilot(event.currentTarget.checked)}
              disabled={!isFixedSashDesign}
            />
            <span className="admin-body-copy">Use guarded fixed sash rectangle path</span>
          </label>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Internal Profile Resolution (Pilot)</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <input
              type="checkbox"
              checked={useInternalProfileResolutionPilot}
              onChange={(event) => setUseInternalProfileResolutionPilot(event.currentTarget.checked)}
              disabled={previewView !== "internal"}
            />
            <span className="admin-body-copy">Show resolved profile refs for field edges and local junctions</span>
          </label>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">View</span>
          <select
            value={previewView}
            onChange={(event) => setPreviewView(event.currentTarget.value === "external" ? "external" : "internal")}
            className="admin-input"
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Preview source</span>
          <select
            value={previewSourceMode}
            onChange={(event) => setPreviewSourceMode(event.currentTarget.value === "b92" ? "b92" : "native")}
            className="admin-input"
          >
            <option value="native">Native render</option>
            <option value="b92">B92 profile-section assembly proof</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Rebate</span>
          <select
            value={rebateMode}
            onChange={(event) =>
              setRebateMode(
                event.currentTarget.value === "internal"
                  ? "internal"
                  : event.currentTarget.value === "external"
                    ? "external"
                    : event.currentTarget.value === "none"
                      ? "none"
                      : "both"
              )
            }
            className="admin-input"
            disabled={previewView === "external"}
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
            <option value="both">Both Sides</option>
            <option value="none">None</option>
          </select>
        </label>
        {!isFixedSashDesign ? (
          <div style={{ display: "grid", gap: 8, gridColumn: "1 / -1" }}>
            <span className="admin-setting-label">Structural splits</span>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(220px, 1fr))" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <span className="admin-body-copy">Column widths (mm)</span>
                <div style={{ display: "grid", gap: 6 }}>
                  {colWidthsMm.map((value, index) => (
                    <label key={`col-width-${index}`} style={{ display: "grid", gap: 4 }}>
                      <span className="admin-setting-label">Column {index + 1}</span>
                      <input
                        type="number"
                        min={200}
                        value={getDisplayValue(`col-width-${index}`, value)}
                        onFocus={() => beginDraft(`col-width-${index}`, value)}
                        onChange={(event) => updateDraft(`col-width-${index}`, event?.currentTarget?.value ?? "")}
                        onBlur={() => commitColumnWidth(index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitColumnWidth(index);
                            (event.currentTarget as HTMLInputElement | null)?.blur?.();
                          }
                        }}
                        className="admin-input"
                        disabled={colWidthsMm.length === 1}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <span className="admin-body-copy">Row heights (mm)</span>
                <div style={{ display: "grid", gap: 6 }}>
                  {rowHeightsMm.map((value, index) => (
                    <label key={`row-height-${index}`} style={{ display: "grid", gap: 4 }}>
                      <span className="admin-setting-label">Row {index + 1}</span>
                      <input
                        type="number"
                        min={200}
                        value={getDisplayValue(`row-height-${index}`, value)}
                        onFocus={() => beginDraft(`row-height-${index}`, value)}
                        onChange={(event) => updateDraft(`row-height-${index}`, event?.currentTarget?.value ?? "")}
                        onBlur={() => commitRowHeight(index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRowHeight(index);
                            (event.currentTarget as HTMLInputElement | null)?.blur?.();
                          }
                        }}
                        className="admin-input"
                        disabled={rowHeightsMm.length === 1}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {previewView === "internal" && previewLayout.fieldsX === 2 && previewLayout.fieldsY === 1 ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px)",
                  alignItems: "end",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="admin-setting-label">Division Split (Pilot)</span>
                  <div className="admin-body-copy">Measured across overall width to centreline of mullion</div>
                  <input
                    type="number"
                    min={Math.round(minDivisionCentreMm)}
                    max={Math.round(maxDivisionCentreMm)}
                    value={getDisplayValue("division-centre", divisionCentreMm)}
                    onFocus={() => beginDraft("division-centre", divisionCentreMm)}
                    onChange={(event) => updateDraft("division-centre", event?.currentTarget?.value ?? "")}
                    onBlur={() => commitDivisionCentre()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitDivisionCentre();
                        (event.currentTarget as HTMLInputElement | null)?.blur?.();
                      }
                    }}
                    className="admin-input"
                    placeholder="Division centre"
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="admin-setting-label">Equal Glass Split</span>
                  <button type="button" className="admin-nav-button" disabled>
                    <span className="admin-nav-button-label">Coming soon</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {!isFixedSashDesign && (useRectanglePilot || useMultiFieldRectanglePilot) ? (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="admin-setting-label">Glazing Bars / Astragals (Pilot)</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
                <input
                  type="checkbox"
                  checked={previewView === "internal" ? useAstragalBars : useExternalAstragalBars}
                  onChange={(event) =>
                    previewView === "internal"
                      ? setUseAstragalBars(event.currentTarget.checked)
                      : setUseExternalAstragalBars(event.currentTarget.checked)
                  }
                />
                <span className="admin-body-copy">Render glazing bars over visible glass</span>
              </label>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="admin-setting-label">Glass columns/lites</span>
              <select
                value={previewView === "internal" ? astragalCols : externalAstragalCols}
                onChange={(event) => {
                  const next = Math.max(1, Math.min(6, Number(event.currentTarget.value) || 2));
                  if (previewView === "internal") setAstragalCols(next);
                  else setExternalAstragalCols(next);
                }}
                className="admin-input"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="admin-setting-label">Glass rows/lites</span>
              <select
                value={previewView === "internal" ? astragalRows : externalAstragalRows}
                onChange={(event) => {
                  const next = Math.max(1, Math.min(6, Number(event.currentTarget.value) || 2));
                  if (previewView === "internal") setAstragalRows(next);
                  else setExternalAstragalRows(next);
                }}
                className="admin-input"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </label>
          </>
        ) : null}
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Internal Frame RAL</span>
          <select
            value={TEMP_RAL_OPTIONS.some((option) => option.value === internalFrameRal) ? internalFrameRal : ""}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (next) setInternalFrameRal(next);
            }}
            className="admin-input"
            disabled={isFixedSashDesign}
          >
            <option value="">Custom / manual</option>
            {TEMP_RAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">Internal Frame RAL Entry</span>
          <input
            value={internalFrameRal}
            onChange={(event) => setInternalFrameRal(event.currentTarget.value)}
            className="admin-input"
            placeholder="e.g. 7016"
            disabled={isFixedSashDesign}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">External Cladding RAL</span>
          <select
            value={TEMP_RAL_OPTIONS.some((option) => option.value === externalCladdingRal) ? externalCladdingRal : ""}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (next) setExternalCladdingRal(next);
            }}
            className="admin-input"
            disabled={isFixedSashDesign}
          >
            <option value="">Custom / manual</option>
            {TEMP_RAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="admin-setting-label">External Cladding RAL Entry</span>
          <input
            value={externalCladdingRal}
            onChange={(event) => setExternalCladdingRal(event.currentTarget.value)}
            className="admin-input"
            placeholder="e.g. 7016"
            disabled={isFixedSashDesign}
          />
        </label>
      </div>
      <div className="admin-placeholder-box" style={{ margin: 0 }}>
        Preview controls live here. DrawingViewport keeps its own tool, pan, zoom, scale, and reset controls inside the render surface.
      </div>
      <div
        style={{
          borderRadius: 16,
          border: "1px solid #e4e4e7",
          background: "#fff",
          padding: 8,
          minHeight: 620,
          display: "grid",
          alignItems: "stretch",
        }}
      >
        {previewSourceMode === "b92" ? (
          <B92ProfileSectionAssemblyPreview
            selectedFamily={selectedB92ProofFamily}
            view={previewView}
            onSelectFamily={(familyId) => setSelectedB92ProofFamilyId(familyId || null)}
            requiresManualFamilySelection={requiresManualB92ProofFamilySelection}
            internalFrameRal={internalFrameRal}
            externalCladdingRal={externalCladdingRal}
          />
        ) : (
          <DrawingViewport model={previewModel} minHeight={620} aspectRatio="4 / 3" />
        )}
      </div>
    </div>
  );
}
