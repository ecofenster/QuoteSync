import type { WindowTypeRenderModel } from "./windowTypeRenderContract";

export type AdminSourceContractComparisonDifference = {
  key: string;
  resolverValue: unknown;
  adminSourceValue: unknown;
};

export type AdminSourceContractComparisonResult = {
  pass: boolean;
  skippedKeys: string[];
  differences: AdminSourceContractComparisonDifference[];
};

function addDifference(
  differences: AdminSourceContractComparisonDifference[],
  key: string,
  resolverValue: unknown,
  adminSourceValue: unknown
): void {
  if (resolverValue !== adminSourceValue) {
    differences.push({ key, resolverValue, adminSourceValue });
  }
}

function arrayLength(value: unknown[] | undefined): number {
  return value?.length ?? 0;
}

export function compareAdminSourceContractToResolverContract(input: {
  resolverContract: WindowTypeRenderModel;
  adminSourceContract: WindowTypeRenderModel;
}): AdminSourceContractComparisonResult {
  const { resolverContract, adminSourceContract } = input;
  const differences: AdminSourceContractComparisonDifference[] = [];
  const skippedKeys = [
    "meta.designRule",
    "meta.notes",
    "provenance/source notes",
    "functionally equivalent single-field id differences",
    "admin absent field.glass when resolver only has validation example glass",
  ];

  addDifference(differences, "meta.system", resolverContract.meta.system, adminSourceContract.meta.system);
  addDifference(
    differences,
    "meta.referenceView",
    resolverContract.meta.referenceView,
    adminSourceContract.meta.referenceView
  );
  addDifference(
    differences,
    "meta.validationMode",
    resolverContract.meta.validationMode,
    adminSourceContract.meta.validationMode
  );
  addDifference(differences, "overall.widthMm", resolverContract.overall.widthMm, adminSourceContract.overall.widthMm);
  addDifference(
    differences,
    "overall.heightMm",
    resolverContract.overall.heightMm,
    adminSourceContract.overall.heightMm
  );
  addDifference(differences, "fields.length", resolverContract.fields.length, adminSourceContract.fields.length);

  const resolverField = resolverContract.fields[0] ?? null;
  const adminField = adminSourceContract.fields[0] ?? null;
  if (!resolverField || !adminField) {
    addDifference(differences, "fields[0].exists", Boolean(resolverField), Boolean(adminField));
  } else {
    addDifference(differences, "fields[0].row", resolverField.row, adminField.row);
    addDifference(differences, "fields[0].column", resolverField.column, adminField.column);
    addDifference(differences, "fields[0].type", resolverField.type, adminField.type);
    addDifference(differences, "fields[0].dimensionsMm.width", resolverField.dimensionsMm.width, adminField.dimensionsMm.width);
    addDifference(
      differences,
      "fields[0].dimensionsMm.height",
      resolverField.dimensionsMm.height,
      adminField.dimensionsMm.height
    );
    addDifference(
      differences,
      "fields[0].perimeter.top.profileId",
      resolverField.perimeter.top.profileId,
      adminField.perimeter.top.profileId
    );
    addDifference(
      differences,
      "fields[0].perimeter.left.profileId",
      resolverField.perimeter.left.profileId,
      adminField.perimeter.left.profileId
    );
    addDifference(
      differences,
      "fields[0].perimeter.right.profileId",
      resolverField.perimeter.right.profileId,
      adminField.perimeter.right.profileId
    );
    addDifference(
      differences,
      "fields[0].perimeter.bottom.profileId",
      resolverField.perimeter.bottom.profileId,
      adminField.perimeter.bottom.profileId
    );
    addDifference(
      differences,
      "fields[0].perimeter.top.source",
      resolverField.perimeter.top.source,
      adminField.perimeter.top.source
    );
    addDifference(
      differences,
      "fields[0].perimeter.left.source",
      resolverField.perimeter.left.source,
      adminField.perimeter.left.source
    );
    addDifference(
      differences,
      "fields[0].perimeter.right.source",
      resolverField.perimeter.right.source,
      adminField.perimeter.right.source
    );
    addDifference(
      differences,
      "fields[0].perimeter.bottom.source",
      resolverField.perimeter.bottom.source,
      adminField.perimeter.bottom.source
    );

    const resolverGlass = resolverField.glass ?? null;
    const adminGlass = adminField.glass ?? null;
    const ignoreValidationExampleGlass = resolverGlass?.source === "validation_example" && !adminGlass;
    if (!ignoreValidationExampleGlass) {
      addDifference(differences, "fields[0].glass.widthMm", resolverGlass?.widthMm ?? null, adminGlass?.widthMm ?? null);
      addDifference(
        differences,
        "fields[0].glass.heightMm",
        resolverGlass?.heightMm ?? null,
        adminGlass?.heightMm ?? null
      );
      addDifference(differences, "fields[0].glass.source", resolverGlass?.source ?? null, adminGlass?.source ?? null);
    }
  }

  addDifference(
    differences,
    "verticalJunctions.length",
    arrayLength(resolverContract.verticalJunctions),
    arrayLength(adminSourceContract.verticalJunctions)
  );
  addDifference(
    differences,
    "horizontalJunctions.length",
    arrayLength(resolverContract.horizontalJunctions),
    arrayLength(adminSourceContract.horizontalJunctions)
  );
  addDifference(differences, "couplings.length", arrayLength(resolverContract.couplings), arrayLength(adminSourceContract.couplings));
  addDifference(differences, "corners.length", arrayLength(resolverContract.corners), arrayLength(adminSourceContract.corners));
  addDifference(
    differences,
    "thresholds.length",
    arrayLength(resolverContract.thresholds),
    arrayLength(adminSourceContract.thresholds)
  );
  addDifference(
    differences,
    "constraints.length",
    arrayLength(resolverContract.constraints),
    arrayLength(adminSourceContract.constraints)
  );

  return {
    pass: differences.length === 0,
    skippedKeys,
    differences,
  };
}
