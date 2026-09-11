import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { createGoogleWorkspaceService, GOOGLE_WORKSPACE_SCOPES } from "../server/features/integrations/googleWorkspaceService.js";
import { createIssuedQuotationService } from "../server/features/customerQuotations/issuedQuotationService.js";
import { initializePortalSecuritySchema } from "../server/features/clientPortal/portalSecuritySchema.js";
import { initializeLifecycleSchema } from "../server/features/lifecycle/lifecycleSchema.js";

const encryptionKey=Buffer.alloc(32,7);
const jsonResponse=(body,{ok=true,status=200}={})=>({ok,status,json:async()=>body});
const projection=(reference,total="1200.00")=>({estimateReference:reference,clientName:"Ada Client",projectName:"Garden Room",projectAddress:"1 Test Street",commercialRevision:4,positions:[{id:"p1",reference:"W1",customerReference:"W1",classification:"included",includedInQuotationTotal:true,quantity:1,widthMm:1000,heightMm:1200,productSystem:"Europa 92",totalSellingPriceGbp:"1000.00"},{id:"p2",reference:"W1A",customerReference:"W1A",classification:"alternative",includedInQuotationTotal:false,alternativeToReference:"W1",quantity:1,widthMm:1000,heightMm:1200,productSystem:"Europa 92",totalSellingPriceGbp:"900.00"}],charges:[{id:"products",label:"Products / Supply Only",amountGbp:"1000.00"}],subtotalExVatGbp:"1000.00",vatRatePercent:"20",vatGbp:"200.00",totalIncVatGbp:total});

async function fixture(t,{gmailFailure=false,environment={}}={}){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-issued-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,deleted_at TEXT);
    CREATE TABLE projects(id TEXT PRIMARY KEY,client_id TEXT,name TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_ref TEXT,base_estimate_ref TEXT,revision_no INTEGER,status TEXT,positions_json TEXT,project_address TEXT,project_address_json TEXT,postcode TEXT,what3words TEXT,latitude REAL,longitude REAL,created_at TEXT,deleted_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE project_calculator_lab_scenarios(id TEXT PRIMARY KEY,estimate_id TEXT);
    CREATE TABLE project_calculator_estimate_product_rows(id TEXT PRIMARY KEY,scenario_id TEXT);
  `);
  await initializeWorkflowSchema(db);
  await initializePortalSecuritySchema(db);
  await initializeLifecycleSchema(db);
  await db.run("INSERT INTO clients VALUES(?,?,?,?,NULL)","client-1","Ada Client","ada@example.com","Garden Room");
  await db.run("INSERT INTO projects VALUES('project-1','client-1','Garden Room',NULL)");
  await db.run("INSERT INTO estimates VALUES(?,?,?,?,?,?,'Draft',?,'1 Test Street','{}','AA1 1AA','',NULL,NULL,?,NULL)","estimate-1","client-1","project-1","EST-100","EST-100",2,JSON.stringify([{id:"p1",positionRef:"W1",qty:1}]),"2026-08-26T09:00:00.000Z");
  await db.run("INSERT INTO project_calculator_lab_scenarios VALUES(?,?)","scenario-1","estimate-1");
  await db.run("INSERT INTO project_calculator_estimate_product_rows VALUES(?,?)","product-1","scenario-1");
  let gmailSendCount=0;
  const accessFixture=Buffer.alloc(24,41).toString("base64url"),refreshFixture=Buffer.alloc(24,42).toString("base64url"),secretFixture=Buffer.alloc(24,43).toString("base64url");
  const fetchImpl=async(url)=>{
    const value=String(url);
    if(value==="https://oauth2.googleapis.com/token")return jsonResponse({access_token:accessFixture,refresh_token:refreshFixture,token_type:"Bearer",expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(" ")});
    if(value==="https://openidconnect.googleapis.com/v1/userinfo")return jsonResponse({sub:"google-account-1",email:"quotes@example.com",name:"QuoteSuite"});
    if(value.endsWith("/messages/send")){gmailSendCount+=1;return gmailFailure?jsonResponse({error:{message:"Provider rejected message"}},{ok:false,status:503}):jsonResponse({id:"gmail-message-1",threadId:"gmail-thread-1"})}
    throw new Error(`Unexpected Google request: ${value}`);
  };
  const options={fetchImpl,environment,encryptionKey,attachmentRoot:path.join(root,"attachments")};
  const workspace=createGoogleWorkspaceService(db,options);
  await workspace.configure({clientId:"fixture-client",clientSecret:secretFixture,redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback"});
  const oauth=await workspace.beginOAuth();
  await workspace.completeOAuth({state:oauth.state,code:"test-code"});
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return {db,root,service:createIssuedQuotationService(db,options),gmailSendCount:()=>gmailSendCount};
}

test("prepared quotation persists an immutable canonical PDF and commercial evidence",async t=>{
  const {db,root,service}=await fixture(t);
  const input={clientId:"client-1",estimateId:"estimate-1",estimateRevision:2,quotationRevision:4,recipient:"ada@example.com",projection:projection("EST-100"),termsSnapshot:"Valid for 30 days"},prepared=await service.prepare(input);
  assert.equal(prepared.status,"prepared_not_sent");
  assert.equal(prepared.document.mediaType,"application/pdf");
  assert.equal(prepared.communication.status,"draft");
  const workflowState=await service.estimateState("estimate-1");assert.equal(workflowState.quotationReviewed,true);assert.equal(workflowState.quotationPrepared,true);assert.equal(workflowState.quotationIssued,false);
  assert.deepEqual(prepared.commercialSnapshot,{subtotalExVatGbp:"1000.00",vatRatePercent:"20",vatGbp:"200.00",totalIncVatGbp:"1200.00"});
  const stored=await db.get("SELECT * FROM issued_quotations WHERE id=?",prepared.id),document=await db.get("SELECT * FROM customer_quotation_documents WHERE id=?",stored.document_id);
  const bytes=await readFile(path.join(root,"attachments",...document.storage_key.split("/")));
  assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
  assert.equal(JSON.parse(document.projection_json).positions[1].classification,"alternative");
  const replay=await service.prepare(input);assert.equal(replay.id,prepared.id);assert.equal(replay.communicationMessageId,prepared.communicationMessageId);assert.equal((await db.get("SELECT COUNT(*) count FROM customer_quotation_documents")).count,1);assert.equal((await db.get("SELECT COUNT(*) count FROM communication_messages")).count,1);
  await db.run("UPDATE estimates SET revision_no=3 WHERE id='estimate-1'");
  assert.equal((await service.get(prepared.id)).estimateRevision,2);
  assert.equal(JSON.parse((await db.get("SELECT commercial_snapshot_json value FROM issued_quotations WHERE id=?",prepared.id)).value).totalIncVatGbp,"1200.00");
});

test("an already issued Estimate revision cannot send a second changed preparation",async t=>{
  const {service,gmailSendCount}=await fixture(t),common={clientId:"client-1",estimateId:"estimate-1",estimateRevision:2,quotationRevision:4,recipient:"ada@example.com"};
  const first=await service.prepare({...common,projection:projection("EST-100","1200.00")}),second=await service.prepare({...common,projection:projection("EST-100","1250.00")});
  const issued=await service.send(first.id,{recipient:first.recipient,subject:first.subject,bodyHtml:first.communication.bodyHtml});assert.equal(issued.status,"issued");assert.equal(gmailSendCount(),1);
  await assert.rejects(()=>service.send(second.id,{recipient:second.recipient,subject:second.subject,bodyHtml:second.communication.bodyHtml}),error=>error.code==="estimate_revision_already_issued"&&error.details.issuedQuotationId===first.id);
  await assert.rejects(()=>service.prepare({...common,projection:projection("EST-100","1300.00")}),error=>error.code==="estimate_revision_already_issued");
  assert.equal(gmailSendCount(),1,"the conflicting preparation must be rejected before the provider call");
  assert.equal((await service.prepare({...common,projection:projection("EST-100","1200.00")})).id,first.id,"an exact retry reuses the issued evidence");
});

test("provider-confirmed send issues once and creates exactly one linked three-day Follow Up",async t=>{
  const {db,service,gmailSendCount}=await fixture(t);
  const prepared=await service.prepare({clientId:"client-1",estimateId:"estimate-1",estimateRevision:2,quotationRevision:4,recipient:"ada@example.com",projection:projection("EST-100")});
  const issued=await service.send(prepared.id,{recipient:"commercial@example.com",subject:"Reviewed quotation",bodyHtml:"<p>Reviewed body</p>"});
  assert.equal(issued.status,"issued");assert.equal(issued.providerMessageId,"gmail-message-1");assert.equal(issued.recipient,"commercial@example.com");assert.equal(gmailSendCount(),1);
  const followUps=await db.all("SELECT * FROM followups WHERE issued_quotation_id=?",issued.id),events=await db.all("SELECT * FROM workflow_events WHERE evidence_id=?",issued.id);
  assert.equal(followUps.length,1);assert.equal(events.length,1);assert.equal(followUps[0].communication_message_id,issued.communicationMessageId);assert.equal(followUps[0].origin_event_id,events[0].id);
  const expected=new Date(issued.issuedAt);expected.setUTCDate(expected.getUTCDate()+3);assert.equal(followUps[0].due_at,expected.toISOString().slice(0,10));
  const retried=await service.send(prepared.id,{recipient:"different@example.com",subject:"Must not resend",bodyHtml:"<p>Must not resend</p>"});
  assert.equal(retried.status,"issued");assert.equal(gmailSendCount(),1);assert.equal((await db.get("SELECT COUNT(*) count FROM followups WHERE issued_quotation_id=?",issued.id)).count,1);
  await assert.rejects(()=>db.run("UPDATE issued_quotations SET recipient='mutated@example.com' WHERE id=?",issued.id),/immutable/);
  await assert.rejects(()=>db.run("UPDATE customer_quotation_documents SET file_name='mutated.pdf' WHERE id=?",issued.document.id),/immutable/);
  await assert.rejects(()=>db.run("UPDATE estimates SET status='Changed' WHERE id='estimate-1'"),/immutable/);
  const release=await db.get("SELECT * FROM estimate_revision_releases WHERE issued_quotation_id=?",issued.id);assert.equal(release.estimate_revision,2);assert.equal(release.project_id,"project-1");
  const state=await service.estimateState("estimate-1");assert.equal(state.quotationIssued,true);assert.equal(state.followUpDue,true);assert.equal(state.followUpDueDate,followUps[0].due_at);
  assert.equal(issued.followUp.dueDate,followUps[0].due_at);
});

test("controlled customer delivery fixes the role address and subject and blocks every other recipient",async t=>{
  const environment={NODE_ENV:"development",QUOTESUITE_TEST_JOURNEY:"1",QUOTESUITE_TEST_DELIVERY_ENABLED:"1",QUOTESUITE_TEST_CUSTOMER_EMAIL:"info@ecofenster.co.uk",QUOTESUITE_TEST_FACTORY_EMAIL:"info@ecofenster.co.uk"};
  const {service,gmailSendCount}=await fixture(t,{environment});
  const prepared=await service.prepare({clientId:"client-1",estimateId:"estimate-1",estimateRevision:2,quotationRevision:4,recipient:"real-customer@example.com",projection:projection("EST-100")});
  assert.equal(prepared.recipient,"info@ecofenster.co.uk");
  assert.match(prepared.subject,/^TEST Customer · Estimate EST-100/);
  await assert.rejects(()=>service.send(prepared.id,{recipient:"outside@example.com",subject:"Edited subject",bodyHtml:"<p>Body</p>"}),/configured test customer address/);
  assert.equal(gmailSendCount(),0);
});

test("provider failure records failed evidence and never emits quotation.issued or a Follow Up",async t=>{
  const {db,service}=await fixture(t,{gmailFailure:true});
  const prepared=await service.prepare({clientId:"client-1",estimateId:"estimate-1",estimateRevision:2,quotationRevision:4,recipient:"ada@example.com",projection:projection("EST-100")});
  await assert.rejects(()=>service.send(prepared.id,{recipient:prepared.recipient,subject:prepared.subject,bodyHtml:prepared.communication.bodyHtml}),/Provider rejected message/);
  const failed=await service.get(prepared.id);assert.equal(failed.status,"failed");assert.match(failed.failureReason,/Provider rejected message/);
  assert.equal((await db.get("SELECT COUNT(*) count FROM workflow_events WHERE evidence_id=?",prepared.id)).count,0);
  assert.equal((await db.get("SELECT COUNT(*) count FROM followups WHERE issued_quotation_id=?",prepared.id)).count,0);
  assert.equal((await db.get("SELECT status FROM communication_messages WHERE id=?",prepared.communicationMessageId)).status,"failed");
});
