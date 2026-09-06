import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { access, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createBrowserRunController } from "../scripts/browser-run-lifecycle.mjs";
import { createPhase6ProfileDirectory, phase6ProfileRoot } from "../scripts/e2e-chrome-profile.mjs";

function fakeOwnedRun(profile) {
  const child = new EventEmitter();
  Object.assign(child, {
    pid: 4101,
    exitCode: null,
    signalCode: null,
    spawnfile: "chrome.exe",
  });
  let processes = [
    { pid: 4101, parentPid: 40, creationDate: new Date().toISOString(), commandLine: `chrome.exe --headless=new --user-data-dir=${profile}` },
    { pid: 4102, parentPid: 4101, creationDate: new Date().toISOString(), commandLine: "chrome.exe --type=renderer" },
  ];
  const spawnImpl = () => {
    const taskkill = new EventEmitter();
    queueMicrotask(() => {
      processes = [];
      child.exitCode = 1;
      child.emit("exit", 1, null);
      taskkill.emit("exit", 0, null);
    });
    return taskkill;
  };
  return {
    child,
    processOptions: {
      platformName: "win32",
      spawnImpl,
      listChromeProcessesImpl: async () => processes,
    },
  };
}

test("a deliberately failed browser assertion still removes its full owned tree and profile", async () => {
  const profile = await createPhase6ProfileDirectory();
  await writeFile(join(profile, "marker"), "owned");
  const owned = fakeOwnedRun(profile);
  const controller = createBrowserRunController({ throwOnLeak: true, processOptions: owned.processOptions });
  controller.setRun({ label: "deliberate-assertion-failure", userDataDir: profile, child: owned.child, startedAt: new Date().toISOString() });

  let assertionFailure = null;
  let cleanup = null;
  try {
    assert.fail("deliberate browser assertion failure");
  } catch (error) {
    assertionFailure = error;
  } finally {
    cleanup = await controller.stop("assertion-failure");
  }

  assert.match(assertionFailure?.message ?? "", /deliberate browser assertion failure/);
  assert.equal(cleanup.verified, true);
  assert.equal(cleanup.ownedBrowserProcessesRemaining, 0);
  assert.equal(cleanup.ownedTemporaryProfilesRemaining, 0);
  await assert.rejects(access(profile));
});

test("cleanup fails closed when its owned profile still exists", async (t) => {
  const profile = await createPhase6ProfileDirectory();
  t.after(() => rm(profile, { recursive: true, force: true }));
  const owned = fakeOwnedRun(profile);
  const controller = createBrowserRunController({
    throwOnLeak: true,
    processOptions: owned.processOptions,
    profileCleanupOptions: { rmImpl: async () => {} },
  });
  controller.setRun({ label: "retained-profile", userDataDir: profile, child: owned.child, startedAt: new Date().toISOString() });

  await assert.rejects(
    controller.stop("failure"),
    /owned browser processes remaining=0; owned temporary profiles remaining=1/,
  );
});

test("profile creation is registered before the initial process inventory can fail", async () => {
  const profile = join(phase6ProfileRoot(), "run-inventory-failure");
  const controller = createBrowserRunController({
    throwOnLeak: true,
    processOptions: { listChromeProcessesImpl: async () => { throw new Error("inventory unavailable"); } },
  });

  await assert.rejects(
    controller.createProfile(
      { label: "inventory-failure" },
      {
        mkdirImpl: async () => {},
        mkdtempImpl: async () => {
          await import("node:fs/promises").then(({ mkdir }) => mkdir(profile, { recursive: true }));
          return profile;
        },
      },
    ),
    /inventory unavailable/,
  );
  await assert.rejects(access(profile));
});

test("every Chrome acceptance launcher uses the shared verified lifecycle", async () => {
  const scriptsDirectory = new URL("../scripts/", import.meta.url);
  const names = (await readdir(scriptsDirectory)).filter((name) => name.endsWith(".mjs"));
  const launchers = [];
  for (const name of names) {
    const source = await readFile(new URL(name, scriptsDirectory), "utf8");
    if (!source.includes("--remote-debugging-port")) continue;
    launchers.push(name);
    assert.match(source, /createBrowserRunController/, `${name} must use the shared lifecycle controller`);
    assert.match(source, /\.createProfile\(/, `${name} must atomically create and register a unique managed profile`);
    assert.doesNotMatch(source, /createPhase6ProfileDirectory/, `${name} must not create an unregistered profile`);
    assert.match(source, /installInterruptHandlers\(\)/, `${name} must install interrupt cleanup`);
    assert.match(source, /finally/, `${name} must clean up from finally`);
    assert.match(source, /\.stop\(/, `${name} must await verified cleanup`);
    assert.doesNotMatch(source, /taskkill[^\n]*(?:\/IM|-IM)[^\n]*chrome/i, `${name} must never broadly terminate Chrome`);
  }
  assert.ok(launchers.length >= 26, `Expected the complete Chrome launcher estate, found ${launchers.length}`);
});
