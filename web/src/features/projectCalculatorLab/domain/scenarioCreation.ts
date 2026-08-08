import type { CalculatorPackageCode, CalculatorScenario, CalculatorScenarioOrigin, ImportSource } from "./projectCalculatorLab.types";

export type ScenarioCreationDraft = {
  name: string;
  origin: CalculatorScenarioOrigin;
  sourceRunId: string;
  currency?: string;
  packageCode: CalculatorPackageCode;
  installationOpeningCount: string;
};

type ScenarioCreationBase = {
  estimateId?: string;
  name: string;
  packageType: CalculatorPackageCode;
};
export type ScenarioCreationInput =
  | (ScenarioCreationBase & { origin:"manual"; currency:string })
  | (ScenarioCreationBase & { origin:"supplier_import"; importLabSessionId:string; extractionRunId:string; sourceAttachmentId:string; installationOpeningCount:number })
  | (ScenarioCreationBase & { origin:"estimate"|"mixed" });

export function validateScenarioCreation(draft: ScenarioCreationDraft, sources: readonly ImportSource[]) {
  const origin = draft.origin || "supplier_import";
  if (!draft.name.trim()) return "Enter a scenario name.";
  if (origin === "estimate") return "Estimate / Configurator scenario creation is not available yet.";
  if (origin === "mixed") return "Mixed-origin scenarios are reserved for a later workflow.";
  if (origin === "manual" && !/^[A-Z]{3}$/.test(String(draft.currency || "").trim().toUpperCase())) return "Enter a valid three-letter currency for the manual scenario.";
  const openings = Number(draft.installationOpeningCount);
  if (origin === "supplier_import" && (!Number.isInteger(openings) || openings < 0)) return "Installation openings must be a whole number of zero or more.";
  if (origin === "supplier_import" && !sources.length) return "No eligible completed Import Lab runs are available. Complete an extraction and select at least one position or additional cost first, or choose Manual Entry.";
  if (origin === "supplier_import" && !draft.sourceRunId) return "Select a completed Import Lab run.";
  if (origin === "manual") return null;
  const source = sources.find((candidate) => candidate.runId === draft.sourceRunId);
  if (!source) return "The selected Import Lab run is no longer available. Refresh and select it again.";
  if (source.selectedRowCount + source.selectedAdditionalCostCount < 1) return "The selected run has no positions or additional costs selected for future use.";
  return null;
}

export function toScenarioCreationInput(draft: ScenarioCreationDraft, source?: ImportSource): ScenarioCreationInput {
  const origin=draft.origin||"supplier_import";
  const base={name:draft.name.trim(),packageType:draft.packageCode};
  if(origin==="manual")return {...base,origin:"manual",currency:String(draft.currency||"").trim().toUpperCase()};
  if(origin==="supplier_import"&&source)return {...base,origin:"supplier_import",importLabSessionId:source.sessionId,extractionRunId:source.runId,sourceAttachmentId:source.attachmentId,installationOpeningCount:Number(draft.installationOpeningCount)};
  return {...base,origin:origin as "estimate"|"mixed"};
}

export function createScenarioCreationWorkflow(
  createScenario: (input: ScenarioCreationInput) => Promise<CalculatorScenario>
) {
  let pending: Promise<CalculatorScenario> | null = null;
  return {
    run(
      input: ScenarioCreationInput,
      refresh: () => Promise<void>,
      open: (scenario: CalculatorScenario) => void
    ) {
      if (pending) return pending;
      pending = (async () => {
        const created = await createScenario(input);
        await refresh();
        open(created);
        return created;
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}
