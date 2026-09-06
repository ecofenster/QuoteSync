const corporateSuffixes = new Set(['LIMITED', 'LTD', 'PLC', 'INC', 'LLC', 'SA']);

export function normalizeManufacturerIdentity(value) {
  const tokens = String(value || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  while (tokens.length > 1 && corporateSuffixes.has(tokens.at(-1))) tokens.pop();
  return tokens.join('');
}

export function resolveCanonicalManufacturer({ recognizedManufacturerName, configuredManufacturers }) {
  const identity = normalizeManufacturerIdentity(recognizedManufacturerName);
  const manufacturers = (configuredManufacturers || []).filter((item) => item?.manufacturerId && item?.manufacturerName);
  if (!identity) return { status: 'not_recognized', manufacturer: null, method: null, candidates: [] };
  const matches = manufacturers.filter((item) => (
    normalizeManufacturerIdentity(item.manufacturerName) === identity
    || normalizeManufacturerIdentity(item.manufacturerCode) === identity
  ));
  if (matches.length === 1) return { status: 'resolved', manufacturer: matches[0], method: 'controlled_manufacturer_identity', candidates: matches };
  if (matches.length > 1) return { status: 'ambiguous', manufacturer: null, method: null, candidates: matches };
  return { status: 'not_configured', manufacturer: null, method: null, candidates: [] };
}

export function canonicalManufacturerSystemIdentity(manufacturer, systemCode) {
  const manufacturerId = String(manufacturer?.manufacturerId || '').trim();
  const normalizedSystem = String(systemCode || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!manufacturerId || !normalizedSystem) return null;
  return {
    manufacturerId,
    manufacturerCode: manufacturer.manufacturerCode ?? null,
    manufacturerName: manufacturer.manufacturerName,
    systemCode: normalizedSystem,
    identity: `${manufacturerId}:${normalizedSystem}`,
  };
}

export function createSupplierManufacturerRelationship({ manufacturer, supplier, sourceSupplierName = null, sourceLegalName = null }) {
  if (!manufacturer || !supplier) return null;
  const direct = normalizeManufacturerIdentity(manufacturer.manufacturerName) === normalizeManufacturerIdentity(supplier.supplierName);
  return {
    relationship: direct ? 'direct_manufacturer_supplier' : 'dealer_supplies_manufacturer_products',
    manufacturerId: manufacturer.manufacturerId,
    manufacturerName: manufacturer.manufacturerName,
    supplierCode: supplier.supplierCode,
    supplierName: supplier.supplierName,
    commercialSupplierCode: supplier.supplierCode,
    commercialSupplierName: supplier.supplierName,
    documentIssuerName: sourceSupplierName,
    documentIssuerLegalName: sourceLegalName,
    supplierSourceName: sourceSupplierName ?? supplier.supplierName,
    supplierSourceLegalName: sourceLegalName ?? sourceSupplierName ?? supplier.supplierName,
    pricingScope: 'commercial_supplier_quotation',
  };
}
