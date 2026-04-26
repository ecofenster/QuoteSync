import type {
  ConfiguratorColourRecord,
  ConfiguratorGlassRecord,
  ConfiguratorHardwareRecord,
  ConfiguratorManufacturerRecord,
  ConfiguratorProductRecord,
  ConfiguratorRenderProfileRecord,
  ConfiguratorWindowTypeRecord,
} from "../../admin/configuratorCatalog.types";
import type {
  OrientationView,
  WindowBarsDefinition,
  WindowFieldDefinition,
  WindowFrameDefinition,
  WindowGlassDefinition,
  WindowHardwareDefinition,
  WindowJunctionDefinition,
  WindowLayoutDefinition,
  WindowSystemOptionsDefinition,
  WorkflowAddressDraft,
} from "../../estimateWorkflow/workflow.types";

export type OpeningFunctionConvention = "din" | "uk";

export type ConfiguratorConsumerAdminSourceIds = {
  manufacturerId: string;
  productId: string;
  windowTypeId: string;
  renderDefinitionContextKey: string | null;
  internalRenderProfileId: string | null;
  externalRenderProfileId: string | null;
  defaultOpeningFunctionConvention: OpeningFunctionConvention;
  handleId?: string | null;
  hingeId?: string | null;
  glassId?: string | null;
  timberOptionId?: string | null;
  lacquerOptionId?: string | null;
  internalColourId?: string | null;
  externalColourId?: string | null;
  dualExternalAluCladColourId?: string | null;
  rebateMode?: WindowSystemOptionsDefinition["rebateMode"] | null;
};

export type ConfiguratorConsumerAdminSourceData = {
  manufacturer: ConfiguratorManufacturerRecord;
  product: ConfiguratorProductRecord;
  windowType: ConfiguratorWindowTypeRecord;
  internalRenderProfile: ConfiguratorRenderProfileRecord | null;
  externalRenderProfile: ConfiguratorRenderProfileRecord | null;
  defaultOpeningFunctionConvention: OpeningFunctionConvention;
  handle: ConfiguratorHardwareRecord | null;
  hinge: ConfiguratorHardwareRecord | null;
  glass: ConfiguratorGlassRecord | null;
  timberOption: ConfiguratorProductRecord | null;
  lacquerOption: ConfiguratorColourRecord | null;
  internalColour: ConfiguratorColourRecord | null;
  externalColour: ConfiguratorColourRecord | null;
  dualExternalAluCladColour: ConfiguratorColourRecord | null;
  futureDefaults?: Record<string, unknown> | null;
};

export type ConfiguratorConsumerEstimateSelection = {
  clientId: string;
  estimateId: string;
  forecast?: string | null;
  projectSiteAddress: WorkflowAddressDraft;
};

export type ConfiguratorConsumerPositionSelection = {
  positionId?: string | null;
  positionReference: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  sourceIds: ConfiguratorConsumerAdminSourceIds;
  layout?: WindowLayoutDefinition | null;
  fields?: WindowFieldDefinition[] | null;
  junctions?: WindowJunctionDefinition[] | null;
  orientationView?: OrientationView;
};

export type ConfiguratorConsumerAllowedOverrides = {
  openingFunctionConvention?: OpeningFunctionConvention | null;
  frame?: Partial<WindowFrameDefinition> | null;
  glass?: Partial<WindowGlassDefinition> | null;
  bars?: Partial<WindowBarsDefinition> | null;
  hardware?: Partial<WindowHardwareDefinition> | null;
  systemOptions?: Partial<WindowSystemOptionsDefinition> | null;
  notes?: string | null;
};

export type ConfiguratorConsumerContract = {
  estimate: ConfiguratorConsumerEstimateSelection;
  position: ConfiguratorConsumerPositionSelection;
  adminSourceData: ConfiguratorConsumerAdminSourceData;
  allowedOverrides: ConfiguratorConsumerAllowedOverrides;
};

// TODO/DEPRECATED(C8): These estimate-side fields duplicate Admin-owned source data
// or render-definition ownership. They should be removed once the new consumer
// stops depending on the legacy estimate configurator draft shape.
export const LEGACY_ESTIMATE_CONFIGURATOR_SOURCE_FIELDS_TO_DELETE = [
  "estimateDefaults.defaultsSnapshot",
  "estimateDefaults.manufacturerId",
  "estimateDefaults.productId",
  "estimateDefaults.windowTypeId",
  "configuration.renderDefinitionContextKey",
  "configuration.internalRenderProfileId",
  "configuration.externalRenderProfileId",
  "configuration.glass.presetLabel",
  "configuration.glass.presetSpec",
  "configuration.hardware.defaultHandleType",
  "configuration.hardware.defaultHingeType",
] as const;

// TODO/DEPRECATED(C8): These estimate-side display values should become Admin-backed
// ids or explicit quote/position overrides instead of free-form source snapshots.
export const LEGACY_ESTIMATE_CONFIGURATOR_RENDER_FIELDS_TO_DELETE = [
  "configuration.frame.internalColour",
  "configuration.frame.externalColour",
  "configuration.frame.bottomRebate",
  "configuration.systemOptions.rebateMode",
  "configuration.openingFunctionConvention",
] as const;
