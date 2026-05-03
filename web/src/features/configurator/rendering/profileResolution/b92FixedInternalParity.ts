import type { DrawingModel, DrawingRect, DrawingShape } from "../drawingModel";

export type B92FixedInternalParityRectKey =
  | "frame.top"
  | "frame.left"
  | "frame.right"
  | "frame.bottom"
  | "bead.top"
  | "bead.left"
  | "bead.right"
  | "bead.bottom"
  | "glass";

export type B92FixedInternalParityRect = {
  key: B92FixedInternalParityRectKey;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  role?: string | null;
};

export type B92FixedInternalParitySnapshot = {
  source: "b92_fixed_internal_target" | "drawing_model";
  overall: {
    widthMm: number;
    heightMm: number;
  };
  frameRectangles: B92FixedInternalParityRect[];
  beadRectangles: B92FixedInternalParityRect[];
  glassRectangle: B92FixedInternalParityRect | null;
  layerOrder: string[];
  notes: string[];
  glassOrderNote?: {
    widthMm: number;
    heightMm: number;
    note: string;
  };
};

export type B92FixedInternalParityTargetInput = {
  widthMm: number;
  heightMm: number;
  visibleFrameMm?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  glassOrderNoteMm?: {
    widthMm: number;
    heightMm: number;
  } | null;
};

export type B92FixedInternalParityCheck = {
  key: string;
  expected: number | string | null;
  actual: number | string | null;
  pass: boolean;
};

export type B92FixedInternalParityComparison = {
  pass: boolean;
  toleranceMm: number;
  checks: B92FixedInternalParityCheck[];
  missing: string[];
  extra: string[];
};

const DEFAULT_B92_FIXED_INTERNAL_VISIBLE_FRAME_MM = {
  top: 78,
  left: 78,
  right: 78,
  bottom: 93,
};

function assertFiniteMm(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid B92 fixed internal parity ${label}: expected a finite millimetre value.`);
  }
}

function roundMm(value: number) {
  return Math.round(value * 1000) / 1000;
}

function isDrawingRect(shape: DrawingShape): shape is DrawingRect {
  return shape.kind === "rect";
}

function roleIncludes(shape: DrawingRect, token: string) {
  return String(shape.role ?? "").toLowerCase().includes(token);
}

function rectValueChecks(
  key: string,
  expected: B92FixedInternalParityRect | null,
  actual: B92FixedInternalParityRect | null,
  toleranceMm: number
): B92FixedInternalParityCheck[] {
  const checks: B92FixedInternalParityCheck[] = [];
  for (const property of ["xMm", "yMm", "widthMm", "heightMm"] as const) {
    const expectedValue = expected?.[property] ?? null;
    const actualValue = actual?.[property] ?? null;
    checks.push({
      key: `${key}.${property}`,
      expected: expectedValue,
      actual: actualValue,
      pass:
        expectedValue !== null &&
        actualValue !== null &&
        Math.abs(expectedValue - actualValue) <= toleranceMm,
    });
  }
  return checks;
}

function findRectByKey(rectangles: B92FixedInternalParityRect[], key: B92FixedInternalParityRectKey) {
  return rectangles.find((rectangle) => rectangle.key === key) ?? null;
}

function convertRectToMm(input: {
  rect: DrawingRect;
  key: B92FixedInternalParityRectKey;
  originPx: { x: number; y: number };
  scaleX: number;
  scaleY: number;
}): B92FixedInternalParityRect {
  const { rect, key, originPx, scaleX, scaleY } = input;
  return {
    key,
    xMm: roundMm((rect.x - originPx.x) / scaleX),
    yMm: roundMm((rect.y - originPx.y) / scaleY),
    widthMm: roundMm(rect.width / scaleX),
    heightMm: roundMm(rect.height / scaleY),
    role: rect.role ?? null,
  };
}

export function buildB92FixedInternalParityTarget(
  input: B92FixedInternalParityTargetInput
): B92FixedInternalParitySnapshot {
  const visibleFrame = input.visibleFrameMm ?? DEFAULT_B92_FIXED_INTERNAL_VISIBLE_FRAME_MM;
  assertFiniteMm(input.widthMm, "widthMm");
  assertFiniteMm(input.heightMm, "heightMm");
  for (const [key, value] of Object.entries(visibleFrame)) {
    assertFiniteMm(value, `visibleFrameMm.${key}`);
  }

  const glassWidthMm = input.widthMm - visibleFrame.left - visibleFrame.right;
  const glassHeightMm = input.heightMm - visibleFrame.top - visibleFrame.bottom;
  if (glassWidthMm <= 0 || glassHeightMm <= 0) {
    throw new Error("Invalid B92 fixed internal parity target: visible frame faces leave no visible glass area.");
  }

  const frameRectangles: B92FixedInternalParityRect[] = [
    {
      key: "frame.top",
      xMm: 0,
      yMm: 0,
      widthMm: input.widthMm,
      heightMm: visibleFrame.top,
    },
    {
      key: "frame.left",
      xMm: 0,
      yMm: visibleFrame.top,
      widthMm: visibleFrame.left,
      heightMm: glassHeightMm,
    },
    {
      key: "frame.right",
      xMm: input.widthMm - visibleFrame.right,
      yMm: visibleFrame.top,
      widthMm: visibleFrame.right,
      heightMm: glassHeightMm,
    },
    {
      key: "frame.bottom",
      xMm: 0,
      yMm: input.heightMm - visibleFrame.bottom,
      widthMm: input.widthMm,
      heightMm: visibleFrame.bottom,
    },
  ];
  const glassOrderNoteMm =
    input.glassOrderNoteMm ??
    (input.widthMm === 1000 && input.heightMm === 1000
      ? {
          widthMm: 870,
          heightMm: 855,
        }
      : null);

  return {
    source: "b92_fixed_internal_target",
    overall: {
      widthMm: input.widthMm,
      heightMm: input.heightMm,
    },
    frameRectangles,
    beadRectangles: [],
    glassRectangle: {
      key: "glass",
      xMm: visibleFrame.left,
      yMm: visibleFrame.top,
      widthMm: glassWidthMm,
      heightMm: glassHeightMm,
    },
    layerOrder: ["frame.top", "frame.left", "frame.right", "frame.bottom", "glass"],
    notes: [
      "B92 fixed internal target uses explicit B92 visible frame faces.",
      "Pilot output is only a comparison baseline and is not used as a source of truth.",
      "Bead rectangles are not generated until explicit B92 bead positioning rules are confirmed.",
    ],
    glassOrderNote: glassOrderNoteMm
      ? {
          widthMm: glassOrderNoteMm.widthMm,
          heightMm: glassOrderNoteMm.heightMm,
          note: "Glass order size is validation/reference data only and is not used for visible geometry parity.",
        }
      : undefined,
  };
}

export function serializeDrawingModelForB92FixedInternalParity(
  model: DrawingModel
): B92FixedInternalParitySnapshot {
  const frameRects = model.geometry.frame.filter(isDrawingRect);
  const glassRects = model.geometry.glass.filter(isDrawingRect);
  const allRects = model.elements.flatMap((element) =>
    element.shapes.filter(isDrawingRect).map((shape) => ({ elementId: element.id, rect: shape }))
  );
  const boundsSource = [...frameRects, ...glassRects][0] ?? null;
  const outerBounds = [...frameRects, ...glassRects].reduce(
    (bounds, rect) => ({
      x0: Math.min(bounds.x0, rect.x),
      y0: Math.min(bounds.y0, rect.y),
      x1: Math.max(bounds.x1, rect.x + rect.width),
      y1: Math.max(bounds.y1, rect.y + rect.height),
    }),
    boundsSource
      ? {
          x0: boundsSource.x,
          y0: boundsSource.y,
          x1: boundsSource.x + boundsSource.width,
          y1: boundsSource.y + boundsSource.height,
        }
      : { x0: 0, y0: 0, x1: model.width, y1: model.height }
  );
  const scaleX = (outerBounds.x1 - outerBounds.x0) / model.width;
  const scaleY = (outerBounds.y1 - outerBounds.y0) / model.height;
  if (!Number.isFinite(scaleX) || scaleX <= 0 || !Number.isFinite(scaleY) || scaleY <= 0) {
    throw new Error("Invalid drawing model parity serialization: cannot resolve drawing scale.");
  }

  const visibleGlass = glassRects.find((rect) => roleIncludes(rect, "glass")) ?? glassRects[0] ?? null;
  const beadRects = frameRects.filter((rect) => roleIncludes(rect, "bead"));
  const nonBeadFrameRects = frameRects.filter((rect) => !roleIncludes(rect, "bead"));

  return {
    source: "drawing_model",
    overall: {
      widthMm: model.width,
      heightMm: model.height,
    },
    frameRectangles: nonBeadFrameRects.map((rect, index) =>
      convertRectToMm({
        rect,
        key: `frame.${(["top", "left", "right", "bottom"][index] ?? "top")}` as B92FixedInternalParityRectKey,
        originPx: { x: outerBounds.x0, y: outerBounds.y0 },
        scaleX,
        scaleY,
      })
    ),
    beadRectangles: beadRects.map((rect, index) =>
      convertRectToMm({
        rect,
        key: `bead.${(["top", "left", "right", "bottom"][index] ?? "top")}` as B92FixedInternalParityRectKey,
        originPx: { x: outerBounds.x0, y: outerBounds.y0 },
        scaleX,
        scaleY,
      })
    ),
    glassRectangle: visibleGlass
      ? convertRectToMm({
          rect: visibleGlass,
          key: "glass",
          originPx: { x: outerBounds.x0, y: outerBounds.y0 },
          scaleX,
          scaleY,
        })
      : null,
    layerOrder: allRects.map(({ elementId, rect }) => `${elementId}:${rect.role ?? "rect"}`),
    notes: [
      "Drawing model serialization converts rectangle bounds to millimetres for parity comparison.",
      "Stroke width, colour, and rendered pixels are intentionally ignored.",
    ],
  };
}

export function compareB92FixedInternalParity(input: {
  expected: B92FixedInternalParitySnapshot;
  actual: B92FixedInternalParitySnapshot;
  toleranceMm?: number;
}): B92FixedInternalParityComparison {
  const toleranceMm = input.toleranceMm ?? 0;
  const checks: B92FixedInternalParityCheck[] = [
    {
      key: "overall.widthMm",
      expected: input.expected.overall.widthMm,
      actual: input.actual.overall.widthMm,
      pass: Math.abs(input.expected.overall.widthMm - input.actual.overall.widthMm) <= toleranceMm,
    },
    {
      key: "overall.heightMm",
      expected: input.expected.overall.heightMm,
      actual: input.actual.overall.heightMm,
      pass: Math.abs(input.expected.overall.heightMm - input.actual.overall.heightMm) <= toleranceMm,
    },
  ];

  const expectedKeys = new Set<string>();
  const actualKeys = new Set<string>();
  for (const expectedFrame of input.expected.frameRectangles) {
    expectedKeys.add(expectedFrame.key);
    checks.push(
      ...rectValueChecks(
        expectedFrame.key,
        expectedFrame,
        findRectByKey(input.actual.frameRectangles, expectedFrame.key),
        toleranceMm
      )
    );
  }
  for (const expectedBead of input.expected.beadRectangles) {
    expectedKeys.add(expectedBead.key);
    checks.push(
      ...rectValueChecks(
        expectedBead.key,
        expectedBead,
        findRectByKey(input.actual.beadRectangles, expectedBead.key),
        toleranceMm
      )
    );
  }
  for (const actualFrame of input.actual.frameRectangles) actualKeys.add(actualFrame.key);
  for (const actualBead of input.actual.beadRectangles) actualKeys.add(actualBead.key);
  if (input.expected.glassRectangle) expectedKeys.add(input.expected.glassRectangle.key);
  if (input.actual.glassRectangle) actualKeys.add(input.actual.glassRectangle.key);
  checks.push(
    ...rectValueChecks(
      "glass",
      input.expected.glassRectangle,
      input.actual.glassRectangle,
      toleranceMm
    )
  );

  const missing = Array.from(expectedKeys).filter((key) => !actualKeys.has(key));
  const extra = Array.from(actualKeys).filter((key) => !expectedKeys.has(key));

  return {
    pass: checks.every((check) => check.pass) && missing.length === 0 && extra.length === 0,
    toleranceMm,
    checks,
    missing,
    extra,
  };
}
