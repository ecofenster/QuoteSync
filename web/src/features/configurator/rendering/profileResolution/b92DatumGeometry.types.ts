export type B92DatumStatus = "confirmed" | "candidate";

export type B92DatumChainProjectionStatus = "complete" | "partial" | "unresolved" | "conflict";

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
  /**
   * Confirmed for fixed no-sash and sash fields where a daylight opening can be
   * resolved:
   * - glass order bite behind bead: 13mm
   * - glass order delta: +26mm width and height
   */
  glassOrderRule?: B92SashDatumGeometry["glassOrderRule"];
};

export type B92MeetingSide = "left" | "right";

export type B92InternalSillDatumProfileId =
  | "B92-5"
  | "B92-8"
  | "B92-8A"
  | "B92-8B"
  | "B92-8C"
  | "B92-8D"
  | "B92-8E"
  | "B92-8F";

export type B92InternalMeetingDatumProfileId = "B92-15" | "B92-16" | "B92-17" | "B92-18";

export type B92InternalTransomDatumProfileId =
  | "B92-19"
  | "B92-20"
  | "B92-21"
  | "B92-22"
  | "B92-23"
  | "B92-24";

export type B92InternalSectionDatumProfileId =
  | B92InternalSillDatumProfileId
  | B92InternalMeetingDatumProfileId
  | B92InternalTransomDatumProfileId;

export type B92InternalSectionDatumRole = "sill" | "meeting_profile" | "horizontal_transom";

export type B92InternalSectionDatumAuthority = {
  profileId: B92InternalSectionDatumProfileId;
  role: B92InternalSectionDatumRole;
  /**
   * Section authority only. A confirmed section can still have partial
   * projection status when ownership, bottom placement, or field-edge closure
   * remains unresolved.
   */
  sectionStatus: B92DatumStatus;
  projectionStatus: B92DatumChainProjectionStatus;
  stackMm?: B92DatumMm[];
  totalMm?: B92DatumMm;
  confirmedRules: string[];
  unresolvedRequirements: string[];
  conflictNotes?: string[];
  note?: string;
};

export type B92MeetingDatumGeometry = {
  side: B92MeetingSide;
  profileId: B92InternalMeetingDatumProfileId;
  axis: "vertical";
  ownerFieldId?: string | null;
  passiveFieldId?: string | null;
  /**
   * Confirmed where documented:
   * - B92-18 flying mullion gap: 5mm
   */
  meetingGapMm?: B92DatumMm;
  /**
   * Confirmed where documented:
   * - B92-15 internally visible distance between sashes: 19mm
   * - B92-16 internally visible frame between sashes: 49mm
   */
  internalVisibleBetweenSashesMm?: B92DatumMm;
  profileWidthMm?: B92DatumMm;
  profileDepthMm?: B92DatumMm;
  externalCladWidthMm?: B92DatumMm;
  daylightReductionMm?: {
    leftField?: B92PerEdgeMm;
    rightField?: B92PerEdgeMm;
  };
  /**
   * Confirmed section stacks:
   * - B92-15: 21 / 57 / 19 / 57 / 21
   * - B92-16: 21 / 57 / 49 / 57 / 21
   * - B92-17: 21 / 57 / 19 / 78
   * - B92-18: 21 / 27 / 5 / 57 / 21
   *
   * Still unresolved:
   * - stack semantics as projected field bounds
   * - meeting ownership and sash termination
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
