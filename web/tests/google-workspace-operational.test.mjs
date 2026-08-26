import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { createGoogleWorkspaceService, GOOGLE_WORKSPACE_SCOPES } from "../server/features/integrations/googleWorkspaceService.js";
import { createGmailProvider, mapGmailMessage } from "../server/features/communications/gmailProvider.js";
import { createDriveIntegrationService } from "../server/features/documents/driveIntegrationService.js";

const encryptionKey=Buffer.alloc(32,11);
const response=(body,{ok=true,status=200}={})=>({ok,status,json:async()=>body});
const encoded=(value)=>Buffer.from(value).toString("base64url");
const opaqueFixture=(byte)=>Buffer.alloc(24,byte).toString("base64url");

async function databaseFixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-google-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,estimate_ref TEXT,revision_no INTEGER,created_at TEXT,deleted_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_attachments(id TEXT PRIMARY KEY,estimate_id TEXT,original_file_name TEXT,media_type TEXT,storage_key TEXT);
  `);
  await initializeWorkflowSchema(db);
  await db.run("INSERT INTO clients VALUES(?,?,?,?,NULL)","client-1","Ada Client","ada@example.com","Garden Room");
  await db.run("INSERT INTO estimates VALUES(?,?,?,?,?,NULL)","estimate-1","client-1","EST-100",2,"2026-08-26T09:00:00.000Z");
  await db.run("INSERT INTO supplier_quotes VALUES(?,?,?,NULL)","quote-1","estimate-1","Zyle Fenster");
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return {db,root};
}

test("Gmail maps mailbox content, folders, search, drafts, replies/forwards and attachments through provider-neutral data",async()=>{
  const calls=[];
  const message={id:"message-1",threadId:"thread-1",labelIds:["INBOX"],internalDate:"1787731200000",payload:{headers:[{name:"From",value:"Client <client@example.com>"},{name:"To",value:"sales@example.com"},{name:"Subject",value:"Quotation question"}],mimeType:"multipart/mixed",parts:[{mimeType:"text/plain",body:{data:encoded("Please call me")}}, {filename:"drawing.pdf",mimeType:"application/pdf",body:{attachmentId:"attachment-1",size:123}}]}};
  const workspace={googleFetch:async(url,options={})=>{const value=String(url);calls.push({value,options});if(value.includes("/messages?"))return response({messages:[{id:"message-1"}]});if(value.includes("/drafts?"))return response({drafts:[{id:"draft-1",message:{id:"message-1"}}]});if(value.includes("/messages/message-1?"))return response(message);if(value.includes("/attachments/attachment-1"))return response({data:encoded("pdf-bytes")});if(value.endsWith("/drafts"))return response({id:"draft-created",message:{id:"draft-message",threadId:"thread-1"}});if(value.endsWith("/messages/send"))return response({id:"sent-message",threadId:"thread-1"});throw new Error(`Unexpected request ${value}`)}};
  const gmail=createGmailProvider(workspace,{pageSize:10});
  const inbox=await gmail.list({folder:"inbox",query:"from:client@example.com"});assert.equal(inbox.messages[0].direction,"inbound");assert.equal(inbox.messages[0].bodyText,"Please call me");assert.equal(inbox.messages[0].attachments[0].providerAttachmentId,"attachment-1");
  await gmail.list({folder:"sent",query:"quotation"});await gmail.list({folder:"drafts",query:"quotation"});
  const draft=await gmail.createDraft({to:["client@example.com"],subject:"Draft quotation",bodyHtml:"<p>Draft</p>",attachments:[]});
  const sent=await gmail.send({to:["client@example.com"],subject:"Re: Quotation question",bodyHtml:"<p>Reply</p>",threadId:"thread-1",inReplyTo:"message-1",references:"message-1",attachments:[{fileName:"quote.pdf",mediaType:"application/pdf",bytes:Buffer.from("quote")} ]});
  assert.equal(draft.providerDraftId,"draft-created");assert.equal(sent.providerMessageId,"sent-message");assert.equal((await gmail.attachment("message-1","attachment-1")).toString(),"pdf-bytes");
  const searchCalls=calls.filter(call=>call.value.includes("?"));assert.ok(searchCalls.some(call=>new URL(call.value).searchParams.get("q")==="from:client@example.com"));assert.ok(searchCalls.some(call=>new URL(call.value).searchParams.get("labelIds")==="SENT"));
  const sendCall=calls.find(call=>call.value.endsWith("/messages/send"));const mime=Buffer.from(JSON.parse(sendCall.options.body).raw,"base64url").toString();assert.match(mime,/In-Reply-To: message-1/);assert.match(mime,/filename="quote.pdf"/);
  assert.equal(mapGmailMessage(message).provider,"google_workspace");
});

test("Google OAuth configuration and tokens are encrypted, reconnectable and disconnectable",async t=>{
  const accessFixture=opaqueFixture(21),refreshFixture=opaqueFixture(22),secretFixture=opaqueFixture(23);
  const {db}=await databaseFixture(t),fetchImpl=async url=>String(url).includes("oauth2.googleapis.com")?response({access_token:accessFixture,refresh_token:refreshFixture,token_type:"Bearer",expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(" ")}):response({sub:"account-1",email:"sales@example.com",name:"Sales"});
  const service=createGoogleWorkspaceService(db,{fetchImpl,environment:{},encryptionKey});
  let status=await service.configure({clientId:"fixture-client",clientSecret:secretFixture,redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback",estimatesRootFolderId:"estimates-root",ordersRootFolderId:"orders-root",folderTemplate:{pictures:"Site Pictures"}});
  assert.equal(status.configured,true);assert.equal(status.connected,false);assert.equal(JSON.stringify(status).includes("plain-client-secret"),false);
  const oauth=await service.beginOAuth();assert.equal(new URL(oauth.authorizationUrl).searchParams.get("access_type"),"offline");assert.ok(GOOGLE_WORKSPACE_SCOPES.every(scope=>new URL(oauth.authorizationUrl).searchParams.get("scope").includes(scope)));
  status=await service.completeOAuth({state:oauth.state,code:"authorisation-code"});assert.equal(status.connected,true);assert.equal(status.account.email,"sales@example.com");
  const persisted=JSON.stringify(await db.get("SELECT * FROM integration_oauth_connections WHERE provider='google_workspace'"));const configured=JSON.stringify(await db.get("SELECT * FROM integration_provider_config WHERE provider='google_workspace'"));
  assert.equal(persisted.includes(accessFixture),false);assert.equal(persisted.includes(refreshFixture),false);assert.equal(configured.includes(secretFixture),false);
  status=await service.disconnect();assert.equal(status.connected,false);assert.equal(status.configured,true);
});

test("Drive provisions the canonical hierarchy once, adds suppliers dynamically and files each supplier document once",async t=>{
  const {db,root}=await databaseFixture(t);let folderCreates=0,fileUploads=0;
  const accessFixture=opaqueFixture(31),refreshFixture=opaqueFixture(32),secretFixture=opaqueFixture(33);
  const fetchImpl=async(url,options={})=>{const value=String(url);if(value.includes("oauth2.googleapis.com"))return response({access_token:accessFixture,refresh_token:refreshFixture,token_type:"Bearer",expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(" ")});if(value.includes("openidconnect.googleapis.com"))return response({sub:"account-1",email:"sales@example.com",name:"Sales"});if(value.startsWith("https://www.googleapis.com/upload/drive/v3/files")){fileUploads+=1;return response({id:`drive-file-${fileUploads}`,name:"supplier-quote.pdf"})}if(value.startsWith("https://www.googleapis.com/drive/v3/files")&&(!options.method||options.method==="GET"))return response({files:[]});if(value.startsWith("https://www.googleapis.com/drive/v3/files")&&options.method==="POST"){folderCreates+=1;const body=JSON.parse(options.body);return response({id:`folder-${folderCreates}`,name:body.name,parents:body.parents,appProperties:body.appProperties})}throw new Error(`Unexpected request ${value}`)};
  const attachmentRoot=path.join(root,"attachments"),options={fetchImpl,environment:{},encryptionKey,attachmentRoot};
  const workspace=createGoogleWorkspaceService(db,options);await workspace.configure({clientId:"fixture-client",clientSecret:secretFixture,redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback",estimatesRootFolderId:"estimates-root",ordersRootFolderId:"orders-root",folderTemplate:{pictures:"Site Pictures"}});const oauth=await workspace.beginOAuth();await workspace.completeOAuth({state:oauth.state,code:"fixture-code"});
  const drive=createDriveIntegrationService(db,options),first=await drive.provisionEstimate("estimate-1");
  assert.equal(first.status,"provisioned");assert.equal(first.folders.length,10);assert.equal(folderCreates,10);assert.ok(first.folders.every(folder=>folder.provider_folder_id));
  await drive.provisionEstimate("estimate-1");assert.equal(folderCreates,10);
  const dynamic=await drive.provisionEstimate("estimate-1",["Other Supplier"]);assert.equal(folderCreates,11);assert.ok(dynamic.folders.some(folder=>folder.name==="Other Supplier"));
  const rows=await db.all("SELECT logical_key,name,provider_folder_id FROM drive_project_folders WHERE estimate_id='estimate-1'");assert.equal(rows.length,11);assert.equal(rows.filter(row=>row.name==="Zyle Fenster").length,1);assert.equal(rows.filter(row=>row.name==="Other Supplier").length,1);assert.ok(rows.find(row=>row.logical_key==="pictures"&&row.name==="Site Pictures"));
  await mkdir(path.join(attachmentRoot,"supplier"),{recursive:true});await writeFile(path.join(attachmentRoot,"supplier","quote.pdf"),"supplier evidence");await db.run("INSERT INTO supplier_quote_attachments VALUES(?,?,?,?,?)","attachment-1","estimate-1","supplier-quote.pdf","application/pdf","supplier/quote.pdf");
  const filed=await drive.fileSupplierAttachment({estimateId:"estimate-1",quoteId:"quote-1",revisionId:"revision-1",attachmentId:"attachment-1",supplierName:"Zyle Fenster"});assert.equal(filed.provider_file_id,"drive-file-1");await drive.fileSupplierAttachment({estimateId:"estimate-1",quoteId:"quote-1",revisionId:"revision-1",attachmentId:"attachment-1",supplierName:"Zyle Fenster"});assert.equal(fileUploads,1);assert.equal((await db.get("SELECT COUNT(*) count FROM drive_document_links WHERE source_attachment_id='attachment-1'")).count,1);
});
