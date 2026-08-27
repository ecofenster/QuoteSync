import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import type { CanonicalDocumentRecord, CanonicalFolderRecord, DocumentRecordsResult } from "../src/services/documents/documentRecordsApi.ts";
import { backExplorerHistory, buildFileExplorer, createExplorerHistory, explorerBreadcrumbs, explorerDirectory, forwardExplorerHistory, navigateExplorerHistory, providerItemKey, resolveFolderUploadCapability, searchFileExplorer } from "../src/features/documents/fileExplorerModel.ts";

const folder = (id:string, name:string, parent:string|null, logicalKey:string, entityKind:CanonicalFolderRecord["entityKind"] = "client", entityId = "client-fixture"):CanonicalFolderRecord => ({ id:`row-${id}`, provider:"google_drive", providerAccountId:"fixture-account", providerFolderId:id, providerParentFolderId:parent, entityKind, entityId, parentLogicalKey:null, logicalKey, name, clientId:"client-fixture", projectId:entityKind === "project" ? entityId : null, estimateId:entityKind === "estimate" ? entityId : null, estimateRef:"", projectName:"", provenance:"fixture", modifiedAt:"2026-08-27T10:00:00.000Z", folderPath:name, capabilities:{upload:true,uploadState:"writable"} });
const document = (id:string, parent:string, overrides:Partial<CanonicalDocumentRecord> = {}):CanonicalDocumentRecord => ({ id:`document-${id}`, provider:"google_drive", providerAccountId:"fixture-account", providerFileId:id, providerFolderId:parent, clientId:"client-fixture", projectId:null, estimateId:null, orderId:null, supplierId:null, supplierName:null, documentType:"client_document", revision:"Drive current", reference:"", fileName:`${id}.pdf`, mediaType:"application/pdf", sizeBytes:1024, sha256:null, estimateRef:"", projectName:"", folder:"Fixture", status:"discovered", createdAt:"2026-08-27T10:00:00.000Z", modifiedAt:"2026-08-27T10:00:00.000Z", downloadUrl:null, openUrl:`https://example.test/${id}`, ...overrides });
const result = (scope:DocumentRecordsResult["scope"], folders:CanonicalFolderRecord[], documents:CanonicalDocumentRecord[]):DocumentRecordsResult => ({ scope, folders, documents, sync:{ state:"synced", strategy:"full_enumeration", lastAttemptAt:null, lastSuccessAt:"2026-08-27T10:00:00.000Z", error:null, cached:true } });

test("Client Files defaults to its single provider Client root and renders only direct children with folders first", () => {
  const folders = [folder("client-root", "EF-CL-900 - Fixture Client", "year-2026", "client_root"), folder("drawings", "Drawings (Client)", "client-root", "drawings_client"), folder("estimates", "Estimates", "client-root", "estimates"), folder("supplier", "Fixture Supplier", "estimates", "supplier")];
  const model = buildFileExplorer(result({clientId:"client-fixture"}, folders, [document("root-file", "client-root"), document("nested-file", "supplier", {projectId:null})]), "Client Files");
  assert.equal(model.preferredFolderKey, providerItemKey("google_drive", "fixture-account", "client-root"));
  assert.deepEqual(explorerDirectory(model, model.preferredFolderKey).map((entry) => entry.kind === "folder" ? entry.folder.name : entry.document.fileName), ["Drawings (Client)", "Estimates", "root-file.pdf"]);
  assert.equal(explorerDirectory(model, model.preferredFolderKey).some((entry) => entry.kind === "file" && entry.document.fileName === "nested-file.pdf"), false);
  assert.equal(model.files.get("document-nested-file")?.document.projectId, null);
  assert.deepEqual(explorerBreadcrumbs(model, providerItemKey("google_drive", "fixture-account", "supplier")).map((item) => item.label), ["Client Files", "EF-CL-900 - Fixture Client", "Estimates", "Fixture Supplier"]);
});

test("multiple Client roots remain separated while Project and Estimate scopes start at their closest canonical folder", () => {
  const clientFolders = [folder("client-2025", "Fixture Client 2025", "year-2025", "client_root:2025"), folder("client-2026", "Fixture Client 2026", "year-2026", "client_root:2026")];
  const clientModel = buildFileExplorer(result({clientId:"client-fixture"}, clientFolders, []), "Client Files");
  assert.equal(clientModel.preferredFolderKey, clientModel.virtualRootKey);
  assert.equal(explorerDirectory(clientModel, clientModel.virtualRootKey).length, 2);

  const projectFolders = [folder("year", "2026", null, "year:2026", "project", "project-fixture"), folder("client", "Fixture Client", "year", "client", "project", "project-fixture"), folder("project", "Garden Room", "client", "project", "project", "project-fixture"), folder("project-estimates", "Estimates", "project", "estimates", "project", "project-fixture")];
  const projectModel = buildFileExplorer(result({projectId:"project-fixture"}, projectFolders, []), "Project Files");
  assert.equal(projectModel.preferredFolderKey, providerItemKey("google_drive", "fixture-account", "project"));

  const fallbackEstimate = buildFileExplorer(result({estimateId:"estimate-fixture"}, projectFolders, []), "Estimate Files / Documents");
  assert.equal(fallbackEstimate.preferredFolderKey, providerItemKey("google_drive", "fixture-account", "project-estimates"));
  const estimateFolder = folder("estimate", "EF-EST-2026-900 - Fixture", "project-estimates", "estimate", "estimate", "estimate-fixture");
  const canonicalEstimate = buildFileExplorer(result({estimateId:"estimate-fixture"}, [...projectFolders, estimateFolder], []), "Estimate Files / Documents");
  assert.equal(canonicalEstimate.preferredFolderKey, providerItemKey("google_drive", "fixture-account", "estimate"));
});

test("provider IDs preserve identity through rename and move, update parentage and avoid duplicate files", () => {
  const initialFolders = [folder("root", "Original Client", null, "client_root"), folder("left", "Left", "root", "left"), folder("right", "Right", "root", "right")];
  const initial = buildFileExplorer(result({clientId:"client-fixture"}, initialFolders, [document("same-file", "left")]), "Client Files");
  const renamedMovedFolders = [folder("root", "Renamed Client", null, "client_root"), folder("left", "Renamed Left", "root", "left"), folder("right", "Right", "root", "right")];
  const updated = buildFileExplorer(result({clientId:"client-fixture"}, renamedMovedFolders, [document("same-file", "right", {fileName:"Renamed file.pdf"})]), "Client Files");
  assert.equal(initial.preferredFolderKey, updated.preferredFolderKey);
  assert.equal(updated.folders.get(providerItemKey("google_drive", "fixture-account", "left"))?.folder.name, "Renamed Left");
  assert.equal(updated.files.size, 1);
  assert.equal(updated.files.get("document-same-file")?.parentKey, providerItemKey("google_drive", "fixture-account", "right"));
});

test("explorer history provides independent Back, Forward and breadcrumb/Up parent navigation", () => {
  let history = createExplorerHistory("root");
  history = navigateExplorerHistory(history, "estimates");
  history = navigateExplorerHistory(history, "supplier");
  assert.deepEqual(history, {entries:["root", "estimates", "supplier"], index:2});
  history = backExplorerHistory(history); assert.equal(history.entries[history.index], "estimates");
  history = forwardExplorerHistory(history); assert.equal(history.entries[history.index], "supplier");
  history = navigateExplorerHistory(backExplorerHistory(history), "drawings");
  assert.deepEqual(history, {entries:["root", "estimates", "drawings"], index:2});
});

test("Folder-mode search spans cached descendants without changing physical hierarchy", () => {
  const folders = [folder("root", "Fixture Client", null, "client_root"), folder("estimates", "Estimates", "root", "estimates"), folder("supplier", "Zyle Fenster", "estimates", "supplier")];
  const model = buildFileExplorer(result({clientId:"client-fixture"}, folders, [document("quotation", "supplier", {fileName:"Quotation 900.pdf", supplierName:"Zyle Fenster", documentType:"supplier_quotation"})]), "Client Files");
  assert.deepEqual(searchFileExplorer(model, "zyle").map((entry) => entry.kind), ["folder", "file"]);
  assert.equal(explorerDirectory(model, providerItemKey("google_drive", "fixture-account", "root")).some((entry) => entry.kind === "file"), false);
});

test("Files UI keeps Folders as default, retains All Documents, selection/details, accessible navigation and responsive theme structure", async () => {
  const [panel, explorer, css] = await Promise.all([readFile("src/features/documents/CanonicalDocumentsPanel.tsx", "utf8"), readFile("src/features/documents/HierarchicalFileExplorer.tsx", "utf8"), readFile("src/features/documents/canonicalDocuments.css", "utf8")]);
  assert.match(panel, /useState<"folders"\|"documents">\("folders"\)/);
  assert.match(panel, />Folders<.*>All Documents</s);
  for (const control of ["Back", "Forward", "Up one folder", "File location", "aria-current", "aria-pressed"]) assert.match(explorer, new RegExp(control));
  assert.match(explorer, /Selected file details/);
  assert.match(explorer, /Preview unavailable/);
  assert.match(explorer, /sandbox=""/);
  assert.match(panel, /All suppliers/); assert.match(panel, /All projects/); assert.match(panel, /All estimates/); assert.match(panel, /All providers/);
  for (const token of ["--qs-bg-card", "--qs-bg-surface-elevated", "--qs-theme-text", "--qs-border-standard", "--qs-bg-row-hover"]) assert.match(css, new RegExp(token));
  assert.match(css, /\.file-explorer__row:focus-visible/);
  assert.match(css, /\.file-explorer__row\.is-selected/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /background:\s*white|#f2f4f7|#d0d5dd/i);
});

test("Files upload is current-folder provider-backed, multi-file, retryable and updates the canonical projection",async()=>{
  const [explorer,api,route,service,css]=await Promise.all([readFile("src/features/documents/HierarchicalFileExplorer.tsx","utf8"),readFile("src/services/documents/documentRecordsApi.ts","utf8"),readFile("server/routes/documents.js","utf8"),readFile("server/features/documents/documentUploadService.js","utf8"),readFile("src/features/documents/canonicalDocuments.css","utf8")]);
  assert.match(explorer,/resolveFolderUploadCapability\(currentFolder\)/);assert.match(explorer,/type="file" multiple/);assert.match(explorer,/onDragEnter/);assert.match(explorer,/onDrop/);assert.match(explorer,/queued/);assert.match(explorer,/Uploading…/);assert.match(explorer,/Uploaded/);assert.match(explorer,/failed/);assert.match(explorer,/Retry/);assert.match(explorer,/onRecordsUpdated\(uploaded\.records\)/);
  assert.match(api,/FormData/);assert.match(api,/provider_folder_id/);assert.match(route,/multer\.memoryStorage/);assert.match(route,/MAX_DOCUMENT_UPLOAD_BYTES/);assert.match(service,/binaryStoredByQuoteSuite:false/);assert.match(service,/provider_creates_separate_file/);assert.match(service,/if \(!uploaded\?\.id\)/);assert.match(service,/canonical_documents/);assert.doesNotMatch(service,/writeFile|storage_key/);
  assert.match(css,/file-explorer__drop-target/);assert.match(css,/file-explorer__uploads/);assert.match(css,/@media\(max-width:760px\)/);
});

test("undefined, loading, absent, disconnected and read-only capabilities keep cached Files usable and Upload safely gated",()=>{
  const base=folder("root","Cached Client Files",null,"client_root");
  const cases:Array<[CanonicalFolderRecord|null,string,boolean]>=[
    [null,"absent",false],
    [{...base,capabilities:undefined},"loading",false],
    [{...base,capabilities:{upload:false,uploadState:"absent"}},"absent",false],
    [{...base,capabilities:{upload:false,uploadState:"disconnected"}},"disconnected",false],
    [{...base,capabilities:{upload:false,uploadState:"read_only"}},"read_only",false],
    [{...base,capabilities:{upload:true,uploadState:"writable"}},"writable",true],
  ];
  for(const [candidate,state,enabled] of cases)assert.deepEqual({state:resolveFolderUploadCapability(candidate).state,enabled:resolveFolderUploadCapability(candidate).enabled},{state,enabled});
  const cached=buildFileExplorer(result({clientId:"client-fixture"},[{...base,capabilities:undefined}],[document("cached","root")]),"Client Files");
  assert.equal(explorerDirectory(cached,cached.preferredFolderKey).length,1);
});

test("API normalisation installs a non-permissive capability default for older cached folder projections",async()=>{
  const api=await readFile("src/services/documents/documentRecordsApi.ts","utf8");
  assert.match(api,/export function normaliseDocumentRecordsResult/);
  assert.match(api,/const upload=folder\.capabilities\?\.upload===true/);
  assert.match(api,/uploadState:folder\.capabilities\?\.uploadState\|\|\(upload\?"writable":"absent"\)/);
  assert.match(api,/folders:\(Array\.isArray\(result\?\.folders\)\?result\.folders:\[\]\)\.map/);
});
