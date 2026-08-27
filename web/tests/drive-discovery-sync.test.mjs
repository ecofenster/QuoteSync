import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { initializeCommercialIdentitySchema } from "../server/features/commercialIdentity/commercialIdentitySchema.js";
import { createDriveIntegrationService, matchesEstimateReferencePrefix } from "../server/features/documents/driveIntegrationService.js";
import { createDocumentRecordsService } from "../server/features/documents/documentRecordsService.js";
import { createGoogleDriveProvider, GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "../server/features/documents/googleDriveProvider.js";

const folder = (id, name, parent) => ({ id, name, parents: [parent], mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE, createdTime: "2025-01-01T09:00:00.000Z", modifiedTime: "2026-08-20T12:00:00.000Z" });
const file = (id, name, parent, version = "1") => ({ id, name, parents: [parent], mimeType: "application/pdf", size: "321", createdTime: "2025-02-01T09:00:00.000Z", modifiedTime: "2026-08-21T12:00:00.000Z", version, md5Checksum: `${id}-md5`, webViewLink: `https://drive.google.com/file/d/${id}/view` });

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qs-drive-discovery-"));
  const db = await open({ filename: path.join(root, "test.db"), driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,name TEXT,email TEXT,project_name TEXT,client_ref TEXT,created_at TEXT,deleted_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,estimate_ref TEXT,revision_no INTEGER,created_at TEXT,deleted_at TEXT,FOREIGN KEY(client_id) REFERENCES clients(id));
    CREATE TABLE followups(id TEXT PRIMARY KEY,client_id TEXT,estimate_id TEXT,title TEXT,notes TEXT,due_at TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,estimate_id TEXT,supplier_code TEXT,supplier_name TEXT,archived_at TEXT);
    CREATE TABLE supplier_quote_revisions(id TEXT PRIMARY KEY,supplier_quote_id TEXT,estimate_id TEXT,revision_sequence INTEGER,supplier_quotation_number TEXT,supplier_revision TEXT);
    CREATE TABLE supplier_quote_attachments(id TEXT PRIMARY KEY,estimate_id TEXT,revision_id TEXT,original_file_name TEXT,media_type TEXT,size_bytes INTEGER,sha256 TEXT,created_at TEXT,document_kind TEXT);
  `);
  await initializeWorkflowSchema(db);
  await initializeCommercialIdentitySchema(db);
  await db.run("INSERT INTO clients(id,name,email,project_name,client_ref,created_at,deleted_at) VALUES(?,?,?,?,?,?,NULL)", "client-1", "John Wingfield", "john@example.com", "Buildhub", "EF-CL-025", "2026-01-01T09:00:00.000Z");
  await db.run("INSERT INTO estimates(id,client_id,estimate_ref,revision_no,created_at,deleted_at) VALUES(?,?,?,?,?,NULL)", "estimate-1", "client-1", "EF-EST-2026-009", 1, "2026-02-01T09:00:00.000Z");
  await db.run("INSERT INTO supplier_quotes VALUES(?,?,?,?,NULL)", "quote-1", "estimate-1", "ZYLE", "Zyle Fenster");
  await db.run("INSERT INTO integration_oauth_connections(provider,status,account_id,scopes_json,updated_at) VALUES('google_workspace','connected','account-1','[]','2026-08-26T09:00:00.000Z')");

  const children = new Map([
    ["estimates-root", [folder("misc-root", "Reference material", "estimates-root"), folder("year-2025", "2025", "estimates-root"), folder("year-2026", "2026", "estimates-root")]],
    ["year-2026", [folder("other-project", "EF-EST-2026-010 - Other", "year-2026"), folder("project-009", "EF-EST-2026-009 - John Wingfield (Buildhub)", "year-2026")]],
    ["project-009", [folder("drawings-client", "Drawings (Client)", "project-009"), folder("drawings-eco", "Drawings (Ecofenster)", "project-009"), folder("estimates", "Estimates", "project-009"), folder("invoices", "Invoices", "project-009"), folder("orders", "Orders", "project-009"), file("project-file", "Site notes.pdf", "project-009")]],
    ["drawings-client", [file("drawing-file", "Opening sizes.pdf", "drawings-client")]],
    ["drawings-eco", []],
    ["estimates", [folder("zyle", "Zyle Fenster", "estimates"), folder("unknown-supplier", "Zyle Fenstr", "estimates"), file("estimate-file", "Comparison.pdf", "estimates")]],
    ["zyle", [file("supplier-file", "343718-1.pdf", "zyle", "7")]],
    ["unknown-supplier", [file("unknown-file", "Unknown quote.pdf", "unknown-supplier")]],
    ["invoices", []],
    ["orders", []],
  ]);
  let fail = false;
  const provider = {
    async listChildren({ parentId }) {
      if (fail) throw new Error("Fixture Drive unavailable");
      return structuredClone(children.get(parentId) || []);
    },
    async ensureFolder() { throw new Error("Read-only discovery must not provision folders"); },
    async uploadFile() { throw new Error("Read-only discovery must not upload files"); },
  };
  const workspace = {
    async status() { return { connected: true, estimatesRootFolderId: "estimates-root", account: { id: "account-1" }, capabilities: { drive: { available: true } } }; },
    async resolvedConfig() { return { stored: { folder_template_json: "{}" } }; },
  };
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  return { db, children, service: createDriveIntegrationService(db, { provider, workspace }), setFail(value) { fail = value; } };
}

test("Drive discovery reuses the configured year, historical Estimate reference and existing standard/supplier folders", async (t) => {
  const { db, service } = await fixture(t);
  assert.equal(matchesEstimateReferencePrefix("EF-EST-2026-009 - Historical name", "EF-EST-2026-009"), true);
  assert.equal(matchesEstimateReferencePrefix("EF-EST-2026-0099 - Different Estimate", "EF-EST-2026-009"), false);
  const result = await service.discoverEstimate("estimate-1");
  assert.equal(result.status, "synced");
  assert.equal(result.strategy, "full_enumeration");
  assert.equal(result.nextChangeToken, null);
  const mappings = await db.all("SELECT logical_key,name,provider_folder_id FROM drive_project_folders WHERE estimate_id='estimate-1' ORDER BY logical_key");
  assert.equal(mappings.find((item) => item.logical_key === "year:2026")?.provider_folder_id, "year-2026");
  assert.equal(mappings.find((item) => item.logical_key === "project")?.name, "EF-EST-2026-009 - John Wingfield (Buildhub)");
  for (const [key, id] of [["drawings_client", "drawings-client"], ["drawings_ecofenster", "drawings-eco"], ["supplier_estimates", "estimates"], ["invoices", "invoices"], ["orders", "orders"]]) assert.equal(mappings.find((item) => item.logical_key === key)?.provider_folder_id, id);
  assert.equal(mappings.some((item) => item.provider_folder_id === "zyle"), true);
  const supplierDocument = await db.get("SELECT * FROM drive_discovered_documents WHERE provider_file_id='supplier-file'");
  assert.equal(supplierDocument.supplier_id, "ZYLE");
  assert.equal(supplierDocument.supplier_name, "Zyle Fenster");
  assert.equal(supplierDocument.client_id, "client-1");
  assert.equal(supplierDocument.project_id, "estimate-1");
  assert.equal(supplierDocument.estimate_id, "estimate-1");
  const unknownDocument = await db.get("SELECT * FROM drive_discovered_documents WHERE provider_file_id='unknown-file'");
  assert.equal(unknownDocument.supplier_id, null);
});

test("file projection is idempotent and refreshes rename, move, version and removed evidence by provider ID", async (t) => {
  const { db, children, service } = await fixture(t);
  await service.discoverEstimate("estimate-1");
  await service.discoverEstimate("estimate-1");
  assert.equal((await db.get("SELECT COUNT(*) count FROM drive_discovered_documents")).count, 5);
  const moved = children.get("zyle").find((item) => item.id === "supplier-file");
  children.set("zyle", []);
  moved.name = "343718-1 renamed.pdf";
  moved.version = "8";
  moved.modifiedTime = "2026-08-26T12:00:00.000Z";
  moved.parents = ["drawings-client"];
  children.get("drawings-client").push(moved);
  children.set("project-009", children.get("project-009").filter((item) => item.id !== "project-file"));
  children.get("estimates").find((item) => item.id === "estimate-file").trashed = true;
  await service.discoverEstimate("estimate-1");
  const refreshed = await db.get("SELECT * FROM drive_discovered_documents WHERE provider_file_id='supplier-file'");
  assert.equal(refreshed.file_name, "343718-1 renamed.pdf");
  assert.equal(refreshed.provider_folder_id, "drawings-client");
  assert.equal(refreshed.provider_version, "8");
  assert.equal(refreshed.supplier_id, null);
  assert.equal((await db.get("SELECT COUNT(*) count FROM drive_discovered_documents WHERE provider_file_id='supplier-file'")).count, 1);
  assert.ok((await db.get("SELECT removed_at FROM drive_discovered_documents WHERE provider_file_id='project-file'")).removed_at);
  assert.equal((await db.get("SELECT trashed FROM drive_discovered_documents WHERE provider_file_id='estimate-file'")).trashed, 1);
});

test("Client and Estimate Files share canonical discovered records, and a failed refresh preserves the cache", async (t) => {
  const { db, service, setFail } = await fixture(t);
  await service.discoverEstimate("estimate-1");
  const records = createDocumentRecordsService(db);
  const client = await records.list({ clientId: "client-1" });
  const estimate = await records.list({ estimateId: "estimate-1" });
  assert.deepEqual(client.documents.map((item) => item.id), estimate.documents.map((item) => item.id));
  assert.equal(client.documents.find((item) => item.providerFileId === "supplier-file")?.folder, "2026/EF-EST-2026-009 - John Wingfield (Buildhub)/Estimates/Zyle Fenster");
  assert.equal(client.sync.state, "synced");
  const cachedIds = client.documents.map((item) => item.id);
  setFail(true);
  await assert.rejects(() => service.discoverEstimate("estimate-1"), /Fixture Drive unavailable/);
  const afterFailure = await records.list({ clientId: "client-1" });
  assert.deepEqual(afterFailure.documents.map((item) => item.id), cachedIds);
  assert.equal(afterFailure.sync.state, "failed");
  assert.match(afterFailure.sync.error, /Fixture Drive unavailable/);
});

test("Files UI renders cached records before background provider refresh and exposes explicit Sync", async () => {
  const source = await readFile("src/features/documents/CanonicalDocumentsPanel.tsx", "utf8");
  const cachedIndex = source.indexOf("const cached=await listCached()");
  assert.ok(cachedIndex >= 0 && cachedIndex < source.indexOf("await syncDrive()", cachedIndex));
  assert.match(source, /Syncing…/);
  assert.match(source, /Sync failed — showing cached files/);
  assert.match(source, /↻ Sync Drive/);
  assert.match(source, /setResult\(cached\)/);
});

test("Google Drive child enumeration is read-only, paginated and Shared Drive compatible", async () => {
  const requests = [];
  const workspace = { async googleFetch(url) {
    const parsed = new URL(url);
    requests.push(parsed);
    const second = parsed.searchParams.get("pageToken") === "page-2";
    return new Response(JSON.stringify(second ? { files: [file("file-2", "Second.pdf", "parent")] } : { files: [file("file-1", "First.pdf", "parent")], nextPageToken: "page-2" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } };
  const files = await createGoogleDriveProvider(workspace).listChildren({ parentId: "parent" });
  assert.deepEqual(files.map((item) => item.id), ["file-1", "file-2"]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("supportsAllDrives"), "true");
  assert.equal(requests[0].searchParams.get("includeItemsFromAllDrives"), "true");
  assert.match(requests[0].searchParams.get("q"), /trashed=false/);
  assert.equal(requests[1].searchParams.get("pageToken"), "page-2");
});
