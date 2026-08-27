import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeSupplierCommercialSchema } from "../server/schema/supplierCommercialSchema.js";
import { EstimatePurgeBlockedError, purgeEstimateOwnedGraph } from "../server/features/estimatePositions/estimatePurgeService.js";

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-estimate-purge-runtime-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY);
    CREATE TABLE projects(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES clients(id));
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES clients(id),project_id TEXT REFERENCES projects(id),deleted_at TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY,source_estimate_id TEXT NOT NULL);
    CREATE TABLE issued_quotations(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL);
    CREATE TABLE customer_quotation_documents(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL);
    CREATE TABLE canonical_documents(id TEXT PRIMARY KEY,estimate_id TEXT);
    CREATE TABLE communication_messages(id TEXT PRIMARY KEY,links_json TEXT NOT NULL DEFAULT '[]');`);
  await initializeSupplierCommercialSchema(db);
  await db.run("INSERT INTO clients(id) VALUES('client')");
  await db.run("INSERT INTO projects(id,client_id) VALUES('project','client')");
  return {db,attachmentRoot:path.join(root,"attachments")};
}

async function addEstimate(db,id,{deleted=true}={}){await db.run("INSERT INTO estimates(id,client_id,project_id,deleted_at) VALUES(?,?,?,?)",id,"client","project",deleted?"2026-08-27T12:00:00.000Z":null)}

test("a deleted draft Estimate purges transactionally while its Project survives",async t=>{
  const{db,attachmentRoot}=await fixture(t);await addEstimate(db,"draft");
  const now="2026-08-27T12:00:00.000Z";
  await db.run("INSERT INTO project_calculator_lab_scenarios(id,estimate_id,origin,name,currency,package_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)","scenario","draft","manual","Draft","GBP","supply_only",now,now);
  await db.run("INSERT INTO supplier_quotes(id,estimate_id,supplier_code,supplier_name) VALUES(?,?,?,?)","quote","draft","TEST","Test Supplier");
  const result=await purgeEstimateOwnedGraph(db,"draft",{attachmentRoot});
  assert.equal(result.success,true);assert.equal((await db.get("SELECT count(*) count FROM estimates WHERE id='draft'")).count,0);assert.equal((await db.get("SELECT count(*) count FROM projects WHERE id='project'")).count,1);assert.equal((await db.get("SELECT count(*) count FROM project_calculator_lab_scenarios WHERE estimate_id='draft'")).count,0);assert.equal((await db.get("SELECT count(*) count FROM supplier_quotes WHERE estimate_id='draft'")).count,0);
});

test("retained documents and canonical workflow evidence prohibit purge with safe dependency details",async t=>{
  const{db,attachmentRoot}=await fixture(t);await addEstimate(db,"evidence");
  await db.run("INSERT INTO canonical_documents(id,estimate_id) VALUES('document','evidence')");
  await db.run("INSERT INTO communication_messages(id,links_json) VALUES('message',?)",JSON.stringify([{kind:"estimate",id:"evidence"}]));
  await assert.rejects(()=>purgeEstimateOwnedGraph(db,"evidence",{attachmentRoot}),error=>{assert.ok(error instanceof EstimatePurgeBlockedError);assert.equal(error.status,409);assert.equal(error.code,"estimate_purge_blocked");assert.deepEqual(error.dependencies.map(item=>item.kind).sort(),["canonical_document","communication"]);assert.doesNotMatch(error.message,/SQLITE|constraint/i);return true});
  assert.equal((await db.get("SELECT count(*) count FROM estimates WHERE id='evidence'")).count,1);assert.equal((await db.get("SELECT count(*) count FROM canonical_documents WHERE estimate_id='evidence'")).count,1);
});

test("Order, issued quotation and customer document each remain explicit purge blockers",async t=>{
  const{db,attachmentRoot}=await fixture(t);await addEstimate(db,"commercial");
  await db.run("INSERT INTO orders(id,source_estimate_id) VALUES('order','commercial')");await db.run("INSERT INTO issued_quotations(id,estimate_id) VALUES('issued','commercial')");await db.run("INSERT INTO customer_quotation_documents(id,estimate_id) VALUES('customer-document','commercial')");
  await assert.rejects(()=>purgeEstimateOwnedGraph(db,"commercial",{attachmentRoot}),error=>{assert.deepEqual(error.dependencies.map(item=>item.kind).sort(),["customer_quotation_document","issued_quotation","order"]);return true});
});

test("active Estimates cannot bypass the Recycle Bin and failed deletes roll the whole transaction back",async t=>{
  const{db,attachmentRoot}=await fixture(t);await addEstimate(db,"active",{deleted:false});
  await assert.rejects(()=>purgeEstimateOwnedGraph(db,"active",{attachmentRoot}),error=>error.code==="estimate_not_deleted"&&error.status===409);
  await addEstimate(db,"rollback");await db.run("INSERT INTO supplier_quotes(id,estimate_id,supplier_code,supplier_name) VALUES(?,?,?,?)","rollback-quote","rollback","TEST","Test Supplier");
  await db.exec("CREATE TRIGGER reject_estimate_purge BEFORE DELETE ON estimates WHEN OLD.id='rollback' BEGIN SELECT RAISE(ABORT,'fixture rollback'); END");
  await assert.rejects(()=>purgeEstimateOwnedGraph(db,"rollback",{attachmentRoot}),/fixture rollback/);
  assert.equal((await db.get("SELECT count(*) count FROM estimates WHERE id='rollback'")).count,1);assert.equal((await db.get("SELECT count(*) count FROM supplier_quotes WHERE estimate_id='rollback'")).count,1);
});

test("the API maps domain purge blocks to 409 without exposing database errors",async()=>{
  const route=await import("node:fs/promises").then(fs=>fs.readFile("server/routes/estimates.js","utf8"));
  assert.match(route,/Number\(error\?\.status\) === 409/);assert.match(route,/res\.status\(409\)\.json/);assert.match(route,/estimate_purge_blocked/);
});
