import type { B92DatumMm, B92Edge, B92FieldDatumGeometry } from "./b92DatumGeometry.types";
import {
  B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY,
  B92_INTERNAL_SASH_FIELD_DATUM_GEOMETRY,
} from "./b92DatumGeometryRegister";
import type {
  B92DatumProjectionPlan,
  B92ProjectedDrawableRegion,
  B92ProjectedGlassOrderGeometry,
  B92ProjectionDatumChain,
  B92ProjectionDatumStep,
  B92ProjectionEdgeAuthority,
  B92ProjectionResolutionStatus,
  B92ProjectionUnresolvedItem,
  B92ProjectionView,
} from "./b92DatumProjection.types";

const B92_EDGES: B92Edge[] = ["top", "bottom", "left", "right"];

/**
 * Static B92 projection fixture layer only.
 *
 * This proves datum authority can be represented as a structured projection plan
 * without creating rectangles for the renderer. It is intentionally not imported
 * by renderer/UI code and does not calculate visual bounds.
 */

function statusForDatum(value: B92DatumMm | undefined): B92ProjectionResolutionStatus {
  if (!value) return "unresolved";
  return value.status === "confirmed" ? "resolved" : "candidate";
}

function edgeAuthority(
  edge: B92Edge,
  view: B92ProjectionView,
  datumGeometry: B92FieldDatumGeometry
): B92ProjectionEdgeAuthority {
  const structuralFaceMm = datumGeometry.frame.structuralFaceMm[edge];
  const visibleFaceMm = datumGeometry.frame.visibleFaceMm[edge];
  const hiddenBehindSashMm = datumGeometry.frame.hiddenBehindSashMm[edge];
  const sashOverlayMm = datumGeometry.sash?.sashOverlayMm[edge];
  const beadFaceMm = datumGeometry.sash?.beadFaceMm[edge];

  return {
    edge,
    view,
    source: "field_datum",
    structuralFaceMm,
    visibleFaceMm,
    hiddenBehindSashMm,
    sashOverlayMm,
    beadFaceMm,
    status:
      statusForDatum(structuralFaceMm) === "resolved" ||
      statusForDatum(visibleFaceMm) === "resolved" ||
      statusForDatum(hiddenBehindSashMm) === "resolved" ||
      statusForDatum(beadFaceMm) === "resolved"
        ? "resolved"
        : "unresolved",
    note: "Static datum authority only; no renderer projection bounds calculated.",
  };
}

function datumStep(
  kind: B92ProjectionDatumStep["kind"],
  edge: B92Edge,
  valueMm: B92DatumMm | undefined,
  note: string
): B92ProjectionDatumStep | null {
  if (!valueMm) return null;
  return {
    kind,
    edge,
    valueMm,
    status: statusForDatum(valueMm),
    note,
  };
}

function region(input: Omit<B92ProjectedDrawableRegion, "status"> & { status?: B92ProjectionResolutionStatus }) {
  return {
    status: input.status ?? "resolved",
    ...input,
  };
}

function fieldChain(
  id: string,
  fieldId: string,
  view: B92ProjectionView,
  datumGeometry: B92FieldDatumGeometry,
  steps: B92ProjectionDatumStep[]
): B92ProjectionDatumChain {
  return {
    id,
    fieldId,
    view,
    edgeAuthorities: {
      top: edgeAuthority("top", view, datumGeometry),
      bottom: edgeAuthority("bottom", view, datumGeometry),
      left: edgeAuthority("left", view, datumGeometry),
      right: edgeAuthority("right", view, datumGeometry),
    },
    steps,
    status: "resolved",
    note: "Static fixture chain from confirmed datum authority; no drawable geometry generated.",
  };
}

function fixedNoSashRegions(fieldId: string, chainId: string): B92ProjectedDrawableRegion[] {
  const structuralFrame = B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY.frame.structuralFaceMm;
  const regions = B92_EDGES.flatMap((edge) => {
    const structuralFace = structuralFrame[edge];
    if (!structuralFace) return [];
    return region({
      id: `${fieldId}:fixed-structural-frame-${edge}`,
      category: "structural_frame_datum",
      visibility: "visible",
      fieldId,
      edge,
      datumChainId: chainId,
      note: `Confirmed fixed no-sash structural/internal ${edge} frame datum: ${structuralFace.valueMm}mm.`,
    });
  });

  regions.push(
    region({
      id: `${fieldId}:daylight-opening`,
      category: "daylight_opening",
      visibility: "visible",
      fieldId,
      datumChainId: chainId,
      note: "Fixed no-sash daylight opening can be projected from four confirmed structural/internal frame edges.",
    })
  );

  const glassOrderRule = B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY.glassOrderRule;
  if (glassOrderRule) {
    regions.push({
      id: `${fieldId}:glass-order`,
      category: "glass_order",
      visibility: "order_only",
      fieldId,
      datumChainId: chainId,
      status: "resolved",
      orderExpansionMm: {
        widthDeltaMm: glassOrderRule.widthDeltaMm,
        heightDeltaMm: glassOrderRule.heightDeltaMm,
        biteBehindBeadMm: glassOrderRule.biteBehindBeadMm,
      },
      note: "Confirmed fixed no-sash glass order expansion: daylight opening +26mm width/height, 13mm bite behind bead each side.",
    } satisfies B92ProjectedGlassOrderGeometry);
  }

  return regions;
}

function sashFieldRegions(fieldId: string, chainId: string): B92ProjectedDrawableRegion[] {
  const datumGeometry = B92_INTERNAL_SASH_FIELD_DATUM_GEOMETRY;
  const regions: B92ProjectedDrawableRegion[] = [];

  for (const edge of B92_EDGES) {
    if (datumGeometry.frame.structuralFaceMm[edge]) {
      regions.push(
        region({
          id: `${fieldId}:structural-frame-${edge}`,
          category: "structural_frame_datum",
          visibility: "construction",
          fieldId,
          edge,
          datumChainId: chainId,
          note: "Confirmed structural frame datum; no visual bounds calculated.",
        })
      );
    }
    if (datumGeometry.frame.visibleFaceMm[edge]) {
      regions.push(
        region({
          id: `${fieldId}:visible-frame-${edge}`,
          category: "visible_frame_face",
          visibility: "visible",
          fieldId,
          edge,
          datumChainId: chainId,
          note: "Confirmed exposed visible frame face after sash overlap; no visual bounds calculated.",
        })
      );
    }
    if (datumGeometry.frame.hiddenBehindSashMm[edge]) {
      regions.push(
        region({
          id: `${fieldId}:hidden-rebate-${edge}`,
          category: "hidden_frame_rebate",
          visibility: "hidden",
          fieldId,
          edge,
          datumChainId: chainId,
          note: "Confirmed hidden/rebate region behind sash; no visual bounds calculated.",
        })
      );
    }
    if (datumGeometry.sash?.visibleFaceMm[edge]) {
      regions.push(
        region({
          id: `${fieldId}:sash-face-${edge}`,
          category: "visible_sash_body",
          visibility: "visible",
          fieldId,
          edge,
          datumChainId: chainId,
          note: "Confirmed sash face/depth datum; no visual bounds calculated.",
        })
      );
    }
    if (datumGeometry.sash?.beadFaceMm[edge]) {
      regions.push(
        region({
          id: `${fieldId}:bead-${edge}`,
          category: "bead",
          visibility: "visible",
          fieldId,
          edge,
          datumChainId: chainId,
          note: "Confirmed bead/glass offset datum; bead segments terminate into 45 degree mitred corner joins and must not be treated as square-ended overlap rectangles.",
        })
      );
    }
  }

  regions.push(
    region({
      id: `${fieldId}:daylight-opening`,
      category: "daylight_opening",
      visibility: "visible",
      fieldId,
      datumChainId: chainId,
      note: "Daylight opening is represented as a planning region only; dimensions require future projection.",
    })
  );

  const glassOrderRule = datumGeometry.sash?.glassOrderRule;
  if (glassOrderRule) {
    regions.push({
      id: `${fieldId}:glass-order`,
      category: "glass_order",
      visibility: "order_only",
      fieldId,
      datumChainId: chainId,
      status: "resolved",
      orderExpansionMm: {
        widthDeltaMm: glassOrderRule.widthDeltaMm,
        heightDeltaMm: glassOrderRule.heightDeltaMm,
        biteBehindBeadMm: glassOrderRule.biteBehindBeadMm,
      },
      note: "Confirmed glass order expansion: daylight opening +26mm width/height, 13mm bite behind bead each side.",
    } satisfies B92ProjectedGlassOrderGeometry);
  }

  return regions;
}

function fieldSteps(datumGeometry: B92FieldDatumGeometry): B92ProjectionDatumStep[] {
  return B92_EDGES.flatMap((edge) =>
    [
      datumStep("structural_edge", edge, datumGeometry.frame.structuralFaceMm[edge], "Confirmed structural datum."),
      datumStep("visible_frame_face", edge, datumGeometry.frame.visibleFaceMm[edge], "Confirmed exposed visible frame datum after sash overlap."),
      datumStep("hidden_rebate", edge, datumGeometry.frame.hiddenBehindSashMm[edge], "Confirmed hidden/rebate datum."),
      datumStep("sash_face", edge, datumGeometry.sash?.visibleFaceMm[edge], "Confirmed sash face/depth datum."),
      datumStep("bead_face", edge, datumGeometry.sash?.beadFaceMm[edge], "Confirmed bead/glass offset datum."),
    ].filter((step): step is B92ProjectionDatumStep => !!step)
  );
}

function fixedNoSashFixtureUnresolved(fieldId: string): B92ProjectionUnresolvedItem[] {
  return [
    {
      id: `${fieldId}:meeting-ownership-unresolved`,
      reason: "unknown_meeting_geometry",
      fieldId,
      note: "Meeting ownership geometry is out of scope for single-field static projection and remains unresolved.",
    },
    {
      id: `${fieldId}:meeting-profile-detail-unresolved`,
      reason: "unknown_meeting_geometry",
      fieldId,
      note: "B92-15 / B92-16 / B92-17 / B92-18 detailed measurements remain unresolved.",
    },
    {
      id: `${fieldId}:external-view-unresolved`,
      reason: "unsupported_view_divergence",
      fieldId,
      note: "External-view projection is not modelled in this internal static fixture.",
    },
  ];
}

function sashFieldFixtureUnresolved(fieldId: string): B92ProjectionUnresolvedItem[] {
  return [
    {
      id: `${fieldId}:bottom-sash-overlay-unresolved`,
      reason: "missing_datum_authority",
      fieldId,
      edge: "bottom",
      note: "Bottom sash overlay/rebate relationship is not confirmed and must not be inferred.",
    },
    {
      id: `${fieldId}:meeting-ownership-unresolved`,
      reason: "unknown_meeting_geometry",
      fieldId,
      note: "Meeting ownership geometry is out of scope for single-field static projection and remains unresolved.",
    },
    {
      id: `${fieldId}:meeting-profile-detail-unresolved`,
      reason: "unknown_meeting_geometry",
      fieldId,
      note: "B92-15 / B92-16 / B92-17 / B92-18 detailed measurements remain unresolved.",
    },
    {
      id: `${fieldId}:external-view-unresolved`,
      reason: "unsupported_view_divergence",
      fieldId,
      note: "External-view projection is not modelled in this internal static fixture.",
    },
  ];
}

export function createB92FixedNoSashDatumProjectionFixture(
  fieldId = "fixed-no-sash-fixture"
): B92DatumProjectionPlan {
  const chainId = `${fieldId}:datum-chain`;
  const datumGeometry = B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY;
  const steps = fieldSteps(datumGeometry);

  return {
    view: "internal",
    fieldChains: [fieldChain(chainId, fieldId, "internal", datumGeometry, steps)],
    meetingChains: [],
    regions: fixedNoSashRegions(fieldId, chainId),
    unresolved: fixedNoSashFixtureUnresolved(fieldId),
    note: "Fixed no-sash static internal datum projection fixture; non-rendering.",
  };
}

export function createB92SashFieldDatumProjectionFixture(
  fieldId = "sash-field-fixture"
): B92DatumProjectionPlan {
  const chainId = `${fieldId}:datum-chain`;
  const datumGeometry = B92_INTERNAL_SASH_FIELD_DATUM_GEOMETRY;
  const steps = fieldSteps(datumGeometry);

  return {
    view: "internal",
    fieldChains: [fieldChain(chainId, fieldId, "internal", datumGeometry, steps)],
    meetingChains: [],
    regions: sashFieldRegions(fieldId, chainId),
    unresolved: sashFieldFixtureUnresolved(fieldId),
    note: "Sash-field static internal datum projection fixture for T&T / Turn / Tilt / Fixed Sash confirmed datum assumptions; non-rendering.",
  };
}

export const B92_FIXED_NO_SASH_DATUM_PROJECTION_FIXTURE =
  createB92FixedNoSashDatumProjectionFixture();

export const B92_SASH_FIELD_DATUM_PROJECTION_FIXTURE = createB92SashFieldDatumProjectionFixture();

export function assertB92StaticDatumProjectionFixture(plan: B92DatumProjectionPlan): void {
  if (plan.view !== "internal") {
    throw new Error("B92 static datum projection fixture must remain internal-view only.");
  }
  if (plan.regions.some((item) => !!item.boundsMm)) {
    throw new Error("B92 static datum projection fixture must not calculate drawable bounds.");
  }
  if (plan.meetingChains.length > 0) {
    throw new Error("B92 static datum projection fixture must not infer meeting projection chains.");
  }
}
