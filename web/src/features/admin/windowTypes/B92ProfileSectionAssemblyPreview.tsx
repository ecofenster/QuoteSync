import { useMemo, useState } from "react";
import DrawingViewport from "../../configurator/rendering/DrawingViewport";
import type { DrawingLine, DrawingModel, DrawingRect, DrawingShape } from "../../configurator/rendering/drawingModel";
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
import { B92_RAL_CLASSIC_BY_CODE, B92_RAL_CLASSIC_COLOURS } from "./b92RalClassicColours";
import type { B92ConfiguratorFinishState } from "../../b92Configurator/b92Configurator.types";

type Props = {
  selectedFamily: B92ProfileSectionProofFamily | null;
  view: B92ProfileSectionProofView;
  onSelectFamily: (familyId: string) => void;
  requiresManualFamilySelection?: boolean;
  internalFrameRal: string;
  externalCladdingRal: string;
  finishState?: B92ConfiguratorFinishState;
  onFinishStateChange?: (patch: Partial<B92ConfiguratorFinishState>) => void;
  hideFamilySelector?: boolean;
  hideFinishControls?: boolean;
};

const VIEWPORT_PAD = 42;
const PROOF_STROKE = "#111827";
const OPENING_STROKE = "#64748b";
const NATIVE_FRAME_FILL = "#f4f4f5";

type FinishMode = "native" | "lacquer" | "ral";
type CladdingFinishMode = "native" | "ral";

type ProofFinishSettings = {
  internalMode: FinishMode;
  internalRal: string;
  internalLacquer: string;
  externalRevealMode: FinishMode;
  externalRevealRal: string;
  externalRevealLacquer: string;
  externalCladdingMode: CladdingFinishMode;
  externalCladdingRal: string;
};

type TeknosLacquerOption = {
  id: string;
  label: string;
  url: string;
  tint: string;
};

type ImportMetaWithGlob = ImportMeta & {
  glob: <T>(pattern: string, options: { eager: true; query: string; import: "default" }) => Record<string, T>;
};

const lacquerAssetModules = (import.meta as ImportMetaWithGlob).glob<string>(
  "../../../../_project/Lacquers/**/*.{jpg,jpeg,png,webp,avif}",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

const CLADDING_ZONE_WIDTHS_MM = [78, 32.7, 4.8] as const;
const RAL_DATALIST_ID = "b92-ral-classic-colours";
const LACQUER_PATTERN_SIZE = 96;

const TEKNOS_LACQUER_OPTIONS = Object.entries(lacquerAssetModules)
  .map(([path, url]) => {
    const id = path.split(/[\\/]/).at(-1) ?? path;
    return {
      id,
      label: id.replace(/\.[^.]+$/, "").toUpperCase(),
      url,
      tint: buildLacquerTint(id),
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })) satisfies TeknosLacquerOption[];

const DEFAULT_LACQUER_ID = TEKNOS_LACQUER_OPTIONS[0]?.id ?? "";

function getProofGeometry(familyId: string, view: B92ProfileSectionProofView) {
  return B92_PROFILE_SECTION_PROOF_GEOMETRY.find((family) => family.id === familyId)?.views[view] ?? null;
}

function isOpeningLine(line: B92ProfileSectionProofLine) {
  return Boolean(line.opening || /opening/i.test(line.role ?? ""));
}

function normalizeRal(input: string, fallback = "7016") {
  const cleaned = input.replace(/[^0-9]/g, "").slice(0, 4);
  return cleaned || fallback;
}

function ralColour(input: string) {
  return B92_RAL_CLASSIC_BY_CODE[normalizeRal(input)]?.hex ?? B92_RAL_CLASSIC_BY_CODE["7016"].hex;
}

function ralLabel(input: string) {
  const code = normalizeRal(input);
  const colour = B92_RAL_CLASSIC_BY_CODE[code];
  return colour ? `RAL ${colour.code} ${colour.name}` : `RAL ${code}`;
}

function buildLacquerTint(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  const hue = 24 + (hash % 28);
  const saturation = 20 + (hash % 18);
  const lightness = 42 + (hash % 24);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getLacquerOption(id: string) {
  return TEKNOS_LACQUER_OPTIONS.find((option) => option.id === id) ?? TEKNOS_LACQUER_OPTIONS[0] ?? null;
}

function finishFill(mode: FinishMode, ral: string, lacquerId: string) {
  if (mode === "native") return NATIVE_FRAME_FILL;
  return mode === "ral" ? ralColour(ral) : getLacquerOption(lacquerId)?.tint ?? "#b89b70";
}

function recolorFillShapes(shapes: DrawingShape[], fill: string): DrawingShape[] {
  return shapes.map((shape) => {
    if (shape.kind === "line") return shape;
    return {
      ...shape,
      fill,
      stroke: shape.stroke === "none" ? shape.stroke : shape.stroke ?? "#111827",
    };
  });
}

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return { kind: "rect", strokeWidth: 0, ...input };
}

function isDrawingRect(shape: DrawingShape): shape is DrawingRect {
  return shape.kind === "rect";
}

function translatedProofBoundsRect(geometry: B92ProfileSectionProofViewGeometry, fill: string, role: string) {
  return rect({
    x: VIEWPORT_PAD,
    y: VIEWPORT_PAD,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
    fill,
    stroke: "none",
    role,
  });
}

function subtractRectHoles(base: DrawingRect, holes: DrawingRect[], fill: string, role: string) {
  const xStops = new Set([base.x, base.x + base.width]);
  const yStops = new Set([base.y, base.y + base.height]);

  for (const hole of holes) {
    xStops.add(Math.max(base.x, Math.min(base.x + base.width, hole.x)));
    xStops.add(Math.max(base.x, Math.min(base.x + base.width, hole.x + hole.width)));
    yStops.add(Math.max(base.y, Math.min(base.y + base.height, hole.y)));
    yStops.add(Math.max(base.y, Math.min(base.y + base.height, hole.y + hole.height)));
  }

  const xs = [...xStops].sort((a, b) => a - b);
  const ys = [...yStops].sort((a, b) => a - b);
  const regions: DrawingRect[] = [];

  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const x = xs[xIndex];
      const y = ys[yIndex];
      const width = xs[xIndex + 1] - x;
      const height = ys[yIndex + 1] - y;
      if (width <= 0.01 || height <= 0.01) continue;

      const coveredByHole = holes.some(
        (hole) =>
          x >= hole.x - 0.01 &&
          y >= hole.y - 0.01 &&
          x + width <= hole.x + hole.width + 0.01 &&
          y + height <= hole.y + hole.height + 0.01
      );
      if (coveredByHole) continue;

      regions.push(rect({ x, y, width, height, fill, stroke: "none", role }));
    }
  }

  return regions;
}

function buildGlassSafeProofSurfaceRegions(
  geometry: B92ProfileSectionProofViewGeometry,
  glassRegions: DrawingShape[],
  fill: string,
  role: string
) {
  const base = translatedProofBoundsRect(geometry, fill, role);
  const glassHoles = glassRegions.filter(isDrawingRect);
  return subtractRectHoles(base, glassHoles, fill, role);
}

function buildInternalFinishRegions(
  geometry: B92ProfileSectionProofViewGeometry,
  semanticGlassRegions: DrawingShape[],
  semanticProfileRegions: DrawingShape[],
  fill: string
) {
  return [
    ...buildGlassSafeProofSurfaceRegions(geometry, semanticGlassRegions, fill, "b92-proof-finish-internal-timber-surface"),
    ...recolorFillShapes(semanticProfileRegions, fill),
  ];
}

function buildExternalRevealRegions(geometry: B92ProfileSectionProofViewGeometry, fill: string): DrawingRect[] {
  const left = VIEWPORT_PAD;
  const top = VIEWPORT_PAD;
  const right = VIEWPORT_PAD + geometry.bounds.width;
  const bottom = VIEWPORT_PAD + geometry.bounds.height;
  return [
    rect({ x: left, y: top, width: geometry.bounds.width, height: 3, fill, stroke: "none", role: "b92-proof-finish-external-reveal-top-3mm" }),
    rect({ x: left, y: top, width: 3, height: geometry.bounds.height, fill, stroke: "none", role: "b92-proof-finish-external-reveal-left-3mm" }),
    rect({ x: right - 3, y: top, width: 3, height: geometry.bounds.height, fill, stroke: "none", role: "b92-proof-finish-external-reveal-right-3mm" }),
    rect({ x: left, y: bottom - 18, width: geometry.bounds.width, height: 18, fill, stroke: "none", role: "b92-proof-finish-external-reveal-bottom-18mm" }),
  ];
}

function buildExternalCladdingRegions(geometry: B92ProfileSectionProofViewGeometry, fill: string): DrawingRect[] {
  const left = VIEWPORT_PAD;
  const top = VIEWPORT_PAD;
  const right = VIEWPORT_PAD + geometry.bounds.width;
  const bottom = VIEWPORT_PAD + geometry.bounds.height;
  const regions: DrawingRect[] = [];
  let offset = 3;

  for (const zoneWidth of CLADDING_ZONE_WIDTHS_MM) {
    regions.push(
      rect({
        x: left + offset,
        y: top + offset,
        width: Math.max(0, geometry.bounds.width - offset * 2),
        height: zoneWidth,
        fill,
        stroke: "none",
        role: `b92-proof-finish-external-cladding-top-${zoneWidth}mm`,
      }),
      rect({
        x: left + offset,
        y: bottom - offset - zoneWidth,
        width: Math.max(0, geometry.bounds.width - offset * 2),
        height: zoneWidth,
        fill,
        stroke: "none",
        role: `b92-proof-finish-external-cladding-bottom-${zoneWidth}mm`,
      }),
      rect({
        x: left + offset,
        y: top + offset,
        width: zoneWidth,
        height: Math.max(0, geometry.bounds.height - offset * 2),
        fill,
        stroke: "none",
        role: `b92-proof-finish-external-cladding-left-${zoneWidth}mm`,
      }),
      rect({
        x: right - offset - zoneWidth,
        y: top + offset,
        width: zoneWidth,
        height: Math.max(0, geometry.bounds.height - offset * 2),
        fill,
        stroke: "none",
        role: `b92-proof-finish-external-cladding-right-${zoneWidth}mm`,
      })
    );
    offset += zoneWidth;
  }

  return regions;
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
  geometry: B92ProfileSectionProofViewGeometry,
  finishes: ProofFinishSettings
): DrawingModel {
  const semanticOverlay = buildB92ProfileSectionProofSemanticOverlay(family.id, view, geometry, VIEWPORT_PAD);
  const internalFinishFill = finishFill(finishes.internalMode, finishes.internalRal, finishes.internalLacquer);
  const externalRevealFill = finishFill(finishes.externalRevealMode, finishes.externalRevealRal, finishes.externalRevealLacquer);
  const externalCladdingFill = ralColour(finishes.externalCladdingRal);
  const internalFinishRegions = buildInternalFinishRegions(
    geometry,
    semanticOverlay.glassRegions,
    semanticOverlay.profileRegions,
    internalFinishFill
  );
  const frameRegions =
    view === "internal"
      ? internalFinishRegions
      : buildGlassSafeProofSurfaceRegions(
          geometry,
          semanticOverlay.glassRegions,
          NATIVE_FRAME_FILL,
          "b92-proof-native-external-frame-surface"
        );
  const profileRegions = view === "internal" ? [] : recolorFillShapes(semanticOverlay.profileRegions, NATIVE_FRAME_FILL);
  const finishRegions =
    view === "external"
      ? [
          ...(finishes.externalRevealMode === "native" ? [] : buildExternalRevealRegions(geometry, externalRevealFill)),
          ...(finishes.externalCladdingMode === "native" ? [] : buildExternalCladdingRegions(geometry, externalCladdingFill)),
        ]
      : [];
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
      { id: "derived-native-frame-fills", role: "frame-fill", shapes: frameRegions },
      { id: "derived-native-profile-fills", role: "profile-fill", shapes: profileRegions },
      { id: "selected-finish-preview-zones", role: "finish-preview", shapes: finishRegions },
      { id: "derived-native-glass-fills", role: "glass", shapes: semanticOverlay.glassRegions },
      { id: "approved-proof-profile-lines", role: "frame", shapes: profileLines },
      { id: "approved-proof-opening-lines", role: "opening-lines", shapes: openingLines },
    ],
    geometry: {
      frame: profileLines,
      sash: [],
      glass: semanticOverlay.glassRegions,
      junctions: profileRegions,
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
        finishPreview: {
          internalMode: finishes.internalMode,
          internalRal: normalizeRal(finishes.internalRal),
          internalLacquer: finishes.internalLacquer,
          externalRevealMode: finishes.externalRevealMode,
          externalRevealRal: normalizeRal(finishes.externalRevealRal),
          externalRevealLacquer: finishes.externalRevealLacquer,
          externalCladdingMode: finishes.externalCladdingMode,
          externalCladdingRal: normalizeRal(finishes.externalCladdingRal),
          lacquerAssetsServedByApp: TEKNOS_LACQUER_OPTIONS.length > 0,
          lacquerAssetCount: TEKNOS_LACQUER_OPTIONS.length,
          ralClassicColourCount: B92_RAL_CLASSIC_COLOURS.length,
        },
      },
    },
    interaction: {
      cells: [],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}

function buildLacquerPatternShapes(
  family: B92ProfileSectionProofFamily,
  view: B92ProfileSectionProofView,
  geometry: B92ProfileSectionProofViewGeometry,
  finishes: ProofFinishSettings
) {
  if (view === "internal" && finishes.internalMode === "lacquer") {
    const semanticOverlay = buildB92ProfileSectionProofSemanticOverlay(family.id, view, geometry, VIEWPORT_PAD);
    return buildInternalFinishRegions(
      geometry,
      semanticOverlay.glassRegions,
      semanticOverlay.profileRegions,
      finishFill("lacquer", finishes.internalRal, finishes.internalLacquer)
    );
  }

  if (view === "external" && finishes.externalRevealMode === "lacquer") {
    return buildExternalRevealRegions(geometry, "none");
  }

  return [];
}

function Swatch(props: { fill: string; label: string; lacquer?: TeknosLacquerOption | null }) {
  const background = props.lacquer ? `url(${props.lacquer.url}) center / cover` : props.fill;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "#475569", fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 24, height: 18, borderRadius: 4, border: "1px solid #94a3b8", background }} />
      {props.label}
    </span>
  );
}

function FinishModeSelect(props: { value: FinishMode; onChange: (value: FinishMode) => void }) {
  return (
    <select className="admin-input" value={props.value} onChange={(event) => props.onChange(event.currentTarget.value as FinishMode)}>
      <option value="native">Native Render</option>
      <option value="lacquer">Lacquer</option>
      <option value="ral">RAL</option>
    </select>
  );
}

function CladdingFinishModeSelect(props: { value: CladdingFinishMode; onChange: (value: CladdingFinishMode) => void }) {
  return (
    <select
      className="admin-input"
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value as CladdingFinishMode)}
    >
      <option value="native">Native Render</option>
      <option value="ral">RAL</option>
    </select>
  );
}

function RalInput(props: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className="admin-input"
      value={props.value}
      inputMode="numeric"
      maxLength={4}
      list={RAL_DATALIST_ID}
      onChange={(event) => props.onChange(normalizeRal(event.currentTarget.value, ""))}
      placeholder="7016"
    />
  );
}

function LacquerPicker(props: { value: string; onChange: (value: string) => void }) {
  if (TEKNOS_LACQUER_OPTIONS.length === 0) {
    return <div className="admin-body-copy">No lacquer assets found in _project/Lacquers.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select className="admin-input" value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>
        {TEKNOS_LACQUER_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        {TEKNOS_LACQUER_OPTIONS.map((option) => {
          const selected = option.id === props.value;
          return (
            <button
              key={option.id}
              type="button"
              title={option.label}
              aria-label={option.label}
              onClick={() => props.onChange(option.id)}
              style={{
                width: 28,
                height: 22,
                flex: "0 0 auto",
                borderRadius: 4,
                border: selected ? "2px solid #0f766e" : "1px solid #94a3b8",
                background: `url(${option.url}) center / cover`,
                boxShadow: selected ? "0 0 0 2px rgba(15, 118, 110, 0.18)" : "none",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RalDatalist() {
  return (
    <datalist id={RAL_DATALIST_ID}>
      {B92_RAL_CLASSIC_COLOURS.map((colour) => (
        <option key={colour.code} value={colour.code}>
          {colour.name}
        </option>
      ))}
    </datalist>
  );
}

function LacquerPatternOverlay(props: { model: DrawingModel; shapes: DrawingShape[]; lacquer: TeknosLacquerOption | null }) {
  if (!props.lacquer || props.shapes.length === 0) return null;

  const patternId = `b92-lacquer-${props.lacquer.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <svg
      viewBox={`0 0 ${props.model.viewBox.width} ${props.model.viewBox.height}`}
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={LACQUER_PATTERN_SIZE} height={LACQUER_PATTERN_SIZE}>
          <image
            href={props.lacquer.url}
            width={LACQUER_PATTERN_SIZE}
            height={LACQUER_PATTERN_SIZE}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      </defs>
      {props.shapes.map((shape, index) => {
        if (shape.kind === "rect") {
          return (
            <rect
              key={`${shape.role ?? "lacquer-rect"}-${index}`}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill={`url(#${patternId})`}
              opacity={0.62}
            />
          );
        }
        if (shape.kind === "polygon") {
          return (
            <polygon
              key={`${shape.role ?? "lacquer-polygon"}-${index}`}
              points={shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill={`url(#${patternId})`}
              opacity={0.62}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

export default function B92ProfileSectionAssemblyPreview(props: Props) {
  const {
    selectedFamily,
    view,
    onSelectFamily,
    requiresManualFamilySelection = false,
    internalFrameRal,
    externalCladdingRal,
    finishState,
    onFinishStateChange,
    hideFamilySelector = false,
    hideFinishControls = false,
  } = props;
  const [internalModeState, setInternalModeState] = useState<FinishMode>("native");
  const [internalRalState, setInternalRalState] = useState(() => normalizeRal(internalFrameRal || "7016"));
  const [internalLacquerState, setInternalLacquerState] = useState(DEFAULT_LACQUER_ID);
  const [externalRevealModeState, setExternalRevealModeState] = useState<FinishMode>("native");
  const [externalRevealRalState, setExternalRevealRalState] = useState(() => normalizeRal(internalFrameRal || "7016"));
  const [externalRevealLacquerState, setExternalRevealLacquerState] = useState(DEFAULT_LACQUER_ID);
  const [externalCladdingModeState, setExternalCladdingModeState] = useState<CladdingFinishMode>("native");
  const [externalCladdingRalValueState, setExternalCladdingRalValueState] = useState(() => normalizeRal(externalCladdingRal || "7016"));
  const internalMode = finishState?.internalMode ?? internalModeState;
  const internalRal = finishState?.internalRal ?? internalRalState;
  const internalLacquer = finishState?.internalLacquerId ?? internalLacquerState;
  const externalRevealMode = finishState?.externalRevealMode ?? externalRevealModeState;
  const externalRevealRal = finishState?.externalRevealRal ?? externalRevealRalState;
  const externalRevealLacquer = finishState?.externalRevealLacquerId ?? externalRevealLacquerState;
  const externalCladdingMode = finishState?.externalCladdingMode ?? externalCladdingModeState;
  const externalCladdingRalValue = finishState?.externalCladdingRal ?? externalCladdingRalValueState;
  const setControlledFinish = <Key extends keyof B92ConfiguratorFinishState>(key: Key, value: B92ConfiguratorFinishState[Key]) => {
    onFinishStateChange?.({ [key]: value } as Partial<B92ConfiguratorFinishState>);
  };
  const setInternalModeValue = (value: FinishMode) => {
    setInternalModeState(value);
    setControlledFinish("internalMode", value);
  };
  const setInternalRalValue = (value: string) => {
    setInternalRalState(value);
    setControlledFinish("internalRal", value);
  };
  const setInternalLacquerValue = (value: string) => {
    setInternalLacquerState(value);
    setControlledFinish("internalLacquerId", value);
  };
  const setExternalRevealModeValue = (value: FinishMode) => {
    setExternalRevealModeState(value);
    setControlledFinish("externalRevealMode", value);
  };
  const setExternalRevealRalValue = (value: string) => {
    setExternalRevealRalState(value);
    setControlledFinish("externalRevealRal", value);
  };
  const setExternalRevealLacquerValue = (value: string) => {
    setExternalRevealLacquerState(value);
    setControlledFinish("externalRevealLacquerId", value);
  };
  const setExternalCladdingModeValue = (value: CladdingFinishMode) => {
    setExternalCladdingModeState(value);
    setControlledFinish("externalCladdingMode", value);
  };
  const setExternalCladdingRalValue = (value: string) => {
    setExternalCladdingRalValueState(value);
    setControlledFinish("externalCladdingRal", value);
  };
  const finishes = useMemo<ProofFinishSettings>(
    () => ({
      internalMode,
      internalRal,
      internalLacquer,
      externalRevealMode,
      externalRevealRal,
      externalRevealLacquer,
      externalCladdingMode,
      externalCladdingRal: externalCladdingRalValue,
    }),
    [
      externalCladdingMode,
      externalCladdingRalValue,
      externalRevealLacquer,
      externalRevealMode,
      externalRevealRal,
      internalLacquer,
      internalMode,
      internalRal,
    ]
  );

  const proofGeometry = selectedFamily ? getProofGeometry(selectedFamily.id, view) : null;
  const statusLabel = selectedFamily?.status === "accepted-reference-only" ? "accepted reference" : "approved / locked";
  const previewModel = useMemo(
    () => (selectedFamily && proofGeometry ? buildProofDrawingModel(selectedFamily, view, proofGeometry, finishes) : null),
    [finishes, proofGeometry, selectedFamily, view]
  );
  const lacquerOverlayShapes = useMemo(
    () => (selectedFamily && proofGeometry ? buildLacquerPatternShapes(selectedFamily, view, proofGeometry, finishes) : []),
    [finishes, proofGeometry, selectedFamily, view]
  );
  const activeLacquerOption =
    view === "internal" && internalMode === "lacquer"
      ? getLacquerOption(internalLacquer)
      : view === "external" && externalRevealMode === "lacquer"
        ? getLacquerOption(externalRevealLacquer)
        : null;

  return (
    <div style={{ padding: 14, display: "grid", gap: 12, minHeight: 0 }}>
      <RalDatalist />
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
        {hideFamilySelector ? null : (
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
        )}
      </div>

      {hideFinishControls ? null : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            alignItems: "end",
          }}
        >
        <div style={{ display: "grid", gap: 5 }}>
          <span className="admin-setting-label">Internal finish</span>
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1fr", gap: 6 }}>
            <FinishModeSelect value={internalMode} onChange={setInternalModeValue} />
            {internalMode === "native" ? (
              <Swatch fill={NATIVE_FRAME_FILL} label="Native Render" />
            ) : internalMode === "ral" ? (
              <RalInput value={internalRal} onChange={setInternalRalValue} />
            ) : (
              <LacquerPicker value={internalLacquer} onChange={setInternalLacquerValue} />
            )}
          </div>
          <Swatch
            fill={finishFill(internalMode, internalRal, internalLacquer)}
            lacquer={internalMode === "lacquer" ? getLacquerOption(internalLacquer) : null}
            label={
              internalMode === "native"
                ? "Native Render"
                : internalMode === "ral"
                  ? ralLabel(internalRal)
                  : getLacquerOption(internalLacquer)?.label ?? "Lacquer"
            }
          />
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <span className="admin-setting-label">External reveal finish</span>
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1fr", gap: 6 }}>
            <FinishModeSelect value={externalRevealMode} onChange={setExternalRevealModeValue} />
            {externalRevealMode === "native" ? (
              <Swatch fill={NATIVE_FRAME_FILL} label="Native Render" />
            ) : externalRevealMode === "ral" ? (
              <RalInput value={externalRevealRal} onChange={setExternalRevealRalValue} />
            ) : (
              <LacquerPicker value={externalRevealLacquer} onChange={setExternalRevealLacquerValue} />
            )}
          </div>
          <Swatch
            fill={finishFill(externalRevealMode, externalRevealRal, externalRevealLacquer)}
            lacquer={externalRevealMode === "lacquer" ? getLacquerOption(externalRevealLacquer) : null}
            label={
              externalRevealMode === "native"
                ? "Native Render"
                : externalRevealMode === "ral"
                  ? ralLabel(externalRevealRal)
                  : getLacquerOption(externalRevealLacquer)?.label ?? "Lacquer"
            }
          />
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <span className="admin-setting-label">External cladding finish</span>
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1fr", gap: 6 }}>
            <CladdingFinishModeSelect value={externalCladdingMode} onChange={setExternalCladdingModeValue} />
            {externalCladdingMode === "native" ? (
              <Swatch fill={NATIVE_FRAME_FILL} label="Native Render" />
            ) : (
              <RalInput value={externalCladdingRalValue} onChange={setExternalCladdingRalValue} />
            )}
          </div>
          <Swatch
            fill={externalCladdingMode === "native" ? NATIVE_FRAME_FILL : ralColour(externalCladdingRalValue)}
            label={externalCladdingMode === "native" ? "Native Render" : ralLabel(externalCladdingRalValue)}
          />
        </div>
        </div>
      )}

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
          <DrawingViewport
            model={previewModel}
            minHeight={520}
            aspectRatio="4 / 3"
            overlay={<LacquerPatternOverlay model={previewModel} shapes={lacquerOverlayShapes} lacquer={activeLacquerOption} />}
          />
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
