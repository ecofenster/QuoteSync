import React from "react";
import ConfiguratorWorkspace from "../../ConfiguratorWorkspace";
import { useEstimateWorkflow } from "../../../estimateWorkflow/useEstimateWorkflow";

// TODO/DEPRECATED(C7.7): Old estimate-side configuration step. Retained temporarily
// while the Admin-led configurator rebuild is in progress.

type Props = {
  estimate: any;
  position: any;
  onSavePosition: (updatedPosition: any) => Promise<void>;
  onExitWorkflow: () => void;
};

export default function ConfigurationStep(props: Props) {
  const { estimate, position, onSavePosition, onExitWorkflow } = props;
  const { goToPreviousStep } = useEstimateWorkflow();

  return (
    <ConfiguratorWorkspace
      estimate={estimate}
      position={position}
      onBack={goToPreviousStep}
      onExitWorkflow={onExitWorkflow}
      embeddedInWorkflowShell
      onSavePosition={onSavePosition}
    />
  );
}
