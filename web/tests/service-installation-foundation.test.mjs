import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import sqlite3 from "sqlite3";
import {open} from "sqlite";
import {initializeSupplierCommercialSchema} from "../server/schema/supplierCommercialSchema.js";
import {initializeCommercialIdentitySchema} from "../server/features/commercialIdentity/commercialIdentitySchema.js";
import {initializeWorkflowSchema} from "../server/features/workflow/workflowSchema.js";
import {initializeServiceSchema} from "../server/features/service/serviceSchema.js";
import {initializeInstallationSafetySchema} from "../server/features/installationSafety/installationSafetySchema.js";
import {createResponsibilityService} from "../server/features/service/responsibilityService.js";
import {createServiceCaseService} from "../server/features/service/serviceCaseService.js";
import {createInstallationWorkforceService} from "../server/features/projectCalculatorLab/installationWorkforceService.js";
import {createInstallationSafetyService} from "../server/features/installationSafety/installationSafetyService.js";
import {addBusinessMinutes,businessMinutesBetween} from "../server/features/service/serviceLevelCalculator.js";
import {createInstallationQualificationEvidenceService} from '../server/features/projectCalculatorLab/installationQualificationEvidenceService.js';
import {createGoogleDriveProvider} from '../server/features/documents/googleDriveProvider.js';
import {createDisposableGoogleTransport} from './fixtures/disposableGoogleTransport.mjs';
import {migrateWorkforceDocumentOwnership} from '../server/features/commercialIdentity/workforceDocumentMigration.js';

async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),"qs-service-installation-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,group_name TEXT,updated_at TEXT);
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',contact_name TEXT NOT NULL DEFAULT '',company_name TEXT NOT NULL DEFAULT '',client_ref TEXT NOT NULL DEFAULT '',project_name TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,project_id TEXT,estimate_ref TEXT NOT NULL,base_estimate_ref TEXT NOT NULL,revision_no INTEGER NOT NULL,status TEXT NOT NULL,estimated_order_month TEXT,estimated_order_year INTEGER,defaults_json TEXT NOT NULL DEFAULT '{}',positions_json TEXT NOT NULL DEFAULT '[]',order_meta_json TEXT NOT NULL DEFAULT '{}',outcome TEXT NOT NULL DEFAULT 'Open',project_address TEXT NOT NULL DEFAULT '',project_address_json TEXT NOT NULL DEFAULT '{}',postcode TEXT NOT NULL DEFAULT '',what3words TEXT NOT NULL DEFAULT '',latitude REAL,longitude REAL,created_by_user_id TEXT,created_by_name TEXT,created_by_role TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,estimate_id TEXT,title TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',due_at TEXT,status TEXT NOT NULL DEFAULT 'Open',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  `);
  await initializeSupplierCommercialSchema(db);await initializeWorkflowSchema(db);await initializeCommercialIdentitySchema(db);await initializeServiceSchema(db);await initializeInstallationSafetySchema(db);
  const at="2026-09-12T09:00:00.000Z";
  await db.run("INSERT INTO settings(key,value,group_name,updated_at) VALUES('references.servicePrefix',?,'references',?)",JSON.stringify({value:"TEST-SER"}),at);
  await db.run("INSERT INTO clients(id,name,email,contact_name,company_name,client_ref,project_name,created_at,updated_at) VALUES('client-a','Disposable Client A','a@example.test','','','TEST-CL-A','',?,?)",at,at);
  await db.run("INSERT INTO clients(id,name,email,contact_name,company_name,client_ref,project_name,created_at,updated_at) VALUES('client-b','Disposable Client B','b@example.test','','','TEST-CL-B','',?,?)",at,at);
  await db.run("INSERT INTO projects(id,client_id,name,status,created_at,updated_at) VALUES('project-a','client-a','Disposable Installation','active',?,?)",at,at);
  const positions=JSON.stringify([{id:"pos-1",positionRef:"W1",quantity:2,widthMm:1200,heightMm:1400,productType:"Window",openingType:"Tilt and turn",roomName:"Kitchen"}]);
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,positions_json,order_meta_json,outcome,project_address,postcode,created_at,updated_at) VALUES('estimate-a','client-a','project-a','TEST-EST-001','TEST-EST-001',2,'Draft',?,?, 'Open','1 Disposable Street','AA1 1AA',?,?)`,positions,JSON.stringify({installationDate:"2026-09-15"}),at,at);
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});return{db,root,at};
}

test("business-hour targets respect weekends, holidays and do not count closed time",()=>{
  const policy={timezone:"Europe/London",businessHours:{monday:[["09:00","17:00"]],tuesday:[["09:00","17:00"]],wednesday:[["09:00","17:00"]],thursday:[["09:00","17:00"]],friday:[["09:00","17:00"]]},holidays:["2026-09-14"],targets:{},pauseRules:{}};
  const start="2026-09-11T15:00:00.000Z",due=addBusinessMinutes(start,180,policy);
  assert.equal(due,"2026-09-15T10:00:00.000Z");assert.equal(businessMinutesBetween(start,due,policy),180);
});

test("responsibility routing and Service cases are idempotent, scoped and preserve private notes",async t=>{
  const{db}=await fixture(t),responsibility=createResponsibilityService(db,{clock:()=>new Date("2026-09-12T09:00:00Z")});
  let config=await responsibility.saveTeam({name:"Customer Care",members:[{userId:"staff-a",userName:"Alex"}]});const team=config.teams[0];await responsibility.saveRoutingRule({responsibilityArea:"service",teamId:team.id,defaultAssigneeId:"staff-a"});
  const service=createServiceCaseService(db,{clock:()=>new Date("2026-09-12T09:00:00Z"),tenantId:"tenant-test"});
  await service.savePolicy({name:"Internal normal",publicationState:"active_internal",priority:"normal",timezone:"Europe/London",businessHours:{monday:[["09:00","17:00"]]},targets:{first_response:60},pauseRules:{first_response:["customer"]}});
  const input={clientId:"client-a",projectId:"project-a",issueSummary:"Disposable service issue",description:"Retained original report",idempotencyKey:"case-key"};
  const first=await service.create(input),retry=await service.create(input);assert.equal(first.id,retry.id);assert.equal(first.teamName,"Customer Care");assert.equal(first.assigneeName,"Alex");assert.equal(first.timers[0].targetKey,"first_response");
  await service.addUpdate(first.id,{body:"Internal diagnosis",visibility:"internal",idempotencyKey:"note-key"},{type:"staff",id:"staff-a"});await service.addUpdate(first.id,{body:"Visible next step",visibility:"customer",idempotencyKey:"update-key"},{type:"staff",id:"staff-a"});
  const external=await service.get(first.id,{tenantId:"tenant-test",clientId:"client-a",projectId:"project-a"},{includeInternal:false});assert.equal(external.events.some(event=>event.body==="Internal diagnosis"),false);assert.equal(external.events.some(event=>event.body==="Visible next step"),true);
  await assert.rejects(()=>service.get(first.id,{tenantId:"tenant-test",clientId:"client-b"},{includeInternal:false}),error=>error.code==="service_case_not_found");
  const unassigned=await service.create({...input,projectId:"",issueSummary:"Second issue",idempotencyKey:"case-key-2",caseType:"unrouted"});assert.equal(unassigned.teamName,"Customer Care");
});

test("installer qualifications remain evidence-backed and are checked against attendance",async t=>{
  const{db,at}=await fixture(t),workforce=createInstallationWorkforceService(db);let state=await workforce.saveCompany({name:"Disposable Installer Ltd",postcode:"BB1 1BB"}),company=state.companies[0];state=await workforce.saveInstaller({companyId:company.id,name:"Pat Installer",postcode:"BB1 1BB"});const installer=state.installers[0];state=await workforce.saveTeam({companyId:company.id,name:"Team One",normalCrewSize:1,basePostcode:"BB1 1BB",installerIds:[installer.id]});const team=state.teams[0];
  await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,estimate_id,document_type,file_name,mime_type,size_bytes,folder_path,trashed,discovered_at,last_seen_at,updated_at) VALUES('evidence-cscs','fixture','account','file-cscs','client-a','project-a','estimate-a','workforce_qualification','CSCS.pdf','application/pdf',100,'Test',0,?,?,?)`,at,at,at);
  state=await workforce.saveQualification({installerId:installer.id,typeCode:"cscs",occupationCategory:"Window fitter",reference:"TEST-CARD",issuer:"Test Scheme",issueDate:"2025-01-01",expiryDate:"2026-09-20",evidenceDocumentId:"evidence-cscs",verificationStatus:"verified"});assert.equal(state.qualifications[0].status,"expiring");
  const valid=await workforce.qualificationCheck(team.id,{attendanceStart:"2026-09-15",attendanceEnd:"2026-09-18",requiredTypes:["cscs"]});assert.equal(valid.status,"available");assert.equal(valid.members[0].qualifications[0].status,"expiring");
  const invalid=await workforce.qualificationCheck(team.id,{attendanceStart:"2026-09-21",requiredTypes:["cscs"]});assert.equal(invalid.status,"review_required");assert.match(invalid.gaps[0],/not verified/);
  await assert.rejects(()=>workforce.saveQualification({installerId:installer.id,typeCode:"sssts",verificationStatus:"verified"}),error=>error.code==="invalid_installation_workforce");
  const original=state.qualifications[0],renewal={id:'retry-safe-renewal',installerId:installer.id,typeCode:'cscs',renewalOfId:original.id,validFromDate:'2026-09-21',expiryDate:'2027-09-20',verificationStatus:'recorded_unverified'};
  await workforce.saveQualification(renewal);await workforce.saveQualification({...renewal,reference:'Retained on retry'});
  assert.equal((await db.get('SELECT COUNT(*) count FROM installation_installer_qualifications WHERE supersedes_qualification_id=?',original.id)).count,1);
  assert.equal((await db.get('SELECT reference FROM installation_installer_qualifications WHERE id=?',renewal.id)).reference,'Retained on retry');
  assert.equal((await db.get('SELECT evidence_document_id FROM installation_installer_qualifications WHERE id=?',original.id)).evidence_document_id,'evidence-cscs');
  await assert.rejects(()=>workforce.saveQualification({...renewal,typeCode:'sssts'}),/renewal source was not found|belongs to another/);
  await assert.rejects(()=>workforce.saveQualification({id:original.id,installerId:installer.id,typeCode:'sssts'}),/belongs to another/);
  await assert.rejects(()=>workforce.saveQualification({id:original.id,installerId:installer.id,typeCode:'cscs',validFromDate:'2026-02-30'}),/valid qualification dates/);
  await assert.rejects(()=>workforce.qualificationCheck(team.id,{attendanceStart:'2026-02-30'}),/valid attendance dates/);
  await db.run('UPDATE installation_teams SET active=0 WHERE id=?',team.id);assert.match((await workforce.qualificationCheck(team.id,{attendanceStart:'2026-09-15'})).gaps.join(' '),/inactive/);
  await db.run('UPDATE installation_teams SET active=1 WHERE id=?',team.id);await db.run('UPDATE installation_installers SET active=0 WHERE id=?',installer.id);assert.match((await workforce.qualificationCheck(team.id,{attendanceStart:'2026-09-15',requiredTypes:['cscs']})).gaps.join(' '),/No active installers/);
});

test('workforce document migration preserves original evidence, indexes and triggers with transactional rollback',async t=>{
  const {db,at}=await fixture(t);
  await db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,document_type,file_name,checksum,discovered_at,last_seen_at,updated_at) VALUES('original-evidence','fixture','account','original-file','client-a','issued_evidence','Original.pdf','unchanged-checksum',?,?,?)",at,at,at);
  await db.exec("CREATE INDEX test_preserved_document_index ON canonical_documents(checksum);CREATE TRIGGER test_preserved_document_trigger BEFORE UPDATE OF checksum ON canonical_documents BEGIN SELECT RAISE(ABORT,'Preserve issued evidence');END");
  const before=await db.get("SELECT * FROM canonical_documents WHERE id='original-evidence'");
  const failing={get:db.get.bind(db),all:db.all.bind(db),exec:sql=>sql.startsWith('CREATE INDEX test_preserved_document_index')?Promise.reject(Error('Injected post-copy failure')):db.exec(sql)};
  await assert.rejects(()=>migrateWorkforceDocumentOwnership(failing),/Injected post-copy/);assert.deepEqual(await db.get("SELECT * FROM canonical_documents WHERE id='original-evidence'"),before);assert.equal((await db.get('PRAGMA foreign_keys')).foreign_keys,1);
  await migrateWorkforceDocumentOwnership(db);const after=await db.get("SELECT * FROM canonical_documents WHERE id='original-evidence'");delete after.installer_id;assert.deepEqual(after,before);
  await assert.rejects(()=>db.run("UPDATE canonical_documents SET checksum='changed' WHERE id='original-evidence'"),/Preserve issued/);assert.equal((await db.all('PRAGMA foreign_key_check')).length,0);assert.ok(await db.get("SELECT name FROM sqlite_master WHERE name='test_preserved_document_index'"));
});

test('qualification uploads retain confirmed provider receipts through local failure and block uncertain repeat uploads',async t=>{
  const {db}=await fixture(t),workforce=createInstallationWorkforceService(db);
  let state=await workforce.saveCompany({name:'Disposable Evidence Company'});state=await workforce.saveInstaller({companyId:state.companies[0].id,name:'Disposable Evidence Installer'});state=await workforce.saveQualification({id:'evidence-qualification',installerId:state.installers[0].id,typeCode:'cscs'});
  await migrateWorkforceDocumentOwnership(db);await migrateWorkforceDocumentOwnership(db);
  await db.run("INSERT INTO integration_provider_config(provider,workforce_root_folder_id,created_at,updated_at) VALUES('google_workspace','test-root',?,?)",new Date().toISOString(),new Date().toISOString());
  const transport=createDisposableGoogleTransport({files:[{id:'test-root',name:'Disposable Workforce',mimeType:'application/vnd.google-apps.folder',parents:[],trashed:false}]}),workspace={status:async()=>({connected:true,capabilities:{drive:{available:true}},account:{id:'test-account'}}),googleFetch:transport.fetchImpl},provider=createGoogleDriveProvider(workspace),file={originalname:'DISPOSABLE certificate.pdf',mimetype:'application/pdf',buffer:Buffer.from('Disposable evidence bytes'),size:25};
  const evidence=()=>createInstallationQualificationEvidenceService(db,{workspace,provider});
  await db.exec("CREATE TEMP TRIGGER fail_evidence BEFORE INSERT ON canonical_documents BEGIN SELECT RAISE(ABORT,'Disposable local save failure');END");
  await assert.rejects(()=>evidence().upload('evidence-qualification',file),error=>error.code==='qualification_upload_partial');
  assert.equal(transport.binaries.size,1);assert.equal((await db.get('SELECT COUNT(*) count FROM installation_qualification_evidence_history')).count,0);
  await db.exec('DROP TRIGGER fail_evidence');const recovered=await evidence().upload('evidence-qualification',file),replayed=await evidence().upload('evidence-qualification',file);assert.equal(recovered.documentId,replayed.documentId);assert.equal(transport.binaries.size,1);assert.equal((await db.get('SELECT COUNT(*) count FROM installation_qualification_evidence_history')).count,1);
  await workforce.saveQualification({id:'evidence-qualification',installerId:state.installers[0].id,typeCode:'cscs',evidenceDocumentId:null,verificationStatus:'not_supplied'});
  const retained=await db.get("SELECT evidence_document_id,verification_status FROM installation_installer_qualifications WHERE id='evidence-qualification'");assert.equal(retained.evidence_document_id,recovered.documentId,'Stale form retry must not erase a confirmed upload');assert.equal(retained.verification_status,'recorded_unverified');
  const second=await workforce.saveInstaller({companyId:state.companies[0].id,name:'Another Installer'}),other=second.installers.find(item=>item.name==='Another Installer');await assert.rejects(()=>workforce.saveQualification({installerId:other.id,typeCode:'cscs',evidenceDocumentId:recovered.documentId}),/another installer/);
  const uncertain=createInstallationQualificationEvidenceService(db,{workspace,provider:{...provider,uploadFile:async input=>{await provider.uploadFile(input);throw Error('Lost provider reply')}}});
  const changed={...file,originalname:'Second disposable certificate.pdf'};await assert.rejects(()=>uncertain.upload('evidence-qualification',changed),error=>error.code==='qualification_upload_uncertain');await assert.rejects(()=>evidence().upload('evidence-qualification',changed),error=>error.code==='qualification_upload_uncertain');assert.equal(transport.binaries.size,2,'Uncertain retry must not upload a third file');
});

test("Basic RAMS preserves issued revisions and detects later schedule changes",async t=>{
  const{db,root}=await fixture(t),workforce=createInstallationWorkforceService(db);let state=await workforce.saveCompany({name:"Disposable Installer Ltd",postcode:"BB1 1BB"}),company=state.companies[0];state=await workforce.saveInstaller({companyId:company.id,name:"Pat Installer",postcode:"BB1 1BB"});const installer=state.installers[0];state=await workforce.saveTeam({companyId:company.id,name:"Team One",normalCrewSize:1,basePostcode:"BB1 1BB",installerIds:[installer.id]});const team=state.teams[0];
  await db.run("INSERT INTO project_calculator_lab_scenarios(id,estimate_id,name,currency,package_code,origin,revision_number,installation_opening_count,created_at,updated_at) VALUES('scenario-a','estimate-a','Disposable','GBP','full_installation','estimate',1,2,?,?)","2026-09-12T09:00:00Z","2026-09-12T09:00:00Z");await db.run("INSERT INTO project_calculator_lab_options(scenario_id,options_json,updated_at) VALUES('scenario-a',?,?)",JSON.stringify({installationProfile:{selectedTeamId:team.id}}),"2026-09-12T09:00:00Z");
  const safety=createInstallationSafetyService(db,{clock:()=>new Date("2026-09-12T10:00:00Z"),attachmentRoot:path.join(root,"attachments")});let record=await safety.create("estimate-a");assert.equal(record.draft.version,1);const hazards=record.draft.hazards.map((item,index)=>({...item,applies:index===0,controls:index===0?["Use a segregated signed storage area"]:[],reviewed:true}));
  record=await safety.saveDraft(record.id,{siteConditions:{description:"Occupied home; segregate the work area."},hazards,methodSteps:["Brief the team","Protect the public","Install to reviewed drawings"],emergencyArrangements:"Call 999 and use the site meeting point.",publicProtection:"Barriers and a banksman.",wasteArrangements:"Remove waste to the licensed carrier.",reviewerName:"Competent Reviewer",reviewerRole:"Installation Manager",competentPersonConfirmed:true});
  const attendance={attendanceStart:'2026-09-15',attendanceEnd:'2026-09-18',requiredQualificationTypes:['cscs']};
  record=await safety.saveDraft(record.id,attendance);assert.deepEqual(record.draft.sourceSnapshot.attendanceReview,attendance);
  const reopened=createInstallationSafetyService(db,{attachmentRoot:path.join(root,'attachments')});record=await reopened.saveDraft(record.id,{title:record.draft.title});assert.deepEqual(record.draft.sourceSnapshot.attendanceReview,attendance,'A later save must preserve the reviewed dates and qualification requirement');
  await assert.rejects(()=>reopened.issue(record.id,{}),error=>error.code==='rams_qualification_review_required','Issue without repeat fields must still enforce the saved missing CSCS requirement');
  await assert.rejects(()=>reopened.saveDraft(record.id,{attendanceEnd:'2026-09-14'}),/end must be on or after/);await assert.rejects(()=>reopened.saveDraft(record.id,{attendanceStart:'2026-02-30'}),/valid attendance dates/);
  assert.deepEqual((await reopened.get(record.id)).draft.sourceSnapshot.attendanceReview,attendance);
  record=await safety.saveDraft(record.id,{requiredQualificationTypes:[]});
  record=await safety.issue(record.id,{});assert.equal(record.issued.version,1);assert.deepEqual(record.issued.sourceSnapshot.attendanceReview,{...attendance,requiredQualificationTypes:[]});const pdf=await safety.readPdf(record.id,1);assert.ok(pdf.bytes.length>1000);assert.match(pdf.fileName,/RAMS-R1\.pdf/);
  const{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),pdfTask=getDocument({data:new Uint8Array(pdf.bytes),useSystemFonts:true});try{const document=await pdfTask.promise;let text='';for(let page=1;page<=document.numPages;page++)text+=(await(await document.getPage(page)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/2026-09-15 to 2026-09-18/)}finally{await pdfTask.destroy()}
  await db.run("UPDATE estimates SET positions_json=?,updated_at=? WHERE id='estimate-a'",JSON.stringify([{id:"pos-1",positionRef:"W1",quantity:3,widthMm:1200,heightMm:1400}]),"2026-09-12T11:00:00Z");record=await safety.get(record.id);assert.equal(record.status,"review_required");assert.match(record.reviewReasons[0],/changed after/);
  record=await safety.newRevision(record.id);assert.equal(record.draft.version,2);assert.equal(record.issued.version,1);await assert.rejects(()=>db.run("UPDATE installation_rams_versions SET title='Changed' WHERE rams_id=? AND version=1",record.id),/immutable/);
  assert.deepEqual(record.draft.sourceSnapshot.attendanceReview,record.issued.sourceSnapshot.attendanceReview,'An editable successor must retain the reviewed attendance basis');
  const briefInput={personName:"Pat Installer",installerId:installer.id,idempotencyKey:"brief-1"};await safety.acknowledge(record.id,briefInput);await safety.acknowledge(record.id,briefInput);assert.equal((await db.get("SELECT count(*) count FROM installation_rams_briefings")).count,1);
});
