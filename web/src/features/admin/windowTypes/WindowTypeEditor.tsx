import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { DrawingDimension, DrawingLine, DrawingModel, DrawingRect, DrawingShape } from "../../configurator/rendering/drawingModel";
import DrawingViewport from "../../configurator/rendering/DrawingViewport";
import { buildAdminPreviewWindowDrawingModel } from "../rendering/adminPreviewRenderAdapter";
import { buildResolvedSectionProfileSetFromRenderProfile } from "../../configurator/rendering/profileSectionMapping";
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
import {
  buildFixedExternalRectanglePilot,
} from "../../configurator/rendering/buildFixedInternalRectanglePilot";
import {
  B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM,
  B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MAX_MM,
  B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MIN_MM,
  buildB92ProfileSectionAssemblyPreviewMeasurementContract,
  buildB92ProfileSectionAssemblyPreviewDrawingModel,
  clampB92ProfileSectionAssemblySplitLeftMm,
  getB92ProfileSectionAssemblyPreviewTitle,
  shouldRenderB92ProfileSectionAssemblyPreview,
} from "../../configurator/rendering/profileSectionAssembly/b92FixedFrameProfileSectionAssemblyPreview";
import { buildWindowTypeRenderModelFromSource } from "../../configurator/rendering/profileResolution/adminWindowTypeSourceAdapter";
import {
  buildWindowTypeSourceModelFromCatalog,
  compareCatalogSourceModelToB92FixedSeed,
  type CatalogSourceModelComparisonDifference,
} from "../../configurator/rendering/profileResolution/catalogWindowTypeSourceAdapter";
import type { WindowTypeRenderModel } from "../../configurator/rendering/profileResolution/windowTypeRenderContract";
import type { ConfiguratorCatalogBootstrap, ConfiguratorRenderProfileRecord } from "../configuratorCatalog.types";
import type {
  WindowTypeSourceModel,
  WindowTypeSourceModelFieldOperation,
  WindowTypeSourceModelFieldRule,
  WindowTypeSourceModelOperationType,
} from "./windowTypeSourceModel.types";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";
import B92ProfileSectionAssemblyPreview from "./B92ProfileSectionAssemblyPreview";
import {
  B92_PROFILE_SECTION_PROOF_FAMILIES,
  getB92ProfileSectionProofById,
  getB92ProfileSectionProofForDesignId,
} from "./b92ProfileSectionProofRegistry";
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
  previewView: "internal" | "external";
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
    if (selectedDesign && supportsGeneratedB92FixedGridPreview(selectedDesign)) {
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
      (record) => ["B92-1", "B92-2", "B92-3"].includes(record.code) && record.is_active !== false
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

const ADMIN_EXTERNAL_FRAME_FILL = "#f4f4f5";
const ADMIN_EXTERNAL_CLADDING_FILL = "#e5e7eb";
const ADMIN_EXTERNAL_GLASS_FILL = "#b9d7f3";
const ADMIN_EXTERNAL_STROKE = "#111";

function isSashLikeField(field: WindowTypeRenderModel["fields"][number]) {
  return (
    field.type === "fixed_sash" ||
    field.type === "tilt_turn" ||
    field.type === "turn_only" ||
    field.operation === "fixed_sash" ||
    field.operation === "tt_left" ||
    field.operation === "tt_right" ||
    field.operation === "turn_left" ||
    field.operation === "turn_right" ||
    field.operation === "tilt_only"
  );
}

function isOpeningOperation(operation: string | undefined) {
  return (
    operation === "tt_left" ||
    operation === "tt_right" ||
    operation === "turn_left" ||
    operation === "turn_right" ||
    operation === "tilt_only"
  );
}

function buildExternalOperationLines(
  bounds: { x0: number; x1: number; y0: number; y1: number },
  operation: string | undefined
): DrawingLine[] {
  if (!isOpeningOperation(operation)) return [];
  const dash = (line: Omit<DrawingLine, "kind">): DrawingLine => ({
    kind: "line",
    dashed: true,
    stroke: ADMIN_EXTERNAL_STROKE,
    strokeWidth: 1.1,
    ...line,
  });
  const hingeSide = operation === "tt_right" || operation === "turn_right" ? "right" : "left";
  const externalHingeSide = hingeSide === "left" ? "right" : "left";
  const topCenter = { x: (bounds.x0 + bounds.x1) / 2, y: bounds.y0 };
  const leftCenter = { x: bounds.x0, y: (bounds.y0 + bounds.y1) / 2 };
  const rightCenter = { x: bounds.x1, y: (bounds.y0 + bounds.y1) / 2 };
  if (operation === "tilt_only") {
    return [
      dash({ x1: bounds.x0, y1: bounds.y1, x2: topCenter.x, y2: topCenter.y }),
      dash({ x1: bounds.x1, y1: bounds.y1, x2: topCenter.x, y2: topCenter.y }),
    ];
  }
  if (externalHingeSide === "left") {
    return [
      dash({ x1: bounds.x0, y1: bounds.y0, x2: rightCenter.x, y2: rightCenter.y }),
      dash({ x1: bounds.x0, y1: bounds.y1, x2: rightCenter.x, y2: rightCenter.y }),
      ...(operation === "tt_left" || operation === "tt_right"
        ? [
            dash({ x1: bounds.x0, y1: bounds.y1, x2: topCenter.x, y2: topCenter.y }),
            dash({ x1: topCenter.x, y1: topCenter.y, x2: bounds.x1, y2: bounds.y1 }),
          ]
        : []),
    ];
  }
  return [
    dash({ x1: bounds.x1, y1: bounds.y0, x2: leftCenter.x, y2: leftCenter.y }),
    dash({ x1: bounds.x1, y1: bounds.y1, x2: leftCenter.x, y2: leftCenter.y }),
    ...(operation === "tt_left" || operation === "tt_right"
      ? [
          dash({ x1: bounds.x1, y1: bounds.y1, x2: topCenter.x, y2: topCenter.y }),
          dash({ x1: topCenter.x, y1: topCenter.y, x2: bounds.x0, y2: bounds.y1 }),
        ]
      : []),
  ];
}

function buildAdminExternalDimensionAnnotations(
  frame: { x: number; y: number; width: number; height: number },
  widthMm: number,
  heightMm: number
): DrawingDimension[] {
  return [
    {
      axis: "horizontal",
      value: String(widthMm),
      line: {
        kind: "line",
        x1: frame.x,
        y1: frame.y + frame.height + 26,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + 26,
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line",
        x1: frame.x,
        y1: frame.y + frame.height + 20,
        x2: frame.x,
        y2: frame.y + frame.height + 32,
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line",
        x1: frame.x + frame.width,
        y1: frame.y + frame.height + 20,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + 32,
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 0.9,
      },
      text: {
        x: frame.x + frame.width / 2,
        y: frame.y + frame.height + 44,
        value: String(widthMm),
        fontSize: 12,
        fill: ADMIN_EXTERNAL_STROKE,
        anchor: "middle",
      },
    },
    {
      axis: "vertical",
      value: String(heightMm),
      line: {
        kind: "line",
        x1: frame.x + frame.width + 26,
        y1: frame.y,
        x2: frame.x + frame.width + 26,
        y2: frame.y + frame.height,
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line",
        x1: frame.x + frame.width + 20,
        y1: frame.y,
        x2: frame.x + frame.width + 32,
        y2: frame.y,
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line",
        x1: frame.x + frame.width + 20,
        y1: frame.y + frame.height,
        x2: frame.x + frame.width + 32,
        y2: frame.y + frame.height,
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 0.9,
      },
      text: {
        x: frame.x + frame.width + 46,
        y: frame.y + frame.height / 2,
        value: String(heightMm),
        fontSize: 12,
        fill: ADMIN_EXTERNAL_STROKE,
        anchor: "middle",
        rotate: 90,
      },
    },
  ];
}

function externalJunctionWidthMm(profileId: string | null | undefined) {
  if (profileId === "B92-18") return 131;
  if (profileId === "B92-15" || profileId === "B92-16" || profileId === "B92-17") return 100;
  return 78;
}

function isAllFixedHorizontalExternalContract(contract: WindowTypeRenderModel) {
  const columns = new Set(contract.fields.map((field) => field.column));
  const rows = new Set(contract.fields.map((field) => field.row));
  return (
    contract.fields.length === columns.size &&
    columns.size >= 2 &&
    columns.size <= 4 &&
    rows.size === 1 &&
    contract.fields.every((field) => field.type === "fixed" || field.operation === "fixed") &&
    contract.verticalJunctions.length === columns.size - 1 &&
    contract.verticalJunctions.every((junction) => junction.profile.profileId === "B92-11")
  );
}

function lineShape(input: Omit<DrawingLine, "kind">): DrawingLine {
  return { kind: "line", stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1, ...input };
}

function buildB92AdminExternalAllFixedPreviewModel(contract: WindowTypeRenderModel): DrawingModel {
  const widthMm = Math.max(300, contract.overall.widthMm);
  const heightMm = Math.max(300, contract.overall.heightMm);
  const viewBoxWidth = 520;
  const viewBoxHeight = 520;
  const pad = 56;
  const availableWidth = viewBoxWidth - pad * 2;
  const availableHeight = viewBoxHeight - pad * 2;
  const ratio = Math.max(0.1, widthMm / Math.max(1, heightMm));
  let frameWidth = availableWidth;
  let frameHeight = frameWidth / ratio;
  if (frameHeight > availableHeight) {
    frameHeight = availableHeight;
    frameWidth = frameHeight * ratio;
  }

  const frameX = pad + (availableWidth - frameWidth) / 2;
  const frameY = pad + (availableHeight - frameHeight) / 2;
  const scale = Math.min(frameWidth / widthMm, frameHeight / heightMm);
  const revealSidePx = 3 * scale;
  const revealTopPx = 3 * scale;
  const revealBottomPx = 18 * scale;
  const claddingPx = 78 * scale;
  const centreAssemblyPx = 84 * scale;
  const centreHalfPx = centreAssemblyPx / 2;
  const outerTopY = frameY;
  const outerBottomY = frameY + frameHeight;
  const innerTopY = frameY + revealTopPx;
  const innerBottomY = frameY + frameHeight - revealBottomPx;
  const leftRevealX = frameX + revealSidePx;
  const rightRevealX = frameX + frameWidth - revealSidePx;
  const leftGlassX = leftRevealX + claddingPx;
  const rightGlassX = rightRevealX - claddingPx;
  const glassTopY = innerTopY + claddingPx;
  const glassBottomY = innerBottomY - claddingPx;
  const fieldsByColumn = [...contract.fields].sort((a, b) => a.column - b.column);
  const columnCount = fieldsByColumn.length;
  const junctionBands = Array.from({ length: Math.max(0, columnCount - 1) }, (_, index) => {
    const splitX = frameX + (frameWidth * (index + 1)) / columnCount;
    return {
      index: index + 1,
      centerX: splitX,
      leftX: splitX - centreHalfPx,
      rightX: splitX + centreHalfPx,
    };
  });

  const frameShapes: DrawingShape[] = [
    lineShape({ x1: frameX, y1: outerTopY, x2: frameX + frameWidth, y2: outerTopY }),
    lineShape({ x1: frameX + frameWidth, y1: outerTopY, x2: frameX + frameWidth, y2: outerBottomY }),
    lineShape({ x1: frameX + frameWidth, y1: outerBottomY, x2: frameX, y2: outerBottomY }),
    lineShape({ x1: frameX, y1: outerBottomY, x2: frameX, y2: outerTopY }),
    lineShape({ x1: leftRevealX, y1: innerTopY, x2: leftRevealX, y2: innerBottomY }),
    lineShape({ x1: rightRevealX, y1: innerTopY, x2: rightRevealX, y2: innerBottomY }),
  ];

  const glassShapes: DrawingShape[] = [
    {
      kind: "polygon",
      points: [
        { x: leftRevealX, y: innerTopY },
        { x: rightRevealX, y: innerTopY },
        { x: rightGlassX, y: glassTopY },
        { x: leftGlassX, y: glassTopY },
      ],
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: ADMIN_EXTERNAL_CLADDING_FILL,
      role: "external_fixed_fixed_full_length_head_cladding",
    },
    {
      kind: "polygon",
      points: [
        { x: leftGlassX, y: glassBottomY },
        { x: rightGlassX, y: glassBottomY },
        { x: rightRevealX, y: innerBottomY },
        { x: leftRevealX, y: innerBottomY },
      ],
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: ADMIN_EXTERNAL_CLADDING_FILL,
      role: "external_fixed_fixed_full_length_bottom_cladding",
    },
    {
      kind: "polygon",
      points: [
        { x: leftRevealX, y: innerTopY },
        { x: leftGlassX, y: glassTopY },
        { x: leftGlassX, y: glassBottomY },
        { x: leftRevealX, y: innerBottomY },
      ],
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: ADMIN_EXTERNAL_CLADDING_FILL,
      role: "external_fixed_fixed_left_jamb_cladding",
    },
    {
      kind: "polygon",
      points: [
        { x: rightGlassX, y: glassTopY },
        { x: rightRevealX, y: innerTopY },
        { x: rightRevealX, y: innerBottomY },
        { x: rightGlassX, y: glassBottomY },
      ],
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: ADMIN_EXTERNAL_CLADDING_FILL,
      role: "external_fixed_fixed_right_jamb_cladding",
    },
  ];

  fieldsByColumn.forEach((field, index) => {
    const previousBand = index > 0 ? junctionBands[index - 1] : null;
    const nextBand = index < columnCount - 1 ? junctionBands[index] : null;
    const fieldLeftX = previousBand ? previousBand.rightX : leftRevealX;
    const fieldRightX = nextBand ? nextBand.leftX : rightRevealX;
    const daylightX0 = index === 0 ? leftGlassX : fieldLeftX;
    const daylightX1 = index === columnCount - 1 ? rightGlassX : fieldRightX;

    glassShapes.push({
      kind: "polygon",
      points: [
        { x: daylightX0, y: glassTopY },
        { x: daylightX1, y: glassTopY },
        { x: daylightX1, y: glassBottomY },
        { x: daylightX0, y: glassBottomY },
      ],
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: "#ffffff",
      role: `external_fixed_fixed_daylight_${field.id}`,
    });
  });

  const junctionShapes: DrawingShape[] = [
    ...junctionBands.flatMap((band) => [
      {
        kind: "rect" as const,
        x: band.leftX,
        y: glassTopY,
        width: Math.max(1, centreAssemblyPx),
        height: Math.max(1, glassBottomY - glassTopY),
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 1,
        fill: ADMIN_EXTERNAL_CLADDING_FILL,
        role: `external_fixed_fixed_b92_11_centre_meeting_${band.index}`,
      },
      lineShape({ x1: band.leftX, y1: glassTopY, x2: band.leftX, y2: glassBottomY }),
      lineShape({ x1: band.rightX, y1: glassTopY, x2: band.rightX, y2: glassBottomY }),
    ]),
    lineShape({ x1: leftRevealX, y1: innerTopY, x2: rightRevealX, y2: innerTopY }),
    lineShape({ x1: leftRevealX, y1: innerBottomY, x2: rightRevealX, y2: innerBottomY }),
    lineShape({ x1: leftGlassX, y1: glassTopY, x2: rightGlassX, y2: glassTopY }),
    lineShape({ x1: leftGlassX, y1: glassBottomY, x2: rightGlassX, y2: glassBottomY }),
  ];

  const cells: DrawingModel["interaction"]["cells"] = fieldsByColumn.map((field, index) => {
    const previousBand = index > 0 ? junctionBands[index - 1] : null;
    const nextBand = index < columnCount - 1 ? junctionBands[index] : null;
    const x = previousBand ? previousBand.rightX : frameX;
    const x2 = nextBand ? nextBand.leftX : frameX + frameWidth;
    return {
      key: field.id,
      x,
      y: frameY,
      width: Math.max(1, x2 - x),
      height: frameHeight,
    };
  });

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: glassShapes },
      { id: "junctions", role: "junctions", shapes: junctionShapes },
    ],
    geometry: {
      frame: frameShapes,
      sash: [],
      glass: glassShapes,
      junctions: junctionShapes,
    },
    annotations: {
      dimensions: buildAdminExternalDimensionAnnotations(
        { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        widthMm,
        heightMm
      ),
      labels: [],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "outward",
      operationType: "admin_external_fixed_fixed",
      sectionReferences: [],
      referenceInputs: [
        {
          drawingId: "b92-external-fixed-fixed",
          title: "B92 External All-Fixed",
          purpose: "External all-fixed elevation principle for Admin Window Types preview.",
          sourceDxfPath: "_project/Test/Europa 92 Alu Clad/2 Field/External-Fixed-Fixed.dxf",
          sourceSvgPath: null,
        },
      ],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "glass", "junctions", "dimensions", "annotations"],
      devReports: {
        adminExternalFixedFixed: {
          sourceDxfPath: "_project/Test/Europa 92 Alu Clad/2 Field/External-Fixed-Fixed.dxf",
          outerRevealMm: { top: 3, left: 3, right: 3, bottom: 18 },
          fixedCladdingReturnMm: 78,
          b92_11_externalCentreAssemblyMm: 84,
          b92_11_count: junctionBands.length,
          b92_11_yStart: "inner edge of top cladding",
          b92_11_yEnd: "inner edge of bottom cladding",
        },
      },
    },
    interaction: {
      cells,
      verticalJunctions: junctionBands.map((band) => ({ index: band.index, x: band.centerX, y1: glassTopY, y2: glassBottomY })),
      horizontalJunctions: [],
    },
  };
}

function withSingleFieldExternalInteraction(model: DrawingModel, contract: WindowTypeRenderModel): DrawingModel {
  const fieldId = contract.fields[0]?.id ?? "0:0";
  return {
    ...model,
    interaction: {
      ...model.interaction,
      cells: model.interaction.cells.map((cell) => ({ ...cell, key: fieldId })),
    },
  };
}

function externalInsertionForField(field: WindowTypeRenderModel["fields"][number]) {
  const operation = String(field.operation ?? field.type ?? "");
  if (operation === "fixed_sash" || field.type === "fixed_sash") return "Fixed Sash";
  if (operation === "tt_right") return "Tilt & Turn Right";
  if (operation === "tt_left" || operation === "tilt_only" || field.type === "tilt_turn") return "Tilt & Turn Left";
  if (operation === "turn_right") return "Turn Right";
  if (operation === "turn_left" || field.type === "turn_only") return "Turn Left";
  return "Fixed";
}

function externalRenderProfileOperationCandidates(field: WindowTypeRenderModel["fields"][number]) {
  const operation = String(field.operation ?? field.type ?? "");
  if (operation === "fixed" || field.type === "fixed") return ["fixed"];
  if (operation === "fixed_sash" || field.type === "fixed_sash") return ["fixed_sash", "tilt_turn"];
  if (operation === "turn_left" || operation === "turn_right" || field.type === "turn_only") return ["side_hung", "tilt_turn"];
  return ["tilt_turn"];
}

function findB92ExternalRenderProfile(
  bootstrap: ConfiguratorCatalogBootstrap,
  field: WindowTypeRenderModel["fields"][number]
): ConfiguratorRenderProfileRecord | null {
  const b92ProductIds = new Set(
    (bootstrap.products ?? [])
      .filter((product) => product.code === "B92" && product.is_active !== false)
      .map((product) => product.id)
  );
  const candidates = externalRenderProfileOperationCandidates(field);
  return (
    (bootstrap.renderProfiles ?? []).find(
      (profile) =>
        profile.is_active !== false &&
        String(profile.view_logic || "").trim().toLowerCase() === "outside" &&
        candidates.includes(String(profile.operation_type || "").trim().toLowerCase()) &&
        (b92ProductIds.size === 0 || (profile.product_id !== null && b92ProductIds.has(profile.product_id)))
    ) ?? null
  );
}

function buildB92AdminExternalSingleFieldPreviewModel(
  contract: WindowTypeRenderModel,
  bootstrap: ConfiguratorCatalogBootstrap
): DrawingModel {
  const field = contract.fields[0];
  if (!field) {
    return buildFixedExternalRectanglePilot({
      widthMm: contract.overall.widthMm,
      heightMm: contract.overall.heightMm,
      frameFill: ADMIN_EXTERNAL_FRAME_FILL,
      claddingFill: ADMIN_EXTERNAL_CLADDING_FILL,
    });
  }
  const renderProfile = findB92ExternalRenderProfile(bootstrap, field);
  return withSingleFieldExternalInteraction(
    buildAdminPreviewWindowDrawingModel({
      widthMm: contract.overall.widthMm,
      heightMm: contract.overall.heightMm,
      fieldsX: 1,
      fieldsY: 1,
      insertion: externalInsertionForField(field),
      cellInsertions: { [field.id]: externalInsertionForField(field) },
      orientationView: "outside",
      openingSymbolMode: "din",
      resolvedProfiles: renderProfile ? buildResolvedSectionProfileSetFromRenderProfile(renderProfile, "outside") : null,
    }),
    contract
  );
}

function buildB92AdminExternalMultiFieldPreviewModel(contract: WindowTypeRenderModel): DrawingModel {
  if (isAllFixedHorizontalExternalContract(contract)) {
    return buildB92AdminExternalAllFixedPreviewModel(contract);
  }

  const widthMm = Math.max(300, contract.overall.widthMm);
  const heightMm = Math.max(300, contract.overall.heightMm);
  const viewBoxWidth = 520;
  const viewBoxHeight = 520;
  const pad = 56;
  const availableWidth = viewBoxWidth - pad * 2;
  const availableHeight = viewBoxHeight - pad * 2;
  const ratio = Math.max(0.1, widthMm / Math.max(1, heightMm));
  let frameWidth = availableWidth;
  let frameHeight = frameWidth / ratio;
  if (frameHeight > availableHeight) {
    frameHeight = availableHeight;
    frameWidth = frameHeight * ratio;
  }
  const frameX = pad + (availableWidth - frameWidth) / 2;
  const frameY = pad + (availableHeight - frameHeight) / 2;
  const scale = Math.min(frameWidth / widthMm, frameHeight / heightMm);
  const headPx = 3 * scale;
  const jambPx = 3 * scale;
  const bottomPx = 18 * scale;
  const claddingPx = 78 * scale;
  const sashOverlayPx = 32.7 * scale;
  const innerCladdingPx = 45.3 * scale;

  const frameShapes: DrawingShape[] = [
    { kind: "rect", x: frameX, y: frameY, width: frameWidth, height: headPx, stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1.2, fill: ADMIN_EXTERNAL_FRAME_FILL, role: "external_frame_head" },
    { kind: "rect", x: frameX, y: frameY + frameHeight - bottomPx, width: frameWidth, height: bottomPx, stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1.2, fill: ADMIN_EXTERNAL_FRAME_FILL, role: "external_frame_bottom" },
    { kind: "rect", x: frameX, y: frameY + headPx, width: jambPx, height: Math.max(1, frameHeight - headPx - bottomPx), stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1.2, fill: ADMIN_EXTERNAL_FRAME_FILL, role: "external_frame_left" },
    { kind: "rect", x: frameX + frameWidth - jambPx, y: frameY + headPx, width: jambPx, height: Math.max(1, frameHeight - headPx - bottomPx), stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1.2, fill: ADMIN_EXTERNAL_FRAME_FILL, role: "external_frame_right" },
  ];
  const sashShapes: DrawingShape[] = [];
  const glassShapes: DrawingShape[] = [];
  const junctionShapes: DrawingShape[] = [];
  const openingLines: DrawingLine[] = [];
  const cells: DrawingModel["interaction"]["cells"] = [];

  const fieldsByGrid = [...contract.fields].sort((a, b) => a.row - b.row || a.column - b.column);
  const columns = Math.max(1, ...fieldsByGrid.map((field) => field.column + 1));
  const rows = Math.max(1, ...fieldsByGrid.map((field) => field.row + 1));
  const splitX = frameX + frameWidth / columns;
  const splitY = frameY + frameHeight / rows;
  const primaryVerticalJunction = contract.verticalJunctions[0] ?? null;
  const primaryHorizontalJunction = contract.horizontalJunctions[0] ?? null;
  if (primaryVerticalJunction && columns === 2) {
    const junctionWidthPx = externalJunctionWidthMm(primaryVerticalJunction.profile.profileId) * scale;
    junctionShapes.push({
      kind: "rect",
      x: splitX - junctionWidthPx / 2,
      y: frameY + headPx,
      width: Math.max(1, junctionWidthPx),
      height: Math.max(1, frameHeight - headPx - bottomPx),
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: ADMIN_EXTERNAL_CLADDING_FILL,
      role:
        primaryVerticalJunction.profile.profileId === "B92-18"
          ? "external_unresolved_flying_meeting_placeholder"
          : `external_static_junction_${primaryVerticalJunction.profile.profileId ?? "unknown"}`,
    });
  }
  if (primaryHorizontalJunction && rows === 2) {
    const junctionHeightPx = externalJunctionWidthMm(primaryHorizontalJunction.profile.profileId) * scale;
    junctionShapes.push({
      kind: "rect",
      x: frameX + jambPx,
      y: splitY - junctionHeightPx / 2,
      width: Math.max(1, frameWidth - jambPx * 2),
      height: Math.max(1, junctionHeightPx),
      stroke: ADMIN_EXTERNAL_STROKE,
      strokeWidth: 1,
      fill: ADMIN_EXTERNAL_CLADDING_FILL,
      role: `external_static_horizontal_junction_${primaryHorizontalJunction.profile.profileId ?? "unknown"}`,
    });
  }

  for (const field of fieldsByGrid) {
    const fieldStartX = frameX + (frameWidth * field.column) / columns;
    const fieldEndX = frameX + (frameWidth * (field.column + 1)) / columns;
    const fieldStartY = frameY + (frameHeight * field.row) / rows;
    const fieldEndY = frameY + (frameHeight * (field.row + 1)) / rows;
    const verticalJunctionInset =
      columns === 2 && primaryVerticalJunction ? (externalJunctionWidthMm(primaryVerticalJunction.profile.profileId) * scale) / 2 : 0;
    const horizontalJunctionInset =
      rows === 2 && primaryHorizontalJunction ? (externalJunctionWidthMm(primaryHorizontalJunction.profile.profileId) * scale) / 2 : 0;
    const outerX0 = field.column === 0 ? frameX + jambPx : fieldStartX + verticalJunctionInset;
    const outerX1 = field.column === columns - 1 ? frameX + frameWidth - jambPx : fieldEndX - verticalJunctionInset;
    const outerY0 = field.row === 0 ? frameY + headPx : fieldStartY + horizontalJunctionInset;
    const outerY1 = field.row === rows - 1 ? frameY + frameHeight - bottomPx : fieldEndY - horizontalJunctionInset;
    cells.push({
      key: field.id,
      x: outerX0,
      y: outerY0,
      width: Math.max(1, outerX1 - outerX0),
      height: Math.max(1, outerY1 - outerY0),
    });

    if (isSashLikeField(field)) {
      const sashInnerX0 = outerX0 + sashOverlayPx;
      const sashInnerX1 = outerX1 - sashOverlayPx;
      const sashInnerY0 = outerY0 + sashOverlayPx;
      const sashInnerY1 = outerY1 - sashOverlayPx;
      const glassX0 = sashInnerX0 + innerCladdingPx;
      const glassX1 = sashInnerX1 - innerCladdingPx;
      const glassY0 = sashInnerY0 + innerCladdingPx;
      const glassY1 = sashInnerY1 - innerCladdingPx;
      sashShapes.push(
        {
          kind: "rect",
          x: outerX0,
          y: outerY0,
          width: Math.max(1, outerX1 - outerX0),
          height: Math.max(1, outerY1 - outerY0),
          stroke: ADMIN_EXTERNAL_STROKE,
          strokeWidth: 1.2,
          fill: ADMIN_EXTERNAL_FRAME_FILL,
          role: `external_sash_outer_${field.id}`,
        },
        {
          kind: "rect",
          x: sashInnerX0,
          y: sashInnerY0,
          width: Math.max(1, sashInnerX1 - sashInnerX0),
          height: Math.max(1, sashInnerY1 - sashInnerY0),
          stroke: ADMIN_EXTERNAL_STROKE,
          strokeWidth: 0.9,
          fill: "transparent",
          role: `external_sash_cladding_edge_${field.id}`,
        }
      );
      glassShapes.push({
        kind: "rect",
        x: glassX0,
        y: glassY0,
        width: Math.max(1, glassX1 - glassX0),
        height: Math.max(1, glassY1 - glassY0),
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 1,
        fill: ADMIN_EXTERNAL_GLASS_FILL,
        role: `external_visible_glass_${field.id}`,
      });
      openingLines.push(
        ...buildExternalOperationLines(
          { x0: glassX0, x1: glassX1, y0: glassY0, y1: glassY1 },
          String(field.operation ?? "")
        )
      );
    } else {
      const glassX0 = outerX0 + claddingPx;
      const glassX1 = outerX1 - claddingPx;
      const glassY0 = outerY0 + claddingPx;
      const glassY1 = outerY1 - claddingPx;
      glassShapes.push({
        kind: "rect",
        x: glassX0,
        y: glassY0,
        width: Math.max(1, glassX1 - glassX0),
        height: Math.max(1, glassY1 - glassY0),
        stroke: ADMIN_EXTERNAL_STROKE,
        strokeWidth: 1,
        fill: ADMIN_EXTERNAL_GLASS_FILL,
        role: `external_visible_glass_fixed_${field.id}`,
      });
      glassShapes.push(
        { kind: "rect", x: outerX0, y: outerY0, width: Math.max(1, outerX1 - outerX0), height: claddingPx, stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1, fill: ADMIN_EXTERNAL_CLADDING_FILL, role: `external_cladding_head_${field.id}` },
        { kind: "rect", x: outerX0, y: outerY1 - claddingPx, width: Math.max(1, outerX1 - outerX0), height: claddingPx, stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1, fill: ADMIN_EXTERNAL_CLADDING_FILL, role: `external_cladding_bottom_${field.id}` },
        { kind: "rect", x: outerX0, y: outerY0, width: claddingPx, height: Math.max(1, outerY1 - outerY0), stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1, fill: ADMIN_EXTERNAL_CLADDING_FILL, role: `external_cladding_left_${field.id}` },
        { kind: "rect", x: outerX1 - claddingPx, y: outerY0, width: claddingPx, height: Math.max(1, outerY1 - outerY0), stroke: ADMIN_EXTERNAL_STROKE, strokeWidth: 1, fill: ADMIN_EXTERNAL_CLADDING_FILL, role: `external_cladding_right_${field.id}` }
      );
    }
  }

  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: sashShapes },
      { id: "glass", role: "glass", shapes: glassShapes },
      { id: "junctions", role: "junctions", shapes: [...junctionShapes, ...openingLines] },
    ],
    geometry: {
      frame: frameShapes,
      sash: sashShapes,
      glass: glassShapes,
      junctions: [...junctionShapes, ...openingLines],
    },
    annotations: {
      dimensions: buildAdminExternalDimensionAnnotations(
        { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        widthMm,
        heightMm
      ),
      labels: [],
      handles: [],
      markers: [],
    },
    metadata: {
      systemType: "window",
      openingDirection: "outward",
      operationType: "admin_external_preview",
      sectionReferences: [],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "sash", "glass", "junctions", "dimensions", "annotations"],
      devReports: {
        adminExternalPreview: {
          partial: true,
          note:
            primaryVerticalJunction?.profile.profileId === "B92-18"
              ? "External flying mullion remains unresolved; this is a guarded admin placeholder."
              : "Admin Window Types external multi-field preview uses a guarded simple elevation.",
        },
      },
    },
    interaction: {
      cells,
      verticalJunctions: primaryVerticalJunction
        ? [{ index: 1, x: splitX, y1: frameY + headPx, y2: frameY + frameHeight - bottomPx }]
        : [],
      horizontalJunctions: primaryHorizontalJunction
        ? [{ index: 1, y: splitY, x1: frameX + jambPx, x2: frameX + frameWidth - jambPx }]
        : [],
    },
  };
}

function buildB92AdminExternalPreviewDrawingModel(
  contract: WindowTypeRenderModel,
  bootstrap: ConfiguratorCatalogBootstrap
): DrawingModel {
  if (contract.fields.length === 1) {
    return buildB92AdminExternalSingleFieldPreviewModel(contract, bootstrap);
  }
  return buildB92AdminExternalMultiFieldPreviewModel(contract);
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
): WindowTypeRenderModel {
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
  const hingeSide: "left" | "right" | null =
    operation === "tt_right" || operation === "turn_right" ? "right" : operation === "tilt_only" ? null : "left";
  const handleSide: "left" | "right" | null =
    operation === "tt_right" || operation === "turn_right" ? "left" : operation === "tilt_only" ? null : "right";

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
      height="100%" className="qs-migrated-200"
      aria-hidden={callouts.length === 0}
    >
      {callouts.map((callout) => (
        <g
          key={callout.id} className="qs-migrated-201"
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
      height="100%" className="qs-migrated-200"
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
  previewView: "internal" | "external";
  onRenderToolbarRegistration?: (registration: RenderWorkspaceToolbarRegistration | null) => void;
}) {
  const { categoryLabel, selectedDesign, bootstrap, previewView, onRenderToolbarRegistration } = props;
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
  const [useB92ProfileSectionAssemblyPreviewToggle, setUseB92ProfileSectionAssemblyPreviewToggle] = useState(false);
  const [previewSourceMode, setPreviewSourceMode] = useState<"native" | "b92">("native");
  const [selectedB92ProofFamilyId, setSelectedB92ProofFamilyId] = useState<string | null>(null);
  const [b92ProfileSectionAssemblySplitLeftMm, setB92ProfileSectionAssemblySplitLeftMm] = useState(1000);
  const [b92SplitLeftDraft, setB92SplitLeftDraft] = useState("1000");
  const [b92SplitRightDraft, setB92SplitRightDraft] = useState("1000");
  const [b92SplitWarning, setB92SplitWarning] = useState("");
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
  const mappedB92ProofFamily = useMemo(
    () => getB92ProfileSectionProofForDesignId(selectedDesignId),
    [selectedDesignId]
  );
  const selectedB92ProofFamily =
    getB92ProfileSectionProofById(selectedB92ProofFamilyId) ??
    mappedB92ProofFamily ??
    B92_PROFILE_SECTION_PROOF_FAMILIES[0] ??
    null;
  const canUseStaticB92ProofPreview = categoryLabel === "Windows";
  const useStaticB92ProofPreview = previewSourceMode === "b92";
  const useB92ProfileSectionAssemblyPreview = shouldRenderB92ProfileSectionAssemblyPreview({
    categoryLabel,
    designId: selectedDesignId,
    view: previewView,
    toggleEnabled: useB92ProfileSectionAssemblyPreviewToggle,
  });

  useEffect(() => {
    setEditableSourceModel(sourceModel ? cloneSourceModel(sourceModel) : null);
    setOperationMenu((current) => ({ ...current, open: false }));
    setProfilePopup(null);
    setDisabledProfileCallouts(new Set());
    setShowMeasurements(false);
    setUseDatumFixedNoSashRenderer(false);
    setUseB92ProfileSectionAssemblyPreviewToggle(false);
    setPreviewSourceMode("native");
    setSelectedB92ProofFamilyId(getB92ProfileSectionProofForDesignId(selectedDesignId)?.id ?? null);
    setB92ProfileSectionAssemblySplitLeftMm(1000);
    setB92SplitLeftDraft("1000");
    setB92SplitRightDraft("1000");
    setB92SplitWarning("");
  }, [selectedDesignId]);

  useEffect(() => {
    setProfilePopup(null);
  }, [previewView]);

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
  const commitB92SplitLeft = useCallback((draft: string) => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setB92SplitLeftDraft(String(b92ProfileSectionAssemblySplitLeftMm));
      setB92SplitRightDraft(String(B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM - b92ProfileSectionAssemblySplitLeftMm));
      setB92SplitWarning("Invalid split restored.");
      return;
    }
    const committed = clampB92ProfileSectionAssemblySplitLeftMm(parsed);
    setB92ProfileSectionAssemblySplitLeftMm(committed);
    setB92SplitLeftDraft(String(committed));
    setB92SplitRightDraft(String(B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM - committed));
    setB92SplitWarning(
      committed !== Math.round(parsed)
        ? `Split clamped to ${B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MIN_MM}-${B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MAX_MM} mm.`
        : ""
    );
    setProfilePopup(null);
  }, [b92ProfileSectionAssemblySplitLeftMm]);
  const commitB92SplitRight = useCallback((draft: string) => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setB92SplitLeftDraft(String(b92ProfileSectionAssemblySplitLeftMm));
      setB92SplitRightDraft(String(B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM - b92ProfileSectionAssemblySplitLeftMm));
      setB92SplitWarning("Invalid split restored.");
      return;
    }
    const committedLeft = clampB92ProfileSectionAssemblySplitLeftMm(B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM - parsed);
    setB92ProfileSectionAssemblySplitLeftMm(committedLeft);
    setB92SplitLeftDraft(String(committedLeft));
    setB92SplitRightDraft(String(B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM - committedLeft));
    setB92SplitWarning(
      committedLeft !== Math.round(B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM - parsed)
        ? `Split clamped to ${B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MIN_MM}-${B92_PROFILE_SECTION_ASSEMBLY_SPLIT_MAX_MM} mm.`
        : ""
    );
    setProfilePopup(null);
  }, [b92ProfileSectionAssemblySplitLeftMm]);
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
    if (useB92ProfileSectionAssemblyPreview) {
      return {
        model: buildB92ProfileSectionAssemblyPreviewDrawingModel(selectedDesignId, b92ProfileSectionAssemblySplitLeftMm),
        contract: buildB92ProfileSectionAssemblyPreviewMeasurementContract(selectedDesignId, b92ProfileSectionAssemblySplitLeftMm),
        error: "",
      };
    }

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
          if (previewView === "external") {
            return buildB92AdminExternalPreviewDrawingModel(contract, bootstrap);
          }
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
  }, [activeSourceModel, b92ProfileSectionAssemblySplitLeftMm, bootstrap, previewView, useB92ProfileSectionAssemblyPreview, useDatumFixedNoSashRenderer]);
  const profileCallouts = useMemo(() => {
    if (!showProfileReferences || !previewResult.model || !previewResult.contract) return [];
    return buildProfileReferenceCallouts(previewResult.contract, previewResult.model, disabledProfileCallouts);
  }, [disabledProfileCallouts, previewResult.contract, previewResult.model, showProfileReferences]);
  const measurementDebug = useMemo(() => {
    if (!showMeasurements || !previewResult.model || !previewResult.contract) return { lines: [], report: null };
    return buildMeasurementDebugData(previewResult.contract, previewResult.model);
  }, [previewResult.contract, previewResult.model, showMeasurements]);

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

  const displayPreviewTitle = useB92ProfileSectionAssemblyPreview
    ? getB92ProfileSectionAssemblyPreviewTitle(selectedDesignId)
    : previewTitle;
  const displaySourceLabel = useB92ProfileSectionAssemblyPreview
    ? "B92 profile-section assembly proof"
    : sourceLabel;
  const b92InlineSplitDimensionOverlay =
    useB92ProfileSectionAssemblyPreview && selectedDesignId === "windows-2-fixed-fixed-static" && previewResult.model
      ? (() => {
          const viewBoxWidth = previewResult.model.viewBox.width;
          const viewBoxHeight = previewResult.model.viewBox.height;
          const existingOverallWidthDimension = previewResult.model.annotations.dimensions.find(
            (dimension) => dimension.id === "overall-width" || dimension.role === "overall-width"
          );
          const frameLeftX = existingOverallWidthDimension?.line.x1 ?? 24;
          const frameRightX = existingOverallWidthDimension?.line.x2 ?? viewBoxWidth - 64;
          const existingOverallDimensionY = existingOverallWidthDimension?.line.y1 ?? viewBoxHeight - 38;
          const frameBounds = getShapeBounds(previewResult.model.geometry.frame);
          const frameBottomY = frameBounds ? frameBounds.y + frameBounds.height : existingOverallDimensionY - 64;
          const frameWidth = frameRightX - frameLeftX;
          const splitX =
            frameLeftX +
            (b92ProfileSectionAssemblySplitLeftMm / B92_PROFILE_SECTION_ASSEMBLY_FIXED_FIXED_WIDTH_MM) * frameWidth;
          const fieldDimensionY = frameBottomY + (existingOverallDimensionY - frameBottomY) / 2;
          const leftLabelX = (frameLeftX + splitX) / 2;
          const rightLabelX = (splitX + frameRightX) / 2;
          const overallLabelX = (frameLeftX + frameRightX) / 2;
          const toLeftPercent = (x: number) => `${(x / viewBoxWidth) * 100}%`;
          const toTopPercent = (y: number) => `${(y / viewBoxHeight) * 100}%`;
          const dimensionStroke = existingOverallWidthDimension?.line.stroke ?? "#111";
          const dimensionStrokeWidth = existingOverallWidthDimension?.line.strokeWidth ?? 0.9;
          const tickLength = Math.abs(
            (existingOverallWidthDimension?.tickA.y2 ?? fieldDimensionY + 6) -
              (existingOverallWidthDimension?.tickA.y1 ?? fieldDimensionY - 6)
          );
          const tickHalf = Math.max(5, tickLength / 2);
          const labelGap = 22;
          return (
            <div
              aria-label="B92-11 editable field split dimensions" className="qs-migrated-202"
            >
              <svg
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                preserveAspectRatio="none" className="qs-migrated-203"
              >
                <g stroke={dimensionStroke} strokeWidth={dimensionStrokeWidth} fill="none" strokeLinecap="round">
                  <line x1={frameLeftX} y1={fieldDimensionY} x2={Math.max(frameLeftX, leftLabelX - labelGap)} y2={fieldDimensionY} />
                  <line x1={Math.min(splitX, leftLabelX + labelGap)} y1={fieldDimensionY} x2={splitX} y2={fieldDimensionY} />
                  <line x1={splitX} y1={fieldDimensionY} x2={Math.max(splitX, rightLabelX - labelGap)} y2={fieldDimensionY} />
                  <line x1={Math.min(frameRightX, rightLabelX + labelGap)} y1={fieldDimensionY} x2={frameRightX} y2={fieldDimensionY} />
                  <line x1={frameLeftX} y1={fieldDimensionY - tickHalf} x2={frameLeftX} y2={fieldDimensionY + tickHalf} />
                  <line x1={splitX} y1={fieldDimensionY - tickHalf} x2={splitX} y2={fieldDimensionY + tickHalf} />
                  <line x1={frameRightX} y1={fieldDimensionY - tickHalf} x2={frameRightX} y2={fieldDimensionY + tickHalf} />
                </g>
              </svg>
              <input
                type="number"
                step={1}
                aria-label="B92-11 left field width"
                value={b92SplitLeftDraft}
                onChange={(event) => setB92SplitLeftDraft(event.currentTarget.value)}
                onBlur={() => commitB92SplitLeft(b92SplitLeftDraft)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="window-type-split-input"
                data-left={toLeftPercent(leftLabelX)}
                data-top={toTopPercent(fieldDimensionY)}
              />
              <input
                type="number"
                step={1}
                aria-label="B92-11 right field width"
                value={b92SplitRightDraft}
                onChange={(event) => setB92SplitRightDraft(event.currentTarget.value)}
                onBlur={() => commitB92SplitRight(b92SplitRightDraft)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="window-type-split-input"
                data-left={toLeftPercent(rightLabelX)}
                data-top={toTopPercent(fieldDimensionY)}
              />
              {b92SplitWarning ? (
                <div
                  className="window-type-split-warning"
                  data-left={toLeftPercent(overallLabelX)}
                  data-top={toTopPercent(Math.min(viewBoxHeight - 4, existingOverallDimensionY + 26))}
                >
                  {b92SplitWarning}
                </div>
              ) : null}
            </div>
          );
        })()
      : null;

  return (
    <div className="qs-migrated-204">
      {activeSourceModel && previewResult.model ? (
        <div className="qs-migrated-205"
        >
          <div className="qs-migrated-206">
            {displayPreviewTitle} — {previewView === "external" ? "External" : "Internal"}
          </div>
          <label className="qs-migrated-207"
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
          <label className="qs-migrated-207"
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
          {canUseStaticB92ProofPreview ? (
            <label className="qs-migrated-207">
              <span>Preview source</span>
              <select
                value={previewSourceMode}
                onChange={(event) => {
                  setPreviewSourceMode(event.currentTarget.value === "b92" ? "b92" : "native");
                  setProfilePopup(null);
                }} className="qs-migrated-208"
              >
                <option value="native">Native render</option>
                <option value="b92">B92 profile-section assembly proof</option>
              </select>
            </label>
          ) : null}
          {previewView === "internal" && !useB92ProfileSectionAssemblyPreview ? (
            <label className="qs-migrated-207"
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
          ) : null}
        </div>
      ) : null}
      {useStaticB92ProofPreview ? (
        <B92ProfileSectionAssemblyPreview
          selectedFamily={selectedB92ProofFamily}
          view={previewView}
          onSelectFamily={(familyId) => setSelectedB92ProofFamilyId(familyId || null)}
          internalFrameRal="9016"
          externalCladdingRal="7016"
        />
      ) : !activeSourceModel ? (
        <div className="admin-placeholder-box qs-migrated-180">
          Preview not available for this design yet.
        </div>
      ) : previewResult.error ? (
        <div className="admin-placeholder-box qs-migrated-180">
          Preview unavailable: {previewResult.error}
        </div>
      ) : previewResult.model ? (
        <div className="qs-migrated-209">
          <div className="qs-migrated-210"
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
                {b92InlineSplitDimensionOverlay}
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
      {!useStaticB92ProofPreview && showProfileReferences && previewResult.model ? (
        <div className="admin-body-copy qs-migrated-17">
          <div>
            Profile reference callouts: {profileCallouts.length === 0 ? "none available" : `${profileCallouts.length} shown`}
          </div>
          {disabledProfileCallouts.size > 0 ? (
            <div className="qs-migrated-211">
              <span>Disabled:</span>
              {Array.from(disabledProfileCallouts).map((calloutId) => (
                <button
                  key={calloutId}
                  type="button"
                  className="admin-nav-button qs-migrated-212"
                  onClick={() => {
                    setDisabledProfileCallouts((current) => {
                      const next = new Set(current);
                      next.delete(calloutId);
                      return next;
                    });
                  }}
                >
                  <span className="admin-nav-button-label">Enable {calloutId}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {!useStaticB92ProofPreview && showMeasurements && previewResult.model ? (
        <div className="admin-body-copy">
          Measurement overlay: {measurementDebug.lines.length === 0 ? "no measurable drawing bounds available" : `${measurementDebug.lines.length} guide lines shown`}
        </div>
      ) : null}
      {profilePopup ? (
        <div
          className="admin-card ui-card window-type-profile-popup"
          data-x={`${Math.round(profilePopup.x)}px`}
          data-y={`${Math.round(profilePopup.y)}px`}
        >
          <div className="qs-migrated-135">
            <div className="admin-setting-label">{profilePopup.callout.profileId}</div>
            <div className="admin-body-copy">Segment: {profilePopup.callout.segmentType}</div>
            <div className="admin-body-copy">Identity: {profilePopup.callout.identity}</div>
          </div>
          <div className="qs-migrated-213">
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
            className="admin-nav-button qs-migrated-214"
            onClick={() => {
              setDisabledProfileCallouts((current) => {
                const next = new Set(current);
                next.add(profilePopup.callout.id);
                return next;
              });
              setProfilePopup(null);
            }}
          >
            <span className="admin-nav-button-label">Disable this callout</span>
          </button>
          <button
            type="button"
            className="admin-nav-button qs-migrated-214"
            onClick={() => setProfilePopup(null)}
          >
            <span className="admin-nav-button-label">Close</span>
          </button>
        </div>
      ) : null}
      {!useStaticB92ProofPreview && activeSourceModel && !catalogReport.attempted ? (
        <div className="qs-migrated-215">
          Preview source: {displaySourceLabel}
        </div>
      ) : null}
      {catalogReport.attempted ? (
        <div className="admin-placeholder-box qs-migrated-216">
          <div>Preview source: {sourceLabel}</div>
          <div>Catalog bridge: {catalogReport.buildSuccess ? "PASS" : "FAIL"}</div>
          <div>Comparison: {catalogReport.comparisonPass ? "PASS" : "FAIL"}</div>
          {catalogReport.error ? <div>Error: {catalogReport.error}</div> : null}
          {catalogReport.differences.length === 0 ? (
            <div>Differences: none</div>
          ) : (
            <div className="qs-migrated-135">
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
      {operationMenu.field ? (
        <FieldOperationContextMenu
          open={operationMenu.open}
          x={operationMenu.x}
          y={operationMenu.y}
          field={operationMenu.field}
          availableOperations={availableOperations}
          onSelectOperation={(operation) => {
            const selectedField = operationMenu.field;
            if (!selectedField) return;
            setEditableSourceModel((current) => {
              if (!current) return current;
              return updateSourceFieldOperation({
                source: current,
                field: selectedField,
                operation,
              });
            });
          }}
          onClose={closeOperationMenu}
        />
      ) : null}
    </div>
  );
}

export default function WindowTypeEditor(props: Props) {
  const { categoryLabel, fieldCountLabel, selectedDesign, bootstrap, previewView, onRenderToolbarRegistration } = props;

  return (
    <div className="qs-migrated-217">
      <WindowTypeTechnicalPreview
        categoryLabel={categoryLabel}
        selectedDesign={selectedDesign}
        bootstrap={bootstrap}
        previewView={previewView}
        onRenderToolbarRegistration={onRenderToolbarRegistration}
      />
      <details className="admin-card ui-card qs-migrated-6">
        <summary className="admin-group-title qs-migrated-218">
          Source model panels
        </summary>
        <div className="qs-migrated-219">
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
