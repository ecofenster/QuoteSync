import type { WindowTypeSourceModel } from "../../../admin/windowTypes/windowTypeSourceModel.types";
import type { B92ProfileId } from "./b92ProfileTypes";
import type {
  WindowTypeRenderModel,
  WindowTypeRenderPerimeter,
  WindowTypeRenderProfileRef,
} from "./windowTypeRenderContract";

type RuntimeDimensionsMm = {
  widthMm: number;
  heightMm: number;
};

const B92_FIXED_INTERNAL_DESIGN_RULE =
  "Admin WindowTypeSourceModel supplies the B92 fixed internal section mapping; drawing geometry remains downstream.";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid WindowTypeSourceModel: ${message}`);
  }
}

function assertFinitePositiveDimension(value: number, label: string): void {
  assertCondition(Number.isFinite(value) && value > 0, `${label} must be a finite positive number.`);
}

function assertProfileCode(value: string, expected: B92ProfileId, label: string): void {
  assertCondition(value === expected, `${label} profile must be ${expected}.`);
}

function resolvedProfile(profileId: B92ProfileId, note?: string): WindowTypeRenderProfileRef {
  return {
    profileId,
    source: "resolved",
    note,
  };
}

function buildPerimeter(source: WindowTypeSourceModel): WindowTypeRenderPerimeter {
  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");

  const { perimeterProfiles } = fieldRule;
  assertProfileCode(perimeterProfiles.top.profileCode, "B92-1", "top");
  assertProfileCode(perimeterProfiles.left.profileCode, "B92-2", "left");
  assertProfileCode(perimeterProfiles.right.profileCode, "B92-2", "right");
  assertProfileCode(perimeterProfiles.bottom.profileCode, "B92-3", "bottom");

  return {
    top: resolvedProfile("B92-1", perimeterProfiles.top.notes),
    left: resolvedProfile("B92-2", perimeterProfiles.left.notes),
    right: resolvedProfile("B92-2", perimeterProfiles.right.notes),
    bottom: resolvedProfile("B92-3", perimeterProfiles.bottom.notes),
  };
}

function validateB92FixedInternalSource(source: WindowTypeSourceModel, dimensions: RuntimeDimensionsMm): void {
  assertFinitePositiveDimension(dimensions.widthMm, "widthMm");
  assertFinitePositiveDimension(dimensions.heightMm, "heightMm");

  assertCondition(source.status === "approved", "status must be approved.");
  assertCondition(source.systemCode === "B92", "systemCode must be B92.");
  assertCondition(source.view === "inside", "view must be inside.");
  assertCondition(source.referenceView === "external", "referenceView must be external.");
  assertCondition(source.layout.columns === 1 && source.layout.rows === 1, "layout must be 1x1.");
  assertCondition(source.fieldRules.length === 1, "exactly one field rule is required.");

  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");
  assertCondition(fieldRule.fieldSelector.row === 0, "field rule row must be 0.");
  assertCondition(fieldRule.fieldSelector.column === 0, "field rule column must be 0.");
  assertCondition(fieldRule.operationType === "fixed", "operationType must be fixed.");
  assertCondition(fieldRule.excludedOperationTypes?.includes("fixed_sash"), "fixed_sash must be excluded.");

  assertProfileCode(fieldRule.perimeterProfiles.top.profileCode, "B92-1", "top");
  assertProfileCode(fieldRule.perimeterProfiles.left.profileCode, "B92-2", "left");
  assertProfileCode(fieldRule.perimeterProfiles.right.profileCode, "B92-2", "right");
  assertProfileCode(fieldRule.perimeterProfiles.bottom.profileCode, "B92-3", "bottom");

  const { visibleFrameMm, glassOrderRule } = fieldRule.geometryRules;
  assertCondition(visibleFrameMm.top === 78, "visible frame top must be 78mm.");
  assertCondition(visibleFrameMm.left === 78, "visible frame left must be 78mm.");
  assertCondition(visibleFrameMm.right === 78, "visible frame right must be 78mm.");
  assertCondition(visibleFrameMm.bottom === 93, "visible frame bottom must be 93mm.");

  assertCondition(glassOrderRule.biteBehindBeadMm === 13, "glass order biteBehindBeadMm must be 13mm.");
  assertCondition(glassOrderRule.widthDeltaMm === 26, "glass order widthDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.heightDeltaMm === 26, "glass order heightDeltaMm must be 26mm.");
  assertCondition(glassOrderRule.formula === "visible_glass_plus_2x_bite", "glass order formula is unsupported.");
}

function metadataNotesFromSource(source: WindowTypeSourceModel): string[] {
  const fieldRule = source.fieldRules[0];
  const notes = [
    "Generated from Admin WindowTypeSourceModel infrastructure; not wired into renderer.",
    `sourceModelId=${source.id}`,
    `source=${source.provenance.source}`,
  ];

  if (source.provenance.sourceId) {
    notes.push(`sourceId=${source.provenance.sourceId}`);
  }
  if (source.provenance.version) {
    notes.push(`sourceVersion=${source.provenance.version}`);
  }
  if (fieldRule) {
    notes.push(
      `visibleFrameMm=${fieldRule.geometryRules.visibleFrameMm.top}/${fieldRule.geometryRules.visibleFrameMm.left}/${fieldRule.geometryRules.visibleFrameMm.right}/${fieldRule.geometryRules.visibleFrameMm.bottom}`
    );
    notes.push(
      `glassOrderRuleMm=bite:${fieldRule.geometryRules.glassOrderRule.biteBehindBeadMm},widthDelta:${fieldRule.geometryRules.glassOrderRule.widthDeltaMm},heightDelta:${fieldRule.geometryRules.glassOrderRule.heightDeltaMm}`
    );
    if (fieldRule.interfaceProfiles?.fixedInternal?.profileCode) {
      notes.push(`fixedInternalInterface=${fieldRule.interfaceProfiles.fixedInternal.profileCode}`);
    }
  }

  return [...notes, ...(source.provenance.notes ?? [])];
}

export function buildWindowTypeRenderModelFromSource(
  source: WindowTypeSourceModel,
  dimensions: RuntimeDimensionsMm
): WindowTypeRenderModel {
  validateB92FixedInternalSource(source, dimensions);

  const fieldRule = source.fieldRules[0];
  assertCondition(fieldRule, "one field rule is required.");

  const fieldId = fieldRule.fieldSelector.fieldKey ?? "fixed-1";

  return {
    meta: {
      system: "B92",
      referenceView: "external",
      validationMode: "external_refs_internal_validation",
      source: "resolver_contract",
      designRule: B92_FIXED_INTERNAL_DESIGN_RULE,
      notes: metadataNotesFromSource(source),
    },
    overall: {
      widthMm: dimensions.widthMm,
      heightMm: dimensions.heightMm,
    },
    fields: [
      {
        id: fieldId,
        row: fieldRule.fieldSelector.row,
        column: fieldRule.fieldSelector.column,
        type: "fixed",
        dimensionsMm: {
          width: dimensions.widthMm,
          height: dimensions.heightMm,
        },
        perimeter: buildPerimeter(source),
      },
    ],
    verticalJunctions: [],
    horizontalJunctions: [],
    couplings: [],
    corners: [],
    thresholds: [],
    constraints: [],
  };
}
