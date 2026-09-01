const twoDecimalMoney = /^-?\d+\.\d{2}$/;

function minorUnits(value) {
  const text = String(value ?? '').trim();
  if (!twoDecimalMoney.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, fraction] = text.replace(/^-/, '').split('.');
  const amount = (BigInt(whole) * 100n) + BigInt(fraction);
  return negative ? -amount : amount;
}

export function assessSupplierRoundingVariance({ currency, calculatedTotal, supplierStatedTotal }) {
  const normalizedCurrency = String(currency ?? '').trim().toUpperCase();
  const calculatedMinorUnits = minorUnits(calculatedTotal);
  const supplierMinorUnits = minorUnits(supplierStatedTotal);
  if (!/^[A-Z]{3}$/.test(normalizedCurrency) || calculatedMinorUnits == null || supplierMinorUnits == null) {
    return {
      status: 'not_assessed',
      accepted: false,
      currency: normalizedCurrency || null,
      differenceMinorUnits: null,
      difference: null,
      rule: 'exactly_one_minor_currency_unit',
    };
  }

  const signedDifference = supplierMinorUnits - calculatedMinorUnits;
  const absoluteDifference = signedDifference < 0n ? -signedDifference : signedDifference;
  return {
    status: absoluteDifference === 0n ? 'exact' : absoluteDifference === 1n ? 'accepted_supplier_rounding_variance' : 'material_variance',
    accepted: absoluteDifference <= 1n,
    currency: normalizedCurrency,
    differenceMinorUnits: Number(signedDifference),
    difference: `${signedDifference < 0n ? '-' : ''}${absoluteDifference / 100n}.${String(absoluteDifference % 100n).padStart(2, '0')}`,
    rule: 'exactly_one_minor_currency_unit',
    calculatedTotal: String(calculatedTotal),
    supplierStatedTotal: String(supplierStatedTotal),
    sourceValuesPreserved: true,
  };
}
