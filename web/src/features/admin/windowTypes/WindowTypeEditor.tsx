import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { DrawingModel, DrawingRect, DrawingShape } from "../../configurator/rendering/drawingModel";
import DrawingViewport from "../../configurator/rendering/DrawingViewport";
import type {
  DrawingViewportHandle,
  DrawingViewportState,
} from "../../configurator/rendering/drawingViewport.types";
import { buildB92FixedInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92ContractDrawingAdapter";
import { b92FixedInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedInternalWindowTypeSource.seed";
import { buildB92FixedSashInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92FixedSashInternalDrawingAdapter";
import { b92FixedSashInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedSashInternalWindowTypeSource.seed";
import { B92_PROFILE_RULE_REGISTER } from "../../configurator/rendering/profileResolution/b92ProfileRuleRegister";
import { buildB92TiltTurnInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92TiltTurnInternalDrawingAdapter";
import { buildWindowTypeRenderModelFromSource } from "../../configurator/rendering/profileResolution/adminWindowTypeSourceAdapter";
import {
  buildWindowTypeSourceModelFromCatalog,
  compareCatalogSourceModelToB92FixedSeed,
  type CatalogSourceModelComparisonDifference,
} from "../../configurator/rendering/profileResolution/catalogWindowTypeSourceAdapter";
import type { WindowTypeRenderModel } from "../../configurator/rendering/profileResolution/windowTypeRenderContract";
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
  onRenderToolbarRegistration?: (registration: RenderWorkspaceToolbarRegistration | null) => void;
};

export type RenderWorkspaceToolbarRegistration = {
  state: {
    viewport: DrawingViewportState;
    showDimensions: boolean;
    showProfiles: boolean;
  };
  controls: {
    fit: () => void;
    setOneToOne: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    togglePan: () => void;
    toggleDimensions: () => void;
    toggleProfiles: () => void;
  };
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
  sourceLabel: "Catalog" | "Seed fallback" | "Generated fixed grid" | "";
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

type ProfileReferenceCallout = {
  id: string;
  x: number;
  y: number;
  profileId: string;
  segmentType: string;
  identity: string;
  alternatives: string[];
};

type ProfileReferencePopupState = {
  callout: ProfileReferenceCallout;
  x: number;
  y: number;
} | null;

type MeasurementLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  label: string;
  color?: string;
};

type MeasurementDebugReport = {
  overall: { widthMm: number; heightMm: number };
  fields: Array<{
    id: string;
    row: number;
    column: number;
    widthMm: number;
    heightMm: number;
    bounds: { x: number; y: number; width: number; height: number } | null;
    sashBounds: { x: number; y: number; width: number; height: number } | null;
    glassBounds: { x: number; y: number; width: number; height: number } | null;
  }>;
  verticalJunctions: Array<{ id: string; profileId: string | null; betweenFieldIds: [string, string] }>;
  horizontalJunctions: Array<{ id: string; profileId: string | null; betweenFieldIds: [string, string] }>;
  sillSegments: Array<{ fieldId: string; column: number; profileId: string }>;
};

function supportsGeneratedB92FixedGridPreview(selectedDesign: WindowTypeDesignListItem | null) {
  return (
    !!selectedDesign?.layout &&
    selectedDesign.id.startsWith("windows-") &&
    selectedDesign.id !== "windows-1-timber-inward-opening" &&
    !selectedDesign.id.includes("sash-case") &&
    !selectedDesign.id.includes("outward-opening")
  );
}

function buildGeneratedB92FixedGridSourceModel(selectedDesign: WindowTypeDesignListItem): WindowTypeSourceModel {
  const layout = selectedDesign.layout;
  if (!layout) throw new Error("Generated B92 fixed grid preview requires layout metadata.");
  const templateRule = b92FixedInternalWindowTypeSourceSeed.fieldRules[0];

  return {
    ...cloneSourceModel(b92FixedInternalWindowTypeSourceSeed),
    id: `generated:${selectedDesign.id}`,
    layout: {
      columns: layout.fieldsX,
      rows: layout.fieldsY,
    },
    fieldRules: layout.fields.map((field) => ({
      ...JSON.parse(JSON.stringify(templateRule)) as WindowTypeSourceModelFieldRule,
      fieldSelector: {
        row: field.row,
        column: field.column,
        fieldKey: field.key,
      },
      operationType: "fixed",
      operation: "fixed",
    })),
    constraints: {
      ...b92FixedInternalWindowTypeSourceSeed.constraints,
      allowMultiField: true,
    },
    provenance: {
      ...b92FixedInternalWindowTypeSourceSeed.provenance,
      source: "manual",
      sourceId: selectedDesign.id,
      notes: [
        ...(b92FixedInternalWindowTypeSourceSeed.provenance.notes ?? []),
        "Generated from Admin Window Type design layout for technical preview only.",
      ],
    },
    dev: {
      b92UseSegmentResolver: true,
      b92UseDiagnosticJunctionRegistryCorrections: true,
      b92UseJunctionGeometryVisualPilot: false,
      b92RenderSegmentedSillOverlay: false,
      b92UseSashOverlapGeometry: true,
    },
  };
}

function generatedPreviewDimensionsMm(source: WindowTypeSourceModel): RuntimeDimensionsMm {
  return {
    widthMm: Math.max(1, source.layout.columns) * 1000,
    heightMm: Math.max(1, source.layout.rows) * 1000,
  };
}

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

  if (selectedDesign?.id !== "windows-1-timber-inward-opening") {
    if (supportsGeneratedB92FixedGridPreview(selectedDesign)) {
      const layout = selectedDesign.layout;
      return {
        sourceModel: buildGeneratedB92FixedGridSourceModel(selectedDesign),
        sourceLabel: "Generated fixed grid",
        previewTitle: `Technical Preview — B92 ${layout?.fieldsX ?? 1}x${layout?.fieldsY ?? 1} Fixed Grid ${(layout?.fieldsX ?? 1) * 1000} x ${(layout?.fieldsY ?? 1) * 1000}`,
        previewDescription:
          "Dev-only generated B92 fixed grid source: inside view, fixed operation per field, segment resolver enabled.",
        catalogReport: skippedReport,
      };
    }
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
        sourceModel: withB92PreviewDevFlags(b92FixedInternalWindowTypeSourceSeed),
        sourceLabel: "Seed fallback",
        previewTitle: "Technical Preview — B92 1 Field Inward Opening 1000 x 1000",
        previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
        catalogReport,
      };
    }

    return {
      sourceModel: withB92PreviewDevFlags(sourceModel),
      sourceLabel: "Catalog",
      previewTitle: "Technical Preview — B92 1 Field Inward Opening 1000 x 1000",
      previewDescription: "Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.",
      catalogReport,
    };
  } catch (error) {
    return {
      sourceModel: withB92PreviewDevFlags(b92FixedInternalWindowTypeSourceSeed),
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

function withB92PreviewDevFlags(source: WindowTypeSourceModel): WindowTypeSourceModel {
  return {
    ...cloneSourceModel(source),
    dev: {
      ...source.dev,
      b92UseSashOverlapGeometry: true,
    },
  };
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

  return withGeneratedB92FlyingDivision(next);
}

function isTurnOnlyOperation(operation: string | undefined) {
  return operation === "turn_left" || operation === "turn_right";
}

function isTiltTurnOperation(operation: string | undefined) {
  return operation === "tt_left" || operation === "tt_right";
}

function withGeneratedB92FlyingDivision(source: WindowTypeSourceModel): WindowTypeSourceModel {
  if (source.systemCode !== "B92" || source.view !== "inside" || source.layout.columns !== 2 || source.layout.rows !== 1) {
    return source;
  }

  const left = source.fieldRules.find((rule) => rule.fieldSelector.row === 0 && rule.fieldSelector.column === 0);
  const right = source.fieldRules.find((rule) => rule.fieldSelector.row === 0 && rule.fieldSelector.column === 1);
  const leftOperation = String(left?.operation ?? left?.operationType ?? "");
  const rightOperation = String(right?.operation ?? right?.operationType ?? "");
  const leftKey = left?.fieldSelector.fieldKey ?? "0:0";
  const rightKey = right?.fieldSelector.fieldKey ?? "0:1";
  const ownerFieldKey =
    isTurnOnlyOperation(leftOperation) && isTiltTurnOperation(rightOperation)
      ? leftKey
      : isTiltTurnOperation(leftOperation) && isTurnOnlyOperation(rightOperation)
        ? rightKey
        : null;
  const divisions = (source.dev?.b92SegmentResolverDivisions ?? []).filter(
    (division) => !(division.axis === "vertical" && division.index === 1 && (division.row === undefined || division.row === null || division.row === 0))
  );

  return {
    ...source,
    dev: {
      ...source.dev,
      b92SegmentResolverDivisions: ownerFieldKey
        ? [
            ...divisions,
            {
              axis: "vertical",
              index: 1,
              row: 0,
              type: "flying",
              ownerFieldKey,
            },
          ]
        : divisions,
    },
  };
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

function clampCalloutPosition(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getCellCenter(cell: { x: number; y: number; width: number; height: number }) {
  return {
    x: cell.x + cell.width / 2,
    y: cell.y + cell.height / 2,
  };
}

function getProfileAlternatives(profileId: string, segmentType: string, edge?: "top" | "bottom" | "left" | "right") {
  const current = B92_PROFILE_RULE_REGISTER.profiles[profileId as keyof typeof B92_PROFILE_RULE_REGISTER.profiles];
  if (!current) return [];

  return Object.values(B92_PROFILE_RULE_REGISTER.profiles)
    .filter((profile) => {
      if (profile.id === profileId) return false;
      if (segmentType === "vertical mullion") return profile.kinds.includes("vertical_mullion");
      if (segmentType === "horizontal transom") return profile.kinds.includes("horizontal_transom");
      if (segmentType === "sill" || segmentType === "bottom") return profile.kinds.includes("sill");
      if (segmentType === "top" || segmentType === "left" || segmentType === "right") {
        return profile.kinds.includes("outer_frame") && (!edge || profile.orientations?.includes(edge));
      }
      return false;
    })
    .map((profile) => profile.id);
}

function buildProfileReferenceCallouts(
  contract: WindowTypeRenderModel,
  model: DrawingModel,
  disabledCallouts: Set<string>
): ProfileReferenceCallout[] {
  const cellsByFieldId = new Map(model.interaction.cells.map((cell) => [cell.key, cell]));
  const callouts: ProfileReferenceCallout[] = [];

  function pushCallout(input: Omit<ProfileReferenceCallout, "alternatives"> & { edge?: "top" | "bottom" | "left" | "right" }) {
    if (disabledCallouts.has(input.id)) return;
    callouts.push({
      id: input.id,
      x: clampCalloutPosition(input.x, 18, model.viewBox.width - 18),
      y: clampCalloutPosition(input.y, 18, model.viewBox.height - 18),
      profileId: input.profileId,
      segmentType: input.segmentType,
      identity: input.identity,
      alternatives: getProfileAlternatives(input.profileId, input.segmentType, input.edge),
    });
  }

  const outerEdgeSegments = contract.outerEdgeSegments ?? [];
  if (outerEdgeSegments.length > 0) {
    for (const segment of outerEdgeSegments) {
      const cell = cellsByFieldId.get(segment.fieldId);
      if (!cell || !segment.profile.profileId) continue;
      const center = getCellCenter(cell);
      const id = `outer-${segment.edge}-${segment.segmentIndex}-${segment.fieldId}`;
      if (segment.edge === "top") {
        pushCallout({
          id,
          x: center.x,
          y: cell.y - 24,
          profileId: segment.profile.profileId,
          segmentType: "top",
          identity: `field ${segment.fieldId}, segment ${segment.segmentIndex}`,
          edge: "top",
        });
      } else if (segment.edge === "left") {
        pushCallout({
          id,
          x: cell.x - 24,
          y: center.y,
          profileId: segment.profile.profileId,
          segmentType: "left",
          identity: `field ${segment.fieldId}, segment ${segment.segmentIndex}`,
          edge: "left",
        });
      } else if (segment.edge === "right") {
        pushCallout({
          id,
          x: cell.x + cell.width + 24,
          y: center.y,
          profileId: segment.profile.profileId,
          segmentType: "right",
          identity: `field ${segment.fieldId}, segment ${segment.segmentIndex}`,
          edge: "right",
        });
      } else if (!contract.sillSegments || contract.sillSegments.length === 0) {
        pushCallout({
          id,
          x: center.x,
          y: cell.y + cell.height + 24,
          profileId: segment.profile.profileId,
          segmentType: "bottom",
          identity: `field ${segment.fieldId}, segment ${segment.segmentIndex}`,
          edge: "bottom",
        });
      }
    }
  } else {
    const minRow = Math.min(...contract.fields.map((field) => field.row));
    const maxRow = Math.max(...contract.fields.map((field) => field.row));
    const minColumn = Math.min(...contract.fields.map((field) => field.column));
    const maxColumn = Math.max(...contract.fields.map((field) => field.column));

    for (const field of contract.fields) {
      const cell = cellsByFieldId.get(field.id);
      if (!cell) continue;
      const center = getCellCenter(cell);
      if (field.row === minRow && field.perimeter.top.profileId) {
        pushCallout({
          id: `perimeter-top-${field.id}`,
          x: center.x,
          y: cell.y - 24,
          profileId: field.perimeter.top.profileId,
          segmentType: "top",
          identity: `field ${field.id}`,
          edge: "top",
        });
      }
      if (field.column === minColumn && field.perimeter.left.profileId) {
        pushCallout({
          id: `perimeter-left-${field.id}`,
          x: cell.x - 24,
          y: center.y,
          profileId: field.perimeter.left.profileId,
          segmentType: "left",
          identity: `field ${field.id}`,
          edge: "left",
        });
      }
      if (field.column === maxColumn && field.perimeter.right.profileId) {
        pushCallout({
          id: `perimeter-right-${field.id}`,
          x: cell.x + cell.width + 24,
          y: center.y,
          profileId: field.perimeter.right.profileId,
          segmentType: "right",
          identity: `field ${field.id}`,
          edge: "right",
        });
      }
      if (field.row === maxRow && field.perimeter.bottom.profileId) {
        pushCallout({
          id: `perimeter-bottom-${field.id}`,
          x: center.x,
          y: cell.y + cell.height + 24,
          profileId: field.perimeter.bottom.profileId,
          segmentType: "bottom",
          identity: `field ${field.id}`,
          edge: "bottom",
        });
      }
    }
  }

  for (const segment of contract.sillSegments ?? []) {
    const cell = cellsByFieldId.get(segment.fieldId);
    if (!cell || !segment.profile.profileId) continue;
    pushCallout({
      id: `sill-${segment.segmentIndex}-${segment.fieldId}`,
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height + 24,
      profileId: segment.profile.profileId,
      segmentType: "sill",
      identity: `field ${segment.fieldId}, column ${segment.column}`,
      edge: "bottom",
    });
  }

  for (const junction of contract.verticalJunctions) {
    const leftCell = cellsByFieldId.get(junction.betweenFieldIds[0]);
    const rightCell = cellsByFieldId.get(junction.betweenFieldIds[1]);
    if (!leftCell || !rightCell || !junction.profile.profileId) continue;
    pushCallout({
      id: `vertical-${junction.id}`,
      x: (leftCell.x + leftCell.width + rightCell.x) / 2,
      y: (getCellCenter(leftCell).y + getCellCenter(rightCell).y) / 2,
      profileId: String(junction.profile.profileId),
      segmentType: "vertical mullion",
      identity: junction.betweenFieldIds.join(" / "),
    });
  }

  for (const junction of contract.horizontalJunctions) {
    const topCell = cellsByFieldId.get(junction.betweenFieldIds[0]);
    const bottomCell = cellsByFieldId.get(junction.betweenFieldIds[1]);
    if (!topCell || !bottomCell || !junction.profile.profileId) continue;
    pushCallout({
      id: `horizontal-${junction.id}`,
      x: (getCellCenter(topCell).x + getCellCenter(bottomCell).x) / 2,
      y: (topCell.y + topCell.height + bottomCell.y) / 2,
      profileId: String(junction.profile.profileId),
      segmentType: "horizontal transom",
      identity: junction.betweenFieldIds.join(" / "),
    });
  }

  return callouts;
}

function ProfileReferenceOverlay(props: {
  model: DrawingModel;
  callouts: ProfileReferenceCallout[];
  onOpenCallout: (callout: ProfileReferenceCallout, event: React.MouseEvent<SVGGElement>) => void;
}) {
  const { model, callouts, onOpenCallout } = props;
  return (
    <svg
      viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`}
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden={callouts.length === 0}
    >
      {callouts.map((callout) => (
        <g
          key={callout.id}
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          onClick={(event) => {
            event.stopPropagation();
            onOpenCallout(callout, event);
          }}
        >
          <circle cx={callout.x} cy={callout.y} r={15} fill="#fff7ed" stroke="#c2410c" strokeWidth={1.2} />
          <text x={callout.x} y={callout.y + 3.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#7c2d12">
            {callout.profileId}
          </text>
        </g>
      ))}
    </svg>
  );
}

function isRectShape(shape: DrawingShape): shape is DrawingRect {
  return shape.kind === "rect";
}

function shapeRoleIncludes(fieldId: string, needle: string) {
  return (shape: DrawingShape) => Boolean(shape.role?.includes(fieldId) && shape.role.includes(needle));
}

function findRectShape(shapes: DrawingShape[], predicate: (shape: DrawingShape) => boolean) {
  return shapes.find((shape): shape is DrawingRect => isRectShape(shape) && predicate(shape)) ?? null;
}

function getShapeBounds(shapes: DrawingShape[]) {
  const points = shapes.flatMap((shape) => {
    if (shape.kind === "rect") {
      return [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
      ];
    }
    if (shape.kind === "line") {
      return [
        { x: shape.x1, y: shape.y1 },
        { x: shape.x2, y: shape.y2 },
      ];
    }
    return shape.points;
  });
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function formatMm(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}mm`;
}

function measurementLine(input: MeasurementLine): MeasurementLine {
  return input;
}

function buildMeasurementDebugData(contract: WindowTypeRenderModel, model: DrawingModel) {
  const allShapes = model.elements.flatMap((element) => element.shapes);
  const frameBounds = getShapeBounds(model.geometry.frame);
  const scale = frameBounds && model.width > 0 ? frameBounds.width / model.width : 1;
  const cellsByFieldId = new Map(model.interaction.cells.map((cell) => [cell.key, cell]));
  const lines: MeasurementLine[] = [];

  if (frameBounds) {
    lines.push(
      measurementLine({
        id: "overall-width",
        x1: frameBounds.x,
        y1: frameBounds.y - 38,
        x2: frameBounds.x + frameBounds.width,
        y2: frameBounds.y - 38,
        labelX: frameBounds.x + frameBounds.width / 2,
        labelY: frameBounds.y - 43,
        label: `overall ${formatMm(contract.overall.widthMm)}`,
      }),
      measurementLine({
        id: "overall-height",
        x1: frameBounds.x - 38,
        y1: frameBounds.y,
        x2: frameBounds.x - 38,
        y2: frameBounds.y + frameBounds.height,
        labelX: frameBounds.x - 43,
        labelY: frameBounds.y + frameBounds.height / 2,
        label: `overall ${formatMm(contract.overall.heightMm)}`,
      })
    );
  }

  const topFrame = findRectShape(model.geometry.frame, (shape) => shape.role?.includes("frame_top") === true);
  const leftFrame = findRectShape(model.geometry.frame, (shape) => shape.role?.includes("frame_left") === true);
  const rightFrame = findRectShape(model.geometry.frame, (shape) => shape.role?.includes("frame_right") === true);
  const bottomFrame = findRectShape(model.geometry.frame, (shape) => shape.role?.includes("frame_bottom") === true);

  if (topFrame) {
    lines.push(measurementLine({
      id: "top-frame-depth",
      x1: topFrame.x + topFrame.width * 0.18,
      y1: topFrame.y,
      x2: topFrame.x + topFrame.width * 0.18,
      y2: topFrame.y + topFrame.height,
      labelX: topFrame.x + topFrame.width * 0.18 + 6,
      labelY: topFrame.y + topFrame.height / 2,
      label: `top ${formatMm(topFrame.height / scale)}`,
      color: "#7c3aed",
    }));
  }
  if (leftFrame) {
    lines.push(measurementLine({
      id: "left-frame-depth",
      x1: leftFrame.x,
      y1: leftFrame.y + leftFrame.height * 0.25,
      x2: leftFrame.x + leftFrame.width,
      y2: leftFrame.y + leftFrame.height * 0.25,
      labelX: leftFrame.x + leftFrame.width / 2,
      labelY: leftFrame.y + leftFrame.height * 0.25 - 6,
      label: `left ${formatMm(leftFrame.width / scale)}`,
      color: "#7c3aed",
    }));
  }
  if (rightFrame) {
    lines.push(measurementLine({
      id: "right-frame-depth",
      x1: rightFrame.x,
      y1: rightFrame.y + rightFrame.height * 0.25,
      x2: rightFrame.x + rightFrame.width,
      y2: rightFrame.y + rightFrame.height * 0.25,
      labelX: rightFrame.x + rightFrame.width / 2,
      labelY: rightFrame.y + rightFrame.height * 0.25 - 6,
      label: `right ${formatMm(rightFrame.width / scale)}`,
      color: "#7c3aed",
    }));
  }
  if (bottomFrame) {
    lines.push(measurementLine({
      id: "bottom-frame-depth",
      x1: bottomFrame.x + bottomFrame.width * 0.18,
      y1: bottomFrame.y,
      x2: bottomFrame.x + bottomFrame.width * 0.18,
      y2: bottomFrame.y + bottomFrame.height,
      labelX: bottomFrame.x + bottomFrame.width * 0.18 + 6,
      labelY: bottomFrame.y + bottomFrame.height / 2,
      label: `bottom ${formatMm(bottomFrame.height / scale)}`,
      color: "#7c3aed",
    }));
  }

  const debugReport: MeasurementDebugReport = {
    overall: { widthMm: contract.overall.widthMm, heightMm: contract.overall.heightMm },
    fields: [],
    verticalJunctions: contract.verticalJunctions.map((junction) => ({
      id: junction.id,
      profileId: junction.profile.profileId,
      betweenFieldIds: junction.betweenFieldIds,
    })),
    horizontalJunctions: contract.horizontalJunctions.map((junction) => ({
      id: junction.id,
      profileId: junction.profile.profileId,
      betweenFieldIds: junction.betweenFieldIds,
    })),
    sillSegments: (contract.sillSegments ?? []).map((segment) => ({
      fieldId: segment.fieldId,
      column: segment.column,
      profileId: segment.profile.profileId,
    })),
  };

  for (const field of contract.fields) {
    const cell = cellsByFieldId.get(field.id) ?? null;
    const center = cell ? getCellCenter(cell) : null;
    const sashRect = findRectShape(allShapes, shapeRoleIncludes(field.id, "sash"));
    const glassRect = findRectShape(allShapes, shapeRoleIncludes(field.id, "visible_glass"));
    const beadRect = findRectShape(allShapes, shapeRoleIncludes(field.id, "bead"));

    debugReport.fields.push({
      id: field.id,
      row: field.row,
      column: field.column,
      widthMm: field.dimensionsMm.width,
      heightMm: field.dimensionsMm.height,
      bounds: cell,
      sashBounds: sashRect ? { x: sashRect.x, y: sashRect.y, width: sashRect.width, height: sashRect.height } : null,
      glassBounds: glassRect ? { x: glassRect.x, y: glassRect.y, width: glassRect.width, height: glassRect.height } : null,
    });

    if (cell && center) {
      lines.push(
        measurementLine({
          id: `field-width-${field.id}`,
          x1: cell.x,
          y1: cell.y + cell.height - 12,
          x2: cell.x + cell.width,
          y2: cell.y + cell.height - 12,
          labelX: center.x,
          labelY: cell.y + cell.height - 16,
          label: `field ${field.id} w ${formatMm(field.dimensionsMm.width)}`,
          color: "#0369a1",
        }),
        measurementLine({
          id: `field-height-${field.id}`,
          x1: cell.x + 12,
          y1: cell.y,
          x2: cell.x + 12,
          y2: cell.y + cell.height,
          labelX: cell.x + 18,
          labelY: center.y,
          label: `h ${formatMm(field.dimensionsMm.height)}`,
          color: "#0369a1",
        })
      );
    }

    if (glassRect) {
      lines.push(
        measurementLine({
          id: `glass-width-${field.id}`,
          x1: glassRect.x,
          y1: glassRect.y + glassRect.height / 2,
          x2: glassRect.x + glassRect.width,
          y2: glassRect.y + glassRect.height / 2,
          labelX: glassRect.x + glassRect.width / 2,
          labelY: glassRect.y + glassRect.height / 2 - 5,
          label: `glass ${formatMm(glassRect.width / scale)}`,
          color: "#0f766e",
        }),
        measurementLine({
          id: `glass-height-${field.id}`,
          x1: glassRect.x + glassRect.width - 8,
          y1: glassRect.y,
          x2: glassRect.x + glassRect.width - 8,
          y2: glassRect.y + glassRect.height,
          labelX: glassRect.x + glassRect.width - 12,
          labelY: glassRect.y + glassRect.height / 2,
          label: formatMm(glassRect.height / scale),
          color: "#0f766e",
        })
      );
    }

    if (sashRect) {
      lines.push(measurementLine({
        id: `sash-size-${field.id}`,
        x1: sashRect.x,
        y1: sashRect.y + 10,
        x2: sashRect.x + sashRect.width,
        y2: sashRect.y + 10,
        labelX: sashRect.x + sashRect.width / 2,
        labelY: sashRect.y + 7,
        label: `sash ${formatMm(sashRect.width / scale)} x ${formatMm(sashRect.height / scale)}`,
        color: "#be123c",
      }));
      if (cell) {
        lines.push(measurementLine({
          id: `sash-offset-${field.id}`,
          x1: cell.x,
          y1: cell.y + 24,
          x2: sashRect.x,
          y2: cell.y + 24,
          labelX: (cell.x + sashRect.x) / 2,
          labelY: cell.y + 20,
          label: `sash offset ${formatMm((sashRect.x - cell.x) / scale)}`,
          color: "#be123c",
        }));
      }
    }

    if (beadRect && glassRect) {
      lines.push(measurementLine({
        id: `bead-glass-offset-${field.id}`,
        x1: beadRect.x,
        y1: beadRect.y + 22,
        x2: glassRect.x,
        y2: beadRect.y + 22,
        labelX: (beadRect.x + glassRect.x) / 2,
        labelY: beadRect.y + 18,
        label: `bead/glass ${formatMm((glassRect.x - beadRect.x) / scale)}`,
        color: "#a16207",
      }));
    }
  }

  for (const junction of contract.verticalJunctions) {
    const left = cellsByFieldId.get(junction.betweenFieldIds[0]);
    const right = cellsByFieldId.get(junction.betweenFieldIds[1]);
    if (!left || !right) continue;
    const width = right.x - (left.x + left.width);
    const x = left.x + left.width + width / 2;
    lines.push(measurementLine({
      id: `vertical-junction-${junction.id}`,
      x1: x,
      y1: Math.min(left.y, right.y),
      x2: x,
      y2: Math.max(left.y + left.height, right.y + right.height),
      labelX: x + 5,
      labelY: Math.min(left.y, right.y) + 20,
      label: `${junction.profile.profileId ?? "n/a"} ${formatMm(width / scale)}`,
      color: "#9333ea",
    }));
    if (frameBounds) {
      lines.push(measurementLine({
        id: `vertical-junction-offset-${junction.id}`,
        x1: frameBounds.x,
        y1: Math.min(left.y, right.y) - 16,
        x2: x,
        y2: Math.min(left.y, right.y) - 16,
        labelX: (frameBounds.x + x) / 2,
        labelY: Math.min(left.y, right.y) - 20,
        label: `offset ${formatMm((x - frameBounds.x) / scale)}`,
        color: "#9333ea",
      }));
    }
  }

  for (const junction of contract.horizontalJunctions) {
    const top = cellsByFieldId.get(junction.betweenFieldIds[0]);
    const bottom = cellsByFieldId.get(junction.betweenFieldIds[1]);
    if (!top || !bottom) continue;
    const height = bottom.y - (top.y + top.height);
    const y = top.y + top.height + height / 2;
    lines.push(measurementLine({
      id: `horizontal-junction-${junction.id}`,
      x1: Math.min(top.x, bottom.x),
      y1: y,
      x2: Math.max(top.x + top.width, bottom.x + bottom.width),
      y2: y,
      labelX: Math.min(top.x, bottom.x) + 16,
      labelY: y - 5,
      label: `${junction.profile.profileId ?? "n/a"} ${formatMm(height / scale)}`,
      color: "#9333ea",
    }));
    if (frameBounds) {
      lines.push(measurementLine({
        id: `horizontal-junction-offset-${junction.id}`,
        x1: Math.min(top.x, bottom.x) - 18,
        y1: frameBounds.y,
        x2: Math.min(top.x, bottom.x) - 18,
        y2: y,
        labelX: Math.min(top.x, bottom.x) - 24,
        labelY: (frameBounds.y + y) / 2,
        label: `offset ${formatMm((y - frameBounds.y) / scale)}`,
        color: "#9333ea",
      }));
    }
  }

  for (const segment of contract.sillSegments ?? []) {
    const cell = cellsByFieldId.get(segment.fieldId);
    if (!cell || !bottomFrame) continue;
    lines.push(measurementLine({
      id: `sill-segment-${segment.segmentIndex}-${segment.fieldId}`,
      x1: cell.x,
      y1: bottomFrame.y + bottomFrame.height - 10,
      x2: cell.x + cell.width,
      y2: bottomFrame.y + bottomFrame.height - 10,
      labelX: cell.x + cell.width / 2,
      labelY: bottomFrame.y + bottomFrame.height - 14,
      label: `${segment.profile.profileId} sill ${formatMm(cell.width / scale)} x ${formatMm(bottomFrame.height / scale)}`,
      color: "#c2410c",
    }));
  }

  return { lines, report: debugReport };
}

function MeasurementOverlay(props: { model: DrawingModel; lines: MeasurementLine[] }) {
  const { model, lines } = props;
  return (
    <svg
      viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`}
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden={lines.length === 0}
    >
      {lines.map((line) => (
        <g key={line.id}>
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color ?? "#2563eb"}
            strokeWidth={0.9}
            strokeDasharray="4 3"
          />
          <text
            x={line.labelX}
            y={line.labelY}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={700}
            fill={line.color ?? "#2563eb"}
            paintOrder="stroke"
            stroke="#fff"
            strokeWidth={2.5}
          >
            {line.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function WindowTypeTechnicalPreview(props: {
  categoryLabel: string;
  selectedDesign: WindowTypeDesignListItem | null;
  bootstrap: ConfiguratorCatalogBootstrap;
  onRenderToolbarRegistration?: (registration: RenderWorkspaceToolbarRegistration | null) => void;
}) {
  const { categoryLabel, selectedDesign, bootstrap, onRenderToolbarRegistration } = props;
  const viewportRef = React.useRef<DrawingViewportHandle | null>(null);
  const [viewportState, setViewportState] = useState<DrawingViewportState>({
    scalePreset: "auto",
    tool: "select",
    zoomMultiplier: 1,
  });
  const [operationMenu, setOperationMenu] = useState<FieldOperationMenuState>({
    open: false,
    x: 0,
    y: 0,
    field: null,
  });
  const [showProfileReferences, setShowProfileReferences] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [useDatumFixedNoSashRenderer, setUseDatumFixedNoSashRenderer] = useState(false);
  const [disabledProfileCallouts, setDisabledProfileCallouts] = useState<Set<string>>(() => new Set());
  const [profilePopup, setProfilePopup] = useState<ProfileReferencePopupState>(null);
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
    setProfilePopup(null);
    setDisabledProfileCallouts(new Set());
    setShowMeasurements(false);
    setUseDatumFixedNoSashRenderer(false);
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
      const dimensions = generatedPreviewDimensionsMm(activeSourceModel);
      const contract = buildWindowTypeRenderModelFromSource(activeSourceModel, dimensions);
      const fieldType = contract.fields[0]?.type;
      const operation = activeSourceModel.fieldRules[0]?.operation ?? activeSourceModel.fieldRules[0]?.operationType;
      return {
        model: (() => {
          if (contract.fields.length === 1 && fieldType === "fixed_sash") {
            return buildB92FixedSashInternalDrawingModelFromContract(contract);
          }
          if (
            contract.fields.length === 1 &&
            (operation === "tt_left" ||
              operation === "tt_right" ||
              operation === "turn_left" ||
              operation === "turn_right" ||
              operation === "tilt_only")
          ) {
            const tiltTurnContract = buildB92TiltTurnPreviewContractFromSource(activeSourceModel, dimensions);
            return buildB92TiltTurnInternalDrawingModelFromContract(tiltTurnContract);
          }
          return buildB92FixedInternalDrawingModelFromContract(
            useDatumFixedNoSashRenderer
              ? {
                  ...contract,
                  meta: {
                    ...contract.meta,
                    dev: {
                      ...contract.meta.dev,
                      b92UseDatumFixedNoSashRenderer: true,
                      b92ProjectionFixedNoSashParityDiagnostics: true,
                    },
                  },
                }
              : contract
          );
        })(),
        contract,
        error: "",
      };
    } catch (error) {
      return {
        model: null,
        contract: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [activeSourceModel, useDatumFixedNoSashRenderer]);
  const profileCallouts = useMemo(() => {
    if (!showProfileReferences || !previewResult.model || !previewResult.contract) return [];
    return buildProfileReferenceCallouts(previewResult.contract, previewResult.model, disabledProfileCallouts);
  }, [disabledProfileCallouts, previewResult.contract, previewResult.model, showProfileReferences]);
  const measurementDebug = useMemo(() => {
    if (!showMeasurements || !previewResult.model || !previewResult.contract) return { lines: [], report: null };
    return buildMeasurementDebugData(previewResult.contract, previewResult.model);
  }, [previewResult.contract, previewResult.model, showMeasurements]);

  useEffect(() => {
    if (!showMeasurements || !measurementDebug.report) return;
    console.group("Window Type Preview Measurements");
    console.log(measurementDebug.report);
    console.groupEnd();
  }, [measurementDebug.report, showMeasurements]);

  useEffect(() => {
    if (!onRenderToolbarRegistration || !activeSourceModel || !previewResult.model) return undefined;
    onRenderToolbarRegistration({
      state: {
        viewport: viewportState,
        showDimensions: showMeasurements,
        showProfiles: showProfileReferences,
      },
      controls: {
        fit: () => viewportRef.current?.fitToView(),
        setOneToOne: () => viewportRef.current?.setOneToOne(),
        zoomIn: () => viewportRef.current?.zoomIn(),
        zoomOut: () => viewportRef.current?.zoomOut(),
        togglePan: () => viewportRef.current?.setTool(viewportState.tool === "pan" ? "select" : "pan"),
        toggleDimensions: () => setShowMeasurements((current) => !current),
        toggleProfiles: () => {
          setShowProfileReferences((current) => !current);
          setProfilePopup(null);
        },
      },
    });
    return () => onRenderToolbarRegistration(null);
  }, [
    activeSourceModel,
    onRenderToolbarRegistration,
    previewResult.model,
    showMeasurements,
    showProfileReferences,
    viewportState,
  ]);

  return (
    <div style={{ display: "grid", gap: 4, minWidth: 0, alignContent: "start" }}>
      {activeSourceModel && previewResult.model ? (
        <div
          style={{
            padding: "6px 8px",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            borderRadius: 6,
            background: "#07100d",
            border: "1px solid rgba(34, 197, 94, 0.14)",
            color: "#d8eee4",
          }}
        >
          <div style={{ marginRight: "auto", fontSize: 11, fontWeight: 800, color: "#f8fafc" }}>
            {previewTitle}
          </div>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", fontSize: 11, color: "#d8eee4" }}
          >
            <input
              type="checkbox"
              checked={showProfileReferences}
              onChange={(event) => {
                setShowProfileReferences(event.currentTarget.checked);
                setProfilePopup(null);
              }}
            />
            Show profile references
          </label>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", fontSize: 11, color: "#d8eee4" }}
          >
            <input
              type="checkbox"
              checked={showMeasurements}
              onChange={(event) => {
                setShowMeasurements(event.currentTarget.checked);
              }}
            />
            Show measurements
          </label>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", fontSize: 11, color: "#d8eee4" }}
          >
            <input
              type="checkbox"
              checked={useDatumFixedNoSashRenderer}
              onChange={(event) => {
                setUseDatumFixedNoSashRenderer(event.currentTarget.checked);
              }}
            />
            Use datum fixed no-sash renderer pilot
          </label>
        </div>
      ) : null}
      {!activeSourceModel ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview not available for this design yet.
        </div>
      ) : previewResult.error ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview unavailable: {previewResult.error}
        </div>
      ) : previewResult.model ? (
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              right: 14,
              top: 12,
              zIndex: 2,
              color: "#64748b",
              fontSize: 10.5,
              fontWeight: 650,
              background: "transparent",
              border: 0,
              borderRadius: 0,
              padding: 0,
              pointerEvents: "none",
              maxWidth: 285,
              textAlign: "right",
            }}
          >
            Right click window fields for operation and configuration options.
          </div>
          <DrawingViewport
            ref={viewportRef}
            model={previewResult.model}
            onCellContextMenu={handleCellContextMenu}
            showToolbar={false}
            height={300}
            minHeight={0}
            maxHeight={300}
            maxWidth={640}
            aspectRatio="16 / 9"
            fitPadding={{ x: 12, y: 12 }}
            onViewportStateChange={setViewportState}
            overlay={
              <>
                {showMeasurements ? (
                  <MeasurementOverlay model={previewResult.model} lines={measurementDebug.lines} />
                ) : null}
                {showProfileReferences ? (
                  <ProfileReferenceOverlay
                    model={previewResult.model}
                    callouts={profileCallouts}
                    onOpenCallout={(callout, event) => {
                      setProfilePopup({
                        callout,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                  />
                ) : null}
              </>
            }
          />
        </div>
      ) : null}
      {showProfileReferences && previewResult.model ? (
        <div className="admin-body-copy" style={{ display: "grid", gap: 4 }}>
          <div>
            Profile reference callouts: {profileCallouts.length === 0 ? "none available" : `${profileCallouts.length} shown`}
          </div>
          {disabledProfileCallouts.size > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span>Disabled:</span>
              {Array.from(disabledProfileCallouts).map((calloutId) => (
                <button
                  key={calloutId}
                  type="button"
                  className="admin-nav-button"
                  onClick={() => {
                    setDisabledProfileCallouts((current) => {
                      const next = new Set(current);
                      next.delete(calloutId);
                      return next;
                    });
                  }}
                  style={{ padding: "3px 7px" }}
                >
                  <span className="admin-nav-button-label">Enable {calloutId}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {showMeasurements && previewResult.model ? (
        <div className="admin-body-copy">
          Measurement overlay: {measurementDebug.lines.length === 0 ? "no measurable drawing bounds available" : `${measurementDebug.lines.length} guide lines shown`}
        </div>
      ) : null}
      {profilePopup ? (
        <div
          className="admin-card ui-card"
          style={{
            position: "fixed",
            top: profilePopup.y,
            left: profilePopup.x,
            zIndex: 1001,
            width: 260,
            padding: 10,
            display: "grid",
            gap: 8,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div className="admin-setting-label">{profilePopup.callout.profileId}</div>
            <div className="admin-body-copy">Segment: {profilePopup.callout.segmentType}</div>
            <div className="admin-body-copy">Identity: {profilePopup.callout.identity}</div>
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            <div className="admin-setting-label">Alternatives</div>
            {profilePopup.callout.alternatives.length === 0 ? (
              <div className="admin-body-copy">No alternatives available.</div>
            ) : (
              profilePopup.callout.alternatives.map((profileId) => (
                <div key={profileId} className="admin-body-copy">
                  {profileId}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            className="admin-nav-button"
            onClick={() => {
              setDisabledProfileCallouts((current) => {
                const next = new Set(current);
                next.add(profilePopup.callout.id);
                return next;
              });
              setProfilePopup(null);
            }}
            style={{ justifyContent: "flex-start" }}
          >
            <span className="admin-nav-button-label">Disable this callout</span>
          </button>
          <button
            type="button"
            className="admin-nav-button"
            onClick={() => setProfilePopup(null)}
            style={{ justifyContent: "flex-start" }}
          >
            <span className="admin-nav-button-label">Close</span>
          </button>
        </div>
      ) : null}
      {activeSourceModel && !catalogReport.attempted ? (
        <div style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>
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
  const { categoryLabel, fieldCountLabel, selectedDesign, bootstrap, onRenderToolbarRegistration } = props;

  return (
    <div style={{ display: "grid", gap: 8, alignContent: "start", minWidth: 0 }}>
      <WindowTypeTechnicalPreview
        categoryLabel={categoryLabel}
        selectedDesign={selectedDesign}
        bootstrap={bootstrap}
        onRenderToolbarRegistration={onRenderToolbarRegistration}
      />
      <details className="admin-card ui-card" style={{ padding: 12 }}>
        <summary className="admin-group-title" style={{ cursor: "pointer" }}>
          Source model panels
        </summary>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <div className="admin-body-copy">
            {categoryLabel} &gt; {fieldCountLabel}
            {selectedDesign ? ` > ${selectedDesign.label}` : ""}
          </div>
          <FieldDefinitionPanel selectedDesign={selectedDesign} />
          <DivisionJunctionPanel selectedDesign={selectedDesign} />
          <SectionMappingPanel selectedDesign={selectedDesign} />
        </div>
      </details>
    </div>
  );
}
