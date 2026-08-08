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
      project_address_json: {},
      createdByUserId: "phase6-e2e",
      createdByName: "Phase 6 E2E",
      createdByRole: "admin",
    }),
  });
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
  const protectedRefsBefore = clients.map((client) => client.client_ref ?? client.clientRef).filter((ref) => PROTECTED_REFS.has(ref)).sort();
  assert(protectedRefsBefore.length === 8, "Protected EF client refs were not intact before E2E");
  const client = clients.find((row) => PROTECTED_REFS.has(row.client_ref ?? row.clientRef));
  assert(client?.id, "No protected client found for temporary estimate");

  await cleanupStalePhase6Estimates(client.id);
  const tempEstimate = await createTemporaryEstimate(client.id);

  let chrome = null;
  let page = null;

  try {
    chrome = await launchChrome();
    page = await createCdpPage(APP_URL);
    await waitForPage(page, () => document.body.innerText.includes("Client Database"), [], "App shell did not render", 90000);
    await page.evaluate(pageScript(() => {
      localStorage.clear();
    }));
    await page.evaluate(pageScript(() => {
      const item = Array.from(document.querySelectorAll("div")).find((element) => element.textContent?.trim() === "Client Database");
      item?.click();
    }));

    await waitForPage(page, (clientRef) => {
      const row = Array.from(document.querySelectorAll('[data-testid="client-database-row"]')).find((element) => element.dataset.clientRef === clientRef);
      if (!row) return false;
      row.querySelector("button")?.click();
      return true;
    }, [client.client_ref ?? client.clientRef], "Protected client row was not available");

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
    await page.evaluate(pageScript(() => {
      const item = Array.from(document.querySelectorAll("div")).find((element) => element.textContent?.trim() === "Client Database");
      item?.click();
    }));
    await waitForPage(page, (clientRef) => {
      const row = Array.from(document.querySelectorAll('[data-testid="client-database-row"]')).find((element) => element.dataset.clientRef === clientRef);
      if (!row) return false;
      row.querySelector("button")?.click();
      return true;
    }, [client.client_ref ?? client.clientRef], "Protected client row was not available after reload");
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

    await verifyUnsupportedB92FailsSafely();

    const protectedAfter = await fetchJson(`${API_URL}/api/clients`);
    const protectedRefsAfter = protectedAfter.map((row) => row.client_ref ?? row.clientRef).filter((ref) => PROTECTED_REFS.has(ref)).sort();
    assert(JSON.stringify(protectedRefsAfter) === JSON.stringify(protectedRefsBefore), "Protected EF client refs changed during E2E");

    console.log("Phase 6 E2E passed");
  } finally {
    if (page) {
      await page.send("Browser.close").catch(() => {});
      page.close();
    }
    await cleanupTemporaryEstimate();
    await cleanupStalePhase6Estimates(client.id);
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
