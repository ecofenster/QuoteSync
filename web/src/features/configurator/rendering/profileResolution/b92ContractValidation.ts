import { compareB92FixedSingleFieldContract, type B92ContractComparisonResult } from "./b92ContractComparison";
import { buildB92FixedSingleFieldContractPreview } from "./b92ContractPreview";
import type { WindowTypeRenderModel } from "./windowTypeRenderContract";

export const B92_GLASS_ORDER_BITE_BEHIND_BEAD_MM = 13;
export const B92_GLASS_ORDER_VISIBLE_GLASS_DELTA_MM = B92_GLASS_ORDER_BITE_BEHIND_BEAD_MM * 2;

export type B92FixedInternalContractValidationView = "inside" | "outside" | "internal" | "external";

export type B92FixedInternalContractValidationInput = {
  system?: string | null;
  view: B92FixedInternalContractValidationView;
  fieldsX: number;
  fieldsY: number;
  insertion?: string | null;
  fieldType?: string | null;
  widthMm: number;
  heightMm: number;
  devFlagEnabled?: boolean | null;
  useAdminSourceModel?: boolean | null;
  fieldId?: string;
  glassValidationDimensionsMm?: {
    width: number;
    height: number;
    note?: string;
  } | null;
};

export type B92FixedInternalContractValidationReport = {
  eligible: boolean;
  reason?: string;
  contract?: WindowTypeRenderModel;
  comparison?: B92ContractComparisonResult;
};

function normalized(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isB92System(value: string | null | undefined) {
  return normalized(value) === "b92";
}

function isInternalView(value: B92FixedInternalContractValidationView) {
  const next = normalized(value);
  return next === "inside" || next === "internal";
}

function isFixedSashType(value: string | null | undefined) {
  const next = normalized(value).replace(/[_-]+/g, " ");
  return next.includes("fixed sash") || next === "fixedsash";
}

function isFixedType(value: string | null | undefined) {
  const next = normalized(value).replace(/[_-]+/g, " ");
  return next === "fixed" || (next.includes("fixed") && !isFixedSashType(value));
}

function resolveFixedInput(input: B92FixedInternalContractValidationInput) {
  return input.fieldType ?? input.insertion ?? "";
}

export function validateB92FixedInternalContractPreview(
  input: B92FixedInternalContractValidationInput
): B92FixedInternalContractValidationReport {
  if (!input.devFlagEnabled) {
    return { eligible: false, reason: "b92FixedInternalContractValidation flag is not enabled." };
  }
  if (!isB92System(input.system)) {
    return { eligible: false, reason: "Explicit B92 system identity is required." };
  }
  if (!isInternalView(input.view)) {
    return { eligible: false, reason: "B92 fixed internal contract validation requires inside/internal view." };
  }
  if (input.fieldsX !== 1 || input.fieldsY !== 1) {
    return { eligible: false, reason: "B92 fixed internal contract validation requires a 1x1 layout." };
  }

  const fixedInput = resolveFixedInput(input);
  if (isFixedSashType(fixedInput)) {
    return { eligible: false, reason: "Fixed sash is not eligible for fixed-only B92 contract validation." };
  }
  if (!isFixedType(fixedInput)) {
    return { eligible: false, reason: "B92 fixed internal contract validation requires a fixed field." };
  }

  const contract = buildB92FixedSingleFieldContractPreview({
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    fieldId: input.fieldId,
    glassValidationDimensionsMm: input.glassValidationDimensionsMm,
    dev: {
      useAdminSourceModel: input.useAdminSourceModel,
    },
  });
  const comparison = compareB92FixedSingleFieldContract({
    expectedProfileRefs: {
      top: "B92-1",
      left: "B92-2",
      right: "B92-2",
      bottom: "B92-3",
    },
    actual: contract,
    expectedGlassDimensionsMm: input.glassValidationDimensionsMm
      ? {
          widthMm: input.glassValidationDimensionsMm.width,
          heightMm: input.glassValidationDimensionsMm.height,
        }
      : null,
  });

  return {
    eligible: true,
    contract,
    comparison,
  };
}
