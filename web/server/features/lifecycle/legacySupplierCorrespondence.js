export async function readLegacySupplierCorrespondence(db,requestId,offset=0,messageId=null){
  const start=Number(offset);
  if(!Number.isSafeInteger(start)||start<0)throw Object.assign(new Error('Choose a valid earlier-message page.'),{status:422});
  const request=await db.get('SELECT id,communication_message_id FROM supplier_revision_requests WHERE id=?',requestId);
  if(!request)throw Object.assign(new Error('Supplier revision request was not found.'),{status:404});
  const where=`FROM communication_messages m WHERE NOT EXISTS(SELECT 1 FROM supplier_enquiry_drafts se WHERE se.communication_message_id=m.id)
    AND (m.id=? OR EXISTS(SELECT 1 FROM workflow_events ev WHERE ev.event_name IN ('supplier.revision.correspondence_reviewed','supplier.revision.correspondence_sent')
      AND EXISTS(SELECT 1 FROM json_each(ev.links_json) link WHERE json_extract(link.value,'$.kind')='supplier_revision_request' AND json_extract(link.value,'$.id')=?)
      AND EXISTS(SELECT 1 FROM json_each(ev.links_json) link WHERE json_extract(link.value,'$.kind')='communication' AND json_extract(link.value,'$.id')=m.id)))${messageId?' AND m.id=?':''}`;
  const params=[request.communication_message_id,request.id,...(messageId?[messageId]:[])],total=Number((await db.get(`SELECT COUNT(*) total ${where}`,...params)).total);
  const rows=await db.all(`SELECT m.id,m.status,m.subject,m.body_text,m.to_json,m.created_at,m.sent_at ${where} ORDER BY m.created_at DESC,m.id LIMIT 20 OFFSET ?`,...params,start);
  const items=await Promise.all(rows.map(async row=>({id:row.id,status:row.status,subject:row.subject,bodyText:row.body_text,recipients:JSON.parse(row.to_json||'[]'),createdAt:row.created_at,sentAt:row.sent_at,attachments:(await db.all('SELECT id,file_name fileName,sha256,storage_key,drive_file_id FROM communication_attachments WHERE communication_message_id=? ORDER BY file_name',row.id)).map(file=>({id:file.id,fileName:file.fileName,downloadUrl:/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(file.sha256||'')&&(file.storage_key||file.drive_file_id)?`/api/lifecycle/supplier-revisions/${encodeURIComponent(requestId)}/earlier-correspondence/${encodeURIComponent(row.id)}/attachments/${encodeURIComponent(file.id)}`:null}))})));
  return {items,total,offset:start};
}
