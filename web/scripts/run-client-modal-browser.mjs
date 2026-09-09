import { build } from "esbuild";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { createBrowserRunController } from "./browser-run-lifecycle.mjs";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";

const root = path.resolve(".");
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
controller.installInterruptHandlers();

const freePort = async () => {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const waitFor = async (fn, message, timeoutMs = 30000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await fn().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
};

const chromePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA || ""}\\Google\\Chrome\\Application\\chrome.exe`,
].find(existsSync);

if (!chromePath) throw new Error("Chrome was not found for Client modal acceptance.");

const temp = await mkdtemp(path.join(os.tmpdir(), "qs-client-modal-browser-"));
const httpPort = await freePort();
const debugPort = await freePort();
const clientRef = "E2E-CLIENT-MODAL-001";
const captured = { creates: [], updates: [] };
let server;
let browser;
let socket;
let browserCleanup;

function json(response, payload, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

try {
  await build({
    entryPoints: [path.join(root, "src", "main.tsx")],
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    outdir: temp,
    banner: { js: "const __quoteSuiteEmptyGlob = () => ({});" },
    loader: { ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl" },
    define: {
      "import.meta.env": JSON.stringify({
        VITE_API_BASE_URL: `http://127.0.0.1:${httpPort}`,
        DEV: false,
        PROD: true,
      }),
      "import.meta.glob": "__quoteSuiteEmptyGlob",
    },
  });

  server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${httpPort}`);
    if (url.pathname === "/main.js" || url.pathname === "/main.css") {
      const fileName = url.pathname.slice(1);
      response.writeHead(200, { "Content-Type": fileName.endsWith(".css") ? "text/css" : "text/javascript" });
      response.end(await readFile(path.join(temp, fileName)));
      return;
    }
    if (url.pathname === "/api/health") {
      json(response, {
        apiAvailable: true,
        databaseAvailable: true,
        status: "connected",
        environment: "test",
        runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family,
        runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version,
        runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity,
        capabilities: [...QUOTESUITE_RUNTIME_CONTRACT.capabilities],
        databaseType: "disposable-browser-fixture",
        startedAt: new Date().toISOString(),
        uptimeSeconds: 1,
        instanceId: "client-modal-browser-fixture",
      });
      return;
    }
    if (url.pathname === "/api/clients" && request.method === "GET") {
      json(response, []);
      return;
    }
    if (url.pathname === "/api/clients" && request.method === "POST") {
      captured.creates.push(JSON.parse(await requestBody(request)));
      json(response, { client_ref: clientRef }, 201);
      return;
    }
    if (/^\/api\/clients\/[^/]+$/.test(url.pathname) && request.method === "PUT") {
      captured.updates.push(JSON.parse(await requestBody(request)));
      json(response, { ok: true });
      return;
    }
    if (url.pathname === "/api/estimates" || url.pathname === "/api/notes" || url.pathname === "/api/projects") {
      json(response, []);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      json(response, []);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/main.css"></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(httpPort, "127.0.0.1", resolve));

  const profile = await controller.createProfile({ label: "client-modal", debugPort });
  browser = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "--disable-extensions",
    "about:blank",
  ], { stdio: "ignore" });
  controller.setRun({ child: browser });
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "Owned Chrome did not start");

  await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${httpPort}`)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.includes(String(httpPort)));
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") {
      diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || "Runtime exception");
    }
    if (message.method === "Runtime.consoleAPICalled") {
      diagnostics.push((message.params?.args || []).map((item) => item.value || item.description || "").join(" "));
    }
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })).result?.value;
  const clickText = async (text, rootSelector = "body") => {
    const clicked = await evaluate(`(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const target = [...(root?.querySelectorAll('button') || [])].find((button) => button.textContent.trim() === ${JSON.stringify(text)});
      target?.click();
      return Boolean(target);
    })()`);
    if (!clicked) throw new Error(`Button not found: ${text}`);
  };
  const setInput = async (placeholder, value, inputType = "insertText") => {
    const changed = await evaluate(`(() => {
      const input = document.querySelector('.app-modal input[placeholder=${JSON.stringify(placeholder)}]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: ${JSON.stringify(inputType)}, data: ${JSON.stringify(value)} }));
      input.focus();
      return true;
    })()`);
    if (!changed) throw new Error(`Input not found: ${placeholder}`);
  };
  const modalValues = () => evaluate(`(() => ({
    open: Boolean(document.querySelector('.app-modal')),
    name: document.querySelector('.app-modal input[placeholder="Name"]')?.value || '',
    address1: document.querySelector('.app-modal input[placeholder="Address line 1"]')?.value || '',
    address2: document.querySelector('.app-modal input[placeholder="Address line 2"]')?.value || '',
    town: document.querySelector('.app-modal input[placeholder="Town"]')?.value || '',
    postcode: document.querySelector('.app-modal input[placeholder="Postcode"]')?.value || '',
    active: document.activeElement?.getAttribute('placeholder') || document.activeElement?.textContent?.trim() || ''
  }))()`);
  const nativeClickInput = async (placeholder) => {
    const point = await evaluate(`(() => {
      const rect = document.querySelector('.app-modal input[placeholder=${JSON.stringify(placeholder)}]')?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    })()`);
    if (!point) throw new Error(`Click target not found: ${placeholder}`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  };
  const pressTab = async () => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  };
  const assertState = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const openSavedClientForEdit = async () => {
    await waitFor(() => evaluate(`Boolean(document.querySelector('[data-client-ref="${clientRef}"]'))`), "Saved disposable client was not listed");
    await evaluate(`document.querySelector('[data-client-ref="${clientRef}"] button')?.click()`);
    await waitFor(() => evaluate(`document.body.innerText.includes(${JSON.stringify(clientRef)}) && [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Edit')`), "Saved client did not reopen");
    await clickText("Edit");
    await waitFor(() => evaluate(`Boolean([...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'Edit client'))`), "Edit Client modal did not open");
    await clickText("▶ Customer address", ".app-modal");
    await waitFor(() => evaluate(`Boolean(document.querySelector('.app-modal input[placeholder="Address line 1"]'))`), "Edit address fields did not open");
  };

  await send("Runtime.enable");
  await send("Page.enable");
  try {
    await waitFor(() => evaluate(`document.body.innerText.includes('Add Client')`), "QuoteSuite did not render");
  } catch (error) {
    const state = await evaluate(`({ url: location.href, text: document.body.innerText, html: document.body.innerHTML.slice(0, 1000) })`);
    throw new Error(`${error.message}: ${JSON.stringify({ state, diagnostics })}`);
  }
  await clickText("Add Client");
  await waitFor(() => evaluate(`document.body.innerText.includes('Client Database')`), "Client Database did not open");
  await clickText("Add new client");
  await waitFor(() => evaluate(`Boolean([...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'Add client'))`), "Add Client modal did not open");
  await setInput("Name", "Disposable Modal Client");
  await clickText("▶ Customer address", ".app-modal");
  await setInput("Address line 1", "10 Paste Test Road", "insertFromPaste");
  await pressTab();
  await nativeClickInput("Town");
  await setInput("Town", "Modalton");
  await setInput("Postcode", "ZZ1 1ZZ");
  const addAfterNavigation = await modalValues();
  assertState(addAfterNavigation.open && addAfterNavigation.address1 === "10 Paste Test Road", "Add Client lost its draft during Tab/click navigation");
  await evaluate(`document.querySelector('.app-modal-scrim')?.click()`);
  const addAfterBackdrop = await modalValues();
  assertState(addAfterBackdrop.open && addAfterBackdrop.postcode === "ZZ1 1ZZ", "Add Client dismissed or reset after an incidental backdrop interaction");
  await clickText("Create Client", ".app-modal");
  await waitFor(() => Promise.resolve(captured.creates.length === 1), "Create Client persistence command was not sent");

  await openSavedClientForEdit();
  const reopenedAfterCreate = await modalValues();
  assertState(reopenedAfterCreate.address1 === "10 Paste Test Road" && reopenedAfterCreate.town === "Modalton" && reopenedAfterCreate.postcode === "ZZ1 1ZZ", "Created address did not persist when reopened");
  await setInput("Address line 1", "22 Updated Paste Avenue", "insertFromPaste");
  await pressTab();
  await nativeClickInput("Town");
  const editAfterNavigation = await modalValues();
  assertState(editAfterNavigation.open && editAfterNavigation.address1 === "22 Updated Paste Avenue", "Edit Client lost its draft during Tab/click navigation");
  await clickText("Save Changes", ".app-modal");
  await waitFor(() => Promise.resolve(captured.updates.length === 1), "Save Changes persistence command was not sent");

  await openSavedClientForEdit();
  const reopenedAfterEdit = await modalValues();
  assertState(reopenedAfterEdit.address1 === "22 Updated Paste Avenue", "Edited address did not persist when reopened");
  await setInput("Address line 1", "Unsaved cancellation value");
  await clickText("Cancel", ".app-modal");
  assertState(!(await modalValues()).open, "Cancel did not deliberately close Add/Edit Client");
  await openSavedClientForEdit();
  const reopenedAfterCancel = await modalValues();
  assertState(reopenedAfterCancel.address1 === "22 Updated Paste Avenue", "Cancel did not discard the unsaved edit");
  await clickText("Close", ".app-modal");
  assertState(!(await modalValues()).open, "Close did not deliberately dismiss Add/Edit Client");

  console.log(JSON.stringify({
    add: { afterNavigation: addAfterNavigation, afterBackdrop: addAfterBackdrop, persisted: reopenedAfterCreate },
    edit: { afterNavigation: editAfterNavigation, persisted: reopenedAfterEdit, cancelPreservedSavedValue: reopenedAfterCancel.address1 },
    requests: { create: captured.creates.length, update: captured.updates.length },
    dataAuthority: "disposable intercepted API fixture; no SQLite/client reference sequence mutation",
  }, null, 2));
} finally {
  try { socket?.close(); } catch {}
  if (server) await new Promise((resolve) => server.close(resolve));
  browserCleanup = await controller.stop("final");
  await rm(temp, { recursive: true, force: true });
  console.log(JSON.stringify({ browserCleanup }, null, 2));
}
