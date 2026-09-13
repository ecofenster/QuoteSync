const fail=(message,status=400)=>Object.assign(new Error(message),{status});

// Read-only canonical directory. Legacy Estimate outcomes are not Order identities.
export async function readOrderDirectory(db,{search='',offset=0}={}){
  if(typeof search!=='string'||search.length>200)throw fail('Use a search of up to 200 characters.');
  offset=Number(offset);if(!Number.isSafeInteger(offset)||offset<0)throw fail('Choose a valid Order page.');
  const term=`%${search.trim().replace(/[\\%_]/g,'\\$&')}%`;
  const where=`FROM orders o JOIN clients c ON c.id=o.client_id JOIN projects p ON p.id=o.project_id AND p.client_id=o.client_id
    WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM portal_estimate_acceptances a WHERE a.order_id=o.id AND a.overall_accepted=1)
    AND (o.order_ref LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR c.client_ref LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')`;
  const args=[term,term,term,term];
  const count=await db.get(`SELECT COUNT(*) total ${where}`,...args);
  const items=await db.all(`SELECT o.id,o.order_ref reference,o.client_id clientId,c.name clientName,c.client_ref clientReference,p.name projectName,o.source_estimate_id estimateId,o.source_estimate_revision revision,o.status,o.created_at createdAt ${where} ORDER BY o.created_at DESC,o.id DESC LIMIT 20 OFFSET ?`,...args,offset);
  return {items,total:count.total,offset,limit:20};
}
