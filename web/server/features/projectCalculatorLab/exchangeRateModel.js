const DECIMAL = /^\d+(?:\.\d+)?$/;
const digits = (value) => String(value).split('.')[1]?.length || 0;
const integer = (value, scale) => { const [whole, fraction = ''] = String(value).split('.'); return BigInt(whole + fraction.padEnd(scale, '0')); };

export function calculateAdjustedRate(rawRate) {
  if (!DECIMAL.test(String(rawRate)) || integer(rawRate, digits(rawRate)) <= 0n) throw Object.assign(new Error('Exchange rate must be a positive decimal string.'), { code: 'invalid_exchange_rate' });
  const scale = digits(rawRate), denominator = 10n ** BigInt(scale), numerator = integer(rawRate, scale);
  const hundredths = (numerator * 100n + denominator - 1n) / denominator;
  const roundedUpRate = `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}`;
  const adjusted = hundredths + 1n;
  return { rawRate: String(rawRate), roundedUpRate, upliftAmount: '0.01', adjustedRate: `${adjusted / 100n}.${String(adjusted % 100n).padStart(2, '0')}` };
}

export function multiplyDecimal(amount, rate, outputScale = 2) {
  if (!DECIMAL.test(String(amount)) || !DECIMAL.test(String(rate))) return null;
  const sourceScale = digits(amount) + digits(rate), product = integer(amount, digits(amount)) * integer(rate, digits(rate));
  const divisor = 10n ** BigInt(Math.max(0, sourceScale - outputScale));
  const rounded = sourceScale > outputScale ? (product + divisor / 2n) / divisor : product * 10n ** BigInt(outputScale - sourceScale);
  return `${rounded / 100n}.${String(rounded % 100n).padStart(2, '0')}`;
}

export function createProjectCostingFx({ supplierToGbpLiveRate, supplierToGbpSellingRate, adjustmentEnabled = true }) {
  const liveRate = String(supplierToGbpLiveRate);
  const calculated = calculateAdjustedRate(liveRate);
  const sellingRate = adjustmentEnabled ? String(supplierToGbpSellingRate ?? calculated.adjustedRate) : liveRate;
  calculateAdjustedRate(sellingRate);
  return {
    supplierToGbpLiveRate: liveRate,
    supplierToGbpSellingRate: sellingRate,
    roundedUpRate: calculated.roundedUpRate,
    upliftAmount: calculated.upliftAmount,
    calculatedSellingRate: calculated.adjustedRate,
    adjustmentEnabled: Boolean(adjustmentEnabled),
  };
}

export function convertSupplierAmountToGbp(amount, fx) {
  return {
    purchaseGbpAmount: multiplyDecimal(amount, fx.supplierToGbpLiveRate),
    sellingGbpAmount: multiplyDecimal(amount, fx.supplierToGbpSellingRate),
  };
}

export function applyMarkup(gbpAmount, markupPercent) {
  if (gbpAmount == null || !DECIMAL.test(String(markupPercent))) return { markupValue: null, markedUpAmount: null };
  const percentScale = digits(markupPercent), percent = integer(markupPercent, percentScale);
  const amountPence = integer(gbpAmount, 2);
  const divisor = 100n * 10n ** BigInt(percentScale);
  const markupPence = (amountPence * percent + divisor / 2n) / divisor;
  const format = (pence) => `${pence / 100n}.${String(pence % 100n).padStart(2, '0')}`;
  return { markupValue: format(markupPence), markedUpAmount: format(amountPence + markupPence) };
}
