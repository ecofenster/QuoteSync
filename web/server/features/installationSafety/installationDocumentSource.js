const fail=(message,status=409)=>Object.assign(new Error(message),{status,code:'installation_document_source_review'});
const parse=value=>{try{return JSON.parse(value)}catch{throw fail('The retained schedule could not be read. Reopen the selected revision for review.')}};

// Read-only source selection. An Order uses its exact acceptance/release, never today's Estimate JSON.
export async function loadInstallationDocumentRevision(db,{estimateId,revision,orderId=null}){
  if(!estimateId||!Number.isInteger(revision)||revision<0)throw fail('Select an Estimate and its exact revision.');
  const estimate=await db.get(`SELECT e.*,c.name client_name,p.name project_name FROM estimates e JOIN clients c ON c.id=e.client_id LEFT JOIN projects p ON p.id=e.project_id WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL`,estimateId);
  if(!estimate)throw fail('The selected Estimate is unavailable.',404);
  let release,order,acceptedIds;
  if(orderId){
    order=await db.get(`SELECT o.*,a.id acceptance_id,a.overall_accepted,r.id release_id,r.client_id release_client_id,r.project_id release_project_id,r.estimate_id accepted_estimate_id,r.estimate_revision,r.customer_projection_json FROM orders o JOIN portal_estimate_acceptances a ON a.order_id=o.id JOIN estimate_revision_releases r ON r.id=a.estimate_release_id WHERE o.id=?`,orderId);
    if(!order||order.accepted_estimate_id!==estimateId||Number(order.estimate_revision)!==revision||order.client_id!==estimate.client_id||order.project_id!==estimate.project_id)throw fail('The Order does not belong to this accepted Client, Project and Estimate revision.');
    if(!order.overall_accepted||order.source_estimate_id!==estimateId||Number(order.source_estimate_revision)!==revision||order.release_client_id!==order.client_id||order.release_project_id!==order.project_id)throw fail('The retained Order acceptance and release disagree. Review their source relationships.');
    release={id:order.release_id,client_id:order.release_client_id,project_id:order.release_project_id,customer_projection_json:order.customer_projection_json};
    acceptedIds=new Set((await db.all('SELECT estimate_position_id FROM portal_position_acceptances WHERE estimate_acceptance_id=? AND accepted=1',order.acceptance_id)).map(item=>item.estimate_position_id));
  }else{
    const releases=await db.all('SELECT id,client_id,project_id,customer_projection_json FROM estimate_revision_releases WHERE estimate_id=? AND estimate_revision=?',estimateId,revision);
    if(releases.length>1)throw fail('More than one release matches this revision. Review the retained release before preparing documents.');
    release=releases[0];
  }
  if(release&&(release.client_id!==estimate.client_id||release.project_id!==estimate.project_id))throw fail('The released revision has a different Client or Project relationship. Review its retained context.');
  if(!release&&await db.get("SELECT id FROM issued_quotations WHERE estimate_id=? AND estimate_revision=? AND status='issued' LIMIT 1",estimateId,revision))throw fail('This issued revision has no matching retained release projection. Review its issued document; the current editable schedule cannot replace it.');
  if(!release&&Number(estimate.revision_no)!==revision)throw fail('The Estimate revision has changed. Reopen the intended revision before preparing documents.');
  const projection=release?parse(release.customer_projection_json):null;
  let positions=release?projection?.positions:parse(estimate.positions_json);
  if(!Array.isArray(positions))throw fail('The selected revision has no readable schedule.');
  // Working canonical Positions use qty; released customer projections use quantity.
  // An explicitly missing quantity stays missing rather than borrowing another field.
  positions=positions.map(item=>Object.hasOwn(item,'quantity')||!Object.hasOwn(item,'qty')?item:{...item,quantity:item.qty});
  if(acceptedIds){positions=positions.filter(item=>acceptedIds.has(item.id));if(!acceptedIds.size||positions.length!==acceptedIds.size)throw fail('Every accepted Order Position must be present in its retained schedule.');}
  const ids=positions.map(item=>item.id);if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw fail('The retained schedule has missing or repeated Position identities.');
  return {estimateId,estimateReference:projection?.estimateReference||estimate.estimate_ref,revision,orderId:order?.id||null,orderReference:order?.order_ref||null,clientId:estimate.client_id,projectId:estimate.project_id||null,clientName:release?projection.clientName:estimate.client_name,projectName:release?projection.projectName:estimate.project_name,siteAddress:release?(typeof projection.siteAddress==='string'?projection.siteAddress:''):estimate.project_address,positions,sourceReleaseId:release?.id||null,sourceUpdatedAt:release?null:estimate.updated_at};
}
