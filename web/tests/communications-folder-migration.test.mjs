import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createCommunicationRepository } from "../server/features/communications/communicationRepository.js";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";

const legacyMessageTable = `CREATE TABLE communication_messages (
  id TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_message_id TEXT,provider_thread_id TEXT,mailbox_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  folder TEXT NOT NULL CHECK (folder IN ('inbox','sent','drafts','other')),
  status TEXT NOT NULL CHECK (status IN ('draft','sending','sent','failed','received')),
  from_json TEXT NOT NULL DEFAULT '[]',to_json TEXT NOT NULL DEFAULT '[]',cc_json TEXT NOT NULL DEFAULT '[]',bcc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',body_html TEXT NOT NULL DEFAULT '',body_text TEXT NOT NULL DEFAULT '',in_reply_to_provider_message_id TEXT,
  links_json TEXT NOT NULL DEFAULT '[]',error_message TEXT,sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
  UNIQUE(provider,provider_message_id)
)`;

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),"qs-communication-folders-")),db=await open({filename:path.join(root,"test.db"),driver:sqlite3.Database});
  await db.exec("PRAGMA foreign_keys=ON");
  await db.exec(`
    CREATE TABLE clients(id TEXT PRIMARY KEY);
    CREATE TABLE estimates(id TEXT PRIMARY KEY);
    CREATE TABLE followups(id TEXT PRIMARY KEY);
    ${legacyMessageTable};
    CREATE TABLE communication_attachments(id TEXT PRIMARY KEY,communication_message_id TEXT NOT NULL,file_name TEXT NOT NULL,media_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,storage_key TEXT,provider_attachment_id TEXT,drive_file_id TEXT,sha256 TEXT,created_at TEXT NOT NULL,FOREIGN KEY (communication_message_id) REFERENCES communication_messages(id) ON DELETE CASCADE);
  `);
  for(const folder of ["inbox","sent","drafts","other"])await db.run("INSERT INTO communication_messages(id,provider,provider_message_id,direction,folder,status,subject,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",`legacy-${folder}`,"fixture",`provider-${folder}`,folder==="inbox"?"inbound":"outbound",folder,folder==="drafts"?"draft":folder==="sent"?"sent":"received",folder,"2026-01-01","2026-01-01");
  await db.run("INSERT INTO communication_attachments(id,communication_message_id,file_name,media_type,size_bytes,created_at) VALUES(?,?,?,?,?,?)","attachment-1","legacy-inbox","legacy.pdf","application/pdf",12,"2026-01-01");
  t.after(async()=>{await db.close();await rm(root,{recursive:true,force:true})});
  return db;
}

const message=(id,folder)=>({id,provider:"fixture",providerMessageId:`provider-${id}`,direction:"inbound",folder,status:"received",subject:id,from:[],to:[],cc:[],bcc:[],bodyHtml:"",bodyText:"",links:[],attachments:[]});

test("communication folder migration preserves legacy rows and attachments while adding trash and spam",async t=>{
  const db=await fixture(t);await initializeWorkflowSchema(db);
  const legacy=await db.all("SELECT id,folder FROM communication_messages WHERE id LIKE 'legacy-%' ORDER BY id");
  assert.deepEqual(new Map(legacy.map(row=>[row.id,row.folder])),new Map([["legacy-drafts","drafts"],["legacy-inbox","inbox"],["legacy-other","other"],["legacy-sent","sent"]]));
  assert.equal((await db.get("SELECT communication_message_id FROM communication_attachments WHERE id='attachment-1'")).communication_message_id,"legacy-inbox");
  assert.equal((await db.get("PRAGMA foreign_keys")).foreign_keys,1);assert.deepEqual(await db.all("PRAGMA foreign_key_check"),[]);
  const schema=(await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='communication_messages'")).sql;assert.match(schema,/'trash'/);assert.match(schema,/'spam'/);

  const repository=createCommunicationRepository(db);
  assert.equal((await repository.save(message("trash","trash"))).folder,"trash");
  assert.equal((await repository.save(message("bin-alias","bin"))).folder,"trash");
  assert.equal((await repository.save(message("spam","spam"))).folder,"spam");
  await assert.rejects(()=>repository.save(message("invalid","starred")),error=>error.code==="invalid_communication_folder");
  await assert.rejects(()=>db.run(`INSERT INTO communication_messages(id,provider,provider_message_id,provider_thread_id,mailbox_id,direction,folder,status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at) SELECT 'direct-invalid',provider,'provider-direct-invalid',provider_thread_id,mailbox_id,direction,'arbitrary',status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at FROM communication_messages WHERE id='legacy-inbox'`),/CHECK constraint failed/);
});
