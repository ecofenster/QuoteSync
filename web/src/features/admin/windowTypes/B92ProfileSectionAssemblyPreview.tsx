import { useMemo } from "react";
import DrawingViewport from "../../configurator/rendering/DrawingViewport";
import type { DrawingLine, DrawingModel } from "../../configurator/rendering/drawingModel";
import {
  B92_PROFILE_SECTION_PROOF_GEOMETRY,
  type B92ProfileSectionProofLine,
  type B92ProfileSectionProofViewGeometry,
} from "./b92ProfileSectionProofGeometry";
import { buildB92ProfileSectionProofSemanticOverlay } from "./b92ProfileSectionProofSemanticAdapter";
import {
  B92_PROFILE_SECTION_PROOF_FAMILIES,
  type B92ProfileSectionProofFamily,
  type B92ProfileSectionProofView,
} from "./b92ProfileSectionProofRegistry";

type Props = {
  selectedFamily: B92ProfileSectionProofFamily | null;
  view: B92ProfileSectionProofView;
  onSelectFamily: (familyId: string) => void;
  requiresManualFamilySelection?: boolean;
  internalFrameRal: string;
  externalCladdingRal: string;
};

const VIEWPORT_PAD = 42;
const PROOF_STROKE = "#111827";
const OPENING_STROKE = "#64748b";

function getProofGeometry(familyId: string, view: B92ProfileSectionProofView) {
  return B92_PROFILE_SECTION_PROOF_GEOMETRY.find((family) => family.id === familyId)?.views[view] ?? null;
}

function isOpeningLine(line: B92ProfileSectionProofLine) {
  return Boolean(line.opening || /opening/i.test(line.role ?? ""));
}

function toDrawingLine(
  line: B92ProfileSectionProofLine,
  geometry: B92ProfileSectionProofViewGeometry
): DrawingLine {
  const xOffset = VIEWPORT_PAD - geometry.bounds.x;
  const yOffset = VIEWPORT_PAD - geometry.bounds.y;
  const opening = isOpeningLine(line);
  return {
    kind: "line",
    x1: line.x1 + xOffset,
    y1: line.y1 + yOffset,
    x2: line.x2 + xOffset,
    y2: line.y2 + yOffset,
    stroke: opening ? OPENING_STROKE : PROOF_STROKE,
    strokeWidth: opening ? 1.2 : 1.1,
    dashed: opening,
    role: line.role,
  };
}

function buildDimensions(geometry: B92ProfileSectionProofViewGeometry): DrawingModel["annotations"]["dimensions"] {
  const left = VIEWPORT_PAD;
  const top = VIEWPORT_PAD;
  const right = VIEWPORT_PAD + geometry.bounds.width;
  const bottom = VIEWPORT_PAD + geometry.bounds.height;
  const widthY = bottom + 28;
  const heightX = right + 28;
  const widthLabel = Math.round(geometry.bounds.width).toString();
  const heightLabel = Math.round(geometry.bounds.height).toString();
  return [
    {
      id: "proof-bounds-width",
      role: "proof-bounds-width",
      axis: "x",
      valueMm: Math.round(geometry.bounds.width),
      value: widthLabel,
      line: { kind: "line", x1: left, y1: widthY, x2: right, y2: widthY, stroke: "#111", strokeWidth: 0.8 },
      tickA: { kind: "line", x1: left, y1: widthY - 5, x2: left, y2: widthY + 5, stroke: "#111", strokeWidth: 0.8 },
      tickB: { kind: "line", x1: right, y1: widthY - 5, x2: right, y2: widthY + 5, stroke: "#111", strokeWidth: 0.8 },
      text: { x: left + geometry.bounds.width / 2, y: widthY + 18, value: widthLabel, fontSize: 11, fill: "#111", anchor: "middle" },
    },
    {
      id: "proof-bounds-height",
      role: "proof-bounds-height",
      axis: "y",
      valueMm: Math.round(geometry.bounds.height),
      value: heightLabel,
      line: { kind: "line", x1: heightX, y1: top, x2: heightX, y2: bottom, stroke: "#111", strokeWidth: 0.8 },
      tickA: { kind: "line", x1: heightX - 5, y1: top, x2: heightX + 5, y2: top, stroke: "#111", strokeWidth: 0.8 },
      tickB: { kind: "line", x1: heightX - 5, y1: bottom, x2: heightX + 5, y2: bottom, stroke: "#111", strokeWidth: 0.8 },
      text: { x: heightX + 18, y: top + geometry.bounds.height / 2, value: heightLabel, fontSize: 11, fill: "#111", anchor: "middle", rotate: 90 },
    },
  ];
}

function buildProofDrawingModel(
  family: B92ProfileSectionProofFamily,
  view: B92ProfileSectionProofView,
  geometry: B92ProfileSectionProofViewGeometry
): DrawingModel {
  const semanticOverlay = buildB92ProfileSectionProofSemanticOverlay(family.id, view, geometry, VIEWPORT_PAD);
  const proofLines = geometry.lines.map((line) => toDrawingLine(line, geometry));
  const openingLines = proofLines.filter((line) => line.dashed);
  const profileLines = proofLines.filter((line) => !line.dashed);
  const viewBox = {
    width: Math.ceil(geometry.bounds.width + VIEWPORT_PAD * 2 + 72),
    height: Math.ceil(geometry.bounds.height + VIEWPORT_PAD * 2 + 72),
  };

  return {
    width: Math.round(geometry.bounds.width),
    height: Math.round(geometry.bounds.height),
    viewBox,
    elements: [
      { id: "derived-native-frame-fills", role: "frame-fill", shapes: semanticOverlay.frameRegions },
      { id: "derived-native-profile-fills", role: "profile-fill", shapes: semanticOverlay.profileRegions },
      { id: "derived-native-glass-fills", role: "glass", shapes: semanticOverlay.glassRegions },
      { id: "approved-proof-profile-lines", role: "frame", shapes: profileLines },
      { id: "approved-proof-opening-lines", role: "opening-lines", shapes: openingLines },
    ],
    geometry: {
      frame: profileLines,
      sash: [],
      glass: semanticOverlay.glassRegions,
      junctions: semanticOverlay.profileRegions,
    },
    annotations: {
      dimensions: buildDimensions(geometry),
      labels: [
        {
          x: VIEWPORT_PAD,
          y: Math.max(16, VIEWPORT_PAD - 16),
          value: `${family.label} - ${view === "external" ? "External" : "Internal"} proof geometry`,
          fontSize: 12,
          fontWeight: 700,
          fill: "#475569",
          anchor: "start",
          role: "proof-family-label",
        },
      ],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "B92",
      openingDirection: "inward",
      operationType: "admin_b92_profile_section_approved_proof_geometry",
      sectionReferences: [],
      referenceInputs: [
        {
          drawingId: family.id,
          title: family.label,
          purpose: "Approved B92 proof line geometry rendered through the native DrawingViewport style.",
          sourceDxfPath: null,
          sourceSvgPath: geometry.sourceFile,
        },
      ],
      renderSource: "native_drawing_model",
      layerHints: ["approved-b92-profile-section-proof-geometry", view],
      devReports: {
        sourceTimeFlattenedSvgGeometry: true,
        runtimeSvgParsing: false,
        rawSvgDisplay: false,
        segmentCount: geometry.segmentCount,
        sourceBounds: geometry.bounds,
        viewportTranslation: { x: VIEWPORT_PAD - geometry.bounds.x, y: VIEWPORT_PAD - geometry.bounds.y },
        semanticNativeStyling: semanticOverlay.styledFamily,
        semanticNativeStylingNotes: semanticOverlay.notes,
      },
    },
    interaction: {
      cells: [],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}

export default function B92ProfileSectionAssemblyPreview(props: Props) {
  const {
    selectedFamily,
    view,
    onSelectFamily,
    requiresManualFamilySelection = false,
  } = props;

  const proofGeometry = selectedFamily ? getProofGeometry(selectedFamily.id, view) : null;
  const statusLabel = selectedFamily?.status === "accepted-reference-only" ? "accepted reference" : "approved / locked";
  const previewModel = useMemo(
    () => (selectedFamily && proofGeometry ? buildProofDrawingModel(selectedFamily, view, proofGeometry) : null),
    [proofGeometry, selectedFamily, view]
  );

  return (
    <div style={{ padding: 14, display: "grid", gap: 12, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div className="admin-group-title">B92 profile-section assembly proof</div>
            <span
              style={{
                border: "1px solid rgba(34, 197, 94, 0.3)",
                background: "rgba(34, 197, 94, 0.1)",
                color: "#166534",
                borderRadius: 999,
                padding: "3px 8px",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="admin-body-copy">
            Exact approved proof line geometry rendered through the native DrawingViewport style. No raw SVG image is displayed.
          </div>
        </div>
        <label style={{ display: "grid", gap: 5, minWidth: 300 }}>
          <span className="admin-setting-label">Proof family</span>
          <select
            className="admin-input"
            value={selectedFamily?.id ?? ""}
            onChange={(event) => onSelectFamily(event.currentTarget.value)}
          >
            {requiresManualFamilySelection ? <option value="">Select approved proof family</option> : null}
            {B92_PROFILE_SECTION_PROOF_FAMILIES.map((family) => (
              <option key={family.id} value={family.id}>
                {family.group} - {family.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedFamily && previewModel && proofGeometry ? (
        <div style={{ display: "grid", gap: 8, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              color: "#475569",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span>{selectedFamily.label}</span>
            <span>{view === "external" ? "External" : "Internal"} view</span>
            <span>{proofGeometry.segmentCount} approved segments</span>
            <span>{previewModel.metadata.devReports?.semanticNativeStyling ? "Native-style fills" : "Line geometry only"}</span>
          </div>
          <DrawingViewport model={previewModel} minHeight={520} aspectRatio="4 / 3" />
          <div className="admin-body-copy">
            {selectedFamily.notes} {String((previewModel.metadata.devReports?.semanticNativeStylingNotes as string[] | undefined)?.join(" ") ?? "")}
          </div>
        </div>
      ) : (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          No approved B92 proof is mapped to this selected design. Choose an approved proof family above to inspect the
          approved proof geometry in the native preview surface.
        </div>
      )}
    </div>
  );
}
