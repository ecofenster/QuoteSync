import type { WindowTypeSourceModel } from "../../../admin/windowTypes/windowTypeSourceModel.types";

export const b92FixedInternalWindowTypeSourceSeed = {
  id: "b92-fixed-1x1-internal",
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
      operationType: "fixed",
      excludedOperationTypes: ["fixed_sash"],
      perimeterProfiles: {
        top: {
          profileCode: "B92-1",
          role: "head",
          required: true,
        },
        left: {
          profileCode: "B92-2",
          role: "left_jamb",
          required: true,
        },
        right: {
          profileCode: "B92-2",
          role: "right_jamb",
          required: true,
          mirrored: true,
        },
        bottom: {
          profileCode: "B92-3",
          role: "sill",
          required: true,
        },
      },
      interfaceProfiles: {
        fixedInternal: {
          profileCode: "B92-6",
          role: "fixed_internal_interface",
          required: false,
        },
      },
      geometryRules: {
        visibleFrameMm: {
          top: 78,
          left: 78,
          right: 78,
          bottom: 93,
        },
        glassOrderRule: {
          biteBehindBeadMm: 13,
          widthDeltaMm: 26,
          heightDeltaMm: 26,
          formula: "visible_glass_plus_2x_bite",
        },
      },
    },
  ],
  constraints: {
    allowFixedSash: false,
    allowMultiField: false,
    allowOutsideView: false,
  },
  status: "approved",
  provenance: {
    source: "admin_seed",
    sourceId: "b92-fixed-internal-contract-validation",
    version: "phase-i-source-model-seed",
    notes: [
      "Seed model only; not persisted to the database.",
      "B92 fixed internal single-field mapping remains disconnected from renderer wiring until Admin Window Type flow becomes source of truth.",
    ],
  },
} as const satisfies WindowTypeSourceModel;
