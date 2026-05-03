import { B92_FIXED_SINGLE_INTERNAL_EXAMPLE, B92_FIXED_SINGLE_INTERNAL_EXAMPLE_INPUT } from "./b92ProfileResolver.examples";
import { resolveB92Profiles } from "./b92ProfileResolver";
import { buildB92WindowTypeRenderModel } from "./b92WindowTypeRenderAdapter";
import type { B92ResolverInput } from "./b92ProfileTypes";

export const fixed_single_internal_validation_adapter_example = buildB92WindowTypeRenderModel({
  resolverInput: B92_FIXED_SINGLE_INTERNAL_EXAMPLE_INPUT,
  resolverOutput: B92_FIXED_SINGLE_INTERNAL_EXAMPLE,
  overallDimensionsMm: {
    width: 1000,
    height: 1000,
  },
  fieldDimensionsMm: {
    "fixed-1": {
      width: 1000,
      height: 1000,
    },
  },
  glassDimensionsMm: {
    "fixed-1": {
      width: 870,
      height: 855,
      source: "validation_example",
      note: "Supplied drawing validation example for 1000 x 1000 fixed only; not global sizing logic.",
    },
  },
  validationMode: "external_refs_internal_validation",
});

export const unresolved_fixed_fixed_junction_adapter_example_input: B92ResolverInput = {
  view: "external",
  fields: [
    {
      id: "fixed-left",
      row: 0,
      column: 0,
      type: "fixed",
      openingType: "fixed",
    },
    {
      id: "fixed-right",
      row: 0,
      column: 1,
      type: "fixed",
      openingType: "fixed",
    },
  ],
  verticalJoins: [
    {
      id: "junction-1",
      leftFieldId: "fixed-left",
      rightFieldId: "fixed-right",
      condition: "fixed_to_fixed",
    },
  ],
};

export const unresolved_fixed_fixed_junction_adapter_example = buildB92WindowTypeRenderModel({
  resolverInput: unresolved_fixed_fixed_junction_adapter_example_input,
  resolverOutput: resolveB92Profiles(unresolved_fixed_fixed_junction_adapter_example_input),
  overallDimensionsMm: {
    width: 2000,
    height: 1000,
  },
  fieldDimensionsMm: {
    "fixed-left": {
      width: 1000,
      height: 1000,
    },
    "fixed-right": {
      width: 1000,
      height: 1000,
    },
  },
});
