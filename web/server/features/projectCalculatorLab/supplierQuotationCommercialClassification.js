import { decimalAdd } from './supplierCommercialPricing.js';
import { buildProductSupplyReconciliation, buildQuotationProductCommercialEvidence } from './quotationProductCommercialEvidence.js';

export const SUPPLIER_QUOTATION_COMMERCIAL_CLASSIFICATION_VERSION = 'supplier-quotation-commercial-classification-v1';

const automaticExtraCategories = new Set(['sill', 'flashing', 'trim', 'accessory', 'packaging', 'surcharge']);
const amount = (value) => value == null || value === '' ? null : String(value);

export function classifySupplierCommercialItem(item = {}) {
  const role = String(item.commercialRole || '').trim().toLowerCase();
  const sourceCategory = String(item.category || 'other').trim().toLowerCase();
  if (role === 'coupling_profile') return { canonicalCategory: 'products_supply', projectCostingCategory: 'product_supply', automaticImport: true, sourceMembership: 'embedded_in_product_list', decision: 'include_once' };
  if (role === 'delivery' || sourceCategory === 'delivery') return { canonicalCategory: 'transport', projectCostingCategory: 'delivery', automaticImport: true, sourceMembership: 'package_additive', decision: 'include_once' };
  if (role === 'external_cills') return { canonicalCategory: 'extras', projectCostingCategory: 'extras', automaticImport: true, sourceMembership: 'package_additive', decision: 'include_once' };
  if (role === 'installation') return { canonicalCategory: 'installation', projectCostingCategory: 'supplier_installation', automaticImport: false, sourceMembership: 'supplier_package', decision: 'evidence_only' };
  if (role === 'survey') return { canonicalCategory: 'survey', projectCostingCategory: 'supplier_survey', automaticImport: false, sourceMembership: 'supplier_package', decision: 'review_required' };
  if (role === 'discount' || sourceCategory === 'discount') return { canonicalCategory: 'discount', projectCostingCategory: 'supplier_discount', automaticImport: false, sourceMembership: 'commercial_adjustment', decision: 'available_not_applied' };
  if (automaticExtraCategories.has(sourceCategory) && item.includedInSupplierTotal !== false) return { canonicalCategory: 'extras', projectCostingCategory: 'extras', automaticImport: true, sourceMembership: 'package_additive', decision: 'include_once' };
  return { canonicalCategory: 'informational', projectCostingCategory: 'supplier_information', automaticImport: false, sourceMembership: item.includedInSupplierTotal === false ? 'embedded_or_comparison' : 'unclassified_package_evidence', decision: 'review_required' };
}

const totalFor = (items, category) => decimalAdd(items.filter((item) => item.classification.canonicalCategory === category).map((item) => amount(item.totalPrice))) ?? '0.00';

export function buildSupplierQuotationCommercialClassification({ positionRows = [], additionalItems = [], summary = null } = {}) {
  const items = additionalItems.map((item) => ({ ...item, classification: classifySupplierCommercialItem(item) }));
  const classifiedItems = items.map((item) => ({ ...item, commercialClassification: item.classification }));
  const productSupplyReconciliation = buildProductSupplyReconciliation({ positionRows, additionalItems: classifiedItems, summary });
  const productEvidence = buildQuotationProductCommercialEvidence({ positionRows, additionalItems: classifiedItems, summary });
  const grossPositions = decimalAdd(positionRows.filter((row) => row.classification !== 'alternative' && row.classification !== 'excluded' && row.includedInSupplierTotal !== false).map((row) => amount(row.totalPrice))) ?? '0.00';
  const productSupplySupplement = totalFor(items, 'products_supply');
  const productsSupply = productEvidence?.grossListAmount ?? decimalAdd([grossPositions, productSupplySupplement]) ?? '0.00';
  const extras = totalFor(items, 'extras');
  const transport = totalFor(items, 'transport');
  const installation = totalFor(items, 'installation');
  const survey = totalFor(items, 'survey');
  const defaultImportedCost = decimalAdd([productsSupply, extras, transport]) ?? '0.00';
  return {
    version: SUPPLIER_QUOTATION_COMMERCIAL_CLASSIFICATION_VERSION,
    currency: String(summary?.currency || productEvidence?.currency || '').toUpperCase() || null,
    categories: {
      productsSupply: { amount: productsSupply, grossPositionAmount: grossPositions, supplementalAmount: productSupplySupplement, automaticImport: true },
      extras: { amount: extras, automaticImport: true },
      transport: { amount: transport, automaticImport: true },
      installation: { amount: installation, automaticImport: false, decision: 'evidence_only' },
      survey: { amount: survey, automaticImport: false, decision: 'review_required' },
      discount: productEvidence ? { percentage: productEvidence.discountPercentage, amount: productEvidence.discountAmount, quotedNetProductAmount: productEvidence.netProductSubtotal, automaticImport: false, decision: 'available_not_applied' } : null,
    },
    defaultImportedCost,
    supplierQuotedTotal: amount(summary?.finalSupplierTotal),
    sourceReconciliation: summary?.reconciliation ?? null,
    productSupplyReconciliation,
    productEvidence,
    items: items.map((item) => ({
      originalDescription: item.originalDescription,
      normalizedLabel: item.normalizedLabel,
      sourceCategory: item.category,
      commercialRole: item.commercialRole ?? null,
      totalPrice: amount(item.totalPrice),
      currency: item.currency ?? null,
      includedInSupplierTotal: item.includedInSupplierTotal !== false,
      ...item.classification,
      sourceTrace: item.sourceTrace ?? null,
    })),
  };
}

export function assertSupplierProductSupplyReconciliation(classification) {
  const reconciliation = classification?.productSupplyReconciliation;
  if (!reconciliation?.blocking) return reconciliation ?? null;
  throw Object.assign(new Error(`Products / Supply reconciliation failed. Expected ${reconciliation.expectedSubtotal}; extracted ${reconciliation.extractedSubtotal}; variance ${reconciliation.variance}. Commercial confirmation is blocked.`), {
    code: 'supplier_product_reconciliation_failed',
    productSupplyReconciliation: reconciliation,
  });
}
