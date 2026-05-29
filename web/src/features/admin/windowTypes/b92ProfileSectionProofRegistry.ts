export type B92ProfileSectionProofView = "internal" | "external";

export type B92ProfileSectionProofFamily = {
  id: string;
  label: string;
  group: string;
  status: "approved-locked" | "accepted-reference-only";
  mappedDesignIds: string[];
  notes: string;
};

export const B92_PROFILE_SECTION_PROOF_FAMILIES: B92ProfileSectionProofFamily[] = [
  {
    id: "b92-1-field-fixed",
    label: "1 Field Fixed",
    group: "1 Field",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-1-field-tilt-turn",
    label: "1 Field Tilt & Turn",
    group: "1 Field",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-fixed-fixed",
    label: "2 Field Horizontal Fixed / Fixed",
    group: "2 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: ["windows-2-fixed-fixed-static"],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-fixed-tilt-turn-left",
    label: "2 Field Horizontal Fixed / Tilt & Turn Left",
    group: "2 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: ["windows-2-fixed-tilt-turn-left-static"],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-turn-tilt-turn",
    label: "2 Field Horizontal Turn / Tilt & Turn",
    group: "2 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-tilt-turn-left-right",
    label: "2 Field Horizontal Tilt & Turn Left / Tilt & Turn Right",
    group: "2 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-tilt-turn-right-left",
    label: "2 Field Horizontal Tilt & Turn Right / Tilt & Turn Left",
    group: "2 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-fixed-tilt-turn-right",
    label: "2 Field Horizontal Fixed / Tilt & Turn Right",
    group: "2 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-fixed-bottom-fixed-top",
    label: "2 Field Vertical Fixed Bottom / Fixed Top",
    group: "2 Field Vertical",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-tilt-turn-bottom-fixed-top",
    label: "2 Field Vertical Tilt & Turn Bottom / Fixed Top",
    group: "2 Field Vertical",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-2-field-fixed-bottom-tilt-turn-top",
    label: "2 Field Vertical Fixed Bottom / Tilt & Turn Top",
    group: "2 Field Vertical",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-3-field-fixed-fixed-fixed",
    label: "3 Field Horizontal Fixed / Fixed / Fixed",
    group: "3 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-3-field-tilt-turn-left-fixed-tilt-turn-right",
    label: "3 Field Horizontal Tilt & Turn Left / Fixed / Tilt & Turn Right",
    group: "3 Field Horizontal",
    status: "approved-locked",
    mappedDesignIds: [],
    notes: "Static approved proof geometry rendered through the native DrawingViewport style.",
  },
  {
    id: "b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference",
    label: "3 Field Horizontal Tilt & Turn Right / Fixed / Tilt & Turn Left Equal-Field Reference",
    group: "3 Field Horizontal",
    status: "accepted-reference-only",
    mappedDesignIds: [],
    notes: "Static accepted-reference proof geometry rendered through the native DrawingViewport style; this is not full renderer generalisation.",
  },
];

export function getB92ProfileSectionProofById(id: string | null | undefined) {
  return B92_PROFILE_SECTION_PROOF_FAMILIES.find((family) => family.id === id) ?? null;
}

export function getB92ProfileSectionProofForDesignId(designId: string | null | undefined) {
  if (!designId) return null;
  return B92_PROFILE_SECTION_PROOF_FAMILIES.find((family) => family.mappedDesignIds.includes(designId)) ?? null;
}
