import React from "react";
import { buildWorkflowReviewSummary } from "../../configuratorWorkflow.summary";
import { useEstimateWorkflow } from "../../../estimateWorkflow/useEstimateWorkflow";

// TODO/DEPRECATED(C7.7): Old estimate-side review/save step. Retained temporarily
// for compatibility until the replacement configurator flow is ready.

export default function ReviewStep() {
  const { draft, updateDraftSection } = useEstimateWorkflow();
  if (!draft) return null;

  const rows = buildWorkflowReviewSummary(draft);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ borderRadius: 14, border: "1px solid #e4e4e7", background: "#fff", padding: 12, display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", textTransform: "uppercase" }}>{row.label}</div>
            <div style={{ fontSize: 14, color: "#18181b" }}>{row.value}</div>
          </div>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: "#18181b" }}>
        <input
          type="checkbox"
          checked={!!draft.review.confirmed}
          onChange={(event) => updateDraftSection("review", { confirmed: event.currentTarget.checked })}
        />
        <span>I confirm this workflow draft is ready to save and resume.</span>
      </label>
    </div>
  );
}
