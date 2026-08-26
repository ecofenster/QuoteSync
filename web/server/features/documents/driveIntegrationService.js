import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";
import { createGoogleDriveProvider } from "./googleDriveProvider.js";

const DEFAULT_NAMES = Object.freeze({ drawingsClient: "Drawings (Client)", pdfTakeOffs: "PDF Auto Take Offs", drawingsEcofenster: "Drawings (Ecofenster)", supplierEstimates: "Estimates", invoices: "Invoices", pictures: "Pictures", videos: "Videos" });
const safeName = (value) => String(value || "Project").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160) || "Project";
const supplierKey = (name) => `supplier:${createHash("sha256").update(String(name).trim().toLowerCase()).digest("hex").slice(0, 16)}`;

export function createDriveIntegrationService(db, options = {}) {
  const workspace = createGoogleWorkspaceService(db, options), provider = createGoogleDriveProvider(workspace), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment);
  async function localFolder(estimateId, logicalKey) { return db.get("SELECT * FROM drive_project_folders WHERE provider='google_drive' AND estimate_id=? AND logical_key=?", estimateId, logicalKey); }
  async function ensure({ estimateId, logicalKey, name, parentLogicalKey, parentId }) {
    const saved = await localFolder(estimateId, logicalKey);
    if (saved) return saved;
    const folder = await provider.ensureFolder({ parentId, name, estimateId, logicalKey }), timestamp = new Date().toISOString(), id = randomUUID();
    await db.run(`INSERT INTO drive_project_folders(id,provider,estimate_id,logical_key,name,parent_logical_key,provider_folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,estimate_id,logical_key) DO NOTHING`, id, "google_drive", estimateId, logicalKey, name, parentLogicalKey ?? null, folder.id, timestamp, timestamp);
    return localFolder(estimateId, logicalKey);
  }
  async function estimateContext(estimateId) { return db.get(`SELECT e.id,e.estimate_ref,e.created_at,c.name client_name,c.project_name FROM estimates e JOIN clients c ON c.id=e.client_id WHERE e.id=? AND e.deleted_at IS NULL AND c.deleted_at IS NULL`, estimateId); }
  async function supplierNames(estimateId) { return (await db.all("SELECT DISTINCT supplier_name FROM supplier_quotes WHERE estimate_id=? AND archived_at IS NULL ORDER BY supplier_name", estimateId)).map((row) => row.supplier_name).filter(Boolean); }
  async function provisionEstimate(estimateId, extraSuppliers = []) {
    const status = await workspace.status();
    if (!status.connected) return { status: "disconnected", folders: [] };
    if (!status.estimatesRootFolderId) throw Object.assign(new Error("Google Drive Estimates root folder is not configured."), { status: 409, code: "drive_root_required" });
    const context = await estimateContext(estimateId); if (!context) throw Object.assign(new Error("Estimate not found."), { status: 404 });
    const config = (await workspace.resolvedConfig()).stored, template = { ...DEFAULT_NAMES, ...(config?.folder_template_json ? JSON.parse(config.folder_template_json) : {}) }, year = String(new Date(context.created_at).getFullYear()), projectName = safeName([context.client_name, context.project_name || context.estimate_ref].filter(Boolean).join(" - "));
    const folders = [];
    const yearFolder = await ensure({ estimateId, logicalKey: `year:${year}`, name: year, parentLogicalKey: "estimates_root", parentId: status.estimatesRootFolderId }); folders.push(yearFolder);
    const project = await ensure({ estimateId, logicalKey: "project", name: projectName, parentLogicalKey: `year:${year}`, parentId: yearFolder.provider_folder_id }); folders.push(project);
    const drawingsClient = await ensure({ estimateId, logicalKey: "drawings_client", name: template.drawingsClient, parentLogicalKey: "project", parentId: project.provider_folder_id }); folders.push(drawingsClient);
    folders.push(await ensure({ estimateId, logicalKey: "pdf_auto_take_offs", name: template.pdfTakeOffs, parentLogicalKey: "drawings_client", parentId: drawingsClient.provider_folder_id }));
    for (const [logicalKey, name] of [["drawings_ecofenster", template.drawingsEcofenster], ["supplier_estimates", template.supplierEstimates], ["invoices", template.invoices], ["pictures", template.pictures], ["videos", template.videos]]) folders.push(await ensure({ estimateId, logicalKey, name, parentLogicalKey: "project", parentId: project.provider_folder_id }));
    const supplierParent = folders.find((folder) => folder.logical_key === "supplier_estimates");
    for (const supplierName of [...new Set([...(await supplierNames(estimateId)), ...extraSuppliers].map((name) => String(name).trim()).filter(Boolean))]) folders.push(await ensure({ estimateId, logicalKey: supplierKey(supplierName), name: safeName(supplierName), parentLogicalKey: "supplier_estimates", parentId: supplierParent.provider_folder_id }));
    return { status: "provisioned", folders };
  }
  async function fileSupplierAttachment({ estimateId, quoteId, revisionId, attachmentId, supplierName }) {
    const existing = await db.get("SELECT * FROM drive_document_links WHERE provider='google_drive' AND source_attachment_id=?", attachmentId); if (existing) return existing;
    const provisioning = await provisionEstimate(estimateId, [supplierName]);
    if (provisioning.status === "disconnected") return { status: "pending_provider_connection", estimateId, attachmentId };
    const parent = await localFolder(estimateId, supplierKey(supplierName)), source = await db.get("SELECT original_file_name,media_type,storage_key FROM supplier_quote_attachments WHERE id=? AND estimate_id=?", attachmentId, estimateId);
    if (!parent || !source) throw Object.assign(new Error("Supplier attachment or Drive supplier folder is unavailable."), { status: 404 });
    const uploaded = await provider.uploadFile({ parentId: parent.provider_folder_id, fileName: source.original_file_name, mediaType: source.media_type, bytes: await readFile(resolveManagedPath(source.storage_key, attachmentRoot)), appProperties: { quotesuiteEstimateId: estimateId, quotesuiteSupplierQuoteId: quoteId, quotesuiteSupplierRevisionId: revisionId, quotesuiteSourceAttachmentId: attachmentId } });
    const timestamp = new Date().toISOString(), id = randomUUID(); await db.run(`INSERT INTO drive_document_links(id,provider,estimate_id,supplier_quote_id,supplier_revision_id,source_attachment_id,quotation_document_id,provider_file_id,provider_folder_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,source_attachment_id) DO NOTHING`, id, "google_drive", estimateId, quoteId, revisionId, attachmentId, null, uploaded.id, parent.provider_folder_id, timestamp);
    return db.get("SELECT * FROM drive_document_links WHERE provider='google_drive' AND source_attachment_id=?", attachmentId);
  }
  return { provisionEstimate, fileSupplierAttachment, status: workspace.status, localFolder };
}
