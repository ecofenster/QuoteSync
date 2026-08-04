import { normalizeCurrencyCode } from "../../commercial/domain/commercial.validation";
import type { CurrencyCode } from "../../commercial/domain/commercial.types";

export function normalizeSupplierCurrency(value: string): CurrencyCode {
  return normalizeCurrencyCode(value);
}

export function normalizeSha256(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeSupplierReferenceTokens(tokens: readonly string[]): string[] {
  return tokens.map((token) => token.trim()).filter(Boolean);
}
