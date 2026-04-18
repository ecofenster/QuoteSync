import React from "react";
import { EstimateWorkflowContext } from "./EstimateWorkflowProvider";

export function useEstimateWorkflow() {
  const context = React.useContext(EstimateWorkflowContext);
  if (!context) {
    throw new Error("useEstimateWorkflow must be used within an EstimateWorkflowProvider.");
  }
  return context;
}
