import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

function waitForExit(child, timeoutMs, wait = delay) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    wait(timeoutMs).then(() => false),
  ]);
}

function runCommand(command, args, spawnImpl = spawn) {
  return new Promise((resolve) => {
    const process = spawnImpl(command, args, { stdio: "ignore", shell: false });
    process.once("error", () => resolve(false));
    process.once("exit", (code) => resolve(code === 0));
  });
}

export async function terminateOwnedProcessTree(child, options = {}) {
  if (!child?.pid) return { exited: true, forced: false };
  const platformName = options.platformName ?? process.platform;
  const timeoutMs = options.timeoutMs ?? 5000;

  if (platformName === "win32") {
    const taskkillCompleted = await runCommand(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      options.spawnImpl,
    );
    const exited = await waitForExit(child, timeoutMs, options.delayImpl);
    return { exited, forced: true, taskkillCompleted };
  }

  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  if (await waitForExit(child, options.gracefulTimeoutMs ?? 3000, options.delayImpl)) {
    return { exited: true, forced: false };
  }
  child.kill("SIGKILL");
  return { exited: await waitForExit(child, timeoutMs, options.delayImpl), forced: true };
}

export async function terminateOwnedProcessTrees(children, options = {}) {
  const results = [];
  for (const child of [...children].reverse()) {
    results.push(await terminateOwnedProcessTree(child, options));
  }
  return results;
}
