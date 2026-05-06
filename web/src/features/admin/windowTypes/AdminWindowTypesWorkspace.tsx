import React, { useMemo, useState } from "react";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorFieldCountMode,
  ConfiguratorProductCategory,
} from "../configuratorCatalog.types";
import WindowTypeDesignList, {
  type WindowTypeDesignListItem,
  type WindowTypeDesignLayout,
} from "./WindowTypeDesignList";
import WindowTypeEditor from "./WindowTypeEditor";

type Props = {
  bootstrap: ConfiguratorCatalogBootstrap;
};

const PRODUCT_CATEGORY_OPTIONS: Array<{ key: ConfiguratorProductCategory; label: string }> = [
  { key: "windows", label: "Windows" },
  { key: "side_balcony_doors", label: "Side/Balcony Doors" },
  { key: "lift_slide", label: "Lift & Slide" },
  { key: "sliding", label: "Sliding" },
  { key: "curtain_wall", label: "Curtain Wall" },
  { key: "rooflights", label: "Rooflights" },
  { key: "internal_doors", label: "Internal Doors" },
  { key: "garage_doors", label: "Garage Doors" },
  { key: "pergolas", label: "Pergolas" },
  { key: "blinds", label: "Blinds" },
  { key: "shutters", label: "Shutters" },
];

const WINDOW_FIELD_COUNT_OPTIONS: Array<{ key: ConfiguratorFieldCountMode; label: string }> = [
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "grid", label: "Grid" },
  { key: "freehand", label: "Freehand" },
];

const WINDOW_MATERIAL_GROUPS = [
  { key: "timber", label: "Timber / Timber Alu" },
  { key: "upvc", label: "uPVC / uPVC Alu" },
  { key: "aluminium", label: "Aluminium" },
  { key: "steel", label: "Steel" },
] as const;

function buildWindowTypeDesignLayout(fieldsX: number, fieldsY: number): WindowTypeDesignLayout {
  const fields = Array.from({ length: fieldsY }, (_, row) =>
    Array.from({ length: fieldsX }, (_, column) => ({
      row,
      column,
      key: `${column}:${row}`,
    }))
  ).flat();

  return { fieldsX, fieldsY, fields };
}

function buildMaterialGroupedWindowDesigns(
  fieldCountMode: Extract<ConfiguratorFieldCountMode, "1" | "2" | "3" | "4" | "6">,
  entries: Array<{
    key: string;
    label: string;
    description: string;
    fieldsX: number;
    fieldsY: number;
    timberUpvcOnly?: boolean;
  }>
): WindowTypeDesignListItem[] {
  return WINDOW_MATERIAL_GROUPS.flatMap((group) =>
    entries
      .filter((entry) => !entry.timberUpvcOnly || group.key === "timber" || group.key === "upvc")
      .map((entry) => ({
        id: `windows-${fieldCountMode}-${group.key}-${entry.key}`,
        groupLabel: group.label,
        label: entry.label,
        description: entry.description,
        layout: buildWindowTypeDesignLayout(entry.fieldsX, entry.fieldsY),
      }))
  );
}

function buildPlaceholderDesigns(
  category: ConfiguratorProductCategory,
  fieldCountMode: ConfiguratorFieldCountMode
): WindowTypeDesignListItem[] {
  if (category === "windows" && fieldCountMode === "1") {
    return buildMaterialGroupedWindowDesigns("1", [
      {
        key: "inward-opening",
        label: "1 Field - Inward Opening",
        description: "Single inward-opening field family. Field operation is selected from the preview context menu.",
        fieldsX: 1,
        fieldsY: 1,
      },
      {
        key: "outward-opening",
        label: "1 Field - Outward Opening",
        description: "Single outward-opening field family. Detailed operations will be selected per field.",
        fieldsX: 1,
        fieldsY: 1,
      },
      {
        key: "sash-case",
        label: "Sash & Case",
        description: "Single sash and case family placeholder.",
        fieldsX: 1,
        fieldsY: 1,
        timberUpvcOnly: true,
      },
    ]);
  }
  if (category === "windows" && fieldCountMode === "2") {
    return buildMaterialGroupedWindowDesigns("2", [
      {
        key: "horizontal",
        label: "2 Field - Horizontal",
        description: "Two-field horizontal window family. Field operations are selected per field.",
        fieldsX: 2,
        fieldsY: 1,
      },
      {
        key: "vertical",
        label: "2 Field - Vertical",
        description: "Two-field vertical window family. Field operations are selected per field.",
        fieldsX: 1,
        fieldsY: 2,
      },
    ]);
  }
  if (category === "windows" && fieldCountMode === "3") {
    return buildMaterialGroupedWindowDesigns("3", [
      {
        key: "horizontal",
        label: "3 Field - Horizontal",
        description: "Three-field horizontal window family. Field operations are selected per field.",
        fieldsX: 3,
        fieldsY: 1,
      },
      {
        key: "vertical",
        label: "3 Field - Vertical",
        description: "Three-field vertical window family. Field operations are selected per field.",
        fieldsX: 1,
        fieldsY: 3,
      },
    ]);
  }
  if (category === "windows" && fieldCountMode === "4") {
    return buildMaterialGroupedWindowDesigns("4", [
      {
        key: "horizontal",
        label: "4 Field - Horizontal",
        description: "Four-field horizontal window family. Field operations are selected per field.",
        fieldsX: 4,
        fieldsY: 1,
      },
      {
        key: "vertical",
        label: "4 Field - Vertical",
        description: "Four-field vertical window family. Field operations are selected per field.",
        fieldsX: 1,
        fieldsY: 4,
      },
      {
        key: "2x2-grid",
        label: "4 Field - 2x2 Grid",
        description: "Four-field 2x2 grid window family. Field operations are selected per field.",
        fieldsX: 2,
        fieldsY: 2,
      },
    ]);
  }
  if (category === "windows" && fieldCountMode === "6") {
    return buildMaterialGroupedWindowDesigns("6", [
      {
        key: "3x2-grid",
        label: "6 Field - 3x2 Grid",
        description: "Six-field 3x2 grid window family. Field operations are selected per field.",
        fieldsX: 3,
        fieldsY: 2,
      },
      {
        key: "2x3-grid",
        label: "6 Field - 2x3 Grid",
        description: "Six-field 2x3 grid window family. Field operations are selected per field.",
        fieldsX: 2,
        fieldsY: 3,
      },
    ]);
  }
  if (category === "windows" && fieldCountMode === "grid") {
    return [
      {
        id: "windows-grid-2x2-mixed-profile-pilot",
        label: "Pilot Profile: 2x2 Mixed Grid",
        description: "Top-left fixed, top-right fixed, bottom-left fixed, bottom-right T&T.",
      },
    ];
  }
  if (category === "windows") {
    return [
      {
        id: `windows-${fieldCountMode}-placeholder`,
        label: `${fieldCountMode} field placeholder`,
        description: "Window Type definitions for this layout count will be defined here.",
      },
    ];
  }
  return [
    {
      id: `${category}-${fieldCountMode}-placeholder`,
      label: `${PRODUCT_CATEGORY_OPTIONS.find((option) => option.key === category)?.label || "Category"} placeholder`,
      description: "Source-model scaffolding only. No category-specific definitions are wired yet.",
    },
  ];
}

export default function AdminWindowTypesWorkspace(props: Props) {
  const { bootstrap } = props;
  const [selectedCategory, setSelectedCategory] = useState<ConfiguratorProductCategory>("windows");
  const [selectedFieldCountMode, setSelectedFieldCountMode] = useState<ConfiguratorFieldCountMode>("1");
  const [selectedWindowTypeId, setSelectedWindowTypeId] = useState("");

  const designOptions = useMemo(
    () => buildPlaceholderDesigns(selectedCategory, selectedFieldCountMode),
    [selectedCategory, selectedFieldCountMode]
  );

  React.useEffect(() => {
    setSelectedWindowTypeId(designOptions[0]?.id ?? "");
  }, [designOptions]);

  const selectedDesign =
    designOptions.find((design) => design.id === selectedWindowTypeId) ?? designOptions[0] ?? null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="admin-card ui-card" style={{ padding: 12, display: "grid", gap: 10 }}>
        <div className="admin-page-title">Window Types</div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="admin-setting-label">Product category</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRODUCT_CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedCategory(option.key)}
                className={selectedCategory === option.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              >
                <span className="admin-nav-button-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div className="admin-setting-label">Field count / layout</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {WINDOW_FIELD_COUNT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedFieldCountMode(option.key)}
                className={selectedFieldCountMode === option.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              >
                <span className="admin-nav-button-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px minmax(420px, 1fr)",
          gap: 12,
          alignItems: "start",
        }}
      >
        <WindowTypeDesignList
          categoryLabel={PRODUCT_CATEGORY_OPTIONS.find((option) => option.key === selectedCategory)?.label || "Category"}
          fieldCountLabel={WINDOW_FIELD_COUNT_OPTIONS.find((option) => option.key === selectedFieldCountMode)?.label || selectedFieldCountMode}
          designs={designOptions}
          selectedDesignId={selectedWindowTypeId}
          onSelectDesign={setSelectedWindowTypeId}
        />
        <WindowTypeEditor
          categoryLabel={PRODUCT_CATEGORY_OPTIONS.find((option) => option.key === selectedCategory)?.label || "Category"}
          fieldCountLabel={WINDOW_FIELD_COUNT_OPTIONS.find((option) => option.key === selectedFieldCountMode)?.label || selectedFieldCountMode}
          selectedDesign={selectedDesign}
          bootstrap={bootstrap}
        />
      </div>
    </div>
  );
}
