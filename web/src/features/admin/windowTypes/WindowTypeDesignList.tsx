import React from "react";

export type WindowTypeDesignLayoutField = {
  row: number;
  column: number;
  key: string;
};

export type WindowTypeDesignLayout = {
  fieldsX: number;
  fieldsY: number;
  fields: WindowTypeDesignLayoutField[];
};

export type WindowTypeDesignListItem = {
  id: string;
  label: string;
  description: string;
  groupLabel?: string;
  layout?: WindowTypeDesignLayout;
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
    <div
      style={{
        padding: 8,
        display: "grid",
        gap: 8,
        alignContent: "start",
        borderRadius: 8,
        background: "#07100d",
        border: "1px solid rgba(34, 197, 94, 0.14)",
        color: "#d8eee4",
        minHeight: "calc(100vh - 156px)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: "#a7f3d0", textTransform: "uppercase" }}>Window layouts</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>
        {categoryLabel} → {fieldCountLabel}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {designs.map((design, index) => {
          const showGroupLabel = design.groupLabel && design.groupLabel !== designs[index - 1]?.groupLabel;
          return (
            <React.Fragment key={design.id}>
              {showGroupLabel ? (
                <div style={{ fontSize: 9, fontWeight: 800, color: "#7dd3a7", textTransform: "uppercase" }}>
                  {design.groupLabel}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onSelectDesign(design.id)}
                className={selectedDesignId === design.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                style={{
                  justifyContent: "flex-start",
                  padding: "7px 8px",
                  background: selectedDesignId === design.id ? "#22c55e" : "#0b1714",
                  borderColor: selectedDesignId === design.id ? "#22c55e" : "rgba(34, 197, 94, 0.18)",
                  color: selectedDesignId === design.id ? "#052e16" : "#d8eee4",
                }}
              >
                <span className="admin-nav-button-label">{design.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
