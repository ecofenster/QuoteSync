const parse=value=>{try{return JSON.parse(value||'[]')}catch{return []}};
const fail=message=>Object.assign(new Error(message),{status:409,code:'factory_attachment_review_required'});

export async function factoryAttachmentOptions(db, order, selectedIds = null) {
  const account=await db.get("SELECT account_id FROM integration_oauth_connections WHERE provider='google_workspace' AND status='connected'").catch(()=>null);
  if(!account)return [];
  const selection=selectedIds?.length?` AND id IN (${selectedIds.map(()=>'?').join(',')})`:'';
  const rows=await db.all(`SELECT * FROM canonical_documents WHERE client_id=? AND project_id=? AND provider='google_drive' AND provider_account_id=? AND removed_at IS NULL AND trashed=0${selection} ORDER BY file_name,id LIMIT 101`,order.client_id,order.project_id,account.account_id,...(selectedIds||[]));
  return rows.filter(row=>/^[a-f0-9]{32}([a-f0-9]{32})?$/i.test(row.checksum||'')&&!String(row.mime_type).startsWith('application/vnd.google-apps.')&&!/customer_quotation|customer_order|internal/i.test(row.document_type)).slice(0,100).map(row=>({id:row.id,fileName:row.file_name,mediaType:row.mime_type,sizeBytes:Number(row.size_bytes),providerFileId:row.provider_file_id,providerAccountId:row.provider_account_id,revision:row.provider_revision||row.provider_version||null,checksum:row.checksum,openUrl:`https://drive.google.com/file/d/${encodeURIComponent(row.provider_file_id)}/view`}));
}

export async function savedFactoryAttachments(db,communicationId) {
  const row=await db.get('SELECT files_json FROM factory_attachment_reviews WHERE communication_message_id=?',communicationId);
  return parse(row?.files_json);
}

export async function reviewFactoryAttachments(db,order,input,previous) {
  if(!Array.isArray(input.additionalDocumentIds))return previous;
  const ids=[...new Set(input.additionalDocumentIds.map(String))].sort();
  if(ids.length>20)throw fail('Select no more than 20 supporting files for one factory request.');
  const available=ids.length?await factoryAttachmentOptions(db,order,ids):[],files=ids.map(id=>available.find(file=>file.id===id));
  if(files.some(file=>!file))throw fail('A selected file is unavailable, belongs to another account or has no confirmed content identity. Review current Project Files before continuing.');
  if(JSON.stringify(files)!==JSON.stringify(previous)&&input.documentsReviewed!==true)throw fail('Open and review the selected files, then confirm that they are current and appropriate for this factory.');
  return files;
}

export async function assertFactoryAttachmentsCurrent(db,order,files) {
  if(!files.length)return;
  const available=await factoryAttachmentOptions(db,order,files.map(file=>file.id));
  for(const file of files){const current=available.find(item=>item.id===file.id);if(!current||current.providerFileId!==file.providerFileId||current.providerAccountId!==file.providerAccountId||current.checksum!==file.checksum)throw fail(`“${file.fileName}” has changed or is no longer available in this Project/account. Reopen and review the file selection before sending.`)}
}

export const factoryCommunicationAttachments=files=>files.map(file=>({fileName:file.fileName,mediaType:file.mediaType,sizeBytes:file.sizeBytes,driveFileId:file.providerFileId,sha256:file.checksum}));
