import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { CLIENT_PORTAL_FEATURES } from "../shared/clientPortalContracts.js";
import { initializePortalSecuritySchema } from "../server/features/clientPortal/portalSecuritySchema.js";
import { createPortalSecurityService } from "../server/features/clientPortal/portalSecurityService.js";
import { createCustomerQuotationDocumentService } from "../server/features/customerQuotations/customerQuotationDocumentService.js";
import { createIssuedQuotationService } from "../server/features/customerQuotations/issuedQuotationService.js";
import { initializeWorkflowSchema } from "../server/features/workflow/workflowSchema.js";
import { initializeLifecycleSchema } from "../server/features/lifecycle/lifecycleSchema.js";
import { pdfJsRuntimeOptions } from "../server/features/supplierImportLab/pdfJsRuntime.js";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTree } from "./e2e-owned-process.mjs";

const APP_URL = "http://127.0.0.1:5276";
const API_URL = "http://127.0.0.1:3104";
const DEBUG_PORT = 9416;
const CUSTOMER = "customer.journey@example.test";
const FACTORY = "factory.journey@example.test";
const OUTPUT = path.resolve("test-output/complete-customer-order-journey");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };
const waitFor = async (fn, message, timeout = 60_000) => { const started = Date.now(); while (Date.now() - started < timeout) { const result = await fn().catch(() => false); if (result) return result; await delay(150); } throw new Error(message); };
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
controller.installInterruptHandlers();

function projection(reference, revision = 1) {
  return {
    estimateReference: reference,
    clientName: "TEST Customer Journey",
    projectName: "TEST Complete Customer Order Journey",
    projectAddress: "1 Test Journey Street, Cardiff, CF10 1AA",
    commercialRevision: revision,
    previewDate: "2026-09-10T09:00:00.000Z",
    brand: { companyName: "Ecofenster", primaryColour: "#55B948", accentColour: "#85C76D", darkColour: "#17211D" },
    positions: [
      { id: "test-position-w01", reference: "W01", customerReference: "W01", quantity: 1, widthMm: 1200, heightMm: 1400, roomName: "Kitchen", productSystem: "Europa 92 Alu", configurationDescription: "Tilt and turn window", description: "Timber/aluminium tilt and turn window", classification: "included", includedInQuotationTotal: true, totalSellingPriceGbp: "1725.00", specification: [{ label: "External finish", value: revision === 1 ? "White" : "Black" }, { label: "Glazing", value: "Triple glazed" }], thermal: { manufacturerQuotedUw: "0.80", ug: "0.50" } },
      { id: "test-position-d01", reference: "D01", customerReference: "D01", quantity: 1, widthMm: 1000, heightMm: 2100, roomName: "Entrance", productSystem: "Europa 92 Alu", configurationDescription: "Inward-opening entrance door", description: "Timber/aluminium entrance door", classification: "included", includedInQuotationTotal: true, totalSellingPriceGbp: "3275.00", specification: [{ label: "External finish", value: "Black" }, { label: "Security", value: "Multipoint locking" }], thermal: { manufacturerQuotedUw: "0.90" } },
      { id: "test-position-d01-alt", reference: "D01 ALT", customerReference: "D01 ALT", alternativeToReference: "D01", quantity: 1, widthMm: 1000, heightMm: 2100, roomName: "Entrance", productSystem: "Europa 92 Alu", configurationDescription: "Alternative entrance door", description: "Alternative entrance door specification", classification: "alternative", includedInQuotationTotal: false, totalSellingPriceGbp: "3500.00", specification: [{ label: "External finish", value: "Black" }] },
    ],
    productShowcases: [],
    charges: [{ id: "products", label: "Products / Supply Only", amountGbp: "5000.00" }, { id: "installation", label: "Installation", amountGbp: "1250.00" }],
    subtotalExVatGbp: "6250.00",
    vatRatePercent: "20",
    vatGbp: "1250.00",
    totalIncVatGbp: "7500.00",
  };
}

async function seed(databasePath, attachmentRoot) {
  const db = await open({ filename: databasePath, driver: sqlite3.Database });
  await initializeWorkflowSchema(db);
  await initializePortalSecuritySchema(db);
  await initializeLifecycleSchema(db);
  const suffix = Date.now().toString(36), clientId = randomUUID(), projectId = randomUUID(), estimateId = randomUUID(), issuedId = randomUUID(), now = "2026-09-10T09:00:00.000Z";
  const estimateReference = `TEST-EST-${suffix.toUpperCase()}`;
  const customerProjection = projection(estimateReference, 1);
  await db.run(`INSERT INTO clients(id,name,email,contact_name,company_name,client_ref,project_name,created_at,deleted_at,commercial_lifecycle,reference_namespace,updated_at) VALUES(?,?,?,?,?,?,?,?,NULL,'prospect','test',?)`, clientId, "TEST Customer Journey", CUSTOMER, "TEST Customer Journey", "", `TEST-CL-${suffix.toUpperCase()}`, customerProjection.projectName, now, now);
  await db.run("INSERT INTO projects(id,client_id,name,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)", projectId, clientId, customerProjection.projectName, now, now);
  await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,1,'Issued','September',2026,'{}',?,'{}','Open',?,'{}','CF10 1AA','','test-staff','Test Staff','estimator',?,?,NULL)`, estimateId, clientId, projectId, estimateReference, estimateReference, JSON.stringify(customerProjection.positions.map((item) => ({ id: item.id, positionRef: item.reference, qty: item.quantity, widthMm: item.widthMm, heightMm: item.heightMm, roomName: item.roomName }))), customerProjection.projectAddress, now, now);
  const documents = createCustomerQuotationDocumentService(db, { attachmentRoot });
  const document = await documents.createImmutablePdf({ estimateId, quotationRevision: 1, projection: customerProjection });
  await db.run(`INSERT INTO issued_quotations(id,idempotency_key,client_id,estimate_id,estimate_revision,quotation_revision,document_id,status,recipient,subject,provider,provider_message_id,prepared_at,issued_at,commercial_snapshot_json,created_at,updated_at) VALUES(?,?,?,?,1,1,?,'issued',?,'TEST Estimate','quotesuite_test_adapter',?,?, ?,?,?,?)`, issuedId, `test-issue-${suffix}`, clientId, estimateId, document.id, CUSTOMER, `test-message-${suffix}`, now, now, JSON.stringify({ subtotalExVatGbp: "6250.00", vatRatePercent: "20", vatGbp: "1250.00", totalIncVatGbp: "7500.00" }), now, now);
  for (const [id, providerFileId, documentType, fileName] of [
    [`test-project-drawing-${suffix}`, "drawing", "project_drawing", "TEST Approved project drawing.pdf"],
    [`test-returned-revision-${suffix}`, "supplier-revision", "supplier_quotation", "TEST Returned manufacturer revision.pdf"],
    [`test-factory-confirmation-${suffix}`, "factory-confirmation", "factory_confirmation", "TEST Factory confirmation.pdf"],
    [`test-signed-confirmation-${suffix}`, "signed-confirmation", "customer_signed_confirmation", "TEST Signed final confirmation.pdf"],
  ]) await db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,project_id,document_type,file_name,checksum,discovered_at,last_seen_at,updated_at) VALUES(?,'test_adapter','test-account',?,?,?,?,?,'test-source-sha',?,?,?)", id, providerFileId, clientId, projectId, documentType, fileName, now, now, now);
  const portal = createPortalSecurityService(db, { documentOptions: { attachmentRoot } });
  for (const featureKey of CLIENT_PORTAL_FEATURES) await portal.setFeatureControl(featureKey, true, "test-staff");
  const release = await portal.releaseIssuedEstimate({ issuedQuotationId: issuedId, releasedBy: "test-staff" });
  const invitation = await portal.createInvitation({ clientId, projectId, email: CUSTOMER, displayName: "TEST Customer Journey", createdBy: "test-staff" });
  await db.close();
  return { suffix, clientId, projectId, estimateId, estimateReference, issuedId, document, projection: customerProjection, release, invitation, projectDrawingId: `test-project-drawing-${suffix}`, returnedRevisionId: `test-returned-revision-${suffix}`, factoryConfirmationDocumentId: `test-factory-confirmation-${suffix}`, signedConfirmationDocumentId: `test-signed-confirmation-${suffix}` };
}

async function connect() {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(`${APP_URL}/#/client-portal`)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json(), target = targets.find((item) => item.type === "page" && item.url.startsWith(APP_URL));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0; const pending = new Map(), diagnostics = [], failures = [];
  socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text); if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") diagnostics.push(message.params.args?.map((item) => item.value || item.description).join(" ")); if (message.method === "Network.responseReceived" && message.params?.response?.status >= 400) failures.push({ status: message.params.response.status, url: message.params.response.url }); if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const call = ++id; pending.set(call, { resolve, reject }); socket.send(JSON.stringify({ id: call, method, params })); });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  return { socket, send, evaluate, diagnostics, failures };
}

async function click(tab, label) {
  const result = await tab.evaluate(`(()=>{const element=[...document.querySelectorAll('button,a,.app-sidebar-item')].find(item=>item.textContent.trim().includes(${JSON.stringify(label)}));if(!element)return false;element.click();return true})()`);
  assert.equal(result, true, `Could not find action: ${label}`);
}
async function input(tab, selector, value) {
  const result = await tab.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)return false;const proto=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));return true})()`);
  assert.equal(result, true, `Could not set ${selector}`);
}
async function staff(pathname, body, method = "POST") {
  const response = await fetch(`${API_URL}${pathname}`, { method, headers: { "Content-Type": "application/json" }, body: body == null ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} -> ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function inspectPdf(filePath, expected) {
  const bytes = await readFile(filePath), task = getDocument(pdfJsRuntimeOptions({ data: new Uint8Array(bytes) }));
  try {
    const pdf = await task.promise; let searchableText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) { const page = await pdf.getPage(pageNumber), content = await page.getTextContent(); searchableText += ` ${content.items.map((item) => item.str).join(" ")}`; page.cleanup(); }
    for (const term of expected) assert.match(searchableText, new RegExp(term, "i"), `${path.basename(filePath)} is missing ${term}`);
    const renderPage = async (pageNumber, suffix) => { const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 1.25 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)), context = canvas.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvasContext: context, canvas, viewport, annotationMode: 0 }).promise; const output = filePath.replace(/\.pdf$/i, suffix); await writeFile(output, await canvas.encode("png")); const size = { width: viewport.width / 1.25, height: viewport.height / 1.25 }; page.cleanup(); return { output, size }; };
    const cover = await renderPage(1, "--cover.png"), schedule = await renderPage(Math.min(3, pdf.numPages), "--schedule.png"), summary = await renderPage(pdf.numPages, "--summary.png");
    return { filePath, sizeBytes: bytes.length, sha256: sha256(bytes), pageCount: pdf.numPages, searchableCharacters: searchableText.replace(/\s+/g, "").length, firstPage: cover.size, previewPaths: { cover: cover.output, schedule: schedule.output, summary: summary.output } };
  } finally { await task.destroy(); }
}

async function run() {
  const root = await mkdtemp(path.join(os.tmpdir(), "quotesuite-complete-journey-")), databasePath = path.join(root, "quotesync.db"), attachmentRoot = path.join(root, "attachments");
  await copyFile(path.resolve("quotesync.db"), databasePath); await mkdir(attachmentRoot, { recursive: true }); await mkdir(OUTPUT, { recursive: true });
  const fixture = await seed(databasePath, attachmentRoot); let api, vite, browser, tab, cleanup;
  try {
    api = spawn(process.execPath, ["server/index.js"], { cwd: process.cwd(), env: { ...process.env, QUOTESUITE_DB_PATH: databasePath, QUOTESYNC_ATTACHMENT_ROOT: attachmentRoot, PORT: "3104", NODE_ENV: "development", QUOTESUITE_APP_ORIGINS: APP_URL, QUOTESUITE_TEST_JOURNEY: "1", QUOTESUITE_TEST_DELIVERY_ENABLED: "0", QUOTESUITE_TEST_CUSTOMER_EMAIL: CUSTOMER, QUOTESUITE_TEST_FACTORY_EMAIL: FACTORY }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    vite = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5276"], { cwd: process.cwd(), env: { ...process.env, VITE_API_BASE_URL: API_URL }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    await waitFor(() => reachable(`${API_URL}/api/health`), "Disposable journey API did not start"); await waitFor(() => reachable(APP_URL), "Disposable journey UI did not start");
    const profile = await controller.createProfile({ label: "complete-customer-order-journey", debugPort: DEBUG_PORT });
    browser = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "--window-size=1920,1080", "about:blank"], { stdio: "ignore", windowsHide: true });
    controller.setRun({ child: browser }); await waitFor(() => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Owned Chrome did not start", 15_000); controller.setRun({ child: browser, userDataDir: profile, debugPort: DEBUG_PORT, profileProcessCountDuring: await countBrowserRunProfiles(profile, { platformName: process.platform }) }); tab = await connect();

    await tab.send("Page.navigate", { url: `${APP_URL}/#/client-portal?token=${encodeURIComponent(fixture.invitation.token)}` }); await waitFor(() => tab.evaluate("document.body.innerText.includes('Open your Project')"), "Invitation screen did not render");
    await input(tab, "input[type=email]", CUSTOMER); await click(tab, "Continue securely"); await waitFor(() => tab.evaluate(`document.body.innerText.includes(${JSON.stringify(fixture.estimateReference)})`), "Customer session did not open the issued Estimate");
    const originalPortalEstimateHash = await tab.evaluate(`(async()=>{const link=[...document.querySelectorAll('a')].find(item=>item.textContent.includes('View issued Estimate'));const response=await fetch(link.href,{credentials:'include'}),bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return {status:response.status,type:response.headers.get('content-type'),hash:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}})()`);
    assert.deepEqual({ status: originalPortalEstimateHash.status, type: originalPortalEstimateHash.type, hash: originalPortalEstimateHash.hash }, { status: 200, type: "application/pdf", hash: fixture.document.sha256 });
    await click(tab, "Review Estimate"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Review every Position')"), "Customer Position review did not open");
    await input(tab, ".portal-external__positions fieldset:first-child select", "amendment_requested"); await input(tab, ".portal-external__positions fieldset:first-child textarea", "Change the external finish from white to black."); await input(tab, "section.portal-external__command > label select", "amendment_requested"); await input(tab, "section.portal-external__command > label textarea", "Update the project finish schedule to match."); await click(tab, "Submit reviewed responses"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Response recorded')&&document.body.innerText.includes('project team reviews')"), "Customer changes were not acknowledged");
    const reviewDesktop = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "01-customer-changes-submitted--1920x1080.png"), Buffer.from(reviewDesktop.data, "base64"));

    await tab.send("Page.navigate", { url: APP_URL }); await waitFor(() => tab.evaluate("document.body.innerText.includes('Client Portal')"), "Staff application did not render"); await click(tab, "Client Portal"); await waitFor(() => tab.evaluate(`[...document.querySelectorAll('article')].some(item=>item.textContent.includes(${JSON.stringify(`TEST-CL-${fixture.suffix.toUpperCase()}`)})&&item.querySelector('button'))`), "Disposable request did not render in the staff Changes Requested queue"); const opened = await tab.evaluate(`(()=>{const row=[...document.querySelectorAll('article')].find(item=>item.textContent.includes(${JSON.stringify(`TEST-CL-${fixture.suffix.toUpperCase()}`)}));const button=row?.querySelector('button');if(!button)return false;button.click();return true})()`); assert.equal(opened, true); try { await waitFor(() => tab.evaluate("document.body.innerText.toLowerCase().includes('immutable customer review')"), "Staff change detail did not render", 10_000); } catch (error) { throw new Error(`${error.message}: ${JSON.stringify({ body: await tab.evaluate("document.body.innerText"), failures: tab.failures, diagnostics: tab.diagnostics })}`); } const staffChanges = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "02-staff-changes-requested--1920x1080.png"), Buffer.from(staffChanges.data, "base64")); await click(tab, "Create working revision"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Working revision created')"), "Staff UI did not create the working revision"); await waitFor(() => tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Prepare supplier change preview'))"), "Supplier change correspondence UI did not become available"); assert.equal(await tab.evaluate("[...document.querySelectorAll('label')].find(item=>item.textContent.includes('Send now to the configured factory test address'))?.querySelector('input')?.disabled"),true); await input(tab, ".portal-operation-detail fieldset input[type=email]", FACTORY); await click(tab, "Prepare supplier change preview"); await waitFor(() => tab.evaluate("document.body.innerText.includes('correspondence prepared in preview-only mode')"), "Staff UI did not prepare the supplier change correspondence");

    const queue = await staff("/api/lifecycle/changes-requested", null, "GET"), reviewId = queue.find((item) => item.client_ref === `TEST-CL-${fixture.suffix.toUpperCase()}`)?.review_submission_id; assert.ok(reviewId, "Disposable change request was absent from the staff queue");
    const changeDetail = await staff(`/api/lifecycle/changes-requested/${reviewId}`, null, "GET"), revisionRequest = changeDetail.supplierRevision; assert.ok(revisionRequest?.id, "Staff UI did not persist the supplier revision request");
    await staff(`/api/lifecycle/supplier-revisions/${revisionRequest.id}/returned-document`, { sourceKind: "canonical_document", canonicalDocumentId: fixture.returnedRevisionId, revision: "2" });
    const firstVerification = await staff(`/api/lifecycle/supplier-revisions/${revisionRequest.id}/verification`, { checks: [{ estimatePositionId: "test-position-w01", fieldKey: "external_finish", requestedChange: "Black", beforeValue: "White", expectedValue: "Black", afterValue: "Black", beforeSourceReference: "Issued Estimate W01", afterSourceReference: "Returned revision 2 p2" }, { estimatePositionId: null, fieldKey: "general_finish_schedule", requestedChange: "Update finish schedule", beforeValue: "Original", expectedValue: "Updated", afterValue: "Updated", beforeSourceReference: "Issued Estimate overview", afterSourceReference: "Returned revision 2 overview" }], unrelatedChanges: [{ estimatePositionId: "test-position-d01", fieldKey: "hardware", requestedChange: "Unrelated material change", beforeValue: "Standard", expectedValue: "Standard", afterValue: "Alternative", beforeSourceReference: "Issued Estimate D01", afterSourceReference: "Returned revision 2 p3" }] }, "PUT"); assert.equal(firstVerification.issueAllowed, false);
    const verified = await staff(`/api/lifecycle/supplier-revisions/${revisionRequest.id}/verification`, { checks: [{ estimatePositionId: "test-position-w01", fieldKey: "external_finish", requestedChange: "Black", beforeValue: "White", expectedValue: "Black", afterValue: "Black", beforeSourceReference: "Issued Estimate W01", afterSourceReference: "Returned revision 2 p2" }, { estimatePositionId: null, fieldKey: "general_finish_schedule", requestedChange: "Update finish schedule", beforeValue: "Original", expectedValue: "Updated", afterValue: "Updated", beforeSourceReference: "Issued Estimate overview", afterSourceReference: "Returned revision 2 overview" }], unrelatedChanges: [{ estimatePositionId: "test-position-d01", fieldKey: "hardware", requestedChange: "Unrelated material change", beforeValue: "Standard", expectedValue: "Standard", afterValue: "Alternative", beforeSourceReference: "Issued Estimate D01", afterSourceReference: "Returned revision 2 p3", approvedDifference: true, resolutionNote: "Reviewed and accepted for the successor Estimate." }] }, "PUT"); assert.equal(verified.issueAllowed, true);

    const db = await open({ filename: databasePath, driver: sqlite3.Database });
    let successor, successorProjection, issuedSuccessor;
    try {
      successor = await db.get("SELECT * FROM estimates WHERE id=?", revisionRequest.successorEstimateId); const issuance = createIssuedQuotationService(db, { attachmentRoot }),terms=await issuance.saveCustomerTerms(successor.id,{validityDays:30,terms:["Final dimensions are subject to survey."],exclusions:["Building work by others."],reviewedBy:"test-staff"});successorProjection = {...projection(successor.estimate_ref, 2),commercialTerms:{validityDays:terms.validityDays,terms:terms.terms,exclusions:terms.exclusions,reviewed:true,reviewedAt:terms.reviewedAt}};
      const prepared = await issuance.prepare({ estimateId: successor.id, clientId: fixture.clientId, estimateRevision: 2, quotationRevision: 2, projection: successorProjection, recipient: CUSTOMER, subject: `TEST Updated Estimate ${successor.estimate_ref}` });
      await db.run("UPDATE communication_messages SET status='sent',folder='sent',provider_message_id=?,sent_at=? WHERE id=?", `test-message-successor-${fixture.suffix}`, "2026-09-10T10:00:00.000Z", prepared.communicationMessageId);
      issuedSuccessor = await issuance.send(prepared.id);
    } finally { await db.close(); }
    assert.equal(issuedSuccessor.status, "issued");

    await tab.send("Page.navigate", { url: `${APP_URL}/?journey=successor#/client-portal` }); try { await waitFor(() => tab.evaluate(`document.body.innerText.includes(${JSON.stringify(successor.estimate_ref)})`), "HttpOnly customer session did not recover onto the successor Estimate", 10_000); } catch (error) { throw new Error(`${error.message}: ${JSON.stringify({ body: await tab.evaluate("document.body.innerText"), failures: tab.failures, diagnostics: tab.diagnostics })}`); } const successorPortalEstimateHash = await tab.evaluate(`(async()=>{const link=[...document.querySelectorAll('a')].find(item=>item.textContent.includes('View issued Estimate'));const response=await fetch(link.href,{credentials:'include'}),bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return {status:response.status,type:response.headers.get('content-type'),hash:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}})()`); assert.deepEqual({ status: successorPortalEstimateHash.status, type: successorPortalEstimateHash.type, hash: successorPortalEstimateHash.hash }, { status: 200, type: "application/pdf", hash: issuedSuccessor.document.sha256 }); await click(tab, "Accept Estimate"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Explicitly confirm each Position')"), "Customer acceptance did not open"); const acceptanceChecked = await tab.evaluate(`(()=>{for(const input of document.querySelectorAll('.portal-external__position-check input'))if(!input.checked)input.click();const overall=document.querySelector('.portal-external__overall-check input');if(!overall)return {ok:false,body:document.body.innerText};if(!overall.checked)overall.click();return {ok:true}})()`); assert.equal(acceptanceChecked.ok, true, JSON.stringify({ acceptanceChecked, diagnostics: tab.diagnostics, failures: tab.failures })); await waitFor(() => tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Submit Estimate acceptance'))"), "Estimate acceptance submit action disappeared", 5_000); await click(tab, "Submit Estimate acceptance"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Estimate accepted')&&document.body.innerText.includes('waiting for staff approval')&&document.body.innerText.includes('No factory order was sent')"), "Customer Estimate acceptance was not recorded");
    await tab.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); const acceptedScreen = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "03-customer-order-created--1440x900.png"), Buffer.from(acceptedScreen.data, "base64"));

    const orderDb = await open({ filename: databasePath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY }), order = await orderDb.get("SELECT * FROM orders WHERE source_estimate_id=?", successor.id); await orderDb.close(); assert.ok(order?.id, "Customer acceptance did not create the canonical Order");
    await tab.send("Page.navigate", { url: `${APP_URL}/?journey=staff-order` }); await waitFor(() => tab.evaluate("document.body.innerText.includes('Client Portal')"), "Staff application did not reopen for the Order journey"); await click(tab, "Client Portal"); await waitFor(() => tab.evaluate(`[...document.querySelectorAll('.client-portal-directory__list article')].some(item=>item.textContent.includes(${JSON.stringify(`TEST-CL-${fixture.suffix.toUpperCase()}`)}))`), "Disposable Client was absent from the Portal directory"); const portalOpened = await tab.evaluate(`(()=>{const row=[...document.querySelectorAll('.client-portal-directory__list article')].find(item=>item.textContent.includes(${JSON.stringify(`TEST-CL-${fixture.suffix.toUpperCase()}`)}));const button=row?.querySelector('button');if(!button)return false;button.click();return true})()`); assert.equal(portalOpened, true); await waitFor(() => tab.evaluate(`document.body.innerText.includes(${JSON.stringify(order.order_ref)})`), "Internal Portal did not show the accepted Order"); await click(tab, "Open Order journey"); await waitFor(() => tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Approve Order for factory'))"), "Order approval action did not render"); await click(tab, "Approve Order for factory"); await waitFor(() => tab.evaluate("document.body.innerText.includes('immutable staff-approved Order PDF created')"), "Staff UI did not approve the Order"); await waitFor(() => tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Prepare factory Order preview'))"), "Factory Order preview action did not render"); assert.equal(await tab.evaluate("[...document.querySelectorAll('label')].find(item=>item.textContent.includes('Send now to the configured factory test address'))?.querySelector('input')?.disabled"),true); await input(tab, ".portal-operation-detail fieldset input[type=email]", FACTORY); await click(tab, "Prepare factory Order preview"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Factory Order email and PDF prepared')"), "Staff UI did not prepare the factory Order"); const orderStaffScreen = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "04-staff-order-prepared--1440x900.png"), Buffer.from(orderStaffScreen.data, "base64"));
    const approvalReplay = await staff(`/api/lifecycle/orders/${order.id}/staff-approval`, { note: "Exact issued Estimate and Position acceptance reviewed." }); assert.equal(approvalReplay.idempotentReplay, true);
    const factoryOrder = await staff(`/api/lifecycle/orders/${order.id}/factory-order`, { recipient: FACTORY, subject: `TEST Factory Order ${order.order_ref}`, bodyText: "Please review the attached staff-approved Order and return the confirmation.", documentIds: [fixture.projectDrawingId], send: false }); assert.equal(factoryOrder.delivery.deliveryMode, "preview_only");
    const incompleteConfirmation = await staff(`/api/lifecycle/orders/${order.id}/factory-confirmations`, { canonicalDocumentId: fixture.factoryConfirmationDocumentId, revision: "1", checks: [] }); assert.equal(incompleteConfirmation.releaseAllowed, false); assert.equal(incompleteConfirmation.missingPositionIds.length, 3);
    const confirmation = await staff(`/api/lifecycle/orders/${order.id}/factory-confirmations`, { canonicalDocumentId: fixture.factoryConfirmationDocumentId, revision: "1", checks: successorProjection.positions.map((position) => ({ estimatePositionId: position.id, fieldKey: "complete_position", approvedValue: `${position.description} · ${position.configurationDescription}`, confirmedValue: `${position.description} · ${position.configurationDescription}`, approvedSourceReference: `Issued Estimate · ${position.reference}`, confirmationSourceReference: `Factory confirmation revision 1 · ${position.reference}` })) }); assert.equal(confirmation.releaseAllowed, true);
    const confirmationRelease = await staff(`/api/lifecycle/factory-confirmations/${confirmation.confirmationId}/release`, {});

    await tab.send("Page.navigate", { url: `${APP_URL}/?journey=confirmation#/client-portal` }); await waitFor(() => tab.evaluate("document.body.innerText.toLowerCase().includes('final confirmation')"), "Released factory confirmation did not appear in the customer session"); await tab.evaluate(`(()=>{document.querySelectorAll('.portal-external__position-check input').forEach(input=>{if(!input.checked)input.click()});const overall=document.querySelector('.portal-external__overall-check input');if(!overall.checked)overall.click();return true})()`); await click(tab, "Submit final confirmation approval"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Final confirmation approved')&&document.body.innerText.includes('continues delivery planning')"), "Customer final confirmation was not recorded");
    await tab.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); const finalMobile = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(path.join(OUTPUT, "05-customer-final-signoff--390x844.png"), Buffer.from(finalMobile.data, "base64")); const mobileOverflow = await tab.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"); assert.ok(mobileOverflow <= 1, `Customer Portal overflowed by ${mobileOverflow}px on mobile`);
    const signedPdf = await staff(`/api/lifecycle/factory-confirmation-releases/${confirmationRelease.id}/signed-approval`, { signedPdfDocumentId: fixture.signedConfirmationDocumentId, reviewed: true, overallApproved: true, positionIds: successorProjection.positions.map((position) => position.id) }); assert.equal(signedPdf.status, "customer_final_confirmation_approved");

    const finalDb = await open({ filename: databasePath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
    const lifecycleDocuments = await finalDb.all("SELECT * FROM customer_lifecycle_documents WHERE order_id=? ORDER BY created_at", order.id), orderDocument = lifecycleDocuments.find((item) => item.document_kind === "order" && item.revision === "staff-approved"), finalDocument = lifecycleDocuments.find((item) => item.document_kind === "final_confirmation"); assert.ok(orderDocument && finalDocument, "Immutable Order/final confirmation documents were not created");
    const issuedRow = await finalDb.get("SELECT d.* FROM issued_quotations i JOIN customer_quotation_documents d ON d.id=i.document_id WHERE i.id=?", issuedSuccessor.id); const releaseRow = await finalDb.get("SELECT customer_projection_json,document_id FROM estimate_revision_releases WHERE issued_quotation_id=?", issuedSuccessor.id), emailAttachment = await finalDb.get("SELECT storage_key,sha256 FROM communication_attachments WHERE communication_message_id=?", issuedSuccessor.communicationMessageId); assert.equal(releaseRow.document_id, issuedRow.id); assert.equal(sha256(releaseRow.customer_projection_json), sha256(issuedRow.projection_json)); assert.equal(emailAttachment.storage_key, issuedRow.storage_key); assert.equal(emailAttachment.sha256, issuedRow.sha256); await finalDb.close();
    const downloads = [
      { path: `${API_URL}/api/quotation-workflow/issued/${issuedSuccessor.id}/document`, file: path.join(OUTPUT, `${successor.estimate_ref}-Estimate.pdf`), expected: ["Estimate", successor.estimate_ref, "W01", "D01", "£7,500.00"] },
      { path: `${API_URL}/api/lifecycle/documents/${orderDocument.id}`, file: path.join(OUTPUT, `${order.order_ref}-Order.pdf`), expected: ["Order", order.order_ref, "Staff approval", "W01", "D01"] },
      { path: `${API_URL}/api/lifecycle/documents/${finalDocument.id}`, file: path.join(OUTPUT, `${order.order_ref}-Final-Confirmation.pdf`), expected: ["Final Confirmation", order.order_ref, "Factory confirmation checks", "Customer Position approval", "Overall approval", "W01", "D01"] },
    ];
    const pdfEvidence = [];
    for (const item of downloads) { const response = await fetch(item.path); assert.equal(response.status, 200); assert.match(response.headers.get("content-type") || "", /application\/pdf/); await writeFile(item.file, Buffer.from(await response.arrayBuffer())); pdfEvidence.push(await inspectPdf(item.file, item.expected)); }
    assert.equal(pdfEvidence[0].sha256, issuedRow.sha256, "Downloaded issued Estimate did not match immutable archive bytes"); assert.equal(successorPortalEstimateHash.hash, issuedRow.sha256, "Portal successor Estimate bytes diverged from immutable archive");

    const previewResponse = await fetch(`${API_URL}/api/quotation-workflow/preview-document`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projection: successorProjection,estimateId:successor.id }) }); assert.equal(previewResponse.status, 200); const previewFile = path.join(OUTPUT, `${successor.estimate_ref}-Estimate-preview.pdf`); await writeFile(previewFile, Buffer.from(await previewResponse.arrayBuffer())); const previewEvidence = await inspectPdf(previewFile, ["Estimate", successor.estimate_ref, "W01", "D01", "£7,500.00"]);

    const diagnostics = tab.diagnostics.filter(Boolean), unexpectedFailures = tab.failures.filter((failure) => !failure.url.endsWith("/api/client-portal/external/session") || failure.status !== 401); assert.deepEqual(diagnostics, []); assert.deepEqual(unexpectedFailures, []);
    tab.socket.close(); tab = null; cleanup = await controller.stop("journey-complete"); browser = null; await terminateOwnedProcessTree(vite, { platformName: process.platform }); vite = null; await terminateOwnedProcessTree(api, { platformName: process.platform }); api = null;
    const proofDb = await open({ filename: databasePath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY }); const proof = { originalEstimateStatus: (await proofDb.get("SELECT status FROM estimates WHERE id=?", fixture.estimateId)).status, successorRevision: (await proofDb.get("SELECT revision_no FROM estimates WHERE id=?", successor.id)).revision_no, orderStatus: (await proofDb.get("SELECT status FROM orders WHERE id=?", order.id)).status, reviewCount: (await proofDb.get("SELECT COUNT(*) count FROM portal_review_submissions")).count, revisionCheckCount: (await proofDb.get("SELECT COUNT(*) count FROM revision_change_checks")).count, confirmationCheckCount: (await proofDb.get("SELECT COUNT(*) count FROM factory_confirmation_checks")).count, signedPdfReviewCount: (await proofDb.get("SELECT COUNT(*) count FROM factory_confirmation_signed_pdf_reviews")).count }; await proofDb.close();
    assert.equal(proof.originalEstimateStatus, "Issued"); assert.equal(proof.successorRevision, 2); assert.equal(proof.orderStatus, "customer_final_confirmation_approved"); assert.equal(proof.signedPdfReviewCount, 1);
    console.log(JSON.stringify({ mode: "development_test_adapter", delivery: "preview_only", addresses: { customerConfigured: true, factoryConfigured: true }, journey: proof, contentAgreement: { immutableEstimateSha256: issuedRow.sha256, downloadSha256: pdfEvidence[0].sha256, portalDownloadSha256: successorPortalEstimateHash.hash, releaseDocumentId: releaseRow.document_id, issuedDocumentId: issuedRow.id, emailAttachmentSha256: emailAttachment.sha256, emailAttachmentStorageKey: emailAttachment.storage_key, previewAndIssueShareRenderer: true }, pdfEvidence: [...pdfEvidence, previewEvidence], screenshots: OUTPUT, browserCleanup: { ownedProcesses: cleanup.ownedBrowserProcessesRemaining, ownedProfiles: cleanup.ownedTemporaryProfilesRemaining } }, null, 2));
  } finally {
    try { tab?.socket.close(); } catch {}
    if (browser) await controller.stop("final");
    if (vite) await terminateOwnedProcessTree(vite, { platformName: process.platform });
    if (api) await terminateOwnedProcessTree(api, { platformName: process.platform });
    for (let attempt = 0; attempt < 25; attempt += 1) {
      try { await rm(root, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 24) console.error(`Temporary journey workspace cleanup remains pending: ${error.message}`); else await delay(200); }
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
