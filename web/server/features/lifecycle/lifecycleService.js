import { createHash, randomUUID } from 'node:crypto';
import { createPortalSecurityService } from '../clientPortal/portalSecurityService.js';
import { createCommunicationRepository } from '../communications/communicationRepository.js';
import { createTestDeliveryPolicy } from './testDeliveryPolicy.js';

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
  const communications = options.communications || createCommunicationRepository(db);
  const delivery = options.deliveryPolicy || createTestDeliveryPolicy(options.environment);
  const stamp = () => now().toISOString();

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
      WHERE EXISTS(SELECT 1 FROM portal_review_position_entries e WHERE e.review_submission_id=r.id AND e.response='amendment_requested')
      ORDER BY r.submitted_at DESC`);
    return rows.map((row) => ({ ...row, amendment_count: Number(row.amendment_count) }));
  }

  async function prepareSupplierEnquiry(projectId, input = {}) {
    const actor=text(input.createdBy),recipient=text(input.recipient),subject=text(input.subject),bodyText=text(input.bodyText),documentIds=[...new Set((input.documentIds||[]).map(text).filter(Boolean))];
    if(!actor||!recipient||!subject||!bodyText)throw problem('Project, factory recipient, subject, message and staff identity are required.');
    const project=await db.get('SELECT p.id,p.client_id,p.name FROM projects p WHERE p.id=? AND p.deleted_at IS NULL',projectId);if(!project)throw problem('Project was not found.',404,'project_not_found');
    const documents=documentIds.length?await db.all(`SELECT id,file_name,mime_type,size_bytes,provider_file_id FROM canonical_documents WHERE project_id=? AND removed_at IS NULL AND trashed=0 AND id IN (${documentIds.map(()=>'?').join(',')})`,projectId,...documentIds):[];
    if(documents.length!==documentIds.length)throw problem('Every selected supplier-enquiry file must be a current canonical document for this Project.',422,'supplier_enquiry_document_invalid');
    if(input.send===true)delivery.assertRecipient(recipient,'factory');
    const id=randomUUID(),communicationId=randomUUID(),at=stamp();
    await communications.save({id:communicationId,provider:'quotesuite_preview',direction:'outbound',folder:'drafts',status:'draft',from:[],to:[recipient],cc:[],bcc:[],subject,bodyText,bodyHtml:`<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;')}</p>`,links:[{kind:'project',id:projectId},...(input.estimateId?[{kind:'estimate',id:text(input.estimateId)}]:[])],attachments:documents.map(document=>({id:randomUUID(),fileName:document.file_name,mediaType:document.mime_type,sizeBytes:Number(document.size_bytes||0),driveFileId:document.provider_file_id}))});
    await db.run(`INSERT INTO supplier_enquiry_drafts(id,project_id,estimate_id,supplier_id,recipient,subject,body_text,document_ids_json,communication_message_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'draft',?,?,?)`,id,projectId,text(input.estimateId)||null,text(input.supplierId)||null,recipient,subject,bodyText,JSON.stringify(documentIds),communicationId,actor,at,at);
    await event('supplier.enquiry.prepared',id,[{kind:'project',id:projectId},{kind:'communication',id:communicationId},...(input.estimateId?[{kind:'estimate',id:text(input.estimateId)}]:[])]);
    return{id,projectId,estimateId:text(input.estimateId)||null,status:'draft',recipient,subject,bodyText,documents,communicationMessageId:communicationId,delivery:delivery.publicStatus()};
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
    if (!entries.length) throw problem('This customer review contains no amendment requests.', 409, 'amendments_not_requested');
    const successor = await portal.createNextEstimateRevision({ estimateReleaseId: review.release_id, createdBy: actor, createdByName: text(input.createdByName) || actor, reason: 'customer_amendment' });
    const summary = { clientName: review.client_name, projectName: review.project_name, sourceEstimateRef: review.estimate_ref, sourceRevision: Number(review.estimate_revision), successorEstimateId: successor.id, successorEstimateRef: successor.estimate_ref, generalComment: review.general_comment, positions: entries.map((entry) => ({ positionId: entry.estimate_position_id, reference: entry.position_reference, request: entry.comment })) };
    const id = randomUUID(), at = stamp(), recipient = text(input.recipient), subject = text(input.subject) || `Requested Estimate changes · ${review.project_name}`;
    await db.run(`INSERT INTO supplier_revision_requests(id,review_submission_id,source_release_id,successor_estimate_id,status,recipient,subject,summary_json,document_ids_json,created_by,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,?,?,?,?,?)`, id, reviewId, review.release_id, successor.id, recipient, subject, JSON.stringify(summary), JSON.stringify(input.documentIds || []), actor, at, at);
    await event('supplier.revision_request.prepared', id, [{ kind: 'estimate_release', id: review.release_id }, { kind: 'estimate', id: successor.id }, { kind: 'project', id: review.project_id }]);
    return { id, status: 'draft', recipient, subject, summary, documentIds: input.documentIds || [], successorEstimateId: successor.id };
  }

  async function verifySupplierRevision(requestId, input = {}) {
    const request = await db.get('SELECT * FROM supplier_revision_requests WHERE id=?', requestId);
    if (!request) throw problem('Supplier revision request was not found.', 404, 'supplier_revision_request_not_found');
    const checks = Array.isArray(input.checks) ? input.checks : [];
    if (!checks.length) throw problem('At least one source-backed requested-change check is required.');
    const at = stamp();
    for (const check of checks) {
      const status = check.approvedDifference === true && text(check.resolutionNote) ? 'approved_difference' : deriveRevisionCheck(check);
      await db.run(`INSERT INTO revision_change_checks(id,supplier_revision_request_id,estimate_position_id,field_key,requested_change,before_value,expected_value,after_value,status,before_source_reference,after_source_reference,resolution_note,resolved_by,resolved_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(supplier_revision_request_id,estimate_position_id,field_key) DO UPDATE SET after_value=excluded.after_value,status=excluded.status,after_source_reference=excluded.after_source_reference,resolution_note=excluded.resolution_note,resolved_by=excluded.resolved_by,resolved_at=excluded.resolved_at`, randomUUID(), requestId, text(check.estimatePositionId) || null, text(check.fieldKey), text(check.requestedChange), text(check.beforeValue) || null, text(check.expectedValue) || null, text(check.afterValue) || null, status, text(check.beforeSourceReference) || null, text(check.afterSourceReference) || null, text(check.resolutionNote), text(input.reviewedBy) || null, input.reviewedBy ? at : null, at);
    }
    const unresolved = Number((await db.get(`SELECT COUNT(*) count FROM revision_change_checks WHERE supplier_revision_request_id=? AND status IN ('not_implemented','needs_review','change_detected')`, requestId))?.count || 0);
    await event('supplier.revision.verified', `${requestId}:${hash(checks)}`, [{ kind: 'supplier_revision_request', id: requestId }, { kind: 'estimate', id: request.successor_estimate_id }]);
    return { requestId, checks: await db.all('SELECT * FROM revision_change_checks WHERE supplier_revision_request_id=? ORDER BY estimate_position_id,field_key', requestId), unresolved, issueAllowed: unresolved === 0 };
  }

  async function approveOrder(orderId, input = {}) {
    const actor = text(input.approvedBy);
    if (!actor) throw problem('Staff approval identity is required.');
    const order = await db.get('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw problem('Order was not found.', 404, 'order_not_found');
    const existing = await db.get('SELECT * FROM order_staff_approvals WHERE order_id=?', orderId);
    if (existing) return { ...existing, idempotentReplay: true };
    if (order.status !== 'customer_accepted_pending_staff_approval') throw problem('Order is not awaiting staff approval.', 409, 'order_not_awaiting_approval');
    const id = randomUUID(), at = stamp();
    await db.exec('BEGIN IMMEDIATE');
    try {
      await db.run('INSERT INTO order_staff_approvals(id,order_id,approved_by,approved_at,note) VALUES(?,?,?,?,?)', id, orderId, actor, at, text(input.note));
      await db.run("UPDATE orders SET status='staff_approved',updated_at=? WHERE id=?", at, orderId);
      await event('order.staff_approved', id, [{ kind: 'order', id: orderId }, { kind: 'project', id: order.project_id }]);
      await db.exec('COMMIT');
      return { id, orderId, approvedBy: actor, approvedAt: at, status: 'staff_approved', idempotentReplay: false };
    } catch (error) { await db.exec('ROLLBACK').catch(() => {}); throw error; }
  }

  async function prepareFactoryOrder(orderId, input = {}) {
    const order = await db.get('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw problem('Order was not found.', 404, 'order_not_found');
    if (!await db.get('SELECT id FROM order_staff_approvals WHERE order_id=?', orderId)) throw problem('Staff approval is required before preparing the factory order.', 409, 'factory_order_staff_approval_required');
    const existing = await db.get('SELECT * FROM factory_order_requests WHERE order_id=?', orderId);
    if (existing) return { ...existing, delivery: delivery.publicStatus(), documentIds: parse(existing.document_ids_json, []) };
    const recipient = text(input.recipient), actor = text(input.createdBy), subject = text(input.subject) || `Factory Order ${order.order_ref}`;
    if (!recipient || !actor) throw problem('Factory recipient and staff identity are required.');
    if (input.send === true) delivery.assertRecipient(recipient, 'factory');
    const id = randomUUID(), communicationId = randomUUID(), at = stamp(), bodyText = text(input.bodyText) || `Please review the attached approved Order ${order.order_ref}.`;
    await communications.save({ id: communicationId, provider: 'quotesuite_preview', direction: 'outbound', folder: 'drafts', status: 'draft', from: [], to: [recipient], cc: [], bcc: [], subject, bodyText, bodyHtml: `<p>${bodyText.replaceAll('&','&amp;').replaceAll('<','&lt;')}</p>`, links: [{ kind: 'order', id: orderId }, { kind: 'project', id: order.project_id }], attachments: [] });
    await db.run(`INSERT INTO factory_order_requests(id,order_id,status,recipient,subject,body_text,document_ids_json,communication_message_id,created_by,created_at,updated_at) VALUES(?,?,'draft',?,?,?,?,?,?,?,?)`, id, orderId, recipient, subject, bodyText, JSON.stringify(input.documentIds || []), communicationId, actor, at, at);
    await event('factory.order.prepared', id, [{ kind: 'order', id: orderId }, { kind: 'communication', id: communicationId }]);
    return { id, orderId, status: 'draft', recipient, subject, bodyText, communicationMessageId: communicationId, documentIds: input.documentIds || [], delivery: delivery.publicStatus() };
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
      await db.run(`INSERT INTO factory_confirmations(id,order_id,canonical_document_id,revision,status,source_sha256,created_by,created_at) VALUES(?,?,?,?,'staff_review',?,?,?)`, id, orderId, documentId, revision, document.checksum || null, text(input.createdBy), at);
      confirmation = await db.get('SELECT * FROM factory_confirmations WHERE id=?', id);
    }
    const checks = Array.isArray(input.checks) ? input.checks : [];
    for (const check of checks) await db.run(`INSERT INTO factory_confirmation_checks(id,factory_confirmation_id,estimate_position_id,field_key,approved_value,confirmed_value,status,approved_source_reference,confirmation_source_reference,resolution_note,resolved_by,resolved_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(factory_confirmation_id,estimate_position_id,field_key) DO UPDATE SET confirmed_value=excluded.confirmed_value,status=excluded.status,confirmation_source_reference=excluded.confirmation_source_reference,resolution_note=excluded.resolution_note,resolved_by=excluded.resolved_by,resolved_at=excluded.resolved_at`, randomUUID(), confirmation.id, text(check.estimatePositionId), text(check.fieldKey), text(check.approvedValue) || null, text(check.confirmedValue) || null, deriveConfirmationCheck(check), text(check.approvedSourceReference) || null, text(check.confirmationSourceReference) || null, text(check.resolutionNote), text(input.reviewedBy) || null, input.reviewedBy ? stamp() : null);
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
    if (existing) return { ...existing, idempotentReplay: true };
    const actor = text(input.releasedBy), at = stamp(), id = randomUUID();
    if (!actor) throw problem('Staff release identity is required.');
    await db.exec('BEGIN IMMEDIATE');
    try {
      await portal.releaseDocument({ clientId: confirmation.client_id, projectId: confirmation.project_id, documentId: confirmation.canonical_document_id, revision: confirmation.revision, releasedBy: actor });
      await db.run('INSERT INTO factory_confirmation_releases(id,factory_confirmation_id,project_id,released_by,released_at) VALUES(?,?,?,?,?)', id, confirmationId, confirmation.project_id, actor, at);
      await db.run("UPDATE factory_confirmations SET status='released' WHERE id=?", confirmationId);
      await db.run("UPDATE orders SET status='awaiting_customer_final_confirmation',updated_at=? WHERE id=?", at, confirmation.order_id);
      await event('factory.confirmation.released', id, [{ kind:'order',id:confirmation.order_id },{ kind:'factory_confirmation',id:confirmationId },{ kind:'document',id:confirmation.canonical_document_id }]);
      await db.exec('COMMIT');
      return { id, factoryConfirmationId: confirmationId, projectId: confirmation.project_id, releasedAt: at, status: 'awaiting_customer_final_confirmation', idempotentReplay: false };
    } catch (error) { await db.exec('ROLLBACK').catch(() => {}); throw error; }
  }

  async function recordReviewedSignedApproval(confirmationReleaseId, input = {}) {
    if (input.reviewed !== true) throw problem('Uploading a signed PDF is not approval; staff must explicitly verify it.', 422, 'signed_pdf_review_required');
    const release = await db.get(`SELECT r.*,fc.order_id,o.project_id FROM factory_confirmation_releases r JOIN factory_confirmations fc ON fc.id=r.factory_confirmation_id JOIN orders o ON o.id=fc.order_id WHERE r.id=?`, confirmationReleaseId);
    if (!release) throw problem('Released factory confirmation was not found.', 404, 'confirmation_release_not_found');
    const document = await db.get('SELECT id FROM canonical_documents WHERE id=? AND project_id=? AND removed_at IS NULL AND trashed=0', text(input.signedPdfDocumentId), release.project_id);
    if (!document) throw problem('The signed approval PDF must be a canonical Project document.', 422, 'signed_pdf_document_invalid');
    const requiredPositions = await db.all(`SELECT pa.estimate_position_id FROM portal_position_acceptances pa JOIN portal_estimate_acceptances a ON a.id=pa.estimate_acceptance_id WHERE a.order_id=? AND pa.accepted=1`, release.order_id);
    const approved = new Set((input.positionIds || []).map(String));
    if (!requiredPositions.length || requiredPositions.some((row) => !approved.has(row.estimate_position_id)) || input.overallApproved !== true) throw problem('Staff must verify overall and Position approval in the signed PDF.', 422, 'signed_pdf_acceptance_incomplete');
    const existing = await db.get('SELECT * FROM factory_confirmation_signoffs WHERE factory_confirmation_release_id=?', confirmationReleaseId);
    if (existing) return { ...existing, idempotentReplay: true };
    const id=randomUUID(),at=stamp(),actor=text(input.reviewedBy);
    await db.exec('BEGIN IMMEDIATE');
    try {
      await db.run(`INSERT INTO factory_confirmation_signoffs(id,factory_confirmation_release_id,portal_contact_id,overall_approved,signed_pdf_document_id,signed_pdf_reviewed_by,signed_pdf_reviewed_at,approved_at) VALUES(?,?,NULL,1,?,?,?,?)`,id,confirmationReleaseId,document.id,actor,at,at);
      for(const row of requiredPositions) await db.run('INSERT INTO factory_confirmation_position_approvals(id,signoff_id,estimate_position_id,approved,created_at) VALUES(?,?,?,1,?)',randomUUID(),id,row.estimate_position_id,at);
      await db.run("UPDATE orders SET status='customer_final_confirmation_approved',updated_at=? WHERE id=?",at,release.order_id);
      await event('factory.confirmation.signed_pdf_approved',id,[{kind:'order',id:release.order_id},{kind:'document',id:document.id}]);
      await db.exec('COMMIT');return{id,orderId:release.order_id,status:'customer_final_confirmation_approved',approvedAt:at,idempotentReplay:false};
    } catch(error){await db.exec('ROLLBACK').catch(()=>{});throw error;}
  }

  return { deliveryStatus: () => delivery.publicStatus(), changesRequestedQueue, prepareSupplierEnquiry, linkManufacturerResponse, prepareSupplierRevision, verifySupplierRevision, approveOrder, prepareFactoryOrder, recordFactoryConfirmation, releaseFactoryConfirmation, recordReviewedSignedApproval };
}
