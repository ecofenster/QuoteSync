import { QUOTESUITE_RUNTIME_CONTRACT } from "../../../shared/runtimeHealthContract.js";
import { API_BASE_URL } from "../../services/api/apiClient";

export type RuntimeHealthPhase =
  | "connecting"
  | "rechecking"
  | "connected"
  | "api_offline"
  | "database_unavailable"
  | "runtime_mismatch"
  | "recovered";

export type RuntimeHealthState = {
  phase: RuntimeHealthPhase;
  runtimeIdentity?: string;
  runtimeVersion?: string;
  runtimeFamily?: string;
  serverEntry?: string;
  startedAt?: string;
};

type HealthPayload = {
  apiAvailable?: boolean;
  databaseAvailable?: boolean;
  runtimeIdentity?: string;
  runtimeVersion?: string;
  runtimeFamily?: string;
  serverEntry?: string;
  startedAt?: string;
};

export const INITIAL_RUNTIME_HEALTH: RuntimeHealthState = { phase: "connecting" };

export function runtimeAllowsMutations(state: RuntimeHealthState) {
  return state.phase === "connected" || state.phase === "recovered";
}

export async function requestRuntimeHealth({
  fetchImpl = fetch,
  signal,
  timeoutMs = 3000,
  baseUrl = API_BASE_URL,
}: {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  baseUrl?: string;
} = {}): Promise<RuntimeHealthState> {
  const timeoutController = new AbortController();
  const abortFromCaller = () => timeoutController.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => timeoutController.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/api/health`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: timeoutController.signal,
    });

    let payload: HealthPayload | undefined;
    try {
      payload = (await response.json()) as HealthPayload;
    } catch {
      payload = undefined;
    }

    const common = payload
      ? {
          runtimeIdentity: payload.runtimeIdentity,
          runtimeVersion: payload.runtimeVersion,
          runtimeFamily: payload.runtimeFamily,
          serverEntry: payload.serverEntry,
          startedAt: payload.startedAt,
        }
      : {};

    const compatible =
      payload?.apiAvailable === true &&
      payload.runtimeFamily === QUOTESUITE_RUNTIME_CONTRACT.family &&
      payload.runtimeIdentity === QUOTESUITE_RUNTIME_CONTRACT.identity;

    if (!compatible) return { phase: "runtime_mismatch", ...common };
    if (payload?.databaseAvailable !== true) return { phase: "database_unavailable", ...common };
    if (!response.ok) return { phase: "database_unavailable", ...common };
    return { phase: "connected", ...common };
  } catch {
    return { phase: "api_offline" };
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

type RuntimeHealthMonitorOptions = {
  check?: (signal: AbortSignal) => Promise<RuntimeHealthState>;
  onState: (state: RuntimeHealthState) => void;
  schedule?: (callback: () => void, delayMs: number) => number;
  cancelSchedule?: (timerId: number) => void;
  connectedIntervalMs?: number;
  unhealthyBackoffMs?: readonly number[];
  recoveryDisplayMs?: number;
};

export function createRuntimeHealthMonitor({
  check = (signal) => requestRuntimeHealth({ signal }),
  onState,
  schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancelSchedule = (timerId) => globalThis.clearTimeout(timerId),
  connectedIntervalMs = 15000,
  unhealthyBackoffMs = [1000, 2000, 5000, 10000, 30000],
  recoveryDisplayMs = 3000,
}: RuntimeHealthMonitorOptions) {
  let running = false;
  let pollTimer: number | undefined;
  let recoveryTimer: number | undefined;
  let activeCheck: Promise<RuntimeHealthState> | undefined;
  let controller: AbortController | undefined;
  let state = INITIAL_RUNTIME_HEALTH;
  let unhealthyAttempts = 0;

  const publish = (next: RuntimeHealthState) => {
    if (
      state.phase === next.phase &&
      state.runtimeIdentity === next.runtimeIdentity &&
      state.startedAt === next.startedAt
    ) return;
    state = next;
    onState(next);
  };

  const clearPoll = () => {
    if (pollTimer !== undefined) cancelSchedule(pollTimer);
    pollTimer = undefined;
  };

  const schedulePoll = (delayMs: number) => {
    clearPoll();
    if (!running) return;
    pollTimer = schedule(() => {
      pollTimer = undefined;
      void run("poll");
    }, delayMs);
  };

  const run = (reason: "startup" | "poll" | "manual"): Promise<RuntimeHealthState> => {
    if (activeCheck) return activeCheck;
    clearPoll();
    if (reason === "manual") publish({ ...state, phase: "rechecking" });
    controller = new AbortController();
    const previousPhase = state.phase;
    activeCheck = check(controller.signal)
      .then((result) => {
        if (!running) return result;
        const wasUnavailable = [
          "api_offline",
          "database_unavailable",
          "runtime_mismatch",
          "rechecking",
        ].includes(previousPhase);
        if (result.phase === "connected") {
          unhealthyAttempts = 0;
          if (wasUnavailable) {
            publish({ ...result, phase: "recovered" });
            if (recoveryTimer !== undefined) cancelSchedule(recoveryTimer);
            recoveryTimer = schedule(() => {
              recoveryTimer = undefined;
              if (running && state.phase === "recovered") publish({ ...state, phase: "connected" });
            }, recoveryDisplayMs);
          } else {
            publish(result);
          }
          schedulePoll(connectedIntervalMs);
        } else {
          publish(result);
          const delay = unhealthyBackoffMs[Math.min(unhealthyAttempts, unhealthyBackoffMs.length - 1)] ?? 30000;
          unhealthyAttempts += 1;
          schedulePoll(delay);
        }
        return state;
      })
      .finally(() => {
        activeCheck = undefined;
        controller = undefined;
      });
    return activeCheck;
  };

  return {
    start() {
      if (running) return;
      running = true;
      publish(INITIAL_RUNTIME_HEALTH);
      void run("startup");
    },
    stop() {
      running = false;
      clearPoll();
      if (recoveryTimer !== undefined) cancelSchedule(recoveryTimer);
      recoveryTimer = undefined;
      controller?.abort();
    },
    retry() {
      if (!running) return Promise.resolve(state);
      return run("manual");
    },
    getState() {
      return state;
    },
  };
}

export function runtimeHealthCopy(phase: RuntimeHealthPhase, development: boolean) {
  const devPrefix = development ? "DEV · " : "";
  switch (phase) {
    case "connected":
      return { label: `${devPrefix}Connected`, title: "Connected", message: "QuoteSuite API and database are available." };
    case "api_offline":
      return {
        label: `${devPrefix}API Offline`,
        title: development ? "Development API offline" : "Service unavailable",
        message: "QuoteSuite cannot currently connect to the application API. Showing previously loaded data; changes cannot be saved.",
      };
    case "database_unavailable":
      return {
        label: `${devPrefix}Database Offline`,
        title: "Database unavailable",
        message: "QuoteSuite is connected to the application server, but the database is not available. Showing previously loaded data; changes cannot be saved.",
      };
    case "runtime_mismatch":
      return {
        label: `${devPrefix}${development ? "Runtime Mismatch" : "Service Mismatch"}`,
        title: development ? "Development runtime mismatch" : "Service compatibility issue",
        message: development
          ? "The active QuoteSuite API is running an older or different development runtime. Restart the API before testing recent backend changes."
          : "The application and service versions are incompatible. Changes are paused until service compatibility is restored.",
      };
    case "rechecking":
      return { label: `${devPrefix}Rechecking`, title: "Rechecking connection", message: "Checking API and database readiness now." };
    case "recovered":
      return { label: `${devPrefix}Recovered`, title: "Connection restored", message: "API and database access have recovered. You can continue in the current workspace." };
    default:
      return { label: `${devPrefix}Connecting`, title: "Connecting", message: "Checking API and database readiness." };
  }
}
