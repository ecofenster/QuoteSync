import {createHash,randomUUID} from 'node:crypto';
import {open as openFile,readFile,unlink} from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {ensureManagedParent,resolveManagedPath,resolveAttachmentRoot} from '../supplierQuotes/managedAttachmentStorage.js';
import {loadInstallationDocumentPreparation} from './installationDocumentPreparation.js';
import {renderInstallationDocumentPdf} from './installationDocumentRenderer.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=409)=>Object.assign(new Error(message),{status,code:'installation_document_preparation'});
export async function initializeInstallationDocumentStore(db){
  await db.exec(`CREATE TABLE IF NOT EXISTS installation_prepared_documents (
    id TEXT PRIMARY KEY,request_identity TEXT NOT NULL UNIQUE,request_sha256 TEXT NOT NULL,
    client_id TEXT NOT NULL,project_id TEXT,estimate_id TEXT NOT NULL,order_id TEXT,
    source_revision INTEGER NOT NULL,audience TEXT NOT NULL CHECK(audience IN('client','installer')),
    projection_json TEXT NOT NULL,source_binding_json TEXT NOT NULL,
    file_name TEXT NOT NULL,storage_key TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,size_bytes INTEGER NOT NULL,
    created_by TEXT NOT NULL,created_at TEXT NOT NULL,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT);
    CREATE INDEX IF NOT EXISTS idx_installation_documents_estimate ON installation_prepared_documents(estimate_id,created_at);
    CREATE TRIGGER IF NOT EXISTS installation_document_no_update BEFORE UPDATE ON installation_prepared_documents BEGIN SELECT RAISE(ABORT,'Prepared installation evidence is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS installation_document_no_delete BEFORE DELETE ON installation_prepared_documents BEGIN SELECT RAISE(ABORT,'Prepared installation evidence is immutable'); END;`);
}
const metadata=row=>({id:row.id,clientId:row.client_id,projectId:row.project_id,estimateId:row.estimate_id,orderId:row.order_id,revision:row.source_revision,audience:row.audience,fileName:row.file_name,sha256:row.sha256,sizeBytes:row.size_bytes,createdAt:row.created_at,status:'prepared_not_sent',document:JSON.parse(row.projection_json)});

// A dedicated connection owns each write transaction, avoiding interleaved operations on the API's shared connection.
// Callers must authorise staff/workspace access before invoking this internal boundary.
export function createInstallationDocumentStore({databasePath,attachmentRoot=resolveAttachmentRoot(),render=renderInstallationDocumentPdf}){
  if(!databasePath||databasePath===':memory:')throw new Error('A persistent database path is required for retained installation documents.');
  const connect=async()=>{const db=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READWRITE});try{await db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000');return db;}catch(error){await db.close();throw error}};
  async function checkedBytes(row){
    let bytes;try{bytes=await readFile(resolveManagedPath(row.storage_key,attachmentRoot));}catch{throw fail('The prepared document is retained but its file is unavailable. Restore the saved file before retrying; it has not been regenerated.');}
    if(bytes.length!==row.size_bytes||hash(bytes)!==row.sha256)throw fail('The saved document failed its integrity check. Review the retained file; it has not been replaced.');return bytes;
  }
  async function read(id,{clientId,estimateId}){
    if(!clientId||!estimateId)throw fail('Select the Client and Estimate for this document.',403);
    const db=await connect();try{const row=await db.get('SELECT * FROM installation_prepared_documents WHERE id=? AND client_id=? AND estimate_id=?',id,clientId,estimateId);if(!row)throw fail('Prepared document not found for this Client and Estimate.',404);return {document:metadata(row),bytes:await checkedBytes(row)};}finally{await db.close()}
  }
  async function prepare(input,{clientId,actorId}){
    if(!clientId||!actorId||!input.requestKey)throw fail('The selected Client, staff identity and preparation request are required.');
    const request={estimateId:input.estimateId,revision:input.revision,orderId:input.orderId||null,audience:input.audience,scenarioId:input.audience==='installer'?input.scenarioId:null,scenarioRevision:input.audience==='installer'?input.scenarioRevision:null};
    if(input.audience==='installer'&&input.orderPlanId)request.orderPlanId=input.orderPlanId;
    const identity=hash(JSON.stringify([clientId,input.estimateId,input.orderId||null,input.requestKey])),requestSha=hash(JSON.stringify(request));
    const db=await connect();let target=null,newId=null,ownedFile=false;
    try{
      await db.exec('BEGIN IMMEDIATE');
      const previous=await db.get('SELECT * FROM installation_prepared_documents WHERE request_identity=?',identity);
      if(previous){if(previous.request_sha256!==requestSha)throw fail('This preparation request already belongs to different reviewed choices. Start a new preparation.');await checkedBytes(previous);await db.exec('COMMIT');return {...metadata(previous),reused:true};}
      const prepared=await loadInstallationDocumentPreparation(db,request);
      if(prepared.source.clientId!==clientId)throw fail('The selected Estimate belongs to another Client.',403);
      const bytes=await render(prepared.document);if(!Buffer.isBuffer(bytes)||bytes.subarray(0,5).toString()!=='%PDF-')throw fail('The document could not be generated. Nothing was saved; retry preparation.');
      newId=randomUUID();const storageKey=`installation-documents/${newId}.pdf`,fileName=`${String(prepared.document.reference).replace(/[^A-Za-z0-9_-]/g,'-')}-${request.audience==='installer'?'Installer-Pack':'Price-Free-Schedule'}-R${request.revision}.pdf`;
      target=await ensureManagedParent(storageKey,attachmentRoot);const handle=await openFile(target,'wx');ownedFile=true;try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close()}
      const sourceBinding={source:prepared.source,calculation:prepared.calculation};
      await db.run(`INSERT INTO installation_prepared_documents(id,request_identity,request_sha256,client_id,project_id,estimate_id,order_id,source_revision,audience,projection_json,source_binding_json,file_name,storage_key,sha256,size_bytes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,newId,identity,requestSha,clientId,prepared.source.projectId,request.estimateId,request.orderId,request.revision,request.audience,JSON.stringify(prepared.document),JSON.stringify(sourceBinding),fileName,storageKey,hash(bytes),bytes.length,actorId,new Date().toISOString());
      const saved=await db.get('SELECT * FROM installation_prepared_documents WHERE id=?',newId);await checkedBytes(saved);await db.exec('COMMIT');return {...metadata(saved),reused:false};
    }catch(error){
      await db.exec('ROLLBACK').catch(()=>{});
      // A commit may have succeeded despite a later transport error: never delete confirmed evidence.
      const retained=newId?await db.get('SELECT * FROM installation_prepared_documents WHERE id=?',newId):null;
      if(retained){await checkedBytes(retained);return {...metadata(retained),reused:true};}
      if(ownedFile)await unlink(target).catch(cleanup=>{if(cleanup.code!=='ENOENT')error.cleanupIncomplete=true;});
      if(error.status)throw error;
      const reported=fail(error.cleanupIncomplete?'No document preparation was confirmed. A temporary generated file needs staff review; your choices are unchanged.':'The document was not saved. Your choices are unchanged; retry preparation.',503);
      reported.cause=error;reported.cleanupIncomplete=!!error.cleanupIncomplete;throw reported;
    }finally{await db.close()}
  }
  return {prepare,read};
}
