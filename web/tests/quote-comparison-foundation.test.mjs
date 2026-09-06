import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeCommercialIdentitySchema } from "../server/features/commercialIdentity/commercialIdentitySchema.js";
import { initializeQuoteComparisonSchema } from "../server/features/quoteComparisons/quoteComparisonSchema.js";
import { createQuoteComparisonService } from "../server/features/quoteComparisons/quoteComparisonService.js";
import { createManufacturerDocumentLibraryService } from "../server/features/manufacturerDocuments/manufacturerDocumentLibraryService.js";
import express from "express";
import { createQuoteComparisonsRouter } from "../server/routes/quoteComparisons.js";
import { createManufacturerDocumentsRouter } from "../server/routes/manufacturerDocuments.js";

test("Client workspace owns Compare Quotes and keeps the portal as an internal preview",async()=>{
  const tabs=await readFile(new URL("../src/features/estimatePicker/EstimatePickerTabs.tsx",import.meta.url),"utf8");
  assert.match(tabs,/estimatePickerTab === "compare_quotes"[\s\S]*Compare Quotes/);
  assert.match(tabs,/CompareQuotesWorkspace client=\{pickerClient\}/);
  assert.match(tabs,/estimatePickerTab === "portal_preview"[\s\S]*Portal Preview/);
  assert.match(tabs,/ClientPortalPreview client=\{pickerClient\}/);
});

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-comparison-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,client_ref TEXT,commercial_lifecycle TEXT,reference_namespace TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_ref TEXT,base_estimate_ref TEXT,revision_no INTEGER,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE integration_provider_config(provider TEXT PRIMARY KEY,enquiries_root_folder_id TEXT);
    CREATE TABLE drive_discovered_documents(id TEXT PRIMARY KEY,enquiry_id TEXT);
  `);
  await initializeCommercialIdentitySchema(db);await initializeQuoteComparisonSchema(db);
  const now="2026-09-06T10:00:00.000Z",positions=[{id:"position-a",positionRef:"001",roomName:"Kitchen",qty:1,widthMm:1200,heightMm:1400},{id:"position-b",positionRef:"002",roomName:"Hall",qty:2,widthMm:900,heightMm:2100}];
  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,commercial_lifecycle,reference_namespace,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)","client-disposable","Disposable Client","test@example.com","Extension","TEST-CL-001","prospect","test",now,now);
  await db.run("INSERT INTO projects(id,client_id,name,status,created_at,updated_at) VALUES(?,?,?,?,?,?)","project-disposable","client-disposable","Extension","active",now,now);
  await db.run("INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,positions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)","estimate-r2","client-disposable","project-disposable","TEST-EST-001-R2","TEST-EST-001",2,"Draft",JSON.stringify(positions),now,now);
  for(const [id,name] of [["doc-a","supplier-a.pdf"],["doc-a-tech","supplier-a-spec.docx"],["doc-b","supplier-b.pdf"]])await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,mime_type,size_bytes,folder_path,trashed,discovered_at,last_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,id,"google_drive","account",`provider-${id}`,"client-disposable","project-disposable","supplier_proposal",name,name.endsWith("pdf")?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",100,"Clients/Disposable",now,now,now);
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});return {db,positions};
}

test("comparison freezes the selected Estimate revision and supports multi-document proposal packages",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  const comparison=await service.create({clientId:"client-disposable",baselineEstimateId:"estimate-r2",proposals:[
    {supplierName:"Supplier A",manufacturerName:"Maker A",quotationNumber:"A-10",quotationRevision:"2",scopeKind:"supply_only",currency:"EUR",originalTotalAmount:"10000",documents:[{canonicalDocumentId:"doc-a",documentRole:"commercial"},{canonicalDocumentId:"doc-a-tech",documentRole:"technical"}],items:[{supplierItemReference:"A01",canonicalEstimatePositionId:"position-a",relationshipKind:"exact",differenceStatus:"review_required"}]},
    {supplierName:"Supplier B",manufacturerName:"Maker B",quotationNumber:"B-20",scopeKind:"supply_only",currency:"GBP",originalTotalAmount:"9200",documents:[{canonicalDocumentId:"doc-b",documentRole:"commercial"}],items:[{supplierItemReference:"B/1",canonicalEstimatePositionId:null,relationshipKind:"unmapped",differenceStatus:"review_required"}]},
  ]},"reviewer-1");
  const supplierA=comparison.proposals.find((proposal)=>proposal.supplierName==="Supplier A");
  assert.equal(comparison.status,"draft_review_required");assert.equal(comparison.proposals.length,2);assert.equal(supplierA.documents.length,2);
  assert.equal(comparison.baselineSnapshot.positions[0].id,"position-a");assert.equal(supplierA.positionMappings[0].supplierItemReference,"A01");
  await db.run("UPDATE estimates SET positions_json='[]',revision_no=3 WHERE id='estimate-r2'");
  const retained=await service.get(comparison.id);assert.equal(retained.baselineEstimateRevision,2);assert.equal(retained.baselineSnapshot.positions.length,2);
});

test("staff mapping corrections retain provenance and approval fails closed on unresolved scope/evidence",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  const comparison=await service.create({clientId:"client-disposable",baselineEstimateId:"estimate-r2",proposals:[
    {supplierName:"Supplier A",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-a"}],items:[{supplierItemReference:"A01",canonicalEstimatePositionId:"position-a",relationshipKind:"exact",differenceStatus:"review_required"}]},
    {supplierName:"Supplier B",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-b"}],items:[{supplierItemReference:"B01",canonicalEstimatePositionId:"position-b",relationshipKind:"exact",differenceStatus:"review_required"}]},
  ]});
  await assert.rejects(()=>service.approve(comparison.id),(error)=>error.code==="comparison_review_required");
  let updated=comparison;
  for(const [proposalIndex,proposal] of updated.proposals.entries())for(const mapping of proposal.positionMappings)updated=await service.correctMapping(comparison.id,mapping.id,{canonicalEstimatePositionId:mapping.canonicalEstimatePositionId,relationshipKind:proposalIndex===0?"grouped":"split",differenceStatus:proposalIndex===0?"minor_difference":"exact_match",differences:proposalIndex===0?[{field:"finish",baseline:"white",supplier:"cream",note:"Staff accepted the source-backed finish variance."}]:[]},"reviewer-2");
  const approved=await service.approve(comparison.id,"reviewer-2");assert.equal(approved.status,"approved");assert.equal(approved.proposals[0].positionMappings[0].correctedBy,"reviewer-2");
  assert.equal(approved.proposals[0].positionMappings[0].relationshipKind,"grouped");assert.equal(approved.proposals[1].positionMappings[0].relationshipKind,"split");assert.match(approved.proposals[0].positionMappings[0].differences[0].note,/source-backed finish variance/);
  const events=await db.all("SELECT event_type FROM quote_comparison_audit_events WHERE comparison_id=? ORDER BY created_at",comparison.id);assert.ok(events.some((event)=>event.event_type==="mapping.corrected"));
  await assert.rejects(()=>service.correctMapping(comparison.id,approved.proposals[0].positionMappings[0].id,{differenceStatus:"minor_difference"}),error=>error.code==="comparison_immutable");
});

test("proposal documents and canonical Position mappings cannot cross Client or baseline boundaries",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db),now=new Date().toISOString();
  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,commercial_lifecycle,reference_namespace,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)","other","Other","o@example.com","Other","TEST-CL-002","prospect","test",now,now);
  await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,document_type,file_name,mime_type,size_bytes,folder_path,trashed,discovered_at,last_seen_at,updated_at) VALUES('doc-other','google_drive','account','other-file','other','supplier_proposal','other.pdf','application/pdf',1,'Other',0,?,?,?)`,now,now,now);
  const base={clientId:"client-disposable",baselineEstimateId:"estimate-r2",proposals:[{supplierName:"A",documents:[{canonicalDocumentId:"doc-a"}],items:[]},{supplierName:"B",documents:[{canonicalDocumentId:"doc-b"}],items:[]}]};
  await assert.rejects(()=>service.create({...base,proposals:[base.proposals[0],{...base.proposals[1],documents:[{canonicalDocumentId:"doc-other"}]}]}),error=>error.code==="comparison_document_scope_mismatch");
  await assert.rejects(()=>service.create({...base,proposals:[{...base.proposals[0],items:[{supplierItemReference:"x",canonicalEstimatePositionId:"not-baseline"}]},base.proposals[1]]}),error=>error.code==="comparison_position_scope_mismatch");
});

test("manufacturer/system library retains certificate and drawing version evidence without copying files",async t=>{
  const {db}=await fixture(t),service=createManufacturerDocumentLibraryService(db);
  const certificate=await service.create({ownerKind:"manufacturer",ownerName:"Maker A",productSystemName:"System 92",category:"certificate",subcategory:"Thermal",title:"Thermal test",documentFormat:"PDF",canonicalDocumentId:"doc-a",versionLabel:"v1",issueDate:"2026-01-01",jurisdiction:"UK",applicability:{glass:"triple"}},"admin-1");
  const drawing=await service.create({ownerKind:"manufacturer",ownerName:"Maker A",productSystemName:"System 92",category:"system_drawing",subcategory:"Threshold",title:"Threshold detail",documentFormat:"DWG",canonicalDocumentId:"doc-a-tech",versionLabel:"A"},"admin-1");
  assert.equal((await service.list({category:"certificate"}))[0].subcategory,"Thermal");assert.equal(drawing.documentFormat,"DWG");
  const superseded=await service.supersede(certificate.id,{canonicalDocumentId:"doc-b",documentFormat:"PDF",versionLabel:"v2",issueDate:"2026-08-01"},"admin-2");
  assert.equal(superseded.previous.status,"superseded");assert.equal(superseded.replacement.status,"active");
  const link=await service.linkToProject(drawing.id,"project-disposable","customer_approved","admin-2",{positionIds:["position-a"]});assert.equal(link.portalVisibility,"customer_approved");
  assert.equal((await db.get("SELECT COUNT(*) count FROM canonical_documents")).count,3,"library metadata must not duplicate provider-backed binaries");
});

test("production-style API routes persist comparison and document-library records",async t=>{
  const {db}=await fixture(t),app=express();app.use(express.json());app.use("/api/quote-comparisons",createQuoteComparisonsRouter({databasePromise:Promise.resolve(db)}));app.use("/api/admin/manufacturer-documents",createManufacturerDocumentsRouter({databasePromise:Promise.resolve(db)}));
  const server=app.listen(0,"127.0.0.1");t.after(()=>new Promise(resolve=>server.close(resolve)));await new Promise(resolve=>server.once("listening",resolve));const address=server.address();assert.ok(address&&typeof address==="object");const base=`http://127.0.0.1:${address.port}`;
  const comparisonResponse=await fetch(`${base}/api/quote-comparisons`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:"client-disposable",baselineEstimateId:"estimate-r2",proposals:[{supplierName:"A",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-a",documentRole:"commercial"}],items:[]},{supplierName:"B",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-b",documentRole:"commercial"}],items:[]}]})});assert.equal(comparisonResponse.status,201);assert.equal((await comparisonResponse.json()).proposals.length,2);
  const documentResponse=await fetch(`${base}/api/admin/manufacturer-documents`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ownerKind:"manufacturer",ownerName:"Maker",productSystemName:"System",category:"certificate",subcategory:"Security",title:"Security certificate",documentFormat:"PDF",canonicalDocumentId:"doc-a"})});assert.equal(documentResponse.status,201);assert.equal((await documentResponse.json()).subcategory,"Security");
  const sources=await(await fetch(`${base}/api/admin/manufacturer-documents/canonical-sources`)).json();assert.equal(sources.length,3);
});
