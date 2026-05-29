import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT = resolve("src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts");

const FAMILIES = [
  {
    id: "b92-1-field-fixed",
    label: "1 Field Fixed",
    group: "1 Field",
    internal: "_project/Test/Europa 92 Alu Clad/1 Field/Fixed/1_FIELD_FIXED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/1 Field/Fixed/1_FIELD_FIXED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-1-field-tilt-turn",
    label: "1 Field Tilt & Turn",
    group: "1 Field",
    internal: "_project/Test/Europa 92 Alu Clad/1 Field/Tilt & Turn/1_FIELD_TILT_TURN_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/1 Field/Tilt & Turn/1_FIELD_TILT_TURN_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-fixed-fixed",
    label: "2 Field Horizontal Fixed / Fixed",
    group: "2 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Fixed/HOR_2_FIELD_FIXED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Fixed/HOR_2_FIELD_FIXED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-fixed-tilt-turn-left",
    label: "2 Field Horizontal Fixed / Tilt & Turn Left",
    group: "2 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Fixed - Tilt and Turn Left/HOR_2_FIELD_FIXED_TILT_TURN_LEFT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Fixed - Tilt and Turn Left/HOR_2_FIELD_FIXED_TILT_TURN_LEFT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-turn-tilt-turn",
    label: "2 Field Horizontal Turn / Tilt & Turn",
    group: "2 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Turn - Tilt and Turn/HOR_2_FIELD_TURN_TILT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Turn - Tilt and Turn/HOR_2_FIELD_TURN_TILT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-tilt-turn-left-right",
    label: "2 Field Horizontal Tilt & Turn Left / Tilt & Turn Right",
    group: "2 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Tilt and Turn Left - Tilt and Turn Right/HOR_2_FIELD_TILT_TURN_LEFT_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Tilt and Turn Left - Tilt and Turn Right/HOR_2_FIELD_TILT_TURN_LEFT_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-tilt-turn-right-left",
    label: "2 Field Horizontal Tilt & Turn Right / Tilt & Turn Left",
    group: "2 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Tilt and Turn Right - Tilt and Turn Left/HOR_2_FIELD_TILT_TURN_RIGHT_LEFT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Tilt and Turn Right - Tilt and Turn Left/HOR_2_FIELD_TILT_TURN_RIGHT_LEFT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-fixed-tilt-turn-right",
    label: "2 Field Horizontal Fixed / Tilt & Turn Right",
    group: "2 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Fixed - Tilt and Turn Right/HOR_2_FIELD_FIXED_TILT_TURN_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Hor - 2 Field Fixed - Tilt and Turn Right/HOR_2_FIELD_FIXED_TILT_TURN_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-fixed-bottom-fixed-top",
    label: "2 Field Vertical Fixed Bottom / Fixed Top",
    group: "2 Field Vertical",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Ver - 2 Field Fixed Bottom - Fixed Top/VER_2_FIELD_FIXED_BOTTOM_FIXED_TOP_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Ver - 2 Field Fixed Bottom - Fixed Top/VER_2_FIELD_FIXED_BOTTOM_FIXED_TOP_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-tilt-turn-bottom-fixed-top",
    label: "2 Field Vertical Tilt & Turn Bottom / Fixed Top",
    group: "2 Field Vertical",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Ver - 2 Field Tilt and Turn Bottom - Fixed Top/VER_2_FIELD_TILT_TURN_BOTTOM_FIXED_TOP_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Ver - 2 Field Tilt and Turn Bottom - Fixed Top/VER_2_FIELD_TILT_TURN_BOTTOM_FIXED_TOP_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-2-field-fixed-bottom-tilt-turn-top",
    label: "2 Field Vertical Fixed Bottom / Tilt & Turn Top",
    group: "2 Field Vertical",
    internal: "_project/Test/Europa 92 Alu Clad/2 Field/Ver - 2 Field Fixed Bottom - Tilt and Turn Top/VER_2_FIELD_FIXED_BOTTOM_TILT_TURN_TOP_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/2 Field/Ver - 2 Field Fixed Bottom - Tilt and Turn Top/VER_2_FIELD_FIXED_BOTTOM_TILT_TURN_TOP_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-3-field-fixed-fixed-fixed",
    label: "3 Field Horizontal Fixed / Fixed / Fixed",
    group: "3 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Fixed/HOR_3_FIELD_FIXED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Fixed/HOR_3_FIELD_FIXED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-3-field-tilt-turn-left-fixed-tilt-turn-right",
    label: "3 Field Horizontal Tilt & Turn Left / Fixed / Tilt & Turn Right",
    group: "3 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Left - Fixed - Tilt Turn Right/HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Left - Fixed - Tilt Turn Right/HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
  },
  {
    id: "b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference",
    label: "3 Field Horizontal Tilt & Turn Right / Fixed / Tilt & Turn Left Equal-Field Reference",
    group: "3 Field Horizontal",
    internal: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    external: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg",
    internalDxf: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf",
    externalDxf: "_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf",
  },
];

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? "";
}

function num(tag, name) {
  return Number(attr(tag, name));
}

function multiplyMatrix(a, b) {
  return {
    a: a.a * b.a + a.c * b.b,
    b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d,
    d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e,
    f: a.b * b.e + a.d * b.f + a.f,
  };
}

function parseTransform(transform) {
  let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const operations = transform.match(/(translate|scale)\([^)]*\)/g) ?? [];

  for (const operation of operations) {
    const [, name, rawValues] = operation.match(/(translate|scale)\(([^)]*)\)/) ?? [];
    const values = rawValues
      ? rawValues
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number)
      : [];

    if (name === "translate") {
      matrix = multiplyMatrix(matrix, { a: 1, b: 0, c: 0, d: 1, e: values[0] ?? 0, f: values[1] ?? 0 });
    }

    if (name === "scale") {
      matrix = multiplyMatrix(matrix, {
        a: values[0] ?? 1,
        b: 0,
        c: 0,
        d: values[1] ?? values[0] ?? 1,
        e: 0,
        f: 0,
      });
    }
  }

  return matrix;
}

function applyMatrix(matrix, x, y) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function parseLines(filePath) {
  const raw = readFileSync(resolve(filePath), "utf8");
  const tags = raw.match(/<\/?g\b[^>]*>|<line\b[^>]*\/>/g) ?? [];
  const transforms = [{ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }];
  const lines = [];

  for (const tag of tags) {
    if (tag.startsWith("</g")) {
      if (transforms.length > 1) transforms.pop();
      continue;
    }

    if (tag.startsWith("<g")) {
      const current = transforms.at(-1);
      transforms.push(multiplyMatrix(current, parseTransform(attr(tag, "transform"))));
      continue;
    }

    const profileRef = attr(tag, "data-profile-ref");
    const role = profileRef || attr(tag, "data-role") || attr(tag, "data-ref") || attr(tag, "data-layer") || "proof-line";
    const transform = transforms.at(-1);
    const start = applyMatrix(transform, num(tag, "x1"), num(tag, "y1"));
    const end = applyMatrix(transform, num(tag, "x2"), num(tag, "y2"));
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    const opening = /opening_lines/i.test(profileRef) || (/authority/i.test(profileRef) && x1 !== x2 && y1 !== y2);
    lines.push({
      x1,
      y1,
      x2,
      y2,
      role,
      opening,
    });
  }

  return lines;
}

function parseDxfLines(filePath) {
  const rows = readFileSync(resolve(filePath), "utf8")
    .split(/\r?\n/)
    .map((row) => row.trim());
  const lines = [];

  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index] !== "LINE") continue;
    const entity = {};

    for (let cursor = index + 1; cursor < rows.length - 1; cursor += 2) {
      const code = rows[cursor];
      const value = rows[cursor + 1];
      if (code === "0") break;
      if (code === "8") entity.role = value;
      if (code === "10") entity.x1 = Number(value);
      if (code === "20") entity.y1 = Number(value);
      if (code === "11") entity.x2 = Number(value);
      if (code === "21") entity.y2 = Number(value);
    }

    if ([entity.x1, entity.y1, entity.x2, entity.y2].every(Number.isFinite)) {
      lines.push({
        x1: entity.x1,
        y1: entity.y1,
        x2: entity.x2,
        y2: entity.y2,
        role: entity.role || "proof-line",
        opening: /opening/i.test(entity.role ?? ""),
      });
    }
  }

  const ys = lines.flatMap((line) => [line.y1, line.y2]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return lines.map((line) => ({
    ...line,
    y1: maxY - line.y1 + minY,
    y2: maxY - line.y2 + minY,
  }));
}

function bounds(lines) {
  const xs = lines.flatMap((line) => [line.x1, line.x2]);
  const ys = lines.flatMap((line) => [line.y1, line.y2]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function viewGeometry(sourceFile, dxfFile = null) {
  const lines = dxfFile ? parseDxfLines(dxfFile) : parseLines(sourceFile);
  return {
    sourceFile: sourceFile.replaceAll("/", "\\\\"),
    sourceDxfFile: dxfFile ? dxfFile.replaceAll("/", "\\\\") : null,
    segmentCount: lines.length,
    bounds: bounds(lines),
    lines,
  };
}

const generated = FAMILIES.map((family) => ({
  id: family.id,
  label: family.label,
  group: family.group,
  views: {
    internal: viewGeometry(family.internal, family.internalDxf),
    external: viewGeometry(family.external, family.externalDxf),
  },
}));

const header = `export type B92ProfileSectionProofView = "internal" | "external";

export type B92ProfileSectionProofLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  role?: string;
  opening?: boolean;
};

export type B92ProfileSectionProofBounds = { x: number; y: number; width: number; height: number };

export type B92ProfileSectionProofViewGeometry = {
  sourceFile: string;
  sourceDxfFile: string | null;
  segmentCount: number;
  bounds: B92ProfileSectionProofBounds;
  lines: readonly B92ProfileSectionProofLine[];
};

export type B92ProfileSectionProofGeometryFamily = {
  id: string;
  label: string;
  group: string;
  views: Record<B92ProfileSectionProofView, B92ProfileSectionProofViewGeometry>;
};

// Static source-time extraction from the approved B92 profile-section assembly proof SVG files.
// Coordinates are flattened with SVG group transforms applied; the app must not parse SVG/DXF at runtime.
`;

writeFileSync(
  OUTPUT,
  `${header}export const B92_PROFILE_SECTION_PROOF_GEOMETRY = ${JSON.stringify(generated, null, 2)} as const satisfies readonly B92ProfileSectionProofGeometryFamily[];\n`,
  "utf8"
);

console.log(JSON.stringify({
  output: OUTPUT,
  families: generated.map((family) => ({
    id: family.id,
    internalSegments: family.views.internal.segmentCount,
    externalSegments: family.views.external.segmentCount,
  })),
}, null, 2));
