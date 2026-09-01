import { decimalAdd, decimalCompare, decimalDivide, decimalMultiply, decimalSubtract } from './supplierCommercialPricing.js';

export const QUOTATION_PRODUCT_COMMERCIAL_EVIDENCE_VERSION = 'quotation-product-commercial-evidence-v1';
export const PRODUCT_SUPPLY_RECONCILIATION_VERSION = 'product-supply-reconciliation-v1';

const money = (value) => value == null || value === '' ? null : String(value);
const minorDifferenceAccepted = (left, right) => {
  if (left == null || right == null) return false;
  const difference = decimalSubtract(left, right).replace('-', '');
  return decimalCompare(difference, '0.01') <= 0;
};

const absoluteDifference = (left, right) => decimalSubtract(left, right).replace('-', '');
const productSupplyItem = (item) => item?.commercialClassification?.canonicalCategory === 'products_supply' || item?.commercialRole === 'coupling_profile';
const includedPosition = (row) => row?.classification !== 'alternative' && row?.classification !== 'excluded' && row?.includedInSupplierTotal !== false;
const contribution = (item, kind, index) => {
  const quantity = Number(item?.quantity);
  const unitPrice = money(item?.unitPrice);
  const sourceLineTotal = money(item?.totalPrice);
  const hasUnitCalculation = Number.isFinite(quantity) && quantity > 0 && unitPrice != null;
  const calculatedAmount = hasUnitCalculation ? decimalMultiply(unitPrice, String(quantity), 2) : sourceLineTotal;
  const lineVariance = calculatedAmount != null && sourceLineTotal != null ? decimalSubtract(calculatedAmount, sourceLineTotal) : null;
  return {
    kind,
    reference: money(item?.displayReference) ?? money(item?.normalizedLabel) ?? money(item?.manufacturerItemNumber) ?? `${kind}-${index + 1}`,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    unitPrice,
    sourceLineTotal,
    calculatedAmount,
    calculation: hasUnitCalculation ? 'source_unit_price_x_source_quantity' : sourceLineTotal != null ? 'source_line_total' : 'unpriced',
    lineVariance,
    sourcePages: item?.sourcePages ?? null,
    sourceTrace: item?.sourceTrace ?? null,
  };
};

export function buildProductSupplyReconciliation({ positionRows = [], additionalItems = [], summary = null } = {}) {
  const comparisons = Array.isArray(summary?.comparisonTotals) ? summary.comparisonTotals : [];
  const listPrice = comparisons.find((item) => item?.classification === 'supplier_list_price');
  const expectedSubtotal = money(listPrice?.amount);
  const positionContributors = positionRows.filter(includedPosition).map((row, index) => contribution(row, 'position', index));
  const itemContributors = additionalItems.filter(productSupplyItem).map((item, index) => contribution(item, 'product_supply_item', index));
  const contributors = [...positionContributors, ...itemContributors];
  const extractedSubtotal = decimalAdd(contributors.map((item) => item.calculatedAmount)) ?? '0.00';
  const incomplete = contributors.filter((item) => item.calculatedAmount == null);
  const lineMismatches = contributors.filter((item) => item.lineVariance != null && !minorDifferenceAccepted(item.calculatedAmount, item.sourceLineTotal));
  const variance = expectedSubtotal == null ? null : decimalSubtract(extractedSubtotal, expectedSubtotal);
  const absoluteVariance = expectedSubtotal == null ? null : absoluteDifference(extractedSubtotal, expectedSubtotal);
  const subtotalWithinTolerance = expectedSubtotal != null && minorDifferenceAccepted(extractedSubtotal, expectedSubtotal);
  const exact = expectedSubtotal != null && decimalCompare(extractedSubtotal, expectedSubtotal) === 0;
  const reviewReasons = [
    ...(incomplete.length ? [`${incomplete.length} Products / Supply contributor${incomplete.length === 1 ? '' : 's'} could not be priced from source evidence.`] : []),
    ...(lineMismatches.length ? [`${lineMismatches.length} source unit-price × quantity calculation${lineMismatches.length === 1 ? '' : 's'} do not reconcile with their source line totals.`] : []),
    ...(expectedSubtotal != null && !subtotalWithinTolerance ? [`Expected Products / Supply subtotal ${expectedSubtotal}; extracted ${extractedSubtotal}; variance ${variance}. Check missing, duplicate, misclassified or incorrectly parsed source items.`] : []),
  ];
  const status = expectedSubtotal == null
    ? 'not_available'
    : reviewReasons.length ? 'review_required'
      : exact ? 'reconciled_exact'
        : 'reconciled_rounding_variance';
  const excludedPositions = positionRows.filter((row) => !includedPosition(row)).map((row, index) => ({
    kind: 'position',
    reference: money(row?.displayReference) ?? `position-${index + 1}`,
    amount: money(row?.totalPrice),
    classification: row?.classification ?? (row?.includedInSupplierTotal === false ? 'not_in_supplier_product_subtotal' : 'excluded'),
    reason: row?.includedInSupplierTotal === false ? 'source_not_in_product_subtotal' : 'canonical_position_classification',
  }));
  const excludedItems = additionalItems.filter((item) => !productSupplyItem(item)).map((item, index) => ({
    kind: 'additional_item',
    reference: money(item?.normalizedLabel) ?? money(item?.originalDescription)?.split('\n')[0] ?? `item-${index + 1}`,
    amount: money(item?.totalPrice),
    classification: item?.commercialClassification?.canonicalCategory ?? item?.category ?? 'unclassified',
    reason: 'not_products_supply',
  }));
  return {
    version: PRODUCT_SUPPLY_RECONCILIATION_VERSION,
    status,
    blocking: status === 'review_required',
    currency: String(summary?.currency || listPrice?.currency || '').toUpperCase() || null,
    expectedSubtotal,
    extractedSubtotal,
    variance,
    absoluteVariance,
    tolerance: '0.01',
    toleranceRule: 'bounded_supplier_rounding_minor_unit',
    contributors,
    excludedItems: [...excludedPositions, ...excludedItems],
    reviewReasons,
    provenance: { supplierListSubtotal: listPrice?.sourceTrace ?? null },
  };
}

export function buildQuotationProductCommercialEvidence({ positionRows = [], additionalItems = [], summary = null } = {}) {
  if (!summary) return null;
  const comparisons = Array.isArray(summary.comparisonTotals) ? summary.comparisonTotals : [];
  const listPrice = comparisons.find((item) => item?.classification === 'supplier_list_price');
  const discount = comparisons.find((item) => item?.classification === 'supplier_discount');
  const grossListAmount = money(listPrice?.amount);
  const netProductSubtotal = money(summary.productSubtotal);
  const discountPercentage = money(discount?.percentage);
  if (grossListAmount == null || netProductSubtotal == null || discountPercentage == null) return null;

  const productSupplyReconciliation = buildProductSupplyReconciliation({ positionRows, additionalItems, summary });

  const grossPositionAmount = decimalAdd(positionRows
    .filter((row) => row?.classification !== 'alternative' && row?.classification !== 'excluded' && row?.includedInSupplierTotal !== false)
    .map((row) => money(row.totalPrice))) ?? '0.00';
  const embeddedAccessoryRows = additionalItems.filter((item) => item?.includedInSupplierTotal === false && item?.commercialRole === 'coupling_profile');
  const embeddedAccessoryGrossAmount = decimalAdd(embeddedAccessoryRows.map((item) => money(item.totalPrice))) ?? '0.00';
  const discountAmount = decimalSubtract(grossListAmount, netProductSubtotal);
  const percentageDiscountAmount = decimalMultiply(grossListAmount, decimalDivide(discountPercentage, '100', 12), 2);
  const positionToNetAdjustmentAmount = decimalSubtract(netProductSubtotal, grossPositionAmount);
  const grossReconciled = !productSupplyReconciliation.blocking && ['reconciled_exact', 'reconciled_rounding_variance'].includes(productSupplyReconciliation.status);
  const discountReconciled = minorDifferenceAccepted(percentageDiscountAmount, discountAmount);
  const sourceReconciled = summary.reconciliation?.reconciled !== false;
  const status = grossReconciled && discountReconciled && sourceReconciled ? 'applicable' : 'review_required';
  const reviewReasons = [
    ...(grossReconciled ? [] : productSupplyReconciliation.reviewReasons.length ? productSupplyReconciliation.reviewReasons : ['Gross position and embedded accessory evidence does not reconcile with the supplier list total.']),
    ...(discountReconciled ? [] : ['The supplier discount percentage does not reconcile with the stated net product subtotal.']),
    ...(sourceReconciled ? [] : ['The source commercial summary has an unresolved material reconciliation warning.']),
  ];

  return {
    version: QUOTATION_PRODUCT_COMMERCIAL_EVIDENCE_VERSION,
    status,
    currency: String(summary.currency || listPrice?.currency || discount?.currency || '').toUpperCase() || null,
    positionPriceBasis: 'gross_list',
    adjustmentScope: 'quotation_product_category',
    grossPositionAmount,
    embeddedAccessoryGrossAmount,
    grossListAmount,
    discountPercentage,
    discountAmount,
    netProductSubtotal,
    positionToNetAdjustmentAmount,
    embeddedAccessoryTreatment: 'included_once_in_supplier_list_and_net_product_subtotal_not_added_as_cost_row',
    sourceAmountsRewritten: false,
    allocationToPositions: 'none',
    reviewReasons,
    productSupplyReconciliation,
    provenance: {
      listPrice: listPrice?.sourceTrace ?? null,
      discount: discount?.sourceTrace ?? null,
      embeddedAccessories: embeddedAccessoryRows.map((item) => item.sourceTrace ?? null),
    },
  };
}

export function resolveQuotationProductCommercialBasis({ evidence, policy = null } = {}) {
  if (!evidence) return { status: 'not_applicable', apply: false, reasons: [] };
  if (evidence.version !== QUOTATION_PRODUCT_COMMERCIAL_EVIDENCE_VERSION || evidence.status !== 'applicable') {
    return { status: 'review_required', apply: false, reasons: evidence.reviewReasons?.length ? evidence.reviewReasons : ['Quotation-level product commercial evidence is not reconciled.'] };
  }
  if (evidence.positionPriceBasis !== 'gross_list') {
    return { status: 'review_required', apply: false, reasons: ['A quotation-level discount cannot be applied to position prices that are already classified as net.'] };
  }
  if (policy?.sourceQuotedPriceBasis === 'net_already_final') {
    return { status: 'review_required', apply: false, reasons: ['The configured policy says source prices are already net, but the document explicitly classifies them as gross/list with a later discount.'] };
  }
  const decision = policy?.sourceDiscountDecision;
  if (decision?.status !== 'applied') {
    return {
      status: 'available_not_applied',
      apply: false,
      reasons: [],
      grossPositionAmount: evidence.grossPositionAmount,
      grossListAmount: evidence.grossListAmount,
      embeddedAccessoryGrossAmount: evidence.embeddedAccessoryGrossAmount,
      discountPercentage: evidence.discountPercentage,
      discountAmount: evidence.discountAmount,
      netProductSubtotal: evidence.netProductSubtotal,
      positionToNetAdjustmentAmount: evidence.positionToNetAdjustmentAmount,
    };
  }
  const projectDiscount = policy?.projectDiscount ?? {};
  const configuredStages = policy?.discountPolicy?.type === 'single'
    ? [{ percentage: policy.discountPolicy.percentage }]
    : Array.isArray(policy?.discountPolicy?.stages) ? policy.discountPolicy.stages : [];
  if (!['factory_price', 'legacy_net_buying_price'].includes(policy?.pricingMethod ?? policy?.pricingBasis) && configuredStages.some((stage) => stage?.enabled !== false && Number(stage?.percentage ?? 0) !== 0)) {
    return { status: 'review_required', apply: false, reasons: ['The configured supplier pricing policy would apply another discount before the selected source quotation discount.'] };
  }
  const exactSourceAction = projectDiscount.source === 'supplier_quotation'
    && projectDiscount.scope === 'products_supply'
    && projectDiscount.evidenceVersion === evidence.version
    && String(projectDiscount.amount ?? '') === String(evidence.discountAmount)
    && String(projectDiscount.percentage ?? '') === String(evidence.discountPercentage);
  if (!exactSourceAction) return { status: 'review_required', apply: false, reasons: ['The applied supplier discount no longer matches the retained source quotation evidence.'] };
  return {
    status: 'applied',
    apply: true,
    reasons: [],
    grossPositionAmount: evidence.grossPositionAmount,
    grossListAmount: evidence.grossListAmount,
    embeddedAccessoryGrossAmount: evidence.embeddedAccessoryGrossAmount,
    discountPercentage: evidence.discountPercentage,
    discountAmount: evidence.discountAmount,
    netProductSubtotal: evidence.netProductSubtotal,
    positionToNetAdjustmentAmount: evidence.positionToNetAdjustmentAmount,
  };
}
