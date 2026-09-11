import { createHash, randomUUID } from "node:crypto";
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

const fileSize = (value) => Number(value || 0);
const lowerFileName = (value) => safeName(value).toLocaleLowerCase("en-GB");

export function classifySupplierDocumentConflict({ files = [], communicationAttachmentId, fileName, bytes }) {
  const sourceBytes = Buffer.from(bytes || []);
  const sourceMd5 = sourceBytes.length ? createHash("md5").update(sourceBytes).digest("hex") : null;
  const sourceSize = sourceBytes.length;
  const exactSource = files.find((file) => file.appProperties?.quotesuiteCommunicationAttachmentId === communicationAttachmentId);
  if (exactSource) return {
    kind: "already_filed",
    message: `This exact email attachment is already filed as “${exactSource.name}”.`,
    evidence: "The saved Drive file carries this retained email attachment identity.",
    existingFile: exactSource,
    recommendedDecision: "reuse_existing",
    decisions: ["reuse_existing"],
  };
  const identical = sourceMd5 ? files.find((file) => String(file.md5Checksum || "").toLowerCase() === sourceMd5 && fileSize(file.size) === sourceSize) : null;
  if (identical) return {
    kind: "identical_content",
    message: `Drive already contains byte-identical content as “${identical.name}”.`,
    evidence: "Provider checksum and file size match the selected retained attachment.",
    existingFile: identical,
    recommendedDecision: "reuse_identical",
    decisions: ["reuse_identical", "save_new_revision"],
  };
  const sameName = files.find((file) => lowerFileName(file.name) === lowerFileName(fileName));
  if (sameName) {
    const providerChecksum = String(sameName.md5Checksum || "").toLowerCase() || null;
    const differs = Boolean(sourceMd5 && providerChecksum && (providerChecksum !== sourceMd5 || fileSize(sameName.size) !== sourceSize));
    return {
      kind: differs ? "same_name_different_content" : "same_name_unverified",
      message: differs
        ? `Drive already contains “${sameName.name}”, but its content differs from the selected attachment.`
        : `Drive already contains “${sameName.name}”, but identical content cannot be confirmed.`,
      evidence: differs
        ? "The provider checksum or file size is different; this may be a supplier revision."
        : "A matching filename is not proof that supplier content is unchanged.",
      existingFile: sameName,
      recommendedDecision: "save_new_revision",
      decisions: ["save_new_revision"],
    };
  }
  return {
    kind: "new_file",
    message: "No matching retained attachment or filename was found in the destination.",
    evidence: "The selected document can be saved as a new supplier file.",
    existingFile: null,
    recommendedDecision: "save",
    decisions: ["save"],
  };
}

export function buildRevisionFileName(fileName, files = []) {
  const cleaned = safeName(fileName) || "Supplier document";
  const dot = cleaned.lastIndexOf(".");
  const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const extension = dot > 0 ? cleaned.slice(dot) : "";
  const names = new Set(files.map((file) => lowerFileName(file.name)));
  let revision = 2;
  while (names.has(lowerFileName(`${base} (revision ${revision})${extension}`))) revision += 1;
  return `${base} (revision ${revision})${extension}`;
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

  const folderPathWithProviderName = (path, providerName) => {
    const parts = String(path || "").split("/").filter(Boolean);
    if (!parts.length) return String(providerName || "");
    parts[parts.length - 1] = String(providerName || parts[parts.length - 1]);
    return parts.join("/");
  };

  async function refreshSavedFolder(saved, input) {
    if (typeof provider.getItem !== "function") return saved;
    let folder;
    try {
      folder = await provider.getItem({ fileId: saved.provider_folder_id });
    } catch (cause) {
      if (Number(cause?.status) === 404) throw error("The linked Drive folder is no longer available. Refresh Drive to reconcile its existing provider hierarchy before retrying; QuoteSuite will not create a duplicate folder.", 409, "drive_folder_mapping_unavailable");
      throw cause;
    }
    if (folder?.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE || folder.trashed) throw error("The linked Drive folder is no longer active. Refresh Drive to reconcile its existing provider hierarchy before retrying; QuoteSuite will not create a duplicate folder.", 409, "drive_folder_mapping_unavailable");
    if (input.parentId && !folder.parents?.includes(input.parentId)) throw error("The linked Drive folder has moved. Refresh Drive to confirm its current destination before retrying; QuoteSuite will not create a parallel hierarchy.", 409, "drive_folder_parent_changed");
    return recordFolder({ ...input, folder, path: folderPathWithProviderName(input.path, folder.name), provenance: saved.provenance || "provider_id" });
  }

  async function ensureFolder(input) {
    const saved = await mapping(input.entityKind, input.entityId, input.logicalKey);
    if (saved) return refreshSavedFolder(saved, input);
    let folder = await provider.findFolderByName({ parentId: input.parentId, name: input.name });
    if (!folder) folder = await provider.createFolder({ parentId: input.parentId, name: input.name, logicalKey: input.logicalKey, appProperties: { quotesuiteEntityKind: input.entityKind, quotesuiteEntityId: input.entityId } });
    return recordFolder({ ...input, folder, provenance: folder.appProperties?.quotesuiteEntityId ? "quotesuite" : "discovered_exact_name" });
  }

  async function ensureSupplierDocumentsFolder({ accountId, estimateId, estimateFolder }) {
    const logicalKey = "supplier_documents";
    const saved = await mapping("estimate", estimateId, logicalKey);
    if (saved) return refreshSavedFolder(saved, { accountId, entityKind: "estimate", entityId: estimateId, logicalKey, name: saved.name, parentId: estimateFolder.provider_folder_id, parentLogicalKey: "estimate", path: `${estimateFolder.folder_path}/${saved.name}` });
    const children = await provider.listChildren({ parentId: estimateFolder.provider_folder_id });
    const aliases = children.filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && ["supplier", "suppliers"].includes(normalized(item.name)));
    if (aliases.length > 1) throw error("Both Supplier and Suppliers folders exist beneath this Estimate. Review the provider hierarchy before filing.", 409, "supplier_documents_folder_ambiguous");
    if (aliases.length === 1) return recordFolder({ accountId, entityKind: "estimate", entityId: estimateId, logicalKey, name: aliases[0].name, parentLogicalKey: "estimate", folder: aliases[0], parentId: estimateFolder.provider_folder_id, path: `${estimateFolder.folder_path}/${aliases[0].name}`, provenance: "discovered_supplier_alias" });
    return ensureFolder({ accountId, entityKind: "estimate", entityId: estimateId, logicalKey, name: "Suppliers", parentId: estimateFolder.provider_folder_id, parentLogicalKey: "estimate", path: `${estimateFolder.folder_path}/Suppliers` });
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

  async function providerFolderPath(folderId, rootId, cache) {
    const names = [], seen = new Set();
    let currentId = folderId;
    while (currentId && currentId !== rootId) {
      if (seen.has(currentId) || seen.size >= 32) throw error("Drive folder ancestry could not be resolved safely.", 409, "drive_folder_ancestry_invalid");
      seen.add(currentId);
      let item = cache.get(currentId);
      if (item === undefined) {
        try { item = await provider.getItem({ fileId: currentId }); }
        catch (cause) { if (Number(cause?.status) === 404) item = null; else throw cause; }
        cache.set(currentId, item);
      }
      if (!item || item.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE || item.trashed) return null;
      names.push(item.name);
      currentId = item.parents?.[0] || null;
    }
    return currentId === rootId ? names.reverse().join("/") : null;
  }

  async function refreshProjectFolderMetadata(projectId, root) {
    if (typeof provider.getItem !== "function") return { status: "unsupported", changed: 0, rebound: 0 };
    const rows = await db.all(`SELECT f.* FROM canonical_drive_folders f
      WHERE f.provider='google_drive' AND f.removed_at IS NULL AND (
        (f.entity_kind='project' AND f.entity_id=?) OR
        (f.entity_kind='estimate' AND f.entity_id IN (SELECT id FROM estimates WHERE project_id=?))
      ) ORDER BY f.created_at`, projectId, projectId);
    if (!rows.length) return { status: "unchanged", changed: 0, rebound: 0 };
    const cache = new Map(), rowItems = new Map();
    for (const row of rows) {
      let item = null;
      try { item = await provider.getItem({ fileId: row.provider_folder_id }); }
      catch (cause) { if (Number(cause?.status) !== 404) throw cause; }
      cache.set(row.provider_folder_id, item);
      rowItems.set(row.id, item);
    }
    const projectRow = rows.find((row) => row.entity_kind === "project" && row.logical_key === "project");
    const clientRow = rows.find((row) => row.entity_kind === "project" && row.logical_key === "client");
    const yearRow = rows.find((row) => row.entity_kind === "project" && row.logical_key.startsWith("year:"));
    const projectItem = projectRow ? rowItems.get(projectRow.id) : null;
    let rebound = 0;
    if (projectItem && !projectItem.trashed && clientRow && yearRow) {
      const actualParentId = projectItem.parents?.[0] || null;
      if (actualParentId && actualParentId !== yearRow.provider_folder_id && actualParentId !== clientRow.provider_folder_id) {
        let actualClient = cache.get(actualParentId);
        if (actualClient === undefined) {
          try { actualClient = await provider.getItem({ fileId: actualParentId }); }
          catch (cause) { if (Number(cause?.status) === 404) actualClient = null; else throw cause; }
          cache.set(actualParentId, actualClient);
        }
        if (actualClient?.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && !actualClient.trashed && actualClient.parents?.includes(yearRow.provider_folder_id)) {
          rowItems.set(clientRow.id, actualClient);
          rebound = 1;
        }
      }
    }
    const timestamp = now().toISOString();
    let changed = 0;
    for (const row of rows) {
      const item = rowItems.get(row.id);
      if (!item || item.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE || item.trashed) continue;
      const path = await providerFolderPath(item.id, root.rootId, cache);
      if (!path) continue;
      const parentId = item.parents?.[0] || null;
      const differs = row.provider_folder_id !== item.id || row.provider_parent_folder_id !== parentId || row.name !== item.name || row.folder_path !== path;
      if (differs) changed += 1;
      await db.run(`UPDATE canonical_drive_folders SET provider_account_id=?,provider_folder_id=?,provider_parent_folder_id=?,name=?,folder_path=?,provenance=CASE WHEN provider_folder_id<>? THEN 'provider_parent_reconciled' ELSE provenance END,last_seen_at=?,removed_at=NULL,updated_at=? WHERE id=?`, root.workspaceStatus.account?.id || row.provider_account_id || null, item.id, parentId, item.name, path, item.id, timestamp, timestamp, row.id);
      await db.run("UPDATE canonical_documents SET folder_path=?,updated_at=? WHERE provider='google_drive' AND provider_folder_id=? AND (project_id=? OR estimate_id IN (SELECT id FROM estimates WHERE project_id=?))", path, timestamp, item.id, projectId, projectId);
      await db.run("UPDATE drive_project_folders SET name=?,provider_parent_folder_id=?,folder_path=?,last_seen_at=?,updated_at=? WHERE provider='google_drive' AND provider_folder_id=? AND estimate_id IN (SELECT id FROM estimates WHERE project_id=?)", item.name, parentId, path, timestamp, timestamp, item.id, projectId).catch(() => {});
      await db.run("UPDATE drive_discovered_documents SET folder_path=?,updated_at=? WHERE provider='google_drive' AND provider_folder_id=? AND (project_id=? OR estimate_id IN (SELECT id FROM estimates WHERE project_id=?))", path, timestamp, item.id, projectId, projectId).catch(() => {});
    }
    return { status: "refreshed", changed, rebound };
  }

  async function refreshStandaloneFolderMetadata(entityKind, entityId, root) {
    if (typeof provider.getItem !== "function") return { status: "unsupported", changed: 0, rebound: 0 };
    const rows = await db.all("SELECT * FROM canonical_drive_folders WHERE provider='google_drive' AND entity_kind=? AND entity_id=? AND removed_at IS NULL ORDER BY created_at", entityKind, entityId);
    const cache = new Map(), timestamp = now().toISOString();
    let changed = 0;
    for (const row of rows) {
      let item;
      try { item = await provider.getItem({ fileId: row.provider_folder_id }); }
      catch (cause) { if (Number(cause?.status) === 404) continue; throw cause; }
      cache.set(item.id, item);
      if (item.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE || item.trashed) continue;
      const path = await providerFolderPath(item.id, root.rootId, cache);
      if (!path) continue;
      const parentId = item.parents?.[0] || null;
      if (row.provider_parent_folder_id !== parentId || row.name !== item.name || row.folder_path !== path) changed += 1;
      await db.run("UPDATE canonical_drive_folders SET provider_account_id=?,provider_parent_folder_id=?,name=?,folder_path=?,last_seen_at=?,removed_at=NULL,updated_at=? WHERE id=?", root.workspaceStatus.account?.id || row.provider_account_id || null, parentId, item.name, path, timestamp, timestamp, row.id);
      const scopeColumn = entityKind === "enquiry" ? "enquiry_id" : "client_id";
      await db.run(`UPDATE canonical_documents SET folder_path=?,updated_at=? WHERE provider='google_drive' AND provider_folder_id=? AND ${scopeColumn}=?`, path, timestamp, item.id, entityId);
    }
    return { status: "refreshed", changed, rebound: 0 };
  }

  async function refreshScopeFolderMetadata(input = {}) {
    const kind = input.enquiryId ? "enquiry" : "project", root = await availableRoot(kind);
    if (!root.rootId) return { status: root.status, changed: 0, rebound: 0 };
    if (input.enquiryId) return refreshStandaloneFolderMetadata("enquiry", input.enquiryId, root);
    let projectIds = [];
    if (input.estimateId) projectIds = (await db.all("SELECT project_id FROM estimates WHERE id=? AND project_id IS NOT NULL", input.estimateId)).map((row) => row.project_id);
    else if (input.projectId) projectIds = [input.projectId];
    else if (input.clientId) projectIds = (await db.all("SELECT id FROM projects WHERE client_id=? AND deleted_at IS NULL ORDER BY created_at", input.clientId)).map((row) => row.id);
    const results = [];
    for (const projectId of [...new Set(projectIds.filter(Boolean))]) results.push(await refreshProjectFolderMetadata(projectId, root));
    if (input.clientId) results.push(await refreshStandaloneFolderMetadata("client", input.clientId, root));
    return { status: results.some((item) => item.status === "refreshed") ? "refreshed" : results[0]?.status || "unchanged", changed: results.reduce((sum, item) => sum + Number(item.changed || 0), 0), rebound: results.reduce((sum, item) => sum + Number(item.rebound || 0), 0) };
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
    await refreshProjectFolderMetadata(projectId, root);
    const year = String(context.context_year || now().getUTCFullYear()), accountId = root.workspaceStatus.account?.id || null;
    const yearFolder = await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: `year:${year}`, name: year, parentId: root.rootId, parentLogicalKey: "estimates_root", path: year });
    const clientName = buildCanonicalClientFolderName(context.client_ref, context.client_name);
    const clientFolder = await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: "client", name: clientName, parentId: yearFolder.provider_folder_id, parentLogicalKey: `year:${year}`, path: `${yearFolder.folder_path}/${clientName}` });
    const projectName = safeName(context.name);
    const projectFolder = await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey: "project", name: projectName, parentId: clientFolder.provider_folder_id, parentLogicalKey: "client", path: `${clientFolder.folder_path}/${projectName}` });
    const config = (await workspace.resolvedConfig()).stored;
    const template = { ...DEFAULT_PROJECT_FOLDER_NAMES, ...(config?.folder_template_json ? JSON.parse(config.folder_template_json) : {}) };
    const folders = [yearFolder, clientFolder, projectFolder];
    for (const [logicalKey, name] of [["drawings_client", template.drawingsClient], ["drawings_ecofenster", template.drawingsEcofenster], ["estimates", template.supplierEstimates], ["invoices", template.invoices], ["orders", template.orders]]) {
      folders.push(await ensureFolder({ accountId, entityKind: "project", entityId: projectId, logicalKey, name, parentId: projectFolder.provider_folder_id, parentLogicalKey: "project", path: `${projectFolder.folder_path}/${name}` }));
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
    const folder = await ensureFolder({ accountId: projectResult.folders[0]?.provider_account_id || null, entityKind: "estimate", entityId: estimateId, logicalKey: "estimate", name: folderName, parentId: estimatesFolder.provider_folder_id, parentLogicalKey: "estimates", path: `${estimatesFolder.folder_path}/${folderName}` });
    return { status: "provisioned", estimateId, folder };
  }

  async function communicationSupplierContext(input) {
    const clientId = String(input.clientId || ""), projectId = String(input.projectId || ""), estimateId = String(input.estimateId || ""), supplierCode = String(input.supplierCode || "");
    const context = await db.get(`SELECT e.id estimate_id,e.estimate_ref,e.created_at,e.project_id,p.client_id,p.name project_name,p.context_year,c.client_ref,c.name client_name
      FROM estimates e JOIN projects p ON p.id=e.project_id JOIN clients c ON c.id=p.client_id
      WHERE e.id=? AND e.deleted_at IS NULL AND p.id=? AND p.deleted_at IS NULL AND c.id=? AND c.deleted_at IS NULL`, estimateId, projectId, clientId);
    if (!context) throw error("The selected Client, Project and Estimate do not form a canonical filing path.", 422, "communication_assignment_path_conflict");
    const supplier = await db.get(`SELECT supplier_code,supplier_name FROM supplier_commercial_defaults WHERE supplier_code=?
      AND NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN ('FACTORY PRICE','1 TO 1 PRICING','STAGED DISCOUNT'))`, supplierCode);
    if (!supplier) throw error("The selected Supplier is unavailable.", 404, "communication_assignment_supplier_not_found");
    return { clientId, projectId, estimateId, supplierCode, context, supplier };
  }

  async function existingSupplierFolder({ projectId, estimateId, supplier }) {
    await refreshScopeFolderMetadata({ estimateId });
    const mapped = await mapping("estimate", estimateId, `supplier:${supplier.supplier_code}`);
    if (mapped) return mapped;
    const estimateFolder = await mapping("estimate", estimateId, "estimate");
    if (!estimateFolder) return null;
    const estimateChildren = await provider.listChildren({ parentId: estimateFolder.provider_folder_id });
    const roots = estimateChildren.filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && ["supplier", "suppliers"].includes(normalized(item.name)));
    if (roots.length > 1) throw error("Both Supplier and Suppliers folders exist beneath this Estimate. Review the provider hierarchy before filing.", 409, "supplier_documents_folder_ambiguous");
    if (!roots.length) return null;
    const matches = (await provider.listChildren({ parentId: roots[0].id })).filter((item) => item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE && normalized(item.name) === normalized(supplier.supplier_name));
    if (matches.length > 1) throw error(`More than one ${supplier.supplier_name} folder exists beneath ${roots[0].name}. Review the provider hierarchy before filing.`, 409, "supplier_folder_ambiguous");
    if (!matches.length) return null;
    return { provider_folder_id: matches[0].id, provider_account_id: estimateFolder.provider_account_id, folder_path: `${estimateFolder.folder_path}/${roots[0].name}/${matches[0].name}`, name: matches[0].name, discovered: true, projectId };
  }

  async function reviewCommunicationSupplierDocument(input) {
    const { clientId, projectId, estimateId, supplierCode, context, supplier } = await communicationSupplierContext(input);
    if (!input.communicationAttachmentId || !input.providerMessageId || !input.providerAttachmentId) throw error("Choose a retained email document before checking the destination.", 422, "communication_assignment_attachment_required");
    const bytes = Buffer.from(input.bytes || []);
    if (!bytes.length) throw error("The selected email document has no retained content.", 409, "source_attachment_unavailable");
    const folder = await existingSupplierFolder({ projectId, estimateId, supplier });
    const year = String(context.context_year || resolveEstimateYear(context.estimate_ref, context.created_at));
    const config = (await workspace.resolvedConfig()).stored;
    const template = { ...DEFAULT_PROJECT_FOLDER_NAMES, ...(config?.folder_template_json ? JSON.parse(config.folder_template_json) : {}) };
    const supplierRows = await db.all("SELECT DISTINCT supplier_name FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL ORDER BY supplier_name", estimateId).catch(() => []);
    const descriptor = supplierRows.map((row) => clean(row.supplier_name)).filter(Boolean).join(" + ");
    const expectedPath = `${year}/${buildCanonicalClientFolderName(context.client_ref, context.client_name)}/${safeName(context.project_name)}/${safeName(template.supplierEstimates)}/${buildCanonicalEstimateFolderName(context.estimate_ref, descriptor)}/Suppliers/${safeName(supplier.supplier_name)}`;
    const files = folder ? await provider.listChildren({ parentId: folder.provider_folder_id }) : [];
    const conflict = classifySupplierDocumentConflict({ files, communicationAttachmentId: String(input.communicationAttachmentId), fileName: input.fileName, bytes });
    return {
      status: "reviewed",
      destinationExists: Boolean(folder),
      folderPath: folder?.folder_path || expectedPath,
      clientId,
      projectId,
      estimateId,
      supplierCode,
      supplierName: supplier.supplier_name,
      fileName: String(input.fileName || "Supplier document"),
      conflict: {
        kind: conflict.kind,
        message: conflict.message,
        evidence: conflict.evidence,
        existingFile: conflict.existingFile ? { id: conflict.existingFile.id, name: conflict.existingFile.name, webViewLink: conflict.existingFile.webViewLink || null } : null,
        recommendedDecision: conflict.recommendedDecision,
        decisions: conflict.decisions,
      },
    };
  }

  async function storeCommunicationSupplierDocument(input) {
    const { clientId, projectId, estimateId, supplierCode, supplier } = await communicationSupplierContext(input), sourceAttachmentId = String(input.communicationAttachmentId || "");
    if (!sourceAttachmentId || !input.providerMessageId || !input.providerAttachmentId) throw error("Choose a retained email document before filing.", 422, "communication_assignment_attachment_required");
    const provisioned = await provisionEstimate(estimateId);
    if (provisioned.status !== "provisioned") return { ...provisioned, stored: false };
    const accountId = provisioned.folder.provider_account_id || null, supplierName = safeName(supplier.supplier_name);
    const supplierRoot = await ensureSupplierDocumentsFolder({ accountId, estimateId, estimateFolder: provisioned.folder });
    const supplierFolder = await ensureFolder({ accountId, entityKind: "estimate", entityId: estimateId, logicalKey: `supplier:${supplier.supplier_code}`, name: supplierName, parentId: supplierRoot.provider_folder_id, parentLogicalKey: "supplier_documents", path: `${supplierRoot.folder_path}/${supplierName}` });
    const existingFiles = await provider.listChildren({ parentId: supplierFolder.provider_folder_id });
    const bytes = Buffer.from(input.bytes || []);
    if (!bytes.length) throw error("The selected email document has no retained content.", 409, "source_attachment_unavailable");
    const conflict = classifySupplierDocumentConflict({ files: existingFiles, communicationAttachmentId: sourceAttachmentId, fileName: input.fileName, bytes });
    const decision = String(input.fileDecision || "");
    if (!conflict.decisions.includes(decision) && !(conflict.kind === "new_file" && !decision) && !(conflict.kind === "already_filed" && !decision)) {
      throw Object.assign(error("The destination changed or this file choice still needs review. Check the existing file and choose how to continue.", 409, "communication_assignment_file_review_required"), {
        details: { folderPath: supplierFolder.folder_path, fileName: input.fileName, conflict: { kind: conflict.kind, message: conflict.message, evidence: conflict.evidence, recommendedDecision: conflict.recommendedDecision, decisions: conflict.decisions } },
      });
    }
    let uploaded = conflict.kind === "already_filed" ? conflict.existingFile : conflict.kind === "identical_content" && decision === "reuse_identical" ? conflict.existingFile : null;
    let duplicate = Boolean(uploaded);
    if (!uploaded) {
      const uploadName = decision === "save_new_revision" ? buildRevisionFileName(input.fileName, existingFiles) : safeName(input.fileName) || "Supplier document";
      uploaded = await provider.uploadFile({ parentId: supplierFolder.provider_folder_id, fileName: uploadName, mediaType: input.mediaType || "application/octet-stream", bytes, appProperties: { quotesuiteCommunicationAttachmentId: sourceAttachmentId, quotesuiteEstimateId: estimateId, quotesuiteSupplierCode: supplier.supplier_code } });
    }
    const timestamp = now().toISOString(), documentId = randomUUID();
    try {
      await db.run(`INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,provider_folder_id,enquiry_id,client_id,project_id,estimate_id,order_id,supplier_id,supplier_quotation_id,document_type,file_name,mime_type,size_bytes,provider_created_at,provider_modified_at,provider_version,provider_revision,checksum,web_view_link,folder_path,trashed,removed_at,discovered_at,last_seen_at,updated_at)
        VALUES(?,'google_drive',?,?,?,NULL,?,?,?,NULL,?,NULL,'supplier_quotation',?,?,?,?,?,?,?,?,?,?,0,NULL,?,?,?)
        ON CONFLICT(provider,provider_account_id,provider_file_id) DO UPDATE SET provider_folder_id=excluded.provider_folder_id,client_id=excluded.client_id,project_id=excluded.project_id,estimate_id=excluded.estimate_id,supplier_id=excluded.supplier_id,document_type='supplier_quotation',file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,provider_modified_at=excluded.provider_modified_at,provider_version=excluded.provider_version,provider_revision=excluded.provider_revision,checksum=excluded.checksum,web_view_link=excluded.web_view_link,folder_path=excluded.folder_path,trashed=0,removed_at=NULL,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`,
        documentId,accountId || "",uploaded.id,supplierFolder.provider_folder_id,clientId,projectId,estimateId,supplier.supplier_code,uploaded.name || input.fileName,uploaded.mimeType || input.mediaType || "application/octet-stream",Number(uploaded.size || input.sizeBytes || 0),uploaded.createdTime || timestamp,uploaded.modifiedTime || timestamp,uploaded.version == null ? null : String(uploaded.version),uploaded.version == null ? null : String(uploaded.version),uploaded.md5Checksum || null,uploaded.webViewLink || null,supplierFolder.folder_path,timestamp,timestamp,timestamp);
    } catch (cause) {
      throw Object.assign(new Error("The provider file was saved, but QuoteSuite could not finish its canonical document record. Retry safely to reuse the same provider file."), { status: 409, code: "communication_assignment_partial_success", cause, details: { providerFileId: uploaded.id, webViewLink: uploaded.webViewLink || null, folderPath: supplierFolder.folder_path, fileName: uploaded.name || input.fileName } });
    }
    const document = await db.get("SELECT * FROM canonical_documents WHERE provider='google_drive' AND provider_account_id=? AND provider_file_id=?", accountId || "", uploaded.id);
    return { status: "stored", stored: true, duplicate, fileOutcome: conflict.kind, decision: duplicate ? (conflict.kind === "identical_content" ? "reuse_identical" : "reuse_existing") : decision || "save", documentId: document.id, providerFileId: uploaded.id, fileName: document.file_name, webViewLink: uploaded.webViewLink || null, folderPath: supplierFolder.folder_path, clientId, projectId, estimateId, supplierCode: supplier.supplier_code, supplierName: supplier.supplier_name };
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

  return { provisionEnquiry, discoverEnquiry, discoverClient, provisionProject, storeReviewedEnquiryAttachments, provisionEstimate, reviewCommunicationSupplierDocument, storeCommunicationSupplierDocument, discoverProject, refreshScopeFolderMetadata, buildCanonicalClientFolderName, buildCanonicalEstimateFolderName };
}

const clean = (value) => String(value || "").trim();
