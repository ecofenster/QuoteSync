import type {
  EstimateWorkflowProgress,
  EstimateWorkflowStepDefinition,
  EstimateWorkflowStepKey,
} from "./workflow.types";

export const ESTIMATE_WORKFLOW_STEPS: EstimateWorkflowStepDefinition[] = [
  {
    key: "project_setup",
    title: "Project Setup",
    description: "Client, project address, forecast, and high-level estimate setup.",
    legacyTabs: ["client_info"],
  },
  {
    key: "openings",
    title: "Openings",
    description: "Add and organise windows, doors, and other positions for the estimate.",
    legacyTabs: ["estimates", "orders", "lost"],
  },
  {
    key: "configuration",
    title: "Configuration",
    description: "Apply product, glazing, finish, hardware, and option choices.",
    legacyTabs: ["estimates", "orders"],
  },
  {
    key: "pricing",
    title: "Pricing",
    description: "Set item prices, totals, and supplier estimate imports.",
    legacyTabs: ["estimates", "orders"],
  },
  {
    key: "review",
    title: "Review",
    description: "Review notes, order scheduling, and estimate readiness.",
    legacyTabs: ["client_notes", "orders", "lost"],
  },
  {
    key: "output",
    title: "Output",
    description: "Email, print, export, follow-up, and order conversion actions.",
    legacyTabs: ["files", "orders", "estimates"],
  },
];

const DEFAULT_STEP_KEY: EstimateWorkflowStepKey = "project_setup";

export function getDefaultEstimateWorkflowProgress(): EstimateWorkflowProgress {
  return {
    project_setup: false,
    openings: false,
    configuration: false,
    pricing: false,
    review: false,
    output: false,
  };
}

export function deriveEstimateWorkflowStepFromLegacyTab(tab: string | null | undefined): EstimateWorkflowStepKey {
  const normalized = String(tab || "").trim().toLowerCase();
  const found = ESTIMATE_WORKFLOW_STEPS.find((step) => step.legacyTabs.includes(normalized));
  return found?.key ?? DEFAULT_STEP_KEY;
}

export function canAccessEstimateWorkflowStep(
  key: EstimateWorkflowStepKey,
  progress: EstimateWorkflowProgress
): boolean {
  if (key === "project_setup") return true;

  const orderedKeys = ESTIMATE_WORKFLOW_STEPS.map((step) => step.key);
  const currentIndex = orderedKeys.indexOf(key);
  if (currentIndex <= 0) return true;

  const previousKey = orderedKeys[currentIndex - 1];
  return !!progress[previousKey];
}

export function getEstimateWorkflowDefaultStepKey(): EstimateWorkflowStepKey {
  return DEFAULT_STEP_KEY;
}
