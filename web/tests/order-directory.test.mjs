import test from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import express from 'express';
import {readOrderDirectory} from '../server/features/lifecycle/orderDirectory.js';
import {createLifecycleRouter} from '../server/routes/lifecycle.js';

test('Order directory SQL paginates, escapes literal search and excludes unaccepted or inconsistent context',async()=>{
  const db=await open({filename:':memory:',driver:sqlite3.Database});
  try{
    await db.exec(`CREATE TABLE clients(id TEXT,name TEXT,client_ref TEXT,deleted_at TEXT);CREATE TABLE projects(id TEXT,client_id TEXT,name TEXT,deleted_at TEXT);CREATE TABLE orders(id TEXT,order_ref TEXT,client_id TEXT,project_id TEXT,source_estimate_id TEXT,source_estimate_revision INTEGER,status TEXT,created_at TEXT);CREATE TABLE portal_estimate_acceptances(order_id TEXT,overall_accepted INTEGER);INSERT INTO clients VALUES('client','Client 100%','TEST-CL',NULL);INSERT INTO projects VALUES('project','client','Site_A',NULL);`);
    for(let index=0;index<23;index++){await db.run("INSERT INTO orders VALUES(?,?,'client','project','estimate',1,'pending_staff_approval',?)",`id-${index}`,`TEST-${index}`,new Date(Date.UTC(2026,0,index+1)).toISOString());if(index<22)await db.run('INSERT INTO portal_estimate_acceptances VALUES(?,1)',`id-${index}`);}
    const page=await readOrderDirectory(db),last=await readOrderDirectory(db,{offset:20});assert.equal(page.total,22);assert.equal(page.items.length,20);assert.equal(last.items.length,2);assert.equal(page.items[0].id,'id-21');assert.equal(new Set([...page.items,...last.items].map(item=>item.id)).size,22);
    assert.equal((await readOrderDirectory(db,{search:'100%'})).total,22);assert.equal((await readOrderDirectory(db,{search:'100_'})).total,0);assert.equal((await readOrderDirectory(db,{search:'Site_A'})).total,22);
    await assert.rejects(()=>readOrderDirectory(db,{offset:-1}),/valid Order page/);await assert.rejects(()=>readOrderDirectory(db,{search:['bad']}),/search/);
    await db.run("UPDATE projects SET client_id='other'");assert.equal((await readOrderDirectory(db)).total,0);
  }finally{await db.close();}
});

test('new directory rejects an untrusted browser origin before database access',async()=>{
  let accessed=false;const app=express();app.use(createLifecycleRouter({databasePromise:{then(){accessed=true;throw new Error('Unexpected database access');}}}));
  const server=await new Promise(resolve=>{const owned=app.listen(0,'127.0.0.1',()=>resolve(owned));});
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/orders`,{headers:{Origin:'https://untrusted.example'}});assert.equal(response.status,403);assert.equal(accessed,false);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
