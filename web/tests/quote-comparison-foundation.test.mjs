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

test("Client workspace owns extraction-first Compare Quotes and governed Portal entry",async()=>{
  const tabs=await readFile(new URL("../src/features/estimatePicker/EstimatePickerTabs.tsx",import.meta.url),"utf8");
  const workspace=await readFile(new URL("../src/features/quoteComparisons/CompareQuotesWorkspace.tsx",import.meta.url),"utf8");
  assert.match(tabs,/estimatePickerTab === "compare_quotes"[\s\S]*Compare Quotes/);
  assert.match(tabs,/CompareQuotesWorkspace client=\{pickerClient\}/);
  assert.match(tabs,/estimatePickerTab === "portal_preview"[\s\S]*Portal Preview/);
  assert.match(tabs,/ClientPortalPreview client=\{pickerClient\}/);
  assert.match(workspace,/Baseline \/ source of truth/);assert.match(workspace,/Add competitor quotation/);assert.match(workspace,/Upload & Analyse/);assert.match(workspace,/Advanced \/ manual correction/);
  const results=await readFile(new URL("../src/features/quoteComparisons/ComparisonResults.tsx",import.meta.url),"utf8");
  assert.match(results,/Comparison Report/);assert.match(results,/Review Exceptions/);assert.match(results,/Advanced Mapping/);assert.match(results,/Project overview/);
  assert.match(results,/Drawing/);assert.match(results,/What is offered/);assert.match(results,/Position conclusion/);assert.match(results,/Image unavailable/);assert.doesNotMatch(results,/Overall Recommendations|Best value/);
  const print=await readFile(new URL("../src/features/quoteComparisons/ComparisonPrintDocument.tsx",import.meta.url),"utf8");
  assert.match(results,/Print \/ Save PDF/);assert.match(results,/comparison\.status === "draft_review_required".*Approve comparison/);
  assert.match(print,/approval is not required to print/);assert.match(print,/report\.sourceReferences/);assert.match(print,/packPositions\(report\.positions\)/);assert.match(print,/supplier\.commercial\.netSupply/);assert.match(print,/Image unavailable/);assert.match(print,/data-print-overview="3"/);assert.doesNotMatch(print,/Overall recommendations|Top 3|Best value|buildQuoteComparisonReport|rankingTuple|deriveProjectCosting/);
  assert.match(results,/resolveManufacturerVisualAssetUrl\(drawing\.url\)/);assert.match(print,/resolveManufacturerVisualAssetUrl\(drawing\.url\)/);
  assert.match(workspace,/sourceVisuals:row\.sourceVisuals/);assert.match(workspace,/sourceAttachmentId:document\.attachmentId/);
  assert.doesNotMatch(workspace,/Create Draft Comparison/);
});

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-comparison-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,client_ref TEXT,commercial_lifecycle TEXT,reference_namespace TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_ref TEXT,base_estimate_ref TEXT,revision_no INTEGER,status TEXT,outcome TEXT NOT NULL DEFAULT 'Open',positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE integration_provider_config(provider TEXT PRIMARY KEY,enquiries_root_folder_id TEXT);
    CREATE TABLE drive_discovered_documents(id TEXT PRIMARY KEY,enquiry_id TEXT);
    CREATE TABLE project_calculator_lab_scenarios(id TEXT PRIMARY KEY,estimate_id TEXT,revision_number INTEGER,updated_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_name TEXT,supplier_code TEXT);
    CREATE TABLE supplier_quote_revisions(id TEXT PRIMARY KEY,supplier_quote_id TEXT,estimate_id TEXT);
    CREATE TABLE supplier_quote_attachments(id TEXT PRIMARY KEY,revision_id TEXT,estimate_id TEXT,original_file_name TEXT,media_type TEXT,sha256 TEXT);
  `);
  await initializeCommercialIdentitySchema(db);await initializeQuoteComparisonSchema(db);
  const now="2026-09-06T10:00:00.000Z",positions=[{id:"position-a",positionRef:"001",roomName:"Kitchen",qty:1,widthMm:1200,heightMm:1400},{id:"position-b",positionRef:"002",roomName:"Hall",qty:2,widthMm:900,heightMm:2100}];
  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,commercial_lifecycle,reference_namespace,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)","client-disposable","Disposable Client","test@example.com","Extension","TEST-CL-001","prospect","test",now,now);
  await db.run("INSERT INTO projects(id,client_id,name,status,created_at,updated_at) VALUES(?,?,?,?,?,?)","project-disposable","client-disposable","Extension","active",now,now);
  await db.run("INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,outcome,positions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)","estimate-r2","client-disposable","project-disposable","TEST-EST-001-R2","TEST-EST-001",2,"Draft","Open",JSON.stringify(positions),now,now);
  await db.run("INSERT INTO project_calculator_lab_scenarios(id,estimate_id,revision_number,updated_at) VALUES(?,?,?,?)","scenario-r2","estimate-r2",4,now);
  for(const [id,name] of [["doc-a","supplier-a.pdf"],["doc-a-tech","supplier-a-spec.docx"],["doc-b","supplier-b.pdf"]])await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,mime_type,size_bytes,folder_path,trashed,discovered_at,last_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,id,"google_drive","account",`provider-${id}`,"client-disposable","project-disposable","supplier_proposal",name,name.endsWith("pdf")?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",100,"Clients/Disposable",now,now,now);
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});return {db,positions};
}

test("active canonical Estimate is selected automatically and one competitor is sufficient",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db),baseline=await service.resolveAutomaticBaseline("client-disposable","project-disposable");
  assert.equal(baseline.status,"canonical_baseline_detected");assert.equal(baseline.baseline.estimateId,"estimate-r2");assert.equal(baseline.baseline.positionCount,2);
  const comparison=await service.create({clientId:"client-disposable",baselineEstimateId:baseline.baseline.estimateId,baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[{supplierName:"Supplier A",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-a"}],items:[{supplierItemReference:"001",supplierItemSnapshot:{sourceOccurrence:1},quantity:1,widthMm:1200,heightMm:1400},{supplierItemReference:"001",supplierItemSnapshot:{sourceOccurrence:2},quantity:1,widthMm:800,heightMm:900}]}]},"reviewer-1");
  assert.equal(comparison.proposals.length,1);assert.equal(comparison.proposals[0].positionMappings.some(item=>item.canonicalEstimatePositionId==="position-a"),true);
  assert.equal(comparison.baselineSnapshot.customerCommercial.kind,"current_project_costing");assert.equal(comparison.baselineSnapshot.customerCommercial.customerSellingExVatGbp,"14500.00");assert.equal(Object.hasOwn(comparison.baselineSnapshot.customerCommercial,"supplierPurchaseCost"),false);
  assert.equal(comparison.proposals[0].positionMappings.some(item=>item.relationshipKind==="missing"&&item.canonicalEstimatePositionId==="position-b"),true);
  assert.equal(comparison.proposals[0].positionMappings.filter(item=>item.supplierItemReference==="001").length,2,"repeated source item references remain separate evidence occurrences");
});

test("comparison freezes the selected Estimate revision and supports multi-document proposal packages",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  const comparison=await service.create({clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[
    {supplierName:"Supplier A",manufacturerName:"Maker A",quotationNumber:"A-10",quotationRevision:"2",scopeKind:"supply_only",currency:"EUR",originalTotalAmount:"10000",documents:[{canonicalDocumentId:"doc-a",documentRole:"commercial"},{canonicalDocumentId:"doc-a-tech",documentRole:"technical"}],items:[{supplierItemReference:"A01",canonicalEstimatePositionId:"position-a",relationshipKind:"exact",differenceStatus:"review_required"}]},
    {supplierName:"Supplier B",manufacturerName:"Maker B",quotationNumber:"B-20",scopeKind:"supply_only",currency:"GBP",originalTotalAmount:"9200",documents:[{canonicalDocumentId:"doc-b",documentRole:"commercial"}],items:[{supplierItemReference:"B/1",canonicalEstimatePositionId:null,relationshipKind:"unmapped",differenceStatus:"review_required"}]},
  ]},"reviewer-1");
  const supplierA=comparison.proposals.find((proposal)=>proposal.supplierName==="Supplier A");
  assert.equal(comparison.status,"draft_review_required");assert.equal(comparison.proposals.length,2);assert.equal(supplierA.documents.length,2);
  assert.equal(comparison.baselineSnapshot.positions[0].id,"position-a");assert.equal(supplierA.positionMappings.some(mapping=>mapping.supplierItemReference==="A01"),true);
  await db.run("UPDATE estimates SET positions_json='[]',revision_no=3 WHERE id='estimate-r2'");
  const retained=await service.get(comparison.id);assert.equal(retained.baselineEstimateRevision,2);assert.equal(retained.baselineSnapshot.positions.length,2);assert.equal(retained.projectName,"Extension");
});

test("comparison rejects supplier purchase evidence as a customer commercial baseline",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  await assert.rejects(()=>service.create({clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"supplier_quotation",supplierPurchaseCost:"9000"},proposals:[{supplierName:"Supplier A",documents:[{canonicalDocumentId:"doc-a"}],items:[]}]}),error=>error.code==="comparison_customer_baseline_required");
});

test("unresolved extracted rows do not become unsupported missing-position assertions",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  const comparison=await service.create({clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[{supplierName:"Sparse Supplier",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-a"}],items:[{supplierItemReference:"Unknown item",supplierItemSnapshot:{product:"Window"}}]}]});
  const generated=comparison.proposals[0].positionMappings.filter(mapping=>mapping.supplierItemSnapshot.generatedFromBaseline);
  assert.equal(generated.length,2);assert.ok(generated.every(mapping=>mapping.differenceStatus==="review_required"));assert.ok(generated.every(mapping=>mapping.relationshipKind==="unmapped"));
});

test("staff mapping corrections retain provenance and approval fails closed on unresolved scope/evidence",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  const comparison=await service.create({clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[
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
  const base={clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[{supplierName:"A",documents:[{canonicalDocumentId:"doc-a"}],items:[]},{supplierName:"B",documents:[{canonicalDocumentId:"doc-b"}],items:[]}]};
  await assert.rejects(()=>service.create({...base,proposals:[base.proposals[0],{...base.proposals[1],documents:[{canonicalDocumentId:"doc-other"}]}]}),error=>error.code==="comparison_document_scope_mismatch");
  await assert.rejects(()=>service.create({...base,proposals:[{...base.proposals[0],items:[{supplierItemReference:"x",canonicalEstimatePositionId:"not-baseline"}]},base.proposals[1]]}),error=>error.code==="comparison_position_scope_mismatch");
});

test("comparison records support naming, draft copy, archive/restore and governed deletion",async t=>{
  const {db}=await fixture(t),service=createQuoteComparisonService(db);
  const comparison=await service.create({name:"September supplier review",description:"Initial evidence",clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[{supplierName:"Supplier A",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-a"}],items:[{supplierItemReference:"001",canonicalEstimatePositionId:"position-a",relationshipKind:"exact",differenceStatus:"exact_match"}]}]});
  assert.equal(comparison.name,"September supplier review");
  const renamed=await service.updateDetails(comparison.id,{name:"10 Supplier Comparison — September 2026"},"reviewer");assert.equal(renamed.name,"10 Supplier Comparison — September 2026");
  const copied=await service.copy(comparison.id,"reviewer");assert.notEqual(copied.id,comparison.id);assert.equal(copied.status,"draft_review_required");assert.equal(copied.proposals.length,1);assert.match(copied.name,/Copy/);
  const archived=await service.setArchived(comparison.id,true,"reviewer");assert.ok(archived.archivedAt);
  const restored=await service.setArchived(comparison.id,false,"reviewer");assert.equal(restored.archivedAt,null);
  const removed=await service.remove(copied.id,"reviewer");assert.equal(removed.deleted,true);assert.equal(await service.get(copied.id),null);
  let approved=comparison;for(const mapping of approved.proposals[0].positionMappings)approved=await service.correctMapping(comparison.id,mapping.id,{canonicalEstimatePositionId:mapping.canonicalEstimatePositionId,relationshipKind:mapping.relationshipKind,differenceStatus:mapping.differenceStatus});approved=await service.approve(comparison.id,"reviewer");
  await assert.rejects(()=>service.remove(approved.id,"reviewer"),error=>error.code==="comparison_delete_forbidden");
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
  const baselineResponse=await fetch(`${base}/api/quote-comparisons/baseline?client_id=client-disposable&project_id=project-disposable`);assert.equal(baselineResponse.status,200);assert.equal((await baselineResponse.json()).baseline.estimateId,"estimate-r2");
  const comparisonResponse=await fetch(`${base}/api/quote-comparisons`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:"client-disposable",baselineEstimateId:"estimate-r2",baselineCommercial:{kind:"current_project_costing",scenarioId:"scenario-r2",customerSellingExVatGbp:"14500.00",vatGbp:"2900.00",totalIncVatGbp:"17400.00"},proposals:[{supplierName:"A",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-a",documentRole:"commercial"}],items:[]},{supplierName:"B",scopeKind:"supply_only",documents:[{canonicalDocumentId:"doc-b",documentRole:"commercial"}],items:[]}]})});assert.equal(comparisonResponse.status,201);assert.equal((await comparisonResponse.json()).proposals.length,2);
  const documentResponse=await fetch(`${base}/api/admin/manufacturer-documents`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ownerKind:"manufacturer",ownerName:"Maker",productSystemName:"System",category:"certificate",subcategory:"Security",title:"Security certificate",documentFormat:"PDF",canonicalDocumentId:"doc-a"})});assert.equal(documentResponse.status,201);assert.equal((await documentResponse.json()).subcategory,"Security");
  const sources=await(await fetch(`${base}/api/admin/manufacturer-documents/canonical-sources`)).json();assert.equal(sources.length,3);
});
