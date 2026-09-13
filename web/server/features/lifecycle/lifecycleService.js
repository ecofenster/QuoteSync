import { createHash, randomUUID } from 'node:crypto';
import { createPortalSecurityService } from '../clientPortal/portalSecurityService.js';
import { createCommunicationRepository } from '../communications/communicationRepository.js';
import { createCommunicationsService } from '../communications/communicationsService.js';
import { createTestDeliveryPolicy } from './testDeliveryPolicy.js';
import { createCustomerLifecycleDocumentService } from './customerLifecycleDocumentService.js';
import { createSupplierRevisionChangeDocumentService } from './supplierRevisionChangeDocumentService.js';
import { recordSupplierResponseState, outstandingSupplierRevisionRequests, outstandingSupplierResponseReviews, supplierReviewSourceIdentity, staleSupplierReviewCount } from './supplierResponseState.js';
import {factoryAttachmentOptions,savedFactoryAttachments,reviewFactoryAttachments,assertFactoryAttachmentsCurrent,factoryCommunicationAttachments} from './factoryAttachmentReview.js';
import {factoryDeliveryState,sendFactoryOnce} from './factoryDelivery.js';
import {sendSupplierOnce} from './supplierDelivery.js';
import {readLegacySupplierCorrespondence} from './legacySupplierCorrespondence.js';

const text = (value) => String(value ?? '').trim();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const problem = (message, status = 422, code = 'lifecycle_invalid') => Object.assign(new Error(message), { status, code });
const normalized = (value) => text(value).toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');
const parse = (value, fallback = []) => { try { return JSON.parse(value || ''); } catch { return fallback; } };
const plusCalendarDays = (value, days) => { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString(); };

export function deriveRevisionCheck(input = {}) {
  const before = text(input.beforeValue), expected = text(input.expectedValue), after = text(input.afterValue);
  if (!after || !text(input.afterSourceReference)) return 'needs_review';
  if (expected && normalized(after) === normalized(expected)) return 'implemented';
  if (before && normalized(after) === normalized(before)) return 'not_implemented';
  return 'needs_review';
}

export function deriveConfirmationCheck(input = {}) {
  const approved = text(input.approvedValue), confirmed = text(input.confirmedValue);
  if (!confirmed || !text(input.confirmationSourceReference)) return 'needs_review';
  return normalized(approved) === normalized(confirmed) ? 'no_change' : 'change_detected';
}

export function createLifecycleService(db, options = {}) {
  const now = options.now || (() => new Date());
  const portal = options.portal || createPortalSecurityService(db, options.portalOptions);
  const delivery = options.deliveryPolicy || createTestDeliveryPolicy(options.environment);
  const communicationService = options.communicationService || createCommunicationsService(db, { ...(options.communicationOptions || {}), environment: options.environment, deliveryPolicy: delivery });
  const communications = options.communications || communicationService.repository || createCommunicationRepository(db);
  const customerDocuments = options.customerDocuments || createCustomerLifecycleDocumentService(db, options.documentOptions);
  const supplierChangeDocuments = options.supplierChangeDocuments || createSupplierRevisionChangeDocumentService(db, options.documentOptions);
  const stamp = () => now().toISOString();
  const revisionWorkflowState=(row)=>row?.workflow_state==='sent_to_supplier'&&row.response_due_at&&new Date(row.response_due_at)<now()?'supplier_response_overdue':row?.workflow_state||row?.status||'revision_requested';
  const deliverOrSave = (message, send) => send === true ? communicationService.sendMessage(message) : communications.save(message);

  async function event(eventName, evidenceId, links) {
    const at = stamp();
    await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING`, randomUUID(), eventName, evidenceId, at, JSON.stringify(links), at);
  }

  async function changesRequestedQueue() {
    const rows = await db.all(`SELECT r.id review_submission_id,r.estimate_release_id,r.status,r.general_comment,r.submitted_at,
      rel.estimate_id,rel.estimate_revision,rel.client_id,rel.project_id,c.client_ref,c.name client_name,p.name project_name,
      (SELECT COUNT(*) FROM portal_review_position_entries e WHERE e.review_submission_id=r.id AND e.response='amendment_requested') amendment_count,
      sr.id supplier_revision_request_id,COALESCE(sr.workflow_state,sr.status) supplier_revision_status,sr.successor_estimate_id
      FROM portal_review_submissions r JOIN estimate_revision_releases rel ON rel.id=r.estimate_release_id
      JOIN clients c ON c.id=rel.client_id JOIN projects p ON p.id=rel.project_id
      LEFT JOIN supplier_revision_requests sr ON sr.review_submission_id=r.id
      WHERE r.general_response='amendment_requested' OR EXISTS(SELECT 1 FROM portal_review_position_entries e WHERE e.review_submission_id=r.id AND e.response='amendment_requested')
      ORDER BY r.submitted_at DESC`);
    return rows.map((row) => ({ ...row, amendment_count: Number(row.amendment_count) }));
  }

  async function changeRequestDetail(reviewId) {
    const review = await db.get(`SELECT r.*,rel.estimate_id,rel.estimate_revision,rel.client_id,rel.project_id,rel.customer_projection_json,
      c.client_ref,c.name client_name,p.name project_name,sr.id supplier_revision_request_id,COALESCE(sr.workflow_state,sr.status) supplier_revision_status,sr.recipient,sr.subject,sr.body_text,sr.successor_estimate_id,sr.returned_document_id,sr.returned_revision,sr.verified_at
      FROM portal_review_submissions r JOIN estimate_revision_releases rel ON rel.id=r.estimate_release_id
      JOIN clients c ON c.id=rel.client_id JOIN projects p ON p.id=rel.project_id
      LEFT JOIN supplier_revision_requests sr ON sr.review_submission_id=r.id WHERE r.id=?`, reviewId);
    if (!review) throw problem('Customer change submission was not found.', 404, 'review_not_found');
    const entries = await db.all('SELECT * FROM portal_review_position_entries WHERE review_submission_id=? ORDER BY position_reference', reviewId);
    const checks = review.supplier_revision_request_id ? await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY change_kind,estimate_position_id,field_key', review.supplier_revision_request_id) : [];
    const documents = await db.all('SELECT id,file_name,document_type,provider_revision revision,provider_modified_at modified_at FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 ORDER BY provider_modified_at DESC', review.project_id);
    const supplierRevision=review.supplier_revision_request_id?await supplierRevisionDetail(review.supplier_revision_request_id):null;
    return { reviewSubmissionId: review.id, estimateReleaseId: review.estimate_release_id, estimateId: review.estimate_id, estimateRevision: Number(review.estimate_revision), clientId: review.client_id, clientReference: review.client_ref, clientName: review.client_name, projectId: review.project_id, projectName: review.project_name, status: review.status, generalComment: review.general_comment, generalResponse: review.general_response, submittedAt: review.submitted_at, positions: entries.map((entry) => ({ id: entry.id, estimatePositionId: entry.estimate_position_id, reference: entry.position_reference, response: entry.response, comment: entry.comment })), supplierRevision, checks, documents };
  }

  async function supplierRevisionDetail(requestId) {
    const request = await db.get(`SELECT sr.*,rel.project_id,rel.client_id,p.name project_name,c.name client_name,e.estimate_ref successor_estimate_ref
      FROM supplier_revision_requests sr JOIN estimate_revision_releases rel ON rel.id=sr.source_release_id
      JOIN projects p ON p.id=rel.project_id JOIN clients c ON c.id=rel.client_id JOIN estimates e ON e.id=sr.successor_estimate_id WHERE sr.id=?`, requestId);
    if (!request) throw problem('Supplier revision request was not found.', 404, 'supplier_revision_request_not_found');
    const hasSupplierAttachments = Boolean(await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_quote_attachments'"));
    const supplierDocuments = hasSupplierAttachments ? await db.all(`SELECT a.id,a.original_file_name file_name,COALESCE(r.supplier_revision,CAST(r.revision_sequence AS TEXT)) revision,r.id revision_id FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id WHERE a.estimate_id=? ORDER BY a.created_at DESC`, request.successor_estimate_id) : [];
    const supplierRequests=await db.all(`SELECT se.*,s.supplier_name FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id WHERE se.revision_request_id=? ORDER BY se.created_at`,requestId);
    return { id: request.id, status: revisionWorkflowState(request), reviewSubmissionId: request.review_submission_id, sourceReleaseId: request.source_release_id, successorEstimateId: request.successor_estimate_id, successorEstimateRef: request.successor_estimate_ref, clientId: request.client_id, clientName: request.client_name, projectId: request.project_id, projectName: request.project_name, responsibleUserId:request.responsible_user_id||null,recipient: request.recipient, subject: request.subject, bodyText: request.body_text, summary: parse(request.summary_json, {}), documentIds: parse(request.document_ids_json, []), communicationMessageId: request.communication_message_id,sentAt:request.sent_at||null,responseDueAt:request.response_due_at||null,receivedAt:request.received_at||null,completedAt:request.completed_at||null,supplierRequests:supplierRequests.map(supplierEnquiryView), returnedDocumentId: request.returned_document_id, returnedSourceKind: request.returned_source_kind, returnedRevision: request.returned_revision, verifiedAt: request.verified_at, checks: await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY change_kind,estimate_position_id,field_key', requestId), supplierDocuments };
  }

  async function supplierReviewHistory(requestId, offset = 0) {
    if (!await db.get('SELECT id FROM supplier_revision_requests WHERE id=?',requestId)) throw problem('Supplier revision request was not found.',404,'supplier_revision_request_not_found');
    const start=Number(offset);
    if (!Number.isSafeInteger(start)||start<0) throw problem('Choose a valid history page.',422,'supplier_review_history_page_invalid');
    const total=Number((await db.get('SELECT COUNT(*) count FROM supplier_revision_review_history WHERE request_id=?',requestId)).count);
    const rows=await db.all('SELECT * FROM supplier_revision_review_history WHERE request_id=? ORDER BY reviewed_at DESC,id DESC LIMIT 10 OFFSET ?',requestId,start);
    return {total,offset:start,items:rows.map(row=>({id:row.id,recordedAt:row.reviewed_at,recordedBy:row.reviewed_by,checks:parse(row.checks_json,[])}))};
  }

  const supplierEnquiryView = (row) => ({
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name || null,
    recipient: row.recipient,
    subject: row.subject,
    bodyText: row.body_text,
    status: row.status,
    deliveryState: row.status==='sent'?'sent':row.delivery_state||'pending',
    revisionNo: Number(row.revision_no || 1),
    supersedesId: row.supersedes_id || null,
    documentIds: parse(row.document_ids_json, []),
    documentSnapshot: parse(row.document_snapshot_json, []),
    communicationMessageId: row.communication_message_id,
    idempotencyKey: row.idempotency_key || null,
    requestKind: row.request_kind || 'initial',
    revisionRequestId: row.revision_request_id || null,
    sentAt: row.sent_at || null,
    responseDueAt: row.response_due_at || null,
    responseState: row.response_state || 'outstanding',
    receivedAt: row.received_at || null,
    completedAt: row.completed_at || null,
    followupDueAt: row.followup_due_at || null,
    followupAttemptedAt: row.followup_attempted_at || null,
    followupSentAt: row.followup_sent_at || null,
    followupFailure: row.followup_failure || '',
    followupDeliveryState: row.followup_sent_at ? 'sent' : row.followup_delivery_state || (row.followup_attempted_at ? 'uncertain' : 'pending'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  async function supplierEnquiryContext(projectId, estimateId) {
    const project = await db.get(`SELECT p.id,p.client_id,p.name,c.name client_name,c.client_ref
      FROM projects p JOIN clients c ON c.id=p.client_id
      WHERE p.id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL`, projectId);
    if (!project) throw problem('Project was not found.', 404, 'project_not_found');
    const estimates = await db.all(`SELECT id,estimate_ref,revision_no,status FROM estimates
      WHERE project_id=? AND deleted_at IS NULL ORDER BY revision_no DESC,updated_at DESC LIMIT 50`, projectId);
    const selectedEstimateId = text(estimateId) || estimates[0]?.id || '';
    if (selectedEstimateId && !estimates.some((item) => item.id === selectedEstimateId)) throw problem('Working Estimate must belong to the selected Project.', 422, 'supplier_enquiry_estimate_invalid');
    const documents = await db.all(`SELECT id,file_name,mime_type,size_bytes,document_type,provider_file_id,provider_revision,checksum,folder_path
      FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0
      ORDER BY provider_modified_at DESC,file_name LIMIT 200`, projectId);
    const suppliers = await db.all(`SELECT supplier_code id,supplier_name name FROM supplier_commercial_defaults
      WHERE NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT'))
      ORDER BY supplier_name,supplier_code`);
    const enquiries = await db.all(`SELECT se.*,s.supplier_name,(SELECT state FROM supplier_delivery_attempts a WHERE a.supplier_enquiry_id=se.id ORDER BY a.created_at DESC,a.rowid DESC LIMIT 1) delivery_state FROM supplier_enquiry_drafts se
      LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id
      WHERE se.project_id=? AND (?='' OR se.estimate_id=?) ORDER BY se.created_at DESC LIMIT 50`, projectId, selectedEstimateId, selectedEstimateId);
    const revisionRequest = selectedEstimateId ? await db.get(`SELECT sr.*,r.submitted_at FROM supplier_revision_requests sr
      JOIN portal_review_submissions r ON r.id=sr.review_submission_id
      WHERE sr.successor_estimate_id=? AND sr.status<>'cancelled' ORDER BY sr.created_at DESC LIMIT 1`, selectedEstimateId).catch(()=>null) : null;
    const legacyPrepared = selectedEstimateId ? await db.all(`SELECT a.id,a.status,a.request_json,a.created_at,q.supplier_name
      FROM estimate_procurement_actions a LEFT JOIN supplier_quotes q ON q.id=a.supplier_quote_id
      WHERE a.estimate_id=? AND a.action_type='request_supplier_revision' ORDER BY a.created_at DESC LIMIT 20`, selectedEstimateId).catch(()=>[]) : [];
    const recommendedDocumentIds = documents.filter((item) => /drawing|schedule|price.?free|without.?prices/i.test(`${item.document_type} ${item.file_name}`)).map((item) => item.id);
    const legacyCorrespondence=revisionRequest?await readLegacySupplierCorrespondence(db,revisionRequest.id):{items:[],total:0};
    return {
      project: { id: project.id, clientId: project.client_id, clientName: project.client_name, clientReference: project.client_ref, name: project.name },
      selectedEstimateId: selectedEstimateId || null,
      estimates: estimates.map((item) => ({ id: item.id, estimateRef: item.estimate_ref, revisionNo: Number(item.revision_no || 1), status: item.status })),
      suppliers,
      documents: documents.map((item) => ({ id: item.id, fileName: item.file_name, mediaType: item.mime_type, sizeBytes: Number(item.size_bytes || 0), documentType: item.document_type, providerFileId: item.provider_file_id, providerRevision: item.provider_revision, checksum: item.checksum, folderPath: item.folder_path })),
      enquiries: enquiries.map(supplierEnquiryView),
      requestMode: revisionRequest ? 'revision' : 'initial',
      revisionRequest: revisionRequest ? { id:revisionRequest.id,status:revisionWorkflowState(revisionRequest),sourceReleaseId:revisionRequest.source_release_id,summary:parse(revisionRequest.summary_json,{}),submittedAt:revisionRequest.submitted_at,responseDueAt:revisionRequest.response_due_at||null } : null,
      legacyPrepared: legacyPrepared.map((item)=>({id:item.id,status:item.status,supplierName:item.supplier_name||null,request:parse(item.request_json,{}),createdAt:item.created_at})),
      legacyCorrespondence: legacyCorrespondence.items,legacyCorrespondenceTotal:legacyCorrespondence.total,
      recommendedDocumentIds,
      delivery: delivery.publicStatus(),
    };
  }

  async function prepareSupplierEnquiry(projectId, input = {}) {
    const actor=text(input.createdBy),recipient=text(input.recipient),subject=text(input.subject),bodyText=text(input.bodyText),estimateId=text(input.estimateId),supplierId=text(input.supplierId),documentIds=[...new Set((input.documentIds||[]).map(text).filter(Boolean))],requestKind=input.requestKind==='revision'?'revision':'initial',revisionRequestId=text(input.revisionRequestId)||null;
    if(!actor||!recipient||!subject||!bodyText)throw problem('Project, factory recipient, subject, message and staff identity are required.');
    const project=await db.get('SELECT p.id,p.client_id,p.name FROM projects p WHERE p.id=? AND p.deleted_at IS NULL',projectId);if(!project)throw problem('Project was not found.',404,'project_not_found');
    if(!estimateId||!await db.get('SELECT id FROM estimates WHERE id=? AND project_id=? AND deleted_at IS NULL',estimateId,projectId))throw problem('Choose a current working Estimate for this Project.',422,'supplier_enquiry_estimate_invalid');
    const supplier=await db.get(`SELECT supplier_code,supplier_name FROM supplier_commercial_defaults WHERE supplier_code=?
      AND NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT'))`,supplierId);
    if(!supplier)throw problem('Choose a current supplier from Administration.',422,'supplier_enquiry_supplier_invalid');
    const revisionRequest=revisionRequestId?await db.get(`SELECT sr.*,rel.project_id FROM supplier_revision_requests sr JOIN estimate_revision_releases rel ON rel.id=sr.source_release_id WHERE sr.id=? AND sr.successor_estimate_id=? AND rel.project_id=? AND sr.status<>'cancelled'`,revisionRequestId,estimateId,projectId):null;
    if(requestKind==='revision'&&!revisionRequest)throw problem('The supplier revision request is no longer linked to this working Estimate. Reopen the customer change request and try again.',409,'supplier_revision_context_invalid');
    const documents=documentIds.length?await db.all(`SELECT id,file_name,mime_type,size_bytes,provider_file_id,provider_revision,checksum,folder_path,document_type FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 AND id IN (${documentIds.map(()=>'?').join(',')})`,projectId,...documentIds):[];
    if(documents.length!==documentIds.length)throw problem('Every selected supplier-enquiry file must be a current canonical document for this Project.',422,'supplier_enquiry_document_invalid');
    if(input.send===true)delivery.assertRecipient(recipient,'factory');
    const documentSnapshot=documents.map(document=>({id:document.id,fileName:document.file_name,mediaType:document.mime_type,sizeBytes:Number(document.size_bytes||0),providerFileId:document.provider_file_id,providerRevision:document.provider_revision,checksum:document.checksum,folderPath:document.folder_path,documentType:document.document_type}));
    const contentSha256=hash({projectId,estimateId,supplierId,recipient:normalized(recipient),subject,bodyText,requestKind,revisionRequestId,documentSnapshot:documentSnapshot.map(document=>({id:document.id,providerFileId:document.providerFileId,providerRevision:document.providerRevision,checksum:document.checksum}))});
    const idempotencyKey=text(input.idempotencyKey)||`content:${contentSha256}`;
    const existing=await db.get('SELECT se.*,s.supplier_name FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id WHERE se.idempotency_key=?',idempotencyKey);
    if(!existing&&input.send===true){
      // Persist the canonical request before delivery, retaining this exact key
      // through partial-save recovery and concurrent requests.
      await prepareSupplierEnquiry(projectId,{...input,send:false,idempotencyKey});
      return prepareSupplierEnquiry(projectId,{...input,send:true,idempotencyKey});
    }
    if(existing){
      if(existing.content_sha256&&existing.content_sha256!==contentSha256)throw problem('This request retry key belongs to different reviewed content. Start a new request revision if the reviewed content changed.',409,'supplier_enquiry_idempotency_conflict');
      if(input.send===true&&existing.status!=='sent'){
        delivery.assertRecipient(recipient,'factory');
        const prepared=await communications.get(existing.communication_message_id);if(!prepared)throw problem('The prepared Email draft could not be found. The supplier request is still retained; open its details and prepare a replacement draft.',409,'supplier_enquiry_communication_missing');
        const receipt=await sendSupplierOnce(db,{requestId:existing.id,message:prepared,now:stamp,send:({attemptId})=>communicationService.sendMessage({...prepared,provider:'google_workspace',folder:'sent',status:'sending'},{supplierDeliveryAttemptId:attemptId})});
        const sent={id:prepared.id},sentAt=receipt.sent_at,responseDueAt=requestKind==='revision'?plusCalendarDays(sentAt,7):null;
        try{
        await db.run("UPDATE supplier_enquiry_drafts SET status='sent',sent_at=?,response_due_at=?,followup_due_at=?,followup_failure='',updated_at=? WHERE id=?",sentAt,responseDueAt,responseDueAt,sentAt,existing.id);
        if(revisionRequestId)await db.run("UPDATE supplier_revision_requests SET status='sent',workflow_state='sent_to_supplier',sent_at=COALESCE(sent_at,?),response_due_at=?,updated_at=? WHERE id=?",sentAt,responseDueAt,sentAt,revisionRequestId);
        await event(requestKind==='revision'?'supplier.revision.sent':'supplier.enquiry.sent',existing.id,[{kind:'project',id:projectId},{kind:'communication',id:sent.id},{kind:'estimate',id:estimateId},...(revisionRequestId?[{kind:'supplier_revision_request',id:revisionRequestId}]:[])]);
        const refreshed=await db.get('SELECT se.*,s.supplier_name FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id WHERE se.id=?',existing.id);
        return{...supplierEnquiryView(refreshed),documents:parse(refreshed.document_snapshot_json,[]),delivery:delivery.publicStatus(),idempotentReplay:false,nextAction:responseDueAt?`Supplier response due ${responseDueAt.slice(0,10)}. The request remains open until the revised document is reviewed.`:'Wait for the supplier response.'};
        }catch(error){throw Object.assign(problem('The provider confirmed this supplier request was sent, but QuoteSuite could not finish its local result. Reopen the same saved request and choose Finish saved result. The recorded send will be reused without another email.',409,'supplier_delivery_partial_success'),{cause:error});}
      }
      return{...supplierEnquiryView(existing),documents:parse(existing.document_snapshot_json,[]),delivery:delivery.publicStatus(),idempotentReplay:true,nextAction:existing.status==='sent'?'Wait for the supplier response.':'Review the saved Email draft, then send it when ready.'};
    }
    const latest=await db.get('SELECT id,COALESCE(MAX(revision_no),0) revision_no FROM supplier_enquiry_drafts WHERE project_id=? AND estimate_id=? AND supplier_id=?',projectId,estimateId,supplierId);
    const revisionNo=Number(latest?.revision_no||0)+1,id=randomUUID(),communicationId=`supplier-rfq-${createHash('sha256').update(idempotencyKey).digest('hex').slice(0,24)}`,at=stamp();
    let changeDocument=null;if(revisionRequestId){const request=await supplierRevisionDetail(revisionRequestId),review=await changeRequestDetail(request.reviewSubmissionId);changeDocument=await supplierChangeDocuments.create(revisionRequestId,{clientName:request.clientName,projectName:request.projectName,estimateReference:request.summary.sourceEstimateRef,estimateRevision:request.summary.sourceRevision,submittedAt:review.submittedAt,generalComment:review.generalComment,generalResponse:review.generalResponse,positions:review.positions});}
    const message={id:communicationId,provider:input.send===true?'google_workspace':'quotesuite_preview',direction:'outbound',folder:input.send===true?'sent':'drafts',status:input.send===true?'sending':'draft',from:[],to:[recipient],cc:[],bcc:[],subject,bodyText,bodyHtml:`<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')}</p>`,links:[{kind:'project',id:projectId},{kind:'estimate',id:estimateId},{kind:'supplier',id:supplierId},...(revisionRequestId?[{kind:'supplier_revision_request',id:revisionRequestId}]:[])],attachments:[...(changeDocument?[{id:`${communicationId}:changes`,fileName:changeDocument.fileName,mediaType:changeDocument.mediaType,sizeBytes:changeDocument.sizeBytes,storageKey:changeDocument.storageKey,sha256:changeDocument.sha256}]:[]),...documents.map(document=>({id:`${communicationId}:${document.id}`,fileName:document.file_name,mediaType:document.mime_type,sizeBytes:Number(document.size_bytes||0),driveFileId:document.provider_file_id,sha256:document.checksum}))]};
    const communication=await deliverOrSave(message,input.send);
    const status=input.send===true?'sent':'draft',sentAt=input.send===true?(communication.sentAt||at):null,responseDueAt=sentAt&&requestKind==='revision'?plusCalendarDays(sentAt,7):null;
    try{await db.run(`INSERT INTO supplier_enquiry_drafts(id,project_id,estimate_id,supplier_id,recipient,subject,body_text,document_ids_json,document_snapshot_json,communication_message_id,status,idempotency_key,content_sha256,revision_no,supersedes_id,created_by,created_at,updated_at,request_kind,revision_request_id,sent_at,response_due_at,followup_due_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,id,projectId,estimateId,supplierId,recipient,subject,bodyText,JSON.stringify(documentIds),JSON.stringify(documentSnapshot),communicationId,status,idempotencyKey,contentSha256,revisionNo,latest?.id||null,actor,at,at,requestKind,revisionRequestId,sentAt,responseDueAt,responseDueAt);}
    catch(cause){throw Object.assign(new Error(`${input.send===true?'The RFQ was sent':'The Email draft was saved'}, but QuoteSuite could not finish its RFQ record. Retry with the same RFQ open; completed work will be reused.`),{status:409,code:'supplier_enquiry_partial_success',cause,details:{communicationMessageId:communication.id,idempotencyKey}});}
    if(revisionRequestId)await db.run("UPDATE supplier_revision_requests SET workflow_state=?,status=?,communication_message_id=?,recipient=?,subject=?,body_text=?,sent_at=COALESCE(sent_at,?),response_due_at=COALESCE(?,response_due_at),updated_at=? WHERE id=?",input.send===true?'sent_to_supplier':'prepared_for_review',input.send===true?'sent':'approved',communication.id,recipient,subject,bodyText,sentAt,responseDueAt,at,revisionRequestId);
    await event(input.send===true?(requestKind==='revision'?'supplier.revision.sent':'supplier.enquiry.sent'):(requestKind==='revision'?'supplier.revision.prepared_for_review':'supplier.enquiry.prepared'),id,[{kind:'project',id:projectId},{kind:'communication',id:communicationId},{kind:'estimate',id:estimateId},{kind:'supplier',id:supplierId},...(revisionRequestId?[{kind:'supplier_revision_request',id:revisionRequestId}]:[])]);
    const saved=await db.get('SELECT se.*,s.supplier_name FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id WHERE se.id=?',id);
    return{...supplierEnquiryView(saved),documents:parse(saved.document_snapshot_json,[]),delivery:delivery.publicStatus(),idempotentReplay:false,nextAction:input.send===true?(responseDueAt?`Supplier response due ${responseDueAt.slice(0,10)}. The request remains open until the revised document is reviewed.`:'Wait for the supplier response, then file and review the returned quotation.'):'Review the saved Email draft before sending.'};
  }

  async function linkManufacturerResponse(projectId,input={}){
    const actor=text(input.createdBy),communicationId=text(input.communicationMessageId),documentId=text(input.canonicalDocumentId)||null,estimateId=text(input.estimateId)||null,supplierEnquiryId=text(input.supplierEnquiryId)||null;
    if(!actor||!communicationId)throw problem('Manufacturer response and staff identity are required.');
    const message=await communications.get(communicationId);if(!message)throw problem('Manufacturer response message was not found.',404,'manufacturer_response_not_found');
    if(message.direction!=='inbound')throw problem('Choose the inbound supplier response message, not the outgoing request.',422,'manufacturer_response_message_invalid');
    if(documentId&&!await db.get('SELECT id FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0',documentId,projectId))throw problem('Manufacturer response document must belong to the selected Project.',422,'manufacturer_response_document_invalid');
    if(estimateId&&!await db.get('SELECT id FROM estimates WHERE id=? AND project_id=? AND deleted_at IS NULL',estimateId,projectId))throw problem('Working Estimate must belong to the selected Project.',422,'manufacturer_response_estimate_invalid');
    if(supplierEnquiryId&&!await db.get('SELECT id FROM supplier_enquiry_drafts WHERE id=? AND project_id=? AND estimate_id IS ?',supplierEnquiryId,projectId,estimateId))throw problem('The selected supplier request does not belong to this Project and working Estimate.',422,'manufacturer_response_supplier_enquiry_invalid');
    const responseResult=(id,idempotentReplay)=>({id,projectId,estimateId,canonicalDocumentId:documentId,status:documentId?'ready_for_import':'review_required',responseState:documentId?'revised_document_received':'acknowledgement_received',nextAction:documentId?'Review with Manufacturer Import':'Review the acknowledgement and record a revised expected-return date if needed.',idempotentReplay});
    const existing=await db.get('SELECT * FROM manufacturer_response_links WHERE project_id=? AND communication_message_id=? AND canonical_document_id IS ?',projectId,communicationId,documentId);if(existing){
      if(existing.supplier_enquiry_id!==supplierEnquiryId||existing.estimate_id!==estimateId)throw problem('This response is already linked to a different supplier request or Estimate. Review the existing relationship before changing it.',409,'manufacturer_response_link_conflict');
      await recordSupplierResponseState(db,{supplierEnquiryId,documentId,receivedAt:existing.created_at});
      return responseResult(existing.id,true);
    }
    const id=randomUUID(),at=stamp();await db.run(`INSERT INTO manufacturer_response_links(id,project_id,estimate_id,supplier_enquiry_id,communication_message_id,canonical_document_id,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,id,projectId,estimateId,supplierEnquiryId,communicationId,documentId,documentId?'ready_for_import':'review_required',actor,at);
    await recordSupplierResponseState(db,{supplierEnquiryId,documentId,receivedAt:at});
    await communications.addLink(communicationId,{kind:'project',id:projectId});if(estimateId)await communications.addLink(communicationId,{kind:'estimate',id:estimateId});
    await event('supplier.response.linked',id,[{kind:'project',id:projectId},{kind:'communication',id:communicationId},...(documentId?[{kind:'document',id:documentId}]:[]),...(estimateId?[{kind:'estimate',id:estimateId}]:[])]);
    await event(documentId?'supplier.quote_returned':'supplier.acknowledgement_received',id,[{kind:'project',id:projectId},{kind:'communication',id:communicationId},...(documentId?[{kind:'document',id:documentId}]:[]),...(estimateId?[{kind:'estimate',id:estimateId}]:[]),...(supplierEnquiryId?[{kind:'supplier_enquiry',id:supplierEnquiryId}]:[])]);
    return responseResult(id,false);
  }

  async function prepareSupplierRevision(input = {}) {
    const reviewId = text(input.reviewSubmissionId), actor = text(input.createdBy);
    if (!reviewId || !actor) throw problem('Review submission and staff identity are required.');
    const existing = await db.get('SELECT * FROM supplier_revision_requests WHERE review_submission_id=?', reviewId);
    if (existing) return { ...existing, summary: parse(existing.summary_json, {}), documentIds: parse(existing.document_ids_json, []) };
    const review = await db.get(`SELECT r.*,rel.id release_id,rel.estimate_id,rel.estimate_revision,e.estimate_ref,c.name client_name,p.name project_name
      FROM portal_review_submissions r JOIN estimate_revision_releases rel ON rel.id=r.estimate_release_id JOIN estimates e ON e.id=rel.estimate_id
      JOIN clients c ON c.id=rel.client_id JOIN projects p ON p.id=rel.project_id WHERE r.id=?`, reviewId);
    if (!review) throw problem('Customer change submission was not found.', 404, 'review_not_found');
    const entries = await db.all(`SELECT * FROM portal_review_position_entries WHERE review_submission_id=? AND response='amendment_requested' ORDER BY position_reference`, reviewId);
    if (!entries.length && review.general_response !== 'amendment_requested') throw problem('This customer review contains no amendment requests.', 409, 'amendments_not_requested');
    const successor = await portal.createNextEstimateRevision({ estimateReleaseId: review.release_id, createdBy: actor, createdByName: text(input.createdByName) || actor, reason: 'customer_amendment' });
    const summary = { clientName: review.client_name, projectName: review.project_name, sourceEstimateRef: review.estimate_ref, sourceRevision: Number(review.estimate_revision), successorEstimateId: successor.id, successorEstimateRef: successor.estimate_ref, generalComment: review.general_comment, positions: entries.map((entry) => ({ positionId: entry.estimate_position_id, reference: entry.position_reference, request: entry.comment })) };
    const id = randomUUID(), at = stamp(), recipient = text(input.recipient), subject = text(input.subject) || `Requested Estimate changes · ${review.project_name}`;
    await db.run(`INSERT INTO supplier_revision_requests(id,review_submission_id,source_release_id,successor_estimate_id,status,recipient,subject,summary_json,document_ids_json,created_by,created_at,updated_at,workflow_state,responsible_user_id) VALUES(?,?,?,?,'draft',?,?,?,?,?,?,?,'revision_requested',?)`, id, reviewId, review.release_id, successor.id, recipient, subject, JSON.stringify(summary), JSON.stringify(input.documentIds || []), actor, at, at, actor);
    await event('supplier.revision_request.prepared', id, [{ kind: 'estimate_release', id: review.release_id }, { kind: 'estimate', id: successor.id }, { kind: 'project', id: review.project_id }]);
    return { id, status: 'draft', recipient, subject, summary, documentIds: input.documentIds || [], successorEstimateId: successor.id };
  }
  async function prepareSupplierRevisionCorrespondence(requestId, input = {}) {
    const request=await supplierRevisionDetail(requestId),supplierId=text(input.supplierId);
    if(!supplierId)throw problem('Choose the supplier in Request supplier estimate / revision on the working Estimate. The older correspondence is retained for review; nothing has been sent.',409,'supplier_revision_supplier_review_required');
    const bodyText=text(input.bodyText)||[
      `Please review the requested changes for ${request.projectName}.`,
      ...(request.summary.positions||[]).map(position=>`${position.reference}: ${position.request}`),
      ...(request.summary.generalComment?[`General: ${request.summary.generalComment}`]:[]),
      'Please return a revised quotation/document which identifies the changed values.',
    ].join('\n');
    const rfq=await prepareSupplierEnquiry(request.projectId,{...input,createdBy:input.reviewedBy,estimateId:request.successorEstimateId,supplierId,subject:text(input.subject)||request.subject,bodyText,documentIds:input.documentIds||request.documentIds,requestKind:'revision',revisionRequestId:requestId});
    const changeDocument=await supplierChangeDocuments.getByRequest(requestId);
    return {...(await supplierRevisionDetail(requestId)),supplierRequest:rfq,communicationMessageId:rfq.communicationMessageId,changeDocument:changeDocument?{id:changeDocument.id,fileName:changeDocument.fileName}:null,delivery:delivery.publicStatus()};
  }

  async function attachSupplierRevisionDocument(requestId, input = {}) {
    const request = await supplierRevisionDetail(requestId), sourceKind = input.sourceKind === 'supplier_quote_attachment' ? 'supplier_quote_attachment' : 'canonical_document', documentId = text(sourceKind === 'supplier_quote_attachment' ? input.supplierQuoteAttachmentId : input.canonicalDocumentId), revision = text(input.revision) || 'current', actor = text(input.reviewedBy);
    if (!documentId || !actor) throw problem('Returned document and staff identity are required.');
    const document = sourceKind === 'supplier_quote_attachment'
      ? await db.get(`SELECT a.id,a.original_file_name file_name,COALESCE(r.supplier_revision,CAST(r.revision_sequence AS TEXT)) provider_revision,a.sha256 checksum FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id WHERE a.id=? AND a.estimate_id=?`, documentId, request.successorEstimateId)
      : await db.get('SELECT id,file_name,provider_revision,checksum FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0', documentId, request.projectId);
    if (!document) throw problem('The returned supplier revision must be a current canonical document for this Project.', 422, 'supplier_revision_return_document_invalid');
    const previous=await db.get('SELECT * FROM supplier_revision_requests WHERE id=?',requestId);
    const changed=supplierReviewSourceIdentity(previous)!==supplierReviewSourceIdentity({returned_document_id:document.id,returned_source_kind:sourceKind,returned_revision:revision,returned_checksum:document.checksum});
    const receivedAt=stamp();await db.run("UPDATE supplier_revision_requests SET returned_document_id=?,returned_source_kind=?,returned_revision=?,returned_checksum=?,verified_at=CASE WHEN ? THEN NULL ELSE verified_at END,status='approved',workflow_state='revised_document_received',received_at=COALESCE(received_at,?),updated_at=? WHERE id=?", document.id, sourceKind, revision,document.checksum||null,changed?1:0,receivedAt,receivedAt, requestId);
    await event('supplier.revision.returned_document_linked', `${requestId}:${document.id}:${revision}`, [{ kind: 'supplier_revision_request', id: requestId }, { kind: sourceKind, id: document.id }, { kind: 'estimate', id: request.successorEstimateId }]);
    return { ...(await supplierRevisionDetail(requestId)), returnedDocument: { id: document.id, sourceKind, fileName: document.file_name, revision, checksum: document.checksum } };
  }

  async function verifySupplierRevision(requestId, input = {}) {
    const request = await db.get('SELECT * FROM supplier_revision_requests WHERE id=?', requestId);
    if (!request) throw problem('Supplier revision request was not found.', 404, 'supplier_revision_request_not_found');
    if (!request.returned_document_id) throw problem('Link the returned supplier revision document before verifying requested changes.', 409, 'supplier_revision_document_required');
    if(!text(input.reviewedBy))throw problem('Staff review identity is required.',422,'supplier_revision_reviewer_required');
    const checks = [...(Array.isArray(input.checks) ? input.checks.map((check) => ({ ...check, changeKind: 'requested' })) : []), ...(Array.isArray(input.unrelatedChanges) ? input.unrelatedChanges.map((check) => ({ ...check, changeKind: 'unrelated_material_change', requestedChange: text(check.requestedChange) || 'Unrelated material change introduced by supplier revision' })) : [])];
    if (!checks.length) throw problem('At least one source-backed requested-change check is required.');
    if(checks.length>500)throw problem('Review up to 500 fields at a time.',422,'supplier_revision_checks_invalid');
    const reviewPositions=new Set((await db.all('SELECT estimate_position_id FROM portal_review_position_entries WHERE review_submission_id=?',request.review_submission_id)).map(row=>row.estimate_position_id));
    const fields=new Set();
    // Validate the entire submission before archiving or changing saved approval.
    for(const check of checks){
      const positionId=text(check.estimatePositionId)||null,fieldKey=text(check.fieldKey);
      if(positionId&&!reviewPositions.has(positionId))throw problem('A reviewed Position does not belong to this issued customer revision. Reopen the customer change request and select its Position. Your saved review has not changed.',422,'supplier_revision_position_invalid');
      const identity=JSON.stringify([positionId,fieldKey]);
      if(!fieldKey||fields.has(identity))throw problem('Give each reviewed field a name and include it only once per Position. Your saved review has not changed.',422,'supplier_revision_checks_invalid');
      fields.add(identity);
      if(check.approvedDifference===true&&(!text(check.beforeValue)||!text(check.expectedValue)||!text(check.afterValue)||!text(check.beforeSourceReference)||!text(check.afterSourceReference)||!text(check.resolutionNote)))throw problem('To approve a difference, enter the original, expected and returned values, both source references, and your review reason. Your entries can be completed and retried; the saved review has not changed.',422,'supplier_revision_difference_evidence_required');
    }
    const at = stamp();
    const sourceIdentity=supplierReviewSourceIdentity(request);
    const preceding=await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY id',requestId);
    if(preceding.length)await db.run('INSERT INTO supplier_revision_review_history(id,request_id,source_identity,checks_json,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?)',randomUUID(),requestId,JSON.stringify([...new Set(preceding.map(check=>check.source_identity||'legacy-unrecorded'))]),JSON.stringify(preceding),text(input.reviewedBy),at);
    await db.run('UPDATE supplier_revision_requests SET verified_at=NULL,updated_at=? WHERE id=?',at,requestId);
    for (const check of checks) {
      const status = check.approvedDifference === true && text(check.resolutionNote) ? 'approved_difference' : deriveRevisionCheck(check);
      const existingCheck=await db.get('SELECT id FROM revision_change_checks WHERE supplier_revision_request_id=? AND estimate_position_id IS ? AND field_key=?',requestId,text(check.estimatePositionId)||null,text(check.fieldKey));
      if(existingCheck){
        await db.run('UPDATE revision_change_checks SET after_value=?,status=?,after_source_reference=?,resolution_note=?,resolved_by=?,resolved_at=?,change_kind=?,source_identity=? WHERE supplier_revision_request_id=? AND estimate_position_id IS ? AND field_key=?',text(check.afterValue)||null,status,text(check.afterSourceReference)||null,text(check.resolutionNote),text(input.reviewedBy),at,check.changeKind,sourceIdentity,requestId,text(check.estimatePositionId)||null,text(check.fieldKey));
        continue;
      }
      await db.run(`INSERT INTO revision_change_checks(id,supplier_revision_request_id,estimate_position_id,field_key,requested_change,before_value,expected_value,after_value,status,before_source_reference,after_source_reference,resolution_note,resolved_by,resolved_at,created_at,change_kind)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(supplier_revision_request_id,estimate_position_id,field_key) DO UPDATE SET after_value=excluded.after_value,status=excluded.status,after_source_reference=excluded.after_source_reference,resolution_note=excluded.resolution_note,resolved_by=excluded.resolved_by,resolved_at=excluded.resolved_at,change_kind=excluded.change_kind`, randomUUID(), requestId, text(check.estimatePositionId) || null, text(check.fieldKey), text(check.requestedChange), text(check.beforeValue) || null, text(check.expectedValue) || null, text(check.afterValue) || null, status, text(check.beforeSourceReference) || null, text(check.afterSourceReference) || null, text(check.resolutionNote), text(input.reviewedBy) || null, input.reviewedBy ? at : null, at, check.changeKind);
      await db.run('UPDATE revision_change_checks SET source_identity=? WHERE supplier_revision_request_id=? AND estimate_position_id IS ? AND field_key=?',sourceIdentity,requestId,text(check.estimatePositionId)||null,text(check.fieldKey));
    }
    const requestedPositions = await db.all(`SELECT e.estimate_position_id FROM portal_review_position_entries e WHERE e.review_submission_id=? AND e.response='amendment_requested'`, request.review_submission_id);
    const generalReview = await db.get('SELECT general_response FROM portal_review_submissions WHERE id=?', request.review_submission_id);
    const covered = new Set((await db.all(`SELECT DISTINCT estimate_position_id FROM revision_change_checks WHERE supplier_revision_request_id=? AND change_kind='requested'`, requestId)).map((row) => row.estimate_position_id));
    const missingRequestedPositions = requestedPositions.map((row) => row.estimate_position_id).filter((positionId) => !covered.has(positionId));
    const generalCovered = generalReview?.general_response !== 'amendment_requested' || Boolean(await db.get(`SELECT id FROM revision_change_checks WHERE supplier_revision_request_id=? AND change_kind='requested' AND estimate_position_id IS NULL`, requestId));
    const outstandingSuppliers=await outstandingSupplierRevisionRequests(db,requestId);
    const pendingSupplierReviews=(await outstandingSupplierResponseReviews(db,requestId)).filter(item=>item.response_state==='revised_document_received');
    const staleChecks=await staleSupplierReviewCount(db,{...request,verified_at:at});
    const unresolved = Number((await db.get(`SELECT COUNT(*) count FROM revision_change_checks WHERE supplier_revision_request_id=? AND status IN ('not_implemented','needs_review','change_detected')`, requestId))?.count || 0) + missingRequestedPositions.length + (generalCovered ? 0 : 1) + outstandingSuppliers.length;
    await db.run("UPDATE supplier_revision_requests SET verified_at=?,status=?,updated_at=? WHERE id=?", unresolved||staleChecks||pendingSupplierReviews.length ? null : at, 'approved', at, requestId);
    await event('supplier.revision.verified', `${requestId}:${hash(checks)}`, [{ kind: 'supplier_revision_request', id: requestId }, { kind: 'estimate', id: request.successor_estimate_id }]);
    return { requestId, checks: await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY change_kind,estimate_position_id,field_key', requestId), missingRequestedPositions, generalRequestCovered: generalCovered, outstandingSuppliers, pendingSupplierReviews:pendingSupplierReviews.map(item=>({id:item.id,supplier_name:item.supplier_name})), staleChecks, unresolved:unresolved+staleChecks+pendingSupplierReviews.length, issueAllowed: unresolved === 0&&staleChecks===0&&pendingSupplierReviews.length===0 };
  }

  async function approveOrder(orderId, input = {}) {
    const actor = text(input.approvedBy);
    if (!actor) throw problem('Staff approval identity is required.');
    const order = await db.get('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw problem('Order was not found.', 404, 'order_not_found');
    const existing = await db.get('SELECT * FROM order_staff_approvals WHERE order_id=?', orderId);
    if (existing) {
      const document = await customerDocuments.createOrderDocument(orderId, { revision: 'staff-approved' });
      await portal.releaseCustomerLifecycleDocument({ documentId: document.id, clientId: document.clientId, projectId: document.projectId, releasedBy: actor });
      return { ...existing, document: { id: document.id, fileName: document.fileName }, idempotentReplay: true };
    }
    if (order.status !== 'customer_accepted_pending_staff_approval') throw problem('Order is not awaiting staff approval.', 409, 'order_not_awaiting_approval');
    const id = randomUUID(), at = stamp();
    await db.exec('BEGIN IMMEDIATE');
    try {
      await db.run('INSERT INTO order_staff_approvals(id,order_id,approved_by,approved_at,note) VALUES(?,?,?,?,?)', id, orderId, actor, at, text(input.note));
      await db.run("UPDATE orders SET status='staff_approved',updated_at=? WHERE id=?", at, orderId);
      await event('order.staff_approved', id, [{ kind: 'order', id: orderId }, { kind: 'project', id: order.project_id }]);
      await db.exec('COMMIT');
      const document = await customerDocuments.createOrderDocument(orderId, { revision: 'staff-approved' });
      await portal.releaseCustomerLifecycleDocument({ documentId: document.id, clientId: document.clientId, projectId: document.projectId, releasedBy: actor });
      return { id, orderId, approvedBy: actor, approvedAt: at, status: 'staff_approved', document: { id: document.id, fileName: document.fileName }, idempotentReplay: false };
    } catch (error) { await db.exec('ROLLBACK').catch(() => {}); throw error; }
  }

  async function orderJourney(orderId) {
    const order = await db.get(`SELECT o.*,a.id acceptance_id,a.accepted_at,r.id estimate_release_id,r.customer_projection_json,r.document_id estimate_document_id,
      sa.id staff_approval_id,sa.approved_by,sa.approved_at,sa.note approval_note,fr.id factory_order_request_id,fr.status factory_order_status,fr.recipient factory_recipient,fr.subject factory_subject,fr.body_text factory_body_text
      FROM orders o JOIN portal_estimate_acceptances a ON a.order_id=o.id JOIN estimate_revision_releases r ON r.id=a.estimate_release_id
      LEFT JOIN order_staff_approvals sa ON sa.order_id=o.id LEFT JOIN factory_order_requests fr ON fr.order_id=o.id WHERE o.id=?`, orderId);
    if (!order) throw problem('Order was not found.', 404, 'order_not_found');
    const acceptedPositions = await db.all('SELECT estimate_position_id,position_reference,confirmations_json,created_at FROM portal_position_acceptances WHERE estimate_acceptance_id=? ORDER BY position_reference', order.acceptance_id);
    const documents = await db.all('SELECT id,file_name,document_type,provider_revision revision,provider_modified_at modified_at FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 ORDER BY provider_modified_at DESC', order.project_id);
    const request = await db.get('SELECT * FROM factory_order_requests WHERE order_id=?', orderId);
    let factoryDraft = null;
    if (request) {
      const message = await communications.get(request.communication_message_id);
      const additionalFiles=await savedFactoryAttachments(db,request.communication_message_id);
      const attachments = [];
      for (const id of parse(request.document_ids_json, [])) {
        const document = await customerDocuments.get(id);
        if (document?.orderId === orderId && message?.attachments?.some(item => item.storageKey === document.storageKey && item.sha256 === document.sha256)) attachments.push({ id: document.id, fileName: document.fileName, sha256: document.sha256, downloadUrl: `/api/lifecycle/documents/${encodeURIComponent(document.id)}`, priceFree: document.context?.audience === 'factory-price-free-v1' });
      }
      factoryDraft = { delivery:await factoryDeliveryState(db,orderId),deliveryMode:delivery.publicStatus().deliveryMode,additionalFiles,availableFiles:await factoryAttachmentOptions(db,order),id: request.id, communicationMessageId: request.communication_message_id, status: request.status, recipient: request.recipient, subject: request.subject, bodyText: request.body_text, updatedAt: request.updated_at, attachments, needsPreparation: !message || message.attachments.length !== 1+additionalFiles.length || attachments.length !== 1 || !attachments[0].priceFree, sentAt: message?.sentAt || null };
    }
    const confirmations = await db.all(`SELECT fc.*,r.id release_id,r.released_at,s.id signoff_id,s.approved_at signoff_approved_at,s.signed_pdf_document_id
      FROM factory_confirmations fc LEFT JOIN factory_confirmation_releases r ON r.factory_confirmation_id=fc.id
      LEFT JOIN factory_confirmation_signoffs s ON s.factory_confirmation_release_id=r.id WHERE fc.order_id=? ORDER BY fc.created_at DESC`, orderId);
    const confirmationDetails = [];
    for (const confirmation of confirmations) {
      const signedPdfReview = confirmation.release_id ? await db.get('SELECT * FROM factory_confirmation_signed_pdf_reviews WHERE factory_confirmation_release_id=? ORDER BY reviewed_at DESC LIMIT 1', confirmation.release_id) : null;
      confirmationDetails.push({ id: confirmation.id, documentId: confirmation.canonical_document_id, revision: confirmation.revision, status: confirmation.status, createdAt: confirmation.created_at, releaseId: confirmation.release_id, releasedAt: confirmation.released_at, signoffId: confirmation.signoff_id, signedPdfDocumentId: signedPdfReview?.signed_pdf_document_id || confirmation.signed_pdf_document_id, signedOffAt: confirmation.signoff_approved_at, signedPdfReviewedAt: signedPdfReview?.reviewed_at || null, checks: await db.all('SELECT * FROM factory_confirmation_checks WHERE factory_confirmation_id=? ORDER BY estimate_position_id,field_key', confirmation.id) });
    }
    return { factoryDraft, id: order.id, orderRef: order.order_ref, clientId: order.client_id, projectId: order.project_id, status: order.status, sourceEstimateId: order.source_estimate_id, sourceEstimateRevision: Number(order.source_estimate_revision), estimateReleaseId: order.estimate_release_id, estimateDocumentId: order.estimate_document_id, customerProjection: parse(order.customer_projection_json, {}), acceptance: { id: order.acceptance_id, acceptedAt: order.accepted_at, positions: acceptedPositions.map((position) => ({ estimatePositionId: position.estimate_position_id, reference: position.position_reference, confirmations: parse(position.confirmations_json, {}) })) }, staffApproval: order.staff_approval_id ? { id: order.staff_approval_id, approvedBy: order.approved_by, approvedAt: order.approved_at, note: order.approval_note } : null, factoryOrder: order.factory_order_request_id ? { id: order.factory_order_request_id, status: order.factory_order_status, recipient: order.factory_recipient, subject: order.factory_subject, bodyText: order.factory_body_text } : null, documents, confirmations: confirmationDetails };
  }

  async function prepareFactoryOrder(orderId, input = {}) {
    const order = await db.get('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw problem('Order was not found.', 404, 'order_not_found');
    if (!await db.get('SELECT id FROM order_staff_approvals WHERE order_id=?', orderId)) throw problem('Staff approval is required before preparing the factory order.', 409, 'factory_order_staff_approval_required');
    const existing = await db.get('SELECT * FROM factory_order_requests WHERE order_id=?', orderId);
    if(input.reconcile===true){
      const attempt=await factoryDeliveryState(db,orderId);
      if(!existing||!attempt||attempt.communication_message_id!==existing.communication_message_id)throw problem('No matching factory delivery attempt is available to check.',409,'factory_delivery_unconfirmed');
      const proof=attempt.state==='sent'&&attempt.provider_message_id?{providerMessageId:attempt.provider_message_id,sentAt:attempt.sent_at}:await communicationService.reconcileFactoryDelivery(attempt);
      if(!proof)return {status:'unconfirmed',message:'No exact sent-message confirmation was found. This does not prove that delivery failed. No email was sent by this check; keep the request blocked and check again later.'};
      const at=stamp();
      await db.run("UPDATE factory_delivery_attempts SET state='sent',provider_message_id=?,sent_at=?,reconciled_by=?,reconciled_at=?,updated_at=? WHERE id=?",proof.providerMessageId,proof.sentAt||attempt.sent_at,text(input.createdBy),at,at,attempt.id);
      await db.run("UPDATE factory_order_requests SET status='sent',updated_at=? WHERE id=? AND communication_message_id=?",at,existing.id,attempt.communication_message_id);
      const prior=await communications.get(attempt.communication_message_id);
      if(prior)await communications.save({...prior,provider:'google_workspace',providerMessageId:proof.providerMessageId,threadId:proof.threadId||prior.threadId,status:'sent',folder:'sent',sentAt:proof.sentAt||attempt.sent_at,error:null});
      await event('factory.order.delivery_reconciled',attempt.id,[{kind:'order',id:orderId},{kind:'communication',id:attempt.communication_message_id}]);
      return {status:'sent',message:'The exact sent message and reviewed contents are confirmed. No additional email was sent.'};
    }
    const activeDelivery=await db.get("SELECT * FROM factory_delivery_attempts WHERE order_id=? AND state IN ('sending','sent','uncertain')",orderId);
    if(activeDelivery&&input.send!==true)throw problem('A factory delivery attempt is recorded. Review its outcome before editing or replacing this request.',409,'factory_delivery_unconfirmed');
    if (existing) {
      if (input.editDraft === true) {
        if (existing.status !== 'draft') throw problem('Only an unsent factory draft can be edited. Sent correspondence is retained unchanged.', 409, 'factory_draft_not_editable');
        if (text(input.expectedCommunicationId) !== existing.communication_message_id) throw problem('This factory draft changed in another window. Reopen it before saving; your entered text has not been discarded.', 409, 'factory_draft_changed');
        const recipient = text(input.recipient), subject = text(input.subject), bodyText = text(input.bodyText);
        if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(recipient) || !subject || /[\r\n]/.test(subject) || !bodyText) throw problem('Enter one valid recipient, a subject and a message before saving.');
        const previousFiles=await savedFactoryAttachments(db,existing.communication_message_id),selectedFiles=await reviewFactoryAttachments(db,order,input,previousFiles);
        if (recipient === existing.recipient && subject === existing.subject && bodyText === existing.body_text && JSON.stringify(selectedFiles)===JSON.stringify(previousFiles)) return { id: existing.id, status: 'draft', unchanged: true };
        const prior = await communications.get(existing.communication_message_id);
        if (!prior) throw problem('The saved message is unavailable. Prepare the factory preview again before editing.',409,'factory_order_communication_missing');
        const message = await communications.save({ ...prior, id: randomUUID(), createdAt: stamp(), provider: 'quotesuite_preview', providerMessageId: null, threadId: null, sentAt: null, error: null, attachments: [...(prior.attachments || []).filter(item=>item.storageKey),...factoryCommunicationAttachments(selectedFiles)].map(item => ({ ...item, id: randomUUID() })), folder: 'drafts', status: 'draft', to: [recipient], cc: [], bcc: [], subject, bodyText, snippet: bodyText, bodyHtml: `<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>')}</p>` });
        await db.run('INSERT INTO factory_attachment_reviews(communication_message_id,order_id,files_json,reviewed_by,reviewed_at) VALUES(?,?,?,?,?)',message.id,orderId,JSON.stringify(selectedFiles),text(input.createdBy)||existing.created_by,stamp());
        const changed = await db.run("UPDATE factory_order_requests SET recipient=?,subject=?,body_text=?,communication_message_id=?,updated_at=? WHERE id=? AND communication_message_id=? AND status='draft' AND NOT EXISTS(SELECT 1 FROM factory_delivery_attempts WHERE order_id=? AND state IN ('sending','sent','uncertain'))",recipient,subject,bodyText,message.id,stamp(),existing.id,existing.communication_message_id,orderId);
        if (!changed.changes) throw problem('The factory draft changed while saving. Reopen it to review the current version; no message was sent.',409,'factory_draft_changed');
        await event('factory.order.draft_reviewed',message.id,[{kind:'order',id:orderId},{kind:'communication',id:message.id}]);
        return { id: existing.id, status: 'draft', communicationMessageId: message.id };
      }
      const retained = await Promise.all(parse(existing.document_ids_json, []).map(id => customerDocuments.get(id)));
      const factoryDocument = retained.find(document => document?.orderId === orderId && document.context?.audience === 'factory-price-free-v1');
      const priorDraft = await communications.get(existing.communication_message_id);
      const additionalFiles=await savedFactoryAttachments(db,existing.communication_message_id);
      const safeDraft = factoryDocument && priorDraft?.attachments?.length === 1+additionalFiles.length && priorDraft.attachments.some(item=>item.sha256===factoryDocument.sha256&&item.storageKey===factoryDocument.storageKey) && additionalFiles.every(file=>priorDraft.attachments.some(item=>item.driveFileId===file.providerFileId&&item.sha256===file.checksum));
      if (existing.status !== 'sent' && !safeDraft) {
        if (input.send === true) throw problem('This older factory draft contains a customer document. Prepare the factory preview again to replace its attachment with a price-free schedule, review it, then send.', 409, 'factory_draft_requires_safe_schedule');
        const document = await customerDocuments.createFactoryOrderDocument(orderId);
        const message = await deliverOrSave({ id: randomUUID(), provider: 'quotesuite_preview', direction: 'outbound', folder: 'drafts', status: 'draft', from: [], to: [existing.recipient], cc: [], bcc: [], subject: existing.subject, bodyText: existing.body_text, bodyHtml: `<p>${existing.body_text.replaceAll('&','&amp;').replaceAll('<','&lt;')}</p>`, links: [{kind:'order',id:orderId},{kind:'project',id:order.project_id}], attachments: [{id:randomUUID(),fileName:document.fileName,mediaType:document.mediaType,sizeBytes:document.sizeBytes,storageKey:document.storageKey,sha256:document.sha256}] }, false);
        const replaced=await db.run("UPDATE factory_order_requests SET status='draft',document_ids_json=?,communication_message_id=?,updated_at=? WHERE id=? AND communication_message_id=? AND status='draft' AND NOT EXISTS(SELECT 1 FROM factory_delivery_attempts WHERE order_id=? AND state IN ('sending','sent','uncertain'))", JSON.stringify([document.id]), message.id, stamp(), existing.id,existing.communication_message_id,orderId);
        if(!replaced.changes)throw problem('This factory request changed or delivery started while preparing. Reopen it to review the recorded result.',409,'factory_draft_changed');
        await event('factory.order.preview_replaced', existing.id, [{kind:'order',id:orderId},{kind:'communication',id:message.id}]);
        return { ...existing, status: 'draft', communicationMessageId: message.id, documentIds: [document.id], delivery: delivery.publicStatus() };
      }
      if (input.send === true && existing.status !== 'sent') {
        if(input.reviewed!==true||text(input.expectedCommunicationId)!==existing.communication_message_id)throw problem('Reopen and review the saved recipient, message and attachments before sending this factory request.',409,'factory_delivery_review_required');
        const prior = await communications.get(existing.communication_message_id);
        if (!prior) throw problem('Prepared factory Order correspondence was not found.', 409, 'factory_order_communication_missing');
        delivery.assertRecipient(existing.recipient, 'factory');
        await assertFactoryAttachmentsCurrent(db,order,additionalFiles);
        const receipt=await sendFactoryOnce(db,{orderId,communicationId:existing.communication_message_id,send:({attemptId})=>communicationService.sendMessage({ ...prior, provider:'google_workspace',folder:'sent',status:'sending' },{factoryDeliveryAttemptId:attemptId}),now:stamp});
        const at=receipt.sent_at||stamp();
        await db.run("UPDATE factory_order_requests SET status='sent',updated_at=? WHERE id=?",at,existing.id);
        await event('factory.order.sent',existing.id,[{kind:'order',id:orderId},{kind:'communication',id:existing.communication_message_id}]);
        return { ...existing, status:'sent', delivery:delivery.publicStatus(), documentIds:parse(existing.document_ids_json,[]) };
      }
      return { ...existing, delivery: delivery.publicStatus(), documentIds: parse(existing.document_ids_json, []) };
    }
    const recipient = text(input.recipient), actor = text(input.createdBy), subject = text(input.subject) || `Factory Order ${order.order_ref}`;
    if(input.send===true)throw problem('Prepare the factory request first, then review its saved schedule and attachments before sending.',409,'factory_delivery_review_required');
    if (!recipient || !actor) throw problem('Factory recipient and staff identity are required.');
    if (input.send === true) delivery.assertRecipient(recipient, 'factory');
    const orderDocument = await customerDocuments.createFactoryOrderDocument(orderId);
    const documentIds = [orderDocument.id];
    const id = randomUUID(), communicationId = randomUUID(), at = stamp(), bodyText = text(input.bodyText) || `Please review the attached approved Order ${order.order_ref}.`;
    const communication=await deliverOrSave({ id: communicationId, provider:input.send===true?'google_workspace':'quotesuite_preview', direction:'outbound', folder:input.send===true?'sent':'drafts', status:input.send===true?'sending':'draft', from:[], to:[recipient], cc:[], bcc:[], subject, bodyText, bodyHtml:`<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;')}</p>`, links:[{kind:'order',id:orderId},{kind:'project',id:order.project_id}], attachments:[{id:randomUUID(),fileName:orderDocument.fileName,mediaType:orderDocument.mediaType,sizeBytes:orderDocument.sizeBytes,storageKey:orderDocument.storageKey,sha256:orderDocument.sha256}] },input.send);
    const status=input.send===true?'sent':'draft';
    await db.run(`INSERT INTO factory_order_requests(id,order_id,status,recipient,subject,body_text,document_ids_json,communication_message_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, id, orderId, status, recipient, subject, bodyText, JSON.stringify(documentIds), communication.id, actor, at, at);
    await event(input.send===true?'factory.order.sent':'factory.order.prepared', id, [{ kind: 'order', id: orderId }, { kind: 'communication', id: communication.id }]);
    return { id, orderId, status, recipient, subject, bodyText, communicationMessageId: communication.id, documentIds, orderDocument: { id: orderDocument.id, fileName: orderDocument.fileName }, delivery: delivery.publicStatus() };
  }

  async function recordFactoryConfirmation(orderId, input = {}) {
    const order = await db.get('SELECT * FROM orders WHERE id=?', orderId);
    if (!order || !await db.get('SELECT id FROM order_staff_approvals WHERE order_id=?', orderId)) throw problem('An approved Order is required.', 409, 'approved_order_required');
    const documentId = text(input.canonicalDocumentId), revision = text(input.revision) || 'current';
    const document = await db.get('SELECT * FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0', documentId, order.project_id);
    if (!document) throw problem('The returned confirmation must be a canonical document for this Project.', 422, 'factory_confirmation_document_invalid');
    let confirmation = await db.get('SELECT * FROM factory_confirmations WHERE order_id=? AND canonical_document_id=? AND revision=?', orderId, documentId, revision);
    if (!confirmation) {
      const id = randomUUID(), at = stamp();
      const priorReleased = await db.all("SELECT fc.id,fc.canonical_document_id,r.id release_id FROM factory_confirmations fc JOIN factory_confirmation_releases r ON r.factory_confirmation_id=fc.id WHERE fc.order_id=? AND fc.status='released'", orderId);
      for (const prior of priorReleased) {
        await db.run("UPDATE factory_confirmations SET status='superseded' WHERE id=?", prior.id);
        await db.run("UPDATE portal_resource_releases SET status='revoked',revoked_by=?,revoked_at=? WHERE project_id=? AND resource_type='document' AND resource_id=? AND status='released'", text(input.createdBy), at, order.project_id, prior.canonical_document_id);
        const managed = await db.all("SELECT id FROM customer_lifecycle_documents WHERE document_kind='final_confirmation' AND owner_id=?", prior.id);
        for (const item of managed) await db.run("UPDATE portal_resource_releases SET status='revoked',revoked_by=?,revoked_at=? WHERE project_id=? AND resource_type='document' AND resource_id=? AND status='released'", text(input.createdBy), at, order.project_id, item.id);
      }
      await db.run(`INSERT INTO factory_confirmations(id,order_id,canonical_document_id,revision,status,source_sha256,created_by,created_at) VALUES(?,?,?,?,'staff_review',?,?,?)`, id, orderId, documentId, revision, document.checksum || null, text(input.createdBy), at);
      await db.run("UPDATE orders SET status='factory_confirmation_received_staff_review',updated_at=? WHERE id=?", at, orderId);
      confirmation = await db.get('SELECT * FROM factory_confirmations WHERE id=?', id);
    }
    const checks = Array.isArray(input.checks) ? input.checks : [];
    for (const check of checks) {
      const detectedStatus = deriveConfirmationCheck(check);
      const status = detectedStatus === 'change_detected' && check.approvedDifference === true && text(check.resolutionNote) ? 'approved_difference' : detectedStatus;
      await db.run(`INSERT INTO factory_confirmation_checks(id,factory_confirmation_id,estimate_position_id,field_key,approved_value,confirmed_value,status,approved_source_reference,confirmation_source_reference,resolution_note,resolved_by,resolved_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(factory_confirmation_id,estimate_position_id,field_key) DO UPDATE SET confirmed_value=excluded.confirmed_value,status=excluded.status,confirmation_source_reference=excluded.confirmation_source_reference,resolution_note=excluded.resolution_note,resolved_by=excluded.resolved_by,resolved_at=excluded.resolved_at`, randomUUID(), confirmation.id, text(check.estimatePositionId), text(check.fieldKey), text(check.approvedValue) || null, text(check.confirmedValue) || null, status, text(check.approvedSourceReference) || null, text(check.confirmationSourceReference) || null, text(check.resolutionNote), text(input.reviewedBy) || null, input.reviewedBy ? stamp() : null);
    }
    const values = await db.all('SELECT * FROM factory_confirmation_checks WHERE factory_confirmation_id=? ORDER BY estimate_position_id,field_key', confirmation.id);
    const acceptedPositions = await db.all(`SELECT pa.estimate_position_id FROM portal_position_acceptances pa JOIN portal_estimate_acceptances a ON a.id=pa.estimate_acceptance_id WHERE a.order_id=? AND pa.accepted=1 ORDER BY pa.estimate_position_id`, orderId);
    const checkedPositionIds = new Set(values.map((check) => check.estimate_position_id));
    const missingPositionIds = acceptedPositions.map((row) => row.estimate_position_id).filter((id) => !checkedPositionIds.has(id));
    const unresolved = values.filter((check) => ['change_detected','needs_review'].includes(check.status)).length + missingPositionIds.length;
    await db.run("UPDATE factory_confirmations SET status=? WHERE id=? AND status<>'released'", unresolved ? 'staff_review' : 'review_resolved', confirmation.id);
    return { confirmationId: confirmation.id, status: unresolved ? 'staff_review' : 'review_resolved', checks: values, missingPositionIds, unresolved, releaseAllowed: unresolved === 0 };
  }

  async function releaseFactoryConfirmation(confirmationId, input = {}) {
    const confirmation = await db.get(`SELECT fc.*,o.client_id,o.project_id,o.id order_id FROM factory_confirmations fc JOIN orders o ON o.id=fc.order_id WHERE fc.id=?`, confirmationId);
    if (!confirmation) throw problem('Factory confirmation was not found.', 404, 'factory_confirmation_not_found');
    const accepted = await db.all(`SELECT pa.estimate_position_id FROM portal_position_acceptances pa JOIN portal_estimate_acceptances a ON a.id=pa.estimate_acceptance_id WHERE a.order_id=? AND pa.accepted=1`, confirmation.order_id);
    const checked = new Set((await db.all('SELECT DISTINCT estimate_position_id FROM factory_confirmation_checks WHERE factory_confirmation_id=?', confirmationId)).map((row) => row.estimate_position_id));
    const missingPositionCount = accepted.filter((row) => !checked.has(row.estimate_position_id)).length;
    const unresolved = Number((await db.get(`SELECT COUNT(*) count FROM factory_confirmation_checks WHERE factory_confirmation_id=? AND status IN ('change_detected','needs_review')`, confirmationId))?.count || 0) + missingPositionCount;
    if (unresolved) throw problem('Resolve every detected or uncertain factory confirmation change before customer release.', 409, 'factory_confirmation_review_required');
    const existing = await db.get('SELECT * FROM factory_confirmation_releases WHERE factory_confirmation_id=?', confirmationId);
    if (existing) {
      const finalDocument = await customerDocuments.createFinalConfirmationDocument(confirmationId);
      await portal.releaseCustomerLifecycleDocument({ documentId: finalDocument.id, clientId: finalDocument.clientId, projectId: finalDocument.projectId, releasedBy: text(input.releasedBy) || existing.released_by });
      return { ...existing, document: { id: finalDocument.id, fileName: finalDocument.fileName }, idempotentReplay: true };
    }
    const actor = text(input.releasedBy), at = stamp(), id = randomUUID();
    if (!actor) throw problem('Staff release identity is required.');
    const finalDocument = await customerDocuments.createFinalConfirmationDocument(confirmationId);
    await db.exec('BEGIN IMMEDIATE');
    try {
      await portal.releaseDocument({ clientId: confirmation.client_id, projectId: confirmation.project_id, documentId: confirmation.canonical_document_id, revision: confirmation.revision, releasedBy: actor });
      await portal.releaseCustomerLifecycleDocument({ documentId: finalDocument.id, clientId: finalDocument.clientId, projectId: finalDocument.projectId, releasedBy: actor });
      await db.run('INSERT INTO factory_confirmation_releases(id,factory_confirmation_id,project_id,released_by,released_at) VALUES(?,?,?,?,?)', id, confirmationId, confirmation.project_id, actor, at);
      await db.run("UPDATE factory_confirmations SET status='released' WHERE id=?", confirmationId);
      await db.run("UPDATE orders SET status='awaiting_customer_final_confirmation',updated_at=? WHERE id=?", at, confirmation.order_id);
      await event('factory.confirmation.released', id, [{ kind:'order',id:confirmation.order_id },{ kind:'factory_confirmation',id:confirmationId },{ kind:'document',id:confirmation.canonical_document_id }]);
      await db.exec('COMMIT');
      return { id, factoryConfirmationId: confirmationId, projectId: confirmation.project_id, releasedAt: at, status: 'awaiting_customer_final_confirmation', document: { id: finalDocument.id, fileName: finalDocument.fileName }, idempotentReplay: false };
    } catch (error) { await db.exec('ROLLBACK').catch(() => {}); throw error; }
  }

  async function recordReviewedSignedApproval(confirmationReleaseId, input = {}) {
    if (input.reviewed !== true) throw problem('Uploading a signed PDF is not approval; staff must explicitly verify it.', 422, 'signed_pdf_review_required');
    const release = await db.get(`SELECT r.*,fc.order_id,o.project_id FROM factory_confirmation_releases r JOIN factory_confirmations fc ON fc.id=r.factory_confirmation_id AND fc.status='released' JOIN orders o ON o.id=fc.order_id WHERE r.id=?`, confirmationReleaseId);
    if (!release) throw problem('Released factory confirmation was not found.', 404, 'confirmation_release_not_found');
    const document = await db.get('SELECT id FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0', text(input.signedPdfDocumentId), release.project_id);
    if (!document) throw problem('The signed approval PDF must be a canonical Project document.', 422, 'signed_pdf_document_invalid');
    const requiredPositions = await db.all(`SELECT pa.estimate_position_id FROM portal_position_acceptances pa JOIN portal_estimate_acceptances a ON a.id=pa.estimate_acceptance_id WHERE a.order_id=? AND pa.accepted=1`, release.order_id);
    const approved = new Set((input.positionIds || []).map(String));
    if (!requiredPositions.length || requiredPositions.some((row) => !approved.has(row.estimate_position_id)) || input.overallApproved !== true) throw problem('Staff must verify overall and Position approval in the signed PDF.', 422, 'signed_pdf_acceptance_incomplete');
    const id=randomUUID(),at=stamp(),actor=text(input.reviewedBy);
    if (!actor) throw problem('Staff review identity is required.', 422, 'signed_pdf_reviewer_required');
    const existingReview = await db.get('SELECT * FROM factory_confirmation_signed_pdf_reviews WHERE factory_confirmation_release_id=? AND signed_pdf_document_id=?', confirmationReleaseId, document.id);
    if (existingReview) return { ...existingReview, orderId: release.order_id, status: 'customer_final_confirmation_approved', idempotentReplay: true };
    await db.exec('BEGIN IMMEDIATE');
    try {
      await db.run(`INSERT INTO factory_confirmation_signed_pdf_reviews(id,factory_confirmation_release_id,signed_pdf_document_id,reviewed_by,reviewed_at,overall_approved,position_ids_json) VALUES(?,?,?,?,?,1,?)`,id,confirmationReleaseId,document.id,actor,at,JSON.stringify([...approved]));
      const existing = await db.get('SELECT * FROM factory_confirmation_signoffs WHERE factory_confirmation_release_id=?', confirmationReleaseId);
      if (!existing) {
        await db.run(`INSERT INTO factory_confirmation_signoffs(id,factory_confirmation_release_id,portal_contact_id,overall_approved,signed_pdf_document_id,signed_pdf_reviewed_by,signed_pdf_reviewed_at,approved_at) VALUES(?,?,NULL,1,?,?,?,?)`,id,confirmationReleaseId,document.id,actor,at,at);
        for(const row of requiredPositions) await db.run('INSERT INTO factory_confirmation_position_approvals(id,signoff_id,estimate_position_id,approved,created_at) VALUES(?,?,?,1,?)',randomUUID(),id,row.estimate_position_id,at);
      }
      await db.run("UPDATE orders SET status='customer_final_confirmation_approved',updated_at=? WHERE id=?",at,release.order_id);
      await event('factory.confirmation.signed_pdf_approved',id,[{kind:'order',id:release.order_id},{kind:'document',id:document.id}]);
      await db.exec('COMMIT');return{id,orderId:release.order_id,status:'customer_final_confirmation_approved',approvedAt:at,idempotentReplay:false};
    } catch(error){await db.exec('ROLLBACK').catch(()=>{});throw error;}
  }

  async function updateSupplierResponseDue(supplierEnquiryId,input={}){
    const dueAt=text(input.responseDueAt),parsedDue=new Date(dueAt);if(!dueAt||Number.isNaN(parsedDue.getTime()))throw problem('Choose a valid revised supplier response date.',422,'supplier_response_due_invalid');
    const row=await db.get("SELECT * FROM supplier_enquiry_drafts WHERE id=? AND request_kind='revision' AND status='sent'",supplierEnquiryId);if(!row)throw problem('The sent supplier revision request was not found.',404,'supplier_revision_dispatch_not_found');
    if(row.response_state==='revised_document_received'||row.completed_at)throw problem('This supplier revision has already been received or completed.',409,'supplier_revision_already_received');
    const at=stamp();await db.run("UPDATE supplier_enquiry_drafts SET response_due_at=?,followup_due_at=?,updated_at=? WHERE id=?",parsedDue.toISOString(),parsedDue.toISOString(),at,row.id);
    if(row.revision_request_id)await db.run("UPDATE supplier_revision_requests SET response_due_at=?,workflow_state='sent_to_supplier',updated_at=? WHERE id=?",parsedDue.toISOString(),at,row.revision_request_id);
    return supplierEnquiryView(await db.get("SELECT se.*,s.supplier_name FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id WHERE se.id=?",row.id));
  }

  async function retrySupplierRevisionFollowup(supplierEnquiryId){
    const row=await db.get("SELECT * FROM supplier_enquiry_drafts WHERE id=? AND request_kind='revision' AND status='sent'",supplierEnquiryId);
    if(!row)throw problem('The sent supplier revision request was not found.',404,'supplier_revision_dispatch_not_found');
    if(row.response_state!=='outstanding'||row.completed_at)throw problem('A supplier response has already been recorded, so no follow-up is required.',409,'supplier_revision_response_recorded');
    if(row.followup_sent_at)throw problem('The supplier follow-up was already sent.',409,'supplier_revision_followup_already_sent');
    if(!row.followup_failure)throw problem('There is no failed follow-up to retry.',409,'supplier_revision_followup_not_failed');
    if(row.followup_delivery_state!=='not_sent')throw problem('The follow-up delivery outcome is uncertain. Do not send another copy. Check the connected mailbox and retain this request for delivery review.',409,'supplier_followup_delivery_unconfirmed');
    const at=stamp();
    const retry=await db.run("UPDATE supplier_enquiry_drafts SET followup_due_at=?,followup_attempted_at=NULL,followup_failure='',followup_delivery_state='',updated_at=? WHERE id=? AND followup_delivery_state='not_sent' AND followup_sent_at IS NULL AND response_state='outstanding' AND completed_at IS NULL",at,at,row.id);
    if(!retry.changes)throw problem('The follow-up changed while retrying. Reopen the request to see its current outcome.',409,'supplier_followup_changed');
    await event('supplier.revision.followup_retry_queued',row.id,[{kind:'supplier_enquiry',id:row.id}]);
    return supplierEnquiryView(await db.get("SELECT se.*,s.supplier_name FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id WHERE se.id=?",row.id));
  }

  async function processDueSupplierRevisionFollowups(){
    if(delivery.publicStatus().deliveryMode!=='test_allowlist')return{processed:0,sent:0,failed:0,skipped:'Automatic supplier follow-up delivery is not enabled.'};
    const at=stamp(),rows=await db.all(`SELECT * FROM supplier_enquiry_drafts WHERE request_kind='revision' AND status='sent' AND response_state='outstanding' AND followup_due_at IS NOT NULL AND followup_due_at<=? AND followup_attempted_at IS NULL AND followup_sent_at IS NULL ORDER BY followup_due_at LIMIT 25`,at);let sentCount=0,failed=0;
    for(const candidate of rows){
      const claimed=await db.run(`UPDATE supplier_enquiry_drafts SET followup_attempted_at=?,followup_delivery_state='sending',updated_at=? WHERE id=? AND status='sent' AND response_state='outstanding' AND followup_attempted_at IS NULL AND followup_sent_at IS NULL AND completed_at IS NULL AND followup_due_at<=?`,at,at,candidate.id,at);if(Number(claimed.changes||0)!==1)continue;
      let providerStarted=false,confirmed;
      try{
        const current=await db.get("SELECT * FROM supplier_enquiry_drafts WHERE id=?",candidate.id);if(!current||current.response_state!=='outstanding'||current.status!=='sent'){
          if(current)await db.run("UPDATE supplier_enquiry_drafts SET followup_due_at=NULL,followup_delivery_state='cancelled',updated_at=? WHERE id=?",stamp(),current.id);
          continue;
        }
        delivery.assertRecipient(current.recipient,'factory');const original=await communications.get(current.communication_message_id);if(!original)throw problem('The original sent supplier request could not be reopened.',409,'supplier_followup_original_missing');
        const eligible=await db.get(`SELECT se.id FROM supplier_enquiry_drafts se
          JOIN supplier_revision_requests sr ON sr.id=se.revision_request_id
          WHERE se.id=? AND se.status='sent' AND se.response_state='outstanding'
          AND se.completed_at IS NULL AND se.followup_sent_at IS NULL AND se.followup_due_at<=?
          AND sr.status<>'cancelled' AND sr.completed_at IS NULL
          AND sr.workflow_state NOT IN ('cancelled','superseded','revised_customer_estimate_issued')
          AND NOT EXISTS(SELECT 1 FROM supplier_enquiry_drafts successor WHERE successor.supersedes_id=se.id AND successor.status<>'cancelled')`,current.id,stamp());
        if(!eligible){await db.run("UPDATE supplier_enquiry_drafts SET followup_due_at=CASE WHEN followup_due_at>? THEN followup_due_at ELSE NULL END,followup_attempted_at=NULL,followup_delivery_state='',updated_at=? WHERE id=?",stamp(),stamp(),current.id);continue;}
        const followupId=`supplier-followup-${current.id}`,bodyText=`Please could you provide an update on the requested revised estimate for ${current.subject}?`;
        providerStarted=true;
        const sent=await communicationService.sendMessage({id:followupId,provider:'google_workspace',direction:'outbound',folder:'sent',status:'sending',from:[],to:[current.recipient],cc:[],bcc:[],subject:`Follow-up: ${current.subject}`,bodyText,bodyHtml:`<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</p>`,threadId:original.threadId||null,inReplyToProviderMessageId:original.providerMessageId||null,links:[{kind:'project',id:current.project_id},{kind:'estimate',id:current.estimate_id},{kind:'supplier_enquiry',id:current.id},...(current.revision_request_id?[{kind:'supplier_revision_request',id:current.revision_request_id}]:[])]},{supplierFollowupRequestId:current.id,supplierFollowupAttemptedAt:current.followup_attempted_at});
        if(!sent?.providerMessageId)throw new Error('The provider did not confirm the follow-up message identity.');
        confirmed=sent;
        const sentAt=sent.sentAt||stamp();await db.run("UPDATE supplier_enquiry_drafts SET followup_sent_at=?,followup_message_id=?,followup_delivery_state='sent',followup_failure='',updated_at=? WHERE id=?",sentAt,sent.id,sentAt,current.id);await event('supplier.revision.followup_sent',current.id,[{kind:'supplier_enquiry',id:current.id},{kind:'communication',id:sent.id}]);sentCount+=1;
      }catch(error){
        const providerConfirmed=confirmed?.providerMessageId||(error.deliveryOutcome==='sent'&&error.providerMessageId),state=providerConfirmed?'sent':!providerStarted||error.deliveryOutcome==='not_sent'?'not_sent':'uncertain';
        const message=state==='sent'?'The provider confirmed the follow-up, but local completion needs review. Do not resend.':state==='not_sent'?`Nothing was sent. ${error.message||'Correct the reported issue and retry.'}`:'Follow-up delivery could not be confirmed. Do not resend; check the connected mailbox and request delivery review.';
        failed+=1;await db.run("UPDATE supplier_enquiry_drafts SET followup_delivery_state=?,followup_sent_at=COALESCE(followup_sent_at,?),followup_message_id=COALESCE(followup_message_id,?),followup_failure=?,updated_at=? WHERE id=?",state,providerConfirmed?confirmed?.sentAt||stamp():null,providerConfirmed?`supplier-followup-${candidate.id}`:null,message,stamp(),candidate.id);
      }
    }
    return{processed:rows.length,sent:sentCount,failed};
  }

  async function reconcileSupplierDelivery(requestId,actor){
    const request=await db.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',requestId);
    const attempt=await db.get("SELECT * FROM supplier_delivery_attempts WHERE supplier_enquiry_id=? AND state IN ('sending','uncertain','sent') ORDER BY created_at DESC LIMIT 1",requestId);
    if(!request||!attempt||attempt.communication_message_id!==request.communication_message_id)throw problem('No matching supplier delivery attempt is available to check.',409,'supplier_delivery_unconfirmed');
    const proof=attempt.state==='sent'&&attempt.provider_message_id?{providerMessageId:attempt.provider_message_id,sentAt:attempt.sent_at}:await communicationService.reconcileFactoryDelivery(attempt,'Supplier');
    if(!proof)return {status:'unconfirmed',message:'No exact sent-message confirmation was found. This does not prove delivery failed. Nothing was sent by this check; keep the request blocked and check again later.'};
    const at=stamp(),sentAt=proof.sentAt||attempt.sent_at,due=request.request_kind==='revision'?plusCalendarDays(sentAt,7):null;
    await db.run("UPDATE supplier_delivery_attempts SET state='sent',provider_message_id=?,sent_at=?,reconciled_by=?,reconciled_at=?,updated_at=? WHERE id=?",proof.providerMessageId,sentAt,text(actor),at,at,attempt.id);
    const prior=await communications.get(attempt.communication_message_id);
    if(prior)await communications.save({...prior,provider:'google_workspace',providerMessageId:proof.providerMessageId,threadId:proof.threadId||prior.threadId,status:'sent',folder:'sent',sentAt,error:null});
    await db.run("UPDATE supplier_enquiry_drafts SET status='sent',sent_at=?,response_due_at=COALESCE(response_due_at,?),followup_due_at=CASE WHEN response_state='outstanding' AND completed_at IS NULL THEN COALESCE(followup_due_at,?) ELSE followup_due_at END,updated_at=? WHERE id=? AND status='draft'",sentAt,due,due,at,requestId);
    if(request.revision_request_id)await db.run("UPDATE supplier_revision_requests SET status='sent',workflow_state='sent_to_supplier',sent_at=COALESCE(sent_at,?),response_due_at=COALESCE(response_due_at,?),updated_at=? WHERE id=? AND workflow_state='prepared_for_review' AND status<>'cancelled' AND completed_at IS NULL",sentAt,due,at,request.revision_request_id);
    await event('supplier.delivery.reconciled',attempt.id,[{kind:'supplier_enquiry',id:requestId},{kind:'communication',id:attempt.communication_message_id}]);
    return {status:'sent',message:'The exact sent message and reviewed contents are confirmed. No additional email was sent. Review the supplier response deadline and wait for the revised document.'};
  }

  return { reconcileSupplierDelivery, deliveryStatus: () => delivery.publicStatus(), changesRequestedQueue, changeRequestDetail, supplierRevisionDetail, supplierReviewHistory, supplierEnquiryContext, prepareSupplierEnquiry, linkManufacturerResponse, prepareSupplierRevision, prepareSupplierRevisionCorrespondence, attachSupplierRevisionDocument, verifySupplierRevision, updateSupplierResponseDue, retrySupplierRevisionFollowup, processDueSupplierRevisionFollowups, orderJourney, approveOrder, prepareFactoryOrder, recordFactoryConfirmation, releaseFactoryConfirmation, recordReviewedSignedApproval, customerDocuments };
}
