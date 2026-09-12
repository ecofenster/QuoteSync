import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTree, terminateOwnedProcessTrees } from "./e2e-owned-process.mjs";

const API_PORT = 3311;
const APP_PORT = 5411;
const DEBUG_PORT = 9311;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async (fn, message, timeout = 30000) => { const started = Date.now(); while (Date.now() - started < timeout) { const value = await fn().catch(() => false); if (value) return value; await delay(150); } throw new Error(message); };
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };
const browserController = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
browserController.installInterruptHandlers();

function ownedProcess(args, env) {
  const child = spawn(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  return child;
}

async function launchChrome() {
  const userDataDir = await browserController.createProfile({ label: "crm-workday", debugPort: DEBUG_PORT });
  const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank"], { stdio: "ignore", windowsHide: true });
  browserController.setRun({ child, rootPid: child.pid });
  await waitFor(() => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Owned Chrome did not start", 15000);
  return { child, userDataDir };
}

async function connect() {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(APP_URL));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let callId = 0; const pending = new Map(); const diagnostics = [];
  socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.text || "Browser exception"); if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++callId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result?.value; };
  await send("Runtime.enable"); await send("Page.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }); await send("Page.navigate", { url: APP_URL });
  return { send, evaluate, diagnostics, close: () => socket.close() };
}

async function api(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${value.error || response.status}`);
  return value;
}

async function run() {
  const root = await mkdtemp(join(tmpdir(), "quotesuite-crm-workday-"));
  const ownedServers = [];
  let tab;
  let fixtureDb;
  const userRuntimeBefore = await fetch("http://127.0.0.1:3001/api/health").then((response) => response.json()).catch(() => null);
  try {
    const apiEnvironment = { PORT: String(API_PORT), QUOTESUITE_DB_PATH: join(root, "acceptance.db"), QUOTESYNC_ATTACHMENT_ROOT: join(root, "attachments"), QUOTESUITE_APP_ORIGINS: APP_URL, NODE_ENV: "development" };
    const apiProcess = ownedProcess(["server/index.js"], apiEnvironment);
    ownedServers.push(apiProcess);
    await waitFor(() => reachable(`${API_URL}/api/health`), "Disposable CRM API did not start");
    const health = await api("/api/health");
    assert(health.capabilities.includes("crm-workday-dashboard-v1") && health.capabilities.includes("enquiry-source-context-v1"), "Disposable API did not load the current CRM/Enquiry contract");

    const client = await api("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Alex Example", email: "alex.crm@example.test", project_name: "Test House", client_type: "Individual" }) });
    await api("/api/followups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "crm-browser-followup", client_id: client.id, title: "Disposable follow-up", notes: "Call the customer", due_at: "2026-09-10", status: "pending" }) });
    for (let index = 2; index <= 6; index += 1) await api("/api/followups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: `crm-browser-followup-${index}`, client_id: client.id, title: `Disposable follow-up ${index}`, notes: `Bounded priority item ${index}`, due_at: `2026-09-11T${String(8 + index).padStart(2, "0")}:00:00.000Z`, status: "pending" }) });
    const boundedProjection = await api("/api/crm/dashboard");
    assert(boundedProjection.attention.length === 6 && boundedProjection.limits.attention === 40, `Dashboard attention projection was not bounded as expected: ${JSON.stringify(boundedProjection.limits)}`);

    const viteProcess = ownedProcess(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"], { VITE_API_BASE_URL: API_URL, NODE_ENV: "development" });
    ownedServers.push(viteProcess);
    await waitFor(() => reachable(APP_URL), "Disposable CRM web app did not start");

    const browser = await launchChrome();
    browserController.setRun({ label: "crm-workday", child: browser.child, rootPid: browser.child.pid, userDataDir: browser.userDataDir, debugPort: DEBUG_PORT, profileProcessCountBefore: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }), startedAt: new Date().toISOString() });
    tab = await connect();
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard-summary'))`), "Canonical dashboard data did not render");
    const initial = await tab.evaluate(`(() => ({primary:[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New Enquiry')?.textContent.trim(),overdue:[...document.querySelectorAll('.qs-dashboard-summary button')].find(b=>b.textContent.includes('Overdue'))?.textContent.trim(),search:Boolean(document.querySelector('.qs-dashboard-search-panel input'))}))()`);
    assert(initial.primary === "New Enquiry" && initial.search && String(initial.overdue || "").includes("6"), `Dashboard foundation is incomplete: ${JSON.stringify(initial)}`);
    const compact = await tab.evaluate(`({rows:document.querySelectorAll('.qs-dashboard-panel--attention .qs-work-item').length,count:document.querySelector('.qs-dashboard-panel__reveal [role=status]')?.textContent,showMore:Boolean([...document.querySelectorAll('.qs-dashboard-panel__reveal button')].find(button=>button.textContent.trim()==='Show more'))})`);
    assert(compact.rows === 4 && compact.count === "Showing 4 of 6" && compact.showMore, `Needs attention was not compact initially: ${JSON.stringify(compact)}`);
    await tab.evaluate(`([...document.querySelectorAll('.qs-dashboard-panel__reveal button')].find(button=>button.textContent.trim()==='Show more')).click()`);
    await waitFor(() => tab.evaluate(`document.querySelectorAll('.qs-dashboard-panel--attention .qs-work-item').length===6&&document.querySelector('.qs-dashboard-panel__reveal [role=status]')?.textContent==='Showing 6 of 6'`), "Show more did not reveal the remaining priority items");
    await tab.evaluate(`([...document.querySelectorAll('.qs-dashboard-panel__reveal button')].find(button=>button.textContent.trim()==='Show fewer')).click()`);
    await waitFor(() => tab.evaluate(`document.querySelectorAll('.qs-dashboard-panel--attention .qs-work-item').length===4&&document.querySelector('.qs-dashboard-panel__reveal [role=status]')?.textContent==='Showing 4 of 6'`), "Show fewer did not restore the compact list");

    await tab.evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New Enquiry')).click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('form[aria-label="New Enquiry"]'))`), "New Enquiry form did not open from the dashboard");
    await tab.evaluate(`(() => { const set=(label,value)=>{const field=[...document.querySelectorAll('form[aria-label="New Enquiry"] label')].find(x=>x.querySelector('span')?.textContent.trim()===label)?.querySelector('input,textarea'); if(!field)throw new Error('Missing '+label); const setter=Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set; setter.call(field,value); field.dispatchEvent(new Event('input',{bubbles:true}));}; set('Name','Alex Example');set('Email','alex.crm@example.test');set('Project / site name','Test House'); })()`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('form[aria-label="New Enquiry"] button')].find(b=>b.textContent.trim()==='Create Enquiry'&&!b.disabled))`), "Create Enquiry did not become available");
    await tab.evaluate(`([...document.querySelectorAll('form[aria-label="New Enquiry"] button')].find(b=>b.textContent.trim()==='Create Enquiry')).click()`);
    await delay(1500);
    const creationState = await tab.evaluate(`({status:document.querySelector('.commercial-identity-workspace__status')?.innerText,detail:document.querySelector('.commercial-identity-detail')?.innerText,form:Boolean(document.querySelector('form[aria-label="New Enquiry"]'))})`);
    const persistedEnquiries = await api("/api/enquiries");
    assert(persistedEnquiries.some((item) => item.enquiryRef === "EF-ENQ-001"), `Enquiry creation failed: ${JSON.stringify({ creationState, persistedEnquiries })}`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-detail')?.innerText.includes('EF-ENQ-001')`), `Created Enquiry did not become selected: ${JSON.stringify(creationState)}`);
    const matching = await tab.evaluate(`({matches:document.body.innerText.includes('Possible existing Clients')&&document.body.innerText.includes('Same email address: alex.crm@example.test'),detail:document.querySelector('.commercial-identity-detail')?.innerText})`);
    assert(matching.matches, `Existing Client evidence was not shown after Enquiry creation: ${JSON.stringify(matching)}`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-source')?.innerText.includes('created manually')`), "Manual Enquiry did not explain the absence of an originating email");
    assert(!(await tab.evaluate(`document.body.innerText.includes('Quick actions')`)), "A generic Quick actions panel remained on the Enquiry route");

    await tab.evaluate(`(() => { const section=document.querySelector('.commercial-identity-next-action'); const set=(label,value)=>{const field=[...section.querySelectorAll('label')].find(x=>x.querySelector('span')?.textContent.trim()===label)?.querySelector('input,select'); const proto=field instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(field,value); field.dispatchEvent(new Event(field instanceof HTMLSelectElement?'change':'input',{bubbles:true}));};set('Action','Confirm supplier response');set('Due date','2026-09-12');set('Waiting on','supplier');})()`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.commercial-identity-next-action button')].find(b=>b.textContent.trim()==='Save next action'&&!b.disabled))`), "Save next action did not become available");
    await tab.evaluate(`([...document.querySelectorAll('.commercial-identity-next-action button')].find(b=>b.textContent.trim()==='Save next action')).click()`);
    await waitFor(() => tab.evaluate(`document.body.innerText.includes('Next action saved for EF-ENQ-001')`), "Next-action success feedback was not shown");

    await terminateOwnedProcessTree(apiProcess, { platformName: process.platform });
    await waitFor(async () => !(await reachable(`${API_URL}/api/health`)), "Disposable API did not stop for recovery acceptance");
    await tab.evaluate(`(() => { const field=[...document.querySelectorAll('.commercial-identity-next-action label')].find(x=>x.querySelector('span')?.textContent.trim()==='Action')?.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Retry after service recovery'); field.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.commercial-identity-next-action button')].find(b=>b.textContent.trim()==='Save next action'&&!b.disabled))`), "Recovery save did not become available");
    await tab.evaluate(`([...document.querySelectorAll('.commercial-identity-next-action button')].find(b=>b.textContent.trim()==='Save next action')).click()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-workspace__status')?.innerText.includes('unchanged')`), "Failure feedback did not explain safe recovery");
    assert(await tab.evaluate(`([...document.querySelectorAll('.commercial-identity-next-action label')].find(x=>x.querySelector('span')?.textContent.trim()==='Action')?.querySelector('input')?.value)==='Retry after service recovery'`), "Entered next action was lost after failure");
    const recoveredApi = ownedProcess(["server/index.js"], apiEnvironment); ownedServers.push(recoveredApi);
    await waitFor(() => reachable(`${API_URL}/api/health`), "Disposable API did not recover");
    await delay(1800);
    await tab.evaluate(`([...document.querySelectorAll('.commercial-identity-next-action button')].find(b=>b.textContent.trim()==='Save next action')).click()`);
    await waitFor(() => tab.evaluate(`document.body.innerText.includes('Next action saved for EF-ENQ-001')`), "Safe next-action retry did not succeed");

    const emailEnquiry = await api("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: "Alex Example", email: "alex.crm@example.test", projectName: "Email-backed Garden Room", source: "gmail", leadSource: "email" }) });
    fixtureDb = await open({ filename: apiEnvironment.QUOTESUITE_DB_PATH, driver: sqlite3.Database });
    const sourceAt = "2026-09-12T08:30:00.000Z";
    await fixtureDb.run(`INSERT INTO communication_messages(id,provider,provider_message_id,provider_thread_id,mailbox_id,direction,folder,status,from_json,to_json,cc_json,bcc_json,subject,body_html,body_text,in_reply_to_provider_message_id,links_json,error_message,sent_at,created_at,updated_at,provider_state_json)
      VALUES('crm-email-source','google_workspace','crm-email-provider','crm-email-thread','me','inbound','inbox','received',?,?,?,?,?,?,?,NULL,?,NULL,?,?,?,?)`, JSON.stringify(["Alex Example <alex.crm@example.test>"]), JSON.stringify(["sales@example.test"]), "[]", "[]", "Garden room enquiry", "<p>Please review the attached drawing and site photograph.</p>", "Please review the attached drawing and site photograph.", JSON.stringify([{ kind:"enquiry", id:emailEnquiry.id }]), sourceAt, sourceAt, sourceAt, JSON.stringify({ unread:false, providerRemoved:false, labels:[], threadCount:1 }));
    await fixtureDb.run("INSERT INTO communication_attachments(id,communication_message_id,file_name,media_type,size_bytes,provider_attachment_id,created_at,content_id,is_inline) VALUES('crm-email-document','crm-email-source','garden-room.pdf','application/pdf',1200,'provider-document',?,NULL,0)", sourceAt);
    await fixtureDb.run("INSERT INTO communication_attachments(id,communication_message_id,file_name,media_type,size_bytes,provider_attachment_id,created_at,content_id,is_inline) VALUES('crm-email-image','crm-email-source','site-photo.jpg','image/jpeg',2400,'provider-image',?,NULL,0)", sourceAt);
    await fixtureDb.run("INSERT INTO communication_attachments(id,communication_message_id,file_name,media_type,size_bytes,provider_attachment_id,created_at,content_id,is_inline) VALUES('crm-email-inline','crm-email-source','signature.png','image/png',400,'provider-inline',?,'signature',1)", sourceAt);
    await fixtureDb.run("INSERT INTO enquiry_email_intakes(id,enquiry_id,communication_message_id,provider_message_id,reviewed_brief,created_by,created_at) VALUES('crm-email-intake',?,'crm-email-source','crm-email-provider','Customer requests a garden room quotation using the supplied drawing and site photograph.','acceptance-user',?)", emailEnquiry.id, sourceAt);
    await fixtureDb.run("INSERT INTO enquiry_intake_attachments(id,enquiry_email_intake_id,communication_attachment_id,file_name,storage_status) VALUES('crm-email-document-selection','crm-email-intake','crm-email-document','garden-room.pdf','pending')");
    await fixtureDb.run("INSERT INTO enquiry_intake_attachments(id,enquiry_email_intake_id,communication_attachment_id,file_name,storage_status) VALUES('crm-email-image-selection','crm-email-intake','crm-email-image','site-photo.jpg','pending')");
    await fixtureDb.run("UPDATE crm_record_work_states SET due_at='2026-09-01T09:00:00.000Z',updated_at=? WHERE record_kind='enquiry' AND record_id=?", sourceAt, emailEnquiry.id);
    await fixtureDb.close(); fixtureDb = null;
    const exactSource = await api(`/api/enquiries/${emailEnquiry.id}/source`);
    assert(exactSource.original?.bodyText === "Please review the attached drawing and site photograph.", "Disposable source body did not retain the exact message");
    const refreshedProjection = await api("/api/crm/dashboard");
    assert(refreshedProjection.attention.some((item) => item.target?.id === emailEnquiry.id), `Email-backed Enquiry was absent from the canonical Dashboard projection: ${JSON.stringify(refreshedProjection.attention)}`);
    await tab.send("Page.reload", { ignoreCache: true });
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.app-sidebar-item'))`), "QuoteSuite did not recover after the disposable email arrived");

    await tab.evaluate(`([...document.querySelectorAll('.app-sidebar-item')].find(b=>b.textContent.trim()==='Main Dashboard')).click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard')) && [...document.querySelectorAll('.qs-dashboard-summary button')].some(b=>b.textContent.includes('Waiting on supplier')&&b.textContent.includes('1'))`), "Saved supplier waiting state did not return to the dashboard");
    await tab.evaluate(`(() => { const input=document.querySelector('.qs-dashboard-search-panel input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'EF-CL'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.qs-dashboard-search-results')?.innerText.includes('EF-CL-001')`), "Bounded dashboard search did not return the disposable Client");

    await tab.evaluate(`([...document.querySelectorAll('.qs-dashboard-panel__reveal button')].find(item=>item.textContent.trim()==='Show more'))?.click()`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('EF-ENQ-001')))`), "Show more did not retain the new Enquiry in priority order");
    await tab.evaluate(`([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('EF-ENQ-001'))).click()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-detail')?.innerText.includes('EF-ENQ-001')`), "Dashboard Enquiry action did not open the exact Enquiry");
    await tab.evaluate(`([...document.querySelectorAll('.app-sidebar-item')].find(b=>b.textContent.trim()==='Main Dashboard')).click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard'))`), "Dashboard did not reopen for the email-backed Enquiry");
    await tab.evaluate(`([...document.querySelectorAll('.qs-dashboard-panel__reveal button')].find(item=>item.textContent.trim()==='Show more'))?.click()`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('EF-ENQ-002')))`), "Email-backed Enquiry was not available in Needs attention");
    await tab.evaluate(`([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('EF-ENQ-002'))).click()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-source')?.innerText.includes('Garden room enquiry')&&document.querySelector('.commercial-identity-source')?.innerText.includes('garden-room.pdf')&&document.querySelector('.commercial-identity-source')?.innerText.includes('site-photo.jpg')`), "Exact email overview and genuine attachments did not load");
    await tab.evaluate(`document.querySelector('.commercial-identity-source__original summary')?.click()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-source__original')?.open===true`), "View original email did not expand");
    const renderedOriginal = await tab.evaluate(`document.querySelector('.commercial-identity-source__body')?.textContent||''`);
    assert(renderedOriginal.includes("attached drawing and site photograph"), `View original email did not show the retained exact message: ${renderedOriginal}`);
    assert(await tab.evaluate(`document.querySelector('.commercial-identity-source__attachments details summary')?.textContent.includes('1')`), "Inline signature resource classification was not available behind details");
    await tab.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 720, deviceScaleFactor: 1, mobile: false });
    await tab.evaluate(`document.body.style.zoom='150%';document.querySelector('.commercial-identity-qualify')?.scrollIntoView({block:'start'})`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.commercial-identity-matches button')].find(button=>button.textContent.trim()==='Use this Client'))`), "Existing Client choice was not reachable at increased zoom");
    await tab.evaluate(`([...document.querySelectorAll('.commercial-identity-matches button')].find(button=>button.textContent.trim()==='Use this Client')).click()`);
    const reachableConnection = await tab.evaluate(`(()=>{const button=[...document.querySelectorAll('.commercial-identity-qualify button')].find(item=>item.textContent.trim()==='Continue to Project');button?.scrollIntoView({block:'center'});const box=button?.getBoundingClientRect();return Boolean(button&&!button.disabled&&box&&box.top>=0&&box.bottom<=innerHeight)})()`);
    assert(reachableConnection, "Connect this Enquiry remained outside the usable viewport at 150% zoom");
    await tab.evaluate(`([...document.querySelectorAll('.commercial-identity-qualify button')].find(item=>item.textContent.trim()==='Continue to Project')).click()`);
    await waitFor(() => tab.evaluate(`document.body.innerText.includes('Connecting Enquiry and preparing its files…')`), "Immediate Enquiry connection progress was not shown", 1200);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-outcome')?.innerText.includes('Client and Project connected')&&document.querySelector('.commercial-identity-outcome')?.innerText.includes('waiting for connected storage')&&document.querySelector('.commercial-identity-outcome')?.innerText.includes('Retry filing')`), "Partial file outcome and safe retry were not explained");
    await tab.evaluate(`document.body.style.zoom='100%';([...document.querySelectorAll('.app-sidebar-item')].find(b=>b.textContent.trim()==='Main Dashboard')).click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard'))`), "Dashboard did not reopen after Enquiry connection");
    await tab.evaluate(`([...document.querySelectorAll('.qs-dashboard-panel__reveal button')].find(item=>item.textContent.trim()==='Show more'))?.click()`);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('Disposable follow-up')))`), "Disposable follow-up was not available after expanding Needs attention");
    await tab.evaluate(`([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('Disposable follow-up'))).click()`);
    await waitFor(() => tab.evaluate(`document.body.innerText.includes('Follow-ups on 2026-09-10') && document.body.innerText.includes('Disposable follow-up')`), "Dashboard follow-up action did not open the exact due date and item");

    assert(tab.diagnostics.length === 0, `Browser exceptions: ${tab.diagnostics.join("; ")}`);
    const userRuntimeAfter = await fetch("http://127.0.0.1:3001/api/health").then((response) => response.json()).catch(() => null);
    assert(userRuntimeBefore?.instanceId === userRuntimeAfter?.instanceId, "The user-owned API was replaced during disposable acceptance");
    console.log(JSON.stringify({ verified: ["canonical dashboard", "compact Needs attention 4 of 6", "Show more and Show fewer preserve bounded projection", "primary New Enquiry route", "generic Quick actions absent", "manual Enquiry missing-email explanation", "existing Client evidence", "next-action progress/success", "failure explanation and retained-input retry", "email-backed exact source/overview/document/image/inline classification", "connection action reachable at 150% zoom", "partial provider outcome and safe filing retry", "waiting-state projection", "bounded search", "exact Enquiry navigation", "exact follow-up navigation"], disposable: true, attentionLimit: boundedProjection.limits.attention, userApiInstancePreserved: userRuntimeAfter?.instanceId || null }, null, 2));
  } finally {
    tab?.close();
    if (fixtureDb) await fixtureDb.close();
    const browserCleanup = await browserController.stop("final");
    const serverCleanup = await terminateOwnedProcessTrees(ownedServers, { platformName: process.platform });
    await rm(root, { recursive: true, force: true });
    console.log(`CRM browser cleanup: ${JSON.stringify(browserCleanup)}`);
    console.log(`Disposable server cleanup: ${JSON.stringify(serverCleanup)}`);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { const cleanup = await browserController.stop("top-level"); if (!cleanup.skipped) console.log(`CRM top-level cleanup: ${JSON.stringify(cleanup)}`); });
