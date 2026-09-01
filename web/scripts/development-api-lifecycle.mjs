import { execFile, spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";
import { terminateOwnedProcessTree } from "./e2e-owned-process.mjs";

const execFileAsync = promisify(execFile);
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;
const DEFAULT_HEALTH_PATH = "/api/health";

function normalizeBaseUrl(baseUrl, host, port) {
  return String(baseUrl || `http://${host}:${port}`).replace(/\/$/, "");
}

function tcpReachable(host, port, timeoutMs = 750) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (reachable) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function runtimeMatchesContract(health, expectedContract = QUOTESUITE_RUNTIME_CONTRACT) {
  const actualCapabilities = new Set(Array.isArray(health?.capabilities) ? health.capabilities : []);
  return health?.runtimeFamily === expectedContract.family
    && health?.runtimeVersion === expectedContract.version
    && health?.runtimeIdentity === expectedContract.identity
    && expectedContract.capabilities.every((capability) => actualCapabilities.has(capability));
}

export function parseWindowsNetstatListeners(output, port) {
  const pids = new Set();
  for (const line of String(output || "").split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0].toUpperCase() !== "TCP" || parts[3].toUpperCase() !== "LISTENING") continue;
    if (!parts[1].endsWith(`:${port}`)) continue;
    const pid = Number(parts[4]);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

async function windowsListenerPids(port, execImpl = execFileAsync) {
  const { stdout } = await execImpl("netstat", ["-ano", "-p", "tcp"], { windowsHide: true });
  return parseWindowsNetstatListeners(stdout, port);
}

async function windowsProcessMetadata(pid, execImpl = execFileAsync) {
  const command = [
    `$p=Get-CimInstance Win32_Process -Filter \"ProcessId=${Number(pid)}\" -ErrorAction SilentlyContinue`,
    "if($p){$started=(Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue).StartTime",
    "[pscustomobject]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;startTime=if($started){$started.ToString('o')}else{$null};executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}",
  ].join(";");
  const { stdout } = await execImpl("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true });
  const text = String(stdout || "").trim();
  return text ? JSON.parse(text) : null;
}

export async function inspectDevelopmentApiProcess({
  port = DEFAULT_PORT,
  platformName = process.platform,
  execImpl = execFileAsync,
} = {}) {
  if (platformName !== "win32") return [];
  try {
    const pids = await windowsListenerPids(port, execImpl);
    const rows = await Promise.all(pids.map((pid) => windowsProcessMetadata(pid, execImpl).catch(() => ({ pid }))));
    return rows.filter(Boolean);
  } catch {
    return [];
  }
}

export async function probeDevelopmentApi({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  baseUrl,
  healthPath = DEFAULT_HEALTH_PATH,
  expectedContract = QUOTESUITE_RUNTIME_CONTRACT,
  fetchImpl = globalThis.fetch,
  tcpProbe = tcpReachable,
  timeoutMs = 2000,
} = {}) {
  const healthUrl = `${normalizeBaseUrl(baseUrl, host, port)}${healthPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetchImpl(healthUrl, { signal: controller.signal, cache: "no-store" });
    let health = null;
    try {
      health = await response.json();
    } catch {
      // A listener without the canonical health response is occupied but incompatible.
    }
    const compatible = runtimeMatchesContract(health, expectedContract);
    if (compatible) {
      return {
        state: health?.databaseAvailable === false ? "database_unavailable" : "connected",
        listening: true,
        compatible: true,
        databaseAvailable: health?.databaseAvailable !== false,
        health,
        healthUrl,
      };
    }
    return {
      state: "runtime_mismatch",
      listening: true,
      compatible: false,
      databaseAvailable: health?.databaseAvailable ?? null,
      health,
      healthUrl,
      httpStatus: response.status,
    };
  } catch (error) {
    const listening = await tcpProbe(host, port);
    return {
      state: listening ? "runtime_mismatch" : "offline",
      listening,
      compatible: false,
      databaseAvailable: null,
      health: null,
      healthUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function captureDevelopmentApiBaseline(options = {}) {
  const probe = await probeDevelopmentApi(options);
  const processInspector = options.processInspector || inspectDevelopmentApiProcess;
  const processes = probe.listening
    ? await processInspector({ port: options.port ?? DEFAULT_PORT, platformName: options.platformName, execImpl: options.execImpl })
    : [];
  return {
    capturedAt: new Date().toISOString(),
    ...probe,
    processes,
    ownership: probe.listening ? "pre_existing_external" : "none",
  };
}

function occupiedPortError(baseline) {
  const error = new Error("Port is already occupied by an incompatible or unhealthy development runtime; it was not replaced.");
  error.code = "QUOTESUITE_API_PORT_OCCUPIED";
  error.baseline = baseline;
  return error;
}

export function createDevelopmentApiLifecycle({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  baseUrl,
  serverEntry = path.resolve("server/index.js"),
  cwd = path.resolve("."),
  spawnImpl = spawn,
  terminateOwnedImpl = terminateOwnedProcessTree,
  inspectImpl = captureDevelopmentApiBaseline,
  probeImpl = probeDevelopmentApi,
  waitImpl = delay,
  startupTimeoutMs = 15000,
  environment = process.env,
  platformName = process.platform,
} = {}) {
  let baseline = null;
  let ownedChild = null;
  let availabilityPromise = null;

  const probeOptions = { host, port, baseUrl, platformName };
  const capture = async () => {
    if (!baseline) baseline = await inspectImpl(probeOptions);
    return baseline;
  };

  const waitUntilCompatible = async () => {
    const deadline = Date.now() + startupTimeoutMs;
    let latest;
    while (Date.now() < deadline) {
      latest = await probeImpl(probeOptions);
      if (latest.compatible) return latest;
      if (ownedChild && (ownedChild.exitCode !== null || ownedChild.signalCode !== null)) break;
      await waitImpl(100);
    }
    const error = new Error("Temporary QuoteSuite API did not reach the expected runtime contract.");
    error.code = "QUOTESUITE_API_START_TIMEOUT";
    error.probe = latest;
    throw error;
  };

  return {
    captureBaseline: capture,
    async ensureAvailable() {
      if (!availabilityPromise) {
        availabilityPromise = (async () => {
          const initial = await capture();
          if (initial.compatible) return { mode: "reused", owned: false, baseline: initial };
          if (initial.listening) throw occupiedPortError(initial);

          ownedChild = spawnImpl(process.execPath, [serverEntry], {
            cwd,
            env: { ...environment, PORT: String(port) },
            stdio: "ignore",
            shell: false,
            windowsHide: true,
          });
          ownedChild.once?.("error", () => {});
          const current = await waitUntilCompatible();
          return { mode: "started_temporary", owned: true, pid: ownedChild.pid, baseline: initial, current };
        })();
      }
      try {
        return await availabilityPromise;
      } catch (error) {
        if (ownedChild) await terminateOwnedImpl(ownedChild, { platformName });
        ownedChild = null;
        availabilityPromise = null;
        throw error;
      }
    },
    async cleanup() {
      const initial = await capture();
      let cleanup = { skipped: true, reason: "no_owned_api" };
      if (ownedChild) {
        const pid = ownedChild.pid;
        const result = await terminateOwnedImpl(ownedChild, { platformName });
        cleanup = { skipped: false, pid, ...result };
        ownedChild = null;
      }
      availabilityPromise = null;
      const current = await probeImpl(probeOptions);
      if (!initial.listening && current.listening) {
        const error = new Error("The task began without an API listener but an API remains after owned cleanup.");
        error.code = "QUOTESUITE_API_OWNERSHIP_RESTORE_FAILED";
        error.baseline = initial;
        error.current = current;
        error.cleanup = cleanup;
        throw error;
      }
      return { baseline: initial, current, cleanup };
    },
    getOwnedPid() {
      return ownedChild?.pid ?? null;
    },
  };
}

export async function withDevelopmentApi(work, options = {}) {
  const lifecycle = createDevelopmentApiLifecycle(options);
  const availability = await lifecycle.ensureAvailable();
  try {
    return await work(availability);
  } finally {
    await lifecycle.cleanup();
  }
}
