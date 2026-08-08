import React, { useEffect, useMemo, useState } from "react";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorFieldCountMode,
  ConfiguratorProductCategory,
} from "../configuratorCatalog.types";
import type { WindowTypeDesignListItem, WindowTypeDesignLayout } from "./WindowTypeDesignList";
import WindowTypeEditor, { type RenderWorkspaceToolbarRegistration } from "./WindowTypeEditor";

type Props = {
  bootstrap: ConfiguratorCatalogBootstrap;
  initialCategory?: ConfiguratorLandingCategoryKey | null;
  onRenderWorkspaceActive?: (active: boolean) => void;
};

type ConfiguratorLandingCategoryKey = ConfiguratorProductCategory | "entrance_doors";
type AdminWindowTypePreviewView = "internal" | "external";

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

const MATERIAL_SYSTEM_OPTIONS = ["Timber", "Timber Alu", "uPVC", "uPVC Alu", "Aluminium", "Steel", "Sash n Case"] as const;

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
    return [
      {
        id: "windows-2-fixed-fixed-static",
        groupLabel: "B92 profile-section proof",
        label: "2 Field - Fixed / Fixed Static",
        description: "Two fixed fields with a static B92-11 centre mullion. The profile-section assembly proof is available from the local preview toggle.",
        layout: buildWindowTypeDesignLayout(2, 1),
      },
      {
        id: "windows-2-fixed-tilt-turn-left-static",
        groupLabel: "B92 profile-section proof",
        label: "2 Field - Fixed / Tilt & Turn Left",
        description: "Fixed field joined to a left-hinged tilt and turn field. The approved B92 profile-section assembly proof is available from the local preview toggle.",
        layout: buildWindowTypeDesignLayout(2, 1),
      },
      ...buildMaterialGroupedWindowDesigns("2", [
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
      ]),
    ];
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

function CategoryTileIcon(props: { category: ConfiguratorLandingCategoryKey }) {
  const stroke = "currentColor";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 48 48" width="58" height="58" aria-hidden="true" focusable="false">
      {props.category === "windows" ? (
        <>
          <rect x="14" y="8" width="20" height="30" rx="1.5" {...common} />
          <rect x="17" y="11" width="14" height="24" rx="0.8" {...common} />
          <path d="M24 11v24M17 23h14" {...common} />
        </>
      ) : props.category === "side_balcony_doors" ? (
        <>
          <rect x="11" y="9" width="26" height="31" rx="1.4" {...common} />
          <path d="M18 9v31M29 9v31M11 26h7M29 26h8" {...common} />
          <path d="M22 13h7v27h-7zM27 24h1.6" {...common} />
          <path d="M8 40h32" {...common} />
        </>
      ) : props.category === "entrance_doors" ? (
        <>
          <rect x="15" y="7" width="18" height="33" rx="1.4" {...common} />
          <path d="M19 11h10v8H19zM29 25h1.6" {...common} />
          <path d="M13 40h22" {...common} />
        </>
      ) : props.category === "lift_slide" ? (
        <>
          <rect x="8" y="11" width="32" height="27" rx="1.3" {...common} />
          <path d="M23 11v27M12 38h25M16 41h17" {...common} />
          <path d="M14 25h9M18 21l-4 4 4 4M34 25h-9M30 21l4 4-4 4" {...common} />
        </>
      ) : props.category === "curtain_wall" ? (
        <>
          <rect x="9" y="8" width="30" height="31" rx="1.2" {...common} />
          <path d="M19 8v31M29 8v31M9 18h30M9 28h30" {...common} />
        </>
      ) : props.category === "rooflights" ? (
        <>
          <path d="M9 28 24 11l16 9-15 17-16-9Z" {...common} />
          <path d="M15 28 25 17l9 5-10 11-9-5Z" {...common} />
          <path d="M9 28v5l16 9 15-17v-5M25 37v5M17 23l16 9" {...common} />
        </>
      ) : props.category === "internal_doors" ? (
        <>
          <rect x="11" y="8" width="26" height="32" rx="1.2" {...common} />
          <path d="M24 8v32M20 25h1.5M26.5 25H28" {...common} />
          <path d="M9 40h30" {...common} />
        </>
      ) : props.category === "garage_doors" ? (
        <>
          <path d="M8 20 24 9l16 11v20H8V20Z" {...common} />
          <rect x="13" y="22" width="22" height="18" rx="1.2" {...common} />
          <path d="M13 27h22M13 32h22M13 37h22" {...common} />
        </>
      ) : props.category === "pergolas" ? (
        <>
          <path d="M9 17h30M12 13h24M15 9h18" {...common} />
          <path d="M11 17v22M37 17v22M17 17v18M31 17v18" {...common} />
          <path d="M11 17 17 23M37 17l-6 6M11 39h26" {...common} />
        </>
      ) : props.category === "blinds" ? (
        <>
          <rect x="14" y="7" width="20" height="34" rx="1.2" {...common} />
          <path d="M14 12h20M14 16h20M14 20h20M14 24h20M14 28h20M14 32h20M14 36h20" {...common} />
          <path d="M37 9v27m0 0 2.4-2.4M37 36l-2.4-2.4" {...common} />
        </>
      ) : (
        <>
          <rect x="14" y="7" width="20" height="34" rx="1.2" {...common} />
          <path d="M18 8v32M30 8v32" {...common} />
          <path d="M19 13h10M19 17h10M19 21h10M19 25h10M19 29h10M19 33h10" {...common} />
        </>
      )}
    </svg>
  );
}

function ToolbarIconButton(props: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled || !props.onClick}
      title={props.title ?? props.label}
      className="window-types-toolbar-button"
      data-state={props.active ? "active" : "idle"}
    >
      <span className="qs-migrated-154">{props.icon}</span>
      <span>{props.label}</span>
    </button>
  );
}

function SaveToolbarButton(props: { icon: string; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      className="admin-nav-button window-types-save-button"
      data-variant={props.primary ? "primary" : "secondary"}
    >
      <span className="qs-migrated-155">{props.icon}</span>
      <span className="admin-nav-button-label">{props.label}</span>
    </button>
  );
}

function ConfiguratorLanding(props: { onOpenCategory: (category: ConfiguratorLandingCategoryKey) => void }) {
  return (
    <div className="qs-migrated-122">
      <div className="admin-card ui-card qs-migrated-123">
        <div className="admin-page-title">Configurator</div>
        <div className="admin-body-copy qs-migrated-156">
          Select a product category to open the render workspace. Current live technical rendering remains wired for Windows; other categories are staged as workspace placeholders.
        </div>
      </div>

      <div className="qs-migrated-157"
      >
        {PRODUCT_CATEGORY_OPTIONS.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => props.onOpenCategory(category.key)}
            className="admin-card ui-card qs-migrated-158"
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
  previewView: AdminWindowTypePreviewView;
  onBack: () => void;
  onSelectCategory: (category: ConfiguratorLandingCategoryKey) => void;
  onSelectFieldCount: (fieldCount: ConfiguratorFieldCountMode) => void;
  onSelectPreviewView: (view: AdminWindowTypePreviewView) => void;
  renderToolbarRegistration: RenderWorkspaceToolbarRegistration | null;
  children: React.ReactNode;
}) {
  const [selectedMaterialSystem, setSelectedMaterialSystem] = useState<(typeof MATERIAL_SYSTEM_OPTIONS)[number]>("Timber");
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const category = categoryLabel(props.activeCategory);
  const layout = props.activeCategory === "windows" ? `${fieldCountLabel(props.selectedFieldCountMode)} Field` : "Workspace";
  const operation = props.activeCategory === "windows" ? selectedOperationLabel(props.selectedDesign) : "Placeholder";
  const toolbar = props.renderToolbarRegistration;

  return (
    <div className="qs-migrated-159"
    >
      <div className="qs-migrated-160"
      >
        <div className="qs-migrated-161">
          Configurator &gt; Render &gt; {category} &gt; {layout} &gt; {operation}
        </div>
        <label className="qs-migrated-162">
          <span className="qs-migrated-163">Product</span>
          <select
            value={selectedMaterialSystem}
            onChange={(event) => setSelectedMaterialSystem(event.currentTarget.value as (typeof MATERIAL_SYSTEM_OPTIONS)[number])}
            className="admin-input qs-migrated-164"
          >
            {MATERIAL_SYSTEM_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="qs-migrated-165">
          <span className="qs-migrated-163">Layout</span>
          <select
            value={props.selectedFieldCountMode}
            onChange={(event) => props.onSelectFieldCount(event.currentTarget.value as ConfiguratorFieldCountMode)}
            className="admin-input qs-migrated-164"
            disabled={props.activeCategory !== "windows"}
          >
            {WINDOW_FIELD_COUNT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="qs-migrated-135">
          <span className="qs-migrated-163">View</span>
          <div className="qs-migrated-166">
            <button
              type="button"
              className={props.previewView === "internal" ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              onClick={() => props.onSelectPreviewView("internal")}
            >
              <span className="admin-nav-button-label">Internal</span>
            </button>
            <button
              type="button"
              className={props.previewView === "external" ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              onClick={() => props.onSelectPreviewView("external")}
            >
              <span className="admin-nav-button-label">External</span>
            </button>
          </div>
        </div>
        <div className="qs-migrated-167" />
        <div className="qs-migrated-168">
          <ToolbarIconButton icon="⛶" label="Fit" onClick={toolbar?.controls.fit} disabled={!toolbar} title="Fit drawing to viewport" />
          <ToolbarIconButton icon="◎" label="100%" onClick={toolbar?.controls.setOneToOne} disabled={!toolbar} title="Set scale to 1:1" />
          <ToolbarIconButton icon="+" label="Zoom" onClick={toolbar?.controls.zoomIn} disabled={!toolbar} title="Zoom in" />
          <ToolbarIconButton
            icon="✋"
            label="Pan"
            active={toolbar?.state.viewport.tool === "pan"}
            onClick={toolbar?.controls.togglePan}
            disabled={!toolbar}
            title="Toggle pan mode"
          />
          <ToolbarIconButton
            icon="▥"
            label="Dimensions"
            active={toolbar?.state.showDimensions}
            onClick={toolbar?.controls.toggleDimensions}
            disabled={!toolbar}
            title="Toggle dimension overlay"
          />
          <ToolbarIconButton
            icon="▥▥"
            label="Profiles"
            active={toolbar?.state.showProfiles}
            onClick={toolbar?.controls.toggleProfiles}
            disabled={!toolbar}
            title="Toggle profile reference callouts"
          />
          <ToolbarIconButton
            icon="▤"
            label="Profiles/Sections"
            disabled
            title="No separate section overlay is available in this render preview yet"
          />
          <ToolbarIconButton
            icon="▣"
            label="Notes"
            active={showDetailsPanel}
            onClick={() => setShowDetailsPanel((current) => !current)}
            title="Toggle details panel"
          />
          <ToolbarIconButton icon="..." label="More" disabled title="No additional render actions are wired yet" />
        </div>
        <div className="qs-migrated-169" />
        <SaveToolbarButton icon="▣" label="Save Type" />
        <SaveToolbarButton icon="✓" label="Save & Close" primary />
      </div>

      <div className="window-types-workspace-grid" data-details={showDetailsPanel ? "visible" : "hidden"}>
        <aside className="qs-migrated-170"
        >
          <button
            type="button"
            className="admin-nav-button qs-migrated-171"
            onClick={props.onBack}
          >
            <span className="admin-nav-button-label">Back to Configurator</span>
          </button>
          <div className="qs-migrated-172">Window Categories</div>
          <div className="qs-migrated-173">
            {WORKSPACE_CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => props.onSelectCategory(option.key)}
                title={option.label}
                className="window-types-category-tile"
                data-state={props.activeCategory === option.key ? "active" : "idle"}
              >
                <span aria-hidden="true" className="window-types-category-icon">
                  <CategoryTileIcon category={option.key} />
                </span>
                <span className="qs-migrated-174">{option.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="qs-migrated-175">{props.children}</main>

        {showDetailsPanel ? (
        <aside className="qs-migrated-176"
        >
          <div className="qs-migrated-177">Details</div>
          <div className="qs-migrated-19">
            {["Measurements", "Profiles", "Details"].map((tab) => (
              <span
                key={tab}
                className={tab === "Measurements" ? "admin-nav-button admin-nav-button--active window-types-details-tab" : "admin-nav-button window-types-details-tab"}
              >
                <span className="admin-nav-button-label">{tab}</span>
              </span>
            ))}
          </div>
          <div className="qs-migrated-80">
            <div className="qs-migrated-172">Dimensions</div>
            <div className="qs-migrated-178">
              <span>Overall width</span><span>1000 mm</span>
            </div>
            <div className="qs-migrated-178">
              <span>Overall height</span><span>1000 mm</span>
            </div>
            <div className="qs-migrated-172">Frame</div>
            <div className="qs-migrated-178">
              <span>Top / jambs</span><span>57 mm</span>
            </div>
            <div className="qs-migrated-178">
              <span>Bottom sill</span><span>72 mm</span>
            </div>
            <div className="qs-migrated-172">Opening</div>
            <div className="qs-migrated-178">
              <span>Daylight</span><span>886 x 871</span>
            </div>
            <div className="qs-migrated-178">
              <span>Glass order</span><span>912 x 897</span>
            </div>
          </div>
        </aside>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminWindowTypesWorkspace(props: Props) {
  const { bootstrap, initialCategory, onRenderWorkspaceActive } = props;
  const [activeCategory, setActiveCategory] = useState<ConfiguratorLandingCategoryKey | null>(initialCategory ?? null);
  const [selectedFieldCountMode, setSelectedFieldCountMode] = useState<ConfiguratorFieldCountMode>("1");
  const [selectedWindowTypeId, setSelectedWindowTypeId] = useState("");
  const [previewView, setPreviewView] = useState<AdminWindowTypePreviewView>("internal");
  const [renderToolbarRegistration, setRenderToolbarRegistration] = useState<RenderWorkspaceToolbarRegistration | null>(null);

  const designOptions = useMemo(
    () => buildPlaceholderDesigns("windows", selectedFieldCountMode),
    [selectedFieldCountMode]
  );

  React.useEffect(() => {
    setSelectedWindowTypeId(designOptions[0]?.id ?? "");
  }, [designOptions]);

  useEffect(() => {
    onRenderWorkspaceActive?.(activeCategory !== null);
    return () => onRenderWorkspaceActive?.(false);
  }, [activeCategory, onRenderWorkspaceActive]);

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
      previewView={previewView}
      onBack={() => setActiveCategory(null)}
      onSelectCategory={setActiveCategory}
      onSelectFieldCount={setSelectedFieldCountMode}
      onSelectPreviewView={setPreviewView}
      renderToolbarRegistration={renderToolbarRegistration}
    >
      {activeCategory === "windows" ? (
        <div>
          <WindowTypeEditor
            categoryLabel="Windows"
            fieldCountLabel={fieldCountLabel(selectedFieldCountMode)}
            selectedDesign={selectedDesign}
            bootstrap={bootstrap}
            previewView={previewView}
            onRenderToolbarRegistration={setRenderToolbarRegistration}
          />
        </div>
      ) : (
        <div className="admin-card ui-card qs-migrated-179">
          <div className="admin-page-title">{categoryLabel(activeCategory)} render workspace coming later</div>
          <div className="admin-body-copy">
            This category opens the render workspace shell now, but no category-specific renderer or source model is wired in this layout-only pass.
          </div>
          <div className="admin-placeholder-box qs-migrated-180">
            Placeholder only. Existing Windows editor/render behaviour is preserved separately.
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
