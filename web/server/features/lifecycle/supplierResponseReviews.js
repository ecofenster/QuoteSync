import { createHash, randomUUID } from 'node:crypto';

const text=value=>String(value??'').trim();
const fail=(message,code='supplier_response_review_invalid')=>Object.assign(new Error(message),{status:409,code});

export async function supplierResponseReviewContext(db, requestId) {
  const suppliers=await db.all(`SELECT se.id,se.supplier_id,se.response_state,se.project_id,se.estimate_id,
    COALESCE(s.supplier_name,se.recipient,'Supplier') supplier_name
    FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id
    WHERE se.revision_request_id=? AND se.status<>'cancelled'
    AND NOT EXISTS(SELECT 1 FROM supplier_enquiry_drafts next WHERE next.supersedes_id=se.id AND next.status<>'cancelled')
    ORDER BY se.created_at,se.id`,requestId);
  const result=[];
  for(const supplier of suppliers){
    const documents=await db.all(`SELECT DISTINCT doc.id,doc.file_name,doc.provider_revision,doc.checksum
      FROM manufacturer_response_links link JOIN canonical_documents doc ON doc.id=link.canonical_document_id
      WHERE link.supplier_enquiry_id=? AND link.project_id=? AND link.estimate_id=? AND doc.project_id=?
      AND doc.removed_at IS NULL AND doc.trashed=0 ORDER BY doc.id`,supplier.id,supplier.project_id,supplier.estimate_id,supplier.project_id);
    const evidenceIdentity=JSON.stringify({supplierId:supplier.id,projectId:supplier.project_id,estimateId:supplier.estimate_id,documents:documents.map(({id,provider_revision,checksum})=>({id,provider_revision,checksum}))});
    const saved=await db.get('SELECT * FROM supplier_response_reviews WHERE supplier_enquiry_id=? ORDER BY rowid DESC LIMIT 1',supplier.id);
    const review=saved?{id:saved.id,canonicalDocumentId:saved.canonical_document_id,checks:JSON.parse(saved.checks_json),unresolved:saved.unresolved,reviewedBy:saved.reviewed_by,reviewedAt:saved.created_at}:null;
    result.push({...supplier,documents,evidenceIdentity,review,reviewRequired:!saved||saved.evidence_identity!==evidenceIdentity||saved.unresolved>0||!documents.length||supplier.response_state!=='revised_document_received'});
  }
  return result;
}

export async function saveSupplierResponseReview(db,requestId,supplierId,input,deriveCheck) {
  const supplier=(await supplierResponseReviewContext(db,requestId)).find(item=>item.id===supplierId);
  if(!supplier)throw fail('Choose an active supplier request belonging to this customer revision.');
  const documentId=text(input.canonicalDocumentId),actor=text(input.reviewedBy),key=text(input.idempotencyKey);
  if(!actor||!key||key.length>200)throw fail('Staff identity and a valid review retry key are required.');
  if(!supplier.documents.some(doc=>doc.id===documentId))throw fail('Choose a retained document received for this exact supplier request. No other supplier document can be substituted.');
  if(!Array.isArray(input.checks)||!input.checks.length||input.checks.length>500)throw fail('Add the source-backed field checks for this supplier response.');
  const checks=[];const fields=new Set();
  for(const item of input.checks){
    const check={estimatePositionId:text(item.estimatePositionId)||null,fieldKey:text(item.fieldKey),beforeValue:text(item.beforeValue),expectedValue:text(item.expectedValue),afterValue:text(item.afterValue),beforeSourceReference:text(item.beforeSourceReference),afterSourceReference:text(item.afterSourceReference),resolutionNote:text(item.resolutionNote),approvedDifference:item.approvedDifference===true};
    if(!check.fieldKey||!check.beforeSourceReference||!check.afterSourceReference||!check.afterValue)throw fail('Each field needs before and after source references and a returned value. Your entries have not been changed.');
    if(check.estimatePositionId&&!await db.get('SELECT e.id FROM portal_review_position_entries e JOIN supplier_revision_requests r ON r.review_submission_id=e.review_submission_id WHERE r.id=? AND e.estimate_position_id=?',requestId,check.estimatePositionId))throw fail('A Position does not belong to this issued customer review.');
    const field=JSON.stringify([check.estimatePositionId,check.fieldKey]);if(fields.has(field))throw fail('Review each Position field once per supplier.');fields.add(field);
    checks.push({...check,status:check.approvedDifference&&check.resolutionNote&&check.beforeValue&&check.expectedValue?'approved_difference':deriveCheck(check)});
  }
  for(const previous of supplier.review?.checks||[])if(!fields.has(JSON.stringify([previous.estimatePositionId,previous.fieldKey])))throw fail('Keep every previously reviewed field and record its resolution. Earlier supplier checks cannot be silently removed.');
  const unresolved=checks.filter(check=>!['implemented','approved_difference'].includes(check.status)).length;
  const contentHash=createHash('sha256').update(JSON.stringify({documentId,actor,checks,evidenceIdentity:supplier.evidenceIdentity})).digest('hex');
  const existing=await db.get('SELECT * FROM supplier_response_reviews WHERE supplier_enquiry_id=? AND idempotency_key=?',supplierId,key);
  if(existing){
    if(existing.content_hash!==contentHash)throw fail('The review changed since that save attempt. Reload the current supplier review before saving changed evidence.');
    // Repair a saved review whose subsequent aggregate invalidation failed,
    // without clearing an overall review completed after this supplier save.
    try{await db.run('UPDATE supplier_revision_requests SET verified_at=NULL,updated_at=? WHERE id=? AND verified_at<=?',existing.created_at,requestId,existing.created_at)}catch{throw fail('The supplier review is saved, but the overall revision status is incomplete. Retry with the same values to reuse the saved review.','supplier_response_review_partial');}
    return {id:existing.id,unresolved:existing.unresolved,idempotentReplay:true};
  }
  const id=randomUUID(),at=new Date().toISOString();
  await db.run(`INSERT INTO supplier_response_reviews(id,supplier_enquiry_id,idempotency_key,content_hash,evidence_identity,canonical_document_id,checks_json,unresolved,reviewed_by,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(supplier_enquiry_id,idempotency_key) DO NOTHING`,id,supplierId,key,contentHash,supplier.evidenceIdentity,documentId,JSON.stringify(checks),unresolved,actor,at);
  const saved=await db.get('SELECT id,content_hash,unresolved FROM supplier_response_reviews WHERE supplier_enquiry_id=? AND idempotency_key=?',supplierId,key);
  if(saved.content_hash!==contentHash)throw fail('Another save used this retry key with different evidence. Reload the supplier review.');
  // Final overall customer review must be explicit after any supplier review.
  try{await db.run('UPDATE supplier_revision_requests SET verified_at=NULL,updated_at=? WHERE id=?',at,requestId)}catch{throw fail('The supplier review is saved, but the overall revision status is incomplete. Retry with the same values to reuse the saved review.','supplier_response_review_partial');}
  return {id:saved.id,unresolved:saved.unresolved,idempotentReplay:saved.id!==id};
}
