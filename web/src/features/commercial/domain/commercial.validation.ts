import type { CurrencyCode, DecimalString, Money, ValidationIssue, ValidationResult } from "./commercial.types";

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function isValidDecimalString(value: unknown): value is DecimalString {
  return typeof value === "string" && DECIMAL_PATTERN.test(value);
}

export function normalizeCurrencyCode(value: string): CurrencyCode {
  return value.trim().toUpperCase();
}

export function isValidCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_PATTERN.test(value);
}

export function validateMoney(
  money: Money | null | undefined,
  options: { path?: string; allowNegative?: boolean; required?: boolean } = {}
): ValidationResult {
  const path = options.path ?? "money";
  const issues: ValidationIssue[] = [];
  if (money == null) {
    if (options.required) issues.push({ code: "money.required", path, message: "Money is required." });
    return { valid: issues.length === 0, issues };
  }
  if (!isValidDecimalString(money.amount)) {
    issues.push({ code: "money.amount.invalid", path: `${path}.amount`, message: "Amount must be a plain decimal string." });
  } else if (!options.allowNegative && money.amount.startsWith("-")) {
    issues.push({ code: "money.amount.negative", path: `${path}.amount`, message: "Negative money is not permitted in this context." });
  }
  if (!isValidCurrencyCode(money.currency)) {
    issues.push({ code: "money.currency.invalid", path: `${path}.currency`, message: "Currency must be a normalized three-letter uppercase code." });
  }
  return { valid: issues.length === 0, issues };
}

export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((result) => result.issues);
  return { valid: issues.length === 0, issues };
}
