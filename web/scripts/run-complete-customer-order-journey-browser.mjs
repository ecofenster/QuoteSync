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
import {createCommunicationRepository} from '../server/features/communications/communicationRepository.js';
import { pdfJsRuntimeOptions } from "../server/features/supplierImportLab/pdfJsRuntime.js";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTree } from "./e2e-owned-process.mjs";
import { initializeIsolatedJourneyDatabase } from "./isolated-journey-database.mjs";
import { createServer as createPortProbe } from "node:net";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";
import { pathToFileURL } from 'node:url';
import {createGoogleWorkspaceService} from '../server/features/integrations/googleWorkspaceService.js';
import {GOOGLE_WORKSPACE_SCOPES} from '../server/features/integrations/googleWorkspaceService.js';
import {extractSupplierDocument} from '../server/features/supplierImportLab/documentExtraction.js';
import {parsePdfSupplierFields} from '../server/features/supplierImportLab/pdfSupplierAdapters.js';

const APP_URL = "http://127.0.0.1:5276";
const API_URL = "http://127.0.0.1:3104";
const DEBUG_PORT = 9416;
const CUSTOMER = "customer.journey@example.test";
const FACTORY = "factory.journey@example.test";
const OUTPUT = path.resolve("test-output/complete-customer-order-journey");
const sourceFactoryReconcile=process.argv.includes('--stop-after-source-backed-factory-reconcile');
const supplierPartial=process.argv.includes('--stop-after-supplier-send-partial');
const supplierReconcile=process.argv.includes('--stop-after-supplier-reconcile');
const followupRestart=process.argv.includes('--stop-after-followup-restart');
const followupCancellation=process.argv.includes('--stop-after-followup-cancellation');
const followupReconcile=followupRestart||process.argv.includes('--stop-after-followup-reconcile');
const legacyCorrespondenceReview=process.argv.includes('--stop-after-legacy-supplier-correspondence');
const supplierFollowup=followupCancellation||followupReconcile||supplierReconcile||supplierPartial||process.argv.includes('--stop-after-supplier-followup');
const sourceFactorySend=sourceFactoryReconcile||process.argv.includes('--stop-after-source-backed-factory-send');
const sourceStaffOrder=sourceFactorySend||process.argv.includes('--stop-after-source-backed-staff-order');
const sourceCustomerOrder=sourceStaffOrder||process.argv.includes('--stop-after-source-backed-customer-order');
const sourceCustomerReissue=sourceCustomerOrder||process.argv.includes('--stop-after-source-backed-customer-reissue');
const sourceCustomerPreparation=sourceCustomerReissue||process.argv.includes('--stop-after-source-backed-customer-preparation');
const sourceReviewCorrection=process.argv.includes('--stop-after-source-review-correction');
const overallSourceReview=sourceReviewCorrection||sourceCustomerPreparation||process.argv.includes('--stop-after-source-backed-overall-review');
const receivedSupplierReviews=process.argv.includes('--stop-after-received-supplier-reviews');
const multiSupplierReview=receivedSupplierReviews||process.argv.includes('--stop-after-multi-supplier-review');
const providerJourneyRequested=supplierFollowup||overallSourceReview||receivedSupplierReviews||['--stop-after-supplier-filing','--stop-after-supplier-review','--stop-after-multi-supplier-review'].some(flag=>process.argv.includes(flag));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };
const waitFor = async (fn, message, timeout = 60_000) => { const started = Date.now(); while (Date.now() - started < timeout) { const result = await fn().catch(() => false); if (result) return result; await delay(150); } throw new Error(message); };
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });

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
  const providerJourney=providerJourneyRequested;
  const estimateReference = providerJourney?'EF-EST-2026-901':`TEST-EST-${suffix.toUpperCase()}`;
  const clientReference=providerJourney?'EF-CL-901':`TEST-CL-${suffix.toUpperCase()}`;
  const customerProjection = projection(estimateReference, 1);
  if(overallSourceReview){
    const filename=path.resolve('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf');
    const extracted=await extractSupplierDocument(filename,{id:'test-baseline-evidence',mediaType:'application/pdf',sha256:sha256(await readFile(filename))});
    const first=parsePdfSupplierFields(extracted).rows.find(row=>row.displayReference==='001');assert.ok(first?.widthMm&&first?.heightMm);
    assert.match(extracted.pages[0].blocks.map(block=>block.text).join(' '),/RAL:\s*7016\s*\(Anthracite grey\)\s*Matt/);
    // Test-owned issued requirement, not a claim about the real customer's prior offer.
    customerProjection.positions=[{...customerProjection.positions[0],reference:first.displayReference,customerReference:first.displayReference,widthMm:first.widthMm,heightMm:first.heightMm,quantity:first.quantity,productSystem:first.productSystem,description:'Disposable window requirement',configurationDescription:'Source-matched test opening',thermal:{},specification:[{label:'External finish',value:'White'}]}];
  }
  await db.run(`INSERT INTO clients(id,name,email,contact_name,company_name,client_ref,project_name,created_at,deleted_at,commercial_lifecycle,reference_namespace,updated_at) VALUES(?,?,?,?,?,?,?,?,NULL,'prospect','test',?)`, clientId, "TEST Customer Journey", CUSTOMER, "TEST Customer Journey", "", clientReference, customerProjection.projectName, now, now);
  await db.run("INSERT INTO projects(id,client_id,name,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)", projectId, clientId, customerProjection.projectName, now, now);
  await db.run("INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at) VALUES('TEST-JOURNEY-SUPPLIER','TEST Journey Supplier','{}','{}',?)",now);
  if(receivedSupplierReviews)await db.run("INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at) VALUES('ZYLE','Zyle Fenster','{}','{}',?)",now);
  await db.run("INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at) VALUES('EKO','EKO-OKNA',?,'{}',?) ON CONFLICT(supplier_code) DO NOTHING",JSON.stringify({pricingMethod:'factory_price',pricingBasis:'factory_price',paidInQuotedCurrency:true,settlementCurrency:'EUR'}),now);
  if(!await db.get("SELECT id FROM configurator_manufacturers WHERE code='EKO' OR name='EKO-OKNA'"))await db.run("INSERT INTO configurator_manufacturers(id,name,code,is_active) VALUES('test-manufacturer-eko','EKO-OKNA','EKO',1)");
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
  return { suffix, clientId, clientReference, projectId, estimateId, estimateReference, issuedId, document, projection: customerProjection, release, invitation, projectDrawingId: `test-project-drawing-${suffix}`, returnedRevisionId: `test-returned-revision-${suffix}`, factoryConfirmationDocumentId: `test-factory-confirmation-${suffix}`, signedConfirmationDocumentId: `test-signed-confirmation-${suffix}` };
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
  assert.equal(result, true, `Could not find action: ${label}${result?'':`: ${await tab.evaluate('document.body.innerText')}`}`);
}
async function reloadWorkingEstimate(tab){
  const previousOrigin=await tab.evaluate('performance.timeOrigin');
  await tab.send('Page.reload',{ignoreCache:true});
  try{await waitFor(()=>tab.evaluate(`performance.timeOrigin!==${previousOrigin}&&document.readyState==='complete'&&[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Request supplier estimate / revision'))`),'Exact working Estimate did not reopen after reload')}
  catch(error){throw new Error(`${error.message}: ${JSON.stringify({body:await tab.evaluate('document.body.innerText'),failures:tab.failures,diagnostics:tab.diagnostics})}`)}
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

async function inspectPdf(filePath, expected, forbidden = []) {
  const bytes = await readFile(filePath), task = getDocument(pdfJsRuntimeOptions({ data: new Uint8Array(bytes) }));
  try {
    const pdf = await task.promise; let searchableText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) { const page = await pdf.getPage(pageNumber), content = await page.getTextContent(); searchableText += ` ${content.items.map((item) => item.str).join(" ")}`; page.cleanup(); }
    for (const term of expected) assert.match(searchableText, new RegExp(term, "i"), `${path.basename(filePath)} is missing ${term}`);
    for (const term of forbidden) assert.ok(!searchableText.includes(term), `${path.basename(filePath)} exposes ${term}`);
    const renderPage = async (pageNumber, suffix) => { const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 1.25 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)), context = canvas.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvasContext: context, canvas, viewport, annotationMode: 0 }).promise; const output = filePath.replace(/\.pdf$/i, suffix); await writeFile(output, await canvas.encode("png")); const size = { width: viewport.width / 1.25, height: viewport.height / 1.25 }; page.cleanup(); return { output, size }; };
    const cover = await renderPage(1, "--cover.png"), schedule = await renderPage(Math.min(3, pdf.numPages), "--schedule.png"), summary = await renderPage(pdf.numPages, "--summary.png");
    return { filePath, sizeBytes: bytes.length, sha256: sha256(bytes), pageCount: pdf.numPages, searchableCharacters: searchableText.replace(/\s+/g, "").length, firstPage: cover.size, previewPaths: { cover: cover.output, schedule: schedule.output, summary: summary.output } };
  } finally { await task.destroy(); }
}

async function run() {
  const userApiBefore=await fetch('http://127.0.0.1:3001/api/health').then(response=>response.ok?response.json():null).catch(()=>null);
  for(const port of [3104,5276,DEBUG_PORT]){
    const probe=createPortProbe();await new Promise((resolve,reject)=>{probe.once('error',()=>reject(new Error(`Acceptance port ${port} is already occupied; no existing listener will be replaced.`)));probe.listen(port,'127.0.0.1',resolve)});await new Promise(resolve=>probe.close(resolve));
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "quotesuite-complete-journey-")), databasePath = path.join(root, "quotesync.db"), attachmentRoot = path.join(root, "attachments");
  let api, vite, browser, tab, cleanup;
  let cleanupPromise;
  const dispose=()=>cleanupPromise||(cleanupPromise=(async()=>{
    try{tab?.socket.close()}catch{}
    try{cleanup=await controller.stop('final');if(cleanup)console.log(JSON.stringify({ownedBrowserCleanup:cleanup}));}
    finally{
      const stopped=await Promise.allSettled([vite,api].map(async child=>{if(child?.pid&&child.exitCode===null&&child.signalCode===null){const result=await terminateOwnedProcessTree(child,{platformName:process.platform});if(!result.exited)throw new Error(`Owned test process ${child.pid} did not exit.`);}}));
      const failedStop=stopped.find(result=>result.status==='rejected');if(failedStop)throw failedStop.reason;
      await rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:200});
      const userApiAfter=await fetch('http://127.0.0.1:3001/api/health').then(response=>response.ok?response.json():null).catch(()=>null);
      assert.equal(userApiAfter?.instanceId||null,userApiBefore?.instanceId||null,'User API baseline changed during isolated acceptance');
    }
  })());
  const interrupt=()=>{void dispose().then(()=>process.exit(130),error=>{console.error(error);process.exit(1)})};
  process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);process.once('SIGBREAK',interrupt);
  try {
    await mkdir(attachmentRoot, { recursive: true }); await mkdir(OUTPUT, { recursive: true });
    const isolation=await initializeIsolatedJourneyDatabase({databasePath,attachmentRoot});
    console.log(JSON.stringify({journeyIsolation:isolation}));
    const fixture=await seed(databasePath,attachmentRoot);
    const providerJourney=providerJourneyRequested,providerKey=createHash('sha256').update(randomUUID()).digest('hex');
    if(providerJourney)await writeFile(path.join(root,'provider-source.pdf'),await readFile(path.resolve('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf')));
    if(receivedSupplierReviews)await writeFile(path.join(root,'provider-second-source.docx'),await readFile(path.resolve('docs/Supplier_Quotes/343117-3_EF-EST-2026-004 - Luke.docx')));
const startApi=()=>spawn(process.execPath, ["--import",pathToFileURL(path.resolve('tests/fixtures/isolatedJourneyExchangeRate.mjs')).href,...(providerJourney?['--import',pathToFileURL(path.resolve('tests/fixtures/isolatedJourneyGoogle.mjs')).href]:[]),"server/index.js"], { cwd: process.cwd(), env: { ...process.env, ...(providerJourney?{QUOTESUITE_INTEGRATION_ENCRYPTION_KEY:providerKey}:{}), QUOTESUITE_DB_PATH: databasePath, QUOTESYNC_ATTACHMENT_ROOT: attachmentRoot, PORT: "3104", NODE_ENV: "development", QUOTESUITE_APP_ORIGINS: APP_URL, QUOTESUITE_TEST_JOURNEY: "1", QUOTESUITE_TEST_DELIVERY_ENABLED: (sourceCustomerReissue||supplierFollowup)?"1":"0", QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY:followupReconcile?'followup-reconcile':supplierReconcile?'supplier-reconcile':supplierFollowup?'supplier-followup':sourceFactoryReconcile?'factory-reconcile':sourceFactorySend?'factory-send':sourceCustomerReissue?'customer-reissue':'', QUOTESUITE_TEST_CUSTOMER_EMAIL: CUSTOMER, QUOTESUITE_TEST_FACTORY_EMAIL: FACTORY }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    api=startApi();
    let apiStartupLog='';for(const stream of [api.stdout,api.stderr])stream.on('data',chunk=>{apiStartupLog=(apiStartupLog+String(chunk)).slice(-5000)});
    vite = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5276"], { cwd: process.cwd(), env: { ...process.env, VITE_API_BASE_URL: API_URL }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    try{await waitFor(() => reachable(`${API_URL}/api/health`), "Disposable journey API did not start")}catch(error){throw new Error(`${error.message}: ${apiStartupLog}`)} await waitFor(() => reachable(APP_URL), "Disposable journey UI did not start");
    const runtime=await (await fetch(`${API_URL}/api/health`)).json();assert.equal(runtime.runtimeVersion,QUOTESUITE_RUNTIME_CONTRACT.version,'Disposable API runtime contract is incompatible');
    const profile = await controller.createProfile({ label: "complete-customer-order-journey", debugPort: DEBUG_PORT });
    browser = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "--window-size=1920,1080", "about:blank"], { stdio: "ignore", windowsHide: true });
    controller.setRun({ child: browser }); await waitFor(() => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Owned Chrome did not start", 15_000); controller.setRun({ child: browser, userDataDir: profile, debugPort: DEBUG_PORT, profileProcessCountDuring: await countBrowserRunProfiles(profile, { platformName: process.platform }) }); tab = await connect();

    await tab.send("Page.navigate", { url: `${APP_URL}/#/client-portal?token=${encodeURIComponent(fixture.invitation.token)}` }); await waitFor(() => tab.evaluate("document.body.innerText.includes('Open your Project')"), "Invitation screen did not render");
    await input(tab, "input[type=email]", CUSTOMER); await click(tab, "Continue securely"); await waitFor(() => tab.evaluate(`document.body.innerText.includes(${JSON.stringify(fixture.estimateReference)})`), "Customer session did not open the issued Estimate");
    const originalPortalEstimateHash = await tab.evaluate(`(async()=>{const link=[...document.querySelectorAll('a')].find(item=>item.textContent.includes('View issued Estimate'));const response=await fetch(link.href,{credentials:'include'}),bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return {status:response.status,type:response.headers.get('content-type'),hash:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}})()`);
    assert.deepEqual({ status: originalPortalEstimateHash.status, type: originalPortalEstimateHash.type, hash: originalPortalEstimateHash.hash }, { status: 200, type: "application/pdf", hash: fixture.document.sha256 });
    await click(tab, "Review Estimate"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Review every Position')"), "Customer Position review did not open");
    await input(tab, ".portal-external__positions fieldset:first-child select", "amendment_requested"); await input(tab, ".portal-external__positions fieldset:first-child textarea", overallSourceReview?"Change the external finish from White to RAL: 7016 (Anthracite grey) Matt.":"Change the external finish from white to black."); await input(tab, "section.portal-external__command > label select", "amendment_requested"); await input(tab, "section.portal-external__command > label textarea", overallSourceReview?"Confirm the supplier quotation reference WEB/26/1133450.":"Update the project finish schedule to match."); await click(tab, "Submit reviewed responses"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Response recorded')&&document.body.innerText.includes('project team reviews')"), "Customer changes were not acknowledged");
    const reviewDesktop = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "01-customer-changes-submitted--1920x1080.png"), Buffer.from(reviewDesktop.data, "base64"));

    await tab.send("Page.navigate", { url: APP_URL }); await waitFor(() => tab.evaluate("document.body.innerText.includes('Client Portal')"), "Staff application did not render"); await click(tab, "Client Portal");
    await waitFor(() => tab.evaluate(`[...document.querySelectorAll('article')].some(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})&&item.querySelector('button'))`), "Disposable request did not render in the staff Changes Requested queue");
    const opened = await tab.evaluate(`(()=>{const row=[...document.querySelectorAll('article')].find(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)}));const button=row?.querySelector('button');if(!button)return false;button.click();return true})()`); assert.equal(opened, true);
    await waitFor(() => tab.evaluate("document.body.innerText.toLowerCase().includes('immutable customer review')"), "Staff change detail did not render");
    const staffChanges = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "02-staff-changes-requested--1920x1080.png"), Buffer.from(staffChanges.data, "base64"));
    await click(tab, "Create working revision"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Working revision created')"), "Staff UI did not create the working revision");
    await click(tab, "Open working Estimate");
    await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Request supplier estimate / revision'))"),'Working Estimate did not expose the consolidated supplier composer');
    if(legacyCorrespondenceReview){
      const context=await staff(`/api/lifecycle/projects/${fixture.projectId}/supplier-enquiries`,null,'GET'),legacyDb=await open({filename:databasePath,driver:sqlite3.Database});
      try{
        const legacyBytes=Buffer.from('Original retained supplier instructions for disposable review.');await writeFile(path.join(attachmentRoot,'legacy-instructions.txt'),legacyBytes);
        await createCommunicationRepository(legacyDb).save({id:'test-legacy-correspondence',provider:'quotesuite_preview',direction:'outbound',folder:'drafts',status:'draft',to:[FACTORY],subject:'TEST Earlier supplier correspondence',bodyText:'Please review the original retained request for the black external finish.',attachments:[{id:'test-legacy-file',fileName:'Legacy instructions.txt',mediaType:'text/plain',storageKey:'legacy-instructions.txt',sha256:sha256(legacyBytes)},{id:'test-unconfirmed-file',fileName:'Unconfirmed old drawing.pdf',mediaType:'application/pdf',driveFileId:'unconfirmed-file'}],links:[]});
        await legacyDb.run("INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES('test-legacy-event','supplier.revision.correspondence_reviewed','test-legacy-evidence','2026-09-01',?,'2026-09-01')",JSON.stringify([{kind:'supplier_revision_request',id:context.revisionRequest.id},{kind:'communication',id:'test-legacy-correspondence'}]));
        for(let index=0;index<20;index++){
          const id=`test-older-correspondence-${index}`;await createCommunicationRepository(legacyDb).save({id,provider:'quotesuite_preview',direction:'outbound',folder:'drafts',status:'draft',to:[FACTORY],subject:`TEST historical message ${index}`,bodyText:'Retained older test wording',createdAt:'2020-01-01T09:00:00Z',attachments:[],links:[]});
          await legacyDb.run("INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,'supplier.revision.correspondence_reviewed',?,'2020-01-01',?,'2020-01-01')",id,id,JSON.stringify([{kind:'supplier_revision_request',id:context.revisionRequest.id},{kind:'communication',id}]));
        }
      }finally{await legacyDb.close()}
    }
    await click(tab,'Request supplier estimate / revision');
    await waitFor(()=>tab.evaluate("document.querySelector('.supplier-rfq input[type=email]')&&!document.body.innerText.includes('Loading supplier request context')"),'Supplier composer did not load');
    if(legacyCorrespondenceReview){
      await waitFor(()=>tab.evaluate("[...document.querySelectorAll('summary')].some(item=>item.textContent.startsWith('Earlier supplier correspondence'))"),'Earlier correspondence was inaccessible');
      await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent.startsWith('Earlier supplier correspondence')).click()");
      await click(tab,'Older messages');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Showing 21–21 of 21')"),'Bounded older correspondence page did not open');
      await click(tab,'Newer messages');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Showing 1–20 of 21')"),'Newer correspondence page did not return');
      const legacyDownload=await tab.evaluate("(async()=>{const link=[...document.querySelectorAll('.supplier-rfq a')].find(item=>item.textContent==='Download Legacy instructions.txt');if(!link)throw new Error('Retained download missing');const response=await fetch(link.href);return {status:response.status,text:await response.text(),href:link.href}})()");assert.equal(legacyDownload.status,200);assert.equal(legacyDownload.text,'Original retained supplier instructions for disposable review.');
      const retainedDownloadResponse=await fetch(legacyDownload.href);assert.equal(retainedDownloadResponse.status,200);assert.match(retainedDownloadResponse.headers.get('content-disposition'),/attachment/);await retainedDownloadResponse.arrayBuffer();
      const foreignDownload=await fetch(legacyDownload.href.replace('/test-legacy-correspondence/','/unrelated-message/'));assert.equal(foreignDownload.status,404);
      assert.equal(await tab.evaluate("[...document.querySelectorAll('.supplier-rfq a')].some(item=>item.textContent.includes('Unconfirmed old drawing'))"),false);
      await click(tab,'Continue earlier message');
      assert.equal(await tab.evaluate("document.querySelector('.supplier-rfq textarea').value"),'Please review the original retained request for the black external finish.');
      assert.equal(await tab.evaluate("document.querySelector('.supplier-rfq select').value"),'','Earlier request inferred an unreviewed supplier');
    }
    await input(tab,'.supplier-rfq select','EKO');await input(tab,'.supplier-rfq input[type=email]',FACTORY);
    assert.equal(await tab.evaluate("document.querySelectorAll('.supplier-rfq input[name=supplier-request-kind]')[1]?.checked"),true,'Customer context did not preselect revision mode');
    assert.equal(await tab.evaluate((sourceCustomerReissue||supplierFollowup)?"document.querySelector('.supplier-rfq__send input')?.checked===false":"document.querySelector('.supplier-rfq')?.innerText.includes('Preview only')"),true);
    // This delivery gate includes the generated change-summary PDF, not the
    // preview-only fixture's metadata placeholders for optional Project files.
    if(supplierFollowup)await tab.evaluate("document.querySelectorAll('.supplier-rfq__documents input:checked').forEach(input=>input.click())");
    await click(tab,'Prepare for review');await waitFor(()=>tab.evaluate("document.querySelector('.supplier-rfq__result')?.innerText.includes('Prepared for review — not sent')"),'Reviewed supplier request was not saved');
    const preparedContext=await staff(`/api/lifecycle/projects/${fixture.projectId}/supplier-enquiries`,null,'GET');
    assert.equal(preparedContext.enquiries.length,1);assert.equal(preparedContext.enquiries[0].requestKind,'revision');assert.notEqual(preparedContext.enquiries[0].status,'sent');
    await click(tab,'Continue editing');await waitFor(()=>tab.evaluate("document.querySelector('.supplier-rfq input[type=email]')?.value==="+JSON.stringify(FACTORY)),'Prepared supplier request could not reopen');
    assert.equal(await tab.evaluate("[...document.querySelectorAll('.supplier-rfq__history article')].some(item=>item.innerText.includes('Invalid Date'))"),false,'Newly prepared request lost its persisted date before refresh');
    assert.equal(await tab.evaluate(`[...document.querySelectorAll('.supplier-rfq__history article')].some(item=>item.innerText.includes(new Date(${JSON.stringify(preparedContext.enquiries[0].createdAt)}).toLocaleString('en-GB')))`),true,'Immediate history does not show the canonical saved date');
    if(multiSupplierReview){
      await input(tab,'.supplier-rfq select',receivedSupplierReviews?'ZYLE':'TEST-JOURNEY-SUPPLIER');
      await click(tab,'Prepare for review');
      await waitFor(()=>tab.evaluate("document.querySelector('.supplier-rfq__result')?.innerText.includes('Prepared for review — not sent')"),'Second supplier request was not retained');
      const secondContext=await staff(`/api/lifecycle/projects/${fixture.projectId}/supplier-enquiries`,null,'GET');assert.equal(secondContext.enquiries.length,2);assert.ok(secondContext.enquiries.every(item=>item.status!=='sent'));
      await click(tab,'Continue editing');
    }
    if(legacyCorrespondenceReview){
      const context=await staff(`/api/lifecycle/projects/${fixture.projectId}/supplier-enquiries`,null,'GET');assert.equal(context.legacyCorrespondence.length,20);assert.equal(context.legacyCorrespondenceTotal,21);assert.equal(context.legacyCorrespondence[0].status,'draft');assert.equal(context.legacyCorrespondence[0].bodyText,context.enquiries[0].bodyText);assert.notEqual(context.legacyCorrespondence[0].id,context.enquiries[0].communicationMessageId);
      console.log(JSON.stringify({scope:'Normal working Estimate → retained legacy correspondence → explicit supplier review → canonical prepared request → reopen',legacyMessagePreserved:true,preparedNotSent:true,liveDelivery:false}));
    }
    if(legacyCorrespondenceReview||process.argv.includes('--stop-after-supplier-draft')){
      console.log(JSON.stringify({scope:'Normal application customer changes → working revision → reviewed supplier draft/reopen only',supplierRequests:1,preparedNotSent:true,sourceImportAndReissueVerified:false}));return;
    }

    await click(tab,'Cancel');
    const originalSource=await readFile(path.resolve('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf'));
    assert.equal(sha256(originalSource),'d1f34d3fd36ef40e4fb1b3ccbddc96b96837fdfd86f598af9c2b189f674f1899','Genuine supplier source changed; review its expected evidence before acceptance');
    const sourcePath=path.join(root,'web-26-1133450.pdf');await writeFile(sourcePath,originalSource);
    await click(tab,'Import Manufacturer Quote');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Upload & Analyse')"),'Normal Manufacturer Import upload did not open');
    await tab.send('DOM.enable');const dom=await tab.send('DOM.getDocument',{depth:-1,pierce:true});
    const fileInput=await tab.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});assert.ok(fileInput.nodeId,'Manufacturer file input is missing');
    await tab.send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[sourcePath]});await click(tab,'Upload & Analyse');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Confirm Manufacturer Quote')"),'Genuine supplier source did not reach identity review',90000);
    await click(tab,'Confirm & Extract Quote');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Extraction / Commercial Review')"),'Genuine supplier source did not reach extraction review',90000);
    const extractedText=await tab.evaluate('document.body.innerText');assert.ok(extractedText.includes('7,885.45'),'Genuine source reconciliation is missing');
    const preImportDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
    try{
      assert.equal((await preImportDb.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count,0,'Analysis changed canonical positions before approval');
      assert.equal((await preImportDb.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows')).count,0,'Analysis changed Project Costing before approval');
    }finally{await preImportDb.close()}
    await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Import to Project Costing')&&!item.disabled)"),'Final import remains blocked; review genuine-source diagnostics');
    await click(tab,'Import to Project Costing');
    await waitFor(async()=>{const db=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});try{return (await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count===5}finally{await db.close()}},'Final import did not persist five source positions',90000);
    await waitFor(()=>tab.evaluate("!document.querySelector('[aria-labelledby=\"manufacturer-import-title\"]')&&document.body.innerText.includes('Project Costing')"),'First import did not finish its UI handoff',90000);
    await reloadWorkingEstimate(tab);
    let retainedImportSnapshot;
    const persisted=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
    try{
      const source=await persisted.get('SELECT storage_key FROM supplier_quote_attachments WHERE sha256=?',sha256(originalSource));assert.ok(source,'Retained genuine source metadata is missing');assert.equal(sha256(await readFile(path.join(attachmentRoot,source.storage_key))),sha256(originalSource));
      const rows=await persisted.all('SELECT total_price_amount,source_position_id,source_snapshot_json FROM project_calculator_estimate_product_rows');assert.equal(rows.length,5);assert.equal(new Set(rows.map(row=>row.source_position_id)).size,5);assert.equal(rows.reduce((sum,row)=>sum+Number(row.total_price_amount),0).toFixed(2),'7885.45');
      for(const row of rows){const snapshot=JSON.parse(row.source_snapshot_json);assert.equal(snapshot.commercialSupplier.supplierCode,'EKO');assert.equal(snapshot.manufacturerEvidence.sourceVisual.status,'available');}
      const operations=await persisted.all('SELECT status FROM supplier_quote_import_operations');assert.ok(operations.length>0&&operations.every(operation=>operation.status==='confirmed'),'Final import did not confirm persisted postconditions');
      assert.equal((await persisted.get('SELECT status FROM estimates WHERE id=?',fixture.estimateId)).status,'Issued','Original issued Estimate was changed');
      retainedImportSnapshot={attachments:await persisted.all('SELECT id,sha256,storage_key FROM supplier_quote_attachments ORDER BY id'),positions:await persisted.all('SELECT id FROM supplier_quote_positions ORDER BY id'),costing:await persisted.all('SELECT id,source_position_id,total_price_amount FROM project_calculator_estimate_product_rows ORDER BY id')};
    }finally{await persisted.close()}
    await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.trim()==='Import Manufacturer Quote')"),'Reloaded costing did not expose Manufacturer Import');
    await click(tab,'Import Manufacturer Quote');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Upload & Analyse')"),'Repeat import did not reopen the normal upload');
    const repeatDom=await tab.send('DOM.getDocument',{depth:-1,pierce:true}),repeatInput=await tab.send('DOM.querySelector',{nodeId:repeatDom.root.nodeId,selector:'.manufacturer-quote-upload input[type=file]'});
    assert.ok(repeatInput.nodeId,'Repeat import file input is missing');
    await tab.send('DOM.setFileInputFiles',{nodeId:repeatInput.nodeId,files:[sourcePath]});await click(tab,'Upload & Analyse');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Confirm Manufacturer Quote')"),'Repeated genuine source did not reopen identity review',90000);
    await click(tab,'Confirm & Extract Quote');
    await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Import to Project Costing')&&!item.disabled)"),'Repeated source did not reach reviewed import',90000);
    await click(tab,'Import to Project Costing');
    await waitFor(()=>tab.evaluate("!document.querySelector('[aria-labelledby=\"manufacturer-import-title\"]')&&document.body.innerText.includes('Project Costing')"),'Repeated import did not report completion',90000);
    await reloadWorkingEstimate(tab);
    const replayDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
    try{
      assert.deepEqual(await replayDb.all('SELECT id,sha256,storage_key FROM supplier_quote_attachments ORDER BY id'),retainedImportSnapshot.attachments,'Repeat upload duplicated or replaced retained source');
      assert.deepEqual(await replayDb.all('SELECT id FROM supplier_quote_positions ORDER BY id'),retainedImportSnapshot.positions,'Repeat import duplicated or replaced canonical positions');
      assert.deepEqual(await replayDb.all('SELECT id,source_position_id,total_price_amount FROM project_calculator_estimate_product_rows ORDER BY id'),retainedImportSnapshot.costing,'Repeat import duplicated or changed costing evidence');
    }finally{await replayDb.close()}
    if(process.argv.includes('--stop-after-manufacturer-import')){console.log(JSON.stringify({scope:'Normal application through genuine-source final Manufacturer Import, repeat upload/import and reload',positions:5,sourceSha256:sha256(originalSource),repeatPreservedSourceAndPositionIdentities:true,exchangeRate:'explicit disposable fixture',twoSupplierReviewAndReissueVerified:false}));return;}
    if(providerJourney){
      const providerDb=await open({filename:databasePath,driver:sqlite3.Database});
      try{
        const workspace=createGoogleWorkspaceService(providerDb,{environment:{},encryptionKey:providerKey,fetchImpl:async url=>new Response(JSON.stringify(String(url).includes('oauth2.googleapis.com')?{access_token:'disposable-access',refresh_token:'disposable-refresh',expires_in:3600,scope:GOOGLE_WORKSPACE_SCOPES.join(' ')}:{sub:'disposable-account',email:CUSTOMER,name:'Disposable acceptance mailbox'}),{status:200,headers:{'Content-Type':'application/json'}})});
        await workspace.configure({clientId:'disposable-client',clientSecret:'disposable-secret',redirectUri:'http://127.0.0.1:3104/disposable-callback',estimatesRootFolderId:'disposable-root'});
        const oauth=await workspace.beginOAuth();assert.equal((await workspace.completeOAuth({state:oauth.state,code:'disposable-code'})).connected,true);
      }finally{await providerDb.close()}
      await staff('/api/communications/sync',{folder:'inbox'});
      await click(tab,'Request supplier estimate / revision');
      if(supplierFollowup){
        await waitFor(()=>tab.evaluate("document.body.innerText.includes('Reopen prepared request')"),'Prepared supplier request did not reopen');
        await click(tab,'Reopen prepared request');
        if(supplierPartial){
          const faultDb=await open({filename:databasePath,driver:sqlite3.Database});
          try{await faultDb.exec("CREATE TRIGGER test_supplier_partial BEFORE UPDATE OF status ON supplier_enquiry_drafts WHEN NEW.status='sent' BEGIN SELECT RAISE(ABORT,'Disposable local completion failure'); END")}finally{await faultDb.close()}
        }
        await tab.evaluate("document.querySelector('.supplier-rfq__send input').click()");
        await click(tab,'Send supplier request');
        if(supplierReconcile){
          await waitFor(()=>tab.evaluate("document.body.innerText.includes('Check delivery outcome')"),'Uncertain supplier send did not expose recovery');
          await click(tab,'Check delivery outcome');
          await waitFor(()=>tab.evaluate("document.body.innerText.includes('exact sent message and reviewed contents are confirmed')"),'Exact supplier receipt was not recovered');
          const receiptDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
          try{const saved=await receiptDb.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',preparedContext.enquiries[0].id),attempt=await receiptDb.get('SELECT * FROM supplier_delivery_attempts WHERE supplier_enquiry_id=?',saved.id);assert.equal(saved.status,'sent');assert.equal(attempt.state,'sent');assert.ok(attempt.reconciled_at);assert.equal(Date.parse(saved.response_due_at)-Date.parse(saved.sent_at),7*24*60*60*1000);const parent=await receiptDb.get('SELECT * FROM supplier_revision_requests WHERE id=?',saved.revision_request_id);assert.equal(parent.workflow_state,'sent_to_supplier');assert.equal(parent.status,'sent')}finally{await receiptDb.close()}
          await click(tab,'Close');await click(tab,'Request supplier estimate / revision');
          assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,1,'Recovery sent another supplier copy');
          console.log(JSON.stringify({scope:'Normal supplier send loses response → Check delivery outcome → exact receipt recovered → reopen',liveDelivery:false,providerMessages:1,restartVerified:false}));return;
        }
        if(supplierPartial){
          await waitFor(()=>tab.evaluate("document.querySelector('.supplier-rfq [role=alert]')?.textContent.includes('provider confirmed')"),'Confirmed partial-send result was not explained');
          await waitFor(()=>tab.evaluate("[...document.querySelectorAll('.supplier-rfq__history')].some(item=>item.textContent.includes('sent — local result needs completion'))"),'Persisted sent receipt was not shown after local failure');
          const faultDb=await open({filename:databasePath,driver:sqlite3.Database});
          try{assert.equal((await faultDb.get('SELECT state FROM supplier_delivery_attempts')).state,'sent');await faultDb.exec('DROP TRIGGER test_supplier_partial')}finally{await faultDb.close()}
          await click(tab,'Reopen prepared request');await click(tab,'Finish saved result');
          assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,1,'Finishing local result sent another supplier message');
        }
        await waitFor(()=>tab.evaluate("document.querySelector('.supplier-rfq__result')?.textContent.includes('Supplier request sent')"),'Supplier send did not show confirmed result');
        const followupDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
        try{
          const sent=await followupDb.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',preparedContext.enquiries[0].id);assert.equal(sent.status,'sent');assert.equal(Date.parse(sent.response_due_at)-Date.parse(sent.sent_at),7*24*60*60*1000);
          await click(tab,'Done');await click(tab,'Request supplier estimate / revision');
          if(followupCancellation){
            await waitFor(()=>tab.evaluate("[...document.querySelectorAll('summary')].some(item=>item.textContent==='Review an incoming supplier reply')"),'Incoming supplier review missing');
            await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent==='Review an incoming supplier reply').click()");
            await tab.evaluate("[...document.querySelectorAll('.supplier-rfq__history button')].find(item=>item.textContent.includes('EKO-OKNA')&&item.textContent.includes('request 1')).click()");
            await click(tab,'Find replies');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Disposable supplier PDF response')"),'Exact supplier reply missing');
            await click(tab,'Disposable supplier PDF response');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Link as acknowledgement')"),'Exact message could not be reviewed');
            await click(tab,'Link as acknowledgement');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Reply linked for staff review')"),'Acknowledgement outcome missing');
            await click(tab,'Back to supplier requests');await click(tab,'Close');await click(tab,'Request supplier estimate / revision');
          }
          await waitFor(()=>tab.evaluate("[...document.querySelectorAll('summary')].some(item=>item.textContent.startsWith('View or reopen previous requests'))"),'Supplier history did not load');
          await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent.startsWith('View or reopen previous requests')).click()");
          await waitFor(()=>tab.evaluate("document.body.innerText.includes('Adjust response deadline')"),'Sent supplier history did not reopen');
          await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent==='Adjust response deadline').click()");
          await tab.evaluate("(()=>{const input=document.querySelector('input[type=datetime-local]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2026-01-01T09:00');input.dispatchEvent(new Event('input',{bubbles:true}))})()");
          await click(tab,'Save reviewed deadline');
          await waitFor(()=>tab.evaluate("document.body.innerText.includes('Supplier response deadline updated')"),'Reviewed deadline did not save');
          if(followupCancellation){
            const before=await followupDb.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',sent.id);assert.equal(before.response_state,'acknowledgement_received');assert.equal(before.followup_due_at,null);assert.equal(before.followup_attempted_at,null);
            assert.equal((await followupDb.get('SELECT workflow_state FROM supplier_revision_requests WHERE id=?',before.revision_request_id)).workflow_state,'supplier_reply_received');
            assert.equal((await followupDb.get('SELECT COUNT(*) count FROM manufacturer_response_links WHERE supplier_enquiry_id=? AND canonical_document_id IS NOT NULL',sent.id)).count,0,'An acknowledgement incorrectly filed or completed the revised document');
            const priorRuntime=await(await fetch(`${API_URL}/api/health`)).json();assert.equal((await terminateOwnedProcessTree(api,{platformName:process.platform})).exited,true);api=null;
            await waitFor(async()=>!await reachable(`${API_URL}/api/health`),'Owned test listener did not stop');api=startApi();for(const stream of [api.stdout,api.stderr])stream.on('data',chunk=>{apiStartupLog=(apiStartupLog+String(chunk)).slice(-5000)});
            await waitFor(()=>reachable(`${API_URL}/api/health`),'Owned test API did not restart');
            await waitFor(async()=>{const health=await(await fetch(`${API_URL}/api/health`)).json();assert.notEqual(health.instanceId,priorRuntime.instanceId);return health.uptimeSeconds>=62},'Restarted scheduled-worker observation did not complete',80000);
            const after=await followupDb.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',sent.id);assert.equal(after.followup_attempted_at,null);assert.equal(after.response_state,'acknowledgement_received');
            assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,1);
            console.log(JSON.stringify({scope:'Normal exact reply acknowledgement → reviewed expected-return date → actual API restart → scheduled-worker observation',followupCancelled:true,revisedDocumentOutstanding:true,providerMessages:1,liveDelivery:false}));return;
          }
          if(followupReconcile){
            await waitFor(async()=>(await followupDb.get('SELECT followup_delivery_state FROM supplier_enquiry_drafts WHERE id=?',sent.id)).followup_delivery_state==='uncertain','Persistent worker did not retain the uncertain follow-up',100000);
            if(followupRestart){
              const priorRuntime=await(await fetch(`${API_URL}/api/health`)).json(),priorClaim=await followupDb.get('SELECT followup_attempted_at,followup_receipt_message_id FROM supplier_enquiry_drafts WHERE id=?',sent.id),priorPid=api.pid;
              const stopped=await terminateOwnedProcessTree(api,{platformName:process.platform});assert.equal(stopped.exited,true);api=null;
              await waitFor(async()=>!await reachable(`${API_URL}/api/health`),'Owned test API listener remained after stopping');
              api=startApi();for(const stream of [api.stdout,api.stderr])stream.on('data',chunk=>{apiStartupLog=(apiStartupLog+String(chunk)).slice(-5000)});
              await waitFor(()=>reachable(`${API_URL}/api/health`),'Owned test API did not restart');
              const resumedRuntime=await(await fetch(`${API_URL}/api/health`)).json();assert.notEqual(resumedRuntime.instanceId,priorRuntime.instanceId);assert.equal(resumedRuntime.runtimeVersion,QUOTESUITE_RUNTIME_CONTRACT.version);
              assert.deepEqual(await followupDb.get('SELECT followup_attempted_at,followup_receipt_message_id FROM supplier_enquiry_drafts WHERE id=?',sent.id),priorClaim);
              console.log(JSON.stringify({actualTestApiRestart:{oldPid:priorPid,newPid:api.pid,instanceChanged:true,claimPreserved:true}}));
            }
            await click(tab,'Close');await click(tab,'Request supplier estimate / revision');
            await waitFor(()=>tab.evaluate("document.body.innerText.includes('Check follow-up outcome')"),'Uncertain follow-up recovery action missing');
            await click(tab,'Check follow-up outcome');await waitFor(()=>tab.evaluate("document.body.innerText.includes('exact sent follow-up is confirmed')"),'Follow-up receipt was not confirmed');
            const recovered=await followupDb.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',sent.id);assert.ok(recovered.followup_reconciled_at);assert.equal(recovered.followup_delivery_state,'sent');assert.equal(recovered.response_state,'outstanding');
          }else await waitFor(async()=>Boolean((await followupDb.get('SELECT followup_sent_at FROM supplier_enquiry_drafts WHERE id=?',sent.id)).followup_sent_at),'Persistent worker did not send due follow-up',100000);
          const completed=await followupDb.get('SELECT * FROM supplier_enquiry_drafts WHERE id=?',sent.id);assert.equal(completed.followup_delivery_state,'sent');assert.ok(completed.followup_attempted_at);
          const evidence=JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8'));assert.equal(evidence.sent.length,2);assert.deepEqual(evidence.sent.map(item=>item.recipients),[[FACTORY],[FACTORY]]);
          assert.match(Buffer.from(evidence.sent[1].raw,'base64url').toString(),/Please could you provide an update/);
          await click(tab,'Close');await click(tab,'Request supplier estimate / revision');
          await waitFor(()=>tab.evaluate("[...document.querySelectorAll('summary')].some(item=>item.textContent.startsWith('View or reopen previous requests'))"),'Sent follow-up history did not load');
          await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent.startsWith('View or reopen previous requests')).click()");
          await waitFor(()=>tab.evaluate("document.body.innerText.includes('Follow-up sent')"),'Persisted follow-up outcome was not visible after reopen');
          assert.equal(await tab.evaluate("document.body.innerText.includes('Retry follow-up safely')"),false);
          console.log(JSON.stringify({scope:'Normal supplier composer → confirmed test send → seven-calendar-day deadline → reviewed due adjustment → persistent scheduled worker → reopened outcome',provider:'no-network disposable transport',providerMessages:2,partialSaveRecoveredWithoutResend:supplierPartial,liveDelivery:false,restartVerified:followupRestart,uncertainRecoveryVerified:followupReconcile}));
        }finally{await followupDb.close()}
        return;
      }
      await waitFor(()=>tab.evaluate("[...document.querySelectorAll('summary')].some(item=>item.textContent==='Review an incoming supplier reply')"),'Saved supplier request did not expose reply review');
      await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent==='Review an incoming supplier reply').click()");
      await tab.evaluate("[...document.querySelectorAll('.supplier-rfq__history button')].find(item=>item.textContent.includes('EKO-OKNA')&&item.textContent.includes('request 1')).click()");
      await click(tab,'Find replies');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Disposable supplier PDF response')"),'Disposable provider reply did not appear');
      await click(tab,'Disposable supplier PDF response');await waitFor(()=>tab.evaluate("document.body.innerText.includes('This exact message contains')"),'Exact supplier body did not open');
      await click(tab,'Review and file selected document');
      await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.trim()==='File selected document'&&!item.disabled)"),'Exact supplier document picker did not become ready');
      await click(tab,'File selected document');
      try{await waitFor(()=>tab.evaluate("document.body.innerText.includes('Import Manufacturer Estimate')&&document.body.innerText.includes('Open Files')"),'Provider-backed filing did not finish',60000)}catch(error){throw new Error(`${error.message}: ${await tab.evaluate('document.body.innerText')}`)}
      await click(tab,'Import Manufacturer Estimate');
      await waitFor(()=>tab.evaluate("document.body.innerText.includes('Confirm Manufacturer Quote')"),'Filed provider source did not reopen genuine extraction review',90000);
      const filedDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
      try{
        const response=await filedDb.get("SELECT l.*,m.provider_message_id,d.folder_path,d.file_name FROM manufacturer_response_links l JOIN communication_messages m ON m.id=l.communication_message_id JOIN canonical_documents d ON d.id=l.canonical_document_id WHERE m.provider_message_id='disposable-supplier-pdf'");
        assert.ok(response);assert.equal(response.supplier_enquiry_id,preparedContext.enquiries[0].id);assert.match(response.folder_path,/Suppliers\/EKO/i);assert.equal(response.file_name,'web-26-1133450.pdf');
        const retained=await filedDb.all('SELECT id,source_canonical_document_id FROM supplier_quote_attachments');assert.equal(retained.length,1);assert.equal(retained[0].source_canonical_document_id,response.canonical_document_id);
      }finally{await filedDb.close()}
      console.log(JSON.stringify({scope:'Normal supplier request → exact provider reply → reviewed commercial Drive filing → canonical document → genuine Manufacturer Import review',provider:'disposable transport; no live OAuth or delivery',reusedOriginalSource:true,multiSupplierReissueVerified:false}));
      if(process.argv.includes('--stop-after-supplier-filing'))return;
      await tab.evaluate("document.querySelector('[aria-labelledby=\"manufacturer-import-title\"] header button').click()");
      await click(tab,'Client Portal');
      await waitFor(()=>tab.evaluate(`[...document.querySelectorAll('article')].some(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})&&item.querySelector('button'))`),'Customer revision request did not reopen');
      await tab.evaluate(`[...document.querySelectorAll('article')].find(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})).querySelector('button').click()`);
      await waitFor(()=>tab.evaluate("[...document.querySelectorAll('legend')].some(item=>item.textContent==='Supplier response reviews')"),'Filed source was not discoverable in customer revision review');
      assert.equal(await tab.evaluate("document.querySelector('.portal-operation-detail__stage h4')?.textContent"),'EF-EST-2026-901-02');
      const supplierSelector="[...document.querySelectorAll('fieldset')].find(item=>item.querySelector('legend')?.textContent==='Supplier response reviews')";
      await tab.evaluate(`(()=>{const select=${supplierSelector}.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(preparedContext.enquiries[0].id)});select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      await waitFor(()=>tab.evaluate("document.body.innerText.includes('Save supplier review')"),'Source-backed supplier field form did not open');
      if(overallSourceReview){
        const finish='RAL: 7016 (Anthracite grey) Matt';
        const fillLabels=async(selector,values)=>{for(const [label,value] of Object.entries(values))await tab.evaluate(`(()=>{const field=[...(${selector}).querySelectorAll('label')].find(item=>item.textContent===${JSON.stringify(label)}).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}))})()`)};
        await tab.evaluate(`(()=>{const select=[...${supplierSelector}.querySelectorAll('label')].find(item=>item.textContent.startsWith('Position')).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'test-position-w01');select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await fillLabels(supplierSelector,{'Field':'external_finish','Before':'White','Requested':finish,'Returned':finish,'Before source / page':'Disposable issued Estimate, Position 001, External finish','Returned source / page':'web-26-1133450.pdf, page 1, Window 001, Colour'});
        await click(tab,'Save supplier review');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Supplier review saved. Complete')"),'Source-backed supplier Position review did not save');
        const savedDocumentId=await tab.evaluate(`[...${supplierSelector}.querySelectorAll('label')].find(item=>item.textContent.startsWith('Returned supplier document')).querySelector('select').value`);
        assert.ok(savedDocumentId,'Exact filed supplier document was not selected');
        await tab.evaluate("(()=>{const select=[...document.querySelectorAll('label')].find(item=>item.textContent.startsWith('Source kind')).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'canonical_document');select.dispatchEvent(new Event('change',{bubbles:true}))})()");
        await tab.evaluate(`(()=>{const select=[...document.querySelectorAll('label')].find(item=>item.textContent.startsWith('Reviewed document')).querySelector('select');if(![...select.options].some(option=>option.value===${JSON.stringify(savedDocumentId)}))throw new Error('Filed source absent from overall review choices');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(savedDocumentId)});select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await click(tab,'Link returned revision');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Returned supplier revision linked')"),'Exact filed document was not linked to overall review');
        const overall="[...document.querySelectorAll('fieldset')].find(item=>item.querySelector('legend')?.textContent==='Requested-change verification')";
        await waitFor(()=>tab.evaluate(`Boolean(${overall})`),'Overall customer checks are unavailable after source filing');
        await fillLabels(`${overall}.querySelectorAll('article')[0]`,{'Field':'external_finish','Before':'White','Requested':finish,'After':finish,'Before source':'Disposable issued Estimate, Position 001, External finish','After source':'web-26-1133450.pdf, page 1, Window 001, Colour'});
        await fillLabels(`${overall}.querySelectorAll('article')[1]`,{'Field':'quotation_reference','Before':'Not confirmed','Requested':'WEB/26/1133450','After':'WEB/26/1133450','Before source':'Disposable customer request, general reference confirmation','After source':'web-26-1133450.pdf, page 1, Price details'});
        if(sourceReviewCorrection){
          await fillLabels(`${overall}.querySelectorAll('article')[0]`,{'Requested':'Disposable mistaken transcription','Before source':'Disposable source reference awaiting correction'});
          await click(tab,'Verify changes');await waitFor(()=>tab.evaluate("document.body.innerText.includes('item(s) still need attention')"),'Mistaken review entry did not remain unresolved');
          const correctionDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});try{assert.equal((await correctionDb.get("SELECT status FROM revision_change_checks WHERE field_key='external_finish'")).status,'needs_review');assert.equal((await correctionDb.get('SELECT verified_at FROM supplier_revision_requests')).verified_at,null)}finally{await correctionDb.close()}
          const externalArticle=`[...${overall}.querySelectorAll('article')].find(article=>[...article.querySelectorAll('label')].some(label=>label.textContent==='Field'&&label.querySelector('input')?.value==='external_finish'))`;
          await fillLabels(externalArticle,{'Requested':finish,'Before source':'Disposable issued Estimate, Position 001, External finish — corrected reference'});
        }
        if(sourceCustomerPreparation){
          await click(tab,'Add unrelated material change');
          await fillLabels(`${overall}.querySelectorAll('article')[2]`,{'Field':'additional_positions','Before':'001 only','Requested':'001 only','After':'001, 002, 003, 004, 005','Before source':'Disposable issued Estimate schedule','After source':'WEB/26/1133450, pages 1–7, complete position schedule','Resolution note':'Staff explicitly accepts four additional source Positions for this disposable successor offer; the original one-Position issued offer remains unchanged.'});
          await tab.evaluate(`${overall}.querySelectorAll('article')[2].querySelector('input[type=checkbox]').click()`);
        }
        await click(tab,'Verify changes');await waitFor(()=>tab.evaluate("document.body.innerText.includes('ready for customer-document review')"),'Overall source-backed review did not reach customer-document readiness');
        const evidenceDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
        try{
          const request=await evidenceDb.get('SELECT * FROM supplier_revision_requests');assert.ok(request.verified_at);
          if(sourceReviewCorrection){const corrected=await evidenceDb.get("SELECT * FROM revision_change_checks WHERE field_key='external_finish'");assert.equal(corrected.expected_value,finish);assert.match(corrected.before_source_reference,/corrected reference/);assert.equal(corrected.status,'implemented');const history=await evidenceDb.all('SELECT checks_json FROM supplier_revision_review_history');assert.ok(history.some(row=>JSON.parse(row.checks_json).some(check=>check.expected_value==='Disposable mistaken transcription')));}
          const working=await evidenceDb.get('SELECT positions_json FROM estimates WHERE id=?',request.successor_estimate_id),positions=JSON.parse(working.positions_json),matched=positions.find(item=>item.id==='test-position-w01');
          assert.ok(matched?.supplierEvidenceLinks?.length,'Genuine source Position did not map to the exact issued Position: '+JSON.stringify(positions.map(item=>({id:item.id,ref:item.positionRef,width:item.widthMm,height:item.heightMm}))));
          assert.equal(positions.length,5,'Source-matched issued Position was duplicated');
          assert.equal((await evidenceDb.get('SELECT COUNT(*) count FROM revision_change_checks WHERE status=\'implemented\'')).count,2);
          assert.equal((await evidenceDb.get('SELECT COUNT(*) count FROM issued_quotations')).count,1,'Verification automatically issued a customer document');
          assert.deepEqual(JSON.parse((await evidenceDb.get('SELECT positions_json FROM estimates WHERE id=?',fixture.estimateId)).positions_json).map(item=>item.id),['test-position-w01']);
        }finally{await evidenceDb.close()}
        console.log(JSON.stringify({scope:'Normal source-backed Position review and overall verification',source:'WEB/26/1133450 page 1 Window 001',exactCanonicalPositionRetained:true,automaticCustomerIssue:false,customerReissueVerified:false}));
        if(sourceCustomerPreparation){
          await click(tab,'Open working Estimate');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Review Customer Quotation')"),'Working Estimate did not expose customer review');
          await click(tab,'Review Customer Quotation');await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.customer-quotation__totals'))"),'Customer quotation preview did not load');
          const previewText=await tab.evaluate("document.querySelector('.customer-quotation__dialog').innerText");
          for(const reference of ['001','002','003','004','005'])assert.ok(previewText.includes(reference),`Customer preview omits Position ${reference}`);
          assert.ok(previewText.includes('7016'),'Customer preview omits the reviewed source-backed external finish');
          await click(tab,'Review terms');await input(tab,'.customer-quotation__terms-editor input','30');
          await input(tab,'.customer-quotation__terms-editor textarea','Disposable acceptance offer only. All sizes remain subject to reviewed survey.');
          await click(tab,'Confirm for this Estimate');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Customer terms reviewed')"),'Customer terms did not persist');
          await click(tab,'Send to Client');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Email ready to review')&&document.body.innerText.includes('Nothing has been sent')"),'Reviewed customer Email preparation failed');
          const readableMessage=await tab.evaluate("document.querySelector('.customer-quotation__email-fields textarea').value");assert.ok(readableMessage.includes('Dear TEST Customer Journey'));assert.doesNotMatch(readableMessage,/<\/?(?:p|strong|br)\b/);assert.ok(readableMessage.includes('\n'));
          const preparedDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
          try{
            const prepared=await preparedDb.get("SELECT * FROM issued_quotations WHERE status<>'issued'");assert.ok(prepared?.document_id);assert.ok(prepared.supplier_review_snapshot);assert.equal(prepared.recipient,CUSTOMER);
            assert.equal((await preparedDb.get("SELECT COUNT(*) count FROM issued_quotations WHERE status='issued'")).count,1);
            const savedPdf=await preparedDb.get('SELECT * FROM customer_quotation_documents WHERE id=?',prepared.document_id);
            const pdfUrl=await tab.evaluate("document.querySelector('.customer-quotation__email-evidence a').href");
            const download=await fetch(pdfUrl);assert.equal(download.status,200);const pdfBytes=Buffer.from(await download.arrayBuffer());assert.equal(sha256(pdfBytes),savedPdf.sha256);
            const emailAttachment=await preparedDb.get('SELECT sha256 FROM communication_attachments WHERE communication_message_id=?',prepared.communication_message_id);assert.equal(emailAttachment.sha256,savedPdf.sha256);
            const customerProjection=JSON.parse(savedPdf.projection_json);assert.equal(customerProjection.positions.length,5);assert.equal(customerProjection.positions.find(item=>item.reference==='001').specification.find(item=>item.label==='Colour').value,finish);
            const pdfFile=path.join(OUTPUT,'source-backed-prepared-customer-estimate.pdf');await writeFile(pdfFile,pdfBytes);
            const pdfEvidence=await inspectPdf(pdfFile,['001','002','003','004','005','7016','Disposable acceptance offer only']);console.log(JSON.stringify({preparedPdf:pdfEvidence,emailAttachmentMatchesSavedPdf:true,customerTotal:customerProjection.totalIncVatGbp}));
            if(sourceCustomerReissue){
              await tab.evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='Send Estimate');button.click();button.click()})()");
              await waitFor(()=>tab.evaluate("document.body.innerText.includes('Estimate was not sent')&&document.body.innerText.includes('PDF and Email draft are still saved')"),'No-network send interruption did not explain recovery');
              assert.equal((await preparedDb.get('SELECT status FROM issued_quotations WHERE id=?',prepared.id)).status,'failed');
              assert.equal((await preparedDb.get("SELECT COUNT(*) count FROM issued_quotations WHERE status='issued'")).count,1);
              await click(tab,'Send Estimate');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Estimate sent successfully')"),'Reviewed no-network reissue did not complete');
              const issued=await preparedDb.get('SELECT * FROM issued_quotations WHERE id=?',prepared.id);assert.equal(issued.status,'issued');assert.equal(issued.document_id,savedPdf.id);assert.ok(issued.issued_at);
              const delivered=JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8'));assert.equal(delivered.attempts,2);assert.equal(delivered.sent.length,1);assert.deepEqual(delivered.sent[0].recipients,[CUSTOMER]);assert.equal(issued.provider_message_id,delivered.sent[0].id);
              const mime=Buffer.from(delivered.sent[0].raw,'base64url').toString();const encoded=mime.match(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/);assert.ok(encoded,'Provider MIME omitted the reviewed PDF');assert.equal(sha256(Buffer.from(encoded[1].replace(/\s/g,''),'base64')),savedPdf.sha256);
              assert.equal((await preparedDb.get('SELECT COUNT(*) count FROM estimate_revision_releases WHERE estimate_id=?',issued.estimate_id)).count,1);
              assert.equal((await preparedDb.get('SELECT COUNT(*) count FROM followups WHERE issued_quotation_id=?',issued.id)).count,1);
              assert.equal((await preparedDb.get('SELECT workflow_state FROM supplier_revision_requests WHERE successor_estimate_id=?',issued.estimate_id)).workflow_state,'revised_customer_estimate_issued');
              assert.equal((await preparedDb.get('SELECT sha256 FROM customer_quotation_documents WHERE id=?',fixture.document.id)).sha256,fixture.document.sha256,'Original issued PDF changed during reissue');
              const origin=await tab.evaluate('performance.timeOrigin');await tab.send('Page.reload');
              await waitFor(()=>tab.evaluate(`performance.timeOrigin!==${origin}&&document.body.innerText.includes('Review Customer Quotation')`),'Issued working Estimate did not reopen after refresh');
              await click(tab,'Review Customer Quotation');await waitFor(()=>tab.evaluate("document.querySelector('.customer-quotation__email-evidence')?.innerText.includes('Estimate sent successfully')"),'Provider-confirmed reissue was not restored after refresh');
              assert.equal(await tab.evaluate("[...document.querySelectorAll('.customer-quotation__controls button')].find(button=>button.textContent==='Estimate issued')?.disabled"),true);
              assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,1,'Refresh repeated provider delivery');
              console.log(JSON.stringify({scope:'Genuine-source normal customer reissue through production Gmail MIME boundary',provider:'explicit no-network disposable transport',attempts:2,successfulProviderMessages:1,pdfBytesMatch:true,successorReleases:1,followups:1,originalIssuedEvidencePreserved:true,liveDelivery:false}));
              if(sourceCustomerOrder){
                await tab.send('Page.navigate',{url:`${APP_URL}/?journey=source-customer-order#/client-portal`});
                await waitFor(()=>tab.evaluate("document.body.innerText.includes('Accept Estimate')"),'Customer could not open the newly released successor');
                const portalPdf=await tab.evaluate("(async()=>{const link=[...document.querySelectorAll('a')].find(item=>item.textContent.includes('View issued Estimate'));const response=await fetch(link.href,{credentials:'include'}),bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return {status:response.status,type:response.headers.get('content-type'),hash:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}})()");
                assert.deepEqual(portalPdf,{status:200,type:'application/pdf',hash:savedPdf.sha256},'Customer Portal did not expose the exact released PDF');
                await click(tab,'Accept Estimate');await waitFor(()=>tab.evaluate("document.querySelectorAll('.portal-external__position-check input').length===5"),'Customer acceptance omitted released Positions');
                await tab.evaluate("(()=>{const boxes=[...document.querySelectorAll('.portal-external__position-check input')];boxes.slice(0,4).forEach(box=>box.click());document.querySelector('.portal-external__overall-check input').click()})()");
                assert.equal(await tab.evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent==='Submit Estimate acceptance').disabled"),true,'Partial Position acceptance allowed an Order');
                assert.equal((await preparedDb.get('SELECT COUNT(*) count FROM orders')).count,0);
                await tab.evaluate("document.querySelectorAll('.portal-external__position-check input')[4].click()");
                await tab.evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent==='Submit Estimate acceptance');button.click();button.click()})()");
                await waitFor(()=>tab.evaluate("document.body.innerText.includes('Estimate accepted')&&document.body.innerText.includes('waiting for staff approval')&&document.body.innerText.includes('No factory order was sent')"),'Customer acceptance did not explain staff approval and factory boundary');
                const orders=await preparedDb.all('SELECT * FROM orders');assert.equal(orders.length,1);const order=orders[0];assert.equal(order.source_estimate_id,issued.estimate_id);assert.equal(order.source_estimate_revision,2);assert.equal(order.status,'customer_accepted_pending_staff_approval');assert.equal(order.client_id,fixture.clientId);assert.equal(order.project_id,fixture.projectId);
                const acceptance=await preparedDb.get('SELECT * FROM portal_estimate_acceptances WHERE order_id=?',order.id);assert.ok(acceptance?.overall_accepted);
                const acceptedIds=(await preparedDb.all('SELECT estimate_position_id FROM portal_position_acceptances WHERE estimate_acceptance_id=?',acceptance.id)).map(item=>item.estimate_position_id).sort();assert.deepEqual(acceptedIds,customerProjection.positions.map(position=>position.id).sort());
                const release=await preparedDb.get('SELECT * FROM estimate_revision_releases WHERE id=?',acceptance.estimate_release_id);assert.equal(release.estimate_id,issued.estimate_id);assert.equal(order.accepted_commercial_snapshot_json,release.commercial_snapshot_json);
                const previousOrigin=await tab.evaluate('performance.timeOrigin');await tab.send('Page.reload');await waitFor(()=>tab.evaluate(`performance.timeOrigin!==${previousOrigin}&&document.body.innerText.includes(${JSON.stringify(order.order_ref)})`),'Accepted Order disappeared from customer Portal after refresh');
                assert.equal((await preparedDb.get('SELECT COUNT(*) count FROM orders')).count,1);assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,1,'Customer acceptance sent a factory communication');
                console.log(JSON.stringify({scope:'Genuine released successor → exact customer PDF → five-Position acceptance → canonical Order → refresh',orderStatus:order.status,orders:1,acceptedPositions:5,partialAcceptanceBlocked:true,reviewedStaffApprovalStillRequired:true,factoryDelivery:false,liveDelivery:false}));
                if(sourceStaffOrder){
                  await tab.send('Page.navigate',{url:`${APP_URL}/?journey=source-staff-order`});await waitFor(()=>tab.evaluate("document.body.innerText.includes('Client Portal')"),'Staff application did not reopen');await click(tab,'Client Portal');
                  await waitFor(()=>tab.evaluate(`[...document.querySelectorAll('.client-portal-directory__list article')].some(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)}))`),'Canonical customer was absent from staff Portal directory');
                  await tab.evaluate(`[...document.querySelectorAll('.client-portal-directory__list article')].find(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})).querySelector('button').click()`);
                  await waitFor(()=>tab.evaluate("document.body.innerText.includes('Open Order journey')"),'Accepted Order was not actionable in staff Portal');await click(tab,'Open Order journey');
                  await waitFor(()=>tab.evaluate("document.body.innerText.includes('Approve Order for factory')"),'Staff approval was not available');await click(tab,'Approve Order for factory');
                  await waitFor(()=>tab.evaluate("document.body.innerText.includes('immutable staff-approved Order PDF created')"),'Staff approval did not confirm preserved Order evidence');
                  await input(tab,'.portal-operation-detail fieldset input[type=email]',FACTORY);
                  assert.equal(await tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent==='Send factory Order')"),false);
                  await click(tab,'Prepare factory Order preview');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Factory Order email and PDF prepared')"),'Factory Order draft did not report prepared-not-sent outcome');
                  const finalOrder=await preparedDb.get('SELECT * FROM orders WHERE id=?',order.id);assert.equal(finalOrder.status,'staff_approved');assert.equal(finalOrder.accepted_commercial_snapshot_json,order.accepted_commercial_snapshot_json);
                  const factoryRequest=await preparedDb.get('SELECT * FROM factory_order_requests WHERE order_id=?',order.id);assert.equal(factoryRequest.status,'draft');
                  const factoryDocument=await preparedDb.get('SELECT * FROM customer_lifecycle_documents WHERE id=?',JSON.parse(factoryRequest.document_ids_json)[0]);assert.equal(JSON.parse(factoryDocument.context_json).audience,'factory-price-free-v1');
                  const factoryProjection=JSON.parse(factoryDocument.projection_json);assert.equal(factoryProjection.positions.length,5);assert.equal(factoryProjection.totalIncVatGbp,undefined);assert.equal(factoryProjection.commercialTerms,undefined);
                  const factoryPath=path.join(OUTPUT,'source-backed-factory-schedule.pdf');await copyFile(path.join(attachmentRoot,factoryDocument.storage_key),factoryPath);
                  const factoryPdf=await inspectPdf(factoryPath,['Factory Order schedule','001','002','003','004','005','7016'],['TOTAL INCLUDING VAT','Subtotal excluding VAT','Estimate validity',...(customerProjection.commercialTerms?.terms||[])]);assert.equal(factoryPdf.sha256,factoryDocument.sha256);
                  console.log(JSON.stringify({factorySchedule:factoryPdf,customerCommercialFieldsAbsent:true}));
                  await waitFor(()=>tab.evaluate("document.querySelector('.factory-draft-review a')!==null"),'Saved factory draft has no accessible PDF');
                  const reviewedPdf=await tab.evaluate("(async()=>{const response=await fetch(document.querySelector('.factory-draft-review a').href),bytes=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);return {status:response.status,sha256:[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')}})()");assert.deepEqual(reviewedPdf,{status:200,sha256:factoryDocument.sha256});
                  const reviewedMessage='Please check the reviewed dimensions & return confirmation.\nDisposable reviewed factory draft; do not send.';
                  await input(tab,'.factory-draft-review textarea',reviewedMessage);await input(tab,'.factory-draft-review input[type=email]','invalid-address');await click(tab,'Save factory request');
                  await waitFor(()=>tab.evaluate("document.querySelector('.factory-draft-review [role=alert]')?.textContent.includes('Enter one valid recipient')"),'Invalid recipient did not explain recovery');assert.equal(await tab.evaluate("document.querySelector('.factory-draft-review textarea').value"),reviewedMessage);assert.equal((await preparedDb.get('SELECT communication_message_id FROM factory_order_requests WHERE id=?',factoryRequest.id)).communication_message_id,factoryRequest.communication_message_id);
                  await input(tab,'.factory-draft-review input[type=email]',FACTORY);await tab.evaluate("(()=>{const button=document.querySelector('.factory-draft-review button');button.click();button.click()})()");await waitFor(()=>tab.evaluate("document.body.innerText.includes('Factory request saved, not sent')"),'Factory draft save did not explain outcome');
                  const reviewedRequest=await preparedDb.get('SELECT * FROM factory_order_requests WHERE order_id=?',order.id);assert.equal(reviewedRequest.body_text,reviewedMessage);assert.equal(reviewedRequest.status,'draft');assert.notEqual(reviewedRequest.communication_message_id,factoryRequest.communication_message_id);
                  await tab.send('Page.navigate',{url:`${APP_URL}/?journey=reopen-factory-draft`});await waitFor(()=>tab.evaluate("document.body.innerText.includes('Client Portal')"),'Staff route did not reopen');await click(tab,'Client Portal');
                  await waitFor(()=>tab.evaluate(`[...document.querySelectorAll('.client-portal-directory__list article')].some(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)}))`),'Customer directory did not reload');await tab.evaluate(`[...document.querySelectorAll('.client-portal-directory__list article')].find(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})).querySelector('button').click()`);
                  await waitFor(()=>tab.evaluate("document.body.innerText.includes('Open Order journey')"),'Saved Order disappeared');await click(tab,'Open Order journey');await waitFor(()=>tab.evaluate(`document.querySelector('.factory-draft-review textarea')?.value===${JSON.stringify(reviewedMessage)}`),'Reviewed factory request did not persist on reopen');
                  await tab.evaluate("document.querySelector('.factory-draft-review details').open=true");
                  await waitFor(()=>tab.evaluate("[...document.querySelectorAll('.factory-draft-review details label')].some(label=>label.textContent.includes('web-26-1133450.pdf'))"),'The exact filed Project document was not offered for review');
                  await tab.evaluate("[...document.querySelectorAll('.factory-draft-review details label')].find(label=>label.textContent.includes('web-26-1133450.pdf')).querySelector('input').click()");
                  await click(tab,'Save factory request');await waitFor(()=>tab.evaluate("document.querySelector('.factory-draft-review [role=alert]')?.textContent.includes('Open and review')"),'File selection saved without explicit review');
                  await tab.evaluate("[...document.querySelectorAll('.factory-draft-review details label')].find(label=>label.textContent.includes('I have reviewed')).querySelector('input').click()");await click(tab,'Save factory request');
                  await waitFor(()=>tab.evaluate("document.querySelector('.factory-draft-review details')?.textContent.includes('Saved selection: web-26-1133450.pdf')"),'Reviewed file selection did not persist');
                  const attachmentRequest=await preparedDb.get('SELECT * FROM factory_order_requests WHERE order_id=?',order.id),attachmentReview=await preparedDb.get('SELECT * FROM factory_attachment_reviews WHERE communication_message_id=?',attachmentRequest.communication_message_id),selectedFiles=JSON.parse(attachmentReview.files_json);assert.equal(selectedFiles.length,1);assert.equal(selectedFiles[0].fileName,'web-26-1133450.pdf');assert.match(selectedFiles[0].checksum,/^[a-f0-9]{32}([a-f0-9]{32})?$/i);
                  const outgoingFiles=await preparedDb.all('SELECT * FROM communication_attachments WHERE communication_message_id=?',attachmentRequest.communication_message_id);assert.equal(outgoingFiles.length,2);assert.ok(outgoingFiles.some(file=>file.drive_file_id===selectedFiles[0].providerFileId&&file.sha256===selectedFiles[0].checksum));assert.equal(attachmentRequest.status,'draft');
                  assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,1,'Staff approval or factory preparation sent another message');
                  if(sourceFactorySend){
                    await tab.evaluate("[...document.querySelectorAll('.factory-draft-review label')].find(label=>label.textContent.includes('I have reviewed the saved recipient')).querySelector('input').click()");
                    await tab.evaluate("(()=>{const button=[...document.querySelectorAll('.factory-draft-review button')].find(button=>button.textContent==='Send reviewed factory request');button.click();button.click()})()");
                    if(sourceFactoryReconcile){
                      await waitFor(()=>tab.evaluate("[...document.querySelectorAll('.factory-draft-review button')].some(button=>button.textContent==='Check delivery outcome')"),'Uncertain send did not offer recovery');
                      assert.equal((await preparedDb.get('SELECT state FROM factory_delivery_attempts WHERE order_id=?',order.id)).state,'uncertain');
                      await click(tab,'Check delivery outcome');
                      await waitFor(()=>tab.evaluate("document.querySelector('.factory-draft-review')?.textContent.includes('No additional email was sent')"),'Exact provider receipt was not recovered');
                    }
                    await waitFor(()=>tab.evaluate("document.querySelector('.factory-draft-review')?.textContent.includes('Await supplier confirmation')"),'Factory send did not report confirmed outcome');
                    const sentRequest=await preparedDb.get('SELECT * FROM factory_order_requests WHERE order_id=?',order.id),attempts=await preparedDb.all('SELECT * FROM factory_delivery_attempts WHERE order_id=?',order.id);assert.equal(sentRequest.status,'sent');assert.equal(attempts.length,1);assert.equal(attempts[0].state,'sent');
                    const evidence=JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8'));assert.equal(evidence.sent.length,2);assert.deepEqual(evidence.sent[1].recipients,[FACTORY]);assert.equal(evidence.sent[1].id,attempts[0].provider_message_id);assert.equal(await tab.evaluate("document.querySelector('.factory-draft-review textarea').readOnly"),true);
                    const factoryMime=Buffer.from(evidence.sent[1].raw,'base64url').toString(),attachmentHashes=[...factoryMime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map(match=>sha256(Buffer.from(match[1].replace(/\s/g,''),'base64')));assert.equal(attachmentHashes.length,2);assert.ok(attachmentHashes.includes(factoryDocument.sha256));assert.ok(attachmentHashes.includes(sha256(await readFile(path.join(root,'provider-source.pdf')))));
                    const replay=await staff(`/api/lifecycle/orders/${order.id}/factory-order`,{send:true,reviewed:true,expectedCommunicationId:sentRequest.communication_message_id});assert.equal(replay.status,'sent');assert.equal(JSON.parse(await readFile(path.join(root,'disposable-delivery-evidence.json'),'utf8')).sent.length,2);
                    console.log(JSON.stringify({scope:'Reviewed factory send with two retained attachments',provider:'explicit no-network factory transport',persistentAttempts:1,providerMessages:1,replaySentAnotherCopy:false,liveDelivery:false}));
                  }
                  console.log(JSON.stringify({scope:'Normal staff Order approval → immutable Order PDF → factory draft preparation',staffApproved:true,factoryPrepared:true,factorySent:sourceFactorySend,acceptedSnapshotPreserved:true,returnedFactoryConfirmationVerified:false}));
                }
              }
            }
          }finally{await preparedDb.close()}
          const screenshot=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(OUTPUT,sourceStaffOrder?'source-backed-staff-order.png':sourceCustomerOrder?'source-backed-customer-order.png':'source-backed-customer-preparation.png'),Buffer.from(screenshot.data,'base64'));
          console.log(JSON.stringify({scope:'Source-backed complete-schedule review → normal customer preview → reviewed terms → retained Email/PDF preparation',positions:5,additionalPositionsExplicitlyReviewed:true,sent:sourceCustomerReissue,customerReissueVerified:sourceCustomerReissue,liveDelivery:false}));
        }
        return;
      }
      await tab.evaluate(`(()=>{const section=${supplierSelector};for(const [label,value] of [['Field','quotation_reference'],['Before','Original disposable issued quotation'],['Requested','A new revised quotation reference'],['Returned','WEB/26/1133450'],['Before source / page','Disposable issued Estimate overview'],['Returned source / page','web-26-1133450.pdf, page 1, quotation reference']]){const field=[...section.querySelectorAll('label')].find(item=>item.textContent===label).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}))}})()`);
      await click(tab,'Save supplier review');
      await waitFor(()=>tab.evaluate("document.body.innerText.includes('field(s) still need resolution')"),'Unresolved source review did not explain remaining work');
      const reviewDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
      try{
        const saved=await reviewDb.get('SELECT * FROM supplier_response_reviews');assert.equal(saved.supplier_enquiry_id,preparedContext.enquiries[0].id);assert.equal(saved.unresolved,1);assert.equal(JSON.parse(saved.checks_json)[0].afterValue,'WEB/26/1133450');
        assert.equal((await reviewDb.get('SELECT verified_at FROM supplier_revision_requests')).verified_at,null,'Receipt or unresolved review approved customer reissue');
        assert.equal((await reviewDb.get('SELECT COUNT(*) count FROM issued_quotations')).count,1,'Source review issued another customer quotation');
      }finally{await reviewDb.close()}
      if(process.argv.includes('--stop-after-multi-supplier-review')){
        await tab.evaluate(`(()=>{const select=${supplierSelector}.querySelector('select');const other=[...select.options].find(item=>item.textContent.includes('TEST Journey Supplier'));if(!other)throw new Error('Second supplier review is missing');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,other.value);select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await waitFor(()=>tab.evaluate("document.body.innerText.includes('No retained revised document is linked to this supplier request')"),'Outstanding supplier was incorrectly treated as reviewed');
        await tab.evaluate(`(()=>{const select=${supplierSelector}.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(preparedContext.enquiries[0].id)});select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await waitFor(()=>tab.evaluate(`${supplierSelector}&&[...${supplierSelector}.querySelectorAll('label')].find(item=>item.textContent==='Returned')?.querySelector('input')?.value==='WEB/26/1133450'`),'Switching supplier lost the saved source review');
      }
      if(receivedSupplierReviews){
        await click(tab,'Open working Estimate');await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Request supplier estimate / revision'))"),'Working Estimate did not reopen for second supplier');
        await click(tab,'Request supplier estimate / revision');
        await waitFor(()=>tab.evaluate("[...document.querySelectorAll('summary')].some(item=>item.textContent==='Review an incoming supplier reply')"),'Second supplier request was not discoverable');
        await tab.evaluate("[...document.querySelectorAll('summary')].find(item=>item.textContent==='Review an incoming supplier reply').click();[...document.querySelectorAll('.supplier-rfq__history button')].find(item=>item.textContent.includes('Zyle Fenster')).click()");
        await click(tab,'Find replies');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Disposable Zyle DOCX response')"),'Second genuine source reply was absent');
        await click(tab,'Disposable Zyle DOCX response');await waitFor(()=>tab.evaluate("document.body.innerText.includes('This exact Zyle response')"),'Second exact message body did not open');
        await click(tab,'Review and file selected document');await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.trim()==='File selected document'&&!item.disabled)"),'Second source filing was not ready');
        await click(tab,'File selected document');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Import Manufacturer Estimate')"),'Second source was not saved');
        await tab.evaluate("document.querySelector('[aria-label=\"Supplier reply review\"] button')?.click()");
        // Leave through the normal sidebar; no supplier source is imported here.
        await tab.send('Page.navigate',{url:`${APP_URL}/?journey=review-both`});
        await waitFor(()=>tab.evaluate("document.body.innerText.includes('Client Portal')"),'Staff navigation did not reload');await click(tab,'Client Portal');
        await waitFor(()=>tab.evaluate(`[...document.querySelectorAll('article')].some(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})&&item.querySelector('button'))`),'Two-supplier customer review disappeared');
        await tab.evaluate(`[...document.querySelectorAll('article')].find(item=>item.textContent.includes(${JSON.stringify(fixture.clientReference)})).querySelector('button').click()`);
        await waitFor(()=>tab.evaluate("[...document.querySelectorAll('legend')].some(item=>item.textContent==='Supplier response reviews')"),'Both supplier reviews did not reload');
        for(const [supplierName,returned,sourceReference] of [['EKO-OKNA','WEB/26/1133450','web-26-1133450.pdf, page 1'],['Zyle Fenster','343117-3','Retained Zyle DOCX, PRICE OFFER heading']]){
          await tab.evaluate(`(()=>{const select=${supplierSelector}.querySelector('select'),option=[...select.options].find(item=>item.textContent.includes(${JSON.stringify(supplierName)}));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,option.value);select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
          await waitFor(()=>tab.evaluate("document.body.innerText.includes('Save supplier review')"),'Supplier source review did not render');
          await tab.evaluate(`(()=>{const section=${supplierSelector};for(const [label,value] of [['Field','quotation_reference'],['Before','Original disposable issued quotation'],['Requested','A new revised quotation reference'],['Returned',${JSON.stringify(returned)}],['Before source / page','Disposable issued Estimate overview'],['Returned source / page',${JSON.stringify(sourceReference)}],['Review note','Staff accepts the evidenced supplier reference unchanged for this disposable review. Overall customer finish changes remain separately review-required.']]){const field=[...section.querySelectorAll('label')].find(item=>item.textContent===label).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}))}const checkbox=section.querySelector('input[type=checkbox]');if(!checkbox.checked)checkbox.click()})()`);
          await click(tab,'Save supplier review');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Supplier review saved. Complete')"),'Explicit supplier resolution did not save');
        }
        const bothDb=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
        try{
          const reviews=await bothDb.all('SELECT * FROM supplier_response_reviews ORDER BY rowid');assert.equal(reviews.length,3);assert.equal(reviews[0].unresolved,1);assert.ok(reviews.slice(1).every(review=>review.unresolved===0));assert.notEqual(reviews[1].canonical_document_id,reviews[2].canonical_document_id);
          const replies=await bothDb.all('SELECT DISTINCT canonical_document_id FROM manufacturer_response_links');assert.equal(replies.length,2);
          assert.equal((await bothDb.get('SELECT verified_at FROM supplier_revision_requests')).verified_at,null);assert.equal((await bothDb.get('SELECT COUNT(*) count FROM issued_quotations')).count,1);
        }finally{await bothDb.close()}
      }
      console.log(JSON.stringify({scope:'Normal source-bound supplier field review after exact filing',unresolvedReviewPersisted:true,customerReissueStillBlocked:true,secondSupplierRemainsOutstanding:process.argv.includes('--stop-after-multi-supplier-review'),bothSupplierResolutionsSaved:receivedSupplierReviews,approvedReissueVerified:false}));return;
    }

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
    await tab.send("Page.navigate", { url: `${APP_URL}/?journey=staff-order` }); await waitFor(() => tab.evaluate("document.body.innerText.includes('Client Portal')"), "Staff application did not reopen for the Order journey"); await click(tab, "Client Portal"); await waitFor(() => tab.evaluate(`[...document.querySelectorAll('.client-portal-directory__list article')].some(item=>item.textContent.includes(${JSON.stringify(`TEST-CL-${fixture.suffix.toUpperCase()}`)}))`), "Disposable Client was absent from the Portal directory"); const portalOpened = await tab.evaluate(`(()=>{const row=[...document.querySelectorAll('.client-portal-directory__list article')].find(item=>item.textContent.includes(${JSON.stringify(`TEST-CL-${fixture.suffix.toUpperCase()}`)}));const button=row?.querySelector('button');if(!button)return false;button.click();return true})()`); assert.equal(portalOpened, true); await waitFor(() => tab.evaluate(`document.body.innerText.includes(${JSON.stringify(order.order_ref)})`), "Internal Portal did not show the accepted Order"); await click(tab, "Open Order journey"); await waitFor(() => tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Approve Order for factory'))"), "Order approval action did not render"); await click(tab, "Approve Order for factory"); await waitFor(() => tab.evaluate("document.body.innerText.includes('immutable staff-approved Order PDF created')"), "Staff UI did not approve the Order"); await waitFor(() => tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent.includes('Prepare factory Order preview'))"), "Factory Order preview action did not render"); assert.equal(await tab.evaluate("[...document.querySelectorAll('label')].find(item=>item.textContent.includes('Send now to the configured factory test address'))?.querySelector('input')?.disabled"),undefined); await input(tab, ".portal-operation-detail fieldset input[type=email]", FACTORY); await click(tab, "Prepare factory Order preview"); await waitFor(() => tab.evaluate("document.body.innerText.includes('Factory Order email and PDF prepared')"), "Staff UI did not prepare the factory Order"); const orderStaffScreen = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(path.join(OUTPUT, "04-staff-order-prepared--1440x900.png"), Buffer.from(orderStaffScreen.data, "base64"));
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
  } catch(error) {
    if(tab){
      try{console.error(JSON.stringify({journeyFailureUi:await tab.evaluate('document.body.innerText'),browserErrors:tab.diagnostics,failedRequests:tab.failures}));}catch{}
    }
    throw error;
  } finally {
    try{await dispose()}finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);process.removeListener('SIGBREAK',interrupt);}
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
