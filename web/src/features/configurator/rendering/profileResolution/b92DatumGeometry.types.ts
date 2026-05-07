export type B92DatumStatus = "confirmed" | "candidate";

export type B92DatumMm = {
  valueMm: number;
  status: B92DatumStatus;
  note?: string;
};

export type B92Edge = "top" | "bottom" | "left" | "right";

export type B92PerEdgeMm<T = B92DatumMm> = Partial<Record<B92Edge, T>>;

export type B92FrameDatumGeometry = {
  /**
   * Confirmed:
   * - top/side structural frame datum: 57mm
   */
  structuralFaceMm: B92PerEdgeMm;
  /**
   * Confirmed:
   * - top/side visible frame: 37.5mm
   * - T&T / Turn / Tilt sill visible: 52.5mm
   * - Fixed sill visible: 72mm
   */
  visibleFaceMm: B92PerEdgeMm;
  /**
   * Confirmed:
   * - top/side hidden behind sash: 19.5mm
   *
   * Candidate:
   * - bottom sash overlay/rebate relationship
   */
  hiddenBehindSashMm: B92PerEdgeMm;
};

export type B92SashDatumGeometry = {
  /**
   * Confirmed:
   * - sash face/depth: 57mm
   */
  visibleFaceMm: B92PerEdgeMm;
  /**
   * Candidate:
   * - uniform 19.5mm sash overlay on all edges
   * - bottom sash overlay/rebate relationship
   */
  sashOverlayMm: B92PerEdgeMm;
  /**
   * Confirmed:
   * - bead/glass offset: 21mm
   */
  beadFaceMm: B92PerEdgeMm;
  daylightReductionMm?: B92PerEdgeMm;
  /**
   * Confirmed:
   * - glass order bite behind bead: 13mm
   * - glass order delta: +26mm width and height
   */
  glassOrderRule?: {
    biteBehindBeadMm: B92DatumMm;
    widthDeltaMm: B92DatumMm;
    heightDeltaMm: B92DatumMm;
    formula: "visible_glass_plus_2x_bite";
  };
};

export type B92FieldDatumGeometry = {
  frame: B92FrameDatumGeometry;
  sash?: B92SashDatumGeometry;
};

export type B92MeetingSide = "left" | "right";

export type B92MeetingDatumGeometry = {
  side: B92MeetingSide;
  profileId: "B92-15" | "B92-16" | "B92-17" | "B92-18";
  axis: "vertical";
  ownerFieldId?: string | null;
  passiveFieldId?: string | null;
  meetingGapMm?: B92DatumMm;
  daylightReductionMm?: {
    leftField?: B92PerEdgeMm;
    rightField?: B92PerEdgeMm;
  };
  /**
   * Candidate:
   * - meeting sequence 21 / 27 / 5 / 57 / 21
   * - B92-16 geometry
   * - B92-17 geometry
   * - B92-18 owner/passive geometry
   */
  sequenceMm?: B92DatumMm[];
  note?: string;
};

export type B92SashEdgePlacement = {
  edge: B92Edge;
  boundaryKind: "outer_frame" | "meeting_profile" | "transom" | "sill";
  adjacentProfileId?: string | null;
  sideRole: "outer" | "meeting" | "top_transom" | "bottom_transom";
  structuralFaceMm?: B92DatumMm;
  visibleFaceMm?: B92DatumMm;
  hiddenBehindSashMm?: B92DatumMm;
  sashOverlayMm?: B92DatumMm;
};

export type B92SashPlacement = Record<B92Edge, B92SashEdgePlacement>;
