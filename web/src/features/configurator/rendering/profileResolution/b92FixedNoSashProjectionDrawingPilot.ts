import type {
  DrawingDimension,
  DrawingLabel,
  DrawingMarker,
  DrawingModel,
  DrawingRect,
  DrawingShape,
} from "../drawingModel";
import { createB92FixedNoSashDatumProjectionFixture } from "./b92DatumProjectionFixture";
import type { B92ProjectedDrawableRegion, B92ProjectionBoundsMm } from "./b92DatumProjection.types";
import { projectB92DatumProjectionPlan } from "./b92ProjectionEngine";
import type { WindowTypeRenderField, WindowTypeRenderModel } from "./windowTypeRenderContract";

const VIEW_BOX_WIDTH = 520;
const VIEW_BOX_HEIGHT = 520;
const VIEW_BOX_PAD = 56;

const REQUIRED_B92_FIXED_INTERNAL_PROFILES = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

export type B92FixedNoSashProjectionPilotEligibility = {
  enabled: boolean;
  eligible: boolean;
  reasons: string[];
};

export type B92FixedNoSashProjectionPilotResult = {
  eligibility: B92FixedNoSashProjectionPilotEligibility;
  model: DrawingModel | null;
};

type B92FixedNoSashProjectionPilotDevFlags = WindowTypeRenderModel["meta"]["dev"] & {
  b92UseProjectionFixedNoSashDrawingPilot?: boolean | null;
};

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return {
    kind: "rect",
    ...input,
  };
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid B92 fixed no-sash projection pilot: ${message}`);
}

function frameViewport(widthMm: number, heightMm: number) {
  const availableWidth = VIEW_BOX_WIDTH - VIEW_BOX_PAD * 2;
  const availableHeight = VIEW_BOX_HEIGHT - VIEW_BOX_PAD * 2;
  const ratio = Math.max(0.1, widthMm / heightMm);
  let width = availableWidth;
  let height = width / ratio;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * ratio;
  }

  return {
    x: VIEW_BOX_PAD + (availableWidth - width) / 2,
    y: VIEW_BOX_PAD + (availableHeight - height) / 2,
    width,
    height,
    scale: Math.min(width / widthMm, height / heightMm),
  };
}

function toViewportBounds(boundsMm: B92ProjectionBoundsMm, frame: ReturnType<typeof frameViewport>) {
  return {
    x: frame.x + boundsMm.x * frame.scale,
    y: frame.y + boundsMm.y * frame.scale,
    width: boundsMm.width * frame.scale,
    height: boundsMm.height * frame.scale,
  };
}

function regionByIdOrCategory(input: {
  regions: B92ProjectedDrawableRegion[];
  category: B92ProjectedDrawableRegion["category"];
  edge?: B92ProjectedDrawableRegion["edge"];
}): B92ProjectedDrawableRegion {
  const region = input.regions.find(
    (item) =>
      item.category === input.category &&
      item.status === "resolved" &&
      !!item.boundsMm &&
      (!input.edge || item.edge === input.edge)
  );
  assertCondition(!!region, `missing resolved ${input.category}${input.edge ? `:${input.edge}` : ""} region.`);
  return region;
}

function buildDimensionAnnotations(
  frame: { x: number; y: number; width: number; height: number },
  widthMm: number,
  heightMm: number
): DrawingDimension[] {
  return [
    {
      id: "overall-width",
      role: "overall-width",
      axis: "x",
      valueMm: widthMm,
      editable: false,
      value: String(widthMm),
      line: { kind: "line", x1: frame.x, y1: frame.y + frame.height + 26, x2: frame.x + frame.width, y2: frame.y + frame.height + 26, stroke: "#111", strokeWidth: 0.9 },
      tickA: { kind: "line", x1: frame.x, y1: frame.y + frame.height + 20, x2: frame.x, y2: frame.y + frame.height + 32, stroke: "#111", strokeWidth: 0.9 },
      tickB: { kind: "line", x1: frame.x + frame.width, y1: frame.y + frame.height + 20, x2: frame.x + frame.width, y2: frame.y + frame.height + 32, stroke: "#111", strokeWidth: 0.9 },
      text: { x: frame.x + frame.width / 2, y: frame.y + frame.height + 46, value: String(widthMm), fontSize: 12, fill: "#111", anchor: "middle" },
    },
    {
      id: "overall-height",
      role: "overall-height",
      axis: "y",
      valueMm: heightMm,
      editable: false,
      value: String(heightMm),
      line: { kind: "line", x1: frame.x + frame.width + 26, y1: frame.y, x2: frame.x + frame.width + 26, y2: frame.y + frame.height, stroke: "#111", strokeWidth: 0.9 },
      tickA: { kind: "line", x1: frame.x + frame.width + 20, y1: frame.y, x2: frame.x + frame.width + 32, y2: frame.y, stroke: "#111", strokeWidth: 0.9 },
      tickB: { kind: "line", x1: frame.x + frame.width + 20, y1: frame.y + frame.height, x2: frame.x + frame.width + 32, y2: frame.y + frame.height, stroke: "#111", strokeWidth: 0.9 },
      text: { x: frame.x + frame.width + 46, y: frame.y + frame.height / 2, value: String(heightMm), fontSize: 12, fill: "#111", anchor: "middle", rotate: 90 },
    },
  ];
}

export function evaluateB92FixedNoSashProjectionPilotEligibility(
  contract: WindowTypeRenderModel
): B92FixedNoSashProjectionPilotEligibility {
  const reasons: string[] = [];
  const field = contract.fields[0];
  const dev = contract.meta.dev as B92FixedNoSashProjectionPilotDevFlags | undefined;
  const enabled = dev?.b92UseProjectionFixedNoSashDrawingPilot === true;

  if (!enabled) reasons.push("pilot flag is off");
  if (contract.meta.system !== "B92") reasons.push("contract system is not B92");
  if (contract.meta.validationMode !== "external_refs_internal_validation") {
    reasons.push("contract is not the internal validation drawing path");
  }
  if (contract.fields.length !== 1) reasons.push("contract must contain exactly one field");
  if (!field) reasons.push("contract has no field");
  if (field && field.type !== "fixed") reasons.push("field must be fixed no-sash");
  if (field?.sash) reasons.push("field must not include sash metadata");
  if (contract.verticalJunctions.length > 0) reasons.push("vertical junctions are not supported by this pilot");
  if (contract.horizontalJunctions.length > 0) reasons.push("horizontal junctions are not supported by this pilot");
  if (contract.couplings.length > 0) reasons.push("couplings are not supported by this pilot");
  if (contract.corners.length > 0) reasons.push("corners are not supported by this pilot");
  if (contract.thresholds.length > 0) reasons.push("thresholds are not supported by this pilot");
  if (!Number.isFinite(contract.overall.widthMm) || contract.overall.widthMm <= 0) reasons.push("overall width is invalid");
  if (!Number.isFinite(contract.overall.heightMm) || contract.overall.heightMm <= 0) reasons.push("overall height is invalid");

  return {
    enabled,
    eligible: enabled && reasons.length === 0,
    reasons,
  };
}

function buildProjectionModel(contract: WindowTypeRenderModel, field: WindowTypeRenderField): DrawingModel {
  const projected = projectB92DatumProjectionPlan({
    plan: createB92FixedNoSashDatumProjectionFixture(field.id),
    fieldBoundsById: {
      [field.id]: {
        x: 0,
        y: 0,
        width: field.dimensionsMm.width,
        height: field.dimensionsMm.height,
      },
    },
  });
  const frame = frameViewport(contract.overall.widthMm, contract.overall.heightMm);
  const frameShapes: DrawingShape[] = (["top", "left", "right", "bottom"] as const).map((edge) => {
    const region = regionByIdOrCategory({ regions: projected.projectedRegions, category: "visible_frame_face", edge });
    return rect({
      ...toViewportBounds(region.boundsMm as B92ProjectionBoundsMm, frame),
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: `b92_projection_fixed_frame_${edge}`,
    });
  });
  const daylight = regionByIdOrCategory({ regions: projected.projectedRegions, category: "daylight_opening" });
  const glassOrder = regionByIdOrCategory({ regions: projected.projectedRegions, category: "glass_order" });
  const glassRect = rect({
    ...toViewportBounds(daylight.boundsMm as B92ProjectionBoundsMm, frame),
    stroke: "#111",
    strokeWidth: 1,
    fill: "#b9d7f3",
    role: "b92_projection_fixed_daylight",
  });
  const labels: DrawingLabel[] = [
    {
      x: glassRect.x + 8,
      y: glassRect.y + 16,
      value: "Fixed",
      fontSize: 9,
      fill: "#3f3f46",
      anchor: "start",
      role: "field_label",
    },
  ];
  const markers: DrawingMarker[] = [
    {
      x: glassRect.x + glassRect.width / 2,
      y: glassRect.y + glassRect.height / 2,
      radius: 16,
      value: "1",
      role: "field_marker",
    },
  ];

  return {
    width: contract.overall.widthMm,
    height: contract.overall.heightMm,
    viewBox: { width: VIEW_BOX_WIDTH, height: VIEW_BOX_HEIGHT },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: [glassRect] },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: [],
      glass: [glassRect],
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(frame, contract.overall.widthMm, contract.overall.heightMm),
      labels,
      handles: [],
      markers,
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: "fixed",
      sectionReferences: [
        REQUIRED_B92_FIXED_INTERNAL_PROFILES.top,
        REQUIRED_B92_FIXED_INTERNAL_PROFILES.left,
        REQUIRED_B92_FIXED_INTERNAL_PROFILES.bottom,
      ],
      referenceInputs: [],
      renderSource: "native_drawing_model",
      layerHints: ["frame", "glass", "dimensions", "annotations"],
      devReports: {
        b92FixedNoSashProjectionDrawingPilot: {
          enabled: true,
          eligible: true,
          usedAsDrawingModel: true,
          diagnosticOnlyUntilFlagged: false,
          visualGeometryChangedByExplicitPilotFlag: true,
          source: "confirmed_b92_fixed_no_sash_datum_projection",
          visibleFrameMm: {
            top: 37.5,
            left: 37.5,
            right: 37.5,
            bottom: 72,
          },
          daylightOpeningMm: daylight.boundsMm,
          glassOrderMm: glassOrder.boundsMm,
          projectionUnresolved: projected.unresolved,
          note:
            "Explicitly gated B92 fixed no-sash internal pilot. This model is returned only when b92UseProjectionFixedNoSashDrawingPilot is true and eligibility passes.",
        },
      },
    },
    interaction: {
      cells: [
        {
          key: field.id,
          ...toViewportBounds(daylight.boundsMm as B92ProjectionBoundsMm, frame),
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}

export function buildB92FixedNoSashProjectionPilotDrawingModel(
  contract: WindowTypeRenderModel
): B92FixedNoSashProjectionPilotResult {
  const eligibility = evaluateB92FixedNoSashProjectionPilotEligibility(contract);
  if (!eligibility.eligible) {
    return {
      eligibility,
      model: null,
    };
  }

  const field = contract.fields[0];
  assertCondition(!!field, "eligible contract must have one field.");
  return {
    eligibility,
    model: buildProjectionModel(contract, field),
  };
}
