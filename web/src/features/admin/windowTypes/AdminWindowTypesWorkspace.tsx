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

type ConfiguratorLandingCategoryKey = ConfiguratorProductCategory | "entrance_doors";

const PRODUCT_CATEGORY_OPTIONS: Array<{ key: ConfiguratorLandingCategoryKey; label: string }> = [
  { key: "windows", label: "Windows" },
  { key: "side_balcony_doors", label: "Side/Balcony Doors" },
  { key: "entrance_doors", label: "Entrance Doors" },
  { key: "lift_slide", label: "Lift and Slide" },
  { key: "curtain_wall", label: "Curtain Wall" },
  { key: "rooflights", label: "Rooflights" },
  { key: "internal_doors", label: "Internal Doors" },
  { key: "garage_doors", label: "Garage Doors" },
  { key: "pergolas", label: "Pergolas" },
  { key: "blinds", label: "Blinds" },
  { key: "shutters", label: "Shutters" },
];

const WORKSPACE_CATEGORY_OPTIONS = PRODUCT_CATEGORY_OPTIONS;

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

function categoryLabel(category: ConfiguratorLandingCategoryKey) {
  return PRODUCT_CATEGORY_OPTIONS.find((option) => option.key === category)?.label || "Category";
}

function fieldCountLabel(fieldCountMode: ConfiguratorFieldCountMode) {
  return WINDOW_FIELD_COUNT_OPTIONS.find((option) => option.key === fieldCountMode)?.label || fieldCountMode;
}

function selectedOperationLabel(selectedDesign: WindowTypeDesignListItem | null) {
  const label = selectedDesign?.label ?? "Fixed";
  if (label.toLowerCase().includes("tilt")) return "Tilt & Turn";
  if (label.toLowerCase().includes("fixed sash")) return "Fixed Sash";
  return "Fixed";
}

function ConfiguratorLanding(props: { onOpenCategory: (category: ConfiguratorLandingCategoryKey) => void }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="admin-card ui-card" style={{ padding: 20, display: "grid", gap: 8 }}>
        <div className="admin-page-title">Configurator</div>
        <div className="admin-body-copy" style={{ maxWidth: 900 }}>
          Select a product category to open the render workspace. Current live technical rendering remains wired for Windows; other categories are staged as workspace placeholders.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        {PRODUCT_CATEGORY_OPTIONS.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => props.onOpenCategory(category.key)}
            className="admin-card ui-card"
            style={{
              padding: 18,
              minHeight: 112,
              display: "grid",
              gap: 8,
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-primary)",
            }}
          >
            <span className="admin-group-title">{category.label}</span>
            <span className="admin-body-copy">
              {category.key === "windows" ? "Open render workspace" : "Render workspace coming later"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkspaceShell(props: {
  activeCategory: ConfiguratorLandingCategoryKey;
  selectedFieldCountMode: ConfiguratorFieldCountMode;
  selectedDesign: WindowTypeDesignListItem | null;
  onBack: () => void;
  onSelectCategory: (category: ConfiguratorLandingCategoryKey) => void;
  onSelectFieldCount: (fieldCount: ConfiguratorFieldCountMode) => void;
  children: React.ReactNode;
}) {
  const category = categoryLabel(props.activeCategory);
  const layout = props.activeCategory === "windows" ? `${fieldCountLabel(props.selectedFieldCountMode)} Field` : "Workspace";
  const operation = props.activeCategory === "windows" ? selectedOperationLabel(props.selectedDesign) : "Placeholder";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 10 }}>
        <div className="admin-body-copy">Configurator &gt; Render &gt; {category} &gt; {layout} &gt; {operation}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div className="admin-page-title">{category} Render Workspace</div>
          <button type="button" className="admin-nav-button" onClick={props.onBack}>
            <span className="admin-nav-button-label">Back to Configurator</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="admin-nav-button admin-nav-button--active">
            <span className="admin-nav-button-label">Product: {category}</span>
          </span>
          <span className="admin-nav-button">
            <span className="admin-nav-button-label">Layout: {layout}</span>
          </span>
          <span className="admin-nav-button">
            <span className="admin-nav-button-label">Type: {operation}</span>
          </span>
          <span className="admin-nav-button" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span className="admin-nav-button-label">View:</span>
            <span className="admin-nav-button-label">Internal</span>
            <span className="admin-nav-button-desc">External later</span>
          </span>
          <span className="admin-nav-button">
            <span className="admin-nav-button-label">Tools: Preview</span>
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px minmax(520px, 1fr) 280px",
          gap: 12,
          alignItems: "start",
        }}
      >
        <aside className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 14, alignContent: "start", position: "sticky", top: 16 }}>
          <button type="button" className="admin-nav-button" onClick={props.onBack}>
            <span className="admin-nav-button-label">Back to Configurator</span>
          </button>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="admin-setting-label">Category</div>
            {WORKSPACE_CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => props.onSelectCategory(option.key)}
                className={props.activeCategory === option.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              >
                <span className="admin-nav-button-label">{option.label}</span>
              </button>
            ))}
          </div>
          {props.activeCategory === "windows" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="admin-setting-label">Layout</div>
              {WINDOW_FIELD_COUNT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => props.onSelectFieldCount(option.key)}
                  className={props.selectedFieldCountMode === option.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                >
                  <span className="admin-nav-button-label">{option.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <main style={{ minWidth: 0 }}>{props.children}</main>

        <aside className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 10, alignContent: "start", position: "sticky", top: 16 }}>
          <div className="admin-group-title">Details</div>
          <div className="admin-body-copy">Measurements, profiles, and render diagnostics are shown in the existing preview/editor panels.</div>
          <div className="admin-placeholder-box" style={{ margin: 0 }}>
            Right panel scaffold only. No render engine, SVG, DB, or right-click logic is changed.
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function AdminWindowTypesWorkspace(props: Props) {
  const { bootstrap } = props;
  const [activeCategory, setActiveCategory] = useState<ConfiguratorLandingCategoryKey | null>(null);
  const [selectedFieldCountMode, setSelectedFieldCountMode] = useState<ConfiguratorFieldCountMode>("1");
  const [selectedWindowTypeId, setSelectedWindowTypeId] = useState("");

  const designOptions = useMemo(
    () => buildPlaceholderDesigns("windows", selectedFieldCountMode),
    [selectedFieldCountMode]
  );

  React.useEffect(() => {
    setSelectedWindowTypeId(designOptions[0]?.id ?? "");
  }, [designOptions]);

  const selectedDesign =
    designOptions.find((design) => design.id === selectedWindowTypeId) ?? designOptions[0] ?? null;

  if (!activeCategory) {
    return <ConfiguratorLanding onOpenCategory={setActiveCategory} />;
  }

  return (
    <WorkspaceShell
      activeCategory={activeCategory}
      selectedFieldCountMode={selectedFieldCountMode}
      selectedDesign={selectedDesign}
      onBack={() => setActiveCategory(null)}
      onSelectCategory={setActiveCategory}
      onSelectFieldCount={setSelectedFieldCountMode}
    >
      {activeCategory === "windows" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px minmax(420px, 1fr)",
            gap: 12,
            alignItems: "start",
          }}
        >
          <WindowTypeDesignList
            categoryLabel="Windows"
            fieldCountLabel={fieldCountLabel(selectedFieldCountMode)}
            designs={designOptions}
            selectedDesignId={selectedWindowTypeId}
            onSelectDesign={setSelectedWindowTypeId}
          />
          <WindowTypeEditor
            categoryLabel="Windows"
            fieldCountLabel={fieldCountLabel(selectedFieldCountMode)}
            selectedDesign={selectedDesign}
            bootstrap={bootstrap}
          />
        </div>
      ) : (
        <div className="admin-card ui-card" style={{ padding: 20, minHeight: 520, display: "grid", gap: 10, alignContent: "start" }}>
          <div className="admin-page-title">{categoryLabel(activeCategory)} render workspace coming later</div>
          <div className="admin-body-copy">
            This category opens the render workspace shell now, but no category-specific renderer or source model is wired in this layout-only pass.
          </div>
          <div className="admin-placeholder-box" style={{ margin: 0 }}>
            Placeholder only. Existing Windows editor/render behaviour is preserved separately.
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
