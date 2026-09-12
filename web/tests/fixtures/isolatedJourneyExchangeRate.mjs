import {isolatedJourneyMode} from './isolatedJourneyGuard.mjs';
isolatedJourneyMode();
globalThis.__quoteSyncExchangeRateTestProvider=async currency=>({rawRate:String(currency).toUpperCase()==='GBP'?'1':'0.84',provider:'disposable-browser-fixture',quotedAt:'2026-09-12T09:00:00.000Z'});
