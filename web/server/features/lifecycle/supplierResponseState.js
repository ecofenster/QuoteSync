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
