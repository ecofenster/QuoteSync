import React from "react";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";

type Props = {
  selectedDesign: WindowTypeDesignListItem | null;
};

export default function FieldDefinitionPanel(props: Props) {
  const { selectedDesign } = props;

  return (
    <div className="admin-card ui-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div className="admin-group-title">Field Definition</div>
      <div className="admin-body-copy">
        Placeholder ordered field list for the selected design:
        {selectedDesign ? ` ${selectedDesign.label}.` : " No design selected."}
      </div>
      <div className="admin-placeholder-box">
        Future controls:
        <br />
        - field list left → right / top → bottom
        <br />
        - operation type
        <br />
        - opening direction
        <br />
        - handing / sequence
      </div>
    </div>
  );
}
