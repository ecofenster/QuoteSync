import React from "react";

export type ConfiguratorWorkflowStepId =
  | "forecast"
  | "projectSiteAddress"
  | "invoiceAddress"
  | "estimateDefaults"
  | "addPosition"
  | "dimensions"
  | "externalWindowSill"
  | "configuration"
  | "review";

export type EstimateWorkflowStepKey = ConfiguratorWorkflowStepId;

export type ConfiguratorConfigurationSectionId =
  | "layout"
  | "fields"
  | "mullionsSplits"
  | "frameRebate"
  | "glass"
  | "barsAstragalsDuplex"
  | "hardware";

export type ConfiguratorEstimateDefaultsSectionId =
  | "supplierProduct"
  | "timberOptions"
  | "finishes"
  | "hardwareHandles"
  | "glass"
  | "accessories";

export type WindowFieldType =
  | "fixed"
  | "tiltAndTurn"
  | "tiltAndTurnLeft"
  | "tiltAndTurnRight"
  | "turnTiltLeft"
  | "turnTiltRight"
  | "turnLeft"
  | "turnRight"
  | "topHung"
  | "sideHung"
  | "reversible";

export type WindowMullionType = "static" | "flying";
export type SplitMode = "equal" | "manual";
export type DivisionBasis = "frame" | "glass";
export type OrientationView = "inside" | "outside";
export type WindowCompositionMode =
  | "single"
  | "linearHorizontal"
  | "linearVertical"
  | "grid"
  | "freehand";

export interface WorkflowAddressDraft {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  what3words?: string;
  latitude?: number | null;
  longitude?: number | null;
  addressJson?: string | null;
}

export interface WindowFieldDefinition {
  key: string;
  row: number;
  col: number;
  type: WindowFieldType;
  handleType?: string | null;
  handleHeightMm?: number | null;
  hingeType?: string | null;
}

export interface WindowJunctionDefinition {
  key: string;
  axis: "vertical" | "horizontal";
  index: number;
  type: WindowMullionType;
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
}

export interface WindowLayoutDefinition {
  rows: number;
  columns: number;
  capacity: number;
  compositionMode: WindowCompositionMode;
  presetKey?: string | null;
  freehand?: {
    enabled?: boolean;
    isGridBased?: boolean;
    allowEmptyFields?: boolean;
    cutEmptyFields?: boolean;
    glassCorner?: boolean;
  };
}

export interface WindowFrameDefinition {
  leftMm?: number | null;
  rightMm?: number | null;
  topMm?: number | null;
  bottomMm?: number | null;
  finishMode?: "single" | "dual";
  internalColour?: string | null;
  externalColour?: string | null;
  bottomRebate?: "inside" | "outside" | null;
  bottomRebateDashed?: boolean;
}

export interface WindowGlassDefinition {
  presetId?: string | null;
  presetLabel?: string | null;
  presetSpec?: string | null;
}

export interface WindowBarsDefinition {
  duplex?: boolean;
  horizontalCount?: number | null;
  verticalCount?: number | null;
  insideBars?: boolean;
  outsideBars?: boolean;
  withinGlassBars?: boolean;
  astragals?: Array<Record<string, unknown>>;
  manualBars?: Array<Record<string, unknown>>;
}

export interface WindowHardwareDefinition {
  defaultHandleType?: string | null;
  defaultHandleHeightMm?: number | null;
  defaultHingeType?: string | null;
}

export interface WindowSystemOptionsDefinition {
  frameExtensionsEnabled?: boolean;
  widerFrameEnabled?: boolean;
  rebateMode?: "none" | "internal" | "external" | "both";
  customMullionWidthMm?: number | null;
}

export interface ConfiguratorWorkflowDraft {
  version: 1;
  estimateId?: string;
  clientId?: string;
  positionId?: string;
  activeStepId: ConfiguratorWorkflowStepId;
  completedStepIds: ConfiguratorWorkflowStepId[];
  skippedStepIds: ConfiguratorWorkflowStepId[];
  lastUpdatedAt: string;
  isDirty: boolean;

  forecast: {
    estimatedOrderForecast?: string;
  };

  projectSiteAddress: WorkflowAddressDraft;

  invoiceAddress: WorkflowAddressDraft & {
    useProjectSiteAddress?: boolean;
  };

  estimateDefaults: {
    activeSectionId?: ConfiguratorEstimateDefaultsSectionId;
    sectionOrder?: ConfiguratorEstimateDefaultsSectionId[];
    defaultsSnapshot?: Record<string, unknown>;
    manufacturerId?: string | null;
    productId?: string | null;
    windowTypeId?: string | null;
    suppressSillStep?: boolean;
    hasUserOverrides?: boolean;
  };

  addPosition: {
    product?: string;
    productType?: string;
    positionReference?: string;
    quantity?: number;
    roomName?: string;
    positionType?: string;
    family?: "window";
  };

  dimensions: {
    widthMm?: number | null;
    heightMm?: number | null;
  };

  externalWindowSill: {
    mode?: "default" | "custom" | "none";
    depthMm?: number | null;
    leftEndCapType?: string | null;
    rightEndCapType?: string | null;
    userEdited?: boolean;
  };

  configuration: {
    activeSectionId?: ConfiguratorConfigurationSectionId;
    layout?: WindowLayoutDefinition;
    fields?: WindowFieldDefinition[];
    junctions?: WindowJunctionDefinition[];
    splitMode?: SplitMode;
    divisionBasis?: DivisionBasis;
    manualVerticalSplitsMm?: number[];
    manualHorizontalSplitsMm?: number[];
    orientationView?: OrientationView;
    frame?: WindowFrameDefinition;
    glass?: WindowGlassDefinition;
    bars?: WindowBarsDefinition;
    hardware?: WindowHardwareDefinition;
    systemOptions?: WindowSystemOptionsDefinition;
  };

  review: {
    confirmed?: boolean;
  };
}

export interface ConfiguratorWorkflowStepDefinition {
  id: ConfiguratorWorkflowStepId;
  label: string;
  order: number;
  isSkippable?: boolean;
  shouldSkip?: (draft: ConfiguratorWorkflowDraft) => boolean;
  validate?: (draft: ConfiguratorWorkflowDraft) => string[];
  isComplete?: (draft: ConfiguratorWorkflowDraft) => boolean;
}

export type EstimateWorkflowStepDefinition = ConfiguratorWorkflowStepDefinition;

export type EstimateWorkflowProgress = Record<ConfiguratorWorkflowStepId, boolean>;
export type ConfiguratorWorkflowScope = "estimate" | "position";
export type ConfiguratorWorkflowMode = "create" | "edit";

export type EstimateWorkflowContextValue = {
  currentClientId: string | null;
  currentEstimateId: string | null;
  currentTab: string | null;
  workflowScope: ConfiguratorWorkflowScope;
  workflowMode: ConfiguratorWorkflowMode;
  currentStepKey: ConfiguratorWorkflowStepId;
  currentConfiguredEstimateId: string | null;
  currentConfiguredPositionId: string | null;
  steps: ConfiguratorWorkflowStepDefinition[];
  visibleSteps: ConfiguratorWorkflowStepDefinition[];
  draft: ConfiguratorWorkflowDraft;
  draftStorageKey: string | null;
  validationErrors: string[];
  completedStepIds: ConfiguratorWorkflowStepId[];
  skippedStepIds: ConfiguratorWorkflowStepId[];
  canGoBack: boolean;
  canGoNext: boolean;
  setCurrentStepKey: (key: ConfiguratorWorkflowStepId) => void;
  canAccessStep: (key: ConfiguratorWorkflowStepId) => boolean;
  goToPreviousStep: () => void;
  goToNextStep: () => void;
  updateDraftSection: <K extends keyof ConfiguratorWorkflowDraft>(
    key: K,
    patch: Partial<ConfiguratorWorkflowDraft[K]>
  ) => void;
  setDraft: React.Dispatch<React.SetStateAction<ConfiguratorWorkflowDraft | null>>;
  saveDraft: () => void;
  loadDraft: () => void;
  clearDraft: () => void;
  openConfigurationStep: (estimateId: string, positionId: string) => void;
  clearConfigurationTarget: () => void;
  resetWorkflow: () => void;
};
