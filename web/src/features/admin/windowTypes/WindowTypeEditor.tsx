import React, { useCallback, useMemo, useState } from "react";
import QuoteSyncDrawingSvg from "../../configurator/rendering/QuoteSyncDrawingSvg";
import { buildB92FixedInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92ContractDrawingAdapter";
import { b92FixedInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedInternalWindowTypeSource.seed";
import { buildB92FixedSashInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92FixedSashInternalDrawingAdapter";
import { b92FixedSashInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedSashInternalWindowTypeSource.seed";
import { buildWindowTypeRenderModelFromSource } from "../../configurator/rendering/profileResolution/adminWindowTypeSourceAdapter";
import {
  buildWindowTypeSourceModelFromCatalog,
  compareCatalogSourceModelToB92FixedSeed,
  type CatalogSourceModelComparisonDifference,
} from "../../configurator/rendering/profileResolution/catalogWindowTypeSourceAdapter";
import type { ConfiguratorCatalogBootstrap } from "../configuratorCatalog.types";
import type { WindowTypeSourceModel } from "./windowTypeSourceModel.types";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";
import DivisionJunctionPanel from "./DivisionJunctionPanel";
import FieldOperationContextMenu, { type FieldOperationContextMenuField } from "./FieldOperationContextMenu";
import FieldDefinitionPanel from "./FieldDefinitionPanel";
import { getFieldOperationOptionsForContext, resolveFieldOperationMenuContext } from "./fieldOperationOptions";
import SectionMappingPanel from "./SectionMappingPanel";

type Props = {
  categoryLabel: string;
  fieldCountLabel: string;
  selectedDesign: WindowTypeDesignListItem | null;
  bootstrap: ConfiguratorCatalogBootstrap;
};

type CatalogBridgePreviewReport = {
  attempted: boolean;
  buildSuccess: boolean;
  comparisonPass: boolean | null;
  differences: CatalogSourceModelComparisonDifference[];
  error: string;
};

type PreviewSourceResult = {
  sourceModel: WindowTypeSourceModel | null;
  sourceLabel: "Catalog" | "Seed fallback" | "Fixed Sash (catalog-validated)" | "";
  previewTitle: string;
  previewDescription: string;
  catalogReport: CatalogBridgePreviewReport;
};

type FieldOperationMenuState = {
  open: boolean;
  x: number;
  y: number;
  field: FieldOperationContextMenuField | null;
};

function resolvePreviewSourceModel(
  selectedDesign: WindowTypeDesignListItem | null,
  bootstrap: ConfiguratorCatalogBootstrap
): PreviewSourceResult {
  const skippedReport = {
    attempted: false,
    buildSuccess: false,
    comparisonPass: null,
    differences: [],
    error: "",
  };

  if (selectedDesign?.id === "windows-1-fixed-sash") {
    return {
      sourceModel: b92FixedSashInternalWindowTypeSourceSeed,
      sourceLabel: "Fixed Sash (catalog-validated)",
      previewTitle: "Technical Preview — B92 Fixed Sash Internal 1000 x 1000",
      previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed sash, no opening hardware, no multi-field.",
      catalogReport: skippedReport,
    };
  }

  if (selectedDesign?.id !== "windows-1-fixed") {
    return {
      sourceModel: null,
      sourceLabel: "",
      previewTitle: "Technical Preview",
      previewDescription: "",
      catalogReport: skippedReport,
    };
  }

  try {
    const product = bootstrap.products.find((record) => record.code === "B92" && record.is_active !== false) ?? null;
    if (!product) throw new Error("B92 product was not found in catalog bootstrap.");
    const manufacturer = bootstrap.manufacturers.find((record) => record.id === product.manufacturer_id) ?? null;
    const windowType =
      bootstrap.windowTypes.find(
        (record) =>
          record.product_id === product.id &&
          record.code === "B92-FIXED-INTERNAL-1X1" &&
          record.operation_type === "fixed" &&
          record.view_logic === "inside" &&
          record.layout_columns === 1 &&
          record.layout_rows === 1 &&
          record.is_active !== false
      ) ?? null;
    if (!windowType) throw new Error("B92 fixed internal 1x1 window type was not found in catalog bootstrap.");
    const renderProfile =
      bootstrap.renderProfiles.find(
        (record) =>
          record.product_id === product.id &&
          record.window_type_id === windowType.id &&
          record.code === "B92-FIXED-INTERNAL" &&
          record.operation_type === "fixed" &&
          record.view_logic === "inside" &&
          record.is_active !== false
      ) ?? null;
    if (!renderProfile) throw new Error("B92 fixed internal render profile was not found in catalog bootstrap.");

    const sectionProfiles = bootstrap.sectionProfiles.filter(
      (record) => ["B92-1", "B92-2", "B92-3", "B92-6"].includes(record.code) && record.is_active !== false
    );
    const profileMappings = bootstrap.profileMappings.filter(
      (record) =>
        record.product_id === product.id &&
        record.window_type_id === windowType.id &&
        record.operation_type === "fixed" &&
        record.is_active !== false
    );
    const sectionDrawings = bootstrap.sectionDrawings.filter(
      (record) =>
        record.product_id === product.id &&
        record.window_type_id === windowType.id &&
        record.code === "B92-FIXED-INTERNAL-GLASS-ORDER" &&
        record.is_active !== false
    );

    const sourceModel = buildWindowTypeSourceModelFromCatalog({
      manufacturer,
      product,
      windowType,
      renderProfile,
      sectionProfiles,
      profileMappings,
      sectionDrawings,
      layout: { columns: windowType.layout_columns ?? 0, rows: windowType.layout_rows ?? 0 },
      view: "inside",
    });
    const comparison = compareCatalogSourceModelToB92FixedSeed(sourceModel);
    const catalogReport = {
      attempted: true,
      buildSuccess: true,
      comparisonPass: comparison.pass,
      differences: comparison.differences,
      error: "",
    };
    if (!comparison.pass) {
      return {
        sourceModel: b92FixedInternalWindowTypeSourceSeed,
        sourceLabel: "Seed fallback",
        previewTitle: "Technical Preview — B92 Fixed Internal 1000 x 1000",
        previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
        catalogReport,
      };
    }

    return {
      sourceModel,
      sourceLabel: "Catalog",
      previewTitle: "Technical Preview — B92 Fixed Internal 1000 x 1000",
      previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
      catalogReport,
    };
  } catch (error) {
    return {
      sourceModel: b92FixedInternalWindowTypeSourceSeed,
      sourceLabel: "Seed fallback",
      previewTitle: "Technical Preview — B92 Fixed Internal 1000 x 1000",
      previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
      catalogReport: {
        attempted: true,
        buildSuccess: false,
        comparisonPass: false,
        differences: [],
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function formatReportValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function WindowTypeTechnicalPreview(props: {
  categoryLabel: string;
  selectedDesign: WindowTypeDesignListItem | null;
  bootstrap: ConfiguratorCatalogBootstrap;
}) {
  const { categoryLabel, selectedDesign, bootstrap } = props;
  const [operationMenu, setOperationMenu] = useState<FieldOperationMenuState>({
    open: false,
    x: 0,
    y: 0,
    field: null,
  });
  const previewSource = useMemo(
    () => resolvePreviewSourceModel(selectedDesign, bootstrap),
    [selectedDesign, bootstrap]
  );
  const { sourceModel, sourceLabel, previewTitle, previewDescription, catalogReport } = previewSource;
  const operationMenuContext = useMemo(
    () => resolveFieldOperationMenuContext({ categoryLabel, selectedDesign }),
    [categoryLabel, selectedDesign]
  );
  const availableOperations = useMemo(
    () => getFieldOperationOptionsForContext(operationMenuContext),
    [operationMenuContext]
  );
  const closeOperationMenu = useCallback(() => {
    setOperationMenu((current) => ({ ...current, open: false }));
  }, []);
  const handleCellContextMenu = useCallback(
    (field: FieldOperationContextMenuField, event: React.MouseEvent<SVGRectElement>) => {
      setOperationMenu({
        open: true,
        x: event.clientX,
        y: event.clientY,
        field,
      });
    },
    []
  );
  const previewResult = useMemo(() => {
    if (!sourceModel) {
      return {
        model: null,
        error: "",
      };
    }
    try {
      const contract = buildWindowTypeRenderModelFromSource(sourceModel, {
        widthMm: 1000,
        heightMm: 1000,
      });
      const fieldType = contract.fields[0]?.type;
      return {
        model:
          fieldType === "fixed_sash"
            ? buildB92FixedSashInternalDrawingModelFromContract(contract)
            : buildB92FixedInternalDrawingModelFromContract(contract),
        error: "",
      };
    } catch (error) {
      return {
        model: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [sourceModel]);

  return (
    <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div>
        <div className="admin-group-title">
          {previewTitle}
        </div>
        {previewDescription ? <div className="admin-body-copy">{previewDescription}</div> : null}
      </div>
      {!sourceModel ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview not available for this design yet.
        </div>
      ) : previewResult.error ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview unavailable: {previewResult.error}
        </div>
      ) : previewResult.model ? (
        <div
          style={{
            border: "1px solid #e4e4e7",
            background: "#fff",
            minHeight: 260,
            aspectRatio: "1 / 1",
            display: "grid",
            alignItems: "stretch",
          }}
        >
          <QuoteSyncDrawingSvg model={previewResult.model} onCellContextMenu={handleCellContextMenu} />
        </div>
      ) : null}
      {sourceModel && !catalogReport.attempted ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview source: {sourceLabel}
        </div>
      ) : null}
      {catalogReport.attempted ? (
        <div className="admin-placeholder-box" style={{ margin: 0, display: "grid", gap: 4 }}>
          <div>Preview source: {sourceLabel}</div>
          <div>Catalog bridge: {catalogReport.buildSuccess ? "PASS" : "FAIL"}</div>
          <div>Comparison: {catalogReport.comparisonPass ? "PASS" : "FAIL"}</div>
          {catalogReport.error ? <div>Error: {catalogReport.error}</div> : null}
          {catalogReport.differences.length === 0 ? (
            <div>Differences: none</div>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              <div>Differences:</div>
              {catalogReport.differences.map((difference) => (
                <div key={difference.key}>
                  {difference.key}: expected {formatReportValue(difference.expected)}, actual {formatReportValue(difference.actual)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <FieldOperationContextMenu
        open={operationMenu.open}
        x={operationMenu.x}
        y={operationMenu.y}
        field={operationMenu.field}
        availableOperations={availableOperations}
        onSelectOperation={(operation) => {
          console.log("Selected operation:", operation, operationMenu.field);
        }}
        onClose={closeOperationMenu}
      />
    </div>
  );
}

export default function WindowTypeEditor(props: Props) {
  const { categoryLabel, fieldCountLabel, selectedDesign, bootstrap } = props;

  return (
    <div style={{ display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}>
      <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 8 }}>
        <div className="admin-group-title">Window Type editor</div>
        <div className="admin-body-copy">
          {categoryLabel} → {fieldCountLabel}
          {selectedDesign ? ` → ${selectedDesign.label}` : ""}
        </div>
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Scaffold only. Source-model panels are mounted here, but no Window Type persistence or migration is wired in this pass.
        </div>
      </div>
      <WindowTypeTechnicalPreview categoryLabel={categoryLabel} selectedDesign={selectedDesign} bootstrap={bootstrap} />
      <FieldDefinitionPanel selectedDesign={selectedDesign} />
      <DivisionJunctionPanel selectedDesign={selectedDesign} />
      <SectionMappingPanel selectedDesign={selectedDesign} />
    </div>
  );
}
