import { createHash, randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { ensureManagedParent, generateManagedStorageKey, readFileIntegrity, resolveManagedPath } from './managedAttachmentStorage.js';

const queues=new WeakMap();
// Router service instances share the connection. Serialize staging transactions
// on that connection; BEGIN IMMEDIATE also protects separate connections.
export async function stageManufacturerUpload(db,{estimateId,bytes,fileName,mediaType,attachmentRoot}){
  const previous=queues.get(db)||Promise.resolve();
  const pending=previous.catch(()=>{}).then(async()=>{
    const sha256=createHash('sha256').update(bytes).digest('hex');
    let target,fileCreated=false,committed=false;
    await db.exec('BEGIN IMMEDIATE');
    try{
      if(!await db.get('SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL',estimateId))throw Object.assign(new Error('The selected Estimate is not available.'),{status:404,code:'estimate_not_found'});
      const matches=await db.all(`SELECT a.id,a.revision_id,r.supplier_quote_id,q.supplier_code,a.storage_key,a.size_bytes FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id AND r.estimate_id=a.estimate_id JOIN supplier_quotes q ON q.id=r.supplier_quote_id AND q.estimate_id=a.estimate_id WHERE a.estimate_id=? AND a.sha256=? AND a.role='original_quote' AND a.parser_eligible=1 ORDER BY a.created_at,a.id LIMIT 2`,estimateId,sha256);
      if(matches.length>1)throw Object.assign(new Error('This exact document is already retained more than once. Open Files / Documents and select the intended supplier quotation for review; no additional copy was saved.'),{status:409,code:'manufacturer_upload_ambiguous_source'});
      if(matches.length){
        const source=matches[0],integrity=await readFileIntegrity(resolveManagedPath(source.storage_key,attachmentRoot));
        if(integrity.sha256!==sha256||integrity.sizeBytes!==bytes.length)throw Object.assign(new Error('The retained quotation could not be verified. Its evidence has not been replaced. Review the saved source before retrying.'),{status:409,code:'manufacturer_upload_integrity_conflict'});
        await db.exec('COMMIT');committed=true;
        return {duplicate:true,documents:[{quoteId:source.supplier_quote_id,revisionId:source.revision_id,attachmentId:source.id}]};
      }
      const quoteId=randomUUID(),revisionId=randomUUID(),attachmentId=randomUUID(),at=new Date().toISOString();
      const storageKey=generateManagedStorageKey({estimateId,revisionId,attachmentId});target=await ensureManagedParent(storageKey,attachmentRoot);
      await writeFile(target,bytes,{flag:'wx'});
      fileCreated=true;
      await db.run('INSERT INTO supplier_quotes(id,estimate_id,supplier_code,supplier_name,created_at,updated_at,archived_at) VALUES(?,?,?,?,?,?,NULL)',quoteId,estimateId,`AUTO-${quoteId}`,'Automatic identification pending',at,at);
      await db.run(`INSERT INTO supplier_quote_revisions(id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,full_quotation_reference,currency,vat_status,lifecycle_status,created_at) VALUES(?,?,?,0,'',?,'XXX','unknown','uploaded',?)`,revisionId,quoteId,estimateId,`Analysis pending · ${fileName}`,at);
      await db.run(`INSERT INTO supplier_quote_attachments(id,estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at,document_kind,uploaded_by,upload_order) VALUES(?,?,?,'original_quote',?,?,?,?,?,1,?,'complete_quotation','local-admin',0)`,attachmentId,estimateId,revisionId,fileName,mediaType,bytes.length,sha256,storageKey,at);
      await db.exec('COMMIT');committed=true;
      return {duplicate:false,documents:[{quoteId,revisionId,attachmentId}]};
    }catch(error){if(!committed){await db.exec('ROLLBACK').catch(()=>{});if(fileCreated)await unlink(target).catch(()=>{});}throw error;}
  });
  queues.set(db,pending);try{return await pending}finally{if(queues.get(db)===pending)queues.delete(db)}
}
