import type {
  B92ConfiguratorFieldState,
  B92ConfiguratorLayoutPreset,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import { getB92StructurePresetDefinition } from "./b92StructurePresetDefinitions";

export function buildB92Fields(rows: number, columns: number): B92ConfiguratorFieldState[] {
  const fields: B92ConfiguratorFieldState[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = fields.length;
      fields.push({
        id: `field-${index + 1}`,
        index,
        row,
        column,
        operation: "fixed",
      });
    }
  }
  return fields;
}

export function buildB92StructureFromPreset(preset: B92ConfiguratorLayoutPreset): B92ConfiguratorStructureState {
  const definition = getB92StructurePresetDefinition(preset);
  const fields = buildB92Fields(definition.rows, definition.columns);
  return {
    structureMode: "fields",
    layoutPreset: definition.id,
    fieldOrientation: definition.orientation,
    fieldCount: definition.fieldCount,
    orientation: definition.orientation,
    gridRows: definition.rows,
    gridColumns: definition.columns,
    rows: definition.rows,
    columns: definition.columns,
    splitMode: "equal",
    fields,
    selectedFieldId: fields[0]?.id ?? null,
    selectedJunctionId: null,
    selectedFrameEdge: null,
    coupledItems: [],
    selectedCouplingTarget: null,
  };
}
