import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";
import { createGoogleDriveProvider, GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "./googleDriveProvider.js";
import { createCommercialDriveService } from "./commercialDriveService.js";

export const DEFAULT_PROJECT_FOLDER_NAMES = Object.freeze({ drawingsClient: "Drawings (Client)", drawingsEcofenster: "Drawings (Ecofenster)", supplierEstimates: "Estimates", invoices: "Invoices", orders: "Orders" });
const safeName = (value) => String(value || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160);
const supplierKey = (name) => `supplier:${createHash("sha256").update(String(name).trim().toLowerCase()).digest("hex").slice(0, 16)}`;
const discoveredFolderKey = (providerFolderId) => `provider:${createHash("sha256").update(String(providerFolderId)).digest("hex").slice(0, 20)}`;
const normalizedName = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
const normalizedSupplierIdentity = (value) => normalizedName(value).replace(/[^\p{L}\p{N}]+/gu, "");
const exactName = (left, right) => normalizedName(left) === normalizedName(right);

export const DRIVE_DISCOVERY_STRATEGY = Object.freeze({
  current: "full_enumeration",
  incrementalSuccessor: "google_drive_changes_api",
  tokenColumn: "drive_document_sync_states.change_token",
});

export function matchesEstimateReferencePrefix(folderName, estimateReference) {
  const name = normalizedName(folderName), reference = normalizedName(estimateReference);
  if (!reference || !name.startsWith(reference)) return false;
  const boundary = name.slice(reference.length, reference.length + 1);
  return !boundary || /[\s\-–—_(]/u.test(boundary);
}

export function resolveEstimateYear(estimateReference, createdAt) {
  const referenceMatch = String(estimateReference || "").trim().match(/^EF-EST-(\d{4})-\d+$/i);
  if (referenceMatch) return referenceMatch[1];
  const createdYear = new Date(createdAt).getUTCFullYear();
  if (Number.isInteger(createdYear)) return String(createdYear);
  throw Object.assign(new Error("Estimate year cannot be resolved from its reference or creation date."), { status: 422, code: "estimate_year_required" });
}

export function buildEstimateProjectFolderName({ estimateReference, clientName, projectName }) {
  const reference = safeName(estimateReference), client = safeName(clientName), project = safeName(projectName);
  if (!reference || !client) throw Object.assign(new Error("Estimate reference and Client name are required for Drive provisioning."), { status: 422, code: "estimate_folder_identity_required" });
  const genuineProject = project && project.localeCompare(client, undefined, { sensitivity: "accent" }) !== 0;
  return `${reference} - ${client}${genuineProject ? ` (${project})` : ""}`;
}

export function createDriveIntegrationService(db, options = {}) {
  const workspace = options.workspace ?? createGoogleWorkspaceService(db, options), provider = options.provider ?? createGoogleDriveProvider(workspace), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment);
  const commercialDrive = options.commercialDrive ?? createCommercialDriveService(db, { ...options, workspace, provider });
  async function localFolder(estimateId, logicalKey) { return db.get("SELECT * FROM drive_project_folders WHERE provider='google_drive' AND estimate_id=? AND logical_key=?", estimateId, logicalKey); }
  async function ensure({ estimateId, logicalKey, name, parentLogicalKey, parentId, discovery, estimateReference }) {
    const saved = await localFolder(estimateId, logicalKey);
    if (saved && !saved.removed_at) return saved;
    const folder = await provider.ensureFolder({ parentId, name, estimateId, logicalKey, discovery, estimateReference }), timestamp = new Date().toISOString(), id = randomUUID();
    await db.run(`INSERT INTO drive_project_folders(id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,provider_parent_folder_id,created_at,updated_at,removed_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)
      ON CONFLICT(provider,estimate_id,logical_key) DO UPDATE SET name=excluded.name,parent_logical_key=excluded.parent_logical_key,provider_folder_id=excluded.provider_folder_id,provider_parent_folder_id=excluded.provider_parent_folder_id,updated_at=excluded.updated_at,removed_at=NULL`, id, "google_drive", estimateId, logicalKey, folder.name || name, parentLogicalKey ?? null, folder.id, parentId, timestamp, timestamp);
    return localFolder(estimateId, logicalKey);
  }
  async function estimateContext(estimateId) { return db.get(`SELECT e.id,e.client_id,e.project_id,e.estimate_ref,e.created_at,c.name client_name,c.project_name FROM estimates e JOIN clients c ON c.id=e.client_id WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL`, estimateId); }
  async function supplierNames(estimateId) { return (await db.all("SELECT DISTINCT supplier_name FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL ORDER BY supplier_name", estimateId)).map((row) => row.supplier_name).filter(Boolean); }
  async function canonicalSupplierName({ estimateId, quoteId, fallback }) {
    const quote = quoteId ? await db.get("SELECT supplier_name FROM supplier_quotes WHERE id=? AND estimate_id=? AND archived_at IS NULL", quoteId, estimateId) : null;
    return String(quote?.supplier_name || fallback || "").trim();
  }
  async function provisionEstimate(estimateId, extraSuppliers = []) {
    const canonicalContext = await estimateContext(estimateId);
    if (canonicalContext?.project_id) return commercialDrive.provisionEstimate(estimateId);
    const status = await workspace.status();
    if (!status.connected) return { status: "disconnected", folders: [] };
    if (!status.capabilities.drive.available) throw Object.assign(new Error("Reconnect Google Workspace and grant the required Google Drive permission."), { status: 409, code: "drive_scope_required" });
    if (!status.estimatesRootFolderId) throw Object.assign(new Error("Google Drive Estimates root folder is not configured."), { status: 409, code: "drive_root_required" });
    const context = await estimateContext(estimateId); if (!context) throw Object.assign(new Error("Estimate not found."), { status: 404 });
    const config = (await workspace.resolvedConfig()).stored, template = { ...DEFAULT_PROJECT_FOLDER_NAMES, ...(config?.folder_template_json ? JSON.parse(config.folder_template_json) : {}) }, year = resolveEstimateYear(context.estimate_ref, context.created_at), projectName = buildEstimateProjectFolderName({ estimateReference: context.estimate_ref, clientName: context.client_name, projectName: context.project_name });
    const folders = [];
    const yearFolder = await ensure({ estimateId, logicalKey: `year:${year}`, name: year, parentLogicalKey: "estimates_root", parentId: status.estimatesRootFolderId, discovery: "exact_name" }); folders.push(yearFolder);
    const project = await ensure({ estimateId, logicalKey: "project", name: projectName, parentLogicalKey: `year:${year}`, parentId: yearFolder.provider_folder_id, discovery: "estimate_reference", estimateReference: context.estimate_ref }); folders.push(project);
    for (const [logicalKey, name] of [["drawings_client", template.drawingsClient], ["drawings_ecofenster", template.drawingsEcofenster], ["supplier_estimates", template.supplierEstimates], ["invoices", template.invoices], ["orders", template.orders]]) folders.push(await ensure({ estimateId, logicalKey, name, parentLogicalKey: "project", parentId: project.provider_folder_id, discovery: "exact_name" }));
    const supplierParent = folders.find((folder) => folder.logical_key === "supplier_estimates");
    for (const supplierName of [...new Set([...(await supplierNames(estimateId)), ...extraSuppliers].map((name) => String(name).trim()).filter(Boolean))]) folders.push(await ensure({ estimateId, logicalKey: supplierKey(supplierName), name: safeName(supplierName), parentLogicalKey: "supplier_estimates", parentId: supplierParent.provider_folder_id, discovery: "exact_name" }));
    return { status: "provisioned", folders };
  }
  async function fileSupplierAttachment({ estimateId, quoteId, revisionId, attachmentId, supplierName }) {
    const existing = await db.get("SELECT * FROM drive_document_links WHERE provider='google_drive' AND source_attachment_id=?", attachmentId); if (existing) return existing;
    const resolvedSupplierName = await canonicalSupplierName({ estimateId, quoteId, fallback: supplierName });
    if (!resolvedSupplierName) throw Object.assign(new Error("A canonical Supplier is required before filing its quotation."), { status: 422, code: "supplier_required" });
    const provisioning = await provisionEstimate(estimateId, [resolvedSupplierName]);
    if (provisioning.status === "disconnected") return { status: "pending_provider_connection", estimateId, attachmentId };
    const parent = await localFolder(estimateId, supplierKey(resolvedSupplierName)), source = await db.get("SELECT original_file_name,media_type,storage_key FROM supplier_quote_attachments WHERE id=? AND estimate_id=?", attachmentId, estimateId);
    if (!parent || !source) throw Object.assign(new Error("Supplier attachment or Drive supplier folder is unavailable."), { status: 404 });
    const uploaded = await provider.uploadFile({ parentId: parent.provider_folder_id, fileName: source.original_file_name, mediaType: source.media_type, bytes: await readFile(resolveManagedPath(source.storage_key, attachmentRoot)), appProperties: { quotesuiteEstimateId: estimateId, quotesuiteSupplierQuoteId: quoteId, quotesuiteSupplierRevisionId: revisionId, quotesuiteSourceAttachmentId: attachmentId } });
    const timestamp = new Date().toISOString(), id = randomUUID(); await db.run(`INSERT INTO drive_document_links(id,provider,estimate_id,supplier_quote_id,supplier_revision_id,source_attachment_id,quotation_document_id,provider_file_id,provider_folder_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,source_attachment_id) DO NOTHING`, id, "google_drive", estimateId, quoteId, revisionId, attachmentId, null, uploaded.id, parent.provider_folder_id, timestamp);
    return db.get("SELECT * FROM drive_document_links WHERE provider='google_drive' AND source_attachment_id=?", attachmentId);
  }

  async function canonicalSuppliers(estimateId) {
    const [quoted, configured] = await Promise.all([
      db.all("SELECT DISTINCT supplier_code,supplier_name FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL", estimateId).catch(() => []),
      db.all("SELECT supplier_code,supplier_name FROM supplier_commercial_defaults WHERE active<>0").catch(() => []),
    ]);
    const suppliers = new Map();
    for (const row of [...quoted, ...configured]) {
      const id = String(row.supplier_code || "").trim(), name = String(row.supplier_name || "").trim();
      if (!id || !name) continue;
      suppliers.set(id, { id, name, aliases: [name, id] });
    }
    const aliases = new Map();
    for (const supplier of suppliers.values()) for (const alias of supplier.aliases) {
      const key = normalizedSupplierIdentity(alias);
      if (!key) continue;
      if (!aliases.has(key)) aliases.set(key, supplier);
      else if (aliases.get(key)?.id !== supplier.id) aliases.set(key, null);
    }
    return { match(folderName) { return aliases.get(normalizedSupplierIdentity(folderName)) || null; } };
  }

  function expectedFolderIdentity(name, template) {
    const expected = [
      ["drawings_client", template.drawingsClient, "client_drawing"],
      ["drawings_ecofenster", template.drawingsEcofenster, "ecofenster_drawing"],
      ["supplier_estimates", template.supplierEstimates, "estimate"],
      ["invoices", template.invoices, "invoice"],
      ["orders", template.orders, "order_document"],
    ];
    const match = expected.find(([, expectedName]) => exactName(name, expectedName));
    return match ? { logicalKey: match[0], documentType: match[2] } : null;
  }

  function documentTypeForLogicalKey(logicalKey, fallback = "project_document") {
    return ({ drawings_client: "client_drawing", drawings_ecofenster: "ecofenster_drawing", supplier_estimates: "estimate", invoices: "invoice", orders: "order_document" })[logicalKey] || fallback;
  }

  async function writeSyncState({ accountId, estimateId, status, timestamp, errorMessage = null }) {
    await db.run(`INSERT INTO drive_document_sync_states(provider,provider_account_id,estimate_id,strategy,change_token,status,last_attempt_at,last_success_at,error_message,updated_at)
      VALUES('google_drive',?,?,?,NULL,?,?,CASE WHEN ?='synced' THEN ? ELSE NULL END,?,?)
      ON CONFLICT(provider,provider_account_id,estimate_id) DO UPDATE SET strategy=excluded.strategy,status=excluded.status,last_attempt_at=excluded.last_attempt_at,last_success_at=CASE WHEN excluded.status='synced' THEN excluded.last_success_at ELSE drive_document_sync_states.last_success_at END,error_message=excluded.error_message,updated_at=excluded.updated_at`,
      accountId, estimateId, DRIVE_DISCOVERY_STRATEGY.current, status, timestamp, status, timestamp, errorMessage, timestamp);
  }

  async function upsertDiscoveredFolder({ accountId, estimateId, logicalKey, name, parentLogicalKey, providerFolderId, providerParentFolderId, folderPath, timestamp, syncId }) {
    const existingProviderFolder = await db.get("SELECT id,logical_key FROM drive_project_folders WHERE provider='google_drive' AND estimate_id=? AND provider_folder_id=? ORDER BY created_at LIMIT 1", estimateId, providerFolderId);
    if (existingProviderFolder) {
      await db.run("UPDATE drive_project_folders SET name=?,parent_logical_key=?,provider_account_id=?,provider_parent_folder_id=?,folder_path=?,last_seen_at=?,last_seen_sync_id=?,removed_at=NULL,updated_at=? WHERE id=?", name, parentLogicalKey, accountId, providerParentFolderId, folderPath, timestamp, syncId, timestamp, existingProviderFolder.id);
      return;
    }
    await db.run(`INSERT INTO drive_project_folders(id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,provider_account_id,provider_parent_folder_id,folder_path,last_seen_at,last_seen_sync_id,removed_at,created_at,updated_at)
      VALUES(?,'google_drive',?,?,?,?,?,?,?,?,?,?,NULL,?,?)
      ON CONFLICT(provider,estimate_id,logical_key) DO UPDATE SET name=excluded.name,parent_logical_key=excluded.parent_logical_key,provider_folder_id=excluded.provider_folder_id,provider_account_id=excluded.provider_account_id,provider_parent_folder_id=excluded.provider_parent_folder_id,folder_path=excluded.folder_path,last_seen_at=excluded.last_seen_at,last_seen_sync_id=excluded.last_seen_sync_id,removed_at=NULL,updated_at=excluded.updated_at`,
      randomUUID(), estimateId, logicalKey, name, parentLogicalKey, providerFolderId, accountId, providerParentFolderId, folderPath, timestamp, syncId, timestamp, timestamp);
  }

  async function upsertDiscoveredDocument({ accountId, estimateId, clientId, file, folder, timestamp, syncId }) {
    const providerCreatedAt = file.createdTime || null, providerModifiedAt = file.modifiedTime || providerCreatedAt;
    await db.run(`INSERT INTO drive_discovered_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,estimate_id,client_id,project_id,order_id,supplier_id,supplier_name,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,md5_checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,last_seen_sync_id,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,estimate_id=excluded.estimate_id,client_id=excluded.client_id,project_id=excluded.project_id,order_id=excluded.order_id,supplier_id=excluded.supplier_id,supplier_name=excluded.supplier_name,document_type=excluded.document_type,file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_created_at=excluded.provider_created_at,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,md5_checksum=excluded.md5_checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=excluded.trashed,removed_at=NULL,last_seen_at=excluded.last_seen_at,last_seen_sync_id=excluded.last_seen_sync_id,updated_at=excluded.updated_at`,
      randomUUID(), "google_drive", accountId, file.id, folder.providerFolderId, estimateId, clientId, estimateId, null, folder.supplierId, folder.supplierName, folder.documentType, String(file.name || "Untitled Drive file"), String(file.mimeType || "application/octet-stream"), Number(file.size || 0), providerCreatedAt, providerModifiedAt, file.version == null ? null : String(file.version), file.version == null ? null : String(file.version), file.md5Checksum || null, file.webViewLink || null, folder.folderPath, file.trashed ? 1 : 0, null, timestamp, timestamp, syncId, timestamp);
  }

  async function reconcileDiscovery({ accountId, estimateId, clientId, folders, files, syncId, timestamp }) {
    for (const folder of folders) await upsertDiscoveredFolder({ accountId, estimateId, ...folder, timestamp, syncId });
    for (const item of files) await upsertDiscoveredDocument({ accountId, estimateId, clientId, ...item, timestamp, syncId });
    await db.run("UPDATE drive_discovered_documents SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND provider_account_id=? AND estimate_id=? AND last_seen_sync_id<>?", timestamp, timestamp, accountId, estimateId, syncId);
    await db.run("UPDATE drive_project_folders SET removed_at=COALESCE(removed_at,?),updated_at=? WHERE provider='google_drive' AND estimate_id=? AND COALESCE(provider_account_id,?)=? AND COALESCE(last_seen_sync_id,'')<>?", timestamp, timestamp, estimateId, accountId, accountId, syncId);
  }

  async function discoverEstimate(estimateId) {
    const status = await workspace.status();
    if (!status.connected) throw Object.assign(new Error("Google Workspace is not connected."), { status: 409, code: "google_workspace_disconnected" });
    if (!status.capabilities?.drive?.available) throw Object.assign(new Error("Reconnect Google Workspace and grant the required Google Drive permission."), { status: 409, code: "drive_scope_required" });
    if (!status.estimatesRootFolderId) throw Object.assign(new Error("Google Drive Estimates root folder is not configured."), { status: 409, code: "drive_root_required" });
    const accountId = String(status.account?.id || "").trim();
    if (!accountId) throw Object.assign(new Error("The connected Google Workspace account identity is unavailable."), { status: 409, code: "drive_account_required" });
    const context = await estimateContext(estimateId);
    if (!context) throw Object.assign(new Error("Estimate not found."), { status: 404 });
    if (context.project_id) return commercialDrive.discoverProject(context.project_id);
    const timestamp = new Date().toISOString(), syncId = randomUUID();
    await writeSyncState({ accountId, estimateId, status: "syncing", timestamp });
    try {
      const config = (await workspace.resolvedConfig()).stored;
      const template = { ...DEFAULT_PROJECT_FOLDER_NAMES, ...(config?.folder_template_json ? JSON.parse(config.folder_template_json) : {}) };
      const existingMappings = new Map((await db.all("SELECT provider_folder_id,logical_key FROM drive_project_folders WHERE provider='google_drive' AND estimate_id=?", estimateId)).map((row) => [row.provider_folder_id, row.logical_key]));
      const year = resolveEstimateYear(context.estimate_ref, context.created_at);
      const rootChildren = await provider.listChildren({ parentId: status.estimatesRootFolderId });
      const yearFolder = rootChildren.find((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && exactName(item.name, year));
      const folders = [], files = [];
      if (yearFolder) {
        folders.push({ logicalKey: `year:${year}`, name: yearFolder.name, parentLogicalKey: "estimates_root", providerFolderId: yearFolder.id, providerParentFolderId: status.estimatesRootFolderId, folderPath: yearFolder.name });
        const yearChildren = await provider.listChildren({ parentId: yearFolder.id });
        const projectFolder = yearChildren.find((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && matchesEstimateReferencePrefix(item.name, context.estimate_ref));
        if (projectFolder) {
          const supplierIndex = await canonicalSuppliers(estimateId);
          const projectPath = `${yearFolder.name}/${projectFolder.name}`;
          folders.push({ logicalKey: "project", name: projectFolder.name, parentLogicalKey: `year:${year}`, providerFolderId: projectFolder.id, providerParentFolderId: yearFolder.id, folderPath: projectPath });
          const queue = [{ providerFolderId: projectFolder.id, logicalKey: "project", folderPath: projectPath, documentType: "project_document", supplierId: null, supplierName: null, depth: 0 }], visited = new Set();
          while (queue.length) {
            const parent = queue.shift();
            if (!parent || visited.has(parent.providerFolderId)) continue;
            visited.add(parent.providerFolderId);
            if (visited.size > 1000) throw Object.assign(new Error("Drive project discovery exceeded the safe folder limit."), { status: 422, code: "drive_tree_limit" });
            const children = await provider.listChildren({ parentId: parent.providerFolderId, includeTrashed: true });
            for (const item of children) {
              if (item.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
                files.push({ file: item, folder: parent });
                continue;
              }
              if (item.trashed) continue;
              const standard = parent.logicalKey === "project" ? expectedFolderIdentity(item.name, template) : null;
              const supplier = parent.logicalKey === "supplier_estimates" ? supplierIndex.match(item.name) : null;
              const previousLogicalKey = existingMappings.get(item.id);
              const logicalKey = standard?.logicalKey || (supplier ? supplierKey(supplier.name) : previousLogicalKey || discoveredFolderKey(item.id));
              const folderPath = `${parent.folderPath}/${item.name}`;
              const child = {
                providerFolderId: item.id,
                logicalKey,
                folderPath,
                documentType: standard?.documentType || (supplier ? "supplier_quotation" : documentTypeForLogicalKey(logicalKey, parent.documentType)),
                supplierId: supplier?.id || parent.supplierId,
                supplierName: supplier?.name || parent.supplierName,
                depth: parent.depth + 1,
              };
              folders.push({ logicalKey, name: item.name, parentLogicalKey: parent.logicalKey, providerFolderId: item.id, providerParentFolderId: parent.providerFolderId, folderPath });
              queue.push(child);
            }
          }
        }
      }
      await reconcileDiscovery({ accountId, estimateId, clientId: context.client_id, folders, files, syncId, timestamp });
      await writeSyncState({ accountId, estimateId, status: "synced", timestamp: new Date().toISOString() });
      return { estimateId, status: "synced", strategy: DRIVE_DISCOVERY_STRATEGY.current, nextChangeToken: null, foldersDiscovered: folders.length, filesDiscovered: files.length };
    } catch (error) {
      await writeSyncState({ accountId, estimateId, status: "failed", timestamp: new Date().toISOString(), errorMessage: error instanceof Error ? error.message : "Drive discovery failed." }).catch(() => {});
      throw error;
    }
  }

  async function syncDocuments({ enquiryId, estimateId, projectId, clientId } = {}) {
    const scope = enquiryId ? { kind: "enquiry", id: enquiryId, response: { enquiryId } } : estimateId ? { kind: "estimate", id: estimateId, response: { estimateId } } : projectId ? { kind: "project", id: projectId, response: { projectId } } : clientId ? { kind: "client", id: clientId, response: { clientId } } : null;
    if (!scope) throw Object.assign(new Error("enquiry_id, client_id, project_id or estimate_id is required."), { status: 400, code: "document_scope_required" });
    const workspaceStatus = await workspace.status(), accountId = workspaceStatus.account?.id || "unavailable", timestamp = new Date().toISOString();
    const writeCanonicalState = async (status, { errorMessage = null, details = {}, success = false } = {}) => db.run(`INSERT INTO canonical_document_sync_states(provider,provider_account_id,scope_kind,scope_id,strategy,status,last_attempt_at,last_success_at,error_message,details_json,updated_at)
      VALUES('google_drive',?,?,?,?,?,?,?, ?,?,?) ON CONFLICT(provider,provider_account_id,scope_kind,scope_id) DO UPDATE SET strategy=excluded.strategy,status=excluded.status,last_attempt_at=excluded.last_attempt_at,last_success_at=CASE WHEN excluded.last_success_at IS NOT NULL THEN excluded.last_success_at ELSE canonical_document_sync_states.last_success_at END,error_message=excluded.error_message,details_json=excluded.details_json,updated_at=excluded.updated_at`,
      accountId, scope.kind, scope.id, DRIVE_DISCOVERY_STRATEGY.current, status, timestamp, success ? timestamp : null, errorMessage, JSON.stringify(details), timestamp);
    await writeCanonicalState("syncing");
    try {
      let results;
      if (enquiryId) results = [await commercialDrive.discoverEnquiry(enquiryId)];
      else if (estimateId) results = [await discoverEstimate(estimateId)];
      else if (projectId) results = [await commercialDrive.discoverProject(projectId)];
      else {
        const projects = await db.all("SELECT id FROM projects WHERE client_id=? AND deleted_at IS NULL ORDER BY created_at", clientId);
        const estimates = await db.all("SELECT id FROM estimates WHERE client_id=? AND project_id IS NULL AND deleted_at IS NULL ORDER BY created_at", clientId);
        results = [];
        if (!projects.length) results.push(await commercialDrive.discoverClient(clientId));
        for (const project of projects) results.push(await commercialDrive.discoverProject(project.id));
        for (const estimate of estimates) results.push(await discoverEstimate(estimate.id));
      }
      const filesDiscovered = results.reduce((total, result) => total + Number(result.filesDiscovered || 0), 0);
      const status = results.some((result) => result.status === "project_assignment_pending") ? "project_assignment_pending"
        : results.some((result) => result.status === "client_folder_not_matched") ? "client_folder_not_matched"
          : results.every((result) => result.status === "synced") && filesDiscovered === 0 ? "synced_no_files"
            : results.some((result) => result.status === "review_required") ? "client_folder_not_matched"
              : "synced";
      const details = { filesDiscovered, results };
      await writeCanonicalState(status, { details, success: !["client_folder_not_matched"].includes(status) });
      return { scope: scope.response, status, filesDiscovered, results };
    } catch (reason) {
      await writeCanonicalState("failed", { errorMessage: reason instanceof Error ? reason.message : "Drive sync failed." });
      throw reason;
    }
  }

  return { provisionEstimate, fileSupplierAttachment, syncDocuments, discoverEstimate, status: workspace.status, localFolder };
}
