import type { B92ProjectionEngineResult } from "./b92ProjectionEngine";
import type {
  B92ProjectedDrawableRegion,
  B92ProjectedDrawableRegionCategory,
  B92ProjectionBoundsMm,
  B92ProjectionResolutionStatus,
  B92ProjectionUnresolvedItem,
  B92ProjectionUnresolvedReason,
} from "./b92DatumProjection.types";

export type B92ProjectionRegionDebugSummary = {
  total: number;
  byCategory: Partial<Record<B92ProjectedDrawableRegionCategory, number>>;
  byStatus: Partial<Record<B92ProjectionResolutionStatus, number>>;
  withBounds: number;
  withoutBounds: number;
};

export type B92ProjectionUnresolvedReasonSummary = {
  reason: B92ProjectionUnresolvedReason;
  count: number;
  items: B92ProjectionUnresolvedItem[];
};

export type B92ProjectionSerializedRegion = Pick<
  B92ProjectedDrawableRegion,
  "id" | "category" | "visibility" | "fieldId" | "edge" | "meetingSide" | "ownerRole" | "profileId" | "datumChainId" | "status" | "note"
> & {
  boundsMm: B92ProjectionBoundsMm | null;
};

export type B92ProjectionSerializedResult = {
  view: B92ProjectionEngineResult["plan"]["view"];
  note?: string;
  regionSummary: B92ProjectionRegionDebugSummary;
  regions: B92ProjectionSerializedRegion[];
  unresolvedReasons: B92ProjectionUnresolvedReasonSummary[];
};

export type B92ProjectedRegionBoundsComparison = {
  regionId: string;
  expectedBoundsMm: B92ProjectionBoundsMm | null;
  actualBoundsMm: B92ProjectionBoundsMm | null;
  deltasMm: B92ProjectionBoundsMm | null;
  matches: boolean;
  note?: string;
};

function emptyCategoryCounts(): Partial<Record<B92ProjectedDrawableRegionCategory, number>> {
  return {};
}

function emptyStatusCounts(): Partial<Record<B92ProjectionResolutionStatus, number>> {
  return {};
}

function increment<T extends string>(counts: Partial<Record<T, number>>, key: T): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function cloneBounds(bounds: B92ProjectionBoundsMm | undefined): B92ProjectionBoundsMm | null {
  if (!bounds) return null;
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function deltaBounds(
  expected: B92ProjectionBoundsMm,
  actual: B92ProjectionBoundsMm
): B92ProjectionBoundsMm {
  return {
    x: actual.x - expected.x,
    y: actual.y - expected.y,
    width: actual.width - expected.width,
    height: actual.height - expected.height,
  };
}

function boundsMatch(
  expected: B92ProjectionBoundsMm,
  actual: B92ProjectionBoundsMm,
  toleranceMm: number
): boolean {
  const delta = deltaBounds(expected, actual);
  return (
    Math.abs(delta.x) <= toleranceMm &&
    Math.abs(delta.y) <= toleranceMm &&
    Math.abs(delta.width) <= toleranceMm &&
    Math.abs(delta.height) <= toleranceMm
  );
}

export function summarizeB92ProjectionRegions(
  regions: readonly B92ProjectedDrawableRegion[]
): B92ProjectionRegionDebugSummary {
  const byCategory = emptyCategoryCounts();
  const byStatus = emptyStatusCounts();
  let withBounds = 0;

  for (const region of regions) {
    increment(byCategory, region.category);
    increment(byStatus, region.status);
    if (region.boundsMm) withBounds += 1;
  }

  return {
    total: regions.length,
    byCategory,
    byStatus,
    withBounds,
    withoutBounds: regions.length - withBounds,
  };
}

export function listB92ProjectionUnresolvedReasons(
  unresolved: readonly B92ProjectionUnresolvedItem[]
): B92ProjectionUnresolvedReasonSummary[] {
  const byReason = new Map<B92ProjectionUnresolvedReason, B92ProjectionUnresolvedItem[]>();

  for (const item of unresolved) {
    const items = byReason.get(item.reason) ?? [];
    items.push({ ...item });
    byReason.set(item.reason, items);
  }

  return Array.from(byReason.entries())
    .map(([reason, items]) => ({
      reason,
      count: items.length,
      items,
    }))
    .sort((a, b) => a.reason.localeCompare(b.reason));
}

export function serializeB92ProjectionEngineResult(
  result: B92ProjectionEngineResult
): B92ProjectionSerializedResult {
  const regions = result.projectedRegions.map((region): B92ProjectionSerializedRegion => ({
    id: region.id,
    category: region.category,
    visibility: region.visibility,
    fieldId: region.fieldId,
    edge: region.edge,
    meetingSide: region.meetingSide,
    ownerRole: region.ownerRole,
    profileId: region.profileId,
    datumChainId: region.datumChainId,
    status: region.status,
    note: region.note,
    boundsMm: cloneBounds(region.boundsMm),
  }));

  return {
    view: result.plan.view,
    note: result.plan.note,
    regionSummary: summarizeB92ProjectionRegions(result.projectedRegions),
    regions,
    unresolvedReasons: listB92ProjectionUnresolvedReasons(result.unresolved),
  };
}

export function compareB92ProjectedRegionBounds(
  expected: B92ProjectedDrawableRegion,
  actual: B92ProjectedDrawableRegion,
  toleranceMm = 0
): B92ProjectedRegionBoundsComparison {
  const expectedBoundsMm = cloneBounds(expected.boundsMm);
  const actualBoundsMm = cloneBounds(actual.boundsMm);

  if (!expectedBoundsMm || !actualBoundsMm) {
    return {
      regionId: actual.id,
      expectedBoundsMm,
      actualBoundsMm,
      deltasMm: null,
      matches: expectedBoundsMm === actualBoundsMm,
      note: "One or both regions do not have projected bounds.",
    };
  }

  return {
    regionId: actual.id,
    expectedBoundsMm,
    actualBoundsMm,
    deltasMm: deltaBounds(expectedBoundsMm, actualBoundsMm),
    matches: boundsMatch(expectedBoundsMm, actualBoundsMm, toleranceMm),
  };
}

export function formatB92ProjectionDebugReport(result: B92ProjectionEngineResult): string {
  const serialized = serializeB92ProjectionEngineResult(result);
  const lines = [
    "B92 Projection Debug Report",
    `view: ${serialized.view}`,
    `regions: ${serialized.regionSummary.total}`,
    `withBounds: ${serialized.regionSummary.withBounds}`,
    `withoutBounds: ${serialized.regionSummary.withoutBounds}`,
    `byCategory: ${JSON.stringify(serialized.regionSummary.byCategory)}`,
    `byStatus: ${JSON.stringify(serialized.regionSummary.byStatus)}`,
    `unresolved: ${result.unresolved.length}`,
  ];

  for (const summary of serialized.unresolvedReasons) {
    lines.push(`unresolved.${summary.reason}: ${summary.count}`);
  }

  return lines.join("\n");
}
