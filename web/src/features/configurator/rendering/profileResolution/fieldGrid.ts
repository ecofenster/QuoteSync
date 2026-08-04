import type {
  PilotFieldBaseType,
  PilotFieldHanding,
  ProfileResolutionInput,
  ResolvedPilotField,
} from "./profileTypes";

export type NormalizedField = Omit<ResolvedPilotField, "edges">;
export type FieldCell = NormalizedField;

export type RowComposition = {
  hasFixed: boolean;
  hasTiltTurn: boolean;
  hasOnlyFixed: boolean;
  hasOnlyTiltTurn: boolean;
  isMixedFixedTiltTurn: boolean;
};

export type RowModel = {
  row: number;
  cells: FieldCell[];
  composition: RowComposition;
};

export type ColumnModel = {
  col: number;
  cells: FieldCell[];
};

export type JunctionRecord = {
  type: "static" | "flying";
  ownerFieldId: string | null;
};

export type VerticalAdjacency = {
  key: string;
  row: number;
  leftField: NormalizedField;
  rightField: NormalizedField;
  junctionType: "static" | "flying";
  ownerFieldId: string | null;
};

export type HorizontalAdjacency = {
  key: string;
  col: number;
  upperField: NormalizedField;
  lowerField: NormalizedField;
};

export type GridModel = {
  cells: FieldCell[];
  rows: RowModel[];
  columns: ColumnModel[];
  verticalAdjacencies: VerticalAdjacency[];
  horizontalAdjacencies: HorizontalAdjacency[];
  normalizedFields: NormalizedField[];
  fieldsByKey: Map<string, NormalizedField>;
  junctionRecordsByKey: Map<string, JunctionRecord>;
};

export function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizedInsertion(insertion: string) {
  return String(insertion || "").trim().toLowerCase();
}

function isFixedSashInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("fixed sash");
}

function isFixedInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("fixed");
}

function isTiltAndTurnInsertion(insertion: string) {
  const normalized = normalizedInsertion(insertion);
  return normalized.includes("tilt") && normalized.includes("turn");
}

function isTurnOnlyInsertion(insertion: string) {
  const normalized = normalizedInsertion(insertion);
  return normalized.includes("turn") && !normalized.includes("tilt");
}

function isLeftHandInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("left");
}

function isRightHandInsertion(insertion: string) {
  return normalizedInsertion(insertion).includes("right");
}

export function isTiltTurnFamily(type: PilotFieldBaseType) {
  return type === "tiltTurn" || type === "turnOnly" || type === "master" || type === "slave";
}

function resolveBaseField(input: {
  key: string;
  col: number;
  row: number;
  insertion: string;
  hasTrickleVent: boolean;
}): NormalizedField {
  const insertion = input.insertion;
  const baseType: Exclude<PilotFieldBaseType, "master" | "slave"> = isFixedSashInsertion(insertion)
    ? "fixedSash"
    : isFixedInsertion(insertion)
      ? "fixed"
      : isTiltAndTurnInsertion(insertion)
        ? "tiltTurn"
        : isTurnOnlyInsertion(insertion)
          ? "turnOnly"
          : "unknown";
  const hingeSide: PilotFieldHanding =
    baseType === "tiltTurn" || baseType === "turnOnly"
      ? isRightHandInsertion(insertion)
        ? "right"
        : isLeftHandInsertion(insertion)
          ? "left"
          : "left"
      : null;
  const handleSide: PilotFieldHanding =
    hingeSide === "left" ? "right" : hingeSide === "right" ? "left" : null;
  const handing: PilotFieldHanding =
    isRightHandInsertion(insertion) ? "right" : isLeftHandInsertion(insertion) ? "left" : null;

  return {
    key: input.key,
    row: input.row,
    col: input.col,
    insertion,
    type: baseType,
    baseType,
    handing,
    hingeSide,
    handleSide,
    trickleVentActive: input.hasTrickleVent && (baseType === "tiltTurn" || baseType === "turnOnly"),
  };
}

function buildRowComposition(cells: FieldCell[]): RowComposition {
  const hasFixed = cells.some((cell) => cell.type === "fixed");
  const hasTiltTurn = cells.some((cell) => cell.type === "tiltTurn");
  return {
    hasFixed,
    hasTiltTurn,
    hasOnlyFixed: cells.length > 0 && cells.every((cell) => cell.type === "fixed"),
    hasOnlyTiltTurn: cells.length > 0 && cells.every((cell) => cell.type === "tiltTurn"),
    isMixedFixedTiltTurn: hasFixed && hasTiltTurn,
  };
}

function buildRows(input: { fieldsY: number; cells: FieldCell[] }): RowModel[] {
  const rows: RowModel[] = [];
  for (let row = 0; row < input.fieldsY; row += 1) {
    const rowCells = input.cells.filter((cell) => cell.row === row);
    rows.push({
      row,
      cells: rowCells,
      composition: buildRowComposition(rowCells),
    });
  }
  return rows;
}

function buildColumns(input: { fieldsX: number; cells: FieldCell[] }): ColumnModel[] {
  const columns: ColumnModel[] = [];
  for (let col = 0; col < input.fieldsX; col += 1) {
    columns.push({
      col,
      cells: input.cells.filter((cell) => cell.col === col),
    });
  }
  return columns;
}

function buildVerticalAdjacencies(input: {
  fieldsX: number;
  fieldsY: number;
  fieldsByKey: Map<string, NormalizedField>;
  junctionRecordsByKey: Map<string, JunctionRecord>;
}): VerticalAdjacency[] {
  const adjacencies: VerticalAdjacency[] = [];
  for (let row = 0; row < input.fieldsY; row += 1) {
    for (let col = 0; col < Math.max(0, input.fieldsX - 1); col += 1) {
      const leftField = input.fieldsByKey.get(keyForCell(col, row));
      const rightField = input.fieldsByKey.get(keyForCell(col + 1, row));
      if (!leftField || !rightField) continue;
      const junction = input.junctionRecordsByKey.get(`vertical-${col + 1}`);
      adjacencies.push({
        key: `vertical-${col + 1}-row-${row}`,
        row,
        leftField,
        rightField,
        junctionType: junction?.type ?? "static",
        ownerFieldId: junction?.ownerFieldId ?? null,
      });
    }
  }
  return adjacencies;
}

function buildHorizontalAdjacencies(input: {
  fieldsX: number;
  fieldsY: number;
  fieldsByKey: Map<string, NormalizedField>;
}): HorizontalAdjacency[] {
  const adjacencies: HorizontalAdjacency[] = [];
  for (let row = 0; row < Math.max(0, input.fieldsY - 1); row += 1) {
    for (let col = 0; col < input.fieldsX; col += 1) {
      const upperField = input.fieldsByKey.get(keyForCell(col, row));
      const lowerField = input.fieldsByKey.get(keyForCell(col, row + 1));
      if (!upperField || !lowerField) continue;
      adjacencies.push({
        key: `horizontal-${row + 1}-col-${col}`,
        col,
        upperField,
        lowerField,
      });
    }
  }
  return adjacencies;
}

export function buildGridModel(input: ProfileResolutionInput): GridModel {
  const normalizedFields: NormalizedField[] = [];
  for (let row = 0; row < input.fieldsY; row += 1) {
    for (let col = 0; col < input.fieldsX; col += 1) {
      const key = keyForCell(col, row);
      normalizedFields.push(
        resolveBaseField({
          key,
          col,
          row,
          insertion: input.insertions[key] ?? "Fixed",
          hasTrickleVent: input.hasTrickleVent,
        })
      );
    }
  }

  const fieldsByKey = new Map(normalizedFields.map((field) => [field.key, field]));
  const junctionRecordsByKey: Map<string, JunctionRecord> = new Map(
    input.junctions.map((junction) => [
      junction.key,
      {
        type: String(junction.type || "static") === "flying" ? "flying" : "static",
        ownerFieldId: junction.ownerFieldId ?? null,
      },
    ])
  );

  // Flying owner/slave are local, so only mark the fields after connection records are known.
  for (let row = 0; row < input.fieldsY; row += 1) {
    for (let col = 0; col < Math.max(0, input.fieldsX - 1); col += 1) {
      const junction = junctionRecordsByKey.get(`vertical-${col + 1}`);
      if (junction?.type !== "flying" || !junction.ownerFieldId) continue;
      const leftField = fieldsByKey.get(keyForCell(col, row));
      const rightField = fieldsByKey.get(keyForCell(col + 1, row));
      if (!leftField || !rightField) continue;
      if (junction.ownerFieldId === leftField.key) {
        leftField.type = "master";
        rightField.type = "slave";
      } else if (junction.ownerFieldId === rightField.key) {
        leftField.type = "slave";
        rightField.type = "master";
      }
    }
  }

  const cells: FieldCell[] = normalizedFields;
  const rows = buildRows({ fieldsY: input.fieldsY, cells });
  const columns = buildColumns({ fieldsX: input.fieldsX, cells });
  const verticalAdjacencies = buildVerticalAdjacencies({
    fieldsX: input.fieldsX,
    fieldsY: input.fieldsY,
    fieldsByKey,
    junctionRecordsByKey,
  });
  const horizontalAdjacencies = buildHorizontalAdjacencies({
    fieldsX: input.fieldsX,
    fieldsY: input.fieldsY,
    fieldsByKey,
  });

  return {
    cells,
    rows,
    columns,
    verticalAdjacencies,
    horizontalAdjacencies,
    normalizedFields,
    fieldsByKey,
    junctionRecordsByKey,
  };
}

export function getVerticalAdjacencies(input: {
  fieldsX: number;
  fieldsY: number;
  grid: GridModel;
}): VerticalAdjacency[] {
  return input.grid.verticalAdjacencies;
}

export function getHorizontalAdjacencies(input: {
  fieldsX: number;
  fieldsY: number;
  grid: GridModel;
}): HorizontalAdjacency[] {
  return input.grid.horizontalAdjacencies;
}
