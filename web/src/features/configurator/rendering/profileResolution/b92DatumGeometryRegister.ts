import type {
  B92DatumMm,
  B92FieldDatumGeometry,
  B92MeetingDatumGeometry,
  B92MeetingSide,
} from "./b92DatumGeometry.types";

export type B92InternalFieldDatumGeometryKey = "fixed_no_sash" | "sash_field";
export type B92InternalMeetingProfileId = B92MeetingDatumGeometry["profileId"];

const confirmedMm = (valueMm: number, note?: string): B92DatumMm => ({
  valueMm,
  status: "confirmed",
  note,
});

const candidateMm = (valueMm: number, note: string): B92DatumMm => ({
  valueMm,
  status: "candidate",
  note,
});

/**
 * B92 datum authority fixture layer only.
 *
 * This file is intentionally not renderer-integrated. Importing it into rendering paths
 * should not happen until a later phase with tests and explicit visual approval.
 * Confirmed values are populated here; unconfirmed meeting values must not be inferred.
 */
export const B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY: B92FieldDatumGeometry = {
  frame: {
    structuralFaceMm: {},
    visibleFaceMm: {
      bottom: confirmedMm(72, "Fixed no-sash frame visible bottom."),
    },
    hiddenBehindSashMm: {},
  },
};

/**
 * Applies to Tilt & Turn / Turn / Tilt / Fixed Sash internal datum conditions.
 *
 * Confirmed:
 * - top structural datum: 57mm
 * - side structural datum: 57mm
 * - top visible frame: 37.5mm
 * - side visible frame: 37.5mm
 * - hidden behind sash top/sides: 19.5mm
 * - bottom visible sill: 52.5mm
 * - sash face/depth: 57mm
 * - bead/glass offset: 21mm
 * - glass size = daylight opening + 26mm width/height
 * - glass order bite behind bead: 13mm each side
 *
 * Not populated:
 * - uniform 19.5mm sash overlay on all edges
 * - bottom sash overlay/rebate relationship
 */
export const B92_INTERNAL_SASH_FIELD_DATUM_GEOMETRY: B92FieldDatumGeometry = {
  frame: {
    structuralFaceMm: {
      top: confirmedMm(57, "Top structural frame datum."),
      left: confirmedMm(57, "Left side structural frame datum."),
      right: confirmedMm(57, "Right side structural frame datum."),
    },
    visibleFaceMm: {
      top: confirmedMm(37.5, "Top visible frame face."),
      left: confirmedMm(37.5, "Left side visible frame face."),
      right: confirmedMm(37.5, "Right side visible frame face."),
      bottom: confirmedMm(52.5, "T&T / Turn / Tilt / Fixed Sash bottom visible sill."),
    },
    hiddenBehindSashMm: {
      top: confirmedMm(19.5, "Top hidden frame zone behind sash."),
      left: confirmedMm(19.5, "Left side hidden frame zone behind sash."),
      right: confirmedMm(19.5, "Right side hidden frame zone behind sash."),
    },
  },
  sash: {
    visibleFaceMm: {
      top: confirmedMm(57, "Sash face/depth."),
      bottom: confirmedMm(57, "Sash face/depth."),
      left: confirmedMm(57, "Sash face/depth."),
      right: confirmedMm(57, "Sash face/depth."),
    },
    sashOverlayMm: {},
    beadFaceMm: {
      top: confirmedMm(21, "Bead/glass offset."),
      bottom: confirmedMm(21, "Bead/glass offset."),
      left: confirmedMm(21, "Bead/glass offset."),
      right: confirmedMm(21, "Bead/glass offset."),
    },
    glassOrderRule: {
      biteBehindBeadMm: confirmedMm(13, "Glass order bite behind bead each side."),
      widthDeltaMm: confirmedMm(26, "Glass order width = daylight opening + 26mm."),
      heightDeltaMm: confirmedMm(26, "Glass order height = daylight opening + 26mm."),
      formula: "visible_glass_plus_2x_bite",
    },
  },
};

export const B92_INTERNAL_FIELD_DATUM_GEOMETRY_REGISTER: Record<
  B92InternalFieldDatumGeometryKey,
  B92FieldDatumGeometry
> = {
  fixed_no_sash: B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY,
  sash_field: B92_INTERNAL_SASH_FIELD_DATUM_GEOMETRY,
};

const meetingFixture = (
  profileId: B92InternalMeetingProfileId,
  side: B92MeetingSide,
  note: string,
  sequenceMm?: B92DatumMm[]
): B92MeetingDatumGeometry => ({
  profileId,
  side,
  axis: "vertical",
  sequenceMm,
  note,
});

const B92_MEETING_SEQUENCE_21_27_5_57_21: B92DatumMm[] = [21, 27, 5, 57, 21].map((valueMm) =>
  candidateMm(valueMm, "TODO: unconfirmed meeting sequence measurement; semantics and ownership must not be inferred.")
);

/**
 * Meeting condition placeholders only.
 *
 * Unknown meeting profile measurements are deliberately left unset. The candidate
 * 21 / 27 / 5 / 57 / 21 sequence is recorded only as an unconfirmed placeholder
 * and must not drive rendering or daylight calculations yet.
 */
export const B92_INTERNAL_MEETING_DATUM_GEOMETRY_REGISTER: Record<
  B92InternalMeetingProfileId,
  Record<B92MeetingSide, B92MeetingDatumGeometry>
> = {
  "B92-15": {
    left: meetingFixture(
      "B92-15",
      "left",
      "Default T&T/T&T static centre mullion. TODO: meeting measurements unknown; do not infer daylight or overlap geometry.",
      B92_MEETING_SEQUENCE_21_27_5_57_21
    ),
    right: meetingFixture(
      "B92-15",
      "right",
      "Default T&T/T&T static centre mullion. TODO: meeting measurements unknown; do not infer daylight or overlap geometry.",
      B92_MEETING_SEQUENCE_21_27_5_57_21
    ),
  },
  "B92-16": {
    left: meetingFixture(
      "B92-16",
      "left",
      "Candidate hinges-at-meeting geometry. TODO: all measurements unknown; do not infer geometry.",
    ),
    right: meetingFixture(
      "B92-16",
      "right",
      "Candidate hinges-at-meeting geometry. TODO: all measurements unknown; do not infer geometry.",
    ),
  },
  "B92-17": {
    left: meetingFixture(
      "B92-17",
      "left",
      "Candidate same-handing geometry. TODO: all measurements unknown; do not infer geometry.",
    ),
    right: meetingFixture(
      "B92-17",
      "right",
      "Candidate same-handing geometry. TODO: all measurements unknown; do not infer geometry.",
    ),
  },
  "B92-18": {
    left: meetingFixture(
      "B92-18",
      "left",
      "Flying mullion. TODO: owner/passive geometry unknown; do not infer sash ownership geometry.",
    ),
    right: meetingFixture(
      "B92-18",
      "right",
      "Flying mullion. TODO: owner/passive geometry unknown; do not infer sash ownership geometry.",
    ),
  },
};

export function getB92InternalFieldDatumGeometry(
  key: B92InternalFieldDatumGeometryKey
): B92FieldDatumGeometry {
  return B92_INTERNAL_FIELD_DATUM_GEOMETRY_REGISTER[key];
}

export function getB92InternalMeetingDatumGeometry(
  profileId: B92InternalMeetingProfileId,
  side: B92MeetingSide
): B92MeetingDatumGeometry {
  return B92_INTERNAL_MEETING_DATUM_GEOMETRY_REGISTER[profileId][side];
}
