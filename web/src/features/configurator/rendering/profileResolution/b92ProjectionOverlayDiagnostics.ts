import type {
  B92ProjectionSerializedRegion,
  B92ProjectionSerializedResult,
} from "./b92ProjectionDebug";
import {
  extractB92DatumProjectionDiagnostics,
  listB92DatumProjectionDiagnosticSerializedResults,
} from "./b92ProjectionDiagnosticSurface";
import type { B92ProjectionBoundsMm } from "./b92DatumProjection.types";

export type B92ProjectionOverlayDiagnosticRegion = {
  id: string;
  category: string;
  status: string;
  boundsMm: B92ProjectionBoundsMm | null;
  label: string;
  unresolvedReason?: string;
  diagnosticOnly: true;
};

export type B92ProjectionOverlayDiagnosticResult = {
  enabled: boolean;
  diagnosticOnly: true;
  regions: B92ProjectionOverlayDiagnosticRegion[];
  note: string;
};

function unresolvedReasonForRegion(
  region: B92ProjectionSerializedRegion,
  projection: B92ProjectionSerializedResult
): string | undefined {
  if (region.status !== "unresolved") return undefined;
  const matched = projection.unresolvedReasons
    .flatMap((summary) => summary.items)
    .find((item) => item.fieldId === region.fieldId && (!item.edge || item.edge === region.edge));
  return matched ? `${matched.reason}: ${matched.note}` : "unresolved projection geometry";
}

export function formatB92ProjectionOverlayRegionLabel(
  region: Pick<B92ProjectionOverlayDiagnosticRegion, "id" | "category" | "status" | "unresolvedReason">
): string {
  const base = `Datum projection diagnostic: ${region.category} (${region.status})`;
  return region.unresolvedReason ? `${base} - ${region.unresolvedReason}` : base;
}

export function buildB92ProjectionOverlayDiagnosticRegions(input: {
  metadata?: unknown;
  devReports?: unknown;
  enabled?: boolean;
}): B92ProjectionOverlayDiagnosticResult {
  const enabled = input.enabled === true;
  const surface = extractB92DatumProjectionDiagnostics(input);
  const projections = listB92DatumProjectionDiagnosticSerializedResults(input);

  if (!enabled) {
    return {
      enabled: false,
      diagnosticOnly: true,
      regions: [],
      note: "B92 projection overlay diagnostics are disabled. Default preview output is unchanged.",
    };
  }

  if (!surface.found) {
    return {
      enabled,
      diagnosticOnly: true,
      regions: [],
      note: "B92 projection diagnostics metadata was not found.",
    };
  }

  const regions = projections.flatMap((projection) =>
    projection.regions.map((region) => {
      const unresolvedReason = unresolvedReasonForRegion(region, projection);
      const overlayRegion: B92ProjectionOverlayDiagnosticRegion = {
        id: region.id,
        category: region.category,
        status: region.status,
        boundsMm: region.boundsMm,
        label: "",
        unresolvedReason,
        diagnosticOnly: true,
      };
      return {
        ...overlayRegion,
        label: formatB92ProjectionOverlayRegionLabel(overlayRegion),
      };
    })
  );

  return {
    enabled,
    diagnosticOnly: true,
    regions,
    note:
      "Read-only B92 datum projection overlay data. Existing renderer geometry remains authoritative; this output is not wired to SVG/UI.",
  };
}
