import React from "react";
import type {
  ConfiguratorWorkflowStepDefinition,
  ConfiguratorWorkflowStepId,
} from "../../estimateWorkflow/workflow.types";

type Props = {
  steps: ConfiguratorWorkflowStepDefinition[];
  activeStepId: ConfiguratorWorkflowStepId;
  completedStepIds: ConfiguratorWorkflowStepId[];
  skippedStepIds: ConfiguratorWorkflowStepId[];
  canAccessStep: (stepId: ConfiguratorWorkflowStepId) => boolean;
  onStepClick: (stepId: ConfiguratorWorkflowStepId) => void;
};

export default function ConfiguratorProgress(props: Props) {
  const { steps, activeStepId, completedStepIds, skippedStepIds, canAccessStep, onStepClick } = props;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {steps.map((step) => {
          const isActive = step.id === activeStepId;
          const isCompleted = completedStepIds.includes(step.id);
          const isSkipped = skippedStepIds.includes(step.id);
          const isAccessible = canAccessStep(step.id) || isActive;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick(step.id)}
              disabled={!isAccessible}
              style={{
                borderRadius: 12,
                border: isActive ? "1px solid #18181b" : "1px solid #e4e4e7",
                background: isActive ? "#18181b" : isSkipped ? "#fafafa" : "#fff",
                color: isActive ? "#fff" : "#18181b",
                padding: "8px 10px",
                minWidth: 120,
                textAlign: "left",
                cursor: isAccessible ? "pointer" : "not-allowed",
                opacity: isAccessible ? 1 : 0.55,
                display: "grid",
                gap: 2,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: isActive ? "#d4d4d8" : "#71717a" }}>
                Step {step.order}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{step.label}</div>
              <div style={{ fontSize: 11, color: isActive ? "#e4e4e7" : "#71717a" }}>
                {isSkipped ? "Skipped" : isCompleted ? "Complete" : isActive ? "Current" : "Pending"}
              </div>
            </button>
          );
        })}
    </div>
  );
}
