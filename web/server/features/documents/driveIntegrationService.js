import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";
import { createGoogleDriveProvider } from "./googleDriveProvider.js";

export const DEFAULT_PROJECT_FOLDER_NAMES = Object.freeze({ drawingsClient: "Drawings (Client)", drawingsEcofenster: "Drawings (Ecofenster)", supplierEstimates: "Estimates", invoices: "Invoices", orders: "Orders" });
const safeName = (value) => String(value || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160);
const supplierKey = (name) => `supplier:${createHash("sha256").update(String(name).trim().toLowerCase()).digest("hex").slice(0, 16)}`;

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
  const workspace = createGoogleWorkspaceService(db, options), provider = createGoogleDriveProvider(workspace), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment);
  async function localFolder(estimateId, logicalKey) { return db.get("SELECT * FROM drive_project_folders WHERE provider='google_drive' AND estimate_id=? AND logical_key=?", estimateId, logicalKey); }
  async function ensure({ estimateId, logicalKey, name, parentLogicalKey, parentId, discovery, estimateReference }) {
    const saved = await localFolder(estimateId, logicalKey);
    if (saved) return saved;
    const folder = await provider.ensureFolder({ parentId, name, estimateId, logicalKey, discovery, estimateReference }), timestamp = new Date().toISOString(), id = randomUUID();
    await db.run(`INSERT INTO drive_project_folders(id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,estimate_id,logical_key) DO NOTHING`, id, "google_drive", estimateId, logicalKey, folder.name || name, parentLogicalKey ?? null, folder.id, timestamp, timestamp);
    return localFolder(estimateId, logicalKey);
  }
  async function estimateContext(estimateId) { return db.get(`SELECT e.id,e.estimate_ref,e.created_at,c.name client_name,c.project_name FROM estimates e JOIN clients c ON c.id=e.client_id WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL`, estimateId); }
  async function supplierNames(estimateId) { return (await db.all("SELECT DISTINCT supplier_name FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL ORDER BY supplier_name", estimateId)).map((row) => row.supplier_name).filter(Boolean); }
  async function canonicalSupplierName({ estimateId, quoteId, fallback }) {
    const quote = quoteId ? await db.get("SELECT supplier_name FROM supplier_quotes WHERE id=? AND estimate_id=? AND archived_at IS NULL", quoteId, estimateId) : null;
    return String(quote?.supplier_name || fallback || "").trim();
  }
  async function provisionEstimate(estimateId, extraSuppliers = []) {
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
  return { provisionEstimate, fileSupplierAttachment, status: workspace.status, localFolder };
}
