import React from "react";
import {
  ESTIMATE_WORKFLOW_STEPS,
  canAccessEstimateWorkflowStep,
  deriveEstimateWorkflowStepFromLegacyTab,
  getDefaultEstimateWorkflowProgress,
  getEstimateWorkflowDefaultStepKey,
} from "./workflow.steps";
import type {
  EstimateWorkflowContextValue,
  EstimateWorkflowProgress,
  EstimateWorkflowStepKey,
} from "./workflow.types";

const EstimateWorkflowContext = React.createContext<EstimateWorkflowContextValue | null>(null);

type Props = {
  children: React.ReactNode;
  currentClientId?: string | null;
  currentEstimateId?: string | null;
  currentTab?: string | null;
};

export function EstimateWorkflowProvider(props: Props) {
  const {
    children,
    currentClientId = null,
    currentEstimateId = null,
    currentTab = null,
  } = props;

  const [currentStepKey, setCurrentStepKeyState] = React.useState<EstimateWorkflowStepKey>(() =>
    deriveEstimateWorkflowStepFromLegacyTab(currentTab)
  );
  const [progress, setProgress] = React.useState<EstimateWorkflowProgress>(() => {
    const next = getDefaultEstimateWorkflowProgress();
    const initialStep = deriveEstimateWorkflowStepFromLegacyTab(currentTab);
    next[initialStep] = true;
    return next;
  });
  const [visitedStepKeys, setVisitedStepKeys] = React.useState<EstimateWorkflowStepKey[]>(() => {
    const initialStep = deriveEstimateWorkflowStepFromLegacyTab(currentTab);
    return [initialStep];
  });
  const [currentConfiguredEstimateId, setCurrentConfiguredEstimateId] = React.useState<string | null>(null);
  const [currentConfiguredPositionId, setCurrentConfiguredPositionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const derivedStep = deriveEstimateWorkflowStepFromLegacyTab(currentTab);
    setCurrentStepKeyState(derivedStep);
    setProgress((prev) => ({ ...prev, [derivedStep]: true }));
    setVisitedStepKeys((prev) => (prev.includes(derivedStep) ? prev : [...prev, derivedStep]));
  }, [currentTab]);

  React.useEffect(() => {
    if (!currentEstimateId) {
      const defaultStep = getEstimateWorkflowDefaultStepKey();
      setCurrentStepKeyState(defaultStep);
      setProgress(getDefaultEstimateWorkflowProgress());
      setVisitedStepKeys([defaultStep]);
      setCurrentConfiguredEstimateId(null);
      setCurrentConfiguredPositionId(null);
      return;
    }

    setProgress((prev) => {
      const next = { ...prev };
      next.project_setup = true;
      return next;
    });
  }, [currentClientId, currentEstimateId]);

  const markStepComplete = React.useCallback((key: EstimateWorkflowStepKey, isComplete = true) => {
    setProgress((prev) => ({ ...prev, [key]: isComplete }));
    if (isComplete) {
      setVisitedStepKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    }
  }, []);

  const canAccessStep = React.useCallback(
    (key: EstimateWorkflowStepKey) => canAccessEstimateWorkflowStep(key, progress),
    [progress]
  );

  const setCurrentStepKey = React.useCallback(
    (key: EstimateWorkflowStepKey) => {
      if (!canAccessEstimateWorkflowStep(key, progress)) return;
      setCurrentStepKeyState(key);
      setVisitedStepKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      if (key !== "configuration") {
        setCurrentConfiguredEstimateId(null);
        setCurrentConfiguredPositionId(null);
      }
    },
    [progress]
  );

  const openConfigurationStep = React.useCallback((estimateId: string, positionId: string) => {
    setCurrentConfiguredEstimateId(estimateId || null);
    setCurrentConfiguredPositionId(positionId || null);
    setCurrentStepKeyState("configuration");
    setProgress((prev) => ({
      ...prev,
      project_setup: true,
      openings: true,
      configuration: true,
    }));
    setVisitedStepKeys((prev) => {
      const next = prev.includes("configuration") ? prev : [...prev, "configuration"];
      return next;
    });
  }, []);

  const clearConfigurationTarget = React.useCallback(() => {
    setCurrentConfiguredEstimateId(null);
    setCurrentConfiguredPositionId(null);
  }, []);

  const resetWorkflow = React.useCallback(() => {
    const defaultStep = getEstimateWorkflowDefaultStepKey();
    setCurrentStepKeyState(defaultStep);
    setProgress(getDefaultEstimateWorkflowProgress());
    setVisitedStepKeys([defaultStep]);
    setCurrentConfiguredEstimateId(null);
    setCurrentConfiguredPositionId(null);
  }, []);

  const value = React.useMemo<EstimateWorkflowContextValue>(
    () => ({
      currentClientId,
      currentEstimateId,
      currentTab,
      currentStepKey,
      currentConfiguredEstimateId,
      currentConfiguredPositionId,
      steps: ESTIMATE_WORKFLOW_STEPS,
      progress,
      visitedStepKeys,
      setCurrentStepKey,
      markStepComplete,
      canAccessStep,
      openConfigurationStep,
      clearConfigurationTarget,
      resetWorkflow,
    }),
    [
      currentClientId,
      currentEstimateId,
      currentTab,
      currentStepKey,
      currentConfiguredEstimateId,
      currentConfiguredPositionId,
      progress,
      visitedStepKeys,
      setCurrentStepKey,
      markStepComplete,
      canAccessStep,
      openConfigurationStep,
      clearConfigurationTarget,
      resetWorkflow,
    ]
  );

  return <EstimateWorkflowContext.Provider value={value}>{children}</EstimateWorkflowContext.Provider>;
}

export { EstimateWorkflowContext };
