import { CONFIGURATOR_WORKFLOW_DEFINITION } from "./workflowDefinition";
import type {
  ConfiguratorWorkflowDraft,
  ConfiguratorWorkflowMode,
  ConfiguratorWorkflowScope,
  ConfiguratorWorkflowStepDefinition,
  ConfiguratorWorkflowStepId,
  EstimateWorkflowProgress,
} from "./workflow.types";

export const ESTIMATE_WORKFLOW_STEPS: ConfiguratorWorkflowStepDefinition[] = CONFIGURATOR_WORKFLOW_DEFINITION;

const DEFAULT_STEP_KEY: ConfiguratorWorkflowStepId = "forecast";

export function getDefaultEstimateWorkflowProgress(): EstimateWorkflowProgress {
  return {
    forecast: false,
    projectSiteAddress: false,
    invoiceAddress: false,
    estimateDefaults: false,
    addPosition: false,
    dimensions: false,
    externalWindowSill: false,
    configuration: false,
    review: false,
  };
}

export function deriveEstimateWorkflowStepFromLegacyTab(): ConfiguratorWorkflowStepId {
  return DEFAULT_STEP_KEY;
}

export function getEstimateWorkflowDefaultStepKey(): ConfiguratorWorkflowStepId {
  return DEFAULT_STEP_KEY;
}

export function getWorkflowStepDefinition(stepId: ConfiguratorWorkflowStepId) {
  return ESTIMATE_WORKFLOW_STEPS.find((step) => step.id === stepId) ?? ESTIMATE_WORKFLOW_STEPS[0];
}

export function resolveVisibleWorkflowSteps(
  draft: ConfiguratorWorkflowDraft | null,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepDefinition[] {
  const nonSillSteps = ESTIMATE_WORKFLOW_STEPS.filter(
    (step) => step.id !== "externalWindowSill" && step.id !== "invoiceAddress" && step.id !== "dimensions"
  );
  const scopedSteps =
    workflowScope === "position"
      ? workflowMode === "edit"
        ? nonSillSteps.filter((step) => ["configuration", "review"].includes(step.id))
        : nonSillSteps.filter((step) =>
            ["forecast", "projectSiteAddress", "estimateDefaults", "configuration", "review"].includes(step.id)
          )
      : nonSillSteps;
  if (!draft) return scopedSteps;
  return scopedSteps.filter((step) => !step.shouldSkip?.(draft));
}

export function getSkippedStepIds(
  draft: ConfiguratorWorkflowDraft | null,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepId[] {
  if (!draft) return [];
  const scopedSteps =
    workflowScope === "position"
      ? workflowMode === "edit"
        ? ESTIMATE_WORKFLOW_STEPS.filter((step) => ["configuration", "review", "externalWindowSill"].includes(step.id))
        : ESTIMATE_WORKFLOW_STEPS.filter((step) =>
            ["forecast", "projectSiteAddress", "estimateDefaults", "configuration", "review", "externalWindowSill"].includes(step.id)
          )
      : ESTIMATE_WORKFLOW_STEPS;
  return scopedSteps
    .filter((step) => !!step.shouldSkip?.(draft))
    .map((step) => step.id);
}

export function getCompletedStepIds(
  draft: ConfiguratorWorkflowDraft | null,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepId[] {
  if (!draft) return [];
  return resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode)
    .filter((step) => !!step.isComplete?.(draft))
    .map((step) => step.id);
}

export function getWorkflowStepValidationErrors(
  draft: ConfiguratorWorkflowDraft | null,
  stepId: ConfiguratorWorkflowStepId
): string[] {
  if (!draft) return [];
  const definition = getWorkflowStepDefinition(stepId);
  return definition.validate?.(draft) ?? [];
}

export function canAccessEstimateWorkflowStep(
  key: ConfiguratorWorkflowStepId,
  draft: ConfiguratorWorkflowDraft | null,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): boolean {
  const visibleSteps = resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode);
  const currentIndex = visibleSteps.findIndex((step) => step.id === key);
  if (currentIndex < 0) return false;
  if (currentIndex === 0) return true;

  for (let i = 0; i < currentIndex; i += 1) {
    const step = visibleSteps[i];
    const isComplete = step.isComplete?.(draft as ConfiguratorWorkflowDraft) ?? false;
    if (!isComplete) return false;
  }

  return true;
}

export function getPreviousWorkflowStepId(
  draft: ConfiguratorWorkflowDraft | null,
  stepId: ConfiguratorWorkflowStepId,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepId | null {
  const visibleSteps = resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode);
  const currentIndex = visibleSteps.findIndex((step) => step.id === stepId);
  if (currentIndex <= 0) return null;
  return visibleSteps[currentIndex - 1]?.id ?? null;
}

export function getNextWorkflowStepId(
  draft: ConfiguratorWorkflowDraft | null,
  stepId: ConfiguratorWorkflowStepId,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepId | null {
  const visibleSteps = resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode);
  const currentIndex = visibleSteps.findIndex((step) => step.id === stepId);
  if (currentIndex < 0 || currentIndex === visibleSteps.length - 1) return null;
  return visibleSteps[currentIndex + 1]?.id ?? null;
}

export function getFirstAccessibleWorkflowStepId(
  draft: ConfiguratorWorkflowDraft | null,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepId {
  const visibleSteps = resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode);
  for (const step of visibleSteps) {
    if (canAccessEstimateWorkflowStep(step.id, draft, workflowScope, workflowMode)) return step.id;
  }
  return visibleSteps[0]?.id ?? DEFAULT_STEP_KEY;
}

export function normalizeActiveWorkflowStepId(
  draft: ConfiguratorWorkflowDraft | null,
  stepId: ConfiguratorWorkflowStepId | null | undefined,
  workflowScope: ConfiguratorWorkflowScope = "position",
  workflowMode: ConfiguratorWorkflowMode = "edit"
): ConfiguratorWorkflowStepId {
  const candidate = stepId ?? draft?.activeStepId ?? DEFAULT_STEP_KEY;
  const visibleSteps = resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode);
  if (visibleSteps.some((step) => step.id === candidate)) {
    return candidate;
  }
  return getFirstAccessibleWorkflowStepId(draft, workflowScope, workflowMode);
}
