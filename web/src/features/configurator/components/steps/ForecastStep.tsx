import React from "react";
import { Input, labelStyle } from "../../../estimatePicker/tabs/shared";
import { useEstimateWorkflow } from "../../../estimateWorkflow/useEstimateWorkflow";

export default function ForecastStep() {
  const { draft, updateDraftSection } = useEstimateWorkflow();
  if (!draft) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={labelStyle}>Estimated order forecast</div>
        <Input
          value={draft.forecast.estimatedOrderForecast ?? ""}
          onChange={(event) => updateDraftSection("forecast", { estimatedOrderForecast: event.currentTarget.value })}
          placeholder="e.g. June 2026"
        />
      </div>
    </div>
  );
}
