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
import { projectCalculatorLabApi } from "../src/features/projectCalculatorLab/api/projectCalculatorLabApi";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function healthResponse(overrides: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({
    apiAvailable: true,
    databaseAvailable: true,
    runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family,
    runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version,
    runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity,
    capabilities: [...QUOTESUITE_RUNTIME_CONTRACT.capabilities],
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

  const missingSupplierInstallationChoice = await requestRuntimeHealth({
    fetchImpl: async () =>
      healthResponse({
        capabilities: QUOTESUITE_RUNTIME_CONTRACT.capabilities.filter(
          (capability) =>
            capability !== "project-costing-supplier-installation-choice-v1",
        ),
      }),
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(missingSupplierInstallationChoice.phase, "runtime_mismatch");

  const missingInstallationComponentChoices = await requestRuntimeHealth({
    fetchImpl: async () =>
      healthResponse({
        capabilities: QUOTESUITE_RUNTIME_CONTRACT.capabilities.filter(
          (capability) =>
            capability !== "project-costing-installation-component-choices-v1",
        ),
      }),
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(missingInstallationComponentChoices.phase, "runtime_mismatch");

  const missingLiveExchangeRate = await requestRuntimeHealth({
    fetchImpl: async () =>
      healthResponse({
        capabilities: QUOTESUITE_RUNTIME_CONTRACT.capabilities.filter(
          (capability) => capability !== "project-costing-live-exchange-rate-v1",
        ),
      }),
    baseUrl: "http://fixture",
    timeoutMs: 50,
  });
  assert.equal(missingLiveExchangeRate.phase, "runtime_mismatch");

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
  assert.ok(readyResponse.body?.capabilities.includes("internorm-aspect-schedule-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("internorm-three-dealer-contract-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("internorm-pdf-image-ownership-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("manufacturer-commercial-isolation-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("supplier-commercial-classification-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("product-supply-reconciliation-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-installation-materials-contract-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-installation-current-catalogue-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-supplier-installation-choice-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-installation-component-choices-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-global-import-customs-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-live-exchange-rate-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("project-costing-fixed-estimate-rate-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("manufacturer-raw-pdf-extraction-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("manufacturer-three-role-identity-position-previews-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("manufacturer-four-role-commercial-supplier-gate-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("manufacturer-commercial-supplier-auto-proposal-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("supplier-current-availability-delete-v1"));
  assert.ok(readyResponse.body?.capabilities.includes("quotation-package-canonical-source-pricing-v1"));
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

test("legacy supplier-choice responses fail visibly instead of reverting the control silently", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "scenario",
        supplierCosts: [
          {
            id: "supplier-installation",
            category: "other",
            sourceSnapshot: { commercialRole: "installation" },
            includedInCurrentEstimate: true,
            inclusionEvidence: "Explicitly included in the selected supplier package total.",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    setApiMutationSafety({ allowed: true, state: "unmonitored" });
    await assert.rejects(
      () =>
        projectCalculatorLabApi.updateSupplierCost(
          "scenario",
          "supplier-installation",
          { includedInCurrentEstimate: true },
        ),
      /did not persist the supplier commercial choice/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    setApiMutationSafety({ allowed: true, state: "unmonitored" });
  }
});

test("legacy Installation profile responses fail visibly instead of reverting a component toggle", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ id: "scenario", products: [], supplierCosts: [], packageItems: [], routeSnapshots: [], exchangeRates: [], revisions: [], options: { installationProfile: {} } }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    setApiMutationSafety({ allowed: true, state: "unmonitored" });
    await assert.rejects(
      () => projectCalculatorLabApi.updateInstallationProfile("scenario", { componentInclusions: { food: false } }),
      /did not persist the Installation component choice/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    setApiMutationSafety({ allowed: true, state: "unmonitored" });
  }
});

test("development copy identifies runtime recovery while production wording leaks no local commands", () => {
  const development = runtimeHealthCopy("api_offline", true);
  assert.match(development.title, /Development API offline/);
  const production = JSON.stringify(runtimeHealthCopy("api_offline", false));
  assert.doesNotMatch(production, /localhost|node index\.js|npm run api|C:\\Github/i);
  assert.match(runtimeHealthCopy("runtime_mismatch", true).title, /runtime mismatch/i);
  assert.match(runtimeHealthCopy("rechecking", true).label, /Rechecking/);
  assert.match(runtimeHealthCopy("recovered", true).title, /restored/i);
});

test("automatic Project Costing synchronization waits for runtime recovery without weakening mutation gating", async () => {
  const workspace = await readFile("src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx", "utf8");
  assert.match(workspace, /useOptionalRuntimeHealth/);
  assert.match(workspace, /runtimeAllowsMutations/);
  assert.match(workspace, /estimateId && !initialScenarioId && runtimeReady/);
  assert.match(workspace, /error instanceof ApiMutationBlockedError/);
  assert.match(workspace, /waiting for the QuoteSuite service to reconnect/);
  assert.match(workspace, /error instanceof ApiMutationBlockedError[\s\S]{0,260}return;[\s\S]{0,80}console\.error/);
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
  assert.match(component, /web: npm run dev:quotesuite/);
  assert.match(component, /reconnects here automatically/);
  assert.match(css, /var\(--qs-type-(?:badge|body|meta)\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /var\(--qs-(?:error|warning|success|info)-(?:surface|border)\)/);
  assert.match(agents, /active listening API process/i);
  assert.match(agents, /web\\server.*node index\.js/);
  assert.match(agents, /npm run dev:quotesuite/);
});
