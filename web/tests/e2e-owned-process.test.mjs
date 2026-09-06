import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { selectOwnedChromeProcesses, terminateOwnedChromeProcessTree, terminateOwnedProcessTree, terminateOwnedProcessTrees } from "../scripts/e2e-owned-process.mjs";

function child(pid) {
  const process = new EventEmitter();
  process.pid = pid;
  process.exitCode = null;
  process.signalCode = null;
  process.kill = () => {};
  return process;
}

test("Windows cleanup targets only the owned PID and its descendants", async () => {
  const owned = child(4242);
  const calls = [];
  const spawnImpl = (command, args, options) => {
    calls.push([command, args, options]);
    const taskkill = new EventEmitter();
    queueMicrotask(() => {
      owned.exitCode = 1;
      owned.emit("exit", 1, null);
      taskkill.emit("exit", 0, null);
    });
    return taskkill;
  };

  const result = await terminateOwnedProcessTree(owned, { platformName: "win32", spawnImpl });
  assert.equal(result.exited, true);
  assert.deepEqual(calls, [["taskkill", ["/PID", "4242", "/T", "/F"], { stdio: "ignore", shell: false }]]);
});

test("cleanup awaits every owned process in reverse launch order", async () => {
  const first = child(1001);
  const second = child(1002);
  const calls = [];
  const spawnImpl = (_command, args) => {
    calls.push(args[1]);
    const taskkill = new EventEmitter();
    queueMicrotask(() => {
      const target = args[1] === "1002" ? second : first;
      target.exitCode = 1;
      target.emit("exit", 1, null);
      taskkill.emit("exit", 0, null);
    });
    return taskkill;
  };

  const results = await terminateOwnedProcessTrees([first, second], { platformName: "win32", spawnImpl });
  assert.deepEqual(calls, ["1002", "1001"]);
  assert.ok(results.every((result) => result.exited));
});

test("owned Chrome discovery retains descendants after the profile-bearing root exits", () => {
  const startedAt = "2026-09-02T12:00:00.000Z";
  const profile = "C:\\Temp\\QuoteSync\\e2e\\phase6\\run-owned";
  const processes = [
    { pid: 2002, parentPid: 2001, creationDate: "2026-09-02T12:00:02.000Z", commandLine: "chrome.exe --type=renderer" },
    { pid: 2003, parentPid: 2002, creationDate: "2026-09-02T12:00:03.000Z", commandLine: "chrome.exe --type=utility" },
    { pid: 9001, parentPid: 8001, creationDate: "2026-09-02T12:00:03.000Z", commandLine: "chrome.exe --type=renderer" },
    { pid: 2004, parentPid: 2001, creationDate: "2026-09-01T12:00:00.000Z", commandLine: "chrome.exe --type=renderer" },
  ];

  const owned = selectOwnedChromeProcesses(processes, { rootPid: 2001, userDataDir: profile, startedAt });
  assert.deepEqual(owned.map((entry) => entry.pid), [2002, 2003]);
});

test("owned Chrome tree termination targets the exact subtree root and verifies absence", async () => {
  const profile = "C:\\Temp\\QuoteSync\\e2e\\phase6\\run-owned";
  let processes = [
    { pid: 3001, parentPid: 42, creationDate: "2026-09-02T12:00:01.000Z", commandLine: `chrome.exe --user-data-dir=${profile}` },
    { pid: 3002, parentPid: 3001, creationDate: "2026-09-02T12:00:02.000Z", commandLine: "chrome.exe --type=renderer" },
  ];
  const terminated = [];
  const result = await terminateOwnedChromeProcessTree(
    { rootPid: 3001, userDataDir: profile, startedAt: "2026-09-02T12:00:00.000Z" },
    {
      listChromeProcessesImpl: async () => processes,
      terminateChromeProcessByPidImpl: async (pid) => {
        terminated.push(pid);
        processes = [];
        return { pid, exited: true, forced: true };
      },
      delayImpl: async () => {},
    },
  );

  assert.deepEqual(terminated, [3001]);
  assert.equal(result.before.length, 2);
  assert.equal(result.remainingCount, 0);
});
