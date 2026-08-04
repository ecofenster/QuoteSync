import React, { useEffect, useMemo, useState } from "react";
import {
  createConfiguratorCatalogRecord,
  deleteConfiguratorCatalogRecord,
  getConfiguratorCatalogBootstrap,
  updateConfiguratorCatalogRecord,
} from "./configuratorCatalogService";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorManufacturerRecord,
  ConfiguratorProductRecord,
  ConfiguratorRenderProfileRecord,
  ConfiguratorTrickleVentEaValue,
  ConfiguratorWindowTypeRecord,
} from "./configuratorCatalog.types";
import { Button, H3, Small } from "../estimatePicker/tabs/shared";
import { buildAdminPreviewWindowDrawingModel } from "./rendering/adminPreviewRenderAdapter";
import DrawingViewport from "../configurator/rendering/DrawingViewport";
import {
  buildRenderDefinitionContextKey,
  buildResolvedSectionProfileSetFromRenderProfile,
  matchesRenderDefinitionContext,
  normalizeRenderProfileForView,
} from "../configurator/rendering/profileSectionMapping";
import {
  applyLayoutDefinitionOverridesToResolvedProfiles,
  buildAdminPreviewInputFromConfiguratorLayoutDefinition,
  buildFourFieldFixedStaticMullionLayoutDefinition,
  buildThreeFieldFixedStaticMullionLayoutDefinition,
  buildTwoFieldFixedStaticMullionLayoutDefinition,
} from "../configurator/configuratorSchema.helpers";
import AdminWindowTypesWorkspace from "./windowTypes/AdminWindowTypesWorkspace";
import B92ConfiguratorShell from "../b92Configurator/B92ConfiguratorShell";

type AdminConfiguratorTopTab = "manufacturers" | "windowTypes" | "configuratorRender" | "b92Configurator";
type ProductGroupKey =
  | "windows"
  | "sideBalconyDoors"
  | "liftSlide"
  | "sliding"
  | "curtainWall"
  | "rooflights"
  | "internalDoors"
  | "garageDoors"
  | "pergolas"
  | "blinds"
  | "shutters";
type WindowRenderTab = "1field" | "2field" | "3field" | "4field" | "5field" | "6field" | "grid" | "freehand";
type RenderProfileProductCode = "TT" | "OW" | "FX" | "LS" | "SL" | "BI" | "CW" | "RF" | "GD" | "VBE" | "VBI";
type RenderProfileViewCode = "IV" | "EV";
type RenderProfileVariantCode = "SASH" | "NOSASH";

const TOP_TABS: Array<{ key: AdminConfiguratorTopTab; label: string; description: string }> = [
  { key: "manufacturers", label: "Manufacturers", description: "Manufacturers and their products/systems only." },
  { key: "windowTypes", label: "Window Types", description: "Opening behaviours only, separate from render geometry." },
  { key: "configuratorRender", label: "Configurator Render", description: "Dimension-driven native render definition." },
  { key: "b92Configurator", label: "B92 Configurator", description: "Migration shell for the future main B92 configurator." },
];

const PRODUCT_GROUP_TABS: Array<{ key: ProductGroupKey; label: string }> = [
  { key: "windows", label: "Windows" },
  { key: "sideBalconyDoors", label: "Side/Balcony Doors" },
  { key: "liftSlide", label: "Lift & Slide" },
  { key: "sliding", label: "Sliding" },
  { key: "curtainWall", label: "Curtain Wall" },
  { key: "rooflights", label: "Rooflights" },
  { key: "internalDoors", label: "Internal Doors" },
  { key: "garageDoors", label: "Garage Doors" },
  { key: "pergolas", label: "Pergolas" },
  { key: "blinds", label: "Blinds" },
  { key: "shutters", label: "Shutters" },
];

const WINDOW_RENDER_TABS: Array<{ key: WindowRenderTab; label: string }> = [
  { key: "1field", label: "1 Field" },
  { key: "2field", label: "2 Field" },
  { key: "3field", label: "3 Field" },
  { key: "4field", label: "4 Field" },
  { key: "5field", label: "5 Field" },
  { key: "6field", label: "6 Field" },
  { key: "grid", label: "Grid" },
  { key: "freehand", label: "Freehand" },
];

const RENDER_PROFILE_PRODUCT_CODES: Array<{ code: RenderProfileProductCode; label: string }> = [
  { code: "TT", label: "Tilt & Turn" },
  { code: "OW", label: "Outward Window" },
  { code: "FX", label: "Fixed Window" },
  { code: "LS", label: "Lift & Slide" },
  { code: "SL", label: "Sliding" },
  { code: "BI", label: "Bifold" },
  { code: "CW", label: "Curtain Wall" },
  { code: "RF", label: "Rooflight" },
  { code: "GD", label: "Garage Door" },
  { code: "VBE", label: "Vertical Blind External" },
  { code: "VBI", label: "Vertical Blind Internal" },
];

const TRICKLE_VENT_PRESETS: Record<
  ConfiguratorTrickleVentEaValue,
  {
    label: string;
    slotWidthsMm: number[];
    slotGapsMm: number[];
    headVisibleMm: number;
    slotTopOffsetMm: number;
    slotHeightMm: number;
    slotBottomOffsetMm: number;
  }
> = {
  "2200": {
    label: "2200 EA",
    slotWidthsMm: [223],
    slotGapsMm: [],
    headVisibleMm: 59.5,
    slotTopOffsetMm: 31,
    slotHeightMm: 13,
    slotBottomOffsetMm: 15.5,
  },
  "4400": {
    label: "4400 EA",
    slotWidthsMm: [173.5, 173.5],
    slotGapsMm: [20],
    headVisibleMm: 59.5,
    slotTopOffsetMm: 31,
    slotHeightMm: 13,
    slotBottomOffsetMm: 15.5,
  },
  "6600": {
    label: "6600 EA",
    slotWidthsMm: [173.5, 173.5, 173.5],
    slotGapsMm: [12, 12],
    headVisibleMm: 59.5,
    slotTopOffsetMm: 31,
    slotHeightMm: 13,
    slotBottomOffsetMm: 15.5,
  },
};

const WINDOW_TYPE_CHOOSER = {
  inward: [
    { operation: "fixed", label: "Fixed" },
    { operation: "tilt_turn", label: "Tilt & Turn" },
  ],
  outward: [
    { operation: "top_hung", label: "Top Hung" },
    { operation: "side_hung", label: "Side Hung" },
    { operation: "reversible", label: "Reversible" },
    { operation: "pivot", label: "Pivot" },
  ],
} as const;

const OPENING_BEHAVIOUR_OPTIONS: Array<{
  operation: string;
  label: string;
  openingDirection: "inward" | "outward";
}> = [
  { operation: "fixed", label: "Fixed", openingDirection: "inward" },
  { operation: "fixed_sash", label: "Fixed Sash", openingDirection: "inward" },
  { operation: "tilt_turn", label: "Tilt & Turn", openingDirection: "inward" },
  { operation: "top_hung", label: "Top Hung", openingDirection: "outward" },
  { operation: "side_hung", label: "Side Hung", openingDirection: "outward" },
  { operation: "reversible", label: "Reversible", openingDirection: "outward" },
  { operation: "pivot", label: "Pivot", openingDirection: "outward" },
  { operation: "sliding", label: "Sliding", openingDirection: "outward" },
];

const OPENING_BEHAVIOUR_OPTIONS_BY_WINDOW_TAB: Record<WindowRenderTab, typeof OPENING_BEHAVIOUR_OPTIONS> = {
  "1field": OPENING_BEHAVIOUR_OPTIONS,
  "2field": [],
  "3field": [],
  "4field": [],
  "5field": [],
  "6field": [],
  grid: [],
  freehand: [],
};

const defaultBootstrap: ConfiguratorCatalogBootstrap = {
  manufacturers: [],
  products: [],
  windowTypes: [],
  sectionProfiles: [],
  profileMappings: [],
  renderProfiles: [],
  sectionDrawings: [],
  materials: [],
  colours: [],
  hardware: [],
  glass: [],
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  padding: "0 12px",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  height: 96,
  padding: "10px 12px",
  resize: "vertical",
};

const denseCardStyle: React.CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 12,
};

function FormField(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="admin-setting-label">{props.label}</span>
      {props.children}
    </label>
  );
}

function SectionShell(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="admin-card ui-card" style={{ padding: 20, display: "grid", gap: 8 }}>
        <div className="admin-page-title">{props.title}</div>
        <div className="admin-body-copy" style={{ maxWidth: 980 }}>{props.description}</div>
      </div>
      {props.children}
    </div>
  );
}

function PlaceholderGroup(props: { label: string }) {
  return (
    <div className="admin-card ui-card" style={{ padding: 20, display: "grid", gap: 8 }}>
      <div className="admin-group-title">{props.label}</div>
      <div className="admin-body-copy">
        This product-group render definition surface is prepared in the new admin structure, but the live dimension-driven editor in this pass is focused on Windows first.
      </div>
    </div>
  );
}

function blankManufacturer(): ConfiguratorManufacturerRecord {
  return {
    id: "",
    name: "",
    code: "",
    notes: "",
    is_active: true,
  };
}

function blankProduct(manufacturerId: string): ConfiguratorProductRecord {
  return {
    id: "",
    manufacturer_id: manufacturerId,
    name: "",
    code: "",
    product_family: "windows",
    notes: "",
    is_active: true,
  };
}

function blankWindowType(productId: string): ConfiguratorWindowTypeRecord {
  return {
    id: "",
    product_id: productId,
    name: "",
    code: "",
    opening_direction: "inward",
    operation_type: "fixed",
    sliding_direction: "none",
    view_logic: "both",
    notes: "",
    is_active: true,
  };
}

function blankRenderProfile(context: {
  manufacturerId: string;
  productId: string;
  windowTypeId: string;
}): ConfiguratorRenderProfileRecord {
  return {
    id: "",
    manufacturer_id: context.manufacturerId || null,
    product_id: context.productId || null,
    window_type_id: context.windowTypeId || null,
    name: "",
    code: "",
    operation_type: "fixed",
    view_logic: "both",
    frame_top_visible_mm: 37.5,
    frame_left_visible_mm: 37.5,
    frame_right_visible_mm: 37.5,
    frame_bottom_visible_mm: 37.5,
    sash_top_visible_mm: 57,
    sash_left_visible_mm: 57,
    sash_right_visible_mm: 57,
    sash_bottom_visible_mm: 57,
    bead_top_visible_mm: 21,
    bead_left_visible_mm: 21,
    bead_right_visible_mm: 21,
    bead_bottom_visible_mm: 21,
    preview_width_mm: 1000,
    preview_height_mm: 1200,
    handle_axis_offset_mm: 22,
    handle_height_mm: 1050,
    hinge_pivot_offset_mm: 0,
    trickle_vent_enabled: false,
    trickle_vent_ea_value: "",
    trickle_vent_head_visible_mm: null,
    trickle_vent_slot_top_offset_mm: null,
    trickle_vent_slot_height_mm: null,
    trickle_vent_slot_bottom_offset_mm: null,
    trickle_vent_slot_widths_mm: [],
    trickle_vent_slot_gaps_mm: [],
    external_cladding_inset_mm: 3,
    external_frame_cladding_colour: "",
    external_sash_cladding_colour: "",
    notes: "",
    is_active: true,
  };
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function applyTrickleVentPreset(
  draft: ConfiguratorRenderProfileRecord,
  eaValue: ConfiguratorTrickleVentEaValue | ""
): ConfiguratorRenderProfileRecord {
  if (!eaValue) {
    return {
      ...draft,
      trickle_vent_enabled: false,
      trickle_vent_ea_value: "",
      trickle_vent_head_visible_mm: null,
      trickle_vent_slot_top_offset_mm: null,
      trickle_vent_slot_height_mm: null,
      trickle_vent_slot_bottom_offset_mm: null,
      trickle_vent_slot_widths_mm: [],
      trickle_vent_slot_gaps_mm: [],
    };
  }
  const preset = TRICKLE_VENT_PRESETS[eaValue];
  return {
    ...draft,
    trickle_vent_enabled: true,
    trickle_vent_ea_value: eaValue,
    trickle_vent_head_visible_mm: preset.headVisibleMm,
    trickle_vent_slot_top_offset_mm: preset.slotTopOffsetMm,
    trickle_vent_slot_height_mm: preset.slotHeightMm,
    trickle_vent_slot_bottom_offset_mm: preset.slotBottomOffsetMm,
    trickle_vent_slot_widths_mm: [...preset.slotWidthsMm],
    trickle_vent_slot_gaps_mm: [...preset.slotGapsMm],
  };
}

function formatTrickleVentLayout(draft: ConfiguratorRenderProfileRecord) {
  const widths = Array.isArray(draft.trickle_vent_slot_widths_mm) ? draft.trickle_vent_slot_widths_mm : [];
  const gaps = Array.isArray(draft.trickle_vent_slot_gaps_mm) ? draft.trickle_vent_slot_gaps_mm : [];
  if (!widths.length) return "No slot layout defined";
  const parts: string[] = [];
  widths.forEach((width, index) => {
    if (index > 0) {
      const gap = gaps[index - 1];
      if (Number.isFinite(Number(gap))) parts.push(`${gap} gap`);
    }
    parts.push(`${width} slot`);
  });
  return parts.join(" + ");
}

function buildRenderProfileCode(
  productCode: RenderProfileProductCode,
  viewCode: RenderProfileViewCode,
  variantCode: RenderProfileVariantCode
) {
  return `${productCode}_${viewCode}_${variantCode}`;
}

function parseRenderProfileCode(code: string | null | undefined): {
  productCode: RenderProfileProductCode;
  viewCode: RenderProfileViewCode;
  variantCode: RenderProfileVariantCode;
} | null {
  const normalized = String(code || "").trim().toUpperCase();
  const parts = normalized.split("_");
  if (parts.length !== 3) return null;
  const [productCode, viewCode, variantCode] = parts;
  const isValidProductCode = RENDER_PROFILE_PRODUCT_CODES.some((entry) => entry.code === productCode);
  if (!isValidProductCode || (viewCode !== "IV" && viewCode !== "EV") || (variantCode !== "SASH" && variantCode !== "NOSASH")) {
    return null;
  }
  return {
    productCode: productCode as RenderProfileProductCode,
    viewCode: viewCode as RenderProfileViewCode,
    variantCode: variantCode as RenderProfileVariantCode,
  };
}

function deriveRenderProfileProductCode(openingDirection: "inward" | "outward", operationType: string): RenderProfileProductCode {
  const normalized = String(operationType || "").trim().toLowerCase();
  if (normalized === "fixed") return "FX";
  if (normalized === "fixed_sash") return "FX";
  if (normalized.includes("tilt") && normalized.includes("turn")) return "TT";
  if (normalized.includes("sliding")) return "SL";
  if (normalized.includes("sash") && normalized.includes("case")) return "OW";
  if (openingDirection === "outward") return "OW";
  return "FX";
}

function deriveRenderProfileViewCode(viewLogic: string | null | undefined): RenderProfileViewCode {
  return String(viewLogic || "").trim().toLowerCase() === "outside" ? "EV" : "IV";
}

function deriveRenderProfileVariantCode(operationType: string): RenderProfileVariantCode {
  return String(operationType || "").trim().toLowerCase() === "fixed" ? "NOSASH" : "SASH";
}

function buildPreviewInsertion(operationType: string) {
  switch (String(operationType || "").trim().toLowerCase()) {
    case "fixed":
      return "Fixed";
    case "fixed_sash":
      return "Fixed Sash";
    case "tilt_turn":
      return "Tilt & Turn Left";
    case "top_hung":
      return "Top Hung";
    case "side_hung":
      return "Turn Left";
    case "reversible":
      return "Reversible";
    case "pivot":
      return "Pivot";
    case "sash_and_case":
      return "Turn Left";
    case "sliding":
      return "Fixed";
    default:
      return "Fixed";
  }
}


function ManufacturersPanel(props: {
  bootstrap: ConfiguratorCatalogBootstrap;
  setBootstrap: React.Dispatch<React.SetStateAction<ConfiguratorCatalogBootstrap>>;
}) {
  const { bootstrap, setBootstrap } = props;
  const [selectedManufacturerId, setSelectedManufacturerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [manufacturerDraft, setManufacturerDraft] = useState<ConfiguratorManufacturerRecord>(blankManufacturer());
  const [productDraft, setProductDraft] = useState<ConfiguratorProductRecord>(blankProduct(""));
  const [isSaving, setIsSaving] = useState(false);

  const selectedManufacturer = bootstrap.manufacturers.find((row) => row.id === selectedManufacturerId) ?? null;
  const productsForManufacturer = bootstrap.products.filter((row) => row.manufacturer_id === selectedManufacturerId);
  const selectedProduct = productsForManufacturer.find((row) => row.id === selectedProductId) ?? null;

  useEffect(() => {
    setManufacturerDraft(selectedManufacturer ?? blankManufacturer());
  }, [selectedManufacturer]);

  useEffect(() => {
    setProductDraft(selectedProduct ?? blankProduct(selectedManufacturerId));
  }, [selectedManufacturerId, selectedProduct]);

  async function saveManufacturer() {
    setIsSaving(true);
    try {
      const saved = selectedManufacturerId
        ? await updateConfiguratorCatalogRecord<ConfiguratorManufacturerRecord>("manufacturers", selectedManufacturerId, manufacturerDraft)
        : await createConfiguratorCatalogRecord<ConfiguratorManufacturerRecord>("manufacturers", manufacturerDraft);
      setBootstrap((previous) => ({
        ...previous,
        manufacturers: [saved, ...previous.manufacturers.filter((row) => row.id !== saved.id)],
      }));
      setSelectedManufacturerId(saved.id);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteManufacturer() {
    if (!selectedManufacturerId) return;
    setIsSaving(true);
    try {
      await deleteConfiguratorCatalogRecord("manufacturers", selectedManufacturerId);
      setBootstrap((previous) => ({
        ...previous,
        manufacturers: previous.manufacturers.filter((row) => row.id !== selectedManufacturerId),
        products: previous.products.filter((row) => row.manufacturer_id !== selectedManufacturerId),
      }));
      setSelectedManufacturerId("");
      setSelectedProductId("");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProduct() {
    if (!productDraft.manufacturer_id) return;
    setIsSaving(true);
    try {
      const saved = selectedProductId
        ? await updateConfiguratorCatalogRecord<ConfiguratorProductRecord>("products", selectedProductId, productDraft)
        : await createConfiguratorCatalogRecord<ConfiguratorProductRecord>("products", productDraft);
      setBootstrap((previous) => ({
        ...previous,
        products: [saved, ...previous.products.filter((row) => row.id !== saved.id)],
      }));
      setSelectedProductId(saved.id);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProduct() {
    if (!selectedProductId) return;
    setIsSaving(true);
    try {
      await deleteConfiguratorCatalogRecord("products", selectedProductId);
      setBootstrap((previous) => ({
        ...previous,
        products: previous.products.filter((row) => row.id !== selectedProductId),
      }));
      setSelectedProductId("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionShell
      title="Manufacturers"
      description="Manufacturers contain products/systems. No render geometry lives here; this layer is only the commercial/system catalog source."
    >
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 1fr", gap: 16 }}>
        <div className="admin-card ui-card" style={denseCardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <H3>Manufacturers</H3>
            <Button variant="secondary" onClick={() => setSelectedManufacturerId("")}>New</Button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {bootstrap.manufacturers.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelectedManufacturerId(row.id);
                  setSelectedProductId("");
                }}
                className={selectedManufacturerId === row.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              >
                <span className="admin-nav-button-label">{row.name || "(unnamed manufacturer)"}</span>
                <span className={selectedManufacturerId === row.id ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                  {row.code || "No code"} • {bootstrap.products.filter((product) => product.manufacturer_id === row.id).length} products
                </span>
              </button>
            ))}
            {bootstrap.manufacturers.length === 0 ? <div className="admin-placeholder-box">No manufacturers yet.</div> : null}
          </div>
        </div>

        <div className="admin-card ui-card" style={denseCardStyle}>
          <div className="admin-group-title">{selectedManufacturerId ? "Edit manufacturer" : "New manufacturer"}</div>
          <FormField label="Name">
            <input value={manufacturerDraft.name} onChange={(event) => setManufacturerDraft((previous) => ({ ...previous, name: event.currentTarget.value }))} style={inputStyle} />
          </FormField>
          <FormField label="Code">
            <input value={manufacturerDraft.code} onChange={(event) => setManufacturerDraft((previous) => ({ ...previous, code: event.currentTarget.value }))} style={inputStyle} />
          </FormField>
          <FormField label="Notes">
            <textarea value={manufacturerDraft.notes} onChange={(event) => setManufacturerDraft((previous) => ({ ...previous, notes: event.currentTarget.value }))} style={textareaStyle} />
          </FormField>
          <label className="admin-flex-row" style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
            <input type="checkbox" checked={!!manufacturerDraft.is_active} onChange={(event) => setManufacturerDraft((previous) => ({ ...previous, is_active: event.currentTarget.checked }))} />
            <span>Active</span>
          </label>
          <div className="admin-flex-row">
            <Button variant="primary" onClick={() => void saveManufacturer()} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
            <Button variant="secondary" onClick={() => void deleteManufacturer()} disabled={!selectedManufacturerId || isSaving}>Delete</Button>
          </div>
        </div>

        <div className="admin-card ui-card" style={denseCardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div className="admin-group-title">Products / Systems</div>
              <div className="admin-body-copy">Selected manufacturer: {selectedManufacturer?.name || "None"}</div>
            </div>
            <Button variant="secondary" onClick={() => setSelectedProductId("")} disabled={!selectedManufacturerId}>New</Button>
          </div>
          {selectedManufacturerId ? (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {productsForManufacturer.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedProductId(row.id)}
                    className={selectedProductId === row.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                  >
                    <span className="admin-nav-button-label">{row.name || "(unnamed product)"}</span>
                    <span className={selectedProductId === row.id ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                      {row.product_family || "No family"}
                    </span>
                  </button>
                ))}
                {productsForManufacturer.length === 0 ? <div className="admin-placeholder-box">No products for this manufacturer yet.</div> : null}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <FormField label="Product / system name">
                  <input value={productDraft.name} onChange={(event) => setProductDraft((previous) => ({ ...previous, name: event.currentTarget.value, manufacturer_id: selectedManufacturerId }))} style={inputStyle} />
                </FormField>
                <FormField label="Code">
                  <input value={productDraft.code} onChange={(event) => setProductDraft((previous) => ({ ...previous, code: event.currentTarget.value, manufacturer_id: selectedManufacturerId }))} style={inputStyle} />
                </FormField>
                <FormField label="Product family">
                  <input value={productDraft.product_family} onChange={(event) => setProductDraft((previous) => ({ ...previous, product_family: event.currentTarget.value, manufacturer_id: selectedManufacturerId }))} style={inputStyle} />
                </FormField>
                <FormField label="Notes">
                  <textarea value={productDraft.notes} onChange={(event) => setProductDraft((previous) => ({ ...previous, notes: event.currentTarget.value, manufacturer_id: selectedManufacturerId }))} style={textareaStyle} />
                </FormField>
                <div className="admin-flex-row">
                  <Button variant="primary" onClick={() => void saveProduct()} disabled={isSaving || !selectedManufacturerId}>{isSaving ? "Saving..." : "Save"}</Button>
                  <Button variant="secondary" onClick={() => void deleteProduct()} disabled={!selectedProductId || isSaving}>Delete</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-placeholder-box">Select or create a manufacturer first.</div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function WindowTypesPanel(props: {
  bootstrap: ConfiguratorCatalogBootstrap;
  setBootstrap: React.Dispatch<React.SetStateAction<ConfiguratorCatalogBootstrap>>;
}) {
  const { bootstrap, setBootstrap } = props;
  const [selectedWindowTypeId, setSelectedWindowTypeId] = useState("");
  const [windowTypeDraft, setWindowTypeDraft] = useState<ConfiguratorWindowTypeRecord>(blankWindowType(""));
  const [isSaving, setIsSaving] = useState(false);

  const selectedWindowType = bootstrap.windowTypes.find((row) => row.id === selectedWindowTypeId) ?? null;
  const inwardTypes = bootstrap.windowTypes.filter((row) => row.opening_direction === "inward");
  const outwardTypes = bootstrap.windowTypes.filter((row) => row.opening_direction === "outward");

  useEffect(() => {
    setWindowTypeDraft(selectedWindowType ?? blankWindowType(""));
  }, [selectedWindowType]);

  function chooseTemplate(openingDirection: "inward" | "outward", operationType: string) {
    const label =
      [...WINDOW_TYPE_CHOOSER[openingDirection]].find((item) => item.operation === operationType)?.label ?? operationType;
    setSelectedWindowTypeId("");
    setWindowTypeDraft({
      ...blankWindowType(windowTypeDraft.product_id || ""),
      opening_direction: openingDirection,
      operation_type: operationType,
      name: label,
      code: label.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    });
  }

  async function saveWindowType() {
    if (!windowTypeDraft.product_id) return;
    setIsSaving(true);
    try {
      const saved = selectedWindowTypeId
        ? await updateConfiguratorCatalogRecord<ConfiguratorWindowTypeRecord>("windowTypes", selectedWindowTypeId, windowTypeDraft)
        : await createConfiguratorCatalogRecord<ConfiguratorWindowTypeRecord>("windowTypes", windowTypeDraft);
      setBootstrap((previous) => ({
        ...previous,
        windowTypes: [saved, ...previous.windowTypes.filter((row) => row.id !== saved.id)],
      }));
      setSelectedWindowTypeId(saved.id);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteWindowType() {
    if (!selectedWindowTypeId) return;
    setIsSaving(true);
    try {
      await deleteConfiguratorCatalogRecord("windowTypes", selectedWindowTypeId);
      setBootstrap((previous) => ({
        ...previous,
        windowTypes: previous.windowTypes.filter((row) => row.id !== selectedWindowTypeId),
      }));
      setSelectedWindowTypeId("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionShell
      title="Window Types"
      description="Window Types define opening behaviours only. Geometry and render dimensions are handled separately in Configurator Render."
    >
      <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
        <div className="admin-card ui-card" style={denseCardStyle}>
          <div className="admin-group-title">Behaviour library</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="admin-setting-label">Inward</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {WINDOW_TYPE_CHOOSER.inward.map((item) => (
                  <button key={item.operation} type="button" onClick={() => chooseTemplate("inward", item.operation)} className="admin-nav-button">
                    <span className="admin-nav-button-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="admin-setting-label">Outward</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {WINDOW_TYPE_CHOOSER.outward.map((item) => (
                  <button key={item.operation} type="button" onClick={() => chooseTemplate("outward", item.operation)} className="admin-nav-button">
                    <span className="admin-nav-button-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="admin-placeholder-box">
            Window Types own only opening behaviour metadata: inward/outward, fixed/tilt-turn/top-hung/etc. No render-dimension controls live here.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16 }}>
          <div className="admin-card ui-card" style={denseCardStyle}>
            <div className="admin-group-title">Defined window types</div>
            <div style={{ display: "grid", gap: 8 }}>
              {[{ title: "Inward", rows: inwardTypes }, { title: "Outward", rows: outwardTypes }].map((group) => (
                <div key={group.title} style={{ display: "grid", gap: 8 }}>
                  <div className="admin-setting-label">{group.title}</div>
                  {group.rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedWindowTypeId(row.id)}
                      className={selectedWindowTypeId === row.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                    >
                      <span className="admin-nav-button-label">{row.name || "(unnamed window type)"}</span>
                      <span className={selectedWindowTypeId === row.id ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                        {row.operation_type} • {bootstrap.products.find((product) => product.id === row.product_id)?.name || "No product"}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {bootstrap.windowTypes.length === 0 ? <div className="admin-placeholder-box">No window types yet.</div> : null}
            </div>
          </div>

          <div className="admin-card ui-card" style={denseCardStyle}>
            <div className="admin-group-title">{selectedWindowTypeId ? "Edit window type" : "New window type"}</div>
            <FormField label="Product / system">
              <select value={windowTypeDraft.product_id} onChange={(event) => setWindowTypeDraft((previous) => ({ ...previous, product_id: event.currentTarget.value }))} style={inputStyle}>
                <option value="">Select product / system</option>
                {bootstrap.products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </FormField>
            <FormField label="Name">
              <input value={windowTypeDraft.name} onChange={(event) => setWindowTypeDraft((previous) => ({ ...previous, name: event.currentTarget.value }))} style={inputStyle} />
            </FormField>
            <FormField label="Code">
              <input value={windowTypeDraft.code} onChange={(event) => setWindowTypeDraft((previous) => ({ ...previous, code: event.currentTarget.value }))} style={inputStyle} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <FormField label="Opening direction">
                <select value={windowTypeDraft.opening_direction} onChange={(event) => setWindowTypeDraft((previous) => ({ ...previous, opening_direction: event.currentTarget.value }))} style={inputStyle}>
                  <option value="inward">Inward</option>
                  <option value="outward">Outward</option>
                </select>
              </FormField>
              <FormField label="Operation type">
                <select value={windowTypeDraft.operation_type} onChange={(event) => setWindowTypeDraft((previous) => ({ ...previous, operation_type: event.currentTarget.value }))} style={inputStyle}>
                  {windowTypeDraft.opening_direction === "inward"
                    ? WINDOW_TYPE_CHOOSER.inward.map((item) => <option key={item.operation} value={item.operation}>{item.label}</option>)
                    : WINDOW_TYPE_CHOOSER.outward.map((item) => <option key={item.operation} value={item.operation}>{item.label}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea value={windowTypeDraft.notes} onChange={(event) => setWindowTypeDraft((previous) => ({ ...previous, notes: event.currentTarget.value }))} style={textareaStyle} />
            </FormField>
            <div className="admin-flex-row">
              <Button variant="primary" onClick={() => void saveWindowType()} disabled={isSaving || !windowTypeDraft.product_id}>{isSaving ? "Saving..." : "Save"}</Button>
              <Button variant="secondary" onClick={() => void deleteWindowType()} disabled={!selectedWindowTypeId || isSaving}>Delete</Button>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function ConfiguratorRenderPanel(props: {
  bootstrap: ConfiguratorCatalogBootstrap;
  setBootstrap: React.Dispatch<React.SetStateAction<ConfiguratorCatalogBootstrap>>;
}) {
  const { bootstrap, setBootstrap } = props;
  const [productGroup, setProductGroup] = useState<ProductGroupKey>("windows");
  const [windowTab, setWindowTab] = useState<WindowRenderTab>("1field");
  const [selectedRenderProfileId, setSelectedRenderProfileId] = useState("");
  const [renderDraft, setRenderDraft] = useState<ConfiguratorRenderProfileRecord>(blankRenderProfile({ manufacturerId: "", productId: "", windowTypeId: "" }));
  const [selectedOpeningOperation, setSelectedOpeningOperation] = useState<string>("fixed");
  const [isSaving, setIsSaving] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [renderProductCode, setRenderProductCode] = useState<RenderProfileProductCode>("FX");
  const [renderViewCode, setRenderViewCode] = useState<RenderProfileViewCode>("IV");
  const [renderVariantCode, setRenderVariantCode] = useState<RenderProfileVariantCode>("NOSASH");
  const [manualCodeOverride, setManualCodeOverride] = useState(false);
  const [twoFieldJunctionType, setTwoFieldJunctionType] = useState<"static" | "flying">("static");

  const windowTypes = bootstrap.windowTypes ?? [];
  const renderProfileRecords = bootstrap.renderProfiles ?? [];
  const generatedRenderCode = buildRenderProfileCode(renderProductCode, renderViewCode, renderVariantCode);
  const generatedInternalCode = buildRenderProfileCode(renderProductCode, "IV", renderVariantCode);
  const generatedExternalCode = buildRenderProfileCode(renderProductCode, "EV", renderVariantCode);
  const activeViewLogic = renderViewCode === "EV" ? "outside" : "inside";
  const comparisonViewCode: RenderProfileViewCode = renderViewCode === "EV" ? "IV" : "EV";
  const comparisonViewLogic = comparisonViewCode === "EV" ? "outside" : "inside";
  const openingOptionsForWindowTab = OPENING_BEHAVIOUR_OPTIONS_BY_WINDOW_TAB[windowTab] ?? [];
  const selectedOpeningOption =
    openingOptionsForWindowTab.find((item) => item.operation === selectedOpeningOperation) ??
    OPENING_BEHAVIOUR_OPTIONS.find((item) => item.operation === selectedOpeningOperation) ??
    null;
  const selectedOpeningDirection = selectedOpeningOption?.openingDirection ?? "inward";
  const selectedOpeningLabel =
    selectedOpeningOption?.label ?? selectedOpeningOperation;
  const selectedViewLabel = renderViewCode === "EV" ? "External View" : "Internal View";
  const selectedDefinitionContextKey = buildRenderDefinitionContextKey(productGroup, windowTab, selectedOpeningOperation, renderViewCode);
  const comparisonDefinitionContextKey = buildRenderDefinitionContextKey(productGroup, windowTab, selectedOpeningOperation, comparisonViewCode);
  const matchingWindowTypeId =
    windowTypes.find(
      (row) =>
        row.opening_direction === selectedOpeningDirection &&
        row.operation_type === selectedOpeningOperation
    )?.id ?? null;
  const exactRenderProfile =
    renderProfileRecords.find((row) => {
      return matchesRenderDefinitionContext(row, selectedDefinitionContextKey, selectedOpeningOperation, activeViewLogic);
    }) ?? null;
  const comparisonRenderProfile =
    renderProfileRecords.find((row) => {
      return matchesRenderDefinitionContext(row, comparisonDefinitionContextKey, selectedOpeningOperation, comparisonViewLogic);
    }) ?? null;

  const renderProfiles = renderProfileRecords.filter((row) => {
    return matchesRenderDefinitionContext(row, selectedDefinitionContextKey, selectedOpeningOperation, activeViewLogic);
  });
  const internalPreviewDraft =
    renderViewCode === "IV"
      ? renderDraft
      : comparisonViewCode === "IV" && comparisonRenderProfile
        ? normalizeRenderProfileForView(comparisonRenderProfile, "inside")
        : normalizeRenderProfileForView({
            ...blankRenderProfile({ manufacturerId: "", productId: "", windowTypeId: matchingWindowTypeId ?? "" }),
            name: buildRenderDefinitionContextKey(productGroup, windowTab, selectedOpeningOperation, "IV"),
            code: generatedInternalCode,
            operation_type: selectedOpeningOperation,
            view_logic: "inside" as const,
            window_type_id: matchingWindowTypeId,
          }, "inside");
  const externalPreviewDraft =
    renderViewCode === "EV"
      ? renderDraft
      : comparisonViewCode === "EV" && comparisonRenderProfile
        ? comparisonRenderProfile
        : {
            ...blankRenderProfile({ manufacturerId: "", productId: "", windowTypeId: matchingWindowTypeId ?? "" }),
            name: buildRenderDefinitionContextKey(productGroup, windowTab, selectedOpeningOperation, "EV"),
            code: generatedExternalCode,
            operation_type: selectedOpeningOperation,
            view_logic: "outside" as const,
            window_type_id: matchingWindowTypeId,
          };

  useEffect(() => {
    const selected = renderProfileRecords.find((row) => row.id === selectedRenderProfileId);
    if (selected) {
      setRenderDraft(
        normalizeRenderProfileForView(
          selected,
          String(selected.view_logic || "").trim().toLowerCase() === "outside" ? "outside" : "inside"
        )
      );
      const parsedCode = parseRenderProfileCode(selected.code);
      const loadedOpeningDirection =
        OPENING_BEHAVIOUR_OPTIONS.find((item) => item.operation === (selected.operation_type || "fixed"))?.openingDirection ?? "inward";
      setSelectedOpeningOperation(selected.operation_type || "fixed");
      setRenderViewCode(deriveRenderProfileViewCode(selected.view_logic));
      if (parsedCode) {
        setRenderProductCode(parsedCode.productCode);
        setRenderVariantCode(parsedCode.variantCode);
        setManualCodeOverride(false);
      } else {
        setRenderProductCode(
          deriveRenderProfileProductCode(
            loadedOpeningDirection,
            selected.operation_type || "fixed"
          )
        );
        setRenderViewCode(deriveRenderProfileViewCode(selected.view_logic));
        setRenderVariantCode(deriveRenderProfileVariantCode(selected.operation_type || "fixed"));
        setManualCodeOverride(!!String(selected.code || "").trim());
      }
      return;
    }
    setManualCodeOverride(false);
  }, [renderProfileRecords, selectedOpeningDirection, selectedRenderProfileId]);

  useEffect(() => {
    const selected = renderProfileRecords.find((row) => row.id === selectedRenderProfileId) ?? null;
    if (selected && matchesRenderDefinitionContext(selected, selectedDefinitionContextKey, selectedOpeningOperation, activeViewLogic)) {
      return;
    }
    if (exactRenderProfile) {
      if (selectedRenderProfileId !== exactRenderProfile.id) {
        setSelectedRenderProfileId(exactRenderProfile.id);
      }
      return;
    }
    if (selectedRenderProfileId) {
      setSelectedRenderProfileId("");
    }
  }, [activeViewLogic, exactRenderProfile, renderProfileRecords, selectedDefinitionContextKey, selectedOpeningOperation, selectedRenderProfileId]);

  useEffect(() => {
    if (selectedRenderProfileId) return;
    setRenderDraft((previous) => {
      const nextCode = manualCodeOverride ? previous.code : generatedRenderCode;
      return normalizeRenderProfileForView(
        {
          ...blankRenderProfile({ manufacturerId: "", productId: "", windowTypeId: "" }),
          id: "",
          name: selectedDefinitionContextKey,
          code: nextCode,
          operation_type: selectedOpeningOperation,
          view_logic: activeViewLogic,
          window_type_id: matchingWindowTypeId,
          external_cladding_inset_mm:
            activeViewLogic === "outside"
              ? previous.external_cladding_inset_mm ?? 3
              : previous.external_cladding_inset_mm ?? 3,
          notes: previous.notes,
          is_active: previous.is_active ?? true,
        },
        activeViewLogic
      );
    });
    setRenderProductCode(deriveRenderProfileProductCode(selectedOpeningDirection, selectedOpeningOperation));
    setRenderVariantCode(deriveRenderProfileVariantCode(selectedOpeningOperation));
  }, [activeViewLogic, generatedRenderCode, manualCodeOverride, matchingWindowTypeId, selectedDefinitionContextKey, selectedOpeningDirection, selectedOpeningOperation, selectedRenderProfileId]);

  useEffect(() => {
    setRenderDraft((previous) => {
      const nextCode = manualCodeOverride ? previous.code : generatedRenderCode;
      const nextViewLogic = renderViewCode === "EV" ? "outside" : "inside";
      const nextName = selectedDefinitionContextKey;
      if (previous.code === nextCode && previous.name === nextName && previous.view_logic === nextViewLogic) {
        return previous;
      }
      return {
        ...previous,
        code: nextCode,
        name: nextName,
        view_logic: nextViewLogic,
      };
    });
  }, [generatedRenderCode, manualCodeOverride, renderViewCode, selectedDefinitionContextKey]);

  const previewNotice =
    selectedOpeningDirection === "outward"
      ? "Outward operation types are defined here and stored correctly, but the live preview remains windows-first. Native outward render refinement comes later without changing this admin structure."
      : null;

  const previewInsertion = buildPreviewInsertion(selectedOpeningOperation);
  const internalModel = useMemo(
    () =>
      buildAdminPreviewWindowDrawingModel({
        widthMm: Math.max(300, Number(internalPreviewDraft.preview_width_mm || 1000)),
        heightMm: Math.max(300, Number(internalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: 1,
        fieldsY: 1,
        insertion: previewInsertion,
        orientationView: "inside",
        openingSymbolMode: "din",
        resolvedProfiles: buildResolvedSectionProfileSetFromRenderProfile(internalPreviewDraft, "inside"),
        adminPreviewConfiguration: {
          hardware: {
            defaultHandleHeightMm: numericOrNull(internalPreviewDraft.handle_height_mm) ?? 1050,
            defaultHingeType: "Standard",
          },
        },
      }),
    [internalPreviewDraft, previewInsertion]
  );
  const externalModel = useMemo(
    () =>
      buildAdminPreviewWindowDrawingModel({
        widthMm: Math.max(300, Number(externalPreviewDraft.preview_width_mm || 1000)),
        heightMm: Math.max(300, Number(externalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: 1,
        fieldsY: 1,
        insertion: previewInsertion,
        orientationView: "outside",
        openingSymbolMode: "din",
        resolvedProfiles: buildResolvedSectionProfileSetFromRenderProfile(externalPreviewDraft, "outside"),
        adminPreviewConfiguration: {
          hardware: {
            defaultHandleHeightMm: numericOrNull(externalPreviewDraft.handle_height_mm) ?? 1050,
            defaultHingeType: "Standard",
          },
        },
      }),
    [externalPreviewDraft, previewInsertion]
  );

  const twoFieldPreviewLayout = useMemo(() => {
    const baseLayout = buildTwoFieldFixedStaticMullionLayoutDefinition(78);
    return {
      ...baseLayout,
      junctions: baseLayout.junctions.map((junction) =>
        junction.key === "vertical-1"
          ? {
              ...junction,
              type: twoFieldJunctionType,
              ownerFieldId: twoFieldJunctionType === "flying" ? "1,0" : null,
            }
          : junction
      ),
    };
  }, [twoFieldJunctionType]);
  const threeFieldPreviewLayout = useMemo(
    () => buildThreeFieldFixedStaticMullionLayoutDefinition(78),
    []
  );
  const fourFieldPreviewLayout = useMemo(
    () => buildFourFieldFixedStaticMullionLayoutDefinition(78),
    []
  );
  const twoFieldRendererInput = useMemo(
    () => buildAdminPreviewInputFromConfiguratorLayoutDefinition(twoFieldPreviewLayout),
    [twoFieldPreviewLayout]
  );
  const threeFieldRendererInput = useMemo(
    () => buildAdminPreviewInputFromConfiguratorLayoutDefinition(threeFieldPreviewLayout),
    [threeFieldPreviewLayout]
  );
  const fourFieldRendererInput = useMemo(
    () => buildAdminPreviewInputFromConfiguratorLayoutDefinition(fourFieldPreviewLayout),
    [fourFieldPreviewLayout]
  );
  const twoFieldBaseResolvedProfiles = useMemo(() => {
    const fixedInternalProfile =
      renderProfileRecords.find(
        (row) =>
          row.is_active &&
          String(row.name || "").trim().toLowerCase() === "windows:1field:fixed:iv"
      ) ?? null;
    return fixedInternalProfile
      ? buildResolvedSectionProfileSetFromRenderProfile(fixedInternalProfile, "inside")
      : buildResolvedSectionProfileSetFromRenderProfile(internalPreviewDraft, "inside");
  }, [internalPreviewDraft, renderProfileRecords]);
  const threeFieldBaseResolvedProfiles = twoFieldBaseResolvedProfiles;
  const fourFieldBaseResolvedProfiles = twoFieldBaseResolvedProfiles;
  const twoFieldResolvedProfiles = useMemo(
    () =>
      applyLayoutDefinitionOverridesToResolvedProfiles(
        twoFieldPreviewLayout,
        twoFieldBaseResolvedProfiles
      ) ?? twoFieldBaseResolvedProfiles,
    [twoFieldBaseResolvedProfiles, twoFieldPreviewLayout]
  );
  const threeFieldResolvedProfiles = useMemo(
    () =>
      applyLayoutDefinitionOverridesToResolvedProfiles(
        threeFieldPreviewLayout,
        threeFieldBaseResolvedProfiles
      ) ?? threeFieldBaseResolvedProfiles,
    [threeFieldBaseResolvedProfiles, threeFieldPreviewLayout]
  );
  const fourFieldResolvedProfiles = useMemo(
    () =>
      applyLayoutDefinitionOverridesToResolvedProfiles(
        fourFieldPreviewLayout,
        fourFieldBaseResolvedProfiles
      ) ?? fourFieldBaseResolvedProfiles,
    [fourFieldBaseResolvedProfiles, fourFieldPreviewLayout]
  );
  const twoFieldInternalModel = useMemo(
    () =>
      buildAdminPreviewWindowDrawingModel({
        widthMm: 1600,
        heightMm: Math.max(300, Number(internalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: twoFieldRendererInput.fieldsX,
        fieldsY: twoFieldRendererInput.fieldsY,
        insertion: twoFieldRendererInput.insertion,
        cellInsertions: twoFieldRendererInput.cellInsertions,
        orientationView: "inside",
        openingSymbolMode: "din",
        resolvedProfiles: twoFieldResolvedProfiles,
        adminPreviewConfiguration: {
          ...twoFieldRendererInput.adminPreviewConfiguration,
          hardware: {
            defaultHandleHeightMm: numericOrNull(internalPreviewDraft.handle_height_mm) ?? 1050,
            defaultHingeType: "Standard",
          },
        },
      }),
    [internalPreviewDraft.handle_height_mm, twoFieldRendererInput, twoFieldResolvedProfiles]
  );
  const threeFieldInternalModel = useMemo(
    () =>
      buildAdminPreviewWindowDrawingModel({
        widthMm: 2400,
        heightMm: Math.max(300, Number(internalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: threeFieldRendererInput.fieldsX,
        fieldsY: threeFieldRendererInput.fieldsY,
        insertion: threeFieldRendererInput.insertion,
        cellInsertions: threeFieldRendererInput.cellInsertions,
        orientationView: "inside",
        openingSymbolMode: "din",
        resolvedProfiles: threeFieldResolvedProfiles,
        adminPreviewConfiguration: {
          ...threeFieldRendererInput.adminPreviewConfiguration,
          hardware: {
            defaultHandleHeightMm: numericOrNull(internalPreviewDraft.handle_height_mm) ?? 1050,
            defaultHingeType: "Standard",
          },
        },
      }),
    [internalPreviewDraft.handle_height_mm, threeFieldRendererInput, threeFieldResolvedProfiles]
  );
  const fourFieldInternalModel = useMemo(
    () =>
      buildAdminPreviewWindowDrawingModel({
        widthMm: 3200,
        heightMm: Math.max(300, Number(internalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: fourFieldRendererInput.fieldsX,
        fieldsY: fourFieldRendererInput.fieldsY,
        insertion: fourFieldRendererInput.insertion,
        cellInsertions: fourFieldRendererInput.cellInsertions,
        orientationView: "inside",
        openingSymbolMode: "din",
        resolvedProfiles: fourFieldResolvedProfiles,
        adminPreviewConfiguration: {
          ...fourFieldRendererInput.adminPreviewConfiguration,
          hardware: {
            defaultHandleHeightMm: numericOrNull(internalPreviewDraft.handle_height_mm) ?? 1050,
            defaultHingeType: "Standard",
          },
        },
      }),
    [fourFieldRendererInput, fourFieldResolvedProfiles, internalPreviewDraft.handle_height_mm]
  );

  const visibleInternalModel = showDimensions ? internalModel : { ...internalModel, annotations: { ...internalModel.annotations, dimensions: [] } };
  const visibleExternalModel = showDimensions ? externalModel : { ...externalModel, annotations: { ...externalModel.annotations, dimensions: [] } };
  const visibleTwoFieldInternalModel = showDimensions
    ? twoFieldInternalModel
    : { ...twoFieldInternalModel, annotations: { ...twoFieldInternalModel.annotations, dimensions: [] } };
  const visibleThreeFieldInternalModel = showDimensions
    ? threeFieldInternalModel
    : { ...threeFieldInternalModel, annotations: { ...threeFieldInternalModel.annotations, dimensions: [] } };
  const visibleFourFieldInternalModel = showDimensions
    ? fourFieldInternalModel
    : { ...fourFieldInternalModel, annotations: { ...fourFieldInternalModel.annotations, dimensions: [] } };

  async function saveRenderProfile() {
    setIsSaving(true);
    try {
      const finalCode = manualCodeOverride ? String(renderDraft.code || "").trim() || generatedRenderCode : generatedRenderCode;
      const activeViewLogic = renderViewCode === "EV" ? "outside" : "inside";
      const payload = {
        ...renderDraft,
        name: selectedDefinitionContextKey,
        code: finalCode,
        operation_type: selectedOpeningOperation,
        view_logic: activeViewLogic,
        window_type_id: matchingWindowTypeId,
        frame_top_visible_mm:
          activeViewLogic === "inside" && renderDraft.trickle_vent_enabled
            ? 85
            : renderDraft.frame_top_visible_mm,
      };
      const saved = selectedRenderProfileId
        ? await updateConfiguratorCatalogRecord<ConfiguratorRenderProfileRecord>("renderProfiles", selectedRenderProfileId, payload)
        : await createConfiguratorCatalogRecord<ConfiguratorRenderProfileRecord>("renderProfiles", payload);
      setBootstrap((previous) => ({
        ...previous,
        renderProfiles: [saved, ...previous.renderProfiles.filter((row) => row.id !== saved.id)],
      }));
      setSelectedRenderProfileId(saved.id);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRenderProfile() {
    if (!selectedRenderProfileId) return;
    setIsSaving(true);
    try {
      await deleteConfiguratorCatalogRecord("renderProfiles", selectedRenderProfileId);
      setBootstrap((previous) => ({
        ...previous,
        renderProfiles: previous.renderProfiles.filter((row) => row.id !== selectedRenderProfileId),
      }));
      setSelectedRenderProfileId("");
      setRenderDraft(
        normalizeRenderProfileForView(
          blankRenderProfile({ manufacturerId: "", productId: "", windowTypeId: "" }),
          activeViewLogic
        )
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionShell
      title="Configurator Render"
      description="This replaces the old admin configurator UI. It is a render-definition system: manual profile dimensions resolve geometry values, then the native renderer draws the technical output."
    >
      <div className="admin-card ui-card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRODUCT_GROUP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setProductGroup(tab.key)}
              className={productGroup === tab.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
            >
              <span className="admin-nav-button-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {productGroup !== "windows" ? (
        <PlaceholderGroup label={PRODUCT_GROUP_TABS.find((tab) => tab.key === productGroup)?.label || "Product group"} />
      ) : (
        <>
          <div className="admin-card ui-card" style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {WINDOW_RENDER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setWindowTab(tab.key)}
                  className={windowTab === tab.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                >
                  <span className="admin-nav-button-label">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {windowTab === "2field" ? (
            <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
              <div className="admin-card ui-card" style={{ ...denseCardStyle, alignContent: "start" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <H3>2 Field Preview</H3>
                  <div className="admin-body-copy">
                    Preview-only schema-driven test using the shared layout definition and existing renderer pipeline. No 2-field save/edit flow is enabled in this pass.
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Layout</div>
                  <div className="admin-placeholder-box">
                    1 row × 2 columns
                    <br />
                    Fixed + Fixed
                    <br />
                    {twoFieldJunctionType === "flying" ? "Flying mullion (right master)" : "Static mullion 78mm"}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Junction type</div>
                  <select
                    value={twoFieldJunctionType}
                    onChange={(event) =>
                      setTwoFieldJunctionType(event.currentTarget.value === "flying" ? "flying" : "static")
                    }
                    className="admin-input"
                  >
                    <option value="static">Static Mullion</option>
                    <option value="flying">Flying Mullion</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Renderer adapter</div>
                  <div className="admin-placeholder-box">
                    fieldsX: {twoFieldRendererInput.fieldsX}
                    <br />
                    fieldsY: {twoFieldRendererInput.fieldsY}
                    <br />
                    insertion: {twoFieldRendererInput.insertion}
                    <br />
                    junction: {twoFieldRendererInput.adminPreviewConfiguration.junctions[0]?.type ?? "static"}
                    {twoFieldRendererInput.adminPreviewConfiguration.junctions[0]?.ownerFieldId
                      ? ` / owner ${twoFieldRendererInput.adminPreviewConfiguration.junctions[0]?.ownerFieldId}`
                      : ""}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Mullion override</div>
                  <div className="admin-placeholder-box">
                    Resolved mullion width: {twoFieldResolvedProfiles?.mullion.visibleFaceWidthMm ?? "n/a"}mm
                  </div>
                </div>
              </div>

              <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 16, alignContent: "start" }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <div className="admin-group-title">2 Field • Fixed / Fixed • Internal preview</div>
                  <div className="admin-body-copy">
                    This branch reuses the existing native renderer. The layout comes from `ConfiguratorLayoutDefinitionV2`; the static mullion width is applied through resolved profile override only.
                  </div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 12 }}>
                  <DrawingViewport model={visibleTwoFieldInternalModel} minHeight={360} aspectRatio="16 / 9" />
                </div>
              </div>
            </div>
          ) : windowTab === "3field" ? (
            <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
              <div className="admin-card ui-card" style={{ ...denseCardStyle, alignContent: "start" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <H3>3 Field Preview</H3>
                  <div className="admin-body-copy">
                    Preview-only schema-driven test using the shared layout definition and existing renderer pipeline. No 3-field save/edit flow is enabled in this pass.
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Layout</div>
                  <div className="admin-placeholder-box">
                    1 row × 3 columns
                    <br />
                    Fixed + Fixed + Fixed
                    <br />
                    Static mullions 78mm
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Renderer adapter</div>
                  <div className="admin-placeholder-box">
                    fieldsX: {threeFieldRendererInput.fieldsX}
                    <br />
                    fieldsY: {threeFieldRendererInput.fieldsY}
                    <br />
                    insertion: {threeFieldRendererInput.insertion}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Mullion override</div>
                  <div className="admin-placeholder-box">
                    Resolved mullion width: {threeFieldResolvedProfiles?.mullion.visibleFaceWidthMm ?? "n/a"}mm
                  </div>
                </div>
              </div>

              <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 16, alignContent: "start" }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <div className="admin-group-title">3 Field • Fixed / Fixed / Fixed • Internal preview</div>
                  <div className="admin-body-copy">
                    This branch reuses the existing native renderer. The layout comes from `ConfiguratorLayoutDefinitionV2`; static mullion width is applied through resolved profile override only.
                  </div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 12 }}>
                  <DrawingViewport model={visibleThreeFieldInternalModel} minHeight={360} aspectRatio="16 / 9" />
                </div>
              </div>
            </div>
          ) : windowTab === "4field" ? (
            <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
              <div className="admin-card ui-card" style={{ ...denseCardStyle, alignContent: "start" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <H3>4 Field Preview</H3>
                  <div className="admin-body-copy">
                    Preview-only schema-driven test using the shared layout definition and existing renderer pipeline. No 4-field save/edit flow is enabled in this pass.
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Layout</div>
                  <div className="admin-placeholder-box">
                    1 row × 4 columns
                    <br />
                    Fixed + Fixed + Fixed + Fixed
                    <br />
                    Static mullions 78mm
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Renderer adapter</div>
                  <div className="admin-placeholder-box">
                    fieldsX: {fourFieldRendererInput.fieldsX}
                    <br />
                    fieldsY: {fourFieldRendererInput.fieldsY}
                    <br />
                    insertion: {fourFieldRendererInput.insertion}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Mullion override</div>
                  <div className="admin-placeholder-box">
                    Resolved mullion width: {fourFieldResolvedProfiles?.mullion.visibleFaceWidthMm ?? "n/a"}mm
                  </div>
                </div>
              </div>

              <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 16, alignContent: "start" }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <div className="admin-group-title">4 Field • Fixed / Fixed / Fixed / Fixed • Internal preview</div>
                  <div className="admin-body-copy">
                    This branch reuses the existing native renderer. The layout comes from `ConfiguratorLayoutDefinitionV2`; static mullion width is applied through resolved profile override only.
                  </div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#fff", padding: 12 }}>
                  <DrawingViewport model={visibleFourFieldInternalModel} minHeight={360} aspectRatio="16 / 9" />
                </div>
              </div>
            </div>
          ) : windowTab !== "1field" ? (
            <PlaceholderGroup label={WINDOW_RENDER_TABS.find((tab) => tab.key === windowTab)?.label || "Window render mode"} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
              <div className="admin-card ui-card" style={{ ...denseCardStyle, alignContent: "start" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <H3>1 Field Render Definition</H3>
                  <Button variant="secondary" onClick={() => setSelectedRenderProfileId("")}>New</Button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">View</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([
                      { code: "IV", label: "Internal View" },
                      { code: "EV", label: "External View" },
                    ] as const).map((viewOption) => (
                      <button
                        key={viewOption.code}
                        type="button"
                        onClick={() => {
                          setSelectedRenderProfileId("");
                          setRenderViewCode(viewOption.code);
                        }}
                        className={renderViewCode === viewOption.code ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                      >
                        <span className="admin-nav-button-label">{viewOption.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Opening behaviour</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {openingOptionsForWindowTab.map((item) => (
                      <button
                        key={item.operation}
                        type="button"
                        onClick={() => {
                          setSelectedRenderProfileId("");
                          setSelectedOpeningOperation(item.operation);
                          setRenderProductCode(deriveRenderProfileProductCode(item.openingDirection, item.operation));
                          setRenderVariantCode(deriveRenderProfileVariantCode(item.operation));
                          const matchedWindowType =
                            windowTypes.find((row) => row.opening_direction === item.openingDirection && row.operation_type === item.operation) ?? null;
                          setRenderDraft((previous) => ({
                            ...previous,
                            operation_type: item.operation,
                            window_type_id: matchedWindowType?.id ?? null,
                          }));
                        }}
                        className={selectedOpeningOperation === item.operation ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                      >
                        <span className="admin-nav-button-label">{item.label}</span>
                      </button>
                    ))}
                    {openingOptionsForWindowTab.length === 0 ? <div className="admin-placeholder-box">Opening behaviour definitions for this field count are prepared next.</div> : null}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div className="admin-setting-label">Saved definitions for this selection</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {renderProfiles.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedRenderProfileId(row.id)}
                        className={selectedRenderProfileId === row.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
                      >
                        <span className="admin-nav-button-label">{row.code || row.name || "(untitled render definition)"}</span>
                        <span className={selectedRenderProfileId === row.id ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                          {windowTypes.find((windowType) => windowType.id === row.window_type_id)?.name || row.operation_type}
                        </span>
                      </button>
                    ))}
                    {renderProfiles.length === 0 ? <div className="admin-placeholder-box">No render definitions for this opening behaviour yet.</div> : null}
                  </div>
                </div>

                <div className="admin-flex-row">
                  <Button variant="primary" onClick={() => void saveRenderProfile()} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
                  <Button variant="secondary" onClick={() => void deleteRenderProfile()} disabled={!selectedRenderProfileId || isSaving}>Delete</Button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {previewNotice ? <div className="admin-card ui-card admin-status-card">{previewNotice}</div> : null}
                <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 16, alignContent: "start" }}>
                  <div style={{ display: "grid", gap: 2 }}>
                    <div className="admin-group-title">{WINDOW_RENDER_TABS.find((tab) => tab.key === windowTab)?.label || "Window"} • {selectedOpeningLabel} • {selectedViewLabel}</div>
                    <div className="admin-body-copy">Both previews stay visible for comparison, but only the selected view definition is active in the editor below.</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                      <div className="admin-setting-label">Internal view</div>
                      <div className="admin-placeholder-box" style={{ padding: "10px 12px", fontWeight: 700 }}>{internalPreviewDraft.code || generatedInternalCode}</div>
                      <div
                        style={{
                          borderRadius: 16,
                          border: renderViewCode === "IV" ? "2px solid var(--color-primary)" : "1px solid #e4e4e7",
                          background: "#fff",
                          padding: 12,
                          display: "grid",
                          alignContent: "start",
                          boxShadow: renderViewCode === "IV" ? "0 0 0 2px rgba(59,130,246,0.12)" : "none",
                        }}
                      >
                        <DrawingViewport model={visibleInternalModel} minHeight={320} aspectRatio="16 / 9" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                      <div className="admin-setting-label">External view</div>
                      <div className="admin-placeholder-box" style={{ padding: "10px 12px", fontWeight: 700 }}>{externalPreviewDraft.code || generatedExternalCode}</div>
                      <div
                        style={{
                          borderRadius: 16,
                          border: renderViewCode === "EV" ? "2px solid var(--color-primary)" : "1px solid #e4e4e7",
                          background: "#fff",
                          padding: 12,
                          display: "grid",
                          alignContent: "start",
                          boxShadow: renderViewCode === "EV" ? "0 0 0 2px rgba(59,130,246,0.12)" : "none",
                        }}
                      >
                        <DrawingViewport model={visibleExternalModel} minHeight={320} aspectRatio="16 / 9" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 14, alignContent: "start" }}>
                  <div style={{ display: "grid", gap: 2 }}>
                    <div className="admin-group-title">{selectedViewLabel} definition editor</div>
                    <div className="admin-body-copy">Grouped values below edit only the selected {selectedViewLabel.toLowerCase()} definition.</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    {renderViewCode === "IV" ? (
                      <>
                        <FormField label="Frame visible standard">
                          <input
                            type="number"
                            value={renderDraft.frame_top_visible_mm ?? ""}
                            onChange={(event) => {
                              const value = numericOrNull(event.currentTarget.value);
                              setRenderDraft((previous) => ({
                                ...previous,
                                frame_top_visible_mm: value,
                                frame_left_visible_mm: value,
                                frame_right_visible_mm: value,
                              }));
                            }}
                            style={inputStyle}
                          />
                        </FormField>
                        <FormField label="Frame visible bottom">
                          <input
                            type="number"
                            value={renderDraft.frame_bottom_visible_mm ?? ""}
                            onChange={(event) => {
                              const value = numericOrNull(event.currentTarget.value);
                              setRenderDraft((previous) => ({ ...previous, frame_bottom_visible_mm: value }));
                            }}
                            style={inputStyle}
                          />
                        </FormField>
                        {selectedOpeningOperation !== "fixed" ? (
                          <FormField label="Sash visible">
                            <input
                              type="number"
                              value={renderDraft.sash_top_visible_mm ?? ""}
                              onChange={(event) => {
                                const value = numericOrNull(event.currentTarget.value);
                                setRenderDraft((previous) => ({
                                  ...previous,
                                  sash_top_visible_mm: value,
                                  sash_left_visible_mm: value,
                                  sash_right_visible_mm: value,
                                  sash_bottom_visible_mm: value,
                                }));
                              }}
                              style={inputStyle}
                            />
                          </FormField>
                        ) : null}
                        <FormField label="Glazing bead visible">
                          <input
                            type="number"
                            value={renderDraft.bead_top_visible_mm ?? ""}
                            onChange={(event) => {
                              const value = numericOrNull(event.currentTarget.value);
                              setRenderDraft((previous) => ({
                                ...previous,
                                bead_top_visible_mm: value,
                                bead_left_visible_mm: value,
                                bead_right_visible_mm: value,
                                bead_bottom_visible_mm: value,
                              }));
                            }}
                            style={inputStyle}
                          />
                        </FormField>
                      </>
                    ) : (
                      <>
                        <FormField label="Outer frame standard">
                          <input
                            type="number"
                            value={renderDraft.frame_top_visible_mm ?? ""}
                            onChange={(event) => {
                              const value = numericOrNull(event.currentTarget.value);
                              setRenderDraft((previous) => ({
                                ...previous,
                                frame_top_visible_mm: value,
                                frame_left_visible_mm: value,
                                frame_right_visible_mm: value,
                              }));
                            }}
                            style={inputStyle}
                          />
                        </FormField>
                        <FormField label="Outer frame bottom">
                          <input
                            type="number"
                            value={renderDraft.frame_bottom_visible_mm ?? ""}
                            onChange={(event) => {
                              const value = numericOrNull(event.currentTarget.value);
                              setRenderDraft((previous) => ({ ...previous, frame_bottom_visible_mm: value }));
                            }}
                            style={inputStyle}
                          />
                        </FormField>
                        {selectedOpeningOperation !== "fixed" ? (
                          <>
                            <FormField label="Outer alu cladding standard">
                              <input
                                type="number"
                                value={renderDraft.sash_top_visible_mm ?? ""}
                                onChange={(event) => {
                                  const value = numericOrNull(event.currentTarget.value);
                                  setRenderDraft((previous) => ({
                                    ...previous,
                                    sash_top_visible_mm: value,
                                    sash_left_visible_mm: value,
                                    sash_right_visible_mm: value,
                                  }));
                                }}
                                style={inputStyle}
                              />
                            </FormField>
                            <FormField label="Outer alu cladding bottom">
                              <input
                                type="number"
                                value={renderDraft.sash_bottom_visible_mm ?? ""}
                                onChange={(event) => {
                                  const value = numericOrNull(event.currentTarget.value);
                                  setRenderDraft((previous) => ({ ...previous, sash_bottom_visible_mm: value }));
                                }}
                                style={inputStyle}
                              />
                            </FormField>
                          </>
                        ) : null}
                        <FormField label="External cladding inset">
                          <input
                            type="number"
                            value={renderDraft.external_cladding_inset_mm ?? ""}
                            onChange={(event) => {
                              const value = numericOrNull(event.currentTarget.value);
                              setRenderDraft((previous) => ({ ...previous, external_cladding_inset_mm: value }));
                            }}
                            style={inputStyle}
                          />
                        </FormField>
                      </>
                    )}
                    <FormField label="Render width">
                      <input
                        type="number"
                        value={renderDraft.preview_width_mm ?? ""}
                        onChange={(event) => {
                          const value = numericOrNull(event.currentTarget.value);
                          setRenderDraft((previous) => ({ ...previous, preview_width_mm: value }));
                        }}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Render height">
                      <input
                        type="number"
                        value={renderDraft.preview_height_mm ?? ""}
                        onChange={(event) => {
                          const value = numericOrNull(event.currentTarget.value);
                          setRenderDraft((previous) => ({ ...previous, preview_height_mm: value }));
                        }}
                        style={inputStyle}
                      />
                    </FormField>
                  </div>

                  {selectedOpeningDirection === "inward" ? (
                    <div className="admin-card ui-card" style={{ padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <div className="admin-group-title">Trickle vent definition</div>
                        <div className="admin-body-copy">
                          Stored on the render definition and resolved into the shared drawing model. Confirmed geometry only; canopy remains out of scope.
                        </div>
                      </div>

                      <label className="admin-flex-row" style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                        <input
                          type="checkbox"
                          checked={!!renderDraft.trickle_vent_enabled}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setRenderDraft((previous) =>
                              checked
                                ? applyTrickleVentPreset(previous, (previous.trickle_vent_ea_value as ConfiguratorTrickleVentEaValue) || "2200")
                                : applyTrickleVentPreset(previous, "")
                            );
                          }}
                        />
                        <span>Enable trickle vent</span>
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <FormField label="EA layout">
                          <select
                            value={renderDraft.trickle_vent_ea_value ?? ""}
                            onChange={(event) => {
                              const value = event.currentTarget.value as ConfiguratorTrickleVentEaValue | "";
                              setRenderDraft((previous) => applyTrickleVentPreset(previous, value));
                            }}
                            disabled={!renderDraft.trickle_vent_enabled}
                            style={inputStyle}
                          >
                            <option value="">Select EA</option>
                            {Object.entries(TRICKLE_VENT_PRESETS).map(([value, preset]) => (
                              <option key={value} value={value}>{preset.label}</option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Head visible with vent">
                          <input
                            value={renderDraft.trickle_vent_head_visible_mm ?? ""}
                            readOnly
                            style={{ ...inputStyle, background: "var(--color-surface-muted)" }}
                          />
                        </FormField>
                        <FormField label="Top of head to top of slot">
                          <input
                            value={renderDraft.trickle_vent_slot_top_offset_mm ?? ""}
                            readOnly
                            style={{ ...inputStyle, background: "var(--color-surface-muted)" }}
                          />
                        </FormField>
                        <FormField label="Slot height">
                          <input
                            value={renderDraft.trickle_vent_slot_height_mm ?? ""}
                            readOnly
                            style={{ ...inputStyle, background: "var(--color-surface-muted)" }}
                          />
                        </FormField>
                        <FormField label="Bottom of slot to lower head line">
                          <input
                            value={renderDraft.trickle_vent_slot_bottom_offset_mm ?? ""}
                            readOnly
                            style={{ ...inputStyle, background: "var(--color-surface-muted)" }}
                          />
                        </FormField>
                        <FormField label="Slot assembly">
                          <input
                            value={formatTrickleVentLayout(renderDraft)}
                            readOnly
                            style={{ ...inputStyle, background: "var(--color-surface-muted)" }}
                          />
                        </FormField>
                      </div>

                      <Small>
                        Internal and external slot geometry are stored identically. Internal head geometry uses the confirmed 59.5mm vent head rule.
                      </Small>
                    </div>
                  ) : null}

                  {selectedOpeningOperation !== "fixed" && selectedOpeningOperation !== "fixed_sash" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                      <FormField label="Handle axis offset">
                        <input
                          type="number"
                          value={renderDraft.handle_axis_offset_mm ?? ""}
                          onChange={(event) => {
                            const value = numericOrNull(event.currentTarget.value);
                            setRenderDraft((previous) => ({ ...previous, handle_axis_offset_mm: value }));
                          }}
                          style={inputStyle}
                        />
                      </FormField>
                      <FormField label="Handle height">
                        <input
                          type="number"
                          value={renderDraft.handle_height_mm ?? ""}
                          onChange={(event) => {
                            const value = numericOrNull(event.currentTarget.value);
                            setRenderDraft((previous) => ({ ...previous, handle_height_mm: value }));
                          }}
                          style={inputStyle}
                        />
                      </FormField>
                      <FormField label="Hinge pivot offset">
                        <input
                          type="number"
                          value={renderDraft.hinge_pivot_offset_mm ?? ""}
                          onChange={(event) => {
                            const value = numericOrNull(event.currentTarget.value);
                            setRenderDraft((previous) => ({ ...previous, hinge_pivot_offset_mm: value }));
                          }}
                          style={inputStyle}
                        />
                      </FormField>
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <FormField label="External frame cladding colour">
                      <input
                        value={renderDraft.external_frame_cladding_colour}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setRenderDraft((previous) => ({ ...previous, external_frame_cladding_colour: value }));
                        }}
                        style={inputStyle}
                      />
                    </FormField>
                    {selectedOpeningOperation !== "fixed" ? (
                      <FormField label="External sash cladding colour">
                        <input
                          value={renderDraft.external_sash_cladding_colour}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setRenderDraft((previous) => ({ ...previous, external_sash_cladding_colour: value }));
                          }}
                          style={inputStyle}
                        />
                      </FormField>
                    ) : null}
                  </div>

                  <label className="admin-flex-row" style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                    <input type="checkbox" checked={showDimensions} onChange={(event) => setShowDimensions(event.currentTarget.checked)} />
                    <span>Show dimensions</span>
                  </label>

                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 700, color: "var(--color-text-primary)" }}>Advanced code override</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <label className="admin-flex-row" style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                        <input
                          type="checkbox"
                          checked={manualCodeOverride}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setManualCodeOverride(checked);
                            if (!checked) {
                              const nextCode = renderViewCode === "EV" ? generatedExternalCode : generatedInternalCode;
                              setRenderDraft((previous) => ({ ...previous, code: nextCode, name: nextCode }));
                            }
                          }}
                        />
                        <span>Manual code override</span>
                      </label>
                      <FormField label="Override code">
                        <input
                          value={renderDraft.code}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setRenderDraft((previous) => ({ ...previous, code: value, name: value }));
                          }}
                          readOnly={!manualCodeOverride}
                          style={{
                            ...inputStyle,
                            background: manualCodeOverride ? "var(--color-surface)" : "var(--color-surface-muted)",
                          }}
                        />
                      </FormField>
                      <FormField label="Notes">
                        <textarea
                          value={renderDraft.notes}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setRenderDraft((previous) => ({ ...previous, notes: value }));
                          }}
                          style={textareaStyle}
                        />
                      </FormField>
                      <Small>Format: <code>[PRODUCT]_[VIEW]_[VARIANT]</code></Small>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </SectionShell>
  );
}

export default function AdminConfiguratorCatalogWorkspace(props: {
  initialTab?: AdminConfiguratorTopTab;
  initialWindowTypesCategory?: "windows";
  onRenderWorkspaceActive?: (active: boolean) => void;
}) {
  const [bootstrap, setBootstrap] = useState<ConfiguratorCatalogBootstrap>(defaultBootstrap);
  const [activeTab, setActiveTab] = useState<AdminConfiguratorTopTab>(props.initialTab ?? "windowTypes");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const next = await getConfiguratorCatalogBootstrap();
        if (!cancelled) {
          setBootstrap({
            ...defaultBootstrap,
            ...next,
            manufacturers: next?.manufacturers ?? [],
            products: next?.products ?? [],
            windowTypes: next?.windowTypes ?? [],
            sectionProfiles: next?.sectionProfiles ?? [],
            profileMappings: next?.profileMappings ?? [],
            renderProfiles: next?.renderProfiles ?? [],
            sectionDrawings: next?.sectionDrawings ?? [],
            materials: next?.materials ?? [],
            colours: next?.colours ?? [],
            hardware: next?.hardware ?? [],
            glass: next?.glass ?? [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load configurator admin workspace", error);
          setErrorMessage("Failed to load configurator admin workspace.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: activeTab === "windowTypes" ? 8 : 16 }}>
      <div className="admin-card ui-card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TOP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
            >
              <span className="admin-nav-button-label">{tab.label}</span>
              <span className={activeTab === tab.key ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                {tab.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <div className="admin-card ui-card admin-status-card">Loading configurator admin workspace…</div> : null}
      {errorMessage ? <div className="admin-card ui-card admin-status-card admin-status-card--error">{errorMessage}</div> : null}

      {!isLoading && !errorMessage && (
        activeTab === "manufacturers" ? (
          <ManufacturersPanel bootstrap={bootstrap} setBootstrap={setBootstrap} />
        ) : activeTab === "windowTypes" ? (
          <AdminWindowTypesWorkspace
            bootstrap={bootstrap}
            initialCategory={props.initialWindowTypesCategory}
            onRenderWorkspaceActive={props.onRenderWorkspaceActive}
          />
        ) : activeTab === "configuratorRender" ? (
          <ConfiguratorRenderPanel bootstrap={bootstrap} setBootstrap={setBootstrap} />
        ) : (
          <SectionShell
            title="B92 Configurator"
            description="Controlled Admin access point for the future main B92 profile-section assembly configurator shell. Existing Window Types, Configurator Render, and Estimate configurators remain available during migration."
          >
            <B92ConfiguratorShell />
          </SectionShell>
        )
      )}
    </div>
  );
}
