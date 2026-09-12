import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

test('Google journey preload refuses production, enabled delivery and non-isolated databases before IO',()=>{
 const env={...process.env,NODE_ENV:'development',QUOTESUITE_TEST_JOURNEY:'1',QUOTESUITE_TEST_DELIVERY_ENABLED:'0',QUOTESUITE_DB_PATH:path.join(os.tmpdir(),'quotesuite-complete-journey-guard','fixture.db')};
 const args=['--import',pathToFileURL(path.resolve('tests/fixtures/isolatedJourneyGoogle.mjs')).href,'--eval',''];
 for(const patch of [{NODE_ENV:'production'},{QUOTESUITE_TEST_DELIVERY_ENABLED:'1'},{QUOTESUITE_TEST_JOURNEY:'0'},{QUOTESUITE_DB_PATH:path.resolve('quotesync.db')}]){
  const result=spawnSync(process.execPath,args,{env:{...env,...patch},encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0);assert.match(result.stderr,/requires the owned delivery-disabled journey workspace/);
 }
});
