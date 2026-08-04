import type { DrawingLabel, DrawingMarker } from "../drawingModel";
import type { ProfileResolutionResult } from "./profileTypes";

type FieldBounds = {
  key: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

type ConnectionBounds = {
  key: string;
  x: number;
  y: number;
};

type Input = {
  resolution: ProfileResolutionResult;
  fieldBounds: FieldBounds[];
  verticalConnectionBounds: ConnectionBounds[];
  horizontalConnectionBounds: ConnectionBounds[];
  hasInternalAstragals: boolean;
  astragalCols: number;
  astragalRows: number;
};

function formatRef(value: string | null | undefined) {
  return value ?? "n/a";
}

export function buildProfilePilotAnnotations(input: Input): {
  labels: DrawingLabel[];
  markers: DrawingMarker[];
} {
  const labels: DrawingLabel[] = [];
  const markers: DrawingMarker[] = [];
  let line = 0;
  const pushReportLine = (value: string, fill = "#0f172a") => {
    labels.push({
      x: 12,
      y: 18 + line * 12,
      value,
      fontSize: 8,
      fill,
      anchor: "start",
      role: "profile_pilot_report",
    });
    line += 1;
  };

  pushReportLine("Profile resolution pilot", "#111827");
  for (const field of input.resolution.fields) {
    const fieldRect = input.fieldBounds.find((item) => item.key === field.key);
    if (fieldRect) {
      markers.push({
        x: (fieldRect.x0 + fieldRect.x1) / 2,
        y: (fieldRect.y0 + fieldRect.y1) / 2,
        radius: 12,
        value: `${field.col},${field.row}`,
        role: "profile_pilot_field_marker",
      });
    }
    pushReportLine(
      `F ${field.key} r${field.row} c${field.col} ${field.type} T:${formatRef(field.edges.top.profileRef)} R:${formatRef(field.edges.right.profileRef)} B:${formatRef(field.edges.bottom.profileRef)} L:${formatRef(field.edges.left.profileRef)}`
    );
  }
  for (const connection of input.resolution.verticalConnections) {
    const marker = input.verticalConnectionBounds.find((item) => item.key === connection.key);
    if (marker) {
      markers.push({
        x: marker.x,
        y: marker.y,
        radius: 10,
        value: `V`,
        role: "profile_pilot_vertical_marker",
      });
    }
    pushReportLine(
      `V ${connection.key} ${connection.type} ${formatRef(connection.profileRef)}${connection.hingeAtCentre ? " hinge-centre" : ""}${connection.mirrored ? " mirrored" : ""}${connection.note ? ` (${connection.note})` : ""}`,
      "#1d4ed8"
    );
  }
  for (const connection of input.resolution.horizontalConnections) {
    const marker = input.horizontalConnectionBounds.find((item) => item.key === connection.key);
    if (marker) {
      markers.push({
        x: marker.x,
        y: marker.y,
        radius: 10,
        value: `H`,
        role: "profile_pilot_horizontal_marker",
      });
    }
    pushReportLine(
      `H ${connection.key} ${connection.type} ${formatRef(connection.profileRef)}${connection.mirrored ? " mirrored" : ""}${connection.note ? ` (${connection.note})` : ""}`,
      "#7c3aed"
    );
  }
  pushReportLine(`Structural fields only. Astragals overlay glass only.`);
  pushReportLine(`Structural split dimensions stay separate from visible/glass split metadata.`);
  pushReportLine(
    `Astragals cols:${input.hasInternalAstragals ? input.astragalCols : 1} rows:${input.hasInternalAstragals ? input.astragalRows : 1}`,
    "#475569"
  );
  if (input.resolution.placeholders.length > 0) {
    pushReportLine(`Needs CAD confirmation: ${input.resolution.placeholders.join(", ")}`, "#b45309");
  }

  return { labels, markers };
}
