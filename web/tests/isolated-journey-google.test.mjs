import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {isolatedJourneyMode} from './fixtures/isolatedJourneyGuard.mjs';

test('no-network reissue mode needs isolated development, explicit opt-in and exact test addresses',()=>{
 const env={NODE_ENV:'development',QUOTESUITE_TEST_JOURNEY:'1',QUOTESUITE_TEST_DELIVERY_ENABLED:'1',QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:'customer-reissue',QUOTESUITE_TEST_CUSTOMER_EMAIL:'customer.journey@example.test',QUOTESUITE_TEST_FACTORY_EMAIL:'factory.journey@example.test',QUOTESUITE_DB_PATH:path.join(os.tmpdir(),'quotesuite-complete-journey-guard','fixture.db')};
 assert.equal(isolatedJourneyMode(env).delivery,true);
 assert.equal(isolatedJourneyMode({...env,QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:'factory-send'}).factoryDelivery,true);
 assert.equal(isolatedJourneyMode(env).factoryDelivery,false);
 assert.throws(()=>isolatedJourneyMode({...env,QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:'factory-send',QUOTESUITE_TEST_FACTORY_EMAIL:'live@example.com'}),/requires the owned/);
 for(const patch of [{NODE_ENV:'production'},{QUOTESUITE_TEST_FACTORY_EMAIL:'factory@example.com'},{QUOTESUITE_TEST_DELIVERY_ENABLED:'0'},{QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:''}])assert.throws(()=>isolatedJourneyMode({...env,...patch}),/requires the owned/);
});

test('Google journey preload refuses production, unapproved delivery and non-isolated databases before IO',()=>{
 const env={...process.env,NODE_ENV:'development',QUOTESUITE_TEST_JOURNEY:'1',QUOTESUITE_TEST_DELIVERY_ENABLED:'0',QUOTESUITE_DB_PATH:path.join(os.tmpdir(),'quotesuite-complete-journey-guard','fixture.db')};
 const args=['--import',pathToFileURL(path.resolve('tests/fixtures/isolatedJourneyGoogle.mjs')).href,'--eval',''];
 for(const patch of [{NODE_ENV:'production'},{QUOTESUITE_TEST_DELIVERY_ENABLED:'1'},{QUOTESUITE_TEST_JOURNEY:'0'},{QUOTESUITE_DB_PATH:path.resolve('quotesync.db')},{QUOTESUITE_TEST_DELIVERY_ENABLED:'1',QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:'customer-reissue',QUOTESUITE_TEST_CUSTOMER_EMAIL:'live@example.com',QUOTESUITE_TEST_FACTORY_EMAIL:'factory.journey@example.test'},{QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:'customer-reissue'}]){
  const result=spawnSync(process.execPath,args,{env:{...env,...patch},encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0);assert.match(result.stderr,/requires the owned delivery-disabled journey workspace/);
 }
});
