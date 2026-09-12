export async function outstandingSupplierRevisionRequests(db, revisionRequestId) {
  return db.all(`SELECT se.id,se.supplier_id,se.recipient,se.subject,se.status,se.response_state,
    COALESCE(s.supplier_name,se.recipient,'Supplier') supplier_name
    FROM supplier_enquiry_drafts se LEFT JOIN supplier_commercial_defaults s ON s.supplier_code=se.supplier_id
    WHERE se.revision_request_id=? AND se.status<>'cancelled'
    AND se.response_state<>'revised_document_received'
    AND NOT EXISTS(SELECT 1 FROM supplier_enquiry_drafts successor WHERE successor.supersedes_id=se.id AND successor.status<>'cancelled')
    ORDER BY se.created_at,se.id`, revisionRequestId);
}

export function supplierReviewSourceIdentity(request) {
  return JSON.stringify([request.returned_source_kind || 'canonical_document', request.returned_document_id, request.returned_revision, request.returned_checksum || null]);
}

export async function staleSupplierReviewCount(db, request) {
  const row=await db.get('SELECT COUNT(*) count FROM revision_change_checks WHERE supplier_revision_request_id=? AND source_identity IS NOT ?',request.id,supplierReviewSourceIdentity(request));
  return Number(row?.count || 0);
}

// Shared by reviewed reply linking and provider-confirmed filing; safe on retry.
export async function recordSupplierResponseState(db, { supplierEnquiryId, documentId, receivedAt }) {
  if (!supplierEnquiryId) return;
  const request = await db.get('SELECT revision_request_id FROM supplier_enquiry_drafts WHERE id=?', supplierEnquiryId);
  if (!request) throw new Error('The supplier request could not be reopened to record its response.');
  await db.run(`UPDATE supplier_enquiry_drafts SET
    response_state=CASE WHEN response_state='revised_document_received' THEN response_state ELSE ? END,
    received_at=COALESCE(received_at,?),followup_due_at=NULL,followup_failure='',updated_at=? WHERE id=?`,
  documentId ? 'revised_document_received' : 'acknowledgement_received', receivedAt, receivedAt, supplierEnquiryId);
  if (request.revision_request_id) await db.run(`UPDATE supplier_revision_requests SET
    workflow_state=CASE WHEN workflow_state IN ('revised_document_received','revised_customer_estimate_issued','cancelled','superseded') THEN workflow_state ELSE ? END,
    received_at=COALESCE(received_at,?),updated_at=? WHERE id=?`,
  documentId ? 'revised_document_received' : 'supplier_reply_received', receivedAt, receivedAt, request.revision_request_id);
}
