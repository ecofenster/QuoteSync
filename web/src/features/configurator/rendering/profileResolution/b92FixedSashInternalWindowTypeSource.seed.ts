import type {
  WindowTypeSourceModel,
  WindowTypeSourceModelFieldRule,
  WindowTypeSourceModelGeometryRules,
} from "../../../admin/windowTypes/windowTypeSourceModel.types";

type ValidatedFixedSashGeometryRules = Partial<WindowTypeSourceModelGeometryRules> & {
  measurementStatus: "validated";
  measurementTodo: string;
};

type ValidatedFixedSashFieldRule = Omit<WindowTypeSourceModelFieldRule, "geometryRules"> & {
  geometryRules: ValidatedFixedSashGeometryRules;
};

type ValidatedFixedSashSourceModel = Omit<WindowTypeSourceModel, "fieldRules" | "status"> & {
  status: "approved";
  fieldRules: ValidatedFixedSashFieldRule[];
};

// Approved source seed. Do not use this seed for rendering, catalog authority, or Admin preview binding.
// B92 fixed sash internal uses the exact T&T visual stack, but has no opening
// operation or hardware; the sash is permanently fixed in place with hidden fixings.
// B92 glass sits behind the glazing bead by 13mm on all sides; glass order
// adds 26mm width and 26mm height. Fixed sash geometry validated via catalog and adapter comparison.
export const b92FixedSashInternalWindowTypeSourceSeed = {
  id: "b92-fixed-sash-1x1-internal-draft",
  manufacturerId: null,
  productId: null,
  windowTypeId: null,
  systemCode: "B92",
  view: "inside",
  referenceView: "external",
  layout: {
    columns: 1,
    rows: 1,
  },
  fieldRules: [
    {
      fieldSelector: {
        row: 0,
        column: 0,
        fieldKey: "0,0",
      },
      operationType: "fixed_sash",
      perimeterProfiles: {
        top: {
          profileCode: "B92-1",
          role: "head",
          required: true,
          notes: "Provisional: same perimeter basis as fixed internal until fixed sash perimeter is confirmed.",
        },
        left: {
          profileCode: "B92-2",
          role: "left_jamb",
          required: true,
          notes: "Provisional: same perimeter basis as fixed internal until fixed sash perimeter is confirmed.",
        },
        right: {
          profileCode: "B92-2",
          role: "right_jamb",
          required: true,
          mirrored: true,
          notes: "Provisional: same perimeter basis as fixed internal until fixed sash perimeter is confirmed.",
        },
        bottom: {
          profileCode: "B92-3",
          role: "sill",
          required: true,
          notes: "Provisional: same perimeter basis as fixed internal until fixed sash perimeter is confirmed.",
        },
      },
      sashProfiles: {
        top: {
          profileCode: "B92-7",
          role: "sash_head",
          required: true,
        },
        left: {
          profileCode: "B92-9",
          role: "sash_left_jamb",
          required: true,
          notes: "Standard side assignment pending PDF/catalog confirmation.",
        },
        right: {
          profileCode: "B92-10",
          role: "sash_right_jamb",
          required: true,
          notes: "Standard side assignment pending PDF/catalog confirmation.",
        },
        bottom: {
          profileCode: "B92-8",
          role: "sash_bottom",
          required: true,
          notes: "Standard B92-8 used first; B92-8a through B92-8g variants require confirmation before use.",
        },
      },
      geometryRules: {
        visibleFrameMm: {
          top: 37.5,
          left: 37.5,
          right: 37.5,
          bottom: 52.5,
        },
        ventVisibleFrameMm: {
          top: 59.5,
          left: 37.5,
          right: 37.5,
          bottom: 52.5,
          notes: "Trickle vent variant follows the existing T&T internal top visible frame rule.",
        },
        sashGeometryRules: {
          visibleFaceMm: {
            top: 57,
            left: 57,
            right: 57,
            bottom: 57,
          },
          insetMm: {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            formula: "explicit_per_side",
          },
          overlapMm: {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            formula: "explicit_per_side",
          },
        },
        beadGeometryRules: {
          visibleFaceMm: {
            top: 21,
            left: 21,
            right: 21,
            bottom: 21,
          },
          biteBehindBeadMm: 13,
          notes: ["B92 glass sits behind glazing bead by 13mm on all sides."],
        },
        glassOrderRule: {
          biteBehindBeadMm: 13,
          widthDeltaMm: 26,
          heightDeltaMm: 26,
          formula: "visible_glass_plus_2x_bite",
        },
        measurementStatus: "validated",
        measurementTodo:
          "Fixed sash geometry validated via catalog and adapter comparison.",
      },
    },
  ],
  constraints: {
    allowFixedSash: true,
    allowMultiField: false,
    allowOutsideView: false,
    blockingIssues: [],
  },
  status: "approved",
  provenance: {
    source: "admin_seed",
    sourceId: "b92-fixed-sash-internal-draft",
    version: "fixed-sash-profile-basis-draft",
    notes: [
      "Fixed sash geometry validated via catalog and adapter comparison.",
      "Do not use for rendering.",
      "Fixed sash uses the exact Tilt & Turn internal visual stack.",
      "No opening operation or hardware; sash is permanently fixed with hidden fixings.",
      "B92 glass sits behind glazing bead by 13mm on all sides.",
      "Glass order adds 26mm width and 26mm height.",
      "Confirmed profile basis: sash B92-7, B92-8, B92-9, B92-10.",
      "Fixed sash remains unwired until Admin preview integration is explicitly approved.",
    ],
  },
} as const satisfies ValidatedFixedSashSourceModel;
