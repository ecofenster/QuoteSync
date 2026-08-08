export async function fetchCentralExchangeRate(fromCurrency) {
  if (typeof globalThis.__quoteSyncExchangeRateTestProvider === 'function') return globalThis.__quoteSyncExchangeRateTestProvider(fromCurrency);
  const currency = String(fromCurrency).toUpperCase();
  if (currency === 'GBP') return { rawRate: '1', provider: 'identity', quotedAt: new Date().toISOString() };
  const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(currency)}&to=GBP`);
  if (!response.ok) throw Object.assign(new Error('Live exchange rate is unavailable.'), { code: 'exchange_rate_unavailable' });
  const data = await response.json();
  if (data?.rates?.GBP == null) throw Object.assign(new Error('Live exchange rate is unavailable.'), { code: 'exchange_rate_unavailable' });
  return { rawRate: String(data.rates.GBP), provider: 'frankfurter', quotedAt: data.date ? `${data.date}T00:00:00.000Z` : new Date().toISOString() };
}
