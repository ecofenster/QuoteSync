import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { initializeCommercialIdentitySchema } from "../server/features/commercialIdentity/commercialIdentitySchema.js";
import { createCommercialIdentityService } from "../server/features/commercialIdentity/commercialIdentityService.js";
import { buildClientReferencePlan, createClientReferenceReconciliationService } from "../server/features/commercialIdentity/clientReferenceReconciliationService.js";
import { createCommercialDriveService } from "../server/features/documents/commercialDriveService.js";
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "../server/features/documents/googleDriveProvider.js";
import { initializeLifecycleSchema } from "../server/features/lifecycle/lifecycleSchema.js";
import { createCommunicationRepository } from "../server/features/communications/communicationRepository.js";
import { createCommunicationsService } from "../server/features/communications/communicationsService.js";
import { ECOFENSTER_PROTECTED_CLIENT_IDS, ECOFENSTER_WORKSPACE_OWNER } from "../server/features/commercialIdentity/ecofensterProtectedClientIds.js";

const now = () => new Date("2026-08-27T10:00:00.000Z");
const backup = { verified: true, backupId: "fixture-backup", sha256: "a".repeat(64) };

test("Project folder action uses plain-language creation and reuse wording", async () => {
  const source = await readFile(new URL("../src/features/commercialIdentity/ClientProjectsPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /Create Client \/ Project Folders/);
  assert.match(source, /Creates missing folders in your connected storage\. Existing folders are reused\./);
  assert.match(source, /Creating folders…/);
  assert.doesNotMatch(source, />Provision Files</);
});

test("Ecofenster protection uses the 29 actual canonical Client IDs without seeding a clean workspace", async (t) => {
  assert.equal(ECOFENSTER_PROTECTED_CLIENT_IDS.length, 29);
  assert.equal(new Set(ECOFENSTER_PROTECTED_CLIENT_IDS).size, 29);
  const clean = await fixture(t);
  assert.equal((await clean.get("SELECT COUNT(*) count FROM clients")).count, 0);
  assert.equal((await clean.get("SELECT COUNT(*) count FROM protected_client_identities")).count, 0);

  const populated = await fixture(t, ECOFENSTER_PROTECTED_CLIENT_IDS.map((id, index) => ({ id, name: `Ecofenster protected ${index + 1}`, ref: `AUDIT-${String(index + 1).padStart(3, "0")}` })));
  const protectedRows = await populated.all("SELECT client_id,workspace_owner FROM protected_client_identities ORDER BY client_id");
  assert.equal(protectedRows.length, 29);
  assert.deepEqual(protectedRows.map((row) => row.client_id), [...ECOFENSTER_PROTECTED_CLIENT_IDS].sort());
  assert.ok(protectedRows.every((row) => row.workspace_owner === ECOFENSTER_WORKSPACE_OWNER));
});

async function fixture(t, seed = []) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qs-commercial-identity-"));
  const db = await open({ filename: path.join(root, "fixture.db"), driver: sqlite3.Database });
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,phone TEXT,mobile TEXT,home TEXT,project_name TEXT,created_at TEXT,client_ref TEXT,client_type TEXT,contact_name TEXT,company_name TEXT,customer_address TEXT,project_address TEXT,invoice_address TEXT,invoice_same_as_customer INTEGER,invoice_same_as_project INTEGER,customer_address_json TEXT,project_address_json TEXT,invoice_address_json TEXT,what3words TEXT,latitude REAL,longitude REAL,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,estimate_ref TEXT,base_estimate_ref TEXT,revision_no INTEGER,status TEXT,estimated_order_month TEXT,estimated_order_year INTEGER,defaults_json TEXT,positions_json TEXT,order_meta_json TEXT,outcome TEXT,project_address TEXT,project_address_json TEXT,postcode TEXT,what3words TEXT,latitude REAL,longitude REAL,created_by_user_id TEXT,created_by_name TEXT,created_by_role TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT,FOREIGN KEY(client_id) REFERENCES clients(id));
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_name TEXT,archived_at TEXT);
  `);
  for (const item of seed) await db.run(`INSERT INTO clients(id,name,created_at,client_ref,client_type,deleted_at) VALUES(?,?,?,?,?,NULL)`, item.id, item.name, now().toISOString(), item.ref, "Individual");
  await initializeWorkflowSchema(db);
  await initializeCommercialIdentitySchema(db);
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  return db;
}

test("EF-ENQ is permanent global sequence and qualification explicitly reuses or creates a Client before Project", async (t) => {
  const db = await fixture(t, [{ id: "existing-client", name: "Existing Client", ref: "EF-CL-001" }]);
  const driveCalls = [];
  const service = createCommercialIdentityService(db, { now, driveTransitions: { provisionEnquiry: async (id) => { driveCalls.push(["enquiry", id]); return { status: "linked" }; }, provisionProject: async (id) => { driveCalls.push(["project", id]); return { status: "provisioned" }; } } });
  const first = await service.createEnquiry({ displayName: "Returning Person", projectName: "Garden Room" });
  const second = await service.createEnquiry({ displayName: "New Person", projectName: "New Build" });
  assert.equal(first.enquiryRef, "EF-ENQ-001");
  assert.equal(second.enquiryRef, "EF-ENQ-002");
  assert.doesNotMatch(first.enquiryRef, /2026/);
  const reused = await service.qualifyEnquiry(first.id, { mode: "existing_client", clientId: "existing-client", project: { name: "Garden Room", contextYear: 2026 } });
  assert.equal(reused.client.id, "existing-client");
  assert.equal(reused.client.clientRef, "EF-CL-001");
  assert.equal(reused.enquiry.enquiryRef, "EF-ENQ-001");
  assert.equal(reused.enquiry.driveTransitionStatus, "linked");
  assert.equal(reused.driveProvisioning.status, "provisioned");
  const created = await service.qualifyEnquiry(second.id, { mode: "new_client", client: { name: "New Person" }, project: { name: "New Build", contextYear: 2027 } });
  assert.match(created.client.clientRef, /^EF-CL-\d{3}$/);
  assert.notEqual(created.client.id, "existing-client");
  assert.equal(created.project.contextYear, 2027);
  assert.equal(created.enquiry.driveTransitionStatus, "linked");
  assert.equal(created.driveProvisioning.status, "provisioned");
  assert.equal((await db.get("SELECT COUNT(*) count FROM enquiries WHERE converted_client_id IS NOT NULL")).count, 2);
  assert.equal((await db.get("SELECT COUNT(*) count FROM projects WHERE client_id='existing-client'")).count, 1);
  assert.equal(driveCalls.filter(([kind]) => kind === "project").length, 2);
});

test("Project creation reports a safe Drive provisioning outcome without rolling back the saved Project", async (t) => {
  const db = await fixture(t, [{ id: "client", name: "Disposable Client", ref: "TEST-CL-001" }]);
  let connected = false;
  const pending = createCommercialIdentityService(db, {
    now,
    driveTransitions: {
      async provisionProject() {
        if (connected) return { status: "provisioned" };
        return {
          status: "pending_provider_connection",
          workspaceStatus: { account: { email: "must-not-leak@example.test" }, encryptedRefreshToken: "must-not-leak" },
        };
      },
    },
  });
  const first = await pending.createProject({ id: "pending-project", clientId: "client", name: "Pending Site", contextYear: 2026 });
  assert.deepEqual(first.driveProvisioning, {
    status: "pending_provider_connection",
    code: null,
    message: "Reconnect your connected storage before creating Client / Project folders.",
  });
  assert.doesNotMatch(JSON.stringify(first), /must-not-leak/);
  connected = true;
  assert.deepEqual(await pending.provisionProjectDrive("pending-project"), {
    status: "provisioned",
    code: null,
    message: "Client / Project folders are ready. Existing folders were reused where present.",
  });

  const failing = createCommercialIdentityService(db, {
    now,
    driveTransitions: {
      async provisionProject() {
        throw Object.assign(new Error("provider detail must not be returned"), { code: "provider_create_failed" });
      },
    },
  });
  const second = await failing.createProject({ id: "failed-project", clientId: "client", name: "Failed Site", contextYear: 2026 });
  assert.equal(second.driveProvisioning.status, "failed");
  assert.equal(second.driveProvisioning.code, "provider_create_failed");
  assert.doesNotMatch(second.driveProvisioning.message, /provider detail/);
  assert.equal((await db.get("SELECT COUNT(*) count FROM projects WHERE client_id='client'")).count, 2);
});

test("new Client Project retries reuse the stable Project identity and folder provisioning", async (t) => {
  const db = await fixture(t, [{ id: "client", name: "Disposable Client", ref: "TEST-CL-001" }]);
  let provisions = 0;
  const service = createCommercialIdentityService(db, {
    now,
    driveTransitions: { provisionProject: async () => { provisions += 1; return { status: "provisioned" }; } },
  });
  const first = await service.createProject({ id: "stable-project", clientId: "client", name: "Reviewed Project", contextYear: 2026, siteAddress: "1 Test Road" });
  const retried = await service.createProject({ id: "stable-project", clientId: "client", name: "Reviewed Project", contextYear: 2026, siteAddress: "1 Test Road" });
  assert.equal(first.id, "stable-project");
  assert.equal(retried.id, first.id);
  assert.equal(provisions, 2);
  assert.equal((await db.get("SELECT COUNT(*) count FROM projects WHERE id='stable-project'")).count, 1);
  await assert.rejects(() => service.createProject({ id: "stable-project", clientId: "client", name: "Different Project", contextYear: 2026 }), /different reviewed details/i);
});

test("one Client owns multiple Projects and one Project owns separate Estimates plus revisions", async (t) => {
  const db = await fixture(t, [{ id: "benjamin", name: "Benjamin Henry", ref: "EF-CL-004" }]);
  const service = createCommercialIdentityService(db, { now });
  const pool = await service.createProject({ clientId: "benjamin", name: "Wiveliscombe Pool House", contextYear: 2025 });
  const millbank = await service.createProject({ clientId: "benjamin", name: "Millbank", contextYear: 2026 });
  for (const [id, ref, revision] of [["e1", "EF-EST-2026-001", 0], ["e2", "EF-EST-2026-002", 0], ["e1-r1", "EF-EST-2026-001-01", 1]]) await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,'{}','[]','{}','Open','','{}','', '',NULL,NULL,'u','User','estimator',?,?,NULL)`, id, "benjamin", millbank.id, ref, ref.replace(/-01$/, ""), revision, "Draft", "August", 2026, now().toISOString(), now().toISOString());
  const projects = await service.listProjects({ clientId: "benjamin" });
  assert.deepEqual(new Set(projects.map((item) => item.name)), new Set(["Wiveliscombe Pool House", "Millbank"]));
  assert.equal(projects.find((item) => item.id === millbank.id)?.estimateCount, 3);
  assert.equal((await db.get("SELECT COUNT(DISTINCT estimate_ref) count FROM estimates WHERE project_id=?", millbank.id)).count, 3);
  assert.equal(pool.clientId, "benjamin");
});

test("live Client references advance from the historical high-water mark and are never recycled", async (t) => {
  const db = await fixture(t, [{ id: "first", name: "First", ref: "EF-CL-001" }, { id: "latest", name: "Latest", ref: "EF-CL-027" }]);
  const service = createCommercialIdentityService(db, { now });
  const enquiry = await service.createEnquiry({ displayName: "Next Prospect", projectName: "Next Site" });
  const converted = await service.qualifyEnquiry(enquiry.id, { mode: "new_client", client: { name: "Next Prospect" }, project: { name: "Next Site", contextYear: 2026 } });
  assert.equal(converted.client.clientRef, "EF-CL-028");
});

test("EF-CL allocation remains separate from commercial lifecycle and canonical Orders drive Customer state", async (t) => {
  const db = await fixture(t, [{ id: "client", name: "Prospect", ref: "EF-CL-030" }]);
  const identity = createCommercialIdentityService(db, { now });
  const project = await identity.createProject({ clientId: "client", name: "Site A", contextYear: 2026 });
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES('estimate','client',?,'EF-EST-2026-100','EF-EST-2026-100',0,'Draft','',2026,'{}','[]','{}','Open','','{}','','',NULL,NULL,'u','User','estimator',?,?,NULL)`, project.id, now().toISOString(), now().toISOString());
  assert.notEqual((await db.get("SELECT commercial_lifecycle FROM clients WHERE id='client'")).commercial_lifecycle, "customer");
  await db.run("INSERT INTO orders VALUES('order-1','EF-ORD-2026-001','client',?,'estimate',0,'{}','created',?,?)", project.id, now().toISOString(), now().toISOString());
  assert.equal((await db.get("SELECT commercial_lifecycle FROM clients WHERE id='client'")).commercial_lifecycle, "customer");
  await db.run("INSERT INTO orders VALUES('order-2','EF-ORD-2027-001','client',?,'estimate',0,'{}','created',?,?)", project.id, now().toISOString(), now().toISOString());
  assert.equal((await db.get("SELECT commercial_lifecycle FROM clients WHERE id='client'")).commercial_lifecycle, "repeat_customer");
});

test("canonical Drive provisioning is Year → Client → Project → Estimates → EF-EST and remains provider-ID idempotent", async (t) => {
  const db = await fixture(t, [{ id: "client", name: "John Wingfield", ref: "EF-CL-025" }]);
  const identity = createCommercialIdentityService(db, { now });
  const project = await identity.createProject({ id: "project", clientId: "client", name: "Cairnpark", contextYear: 2026 });
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES('estimate','client','project','EF-EST-2026-001','EF-EST-2026-001',0,'Draft','August',2026,'{}','[]','{}','Open','','{}','','',NULL,NULL,'u','User','estimator',?,?,NULL)`, now().toISOString(), now().toISOString());
  const children = new Map([["estimates-root", []]]), parent = new Map(); let next = 0;
  const provider = {
    async listChildren({ parentId }) { return structuredClone(children.get(parentId) || []); },
    async findFolderByName({ parentId, name }) { return (children.get(parentId) || []).find((item) => item.name === name) || null; },
    async getItem({ fileId }) { const item = [...children.values()].flat().find((candidate) => candidate.id === fileId); if (!item) throw Object.assign(new Error("Not found"), { status: 404 }); return structuredClone(item); },
    async createFolder({ parentId, name, appProperties }) { const item = { id: `folder-${++next}`, name, parents: [parentId], mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE, trashed: false, appProperties }; children.set(parentId, [...(children.get(parentId) || []), item]); children.set(item.id, []); parent.set(item.id, parentId); return item; },
  };
  const workspace = { async status() { return { connected: true, estimatesRootFolderId: "estimates-root", capabilities: { drive: { available: true } }, account: { id: "account" } }; }, async resolvedConfig() { return { stored: { folder_template_json: "{}" } }; } };
  const drive = createCommercialDriveService(db, { provider, workspace, now });
  const projectFirst = await drive.provisionProject("project");
  const createsAfterProject = next;
  const projectSecond = await drive.provisionProject("project");
  assert.equal(projectFirst.folders.find((item) => item.logical_key === "client")?.provider_folder_id, projectSecond.folders.find((item) => item.logical_key === "client")?.provider_folder_id);
  assert.equal(projectFirst.folders.find((item) => item.logical_key === "project")?.provider_folder_id, projectSecond.folders.find((item) => item.logical_key === "project")?.provider_folder_id);
  assert.equal(next, createsAfterProject);
  const first = await drive.provisionEstimate("estimate");
  const createsAfterEstimate = next;
  const second = await drive.provisionEstimate("estimate");
  assert.equal(first.folder.provider_folder_id, second.folder.provider_folder_id);
  assert.equal(next, createsAfterEstimate);
  const paths = (await db.all("SELECT folder_path FROM canonical_drive_folders ORDER BY created_at")).map((row) => row.folder_path);
  assert.ok(paths.includes("2026/EF-CL-025 - John Wingfield/Cairnpark/Estimates/EF-EST-2026-001"));
  assert.equal((await db.get("SELECT COUNT(*) count FROM canonical_drive_folders")).count, 9);
  assert.equal(parent.get(first.folder.provider_folder_id), (await db.get("SELECT provider_folder_id FROM canonical_drive_folders WHERE entity_kind='project' AND entity_id=? AND logical_key='estimates'", project.id)).provider_folder_id);

  const clientMapping = await db.get("SELECT * FROM canonical_drive_folders WHERE entity_kind='project' AND entity_id='project' AND logical_key='client'");
  const projectMapping = await db.get("SELECT * FROM canonical_drive_folders WHERE entity_kind='project' AND entity_id='project' AND logical_key='project'");
  const clientItem = children.get("folder-1").find((item) => item.id === clientMapping.provider_folder_id);
  clientItem.name = "EF-CL-025 - John Wingfield renamed";
  await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
    VALUES('linked-document','google_drive','account','provider-document',?,NULL,'client','project','estimate',NULL,NULL,NULL,'estimate_document','Evidence.pdf','application/pdf',42,?,0,NULL,?,?,?)`, first.folder.provider_folder_id, first.folder.folder_path, now().toISOString(), now().toISOString(), now().toISOString());
  const renamed = await drive.refreshScopeFolderMetadata({ estimateId: "estimate" });
  assert.equal(renamed.status, "refreshed");
  assert.match((await db.get("SELECT folder_path FROM canonical_documents WHERE id='linked-document'")).folder_path, /EF-CL-025 - John Wingfield renamed/);
  assert.equal((await db.get("SELECT name FROM clients WHERE id='client'")).name, "John Wingfield");

  const yearItems = children.get("folder-1"), oldIndex = yearItems.findIndex((item) => item.id === clientMapping.provider_folder_id);
  yearItems[oldIndex].trashed = true;
  const replacement = { id: "replacement-client-folder", name: "EF-CL-025 - John Wingfield corrected", parents: ["folder-1"], mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE, trashed: false };
  yearItems.push(replacement); children.set(replacement.id, []);
  const oldClientChildren = children.get(clientMapping.provider_folder_id), projectIndex = oldClientChildren.findIndex((item) => item.id === projectMapping.provider_folder_id), movedProject = oldClientChildren.splice(projectIndex, 1)[0];
  movedProject.parents = [replacement.id]; children.get(replacement.id).push(movedProject);
  const createsBeforeRebind = next, folderCountBeforeRebind = (await db.get("SELECT COUNT(*) count FROM canonical_drive_folders")).count;
  const rebound = await drive.refreshScopeFolderMetadata({ projectId: "project" });
  const currentClientMapping = await db.get("SELECT provider_folder_id,name,folder_path FROM canonical_drive_folders WHERE entity_kind='project' AND entity_id='project' AND logical_key='client'");
  assert.equal(rebound.rebound, 1);
  assert.deepEqual(currentClientMapping, { provider_folder_id: replacement.id, name: replacement.name, folder_path: `2026/${replacement.name}` });
  assert.equal((await db.get("SELECT provider_folder_id FROM canonical_drive_folders WHERE entity_kind='project' AND entity_id='project' AND logical_key='project'")).provider_folder_id, projectMapping.provider_folder_id);
  assert.equal((await db.get("SELECT provider_file_id,provider_folder_id FROM canonical_documents WHERE id='linked-document'")).provider_file_id, "provider-document");
  assert.equal(next, createsBeforeRebind);
  assert.equal((await db.get("SELECT COUNT(*) count FROM canonical_drive_folders")).count, folderCountBeforeRebind);
});

test("Enquiry Drive identity uses the configured Enquiries root without a year folder", async (t) => {
  const db = await fixture(t);
  const identity = createCommercialIdentityService(db, { now });
  const enquiry = await identity.createEnquiry({ displayName: "Prospect Person", companyName: "Prospect Company" });
  const children = new Map([["enquiries-root", []]]); let creates = 0;
  const provider = {
    async listChildren({ parentId }) { return structuredClone(children.get(parentId) || []); },
    async findFolderByName({ parentId, name }) { return (children.get(parentId) || []).find((item) => item.name === name) || null; },
    async createFolder({ parentId, name, appProperties }) { const item = { id: `enquiry-folder-${++creates}`, name, mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE, appProperties }; children.set(parentId, [...(children.get(parentId) || []), item]); children.set(item.id, []); return item; },
  };
  const workspace = { async status() { return { connected: true, enquiriesRootFolderId: "enquiries-root", capabilities: { drive: { available: true } }, account: { id: "account" } }; } };
  const drive = createCommercialDriveService(db, { provider, workspace, now });
  const first = await drive.provisionEnquiry(enquiry.id), second = await drive.provisionEnquiry(enquiry.id);
  assert.equal(first.folder.provider_folder_id, second.folder.provider_folder_id);
  assert.equal(first.folder.folder_path, "EF-ENQ-001 - Prospect Company");
  assert.doesNotMatch(first.folder.folder_path, /2026/);
  assert.equal(creates, 1);
  children.get(first.folder.provider_folder_id).push({ id: "enquiry-file", name: "Requirements.pdf", mimeType: "application/pdf", size: "12", version: "1", modifiedTime: now().toISOString() });
  assert.equal((await drive.discoverEnquiry(enquiry.id)).filesDiscovered, 1);
  assert.equal((await db.get("SELECT enquiry_id FROM canonical_documents WHERE provider_file_id='enquiry-file'")).enquiry_id, enquiry.id);
});

test("reviewed Gmail attachments file once into the qualified Project Drawings (Client) folder", async (t) => {
  const db=await fixture(t);await initializeLifecycleSchema(db);
  const identity=createCommercialIdentityService(db,{now}),enquiry=await identity.createEnquiry({displayName:"Test Contact",email:"customer@example.test",projectName:"Garden Studio"});
  const repository=createCommunicationRepository(db),message=await repository.save({id:"message-local",provider:"google_workspace",providerMessageId:"gmail-message",threadId:"gmail-thread",direction:"inbound",folder:"inbox",status:"received",from:["Test Contact <customer@example.test>"],to:["sales@example.test"],cc:[],bcc:[],subject:"Garden Studio",bodyHtml:"",bodyText:"Please quote",links:[{kind:"enquiry",id:enquiry.id}],attachments:[{id:"attachment-local",fileName:"site drawing.pdf",mediaType:"application/pdf",sizeBytes:7,providerAttachmentId:"gmail-attachment"}]});
  await db.run("INSERT INTO enquiry_email_intakes(id,enquiry_id,communication_message_id,provider_message_id,reviewed_brief,created_by,created_at) VALUES('intake',?,?,?,?,?,?)",enquiry.id,message.id,"gmail-message","Reviewed requirements","staff",now().toISOString());
  await db.run("INSERT INTO enquiry_intake_attachments(id,enquiry_email_intake_id,communication_attachment_id,file_name,storage_status) VALUES('intake-file','intake','attachment-local','site drawing.pdf','pending')");
  const qualifiedIdentity=createCommercialIdentityService(db,{now,driveTransitions:{provisionProject:async()=>({status:"provisioned"}),storeReviewedEnquiryAttachments:async()=>({status:"deferred"})}});
  const qualified=await qualifiedIdentity.qualifyEnquiry(enquiry.id,{mode:"new_client",client:{name:"Test Contact"},project:{id:"project",name:"Garden Studio",contextYear:2026}});
  const children=new Map([["root",[]]]);let folderIndex=0,uploads=0;
  const provider={async listChildren({parentId}){return structuredClone(children.get(parentId)||[])},async findFolderByName({parentId,name}){return(children.get(parentId)||[]).find(item=>item.name===name)||null},async createFolder({parentId,name,appProperties}){const item={id:`folder-${++folderIndex}`,name,mimeType:GOOGLE_DRIVE_FOLDER_MIME_TYPE,appProperties};children.set(parentId,[...(children.get(parentId)||[]),item]);children.set(item.id,[]);return item},async uploadFile({parentId,fileName,mediaType,bytes,appProperties}){uploads+=1;assert.equal(Buffer.from(bytes).toString(),"drawing");const item={id:"drive-file",name:fileName,mimeType:mediaType,size:String(bytes.length),version:"1",md5Checksum:"hash",webViewLink:"https://drive.invalid/file",appProperties};children.set(parentId,[...(children.get(parentId)||[]),item]);return item}};
  const workspace={async status(){return{connected:true,estimatesRootFolderId:"root",capabilities:{drive:{available:true}},account:{id:"account"}}},async resolvedConfig(){return{stored:{folder_template_json:"{}"}}}};
  const drive=createCommercialDriveService(db,{provider,workspace,sourceMailProvider:{async attachment(messageId,attachmentId){assert.equal(messageId,"gmail-message");assert.equal(attachmentId,"gmail-attachment");return Buffer.from("drawing")}},now});
  const first=await drive.storeReviewedEnquiryAttachments(enquiry.id,qualified.project.id),second=await drive.storeReviewedEnquiryAttachments(enquiry.id,qualified.project.id);
  assert.equal(first.status,"stored",JSON.stringify(first));assert.equal(first.stored,1);assert.equal(second.stored,1);assert.equal(uploads,1);
  const stored=await db.get("SELECT d.document_type,d.enquiry_id,d.client_id,d.project_id,d.folder_path,a.storage_status,a.canonical_document_id FROM canonical_documents d JOIN enquiry_intake_attachments a ON a.canonical_document_id=d.id WHERE d.provider_file_id='drive-file'");
  assert.equal(stored.document_type,"client_drawing");assert.equal(stored.enquiry_id,enquiry.id);assert.equal(stored.project_id,qualified.project.id);assert.equal(stored.storage_status,"stored");assert.match(stored.folder_path,/Drawings \(Client\)$/);
});

test("reviewed existing-Client email filing creates Estimate → Suppliers → named supplier folders and reuses the genuine document", async (t) => {
  const db=await fixture(t,[{id:"client",name:"Disposable Stuart",ref:"EF-CL-928"}]);
  const identity=createCommercialIdentityService(db,{now}),project=await identity.createProject({id:"project",clientId:"client",name:"Disposable Red House",contextYear:2026});
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES('estimate','client','project','EF-EST-2026-957','EF-EST-2026-957',0,'Draft','',2026,'{}','[]','{}','Open','','{}','','',NULL,NULL,'u','User','estimator',?,?,NULL)`,now().toISOString(),now().toISOString());
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES('estimate-legacy','client','project','EF-EST-2026-958','EF-EST-2026-958',0,'Draft','',2026,'{}','[]','{}','Open','','{}','','',NULL,NULL,'u','User','estimator',?,?,NULL)`,now().toISOString(),now().toISOString());
  await db.exec("CREATE TABLE supplier_commercial_defaults(supplier_code TEXT PRIMARY KEY,supplier_name TEXT NOT NULL)");
  await db.run("INSERT INTO supplier_commercial_defaults VALUES('ZYLE','Zyle Fenster')");
  const children=new Map([["root",[]]]);let folders=0,uploads=0;
  const provider={async listChildren({parentId}){return structuredClone(children.get(parentId)||[])},async findFolderByName({parentId,name}){return(children.get(parentId)||[]).find(item=>item.name===name)||null},async createFolder({parentId,name,appProperties}){const item={id:`folder-${++folders}`,name,mimeType:GOOGLE_DRIVE_FOLDER_MIME_TYPE,appProperties};children.set(parentId,[...(children.get(parentId)||[]),item]);children.set(item.id,[]);return item},async uploadFile({parentId,fileName,mediaType,bytes,appProperties}){uploads+=1;const item={id:`provider-document-${uploads}`,name:fileName,mimeType:mediaType,size:String(bytes.length),version:"1",md5Checksum:"hash",webViewLink:`https://drive.invalid/provider-document-${uploads}`,appProperties};children.set(parentId,[...(children.get(parentId)||[]),item]);return item}};
  const workspace={async status(){return{connected:true,state:"connected",estimatesRootFolderId:"root",scopes:[],capabilities:{gmail:{available:true},drive:{available:true}},account:{id:"account"}}},async resolvedConfig(){return{stored:{folder_template_json:"{}"}}}};
  const drive=createCommercialDriveService(db,{provider,workspace,now});let providerRead=0,currentDocumentId="";
  const actualAttachmentShape=()=>{providerRead+=1;currentDocumentId=`ANGjdJ-${String(providerRead).padEnd(418,"d")}`;return[
    ...Array.from({length:16},(_,index)=>({sourcePartId:`0.${index+1}`,fileName:"image.png",mediaType:"image/png",sizeBytes:[1240,8200,837,780,1032,1086,929,694][index%8],providerAttachmentId:`ANGjdJ-${`${providerRead}-${index}`.padEnd(396,"i")}`,contentId:index<8?`ii_1a07b70b3b8cb971f${161+index}`:`retained-cid-${index}`,inline:true})),
    {sourcePartId:"1",fileName:"EF-CL-028 Stuart Gilks, Ecotherm +.docx",mediaType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",sizeBytes:115091,providerAttachmentId:currentDocumentId,contentId:null,inline:false},
  ]};
  const gmail={async readMessage(){return{provider:"google_workspace",providerMessageId:"disposable-message",threadId:"disposable-thread",direction:"inbound",folder:"inbox",status:"received",from:["Viktorija <info@zylefenster.example>"],to:["sales@example.test"],cc:[],bcc:[],subject:"EF-CL-928: Disposable Stuart",bodyHtml:"<p>Please find the price offer attached.</p>",bodyText:"Please find the price offer attached.",links:[],sentAt:"2026-09-09T13:01:47.000Z",attachments:actualAttachmentShape()}},async attachment(messageId,attachmentId){assert.equal(messageId,"disposable-message");assert.equal(attachmentId,currentDocumentId);return Buffer.from("genuine supplier evidence")}};
  const communications=createCommunicationsService(db,{workspace,gmail,drive,environment:{}}),options=await communications.assignmentOptions("disposable-message");
  assert.equal(options.attachments.length,1);assert.equal(options.attachments[0].fileName,"EF-CL-028 Stuart Gilks, Ecotherm +.docx");
  const selection={clientId:"client",projectId:project.id,estimateId:"estimate",supplierId:"ZYLE",attachmentId:options.attachments[0].id,conflictsReviewed:true};
  const first=await communications.assignSupplierDocument("disposable-message",selection),second=await communications.assignSupplierDocument("disposable-message",selection);
  assert.equal(first.status,"stored");assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);assert.equal(uploads,1);
  assert.match(first.folderPath,/EF-CL-928 - Disposable Stuart\/Disposable Red House\/Estimates\/EF-EST-2026-957\/Suppliers\/Zyle Fenster$/);
  assert.equal(first.fileName,"EF-CL-028 Stuart Gilks, Ecotherm +.docx");assert.ok(providerRead>=3);
  assert.equal([...children.values()].flat().filter(item=>item.name==="Supplier").length,0);
  const stored=await db.get("SELECT client_id,project_id,estimate_id,supplier_id,document_type,folder_path FROM canonical_documents WHERE provider_file_id='provider-document-1'");
  assert.deepEqual({...stored},{client_id:"client",project_id:"project",estimate_id:"estimate",supplier_id:"ZYLE",document_type:"supplier_quotation",folder_path:first.folderPath});
  const legacyEstimate=await drive.provisionEstimate("estimate-legacy"),legacyRoot={id:"legacy-supplier-root",name:"Supplier",mimeType:GOOGLE_DRIVE_FOLDER_MIME_TYPE};
  children.set(legacyEstimate.folder.provider_folder_id,[...(children.get(legacyEstimate.folder.provider_folder_id)||[]),legacyRoot]);children.set(legacyRoot.id,[]);
  const legacy=await drive.storeCommunicationSupplierDocument({clientId:"client",projectId:project.id,estimateId:"estimate-legacy",supplierCode:"ZYLE",communicationAttachmentId:"legacy-message_document",providerMessageId:"legacy-message",providerAttachmentId:"legacy-document",fileName:"Zyle quotation.pdf",mediaType:"application/pdf",bytes:Buffer.from("genuine supplier evidence")});
  assert.match(legacy.folderPath,/EF-EST-2026-958\/Supplier\/Zyle Fenster$/);
  const legacyRoots=(children.get(legacyEstimate.folder.provider_folder_id)||[]).filter(item=>["Supplier","Suppliers"].includes(item.name));
  assert.deepEqual(legacyRoots.map(item=>item.name),["Supplier"]);
});

test("canonical Drive discovery understands nested Project/Estimate folders and reconciles files idempotently by provider ID", async (t) => {
  const db = await fixture(t, [{ id: "client", name: "John Wingfield", ref: "EF-CL-025" }]);
  const identity = createCommercialIdentityService(db, { now });
  await identity.createProject({ id: "project", clientId: "client", name: "Cairnpark", contextYear: 2026 });
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES('estimate','client','project','EF-EST-2026-001','EF-EST-2026-001',0,'Draft','August',2026,'{}','[]','{}','Open','','{}','','',NULL,NULL,'u','User','estimator',?,?,NULL)`, now().toISOString(), now().toISOString());
  const folder = (id, name) => ({ id, name, mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE, modifiedTime: now().toISOString() });
  const file = (id, name, version) => ({ id, name, mimeType: "application/pdf", size: "42", version, modifiedTime: now().toISOString(), webViewLink: `https://drive.invalid/${id}` });
  const children = new Map([
    ["root", [folder("year", "2026")]], ["year", [folder("client-folder", "EF-CL-025 - John Wingfield")]], ["client-folder", [folder("project-folder", "Cairnpark")]],
    ["project-folder", [folder("drawings", "Drawings (Client)"), folder("estimates-folder", "Estimates")]], ["drawings", [file("drawing", "Survey.pdf", "1")]],
    ["estimates-folder", [folder("estimate-folder", "EF-EST-2026-001 - Zyle Fenster")]], ["estimate-folder", [file("quote", "Quotation.pdf", "3")]],
  ]);
  const provider = { async listChildren({ parentId }) { return structuredClone(children.get(parentId) || []); } };
  const workspace = { async status() { return { connected: true, estimatesRootFolderId: "root", capabilities: { drive: { available: true } }, account: { id: "account" } }; } };
  const service = createCommercialDriveService(db, { provider, workspace, now });
  assert.equal((await service.discoverProject("project")).status, "synced");
  await service.discoverProject("project");
  assert.equal((await db.get("SELECT COUNT(*) count FROM canonical_documents")).count, 2);
  assert.equal((await db.get("SELECT estimate_id FROM canonical_documents WHERE provider_file_id='quote'")).estimate_id, "estimate");
  assert.equal((await db.get("SELECT estimate_id FROM canonical_documents WHERE provider_file_id='drawing'")).estimate_id, null);
  const renamed = children.get("drawings")[0]; renamed.name = "Survey reviewed.pdf"; renamed.version = "2";
  await service.discoverProject("project");
  const refreshed = await db.get("SELECT file_name,provider_version,project_id,client_id FROM canonical_documents WHERE provider_file_id='drawing'");
  assert.deepEqual(refreshed, { file_name: "Survey reviewed.pdf", provider_version: "2", project_id: "project", client_id: "client" });
  children.set("estimate-folder", []);
  await service.discoverProject("project");
  assert.ok((await db.get("SELECT removed_at FROM canonical_documents WHERE provider_file_id='quote'")).removed_at);
  assert.equal((await db.get("SELECT COUNT(*) count FROM canonical_drive_folders WHERE provider_folder_id IN ('drawings','estimates-folder','estimate-folder')")).count, 3);
});

test("controlled reconciliation handles protected approval, swap/cycle, demo isolation, creation and relationship preservation", async (t) => {
  const db = await fixture(t, [
    { id: "a", name: "A", ref: "EF-CL-001" }, { id: "b", name: "B", ref: "EF-CL-002" }, { id: "c", name: "C", ref: "EF-CL-003" }, { id: "demo", name: "Demo", ref: "EF-CL-009" },
  ]);
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES('linked','a',NULL,'EF-EST-2026-100','EF-EST-2026-100',0,'Draft','',2026,'{}','[]','{}','Open','','{}','','',NULL,NULL,'u','User','estimator',?,?,NULL)`, now().toISOString(), now().toISOString());
  const actions = [
    { actionId: "a", type: "renumber", clientId: "a", targetRef: "EF-CL-002" },
    { actionId: "b", type: "renumber", clientId: "b", targetRef: "EF-CL-003" },
    { actionId: "c", type: "renumber", clientId: "c", targetRef: "EF-CL-001" },
    { actionId: "demo", type: "demo_isolate", clientId: "demo", targetRef: "DEMO-CL-010", namespace: "demo" },
    { actionId: "new", type: "create", targetRef: "EF-CL-027", name: "New Prospect", lifecycle: "unknown_review" },
    { actionId: "review", type: "review", targetRef: "EF-CL-020", reason: "Unresolved" },
  ];
  const planInput = { version: "fixture-v1", driveInventoryHash: "drive-v1", actions };
  const expected = buildClientReferencePlan(planInput);
  const service = createClientReferenceReconciliationService(db, { now });
  await service.prepare(planInput);
  await assert.rejects(() => service.execute({ planHash: expected.planHash, driveInventoryHash: "drive-v1", approval: { approvedBy: "tester", planHash: expected.planHash }, backupEvidence: backup }), (error) => error.code === "protected_client_approval_required");
  const result = await service.execute({ planHash: expected.planHash, driveInventoryHash: "drive-v1", approval: { approvedBy: "tester", planHash: expected.planHash, protectedClientIds: ["a", "b", "c"] }, backupEvidence: backup });
  assert.equal(result.status, "executed");
  assert.deepEqual(Object.fromEntries((await db.all("SELECT id,client_ref FROM clients WHERE id IN ('a','b','c','demo')")).map((row) => [row.id, row.client_ref])), { a: "EF-CL-002", b: "EF-CL-003", c: "EF-CL-001", demo: "DEMO-CL-010" });
  assert.equal((await db.get("SELECT client_id FROM estimates WHERE id='linked'")).client_id, "a");
  assert.equal((await db.get("SELECT commercial_lifecycle FROM clients WHERE client_ref='EF-CL-027'")).commercial_lifecycle, "unknown_review");
  assert.equal((await db.get("SELECT COUNT(*) count FROM clients WHERE client_ref='EF-CL-020'")).count, 0);
  await assert.rejects(() => db.run("INSERT INTO clients(id,name,client_ref,reference_namespace,created_at) VALUES('duplicate','Duplicate','EF-CL-001','live',?)", now().toISOString()), /UNIQUE constraint failed/);
});

test("stale plan and injected failure reject safely with transactional rollback", async (t) => {
  const db = await fixture(t, [{ id: "x", name: "X", ref: "EF-CL-030" }, { id: "y", name: "Y", ref: "EF-CL-031" }]);
  const staleInput = { version: "stale", driveInventoryHash: "drive-stale", actions: [{ type: "renumber", clientId: "x", targetRef: "EF-CL-032" }] };
  const stalePlan = buildClientReferencePlan(staleInput), staleService = createClientReferenceReconciliationService(db, { now });
  await staleService.prepare(staleInput);
  await db.run("UPDATE clients SET name='Changed after plan' WHERE id='x'");
  // Names are not identity/reference mutation inputs, so the plan remains valid.
  await db.run("UPDATE clients SET client_ref='EF-CL-033' WHERE id='x'");
  await assert.rejects(() => staleService.execute({ planHash: stalePlan.planHash, driveInventoryHash: "drive-stale", approval: { approvedBy: "tester", planHash: stalePlan.planHash }, backupEvidence: backup }), (error) => error.code === "reconciliation_plan_stale");
  await db.run("UPDATE clients SET client_ref='EF-CL-030' WHERE id='x'");
  const rollbackInput = { version: "rollback", driveInventoryHash: "drive-rollback", actions: [{ type: "renumber", clientId: "x", targetRef: "EF-CL-031" }, { type: "renumber", clientId: "y", targetRef: "EF-CL-030" }] };
  const rollbackPlan = buildClientReferencePlan(rollbackInput), rollbackService = createClientReferenceReconciliationService(db, { now, failAfterAction: 1 });
  await rollbackService.prepare(rollbackInput);
  await assert.rejects(() => rollbackService.execute({ planHash: rollbackPlan.planHash, driveInventoryHash: "drive-rollback", approval: { approvedBy: "tester", planHash: rollbackPlan.planHash }, backupEvidence: backup }), (error) => error.code === "reconciliation_injected_failure");
  assert.deepEqual(Object.fromEntries((await db.all("SELECT id,client_ref FROM clients ORDER BY id")).map((row) => [row.id, row.client_ref])), { x: "EF-CL-030", y: "EF-CL-031" });
});

test("post-migration validation executes inside the transaction and can roll back every action", async (t) => {
  const db = await fixture(t, [{ id: "x", name: "X", ref: "EF-CL-030" }, { id: "y", name: "Y", ref: "EF-CL-031" }]);
  const input = { version: "post-validation", driveInventoryHash: "drive-post-validation", actions: [{ type: "renumber", clientId: "x", targetRef: "EF-CL-031" }, { type: "renumber", clientId: "y", targetRef: "EF-CL-030" }] };
  const plan = buildClientReferencePlan(input);
  const service = createClientReferenceReconciliationService(db, { now, validateBeforeCommit: async ({ db: transactionDb }) => {
    assert.equal((await transactionDb.get("SELECT client_ref FROM clients WHERE id='x'")).client_ref, "EF-CL-031");
    throw Object.assign(new Error("Post-validation rejected fixture."), { code: "post_validation_failed" });
  } });
  await service.prepare(input);
  await assert.rejects(() => service.execute({ planHash: plan.planHash, driveInventoryHash: input.driveInventoryHash, approval: { approvedBy: "tester", planHash: plan.planHash, protectedClientIds: ["x", "y"] }, backupEvidence: backup }), (error) => error.code === "post_validation_failed");
  assert.deepEqual(Object.fromEntries((await db.all("SELECT id,client_ref FROM clients ORDER BY id")).map((row) => [row.id, row.client_ref])), { x: "EF-CL-030", y: "EF-CL-031" });
});

test("protection remains bound to reviewed internal IDs after a protected reference is reassigned", async (t) => {
  const db = await fixture(t, [{ id: "historical-five", name: "Historical Five", ref: "EF-CL-005" }]);
  const input = { version: "protected-internal-id", driveInventoryHash: "drive-protected", actions: [
    { type: "renumber", clientId: "historical-five", sourceRef: "EF-CL-005", targetRef: "EF-CL-020" },
    { type: "create", targetRef: "EF-CL-005", name: "New Five", lifecycle: "unknown_review" },
  ] };
  const plan = buildClientReferencePlan(input), service = createClientReferenceReconciliationService(db, { now });
  await service.prepare(input);
  await service.execute({ planHash: plan.planHash, driveInventoryHash: input.driveInventoryHash, approval: { approvedBy: "tester", planHash: plan.planHash, protectedClientIds: ["historical-five"] }, backupEvidence: backup });
  const newFive = await db.get("SELECT id FROM clients WHERE client_ref='EF-CL-005'");
  await db.run("INSERT INTO protected_client_identities(client_id,protection_reason,created_at) VALUES(?,?,?)", newFive.id, "Former bootstrap defect fixture", now().toISOString());
  const repaired = await service.reconcileProtectedIdentities({ planHash: plan.planHash, approval: { approvedBy: "tester", planHash: plan.planHash }, expectedClientIds: ["historical-five"] });
  assert.equal(repaired.repaired, 1);
  await initializeCommercialIdentitySchema(db);
  assert.deepEqual((await db.all("SELECT client_id FROM protected_client_identities")), [{ client_id: "historical-five" }]);
  assert.equal((await db.get("SELECT COUNT(*) count FROM client_reference_reconciliation_journal WHERE plan_id=?", repaired.planId)).count, 3);
});

test("an approved reconciliation matrix is versioned and resolves reviewed identities without live evidence fixtures", () => {
  const actions = [
    { actionId: "keep", type: "keep", clientId: "client-keep", targetRef: "EF-CL-001" },
    { actionId: "move", type: "renumber", clientId: "client-move", sourceRef: "EF-CL-005", targetRef: "EF-CL-020" },
    { actionId: "create", type: "create", targetRef: "EF-CL-005", name: "Reviewed Prospect", lifecycle: "unknown_review" },
  ];
  const plan = buildClientReferencePlan({ version: "fixture-approved-v1", driveInventoryHash: "b".repeat(64), actions });
  assert.match(plan.planHash, /^[a-f0-9]{64}$/);
  assert.equal(plan.driveInventoryHash, "b".repeat(64));
  assert.deepEqual(plan.actions, actions);
});
