import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  captureDevelopmentApiBaseline,
  probeDevelopmentApi,
} from "./development-api-lifecycle.mjs";
import { terminateOwnedProcessTree } from "./e2e-owned-process.mjs";

function occupiedError(baseline) {
  const error = new Error(
    "QuoteSuite development start stopped because the API port is already owned by another process. Stop that API intentionally, then run npm run dev:quotesuite so the combined supervisor can own safe reloads.",
  );
  error.code = "QUOTESUITE_DEV_API_ALREADY_OWNED";
  error.baseline = baseline;
  return error;
}

export function createDevelopmentWorkspaceSupervisor({
  cwd = path.resolve("."),
  host = "127.0.0.1",
  apiPort = 3001,
  frontendPort = 5173,
  serverEntry = path.resolve("server/index.js"),
  viteEntry = path.resolve("node_modules/vite/bin/vite.js"),
  startFrontend = true,
  spawnImpl = spawn,
  captureImpl = captureDevelopmentApiBaseline,
  probeImpl = probeDevelopmentApi,
  terminateImpl = terminateOwnedProcessTree,
  environment = process.env,
  startupTimeoutMs = 20_000,
  waitImpl = delay,
} = {}) {
  let baseline;
  let apiWatcher;
  let frontend;
  let stopping = false;
  let resolveUnexpectedExit;
  const unexpectedExit = new Promise((resolve) => { resolveUnexpectedExit = resolve; });
  const monitor = (child, role) => child.once?.("exit", (code, signal) => {
    if (!stopping) resolveUnexpectedExit({ role, code, signal });
  });

  const probeOptions = { host, port: apiPort };
  const waitForApi = async ({ differentStartedAt } = {}) => {
    const deadline = Date.now() + startupTimeoutMs;
    let latest;
    while (Date.now() < deadline) {
      latest = await probeImpl(probeOptions);
      if (latest.compatible && (!differentStartedAt || latest.health?.startedAt !== differentStartedAt)) return latest;
      if (apiWatcher && (apiWatcher.exitCode !== null || apiWatcher.signalCode !== null)) break;
      await waitImpl(100);
    }
    const error = new Error("The watched QuoteSuite API did not reach the current runtime contract.");
    error.code = "QUOTESUITE_WATCHED_API_START_TIMEOUT";
    error.probe = latest;
    throw error;
  };

  return {
    async start() {
      baseline = await captureImpl(probeOptions);
      if (baseline.listening) throw occupiedError(baseline);

      apiWatcher = spawnImpl(process.execPath, ["--watch", "--watch-preserve-output", serverEntry], {
        cwd,
        env: { ...environment, HOST: host, PORT: String(apiPort), QUOTESUITE_DEVELOPMENT_WATCH: "1" },
        stdio: "inherit",
        shell: false,
        windowsHide: true,
      });
      apiWatcher.once?.("error", () => {});
      monitor(apiWatcher, "api-watch");
      const api = await waitForApi();

      if (startFrontend) {
        frontend = spawnImpl(process.execPath, [viteEntry, "--host", host, "--port", String(frontendPort), "--strictPort"], {
          cwd,
          env: { ...environment, VITE_API_BASE_URL: `http://${host}:${apiPort}` },
          stdio: "inherit",
          shell: false,
          windowsHide: true,
        });
        frontend.once?.("error", () => {});
        monitor(frontend, "vite");
      }
      return { baseline, api, apiWatcherPid: apiWatcher.pid, frontendPid: frontend?.pid ?? null };
    },
    async waitForRestart(previousStartedAt) {
      return waitForApi({ differentStartedAt: previousStartedAt });
    },
    waitForUnexpectedExit() {
      return unexpectedExit;
    },
    async stop(reason = "shutdown") {
      if (stopping) return null;
      stopping = true;
      const owned = [];
      if (frontend) owned.push({ role: "vite", pid: frontend.pid, result: await terminateImpl(frontend, { platformName: process.platform }) });
      if (apiWatcher) owned.push({ role: "api-watch", pid: apiWatcher.pid, result: await terminateImpl(apiWatcher, { platformName: process.platform }) });
      frontend = undefined;
      apiWatcher = undefined;
      const current = await probeImpl(probeOptions);
      if (!baseline?.listening && current.listening) {
        const error = new Error("The combined development command left an API listener it owned behind.");
        error.code = "QUOTESUITE_DEV_OWNERSHIP_RESTORE_FAILED";
        error.current = current;
        error.owned = owned;
        throw error;
      }
      return { reason, baseline, current, owned };
    },
    ownedPids() {
      return { apiWatcherPid: apiWatcher?.pid ?? null, frontendPid: frontend?.pid ?? null };
    },
  };
}
