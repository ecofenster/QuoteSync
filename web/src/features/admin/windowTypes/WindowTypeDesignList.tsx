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
    <div className="qs-migrated-197"
    >
      <div className="qs-migrated-172">Window layouts</div>
      <div className="qs-migrated-198">
        {categoryLabel} → {fieldCountLabel}
      </div>
      <div className="qs-migrated-57">
        {designs.map((design, index) => {
          const showGroupLabel = design.groupLabel && design.groupLabel !== designs[index - 1]?.groupLabel;
          return (
            <React.Fragment key={design.id}>
              {showGroupLabel ? (
                <div className="qs-migrated-199">
                  {design.groupLabel}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onSelectDesign(design.id)}
                className={selectedDesignId === design.id ? "admin-nav-button admin-nav-button--active window-types-design-button" : "admin-nav-button window-types-design-button"}
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
