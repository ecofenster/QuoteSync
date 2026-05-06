import type {
  DrawingDimension,
  DrawingModel,
  DrawingRect,
  DrawingShape,
} from "../drawingModel";
import type {
  WindowTypeRenderConstraint,
  WindowTypeRenderField,
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
} from "./windowTypeRenderContract";

const VIEW_BOX_WIDTH = 520;
const VIEW_BOX_HEIGHT = 520;
const VIEW_BOX_PAD = 56;

const B92_FIXED_INTERNAL_FRAME_MM = {
  top: 78,
  left: 78,
  right: 78,
  bottom: 93,
};

const REQUIRED_B92_FIXED_INTERNAL_PROFILES = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid B92 fixed internal drawing contract: ${message}`);
}

function assertFinitePositiveMm(value: number, label: string) {
  assertCondition(Number.isFinite(value) && value > 0, `${label} must be a finite positive millimetre value.`);
}

function hasBlockingUnresolvedConstraint(constraint: WindowTypeRenderConstraint) {
  return (
    constraint.severity === "blocking" ||
    constraint.constraint === "unresolved_profile_choice" ||
    constraint.constraint === "pending_confirmation"
  );
}

function assertNoBlockingUnresolvedConstraints(contract: WindowTypeRenderModel, field: WindowTypeRenderField) {
  const constraints = [...contract.constraints, ...(field.constraints ?? [])];
  const blocking = constraints.find(hasBlockingUnresolvedConstraint);
  assertCondition(
    !blocking,
    `blocking unresolved constraint found at ${blocking?.sourceId ?? "unknown"}: ${blocking?.constraint ?? "unknown"}.`
  );
}

function assertResolvedProfileRef(
  side: keyof WindowTypeRenderPerimeter,
  ref: WindowTypeRenderProfileRef,
  expectedProfileId: typeof REQUIRED_B92_FIXED_INTERNAL_PROFILES[keyof typeof REQUIRED_B92_FIXED_INTERNAL_PROFILES]
) {
  assertCondition(ref.profileId === expectedProfileId, `${side} profile must be ${expectedProfileId}.`);
  assertCondition(ref.source === "resolved", `${side} profile ${expectedProfileId} must be resolved.`);
  assertCondition(
    !ref.candidateProfileIds || ref.candidateProfileIds.length === 0,
    `${side} profile ${expectedProfileId} must not contain unresolved candidates.`
  );
}

function assertB92FixedInternalContract(contract: WindowTypeRenderModel): WindowTypeRenderField {
  assertCondition(contract.meta.system === "B92", "contract.meta.system must be B92.");
  assertCondition(
    contract.meta.validationMode === "external_refs_internal_validation",
    "contract.meta.validationMode must be external_refs_internal_validation."
  );
  assertCondition(contract.fields.length === 1, "exactly one field is required.");
  assertCondition(contract.verticalJunctions.length === 0, "vertical junctions are not supported.");
  assertCondition(contract.horizontalJunctions.length === 0, "horizontal junctions are not supported.");
  assertCondition(contract.couplings.length === 0, "couplings are not supported.");
  assertCondition(contract.corners.length === 0, "corners are not supported.");
  assertCondition(contract.thresholds.length === 0, "thresholds are not supported.");

  const field = contract.fields[0];
  assertCondition(field !== undefined, "single field is missing.");
  assertCondition(field.type === "fixed", "field type must be fixed.");
  assertCondition(field.row === 0 && field.column === 0, "field must be positioned at row 0, column 0.");
  assertCondition(field.sash === undefined, "fixed sash metadata is not allowed.");

  assertFinitePositiveMm(contract.overall.widthMm, "overall.widthMm");
  assertFinitePositiveMm(contract.overall.heightMm, "overall.heightMm");
  assertFinitePositiveMm(field.dimensionsMm.width, "field.dimensionsMm.width");
  assertFinitePositiveMm(field.dimensionsMm.height, "field.dimensionsMm.height");
  assertCondition(field.dimensionsMm.width === contract.overall.widthMm, "field width must match overall width.");
  assertCondition(field.dimensionsMm.height === contract.overall.heightMm, "field height must match overall height.");

  assertResolvedProfileRef("top", field.perimeter.top, REQUIRED_B92_FIXED_INTERNAL_PROFILES.top);
  assertResolvedProfileRef("left", field.perimeter.left, REQUIRED_B92_FIXED_INTERNAL_PROFILES.left);
  assertResolvedProfileRef("right", field.perimeter.right, REQUIRED_B92_FIXED_INTERNAL_PROFILES.right);
  assertResolvedProfileRef("bottom", field.perimeter.bottom, REQUIRED_B92_FIXED_INTERNAL_PROFILES.bottom);
  assertNoBlockingUnresolvedConstraints(contract, field);

  return field;
}

function getFrameRect(widthMm: number, heightMm: number) {
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

function rect(input: Omit<DrawingRect, "kind">): DrawingRect {
  return {
    kind: "rect",
    ...input,
  };
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
      index: 0,
      valueMm: widthMm,
      editable: false,
      value: String(widthMm),
      line: {
        kind: "line",
        x1: frame.x,
        y1: frame.y + frame.height + 26,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + 26,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line",
        x1: frame.x,
        y1: frame.y + frame.height + 20,
        x2: frame.x,
        y2: frame.y + frame.height + 32,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line",
        x1: frame.x + frame.width,
        y1: frame.y + frame.height + 20,
        x2: frame.x + frame.width,
        y2: frame.y + frame.height + 32,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      text: {
        x: frame.x + frame.width / 2,
        y: frame.y + frame.height + 46,
        value: String(widthMm),
        fontSize: 12,
        fill: "#111",
        anchor: "middle",
      },
    },
    {
      id: "overall-height",
      role: "overall-height",
      axis: "y",
      index: 0,
      valueMm: heightMm,
      editable: false,
      value: String(heightMm),
      line: {
        kind: "line",
        x1: frame.x + frame.width + 26,
        y1: frame.y,
        x2: frame.x + frame.width + 26,
        y2: frame.y + frame.height,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickA: {
        kind: "line",
        x1: frame.x + frame.width + 20,
        y1: frame.y,
        x2: frame.x + frame.width + 32,
        y2: frame.y,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      tickB: {
        kind: "line",
        x1: frame.x + frame.width + 20,
        y1: frame.y + frame.height,
        x2: frame.x + frame.width + 32,
        y2: frame.y + frame.height,
        stroke: "#111",
        strokeWidth: 0.9,
      },
      text: {
        x: frame.x + frame.width + 46,
        y: frame.y + frame.height / 2,
        value: String(heightMm),
        fontSize: 12,
        fill: "#111",
        anchor: "middle",
        rotate: 90,
      },
    },
  ];
}

function shouldRenderSegmentedSillOverlay(contract: WindowTypeRenderModel) {
  return contract.meta.dev?.b92RenderSegmentedSillOverlay === true;
}

function buildSegmentedSillOverlayShapes(
  contract: WindowTypeRenderModel,
  frame: { x: number; y: number; width: number; height: number },
  scale: number
): DrawingShape[] {
  if (!shouldRenderSegmentedSillOverlay(contract)) return [];
  if (!contract.sillSegments || contract.sillSegments.length === 0) return [];

  const fieldsByColumn = new Map(contract.fields.map((field) => [field.column, field]));
  const columns = Array.from(new Set(contract.fields.map((field) => field.column))).sort((a, b) => a - b);
  const columnWidthsMm = new Map<number, number>();
  let totalWidthMm = 0;

  for (const column of columns) {
    const field = fieldsByColumn.get(column);
    if (!field) {
      console.warn("B92 segmented sill overlay skipped: missing field bounds for column.", { column });
      return [];
    }
    columnWidthsMm.set(column, field.dimensionsMm.width);
    totalWidthMm += field.dimensionsMm.width;
  }

  if (totalWidthMm <= 0 || Math.abs(totalWidthMm - contract.overall.widthMm) > 0.01) {
    console.warn("B92 segmented sill overlay skipped: field widths do not match overall width.", {
      totalFieldWidthMm: totalWidthMm,
      overallWidthMm: contract.overall.widthMm,
    });
    return [];
  }

  let xCursor = frame.x;
  const columnStarts = new Map<number, number>();
  for (const column of columns) {
    columnStarts.set(column, xCursor);
    xCursor += (columnWidthsMm.get(column) ?? 0) * scale;
  }

  return contract.sillSegments
    .map((segment) => {
      const x = columnStarts.get(segment.column);
      const widthMm = columnWidthsMm.get(segment.column);
      if (x === undefined || widthMm === undefined) {
        console.warn("B92 segmented sill overlay skipped: sill segment has no matching column bounds.", segment);
        return null;
      }

      return rect({
        x,
        y: frame.y + frame.height - B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
        width: widthMm * scale,
        height: B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
        stroke: "#111",
        strokeWidth: 1.3,
        fill: "rgba(244, 244, 245, 0.72)",
        role: `sill_segment_${segment.profile.profileId}`,
      });
    })
    .filter((shape): shape is DrawingRect => !!shape);
}

export function buildB92FixedInternalDrawingModelFromContract(contract: WindowTypeRenderModel): DrawingModel {
  const field = assertB92FixedInternalContract(contract);
  const widthMm = contract.overall.widthMm;
  const heightMm = contract.overall.heightMm;

  const visibleGlassMm = {
    x: B92_FIXED_INTERNAL_FRAME_MM.left,
    y: B92_FIXED_INTERNAL_FRAME_MM.top,
    width: widthMm - B92_FIXED_INTERNAL_FRAME_MM.left - B92_FIXED_INTERNAL_FRAME_MM.right,
    height: heightMm - B92_FIXED_INTERNAL_FRAME_MM.top - B92_FIXED_INTERNAL_FRAME_MM.bottom,
  };
  assertCondition(
    visibleGlassMm.width > 0 && visibleGlassMm.height > 0,
    "visible frame faces leave no visible glass area."
  );

  const glassOrderMm = {
    width: visibleGlassMm.width + 26,
    height: visibleGlassMm.height + 26,
  };
  const frame = getFrameRect(widthMm, heightMm);
  const scale = frame.scale;

  const frameShapes: DrawingShape[] = [
    rect({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: B92_FIXED_INTERNAL_FRAME_MM.top * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_top",
    }),
    rect({
      x: frame.x,
      y: frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale,
      width: B92_FIXED_INTERNAL_FRAME_MM.left * scale,
      height: visibleGlassMm.height * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_left",
    }),
    rect({
      x: frame.x + frame.width - B92_FIXED_INTERNAL_FRAME_MM.right * scale,
      y: frame.y + B92_FIXED_INTERNAL_FRAME_MM.top * scale,
      width: B92_FIXED_INTERNAL_FRAME_MM.right * scale,
      height: visibleGlassMm.height * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_right",
    }),
    rect({
      x: frame.x,
      y: frame.y + frame.height - B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
      width: frame.width,
      height: B92_FIXED_INTERNAL_FRAME_MM.bottom * scale,
      stroke: "#111",
      strokeWidth: 1.2,
      fill: "#f4f4f5",
      role: "b92_fixed_internal_frame_bottom",
    }),
  ];
  const segmentedSillOverlayShapes = buildSegmentedSillOverlayShapes(contract, frame, scale);
  frameShapes.push(...segmentedSillOverlayShapes);
  const glassShapes: DrawingShape[] = [
    rect({
      x: frame.x + visibleGlassMm.x * scale,
      y: frame.y + visibleGlassMm.y * scale,
      width: visibleGlassMm.width * scale,
      height: visibleGlassMm.height * scale,
      stroke: "#111",
      strokeWidth: 1,
      fill: "#b9d7f3",
      role: "b92_fixed_internal_visible_glass",
    }),
  ];
  return {
    width: widthMm,
    height: heightMm,
    viewBox: { width: VIEW_BOX_WIDTH, height: VIEW_BOX_HEIGHT },
    elements: [
      { id: "frame", role: "frame", shapes: frameShapes },
      { id: "sash", role: "sash", shapes: [] },
      { id: "glass", role: "glass", shapes: glassShapes },
      { id: "junctions", role: "junctions", shapes: [] },
    ],
    geometry: {
      frame: frameShapes,
      sash: [],
      glass: glassShapes,
      junctions: [],
    },
    annotations: {
      dimensions: buildDimensionAnnotations(frame, widthMm, heightMm),
      labels: [],
      handles: [],
      markers: [],
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
        b92FixedInternalContractDrawingAdapter: {
          fieldId: field.id,
          validationMode: contract.meta.validationMode,
          requiredProfiles: REQUIRED_B92_FIXED_INTERNAL_PROFILES,
          visibleFrameMm: B92_FIXED_INTERNAL_FRAME_MM,
          visibleGlassMm,
          glassOrderNoteMm: glassOrderMm,
          segmentedSillOverlay: {
            enabled: shouldRenderSegmentedSillOverlay(contract),
            shapeCount: segmentedSillOverlayShapes.length,
          },
          note: "Isolated B92 fixed internal contract drawing adapter; pilot geometry is not used as authority.",
        },
      },
    },
    interaction: {
      cells: [
        {
          key: "0,0",
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
        },
      ],
      verticalJunctions: [],
      horizontalJunctions: [],
    },
  };
}
