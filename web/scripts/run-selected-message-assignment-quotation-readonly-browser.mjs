import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  createBrowserRunController,
  countBrowserRunProfiles,
} from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTrees } from "./e2e-owned-process.mjs";

const APP_URL = "http://127.0.0.1:4182",
  API_URL = "http://127.0.0.1:3012",
  DEBUG_PORT = 9292;
const evidenceDirectory = path.resolve(
  "test-output",
  `selected-message-assignment-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
const services = [],
  controller = createBrowserRunController({
    throwOnLeak: true,
    processOptions: { platformName: process.platform },
  });
controller.installInterruptHandlers();
const reachable = async (url) => {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
};
const waitFor = async (fn, message, timeout = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await fn().catch(() => false);
    if (value) return value;
    await delay(200);
  }
  throw new Error(message);
};

function launchServices() {
  services.push(
    spawn(process.execPath, ["server/index.js"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3012" },
      stdio: "ignore",
      windowsHide: true,
    }),
  );
  services.push(
    spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "4182",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, VITE_API_BASE_URL: API_URL },
        stdio: "ignore",
        windowsHide: true,
      },
    ),
  );
}

async function launchChrome() {
  const userDataDir = await controller.createProfile({
    label: "selected-message-assignment",
    debugPort: DEBUG_PORT,
  });
  const child = spawn(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--disable-gpu",
      "--disable-extensions",
      "--window-size=1800,1100",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  controller.setRun({
    child,
    userDataDir,
    debugPort: DEBUG_PORT,
    profileProcessCountDuring: await countBrowserRunProfiles(userDataDir, {
      platformName: process.platform,
    }),
  });
  await waitFor(
    () => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`),
    "Owned Chrome did not start",
    15000,
  );
}

async function connect() {
  await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`,
    { method: "PUT" },
  );
  const targets = await (
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
    ).json(),
    target = targets.find(
      (item) => item.type === "page" && item.url.startsWith(APP_URL),
    );
  assert.ok(target, "Application browser target was not created");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map(),
    diagnostics = [],
    responses = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown")
      diagnostics.push(
        message.params?.exceptionDetails?.exception?.description ||
          message.params?.exceptionDetails?.text ||
          "Runtime exception",
      );
    if (
      message.method === "Log.entryAdded" &&
      message.params?.entry?.level === "error"
    )
      diagnostics.push(message.params.entry.text);
    if (message.method === "Network.responseReceived")
      responses.push({
        requestId: message.params.requestId,
        url: message.params.response.url,
        status: message.params.response.status,
        mimeType: message.params.response.mimeType,
        headers: message.params.response.headers,
      });
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error
        ? task.reject(new Error(message.error.message))
        : task.resolve(message.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const call = ++id;
      pending.set(call, { resolve, reject });
      socket.send(JSON.stringify({ id: call, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result?.value;
  };
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: APP_URL });
  return {
    send,
    evaluate,
    diagnostics,
    responses,
    close: () => socket.close(),
  };
}

const clickText = (tab, text, selector = "button") =>
  waitFor(
    () =>
      tab.evaluate(
        `(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!node)return false;node.click();return true})()`,
      ),
    `Control unavailable: ${text}`,
  );
const capture = async (tab, name) => {
  const shot = await tab.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const target = path.resolve(evidenceDirectory, `${name}.png`);
  await writeFile(target, Buffer.from(shot.data, "base64"));
  return target;
};

async function run() {
  await mkdir(evidenceDirectory, { recursive: true });
  launchServices();
  await waitFor(
    () => reachable(`${API_URL}/api/health`),
    "Owned API unavailable",
  );
  await waitFor(() => reachable(APP_URL), "Owned Vite unavailable");
  const status = await (
    await fetch(`${API_URL}/api/communications/status`)
  ).json();
  assert.ok(
    status.connected &&
      status.capabilities?.gmail?.available &&
      status.capabilities?.drive?.available,
    "Persisted Google Workspace capabilities unavailable",
  );
  await launchChrome();
  let tab;
  try {
    tab = await connect();
    await waitFor(
      () => tab.evaluate("Boolean(document.querySelector('.theme-selector'))"),
      "Application shell unavailable",
    );
    await clickText(tab, "Email", ".app-sidebar-item");
    await waitFor(
      () =>
        tab.evaluate(
          "document.querySelectorAll('.email-message-row').length>0",
        ),
      "Mailbox rows unavailable",
    );
    await tab.evaluate(
      "[...document.querySelectorAll('.email-layout-controls button')].find(item=>item.title==='Right preview')?.click()",
    );
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('.email-preview-layout--right'))",
        ),
      "Right preview unavailable",
    );
    const found = await tab.evaluate(
      `(()=>{const input=document.querySelector('.email-search input');if(!input)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'EF-CL-028');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.email-search button[type=submit]')?.click();return true})()`,
    );
    assert.ok(found, "Mailbox search unavailable");
    await waitFor(
      () =>
        tab.evaluate(
          "[...document.querySelectorAll('.email-message-row')].some(row=>row.textContent.includes('Stuart Gilks')&&row.textContent.includes('Viktorija'))",
        ),
      "Exact Viktorija EF-CL-028 row unavailable",
    );
    const opened = await tab.evaluate(
      `(()=>{const row=[...document.querySelectorAll('.email-message-row')].find(item=>item.textContent.includes('Stuart Gilks')&&item.textContent.includes('Viktorija'));if(!row)return false;row.click();return true})()`,
    );
    assert.ok(opened, "Exact EF-CL-028 row could not be opened");
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('.email-reader__selected-message iframe'))",
        ),
      "Exact selected-message reader unavailable",
    );
    await waitFor(
      () =>
        tab.evaluate(
          "(document.querySelector('.email-reader__selected-message iframe')?.getAttribute('srcdoc')||'').includes('data:image')",
        ),
      "Retained CID images were not resolved to local data URLs",
    );
    const messageView = await tab.evaluate(
      `(()=>{const selected=document.querySelector('.email-message-row.is-preview-selected'),bulk=document.querySelectorAll('.email-message-row.is-selected').length,reader=document.querySelector('.email-reader'),context=document.querySelector('.email-context-panel'),message=document.querySelector('.email-reader__selected-message'),frame=message?.querySelector('iframe'),src=frame?.getAttribute('srcdoc')||'',selectedStyle=selected?getComputedStyle(selected):null,other=[...document.querySelectorAll('.email-message-row')].find(item=>item!==selected),otherStyle=other?getComputedStyle(other):null;return{subject:reader?.querySelector(':scope>header h3')?.textContent.trim(),date:message?.querySelector('time')?.textContent.trim(),conversationCards:reader?.querySelectorAll('.email-reader__message').length||0,contextAbove:Boolean(context&&message&&context.getBoundingClientRect().top<message.getBoundingClientRect().top),selectedRows:document.querySelectorAll('.email-message-row.is-preview-selected').length,bulk,distinctBackground:selectedStyle?.backgroundColor!==otherStyle?.backgroundColor,hasInternalUrl:src.includes('/api/communications/messages/'),hasDataImage:src.includes('data:image'),remoteControl:[...document.querySelectorAll('button')].some(item=>item.textContent.trim()==='Load remote images'),readingMode:document.querySelector('.email-reading-mode [aria-pressed=true]')?.textContent.trim()}})()`,
    );
    assert.equal(messageView.readingMode, "Message");
    assert.equal(messageView.conversationCards, 0);
    assert.equal(messageView.contextAbove, true);
    assert.equal(messageView.selectedRows, 1);
    assert.equal(messageView.bulk, 0);
    assert.equal(messageView.distinctBackground, true);
    assert.equal(messageView.hasInternalUrl, false);
    assert.equal(messageView.hasDataImage, true);
    assert.match(messageView.subject, /EF-CL-028: Stuart Gilks/i);
    assert.match(messageView.date, /10 Sept? 2026.*04:39/);
    await clickText(tab, "Link existing");
    await waitFor(
      () =>
        tab.evaluate("Boolean(document.querySelector('.email-assignment'))"),
      "Existing-record assignment picker unavailable",
    );
    const picker = await tab.evaluate(
      `(()=>{const root=document.querySelector('.email-assignment'),labels=[...root.querySelectorAll('label')],value=label=>{const node=labels.find(item=>item.childNodes[0]?.textContent.trim()===label)?.querySelector('select');return{value:node?.value||'',text:node?.selectedOptions?.[0]?.textContent.trim()||''}},buttons=[...root.querySelectorAll('button')].map(item=>item.textContent.trim());return{client:value('Client'),project:value('Project'),estimate:value('Estimate'),supplier:value('Supplier'),document:value('Document'),conflict:root.querySelector('.email-assignment__conflicts')?.textContent||'',buttons}})()`,
    );
    assert.match(picker.client.text, /EF-CL-028.*Stuart Gilk/i);
    assert.match(picker.project.text, /Red House/i);
    assert.match(picker.estimate.text, /EF-EST-2026-057/i);
    assert.match(picker.supplier.text, /Zyle Fenster/i);
    assert.match(
      picker.document.text,
      /EcoTherm Aluminium Clad Casement window\.pdf/i,
    );
    assert.match(picker.conflict, /Stuart Gilks.*Stuart Gilk/i);
    assert.ok(picker.buttons.includes("File selected document"));
    const screenshots = [await capture(tab, "01-selected-message-and-picker")];
    await clickText(tab, "Close");
    await clickText(tab, "Conversation");
    await waitFor(
      () =>
        tab.evaluate(
          "document.querySelectorAll('.email-reader__message').length>1",
        ),
      "Optional conversation mode unavailable",
    );
    const conversationCount = await tab.evaluate(
      "document.querySelectorAll('.email-reader__message').length",
    );
    await clickText(tab, "Message");
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('.email-reader__selected-message'))",
        ),
      "Message mode could not be restored",
    );

    await clickText(tab, "Client Database", ".app-sidebar-item");
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('[data-client-ref=\"EF-CL-019\"]'))",
        ),
      "Nick Corlett Client row unavailable",
    );
    const openedClient = await tab.evaluate(
      `(()=>{const row=document.querySelector('[data-client-ref="EF-CL-019"]'),button=[...row.querySelectorAll('button')].find(item=>item.textContent.trim()==='Open');if(!button)return false;button.click();return true})()`,
    );
    assert.ok(openedClient, "Nick Corlett Client could not be opened");
    await waitFor(
      () =>
        tab.evaluate(
          "[...document.querySelectorAll('button')].some(item=>item.textContent.trim()==='Client Estimates')",
        ),
      "Client Estimate picker unavailable",
    );
    await clickText(tab, "Client Estimates");
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('[data-estimate-ref=\"EF-EST-2026-055\"]'))",
        ),
      "EF-EST-2026-055 row unavailable",
    );
    const openedEstimate = await tab.evaluate(
      `(()=>{const row=document.querySelector('[data-estimate-ref="EF-EST-2026-055"]'),button=[...row.querySelectorAll('button')].find(item=>item.title==='Open Estimate'||item.textContent.trim()==='Open');if(!button)return false;button.click();return true})()`,
    );
    assert.ok(openedEstimate, "EF-EST-2026-055 could not be opened");
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('[data-testid=estimate-commercial-workspace]'))",
        ),
      "Nick Corlett Estimate workspace unavailable",
    );
    await clickText(tab, "Review Customer Quotation");
    await waitFor(
      () =>
        tab.evaluate(
          "Boolean(document.querySelector('.customer-quotation__print-root'))",
        ),
      "Customer Estimate preview unavailable",
    );
    const preview = await tab.evaluate(
      `(()=>{const root=document.querySelector('.customer-quotation__print-root'),detail=[...root.querySelectorAll('.customer-quotation-cover__details>div')].find(item=>item.querySelector('dt')?.textContent.trim()==='Project')?.querySelector('dd')?.textContent.trim(),cards=[...root.querySelectorAll('.customer-quotation-showcases article')].map(item=>({name:item.querySelector('h3')?.textContent.trim(),src:item.querySelector('img')?.src||''})),headingColours=[...root.querySelectorAll('h1,h2,h3')].map(item=>getComputedStyle(item).color);return{project:detail,cards,headingColours,coverPhoto:Boolean(root.querySelector('.customer-quotation-cover__photo')),decorativeDetail:Boolean(root.querySelector('.customer-quotation-cover__detail')),internalWording:/Genuine supplied|product asset/i.test(root.textContent)}})()`,
    );
    assert.equal(preview.project, "Ty Clai");
    assert.equal(preview.coverPhoto, true);
    assert.equal(preview.decorativeDetail, false);
    assert.equal(preview.internalWording, false);
    assert.ok(
      preview.headingColours.every((value) => value === "rgb(16, 25, 27)"),
    );
    assert.match(
      preview.cards.find((item) => item.name === "Ecotherm")?.src || "",
      /PHOTO-2020-08-29-07-54-57/,
    );
    assert.match(
      preview.cards.find((item) => item.name === "Europa 92 Alu")?.src || "",
      /f60e06e3-7b52-45e0-9fad-3a190c0704bb/,
    );
    const beforeTheme = preview.headingColours;
    await tab.evaluate("document.querySelector('.theme-selector')?.click()");
    await delay(200);
    const afterTheme = await tab.evaluate(
      "[...document.querySelectorAll('.customer-quotation__print-root h1,.customer-quotation__print-root h2,.customer-quotation__print-root h3')].map(item=>getComputedStyle(item).color)",
    );
    assert.deepEqual(
      afterTheme,
      beforeTheme,
      "Customer document headings changed with application theme",
    );
    screenshots.push(await capture(tab, "02-nick-corlett-customer-estimate"));
    const responseCursor = tab.responses.length;
    await clickText(tab, "Download PDF");
    const pdfResponse = await waitFor(
      async () =>
        tab.responses
          .slice(responseCursor)
          .find(
            (item) =>
              item.url.includes("/api/quotation-workflow/preview-document") &&
              item.status === 200 &&
              item.mimeType === "application/pdf",
          ),
      "Downloaded PDF response unavailable",
    );
    const request = await tab.send("Network.getRequestPostData", {
        requestId: pdfResponse.requestId,
      }),
      verificationResponse = await fetch(
        `${API_URL}/api/quotation-workflow/preview-document`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: request.postData,
        },
      ),
      pdfBytes = Buffer.from(await verificationResponse.arrayBuffer());
    assert.equal(verificationResponse.status, 200);
    assert.match(
      String(pdfResponse.headers?.["Content-Type"] || pdfResponse.mimeType),
      /application\/pdf/i,
    );
    assert.ok(
      pdfBytes.length > 10000 && pdfBytes.subarray(0, 4).toString() === "%PDF",
      "Downloaded customer Estimate is not a valid PDF",
    );
    const pdfPath = path.resolve(
      evidenceDirectory,
      "EF-EST-2026-055-Estimate.pdf",
    );
    await writeFile(pdfPath, pdfBytes);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) })
      .promise;
    let pdfText = "";
    const pdfColours = new Set();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber),
        content = await page.getTextContent();
      pdfText += content.items.map((item) => item.str).join(" ") + "\n";
      const operators = await page.getOperatorList();
      operators.fnArray.forEach((operator, index) => {
        if (
          operator === pdfjs.OPS.setFillRGBColor ||
          operator === pdfjs.OPS.setStrokeRGBColor
        )
          pdfColours.add(String(operators.argsArray[index]?.[0] || ""));
      });
    }
    assert.match(pdfText, /Ty Clai/);
    assert.doesNotMatch(pdfText, /Genuine supplied|product asset/i);
    assert.ok(
      pdfColours.has("#17211d") && pdfColours.has("#2f6f2f"),
      "Downloaded PDF did not retain its fixed dark customer-document palette",
    );
    const cspDiagnostics = tab.diagnostics.filter((item) =>
      /content security policy|img-src/i.test(item),
    );
    assert.deepEqual(cspDiagnostics, []);
    const assignmentPosts = tab.responses.filter(
      (item) =>
        item.url.includes("/api/communications/messages/") &&
        item.url.endsWith("/assignment") &&
        item.status === 201,
    );
    assert.equal(
      assignmentPosts.length,
      0,
      "Live EF-CL-028 filing was submitted",
    );
    console.log(
      JSON.stringify(
        {
          messageView,
          picker: {
            client: picker.client.text,
            project: picker.project.text,
            estimate: picker.estimate.text,
            supplier: picker.supplier.text,
            document: picker.document.text,
            conflict: picker.conflict.trim(),
          },
          conversationCount,
          preview,
          pdf: {
            path: pdfPath,
            sizeBytes: pdfBytes.length,
            pages: pdf.numPages,
            containsTyClai: /Ty Clai/.test(pdfText),
            fixedPalette: [...pdfColours].filter((colour) =>
              ["#17211d", "#2f6f2f", "#77b84a"].includes(colour),
            ),
          },
          cspDiagnostics,
          liveAssignmentSubmissions: assignmentPosts.length,
          screenshots,
        },
        null,
        2,
      ),
    );
  } finally {
    tab?.close();
    const cleanup = await controller.stop("final");
    console.log(
      `Selected-message acceptance browser cleanup: ${JSON.stringify(cleanup)}`,
    );
    await terminateOwnedProcessTrees(services, {
      platformName: process.platform,
    });
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const extra = await controller.stop("top-level");
    if (!extra.skipped)
      console.log(
        `Selected-message acceptance top-level cleanup: ${JSON.stringify(extra)}`,
      );
    await terminateOwnedProcessTrees(services, {
      platformName: process.platform,
    });
  });
