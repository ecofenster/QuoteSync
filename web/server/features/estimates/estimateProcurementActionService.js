import { createHash, randomUUID } from "node:crypto";

const hash=(value)=>createHash("sha256").update(String(value)).digest("hex");
const error=(status,code,message,details={})=>Object.assign(new Error(message),{status,code,details});

export function createEstimateProcurementActionService(db,{clock=()=>Date.now()}={}){
  const now=()=>new Date(clock()).toISOString();
  async function context(estimateId){
    const estimate=await db.get("SELECT id,client_id,project_id,estimate_ref,status,outcome,deleted_at FROM estimates WHERE id=?",estimateId);
    if(!estimate||estimate.deleted_at)throw error(404,"estimate_not_found","Estimate was not found.");
    const supplier=await db.get(`SELECT q.id supplier_quote_id,q.supplier_name,r.id supplier_revision_id,r.supplier_quotation_number,r.supplier_revision
      FROM supplier_quotes q JOIN supplier_quote_revisions r ON r.supplier_quote_id=q.id AND r.estimate_id=q.estimate_id
      WHERE q.estimate_id=? AND q.archived_at IS NULL AND r.lifecycle_status<>'archived'
      AND EXISTS(SELECT 1 FROM supplier_quote_attachments a WHERE a.estimate_id=q.estimate_id AND a.revision_id=r.id)
      ORDER BY r.revision_sequence DESC LIMIT 1`,estimateId);
    const release=await db.get("SELECT id FROM estimate_revision_releases WHERE estimate_id=? ORDER BY released_at DESC LIMIT 1",estimateId);
    const intent=release?await db.get("SELECT id,decided_at FROM portal_estimate_decisions WHERE estimate_release_id=? AND decision_type='intent_to_proceed' ORDER BY decided_at DESC LIMIT 1",release.id):null;
    const review=release?await db.get("SELECT id,status,submitted_at FROM portal_review_submissions WHERE estimate_release_id=? ORDER BY submitted_at DESC LIMIT 1",release.id):null;
    return {estimate,supplier:supplier||null,release:release||null,intent:intent||null,review:review||null};
  }
  async function availability(estimateId){
    const value=await context(estimateId),requestReasons=[],factoryReasons=[];
    if(!value.supplier)requestReasons.push("A retained supplier/manufacturer quotation revision is required.");
    if(value.estimate.outcome==="Lost")requestReasons.push("A Lost Estimate cannot request a supplier revision without first returning to an active workflow.");
    if(!value.intent)factoryReasons.push("Customer intent to proceed has not been recorded.");
    factoryReasons.push("Position-level customer acceptance and signature evidence are not yet complete.");
    factoryReasons.push("Internal order approval has not been recorded.");
    return {estimateId:value.estimate.id,estimateRef:value.estimate.estimate_ref,requestSupplierRevision:{available:requestReasons.length===0,reasons:requestReasons,supplier:value.supplier,customerReviewAvailable:Boolean(value.review)},raiseOrderToFactory:{available:factoryReasons.length===0,reasons:factoryReasons,customerIntentRecorded:Boolean(value.intent),positionAcceptanceComplete:false,signedAcceptanceComplete:false,internalApprovalComplete:false}};
  }
  async function requestSupplierRevision(estimateId,input,actorId){
    const state=await availability(estimateId);if(!state.requestSupplierRevision.available)throw error(409,"supplier_revision_request_blocked","Request Supplier Revision is not available.",{reasons:state.requestSupplierRevision.reasons});
    const key=String(input.idempotencyKey||"").trim();if(!key)throw error(400,"idempotency_key_required","Idempotency key is required.");
    const existing=await db.get("SELECT * FROM estimate_procurement_actions WHERE estimate_id=? AND action_type='request_supplier_revision' AND idempotency_key_hash=?",estimateId,hash(key));if(existing)return {...existing,idempotentReplay:true};
    const id=randomUUID(),createdAt=now(),supplier=state.requestSupplierRevision.supplier,request={affectedPositionIds:Array.isArray(input.affectedPositionIds)?input.affectedPositionIds.map(String):[],requestedChanges:String(input.requestedChanges||""),supportingDocumentIds:Array.isArray(input.supportingDocumentIds)?input.supportingDocumentIds.map(String):[],customerCommentsIncluded:false,requiresStaffReview:true,dispatchCreated:false};
    await db.exec("BEGIN IMMEDIATE");try{await db.run(`INSERT INTO estimate_procurement_actions(id,estimate_id,project_id,action_type,status,supplier_quote_id,supplier_revision_id,idempotency_key_hash,request_json,gate_snapshot_json,created_by,created_at)
      SELECT ?,id,project_id,'request_supplier_revision','draft_staff_review',?,?,?,?,?,?,? FROM estimates WHERE id=?`,id,supplier.supplier_quote_id,supplier.supplier_revision_id,hash(key),JSON.stringify(request),JSON.stringify(state.requestSupplierRevision),actorId,createdAt,estimateId);await db.run("INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_name,evidence_id) DO NOTHING",randomUUID(),"estimate.supplier_revision_request_prepared",id,createdAt,JSON.stringify([{kind:"estimate",id:estimateId},{kind:"supplier_quote",id:supplier.supplier_quote_id},{kind:"supplier_revision",id:supplier.supplier_revision_id}]),createdAt);await db.exec("COMMIT");}catch(reason){await db.exec("ROLLBACK").catch(()=>{});throw reason}return {id,estimateId,actionType:"request_supplier_revision",status:"draft_staff_review",supplier,request,createdBy:actorId,createdAt,idempotentReplay:false};
  }
  async function raiseOrderToFactory(estimateId){const state=await availability(estimateId);if(!state.raiseOrderToFactory.available)throw error(409,"factory_order_gate_incomplete","Raise Order to Factory is blocked until governed customer acceptance and internal approval are complete.",{reasons:state.raiseOrderToFactory.reasons,gates:state.raiseOrderToFactory});throw error(501,"factory_order_dispatch_not_implemented","Factory order dispatch is not implemented.");}
  return {availability,requestSupplierRevision,raiseOrderToFactory};
}
