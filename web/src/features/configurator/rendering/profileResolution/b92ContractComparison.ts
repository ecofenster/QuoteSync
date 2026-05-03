import type { B92ProfileId } from "./b92ProfileTypes";
import type { WindowTypeRenderModel } from "./windowTypeRenderContract";

export type B92FixedSingleFieldExpectedProfileRefs = {
  top: B92ProfileId;
  left: B92ProfileId;
  right: B92ProfileId;
  bottom: B92ProfileId;
};

export type B92FixedSingleFieldExpectedGlassDimensions = {
  widthMm: number;
  heightMm: number;
};

export type B92ContractComparisonCheck = {
  key: "top" | "left" | "right" | "bottom" | "glassWidthMm" | "glassHeightMm";
  expected: B92ProfileId | number;
  actual: B92ProfileId | number | null;
  pass: boolean;
};

export type B92ContractComparisonResult = {
  pass: boolean;
  fieldId: string | null;
  checks: B92ContractComparisonCheck[];
};

export function compareB92FixedSingleFieldContract(input: {
  expectedProfileRefs: B92FixedSingleFieldExpectedProfileRefs;
  actual: WindowTypeRenderModel;
  expectedGlassDimensionsMm?: B92FixedSingleFieldExpectedGlassDimensions | null;
}): B92ContractComparisonResult {
  const field = input.actual.fields[0] ?? null;
  const checks: B92ContractComparisonCheck[] = [
    {
      key: "top",
      expected: input.expectedProfileRefs.top,
      actual: field?.perimeter.top.profileId ?? null,
      pass: field?.perimeter.top.profileId === input.expectedProfileRefs.top,
    },
    {
      key: "left",
      expected: input.expectedProfileRefs.left,
      actual: field?.perimeter.left.profileId ?? null,
      pass: field?.perimeter.left.profileId === input.expectedProfileRefs.left,
    },
    {
      key: "right",
      expected: input.expectedProfileRefs.right,
      actual: field?.perimeter.right.profileId ?? null,
      pass: field?.perimeter.right.profileId === input.expectedProfileRefs.right,
    },
    {
      key: "bottom",
      expected: input.expectedProfileRefs.bottom,
      actual: field?.perimeter.bottom.profileId ?? null,
      pass: field?.perimeter.bottom.profileId === input.expectedProfileRefs.bottom,
    },
  ];

  if (input.expectedGlassDimensionsMm) {
    checks.push(
      {
        key: "glassWidthMm",
        expected: input.expectedGlassDimensionsMm.widthMm,
        actual: field?.glass?.widthMm ?? null,
        pass: field?.glass?.widthMm === input.expectedGlassDimensionsMm.widthMm,
      },
      {
        key: "glassHeightMm",
        expected: input.expectedGlassDimensionsMm.heightMm,
        actual: field?.glass?.heightMm ?? null,
        pass: field?.glass?.heightMm === input.expectedGlassDimensionsMm.heightMm,
      }
    );
  }

  return {
    pass: checks.every((check) => check.pass),
    fieldId: field?.id ?? null,
    checks,
  };
}
