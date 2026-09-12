import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

test('journey rate fixture refuses production, enabled delivery and non-journey databases',()=>{
  const env={...process.env,NODE_ENV:'development',QUOTESUITE_TEST_JOURNEY:'1',QUOTESUITE_TEST_DELIVERY_ENABLED:'0',QUOTESUITE_DB_PATH:path.join(os.tmpdir(),'quotesuite-complete-journey-rate-test','fixture.db')};
  const args=['--import',pathToFileURL(path.resolve('tests/fixtures/isolatedJourneyExchangeRate.mjs')).href,'--input-type=module','--eval',"console.log(JSON.stringify(await globalThis.__quoteSyncExchangeRateTestProvider('EUR')))"];
  for(const patch of [{NODE_ENV:'production'},{QUOTESUITE_TEST_DELIVERY_ENABLED:'1'},{QUOTESUITE_DB_PATH:path.resolve('quotesync.db')},{QUOTESUITE_TEST_JOURNEY:'0'}]){
    const denied=spawnSync(process.execPath,args,{env:{...env,...patch},encoding:'utf8',timeout:5000,windowsHide:true});
    assert.equal(denied.error,undefined);assert.notEqual(denied.status,0);assert.match(denied.stderr,/restricted to the owned disposable journey/);
  }
  const allowed=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(allowed.status,0,allowed.stderr);assert.deepEqual(JSON.parse(allowed.stdout),{rawRate:'0.84',provider:'disposable-browser-fixture',quotedAt:'2026-09-12T09:00:00.000Z'});
});
