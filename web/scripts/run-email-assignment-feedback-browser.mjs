import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import {
  countBrowserRunProfiles,
  createBrowserRunController,
} from "./browser-run-lifecycle.mjs";

const httpPort = 4191;
const debugPort = 9391;
const appUrl = `http://127.0.0.1:${httpPort}`;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const controller = createBrowserRunController({ throwOnLeak: true });
controller.installInterruptHandlers();

const waitFor = async (action, message, timeout = 20000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await action().catch(() => false);
    if (value) return value;
    await delay(100);
  }
  throw new Error(message);
};

const json = (response, value, status = 200) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
};

let unread = true;
let assignmentSubmissions = 0;
let commandSubmissions = 0;
const message = () => ({
  id: "local-message-1",
  providerMessageId: "message-1",
  threadId: "thread-1",
  direction: "inbound",
  folder: "inbox",
  status: "received",
  from: ["Viktorija <info@zylefenster.example>"],
  to: ["sales@example.test"],
  cc: [],
  bcc: [],
  subject: "EF-CL-928: Disposable supplier estimate",
  snippet: "Please find the retained quotation attached.",
  bodyHtml: "<p>Please find the retained quotation attached.</p>",
  bodyText: "Please find the retained quotation attached.",
  attachmentCount: 1,
  attachments: [
    {
      id: "attachment-1",
      providerAttachmentId: "provider-attachment-1",
      fileName: "Zyle quotation.pdf",
      mediaType: "application/pdf",
      sizeBytes: 128,
      inline: false,
    },
  ],
  sentAt: "2026-09-11T09:00:00.000Z",
  error: null,
  unread,
  starred: false,
  important: false,
  labels: [{ id: "INBOX", name: "Inbox", system: true }],
  threadCount: 1,
  links: [],
});

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

let server;
let browser;
let socket;
let tempDirectory;
let ownedProfile;

async function run() {
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), "qs-email-feedback-"));
  await build({
    entryPoints: [path.resolve("tests/fixtures/EmailAssignmentFeedbackAcceptance.tsx")],
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    outdir: tempDirectory,
    loader: { ".png": "dataurl", ".svg": "dataurl" },
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(appUrl),
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
    },
  });
  server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", appUrl);
    if (url.pathname === "/EmailAssignmentFeedbackAcceptance.js" || url.pathname === "/EmailAssignmentFeedbackAcceptance.css") {
      const file = url.pathname.slice(1);
      response.writeHead(200, { "Content-Type": file.endsWith(".css") ? "text/css" : "text/javascript" });
      response.end(await readFile(path.join(tempDirectory, file)));
      return;
    }
    if (url.pathname === "/api/communications/status") {
      json(response, { provider: "google_workspace", state: "connected", configured: true, configurationStored: true, encryptionConfigured: true, encryptionState: "available", connected: true, connectionStatus: "connected", account: { id: "account", email: "sales@example.test", name: "Sales" }, scopes: [], capabilities: { gmail: { available: true, missingScopes: [] }, drive: { available: true, missingScopes: [], rootConfigured: true } }, clientId: "fixture", redirectUri: null, clientIdHint: null, enquiriesRootFolderId: "root", estimatesRootFolderId: "root", ordersRootFolderId: "root", folderTemplate: {}, infrastructureMessage: null, error: null });
      return;
    }
    if (url.pathname === "/api/communications/mailbox") {
      json(response, { provider: "google_workspace", labels: [{ id: "INBOX", name: "Inbox", type: "system", messagesTotal: 1, messagesUnread: unread ? 1 : 0 }], capabilities: ["archive", "trash", "read_state", "star", "move", "labels"].map((id) => ({ id, available: true })) });
      return;
    }
    if (url.pathname === "/api/communications/messages" || url.pathname === "/api/communications/sync") {
      json(response, { messages: [message()], nextPageToken: null, source: "cache", sync: { state: "synced", strategy: "bounded_fixture", lastSuccessAt: "2026-09-11T09:00:00.000Z" } });
      return;
    }
    if (url.pathname === "/api/communications/messages/message-1") {
      json(response, message());
      return;
    }
    if (url.pathname === "/api/communications/messages/message-1/context") {
      json(response, { links: [], suggestions: [] });
      return;
    }
    if (url.pathname === "/api/communications/messages/message-1/assignment" && request.method === "GET") {
      json(response, { providerMessageId: "message-1", communicationMessageId: "local-message-1", reference: "EF-CL-928", clients: [{ id: "client-1", client_ref: "EF-CL-928", name: "Disposable Client" }], projects: [{ id: "project-1", client_id: "client-1", name: "Disposable Project", context_year: 2026 }], estimates: [{ id: "estimate-1", project_id: "project-1", estimate_ref: "EF-EST-2026-957", created_at: "2026-09-11" }], suppliers: [{ id: "ZYLE", name: "Zyle Fenster" }], attachments: [{ id: "attachment-1", providerAttachmentId: "provider-attachment-1", fileName: "Zyle quotation.pdf", mediaType: "application/pdf", sizeBytes: 128 }], conflicts: [], proposed: { clientId: "client-1", projectId: "project-1", estimateId: "estimate-1", supplierId: "ZYLE", attachmentId: "attachment-1" } });
      return;
    }
    if (url.pathname === "/api/communications/messages/message-1/assignment" && request.method === "POST") {
      assignmentSubmissions += 1;
      await delay(500);
      if (assignmentSubmissions === 1) {
        json(response, { error: "The provider file was saved, but its QuoteSuite relationships are incomplete.", code: "communication_assignment_partial_success", details: { providerFileId: "provider-file-1", fileName: "Zyle quotation.pdf", folderPath: "2026/EF-CL-928 - Disposable Client/Disposable Project/Estimates/EF-EST-2026-957/Suppliers/Zyle Fenster", webViewLink: "https://drive.invalid/provider-file-1" } }, 409);
      } else {
        json(response, { status: "stored", duplicate: true, documentId: "canonical-document-1", providerFileId: "provider-file-1", fileName: "Zyle quotation.pdf", folderPath: "2026/EF-CL-928 - Disposable Client/Disposable Project/Estimates/EF-EST-2026-957/Suppliers/Zyle Fenster", webViewLink: "https://drive.invalid/provider-file-1", links: [{ kind: "client", id: "client-1" }, { kind: "project", id: "project-1" }, { kind: "estimate", id: "estimate-1" }, { kind: "supplier", id: "ZYLE" }], navigation: { clientId: "client-1", projectId: "project-1", estimateId: "estimate-1", destination: "supplier-documents", openFilesLabel: "Open Files", importLabel: "Import Manufacturer Estimate" } }, 201);
      }
      return;
    }
    if (url.pathname === "/api/communications/commands" && request.method === "POST") {
      commandSubmissions += 1;
      const body = await readBody(request);
      if (body.command === "mark_read") unread = false;
      if (body.command === "mark_unread") unread = true;
      json(response, { ok: true });
      return;
    }
    if (url.pathname === "/api/communications/change-state") {
      json(response, { mode: "bounded_reconciliation", pushConfigured: false, projectionVersion: commandSubmissions, watchStatus: "fixture", watchExpirationAt: null, lastNotificationAt: null, lastReconciledAt: null });
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/EmailAssignmentFeedbackAcceptance.css"></head><body><div id="root"></div><script type="module" src="/EmailAssignmentFeedbackAcceptance.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(httpPort, "127.0.0.1", resolve));

  ownedProfile = await controller.createProfile({ label: "email-assignment-feedback", debugPort });
  browser = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${ownedProfile}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "--window-size=1800,1000", "about:blank"], { stdio: "ignore", windowsHide: true });
  controller.setRun({ child: browser });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, "Owned Chrome did not start");
  await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(appUrl));
  assert.ok(target, "Acceptance page target unavailable");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let call = 0;
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener("message", (event) => {
    const response = JSON.parse(String(event.data));
    if (response.method === "Runtime.exceptionThrown") diagnostics.push(response.params?.exceptionDetails?.exception?.description || response.params?.exceptionDetails?.text);
    if (response.id && pending.has(response.id)) {
      const task = pending.get(response.id);
      pending.delete(response.id);
      response.error ? task.reject(new Error(response.error.message)) : task.resolve(response.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++call; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await waitFor(() => evaluate("document.querySelectorAll('.email-message-row').length===1"), "Mailbox row did not render");

  const unreadStyle = await evaluate("(()=>{const row=document.querySelector('.email-message-row'),sender=row.querySelector('.email-message-row__sender'),subject=row.querySelector('.email-message-row__content strong'),snippet=row.querySelector('.email-message-row__content small'),date=row.querySelector('time');return{sender:getComputedStyle(sender).fontWeight,subject:getComputedStyle(subject).fontWeight,snippet:getComputedStyle(snippet).fontWeight,date:getComputedStyle(date).fontWeight}})()");
  assert.deepEqual(unreadStyle, { sender: "600", subject: "600", snippet: "400", date: "600" });
  await evaluate("document.querySelector('.email-message-row').click()");
  await waitFor(() => evaluate("getComputedStyle(document.querySelector('.email-message-row__sender')).fontWeight==='400'"), "Opening did not remove unread emphasis");
  const selected = await evaluate("(()=>{const selected=document.querySelector('.email-message-row.is-preview-selected'),other=document.querySelector('.email-message-row');return Boolean(selected&&getComputedStyle(selected).boxShadow!=='none'&&getComputedStyle(other.querySelector('.email-message-row__content small')).fontWeight==='400')})()");
  assert.equal(selected, true);
  assert.equal(unread, false);
  await evaluate("document.querySelector('button[aria-label=\"Mark unread\"]').click()");
  await waitFor(() => evaluate("document.querySelector('.email-message-row')?.classList.contains('is-unread')"), "Mark unread did not restore row state");
  await send("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("document.querySelector('.email-message-row')?.classList.contains('is-unread')"), "Unread state did not persist after refresh");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.email-message-row__content small')).fontWeight"), "400");

  await evaluate("document.querySelector('.email-message-row').click()");
  await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Link existing'&&!button.disabled)"), "Reader context did not finish opening");
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Link existing').click()");
  await waitFor(() => evaluate("Boolean(document.querySelector('.email-assignment'))"), "Assignment picker did not open");
  await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='File selected document');button.click();button.click();return true})()");
  await waitFor(() => evaluate("document.querySelector('.email-assignment__feedback')?.textContent.includes('Saving document')"), "Immediate saving feedback was not visible");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(item=>item.textContent.includes('Saving document'))?.disabled"), true);
  await waitFor(() => evaluate("document.querySelector('.email-assignment__feedback')?.textContent.includes('provider file is preserved')"), "Partial-success recovery guidance was not visible");
  assert.equal(assignmentSubmissions, 1, "Double-click submitted the first filing twice");
  await evaluate("[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='Retry filing').click()");
  await waitFor(() => evaluate("document.querySelector('.email-assignment__result')?.textContent.includes('Zyle quotation.pdf')"), "Filing success did not show the filename");
  const success = await evaluate("document.querySelector('.email-assignment__result').textContent");
  assert.match(success, /Suppliers\/Zyle Fenster/);
  assert.match(success, /Open Files/);
  assert.match(success, /Import Manufacturer Estimate/);
  await evaluate("[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='Import Manufacturer Estimate').click()");
  await waitFor(() => evaluate("document.querySelector('[data-testid=import-handoff]').textContent.includes('canonical-document-1')"), "Canonical document import handoff was not retained");
  assert.equal(await evaluate("document.querySelector('[data-testid=import-handoff]').textContent"), "client-1|estimate-1|canonical-document-1");
  assert.deepEqual(diagnostics, []);
  console.log(JSON.stringify({ unreadStyle, readStatePersisted: true, assignmentSubmissions, commandSubmissions, success, importHandoff: "client-1|estimate-1|canonical-document-1" }, null, 2));
}

try {
  await run();
} finally {
  socket?.close();
  const cleanup = await controller.stop("final");
  if (!cleanup.skipped) {
    assert.equal(cleanup.verified, true);
    assert.equal(await countBrowserRunProfiles(ownedProfile), 0);
    assert.equal(cleanup.ownedTemporaryProfilesRemaining, 0);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
}
