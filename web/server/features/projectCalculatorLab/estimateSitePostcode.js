const UK_POSTCODE = /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

const text = value => String(value ?? '').trim();
const normalize = value => text(value).toUpperCase().replace(/\s+/g, '');
const parseAddress = value => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}'); } catch { return {}; }
};
const postcodeFrom = (structured, plain = '') => {
  const address = parseAddress(structured);
  const explicit = text(address.postcode ?? address.postalCode);
  if (explicit) return explicit.toUpperCase();
  return text(plain).match(UK_POSTCODE)?.[0]?.toUpperCase() ?? '';
};

/** Resolve a Site Visit postcode without mutating the Estimate-owned address. */
export function resolveEstimateSitePostcode({ estimate = null, client = null, savedPostcode = '', savedSource = '' } = {}) {
  const candidates = [
    { postcode: postcodeFrom(estimate?.project_address_json, estimate?.project_address), source: 'estimate_project_address' },
    { postcode: text(estimate?.postcode).toUpperCase(), source: 'estimate_project_postcode' },
    { postcode: postcodeFrom(client?.project_address_json, client?.project_address), source: 'client_project_address' },
    { postcode: postcodeFrom(client?.customer_address_json, client?.customer_address), source: 'client_customer_address' },
  ].filter(candidate => candidate.postcode);
  const stored = text(savedPostcode).toUpperCase();
  const source = text(savedSource);
  if (stored && ['project_override', 'manually_corrected'].includes(source)) return { postcode: stored, source };
  if (stored) {
    const inherited = candidates.find(candidate => normalize(candidate.postcode) === normalize(stored));
    if (inherited) return inherited;
    return { postcode: stored, source: source || 'project_override' };
  }
  return candidates[0] ?? { postcode: '', source: 'missing' };
}
