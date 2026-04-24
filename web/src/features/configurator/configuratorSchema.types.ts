import type { WindowFieldType } from "../estimateWorkflow/workflow.types";

export type ConfiguratorLayoutMode =
  | "single"
  | "linear_horizontal"
  | "linear_vertical"
  | "grid"
  | "freehand";

export type ConfiguratorOpeningDirection = "inward" | "outward" | "neutral";

export type ConfiguratorOpeningHanding = "left" | "right" | "center";

export type ConfiguratorOpeningSequence = "tilt_first" | "turn_first";

export type ConfiguratorOperationType =
  | "fixed"
  | "fixed_sash"
  | "tilt"
  | "turn"
  | "tilt_turn"
  | "top_hung"
  | "side_hung"
  | "reversible"
  | "pivot"
  | "sliding"
  | "mixed";

export type ConfiguratorFieldOpeningDefinition = {
  operationType: ConfiguratorOperationType;
  openingDirection: ConfiguratorOpeningDirection;
  handing?: ConfiguratorOpeningHanding | null;
  sequence?: ConfiguratorOpeningSequence | null;
  sourceFieldType?: WindowFieldType | null;
};

export type ConfiguratorFieldRenderDefinitionRef = {
  renderDefinitionContextKey?: string | null;
  internalRenderProfileId?: string | null;
  externalRenderProfileId?: string | null;
};

export type ConfiguratorGlassOptionRef = {
  glassOptionId?: string | null;
  glassLabel?: string | null;
  glassSpec?: string | null;
};

export type ConfiguratorFieldDefinitionV2 = {
  key: string;
  row: number;
  col: number;
  opening: ConfiguratorFieldOpeningDefinition;
  glass?: ConfiguratorGlassOptionRef | null;
  renderDefinition?: ConfiguratorFieldRenderDefinitionRef | null;
};

export type ConfiguratorJunctionDefinitionV2 = {
  key: string;
  axis: "vertical" | "horizontal";
  index: number;
  type: "static" | "flying";
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
};

export type ConfiguratorLayoutDefinitionV2 = {
  rows: number;
  columns: number;
  capacity: number;
  mode: ConfiguratorLayoutMode;
  presetKey?: string | null;
  freehand?: {
    enabled: boolean;
    isGridBased?: boolean;
    allowEmptyFields?: boolean;
    cutEmptyFields?: boolean;
    glassCorner?: boolean;
  };
  fields: ConfiguratorFieldDefinitionV2[];
  junctions: ConfiguratorJunctionDefinitionV2[];
};

export type ConfiguratorApprovedOneFieldInternalDefinitionKey =
  | "windows:1field:fixed:IV"
  | "windows:1field:fixed_sash:IV"
  | "windows:1field:tilt:IV"
  | "windows:1field:turn_left:IV"
  | "windows:1field:turn_right:IV"
  | "windows:1field:tilt_turn_left:IV"
  | "windows:1field:tilt_turn_right:IV";

export type ConfiguratorSystemDefinitionV2 = {
  manufacturerId?: string | null;
  productId?: string | null;
  windowTypeId?: string | null;
  productGroup: string;
  layout: ConfiguratorLayoutDefinitionV2;
};
