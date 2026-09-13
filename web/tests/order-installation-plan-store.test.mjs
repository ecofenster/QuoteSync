import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {createOrderInstallationPlanStore,initializeOrderInstallationPlanStore} from '../server/features/installationSafety/orderInstallationPlanStore.js';

test('persistent reviewed Order plan saves once, retains history, rejects changed preview and rolls back failures',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qs-order-plan-store-')),databasePath=path.join(root,'test.db');let db;
  try{
    db=await open({filename:databasePath,driver:sqlite3.Database});await db.exec("CREATE TABLE clients(id TEXT PRIMARY KEY);CREATE TABLE estimates(id TEXT PRIMARY KEY);CREATE TABLE orders(id TEXT PRIMARY KEY);INSERT INTO clients VALUES('client');INSERT INTO estimates VALUES('estimate');INSERT INTO orders VALUES('order');");await initializeOrderInstallationPlanStore(db);
    let fingerprint='a'.repeat(64),loads=0;
    const proposalLoader=async(_db,input,scope)=>{loads++;assert.equal(scope.clientId,'client');return {binding:{orderId:input.orderId,estimateId:input.estimateId,estimateRevision:1,scenarioRevision:2,scopeChanges:{included:[],excluded:[]}},document:{positions:[{id:'accepted'}]},reviewRequired:['Travel not confirmed'],proposedScenario:{private:'INTERNAL'},proposalFingerprint:fingerprint};};
    const make=()=>createOrderInstallationPlanStore({databasePath,proposalLoader}),store=make(),scope={clientId:'client',actorId:'staff'},input={orderId:'order',estimateId:'estimate',revision:1,scenarioId:'scenario',scenarioRevision:2};
    const preview=await store.preview(input,scope);assert.equal(preview.fingerprint,fingerprint);assert.doesNotMatch(JSON.stringify(preview),/INTERNAL|proposedScenario/);
    const request={...input,reviewed:true,reason:'Accepted scope reviewed',expectedFingerprint:preview.fingerprint,requestKey:'save-1'};
    const [first,retry]=await Promise.all([store.save(request,scope),make().save(request,scope)]);assert.equal(first.id,retry.id);assert.notEqual(first.reused,retry.reused);assert.equal(first.version,1);assert.equal(loads,2,'Preview and one save load source; duplicate reuses committed work');
    fingerprint='b'.repeat(64);assert.equal((await make().save(request,scope)).id,first.id,'Successful work survives later source changes and a new store connection');
    await assert.rejects(()=>store.save({...request,requestKey:'stale'},scope),/changed after preview/);assert.equal((await db.get('SELECT COUNT(*) count FROM order_installation_plans')).count,1);
    await assert.rejects(()=>store.save({...request,reason:'Different review'},scope),/different reviewed choices/);
    await assert.rejects(()=>store.read(first.id,{...scope,orderId:'another',estimateId:'estimate'}),/not found/);
    await assert.rejects(()=>db.run('UPDATE order_installation_plans SET version=4'),/immutable/);await assert.rejects(()=>db.run('DELETE FROM order_installation_plans'),/immutable/);
    await db.exec("CREATE TRIGGER forced_order_plan_failure BEFORE INSERT ON order_installation_plans BEGIN SELECT RAISE(ABORT,'Disposable failure'); END");
    const next={...request,requestKey:'save-2',expectedFingerprint:fingerprint};await assert.rejects(()=>store.save(next,scope),/Disposable failure/);assert.equal((await db.get('SELECT COUNT(*) count FROM order_installation_plans')).count,1);await db.exec('DROP TRIGGER forced_order_plan_failure');
    assert.equal((await store.save(next,scope)).version,2);const retained=await store.read(first.id,{...scope,...input});assert.equal(retained.fingerprint,'a'.repeat(64));assert.equal(retained.reviewReason,'Accepted scope reviewed');
  }finally{await db?.close();await rm(root,{recursive:true,force:true});}
});
