import type {
  ConfiguratorManufacturerRecord,
  ConfiguratorProductRecord,
  ConfiguratorProfileMappingRecord,
  ConfiguratorRenderProfileRecord,
  ConfiguratorSectionDrawingRecord,
  ConfiguratorSectionProfileRecord,
  ConfiguratorWindowTypeRecord,
} from "../../../admin/configuratorCatalog.types";
import type {
  WindowTypeSourceModel,
  WindowTypeSourceModelGlassOrderRule,
  WindowTypeSourceModelProfileRef,
} from "../../../admin/windowTypes/windowTypeSourceModel.types";
import { b92FixedInternalWindowTypeSourceSeed } from "./b92FixedInternalWindowTypeSource.seed";

export type CatalogWindowTypeSourceAdapterInput = {
  manufacturer?: ConfiguratorManufacturerRecord | null;
  product: ConfiguratorProductRecord;
  windowType: ConfiguratorWindowTypeRecord;
  renderProfile: ConfiguratorRenderProfileRecord;
  sectionProfiles: ConfiguratorSectionProfileRecord[];
  profileMappings: ConfiguratorProfileMappingRecord[];
  sectionDrawings?: ConfiguratorSectionDrawingRecord[];
  layout: { columns: number; rows: number };
  view: "inside" | "outside" | "internal" | "external";
};

export type CatalogSourceModelComparisonDifference = {
  key: string;
  expected: unknown;
  actual: unknown;
  severity: "blocking" | "info";
};

export type CatalogSourceModelComparisonResult = {
  pass: boolean;
  differences: CatalogSourceModelComparisonDifference[];
};

type RequiredMappingKey =
  | "frame_head"
  | "frame_jamb_left"
  | "frame_jamb_right"
  | "frame_bottom";

const REQUIRED_B92_PERIMETER = {
  top: "B92-1",
  left: "B92-2",
  right: "B92-2",
  bottom: "B92-3",
} as const;

const REQUIRED_VISIBLE_FRAME = {
  top: 78,
  left: 78,
  right: 78,
  bottom: 93,
} as const;

const REQUIRED_GLASS_ORDER: WindowTypeSourceModelGlassOrderRule = {
  biteBehindBeadMm: 13,
  widthDeltaMm: 26,
  heightDeltaMm: 26,
  formula: "visible_glass_plus_2x_bite",
};

function fail(message: string): never {
  throw new Error(`Invalid catalog WindowTypeSourceModel bridge input: ${message}`);
}

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedView(value: CatalogWindowTypeSourceAdapterInput["view"]): "inside" | "outside" {
  const next = normalized(value);
  if (next === "inside" || next === "internal") return "inside";
  if (next === "outside" || next === "external") return "outside";
  fail(`unsupported view ${String(value)}.`);
}

function requireActive(record: { is_active?: boolean } | null | undefined, label: string) {
  if (!record) fail(`${label} is required.`);
  if (record.is_active === false) fail(`${label} must be active.`);
}

function assertFiniteNumber(value: unknown, expected: number, label: string) {
  const next = Number(value);
  if (!Number.isFinite(next)) fail(`${label} is required.`);
  if (next !== expected) fail(`${label} must be ${expected}mm; received ${next}mm.`);
  return next;
}

function findBestMapping(input: {
  mappings: ConfiguratorProfileMappingRecord[];
  key: string;
  operationType: string;
  manufacturerId: string | null;
  productId: string | null;
  windowTypeId: string | null;
}) {
  return input.mappings
    .filter((mapping) => mapping.is_active !== false)
    .filter((mapping) => mapping.mapping_key === input.key)
    .filter((mapping) => !mapping.operation_type || mapping.operation_type === input.operationType)
    .filter((mapping) => !mapping.manufacturer_id || mapping.manufacturer_id === input.manufacturerId)
    .filter((mapping) => !mapping.product_id || mapping.product_id === input.productId)
    .filter((mapping) => !mapping.window_type_id || mapping.window_type_id === input.windowTypeId)
    .sort((a, b) => mappingScore(b) - mappingScore(a))[0] ?? null;
}

function mappingScore(mapping: ConfiguratorProfileMappingRecord) {
  return (
    (mapping.window_type_id ? 8 : 0) +
    (mapping.product_id ? 4 : 0) +
    (mapping.manufacturer_id ? 2 : 0) +
    (mapping.operation_type ? 1 : 0)
  );
}

function profileRefForMapping(input: {
  mapping: ConfiguratorProfileMappingRecord | null;
  profilesById: Map<string, ConfiguratorSectionProfileRecord>;
  expectedCode: string;
  role: WindowTypeSourceModelProfileRef["role"];
  label: string;
  required: boolean;
  mirrored?: boolean;
}): WindowTypeSourceModelProfileRef {
  if (!input.mapping) fail(`${input.label} profile mapping is required.`);
  const profile = input.profilesById.get(input.mapping.profile_id) ?? null;
  if (!profile || profile.is_active === false) fail(`${input.label} section profile is required and must be active.`);
  if (profile.code !== input.expectedCode) {
    fail(`${input.label} profile must be ${input.expectedCode}; received ${profile.code || "(blank)"}.`);
  }
  return {
    profileCode: profile.code,
    role: input.role,
    required: input.required,
    mirrored: input.mirrored,
    sectionProfileId: profile.id,
    notes: profile.notes || input.mapping.notes || undefined,
  };
}

function optionalInterfaceProfile(input: {
  mappings: ConfiguratorProfileMappingRecord[];
  profilesById: Map<string, ConfiguratorSectionProfileRecord>;
  operationType: string;
  manufacturerId: string | null;
  productId: string | null;
  windowTypeId: string | null;
}): WindowTypeSourceModelProfileRef | null {
  const mapping =
    findBestMapping({ ...input, key: "fixed_internal_interface" }) ??
    findBestMapping({ ...input, key: "internal_interface" });
  if (!mapping) return null;
  const profile = input.profilesById.get(mapping.profile_id) ?? null;
  if (!profile || profile.is_active === false) fail("fixed internal interface section profile must be active when mapped.");
  if (profile.code !== "B92-6") fail(`fixed internal interface profile must be B92-6; received ${profile.code || "(blank)"}.`);
  return {
    profileCode: "B92-6",
    role: "fixed_internal_interface",
    required: false,
    sectionProfileId: profile.id,
    notes: profile.notes || mapping.notes || undefined,
  };
}

function readNumberRule(rules: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = rules[key];
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return null;
}

function readStringRule(rules: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = rules[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function findGlassOrderRule(sectionDrawings: ConfiguratorSectionDrawingRecord[] | undefined): WindowTypeSourceModelGlassOrderRule {
  const activeDrawings = (sectionDrawings ?? []).filter((drawing) => drawing.is_active !== false);
  for (const drawing of activeDrawings) {
    const rules = drawing.geometry_rules ?? {};
    const biteBehindBeadMm = readNumberRule(rules, ["biteBehindBeadMm", "bite_behind_bead_mm", "glass_order_bite_mm"]);
    const widthDeltaMm = readNumberRule(rules, ["widthDeltaMm", "width_delta_mm", "glass_order_width_delta_mm"]);
    const heightDeltaMm = readNumberRule(rules, ["heightDeltaMm", "height_delta_mm", "glass_order_height_delta_mm"]);
    const formula = readStringRule(rules, ["formula", "glassOrderFormula", "glass_order_formula"]);
    if (biteBehindBeadMm === null && widthDeltaMm === null && heightDeltaMm === null && formula === null) continue;
    if (
      biteBehindBeadMm === REQUIRED_GLASS_ORDER.biteBehindBeadMm &&
      widthDeltaMm === REQUIRED_GLASS_ORDER.widthDeltaMm &&
      heightDeltaMm === REQUIRED_GLASS_ORDER.heightDeltaMm &&
      formula === REQUIRED_GLASS_ORDER.formula
    ) {
      return { ...REQUIRED_GLASS_ORDER };
    }
    fail(
      `glass order rule must be bite ${REQUIRED_GLASS_ORDER.biteBehindBeadMm}, width delta ${REQUIRED_GLASS_ORDER.widthDeltaMm}, height delta ${REQUIRED_GLASS_ORDER.heightDeltaMm}, formula ${REQUIRED_GLASS_ORDER.formula}.`
    );
  }
  fail("glass order rule is required and was not found in section drawing geometry rules.");
}

function assertRequiredProfileMappings(input: CatalogWindowTypeSourceAdapterInput) {
  const profilesById = new Map(input.sectionProfiles.filter((profile) => profile.is_active !== false).map((profile) => [profile.id, profile]));
  const scope = {
    mappings: input.profileMappings,
    profilesById,
    operationType: "fixed",
    manufacturerId: input.manufacturer?.id ?? null,
    productId: input.product.id,
    windowTypeId: input.windowType.id,
  };
  const mapping = (key: RequiredMappingKey) =>
    findBestMapping({
      mappings: input.profileMappings,
      key,
      operationType: "fixed",
      manufacturerId: input.manufacturer?.id ?? null,
      productId: input.product.id,
      windowTypeId: input.windowType.id,
    });

  return {
    perimeterProfiles: {
      top: profileRefForMapping({
        ...scope,
        mapping: mapping("frame_head"),
        expectedCode: REQUIRED_B92_PERIMETER.top,
        role: "head",
        label: "top/head",
        required: true,
      }),
      left: profileRefForMapping({
        ...scope,
        mapping: mapping("frame_jamb_left"),
        expectedCode: REQUIRED_B92_PERIMETER.left,
        role: "left_jamb",
        label: "left jamb",
        required: true,
      }),
      right: profileRefForMapping({
        ...scope,
        mapping: mapping("frame_jamb_right"),
        expectedCode: REQUIRED_B92_PERIMETER.right,
        role: "right_jamb",
        label: "right jamb",
        required: true,
        mirrored: true,
      }),
      bottom: profileRefForMapping({
        ...scope,
        mapping: mapping("frame_bottom"),
        expectedCode: REQUIRED_B92_PERIMETER.bottom,
        role: "sill",
        label: "bottom/sill",
        required: true,
      }),
    },
    interfaceProfile: optionalInterfaceProfile(scope),
  };
}

export function buildWindowTypeSourceModelFromCatalog(input: CatalogWindowTypeSourceAdapterInput): WindowTypeSourceModel {
  requireActive(input.product, "product");
  requireActive(input.windowType, "windowType");
  requireActive(input.renderProfile, "renderProfile");

  if (input.product.code !== "B92") fail(`product.code must be B92; received ${input.product.code || "(blank)"}.`);
  const view = normalizedView(input.view);
  if (view !== "inside") fail("only inside/internal view is supported.");
  if (input.layout.columns !== 1 || input.layout.rows !== 1) fail("only 1x1 layout is supported.");
  if (normalized(input.windowType.operation_type) !== "fixed") fail("only fixed window type operation is supported.");
  if (normalized(input.renderProfile.operation_type) !== "fixed") fail("only fixed render profile operation is supported.");
  if (normalized(input.windowType.operation_type).includes("fixed_sash") || normalized(input.windowType.operation_type).includes("fixed sash")) {
    fail("fixed sash is not supported.");
  }
  if (normalized(input.renderProfile.view_logic) !== "inside") fail("renderProfile.view_logic must be inside.");

  const { perimeterProfiles, interfaceProfile } = assertRequiredProfileMappings(input);
  const visibleFrameMm = {
    top: assertFiniteNumber(input.renderProfile.frame_top_visible_mm, REQUIRED_VISIBLE_FRAME.top, "visible frame top"),
    left: assertFiniteNumber(input.renderProfile.frame_left_visible_mm, REQUIRED_VISIBLE_FRAME.left, "visible frame left"),
    right: assertFiniteNumber(input.renderProfile.frame_right_visible_mm, REQUIRED_VISIBLE_FRAME.right, "visible frame right"),
    bottom: assertFiniteNumber(input.renderProfile.frame_bottom_visible_mm, REQUIRED_VISIBLE_FRAME.bottom, "visible frame bottom"),
  };
  const glassOrderRule = findGlassOrderRule(input.sectionDrawings);

  return {
    id: `catalog:${input.windowType.id}:inside:1x1`,
    manufacturerId: input.manufacturer?.id ?? null,
    productId: input.product.id,
    windowTypeId: input.windowType.id,
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
        perimeterProfiles,
        ...(interfaceProfile
          ? {
              interfaceProfiles: {
                fixedInternal: interfaceProfile,
              },
            }
          : {}),
        geometryRules: {
          visibleFrameMm,
          glassOrderRule,
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
      source: "admin_catalog",
      sourceId: `catalog:${input.product.id}:${input.windowType.id}:${input.renderProfile.id}`,
      version: "catalog-source-bridge-v1",
      notes: [
        "Generated by read-only Catalog to WindowTypeSourceModel bridge.",
        "B92 fixed internal 1x1 only; no fallback or inferred generic geometry is accepted.",
      ],
    },
  };
}

function addDifference(
  differences: CatalogSourceModelComparisonDifference[],
  key: string,
  expected: unknown,
  actual: unknown,
  severity: CatalogSourceModelComparisonDifference["severity"] = "blocking"
) {
  if (expected === actual) return;
  differences.push({ key, expected, actual, severity });
}

function firstField(model: WindowTypeSourceModel) {
  return model.fieldRules[0] ?? null;
}

export function compareCatalogSourceModelToB92FixedSeed(
  actual: WindowTypeSourceModel
): CatalogSourceModelComparisonResult {
  const expected = b92FixedInternalWindowTypeSourceSeed;
  const differences: CatalogSourceModelComparisonDifference[] = [];
  const expectedField = firstField(expected);
  const actualField = firstField(actual);

  addDifference(differences, "systemCode", expected.systemCode, actual.systemCode);
  addDifference(differences, "view", expected.view, actual.view);
  addDifference(differences, "referenceView", expected.referenceView, actual.referenceView);
  addDifference(differences, "layout.columns", expected.layout.columns, actual.layout.columns);
  addDifference(differences, "layout.rows", expected.layout.rows, actual.layout.rows);
  addDifference(differences, "fieldRules.length", expected.fieldRules.length, actual.fieldRules.length);

  if (!expectedField || !actualField) {
    addDifference(differences, "fieldRules[0]", "present", actualField ? "present" : "missing");
    return { pass: differences.length === 0, differences };
  }

  addDifference(differences, "field.operationType", expectedField.operationType, actualField.operationType);
  addDifference(
    differences,
    "field.perimeterProfiles.top.profileCode",
    expectedField.perimeterProfiles.top.profileCode,
    actualField.perimeterProfiles.top.profileCode
  );
  addDifference(
    differences,
    "field.perimeterProfiles.left.profileCode",
    expectedField.perimeterProfiles.left.profileCode,
    actualField.perimeterProfiles.left.profileCode
  );
  addDifference(
    differences,
    "field.perimeterProfiles.right.profileCode",
    expectedField.perimeterProfiles.right.profileCode,
    actualField.perimeterProfiles.right.profileCode
  );
  addDifference(
    differences,
    "field.perimeterProfiles.bottom.profileCode",
    expectedField.perimeterProfiles.bottom.profileCode,
    actualField.perimeterProfiles.bottom.profileCode
  );
  addDifference(
    differences,
    "field.interfaceProfiles.fixedInternal.profileCode",
    expectedField.interfaceProfiles?.fixedInternal?.profileCode ?? null,
    actualField.interfaceProfiles?.fixedInternal?.profileCode ?? null
  );
  addDifference(differences, "visibleFrameMm.top", expectedField.geometryRules.visibleFrameMm.top, actualField.geometryRules.visibleFrameMm.top);
  addDifference(differences, "visibleFrameMm.left", expectedField.geometryRules.visibleFrameMm.left, actualField.geometryRules.visibleFrameMm.left);
  addDifference(differences, "visibleFrameMm.right", expectedField.geometryRules.visibleFrameMm.right, actualField.geometryRules.visibleFrameMm.right);
  addDifference(differences, "visibleFrameMm.bottom", expectedField.geometryRules.visibleFrameMm.bottom, actualField.geometryRules.visibleFrameMm.bottom);
  addDifference(
    differences,
    "glassOrderRule.biteBehindBeadMm",
    expectedField.geometryRules.glassOrderRule.biteBehindBeadMm,
    actualField.geometryRules.glassOrderRule.biteBehindBeadMm
  );
  addDifference(
    differences,
    "glassOrderRule.widthDeltaMm",
    expectedField.geometryRules.glassOrderRule.widthDeltaMm,
    actualField.geometryRules.glassOrderRule.widthDeltaMm
  );
  addDifference(
    differences,
    "glassOrderRule.heightDeltaMm",
    expectedField.geometryRules.glassOrderRule.heightDeltaMm,
    actualField.geometryRules.glassOrderRule.heightDeltaMm
  );
  addDifference(
    differences,
    "glassOrderRule.formula",
    expectedField.geometryRules.glassOrderRule.formula,
    actualField.geometryRules.glassOrderRule.formula
  );
  addDifference(differences, "constraints.allowFixedSash", expected.constraints.allowFixedSash, actual.constraints.allowFixedSash);
  addDifference(differences, "constraints.allowMultiField", expected.constraints.allowMultiField, actual.constraints.allowMultiField);
  addDifference(differences, "constraints.allowOutsideView", expected.constraints.allowOutsideView, actual.constraints.allowOutsideView);

  return {
    pass: differences.length === 0,
    differences,
  };
}
