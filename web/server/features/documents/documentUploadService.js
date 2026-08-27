import { randomUUID } from "node:crypto";
import { createDocumentRecordsService } from "./documentRecordsService.js";
import { createGoogleDriveProvider } from "./googleDriveProvider.js";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";

export const MAX_DOCUMENT_UPLOAD_BYTES = 50 * 1024 * 1024;

export function safeUploadFileName(value) {
  const name = String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_").trim();
  if (!name || name === "." || name === ".." || name.length > 180) throw Object.assign(new Error("Choose a file with a valid name of 180 characters or fewer."), { status:400, code:"invalid_upload_filename" });
  return name;
}
const safeMediaType = (value) => /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(String(value || "")) ? String(value) : "application/octet-stream";

function normalizedScope(input = {}) {
  if (input.estimateId) return { estimateId:String(input.estimateId) };
  if (input.projectId) return { projectId:String(input.projectId) };
  if (input.clientId) return { clientId:String(input.clientId) };
  if (input.enquiryId) return { enquiryId:String(input.enquiryId) };
  throw Object.assign(new Error("An Enquiry, Client, Project or Estimate scope is required."), { status:400, code:"document_scope_required" });
}

export function createDocumentUploadService(db, options = {}) {
  const workspace = options.workspace || createGoogleWorkspaceService(db, options),records = createDocumentRecordsService(db,{workspace}),drive = options.provider || createGoogleDriveProvider(workspace);
  async function relationshipScope(scope) {
    if (scope.estimateId) { const row=await db.get("SELECT e.id estimate_id,e.client_id,e.project_id FROM estimates e WHERE e.id=? AND e.deleted_at IS NULL", scope.estimateId); if(!row) return null; return {clientId:row.client_id,projectId:row.project_id,estimateId:row.estimate_id,enquiryId:null}; }
    if (scope.projectId) { const row=await db.get("SELECT id project_id,client_id,source_enquiry_id enquiry_id FROM projects WHERE id=? AND deleted_at IS NULL", scope.projectId); if(!row) return null; return {clientId:row.client_id,projectId:row.project_id,estimateId:null,enquiryId:row.enquiry_id}; }
    if (scope.clientId) { const row=await db.get("SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", scope.clientId); return row?{clientId:row.id,projectId:null,estimateId:null,enquiryId:null}:null; }
    const row=await db.get("SELECT id FROM enquiries WHERE id=? AND deleted_at IS NULL", scope.enquiryId);return row?{enquiryId:row.id,clientId:null,projectId:null,estimateId:null}:null;
  }
  async function upload(input) {
    const scope = normalizedScope(input), file = input.file;
    if (!file?.buffer?.length) throw Object.assign(new Error("Choose a non-empty file to upload."), { status:400, code:"upload_file_required" });
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) throw Object.assign(new Error("The file exceeds QuoteSuite's 50 MB upload limit."), { status:413, code:"upload_too_large" });
    const fileName = safeUploadFileName(file.originalname), current = await records.list(scope);
    const folder = current.folders.find((item) => item.provider === String(input.provider) && item.providerAccountId === String(input.providerAccountId) && item.providerFolderId === String(input.providerFolderId));
    if (!folder) throw Object.assign(new Error("The selected provider folder is not available in this Files workspace."), { status:404, code:"upload_folder_not_found" });
    if (!folder.capabilities?.upload) throw Object.assign(new Error("This provider folder is read-only or its upload capability is unavailable."), { status:409, code:"provider_upload_unavailable" });
    const status = await workspace.status();
    if (!status.connected || !status.capabilities.drive.available || status.account?.id !== folder.providerAccountId) throw Object.assign(new Error("Google Drive upload is unavailable for the selected provider account."), { status:409, code:"provider_upload_unavailable" });
    const relationships = await relationshipScope(scope);
    if (!relationships) throw Object.assign(new Error("The canonical Files relationship is unavailable."), { status:404, code:"document_relationship_not_found" });
    const duplicateName = current.documents.some((item) => item.provider === folder.provider && item.providerAccountId === folder.providerAccountId && item.providerFolderId === folder.providerFolderId && !item.removedAt && item.fileName.localeCompare(fileName, undefined, { sensitivity:"base" }) === 0),mediaType=safeMediaType(file.mimetype);
    const appProperties=Object.fromEntries(Object.entries({ quotesuiteEnquiryId:relationships.enquiryId, quotesuiteClientId:relationships.clientId, quotesuiteProjectId:relationships.projectId, quotesuiteEstimateId:relationships.estimateId }).filter(([,value])=>Boolean(value)));
    const uploaded = await drive.uploadFile({ parentId:folder.providerFolderId, fileName, mediaType, bytes:file.buffer, appProperties });
    if (!uploaded?.id) throw Object.assign(new Error("Google Drive did not confirm the uploaded file identity."), { status:502, code:"provider_upload_identity_missing" });
    const timestamp = new Date().toISOString(), id = randomUUID();
    await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,enquiry_id=COALESCE(excluded.enquiry_id,canonical_documents.enquiry_id),client_id=COALESCE(excluded.client_id,canonical_documents.client_id),project_id=COALESCE(excluded.project_id,canonical_documents.project_id),estimate_id=COALESCE(excluded.estimate_id,canonical_documents.estimate_id),file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=0,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`, id,"google_drive",folder.providerAccountId,uploaded.id,folder.providerFolderId,relationships.enquiryId,relationships.clientId,relationships.projectId,relationships.estimateId,null,null,null,"uploaded_file",uploaded.name || fileName,uploaded.mimeType || mediaType,Number(uploaded.size || file.size),uploaded.createdTime || timestamp,uploaded.modifiedTime || timestamp,uploaded.version ? String(uploaded.version) : null,uploaded.version ? String(uploaded.version) : null,uploaded.md5Checksum || null,uploaded.webViewLink || null,folder.folderPath || folder.name,uploaded.trashed ? 1 : 0,null,timestamp,timestamp,timestamp);
    const refreshed = await records.list(scope);
    return { duplicateName, duplicatePolicy:"provider_creates_separate_file", binaryStoredByQuoteSuite:false, document:refreshed.documents.find((item) => item.providerFileId === uploaded.id) || null, records:refreshed };
  }
  return { upload };
}
