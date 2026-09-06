import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";
import { createDevelopmentWorkspaceSupervisor } from "../scripts/development-workspace-supervisor.mjs";

async function reservePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

test("combined development supervisor restarts only its watched API and restores the empty port baseline", { timeout: 40_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "quotesuite-dev-watch-"));
  const entry = path.join(root, "watched-api.mjs");
  const port = await reservePort();
  const fixture = `import http from "node:http";
const startedAt=new Date().toISOString();
const body=${JSON.stringify(JSON.stringify({
    apiAvailable: true,
    databaseAvailable: true,
    runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family,
    runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version,
    runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity,
    serverEntry: "watched-test-api.mjs",
    capabilities: [...QUOTESUITE_RUNTIME_CONTRACT.capabilities],
  }))};
http.createServer((request,response)=>{if(request.url==="/api/health"){response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({...JSON.parse(body),startedAt}));return;}response.writeHead(404);response.end();}).listen(Number(process.env.PORT),process.env.HOST);`;
  await fs.writeFile(entry, fixture);
  const supervisor = createDevelopmentWorkspaceSupervisor({ cwd: root, apiPort: port, serverEntry: entry, startFrontend: false });
  t.after(async () => {
    await supervisor.stop("test_finally").catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  });

  const started = await supervisor.start();
  assert.equal(started.baseline.listening, false);
  assert.equal(started.api.compatible, true);
  const ownerPid = supervisor.ownedPids().apiWatcherPid;
  assert.ok(ownerPid);

  await fs.appendFile(entry, `\n// controlled restart ${Date.now()}\n`);
  const restarted = await supervisor.waitForRestart(started.api.health.startedAt);
  assert.equal(restarted.compatible, true);
  assert.notEqual(restarted.health.startedAt, started.api.health.startedAt);
  assert.equal(supervisor.ownedPids().apiWatcherPid, ownerPid);

  const cleanup = await supervisor.stop("test_complete");
  assert.equal(cleanup.baseline.listening, false);
  assert.equal(cleanup.current.listening, false);
  assert.deepEqual(cleanup.owned.map((item) => item.role), ["api-watch"]);
});

test("combined development supervisor refuses to take ownership of an existing API listener", async () => {
  const port = await reservePort();
  const occupied = createHttpServer((_request, response) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ runtimeFamily: "another-service" }));
  });
  await new Promise((resolve) => occupied.listen(port, "127.0.0.1", resolve));
  try {
    const supervisor = createDevelopmentWorkspaceSupervisor({ apiPort: port, startFrontend: false });
    await assert.rejects(() => supervisor.start(), (error) => error.code === "QUOTESUITE_DEV_API_ALREADY_OWNED");
    assert.deepEqual(supervisor.ownedPids(), { apiWatcherPid: null, frontendPid: null });
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
