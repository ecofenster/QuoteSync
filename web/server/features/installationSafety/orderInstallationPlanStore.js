import {createHash,randomUUID} from 'node:crypto';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {buildOrderInstallationPlan} from './orderInstallationPlan.js';
import {loadInstallationDocumentRevision} from './installationDocumentSource.js';
import {createProjectCalculatorLabService} from '../projectCalculatorLab/projectCalculatorLabService.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=409)=>Object.assign(new Error(message),{status,code:'order_installation_plan_save'});
export async function initializeOrderInstallationPlanStore(db){
  await db.exec(`CREATE TABLE IF NOT EXISTS order_installation_plans (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL,client_id TEXT NOT NULL,estimate_id TEXT NOT NULL,
    version INTEGER NOT NULL,request_identity TEXT NOT NULL UNIQUE,request_sha256 TEXT NOT NULL,
    proposal_fingerprint TEXT NOT NULL,plan_json TEXT NOT NULL,review_reason TEXT NOT NULL,
    reviewed_by TEXT NOT NULL,reviewed_at TEXT NOT NULL,
    UNIQUE(order_id,version),FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE RESTRICT,FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT);
    CREATE TRIGGER IF NOT EXISTS order_installation_plan_no_update BEFORE UPDATE ON order_installation_plans BEGIN SELECT RAISE(ABORT,'Reviewed Order installation plans are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS order_installation_plan_no_delete BEFORE DELETE ON order_installation_plans BEGIN SELECT RAISE(ABORT,'Reviewed Order installation plans are immutable'); END;`);
}
async function loadProposal(db,input,scope){
  const source=await loadInstallationDocumentRevision(db,input);
  if(source.clientId!==scope.clientId)throw fail('This Client does not own the selected Order.',403);
  const scenario=await createProjectCalculatorLabService(db).getScenario(input.scenarioId);
  return buildOrderInstallationPlan(source,scenario,input.scenarioRevision);
}
const safePreview=plan=>({fingerprint:plan.proposalFingerprint,orderId:plan.binding.orderId,estimateRevision:plan.binding.estimateRevision,scenarioRevision:plan.binding.scenarioRevision,scopeChanges:plan.binding.scopeChanges,document:plan.document,reviewRequired:plan.reviewRequired});
const saved=row=>({id:row.id,orderId:row.order_id,version:row.version,reviewReason:row.review_reason,reviewedBy:row.reviewed_by,reviewedAt:row.reviewed_at,...safePreview(JSON.parse(row.plan_json))});

// Backend-only boundary. Each transaction owns its connection; caller supplies authorised staff context.
export function createOrderInstallationPlanStore({databasePath,proposalLoader=loadProposal}){
  if(!databasePath||databasePath===':memory:')throw new Error('Reviewed Order plans require a persistent database.');
  const connect=async()=>{const db=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READWRITE});try{await db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000');return db;}catch(error){await db.close();throw error;}};
  const scopeCheck=(input,scope)=>{if(!scope.clientId||!scope.actorId||!input.orderId||!input.estimateId)throw fail('Select the Order, Client and staff reviewer.',403);};
  async function preview(input,scope){scopeCheck(input,scope);const db=await connect();try{await db.exec('BEGIN');const plan=await proposalLoader(db,input,scope);await db.exec('COMMIT');return safePreview(plan);}finally{await db.close();}}
  async function save(input,scope){
    scopeCheck(input,scope);
    if(input.reviewed!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2000)throw fail('Review the proposed calculation and enter a short reason before saving.');
    if(typeof input.requestKey!=='string'||!input.requestKey||input.requestKey.length>200||typeof input.expectedFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedFingerprint))throw fail('Reopen the calculation preview before saving.');
    const identity=hash([scope.clientId,input.orderId,input.requestKey]),requestHash=hash({estimateId:input.estimateId,orderId:input.orderId,scenarioId:input.scenarioId,scenarioRevision:input.scenarioRevision,revision:input.revision,fingerprint:input.expectedFingerprint,reason:input.reason.trim()}),db=await connect();let transaction=false;
    try{
      await db.exec('BEGIN IMMEDIATE');transaction=true;
      const previous=await db.get('SELECT * FROM order_installation_plans WHERE request_identity=?',identity);
      if(previous){if(previous.request_sha256!==requestHash)throw fail('This save request already belongs to different reviewed choices. Review again before starting a new save.');await db.exec('COMMIT');transaction=false;return {...saved(previous),reused:true};}
      const plan=await proposalLoader(db,input,scope);
      if(plan.proposalFingerprint!==input.expectedFingerprint)throw fail('The source or calculation changed after preview. Nothing was saved. Review the new proposal before continuing.');
      if(plan.binding.orderId!==input.orderId||plan.binding.estimateId!==input.estimateId)throw fail('The proposed plan does not belong to the selected Order.');
      const version=(await db.get('SELECT COALESCE(MAX(version),0)+1 version FROM order_installation_plans WHERE order_id=?',input.orderId)).version;
      const row={id:randomUUID(),order_id:input.orderId,client_id:scope.clientId,estimate_id:input.estimateId,version,request_identity:identity,request_sha256:requestHash,proposal_fingerprint:plan.proposalFingerprint,plan_json:JSON.stringify(plan),review_reason:input.reason.trim(),reviewed_by:scope.actorId,reviewed_at:new Date().toISOString()};
      await db.run('INSERT INTO order_installation_plans(id,order_id,client_id,estimate_id,version,request_identity,request_sha256,proposal_fingerprint,plan_json,review_reason,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',...Object.values(row));
      await db.exec('COMMIT');transaction=false;return {...saved(row),reused:false};
    }catch(error){if(transaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
  }
  async function read(id,{clientId,orderId,estimateId}){if(!clientId||!orderId||!estimateId)throw fail('Select the Client and exact Order for this plan.',403);const db=await connect();try{const row=await db.get('SELECT * FROM order_installation_plans WHERE id=? AND client_id=? AND order_id=? AND estimate_id=?',id,clientId,orderId,estimateId);if(!row)throw fail('Reviewed plan not found for this Order.',404);return saved(row);}finally{await db.close();}}
  async function list({clientId,orderId,estimateId,offset=0}){
    if(!clientId||!orderId||!estimateId)throw fail('Select the Client and exact Order for plan history.',403);
    if(!Number.isSafeInteger(offset)||offset<0)throw fail('Choose a valid plan history page.',400);
    const db=await connect();try{
      await db.exec('BEGIN');
      const args=[clientId,orderId,estimateId];
      const total=(await db.get('SELECT COUNT(*) total FROM order_installation_plans WHERE client_id=? AND order_id=? AND estimate_id=?',...args)).total;
      const plans=await db.all('SELECT id,order_id orderId,version,review_reason reviewReason,reviewed_at reviewedAt FROM order_installation_plans WHERE client_id=? AND order_id=? AND estimate_id=? ORDER BY version DESC LIMIT 10 OFFSET ?',...args,offset);
      await db.exec('COMMIT');return {plans,total,offset,limit:10};
    }finally{await db.close();}
  }
  return {preview,save,read,list};
}
