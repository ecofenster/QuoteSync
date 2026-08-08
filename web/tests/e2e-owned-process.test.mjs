import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { terminateOwnedProcessTree, terminateOwnedProcessTrees } from "../scripts/e2e-owned-process.mjs";

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
