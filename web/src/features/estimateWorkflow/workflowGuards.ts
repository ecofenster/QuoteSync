import type { ConfiguratorWorkflowDraft } from "./workflow.types";

export function shouldSkipExternalWindowSillStep(draft: ConfiguratorWorkflowDraft | null | undefined) {
  if (!draft) return false;
  return !!draft.estimateDefaults.suppressSillStep && !draft.externalWindowSill.userEdited;
}
