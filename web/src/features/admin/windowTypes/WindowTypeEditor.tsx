import React, { useCallback, useEffect, useMemo, useState } from "react";
import QuoteSyncDrawingSvg from "../../configurator/rendering/QuoteSyncDrawingSvg";
import { buildB92FixedInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92ContractDrawingAdapter";
import { b92FixedInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedInternalWindowTypeSource.seed";
import { buildB92FixedSashInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92FixedSashInternalDrawingAdapter";
import { b92FixedSashInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedSashInternalWindowTypeSource.seed";
import { buildB92TiltTurnInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92TiltTurnInternalDrawingAdapter";
import { buildWindowTypeRenderModelFromSource } from "../../configurator/rendering/profileResolution/adminWindowTypeSourceAdapter";
import {
  buildWindowTypeSourceModelFromCatalog,
  compareCatalogSourceModelToB92FixedSeed,
  type CatalogSourceModelComparisonDifference,
} from "../../configurator/rendering/profileResolution/catalogWindowTypeSourceAdapter";
import type { ConfiguratorCatalogBootstrap } from "../configuratorCatalog.types";
import type {
  WindowTypeSourceModel,
  WindowTypeSourceModelFieldOperation,
  WindowTypeSourceModelFieldRule,
  WindowTypeSourceModelOperationType,
} from "./windowTypeSourceModel.types";
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
  sourceLabel: "Catalog" | "Seed fallback" | "";
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

type RuntimeDimensionsMm = {
  widthMm: number;
  heightMm: number;
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

  if (selectedDesign?.id !== "windows-1-inward-opening") {
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
        previewTitle: "Technical Preview — B92 1 Field Inward Opening 1000 x 1000",
        previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
        catalogReport,
      };
    }

    return {
      sourceModel,
      sourceLabel: "Catalog",
      previewTitle: "Technical Preview — B92 1 Field Inward Opening 1000 x 1000",
      previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
      catalogReport,
    };
  } catch (error) {
    return {
      sourceModel: b92FixedInternalWindowTypeSourceSeed,
      sourceLabel: "Seed fallback",
      previewTitle: "Technical Preview — B92 1 Field Inward Opening 1000 x 1000",
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

function cloneSourceModel(source: WindowTypeSourceModel): WindowTypeSourceModel {
  return JSON.parse(JSON.stringify(source)) as WindowTypeSourceModel;
}

function operationTypeForOperation(operation: WindowTypeSourceModelFieldOperation): WindowTypeSourceModelOperationType {
  if (operation === "fixed") return "fixed";
  if (operation === "fixed_sash") return "fixed_sash";
  if (operation === "turn_left" || operation === "turn_right") return "turn_only";
  return "tilt_turn";
}

function templateFieldRuleForOperation(operation: WindowTypeSourceModelFieldOperation): WindowTypeSourceModelFieldRule {
  const template =
    operation === "fixed"
      ? b92FixedInternalWindowTypeSourceSeed.fieldRules[0]
      : b92FixedSashInternalWindowTypeSourceSeed.fieldRules[0];
  return JSON.parse(JSON.stringify(template)) as WindowTypeSourceModelFieldRule;
}

function updateSourceFieldOperation(input: {
  source: WindowTypeSourceModel;
  field: FieldOperationContextMenuField;
  operation: WindowTypeSourceModelFieldOperation;
}): WindowTypeSourceModel {
  const { source, field, operation } = input;
  const next = cloneSourceModel(source);
  const operationType = operationTypeForOperation(operation);
  let updated = false;

  next.fieldRules = next.fieldRules.map((fieldRule) => {
    if (fieldRule.fieldSelector.row !== field.row || fieldRule.fieldSelector.column !== field.column) return fieldRule;
    updated = true;
    const template = templateFieldRuleForOperation(operation);
    return {
      ...template,
      fieldSelector: {
        ...template.fieldSelector,
        row: field.row,
        column: field.column,
        fieldKey: field.key,
      },
      operationType,
      operation,
    };
  });

  if (!updated && next.layout.columns === 1 && next.layout.rows === 1 && next.fieldRules.length === 0) {
    const template = templateFieldRuleForOperation(operation);
    next.fieldRules = [
      {
        ...template,
        fieldSelector: {
          ...template.fieldSelector,
          row: 0,
          column: 0,
          fieldKey: "0,0",
        },
        operationType,
        operation,
      },
    ];
  }

  return next;
}

function resolvedProfile(profileId: "B92-1" | "B92-2" | "B92-3" | "B92-7" | "B92-8" | "B92-9" | "B92-10") {
  return {
    profileId,
    source: "resolved" as const,
  };
}

function buildB92TiltTurnPreviewContractFromSource(
  source: WindowTypeSourceModel,
  dimensions: RuntimeDimensionsMm
) {
  const fieldRule = source.fieldRules[0];
  if (
    !fieldRule ||
    (fieldRule.operation !== "tt_left" &&
      fieldRule.operation !== "tt_right" &&
      fieldRule.operation !== "turn_left" &&
      fieldRule.operation !== "turn_right" &&
      fieldRule.operation !== "tilt_only")
  ) {
    throw new Error("Tilt & Turn preview requires tt_left, tt_right, turn_left, turn_right, or tilt_only field operation.");
  }
  const operation = fieldRule.operation;
  const hingeSide = operation === "tt_right" || operation === "turn_right" ? "right" : operation === "tilt_only" ? null : "left";
  const handleSide = operation === "tt_right" || operation === "turn_right" ? "left" : operation === "tilt_only" ? null : "right";

  return {
    meta: {
      system: "B92" as const,
      referenceView: "external" as const,
      validationMode: "external_refs_internal_validation" as const,
      source: "resolver_contract" as const,
      designRule: "Admin Window Type preview supplies B92 Tilt & Turn operation from fieldRule.operation.",
    },
    overall: {
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
    },
    fields: [
      {
        id: fieldRule.fieldSelector.fieldKey ?? "0,0",
        row: fieldRule.fieldSelector.row,
        column: fieldRule.fieldSelector.column,
        type: "tilt_turn" as const,
        operation,
        dimensionsMm: {
          width: dimensions.widthMm,
          height: dimensions.heightMm,
        },
        perimeter: {
          top: resolvedProfile("B92-1"),
          left: resolvedProfile("B92-2"),
          right: resolvedProfile("B92-2"),
          bottom: resolvedProfile("B92-3"),
        },
        sash: {
          openingType: "tilt_turn" as const,
          operation,
          hingeSide,
          handleSide,
          profiles: {
            top: resolvedProfile("B92-7"),
            left: resolvedProfile("B92-9"),
            right: resolvedProfile("B92-10"),
            bottom: resolvedProfile("B92-8"),
          },
          geometry: {
            visibleFaceMm: fieldRule.geometryRules.sashGeometryRules?.visibleFaceMm,
            insetMm: fieldRule.geometryRules.sashGeometryRules?.insetMm,
            overlapMm: fieldRule.geometryRules.sashGeometryRules?.overlapMm,
            beadVisibleFaceMm: fieldRule.geometryRules.beadGeometryRules?.visibleFaceMm,
            glassOrderRule: fieldRule.geometryRules.glassOrderRule,
          },
        },
      },
    ],
    verticalJunctions: [],
    horizontalJunctions: [],
    couplings: [],
    corners: [],
    thresholds: [],
    constraints: [],
  };
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
  const [editableSourceModel, setEditableSourceModel] = useState<WindowTypeSourceModel | null>(() =>
    sourceModel ? cloneSourceModel(sourceModel) : null
  );
  const selectedDesignId = selectedDesign?.id ?? "";

  useEffect(() => {
    setEditableSourceModel(sourceModel ? cloneSourceModel(sourceModel) : null);
    setOperationMenu((current) => ({ ...current, open: false }));
  }, [selectedDesignId]);

  const activeSourceModel = editableSourceModel ?? sourceModel;
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
    (field: { col: number; row: number; key: string }, event: React.MouseEvent<SVGRectElement>) => {
      setOperationMenu({
        open: true,
        x: event.clientX,
        y: event.clientY,
        field: {
          row: field.row,
          column: field.col,
          key: field.key,
        },
      });
    },
    []
  );
  const previewResult = useMemo(() => {
    if (!activeSourceModel) {
      return {
        model: null,
        error: "",
      };
    }
    try {
      const dimensions = { widthMm: 1000, heightMm: 1000 };
      const operation = activeSourceModel.fieldRules[0]?.operation ?? activeSourceModel.fieldRules[0]?.operationType;
      if (
        operation === "tt_left" ||
        operation === "tt_right" ||
        operation === "turn_left" ||
        operation === "turn_right" ||
        operation === "tilt_only"
      ) {
        const tiltTurnContract = buildB92TiltTurnPreviewContractFromSource(activeSourceModel, dimensions);
        return {
          model: buildB92TiltTurnInternalDrawingModelFromContract(tiltTurnContract),
          error: "",
        };
      }

      const contract = buildWindowTypeRenderModelFromSource(activeSourceModel, dimensions);
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
  }, [activeSourceModel]);

  return (
    <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div>
        <div className="admin-group-title">
          {previewTitle}
        </div>
        {previewDescription ? <div className="admin-body-copy">{previewDescription}</div> : null}
      </div>
      {!activeSourceModel ? (
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
      {activeSourceModel && !catalogReport.attempted ? (
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
          if (!operationMenu.field) return;
          setEditableSourceModel((current) => {
            if (!current) return current;
            return updateSourceFieldOperation({
              source: current,
              field: operationMenu.field,
              operation,
            });
          });
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
