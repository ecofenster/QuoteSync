import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {initializeIsolatedJourneyDatabase} from '../scripts/isolated-journey-database.mjs';
import {stageManufacturerUpload} from '../server/features/supplierQuotes/stageManufacturerUpload.js';

test('genuine source staging preserves identity across concurrent calls, restart, failure and Estimate boundaries',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'qs-upload-staging-')),databasePath=path.join(root,'test.db'),attachmentRoot=path.join(root,'attachments');let db;
 try{
  await initializeIsolatedJourneyDatabase({databasePath,attachmentRoot});db=await open({filename:databasePath,driver:sqlite3.Database});
  await db.run("INSERT INTO clients(id,name,client_ref,created_at,updated_at) VALUES('c','Disposable','TEST-CL','2026-09-12','2026-09-12')");
  for(const id of ['e1','e2'])await db.run("INSERT INTO estimates(id,client_id,estimate_ref,status,created_at,updated_at) VALUES(?,'c',?,'Draft','2026-09-12','2026-09-12')",id,`TEST-${id}`);
  const bytes=await readFile(path.resolve('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf'));
  const input={estimateId:'e1',bytes,fileName:'web-26-1133450.pdf',mediaType:'application/pdf',attachmentRoot};
  const [first,second]=await Promise.all([stageManufacturerUpload(db,input),stageManufacturerUpload(db,input)]);
  assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);assert.deepEqual(first.documents,second.documents);
  await db.close();db=await open({filename:databasePath,driver:sqlite3.Database});
  assert.deepEqual((await stageManufacturerUpload(db,{...input,fileName:'renamed.pdf'})).documents,first.documents);
  assert.notDeepEqual((await stageManufacturerUpload(db,{...input,estimateId:'e2'})).documents,first.documents);
  await db.exec("CREATE TRIGGER reject_staging BEFORE INSERT ON supplier_quote_attachments BEGIN SELECT RAISE(ABORT,'disposable interruption'); END;");
  const changed={...input,bytes:Buffer.concat([bytes,Buffer.from('\n% revised source\n')])};
  await assert.rejects(()=>stageManufacturerUpload(db,changed),/disposable interruption/);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quotes')).count,2,'Failed staging left an orphan quote');
  await db.exec('DROP TRIGGER reject_staging');
  const revision=await stageManufacturerUpload(db,changed);assert.equal(revision.duplicate,false);assert.notDeepEqual(revision.documents,first.documents);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count,0);
  const source=await db.get('SELECT storage_key FROM supplier_quote_attachments WHERE id=?',first.documents[0].attachmentId);
  assert.deepEqual(await readFile(path.join(attachmentRoot,source.storage_key)),bytes);
  await db.run(`INSERT INTO supplier_quote_attachments(id,estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at) SELECT 'legacy-duplicate',estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key||'-legacy',parser_eligible,created_at FROM supplier_quote_attachments WHERE id=?`,first.documents[0].attachmentId);
  await assert.rejects(()=>stageManufacturerUpload(db,input),error=>error.code==='manufacturer_upload_ambiguous_source'&&error.status===409);
 }finally{if(db)await db.close();await rm(root,{recursive:true,force:true})}
});
