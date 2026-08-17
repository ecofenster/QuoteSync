import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { platform } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { cleanupPhase6Profile, createPhase6ProfileDirectory, terminateOwnedChrome } from "./e2e-chrome-profile.mjs";
import { terminateOwnedProcessTrees } from "./e2e-owned-process.mjs";

const APP_URL = process.env.QS_E2E_APP_URL ?? "http://localhost:4173";
const API_URL = process.env.QS_E2E_API_URL ?? "http://localhost:3001";
const APP_ENDPOINT = new URL(APP_URL);
const DEBUG_PORT = Number(process.env.QS_E2E_DEBUG_PORT ?? 9236);
const PROTECTED_REFS = new Set(["EF-CL-001", "EF-CL-002", "EF-CL-003", "EF-CL-004", "EF-CL-005", "EF-CL-006", "EF-CL-007", "EF-CL-008"]);
const tempEstimateId = `phase6_e2e_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const tempClientId = `phase6_e2e_client_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const tempClientRef = `E2E-${Date.now()}`;
const mapFallbackClientId = `${tempClientId}_map_fallback`;
const mapFallbackEstimateId = `${tempEstimateId}_map_fallback`;
const mapUnresolvedClientId = `${tempClientId}_map_unresolved`;
const mapUnresolvedEstimateId = `${tempEstimateId}_map_unresolved`;

const ownedProcesses = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${url} failed: ${response.status} ${text}`);
  }
  return body;
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnOwned(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: resolve("."),
    stdio: "ignore",
    shell: false,
    ...options,
  });
  ownedProcesses.push(child);
  return child;
}

async function ensureServices() {
  if (!(await isReachable(`${API_URL}/api/clients`))) {
    spawnOwned(process.execPath, ["server/index.js"]);
  }

  if (!(await isReachable(APP_URL))) {
    spawnOwned(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", APP_ENDPOINT.hostname, "--port", APP_ENDPOINT.port || "4173"]);
  }

  await waitForAsync(async () => isReachable(`${API_URL}/api/clients`), "API did not become reachable");
  await waitForAsync(async () => isReachable(APP_URL), "App did not become reachable");
}

async function waitForAsync(predicate, message, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await delay(250);
  }
  throw new Error(message);
}

async function waitForValue(producer, message, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await producer();
    if (value) return value;
    await delay(250);
  }
  throw new Error(message);
}

function chromeCandidates() {
  if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];
  if (platform() !== "win32") return ["google-chrome", "chromium", "chromium-browser"];
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
    "chrome.exe",
  ];
}

async function launchChrome() {
  const userDataDir = await createPhase6ProfileDirectory();
  console.log(`Phase 6 Chrome profile: ${userDataDir}`);

  let lastError = null;
  for (const chrome of chromeCandidates()) {
    try {
      const child = spawn(chrome, [
        "--headless=new",
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--disable-extensions",
        "about:blank",
      ], { stdio: "ignore" });
      ownedProcesses.push(child);
      await waitForAsync(async () => isReachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Chrome did not expose CDP", 10000);
      return { userDataDir, child };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Chrome executable was not found");
}

function httpJson(url) {
  return new Promise((resolvePromise, reject) => {
    request(url, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        try {
          resolvePromise(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject).end();
  });
}

async function createCdpPage(url) {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" }).catch(() => null);
  const targets = await httpJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const page = targets.find((target) => target.type === "page" && target.url === url) ?? targets.find((target) => target.type === "page") ?? targets[0];
  assert(page?.webSocketDebuggerUrl, "No Chrome page target available");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    ws.addEventListener("open", resolvePromise, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const diagnostics = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") {
      diagnostics.push(`exception: ${message.params?.exceptionDetails?.text ?? "unknown"}`);
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const args = message.params?.args?.map((arg) => arg.value ?? arg.description ?? "").join(" ");
      diagnostics.push(`console.${message.params?.type ?? "log"}: ${args}`);
    }
    if (message.method === "Network.responseReceived" && Number(message.params?.response?.status) >= 400) diagnostics.push(`network.${message.params.response.status}: ${message.params.response.url}`);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveMessage, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveMessage(message.result);
  });

  function send(method, params = {}) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveMessage, reject) => pending.set(id, { resolve: resolveMessage, reject }));
  }

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails;
      const thrown =
        detail.exception?.description ??
        detail.exception?.value ??
        detail.text ??
        "Browser evaluation failed";
      throw new Error(String(thrown));
    }
    return result.result?.value;
  }

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");

  return { send, evaluate, diagnostics, close: () => ws.close() };
}

function pageScript(fn, ...args) {
  return `(${fn.toString()})(...${JSON.stringify(args)})`;
}

async function waitForPage(page, fn, args = [], message, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await page.evaluate(pageScript(fn, ...args)).catch(() => false);
    if (result) return result;
    await delay(250);
  }
  const snapshot = await page.evaluate(`({
    url: location.href,
    title: document.title,
    root: document.getElementById("root")?.innerHTML?.slice(0, 200) ?? "",
    text: document.body?.innerText?.slice(0, 2000) ?? "",
    resources: performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => name.includes("/src/")).slice(-10)
  })`).catch(() => null);
  const diag = page.diagnostics?.length ? `; diagnostics=${JSON.stringify(page.diagnostics.slice(-10))}` : "";
  throw new Error(`${message}${snapshot ? `; page=${JSON.stringify(snapshot)}` : ""}${diag}`);
}

async function createTemporaryEstimate(clientId) {
  return fetchJson(`${API_URL}/api/estimates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: tempEstimateId,
      client_id: clientId,
      status: "Draft",
      estimated_order_month: "July",
      estimated_order_year: 2026,
      defaults_json: {},
      positions_json: [],
      order_meta_json: {
        timeline: [{ stage: "phase6_e2e_output_gate", completed: true }],
      },
      outcome: "Open",
      project_address: "Phase 6 E2E Temporary Estimate",
      postcode: "KY4 9FA",
      project_address_json: {},
      createdByUserId: "phase6-e2e",
      createdByName: "Phase 6 E2E",
      createdByRole: "admin",
    }),
  });
}

async function createTemporaryClient() {
  await fetchJson(`${API_URL}/api/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tempClientId, name: "QuoteSuite Phase 6 Disposable Client", client_ref: tempClientRef, client_type: "Development", contact_name: "E2E only", project_name: "Disposable Project Costing acceptance" }) });
  return (await fetchJson(`${API_URL}/api/clients`)).find((row) => row.id === tempClientId);
}

async function createProjectMapFixtures() {
  await fetchJson(`${API_URL}/api/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mapFallbackClientId, name: "QuoteSuite Project Map Client Fallback", client_ref: `${tempClientRef}-MAP-FALLBACK`, client_type: "Development", project_name: "Disposable fallback map project", project_address: "BA2 8AP", project_address_json: { postcode: "BA2 8AP" } }) });
  const fallbackEstimate = await fetchJson(`${API_URL}/api/estimates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mapFallbackEstimateId, client_id: mapFallbackClientId, status: "Draft", positions_json: [], defaults_json: {}, outcome: "Order", order_meta_json: { installerId: "phase6-map-installer" }, project_address: "" }) });
  await fetchJson(`${API_URL}/api/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mapUnresolvedClientId, name: "QuoteSuite Project Map Unresolved", client_ref: `${tempClientRef}-MAP-UNRESOLVED`, client_type: "Development", project_name: "Disposable unresolved map project" }) });
  await fetchJson(`${API_URL}/api/estimates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mapUnresolvedEstimateId, client_id: mapUnresolvedClientId, estimate_ref: `MAP-UNRESOLVED-${Date.now()}`, status: "Draft", positions_json: [], defaults_json: {}, outcome: "Open", project_address: "" }) });
  return { fallbackEstimate };
}

async function verifyUnsupportedB92FailsSafely() {
  const tempDir = resolve(".tmp-phase6-e2e-compiler");
  const entry = resolve(tempDir, "unsupported-check.ts");
  const bundle = resolve(tempDir, "unsupported-check.mjs");
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(tempDir, { recursive: true });
  await writeFile(entry, `
    import { createB92DefaultConfiguratorState } from "../src/features/b92Configurator/b92ConfiguratorState";
    import { compileB92ConfiguratorStateToConfiguredPositionContract } from "../src/features/b92Configurator/b92ConfiguredPositionCompiler";

    const state = createB92DefaultConfiguratorState();
    const unsupported = {
      ...state,
      structure: {
        ...state.structure,
        fields: state.structure.fields.map((field) => ({ ...field, operation: "fixed-sash" })),
      },
    };
    const compiled = compileB92ConfiguratorStateToConfiguredPositionContract(unsupported, {
      clientId: "phase6",
      estimateId: "phase6",
      positionId: "phase6",
      positionRef: "W-999",
    });
    if (compiled.ok !== false || compiled.errors.length === 0) {
      throw new Error("Unsupported B92 combination did not fail safely");
    }
  `);

  const esbuild = await import("esbuild");
  await esbuild.build({
    entryPoints: [entry],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  await import(`${pathToFileURL(bundle).href}?t=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
}

async function cleanupTemporaryEstimate() {
  try {
    await fetch(`${API_URL}/api/estimates/${encodeURIComponent(tempEstimateId)}/purge`, { method: "DELETE" });
  } catch {
    // Best-effort cleanup; the main failure will still be reported.
  }
}

async function cleanupTemporaryClient() {
  for (const estimateId of [mapFallbackEstimateId, mapUnresolvedEstimateId]) {
    try { await fetch(`${API_URL}/api/estimates/${encodeURIComponent(estimateId)}/purge`, { method: "DELETE" }); } catch { /* Best-effort test-owned cleanup. */ }
  }
  for (const clientId of [mapFallbackClientId, mapUnresolvedClientId]) {
    try { await fetch(`${API_URL}/api/clients/${encodeURIComponent(clientId)}/purge`, { method: "DELETE" }); } catch { /* Best-effort test-owned cleanup. */ }
  }
  try { await fetch(`${API_URL}/api/clients/${encodeURIComponent(tempClientId)}/purge`, { method: "DELETE" }); } catch { /* Best-effort test-owned cleanup. */ }
}

async function cleanupStalePhase6Estimates(clientId) {
  try {
    const rows = await fetchJson(`${API_URL}/api/estimates?client_id=${encodeURIComponent(clientId)}&include_deleted=true`);
    const staleRows = rows.filter((row) => String(row.id || "").startsWith("phase6_e2e_"));
    for (const row of staleRows) {
      await fetch(`${API_URL}/api/estimates/${encodeURIComponent(row.id)}/purge`, { method: "DELETE" });
    }
  } catch {
    // Best-effort cleanup only for test-owned rows.
  }
}

async function run() {
  await ensureServices();

  const clients = await fetchJson(`${API_URL}/api/clients`);
  const protectedBefore = clients.filter((client) => PROTECTED_REFS.has(client.client_ref ?? client.clientRef)).sort((a,b)=>String(a.client_ref??a.clientRef).localeCompare(String(b.client_ref??b.clientRef)));
  assert(protectedBefore.length === 8, "Protected EF client refs were not intact before E2E");
  const protectedSnapshot = JSON.stringify(protectedBefore);
  const client = await createTemporaryClient();
  assert(client?.id === tempClientId, "Disposable E2E client could not be created");

  await cleanupStalePhase6Estimates(client.id);
  const tempEstimate = await createTemporaryEstimate(client.id);
  const mapFixtures = process.env.QS_E2E_PROJECT_MAP_ONLY === "1" ? await createProjectMapFixtures() : null;

  let chrome = null;
  let page = null;

  try {
    chrome = await launchChrome();
    page = await createCdpPage(APP_URL);
    await waitForPage(page, () => document.body.innerText.includes("Client Database"), [], "App shell did not render", 90000);
    await page.evaluate(pageScript(() => {
      localStorage.clear();
    }));
    await waitForPage(page, () => {
      const item = Array.from(document.querySelectorAll(".app-sidebar-item")).find((element) => element.textContent?.trim() === "Project Map");
      if (!item) return false;
      item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    }, [], "Project Map navigation entry was unavailable");
    await waitForPage(page, (estimateRef) => Array.from(document.querySelectorAll("h2")).some(element => element.textContent?.trim() === "Project Map") && document.body.innerText.includes(estimateRef), [tempEstimate.estimate_ref], "Unified Project Map did not show the disposable project");
    if (process.env.QS_E2E_PROJECT_MAP_ONLY === "1") {
      await waitForPage(page, () => document.body.innerText.includes("QuoteSuite Project Map Client Fallback") && document.body.innerText.includes("QuoteSuite Project Map Unresolved") && document.body.innerText.includes("Client address fallback: BA2 8AP") && document.body.innerText.includes("Location unavailable") && document.body.innerText.includes("Installation"), [], "Project Map fallback/unresolved fixtures were not represented");
      await waitForPage(page, (estimateRef) => Array.from(document.querySelectorAll('[id^="estimate-map-row-"]')).some((row) => row.textContent?.includes(estimateRef) && row.textContent?.includes("Client address fallback: BA2 8AP") && !row.textContent?.includes("Location unavailable")), [mapFixtures.fallbackEstimate.estimate_ref], "Runtime Project Map Estimate did not resolve through its disposable Client address fallback");
    }
    await waitForPage(page, () => Boolean(window.google?.maps) && Boolean(document.querySelector(".google-map-panel__canvas")) && !document.body.innerText.includes("No project locations could be resolved for the current filters."), [], "Unified Project Map did not render the resolved disposable location", 30000);
    const projectMap = await page.evaluate(`({text:document.body.innerText,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,oldEstimateNav:Array.from(document.querySelectorAll('.app-sidebar-item')).some(item=>item.textContent?.trim()==='Estimate Map'),oldInstallationMap:Boolean(Array.from(document.querySelectorAll('.operational-title')).find(item=>item.textContent?.trim()==='Installation Map'))})`);
    const projectMapText = projectMap.text.toLowerCase();
    assert(projectMapText.includes("mapped projects") && projectMapText.includes("unresolved locations"), "Unified Project Map counters were missing");
    assert(!projectMap.oldEstimateNav && !projectMap.oldInstallationMap, "A legacy map remained user-facing");
    assert(!projectMap.overflow, "Unified Project Map caused document-level overflow");
    await page.evaluate(pageScript(() => document.querySelector('.theme-selector')?.click()));
    await waitForPage(page, () => document.documentElement.dataset.qsTheme === "dark", [], "Project Map dark mode did not apply");
    await page.evaluate(pageScript(() => document.querySelector('.theme-selector')?.click()));
    await page.evaluate(pageScript(() => document.querySelector('.theme-selector')?.click()));
    await waitForPage(page, () => document.documentElement.dataset.qsTheme === "light", [], "Project Map light mode did not apply");
    if (process.env.QS_E2E_PROJECT_MAP_ONLY === "1") {
      assert(!page.diagnostics.some(entry => entry.startsWith("exception:") || entry.startsWith("network.4") || entry.startsWith("network.5")), `Project Map emitted browser diagnostics: ${page.diagnostics.join(" | ")}`);
      const protectedAfterMap = (await fetchJson(`${API_URL}/api/clients`)).filter((row) => PROTECTED_REFS.has(row.client_ref ?? row.clientRef)).sort((a,b)=>String(a.client_ref??a.clientRef).localeCompare(String(b.client_ref??b.clientRef)));
      assert(JSON.stringify(protectedAfterMap) === protectedSnapshot, "Protected EF client data changed during Project Map E2E");
      console.log("Phase 6 Project Map E2E passed");
      return;
    }
    await page.evaluate(pageScript(() => {
      const item = Array.from(document.querySelectorAll(".app-sidebar-item")).find((element) => element.textContent?.trim() === "Client Database");
      item?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }));

    await waitForPage(page, (clientRef) => {
      const row = Array.from(document.querySelectorAll('[data-testid="client-database-row"]')).find((element) => element.dataset.clientRef === clientRef);
      if (!row) return false;
      row.querySelector("button")?.click();
      return true;
    }, [client.client_ref ?? client.clientRef], "Disposable client row was not available");

    await waitForPage(page, () => document.body.innerText.includes("Estimate Selection"), [], "Client estimate picker did not open");
    await page.evaluate(pageScript(() => {
      const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Client Estimates");
      button?.click();
    }));
    await page.evaluate(pageScript(() => {
      Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.trim() === "All Estimates")?.click();
    }));

    await waitForPage(page, (estimateRef) => {
      const row = Array.from(document.querySelectorAll('[data-testid="estimate-summary"]')).find((element) => element.dataset.estimateRef === estimateRef);
      if (!row) return false;
      row.click();
      return true;
    }, [tempEstimate.estimate_ref], "Temporary estimate did not appear in the browser");

    await waitForPage(page, () => !!document.querySelector('[data-testid="position-quick-add-type"]'), [], "Position quick-add controls did not render");
    await page.evaluate(pageScript(() => {
      const select = document.querySelector('[data-testid="position-quick-add-type"]');
      select.value = "B92 Approved Fixed";
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }));
    await page.evaluate(pageScript(() => {
      document.querySelector('[data-testid="position-quick-add-submit"]')?.click();
    }));

    const persisted = await waitForValue(async () => {
      const rows = await fetchJson(`${API_URL}/api/estimates?client_id=${encodeURIComponent(client.id)}`);
      const current = rows.find((row) => row.id === tempEstimateId);
      return current?.positions_json?.[0]?.configuredContract ? current : null;
    }, "B92 configured contract was not persisted");

    const position = persisted.positions_json[0];
    assert(position.configuredContract?.schemaVersion === 1, "Saved position does not contain schemaVersion 1 contract");
    assert(position.configuredContract?.product?.systemCode === "B92", "Saved contract is not B92");
    assert(position.widthMm === 1000 && position.heightMm === 1000 && position.qty === 1, "Legacy projection fields were not populated");

    await page.send("Page.reload", { ignoreCache: true });
    await waitForPage(page, () => document.body.innerText.includes("Client Database"), [], "App shell did not render after reload");
    await waitForPage(page, (clientRef) => {
      const item = Array.from(document.querySelectorAll(".app-sidebar-item")).find((element) => element.textContent?.trim() === "Client Database");
      item?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      const row = Array.from(document.querySelectorAll('[data-testid="client-database-row"]')).find((element) => element.dataset.clientRef === clientRef);
      if (!row) return false;
      row.querySelector("button")?.click();
      return true;
    }, [client.client_ref ?? client.clientRef], "Disposable client row was not available after reload");
    await waitForPage(page, () => document.body.innerText.includes("Estimate Selection"), [], "Client estimate picker did not reopen");
    await page.evaluate(pageScript(() => {
      Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Client Estimates")?.click();
    }));
    await page.evaluate(pageScript(() => {
      Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.trim() === "All Estimates")?.click();
    }));
    await waitForPage(page, (estimateRef) => {
      const row = Array.from(document.querySelectorAll('[data-testid="estimate-summary"]')).find((element) => element.dataset.estimateRef === estimateRef);
      if (!row) return false;
      row.click();
      return true;
    }, [tempEstimate.estimate_ref], "Temporary estimate did not reappear after reload");

    await waitForPage(page, () => {
      const text = document.body.innerText;
      return text.includes("B92 1x1") && text.includes("1000 x 1000 mm") && text.includes("TOTAL QUANTITY\n1") && text.includes("TOTAL M²\n1.00");
    }, [], "Reloaded browser view did not show contract-backed description/totals");

    await page.evaluate(pageScript(() => {
      window.__phase6LastDocumentHtml = "";
      window.open = () => ({
        document: {
          open() {},
          write(html) {
            window.__phase6LastDocumentHtml += html;
          },
          close() {},
        },
        focus() {},
        print() {},
      });
    }));

    await waitForPage(page, () => {
      const button = document.querySelector('[data-testid="estimate-print-pdf"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    }, [], "Print PDF action was not available");
    await waitForPage(page, () => String(window.__phase6LastDocumentHtml || "").includes("B92"), [], "Document output did not use contract-first B92 description");

    await fetchJson(`${API_URL}/api/estimates/${encodeURIComponent(tempEstimateId)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({client_id:client.id,estimate_ref:tempEstimate.estimate_ref,positions_json:[]}) });
    const runtimeScenario = await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({estimateId:tempEstimate.id,origin:"manual",name:`${tempEstimate.estimate_ref} Project Costing`,currency:"GBP",packageCode:"supply_only"}) });
    await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(runtimeScenario.id)}/manual-costs`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({category:"extras",label:"Phase 6 runtime extra",amount:"125.00"}) });
    await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(runtimeScenario.id)}/manual-costs`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({category:"delivery",label:"Phase 6 runtime supplier transport",amount:"2200.00"}) });

    await page.evaluate(pageScript(() => {
      Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Open")?.click();
    }));
    await waitForPage(page, () => document.querySelector('[data-testid="estimate-commercial-workspace"]') && document.body.innerText.includes("Products / Supply Only"), [], "Consolidated Project Costing did not open");
    const emptyWorkspace = await page.evaluate(`({text:document.body.innerText,addCount:Array.from(document.querySelectorAll("button")).filter(button=>button.textContent?.trim()==="Add Position").length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})`);
    assert(emptyWorkspace.text.includes("No positions yet."), "Empty Products state was not shown");
    assert(emptyWorkspace.text.includes("Import Manufacturer Quote"), "Manufacturer import action was not shown");
    assert(emptyWorkspace.addCount === 1, "Project Costing did not expose exactly one Add Position action");
    for (const forbidden of ["Supplier Quotations & Project Costing (Preview)","Temporary development entry","Estimate Positions","Review and import supplier documents","Add Position Disabled"]) assert(!emptyWorkspace.text.includes(forbidden), `Normal Project Costing exposed ${forbidden}`);
    assert(!emptyWorkspace.overflow, "Project Costing caused document-level horizontal overflow");

    await waitForPage(page,()=>{const dialog=document.querySelector('[role="dialog"][aria-labelledby="manufacturer-import-title"]');if(dialog)return true;const button=Array.from(document.querySelectorAll("button")).find(item=>item.textContent?.trim()==="Import Manufacturer Quote");button?.click();return false},[],"Estimate-owned supplier import entry point did not open");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find(button=>button.textContent?.trim()==="Close")?.click()));
    await waitForPage(page,()=>!document.querySelector('[role="dialog"][aria-labelledby="manufacturer-import-title"]'),[],"Supplier import dialog did not close");

    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Add Position")?.click()));
    await waitForPage(page, () => document.body.innerText.includes("Save Configuration") && document.body.innerText.includes("B92 Configurator"), [], "Products Add Position did not open B92");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Cancel")?.click()));
    await waitForPage(page, () => document.body.innerText.includes("No positions yet.") && !document.body.innerText.includes("Save Configuration"), [], "Add Position cancel did not return to empty Project Costing");
    const afterCancel = await fetchJson(`${API_URL}/api/estimates/${encodeURIComponent(tempEstimateId)}/position-bridge`);
    assert(afterCancel.positions.length === 0, "Add Position cancel created a canonical position");

    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Add Position")?.click()));
    await waitForPage(page, () => document.body.innerText.includes("Save Configuration"), [], "B92 did not reopen from Products");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Save Configuration")?.click()));
    await waitForPage(page, () => document.body.innerText.includes("Edit Configuration") && !document.body.innerText.includes("Save Configuration"), [], "Saved B92 position did not return to Products");
    const bridgeAfterSave = await fetchJson(`${API_URL}/api/estimates/${encodeURIComponent(tempEstimateId)}/position-bridge`);
    assert(bridgeAfterSave.positions.length === 1 && bridgeAfterSave.positions[0].configuredContract, "Products B92 save did not create exactly one configured canonical position");
    const stablePositionId = bridgeAfterSave.positions[0].id;

    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Edit Configuration")?.click()));
    await waitForPage(page, () => document.body.innerText.includes("Save Configuration"), [], "Edit Configuration did not hydrate B92");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Cancel")?.click()));
    const bridgeAfterEditCancel = await fetchJson(`${API_URL}/api/estimates/${encodeURIComponent(tempEstimateId)}/position-bridge`);
    assert(bridgeAfterEditCancel.positions.length === 1 && bridgeAfterEditCancel.positions[0].id === stablePositionId, "Edit cancel changed canonical position identity");

    const acceptanceScenario = await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(runtimeScenario.id)}`);
    assert(acceptanceScenario?.id === runtimeScenario.id && acceptanceScenario.estimateId === tempEstimate.id, "Disposable Project Costing scenario was not retained by its runtime Estimate");
    await waitForPage(page,()=>document.querySelectorAll('[aria-label$="markup percentage"]').length>0,[],"Project Costing markups did not render after B92 save");
    const beforeFixed = await page.evaluate(`({calculated:document.querySelector('.costing-sheet__summary-sale b')?.textContent,markups:Array.from(document.querySelectorAll('[aria-label$="markup percentage"]')).map(input=>({label:input.getAttribute('aria-label'),value:input.value})),transportCount:Array.from(document.querySelectorAll('.costing-sheet__section-label b')).filter(node=>node.textContent.trim()==='3. Transport').length})`);
    assert(beforeFixed.transportCount <= 1, `Transport rendered ${beforeFixed.transportCount} times`);

    await waitForPage(page,()=>{if(document.querySelector('[aria-label="Use Fixed Selling Price"]'))return true;Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Fix Price")?.click();return false},[],"Fix Price modal did not open");
    await page.evaluate(pageScript(() => document.querySelector('[aria-label="Use Fixed Selling Price"]')?.click()));
    await waitForPage(page,()=>{const input=document.querySelector('[aria-label="Fixed Selling Price GBP Ex VAT"]');return input&&!input.disabled&&!input.closest('label')?.hidden},[],"Fixed Selling Price input did not open");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Fixed Selling Price GBP Ex VAT"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;setter?.call(input,"24000");input?.dispatchEvent(new Event("input",{bubbles:true}));}));
    await waitForPage(page,()=>document.body.innerText.includes("Actual Selling Price (Ex VAT)")&&document.body.innerText.includes("£24,000.00"),[],"Fixed Selling Price did not recalculate the live worksheet");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Apply Fixed Price")?.click()));
    await waitForPage(page,()=>document.body.innerText.includes("£24,000.00"),[],"Saved Fixed Selling Price was not retained");
    const enabledMetrics = await page.evaluate(`({text:document.body.innerText,markups:Array.from(document.querySelectorAll('[aria-label$="markup percentage"]')).map(input=>({label:input.getAttribute('aria-label'),value:input.value})),fixed:document.querySelector('.costing-sheet__summary-sale b')?.textContent,status:document.querySelector('.costing-sheet__summary-sale')?.innerText})`);
    assert(JSON.stringify(enabledMetrics.markups) === JSON.stringify(beforeFixed.markups), `Fixed price changed category markups: before=${JSON.stringify(beforeFixed.markups)} after=${JSON.stringify(enabledMetrics.markups)}`);
    assert(enabledMetrics.fixed === "£24,000.00" && enabledMetrics.status.includes("Fixed"), "Fixed price summary did not retain £24,000");
    await page.send("Page.reload", { ignoreCache: true });
    await waitForPage(page,()=>document.body.innerText.includes("Client Database"),[],"App shell did not reload");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll(".app-sidebar-item")).find(element=>element.textContent?.trim()==="Client Database")?.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}))));
    await waitForPage(page,(clientRef)=>{const row=Array.from(document.querySelectorAll('[data-testid="client-database-row"]')).find(element=>element.dataset.clientRef===clientRef);if(!row)return false;row.querySelector("button")?.click();return true},[client.client_ref??client.clientRef],"Disposable client did not reopen after fixed-price reload");
    await waitForPage(page,()=>document.body.innerText.includes("Estimate Selection"),[],"Estimate picker did not reopen after fixed-price reload");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(element=>element.textContent?.trim()==="Client Estimates")?.click()));
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(element=>element.textContent?.trim()==="All Estimates")?.click()));
    await waitForPage(page,(estimateRef)=>{const row=Array.from(document.querySelectorAll('[data-testid="estimate-summary"]')).find(element=>element.dataset.estimateRef===estimateRef);if(!row)return false;row.click();return true},[tempEstimate.estimate_ref],"Disposable estimate did not reopen after fixed-price reload");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(element=>element.textContent?.trim()==="Open")?.click()));
    await waitForPage(page,()=>document.body.innerText.includes("Products / Supply Only"),[],"Project Costing did not reopen after fixed-price reload");
    await waitForPage(page,()=>document.querySelector('.costing-sheet__summary-sale b')?.textContent==="£24,000.00"&&document.querySelector('.costing-sheet__summary-sale')?.innerText.includes("Fixed"),[],"Fixed price did not survive reload");
    const reloadedMarkups=await page.evaluate(`Array.from(document.querySelectorAll('[aria-label$="markup percentage"]')).map(input=>({label:input.getAttribute('aria-label'),value:input.value}))`);
    assert(JSON.stringify(reloadedMarkups)===JSON.stringify(beforeFixed.markups),"Reload changed category markups");
    await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(acceptanceScenario.id)}/revisions`,{method:"POST"});
    const revisionScenario=await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(acceptanceScenario.id)}`);
    assert(revisionScenario.customerPricing.fixedSellingPrice.enabled&&revisionScenario.customerPricing.fixedSellingPrice.amount==="24000","Revision did not retain fixed price");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Edit Fixed Price")?.click()));
    await waitForPage(page,()=>Boolean(document.querySelector('[aria-label="Use Fixed Selling Price"]')),[],"Edit Fixed Price modal did not open");
    await page.evaluate(pageScript(() => document.querySelector('[aria-label="Use Fixed Selling Price"]')?.click()));
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll("button")).find(button=>button.textContent?.trim()==="Apply Fixed Price")?.click()));
    await waitForPage(page,()=>!document.querySelector('.costing-sheet__summary-sale')?.innerText.includes("Fixed")&&Boolean(Array.from(document.querySelectorAll('.costing-sheet__summary-sale button')).find(button=>button.textContent?.trim()==="Fix Price")),[],"Disabling fixed price did not restore calculated pricing");
    await delay(500);
    const disabledScenario=await fetchJson(`${API_URL}/api/admin/project-calculator-lab/scenarios/${encodeURIComponent(acceptanceScenario.id)}`);
    assert(!disabledScenario.customerPricing.fixedSellingPrice.enabled,"Disabled fixed price did not persist");
    await waitForPage(page,()=>document.body.innerText.includes("Products / Supply Only")&&document.body.innerText.includes("W-001"),[],"Runtime-owned populated Project Costing workspace was not retained");
    const productHeaders=await page.evaluate(`Array.from(document.querySelectorAll('.costing-sheet__detail-table thead th')).map(element=>element.textContent.trim())`);
    assert(!productHeaders.includes("Include"),"Products incorrectly exposed an Include column");
    assert(productHeaders.includes("Alternative?"),"Products did not retain Alternative");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll(".costing-sheet__section-label")).find(button=>button.textContent?.includes("2. Extras"))?.click()));
    await waitForPage(page,()=>document.querySelector('.costing-sheet__extras-head')?.textContent?.includes("Include"),[],"Extras Include column did not render");
    const extraWasIncluded=await page.evaluate(`document.querySelector('.costing-sheet__extras-table .toggle__input')?.checked`);
    await page.evaluate(pageScript(() => document.querySelector('.costing-sheet__extras-table .toggle__input')?.click()));
    await waitForPage(page,(expected)=>document.querySelector('.costing-sheet__extras-table .toggle__input')?.checked===expected,[!extraWasIncluded],"Extra inclusion did not update");
    await page.evaluate(pageScript(() => document.querySelector('.costing-sheet__extras-table .toggle__input')?.click()));
    await waitForPage(page,(expected)=>document.querySelector('.costing-sheet__extras-table .toggle__input')?.checked===expected,[extraWasIncluded],"Extra inclusion did not restore");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll(".costing-sheet__section-label")).find(button=>button.textContent?.includes("3. Transport"))?.click()));
    const transportUi=await page.evaluate(`({text:document.querySelector('.costing-sheet__transport-table')?.innerText,fixVisible:Boolean(Array.from(document.querySelectorAll('.costing-sheet__summary-sale button')).find(button=>/Fix Price|Edit Fixed Price/.test(button.textContent||""))),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})`);
    assert(transportUi.text.includes("Description")&&transportUi.text.includes("Supplier / Cost")&&transportUi.text.includes("Allocate to Products")&&transportUi.text.includes("Selling Price"),"Transport commercial table was not visible");
    assert(transportUi.text.includes("Storage Costs")&&transportUi.text.includes("HIAB Delivery / Offload Fee"),"Separate Transport costs were not visible");
    assert(transportUi.fixVisible,"Fix Price was not visible inside the live Selling Price row");
    assert(!transportUi.overflow,"Corrected Project Costing caused document-level overflow");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Include Storage Costs"]');if(input&&!input.checked)input.click()}));
    await waitForPage(page,()=>Boolean(document.querySelector('[aria-label="Storage Costs GBP"]')),[],"Storage cost input did not render");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Allocate Storage into Products Supply Only"]');if(input?.checked)input.click()}));
    await waitForPage(page,()=>!document.querySelector('[aria-label="Storage Amount to Allocate GBP"]'),[],"Storage allocation did not reset for deterministic acceptance");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Storage Costs GBP"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;input?.focus();setter?.call(input,"100");input?.dispatchEvent(new Event("input",{bubbles:true}));input?.dispatchEvent(new FocusEvent("focusout",{bubbles:true,relatedTarget:document.body}));}));
    await waitForPage(page,()=>Array.from(document.querySelectorAll('.costing-sheet__transport-item')).some(row=>row.textContent?.includes("Storage Costs")&&row.textContent?.includes("£100.00 remains")),[],"Storage cost did not save before allocation");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Allocate Storage into Products Supply Only"]');if(input&&!input.checked)input.click()}));
    await waitForPage(page,()=>Boolean(document.querySelector('[aria-label="Storage Amount to Allocate GBP"]')),[],"Storage allocation input did not render on its row");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Storage Amount to Allocate GBP"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;input?.focus();setter?.call(input,"50");input?.dispatchEvent(new Event("input",{bubbles:true}));input?.dispatchEvent(new FocusEvent("focusout",{bubbles:true,relatedTarget:document.body}));}));
    await waitForPage(page,()=>Array.from(document.querySelectorAll('.costing-sheet__transport-item')).some(row=>row.textContent?.includes("Storage Costs")&&row.textContent?.includes("£50.00 remains")),[],"Storage remainder did not update");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Include HIAB Delivery Offload Fee"]');if(input&&!input.checked)input.click()}));
    await waitForPage(page,()=>Boolean(document.querySelector('[aria-label="HIAB Delivery Offload Fee GBP"]')),[],"HIAB cost input did not render");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Allocate HIAB into Products Supply Only"]');if(input?.checked)input.click()}));
    await waitForPage(page,()=>!document.querySelector('[aria-label="HIAB Amount to Allocate GBP"]'),[],"HIAB allocation did not reset for deterministic acceptance");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="HIAB Delivery Offload Fee GBP"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;input?.focus();setter?.call(input,"250");input?.dispatchEvent(new Event("input",{bubbles:true}));input?.dispatchEvent(new FocusEvent("focusout",{bubbles:true,relatedTarget:document.body}));}));
    await waitForPage(page,()=>Array.from(document.querySelectorAll('.costing-sheet__transport-item')).some(row=>row.textContent?.includes("HIAB Delivery")&&row.textContent?.includes("£250.00 remains")),[],"HIAB cost did not save before allocation");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="Allocate HIAB into Products Supply Only"]');if(input&&!input.checked)input.click()}));
    await waitForPage(page,()=>Boolean(document.querySelector('[aria-label="HIAB Amount to Allocate GBP"]')),[],"HIAB allocation input did not render on its row");
    await page.evaluate(pageScript(() => {const input=document.querySelector('[aria-label="HIAB Amount to Allocate GBP"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;input?.focus();setter?.call(input,"100");input?.dispatchEvent(new Event("input",{bubbles:true}));input?.dispatchEvent(new FocusEvent("focusout",{bubbles:true,relatedTarget:document.body}));}));
    await waitForPage(page,()=>Array.from(document.querySelectorAll('.costing-sheet__transport-item')).some(row=>row.textContent?.includes("HIAB Delivery")&&row.textContent?.includes("£150.00 remains")),[],"HIAB remainder did not update");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll(".costing-sheet__section-label")).find(button=>button.textContent?.includes("4. Site Visit / Travel"))?.click()));
    await waitForPage(page,()=>{const details=document.querySelector('details.site-visit-panel');if(!details)return false;if(!details.open)details.querySelector('summary')?.click();return Boolean(details.querySelector('.site-visit-panel__body'))&&details.textContent?.includes("Project/site postcode")&&details.textContent?.includes("Refresh Route")},[],"Site Visit / Travel worksheet did not open");
    await waitForPage(page,()=>{if(document.querySelector('[role="dialog"][aria-labelledby="fix-price-title"]'))return true;Array.from(document.querySelectorAll('.costing-sheet__summary-sale button')).find(button=>/Fix Price|Edit Fixed Price/.test(button.textContent||""))?.click();return false},[],"Live Selling Price Fix Price click did not open the modal");
    await page.evaluate(pageScript(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find(button=>button.textContent?.trim()==="Cancel")?.click()));
    await waitForPage(page,()=>!document.querySelector('[role="dialog"][aria-labelledby="fix-price-title"]'),[],"Fix Price Cancel did not close the modal");
    await page.evaluate(pageScript(() => document.querySelector('.theme-selector')?.click()));
    await waitForPage(page,()=>document.documentElement.dataset.qsTheme==="dark",[],"Dark mode did not apply",5000);
    const darkWorkspace = await page.evaluate(`({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,summary:document.body.innerText.includes("Commercial Summary")})`);
    assert(!darkWorkspace.overflow && darkWorkspace.summary, "Dark Project Costing acceptance failed");
    await page.evaluate(pageScript(() => document.querySelector('.theme-selector')?.click()));
    await page.evaluate(pageScript(() => document.querySelector('.theme-selector')?.click()));
    await waitForPage(page,()=>document.documentElement.dataset.qsTheme==="light",[],"Light mode did not apply",5000);
    await verifyUnsupportedB92FailsSafely();
    assert(!page.diagnostics.some(entry=>entry.startsWith("exception:")||entry.startsWith("network.4")||entry.startsWith("network.5")),`Project Costing emitted browser diagnostics: ${page.diagnostics.join(" | ")}`);
    const protectedAfterFixed = (await fetchJson(`${API_URL}/api/clients`)).filter((row) => PROTECTED_REFS.has(row.client_ref ?? row.clientRef)).sort((a,b)=>String(a.client_ref??a.clientRef).localeCompare(String(b.client_ref??b.clientRef)));
    assert(JSON.stringify(protectedAfterFixed) === protectedSnapshot, "Protected EF client data changed during fixed-price E2E");
    console.log("Phase 6 E2E passed");
  } finally {
    if (page) {
      await page.send("Browser.close").catch(() => {});
      page.close();
    }
    await cleanupTemporaryEstimate();
    await cleanupStalePhase6Estimates(client.id);
    await cleanupTemporaryClient();
    if (chrome) {
      const termination = await terminateOwnedChrome(chrome.child);
      await delay(300);
      const cleanup = await cleanupPhase6Profile(chrome.userDataDir);
      if (!cleanup.removed) {
        console.warn("Phase 6 Chrome profile cleanup was delayed", {
          profile: chrome.userDataDir,
          attempts: cleanup.attempts,
          code: cleanup.error?.code ?? "unknown",
          chromeExited: termination.exited,
        });
        if (!termination.exited) process.exitCode = 1;
      }
    }
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const results = await terminateOwnedProcessTrees(ownedProcesses);
    if (results.some((result) => !result.exited)) {
      console.error("Phase 6 E2E owned-process cleanup did not complete.");
      process.exitCode = 1;
    }
  });
