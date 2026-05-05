import type {
  WindowTypeSourceModel,
  WindowTypeSourceModelFieldRule,
  WindowTypeSourceModelGeometryRules,
} from "../../../admin/windowTypes/windowTypeSourceModel.types";

type BlockedFixedSashGeometryRules = Partial<WindowTypeSourceModelGeometryRules> & {
  measurementStatus: "blocked";
  measurementTodo: string;
};

type BlockedFixedSashFieldRule = Omit<WindowTypeSourceModelFieldRule, "geometryRules"> & {
  geometryRules: BlockedFixedSashGeometryRules;
};

type BlockedFixedSashSourceModel = Omit<WindowTypeSourceModel, "fieldRules" | "status"> & {
  status: "draft";
  fieldRules: BlockedFixedSashFieldRule[];
};

// Draft only. Do not use this seed for rendering, catalog authority, or Admin preview binding.
// Fixed sash geometry is not authoritative until PDF/catalog measurements confirm frame, sash, bead, and glass order rules.
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
        measurementStatus: "blocked",
        measurementTodo:
          "Fixed sash geometry requires PDF/catalog confirmation for frame, sash, bead, and glass order.",
      },
    },
  ],
  constraints: {
    allowFixedSash: true,
    allowMultiField: false,
    allowOutsideView: false,
    blockingIssues: [
      {
        key: "fixed_sash.measurements",
        reason: "Fixed sash geometry requires PDF/catalog confirmation for frame, sash, bead, and glass order.",
        severity: "blocking",
      },
    ],
  },
  status: "draft",
  provenance: {
    source: "admin_seed",
    sourceId: "b92-fixed-sash-internal-draft",
    version: "fixed-sash-profile-basis-draft",
    notes: [
      "Draft only; not authoritative.",
      "Do not use for rendering.",
      "Confirmed profile basis: sash B92-7, B92-8, B92-9, B92-10.",
      "Awaiting measurement confirmation before catalog, contract, drawing, or Admin preview integration.",
    ],
  },
} as const satisfies BlockedFixedSashSourceModel;
