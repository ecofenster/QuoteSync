import type { B92DatumMm, B92Edge } from "./b92DatumGeometry.types";
import type {
  B92DatumProjectionPlan,
  B92ProjectedDrawableRegion,
  B92ProjectedGlassOrderGeometry,
  B92ProjectionBoundsMm,
  B92ProjectionDatumChain,
  B92ProjectionUnresolvedItem,
} from "./b92DatumProjection.types";

export type B92ProjectionEngineFieldBounds = Record<string, B92ProjectionBoundsMm>;

export type B92ProjectionEngineInput = {
  plan: B92DatumProjectionPlan;
  fieldBoundsById: B92ProjectionEngineFieldBounds;
};

export type B92ProjectionEngineResult = {
  plan: B92DatumProjectionPlan;
  projectedRegions: B92ProjectedDrawableRegion[];
  unresolved: B92ProjectionUnresolvedItem[];
};

/**
 * Pure B92 projection-engine skeleton.
 *
 * This module is deliberately detached from SVG, drawing models, adapters, UI,
 * and resolver routing. It only enriches datum projection plans with structural
 * millimetre bounds where the current confirmed internal datum authority is
 * sufficient. Unknown sash placement, meeting ownership, and external-view
 * projection remain unresolved.
 */

function edgeBand(bounds: B92ProjectionBoundsMm, edge: B92Edge, valueMm: number): B92ProjectionBoundsMm {
  if (edge === "top") {
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: valueMm };
  }
  if (edge === "bottom") {
    return { x: bounds.x, y: bounds.y + bounds.height - valueMm, width: bounds.width, height: valueMm };
  }
  if (edge === "left") {
    return { x: bounds.x, y: bounds.y, width: valueMm, height: bounds.height };
  }
  return { x: bounds.x + bounds.width - valueMm, y: bounds.y, width: valueMm, height: bounds.height };
}

function offsetEdgeBand(
  bounds: B92ProjectionBoundsMm,
  edge: B92Edge,
  offsetMm: number,
  valueMm: number
): B92ProjectionBoundsMm {
  if (edge === "top") {
    return { x: bounds.x, y: bounds.y + offsetMm, width: bounds.width, height: valueMm };
  }
  if (edge === "bottom") {
    return {
      x: bounds.x,
      y: bounds.y + bounds.height - offsetMm - valueMm,
      width: bounds.width,
      height: valueMm,
    };
  }
  if (edge === "left") {
    return { x: bounds.x + offsetMm, y: bounds.y, width: valueMm, height: bounds.height };
  }
  return {
    x: bounds.x + bounds.width - offsetMm - valueMm,
    y: bounds.y,
    width: valueMm,
    height: bounds.height,
  };
}

function hiddenBandAfterVisible(
  bounds: B92ProjectionBoundsMm,
  edge: B92Edge,
  visibleFaceMm: number,
  hiddenBehindSashMm: number
): B92ProjectionBoundsMm {
  if (edge === "top") {
    return { x: bounds.x, y: bounds.y + visibleFaceMm, width: bounds.width, height: hiddenBehindSashMm };
  }
  if (edge === "bottom") {
    return {
      x: bounds.x,
      y: bounds.y + bounds.height - visibleFaceMm - hiddenBehindSashMm,
      width: bounds.width,
      height: hiddenBehindSashMm,
    };
  }
  if (edge === "left") {
    return { x: bounds.x + visibleFaceMm, y: bounds.y, width: hiddenBehindSashMm, height: bounds.height };
  }
  return {
    x: bounds.x + bounds.width - visibleFaceMm - hiddenBehindSashMm,
    y: bounds.y,
    width: hiddenBehindSashMm,
    height: bounds.height,
  };
}

function isFinitePositiveMm(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function confirmedValue(value: B92DatumMm | undefined): number | null {
  if (!value || value.status !== "confirmed" || !isFinitePositiveMm(value.valueMm)) return null;
  return value.valueMm;
}

function unresolved(input: Omit<B92ProjectionUnresolvedItem, "id"> & { id: string }): B92ProjectionUnresolvedItem {
  return input;
}

function chainForRegion(
  chains: B92ProjectionDatumChain[],
  region: B92ProjectedDrawableRegion
): B92ProjectionDatumChain | null {
  return chains.find((chain) => chain.id === region.datumChainId || chain.fieldId === region.fieldId) ?? null;
}

function projectFrameRegion(
  region: B92ProjectedDrawableRegion,
  chain: B92ProjectionDatumChain,
  fieldBounds: B92ProjectionBoundsMm
): { region: B92ProjectedDrawableRegion; unresolved?: B92ProjectionUnresolvedItem } {
  const edge = region.edge;
  if (!edge) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-edge`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        note: "Frame projection region is missing edge authority.",
      }),
    };
  }

  const authority = chain.edgeAuthorities[edge];
  const valueMm =
    region.category === "structural_frame_datum"
      ? confirmedValue(authority?.structuralFaceMm)
      : confirmedValue(authority?.visibleFaceMm);

  if (valueMm === null) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-confirmed-frame-datum`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        edge,
        note: `No confirmed ${region.category} datum is available for this edge.`,
      }),
    };
  }

  return {
    region: {
      ...region,
      boundsMm: edgeBand(fieldBounds, edge, valueMm),
      status: "resolved",
    },
  };
}

function projectHiddenRebateRegion(
  region: B92ProjectedDrawableRegion,
  chain: B92ProjectionDatumChain,
  fieldBounds: B92ProjectionBoundsMm
): { region: B92ProjectedDrawableRegion; unresolved?: B92ProjectionUnresolvedItem } {
  const edge = region.edge;
  if (!edge) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-edge`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        note: "Hidden/rebate projection region is missing edge authority.",
      }),
    };
  }

  const authority = chain.edgeAuthorities[edge];
  const visibleFaceMm = confirmedValue(authority?.visibleFaceMm);
  const hiddenBehindSashMm = confirmedValue(authority?.hiddenBehindSashMm);

  if (visibleFaceMm === null || hiddenBehindSashMm === null) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-confirmed-hidden-datum`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        edge,
        note: "Hidden/rebate projection requires confirmed visible face and hidden-behind-sash datum values.",
      }),
    };
  }

  return {
    region: {
      ...region,
      boundsMm: hiddenBandAfterVisible(fieldBounds, edge, visibleFaceMm, hiddenBehindSashMm),
      status: "resolved",
    },
  };
}

function projectSashFaceRegion(
  region: B92ProjectedDrawableRegion,
  chain: B92ProjectionDatumChain,
  fieldBounds: B92ProjectionBoundsMm
): { region: B92ProjectedDrawableRegion; unresolved?: B92ProjectionUnresolvedItem } {
  const edge = region.edge;
  if (!edge) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-edge`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        note: "Sash face projection region is missing edge authority.",
      }),
    };
  }
  if (edge === "bottom") {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:bottom-placement-unresolved`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        edge,
        note: "Bottom sash face placement depends on the unconfirmed bottom sash overlay/rebate relationship.",
      }),
    };
  }

  const authority = chain.edgeAuthorities[edge];
  const visibleFaceMm = confirmedValue(authority?.visibleFaceMm);
  const hiddenBehindSashMm = confirmedValue(authority?.hiddenBehindSashMm);
  const sashFaceStep = chain.steps.find((step) => step.kind === "sash_face" && step.edge === edge);
  const sashFaceMm = confirmedValue(sashFaceStep?.valueMm);

  if (visibleFaceMm === null || hiddenBehindSashMm === null || sashFaceMm === null) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-confirmed-sash-datum`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        edge,
        note: "Sash face projection requires confirmed visible frame, hidden/rebate, and sash face datum values.",
      }),
    };
  }

  return {
    region: {
      ...region,
      boundsMm: offsetEdgeBand(fieldBounds, edge, visibleFaceMm, sashFaceMm),
      status: "resolved",
      note: `${region.note ?? ""} Projected from confirmed top/side visible frame datum plus 57mm sash face; no uniform overlap assumed.`.trim(),
    },
  };
}

function projectBeadRegion(
  region: B92ProjectedDrawableRegion,
  chain: B92ProjectionDatumChain,
  fieldBounds: B92ProjectionBoundsMm
): { region: B92ProjectedDrawableRegion; unresolved?: B92ProjectionUnresolvedItem } {
  const edge = region.edge;
  if (!edge) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-edge`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        note: "Bead projection region is missing edge authority.",
      }),
    };
  }
  if (edge === "bottom") {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:bottom-placement-unresolved`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        edge,
        note: "Bottom bead placement depends on the unconfirmed bottom sash overlay/rebate relationship.",
      }),
    };
  }

  const authority = chain.edgeAuthorities[edge];
  const visibleFaceMm = confirmedValue(authority?.visibleFaceMm);
  const hiddenBehindSashMm = confirmedValue(authority?.hiddenBehindSashMm);
  const sashFaceStep = chain.steps.find((step) => step.kind === "sash_face" && step.edge === edge);
  const sashFaceMm = confirmedValue(sashFaceStep?.valueMm);
  const beadFaceMm = confirmedValue(authority?.beadFaceMm);

  if (visibleFaceMm === null || hiddenBehindSashMm === null || sashFaceMm === null || beadFaceMm === null) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-confirmed-bead-datum`,
        reason: "missing_datum_authority",
        fieldId: region.fieldId,
        edge,
        note: "Bead projection requires confirmed visible frame, hidden/rebate, sash face, and bead datum values.",
      }),
    };
  }

  return {
    region: {
      ...region,
      boundsMm: offsetEdgeBand(fieldBounds, edge, visibleFaceMm + sashFaceMm, beadFaceMm),
      status: "resolved",
      note: `${region.note ?? ""} Projected from confirmed sash face plus 21mm bead/glass offset; no bottom relationship inferred.`.trim(),
    },
  };
}

function unresolvedSashOrOpeningRegion(region: B92ProjectedDrawableRegion): {
  region: B92ProjectedDrawableRegion;
  unresolved: B92ProjectionUnresolvedItem;
} {
  const reason =
    region.category === "daylight_opening" || region.category === "glass_order"
      ? "not_projected_yet"
      : "missing_datum_authority";

  return {
    region: { ...region, status: "unresolved" },
    unresolved: unresolved({
      id: `${region.id}:projection-unresolved`,
      reason,
      fieldId: region.fieldId,
      edge: region.edge,
      note:
        region.category === "daylight_opening" || region.category === "glass_order"
          ? "Daylight/glass-order bounds require bottom sash overlay/rebate authority before a full rectangle can be projected."
          : "Sash/bead bounds require explicit per-edge sash placement; uniform overlap must not be inferred.",
    }),
  };
}

function projectRegion(
  region: B92ProjectedDrawableRegion,
  chains: B92ProjectionDatumChain[],
  fieldBoundsById: B92ProjectionEngineFieldBounds
): { region: B92ProjectedDrawableRegion; unresolved?: B92ProjectionUnresolvedItem } {
  const chain = chainForRegion(chains, region);
  const fieldId = region.fieldId ?? chain?.fieldId ?? null;
  const fieldBounds = fieldId ? fieldBoundsById[fieldId] : undefined;

  if (!chain || !fieldId || !fieldBounds) {
    return {
      region: { ...region, status: "unresolved" },
      unresolved: unresolved({
        id: `${region.id}:missing-field-bounds`,
        reason: "missing_datum_authority",
        fieldId: fieldId ?? undefined,
        edge: region.edge,
        note: "Projection requires explicit structural field bounds supplied to the non-rendering engine.",
      }),
    };
  }

  if (region.category === "structural_frame_datum" || region.category === "visible_frame_face") {
    return projectFrameRegion(region, chain, fieldBounds);
  }
  if (region.category === "hidden_frame_rebate") {
    return projectHiddenRebateRegion(region, chain, fieldBounds);
  }
  if (region.category === "visible_sash_body") {
    return projectSashFaceRegion(region, chain, fieldBounds);
  }
  if (region.category === "bead") {
    return projectBeadRegion(region, chain, fieldBounds);
  }
  if (region.category === "daylight_opening" || region.category === "glass_order") {
    return unresolvedSashOrOpeningRegion(region);
  }

  return {
    region: { ...region, status: "unresolved" },
    unresolved: unresolved({
      id: `${region.id}:unsupported-projection-category`,
      reason: region.category === "meeting_profile" || region.category === "meeting_ownership"
        ? "unknown_meeting_geometry"
        : "not_projected_yet",
      fieldId,
      edge: region.edge,
      note: "This region category is intentionally not projected by the single-field internal engine skeleton.",
    }),
  };
}

function dedupeUnresolved(items: B92ProjectionUnresolvedItem[]): B92ProjectionUnresolvedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function projectB92DatumProjectionPlan(input: B92ProjectionEngineInput): B92ProjectionEngineResult {
  const { plan, fieldBoundsById } = input;
  const unresolvedItems: B92ProjectionUnresolvedItem[] = [...plan.unresolved];

  if (plan.view !== "internal") {
    unresolvedItems.push(
      unresolved({
        id: "b92-projection-engine:external-view-unsupported",
        reason: "unsupported_view_divergence",
        note: "External-view geometry is not projected by this non-rendering skeleton.",
      })
    );
    return {
      plan: {
        ...plan,
        regions: plan.regions.map((region) => ({ ...region, status: "unresolved" })),
        unresolved: dedupeUnresolved(unresolvedItems),
      },
      projectedRegions: [],
      unresolved: dedupeUnresolved(unresolvedItems),
    };
  }

  const projectedRegions = plan.regions.map((region) => {
    const result = projectRegion(region, plan.fieldChains, fieldBoundsById);
    if (result.unresolved) unresolvedItems.push(result.unresolved);
    return result.region;
  });

  const unresolvedResult = dedupeUnresolved(unresolvedItems);
  return {
    plan: {
      ...plan,
      regions: projectedRegions,
      unresolved: unresolvedResult,
    },
    projectedRegions,
    unresolved: unresolvedResult,
  };
}

export function assertProjectedRegionBounds(region: B92ProjectedDrawableRegion): void {
  if (!region.boundsMm) {
    throw new Error(`Projected region ${region.id} has no bounds.`);
  }
  const { x, y, width, height } = region.boundsMm;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error(`Projected region ${region.id} has invalid bounds.`);
  }
}

export function assertGlassOrderExpansion(
  daylight: B92ProjectedDrawableRegion,
  glassOrder: B92ProjectedGlassOrderGeometry
): void {
  if (!daylight.boundsMm || !glassOrder.boundsMm) {
    throw new Error("Glass order expansion assertion requires projected daylight and glass order bounds.");
  }
  const widthDelta = glassOrder.boundsMm.width - daylight.boundsMm.width;
  const heightDelta = glassOrder.boundsMm.height - daylight.boundsMm.height;
  if (widthDelta !== 26 || heightDelta !== 26) {
    throw new Error("B92 glass order bounds must be 26mm wider and 26mm taller than daylight opening.");
  }
  if (glassOrder.orderExpansionMm?.biteBehindBeadMm.valueMm !== 13) {
    throw new Error("B92 glass order bite behind bead must remain 13mm each side.");
  }
}

export function assertProjectionCompleteness(result: B92ProjectionEngineResult): void {
  for (const region of result.projectedRegions) {
    if (region.status === "resolved") assertProjectedRegionBounds(region);
  }
  if (result.projectedRegions.some((region) => region.category === "meeting_ownership" && region.status === "resolved")) {
    throw new Error("B92 projection engine skeleton must not resolve meeting ownership geometry.");
  }
  if (result.projectedRegions.some((region) => region.category === "meeting_profile" && region.status === "resolved")) {
    throw new Error("B92 projection engine skeleton must not resolve detailed meeting profile geometry.");
  }
}
