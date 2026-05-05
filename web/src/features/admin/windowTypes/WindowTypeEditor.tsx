import React, { useMemo } from "react";
import QuoteSyncDrawingSvg from "../../configurator/rendering/QuoteSyncDrawingSvg";
import { buildB92FixedInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92ContractDrawingAdapter";
import { b92FixedInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedInternalWindowTypeSource.seed";
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
import FieldDefinitionPanel from "./FieldDefinitionPanel";
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
  sourceLabel: "Catalog" | "Seed fallback" | "";
  catalogReport: CatalogBridgePreviewReport;
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

  if (selectedDesign?.id !== "windows-1-fixed") {
    return {
      sourceModel: null,
      sourceLabel: "",
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
        catalogReport,
      };
    }

    return {
      sourceModel,
      sourceLabel: "Catalog",
      catalogReport,
    };
  } catch (error) {
    return {
      sourceModel: b92FixedInternalWindowTypeSourceSeed,
      sourceLabel: "Seed fallback",
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

function WindowTypeTechnicalPreview(props: { selectedDesign: WindowTypeDesignListItem | null; bootstrap: ConfiguratorCatalogBootstrap }) {
  const { selectedDesign, bootstrap } = props;
  const previewSource = useMemo(
    () => resolvePreviewSourceModel(selectedDesign, bootstrap),
    [selectedDesign, bootstrap]
  );
  const { sourceModel, sourceLabel, catalogReport } = previewSource;
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
      return {
        model: buildB92FixedInternalDrawingModelFromContract(contract),
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
          {sourceModel ? "Technical Preview — B92 Fixed Internal 1000 x 1000" : "Technical Preview"}
        </div>
        {sourceModel ? (
          <div className="admin-body-copy">
            Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.
          </div>
        ) : null}
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
          <QuoteSyncDrawingSvg model={previewResult.model} />
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
      <WindowTypeTechnicalPreview selectedDesign={selectedDesign} bootstrap={bootstrap} />
      <FieldDefinitionPanel selectedDesign={selectedDesign} />
      <DivisionJunctionPanel selectedDesign={selectedDesign} />
      <SectionMappingPanel selectedDesign={selectedDesign} />
    </div>
  );
}
