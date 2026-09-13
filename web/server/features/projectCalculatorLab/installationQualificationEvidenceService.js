import {createHash,randomUUID} from "node:crypto";
import {createGoogleWorkspaceService} from "../integrations/googleWorkspaceService.js";
import {createGoogleDriveProvider} from "../documents/googleDriveProvider.js";
import {safeUploadFileName} from "../documents/documentUploadService.js";
import {migrateWorkforceDocumentOwnership} from '../commercialIdentity/workforceDocumentMigration.js';

const fail=(message,status=422,code="qualification_evidence_invalid")=>Object.assign(new Error(message),{status,code});
export function createInstallationQualificationEvidenceService(db,{workspace,provider,id=randomUUID,clock=()=>new Date()}={}){
  const connection=workspace||createGoogleWorkspaceService(db),drive=provider||createGoogleDriveProvider(connection);
  return{async upload(qualificationId,file){
    const qualification=await db.get("SELECT q.*,i.name installer_name FROM installation_installer_qualifications q JOIN installation_installers i ON i.id=q.installer_id WHERE q.id=?",qualificationId);if(!qualification)throw fail("Qualification record not found.",404,"qualification_not_found");
    if(!file?.buffer?.length)throw fail("Choose a non-empty certificate or card file.",400,"qualification_evidence_required");if(file.size>20*1024*1024)throw fail("Qualification evidence must be 20 MB or smaller.",413,"qualification_evidence_too_large");
    const fileName=safeUploadFileName(file.originalname),status=await connection.status(),config=await db.get("SELECT workforce_root_folder_id FROM integration_provider_config WHERE provider='google_workspace'");
    if(!status.connected||!status.capabilities?.drive?.available)throw fail("Google Drive is unavailable. Reconnect it in Administration → Integrations; your installer entries are retained.",409,"qualification_provider_unavailable");
    if(!config?.workforce_root_folder_id)throw fail("Configure the Workforce evidence folder in Administration → Integrations before uploading.",409,"qualification_folder_required");
    await migrateWorkforceDocumentOwnership(db);
    const sourceHash=createHash('sha256').update(file.buffer).digest('hex'),attemptId=id(),accountId=status.account?.id||'',folderId=config.workforce_root_folder_id;
    const inserted=await db.run('INSERT OR IGNORE INTO installation_qualification_uploads(id,qualification_id,provider_account_id,provider_folder_id,file_name,source_sha256,created_at) VALUES(?,?,?,?,?,?,?)',attemptId,qualification.id,accountId,folderId,fileName,sourceHash,clock().toISOString());
    const attempt=await db.get('SELECT * FROM installation_qualification_uploads WHERE qualification_id=? AND provider_account_id=? AND provider_folder_id=? AND file_name=? AND source_sha256=?',qualification.id,accountId,folderId,fileName,sourceHash);
    let uploaded;
    if(!inserted.changes){
      if(!attempt.provider_receipt_json)throw fail('The earlier upload outcome is not confirmed. Do not upload another copy. Review the Workforce evidence folder and ask staff to reconcile the saved upload attempt.',409,'qualification_upload_uncertain');
      const receipt=JSON.parse(attempt.provider_receipt_json);uploaded=await drive.getItem({fileId:receipt.id});
      if(uploaded.trashed||!uploaded.parents?.includes(folderId)||uploaded.md5Checksum!==createHash('md5').update(file.buffer).digest('hex'))throw fail('The previously uploaded evidence has changed or is unavailable. Review its retained file before continuing.',409,'qualification_upload_changed');
      if(attempt.canonical_document_id)return{documentId:attempt.canonical_document_id,fileName:uploaded.name,openUrl:uploaded.webViewLink||null,providerFileId:uploaded.id,verificationStatus:qualification.verification_status,message:'The existing confirmed evidence was reused. No additional copy was uploaded.'};
    }else{
      try{uploaded=await drive.uploadFile({parentId:folderId,fileName,mediaType:file.mimetype||"application/octet-stream",bytes:file.buffer,appProperties:{quotesuiteInstallerId:qualification.installer_id,quotesuiteQualificationId:qualification.id,quotesuiteQualificationType:qualification.qualification_type_code,quotesuiteUploadId:attempt.id}});
        if(!uploaded?.id)throw new Error('Provider identity was not confirmed');
        await db.run('UPDATE installation_qualification_uploads SET provider_receipt_json=? WHERE id=?',JSON.stringify(uploaded),attempt.id);
      }catch{throw fail('The upload outcome is not confirmed. Do not upload another copy. Review the Workforce evidence folder and ask staff to reconcile the saved upload attempt.',409,'qualification_upload_uncertain')}
    }
    const at=clock().toISOString(),documentId=id(),checksum=uploaded.md5Checksum||createHash("sha256").update(file.buffer).digest("hex");
    await db.exec("BEGIN IMMEDIATE");try{
      await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,installer_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,discovered_at,last_seen_at,updated_at)
        VALUES(?,?,?,?,?,?,'workforce_qualification',?,?,?,?,?,?,?,?,?,'Workforce Qualifications',0,?,?,?)`,documentId,"google_drive",status.account?.id||"",uploaded.id,config.workforce_root_folder_id,qualification.installer_id,uploaded.name||fileName,uploaded.mimeType||file.mimetype||"application/octet-stream",Number(uploaded.size||file.size),uploaded.createdTime||at,uploaded.modifiedTime||at,uploaded.version?String(uploaded.version):null,uploaded.version?String(uploaded.version):null,checksum,uploaded.webViewLink||null,at,at,at);
      await db.run("UPDATE installation_qualification_evidence_history SET is_current=0,replaced_at=? WHERE qualification_id=? AND is_current=1",at,qualification.id);
      await db.run("INSERT INTO installation_qualification_evidence_history(id,qualification_id,canonical_document_id,file_name,provider,provider_file_id,is_current,recorded_at) VALUES(?,?,?,?,?,?,1,?)",id(),qualification.id,documentId,uploaded.name||fileName,"google_drive",uploaded.id,at);
      await db.run("UPDATE installation_installer_qualifications SET evidence_document_id=?,evidence_file_name=?,verification_status='recorded_unverified',verified_by=NULL,verified_at=NULL,updated_at=? WHERE id=?",documentId,uploaded.name||fileName,at,qualification.id);
      await db.run('UPDATE installation_qualification_uploads SET canonical_document_id=? WHERE id=?',documentId,attempt.id);
      await db.exec("COMMIT");
    }catch(error){await db.exec("ROLLBACK").catch(()=>{});throw Object.assign(fail(`Drive saved ${uploaded.name||fileName}, but linking the evidence is incomplete. Retry to reuse the confirmed file; no new upload is required.`,409,'qualification_upload_partial'),{cause:error})}
    return{documentId,fileName:uploaded.name||fileName,openUrl:uploaded.webViewLink||null,providerFileId:uploaded.id,verificationStatus:"recorded_unverified",message:`${uploaded.name||fileName} uploaded. Evidence is recorded but remains unverified until reviewed.`};
  }};
}
