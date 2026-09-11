import { createHash } from "node:crypto";
import { createCustomerQuotationDocumentService } from "./customerQuotationDocumentService.js";
import { createCommunicationsService } from "../communications/communicationsService.js";
import { createPortalSecurityService } from "../clientPortal/portalSecurityService.js";
import { createTestDeliveryPolicy } from "../lifecycle/testDeliveryPolicy.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const parse = (value, fallback = null) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const plusDays = (value, days) => { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const requiredText = (value, label) => { const text = String(value || "").trim(); if (!text) throw Object.assign(new Error(`${label} is required.`), { status: 400 }); return text; };
const issueProblem = (message, status, code, details) => Object.assign(new Error(message), { status, code, ...(details ? { details } : {}) });
const stableId = (prefix, idempotencyKey) => `${prefix}-${idempotencyKey.slice(0, 32)}`;
const cleanLines=(value,label)=>{if(!Array.isArray(value))throw issueProblem(`${label} must be a list.`,400,"customer_terms_invalid");const lines=value.map(item=>String(item||"").trim()).filter(Boolean);if(lines.length>30||lines.some(item=>item.length>500))throw issueProblem(`${label} contains too much text.`,400,"customer_terms_invalid");return lines};

export function createIssuedQuotationService(db, options = {}) {
  const documents = createCustomerQuotationDocumentService(db, options), communications = createCommunicationsService(db, options), portalSecurity = createPortalSecurityService(db, options.portalSecurityOptions || {}), delivery = options.deliveryPolicy || createTestDeliveryPolicy(options.environment);
  const customerSubject = (value) => delivery.enabled && !/^TEST Customer\b/i.test(value) ? `TEST Customer · ${value}` : value;

  async function mapIssued(row) {
    if (!row) return null;
    const [document,communication,followUp,lifecycle] = await Promise.all([documents.get(row.document_id),row.communication_message_id ? communications.repository.get(row.communication_message_id) : null,db.get("SELECT id,due_at,status FROM followups WHERE issued_quotation_id=? ORDER BY created_at DESC LIMIT 1",row.id),db.get("SELECT lifecycle_state,reason,related_issued_quotation_id,actor_id,occurred_at FROM issued_quotation_lifecycle_events WHERE issued_quotation_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",row.id)]);
    const lifecycleStatus=lifecycle?.lifecycle_state||(row.status==="issued"?"issued":null);
    return { id: row.id, status: row.status, lifecycleStatus, lifecycle: lifecycle ? { status:lifecycle.lifecycle_state,reason:lifecycle.reason,relatedIssuedQuotationId:lifecycle.related_issued_quotation_id,actorId:lifecycle.actor_id,occurredAt:lifecycle.occurred_at } : null, clientId: row.client_id, estimateId: row.estimate_id, estimateRevision: row.estimate_revision, quotationRevision: row.quotation_revision, recipient: row.recipient, subject: row.subject, provider: row.provider, providerMessageId: row.provider_message_id, communicationMessageId: row.communication_message_id, preparedAt: row.prepared_at, issuedAt: row.issued_at, failedAt: row.failed_at, failureReason: row.failure_reason, commercialSnapshot: parse(row.commercial_snapshot_json, {}), termsSnapshot: row.terms_snapshot, document: document ? { ...document, downloadUrl: `/api/quotation-workflow/issued/${row.id}/document` } : null, communication, followUp: followUp ? { id:followUp.id,dueDate:followUp.due_at,status:followUp.status } : null };
  }
  async function get(id) { return mapIssued(await db.get("SELECT * FROM issued_quotations WHERE id=?", id)); }
  async function customerTerms(estimateId){
    const estimate=await db.get("SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL",requiredText(estimateId,"Estimate ID"));if(!estimate)throw issueProblem("Estimate was not found.",404,"estimate_not_found");
    const row=await db.get("SELECT * FROM estimate_customer_terms WHERE estimate_id=?",estimateId);return row?{estimateId:row.estimate_id,validityDays:Number(row.validity_days),terms:parse(row.terms_json,[]),exclusions:parse(row.exclusions_json,[]),reviewed:true,reviewedBy:row.reviewed_by,reviewedAt:row.reviewed_at}:{estimateId,validityDays:30,terms:[],exclusions:[],reviewed:false,reviewedBy:null,reviewedAt:null};
  }
  async function saveCustomerTerms(estimateId,input={}){
    const actor=requiredText(input.reviewedBy,"Staff identity"),validityDays=Number(input.validityDays),terms=cleanLines(input.terms,"Terms"),exclusions=cleanLines(input.exclusions,"Exclusions");
    if(!Number.isInteger(validityDays)||validityDays<1||validityDays>365)throw issueProblem("Validity must be between 1 and 365 days.",400,"customer_terms_validity_invalid");
    if(!await db.get("SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL",estimateId))throw issueProblem("Estimate was not found.",404,"estimate_not_found");
    if(await db.get("SELECT id FROM estimate_revision_releases WHERE estimate_id=?",estimateId))throw issueProblem("Issued Estimate terms are immutable. Create a new Estimate revision to make changes.",409,"estimate_revision_immutable");
    const at=new Date().toISOString();await db.run(`INSERT INTO estimate_customer_terms(estimate_id,validity_days,terms_json,exclusions_json,reviewed_by,reviewed_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(estimate_id) DO UPDATE SET validity_days=excluded.validity_days,terms_json=excluded.terms_json,exclusions_json=excluded.exclusions_json,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=excluded.updated_at`,estimateId,validityDays,JSON.stringify(terms),JSON.stringify(exclusions),actor,at,at);return customerTerms(estimateId);
  }
  async function assertCustomerTerms(estimateId,projection){
    const reviewedTerms=await customerTerms(estimateId);if(!reviewedTerms.reviewed)throw issueProblem("Review the Estimate validity, terms and exclusions before creating a customer document.",409,"customer_terms_review_required");
    const projectedTerms=projection?.commercialTerms,projectedIdentity=projectedTerms?{validityDays:projectedTerms.validityDays,terms:projectedTerms.terms,exclusions:projectedTerms.exclusions,reviewedAt:projectedTerms.reviewedAt}:null,reviewedIdentity={validityDays:reviewedTerms.validityDays,terms:reviewedTerms.terms,exclusions:reviewedTerms.exclusions,reviewedAt:reviewedTerms.reviewedAt};
    if(!projectedIdentity||hash(JSON.stringify(projectedIdentity))!==hash(JSON.stringify(reviewedIdentity)))throw issueProblem("Estimate terms changed. Refresh the preview and review the current terms before creating the customer document.",409,"customer_terms_changed");return reviewedTerms;
  }

  async function prepare(input) {
    const estimateId = requiredText(input.estimateId, "Estimate ID"), clientId = requiredText(input.clientId, "Client ID"), requestedRecipient = requiredText(input.recipient, "Recipient"), recipient = delivery.enabled && delivery.customer ? delivery.customer : requestedRecipient, projection = input.projection;
    const aggregate = await db.get(`SELECT e.id,e.client_id,e.estimate_ref,e.revision_no,c.name client_name,c.email FROM estimates e JOIN clients c ON c.id=e.client_id WHERE e.id=? AND e.client_id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL`, estimateId, clientId);
    if (!aggregate) throw Object.assign(new Error("Active Client and Estimate relationship was not found."), { status: 404 });
    const estimateRevision = Number(input.estimateRevision), quotationRevision = Number(input.quotationRevision);
    if (!Number.isInteger(estimateRevision) || estimateRevision !== Number(aggregate.revision_no)) throw Object.assign(new Error("Estimate revision changed; review the current quotation before sending."), { status: 409, code: "estimate_revision_changed" });
    if (!Number.isInteger(quotationRevision) || Number(projection?.commercialRevision) !== quotationRevision || String(projection?.estimateReference) !== String(aggregate.estimate_ref)) throw Object.assign(new Error("Canonical quotation revision/reference does not match the Estimate."), { status: 409, code: "quotation_revision_changed" });
    const revisionRequest = await db.get("SELECT * FROM supplier_revision_requests WHERE successor_estimate_id=? ORDER BY created_at DESC LIMIT 1", estimateId);
    if (revisionRequest) {
      const unresolved = Number((await db.get("SELECT COUNT(*) count FROM revision_change_checks WHERE supplier_revision_request_id=? AND status IN ('not_implemented','needs_review','change_detected')", revisionRequest.id))?.count || 0);
      const missingPosition = Number((await db.get(`SELECT COUNT(*) count FROM portal_review_position_entries e WHERE e.review_submission_id=? AND e.response='amendment_requested' AND NOT EXISTS(SELECT 1 FROM revision_change_checks c WHERE c.supplier_revision_request_id=? AND c.change_kind='requested' AND c.estimate_position_id=e.estimate_position_id)`, revisionRequest.review_submission_id, revisionRequest.id))?.count || 0);
      const general = await db.get('SELECT general_response FROM portal_review_submissions WHERE id=?', revisionRequest.review_submission_id);
      const missingGeneral = general?.general_response === 'amendment_requested' && !await db.get(`SELECT id FROM revision_change_checks WHERE supplier_revision_request_id=? AND change_kind='requested' AND estimate_position_id IS NULL`, revisionRequest.id) ? 1 : 0;
      const missing = missingPosition + missingGeneral;
      if (!revisionRequest.returned_document_id || !revisionRequest.verified_at || unresolved || missing) throw Object.assign(new Error("Resolve every requested and unrelated material supplier-revision change before issuing the successor Estimate."), { status: 409, code: "supplier_revision_verification_required" });
    }
    const subject = customerSubject(requiredText(input.subject || `Estimate ${aggregate.estimate_ref} from Ecofenster`, "Subject")), total = String(projection.totalIncVatGbp), bodyHtml = String(input.bodyHtml || `<p>Dear ${aggregate.client_name},</p><p>Please find attached Estimate <strong>${aggregate.estimate_ref}</strong> for your review.</p><p><strong>Total including VAT: GBP ${Number(total).toFixed(2)}</strong></p><p>Please contact us if you would like to discuss the Estimate.</p><p>Kind regards,<br>Ecofenster</p>`);
    const commercialSnapshot = { subtotalExVatGbp: String(projection.subtotalExVatGbp), vatRatePercent: String(projection.vatRatePercent), vatGbp: String(projection.vatGbp), totalIncVatGbp: total };
    const reviewedTerms=await assertCustomerTerms(estimateId,projection);
    const termsSnapshot=JSON.stringify(reviewedTerms),idempotencyKey = hash(JSON.stringify({ estimateId, estimateRevision, quotationRevision, projection, recipient, termsSnapshot }));
    const existing = await db.get("SELECT * FROM issued_quotations WHERE idempotency_key=?", idempotencyKey); if (existing) return mapIssued(existing);
    const alreadyIssued = await db.get("SELECT id FROM issued_quotations WHERE estimate_id=? AND estimate_revision=? AND status='issued' ORDER BY issued_at DESC LIMIT 1",estimateId,estimateRevision);
    if(alreadyIssued)throw issueProblem("This Estimate revision has already been issued. Open the issued Estimate, or create a new revision before sending changed customer information.",409,"estimate_revision_already_issued",{issuedQuotationId:alreadyIssued.id,estimateId,estimateRevision});
    const issuedQuotationId = stableId("quotation",idempotencyKey), communicationMessageId = stableId("quotation-email",idempotencyKey), timestamp = new Date().toISOString();
    let document;
    try{
      document = await documents.createImmutablePdf({ estimateId, quotationRevision, projection });
      const communication = await communications.repository.save({ id: communicationMessageId, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "drafts", status: "draft", from: [], to: [recipient], cc: [], bcc: [], subject, bodyHtml, bodyText: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), links: [{ kind: "client", id: clientId }, { kind: "estimate", id: estimateId }, { kind: "issued_quotation", id: issuedQuotationId }], attachments: [{ id: stableId("quotation-attachment",idempotencyKey), fileName: document.fileName, mediaType: document.mediaType, sizeBytes: document.sizeBytes, storageKey: document.storageKey, sha256: document.sha256 }] });
      await db.run(`INSERT INTO issued_quotations(id,idempotency_key,client_id,estimate_id,estimate_revision,quotation_revision,document_id,status,recipient,subject,provider,provider_message_id,communication_message_id,prepared_at,issued_at,failed_at,failure_reason,commercial_snapshot_json,terms_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, issuedQuotationId, idempotencyKey, clientId, estimateId, estimateRevision, quotationRevision, document.id, "prepared_not_sent", recipient, subject, null, null, communication.id, timestamp, null, null, null, JSON.stringify(commercialSnapshot), termsSnapshot, timestamp, timestamp);
    }catch(cause){
      const recovered=await db.get("SELECT * FROM issued_quotations WHERE idempotency_key=?",idempotencyKey);if(recovered)return mapIssued(recovered);
      throw issueProblem("QuoteSuite could not finish preparing the customer Email. Any completed PDF or draft has been kept; retry the same action to reuse it safely.",409,"quotation_prepare_partial_success",{issuedQuotationId,communicationMessageId,documentId:document?.id||null,cause:cause instanceof Error?cause.message:String(cause)});
    }
    return get(issuedQuotationId);
  }

  async function finalize(row, communication) {
    const issuedAt = communication.sentAt || new Date().toISOString(), eventId = `quotation-issued-${row.id}`, followUpId = `quotation-followup-${row.id}`;
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run("UPDATE issued_quotations SET status='issued',provider='google_workspace',provider_message_id=?,communication_message_id=?,issued_at=?,failed_at=NULL,failure_reason=NULL,updated_at=? WHERE id=? AND status<>'issued'", communication.providerMessageId, communication.id, issuedAt, issuedAt, row.id);
      await portalSecurity.releaseIssuedEstimate({ issuedQuotationId: row.id, releasedBy: "system" });
      await db.run(`INSERT INTO issued_quotation_lifecycle_events(id,issued_quotation_id,lifecycle_state,reason,related_issued_quotation_id,actor_id,occurred_at,created_at) VALUES(?,?,'issued',NULL,NULL,'system',?,?) ON CONFLICT(issued_quotation_id,lifecycle_state) DO NOTHING`,`quotation-lifecycle-issued-${row.id}`,row.id,issuedAt,issuedAt);
      const lineage=await db.get("SELECT client_id,project_id,COALESCE(NULLIF(base_estimate_ref,''),estimate_ref) base_ref FROM estimates WHERE id=?",row.estimate_id);
      const priorIssued=lineage?await db.all(`SELECT iq.id FROM issued_quotations iq JOIN estimates e ON e.id=iq.estimate_id WHERE iq.status='issued' AND iq.id<>? AND iq.client_id=? AND COALESCE(e.project_id,'')=COALESCE(?, '') AND COALESCE(NULLIF(e.base_estimate_ref,''),e.estimate_ref)=? AND COALESCE((SELECT lifecycle_state FROM issued_quotation_lifecycle_events le WHERE le.issued_quotation_id=iq.id ORDER BY le.occurred_at DESC,le.rowid DESC LIMIT 1),'issued')='issued'`,row.id,lineage.client_id,lineage.project_id,lineage.base_ref):[];
      for(const prior of priorIssued){
        await db.run(`INSERT INTO issued_quotation_lifecycle_events(id,issued_quotation_id,lifecycle_state,reason,related_issued_quotation_id,actor_id,occurred_at,created_at) VALUES(?,?,'superseded','A newer Estimate revision was issued.',?,'system',?,?) ON CONFLICT(issued_quotation_id,lifecycle_state) DO NOTHING`,`quotation-lifecycle-superseded-${prior.id}`,prior.id,row.id,issuedAt,issuedAt);
        await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING`,`quotation-superseded-${prior.id}`,"quotation.superseded",prior.id,issuedAt,JSON.stringify([{kind:"issued_quotation",id:prior.id},{kind:"replacement_issued_quotation",id:row.id}]),issuedAt);
      }
      await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING`, eventId, "quotation.issued", row.id, issuedAt, JSON.stringify([{ kind: "client", id: row.client_id }, { kind: "estimate", id: row.estimate_id }, { kind: "issued_quotation", id: row.id }]), issuedAt);
      await db.run(`INSERT INTO followups(id,client_id,estimate_id,title,notes,due_at,status,issued_quotation_id,communication_message_id,origin_event_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, followUpId, row.client_id, row.estimate_id, `Follow up: ${row.subject}`, "Call / email customer regarding issued quotation", plusDays(issuedAt, 3), "pending", row.id, communication.id, eventId, issuedAt, issuedAt);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return get(row.id);
  }

  async function send(id, overrides = {}) {
    const row = await db.get("SELECT * FROM issued_quotations WHERE id=?", id); if (!row) throw Object.assign(new Error("Issued quotation preparation was not found."), { status: 404 });
    if (row.status === "issued") return mapIssued(row);
    const currentTerms=await customerTerms(row.estimate_id),preparedTerms=parse(row.terms_snapshot,null);if(!currentTerms.reviewed||!preparedTerms||hash(JSON.stringify({validityDays:currentTerms.validityDays,terms:currentTerms.terms,exclusions:currentTerms.exclusions,reviewedAt:currentTerms.reviewedAt}))!==hash(JSON.stringify({validityDays:preparedTerms.validityDays,terms:preparedTerms.terms,exclusions:preparedTerms.exclusions,reviewedAt:preparedTerms.reviewedAt})))throw issueProblem("Estimate terms changed after this Email was prepared. Nothing was sent. Close this draft and prepare the current Estimate again.",409,"customer_terms_changed",{estimateId:row.estimate_id,issuedQuotationId:row.id});
    const conflictingIssue=await db.get("SELECT id FROM issued_quotations WHERE estimate_id=? AND estimate_revision=? AND status='issued' AND id<>? ORDER BY issued_at DESC LIMIT 1",row.estimate_id,row.estimate_revision,row.id);
    if(conflictingIssue)throw issueProblem("This Estimate revision was already issued from another reviewed preparation. Nothing was sent. Open the issued Estimate, or create a new revision for changes.",409,"estimate_revision_already_issued",{issuedQuotationId:conflictingIssue.id,estimateId:row.estimate_id,estimateRevision:row.estimate_revision});
    const existingCommunication = await communications.repository.get(row.communication_message_id);
    if (existingCommunication?.status === "sent" && existingCommunication.providerMessageId) return finalize(row, existingCommunication);
    const document = await documents.get(row.document_id), requestedRecipient = requiredText(overrides.recipient ?? row.recipient, "Recipient"), recipient = delivery.enabled ? delivery.assertRecipient(requestedRecipient, "customer") : requestedRecipient, subject = customerSubject(requiredText(overrides.subject ?? row.subject, "Subject")), bodyHtml = requiredText(overrides.bodyHtml ?? existingCommunication?.bodyHtml, "Email body");
    try {
      const communication = await communications.sendMessage({ ...existingCommunication, id: row.communication_message_id, to: [recipient], subject, bodyHtml, bodyText: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), folder: "sent", links: existingCommunication.links, attachments: [{ ...(existingCommunication.attachments?.[0] || {}), fileName: document.fileName, mediaType: document.mediaType, sizeBytes: document.sizeBytes, storageKey: document.storageKey, sha256: document.sha256 }] });
      await db.run("UPDATE issued_quotations SET recipient=?,subject=?,updated_at=? WHERE id=?", recipient, subject, new Date().toISOString(), id);
      return finalize({ ...row, recipient, subject }, communication);
    } catch (error) {
      const failedAt = new Date().toISOString(), reason = error instanceof Error ? error.message : "Provider send failed.";
      await db.run("UPDATE issued_quotations SET status='failed',provider='google_workspace',failed_at=?,failure_reason=?,updated_at=? WHERE id=? AND status<>'issued'", failedAt, reason, failedAt, id);
      throw Object.assign(new Error(reason), { status: Number(error?.status) || 502, issuedQuotationId: id });
    }
  }

  async function withdraw(id,input={}){
    const actor=requiredText(input.actorId,"Staff identity"),reason=requiredText(input.reason,"Withdrawal reason");
    if(reason.length>500)throw issueProblem("Keep the withdrawal reason under 500 characters.",400,"quotation_withdrawal_reason_invalid");
    const row=await db.get("SELECT * FROM issued_quotations WHERE id=?",requiredText(id,"Issued quotation ID"));
    if(!row)throw issueProblem("Issued Estimate was not found.",404,"issued_quotation_not_found");
    if(row.status!=="issued")throw issueProblem("Only a provider-confirmed issued Estimate can be withdrawn.",409,"quotation_not_issued");
    const current=await db.get("SELECT lifecycle_state FROM issued_quotation_lifecycle_events WHERE issued_quotation_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",id);
    if(current?.lifecycle_state==="withdrawn")return mapIssued(row);
    if(current?.lifecycle_state==="superseded")throw issueProblem("This Estimate was already superseded by a newer issued revision. Keep it as history; no withdrawal is needed.",409,"quotation_already_superseded");
    const accepted=await db.get(`SELECT a.id FROM estimate_revision_releases r JOIN portal_estimate_acceptances a ON a.estimate_release_id=r.id WHERE r.issued_quotation_id=? LIMIT 1`,id).catch(()=>null);
    if(accepted)throw issueProblem("This Estimate has already been accepted. Continue from its Order or use the governed change workflow; it cannot be withdrawn.",409,"quotation_already_accepted");
    const at=new Date().toISOString();
    await db.exec("BEGIN IMMEDIATE");
    try{
      await db.run(`INSERT INTO issued_quotation_lifecycle_events(id,issued_quotation_id,lifecycle_state,reason,related_issued_quotation_id,actor_id,occurred_at,created_at) VALUES(?,?,'withdrawn',?,NULL,?,?,?) ON CONFLICT(issued_quotation_id,lifecycle_state) DO NOTHING`,`quotation-lifecycle-withdrawn-${id}`,id,reason,actor,at,at);
      await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING`,`quotation-withdrawn-${id}`,"quotation.withdrawn",id,at,JSON.stringify([{kind:"client",id:row.client_id},{kind:"estimate",id:row.estimate_id},{kind:"issued_quotation",id}]),at);
      await db.exec("COMMIT");
    }catch(error){await db.exec("ROLLBACK").catch(()=>{});throw error}
    return get(id);
  }

  async function estimateState(estimateId) {
    const issue = await db.get("SELECT * FROM issued_quotations WHERE estimate_id=? ORDER BY created_at DESC LIMIT 1", estimateId);
    const followUp = issue ? await db.get("SELECT * FROM followups WHERE issued_quotation_id=? ORDER BY created_at DESC LIMIT 1", issue.id) : null;
    const productCount = (await db.get(`SELECT COUNT(*) count FROM project_calculator_lab_scenarios s JOIN project_calculator_estimate_product_rows p ON p.scenario_id=s.id WHERE s.estimate_id=?`, estimateId))?.count ?? 0;
    const lifecycle=issue?await db.get("SELECT lifecycle_state FROM issued_quotation_lifecycle_events WHERE issued_quotation_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",issue.id):null;
    return { estimateId, manufacturerQuoteImported: productCount > 0, costingReady: productCount > 0, quotationReviewed: Boolean(issue), quotationPrepared: issue?.status === "prepared_not_sent" || issue?.status === "failed", quotationStatus: issue?.status ?? null, quotationLifecycleStatus:lifecycle?.lifecycle_state||(issue?.status==="issued"?"issued":null), quotationIssued: issue?.status === "issued", issuedQuotationId: issue?.id ?? null, followUpDue: followUp?.status !== "done" && Boolean(followUp?.due_at), followUpDueDate: followUp?.due_at ?? null, followUpCompleted: followUp?.status === "done", followUpId: followUp?.id ?? null, customerAccepted: false, orderCreated: false };
  }
  return { prepare, get, send, withdraw, estimateState, customerTerms, saveCustomerTerms, assertCustomerTerms, documents, communications };
}
