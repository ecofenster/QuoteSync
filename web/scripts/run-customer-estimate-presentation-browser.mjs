import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTree } from "./e2e-owned-process.mjs";

const APP_URL = "http://127.0.0.1:5273";
const API_URL = "http://127.0.0.1:3101";
const DEBUG_PORT = 9412;
const ESTIMATE_REF = process.env.QUOTESUITE_ESTIMATE_PRESENTATION_REF || "EF-EST-2026-057";
const OUTPUT_DIR = path.resolve("test-output/customer-estimate-presentation");
const assert = (value, message) => { if (!value) throw new Error(message); };
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };
const waitFor = async (work, message, timeout = 60_000) => { const started = Date.now(); while (Date.now() - started < timeout) { const result = await work().catch(() => false); if (result) return result; await delay(150); } throw new Error(message); };
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
controller.installInterruptHandlers();

async function launchChrome() {
  const userDataDir = await controller.createProfile({ label: "customer-estimate-presentation", debugPort: DEBUG_PORT });
  const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "--window-size=1920,1080", "about:blank"], { stdio: "ignore", windowsHide: true });
  controller.setRun({ child });
  await waitFor(() => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Owned Chrome did not start.", 15_000);
  return { child, userDataDir };
}

async function connect() {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(APP_URL));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0; const pending = new Map(); const diagnostics = []; const failedResponses = [];
  socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || "Runtime exception"); if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") diagnostics.push(message.params.args?.map((arg) => arg.value || arg.description).join(" ") || "Console error"); if (message.method === "Network.responseReceived" && Number(message.params?.response?.status) >= 400) failedResponses.push({ status: message.params.response.status, url: message.params.response.url }); if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const call = ++id; pending.set(call, { resolve, reject }); socket.send(JSON.stringify({ id: call, method, params })); });
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; };
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }); await send("Page.navigate", { url: APP_URL });
  return { send, evaluate, diagnostics, failedResponses, close: () => socket.close() };
}

async function screenshot(tab, selector, name) {
  const clip = await tab.evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node)return null; node.scrollIntoView({block:'start'}); const rect=node.getBoundingClientRect(); return {x:Math.max(0,rect.left+scrollX),y:Math.max(0,rect.top+scrollY),width:rect.width,height:Math.min(rect.height,1120),scale:1}; })()`);
  assert(clip, `Missing screenshot target: ${selector}`);
  const captured = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  const output = path.join(OUTPUT_DIR, `${name}.png`);
  await writeFile(output, Buffer.from(captured.data, "base64"));
  return output;
}

async function searchablePdfText(file) {
  const pdf = await getDocument({ data: new Uint8Array(await readFile(file)), disableWorker: true }).promise;
  let text = "";
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo); const content = await page.getTextContent(); text += content.items.map((item) => item.str).join(" ");
  }
  return { pages: pdf.numPages, text };
}

async function run() {
  assert(!(await reachable(`${API_URL}/api/health`)), "Disposable API port 3101 must be free before this run.");
  const ownedRoot = await mkdtemp(path.join(os.tmpdir(), "quotesuite-estimate-presentation-"));
  const databasePath = path.join(ownedRoot, "quotesync.db");
  await copyFile(path.resolve("quotesync.db"), databasePath);
  await mkdir(OUTPUT_DIR, { recursive: true });
  let api; let vite; let tab;
  try {
    api = spawn(process.execPath, ["server/index.js"], { cwd: process.cwd(), env: { ...process.env, QUOTESUITE_DB_PATH: databasePath, PORT: "3101", NODE_ENV: "development", QUOTESUITE_APP_ORIGINS: APP_URL }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    vite = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5273"], { cwd: process.cwd(), env: { ...process.env, VITE_API_BASE_URL: API_URL }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    await waitFor(() => reachable(`${API_URL}/api/health`), "Disposable API did not become healthy.");
    await waitFor(() => reachable(APP_URL), "Disposable Vite did not become available.");
    const browser = await launchChrome();
    controller.setRun({ child: browser.child, userDataDir: browser.userDataDir, debugPort: DEBUG_PORT, profileProcessCountDuring: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }) });
    tab = await connect();
    await waitFor(() => tab.evaluate("Boolean([...document.querySelectorAll('.app-sidebar-item')].find((node)=>node.textContent.trim()==='Estimates'))"), "QuoteSuite shell did not render.");
    await tab.evaluate("[...document.querySelectorAll('.app-sidebar-item')].find((node)=>node.textContent.trim()==='Estimates').click()");
    await waitFor(() => tab.evaluate("Boolean(document.querySelector('.estimate-index-table'))"), "Estimate index did not render.");
    await tab.evaluate(`(() => { const input=document.querySelector('input[placeholder^="Search estimates"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(ESTIMATE_REF)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('[data-estimate-ref=${JSON.stringify(ESTIMATE_REF)}]'))`), `${ESTIMATE_REF} was not found in the disposable database.`);
    await tab.evaluate(`document.querySelector('button[aria-label="Open ${ESTIMATE_REF}"]').click()`);
    await waitFor(() => tab.evaluate("Boolean([...document.querySelectorAll('button')].find((node)=>node.textContent.trim()==='Review Customer Quotation'&&!node.disabled))"), "Estimate customer document action did not become available.");
    await tab.evaluate("[...document.querySelectorAll('button')].find((node)=>node.textContent.trim()==='Review Customer Quotation').click()");
    await waitFor(() => tab.evaluate("Boolean(document.querySelector('.customer-quotation__dialog'))"), "Customer Estimate preview did not open.");
    await tab.evaluate(`(() => { const select=document.querySelector('select[aria-label="Document template"]'); if(select){select.value='customer_quotation';select.dispatchEvent(new Event('change',{bubbles:true}));} })()`);
    await waitFor(() => tab.evaluate("Boolean(document.querySelector('.customer-quotation-cover')&&document.querySelector('.customer-quotation-page--specification-overview'))"), "Approved Estimate front matter did not render.");
    const result = await tab.evaluate(`(() => { const root=document.querySelector('.customer-quotation__print-root'); const cover=document.querySelector('.customer-quotation-cover'); const banner=document.querySelector('.customer-quotation-cover__banner'); const pages=[...document.querySelectorAll('.customer-quotation-page')]; return {title:cover?.innerText, pageCount:pages.length, positionCount:document.querySelectorAll('.customer-quotation-position').length, showcaseCount:document.querySelectorAll('.customer-quotation-showcases article').length, specificationGroupCount:document.querySelectorAll('.customer-quotation-specification-overview article').length, coverOverflow:cover?Math.max(0,cover.scrollHeight-cover.clientHeight):null, rootOverflow:root?Math.max(0,root.scrollWidth-root.clientWidth):null, bannerBackground:banner?getComputedStyle(banner).backgroundColor:null, bodyText:root?.innerText||''}; })()`);
    assert(result.title.includes("ESTIMATE") && result.title.includes(ESTIMATE_REF), `Cover identity is incomplete: ${JSON.stringify(result)}`);
    assert(result.positionCount > 0 && result.specificationGroupCount > 0, `Estimate projection did not retain positions/specification: ${JSON.stringify(result)}`);
    assert(result.coverOverflow <= 1 && result.rootOverflow <= 1, `Estimate presentation overflowed: ${JSON.stringify(result)}`);
    assert(!/Supplier Cost|Gross Margin|Estimate Rate|Live Rate/.test(result.bodyText), "Internal commercial evidence leaked into the customer Estimate.");
    const coverPng = await screenshot(tab, ".customer-quotation-cover", "estimate-cover");
    const showcasePng = result.showcaseCount ? await screenshot(tab, ".customer-quotation-page--showcase", "estimate-products") : null;
    const specificationPng = await screenshot(tab, ".customer-quotation-page--specification-overview", "estimate-specification");
    const positionPng = await screenshot(tab, ".customer-quotation-position", "estimate-position");
    await tab.send("Emulation.setEmulatedMedia", { media: "print" });
    const generated = await tab.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const pdfPath = path.join(OUTPUT_DIR, `${ESTIMATE_REF}-Estimate-preview.pdf`);
    await writeFile(pdfPath, Buffer.from(generated.data, "base64"));
    const pdf = await searchablePdfText(pdfPath);
    assert(pdf.pages === result.pageCount, `PDF page count differs from preview: ${pdf.pages}/${result.pageCount}`);
    for (const required of ["Estimate", ESTIMATE_REF, "Products in Your Estimate", "Your Specification at a Glance", "Estimate Summary"]) assert(pdf.text.includes(required), `Searchable PDF is missing ${required}.`);
    const relevantFailures = tab.failedResponses.filter((item) => item.status >= 400 && !item.url.includes("favicon"));
    assert(tab.diagnostics.length === 0, `Browser diagnostics: ${tab.diagnostics.join("; ")}`);
    assert(relevantFailures.length === 0, `Browser HTTP failures: ${JSON.stringify(relevantFailures)}`);
    console.log(JSON.stringify({ estimateRef: ESTIMATE_REF, disposableDatabase: true, result: { ...result, bodyText: undefined }, pdf: { path: pdfPath, pages: pdf.pages, searchableCharacters: pdf.text.length }, screenshots: { coverPng, showcasePng, specificationPng, positionPng }, diagnostics: tab.diagnostics, failedResponses: relevantFailures }, null, 2));
  } finally {
    tab?.close();
    const browserCleanup = await controller.stop("final");
    const viteCleanup = vite ? await terminateOwnedProcessTree(vite, { platformName: process.platform }) : { skipped: true };
    const apiCleanup = api ? await terminateOwnedProcessTree(api, { platformName: process.platform }) : { skipped: true };
    await rm(ownedRoot, { recursive: true, force: true });
    assert(!(await reachable(`${API_URL}/api/health`)), "Disposable API still owns port 3101 after cleanup.");
    console.log(JSON.stringify({ browserCleanup, viteCleanup, apiCleanup, finalPort3101: "not listening", userPort3001: "untouched" }));
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
