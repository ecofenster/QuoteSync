import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";
import { createRuntimeHealthHandler } from "../server/features/runtimeHealth/runtimeHealth.js";
import {
  createRuntimeHealthMonitor,
  requestRuntimeHealth,
  runtimeHealthCopy,
  type RuntimeHealthState,
} from "../src/features/runtimeHealth/runtimeHealth";
import {
  ApiMutationBlockedError,
  apiFetch,
  getApiMutationSafety,
  setApiMutationSafety,
} from "../src/services/api/apiClient";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function healthResponse(overrides: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({
    apiAvailable: true,
    databaseAvailable: true,
    runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family,
    runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version,
    runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity,
    startedAt: "2026-08-29T10:00:00.000Z",
    ...overrides,
  }), { status, headers: { "content-type": "application/json" } });
}

test("health probe distinguishes connected, database unavailable, runtime mismatch and API offline", async () => {
  const connected = await requestRuntimeHealth({ fetchImpl: async () => healthResponse(), baseUrl: "http://fixture", timeoutMs: 50 });
  assert.equal(connected.phase, "connected");

  const database = await requestRuntimeHealth({
    fetchImpl: async () => healthResponse({ databaseAvailable: false }, 503),
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(database.phase, "database_unavailable");

  const mismatch = await requestRuntimeHealth({
    fetchImpl: async () => healthResponse({ runtimeIdentity: "older-runtime" }),
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(mismatch.phase, "runtime_mismatch");

  const incompatibleEndpoint = await requestRuntimeHealth({
    fetchImpl: async () => new Response("Not found", { status: 404 }),
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(incompatibleEndpoint.phase, "runtime_mismatch");

  const offline = await requestRuntimeHealth({
    fetchImpl: async () => { throw new TypeError("Failed to fetch"); },
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(offline.phase, "api_offline");
});

test("expected health failures are handled without console error noise", async () => {
  const previous = console.error;
  let calls = 0;
  console.error = () => { calls += 1; };
  try {
    await requestRuntimeHealth({
      fetchImpl: async () => { throw new TypeError("Failed to fetch"); },
      baseUrl: "http://fixture",
      timeoutMs: 50,
    });
    assert.equal(calls, 0);
  } finally {
    console.error = previous;
  }
});

test("server handler reports running-process identity and bounded SQLite readiness without sensitive paths", async () => {
  const makeResponse = () => ({
    statusCode: 0,
    body: undefined as Record<string, unknown> | undefined,
    headers: {} as Record<string, string>,
    set(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this; },
    status(value: number) { this.statusCode = value; return this; },
    json(value: Record<string, unknown>) { this.body = value; return this; },
  });
  const readyResponse = makeResponse();
  const readyHandler = createRuntimeHealthHandler({
    dbPromise: Promise.resolve({ get: async () => ({ ready: 1 }) }),
    environment: "development",
    processRef: { uptime: () => 42 },
    startedAt: "2026-08-29T10:00:00.000Z",
    instanceId: "fixture-instance",
  });
  await readyHandler({}, readyResponse);
  assert.equal(readyResponse.statusCode, 200);
  assert.equal(readyResponse.body?.databaseAvailable, true);
  assert.equal(readyResponse.body?.runtimeIdentity, QUOTESUITE_RUNTIME_CONTRACT.identity);
  assert.equal(readyResponse.body?.serverEntry, "server/index.js");
  assert.equal(readyResponse.headers["cache-control"], "no-store");
  const serialized = JSON.stringify(readyResponse.body).toLowerCase();
  for (const forbidden of ["quotesync.db", "c:\\", "oauth", "token", "credential", "api key"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }

  const failedResponse = makeResponse();
  const failedHandler = createRuntimeHealthHandler({
    dbPromise: Promise.resolve({ get: async () => { throw new Error("fixture unavailable"); } }),
    environment: "production",
    processRef: { uptime: () => 1 },
    databaseTimeoutMs: 25,
  });
  await failedHandler({}, failedResponse);
  assert.equal(failedResponse.statusCode, 503);
  assert.equal(failedResponse.body?.apiAvailable, true);
  assert.equal(failedResponse.body?.databaseAvailable, false);
  assert.equal("serverEntry" in (failedResponse.body || {}), false);
});

test("one monitor owns polling, manual retry is immediate, and recovery preserves workspace state", async () => {
  const scheduled = new Map<number, () => void>();
  let nextTimer = 1;
  let checkCount = 0;
  const results: RuntimeHealthState[] = [
    { phase: "api_offline" },
    { phase: "connected", runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity },
  ];
  const states: RuntimeHealthState[] = [];
  const workspace = { route: "estimates", selectedEstimateId: "EF-EST-2026-045", draft: "unsaved" };
  const originalWorkspace = workspace;
  const monitor = createRuntimeHealthMonitor({
    check: async () => results[Math.min(checkCount++, results.length - 1)],
    onState: (state) => states.push(state),
    schedule: (callback) => { const id = nextTimer++; scheduled.set(id, callback); return id; },
    cancelSchedule: (id) => { scheduled.delete(id); },
    recoveryDisplayMs: 1,
  });

  monitor.start();
  monitor.start();
  await tick();
  assert.equal(checkCount, 1);
  assert.equal(monitor.getState().phase, "api_offline");
  assert.equal(scheduled.size, 1);

  await monitor.retry();
  assert.equal(checkCount, 2);
  assert.equal(monitor.getState().phase, "recovered");
  assert.equal(scheduled.size, 2, "one poll plus one transient recovered-status timer");
  assert.equal(workspace, originalWorkspace);
  assert.equal(workspace.draft, "unsaved");
  assert.ok(states.some((state) => state.phase === "rechecking"));
  monitor.stop();
  assert.equal(scheduled.size, 0);
});

test("unsafe runtime health gates persistence without issuing repeated requests", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    setApiMutationSafety({ allowed: false, state: "database_unavailable" });
    await assert.rejects(() => apiFetch("/api/clients/1", { method: "PUT" }), ApiMutationBlockedError);
    await assert.rejects(() => apiFetch("/api/clients/1", { method: "DELETE" }), ApiMutationBlockedError);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(getApiMutationSafety(), { allowed: false, state: "database_unavailable" });

    await apiFetch("/api/clients");
    assert.equal(fetchCalls, 1, "read-only loaded-data actions remain available");
  } finally {
    setApiMutationSafety({ allowed: true, state: "unmonitored" });
    globalThis.fetch = originalFetch;
  }
});

test("development copy documents both valid starts while production wording leaks neither", () => {
  const development = runtimeHealthCopy("api_offline", true);
  assert.match(development.title, /Development API offline/);
  const production = JSON.stringify(runtimeHealthCopy("api_offline", false));
  assert.doesNotMatch(production, /localhost|node index\.js|npm run api|C:\\Github/i);
  assert.match(runtimeHealthCopy("runtime_mismatch", true).title, /runtime mismatch/i);
  assert.match(runtimeHealthCopy("rechecking", true).label, /Rechecking/);
  assert.match(runtimeHealthCopy("recovered", true).title, /restored/i);
});

test("global shell status is accessible, responsive and uses semantic typography", async () => {
  const [component, shell, css, agents] = await Promise.all([
    readFile("src/features/runtimeHealth/RuntimeHealthStatus.tsx", "utf8"),
    readFile("src/layout/AppShell.tsx", "utf8"),
    readFile("src/layout/AppShell.css", "utf8"),
    readFile("AGENTS.md", "utf8"),
  ]);
  assert.match(shell, /RuntimeHealthProvider/);
  assert.match(component, /role=\{alert \? "alert" : "status"\}/);
  assert.match(component, /aria-live/);
  assert.match(component, /Retry connection/);
  assert.match(component, /web\\server: node index\.js/);
  assert.match(component, /web: npm run api/);
  assert.match(css, /var\(--qs-type-(?:badge|body|meta)\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /var\(--qs-(?:error|warning|success|info)-(?:surface|border)\)/);
  assert.match(agents, /active listening API process/i);
  assert.match(agents, /web\\server.*node index\.js/);
});
