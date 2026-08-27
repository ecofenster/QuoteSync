import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createCommunicationsService } from "../server/features/communications/communicationsService.js";
import { createGmailProvider } from "../server/features/communications/gmailProvider.js";

const message=(overrides={})=>({provider:"google_workspace",providerMessageId:"message-1",threadId:"thread-1",direction:"inbound",folder:"inbox",status:"received",from:["Sender <sender@example.test>"],to:["sales@example.test"],cc:[],bcc:[],subject:"Cached enquiry",snippet:"Cached body",bodyHtml:"<p>Cached body</p>",bodyText:"Cached body",attachments:[],sentAt:"2026-08-27T12:00:00.000Z",unread:true,starred:false,important:false,labels:[{id:"INBOX",name:"Inbox",system:true},{id:"UNREAD",name:"Unread",system:true}],threadCount:1,links:[],...overrides});
const thread=(overrides={})=>{const item=message(overrides);return{...item,threadMessages:[item],threadCount:1}};

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-mail-cache-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec(`CREATE TABLE communication_messages(id TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_message_id TEXT UNIQUE,provider_thread_id TEXT,mailbox_id TEXT,direction TEXT NOT NULL,folder TEXT NOT NULL,status TEXT NOT NULL,from_json TEXT NOT NULL,to_json TEXT NOT NULL,cc_json TEXT NOT NULL,bcc_json TEXT NOT NULL,subject TEXT NOT NULL,body_html TEXT NOT NULL,body_text TEXT NOT NULL,in_reply_to_provider_message_id TEXT,links_json TEXT NOT NULL,error_message TEXT,sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,provider_state_json TEXT NOT NULL DEFAULT '{}');CREATE TABLE communication_attachments(id TEXT PRIMARY KEY,communication_message_id TEXT NOT NULL,file_name TEXT NOT NULL,media_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,storage_key TEXT,provider_attachment_id TEXT,drive_file_id TEXT,sha256 TEXT,created_at TEXT NOT NULL,content_id TEXT,is_inline INTEGER NOT NULL DEFAULT 0);CREATE TABLE communication_provider_sync_states(provider TEXT NOT NULL,provider_account_id TEXT NOT NULL,mailbox_view TEXT NOT NULL,provider_cursor TEXT,status TEXT NOT NULL,last_attempt_at TEXT,last_success_at TEXT,error_message TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(provider,provider_account_id,mailbox_view));CREATE TABLE communication_provider_watch_states(provider TEXT NOT NULL,provider_account_id TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,watch_history_id TEXT,watch_registered_at TEXT,watch_expiration_at TEXT,last_reconciled_history_id TEXT,last_notification_at TEXT,last_reconciled_at TEXT,projection_version INTEGER NOT NULL DEFAULT 0,error_message TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(provider,provider_account_id));CREATE TABLE communication_provider_notifications(provider TEXT NOT NULL,provider_account_id TEXT NOT NULL,notification_id TEXT NOT NULL,provider_cursor TEXT NOT NULL,received_at TEXT NOT NULL,processed_at TEXT,outcome TEXT NOT NULL,PRIMARY KEY(provider,provider_account_id,notification_id));`);
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});return db;
}

test("cached mailbox renders before provider refresh, then Gmail history reconciles without duplicates",async t=>{
  const db=await fixture(t),workspace={async status(){return{connected:true,state:"connected",account:{id:"account-1"},scopes:[],capabilities:{gmail:{available:true}}}}};
  let fullLists=0,historyCalls=0,readVersion=0;
  const gmail={async list(){fullLists+=1;return{messages:[thread()],nextPageToken:null}},async currentHistoryId(){return"100"},async listHistory({startHistoryId}){historyCalls+=1;assert.equal(startHistoryId,"100");return{historyId:"101",changedThreadIds:["thread-1"],deletedMessageIds:[]}},async readThread(){readVersion+=1;return thread({unread:false,labels:[{id:"INBOX",name:"Inbox",system:true}],snippet:"Updated body",bodyText:"Updated body"})}};
  const service=createCommunicationsService(db,{workspace,gmail});
  const empty=await service.listMailbox({folder:"inbox"});assert.equal(empty.messages.length,0);assert.equal(fullLists,0);
  const first=await service.syncMailbox({folder:"inbox"});assert.equal(first.messages.length,1);assert.equal(first.messages[0].unread,true);assert.equal(first.sync.strategy,"controlled_full_sync");assert.equal(fullLists,1);
  const cached=await service.listMailbox({folder:"inbox"});assert.equal(cached.messages.length,1);assert.equal(fullLists,1);
  const delta=await service.syncMailbox({folder:"inbox"});assert.equal(historyCalls,1);assert.equal(readVersion,1);assert.equal(delta.sync.strategy,"gmail_history");assert.equal(delta.messages[0].unread,false);assert.equal(delta.messages[0].snippet,"Updated body");
  assert.equal((await db.get("SELECT COUNT(*) count FROM communication_messages WHERE provider_message_id='message-1'")).count,1);
});

test("expired Gmail history falls back without clearing the visible cached projection",async t=>{
  const db=await fixture(t),workspace={async status(){return{connected:true,state:"connected",account:{id:"account-1"},scopes:[],capabilities:{gmail:{available:true}}}}};
  let lists=0;
  const gmail={async list(){lists+=1;return{messages:[thread({subject:"Fallback result"})],nextPageToken:null}},async currentHistoryId(){return"202"},async listHistory(){const error=new Error("History cursor expired");error.historyExpired=true;throw error}};
  const service=createCommunicationsService(db,{workspace,gmail});await service.repository.save({...message({subject:"Visible cache"}),id:"local-1",mailboxId:"me"});await service.repository.saveSyncState("google_workspace","account-1","inbox",{status:"synced",cursor:"100",lastSuccessAt:"2026-08-27T12:00:00.000Z"});
  assert.equal((await service.listMailbox({folder:"inbox"})).messages[0].subject,"Visible cache");
  const result=await service.syncMailbox({folder:"inbox"});assert.equal(result.sync.strategy,"expired_history_full_sync");assert.equal(lists,1);assert.equal(result.messages[0].subject,"Fallback result");
});

test("Gmail history adapter projects changed threads and deletion evidence across pages",async()=>{
  const urls=[];const responses=[{historyId:"11",nextPageToken:"next",history:[{messagesAdded:[{message:{id:"m1",threadId:"t1"}}],labelsRemoved:[{message:{id:"m2",threadId:"t2"}}]}]},{historyId:"12",history:[{messagesDeleted:[{message:{id:"m3",threadId:"t3"}}]}]}];
  const provider=createGmailProvider({async googleFetch(url){urls.push(String(url));return new Response(JSON.stringify(responses.shift()),{status:200,headers:{"Content-Type":"application/json"}})}});
  const delta=await provider.listHistory({startHistoryId:"10"});assert.deepEqual(delta.changedThreadIds,["t1","t2","t3"]);assert.deepEqual(delta.deletedMessageIds,["m3"]);assert.equal(delta.historyId,"12");assert.match(urls[1],/pageToken=next/);
});
