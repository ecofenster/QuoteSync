import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { countChromeProcessesForProfile, countOwnedChromeProcesses, terminateOwnedChromeProcessTree, terminateOwnedProcessTree } from "./e2e-owned-process.mjs";
import { isManagedPhase6ProfilePath, cleanupPhase6Profile, createPhase6ProfileDirectory } from "./e2e-chrome-profile.mjs";

const DEFAULT_SIGNAL_CODES = Object.freeze({
  SIGINT: 130,
  SIGTERM: 143,
  SIGBREAK: 130,
});

export async function cleanupBrowserRun(run, options = {}) {
  if (!run?.userDataDir) {
    return {
      skipped: true,
      reason: "run profile was not set",
      leak: false,
    };
  }

  if (!isManagedPhase6ProfilePath(run.userDataDir)) {
    throw new Error(`Refusing browser cleanup for unmanaged profile path: ${run.userDataDir}`);
  }

  const processOptions = {
    platformName: run.platformName ?? process.platform,
    ...(options.processOptions ?? {}),
  };

  const summary = {
    label: run.label ?? "browser-run",
    runId: run.runId ?? randomUUID(),
    profile: run.userDataDir,
    debugPort: run.debugPort,
    startedAt: run.startedAt,
    childPid: run.child?.pid ?? null,
    rootPid: run.rootPid ?? run.child?.pid ?? null,
    rootIdentity: run.rootIdentity ?? null,
    throwOnLeak: options.throwOnLeak ?? true,
    skipped: false,
    profileProcessCountBefore: run.profileProcessCountBefore ?? null,
    profileProcessCountDuring: run.profileProcessCountDuring ?? null,
  };

  const cleanupErrors = [];
  try {
    summary.ownedProcessCountBeforeCleanup = await countOwnedChromeProcesses(run, processOptions);
  } catch (error) {
    summary.ownedProcessCountBeforeCleanup = null;
    cleanupErrors.push(error);
  }

  try {
    summary.rootTreeTermination = run.child
      ? await terminateOwnedProcessTree(run.child, { ...processOptions, ...(options.terminateOptions ?? {}) })
      : { skipped: true, reason: "no child process handle" };
  } catch (error) {
    summary.rootTreeTermination = { failed: true, error: error?.message ?? String(error) };
    cleanupErrors.push(error);
  }

  try {
    summary.descendantTreeTermination = await terminateOwnedChromeProcessTree(run, {
      processOptions,
      ...(options.treeTerminationOptions ?? {}),
    });
  } catch (error) {
    summary.descendantTreeTermination = { failed: true, error: error?.message ?? String(error) };
    cleanupErrors.push(error);
  }

  try {
    summary.profileCleanup = await cleanupPhase6Profile(run.userDataDir, options.profileCleanupOptions);
  } catch (error) {
    summary.profileCleanup = { removed: false, error: error?.message ?? String(error) };
    cleanupErrors.push(error);
  }

  try {
    summary.ownedProcessCountAfter = await countOwnedChromeProcesses(run, processOptions);
    summary.profileProcessCountAfter = await countChromeProcessesForProfile(run.userDataDir, processOptions);
  } catch (error) {
    summary.ownedProcessCountAfter = null;
    summary.profileProcessCountAfter = null;
    cleanupErrors.push(error);
  }

  try {
    await access(run.userDataDir);
    summary.ownedProfileCountAfter = 1;
  } catch (error) {
    summary.ownedProfileCountAfter = error?.code === "ENOENT" ? 0 : null;
    if (error?.code !== "ENOENT") cleanupErrors.push(error);
  }

  summary.ownedBrowserProcessesRemaining = summary.ownedProcessCountAfter;
  summary.ownedTemporaryProfilesRemaining = summary.ownedProfileCountAfter;
  summary.verified = cleanupErrors.length === 0 && summary.ownedProcessCountAfter === 0 && summary.ownedProfileCountAfter === 0;
  summary.leak = !summary.verified;

  if (summary.leak && summary.throwOnLeak) {
    const failure = new Error(
      `Browser cleanup verification failed for ${summary.label}; owned browser processes remaining=${summary.ownedProcessCountAfter ?? "unverified"}; owned temporary profiles remaining=${summary.ownedProfileCountAfter ?? "unverified"}`,
    );
    failure.summary = summary;
    if (cleanupErrors.length > 0) failure.cause = cleanupErrors[0];
    throw failure;
  }

  return summary;
}

export function createBrowserRunController(options = {}) {
  let activeRun = null;
  let installed = false;
  let cleanupPromise = null;

  function normalizeRun(run) {
    if (!run) return null;
    return {
      runId: run.runId ?? randomUUID(),
      profileProcessCountBefore: run.profileProcessCountBefore,
      profileProcessCountDuring: run.profileProcessCountDuring,
      profileProcessCountAfter: run.profileProcessCountAfter,
      startedAt: run.startedAt ?? new Date().toISOString(),
      ...run,
      rootPid: run.rootPid ?? run.child?.pid ?? activeRun?.rootPid ?? null,
      rootIdentity: run.rootIdentity ?? (run.child?.pid ? {
        pid: run.child.pid,
        executable: run.child.spawnfile ?? null,
        spawnedAt: new Date().toISOString(),
      } : activeRun?.rootIdentity ?? null),
    };
  }

  async function stop(reason = "final") {
    if (cleanupPromise) return cleanupPromise;
    const run = activeRun;
    if (!run) {
      return {
        skipped: true,
        reason: "no active run",
      };
    }

    cleanupPromise = cleanupBrowserRun(
      { ...run, stoppedReason: reason },
      { ...options, throwOnLeak: options.throwOnLeak ?? true },
    );
    try {
      const result = await cleanupPromise;
      activeRun = null;
      return result;
    } catch (error) {
      activeRun = run;
      throw error;
    } finally {
      cleanupPromise = null;
    }
  }

  function setRun(run) {
    const profileProcessCountBefore = activeRun?.profileProcessCountBefore;
    const startedAt = activeRun?.startedAt;
    activeRun = normalizeRun({ ...(activeRun ?? {}), ...(run ?? {}) });
    if (profileProcessCountBefore !== undefined) activeRun.profileProcessCountBefore = profileProcessCountBefore;
    if (startedAt !== undefined) activeRun.startedAt = startedAt;
    return activeRun;
  }

  function clearRun() {
    activeRun = null;
  }

  async function createProfile(run = {}, profileOptions = {}) {
    const userDataDir = await createPhase6ProfileDirectory(profileOptions);
    setRun({ ...run, userDataDir, startedAt: run.startedAt ?? new Date().toISOString() });
    try {
      const profileProcessCountBefore = await countBrowserRunProfiles(userDataDir, options.processOptions ?? {});
      setRun({ profileProcessCountBefore });
      return userDataDir;
    } catch (error) {
      try {
        await stop("profile-initialization-failure");
      } catch (cleanupError) {
        error.cleanupError = cleanupError;
      }
      throw error;
    }
  }

  function installInterruptHandlers() {
    if (installed) return;
    installed = true;
    let terminating = false;
    const terminateAfterCleanup = (reason, code, error) => {
      if (terminating) return;
      terminating = true;
      void stop(reason).catch((cleanupError) => {
        console.error(cleanupError);
        process.exitCode = 1;
      }).finally(() => {
        if (error) console.error(error);
        process.exit(code);
      });
    };
    const signalHandler = (signal) => {
      const code = DEFAULT_SIGNAL_CODES[signal] ?? 130;
      terminateAfterCleanup(signal, code);
    };
    process.once("SIGINT", signalHandler);
    process.once("SIGTERM", signalHandler);
    process.once("SIGBREAK", signalHandler);
    process.once("beforeExit", () => {
      if (!activeRun || terminating) return;
      void stop("beforeExit").catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
    process.once("uncaughtException", (error) => terminateAfterCleanup("uncaughtException", 1, error));
    process.once("unhandledRejection", (error) => terminateAfterCleanup("unhandledRejection", 1, error));
  }

  return {
    setRun,
    createProfile,
    clearRun,
    stop,
    installInterruptHandlers,
  };
}

export async function countBrowserRunProfiles(profilePath, options = {}) {
  return countChromeProcessesForProfile(profilePath, options);
}
