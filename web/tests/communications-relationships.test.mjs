import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createCommunicationRepository } from "../server/features/communications/communicationRepository.js";
import { findRelationshipSuggestions, preserveCommunicationLinks, resolveCanonicalRelationship } from "../server/features/communications/communicationsService.js";

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-communication-links-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,estimate_ref TEXT,outcome TEXT,deleted_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_code TEXT,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_revisions(id TEXT PRIMARY KEY,supplier_quote_id TEXT,estimate_id TEXT,full_quotation_reference TEXT);
    CREATE TABLE supplier_commercial_defaults(supplier_code TEXT PRIMARY KEY,supplier_name TEXT,active INTEGER);
    CREATE TABLE communication_messages(
      id TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_message_id TEXT,provider_thread_id TEXT,mailbox_id TEXT,direction TEXT NOT NULL,folder TEXT NOT NULL,status TEXT NOT NULL,
      from_json TEXT NOT NULL,to_json TEXT NOT NULL,cc_json TEXT NOT NULL,bcc_json TEXT NOT NULL,subject TEXT NOT NULL,body_html TEXT NOT NULL,body_text TEXT NOT NULL,
      in_reply_to_provider_message_id TEXT,links_json TEXT NOT NULL,error_message TEXT,sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
    );
    CREATE TABLE communication_attachments(id TEXT PRIMARY KEY,communication_message_id TEXT NOT NULL,file_name TEXT NOT NULL,media_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,storage_key TEXT,provider_attachment_id TEXT,drive_file_id TEXT,sha256 TEXT,created_at TEXT NOT NULL);
  `);
  await db.run("INSERT INTO clients VALUES(?,?,?,NULL)","client-1","Exact Client","exact.client@example.test");
  await db.run("INSERT INTO estimates VALUES(?,?,?,?,NULL)","estimate-1","client-1","EF-EST-2026-041","Order");
  await db.run("INSERT INTO supplier_commercial_defaults VALUES(?,?,1)","ZYLE","Zyle Fenster");
  await db.run("INSERT INTO supplier_quotes VALUES(?,?,?,?,NULL)","quote-1","estimate-1","ZYLE","Zyle Fenster");
  await db.run("INSERT INTO supplier_quote_revisions VALUES(?,?,?,?)","revision-1","quote-1","estimate-1","343718-1");
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return db;
}

const providerMessage=(links=[])=>({id:"message-local-1",provider:"google_workspace",providerMessageId:"provider-message-1",threadId:"thread-1",mailboxId:"me",direction:"inbound",folder:"inbox",status:"received",from:["Exact Client <exact.client@example.test>"],to:["sales@example.test"],cc:[],bcc:[],subject:"EF-EST-2026-041 · quotation 343718-1",bodyHtml:"<p>Fixture only</p>",bodyText:"EF-EST-2026-041 quotation 343718-1",links,error:null,sentAt:"2026-08-26T12:00:00.000Z",attachments:[]});

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
});

test("exact evidence produces conservative canonical suggestions without auto-linking",async t=>{
  const db=await fixture(t),suggestions=await findRelationshipSuggestions(db,providerMessage());
  assert.deepEqual(new Set(suggestions.map(item=>item.kind)),new Set(["client","estimate","order","supplier","supplier_quotation"]));
  assert.ok(suggestions.every(item=>item.autoLinkAllowed===false));
  assert.equal((await resolveCanonicalRelationship(db,"client","client-1")).id,"client-1");
  assert.equal((await resolveCanonicalRelationship(db,"order","estimate-1")).id,"estimate-1");
  assert.equal((await resolveCanonicalRelationship(db,"supplier","ZYLE")).id,"ZYLE");
  assert.equal(await resolveCanonicalRelationship(db,"order","missing"),undefined);
});
