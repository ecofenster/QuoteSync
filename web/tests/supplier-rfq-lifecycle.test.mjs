import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { initializeLifecycleSchema } from "../server/features/lifecycle/lifecycleSchema.js";
import { createLifecycleService } from "../server/features/lifecycle/lifecycleService.js";

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-rfq-")),db=await open({filename:path.join(root,"rfq.db"),driver:sqlite3.Database});
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,client_ref TEXT,deleted_at TEXT);
    CREATE TABLE projects(id TEXT PRIMARY KEY,client_id TEXT,name TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,project_id TEXT,estimate_ref TEXT,revision_no INTEGER,status TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,origin_event_id TEXT);
    CREATE TABLE supplier_commercial_defaults(supplier_code TEXT PRIMARY KEY,supplier_name TEXT,policy_json TEXT DEFAULT '{}',pricing_display_policy_json TEXT DEFAULT '{}',updated_at TEXT,active INTEGER DEFAULT 1);
    CREATE TABLE canonical_documents(id TEXT PRIMARY KEY,project_id TEXT,file_name TEXT,mime_type TEXT,size_bytes INTEGER,document_type TEXT,provider_file_id TEXT,provider_revision TEXT,checksum TEXT,folder_path TEXT,provider_modified_at TEXT,removed_at TEXT,trashed INTEGER DEFAULT 0);
    INSERT INTO clients VALUES('client-1','Disposable Client','TEST-CL-1',NULL);
    INSERT INTO projects VALUES('project-1','client-1','Disposable Project',NULL);
    INSERT INTO estimates VALUES('estimate-1','project-1','TEST-EST-1',1,'Draft','2026-09-11T10:00:00.000Z',NULL);
    INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,updated_at) VALUES('ZYLE','Zyle Fenster','2026-09-11T10:00:00.000Z');
    INSERT INTO canonical_documents VALUES('document-1','project-1','Approved drawing.pdf','application/pdf',120,'project_drawing','drive-file-1','7','abc123','2026/TEST/Drawings','2026-09-11T10:00:00.000Z',NULL,0);
  `);
  await initializeWorkflowSchema(db);await initializeLifecycleSchema(db);
  const service=createLifecycleService(db,{environment:{NODE_ENV:"development",QUOTESUITE_TEST_JOURNEY:"1",QUOTESUITE_TEST_FACTORY_EMAIL:"factory@example.test"},now:()=>new Date("2026-09-11T10:00:00.000Z")});
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return{db,service};
}

const request={estimateId:"estimate-1",supplierId:"ZYLE",recipient:"factory@example.test",subject:"Request for quotation · TEST-EST-1",bodyText:"Please quote the selected Project evidence.",documentIds:["document-1"],createdBy:"staff-1",idempotencyKey:"rfq-browser-command-1",send:false};

test("supplier RFQ preview snapshots canonical files and preserves one record across retries",async t=>{
  const {db,service}=await fixture(t),context=await service.supplierEnquiryContext("project-1","estimate-1");
  assert.equal(context.project.clientReference,"TEST-CL-1");assert.equal(context.suppliers[0].name,"Zyle Fenster");assert.equal(context.documents[0].fileName,"Approved drawing.pdf");assert.equal(context.delivery.deliveryMode,"preview_only");
  const created=await service.prepareSupplierEnquiry("project-1",request),replay=await service.prepareSupplierEnquiry("project-1",request);
  assert.equal(created.status,"draft");assert.equal(created.revisionNo,1);assert.equal(created.documents[0].providerRevision,"7");assert.equal(replay.id,created.id);assert.equal(replay.idempotentReplay,true);
  const persisted=await db.get('SELECT created_at,updated_at FROM supplier_enquiry_drafts WHERE id=?',created.id);
  const reopened=(await service.supplierEnquiryContext("project-1","estimate-1")).enquiries[0];
  assert.equal(created.createdAt,persisted.created_at);assert.equal(created.updatedAt,persisted.updated_at);
  assert.equal(Number.isFinite(Date.parse(created.createdAt)),true);
  for(const field of Object.keys(reopened)){
    assert.deepEqual(created[field],reopened[field],`New response must match reopened ${field}`);
    assert.deepEqual(replay[field],reopened[field],`Retry must match reopened ${field}`);
  }
  assert.equal((await db.get("SELECT COUNT(*) count FROM supplier_enquiry_drafts")).count,1);assert.equal((await db.get("SELECT COUNT(*) count FROM communication_messages")).count,1);
  await db.run("UPDATE canonical_documents SET file_name='Externally renamed drawing.pdf',provider_revision='8' WHERE id='document-1'");
  assert.equal((await service.supplierEnquiryContext("project-1","estimate-1")).enquiries[0].documentSnapshot[0].fileName,"Approved drawing.pdf");
  await assert.rejects(()=>service.prepareSupplierEnquiry("project-1",{...request,subject:"Different reviewed content"}),error=>error.code==="supplier_enquiry_idempotency_conflict");
  const revised=await service.prepareSupplierEnquiry("project-1",{...request,idempotencyKey:"rfq-browser-command-2",subject:"Revised request"});assert.equal(revised.revisionNo,2);assert.equal(revised.supersedesId,created.id);
});

test("supplier RFQ ownership and controlled-delivery gates fail closed",async t=>{
  const {db,service}=await fixture(t);
  await assert.rejects(()=>service.prepareSupplierEnquiry("project-1",{...request,estimateId:"other"}),error=>error.code==="supplier_enquiry_estimate_invalid");
  await assert.rejects(()=>service.prepareSupplierEnquiry("project-1",{...request,supplierId:"missing"}),error=>error.code==="supplier_enquiry_supplier_invalid");
  await assert.rejects(()=>service.prepareSupplierEnquiry("project-1",{...request,documentIds:["missing"]}),error=>error.code==="supplier_enquiry_document_invalid");
  await assert.rejects(()=>service.prepareSupplierEnquiry("project-1",{...request,send:true}),error=>error.code==="test_delivery_disabled");
  assert.equal((await db.get("SELECT COUNT(*) count FROM supplier_enquiry_drafts")).count,0);assert.equal((await db.get("SELECT COUNT(*) count FROM communication_messages")).count,0);
});

test("a partial RFQ save keeps the Email draft and safely resumes it",async t=>{
  const {db,service}=await fixture(t);await db.exec("CREATE TRIGGER fail_rfq BEFORE INSERT ON supplier_enquiry_drafts BEGIN SELECT RAISE(ABORT,'injected RFQ persistence failure'); END");
  await assert.rejects(()=>service.prepareSupplierEnquiry("project-1",request),error=>error.code==="supplier_enquiry_partial_success"&&error.message.includes("Email draft was saved"));
  assert.equal((await db.get("SELECT COUNT(*) count FROM communication_messages")).count,1);assert.equal((await db.get("SELECT COUNT(*) count FROM supplier_enquiry_drafts")).count,0);
  await db.exec("DROP TRIGGER fail_rfq");const resumed=await service.prepareSupplierEnquiry("project-1",request);
  assert.equal(resumed.revisionNo,1);assert.equal((await db.get("SELECT COUNT(*) count FROM communication_messages")).count,1);assert.equal((await db.get("SELECT COUNT(*) count FROM supplier_enquiry_drafts")).count,1);
});
