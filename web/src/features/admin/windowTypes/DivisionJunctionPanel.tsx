import React from "react";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";

type Props = {
  selectedDesign: WindowTypeDesignListItem | null;
};

export default function DivisionJunctionPanel(props: Props) {
  const { selectedDesign } = props;

  return (
    <div className="admin-card ui-card qs-migrated-114">
      <div className="admin-group-title">Division / Junction</div>
      <div className="admin-body-copy">
        Placeholder junction rules panel for:
        {selectedDesign ? ` ${selectedDesign.label}.` : " the selected design."}
      </div>
      <div className="admin-placeholder-box">
        Future controls:
        <br />
        - static vertical
        <br />
        - static horizontal
        <br />
        - flying vertical
        <br />
        - adjustable split position defaults
        <br />
        - owner field selector for flying mullions
      </div>
    </div>
  );
}
