const corporateSuffixes = new Set(['LIMITED', 'LTD', 'PLC', 'INC', 'LLC', 'SA']);
const controlledDealerAliases = new Map([
  ['EKO', new Set(['EKO', 'EKOOKNA'])],
]);
const automaticPendingName = normalizeSupplierIdentity('Automatic identification pending');

export function normalizeSupplierIdentity(value) {
  const tokens = String(value || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  while (tokens.length > 1 && corporateSuffixes.has(tokens.at(-1))) tokens.pop();
  return tokens.join('');
}

export function resolveCanonicalSupplier({ recognizedSupplierName, storedSupplierCode, storedSupplierName, configuredSuppliers }) {
  const suppliers = (configuredSuppliers || []).filter((item) => item && item.supplierCode && item.supplierName);
  const storedCode = String(storedSupplierCode || '').trim().toUpperCase();
  const exactCode = storedCode ? suppliers.filter((item) => String(item.supplierCode).trim().toUpperCase() === storedCode) : [];
  if (exactCode.length === 1) return { status: 'resolved', supplier: exactCode[0], method: 'configured_supplier_code', candidates: exactCode };

  const sourceIdentities = [...new Set([recognizedSupplierName, storedSupplierName].map(normalizeSupplierIdentity).filter(Boolean))];
  const exactName = suppliers.filter((item) => sourceIdentities.includes(normalizeSupplierIdentity(item.supplierName)));
  if (exactName.length === 1) return { status: 'resolved', supplier: exactName[0], method: 'normalized_supplier_name', candidates: exactName };
  if (exactName.length > 1 || exactCode.length > 1) return { status: 'ambiguous', supplier: null, method: null, candidates: [...new Map([...exactCode, ...exactName].map((item) => [item.supplierCode, item])).values()] };
  return { status: 'not_configured', supplier: null, method: null, candidates: [] };
}

export function assertCommercialDealerIdentity({ sourceDealerName, sourceAuthority, configuredDealer, quotationDealerName, quotationDealerCode }) {
  const sourceIdentity = normalizeSupplierIdentity(sourceDealerName);
  if (!sourceIdentity) return;
  const configuredIdentity = normalizeSupplierIdentity(configuredDealer?.supplierName);
  const configuredCode = String(configuredDealer?.supplierCode || '').trim().toUpperCase();
  const aliases = controlledDealerAliases.get(configuredCode);
  const configuredMatches = configuredIdentity === sourceIdentity || Boolean(aliases?.has(configuredIdentity) && aliases.has(sourceIdentity));
  if (!configuredDealer || !configuredMatches) {
    throw Object.assign(new Error(`The quotation issuer ${sourceDealerName} cannot be confirmed against ${configuredDealer?.supplierName || 'an unconfigured supplier / dealer'}.`), {
      code: 'dealer_identity_mismatch', sourceDealerName, sourceAuthority: sourceAuthority ?? null, configuredDealerCode: configuredDealer?.supplierCode ?? null, configuredDealerName: configuredDealer?.supplierName ?? null,
    });
  }
  const aggregateName = normalizeSupplierIdentity(quotationDealerName);
  const aggregateCode = String(quotationDealerCode || '').trim().toUpperCase();
  const pendingAutomaticAggregate = aggregateCode.startsWith('AUTO-') && aggregateName === automaticPendingName;
  const aggregateAliases = controlledDealerAliases.get(aggregateCode);
  const aggregateMatches = aggregateCode === configuredCode || aggregateName === sourceIdentity || Boolean(aggregateAliases?.has(aggregateName) && aggregateAliases.has(sourceIdentity));
  if (aggregateName && !aggregateMatches && !pendingAutomaticAggregate) {
    throw Object.assign(new Error(`This quotation aggregate belongs to ${quotationDealerName}, not the explicit source dealer ${sourceDealerName}. Create or select the dealer-owned quotation aggregate before confirmation.`), {
      code: 'quotation_aggregate_dealer_mismatch', sourceDealerName, quotationDealerCode: quotationDealerCode ?? null, quotationDealerName,
    });
  }
}
