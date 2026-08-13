export const MARKUP_CATEGORIES = ["product", "extras", "transport", "siteVisit", "equipment", "installation", "materials", "duties"] as const;
export type MarkupCategory = (typeof MARKUP_CATEGORIES)[number];
export type ProjectCostingMarkups = Record<MarkupCategory, string>;

const decimalPattern = /^\d+(?:\.\d+)?$/;

function parts(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function scaled(value: string, scale: number) {
  const parsed = parts(value);
  return parsed.integer * 10n ** BigInt(scale - parsed.scale);
}

function formatMinorUnits(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

export function validateMarkupPercentage(value: string) {
  if (!decimalPattern.test(value)) return "Enter a percentage from 0 to 999.99 without exponent notation.";
  const parsed = parts(value);
  const hundredths = scaled(value, Math.max(2, parsed.scale));
  const maximum = 99999n * 10n ** BigInt(Math.max(0, parsed.scale - 2));
  return hundredths > maximum ? "Markup cannot exceed 999.99%." : null;
}

export function addDecimalAmounts(values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => typeof value === "string" && decimalPattern.test(value));
  if (!valid.length) return "0.00";
  const scale = Math.max(2, ...valid.map((value) => parts(value).scale));
  const total = valid.reduce((sum, value) => sum + scaled(value, scale), 0n);
  const divisor = 10n ** BigInt(scale - 2);
  return formatMinorUnits((total + divisor / 2n) / divisor);
}

export function applyMarkupPercentage(amount: string, percentage: string) {
  if (!decimalPattern.test(amount) || validateMarkupPercentage(percentage)) return null;
  const amountPence = scaled(amount, 2);
  const percent = parts(percentage);
  const divisor = 100n * 10n ** BigInt(percent.scale);
  const markupPence = (amountPence * percent.integer + divisor / 2n) / divisor;
  return { markupValue: formatMinorUnits(markupPence), sellingPrice: formatMinorUnits(amountPence + markupPence) };
}

export function divideDecimalAmount(amount: string, quantity: number) {
  if (!decimalPattern.test(amount) || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
  const amountPence = scaled(amount, 2);
  return formatMinorUnits((amountPence + BigInt(quantity) / 2n) / BigInt(quantity));
}

export function calculateProductSelling(gbpTotalCost: string, quantity: number, categoryMarkup: string, overrideMarkup: string | null) {
  const effectiveMarkup = overrideMarkup ?? categoryMarkup;
  const total = applyMarkupPercentage(gbpTotalCost, effectiveMarkup);
  if (!total) return null;
  return {
    effectiveMarkup,
    inherited: overrideMarkup == null,
    gbpUnitCost: divideDecimalAmount(gbpTotalCost, quantity),
    unitSellingPrice: divideDecimalAmount(total.sellingPrice, quantity),
    totalSellingPrice: total.sellingPrice,
    grossProfit: total.markupValue,
    grossMargin: percentageRatio(total.markupValue, total.sellingPrice),
  };
}

export function subtractDecimalAmounts(left: string, right: string) {
  const scale = Math.max(2, parts(left).scale, parts(right).scale);
  const difference = scaled(left, scale) - scaled(right, scale);
  const divisor = 10n ** BigInt(scale - 2);
  const rounded = difference >= 0n ? (difference + divisor / 2n) / divisor : (difference - divisor / 2n) / divisor;
  const sign = rounded < 0n ? "-" : "";
  return `${sign}${formatMinorUnits(rounded < 0n ? -rounded : rounded)}`;
}

export function percentageRatio(part: string, whole: string) {
  const denominator = scaled(whole, 2);
  if (denominator === 0n) return "0.0";
  const numerator = scaled(part, 2) * 1000n;
  const tenths = (numerator + denominator / 2n) / denominator;
  return `${tenths / 10n}.${tenths % 10n}`;
}
