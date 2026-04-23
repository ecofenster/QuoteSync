import React from "react";
import { Input, labelStyle } from "../../../estimatePicker/tabs/shared";
import { useEstimateWorkflow } from "../../../estimateWorkflow/useEstimateWorkflow";

export default function ProjectSiteAddressStep() {
  const { draft, updateDraftSection } = useEstimateWorkflow();
  if (!draft) return null;

  const update = (key: string, value: string) => updateDraftSection("projectSiteAddress", { [key]: value } as any);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div>
          <div style={labelStyle}>Address line 1</div>
          <Input value={draft.projectSiteAddress.addressLine1 ?? ""} onChange={(event) => update("addressLine1", event.currentTarget.value)} />
        </div>
        <div>
          <div style={labelStyle}>Address line 2</div>
          <Input value={draft.projectSiteAddress.addressLine2 ?? ""} onChange={(event) => update("addressLine2", event.currentTarget.value)} />
        </div>
        <div>
          <div style={labelStyle}>City / town</div>
          <Input value={draft.projectSiteAddress.city ?? ""} onChange={(event) => update("city", event.currentTarget.value)} />
        </div>
        <div>
          <div style={labelStyle}>County</div>
          <Input value={draft.projectSiteAddress.county ?? ""} onChange={(event) => update("county", event.currentTarget.value)} />
        </div>
        <div>
          <div style={labelStyle}>Postcode</div>
          <Input value={draft.projectSiteAddress.postcode ?? ""} onChange={(event) => update("postcode", event.currentTarget.value)} />
        </div>
        <div>
          <div style={labelStyle}>what3words</div>
          <Input value={draft.projectSiteAddress.what3words ?? ""} onChange={(event) => update("what3words", event.currentTarget.value)} />
        </div>
      </div>
    </div>
  );
}
