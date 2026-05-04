import { buildWindowTypeRenderModelFromSource } from "./adminWindowTypeSourceAdapter";
import { compareAdminSourceContractToResolverContract } from "./adminSourceContractComparison";
import { b92FixedInternalWindowTypeSourceSeed } from "./b92FixedInternalWindowTypeSource.seed";
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
  dev?: {
    useAdminSourceModel?: boolean | null;
    useAdminSourceModelReturn?: boolean | null;
  };
};

function assertFiniteDimension(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid B92 fixed single-field contract preview ${label}: expected a finite number.`);
  }
  return value;
}

function buildAdminSourceComparison(input: {
  widthMm: number;
  heightMm: number;
  resolverContract: WindowTypeRenderModel;
  allowReturn: boolean;
}): { contract: WindowTypeRenderModel | null; notes: string[]; canReturn: boolean } {
  try {
    const adminSourceContract = buildWindowTypeRenderModelFromSource(b92FixedInternalWindowTypeSourceSeed, {
      widthMm: input.widthMm,
      heightMm: input.heightMm,
    });
    const comparison = compareAdminSourceContractToResolverContract({
      resolverContract: input.resolverContract,
      adminSourceContract,
    });
    const failingKeys = comparison.differences.map((difference) => difference.key);
    const canReturn = input.allowReturn && comparison.pass === true && comparison.differences.length === 0;
    const fallbackReason = canReturn
      ? "none"
      : input.allowReturn
        ? "admin comparison did not pass exactly"
        : "useAdminSourceModelReturn flag is not enabled";
    return {
      contract: adminSourceContract,
      canReturn,
      notes: [
        `devReports.adminSourceModelUsed=false`,
        `devReports.adminVsResolverContractComparison.pass=${comparison.pass}`,
        `devReports.adminVsResolverContractComparison.failingKeys=${failingKeys.length ? failingKeys.join(",") : "none"}`,
        `devReports.adminSourceModelReturnAllowed=${input.allowReturn}`,
        `devReports.adminSourceModelFallbackReason=${fallbackReason}`,
      ],
    };
  } catch (error) {
    return {
      contract: null,
      canReturn: false,
      notes: [
        `devReports.adminSourceModelUsed=false`,
        `devReports.adminVsResolverContractComparison.pass=false`,
        `devReports.adminVsResolverContractComparison.error=${error instanceof Error ? error.message : String(error)}`,
        `devReports.adminSourceModelReturnAllowed=${input.allowReturn}`,
        `devReports.adminSourceModelFallbackReason=admin source adapter or comparison failed`,
      ],
    };
  }
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

  const resolverContract = buildB92WindowTypeRenderModel({
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

  if (input.dev?.useAdminSourceModel === true) {
    const adminSourceComparison = buildAdminSourceComparison({
      widthMm,
      heightMm,
      resolverContract,
      allowReturn: input.dev.useAdminSourceModelReturn === true,
    });

    if (adminSourceComparison.canReturn && adminSourceComparison.contract) {
      return {
        ...adminSourceComparison.contract,
        meta: {
          ...adminSourceComparison.contract.meta,
          notes: [
            ...(adminSourceComparison.contract.meta.notes ?? []),
            ...adminSourceComparison.notes.map((note) =>
              note === "devReports.adminSourceModelUsed=false" ? "devReports.adminSourceModelUsed=true" : note
            ),
          ],
        },
      };
    }

    return {
      ...resolverContract,
      meta: {
        ...resolverContract.meta,
        notes: [
          ...(resolverContract.meta.notes ?? []),
          ...adminSourceComparison.notes,
        ],
      },
    };
  }

  return resolverContract;
}
