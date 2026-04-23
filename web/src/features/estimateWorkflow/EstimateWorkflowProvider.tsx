import React from "react";
import {
  canAccessEstimateWorkflowStep,
  deriveEstimateWorkflowStepFromLegacyTab,
  getCompletedStepIds,
  getEstimateWorkflowDefaultStepKey,
  getNextWorkflowStepId,
  getPreviousWorkflowStepId,
  getSkippedStepIds,
  getWorkflowStepValidationErrors,
  normalizeActiveWorkflowStepId,
  resolveVisibleWorkflowSteps,
  ESTIMATE_WORKFLOW_STEPS,
} from "./workflow.steps";
import { clearDraft, createDraft, createEmptyDraft, getWorkflowDraftStorageKey, loadDraft, saveDraft } from "./workflowDraft";
import type {
  ConfiguratorWorkflowDraft,
  ConfiguratorWorkflowMode,
  ConfiguratorWorkflowScope,
  ConfiguratorWorkflowStepId,
  EstimateWorkflowContextValue,
} from "./workflow.types";

const EstimateWorkflowContext = React.createContext<EstimateWorkflowContextValue | null>(null);

type Props = {
  children: React.ReactNode;
  currentClientId?: string | null;
  currentEstimateId?: string | null;
  currentTab?: string | null;
  currentClient?: any;
  currentEstimate?: any;
  currentConfiguredPositionId?: string | null;
  currentConfiguredPosition?: any;
  workflowScope?: ConfiguratorWorkflowScope;
  workflowMode?: ConfiguratorWorkflowMode;
};

function getWorkflowStartStep(
  workflowScope: ConfiguratorWorkflowScope,
  workflowMode: ConfiguratorWorkflowMode,
  currentTab: string | null
): ConfiguratorWorkflowStepId {
  if (workflowScope !== "position") return deriveEstimateWorkflowStepFromLegacyTab(currentTab);
  return workflowMode === "edit" ? "configuration" : "forecast";
}

function reconcileDraft(
  nextDraft: ConfiguratorWorkflowDraft | null | undefined,
  activeStepId: ConfiguratorWorkflowStepId | null | undefined,
  workflowScope: ConfiguratorWorkflowScope,
  workflowMode: ConfiguratorWorkflowMode,
  currentTab: string | null
) {
  const workflowStartStep = getWorkflowStartStep(workflowScope, workflowMode, currentTab);
  const safeDraft = nextDraft ?? createEmptyDraft(workflowStartStep);
  const completedStepIds = getCompletedStepIds(safeDraft, workflowScope, workflowMode);
  const skippedStepIds = getSkippedStepIds(safeDraft, workflowScope, workflowMode);
  const normalizedActiveStepId = normalizeActiveWorkflowStepId(
    safeDraft,
    activeStepId ?? safeDraft.activeStepId,
    workflowScope,
    workflowMode
  );

  return {
    ...safeDraft,
    activeStepId: normalizedActiveStepId,
    completedStepIds,
    skippedStepIds,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function EstimateWorkflowProvider(props: Props) {
  const {
    children,
    currentClientId = null,
    currentEstimateId = null,
    currentTab = null,
    currentClient = null,
    currentEstimate = null,
    currentConfiguredPositionId: currentConfiguredPositionIdProp = null,
    currentConfiguredPosition: currentConfiguredPositionProp = null,
    workflowScope = "position",
    workflowMode = "edit",
  } = props;

  const [currentConfiguredEstimateId, setCurrentConfiguredEstimateId] = React.useState<string | null>(
    workflowMode === "create" ? currentEstimateId : null
  );
  const [currentConfiguredPositionId, setCurrentConfiguredPositionId] = React.useState<string | null>(
    currentConfiguredPositionIdProp
  );
  const [draft, setDraftState] = React.useState<ConfiguratorWorkflowDraft>(() =>
    reconcileDraft(
      createEmptyDraft(getWorkflowStartStep(workflowScope, workflowMode, currentTab)),
      getWorkflowStartStep(workflowScope, workflowMode, currentTab),
      workflowScope,
      workflowMode,
      currentTab
    )
  );
  const [draftStorageKey, setDraftStorageKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (workflowMode === "create") {
      setCurrentConfiguredEstimateId(currentEstimateId ?? null);
    }
  }, [currentEstimateId, workflowMode]);

  React.useEffect(() => {
    setCurrentConfiguredPositionId(currentConfiguredPositionIdProp ?? null);
  }, [currentConfiguredPositionIdProp]);

  const configuredEstimate = React.useMemo(() => {
    if (workflowMode === "create" && currentEstimate) return currentEstimate;
    if (!currentConfiguredEstimateId || !currentEstimate) return currentEstimate ?? null;
    return String(currentEstimate?.id || "") === String(currentConfiguredEstimateId) ? currentEstimate : currentEstimate ?? null;
  }, [currentConfiguredEstimateId, currentEstimate, workflowMode]);

  const configuredPosition = React.useMemo(() => {
    if (currentConfiguredPositionProp) return currentConfiguredPositionProp;
    if (!configuredEstimate || !currentConfiguredPositionId) return null;
    return (
      configuredEstimate?.positions?.find(
        (position: any) => String(position?.id || "") === String(currentConfiguredPositionId)
      ) ?? null
    );
  }, [configuredEstimate, currentConfiguredPositionId, currentConfiguredPositionProp]);

  const visibleSteps = React.useMemo(
    () => resolveVisibleWorkflowSteps(draft, workflowScope, workflowMode),
    [draft, workflowMode, workflowScope]
  );
  const currentStepKey = draft.activeStepId ?? getEstimateWorkflowDefaultStepKey();
  const validationErrors = React.useMemo(
    () => getWorkflowStepValidationErrors(draft, currentStepKey),
    [draft, currentStepKey]
  );
  const canGoBack = React.useMemo(
    () => !!getPreviousWorkflowStepId(draft, currentStepKey, workflowScope, workflowMode),
    [draft, currentStepKey, workflowMode, workflowScope]
  );
  const canGoNext = React.useMemo(
    () => validationErrors.length === 0 && !!getNextWorkflowStepId(draft, currentStepKey, workflowScope, workflowMode),
    [draft, currentStepKey, validationErrors, workflowMode, workflowScope]
  );

  const setDraft = React.useCallback(
    (updater: React.SetStateAction<ConfiguratorWorkflowDraft | null>) => {
      setDraftState((previousDraft) => {
        const nextDraft = typeof updater === "function" ? (updater as any)(previousDraft) : updater;
        return reconcileDraft(nextDraft, nextDraft?.activeStepId, workflowScope, workflowMode, currentTab);
      });
    },
    [currentTab, workflowMode, workflowScope]
  );

  const loadCurrentDraft = React.useCallback(() => {
    const targetEstimateId = currentConfiguredEstimateId ?? currentEstimateId ?? undefined;
    const targetPositionId = currentConfiguredPositionId ?? currentConfiguredPositionIdProp ?? undefined;

    if (!targetEstimateId || !targetPositionId || !configuredEstimate || !configuredPosition) {
      const workflowStartStep = getWorkflowStartStep(workflowScope, workflowMode, currentTab);
      setDraftState(
        reconcileDraft(createEmptyDraft(workflowStartStep), workflowStartStep, workflowScope, workflowMode, currentTab)
      );
      setDraftStorageKey(null);
      return;
    }

    const storageKey = getWorkflowDraftStorageKey(targetEstimateId, targetPositionId);
    const fallbackDraft = createDraft({
      estimateId: targetEstimateId,
      clientId: currentClientId,
      positionId: targetPositionId,
      estimate: configuredEstimate,
      client: currentClient,
      position: configuredPosition,
      activeStepId: getWorkflowStartStep(workflowScope, workflowMode, currentTab),
    });
    const loadedDraft = loadDraft(storageKey, fallbackDraft);

    setDraftStorageKey(storageKey);
    setDraftState(reconcileDraft(loadedDraft, loadedDraft.activeStepId, workflowScope, workflowMode, currentTab));
  }, [
    configuredEstimate,
    configuredPosition,
    currentClient,
    currentClientId,
    currentConfiguredEstimateId,
    currentConfiguredPositionId,
    currentConfiguredPositionIdProp,
    currentEstimateId,
    currentTab,
    workflowMode,
    workflowScope,
  ]);

  React.useEffect(() => {
    if (!currentEstimateId && workflowMode !== "create") {
      const workflowStartStep = getWorkflowStartStep(workflowScope, workflowMode, currentTab);
      setDraftState(
        reconcileDraft(createEmptyDraft(workflowStartStep), workflowStartStep, workflowScope, workflowMode, currentTab)
      );
      setDraftStorageKey(null);
      setCurrentConfiguredEstimateId(null);
      setCurrentConfiguredPositionId(null);
    }
  }, [currentEstimateId, currentTab, workflowMode, workflowScope]);

  React.useEffect(() => {
    if (workflowMode === "create") {
      if (!currentEstimateId || !currentConfiguredPositionIdProp || !currentConfiguredPositionProp) return;
      loadCurrentDraft();
      return;
    }

    if (!currentConfiguredEstimateId || !currentConfiguredPositionId) return;
    loadCurrentDraft();
  }, [
    currentConfiguredEstimateId,
    currentConfiguredPositionId,
    currentConfiguredPositionIdProp,
    currentConfiguredPositionProp,
    currentEstimateId,
    loadCurrentDraft,
    workflowMode,
  ]);

  React.useEffect(() => {
    if (!draftStorageKey) return;
    saveDraft(draftStorageKey, draft);
  }, [draft, draftStorageKey]);

  const setCurrentStepKey = React.useCallback(
    (key: ConfiguratorWorkflowStepId) => {
      setDraftState((previousDraft) => {
        if (!canAccessEstimateWorkflowStep(key, previousDraft, workflowScope, workflowMode)) return previousDraft;
        return reconcileDraft(
          {
            ...previousDraft,
            activeStepId: key,
            isDirty: true,
          },
          key,
          workflowScope,
          workflowMode,
          currentTab
        );
      });
    },
    [currentTab, workflowMode, workflowScope]
  );

  const goToPreviousStep = React.useCallback(() => {
    setDraftState((previousDraft) => {
      const previousStepId = getPreviousWorkflowStepId(
        previousDraft,
        previousDraft.activeStepId,
        workflowScope,
        workflowMode
      );
      if (!previousStepId) return previousDraft;
      return reconcileDraft(
        {
          ...previousDraft,
          activeStepId: previousStepId,
          isDirty: true,
        },
        previousStepId,
        workflowScope,
        workflowMode,
        currentTab
      );
    });
  }, [currentTab, workflowMode, workflowScope]);

  const goToNextStep = React.useCallback(() => {
    setDraftState((previousDraft) => {
      const errors = getWorkflowStepValidationErrors(previousDraft, previousDraft.activeStepId);
      if (errors.length > 0) return previousDraft;
      const nextStepId = getNextWorkflowStepId(
        previousDraft,
        previousDraft.activeStepId,
        workflowScope,
        workflowMode
      );
      if (!nextStepId) return previousDraft;
      return reconcileDraft(
        {
          ...previousDraft,
          activeStepId: nextStepId,
          isDirty: true,
        },
        nextStepId,
        workflowScope,
        workflowMode,
        currentTab
      );
    });
  }, [currentTab, workflowMode, workflowScope]);

  const updateDraftSection = React.useCallback(
    <K extends keyof ConfiguratorWorkflowDraft>(key: K, patch: Partial<ConfiguratorWorkflowDraft[K]>) => {
      setDraftState((previousDraft) =>
        reconcileDraft(
          {
            ...previousDraft,
            [key]: {
              ...(previousDraft[key] as any),
              ...(patch as any),
            },
            isDirty: true,
          },
          previousDraft.activeStepId,
          workflowScope,
          workflowMode,
          currentTab
        )
      );
    },
    [currentTab, workflowMode, workflowScope]
  );

  const persistDraft = React.useCallback(() => {
    if (!draftStorageKey) return;
    saveDraft(draftStorageKey, draft);
  }, [draft, draftStorageKey]);

  const clearCurrentDraft = React.useCallback(() => {
    clearDraft(draftStorageKey);
    const workflowStartStep = getWorkflowStartStep(workflowScope, workflowMode, currentTab);
    setDraftState(() =>
      reconcileDraft(
        createDraft({
          estimateId: currentConfiguredEstimateId ?? currentEstimateId,
          clientId: currentClientId,
          positionId: currentConfiguredPositionId ?? currentConfiguredPositionIdProp,
          estimate: configuredEstimate,
          client: currentClient,
          position: configuredPosition ?? currentConfiguredPositionProp,
          activeStepId: workflowStartStep,
        }),
        workflowStartStep,
        workflowScope,
        workflowMode,
        currentTab
      )
    );
  }, [
    configuredEstimate,
    configuredPosition,
    currentClient,
    currentClientId,
    currentConfiguredEstimateId,
    currentConfiguredPositionId,
    currentConfiguredPositionIdProp,
    currentConfiguredPositionProp,
    currentEstimateId,
    currentTab,
    draftStorageKey,
    workflowMode,
    workflowScope,
  ]);

  const openConfigurationStep = React.useCallback((estimateId: string, positionId: string) => {
    setCurrentConfiguredEstimateId(estimateId || null);
    setCurrentConfiguredPositionId(positionId || null);
  }, []);

  const clearConfigurationTarget = React.useCallback(() => {
    setCurrentConfiguredEstimateId(null);
    setCurrentConfiguredPositionId(null);
    const workflowStartStep = getWorkflowStartStep(workflowScope, workflowMode, currentTab);
    setDraftState(
      reconcileDraft(createEmptyDraft(workflowStartStep), workflowStartStep, workflowScope, workflowMode, currentTab)
    );
    setDraftStorageKey(null);
  }, [currentTab, workflowMode, workflowScope]);

  const resetWorkflow = React.useCallback(() => {
    const resetStep = getWorkflowStartStep(workflowScope, workflowMode, currentTab);
    setDraftState((previousDraft) =>
      reconcileDraft(
        {
          ...previousDraft,
          activeStepId: resetStep,
          review: { ...previousDraft.review, confirmed: false },
          isDirty: false,
        },
        resetStep,
        workflowScope,
        workflowMode,
        currentTab
      )
    );
  }, [currentTab, workflowMode, workflowScope]);

  const value = React.useMemo<EstimateWorkflowContextValue>(
    () => ({
      currentClientId,
      currentEstimateId,
      currentTab,
      workflowScope,
      workflowMode,
      currentStepKey,
      currentConfiguredEstimateId,
      currentConfiguredPositionId,
      steps: ESTIMATE_WORKFLOW_STEPS,
      visibleSteps,
      draft,
      draftStorageKey,
      validationErrors,
      completedStepIds: draft.completedStepIds ?? [],
      skippedStepIds: draft.skippedStepIds ?? [],
      canGoBack,
      canGoNext,
      setCurrentStepKey,
      canAccessStep: (key) => canAccessEstimateWorkflowStep(key, draft, workflowScope, workflowMode),
      goToPreviousStep,
      goToNextStep,
      updateDraftSection,
      setDraft,
      saveDraft: persistDraft,
      loadDraft: loadCurrentDraft,
      clearDraft: clearCurrentDraft,
      openConfigurationStep,
      clearConfigurationTarget,
      resetWorkflow,
    }),
    [
      canGoBack,
      canGoNext,
      clearConfigurationTarget,
      clearCurrentDraft,
      currentClientId,
      currentConfiguredEstimateId,
      currentConfiguredPositionId,
      currentEstimateId,
      currentStepKey,
      currentTab,
      draft,
      draftStorageKey,
      goToNextStep,
      goToPreviousStep,
      loadCurrentDraft,
      openConfigurationStep,
      persistDraft,
      resetWorkflow,
      setCurrentStepKey,
      setDraft,
      updateDraftSection,
      validationErrors,
      visibleSteps,
      workflowMode,
      workflowScope,
    ]
  );

  return <EstimateWorkflowContext.Provider value={value}>{children}</EstimateWorkflowContext.Provider>;
}

export { EstimateWorkflowContext };
