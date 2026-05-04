import React, { useMemo, useState } from "react";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorFieldCountMode,
  ConfiguratorProductCategory,
} from "../configuratorCatalog.types";
import WindowTypeDesignList, { type WindowTypeDesignListItem } from "./WindowTypeDesignList";
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

function buildPlaceholderDesigns(
  category: ConfiguratorProductCategory,
  fieldCountMode: ConfiguratorFieldCountMode
): WindowTypeDesignListItem[] {
  if (category === "windows" && fieldCountMode === "1") {
    return [
      { id: "windows-1-fixed", label: "Fixed", description: "Single fixed light placeholder." },
      { id: "windows-1-fixed-sash", label: "Fixed Sash", description: "Single fixed sash placeholder." },
      { id: "windows-1-tilt-turn-left", label: "Tilt & Turn Left", description: "Single inward opening, hinge left." },
      { id: "windows-1-tilt-turn-right", label: "Tilt & Turn Right", description: "Single inward opening, hinge right." },
      { id: "windows-1-sash-case", label: "Sash & Case", description: "Placeholder design option for future support." },
    ];
  }
  if (category === "windows" && fieldCountMode === "2") {
    return [
      { id: "windows-2-fixed-fixed-static", label: "Pilot Profile: Fixed / Fixed", description: "Static fixed/fixed mullion, B92-14." },
      {
        id: "windows-2-fixed-tiltturn-handle-centre",
        label: "Pilot Profile: Fixed / T&T Handle Centre",
        description: "Mixed fixed/T&T vertical, handle at centre, B92-12.",
      },
      {
        id: "windows-2-fixed-tiltturn-hinge-centre",
        label: "Pilot Profile: Fixed / T&T Hinge Centre",
        description: "Mixed fixed/T&T vertical, hinge at centre, B78-13.",
      },
      {
        id: "windows-2-tiltturn-tiltturn-static",
        label: "Pilot Profile: T&T / T&T Static",
        description: "Static T&T/T&T mullion, B92-15.",
      },
      {
        id: "windows-2-slave-master-flying",
        label: "Pilot Profile: Slave / Master Flying Mullion",
        description: "Flying mullion, B92-18.",
      },
      {
        id: "windows-2-fixed-over-fixed-vertical",
        label: "Pilot Profile: Fixed over Fixed",
        description: "Vertical stack with fixed/fixed transom, B92-23.",
      },
      {
        id: "windows-2-fixed-over-tiltturn-vertical",
        label: "Pilot Profile: Fixed over T&T",
        description: "Vertical stack with fixed over T&T transom, B92-21.",
      },
      {
        id: "windows-2-tiltturn-over-fixed-vertical",
        label: "Pilot Profile: T&T over Fixed",
        description: "Vertical stack with T&T over fixed transom, B92-20.",
      },
    ];
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
