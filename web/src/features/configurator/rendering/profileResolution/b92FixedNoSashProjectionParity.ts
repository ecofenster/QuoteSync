import type { DrawingModel } from "../drawingModel";
import {
  buildB92FixedInternalParityTarget,
  compareB92FixedInternalParity,
  serializeDrawingModelForB92FixedInternalParity,
  type B92FixedInternalParityComparison,
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
  toleranceMm: number;
  rendererOutputChanged: false;
  pilotUsedAsDrawingModel: false;
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

type B92FixedNoSashProjectionParityDevFlags = WindowTypeRenderModel["meta"]["dev"] & {
  b92ProjectionFixedNoSashParityDiagnostics?: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

export function buildB92FixedNoSashProjectionParityReport(input: {
  contract: WindowTypeRenderModel;
  existingRendererModel: DrawingModel;
  toleranceMm?: number;
}): B92FixedNoSashProjectionParityReport {
  const toleranceMm = input.toleranceMm ?? 0;
  const eligibility = parityEligibility(input.contract);

  if (!eligibility.eligible) {
    return {
      enabled: eligibility.enabled,
      eligible: false,
      reasons: eligibility.reasons,
      toleranceMm,
      rendererOutputChanged: false,
      pilotUsedAsDrawingModel: false,
      comparison: null,
      glassOrderComparison: null,
    };
  }

  try {
    const projectionModel = projectionPilotModelForComparison(input.contract);
    if (!projectionModel) {
      return {
        enabled: true,
        eligible: true,
        reasons: ["projection pilot model could not be built"],
        toleranceMm,
        rendererOutputChanged: false,
        pilotUsedAsDrawingModel: false,
        comparison: null,
        glassOrderComparison: null,
      };
    }

    const projectionSnapshot = serializeDrawingModelForB92FixedInternalParity(projectionModel);
    const existingSnapshot = serializeDrawingModelForB92FixedInternalParity(input.existingRendererModel);
    const comparison = compareB92FixedInternalParity({
      expected: projectionSnapshot,
      actual: existingSnapshot,
      toleranceMm,
    });

    return {
      enabled: true,
      eligible: true,
      reasons: [],
      toleranceMm,
      rendererOutputChanged: false,
      pilotUsedAsDrawingModel: false,
      comparison,
      glassOrderComparison: compareGlassOrderDimensions({
        expected: projectionModel,
        actual: input.existingRendererModel,
        toleranceMm,
      }),
    };
  } catch (error) {
    return {
      enabled: true,
      eligible: true,
      reasons: [],
      toleranceMm,
      rendererOutputChanged: false,
      pilotUsedAsDrawingModel: false,
      comparison: null,
      glassOrderComparison: null,
      error: error instanceof Error ? error.message : String(error),
    };
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
