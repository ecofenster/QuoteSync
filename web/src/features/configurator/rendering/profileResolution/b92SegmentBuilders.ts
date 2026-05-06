import type {
  B92HorizontalTransomSegment,
  B92NormalizedField,
  B92OuterEdgeSegment,
  B92VerticalJunctionSegment,
} from "./b92SegmentResolver.types";

type GridDimensions = {
  columns: number;
  rows: number;
  maxColumn: number;
  maxRow: number;
  fieldsByCell: Map<string, B92NormalizedField>;
};

function fail(message: string): never {
  throw new Error(`Invalid B92 segment grid: ${message}`);
}

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function getGridDimensions(fields: B92NormalizedField[]): GridDimensions {
  if (fields.length === 0) {
    fail("at least one normalized field is required.");
  }

  let maxRow = -1;
  let maxColumn = -1;
  const fieldsByCell = new Map<string, B92NormalizedField>();

  for (const field of fields) {
    if (!Number.isInteger(field.row) || field.row < 0) {
      fail(`field ${field.key} has invalid row ${field.row}.`);
    }
    if (!Number.isInteger(field.column) || field.column < 0) {
      fail(`field ${field.key} has invalid column ${field.column}.`);
    }
    const key = cellKey(field.row, field.column);
    if (fieldsByCell.has(key)) {
      fail(`duplicate field at row ${field.row}, column ${field.column}.`);
    }
    fieldsByCell.set(key, field);
    maxRow = Math.max(maxRow, field.row);
    maxColumn = Math.max(maxColumn, field.column);
  }

  for (let row = 0; row <= maxRow; row += 1) {
    for (let column = 0; column <= maxColumn; column += 1) {
      if (!fieldsByCell.has(cellKey(row, column))) {
        fail(`missing field at row ${row}, column ${column}.`);
      }
    }
  }

  return {
    columns: maxColumn + 1,
    rows: maxRow + 1,
    maxColumn,
    maxRow,
    fieldsByCell,
  };
}

function requireField(grid: GridDimensions, row: number, column: number): B92NormalizedField {
  const field = grid.fieldsByCell.get(cellKey(row, column));
  if (!field) {
    fail(`missing field at row ${row}, column ${column}.`);
  }
  return field;
}

export function buildB92OuterEdgeSegments(fields: B92NormalizedField[]): B92OuterEdgeSegment[] {
  const grid = getGridDimensions(fields);
  const segments: B92OuterEdgeSegment[] = [];

  for (let column = 0; column < grid.columns; column += 1) {
    const field = requireField(grid, 0, column);
    segments.push({
      id: `outer-top-col-${column}`,
      kind: "outer_edge",
      edge: "top",
      row: 0,
      column,
      segmentIndex: column,
      field,
      fieldOperation: field.operation,
    });
  }

  for (let column = 0; column < grid.columns; column += 1) {
    const field = requireField(grid, grid.maxRow, column);
    segments.push({
      id: `outer-bottom-col-${column}`,
      kind: "outer_edge",
      edge: "bottom",
      row: grid.maxRow,
      column,
      segmentIndex: column,
      field,
      fieldOperation: field.operation,
    });
  }

  for (let row = 0; row < grid.rows; row += 1) {
    const field = requireField(grid, row, 0);
    segments.push({
      id: `outer-left-row-${row}`,
      kind: "outer_edge",
      edge: "left",
      row,
      column: 0,
      segmentIndex: row,
      field,
      fieldOperation: field.operation,
    });
  }

  for (let row = 0; row < grid.rows; row += 1) {
    const field = requireField(grid, row, grid.maxColumn);
    segments.push({
      id: `outer-right-row-${row}`,
      kind: "outer_edge",
      edge: "right",
      row,
      column: grid.maxColumn,
      segmentIndex: row,
      field,
      fieldOperation: field.operation,
    });
  }

  return segments;
}

export function buildB92VerticalJunctionSegments(fields: B92NormalizedField[]): B92VerticalJunctionSegment[] {
  const grid = getGridDimensions(fields);
  const segments: B92VerticalJunctionSegment[] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.maxColumn; column += 1) {
      const leftField = requireField(grid, row, column);
      const rightField = requireField(grid, row, column + 1);
      segments.push({
        id: `vertical-row-${row}-col-${column + 1}`,
        kind: "vertical_junction",
        axis: "vertical",
        row,
        column: column + 1,
        segmentIndex: segments.length,
        leftField,
        rightField,
        leftOperation: leftField.operation,
        rightOperation: rightField.operation,
        junctionType: "static",
        ownerFieldKey: null,
      });
    }
  }

  return segments;
}

export function buildB92HorizontalTransomSegments(fields: B92NormalizedField[]): B92HorizontalTransomSegment[] {
  const grid = getGridDimensions(fields);
  const segments: B92HorizontalTransomSegment[] = [];

  for (let column = 0; column < grid.columns; column += 1) {
    for (let row = 0; row < grid.maxRow; row += 1) {
      const topField = requireField(grid, row, column);
      const bottomField = requireField(grid, row + 1, column);
      segments.push({
        id: `horizontal-row-${row + 1}-col-${column}`,
        kind: "horizontal_transom",
        axis: "horizontal",
        row: row + 1,
        column,
        segmentIndex: segments.length,
        topField,
        bottomField,
        topOperation: topField.operation,
        bottomOperation: bottomField.operation,
      });
    }
  }

  return segments;
}
