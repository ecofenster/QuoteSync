import { createHash, randomUUID } from 'node:crypto';
import { createPortalSecurityService } from '../clientPortal/portalSecurityService.js';
import { createCommunicationRepository } from '../communications/communicationRepository.js';
import { createCommunicationsService } from '../communications/communicationsService.js';
import { createTestDeliveryPolicy } from './testDeliveryPolicy.js';
import { createCustomerLifecycleDocumentService } from './customerLifecycleDocumentService.js';
import { createSupplierRevisionChangeDocumentService } from './supplierRevisionChangeDocumentService.js';

const text = (value) => String(value ?? '').trim();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const problem = (message, status = 422, code = 'lifecycle_invalid') => Object.assign(new Error(message), { status, code });
const normalized = (value) => text(value).toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');
const parse = (value, fallback = []) => { try { return JSON.parse(value || ''); } catch { return fallback; } };

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
  const deliverOrSave = (message, send) => send === true ? communicationService.sendMessage(message) : communications.save(message);

  async function event(eventName, evidenceId, links) {
    const at = stamp();
    await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING`, randomUUID(), eventName, evidenceId, at, JSON.stringify(links), at);
  }

  async function changesRequestedQueue() {
    const rows = await db.all(`SELECT r.id review_submission_id,r.estimate_release_id,r.status,r.general_comment,r.submitted_at,
      rel.estimate_id,rel.estimate_revision,rel.client_id,rel.project_id,c.client_ref,c.name client_name,p.name project_name,
      (SELECT COUNT(*) FROM portal_review_position_entries e WHERE e.review_submission_id=r.id AND e.response='amendment_requested') amendment_count,
      sr.id supplier_revision_request_id,sr.status supplier_revision_status,sr.successor_estimate_id
      FROM portal_review_submissions r JOIN estimate_revision_releases rel ON rel.id=r.estimate_release_id
      JOIN clients c ON c.id=rel.client_id JOIN projects p ON p.id=rel.project_id
      LEFT JOIN supplier_revision_requests sr ON sr.review_submission_id=r.id
      WHERE r.general_response='amendment_requested' OR EXISTS(SELECT 1 FROM portal_review_position_entries e WHERE e.review_submission_id=r.id AND e.response='amendment_requested')
      ORDER BY r.submitted_at DESC`);
    return rows.map((row) => ({ ...row, amendment_count: Number(row.amendment_count) }));
  }

  async function changeRequestDetail(reviewId) {
    const review = await db.get(`SELECT r.*,rel.estimate_id,rel.estimate_revision,rel.client_id,rel.project_id,rel.customer_projection_json,
      c.client_ref,c.name client_name,p.name project_name,sr.id supplier_revision_request_id,sr.status supplier_revision_status,sr.recipient,sr.subject,sr.body_text,sr.successor_estimate_id,sr.returned_document_id,sr.returned_revision,sr.verified_at
      FROM portal_review_submissions r JOIN estimate_revision_releases rel ON rel.id=r.estimate_release_id
      JOIN clients c ON c.id=rel.client_id JOIN projects p ON p.id=rel.project_id
      LEFT JOIN supplier_revision_requests sr ON sr.review_submission_id=r.id WHERE r.id=?`, reviewId);
    if (!review) throw problem('Customer change submission was not found.', 404, 'review_not_found');
    const entries = await db.all('SELECT * FROM portal_review_position_entries WHERE review_submission_id=? ORDER BY position_reference', reviewId);
    const checks = review.supplier_revision_request_id ? await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY change_kind,estimate_position_id,field_key', review.supplier_revision_request_id) : [];
    const documents = await db.all('SELECT id,file_name,document_type,provider_revision revision,provider_modified_at modified_at FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 ORDER BY provider_modified_at DESC', review.project_id);
    return { reviewSubmissionId: review.id, estimateReleaseId: review.estimate_release_id, estimateId: review.estimate_id, estimateRevision: Number(review.estimate_revision), clientId: review.client_id, clientReference: review.client_ref, clientName: review.client_name, projectId: review.project_id, projectName: review.project_name, status: review.status, generalComment: review.general_comment, generalResponse: review.general_response, submittedAt: review.submitted_at, positions: entries.map((entry) => ({ id: entry.id, estimatePositionId: entry.estimate_position_id, reference: entry.position_reference, response: entry.response, comment: entry.comment })), supplierRevision: review.supplier_revision_request_id ? { id: review.supplier_revision_request_id, status: review.supplier_revision_status, recipient: review.recipient, subject: review.subject, bodyText: review.body_text, successorEstimateId: review.successor_estimate_id, returnedDocumentId: review.returned_document_id, returnedRevision: review.returned_revision, verifiedAt: review.verified_at } : null, checks, documents };
  }

  async function supplierRevisionDetail(requestId) {
    const request = await db.get(`SELECT sr.*,rel.project_id,rel.client_id,p.name project_name,c.name client_name,e.estimate_ref successor_estimate_ref
      FROM supplier_revision_requests sr JOIN estimate_revision_releases rel ON rel.id=sr.source_release_id
      JOIN projects p ON p.id=rel.project_id JOIN clients c ON c.id=rel.client_id JOIN estimates e ON e.id=sr.successor_estimate_id WHERE sr.id=?`, requestId);
    if (!request) throw problem('Supplier revision request was not found.', 404, 'supplier_revision_request_not_found');
    const hasSupplierAttachments = Boolean(await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_quote_attachments'"));
    const supplierDocuments = hasSupplierAttachments ? await db.all(`SELECT a.id,a.original_file_name file_name,COALESCE(r.supplier_revision,CAST(r.revision_sequence AS TEXT)) revision,r.id revision_id FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id WHERE a.estimate_id=? ORDER BY a.created_at DESC`, request.successor_estimate_id) : [];
    return { id: request.id, status: request.status, reviewSubmissionId: request.review_submission_id, sourceReleaseId: request.source_release_id, successorEstimateId: request.successor_estimate_id, successorEstimateRef: request.successor_estimate_ref, clientId: request.client_id, clientName: request.client_name, projectId: request.project_id, projectName: request.project_name, recipient: request.recipient, subject: request.subject, bodyText: request.body_text, summary: parse(request.summary_json, {}), documentIds: parse(request.document_ids_json, []), communicationMessageId: request.communication_message_id, returnedDocumentId: request.returned_document_id, returnedSourceKind: request.returned_source_kind, returnedRevision: request.returned_revision, verifiedAt: request.verified_at, checks: await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY change_kind,estimate_position_id,field_key', requestId), supplierDocuments };
  }

  async function prepareSupplierEnquiry(projectId, input = {}) {
    const actor=text(input.createdBy),recipient=text(input.recipient),subject=text(input.subject),bodyText=text(input.bodyText),documentIds=[...new Set((input.documentIds||[]).map(text).filter(Boolean))];
    if(!actor||!recipient||!subject||!bodyText)throw problem('Project, factory recipient, subject, message and staff identity are required.');
    const project=await db.get('SELECT p.id,p.client_id,p.name FROM projects p WHERE p.id=? AND p.deleted_at IS NULL',projectId);if(!project)throw problem('Project was not found.',404,'project_not_found');
    const documents=documentIds.length?await db.all(`SELECT id,file_name,mime_type,size_bytes,provider_file_id FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 AND id IN (${documentIds.map(()=>'?').join(',')})`,projectId,...documentIds):[];
    if(documents.length!==documentIds.length)throw problem('Every selected supplier-enquiry file must be a current canonical document for this Project.',422,'supplier_enquiry_document_invalid');
    if(input.send===true)delivery.assertRecipient(recipient,'factory');
    const id=randomUUID(),communicationId=randomUUID(),at=stamp();
    const message={id:communicationId,provider:input.send===true?'google_workspace':'quotesuite_preview',direction:'outbound',folder:input.send===true?'sent':'drafts',status:input.send===true?'sending':'draft',from:[],to:[recipient],cc:[],bcc:[],subject,bodyText,bodyHtml:`<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;')}</p>`,links:[{kind:'project',id:projectId},...(input.estimateId?[{kind:'estimate',id:text(input.estimateId)}]:[])],attachments:documents.map(document=>({id:randomUUID(),fileName:document.file_name,mediaType:document.mime_type,sizeBytes:Number(document.size_bytes||0),driveFileId:document.provider_file_id}))};
    const communication=await deliverOrSave(message,input.send);
    const status=input.send===true?'sent':'draft';
    await db.run(`INSERT INTO supplier_enquiry_drafts(id,project_id,estimate_id,supplier_id,recipient,subject,body_text,document_ids_json,communication_message_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,id,projectId,text(input.estimateId)||null,text(input.supplierId)||null,recipient,subject,bodyText,JSON.stringify(documentIds),communicationId,status,actor,at,at);
    await event(input.send===true?'supplier.enquiry.sent':'supplier.enquiry.prepared',id,[{kind:'project',id:projectId},{kind:'communication',id:communicationId},...(input.estimateId?[{kind:'estimate',id:text(input.estimateId)}]:[])]);
    return{id,projectId,estimateId:text(input.estimateId)||null,status,recipient,subject,bodyText,documents,communicationMessageId:communication.id,delivery:delivery.publicStatus()};
  }

  async function linkManufacturerResponse(projectId,input={}){
    const actor=text(input.createdBy),communicationId=text(input.communicationMessageId),documentId=text(input.canonicalDocumentId)||null,estimateId=text(input.estimateId)||null;
    if(!actor||!communicationId)throw problem('Manufacturer response and staff identity are required.');
    const message=await communications.get(communicationId);if(!message)throw problem('Manufacturer response message was not found.',404,'manufacturer_response_not_found');
    if(documentId&&!await db.get('SELECT id FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0',documentId,projectId))throw problem('Manufacturer response document must belong to the selected Project.',422,'manufacturer_response_document_invalid');
    if(estimateId&&!await db.get('SELECT id FROM estimates WHERE id=? AND project_id=? AND deleted_at IS NULL',estimateId,projectId))throw problem('Working Estimate must belong to the selected Project.',422,'manufacturer_response_estimate_invalid');
    const existing=await db.get('SELECT * FROM manufacturer_response_links WHERE project_id=? AND communication_message_id=? AND canonical_document_id IS ?',projectId,communicationId,documentId);if(existing)return{...existing,idempotentReplay:true};
    const id=randomUUID(),at=stamp();await db.run(`INSERT INTO manufacturer_response_links(id,project_id,estimate_id,supplier_enquiry_id,communication_message_id,canonical_document_id,status,created_by,created_at) VALUES(?,?,?,?,?,?,'ready_for_import',?,?)`,id,projectId,estimateId,text(input.supplierEnquiryId)||null,communicationId,documentId,actor,at);
    await communications.addLink(communicationId,{kind:'project',id:projectId});if(estimateId)await communications.addLink(communicationId,{kind:'estimate',id:estimateId});
    await event('supplier.response.linked',id,[{kind:'project',id:projectId},{kind:'communication',id:communicationId},...(documentId?[{kind:'document',id:documentId}]:[]),...(estimateId?[{kind:'estimate',id:estimateId}]:[])]);
    return{id,projectId,estimateId,canonicalDocumentId:documentId,status:'ready_for_import',nextAction:'Review with Manufacturer Import',idempotentReplay:false};
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
    await db.run(`INSERT INTO supplier_revision_requests(id,review_submission_id,source_release_id,successor_estimate_id,status,recipient,subject,summary_json,document_ids_json,created_by,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,?,?,?,?,?)`, id, reviewId, review.release_id, successor.id, recipient, subject, JSON.stringify(summary), JSON.stringify(input.documentIds || []), actor, at, at);
    await event('supplier.revision_request.prepared', id, [{ kind: 'estimate_release', id: review.release_id }, { kind: 'estimate', id: successor.id }, { kind: 'project', id: review.project_id }]);
    return { id, status: 'draft', recipient, subject, summary, documentIds: input.documentIds || [], successorEstimateId: successor.id };
  }

  async function prepareSupplierRevisionCorrespondence(requestId, input = {}) {
    const request = await supplierRevisionDetail(requestId), actor = text(input.reviewedBy), recipient = text(input.recipient), subject = text(input.subject) || request.subject;
    if (!actor || !recipient || !subject) throw problem('Staff review, supplier recipient and subject are required.');
    if (input.send === true) delivery.assertRecipient(recipient, 'factory');
    const documentIds = [...new Set((input.documentIds || request.documentIds || []).map(text).filter(Boolean))];
    const documents = documentIds.length ? await db.all(`SELECT id,file_name,mime_type,size_bytes,provider_file_id FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 AND id IN (${documentIds.map(() => '?').join(',')})`, request.projectId, ...documentIds) : [];
    if (documents.length !== documentIds.length) throw problem('Every supplier revision attachment must be a current canonical document for this Project.', 422, 'supplier_revision_document_invalid');
    const bodyText = text(input.bodyText) || [
      `Please review the requested changes for ${request.projectName}.`,
      ...request.summary.positions.map((position) => `${position.reference}: ${position.request}`),
      ...(request.summary.generalComment ? [`General: ${request.summary.generalComment}`] : []),
      `Please return a revised quotation/document which identifies the changed values.`,
    ].join('\n');
    const review = await changeRequestDetail(request.reviewSubmissionId);
    const changeDocument = await supplierChangeDocuments.create(requestId, {
      clientName: request.clientName, projectName: request.projectName, estimateReference: request.summary.sourceEstimateRef,
      estimateRevision: request.summary.sourceRevision, submittedAt: review.submittedAt, generalComment: review.generalComment,
      generalResponse: review.generalResponse, positions: review.positions,
    });
    const communicationId = request.communicationMessageId || randomUUID(), at = stamp();
    const communication=await deliverOrSave({ id: communicationId, provider: input.send===true?'google_workspace':'quotesuite_preview', direction: 'outbound', folder: input.send===true?'sent':'drafts', status: input.send===true?'sending':'draft', from: [], to: [recipient], cc: [], bcc: [], subject, bodyText, bodyHtml: `<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')}</p>`, links: [{ kind: 'project', id: request.projectId }, { kind: 'estimate', id: request.successorEstimateId }, { kind: 'supplier_revision_request', id: requestId }], attachments: [{ id: randomUUID(), fileName: changeDocument.fileName, mediaType: changeDocument.mediaType, sizeBytes: changeDocument.sizeBytes, storageKey: changeDocument.storageKey, sha256: changeDocument.sha256 }, ...documents.map((document) => ({ id: randomUUID(), fileName: document.file_name, mediaType: document.mime_type, sizeBytes: Number(document.size_bytes || 0), driveFileId: document.provider_file_id }))] },input.send);
    const correspondenceStatus=input.send===true?'sent':'approved';
    await db.run("UPDATE supplier_revision_requests SET recipient=?,subject=?,body_text=?,document_ids_json=?,communication_message_id=?,status=?,updated_at=? WHERE id=?", recipient, subject, bodyText, JSON.stringify(documentIds), communication.id, correspondenceStatus, at, requestId);
    await event(input.send===true?'supplier.revision.correspondence_sent':'supplier.revision.correspondence_reviewed', `${requestId}:${hash({ recipient, subject, bodyText, documentIds })}`, [{ kind: 'supplier_revision_request', id: requestId }, { kind: 'communication', id: communication.id }, { kind: 'estimate', id: request.successorEstimateId }]);
    return { ...(await supplierRevisionDetail(requestId)), communicationMessageId: communicationId, changeDocument: { id: changeDocument.id, fileName: changeDocument.fileName }, delivery: delivery.publicStatus() };
  }

  async function attachSupplierRevisionDocument(requestId, input = {}) {
    const request = await supplierRevisionDetail(requestId), sourceKind = input.sourceKind === 'supplier_quote_attachment' ? 'supplier_quote_attachment' : 'canonical_document', documentId = text(sourceKind === 'supplier_quote_attachment' ? input.supplierQuoteAttachmentId : input.canonicalDocumentId), revision = text(input.revision) || 'current', actor = text(input.reviewedBy);
    if (!documentId || !actor) throw problem('Returned document and staff identity are required.');
    const document = sourceKind === 'supplier_quote_attachment'
      ? await db.get(`SELECT a.id,a.original_file_name file_name,COALESCE(r.supplier_revision,CAST(r.revision_sequence AS TEXT)) provider_revision,a.sha256 checksum FROM supplier_quote_attachments a JOIN supplier_quote_revisions r ON r.id=a.revision_id WHERE a.id=? AND a.estimate_id=?`, documentId, request.successorEstimateId)
      : await db.get('SELECT id,file_name,provider_revision,checksum FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0', documentId, request.projectId);
    if (!document) throw problem('The returned supplier revision must be a current canonical document for this Project.', 422, 'supplier_revision_return_document_invalid');
    await db.run("UPDATE supplier_revision_requests SET returned_document_id=?,returned_source_kind=?,returned_revision=?,status='approved',updated_at=? WHERE id=?", document.id, sourceKind, revision, stamp(), requestId);
    await event('supplier.revision.returned_document_linked', `${requestId}:${document.id}:${revision}`, [{ kind: 'supplier_revision_request', id: requestId }, { kind: sourceKind, id: document.id }, { kind: 'estimate', id: request.successorEstimateId }]);
    return { ...(await supplierRevisionDetail(requestId)), returnedDocument: { id: document.id, sourceKind, fileName: document.file_name, revision, checksum: document.checksum } };
  }

  async function verifySupplierRevision(requestId, input = {}) {
    const request = await db.get('SELECT * FROM supplier_revision_requests WHERE id=?', requestId);
    if (!request) throw problem('Supplier revision request was not found.', 404, 'supplier_revision_request_not_found');
    if (!request.returned_document_id) throw problem('Link the returned supplier revision document before verifying requested changes.', 409, 'supplier_revision_document_required');
    const checks = [...(Array.isArray(input.checks) ? input.checks.map((check) => ({ ...check, changeKind: 'requested' })) : []), ...(Array.isArray(input.unrelatedChanges) ? input.unrelatedChanges.map((check) => ({ ...check, changeKind: 'unrelated_material_change', requestedChange: text(check.requestedChange) || 'Unrelated material change introduced by supplier revision' })) : [])];
    if (!checks.length) throw problem('At least one source-backed requested-change check is required.');
    const at = stamp();
    for (const check of checks) {
      const status = check.approvedDifference === true && text(check.resolutionNote) ? 'approved_difference' : deriveRevisionCheck(check);
      await db.run(`INSERT INTO revision_change_checks(id,supplier_revision_request_id,estimate_position_id,field_key,requested_change,before_value,expected_value,after_value,status,before_source_reference,after_source_reference,resolution_note,resolved_by,resolved_at,created_at,change_kind)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(supplier_revision_request_id,estimate_position_id,field_key) DO UPDATE SET after_value=excluded.after_value,status=excluded.status,after_source_reference=excluded.after_source_reference,resolution_note=excluded.resolution_note,resolved_by=excluded.resolved_by,resolved_at=excluded.resolved_at,change_kind=excluded.change_kind`, randomUUID(), requestId, text(check.estimatePositionId) || null, text(check.fieldKey), text(check.requestedChange), text(check.beforeValue) || null, text(check.expectedValue) || null, text(check.afterValue) || null, status, text(check.beforeSourceReference) || null, text(check.afterSourceReference) || null, text(check.resolutionNote), text(input.reviewedBy) || null, input.reviewedBy ? at : null, at, check.changeKind);
    }
    const requestedPositions = await db.all(`SELECT e.estimate_position_id FROM portal_review_position_entries e WHERE e.review_submission_id=? AND e.response='amendment_requested'`, request.review_submission_id);
    const generalReview = await db.get('SELECT general_response FROM portal_review_submissions WHERE id=?', request.review_submission_id);
    const covered = new Set((await db.all(`SELECT DISTINCT estimate_position_id FROM revision_change_checks WHERE supplier_revision_request_id=? AND change_kind='requested'`, requestId)).map((row) => row.estimate_position_id));
    const missingRequestedPositions = requestedPositions.map((row) => row.estimate_position_id).filter((positionId) => !covered.has(positionId));
    const generalCovered = generalReview?.general_response !== 'amendment_requested' || Boolean(await db.get(`SELECT id FROM revision_change_checks WHERE supplier_revision_request_id=? AND change_kind='requested' AND estimate_position_id IS NULL`, requestId));
    const unresolved = Number((await db.get(`SELECT COUNT(*) count FROM revision_change_checks WHERE supplier_revision_request_id=? AND status IN ('not_implemented','needs_review','change_detected')`, requestId))?.count || 0) + missingRequestedPositions.length + (generalCovered ? 0 : 1);
    await db.run("UPDATE supplier_revision_requests SET verified_at=?,status=?,updated_at=? WHERE id=?", unresolved ? null : at, unresolved ? 'approved' : 'approved', at, requestId);
    await event('supplier.revision.verified', `${requestId}:${hash(checks)}`, [{ kind: 'supplier_revision_request', id: requestId }, { kind: 'estimate', id: request.successor_estimate_id }]);
    return { requestId, checks: await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY change_kind,estimate_position_id,field_key', requestId), missingRequestedPositions, generalRequestCovered: generalCovered, unresolved, issueAllowed: unresolved === 0 };
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
    const confirmations = await db.all(`SELECT fc.*,r.id release_id,r.released_at,s.id signoff_id,s.approved_at signoff_approved_at,s.signed_pdf_document_id
      FROM factory_confirmations fc LEFT JOIN factory_confirmation_releases r ON r.factory_confirmation_id=fc.id
      LEFT JOIN factory_confirmation_signoffs s ON s.factory_confirmation_release_id=r.id WHERE fc.order_id=? ORDER BY fc.created_at DESC`, orderId);
    const confirmationDetails = [];
    for (const confirmation of confirmations) {
      const signedPdfReview = confirmation.release_id ? await db.get('SELECT * FROM factory_confirmation_signed_pdf_reviews WHERE factory_confirmation_release_id=? ORDER BY reviewed_at DESC LIMIT 1', confirmation.release_id) : null;
      confirmationDetails.push({ id: confirmation.id, documentId: confirmation.canonical_document_id, revision: confirmation.revision, status: confirmation.status, createdAt: confirmation.created_at, releaseId: confirmation.release_id, releasedAt: confirmation.released_at, signoffId: confirmation.signoff_id, signedPdfDocumentId: signedPdfReview?.signed_pdf_document_id || confirmation.signed_pdf_document_id, signedOffAt: confirmation.signoff_approved_at, signedPdfReviewedAt: signedPdfReview?.reviewed_at || null, checks: await db.all('SELECT * FROM factory_confirmation_checks WHERE factory_confirmation_id=? ORDER BY estimate_position_id,field_key', confirmation.id) });
    }
    return { id: order.id, orderRef: order.order_ref, clientId: order.client_id, projectId: order.project_id, status: order.status, sourceEstimateId: order.source_estimate_id, sourceEstimateRevision: Number(order.source_estimate_revision), estimateReleaseId: order.estimate_release_id, estimateDocumentId: order.estimate_document_id, customerProjection: parse(order.customer_projection_json, {}), acceptance: { id: order.acceptance_id, acceptedAt: order.accepted_at, positions: acceptedPositions.map((position) => ({ estimatePositionId: position.estimate_position_id, reference: position.position_reference, confirmations: parse(position.confirmations_json, {}) })) }, staffApproval: order.staff_approval_id ? { id: order.staff_approval_id, approvedBy: order.approved_by, approvedAt: order.approved_at, note: order.approval_note } : null, factoryOrder: order.factory_order_request_id ? { id: order.factory_order_request_id, status: order.factory_order_status, recipient: order.factory_recipient, subject: order.factory_subject, bodyText: order.factory_body_text } : null, documents, confirmations: confirmationDetails };
  }

  async function prepareFactoryOrder(orderId, input = {}) {
    const order = await db.get('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw problem('Order was not found.', 404, 'order_not_found');
    if (!await db.get('SELECT id FROM order_staff_approvals WHERE order_id=?', orderId)) throw problem('Staff approval is required before preparing the factory order.', 409, 'factory_order_staff_approval_required');
    const existing = await db.get('SELECT * FROM factory_order_requests WHERE order_id=?', orderId);
    if (existing) {
      if (input.send === true && existing.status !== 'sent') {
        const prior = await communications.get(existing.communication_message_id);
        if (!prior) throw problem('Prepared factory Order correspondence was not found.', 409, 'factory_order_communication_missing');
        delivery.assertRecipient(existing.recipient, 'factory');
        const sent = await communicationService.sendMessage({ ...prior, provider:'google_workspace',folder:'sent',status:'sending' });
        const at=stamp();
        await db.run("UPDATE factory_order_requests SET status='sent',updated_at=? WHERE id=?",at,existing.id);
        await event('factory.order.sent',existing.id,[{kind:'order',id:orderId},{kind:'communication',id:sent.id}]);
        return { ...existing, status:'sent', delivery:delivery.publicStatus(), documentIds:parse(existing.document_ids_json,[]) };
      }
      return { ...existing, delivery: delivery.publicStatus(), documentIds: parse(existing.document_ids_json, []) };
    }
    const recipient = text(input.recipient), actor = text(input.createdBy), subject = text(input.subject) || `Factory Order ${order.order_ref}`;
    if (!recipient || !actor) throw problem('Factory recipient and staff identity are required.');
    if (input.send === true) delivery.assertRecipient(recipient, 'factory');
    const orderDocument = await customerDocuments.createOrderDocument(orderId, { revision: 'staff-approved' });
    const documentIds = [...new Set([orderDocument.id, ...(input.documentIds || []).map(text).filter(Boolean)])];
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

  return { deliveryStatus: () => delivery.publicStatus(), changesRequestedQueue, changeRequestDetail, supplierRevisionDetail, prepareSupplierEnquiry, linkManufacturerResponse, prepareSupplierRevision, prepareSupplierRevisionCorrespondence, attachSupplierRevisionDocument, verifySupplierRevision, orderJourney, approveOrder, prepareFactoryOrder, recordFactoryConfirmation, releaseFactoryConfirmation, recordReviewedSignedApproval, customerDocuments };
}
