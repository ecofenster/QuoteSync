import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createCommunicationRepository } from "../server/features/communications/communicationRepository.js";
import { communicationAttachmentRecordId, createCommunicationsService, findRelationshipSuggestions, preserveCommunicationLinks, resolveCanonicalRelationship, resolveMailboxCapabilities } from "../server/features/communications/communicationsService.js";
import { GMAIL_MODIFY_SCOPE } from "../server/features/integrations/googleWorkspaceService.js";
import { createHash } from "node:crypto";

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-communication-links-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,deleted_at TEXT,client_ref TEXT);
    CREATE TABLE enquiries(id TEXT PRIMARY KEY,enquiry_ref TEXT,display_name TEXT,email TEXT,status TEXT,deleted_at TEXT);
    CREATE TABLE projects(id TEXT PRIMARY KEY,client_id TEXT,name TEXT,deleted_at TEXT,context_year INTEGER);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_ref TEXT,outcome TEXT,deleted_at TEXT,created_at TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY,order_ref TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_code TEXT,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_revisions(id TEXT PRIMARY KEY,supplier_quote_id TEXT,estimate_id TEXT,full_quotation_reference TEXT);
    CREATE TABLE supplier_commercial_defaults(supplier_code TEXT PRIMARY KEY,supplier_name TEXT,active INTEGER);
    CREATE TABLE communication_messages(
      id TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_message_id TEXT,provider_thread_id TEXT,mailbox_id TEXT,direction TEXT NOT NULL,folder TEXT NOT NULL,status TEXT NOT NULL,
      from_json TEXT NOT NULL,to_json TEXT NOT NULL,cc_json TEXT NOT NULL,bcc_json TEXT NOT NULL,subject TEXT NOT NULL,body_html TEXT NOT NULL,body_text TEXT NOT NULL,
      in_reply_to_provider_message_id TEXT,links_json TEXT NOT NULL,error_message TEXT,sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,provider_state_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE communication_attachments(id TEXT PRIMARY KEY,communication_message_id TEXT NOT NULL,file_name TEXT NOT NULL,media_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,storage_key TEXT,provider_attachment_id TEXT,drive_file_id TEXT,sha256 TEXT,created_at TEXT NOT NULL,content_id TEXT,is_inline INTEGER NOT NULL DEFAULT 0);
  `);
  await db.run("INSERT INTO clients VALUES(?,?,?,NULL,?)","client-1","Exact Client","exact.client@example.test","EF-CL-028");
  await db.run("INSERT INTO enquiries VALUES(?,?,?,?,?,NULL)","enquiry-1","EF-ENQ-012","Exact Enquiry","exact.client@example.test","new");
  await db.run("INSERT INTO projects VALUES(?,?,?,NULL,?)","project-1","client-1","Exact Project",2026);
  await db.run("INSERT INTO estimates VALUES(?,?,?,?,?,NULL,?)","estimate-1","client-1","project-1","EF-EST-2026-041","Order","2026-08-26T10:00:00.000Z");
  await db.run("INSERT INTO orders VALUES(?,?)","order-1","EF-ORD-2026-003");
  await db.run("INSERT INTO supplier_commercial_defaults VALUES(?,?,0)","ZYLE","Zyle Fenster");
  await db.run("INSERT INTO supplier_commercial_defaults VALUES(?,?,1)","FACTORY PRICE","Any");
  await db.run("INSERT INTO supplier_quotes VALUES(?,?,?,?,NULL)","quote-1","estimate-1","ZYLE","Zyle Fenster");
  await db.run("INSERT INTO supplier_quote_revisions VALUES(?,?,?,?)","revision-1","quote-1","estimate-1","343718-1");
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return db;
}

const providerMessage=(links=[])=>({id:"message-local-1",provider:"google_workspace",providerMessageId:"provider-message-1",threadId:"thread-1",mailboxId:"me",direction:"inbound",folder:"inbox",status:"received",from:["Exact Client <exact.client@example.test>"],to:["sales@example.test"],cc:[],bcc:[],subject:"EF-ENQ-012 · EF-EST-2026-041 · EF-ORD-2026-003 · quotation 343718-1",bodyHtml:"<p>Fixture only</p>",bodyText:"EF-ENQ-012 EF-EST-2026-041 EF-ORD-2026-003 quotation 343718-1",links,error:null,sentAt:"2026-08-26T12:00:00.000Z",attachments:[]});

test('changed retained provider attachment blocks before Gmail send or draft mutation',async t=>{
  const db=await fixture(t),repository=createCommunicationRepository(db),original=Buffer.from('Reviewed document'),revised=Buffer.from('Replaced document');let sends=0;
  const draft={...providerMessage(),id:'reviewed-draft',provider:'quotesuite_preview',direction:'outbound',folder:'drafts',status:'draft',sentAt:null,attachments:[{id:'reviewed-attachment',fileName:'Reviewed.pdf',mediaType:'application/pdf',driveFileId:'same-provider-id',sha256:createHash('sha256').update(original).digest('hex'),sizeBytes:original.length}]};await repository.save(draft);
  const service=createCommunicationsService(db,{deliveryPolicy:{assertAllRecipients(){}},workspace:{status:async()=>({connected:true,capabilities:{gmail:{available:true}}}),googleFetch:async()=>new Response(revised)},gmail:{send:async()=>{sends++;throw new Error('Must not send')}}});
  const before=await repository.get(draft.id);
  await assert.rejects(()=>service.sendMessage(before),error=>error.code==='communication_attachment_changed');
  assert.equal(sends,0);assert.deepEqual(await repository.get(draft.id),before);
});

test("provider enrichment preserves explicit canonical links",async t=>{
  const db=await fixture(t),repository=createCommunicationRepository(db),clientLink={kind:"client",id:"client-1"};
  await repository.save(providerMessage([clientLink]));
  const existing=await repository.findByProviderId("google_workspace","provider-message-1"),links=preserveCommunicationLinks(existing,providerMessage([]));
  assert.deepEqual(links,[clientLink]);
  await repository.save({...providerMessage([]),links});
  assert.deepEqual((await repository.get("message-local-1")).links,[clientLink]);
  await repository.addLink("message-local-1",{kind:"estimate",id:"estimate-1"});
  await repository.addLink("message-local-1",{kind:"estimate",id:"estimate-1"});
  assert.deepEqual((await repository.get("message-local-1")).links,[clientLink,{kind:"estimate",id:"estimate-1"}]);
  await repository.removeLink("message-local-1",clientLink);
  assert.deepEqual((await repository.get("message-local-1")).links,[{kind:"estimate",id:"estimate-1"}]);
});

test("mailbox summaries count downloadable files without counting inline CID resources",async t=>{
  const db=await fixture(t),repository=createCommunicationRepository(db);
  await repository.save({...providerMessage(),attachments:[{id:"inline-logo",fileName:"logo.png",mediaType:"image/png",providerAttachmentId:"inline-provider",contentId:"logo-1",inline:true},{id:"quotation",fileName:"quotation.pdf",mediaType:"application/pdf",providerAttachmentId:"file-provider",inline:false}]});
  const full=await repository.get("message-local-1"),summary=(await repository.listSummaries({limit:10}))[0];
  assert.equal(full.attachments.length,2);assert.equal(full.attachmentCount,1);assert.equal(summary.attachmentCount,1);
});

test("exact evidence produces conservative canonical suggestions without auto-linking",async t=>{
  const db=await fixture(t),suggestions=await findRelationshipSuggestions(db,providerMessage());
  assert.deepEqual(new Set(suggestions.map(item=>item.kind)),new Set(["enquiry","client","project","estimate","order","supplier","supplier_quotation"]));
  assert.ok(suggestions.every(item=>item.autoLinkAllowed===false));
  assert.equal((await resolveCanonicalRelationship(db,"client","client-1")).id,"client-1");
  assert.equal((await resolveCanonicalRelationship(db,"enquiry","enquiry-1")).id,"enquiry-1");
  assert.equal((await resolveCanonicalRelationship(db,"project","project-1")).id,"project-1");
  assert.ok(suggestions.some(item=>item.kind==="order"&&item.id==="order-1"&&item.label==="EF-ORD-2026-003"));
  assert.equal((await resolveCanonicalRelationship(db,"order","order-1")).id,"order-1");
  assert.equal((await resolveCanonicalRelationship(db,"order","estimate-1")).id,"estimate-1");
  assert.equal((await resolveCanonicalRelationship(db,"supplier","ZYLE")).id,"ZYLE");
  assert.equal(await resolveCanonicalRelationship(db,"supplier","FACTORY PRICE"),undefined);
  assert.equal(await resolveCanonicalRelationship(db,"order","missing"),undefined);
});

test("mutating mailbox capabilities follow the persisted gmail.modify grant",()=>{
  const ids=["archive","trash","read_state","star","move","labels"];
  const before=resolveMailboxCapabilities({connected:true,scopes:["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.compose"]});
  assert.deepEqual(before.map(item=>item.id),ids);assert.ok(before.every(item=>item.available===false));
  const after=resolveMailboxCapabilities({connected:true,scopes:["https://www.googleapis.com/auth/gmail.readonly",GMAIL_MODIFY_SCOPE]});assert.ok(after.every(item=>item.available===true));
  const disconnected=resolveMailboxCapabilities({connected:false,scopes:[GMAIL_MODIFY_SCOPE]});assert.ok(disconnected.every(item=>item.available===false));
});

test("Link existing resolves EF-CL reference, exposes the full picker without a suggestion dependency, and files only after reviewed storage succeeds",async t=>{
  const db=await fixture(t);let providerRead=0,currentProviderDocumentId="";
  await db.exec(`CREATE TABLE supplier_enquiry_drafts(id TEXT PRIMARY KEY,project_id TEXT,estimate_id TEXT,supplier_id TEXT,recipient TEXT,subject TEXT,status TEXT,revision_no INTEGER,created_at TEXT);
    CREATE TABLE manufacturer_response_links(id TEXT PRIMARY KEY,project_id TEXT,estimate_id TEXT,supplier_enquiry_id TEXT,communication_message_id TEXT,canonical_document_id TEXT,status TEXT,created_by TEXT,created_at TEXT,UNIQUE(project_id,communication_message_id,canonical_document_id));
    CREATE TABLE workflow_events(id TEXT PRIMARY KEY,event_name TEXT,evidence_id TEXT,occurred_at TEXT,links_json TEXT,created_at TEXT,UNIQUE(event_name,evidence_id));
    INSERT INTO supplier_enquiry_drafts VALUES('supplier-rfq-1','project-1','estimate-1','ZYLE','factory@example.test','Request for quotation','sent',1,'2026-08-25T10:00:00.000Z');
    INSERT INTO supplier_enquiry_drafts VALUES('supplier-rfq-wrong','project-1','other-estimate','ZYLE','factory@example.test','Different Estimate request','sent',1,'2026-08-25T09:00:00.000Z');`);
  await db.exec(`ALTER TABLE supplier_enquiry_drafts ADD COLUMN revision_request_id TEXT;
    ALTER TABLE supplier_enquiry_drafts ADD COLUMN response_state TEXT DEFAULT 'outstanding';
    ALTER TABLE supplier_enquiry_drafts ADD COLUMN received_at TEXT;
    ALTER TABLE supplier_enquiry_drafts ADD COLUMN followup_due_at TEXT;
    ALTER TABLE supplier_enquiry_drafts ADD COLUMN followup_failure TEXT DEFAULT '';
    ALTER TABLE supplier_enquiry_drafts ADD COLUMN updated_at TEXT;
    CREATE TABLE supplier_revision_requests(id TEXT PRIMARY KEY,workflow_state TEXT,received_at TEXT,updated_at TEXT);
    INSERT INTO supplier_revision_requests VALUES('parent-revision','sent_to_supplier',NULL,NULL);
    UPDATE supplier_enquiry_drafts SET revision_request_id='parent-revision',followup_due_at='2026-09-20T10:00:00Z' WHERE id='supplier-rfq-1';`);
  const providerDocument=()=>{providerRead+=1;currentProviderDocumentId=`ANGjdJ-${String(providerRead).padEnd(418,"x")}`;return{...providerMessage(),from:["Viktorija <info@zylefenster.com>"],subject:"Ats.: EF-CL-028: Stuart Gilks",bodyText:"Please see attached.",attachments:[
    {sourcePartId:"0.1",fileName:"image.png",mediaType:"image/png",sizeBytes:1240,providerAttachmentId:`ANGjdJ-${String(providerRead).padEnd(396,"i")}`,contentId:"ii_1a07b70b3b8cb971f161",inline:true},
    {sourcePartId:"1",fileName:"EF-CL-028 Stuart Gilks, Ecotherm +.docx",mediaType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",sizeBytes:115091,providerAttachmentId:currentProviderDocumentId,contentId:null,inline:false},
  ]}};
  const workspace={async status(){return{connected:true,scopes:[],capabilities:{gmail:{available:true},drive:{available:true}}}}};
  let filed=null;
  const drive={async storeCommunicationSupplierDocument(input){filed=input;return{status:"stored",duplicate:false,documentId:"document-1",providerFileId:"provider-file-1",fileName:"EF-CL-028 Stuart Gilks, Ecotherm +.docx",folderPath:"2026/EF-CL-028 - Exact Client/Exact Project/Estimates/EF-EST-2026-041/Suppliers/Zyle Fenster",webViewLink:"https://drive.invalid/document-1"}}};
  const service=createCommunicationsService(db,{workspace,gmail:{async readMessage(){return providerDocument()},async attachment(messageId,attachmentId){assert.equal(messageId,"provider-message-1");assert.equal(attachmentId,currentProviderDocumentId);return Buffer.from("genuine")}},drive,environment:{}});
  const options=await service.assignmentOptions("provider-message-1");
  assert.equal(options.reference,"EF-CL-028");assert.equal(options.proposed.clientId,"client-1");assert.equal(options.proposed.projectId,"project-1");assert.equal(options.proposed.estimateId,"estimate-1");assert.equal(options.proposed.supplierId,"ZYLE");assert.equal(options.proposed.supplierEnquiryId,"supplier-rfq-1");assert.equal(options.attachments.length,1);assert.equal(options.attachments[0].fileName,"EF-CL-028 Stuart Gilks, Ecotherm +.docx");assert.equal(options.proposed.attachmentId,options.attachments[0].id);assert.equal(options.attachments[0].id,communicationAttachmentRecordId(options.communicationMessageId,{sourcePartId:"1"},1));assert.ok(options.conflicts.some(item=>item.code==="client_name_variance"));
  await assert.rejects(()=>service.assignSupplierDocument("provider-message-1",{...options.proposed,attachmentId:"obsolete-provider-derived-selection",conflictsReviewed:true}),error=>error.code==="communication_assignment_attachment_stale"&&error.details.eligibleFileNames[0]==="EF-CL-028 Stuart Gilks, Ecotherm +.docx");
  await assert.rejects(()=>service.assignSupplierDocument("provider-message-1",{...options.proposed,supplierEnquiryId:"supplier-rfq-wrong",attachmentId:options.attachments[0].id,conflictsReviewed:true}),error=>error.code==="communication_assignment_supplier_enquiry_conflict");
  await assert.rejects(()=>service.assignSupplierDocument("provider-message-1",{...options.proposed,supplierId:"ZYLE",attachmentId:options.attachments[0].id}),/review the reference conflict/i);
  await db.exec("CREATE TRIGGER fail_response_state BEFORE UPDATE ON supplier_enquiry_drafts BEGIN SELECT RAISE(ABORT,'test interrupted response projection'); END");
  await assert.rejects(()=>service.assignSupplierDocument("provider-message-1",{...options.proposed,supplierId:"ZYLE",attachmentId:options.attachments[0].id,conflictsReviewed:true}),error=>error.code==='communication_assignment_partial_success'&&error.details.documentId==='document-1');
  await db.exec('DROP TRIGGER fail_response_state');
  const result=await service.assignSupplierDocument("provider-message-1",{...options.proposed,supplierId:"ZYLE",attachmentId:options.attachments[0].id,conflictsReviewed:true});
  const requestState=await db.get("SELECT * FROM supplier_enquiry_drafts WHERE id='supplier-rfq-1'");
  assert.equal(requestState.response_state,'revised_document_received');assert.equal(requestState.followup_due_at,null);assert.ok(requestState.received_at);
  assert.equal((await db.get("SELECT workflow_state FROM supplier_revision_requests WHERE id='parent-revision'")).workflow_state,'revised_document_received');
  assert.equal(result.manufacturerResponse.idempotentReplay,true);
  assert.ok(providerRead>=5);assert.equal(Buffer.from(filed.bytes).toString(),"genuine");assert.equal(filed.communicationAttachmentId,options.attachments[0].id);assert.equal(filed.providerAttachmentId,currentProviderDocumentId);assert.equal(result.fileName,"EF-CL-028 Stuart Gilks, Ecotherm +.docx");assert.equal(result.providerFileId,"provider-file-1");assert.equal(result.navigation.openFilesLabel,"Open Files");assert.equal(result.navigation.importLabel,"Import Manufacturer Estimate");assert.equal(result.manufacturerResponse.supplierEnquiryId,"supplier-rfq-1");assert.equal(result.manufacturerResponse.event,"supplier.quote_returned");assert.equal((await db.get("SELECT COUNT(*) count FROM manufacturer_response_links")).count,1);assert.equal((await db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name='supplier.quote_returned'")).count,1);
  assert.deepEqual(new Set(result.links.map(item=>item.kind)),new Set(["client","project","estimate","supplier"]));
});

test("saved communication documents hand off the exact provider file to the selected working Estimate review",async t=>{
  const db=await fixture(t);
  await db.exec("CREATE TABLE canonical_documents(id TEXT PRIMARY KEY,provider_file_id TEXT,estimate_id TEXT,supplier_id TEXT,file_name TEXT,mime_type TEXT,size_bytes INTEGER,document_type TEXT,removed_at TEXT,trashed INTEGER)");
  await db.run("INSERT INTO canonical_documents VALUES('document-1','provider-file-1','estimate-1','ZYLE','Zyle quotation.pdf','application/pdf',17,'supplier_quotation',NULL,0)");
  let staged=null,providerReads=0;
  const workspace={async status(){return{connected:true,capabilities:{drive:{available:true}}}},async googleFetch(url){providerReads+=1;assert.match(String(url),/provider-file-1.*alt=media/);return new Response(Buffer.from('%PDF-1.4\nfixture'),{status:200})}};
  const supplierQuotes={async stageCanonicalDocumentForReview(input){staged=input;return{review:{documents:[{attachmentId:"attachment-1"}]}}}};
  const service=createCommunicationsService(db,{workspace,supplierQuotes,environment:{}}),result=await service.prepareAssignedDocumentImport("document-1","estimate-1");
  assert.equal(providerReads,1);assert.equal(staged.canonicalDocumentId,"document-1");assert.equal(staged.estimateId,"estimate-1");assert.equal(staged.supplierCode,"ZYLE");assert.equal(staged.fileName,"Zyle quotation.pdf");assert.equal(Buffer.from(staged.bytes).toString(),'%PDF-1.4\nfixture');assert.equal(result.review.documents[0].attachmentId,"attachment-1");
  await assert.rejects(()=>service.prepareAssignedDocumentImport("document-1","other-estimate"),error=>error.code==="canonical_supplier_document_not_found");
});

test("Email Enquiry intake requires an explicit existing-record decision and can link without creating a duplicate",async t=>{
  const db=await fixture(t),message={...providerMessage(),subject:"EF-CL-028: Different Client Name",bodyText:"Please quote a new phase."};
  const workspace={async status(){return{connected:true,capabilities:{gmail:{available:true}}}}};
  const service=createCommunicationsService(db,{workspace,gmail:{async readMessage(){return message}},environment:{}});
  const draft=await service.enquiryIntake("provider-message-1");
  assert.ok(draft.likelyMatches.some(item=>item.kind==="client"&&item.id==="client-1"&&/canonical Client/i.test(item.conflict)));
  assert.ok(draft.likelyMatches.some(item=>item.kind==="enquiry"&&item.id==="enquiry-1"));
  await assert.rejects(()=>service.createEnquiryFromMessage("provider-message-1",{displayName:draft.displayName,projectName:draft.projectName,selectedAttachmentIds:[]}),error=>error.code==="enquiry_existing_record_review_required"&&error.details.likelyMatches.length>0);
  const linked=await service.linkRelationship("provider-message-1",{kind:"client",id:"client-1"});
  assert.ok(linked.links.some(item=>item.kind==="client"&&item.id==="client-1"));
  assert.equal((await db.get("SELECT COUNT(*) count FROM enquiries")).count,1);
});
