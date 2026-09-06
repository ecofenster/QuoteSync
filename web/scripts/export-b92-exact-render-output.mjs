import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const tempDir = resolve(root, "node_modules/.tmp");
mkdirSync(tempDir, { recursive: true });

const entryPath = resolve(tempDir, "export-b92-exact-render-output-entry.ts");
const bundlePath = resolve(tempDir, "export-b92-exact-render-output-bundle.mjs");

const outputPath = resolve(
  root,
  "_project/Test/Europa 92 Alu Clad/2 Field/Internal_Fixed_B92-4_B92-5_TTR_RENDER_OUTPUT.svg"
);

writeFileSync(
  entryPath,
  `
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildB92FixedInternalDrawingModelFromContract } from "../../src/features/configurator/rendering/profileResolution/b92ContractDrawingAdapter.ts";

const outputPath = ${JSON.stringify(outputPath)};

function profile(profileId) {
  return { profileId, source: "resolved" };
}

const contract = {
  meta: {
    system: "B92",
    referenceView: "internal",
    validationMode: "external_refs_internal_validation",
    source: "resolver_contract",
    designRule: "Temporary exact-case renderer export contract for Admin Window Types preview.",
    notes: ["Exports current renderer output for B92 internal Fixed + Tilt & Turn Right."],
    dev: {
      b92UseSashOverlapGeometry: true,
      b92UseSegmentResolver: true,
      b92RenderSegmentedSillOverlay: false,
      b92UseJunctionGeometryVisualPilot: false,
    },
  },
  overall: { widthMm: 2000, heightMm: 1000 },
  fields: [
    {
      id: "field-1",
      row: 0,
      column: 0,
      type: "fixed",
      operation: "fixed",
      dimensionsMm: { width: 1000, height: 1000 },
      perimeter: {
        top: profile("B92-1"),
        left: profile("B92-2"),
        right: profile("B92-2"),
        bottom: profile("B92-3"),
      },
      glass: { widthMm: 875, heightMm: 792, source: "renderer_export" },
    },
    {
      id: "field-2",
      row: 0,
      column: 1,
      type: "tilt_turn",
      operation: "tt_right",
      dimensionsMm: { width: 1000, height: 1000 },
      perimeter: {
        top: profile("B92-1"),
        left: profile("B92-2"),
        right: profile("B92-2"),
        bottom: profile("B92-3"),
      },
      sash: {
        operation: "tt_right",
        profiles: {
          top: profile("B92-7"),
          left: profile("B92-9"),
          right: profile("B92-9"),
          bottom: profile("B92-8"),
        },
      },
      glass: { widthMm: 808, heightMm: 754, source: "renderer_export" },
    },
  ],
  verticalJunctions: [
    {
      id: "junction-1",
      orientation: "vertical",
      betweenFieldIds: ["field-1", "field-2"],
      profile: profile("B92-13"),
      condition: "static_mullion",
    },
  ],
  horizontalJunctions: [],
  outerEdgeSegments: [
    { id: "field-1-top", fieldId: "field-1", edge: "top", profile: profile("B92-4") },
    { id: "field-2-top", fieldId: "field-2", edge: "top", profile: profile("B92-7") },
  ],
  sillSegments: [
    { id: "field-1-bottom", fieldId: "field-1", profile: profile("B92-5") },
    { id: "field-2-bottom", fieldId: "field-2", profile: profile("B92-8") },
  ],
  couplings: [],
  corners: [],
  thresholds: [],
  constraints: [],
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmt(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : "0";
}

function shapeToSvg(shape) {
  if (shape.kind === "line") {
    const dashed = shape.dashed ? ' stroke-dasharray="6 6"' : "";
    return '<line x1="' + fmt(shape.x1) + '" y1="' + fmt(shape.y1) + '" x2="' + fmt(shape.x2) + '" y2="' + fmt(shape.y2) + '" stroke="' + escapeXml(shape.stroke || "#111") + '" stroke-width="' + fmt(shape.strokeWidth ?? 1) + '"' + dashed + ' fill="none" data-role="' + escapeXml(shape.role || "") + '"/>';
  }
  if (shape.kind === "rect") {
    return '<rect x="' + fmt(shape.x) + '" y="' + fmt(shape.y) + '" width="' + fmt(shape.width) + '" height="' + fmt(shape.height) + '" stroke="' + escapeXml(shape.stroke || "#111") + '" stroke-width="' + fmt(shape.strokeWidth ?? 1) + '" fill="' + escapeXml(shape.fill ?? "none") + '" data-role="' + escapeXml(shape.role || "") + '"/>';
  }
  return '<polygon points="' + shape.points.map((point) => fmt(point.x) + "," + fmt(point.y)).join(" ") + '" stroke="' + escapeXml(shape.stroke || "#111") + '" stroke-width="' + fmt(shape.strokeWidth ?? 1) + '" stroke-linejoin="bevel" stroke-miterlimit="1" fill="' + escapeXml(shape.fill ?? "none") + '" data-role="' + escapeXml(shape.role || "") + '"/>';
}

function textToSvg(text, role) {
  const rotate = text.rotate ? ' transform="rotate(' + fmt(text.rotate) + ' ' + fmt(text.x) + ' ' + fmt(text.y) + ')"' : "";
  return '<text x="' + fmt(text.x) + '" y="' + fmt(text.y) + '" text-anchor="' + escapeXml(text.anchor || "start") + '" font-size="' + fmt(text.fontSize ?? 10) + '" font-weight="' + escapeXml(text.fontWeight ?? 500) + '" fill="' + escapeXml(text.fill || "#71717a") + '" data-role="' + escapeXml(role || "") + '"' + rotate + '>' + escapeXml(text.value) + '</text>';
}

function markerToSvg(marker) {
  return '<g data-role="' + escapeXml(marker.role || "field_marker") + '"><circle cx="' + fmt(marker.x) + '" cy="' + fmt(marker.y) + '" r="' + fmt(marker.radius) + '" fill="#fff" stroke="#111" stroke-width="1"/><text x="' + fmt(marker.x) + '" y="' + fmt(marker.y + 4) + '" text-anchor="middle" font-size="14" font-weight="600" fill="#111">' + escapeXml(marker.value) + '</text></g>';
}

function dimensionToSvg(dimension) {
  return '<g fill="none" font-family="ui-sans-serif, system-ui, -apple-system" data-role="' + escapeXml(dimension.role || dimension.id || "dimension") + '">' +
    shapeToSvg(dimension.line) +
    shapeToSvg(dimension.tickA) +
    shapeToSvg(dimension.tickB) +
    textToSvg(dimension.text, dimension.role || dimension.id || "dimension_text") +
    '</g>';
}

function drawingModelToSvg(model) {
  const body = [
    '<rect x="0" y="0" width="' + fmt(model.viewBox.width) + '" height="' + fmt(model.viewBox.height) + '" fill="#ffffff"/>',
    ...model.elements.flatMap((element) => element.shapes.map((shape) => shapeToSvg(shape))),
    ...model.annotations.dimensions.map((dimension) => dimensionToSvg(dimension)),
    ...model.annotations.labels.map((label) => textToSvg(label, label.role)),
    ...model.annotations.handles.map((handle) => '<line x1="' + fmt(handle.x) + '" y1="' + fmt(handle.y - handle.size) + '" x2="' + fmt(handle.x) + '" y2="' + fmt(handle.y + handle.size) + '" stroke="#111" stroke-width="1.6" stroke-linecap="round" data-role="' + escapeXml(handle.role || "handle") + '"/>'),
    ...model.annotations.markers.map((marker) => markerToSvg(marker)),
  ].join("\\n  ");
  return '<?xml version="1.0" encoding="UTF-8"?>\\n<svg xmlns="http://www.w3.org/2000/svg" width="' + fmt(model.viewBox.width) + '" height="' + fmt(model.viewBox.height) + '" viewBox="0 0 ' + fmt(model.viewBox.width) + ' ' + fmt(model.viewBox.height) + '">\\n  <title>Current QuoteSuite renderer output: Internal Fixed B92-4/B92-5 + TTR</title>\\n  <desc>Generated from buildB92FixedInternalDrawingModelFromContract, not copied from DXF/SVG reference.</desc>\\n  ' + body + '\\n</svg>\\n';
}

const model = buildB92FixedInternalDrawingModelFromContract(contract);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, drawingModelToSvg(model), "utf8");
console.log(outputPath);
`,
  "utf8"
);

await build({
  entryPoints: [entryPath],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

await import(pathToFileURL(bundlePath).href + `?t=${Date.now()}`);
