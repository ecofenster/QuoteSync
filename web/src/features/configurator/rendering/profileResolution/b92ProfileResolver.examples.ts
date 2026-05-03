import { resolveB92Profiles } from "./b92ProfileResolver";
import type { B92ResolverInput } from "./b92ProfileTypes";

export const B92_FIXED_SINGLE_INTERNAL_EXAMPLE_INPUT: B92ResolverInput = {
  view: "external_refs_internal_validation",
  fields: [
    {
      id: "fixed-1",
      row: 0,
      column: 0,
      type: "fixed",
      openingType: "fixed",
    },
  ],
};

export const B92_FIXED_SINGLE_INTERNAL_EXAMPLE = resolveB92Profiles(B92_FIXED_SINGLE_INTERNAL_EXAMPLE_INPUT);

export const B92_FIXED_SINGLE_INTERNAL_EXPECTED_PROFILE_REFS = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

export const B92_FIXED_SINGLE_INTERNAL_GLASS_ORDER_VALIDATION_EXAMPLE = {
  sourceFrameSizeMm: {
    width: 1000,
    height: 1000,
  },
  glassOrderSizeMm: {
    width: 870,
    height: 855,
  },
  note: "Supplied drawing validation example only. Do not use as hard-coded global glass sizing logic.",
} as const;

export const B92_EXAMPLE_NOTES = [
  "All numbered B92 elevation references are treated as external-view references.",
  "C07-C16 are plan/top-down corner systems, not elevation profile refs.",
  "B92-25 and B92-26 are threshold systems, not normal sill profiles.",
  "external_refs_internal_validation means internal validation using external profile reference IDs; it is not internal-view geometry.",
  "The guarded fixed internal rectangle pilot remains a temporary validation path and is not wired to this resolver.",
] as const;
