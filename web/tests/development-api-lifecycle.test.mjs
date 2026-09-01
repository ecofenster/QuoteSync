import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import test from "node:test";
import {
  captureDevelopmentApiBaseline,
  createDevelopmentApiLifecycle,
  parseWindowsNetstatListeners,
  probeDevelopmentApi,
} from "../scripts/development-api-lifecycle.mjs";
import { terminateOwnedProcessTree } from "../scripts/e2e-owned-process.mjs";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";

const listen = (server, port = 0) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

function runtimeHealth(overrides = {}) {
  return {
    apiAvailable: true,
    databaseAvailable: true,
    status: "connected",
    environment: "development",
    runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family,
    runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version,
    runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity,
    capabilities: [...QUOTESUITE_RUNTIME_CONTRACT.capabilities],
    databaseType: "sqlite",
    startedAt: new Date(0).toISOString(),
    instanceId: "isolated-test-api",
    serverEntry: "server/index.js",
    ...overrides,
  };
}

function healthServer(payload) {
  return http.createServer((request, response) => {
    if (request.url !== "/api/health") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(payload.databaseAvailable === false ? 503 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
}

async function baselineFor(baseUrl, port) {
  return captureDevelopmentApiBaseline({
    baseUrl,
    port,
    processInspector: async () => [{ pid: process.pid, parentPid: process.ppid, commandLine: process.argv.join(" ") }],
  });
}

test("Windows listener parsing returns only exact LISTENING PIDs without duplicates", () => {
  const output = [
    "  TCP    0.0.0.0:3001      0.0.0.0:0       LISTENING       28232",
    "  TCP    [::]:3001         [::]:0          LISTENING       28232",
    "  TCP    127.0.0.1:30010   0.0.0.0:0       LISTENING       99999",
    "  TCP    127.0.0.1:3001    127.0.0.1:52000 ESTABLISHED     28232",
  ].join("\r\n");
  assert.deepEqual(parseWindowsNetstatListeners(output, 3001), [28232]);
});

test("a healthy compatible pre-existing API is reused and preserved", async (t) => {
  const owner = healthServer(runtimeHealth());
  const port = await listen(owner);
  t.after(() => close(owner));
  let spawnCount = 0;
  let terminateCount = 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  const lifecycle = createDevelopmentApiLifecycle({
    port,
    baseUrl,
    inspectImpl: () => baselineFor(baseUrl, port),
    spawnImpl: () => { spawnCount += 1; throw new Error("must not spawn"); },
    terminateOwnedImpl: async () => { terminateCount += 1; },
  });

  const first = await lifecycle.ensureAvailable();
  const second = await lifecycle.ensureAvailable();
  const restored = await lifecycle.cleanup();

  assert.equal(first.mode, "reused");
  assert.equal(second.mode, "reused");
  assert.equal(spawnCount, 0);
  assert.equal(terminateCount, 0);
  assert.equal(restored.current.compatible, true);
  assert.equal(owner.listening, true);
});

test("a compatible API with an unavailable database is still reused rather than duplicated", async (t) => {
  const owner = healthServer(runtimeHealth({ databaseAvailable: false, status: "database_unavailable" }));
  const port = await listen(owner);
  t.after(() => close(owner));
  const baseUrl = `http://127.0.0.1:${port}`;
  const lifecycle = createDevelopmentApiLifecycle({
    port,
    baseUrl,
    inspectImpl: () => baselineFor(baseUrl, port),
    spawnImpl: () => { throw new Error("must not spawn"); },
  });

  const result = await lifecycle.ensureAvailable();
  assert.equal(result.mode, "reused");
  assert.equal(result.baseline.state, "database_unavailable");
  assert.equal(owner.listening, true);
});

test("an occupied stale runtime is detected, never replaced, and remains owned by its original process", async (t) => {
  const owner = healthServer(runtimeHealth({ runtimeIdentity: "quotesuite-stale-runtime" }));
  const port = await listen(owner);
  t.after(() => close(owner));
  const baseUrl = `http://127.0.0.1:${port}`;
  let spawnCount = 0;
  let terminateCount = 0;
  const lifecycle = createDevelopmentApiLifecycle({
    port,
    baseUrl,
    inspectImpl: () => baselineFor(baseUrl, port),
    spawnImpl: () => { spawnCount += 1; throw new Error("must not spawn"); },
    terminateOwnedImpl: async () => { terminateCount += 1; },
  });

  await assert.rejects(lifecycle.ensureAvailable(), (error) => error.code === "QUOTESUITE_API_PORT_OCCUPIED");
  assert.equal(spawnCount, 0);
  assert.equal(terminateCount, 0);
  assert.equal(owner.listening, true);
});

test("no listener produces one temporary owned API and cleanup restores the free port", async () => {
  const reservation = http.createServer();
  const port = await listen(reservation);
  await close(reservation);
  const baseUrl = `http://127.0.0.1:${port}`;
  const payload = JSON.stringify(runtimeHealth());
  const fixture = `const http=require('node:http');const body=${JSON.stringify(payload)};const server=http.createServer((req,res)=>{if(req.url!=='/api/health'){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':'application/json'});res.end(body)});server.listen(Number(process.env.PORT),'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`;
  let spawnCount = 0;
  let terminatedPid = null;
  const lifecycle = createDevelopmentApiLifecycle({
    port,
    baseUrl,
    inspectImpl: () => baselineFor(baseUrl, port),
    spawnImpl: (_command, _args, options) => {
      spawnCount += 1;
      return spawn(process.execPath, ["-e", fixture], options);
    },
    terminateOwnedImpl: async (child, options) => {
      terminatedPid = child.pid;
      return terminateOwnedProcessTree(child, options);
    },
  });

  const first = await lifecycle.ensureAvailable();
  const second = await lifecycle.ensureAvailable();
  assert.equal(first.mode, "started_temporary");
  assert.equal(second.pid, first.pid);
  assert.equal(spawnCount, 1);
  assert.equal((await probeDevelopmentApi({ baseUrl })).compatible, true);

  const restored = await lifecycle.cleanup();
  assert.equal(terminatedPid, first.pid);
  assert.equal(restored.current.listening, false);
  assert.equal((await probeDevelopmentApi({ baseUrl, port })).state, "offline");
});

test("development API tooling contains no broad Node termination", async () => {
  const lifecycleSource = await readFile(new URL("../scripts/development-api-lifecycle.mjs", import.meta.url), "utf8");
  const ownedProcessSource = await readFile(new URL("../scripts/e2e-owned-process.mjs", import.meta.url), "utf8");
  const source = `${lifecycleSource}\n${ownedProcessSource}`;
  assert.doesNotMatch(source, /Stop-Process\s+-Name\s+node/i);
  assert.doesNotMatch(source, /taskkill[^\n]*(?:\/IM|-IM)[^\n]*node/i);
  assert.match(ownedProcessSource, /taskkill[\s\S]*"\/PID", String\(child\.pid\), "\/T", "\/F"/);
});

test("AGENTS permanently assigns the persistent API to the user and requires baseline restoration", async () => {
  const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(agents, /user owns the normal persistent QuoteSuite development API/i);
  assert.match(agents, /capture whether it was listening plus its PID, parent PID, command line, start time and runtime contract/i);
  assert.match(agents, /temporary Codex-owned infrastructure/);
  assert.match(agents, /restore port 3001 to not listening/);
  assert.match(agents, /Broad Node termination[\s\S]*prohibited/);
  assert.match(agents, /`node index\.js` from `web\\server` and `npm run api` from `web`/);
});
