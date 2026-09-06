import { build } from "esbuild";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createBrowserRunController } from "./browser-run-lifecycle.mjs";

const root = path.resolve(".");
const dir = await mkdtemp(path.join(os.tmpdir(), "qs-manufacturer-auto-browser-"));
const port = 4197;
const debugPort = 9600 + (process.pid % 250);
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
controller.installInterruptHandlers();

const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async (fn, message, timeout = 20_000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await fn().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(message);
};
const chromePath = () => [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
].find((candidate) => existsSync(candidate));

let server;
let child;
let ws;
let cleanup;
const browserErrors = [];
let evaluate;

try {
  const sourceFile = path.join(dir, "synthetic-eko.pdf");
  await writeFile(sourceFile, "%PDF-1.4\n% synthetic acceptance evidence\n");
  await build({
    entryPoints: [path.join(root, "tests/fixtures/ManufacturerQuoteAutomaticAcceptance.tsx")],
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    outdir: dir,
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`http://127.0.0.1:${port}`) },
  });
  server = createServer(async (request, response) => {
    const cleanUrl = request.url?.split("?")[0];
    const file = cleanUrl === "/ManufacturerQuoteAutomaticAcceptance.js"
      ? "ManufacturerQuoteAutomaticAcceptance.js"
      : cleanUrl === "/ManufacturerQuoteAutomaticAcceptance.css"
        ? "ManufacturerQuoteAutomaticAcceptance.css"
        : null;
    if (file) {
      response.writeHead(200, { "content-type": file.endsWith(".css") ? "text/css" : "text/javascript" });
      response.end(await readFile(path.join(dir, file)));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ManufacturerQuoteAutomaticAcceptance.css"></head><body><div id="root"></div><script type="module" src="/ManufacturerQuoteAutomaticAcceptance.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

  const profile = await controller.createProfile({ label: "manufacturer-automatic-identification", debugPort });
  child = spawn(chromePath(), [
    "--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank",
  ], { stdio: "ignore" });
  controller.setRun({ child });
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; }
    catch { return false; }
  }, "Chrome unavailable");

  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((item) => item.type === "page");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let commandId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${port}` });
  await waitFor(() => evaluate("document.body.innerText.includes('Upload & Analyse')"), "Upload state did not render");

  const initialText = await evaluate("document.body.innerText");
  for (const absent of ["Quotation / Reference", "Quotation Date", "Currency", "Canonical Manufacturer", "Configured Supplier / Dealer"]) assert(!initialText.includes(absent), `Pre-analysis metadata leaked into upload state: ${absent}`);

  const dom = await send("DOM.getDocument", { depth: -1, pierce: true });
  const fileNode = await send("DOM.querySelector", { nodeId: dom.root.nodeId, selector: 'input[type="file"]' });
  await send("DOM.setFileInputFiles", { nodeId: fileNode.nodeId, files: [sourceFile] });
  await evaluate("[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Upload & Analyse'))?.click()");
  await waitFor(() => evaluate("document.body.innerText.includes('Confirm Manufacturer Quote')"), "Confirmation state did not render", 30_000);

  const detected = await evaluate("({text:document.body.innerText,state:window.__manufacturerQuoteAcceptance})");
  for (const value of ["EKO-OKNA", "2025-11-18", "Factory Price", "Complete quotation", "1", "£5,989.85", "Detected from quotation", "Matched from Administration"]) assert(detected.text.includes(value), `Detected confirmation evidence missing: ${value}`);
  const detectedInputs = await evaluate(`Object.fromEntries([...document.querySelectorAll('label')].map(label=>[label.firstChild?.textContent?.trim(),label.querySelector('input,select')?.value]))`);
  assert(detectedInputs["Quotation / Reference"] === "OF/25/2263569" && detectedInputs["Quotation Date"] === "2025-11-18" && detectedInputs.Currency === "GBP", "Detected quotation identity did not populate the correction fields");
  assert(detected.state.uploads === 1 && detected.state.analyses === 1 && detected.state.imports === 0, "Upload/analysis was duplicated or mutated Project Costing before approval");

  await evaluate(`(()=>{const input=[...document.querySelectorAll('input')].find(node=>node.closest('label')?.textContent.includes('Quotation / Reference'));const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'OF/25/2263569-REVIEWED');input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await waitFor(() => evaluate("document.body.innerText.includes('Manually corrected')"), "Manual correction provenance did not render");
  await evaluate("[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Confirm & Extract Quote'))?.click()");
  await waitFor(() => evaluate("document.body.innerText.includes('Extraction / Commercial Review')"), "Extraction review did not open");
  assert((await evaluate("window.__manufacturerQuoteAcceptance.imports")) === 0, "Opening extraction review mutated Project Costing");

  for (const theme of ["dark", "light"]) for (const [width, height] of [[1920, 1080], [1440, 900], [390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const overflow = await evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth");
    assert(overflow <= 1, `${theme} ${width}: page overflow ${overflow}`);
  }

  await evaluate("[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Import to Project Costing'))?.click()");
  await waitFor(() => evaluate("window.__manufacturerQuoteAcceptance.imports===1"), "Final import was not invoked exactly once");
  const finalState = await evaluate("window.__manufacturerQuoteAcceptance");
  assert(finalState.uploads === 1 && finalState.imports === 1, "Source upload or final import count is incorrect");
  assert(finalState.importedReference === "OF/25/2263569-REVIEWED", "Manual correction did not reach final import");
  assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
  console.log(JSON.stringify({ automaticIdentification: true, detectedManufacturer: "EKO-OKNA", detectedSupplier: "EKO-OKNA", pricingMethod: "Factory Price", manualCorrection: true, noMutationBeforeApproval: true, sourceUploads: finalState.uploads, finalImports: finalState.imports, responsiveThemes: 6 }, null, 2));
} catch (error) {
  if (evaluate) console.error(JSON.stringify({ body: await evaluate("document.body.innerText").catch(() => ""), browserErrors }, null, 2));
  throw error;
} finally {
  try { ws?.close(); } catch {}
  cleanup = await controller.stop("final");
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ browserCleanup: { ownedBrowserProcesses: cleanup.ownedProcessCountAfter ?? 0, ownedTemporaryProfiles: cleanup.ownedProfileCountAfter ?? 0, verified: cleanup.verified ?? cleanup.skipped === true } }, null, 2));
}
