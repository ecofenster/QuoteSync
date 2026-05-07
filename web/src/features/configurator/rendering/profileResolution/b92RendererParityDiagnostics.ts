import type { B92ProjectionEngineResult } from "./b92ProjectionEngine";
import {
  compareB92ProjectedRegionBounds,
  listB92ProjectionUnresolvedReasons,
  summarizeB92ProjectionRegions,
  type B92ProjectedRegionBoundsComparison,
  type B92ProjectionUnresolvedReasonSummary,
} from "./b92ProjectionDebug";
import type {
  B92ProjectedDrawableRegion,
  B92ProjectedDrawableRegionCategory,
  B92ProjectionBoundsMm,
} from "./b92DatumProjection.types";

/**
 * Read-only B92 renderer parity diagnostics.
 *
 * This file is for future controlled renderer migration diagnostics only. It
 * compares plain projected bounds to plain renderer-like bounds supplied by a
 * caller. It must not import renderer/SVG/UI/drawing-model modules, must not
 * become geometry authority, and must not replace renderer geometry here.
 */

export type B92RendererParityRegion = {
  id: string;
  category?: B92ProjectedDrawableRegionCategory | string;
  role?: string;
  fieldId?: string;
  edge?: string;
  boundsMm: B92ProjectionBoundsMm | null;
  note?: string;
};

export type B92RendererParityMatchKey = "id" | "category" | "role";

export type B92RendererParityComparison = {
  projectionRegionId: string;
  rendererRegionId?: string;
  category?: B92ProjectedDrawableRegionCategory | string;
  role?: string;
  status: "matched" | "projection_unresolved" | "renderer_missing" | "projection_missing" | "bounds_mismatch";
  boundsComparison?: B92ProjectedRegionBoundsComparison;
  note?: string;
};

export type B92RendererParityReport = {
  toleranceMm: number;
  matchKey: B92RendererParityMatchKey;
  projectionSummary: ReturnType<typeof summarizeB92ProjectionRegions>;
  unresolvedReasons: B92ProjectionUnresolvedReasonSummary[];
  comparisons: B92RendererParityComparison[];
  totals: {
    matched: number;
    projectionUnresolved: number;
    rendererMissing: number;
    projectionMissing: number;
    boundsMismatch: number;
  };
};

function keyForProjected(region: B92ProjectedDrawableRegion, matchKey: B92RendererParityMatchKey): string {
  if (matchKey === "category") return region.category;
  if (matchKey === "role") return region.category;
  return region.id;
}

function keyForRenderer(region: B92RendererParityRegion, matchKey: B92RendererParityMatchKey): string {
  if (matchKey === "category") return String(region.category ?? region.role ?? region.id);
  if (matchKey === "role") return String(region.role ?? region.category ?? region.id);
  return region.id;
}

function rendererAsProjected(region: B92RendererParityRegion): B92ProjectedDrawableRegion {
  return {
    id: region.id,
    category: (region.category ?? "structural_frame_datum") as B92ProjectedDrawableRegionCategory,
    visibility: "construction",
    boundsMm: region.boundsMm ?? undefined,
    fieldId: region.fieldId,
    edge: region.edge as B92ProjectedDrawableRegion["edge"],
    status: region.boundsMm ? "resolved" : "unresolved",
    note: region.note,
  };
}

function countTotals(comparisons: B92RendererParityComparison[]): B92RendererParityReport["totals"] {
  return {
    matched: comparisons.filter((item) => item.status === "matched").length,
    projectionUnresolved: comparisons.filter((item) => item.status === "projection_unresolved").length,
    rendererMissing: comparisons.filter((item) => item.status === "renderer_missing").length,
    projectionMissing: comparisons.filter((item) => item.status === "projection_missing").length,
    boundsMismatch: comparisons.filter((item) => item.status === "bounds_mismatch").length,
  };
}

export function compareB92ProjectionToRendererRegions(input: {
  projection: B92ProjectionEngineResult;
  rendererRegions: readonly B92RendererParityRegion[];
  toleranceMm?: number;
  matchKey?: B92RendererParityMatchKey;
}): B92RendererParityReport {
  const toleranceMm = input.toleranceMm ?? 0;
  const matchKey = input.matchKey ?? "id";
  const rendererByKey = new Map(input.rendererRegions.map((region) => [keyForRenderer(region, matchKey), region]));
  const projectedByKey = new Map(input.projection.projectedRegions.map((region) => [keyForProjected(region, matchKey), region]));
  const comparisons: B92RendererParityComparison[] = [];

  for (const projected of input.projection.projectedRegions) {
    const key = keyForProjected(projected, matchKey);
    const renderer = rendererByKey.get(key);

    if (projected.status !== "resolved" || !projected.boundsMm) {
      comparisons.push({
        projectionRegionId: projected.id,
        rendererRegionId: renderer?.id,
        category: projected.category,
        role: renderer?.role,
        status: "projection_unresolved",
        note: "Projected region is intentionally unresolved and should not be treated as a renderer mismatch.",
      });
      continue;
    }

    if (!renderer) {
      comparisons.push({
        projectionRegionId: projected.id,
        category: projected.category,
        status: "renderer_missing",
        note: "No renderer-like region was supplied for this projected region.",
      });
      continue;
    }

    const boundsComparison = compareB92ProjectedRegionBounds(projected, rendererAsProjected(renderer), toleranceMm);
    comparisons.push({
      projectionRegionId: projected.id,
      rendererRegionId: renderer.id,
      category: projected.category,
      role: renderer.role,
      status: boundsComparison.matches ? "matched" : "bounds_mismatch",
      boundsComparison,
    });
  }

  for (const renderer of input.rendererRegions) {
    const key = keyForRenderer(renderer, matchKey);
    if (projectedByKey.has(key)) continue;
    comparisons.push({
      projectionRegionId: "",
      rendererRegionId: renderer.id,
      category: renderer.category,
      role: renderer.role,
      status: "projection_missing",
      note: "Renderer-like region has no projected counterpart for the selected match key.",
    });
  }

  return {
    toleranceMm,
    matchKey,
    projectionSummary: summarizeB92ProjectionRegions(input.projection.projectedRegions),
    unresolvedReasons: listB92ProjectionUnresolvedReasons(input.projection.unresolved),
    comparisons,
    totals: countTotals(comparisons),
  };
}

export function formatB92RendererParityReport(report: B92RendererParityReport): string {
  return [
    "B92 Renderer Parity Diagnostics",
    `matchKey: ${report.matchKey}`,
    `toleranceMm: ${report.toleranceMm}`,
    `projectedRegions: ${report.projectionSummary.total}`,
    `projectedWithBounds: ${report.projectionSummary.withBounds}`,
    `projectedWithoutBounds: ${report.projectionSummary.withoutBounds}`,
    `matched: ${report.totals.matched}`,
    `boundsMismatch: ${report.totals.boundsMismatch}`,
    `rendererMissing: ${report.totals.rendererMissing}`,
    `projectionMissing: ${report.totals.projectionMissing}`,
    `projectionUnresolved: ${report.totals.projectionUnresolved}`,
    `unresolvedReasons: ${report.unresolvedReasons.map((item) => `${item.reason}:${item.count}`).join(", ")}`,
  ].join("\n");
}
