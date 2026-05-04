import type { WindowFieldType } from "../estimateWorkflow/workflow.types";

export type ConfiguratorLayoutMode =
  | "single"
  | "linear_horizontal"
  | "linear_vertical"
  | "grid"
  | "freehand";

export type ConfiguratorFieldCountMode =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "grid"
  | "freehand";

export type ConfiguratorProductCategory =
  | "windows"
  | "side_balcony_doors"
  | "lift_slide"
  | "sliding"
  | "curtain_wall"
  | "rooflights"
  | "internal_doors"
  | "garage_doors"
  | "pergolas"
  | "blinds"
  | "shutters";

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

export type ConfiguratorStaticMullionWidth = 78 | 115 | 135;

export type ConfiguratorStaticMullionDefinition = {
  type: "static";
  totalWidthMm: ConfiguratorStaticMullionWidth;
  internal: {
    beadLeftVisibleMm: number;
    beadRightVisibleMm: number;
    centerProfileVisibleMm: number;
  };
  external: {
    visibleWidthMm: number;
  };
};

export type ConfiguratorGlassOptionRef = {
  glassOptionId?: string | null;
  glassLabel?: string | null;
  glassSpec?: string | null;
};

export type ConfiguratorRenderDevFlags = {
  b92FixedInternalContractValidation?: boolean | null;
  b92System?: "B92" | string | null;
  useAdminSourceModel?: boolean | null;
  useAdminSourceModelReturn?: boolean | null;
};

export type ConfiguratorFieldDefinitionV2 = {
  key: string;
  row: number;
  col: number;
  opening: ConfiguratorFieldOpeningDefinition;
  glass?: ConfiguratorGlassOptionRef | null;
  renderDefinition?: ConfiguratorFieldRenderDefinitionRef | null;
};

export type ConfiguratorWindowTypeFieldDesignDefinitionV2 = {
  fieldKey: string;
  operationType: ConfiguratorOperationType;
  openingDirection: ConfiguratorOpeningDirection;
  handing?: ConfiguratorOpeningHanding | null;
  sequence?: ConfiguratorOpeningSequence | null;
};

export type ConfiguratorSectionMappingRole =
  | "left_jamb"
  | "right_jamb"
  | "head"
  | "bottom"
  | "cill"
  | "static_mullion"
  | "flying_mullion"
  | "glazing_bar"
  | "threshold";

export type ConfiguratorSectionVariantCondition =
  | "standard"
  | "wider_frame"
  | "frame_only"
  | "frame_with_sash"
  | "no_rebate"
  | "internal_rebate"
  | "external_rebate"
  | "rebate_both_sides";

export type ConfiguratorSectionOperationContext =
  | "fixed"
  | "fixed_sash"
  | "turn"
  | "tilt"
  | "tilt_turn"
  | "sliding"
  | "lift_slide"
  | "door";

export type ConfiguratorSectionMappingRuleV2 = {
  profileRole: ConfiguratorSectionMappingRole;
  variantCondition: ConfiguratorSectionVariantCondition;
  operationContext: ConfiguratorSectionOperationContext;
  sectionReferenceId?: string | null;
};

export type ConfiguratorDivisionJunctionKind =
  | "static_vertical"
  | "static_horizontal"
  | "flying_vertical";

export type ConfiguratorJunctionDefinitionV2 = {
  key: string;
  axis: "vertical" | "horizontal";
  index: number;
  type: "static" | "flying";
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
  ownerFieldId?: string | null;
  staticMullion?: ConfiguratorStaticMullionDefinition | null;
};

export type ConfiguratorWindowTypeDivisionRuleV2 = {
  junctionKind: ConfiguratorDivisionJunctionKind;
  adjustableSplitPosition: boolean;
  supportsOwnerField: boolean;
  defaultOwnerFieldId?: string | null;
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
  productGroup: ConfiguratorProductCategory | string;
  layout: ConfiguratorLayoutDefinitionV2;
  fieldCountMode?: ConfiguratorFieldCountMode | null;
  fieldDesigns?: ConfiguratorWindowTypeFieldDesignDefinitionV2[] | null;
  sectionMappings?: Array<{
    role: ConfiguratorSectionMappingRole;
    sectionRefId?: string | null;
  }> | null;
  sectionMappingRules?: ConfiguratorSectionMappingRuleV2[] | null;
  divisionRules?: ConfiguratorWindowTypeDivisionRuleV2[] | null;
};
