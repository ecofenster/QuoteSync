import { spawn, execFile } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";

const execFileAsync = promisify(execFile);

function chromeCandidates() {
  if (process.platform !== "win32") return ["google-chrome", "chromium"];
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  ];
}

function findChrome() {
  if (process.platform !== "win32") return chromeCandidates()[0];
  const executable = chromeCandidates().find((candidate) => existsSync(candidate));
  if (!executable) throw new Error("Chrome executable was not found");
  return executable;
}

async function allocatePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not allocate a remote debugging port");
  return port;
}

async function countAllQuoteSyncHeadlessChrome() {
  if (process.platform !== "win32") {
    throw new Error("The focused global ownership count currently requires Windows");
  }
  const ownedRoot = join(tmpdir(), "QuoteSync", "e2e");
  const escapedRoot = ownedRoot.replaceAll("'", "''");
  const command = [
    "$ownedRoot = '" + escapedRoot + "'",
    "$owned = @(Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*--headless*' -and $_.CommandLine -like ('*' + $ownedRoot + '*') })",
    "$owned.Count",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true });
  const count = Number.parseInt(String(stdout).trim(), 10);
  if (!Number.isInteger(count)) throw new Error("Could not parse QuoteSync-owned Chrome process count");
  return count;
}

async function waitForCdp(port, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (response.ok) return;
    } catch {
    }
    await delay(100);
  }
  throw new Error("Chrome did not expose CDP before timeout");
}

const controller = createBrowserRunController({
  throwOnLeak: true,
  processOptions: { platformName: process.platform },
});
controller.installInterruptHandlers();

let userDataDir = null;
let child = null;
let debugPort = null;
let before = null;
let during = null;
let cleanup = null;
let cleanupError = null;
const deliberateFailure = process.argv.includes("--deliberate-failure");
let deliberateFailureObserved = false;

try {
  before = await countAllQuoteSyncHeadlessChrome();
  debugPort = await allocatePort();
  userDataDir = await controller.createProfile({
    label: "browser-lifecycle-leak-check",
    debugPort,
  });

  child = spawn(findChrome(), [
    "--headless=new",
    "--remote-debugging-port=" + debugPort,
    "--user-data-dir=" + userDataDir,
    "--no-first-run",
    "--disable-gpu",
    "--disable-extensions",
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  controller.setRun({ child });
  await waitForCdp(debugPort);

  during = await countAllQuoteSyncHeadlessChrome();
  controller.setRun({
    profileProcessCountDuring: await countBrowserRunProfiles(userDataDir, { platformName: process.platform }),
  });
  if (deliberateFailure) assert.fail("deliberate browser acceptance failure");
} catch (error) {
  if (!deliberateFailure || error?.message !== "deliberate browser acceptance failure") throw error;
  deliberateFailureObserved = true;
} finally {
  try {
    cleanup = await controller.stop("final");
  } catch (error) {
    cleanupError = error;
  }
}

const after = await countAllQuoteSyncHeadlessChrome();
const profileRemoved = userDataDir ? !existsSync(userDataDir) : true;
const result = {
  before,
  during,
  after,
  rootPid: child?.pid ?? null,
  userDataDir,
  debugPort,
  exactProfileBefore: cleanup?.profileProcessCountBefore ?? null,
  exactProfileDuring: cleanup?.profileProcessCountDuring ?? null,
  exactProfileAfter: cleanup?.profileProcessCountAfter ?? null,
  ownedBrowserProcessesRemaining: cleanup?.ownedBrowserProcessesRemaining ?? null,
  ownedTemporaryProfilesRemaining: cleanup?.ownedTemporaryProfilesRemaining ?? null,
  cleanupVerified: cleanup?.verified ?? false,
  profileRemoved,
  deliberateFailureObserved,
};
console.log(JSON.stringify(result));

if (cleanupError) throw cleanupError;
if (after !== 0) throw new Error("QuoteSync-owned headless Chrome processes remain after focused cleanup: " + after);
if (!profileRemoved) throw new Error("QuoteSync-owned temporary profile remains after focused cleanup: " + userDataDir);
if (deliberateFailure && !deliberateFailureObserved) throw new Error("The deliberate browser acceptance failure was not observed");
