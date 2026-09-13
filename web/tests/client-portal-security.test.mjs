import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { initializeCommercialIdentitySchema } from "../server/features/commercialIdentity/commercialIdentitySchema.js";
import { initializePortalSecuritySchema } from "../server/features/clientPortal/portalSecuritySchema.js";
import { createPortalSecurityService } from "../server/features/clientPortal/portalSecurityService.js";
import { initializeLifecycleSchema } from "../server/features/lifecycle/lifecycleSchema.js";
import { createLifecycleService, deriveConfirmationCheck, deriveRevisionCheck } from "../server/features/lifecycle/lifecycleService.js";
import { saveSupplierResponseReview, supplierResponseReviewContext, supplierResponseReviewHistory } from "../server/features/lifecycle/supplierResponseReviews.js";
import { createCommunicationRepository } from "../server/features/communications/communicationRepository.js";
import { createCommunicationsService } from "../server/features/communications/communicationsService.js";
import { createTestDeliveryPolicy } from "../server/features/lifecycle/testDeliveryPolicy.js";
import { createPortalTestAdapter } from "../server/features/clientPortal/portalTestAdapter.js";
import { createIssuedQuotationService } from "../server/features/customerQuotations/issuedQuotationService.js";
import { createClientPortalRouter } from "../server/routes/clientPortal.js";
import { CLIENT_PORTAL_FEATURES, PORTAL_POSITION_ACCEPTANCE_CONFIRMATIONS, PORTAL_REVIEW_POSITION_RESPONSES } from "../shared/clientPortalContracts.js";

const issuedProjection = {
  estimateReference:"TEST-EST-PORTAL-01",projectName:"Disposable Project A1",projectAddress:"1 Test Street",commercialRevision:1,
  positions:[{id:"position-a",reference:"W1",customerReference:"W1",quantity:1,widthMm:1000,heightMm:1200,productSystem:"Test 92",description:"Window",classification:"included",supplierPurchaseCost:9999,internalNotes:"never expose"}],
  charges:[{id:"products",label:"Products / Supply Only",amountGbp:"1000.00"},{id:"installation",label:"Installation",amountGbp:"250.00"}],subtotalExVatGbp:"1250.00",vatRatePercent:"20",vatGbp:"250.00",totalIncVatGbp:"1500.00",
  margin:"secret",estimateRate:"0.87",liveRate:"0.85898",
};

test("review evidence and future signed Position acceptance remain distinct contracts",()=>{
  assert.deepEqual([...PORTAL_REVIEW_POSITION_RESPONSES],["accepted_as_shown","amendment_requested","question_comment"]);
  assert.deepEqual([...PORTAL_POSITION_ACCEPTANCE_CONFIRMATIONS],["item_reference","configuration","dimensions","specification"]);
});

test("test identities work in preview-only mode while actual delivery needs a separate explicit flag",async()=>{
  const environment={NODE_ENV:"development",QUOTESUITE_TEST_JOURNEY:"1",QUOTESUITE_TEST_CUSTOMER_EMAIL:"customer@example.test",QUOTESUITE_TEST_FACTORY_EMAIL:"factory@example.test"};
  const policy=createTestDeliveryPolicy(environment),adapter=createPortalTestAdapter(environment);
  assert.equal(policy.publicStatus().deliveryMode,"preview_only");assert.equal(adapter.enabled,true);
  await assert.doesNotReject(()=>adapter.verify({email:"customer@example.test"},{expectedEmail:"customer@example.test"}));
  assert.throws(()=>policy.assertRecipient("factory@example.test","factory"),error=>error.code==="test_delivery_disabled");
  const enabled=createTestDeliveryPolicy({...environment,QUOTESUITE_TEST_DELIVERY_ENABLED:"1"});assert.equal(enabled.publicStatus().deliveryMode,"test_allowlist");assert.equal(enabled.assertRecipient("factory@example.test","factory"),"factory@example.test");
  assert.throws(()=>enabled.assertRecipient("real@example.com","factory"),error=>error.code==="test_delivery_recipient_blocked");
});

async function fixture(t,{clockStart=Date.parse("2026-09-06T10:00:00.000Z")}={}) {
  const root=await mkdtemp(path.join(tmpdir(),"qs-portal-security-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  let clock=clockStart,tokenIndex=0;
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',contact_name TEXT NOT NULL DEFAULT '',company_name TEXT NOT NULL DEFAULT '',client_ref TEXT NOT NULL DEFAULT '',project_name TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,project_id TEXT,estimate_ref TEXT NOT NULL,base_estimate_ref TEXT NOT NULL,revision_no INTEGER NOT NULL,status TEXT NOT NULL,estimated_order_month TEXT,estimated_order_year INTEGER,defaults_json TEXT NOT NULL DEFAULT '{}',positions_json TEXT NOT NULL DEFAULT '[]',order_meta_json TEXT NOT NULL DEFAULT '{}',outcome TEXT NOT NULL DEFAULT 'Open',project_address TEXT NOT NULL DEFAULT '',project_address_json TEXT NOT NULL DEFAULT '{}',postcode TEXT NOT NULL DEFAULT '',what3words TEXT NOT NULL DEFAULT '',latitude REAL,longitude REAL,created_by_user_id TEXT,created_by_name TEXT,created_by_role TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT,FOREIGN KEY(client_id) REFERENCES clients(id));
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE project_calculator_lab_scenarios(id TEXT PRIMARY KEY,estimate_id TEXT,revision_number INTEGER NOT NULL DEFAULT 1,updated_at TEXT);
    CREATE TABLE project_calculator_lab_manual_cost_lines(id TEXT PRIMARY KEY,scenario_id TEXT NOT NULL,label TEXT);
    CREATE TABLE supplier_commercial_defaults(supplier_code TEXT PRIMARY KEY,supplier_name TEXT,policy_json TEXT DEFAULT '{}',pricing_display_policy_json TEXT DEFAULT '{}',updated_at TEXT,active INTEGER DEFAULT 1);
  `);
  await initializeWorkflowSchema(db);
  await initializeCommercialIdentitySchema(db);
  await initializePortalSecuritySchema(db);
  await initializeLifecycleSchema(db);
  const now="2026-09-06T09:00:00.000Z";
  for(const row of [["client-a","Client A","a@example.test","TEST-CL-A"],["client-b","Client B","b@example.test","TEST-CL-B"]])await db.run("INSERT INTO clients(id,name,email,contact_name,company_name,client_ref,project_name,created_at,deleted_at,commercial_lifecycle,reference_namespace,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",row[0],row[1],row[2],row[1],"",row[3],`${row[1]} Project`,now,null,"prospect","test",now);
  for(const row of [["project-a1","client-a","Disposable Project A1"],["project-a2","client-a","Disposable Project A2"],["project-b1","client-b","Disposable Project B1"]])await db.run("INSERT INTO projects(id,client_id,name,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)",...row,now,now);
  const positions=JSON.stringify([{id:"position-a",positionRef:"W1",qty:1,widthMm:1000,heightMm:1200,roomName:"Kitchen"}]);
  for(const row of [["estimate-a1","client-a","project-a1","TEST-EST-PORTAL-01"],["estimate-a2","client-a","project-a2","TEST-EST-PORTAL-02"],["estimate-b1","client-b","project-b1","TEST-EST-PORTAL-03"]])await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,created_by_user_id,created_by_name,created_by_role,created_at,updated_at) VALUES(?,?,?,?,?,1,'Issued','',2026,'{}',?,'{}','Open','1 Test Street','{}','AA1 1AA','','staff','Staff','estimator',?,?)`,row[0],row[1],row[2],row[3],row[3],positions,now,now);
  await db.run("INSERT INTO customer_quotation_documents(id,estimate_id,quotation_revision,file_name,media_type,storage_key,size_bytes,sha256,projection_sha256,projection_json,created_at) VALUES('document-issued','estimate-a1',1,'TEST-EST-PORTAL-01.pdf','application/pdf','test/issued.pdf',100,'document-hash','projection-hash',?,?)",JSON.stringify(issuedProjection),now);
  await db.run(`INSERT INTO issued_quotations(id,idempotency_key,client_id,estimate_id,estimate_revision,quotation_revision,document_id,status,recipient,subject,provider,provider_message_id,prepared_at,issued_at,commercial_snapshot_json,created_at,updated_at) VALUES('issued-a1','issue-key','client-a','estimate-a1',1,1,'document-issued','issued','a@example.test','Estimate','test','message',?,?,?, ?,?)`,now,now,JSON.stringify({subtotalExVatGbp:"1250.00",vatRatePercent:"20",vatGbp:"250.00",totalIncVatGbp:"1500.00"}),now,now);
  await db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,discovered_at,last_seen_at,updated_at) VALUES('document-safe','fixture','account','safe','client-a','project-a1','project_drawing','Approved drawing.pdf',?,?,?)",now,now,now);
  await db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,discovered_at,last_seen_at,updated_at) VALUES('document-unreleased','fixture','account','private','client-a','project-a1','supplier_quotation','Supplier cost.pdf',?,?,?)",now,now,now);
  await db.run("INSERT INTO project_calculator_lab_scenarios(id,estimate_id,revision_number,updated_at) VALUES('scenario-a1','estimate-a1',1,?)",now);
  await db.run("INSERT INTO project_calculator_lab_manual_cost_lines(id,scenario_id,label) VALUES('cost-before','scenario-a1','Before release')");
  await db.run("INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,updated_at) VALUES('TEST-SUPPLIER','Example Supplier',?)",now);
  const options={clock:()=>clock,tokenFactory:()=>Buffer.from(`portal-test-token-${++tokenIndex}`.padEnd(32,"x")).toString("base64url"),identityVerifier:async(assertion)=>({provider:"test-oidc-adapter",subject:String(assertion?.subject||"subject-a"),email:String(assertion?.email||"a@example.test")}),documentOptions:{attachmentRoot:path.join(root,"attachments")}};
  const service=createPortalSecurityService(db,options);
  for(const featureKey of CLIENT_PORTAL_FEATURES)await service.setFeatureControl(featureKey,true,"fixture");
  const release=await service.releaseIssuedEstimate({issuedQuotationId:"issued-a1",releasedBy:"staff-1"});
  await service.releaseDocument({clientId:"client-a",projectId:"project-a1",documentId:"document-safe",releasedBy:"staff-1"});
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return {db,service,options,release,setClock:(value)=>{clock=value}};
}

test("portal disclosure requires both an enabled feature and an explicit resource release",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source);
  await source.service.setFeatureControl("estimates",false,"staff-1");
  await assert.rejects(()=>source.service.getReleasedEstimate(auth.session,"project-a1",source.release.id),error=>error.code==="portal_feature_disabled");
  await source.service.setFeatureControl("estimates",true,"staff-1");
  assert.equal((await source.service.getReleasedEstimate(auth.session,"project-a1",source.release.id)).estimateRef,"TEST-EST-PORTAL-01");
  await assert.rejects(()=>source.service.getReleasedDocument(auth.session,"project-a1","document-unreleased"),error=>error.code==="portal_resource_unreleased");
});

test("withdrawn offers remain in staff history but leave external disclosure and customer actions",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),issuance=createIssuedQuotationService(source.db,{attachmentRoot:source.options.documentOptions.attachmentRoot,portalSecurityOptions:source.options});
  const withdrawn=await issuance.withdraw("issued-a1",{actorId:"staff-1",reason:"Scope replaced after customer discussion."});assert.equal(withdrawn.lifecycleStatus,"withdrawn");
  await assert.rejects(()=>source.service.getReleasedEstimate(auth.session,"project-a1",source.release.id),error=>error.code==="portal_estimate_withdrawn");
  await assert.rejects(()=>source.service.getReleasedDocument(auth.session,"project-a1","document-issued"),error=>error.code==="portal_estimate_withdrawn");
  await assert.rejects(()=>source.service.startReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id}),error=>error.code==="portal_estimate_withdrawn");
  assert.equal((await source.service.getProjectPortal(auth.session,"project-a1")).estimates.length,0);
  const internal=await source.service.internalProjectPreview("client-a","project-a1");assert.equal(internal.estimates.length,1);assert.equal(internal.estimates[0].status,"withdrawn");assert.match(internal.estimates[0].lifecycle.reason,/Scope replaced/);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM estimate_revision_releases WHERE id=?",source.release.id)).count,1);assert.equal((await source.db.get("SELECT status FROM issued_quotations WHERE id='issued-a1'")).status,"issued");
});

async function authenticated(t,source) {
  const invitation=await source.service.createInvitation({clientId:"client-a",projectId:"project-a1",email:"a@example.test",displayName:"Contact A",createdBy:"staff-1"});
  const accepted=await source.service.acceptInvitation({token:invitation.token,identityAssertion:{subject:"subject-a",email:"a@example.test"}});
  const session=await source.service.authenticateSession(accepted.sessionToken);
  return {...accepted,session,invitation};
}

test("invitation secrets are hashed, expiring, single-use and revocable",async t=>{
  const source=await fixture(t),first=await source.service.createInvitation({clientId:"client-a",projectId:"project-a1",email:"a@example.test",createdBy:"staff-1"});
  const persisted=await source.db.get("SELECT * FROM portal_invitations WHERE id=?",first.invitation.id);
  assert.notEqual(persisted.token_hash,first.token);assert.equal(JSON.stringify(persisted).includes(first.token),false);assert.equal(persisted.token_hash.length,64);assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_project_grants")).count,0);
  const accepted=await source.service.acceptInvitation({token:first.token,identityAssertion:{subject:"subject-a",email:"a@example.test"}});
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_project_grants WHERE project_id='project-a1' AND status='active'")).count,1);
  const persistedSession=await source.db.get("SELECT session_token_hash,csrf_token_hash FROM portal_sessions WHERE id=?",accepted.session.id);
  assert.notEqual(persistedSession.session_token_hash,accepted.sessionToken);assert.notEqual(persistedSession.csrf_token_hash,accepted.csrfToken);assert.equal(JSON.stringify(persistedSession).includes(accepted.sessionToken),false);assert.equal(JSON.stringify(persistedSession).includes(accepted.csrfToken),false);
  await assert.rejects(()=>source.service.acceptInvitation({token:first.token,identityAssertion:{subject:"subject-a",email:"a@example.test"}}),error=>error.code==="portal_invitation_used");
  const revoked=await source.service.createInvitation({clientId:"client-a",projectId:"project-a1",email:"a@example.test",createdBy:"staff-1"});await source.service.revokeInvitation(revoked.invitation.id,"staff-1");
  await assert.rejects(()=>source.service.acceptInvitation({token:revoked.token,identityAssertion:{subject:"subject-a",email:"a@example.test"}}),error=>error.code==="portal_invitation_revoked");
  const expired=await source.service.createInvitation({clientId:"client-a",projectId:"project-a1",email:"a@example.test",createdBy:"staff-1",lifetimeMs:1000});source.setClock(Date.parse("2026-09-06T10:00:02.000Z"));
  await assert.rejects(()=>source.service.acceptInvitation({token:expired.token,identityAssertion:{subject:"subject-a",email:"a@example.test"}}),error=>error.code==="portal_invitation_expired");
  const dump=JSON.stringify(await source.db.all("SELECT * FROM portal_audit_events"));assert.equal(dump.includes(first.token),false);assert.equal(dump.includes(revoked.token),false);
});

test("session and exact Project authorization prevent cross-Client and sibling-Project access",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source);
  const reviewStarted=await source.service.startReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id}),reviewStartedReplay=await source.service.startReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id});assert.equal(reviewStarted.idempotentReplay,false);assert.equal(reviewStartedReplay.idempotentReplay,true);
  assert.equal((await source.service.getReleasedEstimate(auth.session,"project-a1",source.release.id)).estimateRef,"TEST-EST-PORTAL-01");
  await assert.rejects(()=>source.service.authorizeProject(auth.session,"project-a2"),error=>error.code==="portal_project_forbidden");
  await assert.rejects(()=>source.service.authorizeProject(auth.session,"project-b1"),error=>error.code==="portal_project_forbidden");
  await assert.rejects(()=>source.service.submitReview(auth.session,{projectId:"project-a2",estimateReleaseId:source.release.id,idempotencyKey:"unauthorised-project-command",positions:[]}),error=>error.code==="portal_project_forbidden");
  await assert.rejects(()=>source.service.getReleasedEstimate(auth.session,"project-a1","estimate-a2"),error=>error.code==="portal_resource_unreleased");
  await assert.rejects(()=>source.service.getReleasedDocument(auth.session,"project-a1","document-unreleased"),error=>error.code==="portal_resource_unreleased");
  await source.db.run("UPDATE portal_project_grants SET access_role='viewer' WHERE portal_contact_id=? AND project_id='project-a1'",auth.session.portalContactId);
  await assert.rejects(()=>source.service.startReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id}),error=>error.code==="portal_command_forbidden");
  await source.db.run("UPDATE portal_project_grants SET access_role='reviewer' WHERE portal_contact_id=? AND project_id='project-a1'",auth.session.portalContactId);
  await assert.rejects(()=>source.service.authenticateSession(null),error=>error.code==="portal_authentication_required");
  assert.ok((await source.db.get("SELECT COUNT(*) count FROM portal_audit_events WHERE event_type='portal.authorization.denied'")).count>=4);
});

test("portal sessions expire and can be explicitly revoked",async t=>{
  const expiring=await fixture(t),expiringAuth=await authenticated(t,expiring);
  expiring.setClock(Date.parse(expiringAuth.session.absoluteExpiresAt)+1);
  await assert.rejects(()=>expiring.service.authenticateSession(expiringAuth.sessionToken),error=>error.code==="portal_session_expired");
  const revocable=await fixture(t),revocableAuth=await authenticated(t,revocable);
  await revocable.service.revokeSession(revocableAuth.sessionToken,"logout");
  await assert.rejects(()=>revocable.service.authenticateSession(revocableAuth.sessionToken),error=>error.code==="portal_session_invalid");
  assert.equal((await revocable.db.get("SELECT COUNT(*) count FROM portal_audit_events WHERE event_type='portal.session.revoked'")).count,1);
});

test("server portal projection is allowlisted and never returns internal commercial evidence",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),projection=await source.service.getProjectPortal(auth.session,"project-a1"),json=JSON.stringify(projection);
  assert.equal(projection.estimates.length,1);assert.equal(projection.documents.some((item)=>item.id==="document-safe"),true);assert.equal(projection.documents.some((item)=>item.id==="document-unreleased"),false);
  for(const forbidden of ["supplierPurchaseCost","internalNotes","margin","markup","estimateRate","liveRate","supplierDiscount","extractionConfidence","9999","0.85898"])assert.equal(json.includes(forbidden),false,`${forbidden} crossed the server portal boundary`);
  assert.equal(projection.estimates[0].commercial.totalIncVatGbp,"1500.00");assert.equal(projection.estimates[0].immutable,true);
});

test("issued Estimate, Position and costing state are immutable while an explicit next revision remains editable",async t=>{
  const source=await fixture(t);
  await assert.rejects(()=>source.db.run("UPDATE estimates SET status='Changed' WHERE id='estimate-a1'"),/immutable/i);
  await assert.rejects(()=>source.db.run("UPDATE project_calculator_lab_manual_cost_lines SET label='Changed' WHERE id='cost-before'"),/immutable/i);
  await assert.rejects(()=>source.db.run("INSERT INTO project_calculator_lab_manual_cost_lines(id,scenario_id,label) VALUES('cost-after','scenario-a1','After')"),/immutable/i);
  const successor=await source.service.createNextEstimateRevision({estimateReleaseId:source.release.id,createdBy:"staff-1",createdByName:"Staff User",reason:"customer_amendment"});
  assert.equal(successor.revision_no,2);assert.equal(successor.status,"Draft");assert.equal(successor.base_estimate_ref,"TEST-EST-PORTAL-01");
  await source.db.run("UPDATE estimates SET status='Working' WHERE id=?",successor.id);
  assert.equal((await source.db.get("SELECT status FROM estimates WHERE id='estimate-a1'")).status,"Issued");assert.equal((await source.db.get("SELECT status FROM estimates WHERE id=?",successor.id)).status,"Working");
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM estimate_revision_lineage WHERE source_release_id=?",source.release.id)).count,1);
});

test("review, decline and intent commands are authorized, audited and idempotent without creating an Order",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source);
  const reviewStarted=await source.service.startReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id}),reviewStartedReplay=await source.service.startReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id});assert.equal(reviewStarted.idempotentReplay,false);assert.equal(reviewStartedReplay.idempotentReplay,true);
  const reviewInput={projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"review-command-1",positions:[{estimatePositionId:"position-a",positionReference:"W1",response:"amendment_requested",comment:"Please change finish"}]};
  const first=await source.service.submitReview(auth.session,reviewInput),replay=await source.service.submitReview(auth.session,reviewInput);
  assert.equal(first.idempotentReplay,false);assert.equal(replay.idempotentReplay,true);assert.equal(first.reviewSubmissionId,replay.reviewSubmissionId);assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_review_submissions")).count,1);
  await assert.rejects(()=>source.service.submitReview(auth.session,{...reviewInput,generalComment:"different"}),error=>error.code==="portal_idempotency_conflict");
  await assert.rejects(()=>source.service.submitReview(auth.session,{...reviewInput,idempotencyKey:"review-command-2"}),error=>error.code==="portal_review_already_submitted");
  const declined=await source.service.declineEstimate(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"decline-1",reason:"chose_another_supplier",optionalSupplierName:"Optional competitor"});
  const declineReplay=await source.service.declineEstimate(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"decline-1",reason:"chose_another_supplier",optionalSupplierName:"Optional competitor"});assert.equal(declineReplay.idempotentReplay,true);assert.equal(declined.status,"declined");
  await assert.rejects(()=>source.service.indicateIntentToProceed(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"proceed-after-decline"}),error=>error.code==="portal_estimate_decision_conflict");
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM orders")).count,0);assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_estimate_decisions")).count,1);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_audit_events WHERE portal_command_id IS NOT NULL")).count,2);assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_audit_events WHERE event_type='estimate.review.started'")).count,1);
  assert.deepEqual((await source.db.all("SELECT event_name FROM workflow_events WHERE event_name LIKE 'estimate.%' ORDER BY event_name")).map((row)=>row.event_name),["estimate.customer_declined","estimate.customer_reviewing","estimate.revision_requested"]);
});

test("customer changes produce a carried-forward working revision, attached change summary and evidence-gated successor issue",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),lifecycle=createLifecycleService(source.db,{portal:source.service,documentOptions:source.options.documentOptions,deliveryPolicy:{publicStatus:()=>({deliveryMode:"preview_only"}),assertRecipient(){throw new Error("preview only")}}});
  const review=await source.service.submitReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"revision-review-1",generalResponse:"amendment_requested",generalComment:"Please change the project finish schedule.",positions:[{estimatePositionId:"position-a",positionReference:"W1",response:"amendment_requested",comment:"Change the external finish to black."}]});
  const request=await lifecycle.prepareSupplierRevision({reviewSubmissionId:review.reviewSubmissionId,createdBy:"staff-1",createdByName:"Staff User"});
  const successor=await source.db.get("SELECT * FROM estimates WHERE id=?",request.successorEstimateId);assert.equal(successor.revision_no,2);assert.equal((await source.db.get("SELECT COUNT(*) count FROM project_calculator_lab_manual_cost_lines WHERE scenario_id<>(SELECT id FROM project_calculator_lab_scenarios WHERE estimate_id='estimate-a1')")).count,1);
  await assert.rejects(()=>lifecycle.prepareSupplierRevisionCorrespondence(request.id,{reviewedBy:"staff-1",recipient:"factory@example.test",send:true}),error=>error.code==='supplier_revision_supplier_review_required');
  const legacyRepository=createCommunicationRepository(source.db);
  const older=await legacyRepository.save({id:'legacy-prepared-correspondence',provider:'quotesuite_preview',direction:'outbound',folder:'drafts',status:'draft',to:['factory@example.test'],subject:'Earlier reviewed supplier message',bodyText:'Original retained wording',attachments:[],links:[]});
  await source.db.run("INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES('legacy-event','supplier.revision.correspondence_reviewed','legacy-evidence','2026-09-01',?,'2026-09-01')",JSON.stringify([{kind:'supplier_revision_request',id:request.id},{kind:'communication',id:older.id}]));
  const correspondence=await lifecycle.prepareSupplierRevisionCorrespondence(request.id,{supplierId:'TEST-SUPPLIER',reviewedBy:"staff-1",recipient:"factory@example.test",subject:"TEST reviewed changes",documentIds:["document-safe"],send:false});
  assert.match(correspondence.changeDocument.fileName,/Requested-Changes\.pdf$/);const communication=await source.db.get("SELECT * FROM communication_messages WHERE id=?",correspondence.communicationMessageId);assert.ok(communication);
  assert.equal(correspondence.supplierRequest.requestKind,'revision');
  const reopenedContext=await lifecycle.supplierEnquiryContext('project-a1',request.successorEstimateId);assert.equal(reopenedContext.enquiries.length,1);assert.equal(reopenedContext.legacyCorrespondence[0].bodyText,'Original retained wording');
  assert.deepEqual(await legacyRepository.get(older.id),older,'Consolidating correspondence changed the earlier message');
  const ordinaryLegacyMail=createCommunicationsService(source.db,{deliveryPolicy:{assertAllRecipients(){}}});
  await assert.rejects(()=>ordinaryLegacyMail.sendMessage(older),error=>error.code==='supplier_revision_supplier_review_required');
  await assert.rejects(()=>ordinaryLegacyMail.createDraft(older),error=>error.code==='supplier_draft_context_required');
  const attachments=await source.db.all("SELECT file_name,storage_key FROM communication_attachments WHERE communication_message_id=? ORDER BY file_name",correspondence.communicationMessageId);assert.equal(attachments.some(item=>/Requested-Changes\.pdf$/.test(item.file_name)&&item.storage_key),true);
  await legacyRepository.save({id:'compatibility-supplier-reply',provider:'fixture',providerMessageId:'compatibility-supplier-reply',direction:'inbound',folder:'inbox',status:'received',from:['factory@example.test'],subject:'Fixture supplier response',bodyText:'Fixture revised finish evidence',attachments:[],links:[]});
  await lifecycle.linkManufacturerResponse('project-a1',{estimateId:successor.id,supplierEnquiryId:correspondence.supplierRequest.id,communicationMessageId:'compatibility-supplier-reply',canonicalDocumentId:'document-safe',createdBy:'staff-1'});
  await saveSupplierResponseReview(source.db,request.id,correspondence.supplierRequest.id,{canonicalDocumentId:'document-safe',reviewedBy:'staff-1',idempotencyKey:'compatibility-source-review',checks:[{fieldKey:'finish',estimatePositionId:'position-a',beforeValue:'White',expectedValue:'Black',afterValue:'Black',beforeSourceReference:'Fixture issued W1',afterSourceReference:'Fixture returned document'}]},deriveRevisionCheck);
  await lifecycle.attachSupplierRevisionDocument(request.id,{sourceKind:"canonical_document",canonicalDocumentId:"document-safe",revision:"2",reviewedBy:"staff-1"});
  const incomplete=await lifecycle.verifySupplierRevision(request.id,{reviewedBy:"staff-1",checks:[{estimatePositionId:"position-a",fieldKey:"external_finish",requestedChange:"Black",beforeValue:"White",expectedValue:"Black",afterValue:"Black",beforeSourceReference:"Issued Estimate W1",afterSourceReference:"Revision 2 p2"}],unrelatedChanges:[{estimatePositionId:"position-a",fieldKey:"hardware",requestedChange:"Unrelated material change",beforeValue:"Standard",expectedValue:"Standard",afterValue:"Different",beforeSourceReference:"Issued Estimate W1",afterSourceReference:"Revision 2 p2"}]});
  assert.equal(incomplete.issueAllowed,false);
  const projection={...issuedProjection,estimateReference:successor.estimate_ref,clientName:"Client A",commercialRevision:1};const issuance=createIssuedQuotationService(source.db,{attachmentRoot:source.options.documentOptions.attachmentRoot,portalSecurityOptions:source.options});
  await assert.rejects(()=>issuance.prepare({estimateId:successor.id,clientId:"client-a",estimateRevision:2,quotationRevision:1,projection,recipient:"a@example.test"}),error=>error.code==="supplier_revision_verification_required");
  const verified=await lifecycle.verifySupplierRevision(request.id,{reviewedBy:"staff-1",checks:[{estimatePositionId:"position-a",fieldKey:"external_finish",requestedChange:"Black",beforeValue:"White",expectedValue:"Black",afterValue:"Black",beforeSourceReference:"Issued Estimate W1",afterSourceReference:"Revision 2 p2"},{estimatePositionId:null,fieldKey:"general_finish_schedule",requestedChange:"Change finish schedule",beforeValue:"Original schedule",expectedValue:"Revised schedule",afterValue:"Revised schedule",beforeSourceReference:"Issued Estimate overview",afterSourceReference:"Revision 2 overview"}],unrelatedChanges:[{estimatePositionId:"position-a",fieldKey:"hardware",requestedChange:"Unrelated material change",beforeValue:"Standard",expectedValue:"Standard",afterValue:"Different",beforeSourceReference:"Issued Estimate W1",afterSourceReference:"Revision 2 p2",approvedDifference:true,resolutionNote:"Reviewed and accepted for the successor offer."}]});
  assert.equal(verified.issueAllowed,true);
  const protectedReview=await source.db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY id',request.id);
  const protectedApproval=await source.db.get('SELECT verified_at FROM supplier_revision_requests WHERE id=?',request.id);
  const protectedHistory=await source.db.get('SELECT COUNT(*) count FROM supplier_revision_review_history WHERE request_id=?',request.id);
  const approvedField={estimatePositionId:'position-a',fieldKey:'external_finish',beforeValue:'White',expectedValue:'Black',afterValue:'Different',beforeSourceReference:'Issued Estimate W1',afterSourceReference:'Returned document page 2',approvedDifference:true,resolutionNote:'Reviewed difference'};
  for(const missing of ['beforeValue','expectedValue','afterValue','beforeSourceReference','afterSourceReference','resolutionNote']){
    await assert.rejects(()=>lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:[{...approvedField,[missing]:''}]}),error=>error.code==='supplier_revision_difference_evidence_required');
  }
  await assert.rejects(()=>lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:[{...approvedField,estimatePositionId:'another-customer-position'}]}),error=>error.code==='supplier_revision_position_invalid');
  await assert.rejects(()=>lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:[approvedField],unrelatedChanges:[approvedField]}),error=>error.code==='supplier_revision_checks_invalid');
  assert.deepEqual(await source.db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY id',request.id),protectedReview);
  assert.deepEqual(await source.db.get('SELECT verified_at FROM supplier_revision_requests WHERE id=?',request.id),protectedApproval);
  assert.deepEqual(await source.db.get('SELECT COUNT(*) count FROM supplier_revision_review_history WHERE request_id=?',request.id),protectedHistory);
  await lifecycle.attachSupplierRevisionDocument(request.id,{sourceKind:'canonical_document',canonicalDocumentId:'document-safe',revision:'3',reviewedBy:'staff-1'});
  assert.equal((await source.db.get('SELECT verified_at FROM supplier_revision_requests WHERE id=?',request.id)).verified_at,null);
  const recheck=row=>({estimatePositionId:row.estimate_position_id,fieldKey:row.field_key,requestedChange:row.requested_change,beforeValue:row.before_value,expectedValue:row.expected_value,afterValue:row.after_value,beforeSourceReference:row.before_source_reference,afterSourceReference:'Revision 3 reviewed source',approvedDifference:row.status==='approved_difference',resolutionNote:row.resolution_note});
  const partiallyRechecked=await lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:[recheck(verified.checks.find(row=>row.field_key==='external_finish'))]});
  assert.equal(partiallyRechecked.issueAllowed,false);assert.equal(partiallyRechecked.staleChecks,2);
  await assert.rejects(()=>issuance.prepare({estimateId:successor.id,clientId:'client-a',estimateRevision:2,quotationRevision:1,projection,recipient:'a@example.test'}),error=>error.code==='supplier_revision_verification_required');
  const currentReview=await lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:verified.checks.filter(row=>row.change_kind==='requested').map(recheck),unrelatedChanges:verified.checks.filter(row=>row.change_kind==='unrelated_material_change').map(recheck)});
  assert.equal(currentReview.issueAllowed,true);assert.equal(currentReview.checks.length,3);
  const history=await source.db.all('SELECT * FROM supplier_revision_review_history WHERE request_id=?',request.id);assert.ok(history.length>=2);assert.ok(history.some(row=>JSON.parse(row.checks_json).some(check=>String(check.source_identity).includes('"2"'))));
  await assert.rejects(()=>source.db.run("UPDATE supplier_revision_review_history SET checks_json='[]' WHERE id=?",history[0].id),/immutable/);
  const historyPage=await lifecycle.supplierReviewHistory(request.id,0);
  assert.equal(historyPage.total,history.length);assert.equal(historyPage.items.length,Math.min(10,history.length));
  assert.ok(historyPage.items.some(item=>item.checks.some(check=>check.field_key==='external_finish')));
  const reopenedReview=await lifecycle.changeRequestDetail(review.reviewSubmissionId);
  assert.equal(reopenedReview.checks.length,3);assert.equal(reopenedReview.supplierRevision.returnedRevision,'3');
  assert.ok(Array.isArray(reopenedReview.supplierRevision.supplierDocuments));
  assert.equal((await lifecycle.supplierReviewHistory(request.id,history.length)).items.length,0);
  await assert.rejects(()=>lifecycle.supplierReviewHistory(request.id,-1),/valid history page/);
  await assert.rejects(()=>lifecycle.supplierReviewHistory('missing-request',0),/not found/);
  await source.db.run("INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,updated_at) VALUES('SECOND-SUPPLIER','Second Supplier',?)",new Date().toISOString());
  const dispatchInput={estimateId:successor.id,recipient:"factory@example.test",subject:"Reviewed revision request",bodyText:"Please return the revised estimate.",createdBy:"staff-1",requestKind:"revision",revisionRequestId:request.id};
  const first=await lifecycle.prepareSupplierEnquiry("project-a1",{...dispatchInput,supplierId:"TEST-SUPPLIER",idempotencyKey:"multi-first"});
  const second=await lifecycle.prepareSupplierEnquiry("project-a1",{...dispatchInput,supplierId:"SECOND-SUPPLIER",idempotencyKey:"multi-second"});
  const messages=createCommunicationRepository(source.db);
  for(const id of ['first-revision-reply','second-revision-reply'])await messages.save({id,provider:"fixture",providerMessageId:id,direction:"inbound",folder:"inbox",status:"received",subject:id,bodyText:"Reviewed supplier response",from:["factory@example.test"],to:[],attachments:[],links:[]});
  await lifecycle.linkManufacturerResponse("project-a1",{estimateId:successor.id,supplierEnquiryId:first.id,communicationMessageId:"first-revision-reply",canonicalDocumentId:"document-safe",createdBy:"staff-1"});
  await lifecycle.linkManufacturerResponse("project-a1",{estimateId:successor.id,supplierEnquiryId:second.id,communicationMessageId:"second-revision-reply",createdBy:"staff-1"});
  const issueInput={estimateId:successor.id,clientId:"client-a",estimateRevision:2,quotationRevision:1,projection,recipient:"a@example.test"};
  await assert.rejects(()=>issuance.prepare(issueInput),error=>error.code==='supplier_revision_responses_outstanding'&&error.details.outstandingSuppliers.length===1&&error.details.outstandingSuppliers[0].id===second.id&&error.message.includes('Second Supplier'));
  await lifecycle.linkManufacturerResponse("project-a1",{estimateId:successor.id,supplierEnquiryId:second.id,communicationMessageId:"second-revision-reply",canonicalDocumentId:"document-unreleased",createdBy:"staff-1"});
  await assert.rejects(()=>issuance.prepare(issueInput),error=>error.code==='supplier_response_reviews_required');
  const supplierCheck={fieldKey:'finish',estimatePositionId:'position-a',beforeValue:'White',expectedValue:'Black',afterValue:'Black',beforeSourceReference:'Issued W1',afterSourceReference:'Returned page 1'};
  const reviewInput={canonicalDocumentId:'document-safe',reviewedBy:'staff-1',idempotencyKey:'supplier-review-1',checks:[supplierCheck]};
  await assert.rejects(()=>saveSupplierResponseReview(source.db,request.id,first.id,{...reviewInput,canonicalDocumentId:'document-unreleased'},deriveRevisionCheck),/exact supplier request/);
  await assert.rejects(()=>saveSupplierResponseReview(source.db,'another-parent',first.id,reviewInput,deriveRevisionCheck),/active supplier request/);
  await source.db.exec("CREATE TRIGGER disposable_review_invalidation_failure BEFORE UPDATE ON supplier_revision_requests BEGIN SELECT RAISE(ABORT,'disposable aggregate interruption'); END");
  await assert.rejects(()=>saveSupplierResponseReview(source.db,request.id,first.id,reviewInput,deriveRevisionCheck),error=>error.code==='supplier_response_review_partial');
  await source.db.exec('DROP TRIGGER disposable_review_invalidation_failure');
  const firstReview=await saveSupplierResponseReview(source.db,request.id,first.id,reviewInput,deriveRevisionCheck);
  assert.equal(firstReview.idempotentReplay,true);assert.equal((await source.db.get('SELECT verified_at FROM supplier_revision_requests WHERE id=?',request.id)).verified_at,null);
  assert.equal((await saveSupplierResponseReview(source.db,request.id,first.id,reviewInput,deriveRevisionCheck)).id,firstReview.id);
  let responseReviews=await supplierResponseReviewContext(source.db,request.id);
  assert.equal(responseReviews.find(item=>item.id===first.id).reviewRequired,false);assert.equal(responseReviews.find(item=>item.id===second.id).reviewRequired,true);
  await assert.rejects(()=>issuance.prepare(issueInput),error=>error.code==='supplier_response_reviews_required');
  const secondReviewInput={...reviewInput,canonicalDocumentId:'document-unreleased'};
  await saveSupplierResponseReview(source.db,request.id,second.id,{...secondReviewInput,checks:[{...supplierCheck,afterValue:'White'}]},deriveRevisionCheck);
  assert.equal((await supplierResponseReviewContext(source.db,request.id)).find(item=>item.id===second.id).reviewRequired,true);
  await saveSupplierResponseReview(source.db,request.id,second.id,{...secondReviewInput,idempotencyKey:'supplier-review-2'},deriveRevisionCheck);
  assert.equal((await source.db.get('SELECT COUNT(*) count FROM supplier_response_reviews')).count,4,'Includes the reviewed response to the consolidated compatibility request');
  await assert.rejects(()=>source.db.run('DELETE FROM supplier_response_reviews WHERE id=?',firstReview.id),/immutable/);
  await source.db.run("UPDATE canonical_documents SET checksum='changed-second-response' WHERE id='document-unreleased'");
  responseReviews=await supplierResponseReviewContext(source.db,request.id);
  assert.equal(responseReviews.find(item=>item.id===first.id).reviewRequired,false);assert.equal(responseReviews.find(item=>item.id===second.id).reviewRequired,true);
  await assert.rejects(()=>issuance.prepare(issueInput),error=>error.code==='supplier_response_reviews_required');
  await saveSupplierResponseReview(source.db,request.id,second.id,{...secondReviewInput,idempotencyKey:'supplier-review-3'},deriveRevisionCheck);
  const secondHistory=await supplierResponseReviewHistory(source.db,request.id,second.id);
  assert.equal(secondHistory.total,3);assert.ok(secondHistory.items.some(item=>item.checks.some(check=>check.after_value==='White')));
  await assert.rejects(()=>supplierResponseReviewHistory(source.db,'another-parent',second.id),/does not belong/);
  await assert.rejects(()=>supplierResponseReviewHistory(source.db,request.id,second.id,-1),/valid review history page/);
  for(let pageIndex=0;pageIndex<10;pageIndex++)await saveSupplierResponseReview(source.db,request.id,first.id,{...reviewInput,idempotencyKey:`history-page-${pageIndex}`},deriveRevisionCheck);
  const firstHistory=await supplierResponseReviewHistory(source.db,request.id,first.id);
  assert.equal(firstHistory.total,11);assert.equal(firstHistory.items.length,10);
  assert.equal((await supplierResponseReviewHistory(source.db,request.id,first.id,10)).items.length,1);
  assert.ok(firstHistory.items.every(item=>item.checks.every(check=>check.after_value==='Black')));
  await lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:currentReview.checks.filter(row=>row.change_kind==='requested').map(recheck),unrelatedChanges:currentReview.checks.filter(row=>row.change_kind==='unrelated_material_change').map(recheck)});
  const terms=await issuance.saveCustomerTerms(successor.id,{validityDays:30,terms:["Final dimensions are subject to survey."],exclusions:["Building work by others."],reviewedBy:"staff-1"});projection.commercialTerms={validityDays:terms.validityDays,terms:terms.terms,exclusions:terms.exclusions,reviewed:true,reviewedAt:terms.reviewedAt};const prepared=await issuance.prepare(issueInput);assert.equal(prepared.status,"prepared_not_sent");
  assert.equal((await issuance.prepare(issueInput)).id,prepared.id);
  const preparedEvidence=await source.db.get('SELECT supplier_review_snapshot,document_id,communication_message_id FROM issued_quotations WHERE id=?',prepared.id);
  assert.ok(preparedEvidence.supplier_review_snapshot);
  await lifecycle.attachSupplierRevisionDocument(request.id,{sourceKind:'canonical_document',canonicalDocumentId:'document-safe',revision:'4',reviewedBy:'staff-1'});
  await lifecycle.verifySupplierRevision(request.id,{reviewedBy:'staff-1',checks:currentReview.checks.filter(row=>row.change_kind==='requested').map(recheck),unrelatedChanges:currentReview.checks.filter(row=>row.change_kind==='unrelated_material_change').map(recheck)});
  await assert.rejects(()=>issuance.send(prepared.id),error=>error.code==='supplier_review_changed_after_preparation'&&error.message.includes('Nothing was sent'));
  assert.deepEqual(await source.db.get('SELECT supplier_review_snapshot,document_id,communication_message_id FROM issued_quotations WHERE id=?',prepared.id),preparedEvidence);
  assert.equal((await messages.get(preparedEvidence.communication_message_id)).status,'draft');
  const refreshedPreparation=await issuance.prepare(issueInput);
  assert.notEqual(refreshedPreparation.id,prepared.id);assert.equal((await issuance.prepare(issueInput)).id,refreshedPreparation.id);
  await lifecycle.prepareSupplierEnquiry("project-a1",{...dispatchInput,supplierId:"SECOND-SUPPLIER",subject:"Further reviewed supplier changes",idempotencyKey:"multi-after-preparation"});
  await assert.rejects(()=>issuance.send(prepared.id),error=>error.code==='supplier_revision_responses_outstanding'&&error.message.includes('Nothing was sent'));
  assert.equal((await source.db.get('SELECT status FROM issued_quotations WHERE id=?',prepared.id)).status,'prepared_not_sent');
  assert.equal((await source.db.get("SELECT status FROM estimates WHERE id='estimate-a1'")).status,"Issued");
});

test("intent to proceed records one workflow decision and never creates a supplier Order",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),input={projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"intent-command-1"};
  const first=await source.service.indicateIntentToProceed(auth.session,input),replay=await source.service.indicateIntentToProceed(auth.session,input);
  assert.equal(first.status,"intent_to_proceed");assert.equal(first.supplierOrderCreated,false);assert.equal(replay.idempotentReplay,true);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_estimate_decisions WHERE decision_type='intent_to_proceed'")).count,1);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name='estimate.intent_to_proceed'")).count,1);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM orders")).count,0);
});

test("customer acceptance creates one canonical Order and factory commitment remains staff-gated",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),acceptance={projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"accept-estimate-1",overallAccepted:true,positions:[{estimatePositionId:"position-a",positionReference:"W1",accepted:true,confirmations:{item_reference:true,configuration:true,dimensions:true,specification:true}}]};
  const accepted=await source.service.acceptEstimate(auth.session,acceptance),replay=await source.service.acceptEstimate(auth.session,acceptance);
  assert.match(accepted.orderRef,/^EF-ORD-2026-\d{3}$/);assert.equal(accepted.status,"customer_accepted_pending_staff_approval");assert.equal(replay.orderId,accepted.orderId);assert.equal(replay.idempotentReplay,true);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM orders WHERE id=?",accepted.orderId)).count,1);assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_position_acceptances WHERE estimate_acceptance_id=?",accepted.acceptanceId)).count,1);
  const lifecycle=createLifecycleService(source.db,{portal:source.service,documentOptions:source.options.documentOptions,deliveryPolicy:{publicStatus:()=>({deliveryMode:"preview_only"}),assertRecipient(){throw new Error("delivery must not occur")}}});
  await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,{recipient:"factory@example.test",createdBy:"staff-1"}),error=>error.code==="factory_order_staff_approval_required");
  const approval=await lifecycle.approveOrder(accepted.orderId,{approvedBy:"staff-1",note:"Reviewed exact issued revision"});assert.equal(approval.status,"staff_approved");
  const draft=await lifecycle.prepareFactoryOrder(accepted.orderId,{recipient:"factory@example.test",createdBy:"staff-1",documentIds:["document-issued"]});assert.equal(draft.status,"draft");assert.equal((await source.db.get("SELECT status FROM orders WHERE id=?",accepted.orderId)).status,"staff_approved");
  const safeDocument=await lifecycle.customerDocuments.get(draft.documentIds[0]);
  const ordinaryMail=createCommunicationsService(source.db,{deliveryPolicy:{assertAllRecipients(){}}});
  await assert.rejects(()=>ordinaryMail.sendMessage({id:draft.communicationMessageId,factoryDeliveryAttemptId:'cannot-pass-context-in-payload'}),error=>error.code==='factory_delivery_context_required'&&error.deliveryOutcome==='not_sent');
  assert.equal(safeDocument.context.audience,'factory-price-free-v1');assert.match(safeDocument.fileName,/Factory-Schedule/);
  assert.equal(safeDocument.projection.totalIncVatGbp,undefined);assert.equal(safeDocument.projection.commercialTerms,undefined);assert.equal(safeDocument.projection.positions[0].totalSellingPriceGbp,undefined);
  const draftReplay=await lifecycle.prepareFactoryOrder(accepted.orderId,{recipient:'factory@example.test',createdBy:'staff-1'});assert.deepEqual(draftReplay.documentIds,draft.documentIds);
  const legacy=await lifecycle.customerDocuments.createOrderDocument(accepted.orderId,{revision:'staff-approved'});
  await source.db.run('UPDATE factory_order_requests SET document_ids_json=? WHERE id=?',JSON.stringify([legacy.id]),draft.id);
  await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,{send:true}),error=>error.code==='factory_draft_requires_safe_schedule');
  const repaired=await lifecycle.prepareFactoryOrder(accepted.orderId,{send:false});assert.deepEqual(repaired.documentIds,[safeDocument.id]);assert.notEqual(repaired.communicationMessageId,draft.communicationMessageId);
  assert.ok(await createCommunicationRepository(source.db).get(draft.communicationMessageId),'Previous draft evidence must remain retained');
  assert.equal((await lifecycle.customerDocuments.get(legacy.id)).sha256,legacy.sha256,'Customer Order evidence changed during repair');
  const opened=(await lifecycle.orderJourney(accepted.orderId)).factoryDraft;assert.equal(opened.attachments[0].id,safeDocument.id);assert.equal(opened.needsPreparation,false);
  const edit={editDraft:true,expectedCommunicationId:opened.communicationMessageId,recipient:'reviewed.factory@example.test',subject:'Reviewed factory request',bodyText:'Please check <dimensions> & reply.\nReviewed draft only.'};
  await lifecycle.prepareFactoryOrder(accepted.orderId,edit);
  const saved=(await lifecycle.orderJourney(accepted.orderId)).factoryDraft;assert.equal(saved.bodyText,edit.bodyText);assert.equal(saved.recipient,edit.recipient);assert.equal(saved.status,'draft');assert.deepEqual(saved.attachments,opened.attachments);assert.notEqual(saved.communicationMessageId,opened.communicationMessageId);
  await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,{...edit,bodyText:'Stale edit'}),error=>error.code==='factory_draft_changed');
  assert.equal((await lifecycle.orderJourney(accepted.orderId)).factoryDraft.bodyText,edit.bodyText);
  assert.equal((await createCommunicationRepository(source.db).get(opened.communicationMessageId)).attachments.length,1,'Editing must preserve previous attachment metadata');
  const currentMessage=await createCommunicationRepository(source.db).get(saved.communicationMessageId);assert.match(currentMessage.bodyHtml,/&lt;dimensions&gt; &amp; reply\.<br>/);assert.equal(currentMessage.attachments.length,1);assert.equal(currentMessage.snippet,edit.bodyText);assert.equal(currentMessage.providerMessageId,null);assert.equal(currentMessage.threadId,null);
  await source.db.run("INSERT INTO integration_oauth_connections(provider,account_id,status,updated_at) VALUES('google_workspace','test-owned-account','connected',?)",new Date().toISOString());
  await source.db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,checksum,discovered_at,last_seen_at,updated_at) VALUES('factory-support','google_drive','test-owned-account','provider-support','client-a','project-a1','project_drawing','Reviewed drawing.pdf',?,?,?,?)",'a'.repeat(64),new Date().toISOString(),new Date().toISOString(),new Date().toISOString());
  const filesEdit={...edit,expectedCommunicationId:saved.communicationMessageId,additionalDocumentIds:['factory-support']};
  await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,filesEdit),error=>error.code==='factory_attachment_review_required');
  await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,{...filesEdit,additionalDocumentIds:['document-safe'],documentsReviewed:true}),error=>error.code==='factory_attachment_review_required');
  await lifecycle.prepareFactoryOrder(accepted.orderId,{...filesEdit,documentsReviewed:true});const selected=(await lifecycle.orderJourney(accepted.orderId)).factoryDraft;assert.equal(selected.additionalFiles[0].id,'factory-support');assert.equal(selected.needsPreparation,false);
  const selectedMessage=await createCommunicationRepository(source.db).get(selected.communicationMessageId);assert.equal(selectedMessage.attachments.length,2);assert.ok(selectedMessage.attachments.some(file=>file.driveFileId==='provider-support'&&file.sha256==='a'.repeat(64)));
  await assert.rejects(()=>source.db.run('DELETE FROM factory_attachment_reviews WHERE communication_message_id=?',selected.communicationMessageId),/immutable/);
  await source.db.run("UPDATE canonical_documents SET checksum=? WHERE id='factory-support'",'b'.repeat(64));
  await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,{...filesEdit,expectedCommunicationId:selected.communicationMessageId}),error=>error.code==='factory_attachment_review_required');
  for(const [column,value] of [['provider_account_id','another-account'],['client_id','client-b'],['project_id','project-a2']]) {
    const before=await source.db.get('SELECT * FROM canonical_documents WHERE id=?','factory-support');
    await source.db.run(`UPDATE canonical_documents SET ${column}=? WHERE id=?`,value,'factory-support');
    await assert.rejects(()=>lifecycle.prepareFactoryOrder(accepted.orderId,{...filesEdit,expectedCommunicationId:selected.communicationMessageId,documentsReviewed:true}),error=>error.code==='factory_attachment_review_required');
    await source.db.run(`UPDATE canonical_documents SET ${column}=? WHERE id=?`,before[column],'factory-support');
  }
});

test("accepted Positions remain a fail-closed gate through factory confirmation and final customer sign-off",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),lifecycle=createLifecycleService(source.db,{portal:source.service,documentOptions:source.options.documentOptions,deliveryPolicy:{publicStatus:()=>({deliveryMode:"preview_only"}),assertRecipient(){throw new Error("test journey must remain preview-only")}}});
  const accepted=await source.service.acceptEstimate(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"journey-accept-1",overallAccepted:true,positions:[{estimatePositionId:"position-a",positionReference:"W1",accepted:true,confirmations:{item_reference:true,configuration:true,dimensions:true,specification:true}}]});
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM customer_lifecycle_documents WHERE order_id=? AND document_kind='order'",accepted.orderId)).count,1);
  await lifecycle.approveOrder(accepted.orderId,{approvedBy:"staff-1",note:"Reviewed exact issued Estimate"});
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM customer_lifecycle_documents WHERE order_id=? AND document_kind='order'",accepted.orderId)).count,2);
  const factoryOrder=await lifecycle.prepareFactoryOrder(accepted.orderId,{recipient:"factory@example.test",createdBy:"staff-1",subject:`TEST Factory Order ${accepted.orderRef}`,bodyText:"Preview only; use the approved Estimate evidence.",documentIds:["document-issued"],send:false});
  assert.equal(factoryOrder.status,"draft");
  const empty=await lifecycle.recordFactoryConfirmation(accepted.orderId,{canonicalDocumentId:"document-safe",revision:"1",createdBy:"staff-1",reviewedBy:"staff-1",checks:[]});
  assert.deepEqual(empty.missingPositionIds,["position-a"]);assert.equal(empty.releaseAllowed,false);
  await assert.rejects(()=>lifecycle.releaseFactoryConfirmation(empty.confirmationId,{releasedBy:"staff-1"}),error=>error.code==="factory_confirmation_review_required");
  const checked=await lifecycle.recordFactoryConfirmation(accepted.orderId,{canonicalDocumentId:"document-safe",revision:"1",createdBy:"staff-1",reviewedBy:"staff-1",checks:[{estimatePositionId:"position-a",fieldKey:"dimensions",approvedValue:"1000 × 1200 mm",confirmedValue:"1000 × 1200 mm",approvedSourceReference:"Issued Estimate Position W1",confirmationSourceReference:"Factory confirmation p2"}]});
  assert.equal(checked.releaseAllowed,true);assert.deepEqual(checked.missingPositionIds,[]);
  const released=await lifecycle.releaseFactoryConfirmation(checked.confirmationId,{releasedBy:"staff-1"});
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM customer_lifecycle_documents WHERE order_id=? AND document_kind='final_confirmation'",accepted.orderId)).count,1);
  const signed=await source.service.signOffFactoryConfirmation(auth.session,{projectId:"project-a1",factoryConfirmationReleaseId:released.id,idempotencyKey:"journey-final-signoff-1",overallApproved:true,positions:[{estimatePositionId:"position-a",approved:true}]});
  assert.equal(signed.status,"customer_final_confirmation_approved");
  await source.db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,discovered_at,last_seen_at,updated_at) VALUES('document-signed','fixture','account','signed','client-a','project-a1','customer_signed_confirmation','Signed confirmation.pdf',?,?,?)","2026-09-06T12:00:00.000Z","2026-09-06T12:00:00.000Z","2026-09-06T12:00:00.000Z");
  const signedPdf=await lifecycle.recordReviewedSignedApproval(released.id,{signedPdfDocumentId:"document-signed",reviewed:true,reviewedBy:"staff-1",overallApproved:true,positionIds:["position-a"]});
  assert.equal(signedPdf.status,"customer_final_confirmation_approved");assert.equal((await source.db.get("SELECT COUNT(*) count FROM factory_confirmation_signed_pdf_reviews WHERE factory_confirmation_release_id=?",released.id)).count,1);
  assert.equal((await source.db.get("SELECT status FROM orders WHERE id=?",accepted.orderId)).status,"customer_final_confirmation_approved");
  for(const eventName of ["order.staff_approved","factory.order.prepared","factory.confirmation.released","factory.confirmation.customer_approved"])assert.equal((await source.db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name=?",eventName)).count,1,eventName);

  await source.db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,discovered_at,last_seen_at,updated_at) VALUES('document-confirmation-v2','fixture','account','confirmation-v2','client-a','project-a1','factory_confirmation','Factory confirmation revision 2.pdf',?,?,?)","2026-09-06T13:00:00.000Z","2026-09-06T13:00:00.000Z","2026-09-06T13:00:00.000Z");
  const replacement=await lifecycle.recordFactoryConfirmation(accepted.orderId,{canonicalDocumentId:"document-confirmation-v2",revision:"2",createdBy:"staff-1",reviewedBy:"staff-1",checks:[]});
  assert.equal(replacement.releaseAllowed,false);assert.deepEqual(replacement.missingPositionIds,["position-a"]);
  assert.equal((await source.db.get("SELECT status FROM factory_confirmations WHERE id=?",checked.confirmationId)).status,"superseded");
  assert.equal((await source.db.get("SELECT status FROM orders WHERE id=?",accepted.orderId)).status,"factory_confirmation_received_staff_review");
  await assert.rejects(()=>source.service.signOffFactoryConfirmation(auth.session,{projectId:"project-a1",factoryConfirmationReleaseId:released.id,idempotencyKey:"stale-release-signoff",overallApproved:true,positions:[{estimatePositionId:"position-a",approved:true}]}),error=>error.status===403||error.code==="factory_confirmation_release_not_found");
});

test("an issued revision can create only one canonical Order across delegated contacts",async t=>{
  const source=await fixture(t),first=await authenticated(t,source),payload={projectId:"project-a1",estimateReleaseId:source.release.id,overallAccepted:true,positions:[{estimatePositionId:"position-a",positionReference:"W1",accepted:true,confirmations:{item_reference:true,configuration:true,dimensions:true,specification:true}}]};
  const accepted=await source.service.acceptEstimate(first.session,{...payload,idempotencyKey:"contact-a-acceptance"});
  const invitation=await source.service.createInvitation({clientId:"client-a",projectId:"project-a1",email:"delegate@example.test",displayName:"Delegate",createdBy:"staff-1"});
  const secondAccepted=await source.service.acceptInvitation({token:invitation.token,identityAssertion:{subject:"subject-delegate",email:"delegate@example.test"}}),secondSession=await source.service.authenticateSession(secondAccepted.sessionToken);
  const replay=await source.service.acceptEstimate(secondSession,{...payload,idempotencyKey:"contact-delegate-acceptance"});
  assert.equal(replay.orderId,accepted.orderId);assert.equal(replay.idempotentReplay,true);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM portal_estimate_acceptances WHERE estimate_release_id=?",source.release.id)).count,1);
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM orders WHERE source_estimate_id='estimate-a1'")).count,1);
});

test("supplier revision and factory confirmation checks require exact source-backed evidence",()=>{
  assert.equal(deriveRevisionCheck({beforeValue:"White",expectedValue:"Black",afterValue:"Black",afterSourceReference:"Revision 2 p4"}),"implemented");
  assert.equal(deriveRevisionCheck({beforeValue:"White",expectedValue:"Black",afterValue:"White",afterSourceReference:"Revision 2 p4"}),"not_implemented");
  assert.equal(deriveRevisionCheck({beforeValue:"White",expectedValue:"Black",afterValue:"Anthracite",afterSourceReference:"Revision 2 p4"}),"needs_review");
  assert.equal(deriveRevisionCheck({beforeValue:"White",expectedValue:"Black",afterValue:"Black"}),"needs_review");
  assert.equal(deriveConfirmationCheck({approvedValue:"1000 mm",confirmedValue:"1000 mm",confirmationSourceReference:"Confirmation p2"}),"no_change");
  assert.equal(deriveConfirmationCheck({approvedValue:"1000 mm",confirmedValue:"990 mm",confirmationSourceReference:"Confirmation p2"}),"change_detected");
  assert.equal(deriveConfirmationCheck({approvedValue:"1000 mm",confirmedValue:"1000 mm"}),"needs_review");
});

test("supplier enquiry preview and returned evidence stay linked to one canonical Project and working Estimate",async t=>{
  const source=await fixture(t),communications=createCommunicationRepository(source.db),lifecycle=createLifecycleService(source.db,{portal:source.service,communications,documentOptions:source.options.documentOptions,deliveryPolicy:{publicStatus:()=>({deliveryMode:"preview_only"}),assertRecipient(){throw new Error("no send")}}});
  const enquiry=await lifecycle.prepareSupplierEnquiry("project-a1",{estimateId:"estimate-a1",supplierId:"TEST-SUPPLIER",recipient:"factory@example.test",subject:"TEST supplier enquiry",bodyText:"Please review the selected Project drawing.",documentIds:["document-safe"],createdBy:"staff-1"});
  assert.equal(enquiry.status,"draft");assert.deepEqual(enquiry.documents.map(item=>item.id),["document-safe"]);assert.equal((await source.db.get("SELECT COUNT(*) count FROM supplier_enquiry_drafts WHERE project_id='project-a1'")).count,1);
  const response=await communications.save({id:"supplier-response-a1",provider:"fixture",providerMessageId:"supplier-response-a1",direction:"inbound",folder:"inbox",status:"received",from:["factory@example.test"],to:["sales@example.test"],cc:[],bcc:[],subject:"Re: TEST supplier enquiry",bodyHtml:"",bodyText:"Quotation attached",links:[],attachments:[]});
  await assert.rejects(()=>lifecycle.linkManufacturerResponse("project-a1",{estimateId:"estimate-a1",supplierEnquiryId:enquiry.id,communicationMessageId:enquiry.communicationMessageId,canonicalDocumentId:"document-safe",createdBy:"staff-1"}),error=>error.code==="manufacturer_response_message_invalid");
  const acknowledged=await lifecycle.linkManufacturerResponse("project-a1",{estimateId:"estimate-a1",supplierEnquiryId:enquiry.id,communicationMessageId:response.id,createdBy:"staff-1"});
  assert.equal(acknowledged.status,"review_required");
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name='supplier.quote_returned'")).count,0);
  assert.equal((await source.db.get("SELECT status FROM manufacturer_response_links WHERE id=?",acknowledged.id)).status,"review_required");
  const linked=await lifecycle.linkManufacturerResponse("project-a1",{estimateId:"estimate-a1",supplierEnquiryId:enquiry.id,communicationMessageId:response.id,canonicalDocumentId:"document-safe",createdBy:"staff-1"});
  assert.equal(linked.status,"ready_for_import");assert.equal(linked.nextAction,"Review with Manufacturer Import");
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name='supplier.quote_returned'")).count,1);
  const replay=await lifecycle.linkManufacturerResponse("project-a1",{estimateId:"estimate-a1",supplierEnquiryId:enquiry.id,communicationMessageId:response.id,canonicalDocumentId:"document-safe",createdBy:"staff-1"});assert.equal(replay.idempotentReplay,true);
  assert.equal(replay.nextAction,"Review with Manufacturer Import");
  const late=await communications.save({...response,id:"late-acknowledgement",providerMessageId:"late-acknowledgement",subject:"Thank you"});
  await lifecycle.linkManufacturerResponse("project-a1",{estimateId:"estimate-a1",supplierEnquiryId:enquiry.id,communicationMessageId:late.id,createdBy:"staff-1"});
  assert.equal((await source.db.get('SELECT response_state FROM supplier_enquiry_drafts WHERE id=?',enquiry.id)).response_state,"revised_document_received");
  assert.equal((await source.db.get("SELECT COUNT(*) count FROM workflow_events WHERE event_name='supplier.quote_returned'")).count,1);
  await assert.rejects(()=>lifecycle.linkManufacturerResponse("project-a1",{estimateId:"estimate-a1",communicationMessageId:response.id,canonicalDocumentId:"document-safe",createdBy:"staff-1"}),error=>error.code==="manufacturer_response_link_conflict");
  await assert.rejects(()=>lifecycle.prepareSupplierEnquiry("project-a2",{estimateId:"estimate-a2",supplierId:"TEST-SUPPLIER",recipient:"factory@example.test",subject:"Wrong Project",bodyText:"No",documentIds:["document-safe"],createdBy:"staff-1"}),error=>error.code==="supplier_enquiry_document_invalid");
});

test("one tracked supplier revision draft reopens, sends once and follows up once after seven calendar days",async t=>{
  const source=await fixture(t),auth=await authenticated(t,source),communications=createCommunicationRepository(source.db);let clock=Date.parse("2026-09-06T10:00:00.000Z"),sendCount=0,failNext=false;
  const communicationService={repository:communications,sendMessage:async message=>{if(failNext){const outcome=failNext===true?'not_sent':failNext;failNext=false;throw Object.assign(new Error("TEST supplier delivery unavailable"),{deliveryOutcome:outcome})}sendCount+=1;return communications.save({...message,provider:"fixture",providerMessageId:`sent-${sendCount}`,folder:"sent",status:"sent",sentAt:new Date(clock).toISOString()})}};
  const deliveryPolicy={publicStatus:()=>({deliveryMode:"test_allowlist"}),assertRecipient(value){assert.equal(value,"factory@example.test");return value}};
  const lifecycle=createLifecycleService(source.db,{portal:source.service,communications,communicationService,documentOptions:source.options.documentOptions,deliveryPolicy,now:()=>new Date(clock)});
  const review=await source.service.submitReview(auth.session,{projectId:"project-a1",estimateReleaseId:source.release.id,idempotencyKey:"tracked-revision-review",generalResponse:"amendment_requested",generalComment:"Change the finish.",positions:[{estimatePositionId:"position-a",positionReference:"W1",response:"amendment_requested",comment:"Black outside."}]});
  const parent=await lifecycle.prepareSupplierRevision({reviewSubmissionId:review.reviewSubmissionId,createdBy:"staff-1",createdByName:"Staff User"}),context=await lifecycle.supplierEnquiryContext("project-a1",parent.successorEstimateId);assert.equal(context.requestMode,"revision");assert.equal(context.revisionRequest.id,parent.id);
  const payload={estimateId:parent.successorEstimateId,supplierId:"TEST-SUPPLIER",recipient:"factory@example.test",subject:"TEST revised estimate",bodyText:"Please revise W1.",documentIds:["document-safe"],createdBy:"staff-1",requestKind:"revision",revisionRequestId:parent.id,idempotencyKey:"tracked-supplier-draft"};
  const prepared=await lifecycle.prepareSupplierEnquiry("project-a1",payload);assert.equal(prepared.status,"draft");assert.equal((await lifecycle.supplierRevisionDetail(parent.id)).status,"prepared_for_review");
  const sent=(await lifecycle.prepareSupplierRevisionCorrespondence(parent.id,{...payload,reviewedBy:'staff-1',send:true})).supplierRequest;assert.equal(sent.status,"sent");assert.equal(sent.responseDueAt,"2026-09-13T10:00:00.000Z");assert.equal(sendCount,1);
  assert.equal((await source.db.get('SELECT COUNT(*) count FROM supplier_delivery_attempts WHERE supplier_enquiry_id=?',sent.id)).count,1,'Compatibility send bypassed the canonical claim');
  const replay=await lifecycle.prepareSupplierEnquiry("project-a1",{...payload,send:true});assert.equal(replay.idempotentReplay,true);assert.equal(sendCount,1);
  const adjusted=await lifecycle.updateSupplierResponseDue(sent.id,{responseDueAt:"2026-09-14T10:00:00.000Z"});assert.equal(adjusted.responseDueAt,"2026-09-14T10:00:00.000Z");
  clock=Date.parse("2026-09-13T10:01:00.000Z");assert.deepEqual(await lifecycle.processDueSupplierRevisionFollowups(),{processed:0,sent:0,failed:0});
  clock=Date.parse("2026-09-14T10:01:00.000Z");failNext=true;const failedFollowup=await lifecycle.processDueSupplierRevisionFollowups();assert.deepEqual(failedFollowup,{processed:1,sent:0,failed:1});assert.equal(sendCount,1);
  const queued=await lifecycle.retrySupplierRevisionFollowup(sent.id);assert.equal(queued.followupFailure,"");
  const followup=await lifecycle.processDueSupplierRevisionFollowups();assert.deepEqual(followup,{processed:1,sent:1,failed:0});assert.equal(sendCount,2);
  assert.deepEqual(await lifecycle.processDueSupplierRevisionFollowups(),{processed:0,sent:0,failed:0});assert.equal(sendCount,2);
  const portal=await source.service.getProjectPortal(auth.session,"project-a1");assert.equal(portal.revisionRequests[0].status,"Updated Estimate being prepared");assert.equal(JSON.stringify(portal.revisionRequests).includes("factory@example.test"),false);
  const second=await lifecycle.prepareSupplierEnquiry("project-a1",{...payload,subject:"Second supplier request",idempotencyKey:"second-tracked-request",send:true});
  await source.db.run("UPDATE supplier_revision_requests SET status='cancelled',workflow_state='cancelled' WHERE id=?",parent.id);
  clock+=8*24*60*60*1000;
  const restarted=createLifecycleService(source.db,{portal:source.service,communications,communicationService,documentOptions:source.options.documentOptions,deliveryPolicy,now:()=>new Date(clock)});
  assert.deepEqual(await restarted.processDueSupplierRevisionFollowups(),{processed:1,sent:0,failed:0});
  assert.equal(sendCount,3);
  assert.equal((await source.db.get('SELECT followup_due_at FROM supplier_enquiry_drafts WHERE id=?',second.id)).followup_due_at,null);
  await source.db.run("UPDATE supplier_revision_requests SET status='sent',workflow_state='sent_to_supplier' WHERE id=?",parent.id);
  const uncertain=await lifecycle.prepareSupplierEnquiry('project-a1',{...payload,subject:'Uncertain follow-up',idempotencyKey:'uncertain-followup',send:true});
  clock+=8*24*60*60*1000;failNext='uncertain';
  assert.deepEqual(await lifecycle.processDueSupplierRevisionFollowups(),{processed:1,sent:0,failed:1});
  const claimed=await source.db.get('SELECT followup_attempted_at FROM supplier_enquiry_drafts WHERE id=?',uncertain.id);
  await assert.rejects(()=>lifecycle.retrySupplierRevisionFollowup(uncertain.id),error=>error.code==='supplier_followup_delivery_unconfirmed');
  await lifecycle.updateSupplierResponseDue(uncertain.id,{responseDueAt:new Date(clock-1000).toISOString()});
  assert.equal((await source.db.get('SELECT followup_attempted_at FROM supplier_enquiry_drafts WHERE id=?',uncertain.id)).followup_attempted_at,claimed.followup_attempted_at,'Deadline adjustment cleared uncertain claim');
  assert.deepEqual(await restarted.processDueSupplierRevisionFollowups(),{processed:0,sent:0,failed:0});
  assert.equal(sendCount,4,'Uncertain follow-up sent another copy after service restart');
  assert.equal((await lifecycle.supplierEnquiryContext('project-a1',parent.successorEstimateId)).enquiries.find(row=>row.id===uncertain.id).followupDeliveryState,'uncertain');
});

test("HTTP boundary is fail-closed by default and requires authentication plus CSRF when explicitly test-enabled",async t=>{
  const source=await fixture(t),app=express();app.use(express.json());app.use("/api/client-portal",createClientPortalRouter({databasePromise:Promise.resolve(source.db)}));
  const server=createServer(app);await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const blocked=await fetch(`${base}/api/client-portal/external/projects/project-a1`);assert.equal(blocked.status,503);assert.equal(blocked.headers.get("cache-control"),"private, no-store");assert.equal(blocked.headers.get("x-frame-options"),"DENY");assert.equal((await blocked.json()).code,"portal_external_access_disabled");
  const enabledApp=express();enabledApp.use(express.json());enabledApp.use("/api/client-portal",createClientPortalRouter({databasePromise:Promise.resolve(source.db),externalAccessEnabled:true,serviceOptions:source.options}));
  const enabledServer=createServer(enabledApp);await new Promise(resolve=>enabledServer.listen(0,"127.0.0.1",resolve));t.after(()=>new Promise(resolve=>enabledServer.close(resolve)));const enabledBase=`http://127.0.0.1:${enabledServer.address().port}`;
  assert.equal((await fetch(`${enabledBase}/api/client-portal/external/projects/project-a1`)).status,401);
  const invitation=await source.service.createInvitation({clientId:"client-a",projectId:"project-a1",email:"a@example.test",createdBy:"staff-1"});
  const acceptedResponse=await fetch(`${enabledBase}/api/client-portal/external/invitations/accept`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:invitation.token,identityAssertion:{subject:"http-subject",email:"a@example.test"}})});assert.equal(acceptedResponse.status,200);const accepted=await acceptedResponse.json(),cookie=acceptedResponse.headers.get("set-cookie").split(";")[0];assert.equal(acceptedResponse.headers.get("set-cookie").includes("HttpOnly"),true);assert.equal(acceptedResponse.headers.get("set-cookie").includes("Secure"),true);assert.equal(acceptedResponse.headers.get("set-cookie").includes("SameSite=Strict"),true);
  const restored=await fetch(`${enabledBase}/api/client-portal/external/session`,{headers:{Cookie:cookie}});assert.equal(restored.status,200);const restoredBody=await restored.json();assert.deepEqual(restoredBody.session.projects.map(item=>item.id),["project-a1"]);assert.equal(JSON.stringify(restoredBody).includes(accepted.csrfToken),false);
  const badCsrf=await fetch(`${enabledBase}/api/client-portal/external/logout`,{method:"POST",headers:{Cookie:cookie,"X-Portal-CSRF":"wrong"}});assert.equal(badCsrf.status,403);
  const projectResponse=await fetch(`${enabledBase}/api/client-portal/external/projects/project-a1`,{headers:{Cookie:cookie}});assert.equal(projectResponse.status,200);assert.equal((await projectResponse.json()).project.id,"project-a1");
  const logout=await fetch(`${enabledBase}/api/client-portal/external/logout`,{method:"POST",headers:{Cookie:cookie,"X-Portal-CSRF":accepted.csrfToken}});assert.equal(logout.status,200);
  assert.equal((await fetch(`${enabledBase}/api/client-portal/external/projects/project-a1`,{headers:{Cookie:cookie}})).status,401);
});
