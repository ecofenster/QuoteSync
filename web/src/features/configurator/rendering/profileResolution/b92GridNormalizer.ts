import type { WindowTypeSourceModel, WindowTypeSourceModelFieldRule } from "../../../admin/windowTypes/windowTypeSourceModel.types";
import type {
  B92NormalizedField,
  B92OperationFamily,
  B92ResolvedFieldOperation,
} from "./b92SegmentResolver.types";

function fail(message: string): never {
  throw new Error(`Invalid B92 field grid: ${message}`);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer.`);
  }
}

function fieldKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function normalizeOperation(fieldRule: WindowTypeSourceModelFieldRule): B92ResolvedFieldOperation {
  const operation = fieldRule.operation ?? fieldRule.operationType;
  if (
    operation === "fixed" ||
    operation === "fixed_sash" ||
    operation === "tt_left" ||
    operation === "tt_right" ||
    operation === "turn_left" ||
    operation === "turn_right" ||
    operation === "tilt_only"
  ) {
    return operation;
  }

  fail(
    `unsupported operation "${String(operation || "(blank)")}" at row ${fieldRule.fieldSelector.row}, column ${fieldRule.fieldSelector.column}.`
  );
}

function operationFamily(operation: B92ResolvedFieldOperation): B92OperationFamily {
  if (operation === "fixed") return "fixed";
  if (operation === "fixed_sash") return "fixed_sash";
  if (operation === "tt_left" || operation === "tt_right") return "tilt_turn";
  if (operation === "turn_left" || operation === "turn_right") return "turn_only";
  return "tilt_only";
}

function hingeSide(operation: B92ResolvedFieldOperation): B92NormalizedField["hingeSide"] {
  if (operation === "tt_left" || operation === "turn_left") return "left";
  if (operation === "tt_right" || operation === "turn_right") return "right";
  return null;
}

function handleSide(operation: B92ResolvedFieldOperation): B92NormalizedField["handleSide"] {
  if (operation === "tt_left" || operation === "turn_left") return "right";
  if (operation === "tt_right" || operation === "turn_right") return "left";
  return null;
}

function fieldRulesByCell(source: WindowTypeSourceModel): Map<string, WindowTypeSourceModelFieldRule> {
  const map = new Map<string, WindowTypeSourceModelFieldRule>();
  for (const fieldRule of source.fieldRules) {
    const { row, column } = fieldRule.fieldSelector;
    if (!Number.isInteger(row) || row < 0 || !Number.isInteger(column) || column < 0) {
      fail(`fieldRule has invalid row/column selector: row ${row}, column ${column}.`);
    }
    const key = fieldKey(row, column);
    if (map.has(key)) {
      fail(`duplicate fieldRule for row ${row}, column ${column}.`);
    }
    map.set(key, fieldRule);
  }
  return map;
}

export function normalizeB92FieldGrid(source: WindowTypeSourceModel): B92NormalizedField[] {
  if (source.systemCode !== "B92") {
    fail(`systemCode must be B92; received ${source.systemCode || "(blank)"}.`);
  }

  const columns = source.layout.columns;
  const rows = source.layout.rows;
  assertPositiveInteger(columns, "layout.columns");
  assertPositiveInteger(rows, "layout.rows");

  const rulesByCell = fieldRulesByCell(source);
  const fields: B92NormalizedField[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const rule = rulesByCell.get(fieldKey(row, column));
      if (!rule) {
        fail(`missing fieldRule for row ${row}, column ${column}.`);
      }
      const key = rule.fieldSelector.fieldKey;
      if (!key) {
        fail(`fieldRule for row ${row}, column ${column} must include fieldSelector.fieldKey.`);
      }
      const operation = normalizeOperation(rule);

      fields.push({
        id: key,
        key,
        row,
        column,
        operation,
        operationFamily: operationFamily(operation),
        hingeSide: hingeSide(operation),
        handleSide: handleSide(operation),
      });
    }
  }

  return fields;
}
