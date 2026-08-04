import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const explodedDir = resolve(root, "_project/Test/Exploded");

const files = {
  tiltTurn: resolve(explodedDir, "T&T.dxf"),
  fixedTiltTurn: resolve(explodedDir, "Fixed - T&T.dxf"),
};

function parseDxfEntities(filePath) {
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
  return entities;
}

function dxfLines(filePath, layers = ["Medis hatch"]) {
  return parseDxfEntities(filePath)
    .filter((entity) => entity.type === "LINE")
    .map((entity) => ({
      layer: entity.values["8"]?.[0] ?? "",
      x1: Number(entity.values["10"]?.[0]),
      y1: Number(entity.values["20"]?.[0]),
      x2: Number(entity.values["11"]?.[0]),
      y2: Number(entity.values["21"]?.[0]),
      linetype: entity.values["6"]?.[0] ?? "CONTINUOUS",
    }))
    .filter((line) => layers.includes(line.layer));
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

function fmt(value) {
  return Number(value.toFixed(3)).toString();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bbox(lines) {
  return {
    minX: Math.min(...lines.flatMap((line) => [line.x1, line.x2])),
    minY: Math.min(...lines.flatMap((line) => [line.y1, line.y2])),
    maxX: Math.max(...lines.flatMap((line) => [line.x1, line.x2])),
    maxY: Math.max(...lines.flatMap((line) => [line.y1, line.y2])),
  };
}

function normalizeForSvg(lines, padding = 40) {
  const bounds = bbox(lines);
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  return {
    width,
    height,
    lines: lines.map((line) => ({
      ...line,
      x1: line.x1 - bounds.minX + padding,
      y1: bounds.maxY - line.y1 + padding,
      x2: line.x2 - bounds.minX + padding,
      y2: bounds.maxY - line.y2 + padding,
    })),
  };
}

function svgFor(title, groupedLines) {
  const allLines = groupedLines.flatMap((group) => group.lines);
  const normalized = normalizeForSvg(allLines);
  const byOriginal = new Map();
  for (const group of groupedLines) {
    for (const line of group.lines) byOriginal.set(line, group.id);
  }

  const body = [];
  let lineIndex = 1;
  for (const group of groupedLines) {
    for (const line of group.lines) {
      const normalizedLine = normalized.lines[allLines.indexOf(line)];
      const dashed = normalizedLine.linetype === "DASHED" ? ' stroke-dasharray="10 10"' : "";
      body.push(
        `  <line id="${escapeXml(group.id)}-${lineIndex}" data-group="${escapeXml(group.id)}" x1="${fmt(normalizedLine.x1)}" y1="${fmt(normalizedLine.y1)}" x2="${fmt(normalizedLine.x2)}" y2="${fmt(normalizedLine.y2)}" stroke="#111" stroke-width="1" fill="none"${dashed}/>`
      );
      lineIndex += 1;
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(normalized.width)}" height="${fmt(normalized.height)}" viewBox="0 0 ${fmt(normalized.width)} ${fmt(normalized.height)}">`,
    `  <title>${escapeXml(title)}</title>`,
    '  <desc>Export-only proof reassembled from exploded DXF Medis hatch LINE entities; no renderer geometry used.</desc>',
    `  <rect x="0" y="0" width="${fmt(normalized.width)}" height="${fmt(normalized.height)}" fill="#fff"/>`,
    ...body,
    "</svg>",
    "",
  ].join("\n");
}

function classifyTiltTurn(lines) {
  const groups = {
    b92_7_top: [],
    b92_8_bottom: [],
    b92_10_left: [],
    b92_9_right: [],
  };

  for (const line of lines) {
    const maxY = Math.max(line.y1, line.y2);
    const minY = Math.min(line.y1, line.y2);
    const maxX = Math.max(line.x1, line.x2);
    const minX = Math.min(line.x1, line.x2);
    if (minY > 2000) groups.b92_7_top.push(line);
    else if (maxY < 1050) groups.b92_8_bottom.push(line);
    else if (maxX < 1300) groups.b92_10_left.push(line);
    else if (minX > 2000) groups.b92_9_right.push(line);
  }

  return [
    { id: "b92_7_top", lines: groups.b92_7_top.map((line) => shift(line, 0, -113.349347550989)) },
    { id: "b92_8_bottom", lines: groups.b92_8_bottom.map((line) => shift(line, 0, 126.6139186313096)) },
    { id: "b92_10_left", lines: groups.b92_10_left },
    { id: "b92_9_right", lines: groups.b92_9_right },
  ];
}

function classifyFixedTiltTurn(lines, closureLines) {
  const groups = {
    b92_4_top: [],
    b92_5_bottom: [],
    b92_2_left: [],
    b92_12_centre: [],
    b92_7_top: [],
    b92_8_bottom: [],
    b92_10_right: [],
    ttr_opening_dashed: [],
  };

  for (const line of lines) {
    const maxY = Math.max(line.y1, line.y2);
    const minY = Math.min(line.y1, line.y2);
    const maxX = Math.max(line.x1, line.x2);
    const minX = Math.min(line.x1, line.x2);
    const isTtr = minX >= 5200;
    if (line.linetype === "DASHED") groups.ttr_opening_dashed.push(line);
    else if (!isTtr && minY > 700) groups.b92_4_top.push(line);
    else if (!isTtr && maxY < -250) groups.b92_5_bottom.push(line);
    else if (!isTtr && maxX < 4200) groups.b92_2_left.push(line);
    else if (minX > 5100 && maxX < 5300) groups.b92_12_centre.push(line);
    else if (isTtr && minY > 680) groups.b92_7_top.push(line);
    else if (isTtr && maxY < -260) groups.b92_8_bottom.push(line);
    else if (isTtr && minX > 6200) groups.b92_10_right.push(line);
  }

  return [
    { id: "b92_4_top", lines: groups.b92_4_top.map((line) => shift(line, 0, -100)) },
    { id: "b92_5_bottom", lines: groups.b92_5_bottom.map((line) => shift(line, 0, 100)) },
    { id: "b92_2_left", lines: groups.b92_2_left.map((line) => shift(line, 100, 0)) },
    { id: "b92_12_centre", lines: groups.b92_12_centre },
    { id: "b92_7_top", lines: groups.b92_7_top.map((line) => shift(line, -100, -100)) },
    { id: "b92_8_bottom", lines: groups.b92_8_bottom.map((line) => shift(line, -100, 100)) },
    { id: "b92_10_right", lines: groups.b92_10_right.map((line) => shift(line, -200, 0)) },
    { id: "ttr_opening_dashed", lines: groups.ttr_opening_dashed.map((line) => shift(line, -100, 0)) },
    {
      id: "outer_envelope_closure",
      lines: closureLines.map((line) => {
        const near = (left, right) => Math.abs(left - right) < 0.001;
        if (near(line.x1, 4204.297799938635) && near(line.y1, 743.1793288775516)) {
          return shift(line, 0, -100);
        }
        if (line.x1 > 6300 && near(line.y1, 643.1793288775516)) {
          return shift(line, -200, 0);
        }
        if (line.x1 > 6300 && near(line.y1, -241.8206711224484)) {
          return shift(line, -200, 0);
        }
        if (line.x1 >= 5300 && line.x2 >= 5300 && near(line.y1, -399.8206711224484)) {
          return shift(line, -100, 100);
        }
        return line;
      }),
    },
  ];
}

const tiltTurnGroups = classifyTiltTurn(dxfLines(files.tiltTurn));
const fixedTiltTurnMedisLines = dxfLines(files.fixedTiltTurn);
const fixedTiltTurnClosureLines = dxfLines(files.fixedTiltTurn, ["MATMENYS"]).filter((line) => {
  const isTopLeftClosure =
    line.x1 === 4204.297799938635 &&
    line.y1 === 743.1793288775516 &&
    line.x2 === 4247.297799938634 &&
    line.y2 === 743.1793288775516;
  const isTopRightClosure =
    line.x1 === 6404.297799938635 &&
    line.y1 === 643.1793288775516 &&
    line.x2 === 6366.797799938635 &&
    line.y2 === 643.1793288775516;
  const isBottomRightClosure =
    line.x1 === 6404.297799938635 &&
    line.y1 === -241.8206711224484 &&
    line.x2 === 6366.797799938635 &&
    line.y2 === -241.8206711224339;
  const isBottomOuterClosure =
    line.x1 === 5304.297799938635 &&
    line.y1 === -399.8206711224484 &&
    line.x2 === 6304.297799938635 &&
    line.y2 === -399.8206711224484;
  return isTopLeftClosure || isTopRightClosure || isBottomRightClosure || isBottomOuterClosure;
});
const fixedTiltTurnGroups = classifyFixedTiltTurn(fixedTiltTurnMedisLines, fixedTiltTurnClosureLines);

writeFileSync(
  resolve(explodedDir, "T&T_REASSEMBLED_PROOF.svg"),
  svgFor("Exploded B92 Tilt & Turn reassembled proof", tiltTurnGroups),
  "utf8"
);

writeFileSync(
  resolve(explodedDir, "Fixed - T&T_REASSEMBLED_PROOF.svg"),
  svgFor("Exploded B92 Fixed + Tilt & Turn reassembled proof", fixedTiltTurnGroups),
  "utf8"
);

console.log(JSON.stringify({
  outputs: [
    "T&T_REASSEMBLED_PROOF.svg",
    "Fixed - T&T_REASSEMBLED_PROOF.svg",
  ],
  groupCounts: Object.fromEntries(
    [...tiltTurnGroups, ...fixedTiltTurnGroups].map((group) => [group.id, group.lines.length])
  ),
}, null, 2));
