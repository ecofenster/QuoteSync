import express from 'express';
import {CURRENT_APP_USER} from '../currentUser.js';
import {createInstallationDocumentStore} from '../features/installationSafety/installationDocumentStore.js';
import {loadInstallationCalculationReview} from '../features/installationSafety/installationDocumentPreparation.js';

const problem=(message,status=409)=>Object.assign(new Error(message),{status});
export function createInstallationDocumentsRouter({databasePromise,environment=process.env,attachmentRoot}={}){
  const router=express.Router();
  router.use((req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    let allowedOrigin=true;try{if(req.get('Origin'))allowedOrigin=['localhost','127.0.0.1','[::1]'].includes(new URL(req.get('Origin')).hostname);}catch{allowedOrigin=false;}
    if(environment.NODE_ENV==='production'||!local||!allowedOrigin)return res.status(403).json({error:'Installation document preparation is restricted to local staff development until production access is approved.'});
    next();
  });
  const fail=(res,error)=>res.status(Number(error.status)||500).json({error:error.status?error.message:'Installation documents could not be processed. Your saved work is unchanged.',code:error.code||'installation_documents_failed'});
  const context=async(estimateId)=>{const db=await databasePromise;const estimate=await db.get('SELECT e.id,e.client_id,e.estimate_ref,e.revision_no FROM estimates e JOIN clients c ON c.id=e.client_id WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL',estimateId);if(!estimate)throw problem('Estimate not found.',404);return {db,estimate};};
  const store=async db=>{const main=(await db.all('PRAGMA database_list')).find(item=>item.name==='main');return createInstallationDocumentStore({databasePath:main?.file,attachmentRoot});};
  router.get('/estimates/:estimateId',async(req,res)=>{try{
    const {db,estimate}=await context(req.params.estimateId),offset=Number(req.query.offset||0);if(!Number.isInteger(offset)||offset<0)throw problem('Choose a valid document page.',400);
    const documents=await db.all('SELECT id,file_name fileName,audience,source_revision revision,order_id orderId,created_at createdAt FROM installation_prepared_documents WHERE estimate_id=? AND client_id=? ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET ?',estimate.id,estimate.client_id,offset);
    const count=await db.get('SELECT COUNT(*) total FROM installation_prepared_documents WHERE estimate_id=? AND client_id=?',estimate.id,estimate.client_id);
    const scenarios=await db.all('SELECT id,name,revision_number revision FROM project_calculator_lab_scenarios WHERE estimate_id=? ORDER BY updated_at DESC LIMIT 20',estimate.id);
    const orders=await db.all('SELECT id,order_ref reference,source_estimate_revision revision FROM orders WHERE source_estimate_id=? AND client_id=? ORDER BY created_at DESC LIMIT 20',estimate.id,estimate.client_id);
    // Keep the exact open record available without unbounding the recent-choice query.
    for(const [key,items,sql,args] of [
      ['scenarioId',scenarios,'SELECT id,name,revision_number revision FROM project_calculator_lab_scenarios WHERE id=? AND estimate_id=?',[estimate.id]],
      ['orderId',orders,'SELECT id,order_ref reference,source_estimate_revision revision FROM orders WHERE id=? AND source_estimate_id=? AND client_id=?',[estimate.id,estimate.client_id]],
    ]){
      const id=req.query[key];if(id===undefined)continue;
      if(typeof id!=='string'||!id.trim()||id.length>200)throw problem('The selected document source is invalid. Reopen the record.',400);
      if(items.some(item=>item.id===id))continue;
      const selected=await db.get(sql,id,...args);
      if(!selected)throw problem('The selected Order or calculation is unavailable for this Estimate. Reopen the correct record; no alternative has been selected.',404);
      items.unshift(selected);if(items.length>20)items.pop();
    }
    res.json({capability:'installation-document-preparation-v1',access:'local_development_only',clientId:estimate.client_id,estimateReference:estimate.estimate_ref,revision:estimate.revision_no,scenarios,orders,documents,total:count.total,offset,limit:10});
  }catch(error){fail(res,error)}});
  router.post('/estimates/:estimateId/calculation-review',async(req,res)=>{try{const {db,estimate}=await context(req.params.estimateId);if(req.body?.clientId!==estimate.client_id)throw problem('The selected Client does not own this Estimate.',403);res.json(await loadInstallationCalculationReview(db,{...req.body,estimateId:estimate.id}));}catch(error){fail(res,error)}});
  router.post('/estimates/:estimateId',async(req,res)=>{try{const {db,estimate}=await context(req.params.estimateId);if(req.body?.clientId!==estimate.client_id)throw problem('The selected Client does not own this Estimate.',403);const result=await(await store(db)).prepare({...req.body,estimateId:estimate.id},{clientId:estimate.client_id,actorId:CURRENT_APP_USER.id});res.status(result.reused?200:201).json(result);}catch(error){fail(res,error)}});
  router.get('/estimates/:estimateId/documents/:documentId',async(req,res)=>{try{const {db,estimate}=await context(req.params.estimateId),result=await(await store(db)).read(req.params.documentId,{clientId:estimate.client_id,estimateId:estimate.id});res.set({'Content-Type':'application/pdf','Content-Length':String(result.bytes.length),'Content-Disposition':`inline; filename="${result.document.fileName.replace(/["\r\n]/g,'')}"`,'ETag':`"${result.document.sha256}"`});res.send(result.bytes);}catch(error){fail(res,error)}});
  return router;
}
