import type {
  B92DatumMm,
  B92Edge,
  B92FieldDatumGeometry,
  B92MeetingDatumGeometry,
  B92MeetingSide,
  B92PerEdgeMm,
  B92SashPlacement,
} from "./b92DatumGeometry.types";

/**
 * Planning types for the future B92 datum projection layer.
 *
 * This file does not generate drawable output and is intentionally not wired into
 * the renderer. The current renderer still relies on nested rectangles, symmetric
 * inflation, and frame-thickness constants; that is insufficient for B92 because
 * structural datum, visible face, hidden/rebate, sash overlay, bead, daylight, and
 * meeting ownership are separate concerns.
 *
 * Future projection must start from datum authority, preserve per-edge authority,
 * and keep unknown meeting geometry unresolved instead of inferring dimensions.
 */

export type B92ProjectionView = "internal" | "external";

export type B92ProjectionAxis = "x" | "y";

export type B92ProjectionOwnerRole = "none" | "owner" | "passive" | "shared";

export type B92ProjectedRegionVisibility = "visible" | "hidden" | "construction" | "order_only";

export type B92ProjectedDrawableRegionCategory =
  | "structural_frame_datum"
  | "visible_frame_face"
  | "hidden_frame_rebate"
  | "sash_overlay"
  | "visible_sash_body"
  | "bead"
  | "daylight_opening"
  | "glass_order"
  | "meeting_profile"
  | "meeting_ownership";

export type B92ProjectionResolutionStatus = "resolved" | "candidate" | "unresolved";

export type B92ProjectionBoundsMm = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type B92ProjectionEdgeAuthority = {
  edge: B92Edge;
  view: B92ProjectionView;
  source: "field_datum" | "sash_placement" | "meeting_datum" | "derived_projection";
  structuralFaceMm?: B92DatumMm;
  visibleFaceMm?: B92DatumMm;
  hiddenBehindSashMm?: B92DatumMm;
  sashOverlayMm?: B92DatumMm;
  beadFaceMm?: B92DatumMm;
  daylightReductionMm?: B92DatumMm;
  status: B92ProjectionResolutionStatus;
  note?: string;
};

export type B92ProjectionDatumStepKind =
  | "structural_edge"
  | "visible_frame_face"
  | "hidden_rebate"
  | "sash_overlay"
  | "sash_face"
  | "bead_face"
  | "daylight_reduction"
  | "glass_order_expansion"
  | "meeting_adjustment";

export type B92ProjectionDatumStep = {
  kind: B92ProjectionDatumStepKind;
  edge?: B92Edge;
  axis?: B92ProjectionAxis;
  valueMm?: B92DatumMm;
  status: B92ProjectionResolutionStatus;
  note?: string;
};

export type B92ProjectionDatumChain = {
  id: string;
  fieldId?: string;
  meetingId?: string;
  view: B92ProjectionView;
  edgeAuthorities: B92PerEdgeMm<B92ProjectionEdgeAuthority>;
  steps: B92ProjectionDatumStep[];
  status: B92ProjectionResolutionStatus;
  note?: string;
};

export type B92ProjectedDrawableRegion = {
  id: string;
  category: B92ProjectedDrawableRegionCategory;
  visibility: B92ProjectedRegionVisibility;
  boundsMm?: B92ProjectionBoundsMm;
  fieldId?: string;
  edge?: B92Edge;
  meetingSide?: B92MeetingSide;
  ownerRole?: B92ProjectionOwnerRole;
  profileId?: string | null;
  datumChainId?: string;
  orderExpansionMm?: {
    widthDeltaMm: B92DatumMm;
    heightDeltaMm: B92DatumMm;
    biteBehindBeadMm: B92DatumMm;
  };
  status: B92ProjectionResolutionStatus;
  note?: string;
};

export type B92ProjectedVisibleFrameEdge = B92ProjectedDrawableRegion & {
  category: "visible_frame_face";
  edge: B92Edge;
  visibility: "visible";
};

export type B92ProjectedHiddenFrameRegion = B92ProjectedDrawableRegion & {
  category: "hidden_frame_rebate";
  edge: B92Edge;
  visibility: "hidden" | "construction";
};

export type B92ProjectedSashOverlayRegion = B92ProjectedDrawableRegion & {
  category: "sash_overlay";
  edge: B92Edge;
  visibility: "hidden" | "construction";
};

export type B92ProjectedSashFaceRegion = B92ProjectedDrawableRegion & {
  category: "visible_sash_body";
  edge: B92Edge;
  visibility: "visible";
};

export type B92ProjectedBeadRegion = B92ProjectedDrawableRegion & {
  category: "bead";
  edge: B92Edge;
  visibility: "visible";
};

export type B92ProjectedDaylightOpening = B92ProjectedDrawableRegion & {
  category: "daylight_opening";
  visibility: "visible";
};

export type B92ProjectedGlassOrderGeometry = B92ProjectedDrawableRegion & {
  category: "glass_order";
  visibility: "order_only";
  orderExpansionMm?: NonNullable<B92ProjectedDrawableRegion["orderExpansionMm"]>;
};

export type B92ProjectedMeetingOwnershipGeometry = B92ProjectedDrawableRegion & {
  category: "meeting_ownership";
  visibility: "construction";
  meetingSide: B92MeetingSide;
  ownerRole: B92ProjectionOwnerRole;
};

export type B92FieldDatumProjectionInput = {
  fieldId: string;
  view: B92ProjectionView;
  structuralBoundsMm: B92ProjectionBoundsMm;
  datumGeometry: B92FieldDatumGeometry;
  sashPlacement?: B92SashPlacement;
};

export type B92MeetingDatumProjectionInput = {
  meetingId: string;
  view: B92ProjectionView;
  structuralBoundsMm?: B92ProjectionBoundsMm;
  datumGeometry: B92MeetingDatumGeometry;
  ownerFieldId?: string | null;
  passiveFieldId?: string | null;
};

export type B92DatumProjectionInput = {
  view: B92ProjectionView;
  fields: B92FieldDatumProjectionInput[];
  meetings?: B92MeetingDatumProjectionInput[];
  note?: string;
};

export type B92DatumProjectionPlan = {
  view: B92ProjectionView;
  fieldChains: B92ProjectionDatumChain[];
  meetingChains: B92ProjectionDatumChain[];
  regions: B92ProjectedDrawableRegion[];
  unresolved: B92ProjectionUnresolvedItem[];
  note?: string;
};

export type B92ProjectionUnresolvedReason =
  | "missing_datum_authority"
  | "candidate_datum_only"
  | "unknown_meeting_geometry"
  | "missing_owner_field"
  | "unsupported_view_divergence"
  | "not_projected_yet";

export type B92ProjectionUnresolvedItem = {
  id: string;
  reason: B92ProjectionUnresolvedReason;
  fieldId?: string;
  meetingId?: string;
  profileId?: string | null;
  edge?: B92Edge;
  note: string;
};
