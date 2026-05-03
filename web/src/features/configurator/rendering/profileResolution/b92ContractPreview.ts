import { resolveB92Profiles } from "./b92ProfileResolver";
import type { B92ResolverInput } from "./b92ProfileTypes";
import { buildB92WindowTypeRenderModel } from "./b92WindowTypeRenderAdapter";
import type { WindowTypeRenderGlass, WindowTypeRenderModel } from "./windowTypeRenderContract";

export type BuildB92FixedSingleFieldContractPreviewInput = {
  widthMm: number;
  heightMm: number;
  fieldId?: string;
  glassValidationDimensionsMm?: {
    width: number;
    height: number;
    note?: string;
  } | null;
};

function assertFiniteDimension(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid B92 fixed single-field contract preview ${label}: expected a finite number.`);
  }
  return value;
}

export function buildB92FixedSingleFieldContractPreview(
  input: BuildB92FixedSingleFieldContractPreviewInput
): WindowTypeRenderModel {
  // Fixed single-field previews use this stable default unless a caller needs a custom contract field id.
  const fieldId = String(input.fieldId || "fixed-1").trim() || "fixed-1";
  const widthMm = assertFiniteDimension(input.widthMm, "widthMm");
  const heightMm = assertFiniteDimension(input.heightMm, "heightMm");
  const resolverInput: B92ResolverInput = {
    view: "external_refs_internal_validation",
    fields: [
      {
        id: fieldId,
        row: 0,
        column: 0,
        type: "fixed",
        openingType: "fixed",
      },
    ],
  };
  const glassDimensions: WindowTypeRenderGlass | null = input.glassValidationDimensionsMm
    ? {
        widthMm: assertFiniteDimension(input.glassValidationDimensionsMm.width, "glassValidationDimensionsMm.width"),
        heightMm: assertFiniteDimension(input.glassValidationDimensionsMm.height, "glassValidationDimensionsMm.height"),
        source: "validation_example",
        note: input.glassValidationDimensionsMm.note,
      }
    : null;

  return buildB92WindowTypeRenderModel({
    resolverInput,
    resolverOutput: resolveB92Profiles(resolverInput),
    overallDimensionsMm: {
      width: widthMm,
      height: heightMm,
    },
    fieldDimensionsMm: {
      [fieldId]: {
        width: widthMm,
        height: heightMm,
      },
    },
    ...(glassDimensions
      ? {
          glassDimensionsMm: {
            [fieldId]: {
              width: glassDimensions.widthMm,
              height: glassDimensions.heightMm,
              source: glassDimensions.source,
              note: glassDimensions.note,
            },
          },
        }
      : {}),
    validationMode: "external_refs_internal_validation",
  });
}
