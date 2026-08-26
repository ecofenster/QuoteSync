import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import express from "express";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { createDocumentRecordsService } from "../server/features/documents/documentRecordsService.js";
import { createDocumentsRouter } from "../server/routes/documents.js";

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-documents-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,estimate_ref TEXT,revision_no INTEGER,created_at TEXT,deleted_at TEXT,FOREIGN KEY(client_id) REFERENCES clients(id));
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_code TEXT,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_revisions(id TEXT PRIMARY KEY,supplier_quote_id TEXT,estimate_id TEXT,revision_sequence INTEGER,supplier_quotation_number TEXT,supplier_revision TEXT);
    CREATE TABLE supplier_quote_attachments(id TEXT PRIMARY KEY,estimate_id TEXT,revision_id TEXT,original_file_name TEXT,media_type TEXT,size_bytes INTEGER,sha256 TEXT,created_at TEXT,document_kind TEXT);
  `);
  await initializeWorkflowSchema(db);
  await db.run("INSERT INTO clients VALUES(?,?,?,?,NULL)","client-1","Ada Client","ada@example.com","Garden Room");
  await db.run("INSERT INTO estimates VALUES(?,?,?,?,?,NULL)","estimate-1","client-1","EST-100",2,"2026-08-26T09:00:00.000Z");
  await db.run("INSERT INTO supplier_quotes VALUES(?,?,?,?,NULL)","quote-1","estimate-1","ZYLE","Zyle Fenster");
  await db.run("INSERT INTO supplier_quote_revisions VALUES(?,?,?,?,?,?)","revision-1","quote-1","estimate-1",1,"343718-1","1");
  await db.run("INSERT INTO supplier_quote_attachments VALUES(?,?,?,?,?,?,?,?,?)","attachment-1","estimate-1","revision-1","343718-1.pdf","application/pdf",321,"a".repeat(64),"2026-08-26T10:00:00.000Z","complete_quotation");
  await db.run("INSERT INTO customer_quotation_documents VALUES(?,?,?,?,?,?,?,?,?,?,?)","document-1","estimate-1",3,"EST-100-R3.pdf","application/pdf","quotations/document-1.pdf",456,"b".repeat(64),"c".repeat(64),"{}","2026-08-26T11:00:00.000Z");
  await db.run("INSERT INTO integration_oauth_connections(provider,status,account_id,scopes_json,updated_at) VALUES('google_workspace','connected','google-account-1','[]','2026-08-26T09:00:00.000Z')");
  await db.run("INSERT INTO drive_project_folders VALUES(?,?,?,?,?,?,?,?,?)","folder-row","google_drive","estimate-1","supplier:test","Zyle Fenster","supplier_estimates","drive-folder-1","2026-08-26T10:00:00.000Z","2026-08-26T10:00:00.000Z");
  await db.run("INSERT INTO drive_document_links VALUES(?,?,?,?,?,?,?,?,?,?)","link-1","google_drive","estimate-1","quote-1","revision-1","attachment-1",null,"drive-file-1","drive-folder-1","2026-08-26T10:05:00.000Z");
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return db;
}

test("Client Files and Estimate Files project the same canonical document identities",async t=>{
  const db=await fixture(t),service=createDocumentRecordsService(db);
  const client=await service.list({clientId:"client-1"}),estimate=await service.list({estimateId:"estimate-1"});
  assert.deepEqual(client.documents.map(item=>item.id),estimate.documents.map(item=>item.id));
  const supplier=client.documents.find(item=>item.id==="supplier_attachment:attachment-1");
  assert.equal(supplier.provider,"google_drive");assert.equal(supplier.providerAccountId,"google-account-1");assert.equal(supplier.providerFileId,"drive-file-1");assert.equal(supplier.providerFolderId,"drive-folder-1");
  assert.equal(supplier.clientId,"client-1");assert.equal(supplier.projectId,"estimate-1");assert.equal(supplier.estimateId,"estimate-1");assert.equal(supplier.supplierId,"ZYLE");assert.equal(supplier.folder,"Estimates/Zyle Fenster");
  const quotation=client.documents.find(item=>item.id==="customer_quotation:document-1");assert.equal(quotation.provider,"quotesuite_managed");assert.equal(quotation.documentType,"customer_quotation");
  assert.equal(client.folders[0].providerFolderId,"drive-folder-1");
});

test("Client Files UI and Estimate context reuse the provider-neutral endpoint",async()=>{
  const [panel,clientTab,workspace,service]=await Promise.all([
    readFile("src/features/documents/CanonicalDocumentsPanel.tsx","utf8"),readFile("src/features/estimatePicker/tabs/FilesTab.tsx","utf8"),readFile("src/features/estimateCommercial/EstimateCommercialWorkspace.tsx","utf8"),readFile("server/features/documents/documentRecordsService.js","utf8")
  ]);
  assert.match(panel,/listClient/);assert.match(panel,/listEstimate/);assert.match(clientTab,/CanonicalDocumentsPanel clientId/);assert.match(workspace,/Files \/ Documents/);assert.match(workspace,/CanonicalDocumentsPanel estimateId/);
  const architecture=await readFile("src/features/documents/domain/projectDocumentArchitecture.ts","utf8");
  assert.match(service,/providerAccountId/);assert.match(service,/providerFileId/);assert.match(service,/providerFolderId/);assert.match(service,/orderId/);assert.doesNotMatch(service,/CREATE TABLE/);
  assert.match(architecture,/microsoft_onedrive/);assert.match(architecture,/microsoft_sharepoint/);assert.match(architecture,/providerAccountId/);
});

test("provider-neutral documents API scopes the same records by Client or Estimate",async t=>{
  const db=await fixture(t),app=express();app.use("/api/documents",createDocumentsRouter({databasePromise:Promise.resolve(db)}));
  const server=app.listen(0,"127.0.0.1");t.after(()=>new Promise(resolve=>server.close(resolve)));await new Promise(resolve=>server.once("listening",resolve));
  const address=server.address();assert.ok(address&&typeof address==="object");
  const clientResponse=await fetch(`http://127.0.0.1:${address.port}/api/documents?client_id=client-1`);assert.equal(clientResponse.status,200);assert.equal((await clientResponse.json()).documents.length,2);
  const invalid=await fetch(`http://127.0.0.1:${address.port}/api/documents`);assert.equal(invalid.status,400);
});
