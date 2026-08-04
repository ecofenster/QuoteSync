import type {
  DrawingLabel,
  DrawingLine,
  DrawingMarker,
  DrawingModel,
  DrawingShape,
} from "../drawingModel";
import type { WindowTypeRenderModel } from "./windowTypeRenderContract";

type EvidenceView = "inside" | "outside";

type EvidenceLine = [number, number, number, number];
type EvidenceLabel = [number, number, string];
type EvidenceMarker = [number, number, number];

const PANEL_ORIGIN = { x: 28, y: 974 };
const VIEW_BOX = { width: 620, height: 420 };

const INTERNAL_GEOMETRY_LINES: EvidenceLine[] = [
  [75.01, 1335.34, 336.26, 1335.34],
  [75.01, 1320.45, 336.26, 1320.45],
  [597.5, 1335.34, 597.5, 1074.1],
  [582.61, 1320.45, 582.61, 1088.99],
  [75.01, 1074.1, 75.01, 1335.34],
  [89.9, 1088.99, 89.9, 1320.45],
  [336.26, 1335.34, 597.5, 1335.34],
  [336.26, 1320.45, 597.5, 1320.45],
  [75.01, 1074.1, 336.26, 1074.1],
  [75.01, 1088.99, 336.26, 1088.99],
  [336.26, 1074.1, 597.5, 1074.1],
  [336.26, 1088.99, 597.5, 1088.99],
  [331.56, 1088.99, 340.48, 1088.99],
  [340.96, 1088.99, 340.96, 1320.45],
  [340.96, 1320.45, 331.56, 1320.45],
  [331.56, 1320.45, 331.56, 1088.99],
  [331.56, 1320.44, 331.56, 1088.99],
  [95.39, 1094.47, 326.07, 1094.47],
  [89.9, 1320.44, 89.9, 1088.99],
  [89.9, 1088.99, 95.39, 1094.47],
  [95.39, 1094.47, 95.39, 1314.95],
  [89.9, 1320.45, 331.56, 1320.44],
  [89.9, 1320.45, 95.39, 1314.96],
  [95.39, 1314.96, 326.07, 1314.96],
  [326.08, 1314.96, 331.57, 1320.45],
  [331.56, 1088.99, 326.07, 1094.47],
  [582.63, 1320.45, 582.61, 1088.99],
  [577.13, 1314.96, 577.13, 1094.47],
  [346.45, 1094.47, 577.13, 1094.47],
  [340.96, 1320.44, 340.96, 1088.99],
  [340.96, 1088.99, 346.45, 1094.47],
  [346.45, 1094.47, 346.45, 1314.95],
  [340.96, 1320.45, 346.45, 1314.96],
  [346.45, 1314.96, 577.13, 1314.96],
  [577.14, 1314.96, 582.63, 1320.45],
  [582.61, 1088.99, 577.13, 1094.47],
];

const INTERNAL_CALLOUT_LINES: EvidenceLine[] = [[326.07, 1314.96, 326.07, 1094.47]];

const EXTERNAL_GEOMETRY_LINES: EvidenceLine[] = [
  [73.21, 1337.24, 334.46, 1337.24],
  [74, 1332.54, 334.46, 1332.54],
  [595.71, 1337.24, 595.71, 1075.99],
  [594.92, 1332.54, 594.92, 1076.78],
  [73.21, 1075.99, 73.21, 1337.24],
  [74, 1076.78, 74, 1332.54],
  [334.46, 1337.24, 595.71, 1337.24],
  [334.46, 1332.54, 595.71, 1332.54],
  [73.21, 1075.99, 334.46, 1075.99],
  [74, 1076.78, 334.46, 1076.78],
  [334.46, 1075.99, 595.71, 1075.99],
  [334.46, 1076.78, 594.92, 1076.78],
  [94.37, 1097.16, 94.37, 1312.16],
  [74, 1332.54, 94.37, 1312.16],
  [94.37, 1312.16, 323.49, 1312.16],
  [323.49, 1097.16, 94.37, 1097.16],
  [94.37, 1097.16, 74, 1076.78],
  [323.49, 1076.78, 323.49, 1332.54],
  [345.43, 1332.54, 594.92, 1332.54],
  [574.54, 1097.16, 574.54, 1312.16],
  [594.92, 1332.54, 574.54, 1312.16],
  [574.54, 1312.16, 345.43, 1312.16],
  [345.43, 1097.16, 574.54, 1097.16],
  [574.54, 1097.16, 594.92, 1076.78],
  [345.43, 1076.78, 345.43, 1332.54],
];

const EXTERNAL_CALLOUT_LINES: EvidenceLine[] = [
  [73.21, 1322.35, 74, 1322.35],
  [73.21, 1090.89, 74, 1090.89],
  [595.71, 1090.89, 594.92, 1090.89],
];

const PROFILE_LABELS: EvidenceLabel[] = [
  [324.51, 1086.79, "B92-1"],
  [74.75, 1206.77, "B92-2"],
  [577.93, 1206.16, "B92-2"],
  [324.32, 1327.31, "B92-3"],
  [324.47, 1206.97, "B92-11"],
  [546, 1380, "2000 x 1000"],
];

const PROFILE_MARKERS: EvidenceMarker[] = [
  [336.17, 1084.74, 18.41],
  [86.41, 1204.72, 18.41],
  [589.59, 1204.11, 18.41],
  [335.98, 1325.26, 18.41],
  [336.13, 1204.92, 18.41],
];

function localX(value: number) {
  return value - PANEL_ORIGIN.x;
}

function localY(value: number) {
  return value - PANEL_ORIGIN.y;
}

function lineFromEvidence(input: EvidenceLine, role: string, stroke = "#111", strokeWidth = 1): DrawingLine {
  return {
    kind: "line",
    x1: localX(input[0]),
    y1: localY(input[1]),
    x2: localX(input[2]),
    y2: localY(input[3]),
    stroke,
    strokeWidth,
    role,
  };
}

function isFixedFixedOneByTwoContract(contract: WindowTypeRenderModel) {
  if (contract.meta.system !== "B92") return false;
  if (contract.fields.length !== 2) return false;
  if (contract.fields.some((field) => field.type !== "fixed" || field.operation !== "fixed")) return false;

  const rows = new Set(contract.fields.map((field) => field.row));
  const columns = new Set(contract.fields.map((field) => field.column));
  if (rows.size !== 1 || !rows.has(0)) return false;
  if (columns.size !== 2 || !columns.has(0) || !columns.has(1)) return false;

  const junctionProfiles = contract.verticalJunctions.map((junction) => junction.profile.profileId);
  return junctionProfiles.length === 0 || junctionProfiles.every((profileId) => profileId === "B92-11");
}

function evidenceForView(view: EvidenceView) {
  return view === "outside"
    ? {
        view,
        drawingId: "external-fixed-fixed",
        title: "External-Fixed-Fixed.dxf",
        sourceDxfPath: "_project/Test/Europa 92 Alu Clad/2 Field/External-Fixed-Fixed.dxf",
        sourceSvgPath: "_project/Test/Europa 92 Alu Clad/2 Field/generated-external.svg",
        geometry: EXTERNAL_GEOMETRY_LINES,
        callouts: EXTERNAL_CALLOUT_LINES,
      }
    : {
        view,
        drawingId: "internal-fixed-fixed",
        title: "Internal-Fixed-Fixed.dxf",
        sourceDxfPath: "_project/Test/Europa 92 Alu Clad/2 Field/Internal-Fixed-Fixed.dxf",
        sourceSvgPath: "_project/Test/Europa 92 Alu Clad/2 Field/generated-internal.svg",
        geometry: INTERNAL_GEOMETRY_LINES,
        callouts: INTERNAL_CALLOUT_LINES,
      };
}

export function buildB92FixedFixedEvidenceLineworkPilotDrawingModel(
  contract: WindowTypeRenderModel
): DrawingModel | null {
  const dev = contract.meta.dev;
  if (dev?.b92UseJunctionGeometryVisualPilot !== true) return null;
  if (!isFixedFixedOneByTwoContract(contract)) return null;

  const requestedView = dev.b92JunctionGeometryVisualPilotView === "outside" ? "outside" : "inside";
  const evidence = evidenceForView(requestedView);
  const geometryShapes: DrawingShape[] = evidence.geometry.map((item) =>
    lineFromEvidence(item, `b92_fixed_fixed_${requestedView}_dxf_geometry`, "#111", 1.15)
  );
  const calloutShapes: DrawingShape[] = evidence.callouts.map((item) =>
    lineFromEvidence(item, `b92_fixed_fixed_${requestedView}_dxf_callout`, "#4b5563", 0.85)
  );
  const labels: DrawingLabel[] = PROFILE_LABELS.map(([x, y, value]) => ({
    x: localX(x),
    y: localY(y),
    value,
    fontSize: value.startsWith("B92-") ? 9 : 11,
    fontWeight: value.startsWith("B92-") ? 700 : 500,
    fill: "#111",
    anchor: "start",
    role: value.startsWith("B92-") ? "profile_ref_callout" : "overall_dimension_label",
  }));
  const markers: DrawingMarker[] = PROFILE_MARKERS.map(([x, y, radius]) => ({
    x: localX(x),
    y: localY(y),
    radius,
    value: "",
    role: "profile_ref_callout_bubble",
  }));

  return {
    width: contract.overall.widthMm,
    height: contract.overall.heightMm,
    viewBox: VIEW_BOX,
    elements: [
      { id: "dxf-derived-fixed-fixed-linework", role: "frame", shapes: geometryShapes },
      { id: "dxf-derived-fixed-fixed-callouts", role: "annotations", shapes: calloutShapes },
    ],
    geometry: {
      frame: geometryShapes,
      sash: [],
      glass: [],
      junctions: [],
    },
    annotations: {
      dimensions: [],
      labels,
      handles: [],
      markers,
    },
    metadata: {
      systemType: "window",
      openingDirection: "inward",
      operationType: "fixed",
      sectionReferences: ["B92-1", "B92-2", "B92-3", "B92-11"],
      referenceInputs: [
        {
          drawingId: evidence.drawingId,
          title: evidence.title,
          purpose:
            "Dev-flag B92 1x2 fixed/fixed visual pilot uses DXF-derived SVG linework instead of simplified rectangle mullion geometry.",
          sourceDxfPath: evidence.sourceDxfPath,
          sourceSvgPath: evidence.sourceSvgPath,
        },
      ],
      renderSource: "native_drawing_model",
      layerHints: ["dxf-derived-linework", "profile-callouts", "dimensions"],
      devReports: {
        b92FixedFixedEvidenceLineworkPilot: {
          enabled: true,
          visualGeometryChanged: true,
          scope: "B92 fixed/fixed 1 row x 2 columns only",
          view: requestedView,
          geometrySource: evidence.sourceSvgPath,
          sourceDxfPath: evidence.sourceDxfPath,
          profileRefs: ["B92-1", "B92-2", "B92-3", "B92-11"],
          note:
            "This pilot intentionally bypasses the simplified centre-rectangle adapter for the fixed/fixed case and renders evidence-derived linework.",
        },
      },
    },
    interaction: {
      cells: [
        { key: contract.fields[0]?.id ?? "field-0", x: 66, y: 120, width: 230, height: 216 },
        { key: contract.fields[1]?.id ?? "field-1", x: 318, y: 120, width: 230, height: 216 },
      ],
      verticalJunctions: [{ index: 1, x: 308, y1: 110, y2: 348 }],
      horizontalJunctions: [],
    },
  };
}
