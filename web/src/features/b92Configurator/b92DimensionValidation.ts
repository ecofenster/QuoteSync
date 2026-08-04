export const B92_DIMENSION_MIN_MM = 300;
export const B92_DIMENSION_MAX_MM = 6000;

export type B92DimensionField = "width" | "height";

export type B92DimensionValidationErrors = Partial<Record<B92DimensionField, string>>;

export type B92DimensionValidationResult =
  | {
      valid: true;
      widthMm: number;
      heightMm: number;
      errors: B92DimensionValidationErrors;
    }
  | {
      valid: false;
      errors: B92DimensionValidationErrors;
    };

export type B92GeneratedSplitValidationResult = {
  valid: boolean;
  errors: string[];
};

function validateDimension(rawValue: string, label: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) return `${label} is required.`;
  if (!/^\d+$/.test(trimmed)) return `${label} must be whole millimetres only.`;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return `${label} must be a valid number.`;
  if (value < B92_DIMENSION_MIN_MM) return `${label} must be at least ${B92_DIMENSION_MIN_MM}mm.`;
  if (value > B92_DIMENSION_MAX_MM) return `${label} must be no more than ${B92_DIMENSION_MAX_MM}mm.`;

  return value;
}

export function validateB92OverallDimensions(widthInput: string, heightInput: string): B92DimensionValidationResult {
  const widthResult = validateDimension(widthInput, "Width");
  const heightResult = validateDimension(heightInput, "Height");
  const errors: B92DimensionValidationErrors = {};

  if (typeof widthResult === "string") errors.width = widthResult;
  if (typeof heightResult === "string") errors.height = heightResult;

  if (typeof widthResult !== "number" || typeof heightResult !== "number") return { valid: false, errors };

  return {
    valid: true,
    widthMm: widthResult,
    heightMm: heightResult,
    errors: {},
  };
}

export function buildB92EqualSplit(total: number, parts: number) {
  const safeParts = Math.max(1, Math.round(parts));
  const base = Math.floor(total / safeParts);
  const remainder = total - base * safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function validateB92GeneratedSplits(
  values: number[],
  expectedCount: number,
  expectedTotal: number,
  label: string
): B92GeneratedSplitValidationResult {
  const errors: string[] = [];
  const safeExpectedCount = Math.max(1, Math.round(expectedCount));

  if (values.length !== safeExpectedCount) {
    errors.push(`${label} count is ${values.length}; expected ${safeExpectedCount}.`);
  }

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    errors.push(`${label} must contain positive whole millimetre values.`);
  }

  const sum = values.reduce((total, value) => total + value, 0);
  if (sum !== expectedTotal) {
    errors.push(`${label} sum is ${sum}mm; expected ${expectedTotal}mm.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
