import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { initializeCommercialIdentitySchema } from "../server/features/commercialIdentity/commercialIdentitySchema.js";
import { createGoogleWorkspaceService, GOOGLE_WORKSPACE_SCOPES } from "../server/features/integrations/googleWorkspaceService.js";
import { createGmailProvider, mapGmailMessage } from "../server/features/communications/gmailProvider.js";
import { buildEstimateProjectFolderName, createDriveIntegrationService, DEFAULT_PROJECT_FOLDER_NAMES, resolveEstimateYear } from "../server/features/documents/driveIntegrationService.js";
import { loadLocalEnvironment, resolveLocalEnvironmentPath } from "../server/loadLocalEnvironment.js";

const encryptionKey=Buffer.alloc(32,11);
const response=(body,{ok=true,status=200}={})=>({ok,status,json:async()=>body});
const encoded=(value)=>Buffer.from(value).toString("base64url");
const opaqueFixture=(byte)=>Buffer.alloc(24,byte).toString("base64url");

async function databaseFixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-google-")),filename=path.join(root,"test.db"),db=await open({filename,driver:sqlite3.Database}),openDatabases=new Set([db]);
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,client_ref TEXT,created_at TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,estimate_ref TEXT,revision_no INTEGER,created_at TEXT,deleted_at TEXT);
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_attachments(id TEXT PRIMARY KEY,estimate_id TEXT,original_file_name TEXT,media_type TEXT,storage_key TEXT);
  `);
  await initializeWorkflowSchema(db);
  await initializeCommercialIdentitySchema(db);
  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,created_at,deleted_at) VALUES(?,?,?,?,?,?,NULL)","client-1","John Smith","john@example.com","The Aviary","EF-CL-025","2025-12-01T09:00:00.000Z");
  await db.run("INSERT INTO estimates(id,client_id,estimate_ref,revision_no,created_at,deleted_at) VALUES(?,?,?,?,?,NULL)","estimate-1","client-1","EF-EST-2026-041",2,"2025-12-20T09:00:00.000Z");
  await db.run("INSERT INTO supplier_quotes VALUES(?,?,?,NULL)","quote-1","estimate-1","Zyle Fenster");
  const reopen=async()=>{if(openDatabases.has(db)){await db.close();openDatabases.delete(db)}const next=await open({filename,driver:sqlite3.Database});openDatabases.add(next);return next};
  t.after(async()=>{for(const database of openDatabases)await database.close();await rm(root,{recursive:true,force:true})});
  return {db,root,reopen};
}

test("Gmail maps mailbox content, folders, search, drafts, replies/forwards and attachments through provider-neutral data",async()=>{
  const calls=[];
  const message={id:"message-1",threadId:"thread-1",labelIds:["INBOX","UNREAD","STARRED","Label_suppliers"],snippet:"Please call me",internalDate:"1787731200000",payload:{headers:[{name:"From",value:"Client <client@example.com>"},{name:"To",value:"sales@example.com"},{name:"Subject",value:"Quotation question"}],mimeType:"multipart/mixed",parts:[{mimeType:"text/html",body:{data:encoded("<p>Please call me</p><img src=\"cid:logo-1\">")}}, {filename:"logo.png",mimeType:"image/png",headers:[{name:"Content-ID",value:"<logo-1>"},{name:"Content-Disposition",value:"inline"}],body:{attachmentId:"attachment-logo",size:48}}, {filename:"drawing.pdf",mimeType:"application/pdf",body:{attachmentId:"attachment-1",size:123}}]}};
  const workspace={googleFetch:async(url,options={})=>{const value=String(url);calls.push({value,options});if(value.includes("/threads?")&&(!options.method||options.method==="GET"))return response({threads:[{id:"thread-1"}],nextPageToken:"page-2"});if(value.includes("/threads/thread-1?")&&(!options.method||options.method==="GET"))return response({id:"thread-1",messages:[message]});if(value.includes("/messages/message-1?"))return response(message);if(value.includes("/attachments/attachment-1"))return response({data:encoded("pdf-bytes")});if(value.endsWith("/labels"))return response({labels:[{id:"INBOX",name:"INBOX",type:"system"},{id:"Label_suppliers",name:"Suppliers/Zyle Fenster",type:"user"}]});if(value.endsWith("/labels/INBOX"))return response({id:"INBOX",name:"INBOX",type:"system",messagesTotal:4,messagesUnread:2});if(value.endsWith("/labels/Label_suppliers"))return response({id:"Label_suppliers",name:"Suppliers/Zyle Fenster",type:"user",messagesTotal:3,messagesUnread:1});if(value.endsWith("/threads/thread-1/modify")||value.endsWith("/threads/thread-1/trash"))return response({id:"thread-1"});if(value.endsWith("/drafts"))return response({id:"draft-created",message:{id:"draft-message",threadId:"thread-1"}});if(value.endsWith("/messages/send"))return response({id:"sent-message",threadId:"thread-1"});throw new Error(`Unexpected request ${value}`)}};
  const gmail=createGmailProvider(workspace,{pageSize:10});
  const inbox=await gmail.list({folder:"inbox",query:"from:client@example.com"});assert.equal(inbox.messages[0].direction,"inbound");assert.equal(inbox.messages[0].bodyHtml.includes("Please call me"),true);assert.equal(inbox.messages[0].unread,true);assert.equal(inbox.messages[0].starred,true);assert.equal(inbox.messages[0].threadCount,1);assert.equal(inbox.nextPageToken,"page-2");assert.equal(inbox.messages[0].attachments.find(item=>item.contentId==="logo-1").inline,true);
  await gmail.list({folder:"sent",query:"quotation"});await gmail.list({folder:"drafts",query:"quotation"});
  await assert.rejects(()=>gmail.list({folder:"arbitrary"}),error=>error.code==="invalid_mailbox_view");
  const labels=await gmail.labels();assert.equal(labels.find(label=>label.id==="INBOX").messagesUnread,2);assert.equal(labels.find(label=>label.id==="Label_suppliers").name,"Suppliers/Zyle Fenster");await gmail.command({threadIds:["thread-1"],command:"mark_read"});
  const draft=await gmail.createDraft({to:["client@example.com"],subject:"Draft quotation",bodyHtml:"<p>Draft</p>",attachments:[]});
  const sent=await gmail.send({to:["client@example.com"],subject:"Re: Quotation question",bodyHtml:"<p>Reply</p>",threadId:"thread-1",inReplyTo:"message-1",references:"message-1",attachments:[{fileName:"quote.pdf",mediaType:"application/pdf",bytes:Buffer.from("quote")} ]});
  assert.equal(draft.providerDraftId,"draft-created");assert.equal(sent.providerMessageId,"sent-message");assert.equal((await gmail.attachment("message-1","attachment-1")).toString(),"pdf-bytes");
  const searchCalls=calls.filter(call=>call.value.includes("?"));assert.ok(searchCalls.some(call=>new URL(call.value).searchParams.get("q")==="from:client@example.com"));assert.ok(searchCalls.some(call=>new URL(call.value).searchParams.get("labelIds")==="SENT"));assert.ok(calls.some(call=>call.value.endsWith("/threads/thread-1/modify")&&JSON.parse(call.options.body).removeLabelIds.includes("UNREAD")));
  const sendCall=calls.find(call=>call.value.endsWith("/messages/send"));const mime=Buffer.from(JSON.parse(sendCall.options.body).raw,"base64url").toString();assert.match(mime,/In-Reply-To: message-1/);assert.match(mime,/filename="quote.pdf"/);
  assert.equal(mapGmailMessage(message).provider,"google_workspace");
  assert.equal(mapGmailMessage({...message,labelIds:["TRASH"]},"trash").folder,"trash");assert.equal(mapGmailMessage({...message,labelIds:["SPAM"]},"spam").folder,"spam");assert.equal(mapGmailMessage({...message,labelIds:["STARRED"]},"starred").folder,"other");assert.equal(mapGmailMessage({...message,labelIds:["INBOX","STARRED"]},"starred").folder,"inbox");
});

test("Gmail label metadata uses bounded concurrency and survives per-label rate limits",async()=>{
  let active=0,maxActive=0,rateLimited=false;
  const labels=Array.from({length:12},(_,index)=>({id:`Label_${index}`,name:`Label ${index}`,type:"user"}));
  const workspace={googleFetch:async url=>{const value=String(url);if(value.endsWith("/labels"))return response({labels});active+=1;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active-=1;if(value.endsWith("/Label_3")&&!rateLimited){rateLimited=true;return response({error:{message:"rate limited"}},{ok:false,status:429})}const id=value.split("/").at(-1);return response({id,name:`Detailed ${id}`,type:"user",messagesTotal:2,messagesUnread:1})}};
  const result=await createGmailProvider(workspace).labels();
  assert.equal(result.length,12);assert.ok(maxActive<=4);assert.equal(result.find(label=>label.id==="Label_3").messagesUnread,1);
});

test("Google OAuth configuration and tokens are encrypted, reconnectable and disconnectable",async t=>{
  const accessFixture=opaqueFixture(21),refreshFixture=opaqueFixture(22),secretFixture=opaqueFixture(23);
  const {db}=await databaseFixture(t),fetchImpl=async url=>String(url).includes("oauth2.googleapis.com")?response({access_token:accessFixture,refresh_token:refreshFixture,token_type:"Bearer",expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(" ")}):response({sub:"account-1",email:"sales@example.com",name:"Sales"});
  const service=createGoogleWorkspaceService(db,{fetchImpl,environment:{},encryptionKey});
  assert.equal((await service.status()).state,"not_configured");
  let status=await service.configure({clientId:"fixture-client",clientSecret:secretFixture,redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback",enquiriesRootFolderId:"enquiries-root",estimatesRootFolderId:"estimates-root",ordersRootFolderId:"orders-root",folderTemplate:{pictures:"Site Pictures"}});
  assert.equal(status.state,"configured_disconnected");assert.equal(status.configured,true);assert.equal(status.connected,false);assert.equal(JSON.stringify(status).includes("plain-client-secret"),false);
  status=await service.configure({clientId:"fixture-client",redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback",ordersRootFolderId:null});assert.equal(status.ordersRootFolderId,null);assert.equal(status.enquiriesRootFolderId,"enquiries-root");assert.equal(status.estimatesRootFolderId,"estimates-root");assert.equal(status.configured,true);
  const oauth=await service.beginOAuth();assert.equal(new URL(oauth.authorizationUrl).searchParams.get("access_type"),"offline");assert.ok(GOOGLE_WORKSPACE_SCOPES.every(scope=>new URL(oauth.authorizationUrl).searchParams.get("scope").includes(scope)));
  status=await service.completeOAuth({state:oauth.state,code:"authorisation-code"});assert.equal(status.connected,true);assert.equal(status.account.email,"sales@example.com");
  assert.equal(status.capabilities.gmail.available,true);assert.equal(status.capabilities.drive.available,true);assert.equal(status.capabilities.drive.rootConfigured,true);
  const persisted=JSON.stringify(await db.get("SELECT * FROM integration_oauth_connections WHERE provider='google_workspace'"));const configured=JSON.stringify(await db.get("SELECT * FROM integration_provider_config WHERE provider='google_workspace'"));
  assert.equal(persisted.includes(accessFixture),false);assert.equal(persisted.includes(refreshFixture),false);assert.equal(configured.includes(secretFixture),false);
  await db.run("UPDATE integration_oauth_connections SET encrypted_refresh_token=NULL WHERE provider='google_workspace'");status=await service.status();assert.equal(status.state,"reconnect_required");assert.equal(status.connected,false);
  status=await service.disconnect();assert.equal(status.connected,false);assert.equal(status.configured,true);
  assert.equal(status.state,"configured_disconnected");
  assert.equal(status.capabilities.gmail.available,false);assert.equal(status.capabilities.drive.available,false);
});

test("persisted Google configuration survives restart and safely recovers after encryption-key restoration",async t=>{
  const accessFixture=opaqueFixture(41),refreshFixture=opaqueFixture(42),secretFixture=opaqueFixture(43);
  const {db,reopen}=await databaseFixture(t),fetchImpl=async url=>String(url).includes("oauth2.googleapis.com")?response({access_token:accessFixture,refresh_token:refreshFixture,token_type:"Bearer",expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(" ")}):response({sub:"account-persisted",email:"persisted@example.com",name:"Persisted Account"});
  const configuredService=createGoogleWorkspaceService(db,{fetchImpl,environment:{},encryptionKey});
  await configuredService.configure({clientId:"persisted-client-id",clientSecret:secretFixture,redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback",estimatesRootFolderId:"estimates-persisted",ordersRootFolderId:"orders-persisted",folderTemplate:{orders:"Orders"}});
  const oauth=await configuredService.beginOAuth();await configuredService.completeOAuth({state:oauth.state,code:"fixture-code"});

  const restartedDb=await reopen();
  const configBefore=await restartedDb.get("SELECT * FROM integration_provider_config WHERE provider=?","google_workspace");
  const connectionBefore=await restartedDb.get("SELECT * FROM integration_oauth_connections WHERE provider=?","google_workspace");
  const restartedService=createGoogleWorkspaceService(restartedDb,{fetchImpl,environment:{},encryptionKey});
  const restartedStatus=await restartedService.status();
  assert.equal(restartedStatus.state,"connected");assert.equal(restartedStatus.configured,true);assert.equal(restartedStatus.connected,true);
  assert.equal((await restartedService.resolvedConfig()).clientSecret,secretFixture);

  const missingStatus=await createGoogleWorkspaceService(restartedDb,{fetchImpl,environment:{}}).status();
  assert.equal(missingStatus.state,"configured_encryption_unavailable");assert.equal(missingStatus.configured,true);assert.equal(missingStatus.configurationStored,true);assert.equal(missingStatus.encryptionConfigured,false);assert.equal(missingStatus.encryptionState,"missing");assert.equal(missingStatus.connected,false);assert.equal(missingStatus.connectionStatus,"connected");
  assert.equal(missingStatus.clientId,"persisted-client-id");assert.equal(missingStatus.estimatesRootFolderId,"estimates-persisted");assert.equal(missingStatus.ordersRootFolderId,"orders-persisted");assert.match(missingStatus.infrastructureMessage,/configuration is stored.*encryption service is unavailable/i);

  const invalidStatus=await createGoogleWorkspaceService(restartedDb,{fetchImpl,environment:{QUOTESUITE_INTEGRATION_ENCRYPTION_KEY:"invalid"}}).status();
  assert.equal(invalidStatus.state,"configured_encryption_unavailable");assert.equal(invalidStatus.encryptionState,"invalid");assert.doesNotMatch(JSON.stringify(invalidStatus),/QUOTESUITE_INTEGRATION_ENCRYPTION_KEY/);
  const wrongKeyStatus=await createGoogleWorkspaceService(restartedDb,{fetchImpl,environment:{},encryptionKey:Buffer.alloc(32,99)}).status();
  assert.equal(wrongKeyStatus.state,"configured_encryption_unavailable");assert.equal(wrongKeyStatus.encryptionState,"decryption_failed");

  assert.deepEqual(await restartedDb.get("SELECT * FROM integration_provider_config WHERE provider=?","google_workspace"),configBefore);
  assert.deepEqual(await restartedDb.get("SELECT * FROM integration_oauth_connections WHERE provider=?","google_workspace"),connectionBefore);
  const restoredStatus=await createGoogleWorkspaceService(restartedDb,{fetchImpl,environment:{},encryptionKey}).status();
  assert.equal(restoredStatus.state,"connected");assert.equal(restoredStatus.connected,true);assert.equal(restoredStatus.capabilities.gmail.available,true);assert.equal(restoredStatus.capabilities.drive.available,true);

  for(const status of [restartedStatus,missingStatus,invalidStatus,wrongKeyStatus,restoredStatus]){
    const serialized=JSON.stringify(status);
    assert.equal(serialized.includes(secretFixture),false);assert.equal(serialized.includes(accessFixture),false);assert.equal(serialized.includes(refreshFixture),false);assert.doesNotMatch(serialized,/encrypted_(?:client_secret|access_token|refresh_token)|clientSecret|accessToken|refreshToken/);
  }
});

test("local API startup loads the ignored QuoteSuite secret file without embedding credentials",async()=>{
  const [startup,application,loader,provider,script,ignore,manifest]=await Promise.all([readFile(new URL("../server/index.js",import.meta.url),"utf8"),readFile(new URL("../server/startQuoteSuiteApi.js",import.meta.url),"utf8"),readFile(new URL("../server/loadLocalEnvironment.js",import.meta.url),"utf8"),readFile(new URL("../server/features/integrations/integrationSecretProvider.js",import.meta.url),"utf8"),readFile(new URL("../scripts/ensure-local-integration-key.mjs",import.meta.url),"utf8"),readFile(new URL("../.gitignore",import.meta.url),"utf8"),readFile(new URL("../package.json",import.meta.url),"utf8")]);
  assert.match(startup,/import \{ integrationSecretBootstrap \} from '\.\/loadLocalEnvironment\.js'/);assert.match(startup,/await import\('\.\/startQuoteSuiteApi\.js'\)/);assert.doesNotMatch(startup,/routes\/|createGoogleWorkspaceService|startApiServer\(/);assert.match(application,/startApiServer\(app/);assert.match(loader,/process\.loadEnvFile/);assert.match(loader,/\.env\.local/);assert.match(loader,/bootstrapIntegrationSecretProvider/);assert.doesNotMatch(startup,/ensure-local-integration-key/);assert.doesNotMatch(`${startup}\n${loader}\n${provider}`,/randomBytes|writeFile|INSERT INTO|UPDATE integration_provider_config/);assert.match(script,/randomBytes\(32\)\.toString\("base64"\)/);assert.doesNotMatch(script,/console\.log\([^)]*key\)/);assert.match(ignore,/\*\.local|web\/\.env\*/);assert.equal(JSON.parse(manifest).scripts.api,"node server/index.js");
});

test("local environment resolution is independent of the API working directory",()=>{
  const original=process.cwd();
  const applicationRoot=fileURLToPath(new URL("../",import.meta.url));
  const expected=path.join(applicationRoot,".env.local");
  try {
    for(const cwd of [applicationRoot,path.dirname(applicationRoot),path.join(applicationRoot,"server"),os.tmpdir()]){
      process.chdir(cwd);
      assert.equal(resolveLocalEnvironmentPath(),expected);
      const environment={};let loadedPath=null;
      const result=loadLocalEnvironment({environment,existsSyncImpl:value=>value===expected,loadEnvFileImpl:value=>{loadedPath=value;environment.QUOTESUITE_INTEGRATION_ENCRYPTION_KEY=Buffer.alloc(32,7).toString("base64")}});
      assert.equal(loadedPath,expected);assert.equal(result.source,expected);assert.equal(result.state,"available");assert.equal(result.available,true);
    }
  } finally {
    process.chdir(original);
  }
});

test("Drive derives canonical year and new project folder names without using Lead Source",()=>{
  assert.equal(resolveEstimateYear("EF-EST-2026-041","2025-12-20T09:00:00.000Z"),"2026");
  assert.equal(resolveEstimateYear("EF-EST-2027-001","2026-01-01T09:00:00.000Z"),"2027");
  assert.equal(buildEstimateProjectFolderName({estimateReference:"EF-EST-2026-041",clientName:"John Smith",projectName:"The Aviary",leadSource:"BuildHub"}),"EF-EST-2026-041 - John Smith (The Aviary)");
  assert.equal(buildEstimateProjectFolderName({estimateReference:"EF-EST-2026-042",clientName:"John Smith",projectName:"",leadSource:"BuildHub"}),"EF-EST-2026-042 - John Smith");
  assert.equal(buildEstimateProjectFolderName({estimateReference:"EF-EST-2026-043",clientName:"John Smith",projectName:"john smith",leadSource:"Referral"}),"EF-EST-2026-043 - John Smith");
  assert.deepEqual(Object.values(DEFAULT_PROJECT_FOLDER_NAMES),["Drawings (Client)","Drawings (Ecofenster)","Estimates","Invoices","Orders"]);
});

test("workflow schema migration permits one discovered year folder ID to serve multiple Estimates",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-drive-schema-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY);
    CREATE TABLE estimates(id TEXT PRIMARY KEY);
    CREATE TABLE followups(id TEXT PRIMARY KEY);
    CREATE TABLE drive_project_folders (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, estimate_id TEXT NOT NULL, logical_key TEXT NOT NULL,
      name TEXT NOT NULL, parent_logical_key TEXT, provider_folder_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(provider, estimate_id, logical_key), UNIQUE(provider, provider_folder_id)
    );
    INSERT INTO clients VALUES('client-1');
    INSERT INTO estimates VALUES('estimate-1');
    INSERT INTO estimates VALUES('estimate-2');
    INSERT INTO drive_project_folders(id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,created_at,updated_at) VALUES('mapping-1','google_drive','estimate-1','year:2026','2026','estimates_root','existing-year-2026','now','now');
  `);
  await initializeWorkflowSchema(db);
  await db.run("INSERT INTO drive_project_folders(id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)","mapping-2","google_drive","estimate-2","year:2026","2026","estimates_root","existing-year-2026","now","now");
  assert.equal((await db.get("SELECT COUNT(*) count FROM drive_project_folders WHERE provider_folder_id='existing-year-2026'")).count,2);
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
});

test("Drive reuses existing years and historical projects, provisions the exact default once, and files canonical supplier evidence once",async t=>{
  const {db,root}=await databaseFixture(t);let folderCreates=0,fileUploads=0;
  const accessFixture=opaqueFixture(31),refreshFixture=opaqueFixture(32),secretFixture=opaqueFixture(33);
  const providerFolders=[
    {id:"existing-year-2026",name:"2026",parents:["estimates-root"],appProperties:{}},
    {id:"historical-project-009",name:"EF-EST-2026-009 - John Wingfield (Buildhub)",parents:["existing-year-2026"],appProperties:{}},
  ],createdFolders=[];
  const matchingFolders=(url)=>{const query=new URL(url).searchParams.get("q")||"",parent=query.match(/'([^']+)' in parents/)?.[1],exact=query.match(/name='([^']+)'/)?.[1],contains=query.match(/name contains '([^']+)'/)?.[1],estimateId=query.match(/quotesuiteEstimateId' and value='([^']+)'/)?.[1],logicalKey=query.match(/quotesuiteLogicalKey' and value='([^']+)'/)?.[1];return providerFolders.filter(folder=>folder.parents?.includes(parent)&&(!exact||folder.name===exact)&&(!contains||folder.name.includes(contains))&&(!estimateId||folder.appProperties?.quotesuiteEstimateId===estimateId)&&(!logicalKey||folder.appProperties?.quotesuiteLogicalKey===logicalKey))};
  const fetchImpl=async(url,options={})=>{const value=String(url);if(value.includes("oauth2.googleapis.com"))return response({access_token:accessFixture,refresh_token:refreshFixture,token_type:"Bearer",expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(" ")});if(value.includes("openidconnect.googleapis.com"))return response({sub:"account-1",email:"sales@example.com",name:"Sales"});if(value.startsWith("https://www.googleapis.com/upload/drive/v3/files")){fileUploads+=1;return response({id:`drive-file-${fileUploads}`,name:"supplier-quote.pdf"})}if(value.startsWith("https://www.googleapis.com/drive/v3/files")&&(!options.method||options.method==="GET"))return response({files:matchingFolders(value)});if(value.startsWith("https://www.googleapis.com/drive/v3/files")&&options.method==="POST"){folderCreates+=1;const body=JSON.parse(options.body),folder={id:`folder-${folderCreates}`,name:body.name,parents:body.parents,appProperties:body.appProperties};providerFolders.push(folder);createdFolders.push(folder);return response(folder)}throw new Error(`Unexpected request ${value}`)};
  const attachmentRoot=path.join(root,"attachments"),options={fetchImpl,environment:{},encryptionKey,attachmentRoot};
  const workspace=createGoogleWorkspaceService(db,options);await workspace.configure({clientId:"fixture-client",clientSecret:secretFixture,redirectUri:"http://localhost:3001/api/integrations/googleWorkspace/oauth/callback",estimatesRootFolderId:"estimates-root",ordersRootFolderId:null,folderTemplate:{pictures:"Legacy Pictures setting must not provision"}});const oauth=await workspace.beginOAuth();await workspace.completeOAuth({state:oauth.state,code:"fixture-code"});
  const drive=createDriveIntegrationService(db,options),first=await drive.provisionEstimate("estimate-1");
  assert.equal(first.status,"provisioned");assert.equal(first.folders.length,8);assert.equal(folderCreates,7);assert.ok(first.folders.every(folder=>folder.provider_folder_id));
  assert.equal(first.folders.find(folder=>folder.logical_key==="year:2026").provider_folder_id,"existing-year-2026");assert.equal(first.folders.find(folder=>folder.logical_key==="project").name,"EF-EST-2026-041 - John Smith (The Aviary)");
  assert.equal(createdFolders.some(folder=>folder.name==="2026"),false);assert.equal(createdFolders.some(folder=>folder.name==="Estimates"&&folder.parents.includes("estimates-root")),false);
  await drive.provisionEstimate("estimate-1");assert.equal(folderCreates,7);
  const dynamic=await drive.provisionEstimate("estimate-1",["Other Supplier"]);assert.equal(folderCreates,8);assert.ok(dynamic.folders.some(folder=>folder.name==="Other Supplier"));
  const rows=await db.all("SELECT logical_key,name,provider_folder_id FROM drive_project_folders WHERE estimate_id='estimate-1'");assert.equal(rows.length,9);assert.equal(rows.filter(row=>row.name==="Zyle Fenster").length,1);assert.equal(rows.filter(row=>row.name==="Other Supplier").length,1);
  const projectChildren=rows.filter(row=>["drawings_client","drawings_ecofenster","supplier_estimates","invoices","orders"].includes(row.logical_key)).map(row=>row.name).sort();assert.deepEqual(projectChildren,["Drawings (Client)","Drawings (Ecofenster)","Estimates","Invoices","Orders"].sort());for(const excluded of ["PDF Auto Take Offs","Pictures","Videos","Legacy Pictures setting must not provision"])assert.equal(rows.some(row=>row.name===excluded),false);

  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,created_at,deleted_at) VALUES(?,?,?,?,?,?,NULL)","client-2","Jane Smith","jane@example.com","","EF-CL-030","2026-02-01T09:00:00.000Z");await db.run("INSERT INTO estimates(id,client_id,estimate_ref,revision_no,created_at,deleted_at) VALUES(?,?,?,?,?,NULL)","estimate-2","client-2","EF-EST-2027-001",1,"2026-02-01T09:00:00.000Z");
  const before2027=folderCreates,year2027=await drive.provisionEstimate("estimate-2");assert.equal(year2027.folders.find(folder=>folder.logical_key==="year:2027").name,"2027");assert.equal(folderCreates,before2027+7);await drive.provisionEstimate("estimate-2");assert.equal(folderCreates,before2027+7);assert.equal(providerFolders.filter(folder=>folder.name==="2027"&&folder.parents.includes("estimates-root")).length,1);

  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,created_at,deleted_at) VALUES(?,?,?,?,?,?,NULL)","client-3","John Wingfield","john.w@example.com","","EF-CL-031","2026-03-01T09:00:00.000Z");await db.run("INSERT INTO estimates(id,client_id,estimate_ref,revision_no,created_at,deleted_at) VALUES(?,?,?,?,?,NULL)","estimate-3","client-3","EF-EST-2026-009",1,"2026-03-01T09:00:00.000Z");
  const beforeHistorical=folderCreates,historical=await drive.provisionEstimate("estimate-3");const historicalProject=historical.folders.find(folder=>folder.logical_key==="project");assert.equal(historicalProject.provider_folder_id,"historical-project-009");assert.equal(historicalProject.name,"EF-EST-2026-009 - John Wingfield (Buildhub)");assert.equal(folderCreates,beforeHistorical+5);assert.equal(createdFolders.slice(beforeHistorical).some(folder=>folder.name.includes("EF-EST-2026-009")),false);

  await mkdir(path.join(attachmentRoot,"supplier"),{recursive:true});await writeFile(path.join(attachmentRoot,"supplier","quote.pdf"),"supplier evidence");await db.run("INSERT INTO supplier_quote_attachments VALUES(?,?,?,?,?)","attachment-1","estimate-1","supplier-quote.pdf","application/pdf","supplier/quote.pdf");
  const filed=await drive.fileSupplierAttachment({estimateId:"estimate-1",quoteId:"quote-1",revisionId:"revision-1",attachmentId:"attachment-1",supplierName:"Wrong Parsed Supplier"});assert.equal(filed.provider_file_id,"drive-file-1");await drive.fileSupplierAttachment({estimateId:"estimate-1",quoteId:"quote-1",revisionId:"revision-1",attachmentId:"attachment-1",supplierName:"Wrong Parsed Supplier"});assert.equal(fileUploads,1);assert.equal((await db.get("SELECT COUNT(*) count FROM drive_document_links WHERE source_attachment_id='attachment-1'")).count,1);assert.equal((await db.all("SELECT name FROM drive_project_folders WHERE estimate_id='estimate-1'")).some(row=>row.name==="Wrong Parsed Supplier"),false);
});
