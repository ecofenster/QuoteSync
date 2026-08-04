import type {
  B92DatumMm,
  B92FieldDatumGeometry,
  B92InternalSectionDatumAuthority,
  B92InternalSectionDatumRole,
  B92MeetingDatumGeometry,
  B92MeetingSide,
} from "./b92DatumGeometry.types";

export type B92InternalFieldDatumGeometryKey = "fixed_no_sash" | "sash_field";
export type B92InternalMeetingProfileId = B92MeetingDatumGeometry["profileId"];
export type B92InternalSectionDatumProfileId = B92InternalSectionDatumAuthority["profileId"];

const confirmedMm = (valueMm: number, note?: string): B92DatumMm => ({
  valueMm,
  status: "confirmed",
  note,
});

const confirmedStackMm = (valuesMm: number[], note: string): B92DatumMm[] =>
  valuesMm.map((valueMm) => confirmedMm(valueMm, note));

/**
 * B92 datum authority fixture layer only.
 *
 * This file is intentionally not renderer-integrated. Importing it into rendering paths
 * should not happen until a later phase with tests and explicit visual approval.
 * Confirmed values are populated here; unconfirmed meeting values must not be inferred.
 */
export const B92_INTERNAL_FIXED_NO_SASH_DATUM_GEOMETRY: B92FieldDatumGeometry = {
  frame: {
    structuralFaceMm: {
      top: confirmedMm(57, "Fixed no-sash top/head structural frame datum."),
      left: confirmedMm(57, "Fixed no-sash left structural frame datum."),
      right: confirmedMm(57, "Fixed no-sash right structural frame datum."),
      bottom: confirmedMm(72, "Fixed no-sash bottom sill structural frame datum."),
    },
    visibleFaceMm: {},
    hiddenBehindSashMm: {},
  },
  glassOrderRule: {
    biteBehindBeadMm: confirmedMm(13, "Glass order bite behind bead each side."),
    widthDeltaMm: confirmedMm(26, "Glass order width = daylight opening + 26mm."),
    heightDeltaMm: confirmedMm(26, "Glass order height = daylight opening + 26mm."),
    formula: "visible_glass_plus_2x_bite",
  },
};

/**
 * Applies to Tilt & Turn / Turn / Tilt / Fixed Sash internal datum conditions.
 *
 * Confirmed:
 * - top structural datum: 57mm
 * - side structural datum: 57mm
 * - top exposed visible frame after sash overlap: 37.5mm
 * - side exposed visible frame after sash overlap: 37.5mm
 * - hidden behind sash top/sides: 19.5mm
 * - bottom visible sill: 52.5mm
 * - sash face/depth: 57mm
 * - bead/glass offset: 21mm
 * - glazing beads terminate into 45 degree mitred corner joins
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
      top: confirmedMm(37.5, "Top exposed visible frame face after sash overlap."),
      left: confirmedMm(37.5, "Left side exposed visible frame face after sash overlap."),
      right: confirmedMm(37.5, "Right side exposed visible frame face after sash overlap."),
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
      top: confirmedMm(21, "Bead/glass offset. Bead segment terminates into 45 degree mitred corner joins."),
      bottom: confirmedMm(21, "Bead/glass offset. Bead segment terminates into 45 degree mitred corner joins."),
      left: confirmedMm(21, "Bead/glass offset. Bead segment terminates into 45 degree mitred corner joins."),
      right: confirmedMm(21, "Bead/glass offset. Bead segment terminates into 45 degree mitred corner joins."),
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
  options?: {
    meetingGapMm?: B92DatumMm;
    internalVisibleBetweenSashesMm?: B92DatumMm;
    profileWidthMm?: B92DatumMm;
    profileDepthMm?: B92DatumMm;
    externalCladWidthMm?: B92DatumMm;
    sequenceMm?: B92DatumMm[];
  }
): B92MeetingDatumGeometry => ({
  profileId,
  side,
  axis: "vertical",
  meetingGapMm: options?.meetingGapMm,
  internalVisibleBetweenSashesMm: options?.internalVisibleBetweenSashesMm,
  profileWidthMm: options?.profileWidthMm,
  profileDepthMm: options?.profileDepthMm,
  externalCladWidthMm: options?.externalCladWidthMm,
  sequenceMm: options?.sequenceMm,
  note,
});

const B92_MEETING_SEQUENCE_15: B92DatumMm[] = confirmedStackMm(
  [21, 57, 19, 57, 21],
  "Confirmed B92-15 internal meeting section stack from supplied section authority."
);
const B92_MEETING_SEQUENCE_16: B92DatumMm[] = confirmedStackMm(
  [21, 57, 49, 57, 21],
  "Confirmed B92-16 internal meeting section stack from supplied section authority."
);
const B92_MEETING_SEQUENCE_17: B92DatumMm[] = confirmedStackMm(
  [21, 57, 19, 78],
  "Confirmed B92-17 internal meeting section stack from supplied section authority."
);
const B92_MEETING_SEQUENCE_18: B92DatumMm[] = confirmedStackMm(
  [21, 27, 5, 57, 21],
  "Confirmed B92-18 internal flying-mullion section stack from supplied section authority."
);

/**
 * Meeting condition placeholders only.
 *
 * Confirmed meeting section stacks are recorded as datum authority only. They
 * must not drive rendering or daylight calculations until ownership and field
 * edge closure are explicit.
 */
export const B92_INTERNAL_MEETING_DATUM_GEOMETRY_REGISTER: Record<
  B92InternalMeetingProfileId,
  Record<B92MeetingSide, B92MeetingDatumGeometry>
> = {
  "B92-15": {
    left: meetingFixture(
      "B92-15",
      "left",
      "Default T&T/T&T static centre mullion. Confirmed source note: section stack 21 / 57 / 19 / 57 / 21, 19mm internally visible between sashes, and 92x100 timber profile. TODO: detailed meeting ownership unknown; do not infer daylight or overlap geometry.",
      {
        internalVisibleBetweenSashesMm: confirmedMm(19, "B92-15 internally visible distance between sashes."),
        profileWidthMm: confirmedMm(100, "B92-15 timber profile width."),
        profileDepthMm: confirmedMm(92, "B92-15 timber profile depth."),
        sequenceMm: B92_MEETING_SEQUENCE_15,
      }
    ),
    right: meetingFixture(
      "B92-15",
      "right",
      "Default T&T/T&T static centre mullion. Confirmed source note: section stack 21 / 57 / 19 / 57 / 21, 19mm internally visible between sashes, and 92x100 timber profile. TODO: detailed meeting ownership unknown; do not infer daylight or overlap geometry.",
      {
        internalVisibleBetweenSashesMm: confirmedMm(19, "B92-15 internally visible distance between sashes."),
        profileWidthMm: confirmedMm(100, "B92-15 timber profile width."),
        profileDepthMm: confirmedMm(92, "B92-15 timber profile depth."),
        sequenceMm: B92_MEETING_SEQUENCE_15,
      }
    ),
  },
  "B92-16": {
    left: meetingFixture(
      "B92-16",
      "left",
      "Hinges-at-meeting section authority. Confirmed source note: section stack 21 / 57 / 49 / 57 / 21, 92x130 timber profile, 49mm internally visible between sashes, 136mm with aluminium cladding. TODO: ownership/daylight geometry unknown; do not infer projection.",
      {
        internalVisibleBetweenSashesMm: confirmedMm(49, "B92-16 internally visible frame between sashes."),
        profileWidthMm: confirmedMm(130, "B92-16 timber profile width."),
        profileDepthMm: confirmedMm(92, "B92-16 timber profile depth."),
        externalCladWidthMm: confirmedMm(136, "B92-16 external width with aluminium cladding."),
        sequenceMm: B92_MEETING_SEQUENCE_16,
      }
    ),
    right: meetingFixture(
      "B92-16",
      "right",
      "Hinges-at-meeting section authority. Confirmed source note: section stack 21 / 57 / 49 / 57 / 21, 92x130 timber profile, 49mm internally visible between sashes, 136mm with aluminium cladding. TODO: ownership/daylight geometry unknown; do not infer projection.",
      {
        internalVisibleBetweenSashesMm: confirmedMm(49, "B92-16 internally visible frame between sashes."),
        profileWidthMm: confirmedMm(130, "B92-16 timber profile width."),
        profileDepthMm: confirmedMm(92, "B92-16 timber profile depth."),
        externalCladWidthMm: confirmedMm(136, "B92-16 external width with aluminium cladding."),
        sequenceMm: B92_MEETING_SEQUENCE_16,
      }
    ),
  },
  "B92-17": {
    left: meetingFixture(
      "B92-17",
      "left",
      "Same-handing section authority. Confirmed source note: section stack 21 / 57 / 19 / 78. TODO: side ownership and daylight closure unknown; do not infer geometry.",
      {
        internalVisibleBetweenSashesMm: confirmedMm(19, "B92-17 internal visible meeting stack component."),
        sequenceMm: B92_MEETING_SEQUENCE_17,
      }
    ),
    right: meetingFixture(
      "B92-17",
      "right",
      "Same-handing section authority. Confirmed source note: section stack 21 / 57 / 19 / 78. TODO: side ownership and daylight closure unknown; do not infer geometry.",
      {
        internalVisibleBetweenSashesMm: confirmedMm(19, "B92-17 internal visible meeting stack component."),
        sequenceMm: B92_MEETING_SEQUENCE_17,
      }
    ),
  },
  "B92-18": {
    left: meetingFixture(
      "B92-18",
      "left",
      "Flying mullion. Confirmed source note: section stack 21 / 27 / 5 / 57 / 21, 5mm gap and no static mullion post. TODO: owner/passive geometry unknown; do not infer sash ownership geometry.",
      {
        meetingGapMm: confirmedMm(5, "B92-18 flying mullion gap."),
        sequenceMm: B92_MEETING_SEQUENCE_18,
      }
    ),
    right: meetingFixture(
      "B92-18",
      "right",
      "Flying mullion. Confirmed source note: section stack 21 / 27 / 5 / 57 / 21, 5mm gap and no static mullion post. TODO: owner/passive geometry unknown; do not infer sash ownership geometry.",
      {
        meetingGapMm: confirmedMm(5, "B92-18 flying mullion gap."),
        sequenceMm: B92_MEETING_SEQUENCE_18,
      }
    ),
  },
};

const sectionAuthority = (input: {
  profileId: B92InternalSectionDatumProfileId;
  role: B92InternalSectionDatumRole;
  projectionStatus: B92InternalSectionDatumAuthority["projectionStatus"];
  stackMm?: number[];
  totalMm?: number;
  confirmedRules: string[];
  unresolvedRequirements: string[];
  note?: string;
  conflictNotes?: string[];
}): B92InternalSectionDatumAuthority => ({
  profileId: input.profileId,
  role: input.role,
  sectionStatus: "confirmed",
  projectionStatus: input.projectionStatus,
  stackMm: input.stackMm
    ? confirmedStackMm(input.stackMm, `Confirmed ${input.profileId} internal section stack from supplied section authority.`)
    : undefined,
  totalMm: input.totalMm
    ? confirmedMm(input.totalMm, `Confirmed ${input.profileId} total internal section stack from supplied section authority.`)
    : undefined,
  confirmedRules: input.confirmedRules,
  unresolvedRequirements: input.unresolvedRequirements,
  note: input.note,
  conflictNotes: input.conflictNotes,
});

/**
 * Internal B92 section authority only.
 *
 * These records encode confirmed supplied sections and explicit stack values
 * already present in committed source. They do not replace renderer geometry and
 * are not sufficient by themselves to project field daylight where ownership,
 * bottom sash placement, or transom edge closure is unresolved.
 */
export const B92_INTERNAL_SECTION_DATUM_AUTHORITY_REGISTER: Record<
  B92InternalSectionDatumProfileId,
  B92InternalSectionDatumAuthority
> = {
  "B92-5": sectionAuthority({
    profileId: "B92-5",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["fixed-field mixed-context/equalising sill section authority is supplied as confirmed"],
    unresolvedRequirements: ["segmented sill transition datum", "mixed fixed/sash bottom rebate relationship"],
    note: "B92-5 can identify a sill section, but it does not by itself define complete bottom field projection.",
  }),
  "B92-8": sectionAuthority({
    profileId: "B92-8",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: [
      "standard T&T / Turn / Tilt / Fixed Sash bottom sill section",
      "bottom visible sill datum remains 52.5mm for sash-field fixtures",
    ],
    unresolvedRequirements: ["bottom sash face placement", "bottom hidden/rebate datum", "bottom bead start datum"],
  }),
  "B92-8A": sectionAuthority({
    profileId: "B92-8A",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["supplied T&T sill variant section authority is confirmed"],
    unresolvedRequirements: ["variant selection rule", "bottom sash/rebate datum", "bottom bead placement"],
  }),
  "B92-8B": sectionAuthority({
    profileId: "B92-8B",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["rebate-inside-only T&T sill variant section authority is confirmed"],
    unresolvedRequirements: ["bottom sash/rebate datum", "bottom bead placement"],
  }),
  "B92-8C": sectionAuthority({
    profileId: "B92-8C",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["supplied T&T sill variant section authority is confirmed"],
    unresolvedRequirements: ["variant selection rule", "bottom sash/rebate datum", "bottom bead placement"],
  }),
  "B92-8D": sectionAuthority({
    profileId: "B92-8D",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["supplied T&T sill variant section authority is confirmed"],
    unresolvedRequirements: ["variant selection rule", "bottom sash/rebate datum", "bottom bead placement"],
  }),
  "B92-8E": sectionAuthority({
    profileId: "B92-8E",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["supplied T&T sill variant section authority is confirmed"],
    unresolvedRequirements: ["variant selection rule", "bottom sash/rebate datum", "bottom bead placement"],
  }),
  "B92-8F": sectionAuthority({
    profileId: "B92-8F",
    role: "sill",
    projectionStatus: "partial",
    confirmedRules: ["supplied T&T sill variant section authority is confirmed"],
    unresolvedRequirements: ["variant selection rule", "bottom sash/rebate datum", "bottom bead placement"],
  }),
  "B92-15": sectionAuthority({
    profileId: "B92-15",
    role: "meeting_profile",
    projectionStatus: "partial",
    stackMm: [21, 57, 19, 57, 21],
    totalMm: 175,
    confirmedRules: ["static T&T/T&T meeting stack", "19mm internally visible between sashes"],
    unresolvedRequirements: ["field ownership", "left/right daylight closure", "sash termination ordering semantics"],
  }),
  "B92-16": sectionAuthority({
    profileId: "B92-16",
    role: "meeting_profile",
    projectionStatus: "partial",
    stackMm: [21, 57, 49, 57, 21],
    totalMm: 205,
    confirmedRules: ["hinges-at-meeting T&T/T&T stack", "49mm internally visible frame between sashes"],
    unresolvedRequirements: ["hinge-side ownership", "left/right daylight closure", "handle/hinge operation implications"],
  }),
  "B92-17": sectionAuthority({
    profileId: "B92-17",
    role: "meeting_profile",
    projectionStatus: "partial",
    stackMm: [21, 57, 19, 78],
    totalMm: 175,
    confirmedRules: ["same-handing T&T/T&T stack"],
    unresolvedRequirements: ["same-handing ownership", "left/right daylight closure", "handle/hinge operation implications"],
  }),
  "B92-18": sectionAuthority({
    profileId: "B92-18",
    role: "meeting_profile",
    projectionStatus: "partial",
    stackMm: [21, 27, 5, 57, 21],
    totalMm: 131,
    confirmedRules: ["flying mullion stack", "5mm meeting gap", "no static mullion post"],
    unresolvedRequirements: ["owner/passive sash allocation", "owner/passive daylight closure", "glass order at flying meeting"],
  }),
  "B92-19": sectionAuthority({
    profileId: "B92-19",
    role: "horizontal_transom",
    projectionStatus: "partial",
    stackMm: [21, 57, 31.5, 21],
    totalMm: 130.5,
    confirmedRules: ["fixed/fixed horizontal transom stack"],
    unresolvedRequirements: ["above/below edge ownership", "daylight closure across horizontal transom"],
  }),
  "B92-20": sectionAuthority({
    profileId: "B92-20",
    role: "horizontal_transom",
    projectionStatus: "partial",
    stackMm: [21, 36, 21],
    totalMm: 78,
    confirmedRules: ["T&T over fixed horizontal transom stack"],
    unresolvedRequirements: ["above/below edge ownership", "asymmetric fixed/T&T daylight closure"],
  }),
  "B92-21": sectionAuthority({
    profileId: "B92-21",
    role: "horizontal_transom",
    projectionStatus: "partial",
    stackMm: [21, 16.5, 57, 21],
    totalMm: 115.5,
    confirmedRules: ["fixed over T&T horizontal transom stack"],
    unresolvedRequirements: ["above/below edge ownership", "asymmetric fixed/T&T daylight closure"],
  }),
  "B92-22": sectionAuthority({
    profileId: "B92-22",
    role: "horizontal_transom",
    projectionStatus: "partial",
    stackMm: [21, 57, 30, 57, 21],
    totalMm: 186,
    confirmedRules: ["T&T/T&T horizontal transom stack"],
    unresolvedRequirements: ["above/below edge ownership", "daylight closure across horizontal transom"],
  }),
  "B92-23": sectionAuthority({
    profileId: "B92-23",
    role: "horizontal_transom",
    projectionStatus: "partial",
    stackMm: [21, 51, 37, 21],
    totalMm: 130,
    confirmedRules: ["row-aware fixed/fixed horizontal transom stack"],
    unresolvedRequirements: ["row-composition selection authority", "above/below edge ownership"],
  }),
  "B92-24": sectionAuthority({
    profileId: "B92-24",
    role: "horizontal_transom",
    projectionStatus: "partial",
    stackMm: [21, 22, 14, 21],
    totalMm: 78,
    confirmedRules: ["row-aware mixed-case horizontal transom stack"],
    unresolvedRequirements: ["row-composition selection authority", "above/below edge ownership"],
  }),
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

export function getB92InternalSectionDatumAuthority(
  profileId: B92InternalSectionDatumProfileId
): B92InternalSectionDatumAuthority {
  return B92_INTERNAL_SECTION_DATUM_AUTHORITY_REGISTER[profileId];
}

export function listB92InternalSectionDatumAuthorities(input?: {
  role?: B92InternalSectionDatumRole | B92InternalSectionDatumRole[];
  projectionStatus?: B92InternalSectionDatumAuthority["projectionStatus"] | B92InternalSectionDatumAuthority["projectionStatus"][];
}): B92InternalSectionDatumAuthority[] {
  const roles = input?.role ? new Set(Array.isArray(input.role) ? input.role : [input.role]) : null;
  const statuses = input?.projectionStatus
    ? new Set(Array.isArray(input.projectionStatus) ? input.projectionStatus : [input.projectionStatus])
    : null;

  return Object.values(B92_INTERNAL_SECTION_DATUM_AUTHORITY_REGISTER)
    .filter((authority) => {
      if (roles && !roles.has(authority.role)) return false;
      if (statuses && !statuses.has(authority.projectionStatus)) return false;
      return true;
    })
    .map((authority) => ({
      ...authority,
      stackMm: authority.stackMm ? [...authority.stackMm] : undefined,
      confirmedRules: [...authority.confirmedRules],
      unresolvedRequirements: [...authority.unresolvedRequirements],
      conflictNotes: authority.conflictNotes ? [...authority.conflictNotes] : undefined,
    }));
}
