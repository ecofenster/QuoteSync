import { shouldSkipExternalWindowSillStep } from "./workflowGuards";
import {
  validateAddPositionStep,
  validateConfigurationStep,
  validateEstimateDefaultsStep,
  validateExternalWindowSillStep,
  validateForecastStep,
  validateProjectSiteAddressStep,
  validateReviewStep,
} from "./workflowValidation";
import type { ConfiguratorWorkflowStepDefinition } from "./workflow.types";

export const CONFIGURATOR_WORKFLOW_DEFINITION: ConfiguratorWorkflowStepDefinition[] = [
  {
    id: "forecast",
    label: "Forecast",
    order: 1,
    validate: validateForecastStep,
    isComplete: (draft) => validateForecastStep().length === 0,
  },
  {
    id: "projectSiteAddress",
    label: "Project Site Address",
    order: 2,
    validate: validateProjectSiteAddressStep,
    isComplete: (draft) => validateProjectSiteAddressStep(draft).length === 0,
  },
  {
    id: "estimateDefaults",
    label: "Estimate Defaults",
    order: 3,
    validate: validateEstimateDefaultsStep,
    isComplete: (draft) => validateEstimateDefaultsStep(draft).length === 0,
  },
  {
    id: "addPosition",
    label: "Quick Add Seed",
    order: 4,
    validate: validateAddPositionStep,
    isComplete: (draft) => validateAddPositionStep(draft).length === 0,
  },
  {
    id: "configuration",
    label: "Configuration",
    order: 5,
    validate: validateConfigurationStep,
    isComplete: (draft) => validateConfigurationStep(draft).length === 0,
  },
  {
    id: "review",
    label: "Review / Save",
    order: 6,
    validate: validateReviewStep,
    isComplete: (draft) => validateReviewStep(draft).length === 0,
  },
  {
    id: "externalWindowSill",
    label: "External Window Sill",
    order: 99,
    isSkippable: true,
    shouldSkip: shouldSkipExternalWindowSillStep,
    validate: validateExternalWindowSillStep,
    isComplete: (draft) => validateExternalWindowSillStep(draft).length === 0,
  },
];
