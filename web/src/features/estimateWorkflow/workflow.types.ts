export type EstimateWorkflowStepKey =
  | "project_setup"
  | "openings"
  | "configuration"
  | "pricing"
  | "review"
  | "output";

export type EstimateWorkflowStepDefinition = {
  key: EstimateWorkflowStepKey;
  title: string;
  description: string;
  legacyTabs: string[];
};

export type EstimateWorkflowProgress = Record<EstimateWorkflowStepKey, boolean>;

export type EstimateWorkflowContextValue = {
  currentClientId: string | null;
  currentEstimateId: string | null;
  currentTab: string | null;
  currentStepKey: EstimateWorkflowStepKey;
  currentConfiguredEstimateId: string | null;
  currentConfiguredPositionId: string | null;
  steps: EstimateWorkflowStepDefinition[];
  progress: EstimateWorkflowProgress;
  visitedStepKeys: EstimateWorkflowStepKey[];
  setCurrentStepKey: (key: EstimateWorkflowStepKey) => void;
  markStepComplete: (key: EstimateWorkflowStepKey, isComplete?: boolean) => void;
  canAccessStep: (key: EstimateWorkflowStepKey) => boolean;
  openConfigurationStep: (estimateId: string, positionId: string) => void;
  clearConfigurationTarget: () => void;
  resetWorkflow: () => void;
};
