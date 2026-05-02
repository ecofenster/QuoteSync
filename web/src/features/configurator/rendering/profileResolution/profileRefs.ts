import type { ProfileRefDefinition, ProfileRefId } from "./profileTypes";

export const PROFILE_REFS: Record<ProfileRefId, ProfileRefDefinition> = {
  "B92-1": {
    id: "B92-1",
    title: "Standard fixed head/top",
    summary: "92 x 78. Standard fixed head/top. Visible 57 / 21 = 78.",
  },
  "B92-2": {
    id: "B92-2",
    title: "Standard fixed jamb left/right",
    summary: "92 x 78. Standard fixed jamb left/right. Use mirrored by side in standard fixed cases.",
  },
  "B92-3": {
    id: "B92-3",
    title: "Standard fixed sill/bottom",
    summary: "92 x 93. Standard fixed sill/bottom.",
  },
  "B92-3B": {
    id: "B92-3B",
    title: "Fixed sill reference variant",
    summary: "92 x 93. Keep as reference variant only; not the default standard fixed sill in current pilot mappings.",
  },
  "B92-4": {
    id: "B92-4",
    title: "Legacy fixed detail",
    summary: "43 / 14 / 21 fixed detail retained as reference only.",
    notes: ["Do not use as default fixed outer head."],
  },
  "B92-5": {
    id: "B92-5",
    title: "Special fixed sill in mixed T&T context",
    summary: "Mixed fixed bottom sill/detail for supplied T&T mixed context.",
  },
  "B92-6": {
    id: "B92-6",
    title: "Mixed fixed-side jamb detail",
    summary: "92 x 78. Fixed jamb detail used for fixed/T&T mixed horizontal and vertical fixed frame cases, not the standard fixed jamb.",
  },
  "B92-7": {
    id: "B92-7",
    title: "Tilt & Turn head/top",
    summary: "Frame 92 x 78, sash 90 x 78. Visible top 37.5, or 59.5 with trickle vent.",
  },
  "B92-8": {
    id: "B92-8",
    title: "Tilt & Turn sill/bottom",
    summary: "Standard Tilt & Turn sill/bottom profile.",
  },
  "B92-8B": {
    id: "B92-8B",
    title: "Tilt & Turn sill/bottom rebate-inside variant",
    summary: "Rebate-inside-only variant of the standard T&T sill family.",
  },
  "B92-9": {
    id: "B92-9",
    title: "Tilt & Turn handle-side jamb",
    summary: "Visible frame 37.5. Handle-side jamb.",
  },
  "B92-10": {
    id: "B92-10",
    title: "Tilt & Turn hinge-side jamb",
    summary: "Visible frame 37.5. Hinge-side jamb.",
  },
  "B92-12": {
    id: "B92-12",
    title: "Mixed fixed/T&T vertical centre mullion",
    summary: "Asymmetric mixed vertical centre mullion, fixed left / T&T right supplied orientation.",
    notes: ["Fixed/T&T handle-centre mullion for the B92 system."],
  },
  "B92-13": {
    id: "B92-13",
    title: "Mixed fixed/T&T hinge-at-centre mullion",
    summary: "Use when the T&T hinge side is at the mixed centre junction in the B92 system.",
  },
  "B92-14": {
    id: "B92-14",
    title: "Fixed/fixed centre mullion / Solid Sash Bar",
    summary: "78mm internal centre vertical mullion. Solid Sash Bar. 21 / 36 / 21. Structural split at centreline of 36mm core.",
  },
  "B92-15": {
    id: "B92-15",
    title: "T&T/T&T static mullion",
    summary: "100mm static mullion with 19mm sash gap. Not flying mullion.",
  },
  "B92-18": {
    id: "B92-18",
    title: "Flying mullion",
    summary: "Asymmetric slave/master flying mullion, 5mm gap, no static mullion post.",
  },
  "B92-20": {
    id: "B92-20",
    title: "T&T over fixed mixed transom",
    summary: "Use where upper = T&T and lower = fixed.",
    notes: ["A later note mentioned B92-8 as T&T head in this stack, but B92-7 remains the confirmed T&T head/top. Keep this as requires-confirmation context only."],
  },
  "B92-21": {
    id: "B92-21",
    title: "Fixed over T&T mixed transom",
    summary: "Use where upper = fixed and lower = T&T. Asymmetric, not mirrored automatically.",
  },
  "B92-22": {
    id: "B92-22",
    title: "T&T/T&T transom",
    summary: "Use where upper = T&T and lower = T&T.",
  },
  "B92-23": {
    id: "B92-23",
    title: "Fixed/fixed centre transom",
    summary: "Row-composition-aware fixed/fixed transom in mixed-row context.",
  },
  "B92-24": {
    id: "B92-24",
    title: "Mixed top row over fixed transom",
    summary: "Row-composition-aware transom where top row is mixed fixed/T&T and bottom row is fixed.",
  },
  "B92-C01": {
    id: "B92-C01",
    title: "Straight coupled-window connection C01",
    summary: "Separate-frame straight coupling detail.",
  },
  "B92-C02": {
    id: "B92-C02",
    title: "Straight coupled-window connection C02",
    summary: "Separate-frame straight coupling detail.",
  },
  "B92-C03": {
    id: "B92-C03",
    title: "Straight coupled-window connection C03",
    summary: "Separate-frame straight coupling detail.",
  },
  "B92-C04": {
    id: "B92-C04",
    title: "Straight coupled-window connection C04",
    summary: "Separate-frame straight coupling detail.",
  },
  "B92-C05": {
    id: "B92-C05",
    title: "Straight coupled-window connection C05",
    summary: "Separate-frame straight coupling detail.",
  },
  "B92-C06": {
    id: "B92-C06",
    title: "Straight coupled-window connection C06",
    summary: "Separate-frame straight coupling detail.",
  },
  "B92-C07": {
    id: "B92-C07",
    title: "90 degree corner post C07",
    summary: "90 degree corner post option.",
  },
  "B92-C08": {
    id: "B92-C08",
    title: "90 degree corner post C08",
    summary: "90 degree corner post option.",
  },
  "B92-C09": {
    id: "B92-C09",
    title: "90 degree corner post C09",
    summary: "90 degree corner post option.",
  },
  "B92-C10": {
    id: "B92-C10",
    title: "90 degree corner post C10",
    summary: "90 degree corner post option.",
  },
  "B92-C11": {
    id: "B92-C11",
    title: "90 degree corner post C11",
    summary: "90 degree corner post option.",
  },
  "B92-C12": {
    id: "B92-C12",
    title: "90 degree corner post C12",
    summary: "90 degree corner post option.",
  },
  "B92-C13": {
    id: "B92-C13",
    title: "Angled/bay coupler C13",
    summary: "Fixed/passive angled bay coupler for 91 to 140 degrees.",
  },
  "B92-C14": {
    id: "B92-C14",
    title: "Angled/bay coupler C14",
    summary: "Fixed/passive angled bay coupler for 141 to 179 degrees.",
  },
  "B92-C15": {
    id: "B92-C15",
    title: "Angled/bay coupler C15",
    summary: "T&T-present angled bay coupler for 91 to 140 degrees with single-tilt constraint.",
  },
  "B92-C16": {
    id: "B92-C16",
    title: "Angled/bay coupler C16",
    summary: "T&T-present angled bay coupler for 141 to 179 degrees with single-tilt constraint.",
  },
  "B92-C17": {
    id: "B92-C17",
    title: "Structural glass-to-glass corner",
    summary: "Site-glazed structural glazing / glass-to-glass joint with no corner post.",
  },
};

export function isKnownProfileRef(value: string): value is ProfileRefId {
  return value in PROFILE_REFS;
}
