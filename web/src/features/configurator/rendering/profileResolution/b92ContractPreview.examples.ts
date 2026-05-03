import { compareB92FixedSingleFieldContract } from "./b92ContractComparison";
import { buildB92FixedSingleFieldContractPreview } from "./b92ContractPreview";

export const B92_FIXED_SINGLE_FIELD_CONTRACT_PREVIEW_EXAMPLE = buildB92FixedSingleFieldContractPreview({
  widthMm: 1000,
  heightMm: 1000,
  glassValidationDimensionsMm: {
    width: 870,
    height: 855,
    note: "Supplied validation example only; not global glass sizing logic.",
  },
});

export const B92_FIXED_SINGLE_FIELD_CONTRACT_EXPECTED_PROFILE_REFS = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

export const B92_FIXED_SINGLE_FIELD_CONTRACT_EXPECTED_GLASS_DIMENSIONS = {
  widthMm: 870,
  heightMm: 855,
} as const;

export const B92_FIXED_SINGLE_FIELD_CONTRACT_COMPARISON_EXAMPLE = compareB92FixedSingleFieldContract({
  expectedProfileRefs: B92_FIXED_SINGLE_FIELD_CONTRACT_EXPECTED_PROFILE_REFS,
  actual: B92_FIXED_SINGLE_FIELD_CONTRACT_PREVIEW_EXAMPLE,
  expectedGlassDimensionsMm: B92_FIXED_SINGLE_FIELD_CONTRACT_EXPECTED_GLASS_DIMENSIONS,
});
