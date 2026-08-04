import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const explodedDir = resolve(root, "_project/Test/Exploded");
const internalSource = resolve(explodedDir, "what_window_type_B92_references.dxf");
const internalOutput = resolve(explodedDir, "B92_18_FLYING_MULLION_INTERNAL_REASSEMBLED_PROOF.svg");
const externalSource = resolve(explodedDir, "what_window_type2_B92_references.dxf");
const externalOutput = resolve(explodedDir, "B92_18_FLYING_MULLION_EXTERNAL_REASSEMBLED_PROOF.svg");

function parseDxfLines(filePath) {
  const raw = readFileSync(filePath, "utf8").split(/\r?\n/);
  const pairs = [];
  for (let index = 0; index < raw.length - 1; index += 2) {
    pairs.push([raw[index].trim(), raw[index + 1].trim()]);
  }

  const entities = [];
  let inEntities = false;
  let current = null;
  for (const [code, value] of pairs) {
    if (code === "2" && value === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (inEntities && code === "0" && value === "ENDSEC") break;
    if (!inEntities) continue;
    if (code === "0") {
      if (current) entities.push(current);
      current = { type: value, values: {} };
      continue;
    }
    if (!current) continue;
    current.values[code] ??= [];
    current.values[code].push(value);
  }
  if (current) entities.push(current);

  return entities
    .filter((entity) => entity.type === "LINE")
    .map((entity, index) => ({
      index,
      layer: entity.values["8"]?.[0] ?? "",
      x1: Number(entity.values["10"]?.[0]),
      y1: Number(entity.values["20"]?.[0]),
      x2: Number(entity.values["11"]?.[0]),
      y2: Number(entity.values["21"]?.[0]),
      linetype: entity.values["6"]?.[0] ?? "CONTINUOUS",
    }));
}

function shift(line, dx = 0, dy = 0) {
  return {
    ...line,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmt(value) {
  return Number(value.toFixed(3)).toString();
}

function bbox(lines) {
  return {
    minX: Math.min(...lines.flatMap((line) => [line.x1, line.x2])),
    minY: Math.min(...lines.flatMap((line) => [line.y1, line.y2])),
    maxX: Math.max(...lines.flatMap((line) => [line.x1, line.x2])),
    maxY: Math.max(...lines.flatMap((line) => [line.y1, line.y2])),
  };
}

function normalize(lines, padding = 40) {
  const bounds = bbox(lines);
  return {
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
    lines: lines.map((line) => ({
      ...line,
      x1: line.x1 - bounds.minX + padding,
      y1: bounds.maxY - line.y1 + padding,
      x2: line.x2 - bounds.minX + padding,
      y2: bounds.maxY - line.y2 + padding,
    })),
  };
}

const transformByIndex = new Map([
  // outer frame top/bottom pieces prove 100 mm vertical explosion against side endpoints
  [0, { dx: 0, dy: 100 }],
  [3, { dx: 0, dy: 100 }],
  [4, { dx: 0, dy: -100 }],
  [5, { dx: 0, dy: -100 }],
  // left outer/frame profile proves 100 mm horizontal explosion against shifted top/bottom returns
  [2, { dx: 100, dy: 0 }],
  [6, { dx: 100, dy: 0 }],
  [10, { dx: 100, dy: 0 }],
  [11, { dx: 100, dy: 0 }],
  [25, { dx: 100, dy: 0 }],
  [49, { dx: 100, dy: 0 }],
  // internal top/bottom profile pieces prove 100 mm vertical explosion against existing sash/centre verticals
  [12, { dx: 0, dy: -100 }],
  [13, { dx: 0, dy: -100 }],
  [14, { dx: 0, dy: -100 }],
  [15, { dx: 0, dy: -100 }],
  [20, { dx: 0, dy: 100 }],
  [21, { dx: 0, dy: 100 }],
  [22, { dx: 0, dy: 100 }],
  [23, { dx: 0, dy: 100 }],
  // left sash top/bottom members
  [27, { dx: 0, dy: -100 }],
  [26, { dx: 100, dy: 0 }],
  [29, { dx: 100, dy: 0 }],
  [31, { dx: 100, dy: 0 }],
  [32, { dx: 0, dy: 100 }],
  // right sash top/bottom members
  [35, { dx: 0, dy: -100 }],
  [36, { dx: 0, dy: -100 }],
  [42, { dx: 0, dy: 100 }],
  [46, { dx: 0, dy: 100 }],
  // right outer/frame profile is already authored in contact; no x shift applied
]);

const physicalGroupByIndex = new Map([
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 25, 42, 45, 48, 49, 50].map((index) => [index, "outer_frame_group"]),
  ...[26, 27, 28, 29, 30, 31, 32, 33].map((index) => [index, "left_sash_group"]),
  ...[34, 35, 36, 37, 38, 39, 40, 41, 46].map((index) => [index, "right_sash_group"]),
  ...[16, 17, 18, 19, 43, 44, 47].map((index) => [index, "b92_18_flying_mullion_group"]),
  [24, "opening_dashed_group"],
]);

function buildGroups(lines) {
  const groups = new Map([
    ["outer_frame_group", []],
    ["left_sash_group", []],
    ["right_sash_group", []],
    ["b92_18_flying_mullion_group", []],
    ["opening_dashed_group", []],
    ["non_medis_authored_lines", []],
  ]);

  for (const line of lines) {
    const transform = transformByIndex.get(line.index) ?? { dx: 0, dy: 0 };
    const rendered = shift(line, transform.dx, transform.dy);
    const groupId =
      line.layer !== "Medis hatch"
        ? "non_medis_authored_lines"
        : physicalGroupByIndex.get(line.index) ?? "non_medis_authored_lines";
    groups.get(groupId).push(rendered);
  }

  return [...groups.entries()].map(([id, groupLines]) => ({ id, lines: groupLines }));
}

function pointKey(x, y) {
  return `${fmt(x)},${fmt(y)}`;
}

function endpointJoin(lines, aIndex, bIndex) {
  const a = lines.find((line) => line.index === aIndex);
  const b = lines.find((line) => line.index === bIndex);
  const aPoints = [pointKey(a.x1, a.y1), pointKey(a.x2, a.y2)];
  const bPoints = [pointKey(b.x1, b.y1), pointKey(b.x2, b.y2)];
  return aPoints.find((point) => bPoints.includes(point)) ?? null;
}

function svgFor(groups, title, desc) {
  const sourceLines = groups.flatMap((group) => group.lines);
  const normalized = normalize(sourceLines);
  let normalizedIndex = 0;
  let lineIndex = 1;
  const body = [];

  for (const group of groups) {
    for (const line of group.lines) {
      const rendered = normalized.lines[normalizedIndex];
      const dashed = rendered.linetype === "DASHED" ? ' stroke-dasharray="10 10"' : "";
      body.push(
        `  <line id="${escapeXml(group.id)}-${lineIndex}" data-group="${escapeXml(group.id)}" data-source-index="${line.index}" data-layer="${escapeXml(line.layer)}" x1="${fmt(rendered.x1)}" y1="${fmt(rendered.y1)}" x2="${fmt(rendered.x2)}" y2="${fmt(rendered.y2)}" stroke="#111" stroke-width="1" fill="none"${dashed}/>`
      );
      normalizedIndex += 1;
      lineIndex += 1;
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(normalized.width)}" height="${fmt(normalized.height)}" viewBox="0 0 ${fmt(normalized.width)} ${fmt(normalized.height)}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  <desc>${escapeXml(desc)}</desc>`,
    `  <rect x="0" y="0" width="${fmt(normalized.width)}" height="${fmt(normalized.height)}" fill="#fff"/>`,
    ...body,
    "</svg>",
    "",
  ].join("\n");
}

function buildInternalProof() {
const authoredLines = parseDxfLines(internalSource);
const renderedLines = authoredLines.map((line) => {
  const transform = transformByIndex.get(line.index) ?? { dx: 0, dy: 0 };
  return shift(line, transform.dx, transform.dy);
});
const groups = buildGroups(authoredLines);

writeFileSync(internalOutput, svgFor(groups, "B92-18 flying mullion internal reassembled proof", "Export-only proof from authored DXF LINE entities using explicit fixture assembly ownership and datum-proven transforms only."), "utf8");

return {
      output: internalOutput,
      groupCounts: Object.fromEntries(groups.map((group) => [group.id, group.lines.length])),
      transformsByIndex: Object.fromEntries(transformByIndex),
      endpointJoins: {
        outer_top_left: endpointJoin(renderedLines, 4, 2),
        outer_top_right: endpointJoin(renderedLines, 5, 1),
        outer_bottom_left: endpointJoin(renderedLines, 0, 2),
        outer_bottom_right: endpointJoin(renderedLines, 3, 1),
        left_sash_top_left: endpointJoin(renderedLines, 27, 26),
        left_sash_top_right: endpointJoin(renderedLines, 27, 28),
        left_sash_bottom_left: endpointJoin(renderedLines, 32, 26),
        left_sash_bottom_right: endpointJoin(renderedLines, 32, 28),
        right_sash_top_left: endpointJoin(renderedLines, 36, 38),
        right_sash_top_right: endpointJoin(renderedLines, 36, 34),
        right_sash_bottom_left: endpointJoin(renderedLines, 46, 38),
        right_sash_bottom_right: endpointJoin(renderedLines, 46, 34),
      },
      lineCount: renderedLines.length,
    };
}

const externalTransformByIndex = new Map([
  [0, { dx: 0, dy: 100 }],
  [3, { dx: 0, dy: 100 }],
  [4, { dx: 0, dy: -100 }],
  [5, { dx: 0, dy: -100 }],
  ...[2, 8, 10, 11, 14, 23, 24, 25, 41, 42, 43, 57, 59].map((index) => [index, { dx: 100, dy: 0 }]),
  ...[1, 9, 16, 17, 18, 32, 37, 38, 39, 49, 54, 55, 56, 58, 60].map((index) => [index, { dx: -100, dy: 0 }]),
  ...[6, 13, 19, 22, 36, 40, 48].map((index) => [index, { dx: 0, dy: -100 }]),
  ...[7, 12, 15, 29, 34, 44, 45, 52, 53].map((index) => [index, { dx: 0, dy: 100 }]),
]);

const externalGroupByIndex = new Map([
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16, 17, 18, 23, 24, 25, 32, 37, 38, 39, 41, 42, 43, 49, 54, 55, 56].map((index) => [index, "outer_cladding_frame_group"]),
  ...[12, 13, 22, 29, 40, 44, 45, 46, 47].map((index) => [index, "left_sash_group"]),
  ...[15, 19, 34, 35, 36, 48, 50, 51, 52, 53].map((index) => [index, "right_sash_group"]),
  ...[20, 21, 26, 27, 28, 30, 31, 33].map((index) => [index, "b92_18_flying_mullion_group"]),
]);

function buildExternalGroups(lines) {
  const groups = new Map([
    ["outer_cladding_frame_group", []],
    ["left_sash_group", []],
    ["right_sash_group", []],
    ["b92_18_flying_mullion_group", []],
    ["non_medis_authored_lines", []],
  ]);
  for (const line of lines) {
    const transform = externalTransformByIndex.get(line.index) ?? { dx: 0, dy: 0 };
    const rendered = shift(line, transform.dx, transform.dy);
    const groupId = line.layer !== "Medis hatch"
      ? "non_medis_authored_lines"
      : externalGroupByIndex.get(line.index) ?? "non_medis_authored_lines";
    groups.get(groupId).push(rendered);
  }
  return [...groups.entries()].map(([id, groupLines]) => ({ id, lines: groupLines }));
}

function buildExternalProof() {
  const authoredLines = parseDxfLines(externalSource);
  const renderedLines = authoredLines.map((line) => {
    const transform = externalTransformByIndex.get(line.index) ?? { dx: 0, dy: 0 };
    return shift(line, transform.dx, transform.dy);
  });
  const groups = buildExternalGroups(authoredLines);
  writeFileSync(externalOutput, svgFor(groups, "B92-18 flying mullion external reassembled proof", "Export-only proof from authored DXF LINE entities using explicit fixture assembly ownership and datum-proven transforms only."), "utf8");
  return {
    output: externalOutput,
    groupCounts: Object.fromEntries(groups.map((group) => [group.id, group.lines.length])),
    lineCount: renderedLines.length,
    endpointJoins: {
      left_centre_bottom_mitre_to_horizontal: endpointJoin(renderedLines, 44, 45),
      right_centre_bottom_mitre_to_horizontal: endpointJoin(renderedLines, 53, 52),
    },
  };
}

console.log(JSON.stringify({ internal: buildInternalProof(), external: buildExternalProof() }, null, 2));
