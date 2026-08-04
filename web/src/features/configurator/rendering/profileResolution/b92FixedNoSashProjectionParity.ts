import type { DrawingModel } from "../drawingModel";
import {
  buildB92FixedInternalParityTarget,
  compareB92FixedInternalParity,
  serializeDrawingModelForB92FixedInternalParity,
  type B92FixedInternalParityComparison,
  type B92FixedInternalParitySnapshot,
} from "./b92FixedInternalParity";
import {
  buildB92FixedNoSashProjectionPilotDrawingModel,
  evaluateB92FixedNoSashProjectionPilotEligibility,
  type B92FixedNoSashProjectionPilotEligibility,
} from "./b92FixedNoSashProjectionDrawingPilot";
import type { WindowTypeRenderModel } from "./windowTypeRenderContract";

export type B92FixedNoSashProjectionParityReport = {
  enabled: boolean;
  eligible: boolean;
  reasons: string[];
  parityPassed: boolean | null;
  parityWarnings: string[];
  parityFailures: string[];
  toleranceMm: number;
  rendererOutputChanged: false;
  pilotUsedAsDrawingModel: false;
  summary: B92FixedNoSashProjectionParitySummary | null;
  compactComparisons: B92FixedNoSashProjectionCompactComparison[];
  frameEdgeComparison: Record<B92FixedNoSashProjectionFrameEdge, B92FixedNoSashProjectionCompactComparison | null>;
  daylightComparison: B92FixedNoSashProjectionCompactComparison | null;
  comparison: B92FixedInternalParityComparison | null;
  glassOrderComparison: {
    pass: boolean;
    expectedWidthMm: number | null;
    actualWidthMm: number | null;
    expectedHeightMm: number | null;
    actualHeightMm: number | null;
    widthDeltaMm: number | null;
    heightDeltaMm: number | null;
  } | null;
  error?: string;
};

export type B92FixedNoSashProjectionFrameEdge = "top" | "left" | "right" | "bottom";

export type B92FixedNoSashProjectionCompactComparison = {
  key: string;
  pass: boolean;
  expected: Record<string, number | string | null>;
  actual: Record<string, number | string | null>;
  deltasMm: Record<string, number | null>;
  maxAbsDeltaMm: number | null;
};

export type B92FixedNoSashProjectionParitySummary = {
  pass: boolean;
  toleranceMm: number;
  checkCount: number;
  failedCheckCount: number;
  missingRectCount: number;
  extraRectCount: number;
  comparedRectCounts: {
    projectionFrame: number;
    projectionBead: number;
    projectionGlass: number;
    existingFrame: number;
    existingBead: number;
    existingGlass: number;
  };
  comparedLayerCounts: {
    projection: number;
    existing: number;
  };
  maxAbsDeltaMm: number | null;
};

type B92FixedNoSashProjectionParityDevFlags = WindowTypeRenderModel["meta"]["dev"] & {
  b92ProjectionFixedNoSashParityDiagnostics?: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundedDelta(actual: number | string | null, expected: number | string | null): number | null {
  if (typeof actual !== "number" || typeof expected !== "number") return null;
  return Math.round((actual - expected) * 1000) / 1000;
}

function maxAbs(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return null;
  return Math.max(...finite.map((value) => Math.abs(value)));
}

function parityFlagEnabled(contract: WindowTypeRenderModel): boolean {
  const dev = contract.meta.dev as B92FixedNoSashProjectionParityDevFlags | undefined;
  return dev?.b92ProjectionFixedNoSashParityDiagnostics === true;
}

function parityEligibility(contract: WindowTypeRenderModel): B92FixedNoSashProjectionPilotEligibility {
  const pilotEligibility = evaluateB92FixedNoSashProjectionPilotEligibility({
    ...contract,
    meta: {
      ...contract.meta,
      dev: {
        ...contract.meta.dev,
        b92UseProjectionFixedNoSashDrawingPilot: true,
      } as WindowTypeRenderModel["meta"]["dev"],
    },
  });
  const enabled = parityFlagEnabled(contract);
  const reasons = enabled ? pilotEligibility.reasons : ["parity diagnostics flag is off"];

  return {
    enabled,
    eligible: enabled && pilotEligibility.eligible,
    reasons,
  };
}

function projectionPilotModelForComparison(contract: WindowTypeRenderModel): DrawingModel | null {
  return buildB92FixedNoSashProjectionPilotDrawingModel({
    ...contract,
    meta: {
      ...contract.meta,
      dev: {
        ...contract.meta.dev,
        b92UseProjectionFixedNoSashDrawingPilot: true,
      } as WindowTypeRenderModel["meta"]["dev"],
    },
  }).model;
}

function existingGlassOrderDimensions(model: DrawingModel): { widthMm: number | null; heightMm: number | null } {
  const adapterReport = isRecord(model.metadata.devReports?.b92FixedInternalContractDrawingAdapter)
    ? model.metadata.devReports.b92FixedInternalContractDrawingAdapter
    : null;
  const glassOrder = adapterReport && isRecord(adapterReport.glassOrderNoteMm) ? adapterReport.glassOrderNoteMm : null;
  return {
    widthMm: glassOrder ? numericValue(glassOrder.width) ?? numericValue(glassOrder.widthMm) : null,
    heightMm: glassOrder ? numericValue(glassOrder.height) ?? numericValue(glassOrder.heightMm) : null,
  };
}

function projectionGlassOrderDimensions(model: DrawingModel): { widthMm: number | null; heightMm: number | null } {
  const pilotReport = isRecord(model.metadata.devReports?.b92FixedNoSashProjectionDrawingPilot)
    ? model.metadata.devReports.b92FixedNoSashProjectionDrawingPilot
    : null;
  const glassOrder = pilotReport && isRecord(pilotReport.glassOrderMm) ? pilotReport.glassOrderMm : null;
  return {
    widthMm: glassOrder ? numericValue(glassOrder.width) ?? numericValue(glassOrder.widthMm) : null,
    heightMm: glassOrder ? numericValue(glassOrder.height) ?? numericValue(glassOrder.heightMm) : null,
  };
}

function compareGlassOrderDimensions(input: {
  expected: DrawingModel;
  actual: DrawingModel;
  toleranceMm: number;
}): B92FixedNoSashProjectionParityReport["glassOrderComparison"] {
  const expected = projectionGlassOrderDimensions(input.expected);
  const actual = existingGlassOrderDimensions(input.actual);
  const widthDeltaMm =
    expected.widthMm !== null && actual.widthMm !== null ? actual.widthMm - expected.widthMm : null;
  const heightDeltaMm =
    expected.heightMm !== null && actual.heightMm !== null ? actual.heightMm - expected.heightMm : null;

  return {
    pass:
      widthDeltaMm !== null &&
      heightDeltaMm !== null &&
      Math.abs(widthDeltaMm) <= input.toleranceMm &&
      Math.abs(heightDeltaMm) <= input.toleranceMm,
    expectedWidthMm: expected.widthMm,
    actualWidthMm: actual.widthMm,
    expectedHeightMm: expected.heightMm,
    actualHeightMm: actual.heightMm,
    widthDeltaMm,
    heightDeltaMm,
  };
}

function compactComparisonForKey(
  comparison: B92FixedInternalParityComparison,
  key: string
): B92FixedNoSashProjectionCompactComparison | null {
  const checks = comparison.checks.filter((check) => check.key.startsWith(`${key}.`));
  if (checks.length === 0) return null;

  const expected: Record<string, number | string | null> = {};
  const actual: Record<string, number | string | null> = {};
  const deltasMm: Record<string, number | null> = {};

  for (const check of checks) {
    const property = check.key.slice(key.length + 1);
    expected[property] = check.expected;
    actual[property] = check.actual;
    deltasMm[property] = roundedDelta(check.actual, check.expected);
  }

  return {
    key,
    pass: checks.every((check) => check.pass),
    expected,
    actual,
    deltasMm,
    maxAbsDeltaMm: maxAbs(Object.values(deltasMm)),
  };
}

function compactComparisons(
  comparison: B92FixedInternalParityComparison
): B92FixedNoSashProjectionCompactComparison[] {
  const keys = Array.from(new Set(comparison.checks.map((check) => check.key.split(".").slice(0, 2).join("."))));
  return keys
    .map((key) => compactComparisonForKey(comparison, key))
    .filter((item): item is B92FixedNoSashProjectionCompactComparison => !!item);
}

function frameEdgeComparison(
  comparison: B92FixedInternalParityComparison
): Record<B92FixedNoSashProjectionFrameEdge, B92FixedNoSashProjectionCompactComparison | null> {
  return {
    top: compactComparisonForKey(comparison, "frame.top"),
    left: compactComparisonForKey(comparison, "frame.left"),
    right: compactComparisonForKey(comparison, "frame.right"),
    bottom: compactComparisonForKey(comparison, "frame.bottom"),
  };
}

function paritySummary(input: {
  comparison: B92FixedInternalParityComparison;
  projectionSnapshot: B92FixedInternalParitySnapshot;
  existingSnapshot: B92FixedInternalParitySnapshot;
}): B92FixedNoSashProjectionParitySummary {
  const compact = compactComparisons(input.comparison);
  return {
    pass: input.comparison.pass,
    toleranceMm: input.comparison.toleranceMm,
    checkCount: input.comparison.checks.length,
    failedCheckCount: input.comparison.checks.filter((check) => !check.pass).length,
    missingRectCount: input.comparison.missing.length,
    extraRectCount: input.comparison.extra.length,
    comparedRectCounts: {
      projectionFrame: input.projectionSnapshot.frameRectangles.length,
      projectionBead: input.projectionSnapshot.beadRectangles.length,
      projectionGlass: input.projectionSnapshot.glassRectangle ? 1 : 0,
      existingFrame: input.existingSnapshot.frameRectangles.length,
      existingBead: input.existingSnapshot.beadRectangles.length,
      existingGlass: input.existingSnapshot.glassRectangle ? 1 : 0,
    },
    comparedLayerCounts: {
      projection: input.projectionSnapshot.layerOrder.length,
      existing: input.existingSnapshot.layerOrder.length,
    },
    maxAbsDeltaMm: maxAbs(compact.map((item) => item.maxAbsDeltaMm)),
  };
}

function parityFailures(input: {
  comparison: B92FixedInternalParityComparison | null;
  glassOrderComparison: B92FixedNoSashProjectionParityReport["glassOrderComparison"];
  error?: string;
}): string[] {
  const failures: string[] = [];
  if (input.error) failures.push(input.error);
  if (input.comparison) {
    for (const check of input.comparison.checks) {
      if (!check.pass) failures.push(`${check.key}: expected ${String(check.expected)}, actual ${String(check.actual)}`);
    }
    for (const missing of input.comparison.missing) failures.push(`missing rect: ${missing}`);
  }
  if (input.glassOrderComparison && !input.glassOrderComparison.pass) {
    failures.push(
      `glass order mismatch: expected ${String(input.glassOrderComparison.expectedWidthMm)}x${String(
        input.glassOrderComparison.expectedHeightMm
      )}, actual ${String(input.glassOrderComparison.actualWidthMm)}x${String(input.glassOrderComparison.actualHeightMm)}`
    );
  }
  return failures;
}

function parityWarnings(input: {
  comparison: B92FixedInternalParityComparison | null;
  glassOrderComparison: B92FixedNoSashProjectionParityReport["glassOrderComparison"];
}): string[] {
  const warnings: string[] = [];
  if (input.comparison) {
    for (const extra of input.comparison.extra) warnings.push(`extra rect: ${extra}`);
  }
  if (!input.glassOrderComparison) warnings.push("glass order comparison unavailable");
  return warnings;
}

function emptyReport(input: {
  enabled: boolean;
  eligible: boolean;
  reasons: string[];
  toleranceMm: number;
  error?: string;
}): B92FixedNoSashProjectionParityReport {
  return {
    enabled: input.enabled,
    eligible: input.eligible,
    reasons: input.reasons,
    parityPassed: input.error ? false : null,
    parityWarnings: [],
    parityFailures: input.error ? [input.error] : [],
    toleranceMm: input.toleranceMm,
    rendererOutputChanged: false,
    pilotUsedAsDrawingModel: false,
    summary: null,
    compactComparisons: [],
    frameEdgeComparison: {
      top: null,
      left: null,
      right: null,
      bottom: null,
    },
    daylightComparison: null,
    comparison: null,
    glassOrderComparison: null,
    ...(input.error ? { error: input.error } : {}),
  };
}

export function buildB92FixedNoSashProjectionParityReport(input: {
  contract: WindowTypeRenderModel;
  existingRendererModel: DrawingModel;
  toleranceMm?: number;
}): B92FixedNoSashProjectionParityReport {
  const toleranceMm = input.toleranceMm ?? 0;
  const eligibility = parityEligibility(input.contract);

  if (!eligibility.eligible) {
    return emptyReport({
      enabled: eligibility.enabled,
      eligible: false,
      reasons: eligibility.reasons,
      toleranceMm,
    });
  }

  try {
    const projectionModel = projectionPilotModelForComparison(input.contract);
    if (!projectionModel) {
      return emptyReport({
        enabled: true,
        eligible: true,
        reasons: ["projection pilot model could not be built"],
        toleranceMm,
      });
    }

    const projectionSnapshot = serializeDrawingModelForB92FixedInternalParity(projectionModel);
    const existingSnapshot = serializeDrawingModelForB92FixedInternalParity(input.existingRendererModel);
    const comparison = compareB92FixedInternalParity({
      expected: projectionSnapshot,
      actual: existingSnapshot,
      toleranceMm,
    });
    const glassOrderComparison = compareGlassOrderDimensions({
      expected: projectionModel,
      actual: input.existingRendererModel,
      toleranceMm,
    });
    if (!glassOrderComparison) {
      return emptyReport({
        enabled: true,
        eligible: true,
        reasons: [],
        toleranceMm,
        error: "Glass order comparison was not available.",
      });
    }
    const summary = paritySummary({ comparison, projectionSnapshot, existingSnapshot });
    const compact = compactComparisons(comparison);
    const failures = parityFailures({ comparison, glassOrderComparison });
    const warnings = parityWarnings({ comparison, glassOrderComparison });

    return {
      enabled: true,
      eligible: true,
      reasons: [],
      parityPassed: comparison.pass && glassOrderComparison.pass,
      parityWarnings: warnings,
      parityFailures: failures,
      toleranceMm,
      rendererOutputChanged: false,
      pilotUsedAsDrawingModel: false,
      summary,
      compactComparisons: compact,
      frameEdgeComparison: frameEdgeComparison(comparison),
      daylightComparison: compactComparisonForKey(comparison, "glass"),
      comparison,
      glassOrderComparison,
    };
  } catch (error) {
    return emptyReport({
      enabled: true,
      eligible: true,
      reasons: [],
      toleranceMm,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function withB92FixedNoSashProjectionParityDiagnostics(input: {
  contract: WindowTypeRenderModel;
  model: DrawingModel;
  toleranceMm?: number;
}): DrawingModel {
  if (!parityFlagEnabled(input.contract)) return input.model;

  return {
    ...input.model,
    metadata: {
      ...input.model.metadata,
      devReports: {
        ...input.model.metadata.devReports,
        b92FixedNoSashProjectionParity: buildB92FixedNoSashProjectionParityReport({
          contract: input.contract,
          existingRendererModel: input.model,
          toleranceMm: input.toleranceMm,
        }),
      },
    },
  };
}
