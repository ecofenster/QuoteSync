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
  ConfiguratorCatalogEntityKey,
  ConfiguratorProfileMappingKey,
  ConfiguratorSectionProfileCategory,
  ConfiguratorSectionProfileOrientation,
} from "./configuratorCatalog.types";

type Props = {
  selectedManufacturerId: string;
  selectedProductId: string;
  selectedWindowTypeId: string;
};

type SectionsSubTabKey = "sectionProfiles" | "profileMappings" | "sectionDrawings";

const SUB_TAB_LIST: Array<{ key: SectionsSubTabKey; label: string }> = [
  { key: "sectionProfiles", label: "Profiles" },
  { key: "profileMappings", label: "Mappings" },
  { key: "sectionDrawings", label: "Reference drawings" },
];

const PROFILE_CATEGORY_OPTIONS: ConfiguratorSectionProfileCategory[] = [
  "outer_frame",
  "sash",
  "mullion",
  "flying_mullion",
  "transom",
  "coupling",
  "corner",
  "cill",
];

const PROFILE_ORIENTATION_OPTIONS: ConfiguratorSectionProfileOrientation[] = [
  "head",
  "jamb_left",
  "jamb_right",
  "bottom",
  "mullion",
  "transom",
  "coupling",
  "corner",
];

const OPERATION_OPTIONS = ["fixed", "tilt_turn", "turn", "outward_opening", "slide"];
const MAPPING_KEY_OPTIONS: ConfiguratorProfileMappingKey[] = [
  "frame_head",
  "frame_jamb_left",
  "frame_jamb_right",
  "frame_bottom",
  "sash_head",
  "sash_jamb_left",
  "sash_jamb_right",
  "sash_bottom",
  "mullion",
  "flying_mullion",
  "transom",
  "coupling",
  "corner",
  "cill",
];

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

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseJsonInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

function FormField(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="admin-setting-label">{props.label}</span>
      {props.children}
    </label>
  );
}

function CheckboxPill(props: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className={props.checked ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
      style={{ minHeight: 0, padding: "10px 12px" }}
    >
      <span className="admin-nav-button-label">{props.label}</span>
    </button>
  );
}

function blankForm(
  subTab: SectionsSubTabKey,
  context: { manufacturerId: string; productId: string; windowTypeId: string }
) {
  if (subTab === "sectionProfiles") {
    return {
      category: "outer_frame",
      family: "window",
      code: "",
      name: "",
      description: "",
      orientation_applicability: ["head", "jamb_left", "jamb_right", "bottom"],
      inside_outside_applicability: "both",
      operation_applicability: ["fixed"],
      visible_face_width_mm: 70,
      depth_mm: 70,
      inset_mm: 0,
      overlap_mm: 0,
      drawing_reference_ids: [],
      notes: "",
      is_active: true,
    };
  }
  if (subTab === "profileMappings") {
    return {
      manufacturer_id: context.manufacturerId || null,
      product_id: context.productId || null,
      window_type_id: context.windowTypeId || null,
      profile_id: "",
      mapping_key: "frame_head",
      operation_type: "fixed",
      notes: "",
      is_active: true,
    };
  }
  return {
    manufacturer_id: context.manufacturerId || null,
    product_id: context.productId || null,
    window_type_id: context.windowTypeId || null,
    title: "",
    code: "",
    represents: "",
    orientation: "head",
    inside_outside_applicability: "both",
    section_ref_id: "",
    profile_ref_id: "",
    drawing_purpose: "elevation_reference",
    source_dxf_path: "",
    source_svg_path: "",
    geometry_rules: {},
    render_behaviour: {},
    notes: "",
    is_active: true,
  };
}

function labelForRecord(subTab: SectionsSubTabKey, record: any, bootstrap: ConfiguratorCatalogBootstrap) {
  if (subTab === "sectionProfiles") return record.name || "(unnamed profile)";
  if (subTab === "profileMappings") {
    const profileName =
      bootstrap.sectionProfiles.find((row) => row.id === record.profile_id)?.name || "Unknown profile";
    return `${record.mapping_key || "mapping"} → ${profileName}`;
  }
  return record.title || "(untitled drawing)";
}

export default function ConfiguratorSectionsWorkspace(props: Props) {
  const { selectedManufacturerId, selectedProductId, selectedWindowTypeId } = props;
  const [bootstrap, setBootstrap] = useState<ConfiguratorCatalogBootstrap>(defaultBootstrap);
  const [activeSubTab, setActiveSubTab] = useState<SectionsSubTabKey>("sectionProfiles");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
        console.error("Failed to load configurator sections workspace", error);
        setErrorMessage("Failed to load sections workspace.");
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
    () =>
      bootstrap.products.filter(
        (row) => !selectedManufacturerId || row.manufacturer_id === selectedManufacturerId
      ),
    [bootstrap.products, selectedManufacturerId]
  );
  const filteredWindowTypes = useMemo(
    () =>
      bootstrap.windowTypes.filter((row) => !selectedProductId || row.product_id === selectedProductId),
    [bootstrap.windowTypes, selectedProductId]
  );

  const records = useMemo(() => {
    if (activeSubTab === "sectionProfiles") return bootstrap.sectionProfiles;
    if (activeSubTab === "profileMappings") {
      return bootstrap.profileMappings.filter((row) => {
        if (selectedManufacturerId && row.manufacturer_id && row.manufacturer_id !== selectedManufacturerId) return false;
        if (selectedProductId && row.product_id && row.product_id !== selectedProductId) return false;
        if (selectedWindowTypeId && row.window_type_id && row.window_type_id !== selectedWindowTypeId) return false;
        return true;
      });
    }
    return bootstrap.sectionDrawings.filter((row) => {
      if (selectedManufacturerId && row.manufacturer_id && row.manufacturer_id !== selectedManufacturerId) return false;
      if (selectedProductId && row.product_id && row.product_id !== selectedProductId) return false;
      if (selectedWindowTypeId && row.window_type_id && row.window_type_id !== selectedWindowTypeId) return false;
      return true;
    });
  }, [activeSubTab, bootstrap, selectedManufacturerId, selectedProductId, selectedWindowTypeId]);

  useEffect(() => {
    const selected = records.find((row: any) => row.id === selectedRecordId);
    if (!selected) {
      const nextBlank = blankForm(activeSubTab, {
        manufacturerId: selectedManufacturerId,
        productId: selectedProductId,
        windowTypeId: selectedWindowTypeId,
      });
      setSelectedRecordId("");
      setFormState(nextBlank);
      setJsonDrafts({
        geometry_rules: prettyJson((nextBlank as any).geometry_rules),
        render_behaviour: prettyJson((nextBlank as any).render_behaviour),
      });
      return;
    }
    setFormState(selected);
    setJsonDrafts({
      geometry_rules: prettyJson((selected as any).geometry_rules),
      render_behaviour: prettyJson((selected as any).render_behaviour),
    });
  }, [activeSubTab, records, selectedRecordId, selectedManufacturerId, selectedProductId, selectedWindowTypeId]);

  function patchBootstrap(entity: ConfiguratorCatalogEntityKey, saved: any) {
    setBootstrap((previous) => ({
      ...previous,
      [entity]: [saved, ...previous[entity].filter((row: any) => row.id !== saved.id)],
    }));
  }

  function removeFromBootstrap(entity: ConfiguratorCatalogEntityKey, id: string) {
    setBootstrap((previous) => ({
      ...previous,
      [entity]: previous[entity].filter((row: any) => row.id !== id),
    }));
  }

  function activeEntity(): ConfiguratorCatalogEntityKey {
    return activeSubTab;
  }

  function setField(key: string, value: unknown) {
    setFormState((previous) => ({ ...previous, [key]: value }));
  }

  function toggleArrayField(key: "orientation_applicability" | "operation_applicability", value: string) {
    setFormState((previous) => {
      const current = Array.isArray(previous[key]) ? previous[key] : [];
      const exists = current.includes(value);
      return {
        ...previous,
        [key]: exists ? current.filter((entry: string) => entry !== value) : [...current, value],
      };
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const payload =
        activeSubTab === "sectionProfiles"
          ? {
              ...formState,
              visible_face_width_mm: Number(formState.visible_face_width_mm || 0),
              depth_mm: Number(formState.depth_mm || 0),
              inset_mm: Number(formState.inset_mm || 0),
              overlap_mm: Number(formState.overlap_mm || 0),
            }
          : activeSubTab === "profileMappings"
            ? { ...formState }
            : {
                ...formState,
                geometry_rules: parseJsonInput(jsonDrafts.geometry_rules || "{}"),
                render_behaviour: parseJsonInput(jsonDrafts.render_behaviour || "{}"),
              };
      const entity = activeEntity();
      const saved = selectedRecordId
        ? await updateConfiguratorCatalogRecord<any>(entity, selectedRecordId, payload)
        : await createConfiguratorCatalogRecord<any>(entity, payload);
      patchBootstrap(entity, saved);
      setSelectedRecordId(saved.id);
    } catch (error) {
      console.error("Failed to save configurator sections record", error);
      setErrorMessage("Failed to save section/profile record.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedRecordId) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      const entity = activeEntity();
      await deleteConfiguratorCatalogRecord(entity, selectedRecordId);
      removeFromBootstrap(entity, selectedRecordId);
      setSelectedRecordId("");
    } catch (error) {
      console.error("Failed to delete configurator sections record", error);
      setErrorMessage("Failed to delete section/profile record.");
    } finally {
      setIsSaving(false);
    }
  }

  const mappingCountForSelectedWindowType = useMemo(() => {
    return bootstrap.profileMappings.filter(
      (row) => !selectedWindowTypeId || row.window_type_id === selectedWindowTypeId || !row.window_type_id
    ).length;
  }, [bootstrap.profileMappings, selectedWindowTypeId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16 }}>
      <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 12, alignContent: "start" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <H3>Sections / Drawings</H3>
          <Small>
            Section profiles and mappings are now the bridge between the admin catalog and the native
            drawing model. Reference drawings remain optional source/reference records only.
          </Small>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUB_TAB_LIST.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveSubTab(tab.key);
                setSelectedRecordId("");
              }}
              className={activeSubTab === tab.key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              style={{ minWidth: 120 }}
            >
              <span className="admin-nav-button-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="admin-placeholder-box">
          {selectedWindowTypeId
            ? `Filtered to the selected window type where mappings/drawings are specific. Matching and global mappings are shown. Current relevance: ${mappingCountForSelectedWindowType} mapping records.`
            : "No window type filter is selected, so all global and scoped mappings are shown."}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="admin-group-title">{SUB_TAB_LIST.find((row) => row.key === activeSubTab)?.label}</div>
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedRecordId("");
              setFormState(
                blankForm(activeSubTab, {
                  manufacturerId: selectedManufacturerId,
                  productId: selectedProductId,
                  windowTypeId: selectedWindowTypeId,
                })
              );
            }}
          >
            New
          </Button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {records.map((record: any) => {
            const relevance =
              activeSubTab === "sectionProfiles"
                ? `${bootstrap.profileMappings.filter((row) => row.profile_id === record.id).length} mappings`
                : record.code || record.operation_type || record.orientation || "No code";
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedRecordId(record.id)}
                className={selectedRecordId === record.id ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"}
              >
                <span className="admin-nav-button-label">
                  {labelForRecord(activeSubTab, record, bootstrap)}
                </span>
                <span
                  className={
                    selectedRecordId === record.id
                      ? "admin-nav-button-desc admin-nav-button-desc--active"
                      : "admin-nav-button-desc"
                  }
                >
                  {relevance}
                </span>
              </button>
            );
          })}
          {!isLoading && records.length === 0 ? (
            <div className="admin-placeholder-box">No records in this section yet.</div>
          ) : null}
        </div>
      </div>

      <div className="admin-card ui-card" style={{ padding: 18, display: "grid", gap: 14 }}>
        {isLoading ? <div className="admin-status-card">Loading sections workspace…</div> : null}
        {errorMessage ? <div className="admin-status-card admin-status-card--error">{errorMessage}</div> : null}

        {!isLoading ? (
          <>
            <div>
              <div className="admin-group-title">{selectedRecordId ? "Edit record" : "New record"}</div>
              <div className="admin-body-copy">
                This surface manages section/profile definitions, the mapping bridge into the renderer, and
                optional section/drawing reference metadata. DXF/SVG remain source references only.
              </div>
            </div>

            {activeSubTab === "sectionProfiles" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <FormField label="Category">
                    <select
                      value={formState.category ?? "outer_frame"}
                      onChange={(event) => setField("category", event.currentTarget.value)}
                      style={inputStyle}
                    >
                      {PROFILE_CATEGORY_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Family">
                    <input
                      value={formState.family ?? "window"}
                      onChange={(event) => setField("family", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Name">
                    <input
                      value={formState.name ?? ""}
                      onChange={(event) => setField("name", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Code">
                    <input
                      value={formState.code ?? ""}
                      onChange={(event) => setField("code", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Visible face width (mm)">
                    <input
                      type="number"
                      value={formState.visible_face_width_mm ?? 70}
                      onChange={(event) => setField("visible_face_width_mm", Number(event.currentTarget.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Depth (mm)">
                    <input
                      type="number"
                      value={formState.depth_mm ?? 70}
                      onChange={(event) => setField("depth_mm", Number(event.currentTarget.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Inset (mm)">
                    <input
                      type="number"
                      value={formState.inset_mm ?? 0}
                      onChange={(event) => setField("inset_mm", Number(event.currentTarget.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Overlap (mm)">
                    <input
                      type="number"
                      value={formState.overlap_mm ?? 0}
                      onChange={(event) => setField("overlap_mm", Number(event.currentTarget.value))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Inside / outside applicability">
                    <select
                      value={formState.inside_outside_applicability ?? "both"}
                      onChange={(event) =>
                        setField("inside_outside_applicability", event.currentTarget.value)
                      }
                      style={inputStyle}
                    >
                      <option value="inside">Inside</option>
                      <option value="outside">Outside</option>
                      <option value="both">Both</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Description">
                  <textarea
                    value={formState.description ?? ""}
                    onChange={(event) => setField("description", event.currentTarget.value)}
                    style={textareaStyle}
                  />
                </FormField>

                <FormField label="Notes">
                  <textarea
                    value={formState.notes ?? ""}
                    onChange={(event) => setField("notes", event.currentTarget.value)}
                    style={textareaStyle}
                  />
                </FormField>

                <div style={{ display: "grid", gap: 8 }}>
                  <div className="admin-setting-label">Orientation applicability</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PROFILE_ORIENTATION_OPTIONS.map((value) => (
                      <CheckboxPill
                        key={value}
                        label={value}
                        checked={(formState.orientation_applicability ?? []).includes(value)}
                        onToggle={() => toggleArrayField("orientation_applicability", value)}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div className="admin-setting-label">Operation applicability</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {OPERATION_OPTIONS.map((value) => (
                      <CheckboxPill
                        key={value}
                        label={value}
                        checked={(formState.operation_applicability ?? []).includes(value)}
                        onToggle={() => toggleArrayField("operation_applicability", value)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {activeSubTab === "profileMappings" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <FormField label="Manufacturer">
                  <select
                    value={formState.manufacturer_id ?? ""}
                    onChange={(event) => setField("manufacturer_id", event.currentTarget.value || null)}
                    style={inputStyle}
                  >
                    <option value="">Any manufacturer</option>
                    {bootstrap.manufacturers.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Product">
                  <select
                    value={formState.product_id ?? ""}
                    onChange={(event) => setField("product_id", event.currentTarget.value || null)}
                    style={inputStyle}
                  >
                    <option value="">Any product</option>
                    {filteredProducts.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Window type">
                  <select
                    value={formState.window_type_id ?? ""}
                    onChange={(event) => setField("window_type_id", event.currentTarget.value || null)}
                    style={inputStyle}
                  >
                    <option value="">Any window type</option>
                    {filteredWindowTypes.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Profile">
                  <select
                    value={formState.profile_id ?? ""}
                    onChange={(event) => setField("profile_id", event.currentTarget.value)}
                    style={inputStyle}
                  >
                    <option value="">Select profile</option>
                    {bootstrap.sectionProfiles.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Mapping key">
                  <select
                    value={formState.mapping_key ?? "frame_head"}
                    onChange={(event) => setField("mapping_key", event.currentTarget.value)}
                    style={inputStyle}
                  >
                    {MAPPING_KEY_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Operation type">
                  <select
                    value={formState.operation_type ?? "fixed"}
                    onChange={(event) => setField("operation_type", event.currentTarget.value)}
                    style={inputStyle}
                  >
                    <option value="">Any operation</option>
                    {OPERATION_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Notes">
                  <textarea
                    value={formState.notes ?? ""}
                    onChange={(event) => setField("notes", event.currentTarget.value)}
                    style={textareaStyle}
                  />
                </FormField>
              </div>
            ) : null}

            {activeSubTab === "sectionDrawings" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <FormField label="Manufacturer">
                    <select
                      value={formState.manufacturer_id ?? ""}
                      onChange={(event) => setField("manufacturer_id", event.currentTarget.value || null)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      {bootstrap.manufacturers.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Product">
                    <select
                      value={formState.product_id ?? ""}
                      onChange={(event) => setField("product_id", event.currentTarget.value || null)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      {filteredProducts.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Window type">
                    <select
                      value={formState.window_type_id ?? ""}
                      onChange={(event) => setField("window_type_id", event.currentTarget.value || null)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      {filteredWindowTypes.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Title">
                    <input
                      value={formState.title ?? ""}
                      onChange={(event) => setField("title", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Code">
                    <input
                      value={formState.code ?? ""}
                      onChange={(event) => setField("code", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Represents">
                    <input
                      value={formState.represents ?? ""}
                      onChange={(event) => setField("represents", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Orientation">
                    <select
                      value={formState.orientation ?? "head"}
                      onChange={(event) => setField("orientation", event.currentTarget.value)}
                      style={inputStyle}
                    >
                      {["head", "jamb_left", "jamb_right", "bottom", "mullion", "transom", "coupling", "corner"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Inside / outside applicability">
                    <select
                      value={formState.inside_outside_applicability ?? "both"}
                      onChange={(event) =>
                        setField("inside_outside_applicability", event.currentTarget.value)
                      }
                      style={inputStyle}
                    >
                      <option value="inside">Inside</option>
                      <option value="outside">Outside</option>
                      <option value="both">Both</option>
                    </select>
                  </FormField>
                  <FormField label="Drawing purpose">
                    <select
                      value={formState.drawing_purpose ?? "elevation_reference"}
                      onChange={(event) => setField("drawing_purpose", event.currentTarget.value)}
                      style={inputStyle}
                    >
                      <option value="elevation_reference">Elevation reference</option>
                      <option value="section_reference">Section reference</option>
                    </select>
                  </FormField>
                  <FormField label="Section ref ID">
                    <input
                      value={formState.section_ref_id ?? ""}
                      onChange={(event) => setField("section_ref_id", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Profile ref ID">
                    <input
                      value={formState.profile_ref_id ?? ""}
                      onChange={(event) => setField("profile_ref_id", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Source DXF path">
                    <input
                      value={formState.source_dxf_path ?? ""}
                      onChange={(event) => setField("source_dxf_path", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Source SVG path">
                    <input
                      value={formState.source_svg_path ?? ""}
                      onChange={(event) => setField("source_svg_path", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </FormField>
                </div>

                <FormField label="Geometry rules JSON">
                  <textarea
                    value={jsonDrafts.geometry_rules ?? "{}"}
                    onChange={(event) =>
                      setJsonDrafts((previous) => ({
                        ...previous,
                        geometry_rules: event.currentTarget.value,
                      }))
                    }
                    style={textareaStyle}
                  />
                </FormField>
                <FormField label="Render behaviour JSON">
                  <textarea
                    value={jsonDrafts.render_behaviour ?? "{}"}
                    onChange={(event) =>
                      setJsonDrafts((previous) => ({
                        ...previous,
                        render_behaviour: event.currentTarget.value,
                      }))
                    }
                    style={textareaStyle}
                  />
                </FormField>
                <FormField label="Notes">
                  <textarea
                    value={formState.notes ?? ""}
                    onChange={(event) => setField("notes", event.currentTarget.value)}
                    style={textareaStyle}
                  />
                </FormField>
              </>
            ) : null}

            <label className="admin-flex-row" style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
              <input
                type="checkbox"
                checked={!!formState.is_active}
                onChange={(event) => setField("is_active", event.currentTarget.checked)}
              />
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
          </>
        ) : null}
      </div>
    </div>
  );
}
