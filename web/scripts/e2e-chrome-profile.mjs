import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const RETRYABLE_CLEANUP_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);

export function phase6ProfileRoot(osTemporaryDirectory = tmpdir()) {
  return resolve(osTemporaryDirectory, "QuoteSync", "e2e", "phase6");
}

export function isManagedPhase6ProfilePath(profilePath, osTemporaryDirectory = tmpdir()) {
  if (!profilePath || !isAbsolute(profilePath) || !basename(profilePath).startsWith("run-")) return false;
  const root = phase6ProfileRoot(osTemporaryDirectory);
  const candidate = resolve(profilePath);
  const child = relative(root, candidate);
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

export async function createPhase6ProfileDirectory(options = {}) {
  const root = phase6ProfileRoot(options.osTemporaryDirectory);
  await (options.mkdirImpl ?? mkdir)(root, { recursive: true });
  return (options.mkdtempImpl ?? mkdtemp)(join(root, "run-"));
}

export async function cleanupPhase6Profile(profilePath, options = {}) {
  if (!isManagedPhase6ProfilePath(profilePath, options.osTemporaryDirectory)) {
    throw Object.assign(new Error("Refusing to clean an unmanaged Chrome profile path."), { code: "UNMANAGED_PROFILE_PATH" });
  }
  const remove = options.rmImpl ?? rm;
  const wait = options.delayImpl ?? delay;
  const attempts = options.attempts ?? 11;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await remove(profilePath, { recursive: true, force: true });
      return { removed: true, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (!RETRYABLE_CLEANUP_CODES.has(error?.code) || attempt === attempts) break;
      await wait(100 * attempt);
    }
  }
  return { removed: false, attempts, error: lastError };
}

function waitForExit(child, timeoutMs, wait = delay) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return Promise.race([
    new Promise((resolvePromise) => child.once("exit", () => resolvePromise(true))),
    wait(timeoutMs).then(() => false),
  ]);
}

function runOwnedCommand(command, args, spawnImpl = spawn) {
  return new Promise((resolvePromise) => {
    const child = spawnImpl(command, args, { stdio: "ignore", shell: false });
    child.once("error", () => resolvePromise(false));
    child.once("exit", () => resolvePromise(true));
  });
}

export async function terminateOwnedChrome(child, options = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return { exited: true, forced: false };
  child.kill("SIGTERM");
  if (await waitForExit(child, options.gracefulTimeoutMs ?? 3000, options.delayImpl)) return { exited: true, forced: false };

  if ((options.platformName ?? process.platform) === "win32" && child.pid) {
    await runOwnedCommand("taskkill", ["/PID", String(child.pid), "/T", "/F"], options.spawnImpl);
  } else {
    child.kill("SIGKILL");
  }
  return { exited: await waitForExit(child, options.forceTimeoutMs ?? 3000, options.delayImpl), forced: true };
}
