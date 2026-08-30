const corporateSuffixes = new Set(['LIMITED', 'LTD', 'PLC', 'INC', 'LLC', 'SA']);

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
