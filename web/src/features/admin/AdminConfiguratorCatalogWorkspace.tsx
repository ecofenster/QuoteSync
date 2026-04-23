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
  ConfiguratorWindowTypeRecord,
} from "./configuratorCatalog.types";
import { Button, H3, Small } from "../estimatePicker/tabs/shared";
import { buildWindowDrawingModel } from "../configurator/rendering/buildWindowDrawingModel";
import QuoteSyncDrawingSvg from "../configurator/rendering/QuoteSyncDrawingSvg";
import type { ResolvedSectionProfileSet } from "../configurator/rendering/profileSectionMapping";

type AdminConfiguratorTopTab = "manufacturers" | "windowTypes" | "configuratorRender";
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
    external_cladding_inset_mm: 3,
    external_frame_cladding_colour: "",
    external_sash_cladding_colour: "",
    notes: "",
    is_active: true,
  };
}

function applyInternalRenderDefaults(
  record: ConfiguratorRenderProfileRecord,
  viewLogic: "inside" | "outside" | "both"
): ConfiguratorRenderProfileRecord {
  if (viewLogic !== "inside") return record;
  const nextBottom =
    record.frame_bottom_visible_mm == null || Number(record.frame_bottom_visible_mm) === 37.5
      ? 52.5
      : record.frame_bottom_visible_mm;
  return {
    ...record,
    frame_bottom_visible_mm: nextBottom,
  };
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
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

function buildRenderDefinitionContextKey(
  productGroup: ProductGroupKey,
  windowTab: WindowRenderTab,
  operationType: string,
  viewCode: RenderProfileViewCode
) {
  return `${productGroup}:${windowTab}:${String(operationType || "fixed").trim().toLowerCase()}:${viewCode}`;
}

function matchesRenderDefinitionContext(
  row: ConfiguratorRenderProfileRecord,
  contextKey: string,
  operationType: string,
  viewLogic: "inside" | "outside"
) {
  const normalizedName = String(row.name || "").trim().toLowerCase();
  if (normalizedName === contextKey.toLowerCase()) return true;
  const legacyName = String(row.name || "").trim();
  const rowViewLogic = String(row.view_logic || "").trim().toLowerCase();
  const isLegacyProfile = !legacyName.includes(":");
  if (!isLegacyProfile) return false;
  return row.operation_type === operationType && (rowViewLogic === viewLogic || rowViewLogic === "both");
}

function buildResolvedProfiles(record: ConfiguratorRenderProfileRecord, view: "inside" | "outside"): ResolvedSectionProfileSet {
  const operationType = record.operation_type === "fixed" ? "fixed" : "tilt_turn";
  const beadTop = view === "inside" ? numericOrNull(record.bead_top_visible_mm) : null;
  const beadLeft = view === "inside" ? numericOrNull(record.bead_left_visible_mm) : null;
  const beadRight = view === "inside" ? numericOrNull(record.bead_right_visible_mm) : null;
  const beadBottom = view === "inside" ? numericOrNull(record.bead_bottom_visible_mm) : null;
  const sashTop = numericOrNull(record.sash_top_visible_mm);
  const sashLeft = numericOrNull(record.sash_left_visible_mm);
  const sashRight = numericOrNull(record.sash_right_visible_mm);
  const sashBottom = numericOrNull(record.sash_bottom_visible_mm);
  const handleOffset = numericOrNull(record.handle_axis_offset_mm);
  const pivotOffset = numericOrNull(record.hinge_pivot_offset_mm);
  const externalCladdingInsetMm = view === "outside" ? numericOrNull(record.external_cladding_inset_mm) ?? 3 : 0;

  const baseProfile = (
    name: string,
    visibleFaceWidthMm: number,
    beadVisibleFaceMm: number | null,
    side: "top" | "left" | "right" | "bottom"
  ) => ({
    id: `${record.id || "draft"}-${name}-${view}`,
    code: record.code,
    name,
    visibleFaceWidthMm,
    depthMm: visibleFaceWidthMm,
    insetMm: view === "outside" ? externalCladdingInsetMm : beadVisibleFaceMm ?? 10,
    overlapMm: 0,
    visibleInternalFaceMm: view === "inside" ? visibleFaceWidthMm : null,
    glassInsetMm: view === "inside" ? beadVisibleFaceMm : null,
    beadOffsetMm: view === "inside" ? beadVisibleFaceMm : null,
    beadVisibleFaceMm: view === "inside" ? beadVisibleFaceMm : null,
    handleAxisOffsetMm: side === "left" || side === "right" ? handleOffset : null,
    hingePivotOffsetMm: side === "left" || side === "right" ? pivotOffset : null,
    meetingGapMm: null,
    drawingReferenceIds: [],
    referenceInputs: [],
    notes: record.notes,
  });

  const sashProfile = (
    name: string,
    visibleFaceWidthMm: number | null,
    beadVisibleFaceMm: number | null,
    side: "top" | "left" | "right" | "bottom"
  ) =>
    visibleFaceWidthMm == null
        ? null
      : {
          id: `${record.id || "draft"}-${name}-${view}`,
          code: record.code,
          name,
          visibleFaceWidthMm,
          depthMm: visibleFaceWidthMm,
          insetMm:
            view === "inside"
              ? side === "bottom"
                ? 0
                : beadVisibleFaceMm ?? 8
              : externalCladdingInsetMm,
          overlapMm: 0,
          visibleInternalFaceMm: view === "inside" ? visibleFaceWidthMm : null,
          glassInsetMm: view === "inside" ? beadVisibleFaceMm : null,
          beadOffsetMm: view === "inside" ? beadVisibleFaceMm : null,
          beadVisibleFaceMm: view === "inside" ? beadVisibleFaceMm : null,
          handleAxisOffsetMm: side === "left" || side === "right" ? handleOffset : null,
          hingePivotOffsetMm: side === "left" || side === "right" ? pivotOffset : null,
          meetingGapMm: null,
          drawingReferenceIds: [],
          referenceInputs: [],
          notes: record.notes,
        };

  return {
    operationType,
    manufacturerId: record.manufacturer_id,
    productId: record.product_id,
    windowTypeId: record.window_type_id,
    frame: {
      head: baseProfile("Frame head", Number(record.frame_top_visible_mm || 63), beadTop, "top"),
      jambLeft: baseProfile("Frame jamb left", Number(record.frame_left_visible_mm || 63), beadLeft, "left"),
      jambRight: baseProfile("Frame jamb right", Number(record.frame_right_visible_mm || 63), beadRight, "right"),
      bottom: baseProfile("Frame bottom", Number(record.frame_bottom_visible_mm || 52.5), beadBottom, "bottom"),
    },
    sash: operationType === "fixed"
      ? { head: null, jambLeft: null, jambRight: null, bottom: null }
      : {
          head: sashProfile("Sash head", sashTop, beadTop, "top"),
          jambLeft: sashProfile("Sash jamb left", sashLeft, beadLeft, "left"),
          jambRight: sashProfile("Sash jamb right", sashRight, beadRight, "right"),
          bottom: sashProfile("Sash bottom", sashBottom, beadBottom, "bottom"),
        },
    mullion: {
      id: `${record.id || "draft"}-mullion-${view}`,
      code: record.code,
      name: "Default mullion",
      visibleFaceWidthMm: 76,
      depthMm: 76,
      insetMm: 0,
      overlapMm: 0,
      visibleInternalFaceMm: null,
      glassInsetMm: null,
      beadOffsetMm: null,
      beadVisibleFaceMm: null,
      handleAxisOffsetMm: null,
      hingePivotOffsetMm: null,
      meetingGapMm: null,
      drawingReferenceIds: [],
      referenceInputs: [],
      notes: record.notes,
    },
    flyingMullion: {
      id: `${record.id || "draft"}-flying-${view}`,
      code: record.code,
      name: "Default flying mullion",
      visibleFaceWidthMm: 62,
      depthMm: 62,
      insetMm: 0,
      overlapMm: 0,
      visibleInternalFaceMm: null,
      glassInsetMm: null,
      beadOffsetMm: null,
      beadVisibleFaceMm: null,
      handleAxisOffsetMm: null,
      hingePivotOffsetMm: null,
      meetingGapMm: 5,
      drawingReferenceIds: [],
      referenceInputs: [],
      notes: record.notes,
    },
    transom: {
      id: `${record.id || "draft"}-transom-${view}`,
      code: record.code,
      name: "Default transom",
      visibleFaceWidthMm: 76,
      depthMm: 76,
      insetMm: 0,
      overlapMm: 0,
      visibleInternalFaceMm: null,
      glassInsetMm: null,
      beadOffsetMm: null,
      beadVisibleFaceMm: null,
      handleAxisOffsetMm: null,
      hingePivotOffsetMm: null,
      meetingGapMm: null,
      drawingReferenceIds: [],
      referenceInputs: [],
      notes: record.notes,
    },
    cill: null,
    sectionReferenceIds: [],
    referenceInputs: [],
  };
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
        ? applyInternalRenderDefaults(comparisonRenderProfile, "inside")
        : applyInternalRenderDefaults({
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
        applyInternalRenderDefaults(
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
      return applyInternalRenderDefaults(
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
      buildWindowDrawingModel({
        widthMm: Math.max(300, Number(internalPreviewDraft.preview_width_mm || 1000)),
        heightMm: Math.max(300, Number(internalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: 1,
        fieldsY: 1,
        insertion: previewInsertion,
        orientationView: "inside",
        resolvedProfiles: buildResolvedProfiles(internalPreviewDraft, "inside"),
        windowConfiguration: {
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
      buildWindowDrawingModel({
        widthMm: Math.max(300, Number(externalPreviewDraft.preview_width_mm || 1000)),
        heightMm: Math.max(300, Number(externalPreviewDraft.preview_height_mm || 1200)),
        fieldsX: 1,
        fieldsY: 1,
        insertion: previewInsertion,
        orientationView: "outside",
        resolvedProfiles: buildResolvedProfiles(externalPreviewDraft, "outside"),
        windowConfiguration: {
          hardware: {
            defaultHandleHeightMm: numericOrNull(externalPreviewDraft.handle_height_mm) ?? 1050,
            defaultHingeType: "Standard",
          },
        },
      }),
    [externalPreviewDraft, previewInsertion]
  );

  const visibleInternalModel = showDimensions ? internalModel : { ...internalModel, annotations: { ...internalModel.annotations, dimensions: [] } };
  const visibleExternalModel = showDimensions ? externalModel : { ...externalModel, annotations: { ...externalModel.annotations, dimensions: [] } };

  async function saveRenderProfile() {
    setIsSaving(true);
    try {
      const finalCode = manualCodeOverride ? String(renderDraft.code || "").trim() || generatedRenderCode : generatedRenderCode;
      const payload = {
        ...renderDraft,
        name: selectedDefinitionContextKey,
        code: finalCode,
        operation_type: selectedOpeningOperation,
        view_logic: renderViewCode === "EV" ? "outside" : "inside",
        window_type_id: matchingWindowTypeId,
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
        applyInternalRenderDefaults(
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

          {windowTab !== "1field" ? (
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
                        <QuoteSyncDrawingSvg model={visibleInternalModel} />
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
                        <QuoteSyncDrawingSvg model={visibleExternalModel} />
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
                        {!(selectedOpeningDirection === "inward" && renderViewCode === "EV") ? (
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
                        ) : null}
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

export default function AdminConfiguratorCatalogWorkspace() {
  const [bootstrap, setBootstrap] = useState<ConfiguratorCatalogBootstrap>(defaultBootstrap);
  const [activeTab, setActiveTab] = useState<AdminConfiguratorTopTab>("manufacturers");
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
    <div style={{ display: "grid", gap: 16 }}>
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
          <WindowTypesPanel bootstrap={bootstrap} setBootstrap={setBootstrap} />
        ) : (
          <ConfiguratorRenderPanel bootstrap={bootstrap} setBootstrap={setBootstrap} />
        )
      )}
    </div>
  );
}
