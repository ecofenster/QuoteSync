import type { B92ProjectionEngineResult } from "./b92ProjectionEngine";
import {
  B92_INTERNAL_SECTION_DATUM_AUTHORITY_REGISTER,
  listB92InternalSectionDatumAuthorities,
} from "./b92DatumGeometryRegister";
import type {
  B92DatumChainProjectionStatus,
  B92InternalSectionDatumAuthority,
  B92InternalSectionDatumProfileId,
  B92InternalSectionDatumRole,
} from "./b92DatumGeometry.types";
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

export type B92SectionAuthorityStackDiagnosticStatus = "complete" | "partial" | "unresolved" | "conflict";

export type B92SectionAuthorityStackSegmentDiagnostic = {
  index: number;
  valueMm: number;
  status: B92InternalSectionDatumAuthority["sectionStatus"];
  note?: string;
};

export type B92SectionAuthorityProjectionDiagnostic = {
  profileId: B92InternalSectionDatumProfileId;
  role: B92InternalSectionDatumRole;
  sectionStatus: B92InternalSectionDatumAuthority["sectionStatus"];
  projectionStatus: B92DatumChainProjectionStatus;
  stackStatus: B92SectionAuthorityStackDiagnosticStatus;
  stackMm: B92SectionAuthorityStackSegmentDiagnostic[];
  registeredTotalMm: number | null;
  computedTotalMm: number | null;
  totalMatches: boolean | null;
  confirmedRules: string[];
  unresolvedRequirements: string[];
  conflictNotes: string[];
  note?: string;
};

export type B92SectionAuthorityProjectionDiagnosticSummary = {
  total: number;
  byRole: Partial<Record<B92InternalSectionDatumRole, number>>;
  byProjectionStatus: Partial<Record<B92DatumChainProjectionStatus, number>>;
  byStackStatus: Partial<Record<B92SectionAuthorityStackDiagnosticStatus, number>>;
  stackTotalsChecked: number;
  stackTotalMismatches: number;
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

function sumMm(values: readonly B92SectionAuthorityStackSegmentDiagnostic[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value.valueMm, 0);
  return Number.isFinite(total) ? total : null;
}

function totalsMatch(registeredTotalMm: number | null, computedTotalMm: number | null): boolean | null {
  if (registeredTotalMm === null || computedTotalMm === null) return null;
  return Math.abs(registeredTotalMm - computedTotalMm) < 0.0001;
}

function sectionStackStatus(input: {
  authority: B92InternalSectionDatumAuthority;
  computedTotalMm: number | null;
  registeredTotalMm: number | null;
  totalMatches: boolean | null;
}): B92SectionAuthorityStackDiagnosticStatus {
  if (input.authority.conflictNotes && input.authority.conflictNotes.length > 0) return "conflict";
  if (input.totalMatches === false) return "conflict";
  if (input.authority.stackMm && input.authority.stackMm.length > 0 && input.totalMatches === true) return "complete";
  if (input.authority.stackMm && input.authority.stackMm.length > 0 && input.computedTotalMm !== null) return "partial";
  if (input.authority.confirmedRules.length > 0 || input.authority.unresolvedRequirements.length > 0) return "partial";
  return "unresolved";
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

export function buildB92SectionAuthorityProjectionDiagnostic(
  authority: B92InternalSectionDatumAuthority
): B92SectionAuthorityProjectionDiagnostic {
  const stackMm = (authority.stackMm ?? []).map((segment, index) => ({
    index,
    valueMm: segment.valueMm,
    status: segment.status,
    note: segment.note,
  }));
  const registeredTotalMm = authority.totalMm?.valueMm ?? null;
  const computedTotalMm = sumMm(stackMm);
  const totalMatches = totalsMatch(registeredTotalMm, computedTotalMm);

  return {
    profileId: authority.profileId,
    role: authority.role,
    sectionStatus: authority.sectionStatus,
    projectionStatus: authority.projectionStatus,
    stackStatus: sectionStackStatus({ authority, computedTotalMm, registeredTotalMm, totalMatches }),
    stackMm,
    registeredTotalMm,
    computedTotalMm,
    totalMatches,
    confirmedRules: [...authority.confirmedRules],
    unresolvedRequirements: [...authority.unresolvedRequirements],
    conflictNotes: authority.conflictNotes ? [...authority.conflictNotes] : [],
    note: authority.note,
  };
}

export function buildB92InternalSectionAuthorityProjectionDiagnostics(input?: {
  role?: B92InternalSectionDatumRole | B92InternalSectionDatumRole[];
  projectionStatus?: B92DatumChainProjectionStatus | B92DatumChainProjectionStatus[];
}): B92SectionAuthorityProjectionDiagnostic[] {
  return listB92InternalSectionDatumAuthorities(input).map(buildB92SectionAuthorityProjectionDiagnostic);
}

export function getB92InternalSectionAuthorityProjectionDiagnostic(
  profileId: B92InternalSectionDatumProfileId
): B92SectionAuthorityProjectionDiagnostic {
  return buildB92SectionAuthorityProjectionDiagnostic(B92_INTERNAL_SECTION_DATUM_AUTHORITY_REGISTER[profileId]);
}

export function summarizeB92SectionAuthorityProjectionDiagnostics(
  diagnostics: readonly B92SectionAuthorityProjectionDiagnostic[] =
    buildB92InternalSectionAuthorityProjectionDiagnostics()
): B92SectionAuthorityProjectionDiagnosticSummary {
  const byRole: Partial<Record<B92InternalSectionDatumRole, number>> = {};
  const byProjectionStatus: Partial<Record<B92DatumChainProjectionStatus, number>> = {};
  const byStackStatus: Partial<Record<B92SectionAuthorityStackDiagnosticStatus, number>> = {};
  let stackTotalsChecked = 0;
  let stackTotalMismatches = 0;

  for (const diagnostic of diagnostics) {
    increment(byRole, diagnostic.role);
    increment(byProjectionStatus, diagnostic.projectionStatus);
    increment(byStackStatus, diagnostic.stackStatus);
    if (diagnostic.totalMatches !== null) stackTotalsChecked += 1;
    if (diagnostic.totalMatches === false) stackTotalMismatches += 1;
  }

  return {
    total: diagnostics.length,
    byRole,
    byProjectionStatus,
    byStackStatus,
    stackTotalsChecked,
    stackTotalMismatches,
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

export function formatB92SectionAuthorityProjectionDebugReport(
  diagnostics: readonly B92SectionAuthorityProjectionDiagnostic[] =
    buildB92InternalSectionAuthorityProjectionDiagnostics()
): string {
  const summary = summarizeB92SectionAuthorityProjectionDiagnostics(diagnostics);
  const lines = [
    "B92 Section Authority Projection Diagnostics",
    "diagnosticOnly: true",
    "drawableGeometry: false",
    `sections: ${summary.total}`,
    `byRole: ${JSON.stringify(summary.byRole)}`,
    `byProjectionStatus: ${JSON.stringify(summary.byProjectionStatus)}`,
    `byStackStatus: ${JSON.stringify(summary.byStackStatus)}`,
    `stackTotalsChecked: ${summary.stackTotalsChecked}`,
    `stackTotalMismatches: ${summary.stackTotalMismatches}`,
  ];

  for (const diagnostic of diagnostics) {
    lines.push(
      `${diagnostic.profileId}: role=${diagnostic.role}, stack=${diagnostic.stackStatus}, projection=${diagnostic.projectionStatus}, total=${diagnostic.computedTotalMm ?? "n/a"}/${diagnostic.registeredTotalMm ?? "n/a"}`
    );
  }

  return lines.join("\n");
}
