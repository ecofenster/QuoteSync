import { randomUUID } from "node:crypto";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";
import { createGoogleDriveProvider, GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "./googleDriveProvider.js";
import { createGmailProvider } from "../communications/gmailProvider.js";

// Keep the canonical hierarchy independent from the legacy Estimate-first
// integration service. The legacy service composes this one, so importing it
// here would create an ESM cycle during API bootstrap.
const DEFAULT_PROJECT_FOLDER_NAMES = Object.freeze({
  drawingsClient: "Drawings (Client)",
  drawingsEcofenster: "Drawings (Ecofenster)",
  supplierEstimates: "Estimates",
  invoices: "Invoices",
  orders: "Orders",
});

const safeName = (value) => String(value || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160);
const normalized = (value) => safeName(value).normalize("NFKC").toLocaleLowerCase("en-GB");
const error = (message, status, code) => Object.assign(new Error(message), { status, code });
const matchesReferencePrefix = (name, reference) => String(name || "").toUpperCase().startsWith(`${String(reference || "").toUpperCase()} `)
  || String(name || "").toUpperCase() === String(reference || "").toUpperCase()
  || String(name || "").toUpperCase().startsWith(`${String(reference || "").toUpperCase()} -`);
const resolveEstimateYear = (reference, createdAt) => /^EF-EST-(\d{4})-/i.exec(String(reference || ""))?.[1]
  || String(createdAt || "").slice(0, 4)
  || String(new Date().getUTCFullYear());

export function buildCanonicalClientFolderName(clientRef, clientName) {
  const reference = safeName(clientRef), name = safeName(clientName);
  if (!/^EF-CL-\d{3}$/i.test(reference) || !name) throw error("A canonical Client reference and name are required.", 422, "client_drive_identity_required");
  return `${reference.toUpperCase()} - ${name}`;
}

export function buildCanonicalEstimateFolderName(estimateRef, descriptor = "") {
  const reference = safeName(estimateRef).toUpperCase(), suffix = safeName(descriptor);
  if (!/^EF-EST-\d{4}-\d{3}(?:-\d{2})?$/.test(reference)) throw error("A canonical Estimate reference is required.", 422, "estimate_drive_identity_required");
  return suffix ? `${reference} - ${suffix}` : reference;
}

export function createCommercialDriveService(db, options = {}) {
  const workspace = options.workspace ?? createGoogleWorkspaceService(db, options);
  const provider = options.provider ?? createGoogleDriveProvider(workspace);
  const sourceMail = options.sourceMailProvider ?? createGmailProvider(workspace);
  const now = options.now ?? (() => new Date());

  async function mapping(entityKind, entityId, logicalKey) {
    return db.get("SELECT * FROM canonical_drive_folders WHERE provider='google_drive' AND entity_kind=? AND entity_id=? AND logical_key=? AND removed_at IS NULL", entityKind, entityId, logicalKey);
  }

  async function recordFolder({ accountId = null, entityKind, entityId, logicalKey, name, parentLogicalKey = null, folder, parentId, path, provenance = "quotesuite" }) {
    const timestamp = now().toISOString();
    const existingProviderFolder = await db.get("SELECT * FROM canonical_drive_folders WHERE provider='google_drive' AND entity_kind=? AND entity_id=? AND provider_folder_id=? ORDER BY created_at LIMIT 1", entityKind, entityId, folder.id);
    if (existingProviderFolder) {
      await db.run("UPDATE canonical_drive_folders SET provider_account_id=?,name=?,parent_logical_key=?,provider_parent_folder_id=?,folder_path=?,provenance=?,last_seen_at=?,removed_at=NULL,updated_at=? WHERE id=?", accountId, folder.name || name, parentLogicalKey, parentId || null, path || folder.name || name, provenance, timestamp, timestamp, existingProviderFolder.id);
      return db.get("SELECT * FROM canonical_drive_folders WHERE id=?", existingProviderFolder.id);
    }
    await db.run(`INSERT INTO canonical_drive_folders(id,provider,provider_account_id,entity_kind,entity_id,logical_key,name,parent_logical_key,provider_folder_id,provider_parent_folder_id,folder_path,provenance,last_seen_at,removed_at,created_at,updated_at)
      VALUES(?,'google_drive',?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)
      ON CONFLICT(provider,entity_kind,entity_id,logical_key) DO UPDATE SET provider_account_id=excluded.provider_account_id,name=excluded.name,parent_logical_key=excluded.parent_logical_key,provider_folder_id=excluded.provider_folder_id,provider_parent_folder_id=excluded.provider_parent_folder_id,folder_path=excluded.folder_path,provenance=excluded.provenance,last_seen_at=excluded.last_seen_at,removed_at=NULL,updated_at=excluded.updated_at`,
      randomUUID(), accountId, entityKind, entityId, logicalKey, folder.name || name, parentLogicalKey, folder.id, parentId || null, path || folder.name || name, provenance, timestamp, timestamp, timestamp);
    return mapping(entityKind, entityId, logicalKey);
  }

  async function ensureFolder(input) {
    const saved = await mapping(input.entityKind, input.entityId, input.logicalKey);
    if (saved) return saved;
    let folder = await provider.findFolderByName({ parentId: input.parentId, name: input.name });
    if (!folder) folder = await provider.createFolder({ parentId: input.parentId, name: input.name, logicalKey: input.logicalKey, appProperties: { quotesuiteEntityKind: input.entityKind, quotesuiteEntityId: input.entityId } });
    return recordFolder({ ...input, folder, provenance: folder.appProperties?.quotesuiteEntityId ? "quotesuite" : "discovered_exact_name" });
  }

  async function availableRoot(kind) {
    const status = await workspace.status();
    if (!status.connected || !status.capabilities?.drive?.available) return { status: "pending_provider_connection", workspaceStatus: status, rootId: null };
    const rootId = kind === "enquiry" ? status.enquiriesRootFolderId : status.estimatesRootFolderId;
    if (!rootId) return { status: "pending_root_configuration", workspaceStatus: status, rootId: null };
    return { status: "available", workspaceStatus: status, rootId };
  }

  async function provisionEnquiry(enquiryId) {
    const root = await availableRoot("enquiry");
    if (!root.rootId) return { status: root.status, enquiryId };
    const enquiry = await db.get("SELECT id,enquiry_ref,display_name,company_name FROM enquiries WHERE id=? AND deleted_at IS NULL", enquiryId);
    if (!enquiry) throw error("Enquiry not found.", 404, "enquiry_not_found");
    const label = safeName(enquiry.company_name || enquiry.display_name);
    const folder = await ensureFolder({ accountId: root.workspaceStatus.account?.id || null, entityKind: "enquiry", entityId: enquiry.id, logicalKey: "enquiry_root", name: `${enquiry.enquiry_ref} - ${label}`, parentId: root.rootId, parentLogicalKey: "enquiries_root", path: `${enquiry.enquiry_ref} - ${label}` });
    return { status: "provisioned", enquiryId, folder };
  }

  async function discoverEnquiry(enquiryId) {
    const root = await availableRoot("enquiry");
    if (!root.rootId) throw error("Google Drive Enquiries root is unavailable.", 409, "drive_enquiries_root_required");
    const enquiry = await db.get("SELECT id,enquiry_ref,display_name,company_name FROM enquiries WHERE id=? AND deleted_at IS NULL", enquiryId);
    if (!enquiry) throw error("Enquiry not found.", 404, "enquiry_not_found");
    const saved = await mapping("enquiry", enquiryId, "enquiry_root");
    const rootChildren = await provider.listChildren({ parentId: root.rootId });
    const folder = saved ? rootChildren.find((item) => item.id === saved.provider_folder_id) : rootChildren.find((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && matchesReferencePrefix(item.name, enquiry.enquiry_ref));
    if (!folder) return { status: "review_required", enquiryId, reason: "No unambiguous Enquiry folder matched its canonical reference." };
    const accountId = root.workspaceStatus.account?.id || "", timestamp = now().toISOString(), seenFiles = new Set(), visited = new Set();
    await recordFolder({ accountId, entityKind: "enquiry", entityId: enquiryId, logicalKey: "enquiry_root", name: folder.name, parentLogicalKey: "enquiries_root", folder, parentId: root.rootId, path: folder.name, provenance: saved ? "provider_id" : "enquiry_reference" });
    const queue = [{ folder, path: folder.name, logicalKey: "enquiry_root" }];
    while (queue.length) {
      const parent = queue.shift();
      if (!parent || visited.has(parent.folder.id)) continue;
      visited.add(parent.folder.id);
      if (visited.size > 500) throw error("Drive Enquiry discovery exceeded the safe folder limit.", 422, "drive_tree_limit");
      for (const item of await provider.listChildren({ parentId: parent.folder.id, includeTrashed: true })) {
        if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
          if (item.trashed) continue;
          const path = `${parent.path}/${item.name}`, logicalKey = `discovered:${item.id}`;
          await recordFolder({ accountId, entityKind: "enquiry", entityId: enquiryId, logicalKey, name: item.name, parentLogicalKey: parent.logicalKey, folder: item, parentId: parent.folder.id, path, provenance: "discovered_provider_id" });
          queue.push({ folder: item, path, logicalKey });
          continue;
        }
        seenFiles.add(item.id);
        const fileTimestamp = item.modifiedTime || item.createdTime || timestamp;
        await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
          VALUES(?,'google_drive',?,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,'enquiry_document',?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)
          ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,enquiry_id=excluded.enquiry_id,document_type=excluded.document_type,file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_created_at=excluded.provider_created_at,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=excluded.trashed,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`,
          randomUUID(), accountId, item.id, parent.folder.id, enquiryId, String(item.name || "Untitled Drive file"), String(item.mimeType || "application/octet-stream"), Number(item.size || 0), item.createdTime || null, fileTimestamp, item.version == null ? null : String(item.version), item.version == null ? null : String(item.version), item.md5Checksum || null, item.webViewLink || null, parent.path, item.trashed ? 1 : 0, timestamp, timestamp, timestamp);
      }
    }
    if (seenFiles.size) await db.run(`UPDATE canonical_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND enquiry_id=? AND provider_file_id NOT IN (${[...seenFiles].map(() => "?").join(",")})`, timestamp, timestamp, accountId, enquiryId, ...seenFiles);
    else await db.run("UPDATE canonical_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND enquiry_id=?", timestamp, timestamp, accountId, enquiryId);
    return { status: "synced", enquiryId, foldersVisited: visited.size, filesDiscovered: seenFiles.size };
  }

  async function projectContext(projectId) {
    return db.get(`SELECT p.*,c.client_ref,c.name client_name FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL`, projectId);
  }

  async function clientContext(clientId) {
    return db.get("SELECT id,client_ref,name FROM clients WHERE id=? AND deleted_at IS NULL", clientId);
  }

  async function locateClientFolders(context, rootId) {
    const rootChildren = await provider.listChildren({ parentId: rootId });
    const yearFolders = rootChildren.filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && /^\d{4}$/.test(String(item.name || "").trim()));
    const matches = [];
    for (const yearFolder of yearFolders) {
      const yearChildren = await provider.listChildren({ parentId: yearFolder.id });
      for (const clientFolder of yearChildren.filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && matchesReferencePrefix(item.name, context.client_ref))) matches.push({ yearFolder, clientFolder });
    }
    return { matches, yearsSearched: yearFolders.map((item) => String(item.name)).sort() };
  }

  async function discoverClient(clientId) {
    const root = await availableRoot("project");
    if (!root.rootId) throw error("Google Drive Estimates root is unavailable.", 409, "drive_root_required");
    const context = await clientContext(clientId);
    if (!context) throw error("Client not found.", 404, "client_not_found");
    const located = await locateClientFolders(context, root.rootId);
    if (!located.matches.length) return { status: "client_folder_not_matched", clientId, yearsSearched: located.yearsSearched, foldersVisited: 0, filesDiscovered: 0 };
    const accountId = root.workspaceStatus.account?.id || "", timestamp = now().toISOString(), visited = new Set(), seenFiles = new Set();
    const standardFolders = new Map([
      [normalized("Drawings (Client)"), "client_drawing"],
      [normalized("Drawings (Ecofenster)"), "ecofenster_drawing"],
      [normalized("Estimates"), "estimate_document"],
      [normalized("Invoices"), "invoice"],
      [normalized("Orders"), "order_document"],
    ]);
    const queue = [];
    for (const { yearFolder, clientFolder } of located.matches) {
      const logicalKey = `client_root:${yearFolder.name}:${clientFolder.id}`, path = `${yearFolder.name}/${clientFolder.name}`;
      await recordFolder({ accountId, entityKind: "client", entityId: clientId, logicalKey, name: clientFolder.name, parentLogicalKey: `year:${yearFolder.name}`, folder: clientFolder, parentId: yearFolder.id, path, provenance: "client_reference" });
      queue.push({ folder: clientFolder, path, logicalKey, documentType: "client_document" });
    }
    while (queue.length) {
      const parent = queue.shift();
      if (!parent || visited.has(parent.folder.id)) continue;
      visited.add(parent.folder.id);
      if (visited.size > 1000) throw error("Drive Client discovery exceeded the safe folder limit.", 422, "drive_tree_limit");
      for (const item of await provider.listChildren({ parentId: parent.folder.id, includeTrashed: true })) {
        if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
          if (item.trashed) continue;
          const path = `${parent.path}/${item.name}`, logicalKey = `discovered:${item.id}`, documentType = standardFolders.get(normalized(item.name)) || parent.documentType;
          await recordFolder({ accountId, entityKind: "client", entityId: clientId, logicalKey, name: item.name, parentLogicalKey: parent.logicalKey, folder: item, parentId: parent.folder.id, path, provenance: standardFolders.has(normalized(item.name)) ? "standard_folder" : "discovered_provider_id" });
          queue.push({ folder: item, path, logicalKey, documentType });
          continue;
        }
        seenFiles.add(item.id);
        const fileTimestamp = item.modifiedTime || item.createdTime || timestamp;
        await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
          VALUES(?,'google_drive',?,?,?,NULL,?,NULL,NULL,NULL,NULL,NULL,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)
          ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,client_id=excluded.client_id,document_type=CASE WHEN canonical_documents.project_id IS NULL THEN excluded.document_type ELSE canonical_documents.document_type END,file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_created_at=excluded.provider_created_at,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=excluded.trashed,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`,
          randomUUID(), accountId, item.id, parent.folder.id, clientId, parent.documentType, String(item.name || "Untitled Drive file"), String(item.mimeType || "application/octet-stream"), Number(item.size || 0), item.createdTime || null, fileTimestamp, item.version == null ? null : String(item.version), item.version == null ? null : String(item.version), item.md5Checksum || null, item.webViewLink || null, parent.path, item.trashed ? 1 : 0, timestamp, timestamp, timestamp);
      }
    }
    if (seenFiles.size) await db.run(`UPDATE canonical_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND client_id=? AND project_id IS NULL AND estimate_id IS NULL AND provider_file_id NOT IN (${[...seenFiles].map(() => "?").join(",")})`, timestamp, timestamp, accountId, clientId, ...seenFiles);
    else await db.run("UPDATE canonical_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND client_id=? AND project_id IS NULL AND estimate_id IS NULL", timestamp, timestamp, accountId, clientId);
    if (visited.size) await db.run(`UPDATE canonical_drive_folders SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND entity_kind='client' AND entity_id=? AND provider_folder_id NOT IN (${[...visited].map(() => "?").join(",")})`, timestamp, timestamp, accountId, clientId, ...visited);
    return { status: "project_assignment_pending", clientId, yearsSearched: located.yearsSearched, clientFoldersMatched: located.matches.length, foldersVisited: visited.size, filesDiscovered: seenFiles.size };
  }

  async function provisionProject(projectId) {
    const root = await availableRoot("project");
    if (!root.rootId) return { status: root.status, projectId };
    const context = await projectContext(projectId);
    if (!context) throw error("Project not found.", 404, "project_not_found");
    if (!safeName(context.name) || /^project\s+\d+$/i.test(context.name)) throw error("A reviewed Project name is required before Drive provisioning.", 422, "project_name_required");
    const year = String(context.context_year || now().getUTCFullYear()), accountId = root.workspaceStatus.account?.id || null;
    const yearFolder = await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: `year:${year}`, name: year, parentId: root.rootId, parentLogicalKey: "estimates_root", path: year });
    const clientName = buildCanonicalClientFolderName(context.client_ref, context.client_name);
    const clientFolder = await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: "client", name: clientName, parentId: yearFolder.provider_folder_id, parentLogicalKey: `year:${year}`, path: `${year}/${clientName}` });
    const projectName = safeName(context.name);
    const projectFolder = await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: "project", name: projectName, parentId: clientFolder.provider_folder_id, parentLogicalKey: "client", path: `${year}/${clientName}/${projectName}` });
    const config = (await workspace.resolvedConfig()).stored;
    const template = { ...DEFAULT_PROJECT_FOLDER_NAMES, ...(config?.folder_template_json ? JSON.parse(config.folder_template_json) : {}) };
    const folders = [yearFolder, clientFolder, projectFolder];
    for (const [logicalKey, name] of [["drawings_client", template.drawingsClient], ["drawings_ecofenster", template.drawingsEcofenster], ["estimates", template.supplierEstimates], ["invoices", template.invoices], ["orders", template.orders]]) {
      folders.push(await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey, name, parentId: projectFolder.provider_folder_id, parentLogicalKey: "project", path: `${year}/${clientName}/${projectName}/${name}` }));
    }
    return { status: "provisioned", projectId, folders };
  }

  async function storeReviewedEnquiryAttachments(enquiryId, projectId) {
    const projectResult = await provisionProject(projectId);
    if (projectResult.status !== "provisioned") return { status: projectResult.status, projectId, stored: 0, failed: 0, pending: 0, files: [] };
    const project = await projectContext(projectId), target = await mapping("project", projectId, "drawings_client");
    if (!project || !target) throw error("The reviewed Project or Drawings (Client) folder is unavailable.", 409, "drawings_client_folder_unavailable");
    const rows = await db.all(`SELECT a.id intake_attachment_id,a.canonical_document_id,a.storage_status,a.file_name,
      ca.media_type,ca.size_bytes,ca.provider_attachment_id,m.provider,m.provider_message_id
      FROM enquiry_intake_attachments a JOIN enquiry_email_intakes i ON i.id=a.enquiry_email_intake_id
      JOIN communication_attachments ca ON ca.id=a.communication_attachment_id
      JOIN communication_messages m ON m.id=i.communication_message_id
      WHERE i.enquiry_id=? AND a.storage_status<>'not_selected' ORDER BY a.id`, enquiryId);
    const existingFiles = await provider.listChildren({ parentId: target.provider_folder_id });
    const outcomes = [];
    for (const row of rows) {
      if (row.canonical_document_id) { outcomes.push({ attachmentId: row.intake_attachment_id, fileName: row.file_name, status: "reused", documentId: row.canonical_document_id }); continue; }
      try {
        if (row.provider !== "google_workspace" || !row.provider_message_id || !row.provider_attachment_id) throw error("The selected email attachment no longer has provider evidence.", 409, "source_attachment_unavailable");
        const sourceKey = row.intake_attachment_id;
        let uploaded = existingFiles.find((file) => file.appProperties?.quotesuiteEnquiryIntakeAttachmentId === sourceKey);
        if (!uploaded) {
          const bytes = await sourceMail.attachment(row.provider_message_id, row.provider_attachment_id);
          uploaded = await provider.uploadFile({ parentId: target.provider_folder_id, fileName: row.file_name, mediaType: row.media_type || "application/octet-stream", bytes, appProperties: { quotesuiteEnquiryId: enquiryId, quotesuiteProjectId: projectId, quotesuiteEnquiryIntakeAttachmentId: sourceKey } });
        }
        const at = now().toISOString(), documentId = randomUUID(), checksum = uploaded.md5Checksum || null;
        await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
          VALUES(?,'google_drive',?,?,?,?,?,?,'client_drawing',?,?,?,?,?,?,?,?,?,?,0,NULL,?,?,?)
          ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET enquiry_id=COALESCE(canonical_documents.enquiry_id,excluded.enquiry_id),client_id=excluded.client_id,project_id=excluded.project_id,provider_folder_id=excluded.provider_folder_id,document_type='client_drawing',file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=0,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`,
          documentId,target.provider_account_id || "",uploaded.id,target.provider_folder_id,enquiryId,project.client_id,projectId,uploaded.name || row.file_name,uploaded.mimeType || row.media_type || "application/octet-stream",Number(uploaded.size || row.size_bytes || 0),uploaded.createdTime || at,uploaded.modifiedTime || at,uploaded.version == null ? null : String(uploaded.version),uploaded.version == null ? null : String(uploaded.version),checksum,uploaded.webViewLink || null,target.folder_path,at,at,at);
        const canonical = await db.get("SELECT id FROM canonical_documents WHERE provider='google_drive' AND provider_account_id=? AND provider_file_id=?", target.provider_account_id || "", uploaded.id);
        await db.run("UPDATE enquiry_intake_attachments SET storage_status='stored',canonical_document_id=?,error_code=NULL WHERE id=?", canonical.id, row.intake_attachment_id);
        outcomes.push({ attachmentId: row.intake_attachment_id, fileName: row.file_name, status: "stored", documentId: canonical.id });
      } catch (cause) {
        const code = String(cause?.code || "attachment_storage_failed");
        await db.run("UPDATE enquiry_intake_attachments SET storage_status='failed',error_code=? WHERE id=?", code, row.intake_attachment_id);
        outcomes.push({ attachmentId: row.intake_attachment_id, fileName: row.file_name, status: "failed", errorCode: code });
      }
    }
    return { status: outcomes.some((item) => item.status === "failed") ? "partial_failure" : "stored", projectId, stored: outcomes.filter((item) => ["stored","reused"].includes(item.status)).length, failed: outcomes.filter((item) => item.status === "failed").length, pending: 0, files: outcomes };
  }

  async function provisionEstimate(estimateId) {
    const estimate = await db.get("SELECT id,project_id,estimate_ref,created_at FROM estimates WHERE id=? AND deleted_at IS NULL", estimateId);
    if (!estimate) throw error("Estimate not found.", 404, "estimate_not_found");
    if (!estimate.project_id) return { status: "legacy_project_required", estimateId };
    const projectResult = await provisionProject(estimate.project_id);
    if (projectResult.status !== "provisioned") return { ...projectResult, estimateId };
    const estimatesFolder = await mapping("project", estimate.project_id, "estimates");
    const supplierRows = await db.all("SELECT DISTINCT supplier_name FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL ORDER BY supplier_name", estimateId).catch(() => []);
    const descriptor = supplierRows.map((row) => clean(row.supplier_name)).filter(Boolean).join(" + ");
    const folderName = buildCanonicalEstimateFolderName(estimate.estimate_ref, descriptor);
    const year = resolveEstimateYear(estimate.estimate_ref, estimate.created_at);
    const folder = await ensureFolder({ accountId: projectResult.folders[0]?.provider_account_id || null, entityKind: "estimate", entityId: estimateId, logicalKey: "estimate", name: folderName, parentId: estimatesFolder.provider_folder_id, parentLogicalKey: "estimates", path: `${year}/${projectResult.folders.find((item) => item.logical_key === "client")?.name}/${projectResult.folders.find((item) => item.logical_key === "project")?.name}/${estimatesFolder.name}/${folderName}` });
    return { status: "provisioned", estimateId, folder };
  }

  async function storeCommunicationSupplierDocument(input) {
    const clientId = String(input.clientId || ""), projectId = String(input.projectId || ""), estimateId = String(input.estimateId || ""), supplierCode = String(input.supplierCode || ""), sourceAttachmentId = String(input.communicationAttachmentId || "");
    const context = await db.get(`SELECT e.id estimate_id,e.estimate_ref,e.project_id,p.client_id,p.name project_name,c.client_ref,c.name client_name
      FROM estimates e JOIN projects p ON p.id=e.project_id JOIN clients c ON c.id=p.client_id
      WHERE e.id=? AND e.deleted_at IS NULL AND p.id=? AND p.deleted_at IS NULL AND c.id=? AND c.deleted_at IS NULL`, estimateId, projectId, clientId);
    if (!context) throw error("The selected Client, Project and Estimate do not form a canonical filing path.", 422, "communication_assignment_path_conflict");
    const supplier = await db.get(`SELECT supplier_code,supplier_name FROM supplier_commercial_defaults WHERE supplier_code=?
      AND NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT'))`, supplierCode);
    if (!supplier) throw error("The selected Supplier is unavailable.", 404, "communication_assignment_supplier_not_found");
    if (!sourceAttachmentId || !input.providerMessageId || !input.providerAttachmentId) throw error("Choose a retained email document before filing.", 422, "communication_assignment_attachment_required");
    const provisioned = await provisionEstimate(estimateId);
    if (provisioned.status !== "provisioned") return { ...provisioned, stored: false };
    const accountId = provisioned.folder.provider_account_id || null, supplierRootName = "Supplier", supplierName = safeName(supplier.supplier_name);
    const supplierRoot = await ensureFolder({ accountId, entityKind: "estimate", entityId: estimateId, logicalKey: "supplier_documents", name: supplierRootName, parentId: provisioned.folder.provider_folder_id, parentLogicalKey: "estimate", path: `${provisioned.folder.folder_path}/${supplierRootName}` });
    const supplierFolder = await ensureFolder({ accountId, entityKind: "estimate", entityId: estimateId, logicalKey: `supplier:${supplier.supplier_code}`, name: supplierName, parentId: supplierRoot.provider_folder_id, parentLogicalKey: "supplier_documents", path: `${supplierRoot.folder_path}/${supplierName}` });
    const existingFiles = await provider.listChildren({ parentId: supplierFolder.provider_folder_id });
    let uploaded = existingFiles.find((file) => file.appProperties?.quotesuiteCommunicationAttachmentId === sourceAttachmentId);
    let duplicate = Boolean(uploaded);
    if (!uploaded) {
      const bytes = Buffer.from(input.bytes || []);
      if (!bytes.length) throw error("The selected email document has no retained content.", 409, "source_attachment_unavailable");
      uploaded = await provider.uploadFile({ parentId: supplierFolder.provider_folder_id, fileName: safeName(input.fileName) || "Supplier document", mediaType: input.mediaType || "application/octet-stream", bytes, appProperties: { quotesuiteCommunicationAttachmentId: sourceAttachmentId, quotesuiteEstimateId: estimateId, quotesuiteSupplierCode: supplier.supplier_code } });
    }
    const timestamp = now().toISOString(), documentId = randomUUID();
    await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
      VALUES(?,'google_drive',?,?,?,NULL,?,?,?,NULL,?,NULL,'supplier_quotation',?,?,?,?,?,?,?,?,?,?,0,NULL,?,?,?)
      ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,client_id=excluded.client_id,project_id=excluded.project_id,estimate_id=excluded.estimate_id,supplier_id=excluded.supplier_id,document_type='supplier_quotation',file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=0,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`,
      documentId,accountId || "",uploaded.id,supplierFolder.provider_folder_id,clientId,projectId,estimateId,supplier.supplier_code,uploaded.name || input.fileName,uploaded.mimeType || input.mediaType || "application/octet-stream",Number(uploaded.size || input.sizeBytes || 0),uploaded.createdTime || timestamp,uploaded.modifiedTime || timestamp,uploaded.version == null ? null : String(uploaded.version),uploaded.version == null ? null : String(uploaded.version),uploaded.md5Checksum || null,uploaded.webViewLink || null,supplierFolder.folder_path,timestamp,timestamp,timestamp);
    const document = await db.get("SELECT * FROM canonical_documents WHERE provider='google_drive' AND provider_account_id=? AND provider_file_id=?", accountId || "", uploaded.id);
    return { status: "stored", stored: true, duplicate, documentId: document.id, providerFileId: uploaded.id, webViewLink: uploaded.webViewLink || null, folderPath: supplierFolder.folder_path, clientId, projectId, estimateId, supplierCode: supplier.supplier_code, supplierName: supplier.supplier_name };
  }

  async function locateProjectFolder(context, rootId) {
    const year = String(context.context_year || now().getUTCFullYear());
    const rootChildren = await provider.listChildren({ parentId: rootId });
    const yearFolder = rootChildren.find((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && normalized(item.name) === normalized(year));
    if (!yearFolder) return null;
    const yearChildren = await provider.listChildren({ parentId: yearFolder.id });
    const clientCandidates = yearChildren.filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && matchesReferencePrefix(item.name, context.client_ref));
    const saved = await mapping("project", context.id, "project");
    if (saved) {
      const historical = clientCandidates.find((item) => item.id === saved.provider_folder_id);
      if (historical) return { yearFolder, clientFolder: historical, projectFolder: historical, provenance: "historical_client_project_folder" };
      for (const clientFolder of clientCandidates) {
        const children = await provider.listChildren({ parentId: clientFolder.id });
        const projectFolder = children.find((item) => item.id === saved.provider_folder_id);
        if (projectFolder) return { yearFolder, clientFolder, projectFolder, provenance: "canonical_project_folder" };
      }
    }
    const projectName = normalized(context.name);
    const historical = clientCandidates.filter((item) => normalized(item.name).includes(projectName));
    if (historical.length === 1) return { yearFolder, clientFolder: historical[0], projectFolder: historical[0], provenance: "historical_client_project_folder" };
    for (const clientFolder of clientCandidates) {
      const children = await provider.listChildren({ parentId: clientFolder.id });
      const matches = children.filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && normalized(item.name) === projectName);
      if (matches.length === 1) return { yearFolder, clientFolder, projectFolder: matches[0], provenance: "canonical_project_folder" };
    }
    const clientProjects = await db.get("SELECT COUNT(*) count FROM projects WHERE client_id=? AND context_year=? AND deleted_at IS NULL", context.client_id, Number(year));
    const clientMappings = await db.all("SELECT provider_folder_id FROM canonical_drive_folders WHERE provider='google_drive' AND entity_kind='client' AND entity_id=? AND logical_key LIKE ? AND removed_at IS NULL", context.client_id, `client_root:${year}:%`);
    const mappedCandidates = clientCandidates.filter((candidate) => clientMappings.some((savedClient) => savedClient.provider_folder_id === candidate.id));
    if (clientProjects?.count === 1 && mappedCandidates.length === 1) return { yearFolder, clientFolder: mappedCandidates[0], projectFolder: mappedCandidates[0], provenance: "reviewed_project_client_folder" };
    return null;
  }

  async function discoverProject(projectId) {
    const root = await availableRoot("project");
    if (!root.rootId) throw error("Google Drive Estimates root is unavailable.", 409, "drive_root_required");
    const context = await projectContext(projectId);
    if (!context) throw error("Project not found.", 404, "project_not_found");
    const located = await locateProjectFolder(context, root.rootId);
    if (!located) return { status: "review_required", projectId, reason: "No unambiguous Drive project folder matched the canonical Project." };
    const accountId = root.workspaceStatus.account?.id || "", seen = new Set(), seenFiles = new Set(), timestamp = now().toISOString();
    await recordFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: "project", name: located.projectFolder.name, parentLogicalKey: located.projectFolder.id === located.clientFolder.id ? `year:${context.context_year}` : "client", folder: located.projectFolder, parentId: located.projectFolder.id === located.clientFolder.id ? located.yearFolder.id : located.clientFolder.id, path: `${located.yearFolder.name}/${located.clientFolder.name}${located.projectFolder.id === located.clientFolder.id ? "" : `/${located.projectFolder.name}`}`, provenance: located.provenance });
    const estimates = await db.all("SELECT id,estimate_ref FROM estimates WHERE project_id=? AND deleted_at IS NULL", projectId);
    const suppliers = await db.all(`SELECT DISTINCT q.id,q.supplier_name FROM supplier_quotes q JOIN estimates e ON e.id=q.estimate_id WHERE e.project_id=? AND q.archived_at IS NULL`, projectId).catch(() => []);
    const standardFolders = new Map([
      [normalized("Drawings (Client)"), ["drawings_client", "client_drawing"]],
      [normalized("Drawings (Ecofenster)"), ["drawings_ecofenster", "ecofenster_drawing"]],
      [normalized("Estimates"), ["estimates", "estimate_document"]],
      [normalized("Invoices"), ["invoices", "invoice"]],
      [normalized("Orders"), ["orders", "order_document"]],
    ]);
    const projectPath = `${located.yearFolder.name}/${located.clientFolder.name}${located.projectFolder.id === located.clientFolder.id ? "" : `/${located.projectFolder.name}`}`;
    const queue = [{ folder: located.projectFolder, path: projectPath, entityKind: "project", entityId: projectId, logicalKey: "project", estimateId: null, supplierId: null, documentType: "project_document" }];
    let filesDiscovered = 0;
    while (queue.length) {
      const parent = queue.shift();
      if (!parent || seen.has(parent.folder.id)) continue;
      seen.add(parent.folder.id);
      if (seen.size > 1000) throw error("Drive Project discovery exceeded the safe folder limit.", 422, "drive_tree_limit");
      for (const item of await provider.listChildren({ parentId: parent.folder.id, includeTrashed: true })) {
        if (item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
          if (item.trashed) continue;
          const estimate = estimates.find((candidate) => matchesReferencePrefix(item.name, candidate.estimate_ref));
          const standard = standardFolders.get(normalized(item.name));
          const supplier = parent.logicalKey === "estimates" ? suppliers.find((candidate) => normalized(candidate.supplier_name) === normalized(item.name)) : null;
          const entityKind = estimate ? "estimate" : "project", entityId = estimate?.id || projectId;
          const logicalKey = estimate ? "estimate" : standard?.[0] || `discovered:${item.id}`;
          const path = `${parent.path}/${item.name}`;
          await recordFolder({ accountId, entityKind, entityId, logicalKey, name: item.name, parentLogicalKey: parent.logicalKey, folder: item, parentId: parent.folder.id, path, provenance: estimate ? "estimate_reference" : standard ? "standard_folder" : supplier ? "supplier_exact_name" : "discovered_provider_id" });
          queue.push({ folder: item, path, entityKind, entityId, logicalKey, estimateId: estimate?.id || parent.estimateId, supplierId: supplier?.id || parent.supplierId, documentType: estimate ? "estimate_document" : standard?.[1] || (supplier ? "supplier_quotation" : parent.documentType) });
          continue;
        }
        filesDiscovered += 1;
        seenFiles.add(item.id);
        const fileTimestamp = item.modifiedTime || item.createdTime || timestamp;
        await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
          VALUES(?,'google_drive',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)
          ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,client_id=excluded.client_id,project_id=excluded.project_id,estimate_id=excluded.estimate_id,document_type=excluded.document_type,file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_created_at=excluded.provider_created_at,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=excluded.trashed,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`,
          randomUUID(), accountId, item.id, parent.folder.id, null, context.client_id, projectId, parent.estimateId, null, parent.supplierId, null, parent.documentType, String(item.name || "Untitled Drive file"), String(item.mimeType || "application/octet-stream"), Number(item.size || 0), item.createdTime || null, fileTimestamp, item.version == null ? null : String(item.version), item.version == null ? null : String(item.version), item.md5Checksum || null, item.webViewLink || null, parent.path, item.trashed ? 1 : 0, timestamp, timestamp, timestamp);
      }
    }
    if (seenFiles.size) await db.run(`UPDATE canonical_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND project_id=? AND provider_file_id NOT IN (${[...seenFiles].map(() => "?").join(",")})`, timestamp, timestamp, accountId, projectId, ...seenFiles);
    else await db.run("UPDATE canonical_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND project_id=?", timestamp, timestamp, accountId, projectId);
    if (seen.size) await db.run(`UPDATE canonical_drive_folders SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND entity_kind='project' AND entity_id=? AND provider_folder_id NOT IN (${[...seen].map(() => "?").join(",")})`, timestamp, timestamp, accountId, projectId, ...seen);
    return { status: "synced", projectId, provenance: located.provenance, foldersVisited: seen.size, filesDiscovered };
  }

  return { provisionEnquiry, discoverEnquiry, discoverClient, provisionProject, storeReviewedEnquiryAttachments, provisionEstimate, storeCommunicationSupplierDocument, discoverProject, buildCanonicalClientFolderName, buildCanonicalEstimateFolderName };
}

const clean = (value) => String(value || "").trim();
