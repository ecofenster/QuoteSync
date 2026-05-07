import {
  createB92FixedNoSashDatumProjectionFixture,
  createB92SashFieldDatumProjectionFixture,
} from "./b92DatumProjectionFixture";
import type {
  B92ProjectedDrawableRegion,
  B92ProjectedDrawableRegionCategory,
  B92ProjectionBoundsMm,
  B92ProjectionUnresolvedReason,
} from "./b92DatumProjection.types";
import {
  assertGlassOrderExpansion,
  projectB92DatumProjectionPlan,
  type B92ProjectionEngineResult,
} from "./b92ProjectionEngine";
import { summarizeB92ProjectionRegions } from "./b92ProjectionDebug";

export type B92ProjectionValidationSeverity = "error" | "warning" | "info";

export type B92ProjectionValidationIssue = {
  id: string;
  severity: B92ProjectionValidationSeverity;
  code:
    | "invalid_bounds"
    | "missing_expected_category"
    | "missing_expected_status"
    | "missing_unresolved_reason"
    | "meeting_geometry_projected"
    | "glass_order_mismatch"
    | "fixture_projection_failed";
  regionId?: string;
  note: string;
};

export type B92ProjectionValidationReport = {
  id: string;
  valid: boolean;
  issues: B92ProjectionValidationIssue[];
  summary: ReturnType<typeof summarizeB92ProjectionRegions>;
};

type StaticFixtureKey = "fixed_no_sash" | "sash_field";

const STATIC_FIXTURE_BOUNDS: Record<StaticFixtureKey, B92ProjectionBoundsMm> = {
  fixed_no_sash: { x: 0, y: 0, width: 1000, height: 1000 },
  sash_field: { x: 0, y: 0, width: 1000, height: 1000 },
};

function issue(input: B92ProjectionValidationIssue): B92ProjectionValidationIssue {
  return input;
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validateBounds(region: B92ProjectedDrawableRegion): B92ProjectionValidationIssue[] {
  if (!region.boundsMm) return [];
  const { x, y, width, height } = region.boundsMm;
  if ([x, y, width, height].every(isFiniteNonNegative)) return [];
  return [
    issue({
      id: `${region.id}:invalid-bounds`,
      severity: "error",
      code: "invalid_bounds",
      regionId: region.id,
      note: "Projected bounds must be finite and non-negative.",
    }),
  ];
}

function hasCategory(regions: B92ProjectedDrawableRegion[], category: B92ProjectedDrawableRegionCategory): boolean {
  return regions.some((region) => region.category === category);
}

function hasResolvedCategory(
  regions: B92ProjectedDrawableRegion[],
  category: B92ProjectedDrawableRegionCategory
): boolean {
  return regions.some((region) => region.category === category && region.status === "resolved");
}

function unresolvedText(result: B92ProjectionEngineResult): string {
  return result.unresolved.map((item) => `${item.reason} ${item.note}`).join("\n").toLowerCase();
}

function hasUnresolvedReason(result: B92ProjectionEngineResult, reason: B92ProjectionUnresolvedReason): boolean {
  return result.unresolved.some((item) => item.reason === reason);
}

function validateRequiredUnresolved(result: B92ProjectionEngineResult): B92ProjectionValidationIssue[] {
  const issues: B92ProjectionValidationIssue[] = [];
  const text = unresolvedText(result);

  if (!text.includes("bottom sash overlay/rebate")) {
    issues.push(
      issue({
        id: "b92-projection:missing-bottom-sash-unresolved",
        severity: "error",
        code: "missing_unresolved_reason",
        note: "Bottom sash overlay/rebate relationship must remain explicitly unresolved.",
      })
    );
  }
  if (!text.includes("meeting ownership")) {
    issues.push(
      issue({
        id: "b92-projection:missing-meeting-ownership-unresolved",
        severity: "error",
        code: "missing_unresolved_reason",
        note: "Meeting ownership geometry must remain explicitly unresolved.",
      })
    );
  }
  if (!hasUnresolvedReason(result, "unsupported_view_divergence")) {
    issues.push(
      issue({
        id: "b92-projection:missing-external-view-unresolved",
        severity: "error",
        code: "missing_unresolved_reason",
        note: "External-view projection must remain explicitly unresolved.",
      })
    );
  }

  return issues;
}

function validateNoMeetingGeometryProjected(result: B92ProjectionEngineResult): B92ProjectionValidationIssue[] {
  const projectedMeeting = result.projectedRegions.find(
    (region) =>
      (region.category === "meeting_profile" || region.category === "meeting_ownership") &&
      region.status === "resolved"
  );
  if (!projectedMeeting) return [];
  return [
    issue({
      id: `${projectedMeeting.id}:meeting-geometry-projected`,
      severity: "error",
      code: "meeting_geometry_projected",
      regionId: projectedMeeting.id,
      note: "Detailed meeting geometry must not be silently projected.",
    }),
  ];
}

function validateGlassOrderIfProjected(result: B92ProjectionEngineResult): B92ProjectionValidationIssue[] {
  const daylight = result.projectedRegions.find((region) => region.category === "daylight_opening");
  const glassOrder = result.projectedRegions.find((region) => region.category === "glass_order");
  if (!daylight?.boundsMm || !glassOrder?.boundsMm || glassOrder.category !== "glass_order") return [];

  try {
    assertGlassOrderExpansion(daylight, glassOrder);
    return [];
  } catch (error) {
    return [
      issue({
        id: `${glassOrder.id}:glass-order-mismatch`,
        severity: "error",
        code: "glass_order_mismatch",
        regionId: glassOrder.id,
        note: error instanceof Error ? error.message : "Glass order projection did not match B92 expansion rule.",
      }),
    ];
  }
}

function validateExpectedCategories(
  result: B92ProjectionEngineResult,
  categories: B92ProjectedDrawableRegionCategory[]
): B92ProjectionValidationIssue[] {
  return categories
    .filter((category) => !hasCategory(result.projectedRegions, category))
    .map((category) =>
      issue({
        id: `b92-projection:missing-category:${category}`,
        severity: "error",
        code: "missing_expected_category",
        note: `Expected projection category is missing: ${category}.`,
      })
    );
}

function validateResolvedCategories(
  result: B92ProjectionEngineResult,
  categories: B92ProjectedDrawableRegionCategory[]
): B92ProjectionValidationIssue[] {
  return categories
    .filter((category) => !hasResolvedCategory(result.projectedRegions, category))
    .map((category) =>
      issue({
        id: `b92-projection:missing-resolved-category:${category}`,
        severity: "error",
        code: "missing_expected_status",
        note: `Expected at least one resolved projection category: ${category}.`,
      })
    );
}

export function validateB92ProjectionEngineResult(
  id: string,
  result: B92ProjectionEngineResult,
  expectedCategories: B92ProjectedDrawableRegionCategory[] = []
): B92ProjectionValidationReport {
  const issues = [
    ...result.projectedRegions.flatMap(validateBounds),
    ...validateExpectedCategories(result, expectedCategories),
    ...validateRequiredUnresolved(result),
    ...validateNoMeetingGeometryProjected(result),
    ...validateGlassOrderIfProjected(result),
  ];

  return {
    id,
    valid: issues.every((item) => item.severity !== "error"),
    issues,
    summary: summarizeB92ProjectionRegions(result.projectedRegions),
  };
}

export function validateB92ProjectionFixture(fixture: StaticFixtureKey): B92ProjectionValidationReport {
  const fieldId = `${fixture}-validation`;
  const plan =
    fixture === "fixed_no_sash"
      ? createB92FixedNoSashDatumProjectionFixture(fieldId)
      : createB92SashFieldDatumProjectionFixture(fieldId);
  const result = projectB92DatumProjectionPlan({
    plan,
    fieldBoundsById: {
      [fieldId]: STATIC_FIXTURE_BOUNDS[fixture],
    },
  });

  const expectedCategories: B92ProjectedDrawableRegionCategory[] =
    fixture === "fixed_no_sash"
      ? ["visible_frame_face"]
      : [
          "structural_frame_datum",
          "visible_frame_face",
          "hidden_frame_rebate",
          "visible_sash_body",
          "bead",
          "daylight_opening",
          "glass_order",
        ];

  const baseReport = validateB92ProjectionEngineResult(`b92-static-fixture:${fixture}`, result, expectedCategories);
  const resolvedCategoryIssues =
    fixture === "fixed_no_sash"
      ? validateResolvedCategories(result, ["visible_frame_face"])
      : validateResolvedCategories(result, [
          "structural_frame_datum",
          "visible_frame_face",
          "hidden_frame_rebate",
          "visible_sash_body",
          "bead",
        ]);
  const issues = [...baseReport.issues, ...resolvedCategoryIssues];

  return {
    ...baseReport,
    valid: issues.every((item) => item.severity !== "error"),
    issues,
  };
}

export function validateB92StaticProjectionFixtures(): B92ProjectionValidationReport[] {
  return [validateB92ProjectionFixture("fixed_no_sash"), validateB92ProjectionFixture("sash_field")];
}
