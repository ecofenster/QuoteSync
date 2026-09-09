import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeEstimateProcurementActionSchema } from "../server/features/estimates/estimateProcurementActionSchema.js";
import { createEstimateProcurementActionService } from "../server/features/estimates/estimateProcurementActionService.js";
import express from "express";
import { createEstimateProcurementActionsRouter } from "../server/routes/estimateProcurementActions.js";

async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),"qs-procurement-actions-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE projects(id TEXT PRIMARY KEY);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,project_id TEXT,estimate_ref TEXT NOT NULL,status TEXT NOT NULL,outcome TEXT NOT NULL,deleted_at TEXT,FOREIGN KEY(project_id) REFERENCES projects(id));
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_revisions(id TEXT PRIMARY KEY,supplier_quote_id TEXT NOT NULL,estimate_id TEXT NOT NULL,supplier_quotation_number TEXT,supplier_revision TEXT,revision_sequence INTEGER NOT NULL,lifecycle_status TEXT NOT NULL);
    CREATE TABLE supplier_quote_attachments(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,revision_id TEXT NOT NULL);
    CREATE TABLE estimate_revision_releases(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,released_at TEXT NOT NULL);
    CREATE TABLE portal_estimate_decisions(id TEXT PRIMARY KEY,estimate_release_id TEXT NOT NULL,decision_type TEXT NOT NULL,decided_at TEXT NOT NULL);
    CREATE TABLE portal_review_submissions(id TEXT PRIMARY KEY,estimate_release_id TEXT NOT NULL,status TEXT,submitted_at TEXT);
    CREATE TABLE workflow_events(id TEXT PRIMARY KEY,event_name TEXT NOT NULL,evidence_id TEXT NOT NULL,occurred_at TEXT NOT NULL,links_json TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(event_name,evidence_id));
    INSERT INTO projects VALUES('project-1');
    INSERT INTO estimates VALUES('estimate-1','client-1','project-1','TEST-EST-1','Issued','Open',NULL);
  `);
  await initializeEstimateProcurementActionSchema(db);
  const service=createEstimateProcurementActionService(db,{clock:()=>Date.parse("2026-09-07T12:00:00.000Z")});
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return {db,service};
}

test("supplier revision request is evidence-gated, staff-reviewed and idempotent",async t=>{
  const {db,service}=await fixture(t);
  assert.equal((await service.availability("estimate-1")).requestSupplierRevision.available,false);
  await db.exec(`INSERT INTO supplier_quotes VALUES('quote-1','estimate-1','Example Supplier',NULL);
    INSERT INTO supplier_quote_revisions VALUES('revision-1','quote-1','estimate-1','SQ-1','A',1,'reviewed');
    INSERT INTO supplier_quote_attachments VALUES('attachment-1','estimate-1','revision-1');`);
  assert.equal((await service.availability("estimate-1")).requestSupplierRevision.available,true);
  const input={idempotencyKey:"request-1",affectedPositionIds:["position-1"],requestedChanges:"Reviewed change",supportingDocumentIds:["document-1"]};
  const first=await service.requestSupplierRevision("estimate-1",input,"staff-1"),replay=await service.requestSupplierRevision("estimate-1",input,"staff-1");
  assert.equal(first.status,"draft_staff_review");assert.equal(first.request.customerCommentsIncluded,false);assert.equal(first.request.dispatchCreated,false);assert.equal(replay.idempotentReplay,true);
  assert.equal((await db.get("SELECT COUNT(*) count FROM estimate_procurement_actions")).count,1);
  assert.equal((await db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name='estimate.supplier_revision_request_prepared'")).count,1);
});

test("customer intent never bypasses Position acceptance, signature and internal factory approval",async t=>{
  const {db,service}=await fixture(t);
  await db.exec(`INSERT INTO estimate_revision_releases VALUES('release-1','estimate-1','2026-09-07T10:00:00.000Z');
    INSERT INTO portal_estimate_decisions VALUES('decision-1','release-1','intent_to_proceed','2026-09-07T11:00:00.000Z');`);
  const state=await service.availability("estimate-1");
  assert.equal(state.raiseOrderToFactory.customerIntentRecorded,true);assert.equal(state.raiseOrderToFactory.available,false);
  await assert.rejects(()=>service.raiseOrderToFactory("estimate-1"),error=>error.code==="factory_order_gate_incomplete"&&error.details.reasons.length===2);
  assert.equal((await db.get("SELECT COUNT(*) count FROM estimate_procurement_actions WHERE action_type='raise_order_to_factory'")).count,0);
});

test("production-style API exposes state-aware actions and keeps factory execution fail-closed",async t=>{
  const {db}=await fixture(t);await db.exec(`INSERT INTO estimate_revision_releases VALUES('release-1','estimate-1','2026-09-07T10:00:00.000Z');INSERT INTO portal_estimate_decisions VALUES('decision-1','release-1','intent_to_proceed','2026-09-07T11:00:00.000Z');`);
  const app=express();app.use(express.json());app.use("/api/estimates",createEstimateProcurementActionsRouter({databasePromise:Promise.resolve(db)}));const server=app.listen(0,"127.0.0.1");t.after(()=>new Promise(resolve=>server.close(resolve)));await new Promise(resolve=>server.once("listening",resolve));const address=server.address(),base=`http://127.0.0.1:${address.port}`;
  const availability=await fetch(`${base}/api/estimates/estimate-1/procurement-actions`);assert.equal(availability.status,200);assert.equal((await availability.json()).raiseOrderToFactory.customerIntentRecorded,true);
  const factory=await fetch(`${base}/api/estimates/estimate-1/procurement-actions/raise-order-to-factory`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"factory-attempt"},body:"{}"});assert.equal(factory.status,409);assert.equal((await factory.json()).code,"factory_order_gate_incomplete");
});
