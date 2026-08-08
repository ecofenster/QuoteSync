import React, { useEffect, useMemo, useState } from "react";
import { Button, H3, Small } from "../estimatePicker/tabs/shared";
import {
  createConfiguratorCatalogRecord,
  deleteConfiguratorCatalogRecord,
  getConfiguratorCatalogBootstrap,
  updateConfiguratorCatalogRecord,
} from "./configuratorCatalogService";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorRenderProfileRecord,
} from "./configuratorCatalog.types";
import { buildAdminPreviewWindowDrawingModel } from "./rendering/adminPreviewRenderAdapter";
import QuoteSyncDrawingSvg from "../configurator/rendering/QuoteSyncDrawingSvg";
import type { ResolvedSectionProfileSet } from "../configurator/rendering/profileSectionMapping";

type Props = {
  selectedManufacturerId: string;
  selectedProductId: string;
  selectedWindowTypeId: string;
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

function blankForm(context: { manufacturerId: string; productId: string; windowTypeId: string }): ConfiguratorRenderProfileRecord {
  return {
    id: "",
    manufacturer_id: context.manufacturerId || null,
    product_id: context.productId || null,
    window_type_id: context.windowTypeId || null,
    name: "",
    code: "",
    operation_type: "fixed",
    view_logic: "inside",
    frame_top_visible_mm: 63,
    frame_left_visible_mm: 63,
    frame_right_visible_mm: 63,
    frame_bottom_visible_mm: 63,
    sash_top_visible_mm: null,
    sash_left_visible_mm: null,
    sash_right_visible_mm: null,
    sash_bottom_visible_mm: null,
    bead_top_visible_mm: 21,
    bead_left_visible_mm: 21,
    bead_right_visible_mm: 21,
    bead_bottom_visible_mm: 21,
    preview_width_mm: 1000,
    preview_height_mm: 1200,
    handle_axis_offset_mm: null,
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
    external_cladding_inset_mm: null,
    external_frame_cladding_colour: "",
    external_sash_cladding_colour: "",
    notes: "",
    is_active: true,
  };
}

function FormField(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="qs-migrated-57">
      <span className="admin-setting-label">{props.label}</span>
      {props.children}
    </label>
  );
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function buildResolvedProfiles(record: ConfiguratorRenderProfileRecord): ResolvedSectionProfileSet {
  const operationType = record.operation_type === "fixed" ? "fixed" : "tilt_turn";
  const view = record.view_logic === "outside" ? "outside" : "inside";
  const beadTop = numericOrNull(record.bead_top_visible_mm);
  const beadLeft = numericOrNull(record.bead_left_visible_mm);
  const beadRight = numericOrNull(record.bead_right_visible_mm);
  const beadBottom = numericOrNull(record.bead_bottom_visible_mm);
  const sashTop = numericOrNull(record.sash_top_visible_mm);
  const sashLeft = numericOrNull(record.sash_left_visible_mm);
  const sashRight = numericOrNull(record.sash_right_visible_mm);
  const sashBottom = numericOrNull(record.sash_bottom_visible_mm);
  const handleOffset = numericOrNull(record.handle_axis_offset_mm);
  const pivotOffset = numericOrNull(record.hinge_pivot_offset_mm);

  const frameProfile = (name: string, visibleFaceWidthMm: number, beadVisibleFaceMm: number | null, side: "top" | "left" | "right" | "bottom") => ({
    id: `${record.id || "draft"}-${name}`,
    code: record.code,
    name,
    visibleFaceWidthMm,
    depthMm: visibleFaceWidthMm,
    insetMm: beadVisibleFaceMm ?? 10,
    overlapMm: 0,
    visibleInternalFaceMm: view === "inside" ? visibleFaceWidthMm : null,
    glassInsetMm: beadVisibleFaceMm,
    beadOffsetMm: view === "inside" ? beadVisibleFaceMm : null,
    beadVisibleFaceMm,
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
          id: `${record.id || "draft"}-${name}`,
          code: record.code,
          name,
          visibleFaceWidthMm,
          depthMm: visibleFaceWidthMm,
          insetMm: beadVisibleFaceMm ?? 8,
          overlapMm: 0,
          visibleInternalFaceMm: view === "inside" ? visibleFaceWidthMm : null,
          glassInsetMm: beadVisibleFaceMm,
          beadOffsetMm: view === "inside" ? beadVisibleFaceMm : null,
          beadVisibleFaceMm,
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
      head: frameProfile("Frame head", Number(record.frame_top_visible_mm || 63), beadTop, "top"),
      jambLeft: frameProfile("Frame jamb left", Number(record.frame_left_visible_mm || 63), beadLeft, "left"),
      jambRight: frameProfile("Frame jamb right", Number(record.frame_right_visible_mm || 63), beadRight, "right"),
      bottom: frameProfile("Frame bottom", Number(record.frame_bottom_visible_mm || 63), beadBottom, "bottom"),
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
      id: `${record.id || "draft"}-mullion`,
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
      id: `${record.id || "draft"}-flying`,
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
      id: `${record.id || "draft"}-transom`,
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
    trickleVent: null,
    sectionReferenceIds: [],
    referenceInputs: [],
  };
}

export default function AdminRenderProfileWorkspace(props: Props) {
  const { selectedManufacturerId, selectedProductId, selectedWindowTypeId } = props;
  const [bootstrap, setBootstrap] = useState<ConfiguratorCatalogBootstrap>(defaultBootstrap);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [formState, setFormState] = useState<ConfiguratorRenderProfileRecord>(
    blankForm({
      manufacturerId: selectedManufacturerId,
      productId: selectedProductId,
      windowTypeId: selectedWindowTypeId,
    })
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDimensions, setShowDimensions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const next = await getConfiguratorCatalogBootstrap();
        if (cancelled) return;
        setBootstrap(next);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load render profile workspace", error);
        setErrorMessage("Failed to load render profile workspace.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(
    () => bootstrap.products.filter((row) => !selectedManufacturerId || row.manufacturer_id === selectedManufacturerId),
    [bootstrap.products, selectedManufacturerId]
  );
  const filteredWindowTypes = useMemo(
    () => bootstrap.windowTypes.filter((row) => !selectedProductId || row.product_id === selectedProductId),
    [bootstrap.windowTypes, selectedProductId]
  );

  const records = useMemo(
    () =>
      bootstrap.renderProfiles.filter((row) => {
        if (selectedManufacturerId && row.manufacturer_id && row.manufacturer_id !== selectedManufacturerId) return false;
        if (selectedProductId && row.product_id && row.product_id !== selectedProductId) return false;
        if (selectedWindowTypeId && row.window_type_id && row.window_type_id !== selectedWindowTypeId) return false;
        return true;
      }),
    [bootstrap.renderProfiles, selectedManufacturerId, selectedProductId, selectedWindowTypeId]
  );

  useEffect(() => {
    const selected = records.find((row) => row.id === selectedRecordId);
    if (selected) {
      setFormState(selected);
      return;
    }
    setSelectedRecordId("");
    setFormState(
      blankForm({
        manufacturerId: selectedManufacturerId,
        productId: selectedProductId,
        windowTypeId: selectedWindowTypeId,
      })
    );
  }, [records, selectedRecordId, selectedManufacturerId, selectedProductId, selectedWindowTypeId]);

  function setField<K extends keyof ConfiguratorRenderProfileRecord>(key: K, value: ConfiguratorRenderProfileRecord[K]) {
    setFormState((previous) => ({ ...previous, [key]: value }));
  }

  function patchBootstrap(saved: ConfiguratorRenderProfileRecord) {
    setBootstrap((previous) => ({
      ...previous,
      renderProfiles: [saved, ...previous.renderProfiles.filter((row) => row.id !== saved.id)],
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const payload = { ...formState };
      const saved = selectedRecordId
        ? await updateConfiguratorCatalogRecord<ConfiguratorRenderProfileRecord>("renderProfiles", selectedRecordId, payload)
        : await createConfiguratorCatalogRecord<ConfiguratorRenderProfileRecord>("renderProfiles", payload);
      patchBootstrap(saved);
      setSelectedRecordId(saved.id);
    } catch (error) {
      console.error("Failed to save render profile", error);
      setErrorMessage("Failed to save render profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedRecordId) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      await deleteConfiguratorCatalogRecord("renderProfiles", selectedRecordId);
      setBootstrap((previous) => ({
        ...previous,
        renderProfiles: previous.renderProfiles.filter((row) => row.id !== selectedRecordId),
      }));
      setSelectedRecordId("");
    } catch (error) {
      console.error("Failed to delete render profile", error);
      setErrorMessage("Failed to delete render profile.");
    } finally {
      setIsSaving(false);
    }
  }

  const previewModel = useMemo(() => {
    const resolvedProfiles = buildResolvedProfiles(formState);
    const model = buildAdminPreviewWindowDrawingModel({
      widthMm: Math.max(300, Number(formState.preview_width_mm || 1000)),
      heightMm: Math.max(300, Number(formState.preview_height_mm || 1200)),
      fieldsX: 1,
      fieldsY: 1,
      insertion: formState.operation_type === "fixed" ? "Fixed" : "Tilt & Turn Left",
      orientationView: formState.view_logic === "outside" ? "outside" : "inside",
      openingSymbolMode: "din",
      resolvedProfiles,
      adminPreviewConfiguration: {
        hardware: {
          defaultHandleHeightMm: numericOrNull(formState.handle_height_mm) ?? 1050,
          defaultHingeType: "Standard",
        },
      },
    });
    return showDimensions
      ? model
      : { ...model, annotations: { ...model.annotations, dimensions: [] } };
  }, [formState, showDimensions]);

  return (
    <div className="qs-migrated-131">
      <div className="admin-card ui-card qs-migrated-146">
        <div className="qs-migrated-80">
          <H3>Render Profile Dimensions</H3>
          <Small>
            Manual inside-view render dimensions for fixed and tilt & turn profiles. These values drive the native preview and are the next bridge into accurate profile-based rendering.
          </Small>
        </div>

        <Button
          variant="secondary"
          onClick={() =>
            setFormState(
              blankForm({
                manufacturerId: selectedManufacturerId,
                productId: selectedProductId,
                windowTypeId: selectedWindowTypeId,
              })
            )
          }
        >
          New
        </Button>

        <div className="qs-migrated-80">
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => setSelectedRecordId(record.id)}
              className={selectedRecordId === record.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
            >
              <span className="admin-nav-button-label">{record.name || "(untitled render profile)"}</span>
              <span className={selectedRecordId === record.id ? "admin-nav-button-desc admin-nav-button-desc--active" : "admin-nav-button-desc"}>
                {record.operation_type} • {record.view_logic}
              </span>
            </button>
          ))}
          {!isLoading && records.length === 0 ? <div className="admin-placeholder-box">No render profiles yet.</div> : null}
        </div>
      </div>

      <div className="qs-migrated-122">
        {isLoading ? <div className="admin-card ui-card admin-status-card">Loading render profiles…</div> : null}
        {errorMessage ? <div className="admin-card ui-card admin-status-card admin-status-card--error">{errorMessage}</div> : null}

        {!isLoading && (
          <>
            <div className="admin-card ui-card qs-migrated-147">
              <div>
                <div className="admin-group-title">{selectedRecordId ? "Edit render profile" : "New render profile"}</div>
                <div className="admin-body-copy">
                  This is a manual render-profile dimension editor. Uploaded CAD files remain reference inputs only; the live preview below is always a native QuoteSync render.
                </div>
              </div>

              <div className="qs-migrated-142">
                <FormField label="Manufacturer">
                  <select value={formState.manufacturer_id ?? ""} onChange={(event) => setField("manufacturer_id", event.currentTarget.value || null)} className="qs-migrated-127">
                    <option value="">Any manufacturer</option>
                    {bootstrap.manufacturers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Product">
                  <select value={formState.product_id ?? ""} onChange={(event) => setField("product_id", event.currentTarget.value || null)} className="qs-migrated-127">
                    <option value="">Any product</option>
                    {filteredProducts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Window type">
                  <select value={formState.window_type_id ?? ""} onChange={(event) => setField("window_type_id", event.currentTarget.value || null)} className="qs-migrated-127">
                    <option value="">Any window type</option>
                    {filteredWindowTypes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Name">
                  <input value={formState.name} onChange={(event) => setField("name", event.currentTarget.value)} className="qs-migrated-127" />
                </FormField>
                <FormField label="Code">
                  <input value={formState.code} onChange={(event) => setField("code", event.currentTarget.value)} className="qs-migrated-127" />
                </FormField>
                <FormField label="Window type selection">
                  <select value={formState.operation_type} onChange={(event) => setField("operation_type", event.currentTarget.value)} className="qs-migrated-127">
                    <option value="fixed">Fixed window</option>
                    <option value="tilt_turn">Tilt & Turn window</option>
                  </select>
                </FormField>
                <FormField label="View">
                  <select value={formState.view_logic} onChange={(event) => setField("view_logic", event.currentTarget.value)} className="qs-migrated-127">
                    <option value="inside">Inside</option>
                    <option value="outside">Outside</option>
                    <option value="both">Both</option>
                  </select>
                </FormField>
                <FormField label="Preview width (mm)">
                  <input type="number" value={formState.preview_width_mm ?? ""} onChange={(event) => setField("preview_width_mm", Number(event.currentTarget.value || 0))} className="qs-migrated-127" />
                </FormField>
                <FormField label="Preview height (mm)">
                  <input type="number" value={formState.preview_height_mm ?? ""} onChange={(event) => setField("preview_height_mm", Number(event.currentTarget.value || 0))} className="qs-migrated-127" />
                </FormField>
              </div>

              <div className="qs-migrated-41">
                <div className="admin-setting-label">Visible fixed frame width (mm)</div>
                <div className="qs-migrated-148">
                  {[
                    ["frame_top_visible_mm", "Top"],
                    ["frame_left_visible_mm", "Left"],
                    ["frame_right_visible_mm", "Right"],
                    ["frame_bottom_visible_mm", "Bottom"],
                  ].map(([key, label]) => (
                    <FormField key={key} label={label}>
                      <input type="number" value={(formState as any)[key] ?? ""} onChange={(event) => setField(key as keyof ConfiguratorRenderProfileRecord, Number(event.currentTarget.value || 0) as any)} className="qs-migrated-127" />
                    </FormField>
                  ))}
                </div>
              </div>

              <div className="qs-migrated-41">
                <div className="admin-setting-label">Visible sash width (mm)</div>
                <div className="qs-migrated-148">
                  {[
                    ["sash_top_visible_mm", "Top"],
                    ["sash_left_visible_mm", "Left"],
                    ["sash_right_visible_mm", "Right"],
                    ["sash_bottom_visible_mm", "Bottom"],
                  ].map(([key, label]) => (
                    <FormField key={key} label={label}>
                      <input type="number" value={(formState as any)[key] ?? ""} onChange={(event) => setField(key as keyof ConfiguratorRenderProfileRecord, numericOrNull(event.currentTarget.value) as any)} className="qs-migrated-127" />
                    </FormField>
                  ))}
                </div>
              </div>

              <div className="qs-migrated-41">
                <div className="admin-setting-label">Visible glazing bead width (mm)</div>
                <div className="qs-migrated-148">
                  {[
                    ["bead_top_visible_mm", "Top"],
                    ["bead_left_visible_mm", "Left"],
                    ["bead_right_visible_mm", "Right"],
                    ["bead_bottom_visible_mm", "Bottom"],
                  ].map(([key, label]) => (
                    <FormField key={key} label={label}>
                      <input type="number" value={(formState as any)[key] ?? ""} onChange={(event) => setField(key as keyof ConfiguratorRenderProfileRecord, numericOrNull(event.currentTarget.value) as any)} className="qs-migrated-127" />
                    </FormField>
                  ))}
                </div>
              </div>

              <div className="qs-migrated-149">
                <FormField label="Handle axis offset (mm)">
                  <input type="number" value={formState.handle_axis_offset_mm ?? ""} onChange={(event) => setField("handle_axis_offset_mm", numericOrNull(event.currentTarget.value))} className="qs-migrated-127" />
                </FormField>
                <FormField label="Handle height (mm)">
                  <input type="number" value={formState.handle_height_mm ?? ""} onChange={(event) => setField("handle_height_mm", numericOrNull(event.currentTarget.value))} className="qs-migrated-127" />
                </FormField>
                <FormField label="Hinge pivot offset (mm)">
                  <input type="number" value={formState.hinge_pivot_offset_mm ?? ""} onChange={(event) => setField("hinge_pivot_offset_mm", numericOrNull(event.currentTarget.value))} className="qs-migrated-127" />
                </FormField>
                <FormField label="External frame cladding">
                  <input value={formState.external_frame_cladding_colour} onChange={(event) => setField("external_frame_cladding_colour", event.currentTarget.value)} className="qs-migrated-127" />
                </FormField>
                <FormField label="External sash cladding">
                  <input value={formState.external_sash_cladding_colour} onChange={(event) => setField("external_sash_cladding_colour", event.currentTarget.value)} className="qs-migrated-127" />
                </FormField>
              </div>

              <FormField label="Notes">
                <textarea value={formState.notes} onChange={(event) => setField("notes", event.currentTarget.value)} className="qs-migrated-128" />
              </FormField>

              <label className="admin-flex-row qs-migrated-129">
                <input type="checkbox" checked={!!formState.is_active} onChange={(event) => setField("is_active", event.currentTarget.checked)} />
                <span>Active</span>
              </label>

              <div className="admin-flex-row">
                <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => void handleDelete()} disabled={!selectedRecordId || isSaving}>
                  Delete
                </Button>
              </div>
            </div>

            <div className="admin-card ui-card qs-migrated-150">
              <div className="qs-migrated-7">
                <div>
                  <div className="admin-group-title">Native preview</div>
                  <div className="admin-body-copy">Manual profile dimensions → resolved geometry values → native drawing model → live render.</div>
                </div>
                <label className="admin-flex-row qs-migrated-129">
                  <input type="checkbox" checked={showDimensions} onChange={(event) => setShowDimensions(event.currentTarget.checked)} />
                  <span>Show dimensions</span>
                </label>
              </div>
              <div className="qs-migrated-151">
                <QuoteSyncDrawingSvg model={previewModel} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
