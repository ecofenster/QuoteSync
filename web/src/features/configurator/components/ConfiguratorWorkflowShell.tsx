import React from "react";
import ConfiguratorProgress from "./ConfiguratorProgress";
import ConfiguratorStepFrame from "./ConfiguratorStepFrame";
import ForecastStep from "./steps/ForecastStep";
import ProjectSiteAddressStep from "./steps/ProjectSiteAddressStep";
import EstimateDefaultsStep from "./steps/EstimateDefaultsStep";
import AddPositionStep from "./steps/AddPositionStep";
import ConfigurationStep from "./steps/ConfigurationStep";
import ReviewStep from "./steps/ReviewStep";
import { Button, Small } from "../../estimatePicker/tabs/shared";
import { useEstimateWorkflow } from "../../estimateWorkflow/useEstimateWorkflow";

// TODO/DEPRECATED(C7.7): Old estimate configurator shell. Keep in place for compatibility
// while the Admin-led configurator flow is rebuilt, then delete or replace.

type Props = {
  estimate: any;
  position: any;
  onExit: () => void;
  onSavePosition: (updatedPosition: any) => Promise<void>;
};

const STEP_META: Record<string, { title: string; description: string; nextLabel?: string }> = {
  forecast: {
    title: "Estimated Order Forecast",
    description: "Capture or confirm the high-level forecast timing for this opening.",
  },
  projectSiteAddress: {
    title: "Project Site Address",
    description: "Confirm the project site details before the position workflow continues.",
  },
  estimateDefaults: {
    title: "Estimate Defaults",
    description: "Estimate Defaults now run sequentially through supplier/product, timber where relevant, and hardware where relevant.",
  },
  configuration: {
    title: "Configuration",
    description: "Configuration is now the true working step for position reference, quantity, room, dimensions, layout, system options and native render editing.",
  },
  review: {
    title: "Save / Finish",
    description: "Review the complete position draft, save it, then decide whether to add another position or finish.",
    nextLabel: "Finish review",
  },
};

function renderStep(
  stepId: string,
  estimate: any,
  position: any,
  onSavePosition: (updatedPosition: any) => Promise<void>,
  onExitWorkflow: () => void
) {
  if (stepId === "forecast") return <ForecastStep />;
  if (stepId === "projectSiteAddress") return <ProjectSiteAddressStep />;
  if (stepId === "estimateDefaults") return <EstimateDefaultsStep />;
  if (stepId === "addPosition") return <AddPositionStep />;
  if (stepId === "configuration") {
    return (
      <ConfigurationStep
        estimate={estimate}
        position={position}
        onSavePosition={onSavePosition}
        onExitWorkflow={onExitWorkflow}
      />
    );
  }
  return <ReviewStep />;
}

export default function ConfiguratorWorkflowShell(props: Props) {
  const { estimate, position, onExit, onSavePosition } = props;
  const {
    currentStepKey,
    visibleSteps,
    completedStepIds,
    skippedStepIds,
    canAccessStep,
    setCurrentStepKey,
    canGoBack,
    canGoNext,
    goToPreviousStep,
    goToNextStep,
    validationErrors,
    saveDraft,
  } = useEstimateWorkflow();

  const activeMeta = STEP_META[currentStepKey];
  const isConfigurationStep = currentStepKey === "configuration";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!isConfigurationStep && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 2 }}>
            <Small>
              Estimate {estimate?.estimateRef || estimate?.id} • Position {position?.positionRef || position?.id}
            </Small>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={saveDraft}>Save draft</Button>
            <Button variant="secondary" onClick={onExit}>Exit workflow</Button>
          </div>
        </div>
      )}

      <ConfiguratorProgress
        steps={visibleSteps}
        activeStepId={currentStepKey}
        completedStepIds={completedStepIds}
        skippedStepIds={skippedStepIds}
        canAccessStep={canAccessStep}
        onStepClick={setCurrentStepKey}
      />
      <ConfiguratorStepFrame
        title={activeMeta.title}
        description={activeMeta.description}
        errors={validationErrors}
        canGoBack={canGoBack}
        canGoNext={canGoNext}
        onBack={goToPreviousStep}
        onNext={goToNextStep}
        nextLabel={activeMeta.nextLabel}
        hideHeader={isConfigurationStep}
      >
        {renderStep(currentStepKey, estimate, position, onSavePosition, onExit)}
      </ConfiguratorStepFrame>
    </div>
  );
}
