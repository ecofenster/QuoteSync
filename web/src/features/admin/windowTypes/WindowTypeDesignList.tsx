import React from "react";

export type WindowTypeDesignListItem = {
  id: string;
  label: string;
  description: string;
};

type Props = {
  categoryLabel: string;
  fieldCountLabel: string;
  designs: WindowTypeDesignListItem[];
  selectedDesignId: string;
  onSelectDesign: (id: string) => void;
};

export default function WindowTypeDesignList(props: Props) {
  const { categoryLabel, fieldCountLabel, designs, selectedDesignId, onSelectDesign } = props;

  return (
    <div className="admin-card ui-card" style={{ padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
      <div className="admin-group-title">Window Type designs</div>
      <div className="admin-body-copy">
        {categoryLabel} → {fieldCountLabel}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button type="button" className="admin-nav-button">
          <span className="admin-nav-button-label">New Type</span>
        </button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {designs.map((design) => (
          <button
            key={design.id}
            type="button"
            onClick={() => onSelectDesign(design.id)}
            className={selectedDesignId === design.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
          >
            <span className="admin-nav-button-label">{design.label}</span>
            <span className={selectedDesignId === design.id ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
              {design.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
