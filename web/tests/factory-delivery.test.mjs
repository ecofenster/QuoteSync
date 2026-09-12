import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {initializeFactoryDeliverySchema,sendFactoryOnce,factoryDeliveryState} from '../server/features/lifecycle/factoryDelivery.js';

test('factory delivery claim persists across connections, failures and restart without another provider call',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'quotesuite-factory-delivery-')),filename=path.join(root,'test.db');let db,second;
  try{
    db=await open({filename,driver:sqlite3.Database});await db.exec("CREATE TABLE orders(id TEXT PRIMARY KEY);CREATE TABLE factory_order_requests(order_id TEXT PRIMARY KEY,communication_message_id TEXT,status TEXT)");await initializeFactoryDeliverySchema(db);
    for(const id of ['success','retry','uncertain','partial','stale']){await db.run('INSERT INTO orders VALUES(?)',id);await db.run("INSERT INTO factory_order_requests VALUES(?,?,'draft')",id,`${id}-message`)}
    second=await open({filename,driver:sqlite3.Database});
    let sends=0,release,started;const begun=new Promise(resolve=>{started=resolve}),waiting=new Promise(resolve=>{release=resolve});
    const sending=sendFactoryOnce(db,{orderId:'success',communicationId:'success-message',send:async()=>{sends++;started();await waiting;return {providerMessageId:'provider-success'}}});await begun;
    await assert.rejects(()=>sendFactoryOnce(second,{orderId:'success',communicationId:'success-message',send:async()=>{sends++}}),error=>error.code==='factory_delivery_unconfirmed');release();await sending;
    await second.close();second=await open({filename,driver:sqlite3.Database});assert.equal((await sendFactoryOnce(second,{orderId:'success',communicationId:'success-message',send:async()=>{sends++}})).state,'sent');assert.equal(sends,1);
    await assert.rejects(()=>sendFactoryOnce(db,{orderId:'retry',communicationId:'retry-message',send:async()=>{throw Object.assign(new Error('Attachment unavailable'),{deliveryOutcome:'not_sent'})}}),error=>error.code==='factory_delivery_not_sent');
    assert.equal((await sendFactoryOnce(second,{orderId:'retry',communicationId:'retry-message',send:async()=>({providerMessageId:'retry-confirmed'})})).state,'sent');assert.equal((await db.get("SELECT COUNT(*) n FROM factory_delivery_attempts WHERE order_id='retry'")).n,2);
    await assert.rejects(()=>sendFactoryOnce(db,{orderId:'uncertain',communicationId:'uncertain-message',send:async()=>{throw new Error('Connection ended after request')}}),error=>error.code==='factory_delivery_unconfirmed');
    await assert.rejects(()=>sendFactoryOnce(second,{orderId:'uncertain',communicationId:'uncertain-message',send:async()=>{throw new Error('Must not retry')}}),error=>error.code==='factory_delivery_unconfirmed');assert.equal((await factoryDeliveryState(db,'uncertain')).state,'uncertain');
    const partial=await sendFactoryOnce(db,{orderId:'partial',communicationId:'partial-message',send:async()=>{throw Object.assign(new Error('Local projection failed'),{deliveryOutcome:'sent',providerMessageId:'provider-partial'})}});assert.equal(partial.state,'sent');assert.equal(partial.provider_message_id,'provider-partial');
    await assert.rejects(()=>sendFactoryOnce(db,{orderId:'stale',communicationId:'old-message',send:async()=>{throw new Error('Must not send')}}),error=>error.code==='factory_draft_changed');
    await db.run("INSERT INTO orders VALUES('race')");await db.run("INSERT INTO factory_order_requests VALUES('race','race-message','draft')");
    const recovered=await sendFactoryOnce(db,{orderId:'race',communicationId:'race-message',send:async({attemptId})=>{
      await second.run("UPDATE factory_delivery_attempts SET state='sent',provider_message_id='reconciled-proof',sent_at='2026-09-13T12:00:00Z' WHERE id=?",attemptId);
      throw new Error('Original request timed out after concurrent recovery');
    }});assert.equal(recovered.state,'sent');assert.equal(recovered.provider_message_id,'reconciled-proof');
    await assert.rejects(()=>db.run('DELETE FROM factory_delivery_attempts'),/cannot be deleted/);
  }finally{await second?.close();await db?.close();await rm(root,{recursive:true,force:true})}
});
