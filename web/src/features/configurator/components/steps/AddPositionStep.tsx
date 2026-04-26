import React from "react";
import { Input, Small, labelStyle } from "../../../estimatePicker/tabs/shared";
import { useEstimateWorkflow } from "../../../estimateWorkflow/useEstimateWorkflow";

// TODO/DEPRECATED(C7.7): Old estimate-side add-position seed step. Retained only
// until the rebuilt Admin-led configurator replaces this path.

export default function AddPositionStep() {
  const { draft, updateDraftSection } = useEstimateWorkflow();
  if (!draft) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Small>
        This step now acts as the quick system seed only. Position reference, quantity, room name, width and height are entered directly in Configuration.
      </Small>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div>
          <div style={labelStyle}>Product / system</div>
          <Input
            value={draft.addPosition.product ?? ""}
            onChange={(event) => updateDraftSection("addPosition", { product: event.currentTarget.value })}
          />
        </div>
        <div>
          <div style={labelStyle}>Product type</div>
          <Input
            value={draft.addPosition.productType ?? ""}
            onChange={(event) => updateDraftSection("addPosition", { productType: event.currentTarget.value })}
          />
        </div>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fafafa", padding: 12, display: "grid", gap: 4 }}>
        <Small>Next step</Small>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#18181b" }}>
          Configuration becomes the working position step for reference, quantity, room, size, layout, system options and render editing.
        </div>
      </div>
    </div>
  );
}
