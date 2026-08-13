import assert from "node:assert/strict";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import test from "node:test";
import { EventEmitter } from "node:events";
import { cleanupPhase6Profile, createPhase6ProfileDirectory, isManagedPhase6ProfilePath, phase6ProfileRoot, terminateOwnedChrome } from "../scripts/e2e-chrome-profile.mjs";

const repositoryRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));

test("Phase 6 profiles are unique and live beneath the OS temporary directory", async (t) => {
  const first = await createPhase6ProfileDirectory();
  const second = await createPhase6ProfileDirectory();
  t.after(() => Promise.all([rm(first, { recursive: true, force: true }), rm(second, { recursive: true, force: true })]));
  assert.notEqual(first, second);
  assert.equal(isManagedPhase6ProfilePath(first), true);
  assert.equal(relative(tmpdir(), first).startsWith(".."), false);
  assert.equal(relative(repositoryRoot, first).startsWith(".."), true);
});

for (const outcome of ["success", "failure"]) {
  test(`profile cleanup runs after simulated ${outcome}`, async () => {
    const profile = await createPhase6ProfileDirectory();
    await writeFile(resolve(profile, "marker"), outcome);
    const result = await cleanupPhase6Profile(profile);
    assert.equal(result.removed, true);
    await assert.rejects(access(profile));
  });
}

test("cleanup retries bounded EBUSY and EPERM failures", async () => {
  const profile = resolve(phase6ProfileRoot(), "run-simulated-lock");
  await mkdir(profile, { recursive: true });
  let calls = 0;
  const result = await cleanupPhase6Profile(profile, {
    delayImpl: async () => {},
    rmImpl: async (target, options) => {
      calls += 1;
      if (calls <= 2) throw Object.assign(new Error("locked"), { code: calls === 1 ? "EBUSY" : "EPERM" });
      await rm(target, options);
    },
  });
  assert.deepEqual({ removed: result.removed, attempts: result.attempts, calls }, { removed: true, attempts: 3, calls: 3 });
});

test("cleanup refuses paths outside its generated profile root", async () => {
  assert.equal(isManagedPhase6ProfilePath(repositoryRoot), false);
  await assert.rejects(cleanupPhase6Profile(repositoryRoot), /unmanaged Chrome profile/i);
});

test("forced Windows termination targets only the launched Chrome process tree", async () => {
  const launched = new EventEmitter();
  Object.assign(launched, { pid: 4242, exitCode: null, signalCode: null, kill: () => true });
  const calls = [];
  const result = await terminateOwnedChrome(launched, {
    platformName: "win32",
    gracefulTimeoutMs: 0,
    forceTimeoutMs: 10,
    delayImpl: async () => false,
    spawnImpl: (command, args) => {
      calls.push([command, args]);
      const taskkill = new EventEmitter();
      queueMicrotask(() => {
        launched.exitCode = 0;
        launched.emit("exit", 0, null);
        taskkill.emit("exit", 0, null);
      });
      return taskkill;
    },
  });
  assert.equal(result.forced, true);
  assert.deepEqual(calls, [["taskkill", ["/PID", "4242", "/T", "/F"]]]);
});

test("Vite retains narrow test-artifact watcher exclusions", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../vite.config.ts", import.meta.url), "utf8"));
  assert.match(source, /\*\*\/\.tmp-chrome-phase\*\/\*\*/);
  assert.match(source, /\*\*\/\.tmp-phase\*-tests\/\*\*/);
  assert.match(source, /\*\*\/\.tmp-edge-acceptance\/\*\*/);
  assert.match(source, /\*\*\/\.tmp-chrome-acceptance\*\/\*\*/);
});

test("Git ignores disposable in-repository browser acceptance profiles", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../.gitignore", import.meta.url), "utf8"));
  assert.match(source, /^\.tmp-edge-acceptance\/$/m);
  assert.match(source, /^\.tmp-chrome-acceptance\*\/$/m);
});
