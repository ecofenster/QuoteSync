import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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
  return { evaluate, diagnostics, close: () => socket.close() };
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
  const userRuntimeBefore = await fetch("http://127.0.0.1:3001/api/health").then((response) => response.json()).catch(() => null);
  try {
    const apiEnvironment = { PORT: String(API_PORT), QUOTESUITE_DB_PATH: join(root, "acceptance.db"), QUOTESYNC_ATTACHMENT_ROOT: join(root, "attachments"), QUOTESUITE_APP_ORIGINS: APP_URL, NODE_ENV: "development" };
    const apiProcess = ownedProcess(["server/index.js"], apiEnvironment);
    ownedServers.push(apiProcess);
    await waitFor(() => reachable(`${API_URL}/api/health`), "Disposable CRM API did not start");
    const health = await api("/api/health");
    assert(health.capabilities.includes("crm-workday-dashboard-v1"), "Disposable API did not load the CRM workday contract");

    const client = await api("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Alex Example", email: "alex.crm@example.test", project_name: "Test House", client_type: "Individual" }) });
    await api("/api/followups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "crm-browser-followup", client_id: client.id, title: "Disposable follow-up", notes: "Call the customer", due_at: "2026-09-10", status: "pending" }) });

    const viteProcess = ownedProcess(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"], { VITE_API_BASE_URL: API_URL, NODE_ENV: "development" });
    ownedServers.push(viteProcess);
    await waitFor(() => reachable(APP_URL), "Disposable CRM web app did not start");

    const browser = await launchChrome();
    browserController.setRun({ label: "crm-workday", child: browser.child, rootPid: browser.child.pid, userDataDir: browser.userDataDir, debugPort: DEBUG_PORT, profileProcessCountBefore: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }), startedAt: new Date().toISOString() });
    tab = await connect();
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard-summary'))`), "Canonical dashboard data did not render");
    const initial = await tab.evaluate(`(() => ({primary:[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New Enquiry')?.textContent.trim(),overdue:[...document.querySelectorAll('.qs-dashboard-summary button')].find(b=>b.textContent.includes('Overdue'))?.textContent.trim(),search:Boolean(document.querySelector('.qs-dashboard-search-panel input'))}))()`);
    assert(initial.primary === "New Enquiry" && initial.search && String(initial.overdue || "").includes("1"), `Dashboard foundation is incomplete: ${JSON.stringify(initial)}`);

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

    await tab.evaluate(`([...document.querySelectorAll('.app-sidebar-item')].find(b=>b.textContent.trim()==='Main Dashboard')).click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard')) && [...document.querySelectorAll('.qs-dashboard-summary button')].some(b=>b.textContent.includes('Waiting on supplier')&&b.textContent.includes('1'))`), "Saved supplier waiting state did not return to the dashboard");
    await tab.evaluate(`(() => { const input=document.querySelector('.qs-dashboard-search-panel input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'EF-CL'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.qs-dashboard-search-results')?.innerText.includes('EF-CL-001')`), "Bounded dashboard search did not return the disposable Client");

    await tab.evaluate(`([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('EF-ENQ-001'))).click()`);
    await waitFor(() => tab.evaluate(`document.querySelector('.commercial-identity-detail')?.innerText.includes('EF-ENQ-001')`), "Dashboard Enquiry action did not open the exact Enquiry");
    await tab.evaluate(`([...document.querySelectorAll('.app-sidebar-item')].find(b=>b.textContent.trim()==='Main Dashboard')).click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard'))`), "Dashboard did not reopen");
    await tab.evaluate(`([...document.querySelectorAll('.qs-work-item')].find(b=>b.textContent.includes('Disposable follow-up'))).click()`);
    await waitFor(() => tab.evaluate(`document.body.innerText.includes('Follow-ups on 2026-09-10') && document.body.innerText.includes('Disposable follow-up')`), "Dashboard follow-up action did not open the exact due date and item");

    assert(tab.diagnostics.length === 0, `Browser exceptions: ${tab.diagnostics.join("; ")}`);
    const userRuntimeAfter = await fetch("http://127.0.0.1:3001/api/health").then((response) => response.json()).catch(() => null);
    assert(userRuntimeBefore?.instanceId === userRuntimeAfter?.instanceId, "The user-owned API was replaced during disposable acceptance");
    console.log(JSON.stringify({ verified: ["canonical dashboard", "primary New Enquiry route", "existing Client evidence", "next-action progress/success", "failure explanation and retained-input retry", "waiting-state projection", "bounded search", "exact Enquiry navigation", "exact follow-up navigation"], disposable: true, userApiInstancePreserved: userRuntimeAfter?.instanceId || null }, null, 2));
  } finally {
    tab?.close();
    const browserCleanup = await browserController.stop("final");
    const serverCleanup = await terminateOwnedProcessTrees(ownedServers, { platformName: process.platform });
    await rm(root, { recursive: true, force: true });
    console.log(`CRM browser cleanup: ${JSON.stringify(browserCleanup)}`);
    console.log(`Disposable server cleanup: ${JSON.stringify(serverCleanup)}`);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { const cleanup = await browserController.stop("top-level"); if (!cleanup.skipped) console.log(`CRM top-level cleanup: ${JSON.stringify(cleanup)}`); });
