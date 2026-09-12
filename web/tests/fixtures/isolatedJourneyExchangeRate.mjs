import path from 'node:path';
const database=path.resolve(process.env.QUOTESUITE_DB_PATH||'');
if(process.env.NODE_ENV!=='development'||process.env.QUOTESUITE_TEST_JOURNEY!=='1'||process.env.QUOTESUITE_TEST_DELIVERY_ENABLED!=='0'||!path.basename(path.dirname(database)).startsWith('quotesuite-complete-journey-'))throw new Error('The deterministic journey exchange rate is restricted to the owned disposable journey workspace.');
globalThis.__quoteSyncExchangeRateTestProvider=async currency=>({rawRate:String(currency).toUpperCase()==='GBP'?'1':'0.84',provider:'disposable-browser-fixture',quotedAt:'2026-09-12T09:00:00.000Z'});
