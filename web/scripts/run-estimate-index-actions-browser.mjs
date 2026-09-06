import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";

const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:5173";
const DEBUG_PORT = 9278;
const assert = (value, message) => { if (!value) throw new Error(message); };
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };
const waitFor = async (fn, message, timeout = 30000) => { const started = Date.now(); while (Date.now() - started < timeout) { const value = await fn().catch(() => false); if (value) return value; await delay(150); } throw new Error(message); };

const browserRunController = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
browserRunController.installInterruptHandlers();

async function launchChrome() {
  const userDataDir = await browserRunController.createProfile({ label: "estimate-index-actions", debugPort: DEBUG_PORT });
  const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank"], { stdio: "ignore" });
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
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.text);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const call = ++id;
    pending.set(call, { resolve, reject });
    socket.send(JSON.stringify({ id: call, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: APP_URL });
  return { send, evaluate, diagnostics, close: () => socket.close() };
}

const inspect = (tab) => tab.evaluate(`(() => {
  const wrap = document.querySelector('.estimate-index-table-wrap');
  const headings = [...document.querySelectorAll('.estimate-index-action-headings > span')];
  const row = document.querySelector('.estimate-index-table tbody tr');
  const controls = row ? [...row.querySelector('.estimate-index-actions').children] : [];
  const rects = controls.map((node) => node.getBoundingClientRect());
  return {
    headings: headings.map((node) => node.textContent.trim()),
    alignment: headings.map((node, index) => Math.abs((node.getBoundingClientRect().left + node.getBoundingClientRect().width / 2) - (rects[index]?.left + rects[index].width / 2)),
    widths: rects.map((rect) => Math.round(rect.width)),
    rowHeight: row ? Math.round(row.getBoundingClientRect().height) : 0,
    horizontalOverflow: wrap ? Math.max(0, wrap.scrollWidth - wrap.clientWidth) : -1,
    overlap: rects.some((rect, index) => index > 0 && rect.left < rects[index - 1].right),
    status: row?.querySelector('select')?.value,
    openText: controls.at(-1)?.textContent?.trim()
  };
})()`);

async function run() {
  assert(await reachable(APP_URL), `Application unavailable at ${APP_URL}`);
  const browser = await launchChrome();
  let tab;
  try {
    browserRunController.setRun({
      label: "estimate-index-actions",
      userDataDir: browser.userDataDir,
      child: browser.child,
      debugPort: DEBUG_PORT,
      profileProcessCountBefore: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }),
      startedAt: new Date().toISOString(),
    });

    tab = await connect();
    await delay(1500);
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('.app-sidebar-item')].find((node) => node.textContent.trim() === 'Estimates') )`), "Application shell unavailable");
    await waitFor(() => tab.evaluate(`(() => { const item = [...document.querySelectorAll('.app-sidebar-item')].find((node) => node.textContent.trim() === 'Estimates'); if (!item) return false; item.click(); return true; })()`), "Estimates navigation unavailable");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.estimate-index-table tbody tr'))`), "No Estimate row available for layout acceptance");

    browserRunController.setRun({
      profileProcessCountDuring: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }),
    });

    const results = {};
    for (const [width, height] of [[1920, 1080], [1366, 768]]) {
      await tab.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await delay(250);
      const result = await inspect(tab);
      assert(JSON.stringify(result.headings) === JSON.stringify(["Email", "Follow Up", "Status", "Copy", "Delete", "Open"]), `Action headings incorrect at ${width}x${height}`);
      assert(result.alignment.every((offset) => offset < 2), `Headers and controls are misaligned at ${width}x${height}`);
      assert(!result.overlap && result.horizontalOverflow === 0, `Action layout clips or scrolls at ${width}x${height}: ${JSON.stringify(result)}`);
      assert(result.rowHeight <= 52 && result.widths[2] >= 108 && result.openText === "Open", `Action sizing is not compact/readable at ${width}x${height}`);
      const shot = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const path = join(tmpdir(), `quotesuite-estimates-actions-${width}x${height}.png`);
      await writeFile(path, Buffer.from(shot.data, "base64"));
      results[`${width}x${height}`] = { ...result, screenshot: path };
    }
    assert(tab.diagnostics.length === 0, `Browser diagnostics: ${tab.diagnostics.join("; ")}`);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    tab?.close();
    const cleanup = await browserRunController.stop("final");
    console.log(`Estimate index actions browser cleanup: ${JSON.stringify(cleanup)}`);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { const cleanup = await browserRunController.stop("top-level"); if (!cleanup.skipped) console.log("Browser top-level cleanup: " + JSON.stringify(cleanup)); });
