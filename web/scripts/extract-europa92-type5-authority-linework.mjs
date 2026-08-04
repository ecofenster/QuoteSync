import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceDxfPath = resolve("_project/Test/Europa 92 Alu Clad/2 Field/Table_Test/2 Field, Type 5.dxf");
const outputPath = resolve("src/features/configurator/rendering/authorityFixtures/europa92Type5InternalLinework.generated.ts");
const raw = readFileSync(sourceDxfPath, "utf8").split(/\r?\n/);

function pairsFrom(start, end) {
  const pairs = [];
  for (let index = start; index < end - 1; index += 2) {
    pairs.push({ code: raw[index].trim(), value: raw[index + 1]?.trim() ?? "", line: index + 1 });
  }
  return pairs;
}

function pairValue(pairs, code) {
  return pairs.find((pair) => pair.code === code)?.value ?? null;
}

function numericPairValue(pairs, code) {
  const value = pairValue(pairs, code);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boundsFor(entities) {
  const xs = [];
  const ys = [];
  for (const entity of entities) {
    if (entity.type === "LINE") {
      xs.push(entity.x1, entity.x2);
      ys.push(entity.y1, entity.y2);
    } else if (entity.type === "CIRCLE") {
      xs.push(entity.cx - entity.r, entity.cx + entity.r);
      ys.push(entity.cy - entity.r, entity.cy + entity.r);
    } else if (entity.type === "TEXT") {
      xs.push(entity.x);
      ys.push(entity.y);
    }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

let section = "";
const entities = [];
for (let index = 0; index < raw.length - 1; index += 2) {
  const code = raw[index].trim();
  const value = raw[index + 1]?.trim() ?? "";
  if (code === "0" && value === "SECTION") continue;
  if (code === "2" && index >= 2 && raw[index - 2]?.trim() === "0" && raw[index - 1]?.trim() === "SECTION") {
    section = value;
    continue;
  }
  if (code === "0" && value === "ENDSEC") {
    section = "";
    continue;
  }
  if (section !== "ENTITIES" || code !== "0") continue;
  const type = value;
  let end = index + 2;
  while (end < raw.length - 1 && raw[end].trim() !== "0") end += 2;
  const pairs = pairsFrom(index + 2, end);
  const layer = pairValue(pairs, "8") ?? "";
  const handle = pairValue(pairs, "5") ?? "";
  if (type === "LINE") {
    const x1 = numericPairValue(pairs, "10");
    const y1 = numericPairValue(pairs, "20");
    const x2 = numericPairValue(pairs, "11");
    const y2 = numericPairValue(pairs, "21");
    if ([x1, y1, x2, y2].every((item) => typeof item === "number")) {
      entities.push({ type, layer, handle, line: index + 1, x1, y1, x2, y2 });
    }
  } else if (type === "CIRCLE") {
    const cx = numericPairValue(pairs, "10");
    const cy = numericPairValue(pairs, "20");
    const r = numericPairValue(pairs, "40");
    if ([cx, cy, r].every((item) => typeof item === "number")) {
      entities.push({ type, layer, handle, line: index + 1, cx, cy, r });
    }
  } else if (type === "TEXT") {
    const x = numericPairValue(pairs, "10");
    const y = numericPairValue(pairs, "20");
    const valueText = pairValue(pairs, "1") ?? "";
    const height = numericPairValue(pairs, "40") ?? 20;
    if (typeof x === "number" && typeof y === "number" && valueText) {
      entities.push({ type, layer, handle, line: index + 1, x, y, height, value: valueText });
    }
  }
  index = end - 2;
}

const geometryLines = entities.filter((entity) => entity.type === "LINE" && entity.layer === "Medis hatch");
const annotationEntities = entities.filter((entity) => !(entity.type === "LINE" && entity.layer === "Medis hatch"));
const annotationLines = annotationEntities.filter((entity) => entity.type === "LINE");
const annotationCircles = annotationEntities.filter((entity) => entity.type === "CIRCLE");
const annotationTexts = annotationEntities.filter((entity) => entity.type === "TEXT");
const allBounds = boundsFor(entities);
const geometryBounds = boundsFor(geometryLines);
const geometryLayers = Array.from(new Set(geometryLines.map((entity) => entity.layer))).sort();
const annotationLayers = Array.from(new Set(annotationEntities.map((entity) => entity.layer))).sort();
const normalizeWidth = 720;
const normalizeHeight = 360;
const sourceWidth = geometryBounds.maxX - geometryBounds.minX;
const sourceHeight = geometryBounds.maxY - geometryBounds.minY;
const scale = Math.min(normalizeWidth / sourceWidth, normalizeHeight / sourceHeight);
const normalizedBounds = {
  minX: 0,
  minY: 0,
  maxX: Number((sourceWidth * scale).toFixed(6)),
  maxY: Number((sourceHeight * scale).toFixed(6)),
};

const lineForTs = (entity) => ({
  type: entity.type,
  layer: entity.layer,
  handle: entity.handle,
  sourceLine: entity.line,
  x1: entity.x1,
  y1: entity.y1,
  x2: entity.x2,
  y2: entity.y2,
});
const circleForTs = (entity) => ({
  type: entity.type,
  layer: entity.layer,
  handle: entity.handle,
  sourceLine: entity.line,
  cx: entity.cx,
  cy: entity.cy,
  r: entity.r,
});
const textForTs = (entity) => ({
  type: entity.type,
  layer: entity.layer,
  handle: entity.handle,
  sourceLine: entity.line,
  x: entity.x,
  y: entity.y,
  height: entity.height,
  value: entity.value,
});

const output = `// Generated by scripts/extract-europa92-type5-authority-linework.mjs\n// Source: _project/Test/Europa 92 Alu Clad/2 Field/Table_Test/2 Field, Type 5.dxf\n// Do not edit by hand; regenerate from the approved authority DXF.\n\nexport type Europa92Type5AuthorityLine = {\n  type: "LINE";\n  layer: string;\n  handle: string;\n  sourceLine: number;\n  x1: number;\n  y1: number;\n  x2: number;\n  y2: number;\n};\n\nexport type Europa92Type5AuthorityCircle = {\n  type: "CIRCLE";\n  layer: string;\n  handle: string;\n  sourceLine: number;\n  cx: number;\n  cy: number;\n  r: number;\n};\n\nexport type Europa92Type5AuthorityText = {\n  type: "TEXT";\n  layer: string;\n  handle: string;\n  sourceLine: number;\n  x: number;\n  y: number;\n  height: number;\n  value: string;\n};\n\nexport const EUROPA92_TYPE5_AUTHORITY_LINEWORK_SOURCE = ${JSON.stringify({
  dxfPath: "_project/Test/Europa 92 Alu Clad/2 Field/Table_Test/2 Field, Type 5.dxf",
  includedSections: ["ENTITIES"],
  geometryRule: "Render only LINE entities on layer Medis hatch. Other extracted ENTITIES are authority annotations and are excluded from visual preview.",
  renderedEntityTypes: ["LINE"],
  renderedLayers: geometryLayers,
  excludedAnnotationEntityTypes: ["LINE", "CIRCLE", "TEXT"],
  ignoredEntityTypes: ["MTEXT", "ACAD_TABLE", "INSERT", "LWPOLYLINE", "ARC", "HATCH"],
  allExtractedBounds: allBounds,
  bounds: geometryBounds,
  normalizedBounds,
  scale,
  renderedEntityCount: geometryLines.length,
  excludedAnnotationEntityCount: annotationEntities.length,
  extractedEntityTypeCounts: countBy(entities, "type"),
  renderedLayerCounts: countBy(geometryLines, "layer"),
  excludedAnnotationLayerCounts: countBy(annotationEntities, "layer"),
  renderedLayers: geometryLayers,
  excludedAnnotationLayers: annotationLayers,
}, null, 2)} as const;\n\nexport const EUROPA92_TYPE5_AUTHORITY_GEOMETRY_LINES = ${JSON.stringify(geometryLines.map(lineForTs), null, 2)} as const satisfies readonly Europa92Type5AuthorityLine[];\n\nexport const EUROPA92_TYPE5_AUTHORITY_ANNOTATION_LINES = ${JSON.stringify(annotationLines.map(lineForTs), null, 2)} as const satisfies readonly Europa92Type5AuthorityLine[];\n\nexport const EUROPA92_TYPE5_AUTHORITY_ANNOTATION_CIRCLES = ${JSON.stringify(annotationCircles.map(circleForTs), null, 2)} as const satisfies readonly Europa92Type5AuthorityCircle[];\n\nexport const EUROPA92_TYPE5_AUTHORITY_ANNOTATION_TEXTS = ${JSON.stringify(annotationTexts.map(textForTs), null, 2)} as const satisfies readonly Europa92Type5AuthorityText[];\n`;

writeFileSync(outputPath, output, "utf8");
console.log(JSON.stringify({
  sourceDxfPath,
  outputPath,
  geometryLineCount: geometryLines.length,
  annotationLineCount: annotationLines.length,
  annotationCircleCount: annotationCircles.length,
  annotationTextCount: annotationTexts.length,
  annotationEntityCount: annotationEntities.length,
  renderedLayers: geometryLayers,
  excludedAnnotationLayers: annotationLayers,
  bounds: geometryBounds,
  normalizedBounds,
  allExtractedBounds: allBounds,
}, null, 2));
