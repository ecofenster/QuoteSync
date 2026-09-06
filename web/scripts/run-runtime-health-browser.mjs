import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTree, terminateOwnedProcessTrees } from "./e2e-owned-process.mjs";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";

const ROOT = process.cwd();
const APP_URL = "http://127.0.0.1:4194";
const API_URL = "http://127.0.0.1:3021";
const DEBUG_PORT = 9297;
const services = [];
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async (fn, message, timeout = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await Promise.resolve().then(fn).catch(() => false);
    if (value) return value;
    await delay(150);
  }
  throw new Error(message);
};
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };

const browserRunController = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
browserRunController.installInterruptHandlers();

function startApi() {
  const child = spawn(process.execPath, ["index.js"], {
    cwd: `${ROOT}\\server`,
    env: { ...process.env, PORT: "3021", NODE_ENV: "development" },
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
  services.push(child);
  return child;
}

function startVite() {
  const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4194"], {
    cwd: ROOT,
    env: { ...process.env, VITE_API_BASE_URL: API_URL },
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
  services.push(child);
  return child;
}

async function launchChrome() {
  const userDataDir = await browserRunController.createProfile({ label: "runtime-health", debugPort: DEBUG_PORT });
  const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank"], { stdio: "ignore", shell: false, windowsHide: true });
  browserRunController.setRun({ child });
  await waitFor(() => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Chrome unavailable", 10000);
  return { child, userDataDir };
}

async function connect() {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(APP_URL));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  let healthRequests = 0;
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Network.requestWillBeSent" && message.params?.request?.url === `${API_URL}/api/health`) healthRequests += 1;
    if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.text || "Runtime exception");
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") diagnostics.push(message.params.args?.map((item) => item.value || item.description).join(" ") || "console.error");
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const call = ++id; pending.set(call, { resolve, reject }); socket.send(JSON.stringify({ id: call, method, params })); });
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result?.value; };
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: APP_URL });
  return { send, evaluate, diagnostics, healthRequestCount: () => healthRequests, close: () => socket.close() };
}

async function run() {
  let api;
  let browser;
  let tab;
  try {
    api = startApi();
    startVite();
    await waitFor(() => reachable(`${API_URL}/api/health`), "Isolated current API unavailable");
    await waitFor(() => reachable(APP_URL), "Vite unavailable");
    browser = await launchChrome();
    tab = await connect();
    browserRunController.setRun({ profileProcessCountDuring: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }) });
    await waitFor(() => tab.evaluate(`document.querySelector('.runtime-health__badge')?.textContent.includes('Connected')`), "Connected status unavailable");
    const runtime = await (await fetch(`${API_URL}/api/health`)).json();
    assert(runtime.runtimeIdentity === QUOTESUITE_RUNTIME_CONTRACT.identity, `Wrong active runtime: ${runtime.runtimeIdentity}`);

    await tab.evaluate(`[...document.querySelectorAll('.app-sidebar-item')].find((node) => node.textContent.trim() === 'Estimates')?.click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.estimate-index-table tbody tr'))`), "Estimate workspace unavailable");
    await delay(750);
    const before = await tab.evaluate(`(() => ({ active: document.querySelector('.app-sidebar-item[data-state="active"]')?.textContent.trim(), estimateRef: document.querySelector('.estimate-index-table tbody tr')?.dataset.estimateRef, navigationCount: performance.getEntriesByType('navigation').length }))()`);

    await terminateOwnedProcessTree(api);
    services.splice(services.indexOf(api), 1);
    await waitFor(() => tab.evaluate(`document.querySelector('.runtime-health__badge')?.textContent.includes('API Offline')`), "API-offline state unavailable", 25000);
    const offline = await tab.evaluate(`(() => ({ active: document.querySelector('.app-sidebar-item[data-state="active"]')?.textContent.trim(), retained: Boolean([...document.querySelectorAll('.estimate-index-table tbody tr')].find((row) => row.dataset.estimateRef === ${JSON.stringify(before.estimateRef)})), notice: document.querySelector('.runtime-health__notice')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth }))()`);
    assert(offline.active === before.active && offline.retained, `Loaded workspace changed during outage: ${JSON.stringify({ before, offline })}`);
    assert(/previously loaded data/i.test(offline.notice || ""), "Cached-data qualification missing");

    const requestCountBeforeRetry = tab.healthRequestCount();
    await tab.evaluate(`document.querySelector('.runtime-health__retry')?.click()`);
    await waitFor(() => tab.healthRequestCount() > requestCountBeforeRetry, "Manual retry did not trigger one immediate health check");
    api = startApi();
    await waitFor(() => reachable(`${API_URL}/api/health`), "Restarted current API unavailable");
    await waitFor(() => tab.evaluate(`/Recovered|Connected/.test(document.querySelector('.runtime-health__badge')?.textContent || '')`), "Automatic recovery unavailable", 15000);

    const recovered = await tab.evaluate(`(() => ({ active: document.querySelector('.app-sidebar-item[data-state="active"]')?.textContent.trim(), retained: Boolean([...document.querySelectorAll('.estimate-index-table tbody tr')].find((row) => row.dataset.estimateRef === ${JSON.stringify(before.estimateRef)})), navigationCount: performance.getEntriesByType('navigation').length, mutations: document.querySelector('.runtime-health__notice')?.dataset.mutations || 'allowed' }))()`);
    assert(recovered.active === before.active && recovered.retained, "Workspace was not preserved across restart");
    assert(recovered.navigationCount === before.navigationCount, "API recovery caused navigation or reload");
    assert(tab.healthRequestCount() < 12, `Unexpected health request storm: ${tab.healthRequestCount()}`);

    await tab.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const mobile = await tab.evaluate(`(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, badge: Boolean(document.querySelector('.runtime-health__badge')) }))()`);
    assert(!mobile.overflow && mobile.badge, `Responsive shell failed: ${JSON.stringify(mobile)}`);
    await tab.evaluate(`document.querySelector('.theme-selector')?.click()`);
    assert(await tab.evaluate(`['dark','light'].includes(document.documentElement.dataset.qsTheme)`), "Theme status rendering failed");

    const healthNoise = tab.diagnostics.filter((entry) => /api\/health|API error|Failed to fetch/i.test(String(entry)));
    assert(healthNoise.length === 0, `Expected health polling polluted the console: ${JSON.stringify(healthNoise)}`);
    console.log(JSON.stringify({ runtimeIdentity: runtime.runtimeIdentity, before, offline, recovered, healthRequests: tab.healthRequestCount(), mobile, diagnostics: tab.diagnostics }, null, 2));
  } finally {
    tab?.close();
    if (browser) await browserRunController.stop("final");
    await terminateOwnedProcessTrees(services);
  }
}

await run();
