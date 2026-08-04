import type {
  ConfiguratorWorkflowDraft,
  WindowJunctionDefinition,
} from "../estimateWorkflow/workflow.types";

export type LegacyWindowConfiguration = Partial<NonNullable<ConfiguratorWorkflowDraft["configuration"]>> & {
  layoutFamilyId?: unknown;
  mullions?: WindowJunctionDefinition[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
export function getLegacyWindowConfiguration(position: unknown): LegacyWindowConfiguration {
  if (!isRecord(position) || !isRecord(position.windowConfiguration)) return {};
  return position.windowConfiguration as LegacyWindowConfiguration;
}
