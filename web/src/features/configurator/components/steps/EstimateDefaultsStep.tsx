import React from "react";
import { Button, Input, Small, labelStyle } from "../../../estimatePicker/tabs/shared";
import { useEstimateWorkflow } from "../../../estimateWorkflow/useEstimateWorkflow";
import { getConfiguratorCatalogBootstrap } from "../../../admin/configuratorCatalogService";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorColourRecord,
  ConfiguratorHardwareRecord,
} from "../../../admin/configuratorCatalog.types";
import type { ConfiguratorEstimateDefaultsSectionId } from "../../../estimateWorkflow/workflow.types";

const EMPTY_BOOTSTRAP: ConfiguratorCatalogBootstrap = {
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

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid #e4e4e7",
  background: "#fafafa",
  padding: 12,
  display: "grid",
  gap: 12,
};

function colourSwatch(colour: string | null | undefined) {
  const normalized = String(colour || "").toLowerCase();
  if (normalized.includes("anthracite")) return "#4b5563";
  if (normalized.includes("black")) return "#18181b";
  if (normalized.includes("cream")) return "#f5e9c9";
  if (normalized.includes("green")) return "#7d9b76";
  if (normalized.includes("silver")) return "#9ca3af";
  if (normalized.includes("blue")) return "#93c5fd";
  return "#f4f4f5";
}

function metadataIncludes(record: { metadata?: Record<string, unknown> } | null | undefined, key: string) {
  const value = record?.metadata?.[key];
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

export default function EstimateDefaultsStep() {
  const { draft, updateDraftSection } = useEstimateWorkflow();
  const [catalogBootstrap, setCatalogBootstrap] = React.useState<ConfiguratorCatalogBootstrap>(EMPTY_BOOTSTRAP);

  React.useEffect(() => {
    let active = true;
    async function loadCatalog() {
      try {
        const bootstrap = await getConfiguratorCatalogBootstrap();
        if (active) setCatalogBootstrap(bootstrap);
      } catch {
        if (active) setCatalogBootstrap(EMPTY_BOOTSTRAP);
      }
    }
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  if (!draft) return null;

  const snapshot = draft.estimateDefaults.defaultsSnapshot ?? {};
  const sectionOrder = draft.estimateDefaults.sectionOrder ?? [
    "supplierProduct",
    "timberOptions",
    "hardwareHandles",
  ];
  const selectedManufacturerId =
    String(draft.estimateDefaults.manufacturerId ?? snapshot.manufacturerId ?? "").trim();
  const selectedProductId = String(draft.estimateDefaults.productId ?? snapshot.productId ?? "").trim();
  const selectedWindowTypeId = String(draft.estimateDefaults.windowTypeId ?? snapshot.windowTypeId ?? "").trim();

  const selectedProduct =
    catalogBootstrap.products.find((product) => String(product.id) === selectedProductId) ?? null;
  const selectedWindowType =
    catalogBootstrap.windowTypes.find((windowType) => String(windowType.id) === selectedWindowTypeId) ?? null;

  const filteredProducts = selectedManufacturerId
    ? catalogBootstrap.products.filter((product) => String(product.manufacturer_id) === selectedManufacturerId)
    : catalogBootstrap.products;
  const filteredWindowTypes = selectedProductId
    ? catalogBootstrap.windowTypes.filter((windowType) => String(windowType.product_id) === selectedProductId)
    : catalogBootstrap.windowTypes;
  const filteredColours = catalogBootstrap.colours.filter((colour) => {
    if (selectedProductId && colour.product_id && String(colour.product_id) !== selectedProductId) return false;
    if (selectedManufacturerId && colour.manufacturer_id && String(colour.manufacturer_id) !== selectedManufacturerId) return false;
    return colour.is_active !== false;
  });
  const filteredHardware = catalogBootstrap.hardware.filter((item) => {
    if (selectedProductId && item.product_id && String(item.product_id) !== selectedProductId) return false;
    if (selectedManufacturerId && item.manufacturer_id && String(item.manufacturer_id) !== selectedManufacturerId) return false;
    if (selectedWindowTypeId && item.window_type_id && String(item.window_type_id) !== selectedWindowTypeId) return false;
    return item.is_active !== false;
  });
  const filteredGlass = catalogBootstrap.glass.filter((item) => {
    if (selectedProductId && item.product_id && String(item.product_id) !== selectedProductId) return false;
    if (selectedManufacturerId && item.manufacturer_id && String(item.manufacturer_id) !== selectedManufacturerId) return false;
    return item.is_active !== false;
  });
  const filteredTimberMaterials = catalogBootstrap.materials.filter((material) => {
    if (selectedProductId && material.product_id && String(material.product_id) !== selectedProductId) return false;
    if (selectedManufacturerId && material.manufacturer_id && String(material.manufacturer_id) !== selectedManufacturerId) return false;
    const materialType = String(material.material_type || "").toLowerCase();
    return material.is_active !== false && (materialType.includes("timber") || materialType.includes("wood"));
  });

  const isTimberProduct =
    String(selectedProduct?.product_family || "").toLowerCase().includes("timber") ||
    filteredTimberMaterials.length > 0;
  const handleOptions = filteredHardware.filter((item) => String(item.hardware_type || "").toLowerCase().includes("handle"));
  const hingeOptions = filteredHardware.filter((item) => String(item.hardware_type || "").toLowerCase().includes("hinge"));
  const accessoryOptions = filteredHardware.filter((item) => {
    const type = String(item.hardware_type || "").toLowerCase();
    return type.includes("accessory") || type.includes("trickle") || type.includes("vent");
  });
  const hasRelevantHardwareOptions = handleOptions.length > 0 || hingeOptions.length > 0;
  const visibleSections = sectionOrder.filter((section) => {
    if (section === "timberOptions") return isTimberProduct;
    if (section === "hardwareHandles") return hasRelevantHardwareOptions;
    return true;
  });
  const activeSectionId = visibleSections.includes(
    (draft.estimateDefaults.activeSectionId ?? visibleSections[0]) as ConfiguratorEstimateDefaultsSectionId
  )
    ? (draft.estimateDefaults.activeSectionId as ConfiguratorEstimateDefaultsSectionId)
    : visibleSections[0];

  React.useEffect(() => {
    if (draft.estimateDefaults.activeSectionId !== activeSectionId) {
      updateDraftSection("estimateDefaults", { activeSectionId });
    }
  }, [activeSectionId, draft.estimateDefaults.activeSectionId, updateDraftSection]);

  const activeIndex = visibleSections.indexOf(activeSectionId);

  function updateDefaultsSnapshot(patch: Record<string, unknown>) {
    updateDraftSection("estimateDefaults", {
      defaultsSnapshot: {
        ...snapshot,
        ...patch,
      },
      hasUserOverrides: true,
    });
  }

  function goToSection(offset: -1 | 1) {
    const nextSection = visibleSections[activeIndex + offset];
    if (!nextSection) return;
    updateDraftSection("estimateDefaults", { activeSectionId: nextSection });
  }

  function renderColourSelect(
    label: string,
    value: string,
    onChange: (nextValue: string) => void,
    options: ConfiguratorColourRecord[]
  ) {
    const fallbackOptions = options.length > 0 ? options : [];
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>{label}</div>
        <select
          className="ep-shared-input"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {fallbackOptions.length === 0 ? (
            <option value={value || ""}>{value || "No catalogue colours available"}</option>
          ) : (
            fallbackOptions.map((colour) => (
              <option key={colour.id} value={colour.name}>
                {colour.name}
              </option>
            ))
          )}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #d4d4d8", background: colourSwatch(value) }} />
          <Small>{value || "No colour selected"}</Small>
        </div>
      </div>
    );
  }

  function renderHardwareSelect(
    label: string,
    value: string,
    options: ConfiguratorHardwareRecord[],
    onChange: (nextValue: string) => void
  ) {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>{label}</div>
        <select
          className="ep-shared-input"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {options.length === 0 ? (
            <option value={value || ""}>{value || "No catalogue options available"}</option>
          ) : (
            options.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))
          )}
        </select>
      </div>
    );
  }

  function renderActiveSection() {
    if (activeSectionId === "supplierProduct") {
      return (
        <div style={sectionCardStyle}>
          <Small>
            Choose the supplier/manufacturer and product first. The remaining defaults now follow from the catalogue records attached to that system.
          </Small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Supplier / Manufacturer</div>
              <select
                className="ep-shared-input"
                value={selectedManufacturerId}
                onChange={(event) => {
                  const manufacturerId = event.currentTarget.value;
                  const manufacturer =
                    catalogBootstrap.manufacturers.find((row) => String(row.id) === manufacturerId) ?? null;
                  updateDraftSection("estimateDefaults", {
                    manufacturerId,
                    productId: null,
                    windowTypeId: null,
                  });
                  updateDefaultsSnapshot({
                    manufacturerId,
                    manufacturerName: manufacturer?.name ?? "",
                    productId: null,
                    productName: "",
                    windowTypeId: null,
                    windowTypeName: "",
                  });
                }}
              >
                <option value="">Choose supplier</option>
                {catalogBootstrap.manufacturers
                  .filter((row) => row.is_active !== false)
                  .map((manufacturer) => (
                    <option key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Product / System</div>
              <select
                className="ep-shared-input"
                value={selectedProductId}
                onChange={(event) => {
                  const productId = event.currentTarget.value;
                  const product =
                    filteredProducts.find((row) => String(row.id) === productId) ?? null;
                  updateDraftSection("estimateDefaults", {
                    productId,
                    windowTypeId: null,
                  });
                  updateDraftSection("addPosition", {
                    product: product?.name ?? "",
                    productType: product?.product_family ?? "",
                  });
                  updateDefaultsSnapshot({
                    productId,
                    productName: product?.name ?? "",
                    productFamily: product?.product_family ?? "",
                    supplier: product?.name ?? snapshot.supplier ?? "",
                    productType: product?.product_family ?? "",
                    windowTypeId: null,
                    windowTypeName: "",
                  });
                }}
              >
                <option value="">Choose product</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Window / System type</div>
              <select
                className="ep-shared-input"
                value={selectedWindowTypeId}
                onChange={(event) => {
                  const windowTypeId = event.currentTarget.value;
                  const windowType =
                    filteredWindowTypes.find((row) => String(row.id) === windowTypeId) ?? null;
                  updateDraftSection("estimateDefaults", { windowTypeId });
                  updateDefaultsSnapshot({
                    windowTypeId,
                    windowTypeName: windowType?.name ?? "",
                    operationType: windowType?.operation_type ?? "",
                    openingDirection: windowType?.opening_direction ?? "",
                  });
                }}
              >
                <option value="">Choose window type</option>
                {filteredWindowTypes.map((windowType) => (
                  <option key={windowType.id} value={windowType.id}>
                    {windowType.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      );
    }

    if (activeSectionId === "timberOptions") {
      return (
        <div style={sectionCardStyle}>
          <Small>Only shown when the selected system requires timber-specific defaults.</Small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Timber option</div>
              <select
                className="ep-shared-input"
                value={String(snapshot.timberOption ?? "")}
                onChange={(event) => updateDefaultsSnapshot({ timberOption: event.currentTarget.value })}
              >
                <option value="">Choose timber option</option>
                {filteredTimberMaterials.map((material) => (
                  <option key={material.id} value={material.name}>
                    {material.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Timber notes</div>
              <Input
                value={String(snapshot.timberNotes ?? "")}
                onChange={(event) => updateDefaultsSnapshot({ timberNotes: event.currentTarget.value })}
              />
            </div>
          </div>
        </div>
      );
    }

    if (activeSectionId === "finishes") {
      const finishMode = String(snapshot.finishMode || "single");
      const internalColour = String(snapshot.internalColour || filteredColours[0]?.name || "White");
      const externalColour = String(
        snapshot.externalColour || (finishMode === "dual" ? filteredColours[1]?.name ?? internalColour : internalColour)
      );
      return (
        <div style={sectionCardStyle}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant={finishMode === "single" ? "primary" : "secondary"}
              onClick={() => updateDefaultsSnapshot({ finishMode: "single", internalColour, externalColour: internalColour })}
            >
              Single colour
            </Button>
            <Button
              variant={finishMode === "dual" ? "primary" : "secondary"}
              onClick={() => updateDefaultsSnapshot({ finishMode: "dual", internalColour, externalColour })}
            >
              Dual colour
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {renderColourSelect("Internal colour", internalColour, (nextValue) => {
              updateDefaultsSnapshot({
                finishMode,
                internalColour: nextValue,
                externalColour: finishMode === "dual" ? externalColour : nextValue,
              });
            }, filteredColours.filter((colour) => !metadataIncludes(colour, "externalOnly")))}
            {renderColourSelect("External colour", finishMode === "dual" ? externalColour : internalColour, (nextValue) => {
              updateDefaultsSnapshot({ finishMode: "dual", internalColour, externalColour: nextValue });
            }, filteredColours.filter((colour) => !metadataIncludes(colour, "internalOnly")))}
          </div>
          <Small>
            Structure is now ready for systems where the external frame cladding and opening sash cladding can diverge later.
          </Small>
        </div>
      );
    }

    if (activeSectionId === "hardwareHandles") {
      return (
        <div style={sectionCardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {renderHardwareSelect("Handle set", String(snapshot.windowHandleType ?? ""), handleOptions, (nextValue) =>
              updateDefaultsSnapshot({ windowHandleType: nextValue })
            )}
            {renderHardwareSelect("Hinge set", String(snapshot.hingeType ?? ""), hingeOptions, (nextValue) =>
              updateDefaultsSnapshot({ hingeType: nextValue })
            )}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>Hardware notes</div>
            <Input
              value={String(snapshot.hardwareNotes ?? "")}
              onChange={(event) => updateDefaultsSnapshot({ hardwareNotes: event.currentTarget.value })}
            />
          </div>
        </div>
      );
    }

    if (activeSectionId === "glass") {
      return (
        <div style={sectionCardStyle}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>Glass option</div>
            <select
              className="ep-shared-input"
              value={String(snapshot.glassType ?? "")}
              onChange={(event) => updateDefaultsSnapshot({ glassType: event.currentTarget.value })}
            >
              <option value="">Choose glass</option>
              {filteredGlass.map((glass) => (
                <option key={glass.id} value={glass.specification || glass.name}>
                  {glass.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #e4e4e7", background: "#fff", padding: 12, fontSize: 13, color: "#3f3f46" }}>
            {String(snapshot.glassType || "No glass option selected yet.")}
          </div>
        </div>
      );
    }

    return (
      <div style={sectionCardStyle}>
        {accessoryOptions.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>Accessory package</div>
            <select
              className="ep-shared-input"
              value={String(snapshot.accessoryPackage ?? "")}
              onChange={(event) => updateDefaultsSnapshot({ accessoryPackage: event.currentTarget.value })}
            >
              <option value="">Choose accessory set</option>
              {accessoryOptions.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: "#18181b" }}>
          <input
            type="checkbox"
            checked={!!draft.estimateDefaults.suppressSillStep}
            onChange={(event) => updateDraftSection("estimateDefaults", { suppressSillStep: event.currentTarget.checked })}
          />
          <span>Use defaults to suppress the separate sill step unless the user explicitly edits it.</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: "#18181b" }}>
          <input
            type="checkbox"
            checked={!!draft.externalWindowSill.userEdited}
            onChange={(event) => updateDraftSection("externalWindowSill", { userEdited: event.currentTarget.checked })}
          />
          <span>Keep sill/accessory options editable later in the position workflow.</span>
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Small>Estimate defaults now run as a guided sequence for supplier/product, timber where relevant, and hardware where relevant.</Small>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          {visibleSections.map((section, index) => {
            const active = section === activeSectionId;
            return (
              <button
                key={section}
                type="button"
                style={{
                  borderRadius: 12,
                  border: active ? "1px solid #18181b" : "1px solid #e4e4e7",
                  background: active ? "#18181b" : "#fff",
                  color: active ? "#fff" : "#18181b",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                onClick={() => updateDraftSection("estimateDefaults", { activeSectionId: section })}
              >
                {index + 1}. {section === "supplierProduct"
                  ? "Supplier & Product"
                  : section === "timberOptions"
                    ? "Timber"
                    : "Hardware / Handles"}
              </button>
            );
          })}
        </div>
      </div>

      {renderActiveSection()}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={() => goToSection(-1)} disabled={activeIndex <= 0}>
          Previous section
        </Button>
        <Button variant="secondary" onClick={() => goToSection(1)} disabled={activeIndex >= visibleSections.length - 1}>
          Next section
        </Button>
      </div>
    </div>
  );
}
