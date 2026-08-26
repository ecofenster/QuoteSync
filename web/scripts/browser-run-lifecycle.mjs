import { randomUUID } from "node:crypto";
import { countChromeProcessesForProfile, terminateChromeProcessesForProfile } from "./e2e-owned-process.mjs";
import { isManagedPhase6ProfilePath, cleanupPhase6Profile, terminateOwnedChrome } from "./e2e-chrome-profile.mjs";

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
    return {
      skipped: true,
      reason: "profile path is not managed",
      profile: run.userDataDir,
      leak: false,
    };
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
    throwOnLeak: options.throwOnLeak ?? true,
    skipped: false,
  };

  summary.profileProcessCountBefore =
    run.profileProcessCountBefore ??
    (await countChromeProcessesForProfile(run.userDataDir, processOptions));
  summary.profileProcessCountDuring =
    run.profileProcessCountDuring ??
    (await countChromeProcessesForProfile(run.userDataDir, processOptions));

  if (run.child) {
    summary.ownedChromeTermination = await terminateOwnedChrome(run.child, options.terminateOptions);
  } else {
    summary.ownedChromeTermination = { skipped: true, reason: "no child process handle" };
  }

  summary.profileProcessKills = await terminateChromeProcessesForProfile(run.userDataDir, processOptions);
  summary.profileCleanup = await cleanupPhase6Profile(run.userDataDir, options.profileCleanupOptions);
  summary.profileProcessCountAfter = await countChromeProcessesForProfile(run.userDataDir, processOptions);
  summary.leak = summary.profileProcessCountAfter > 0;

  if (summary.leak && summary.throwOnLeak) {
    throw new Error(`QuoteSync-owned Chrome processes were not fully removed for profile ${summary.profile}; remaining=${summary.profileProcessCountAfter}`);
  }

  return summary;
}

export function createBrowserRunController(options = {}) {
  let activeRun = null;
  let installed = false;
  let cleaning = false;

  function normalizeRun(run) {
    if (!run) return null;
    return {
      runId: run.runId ?? randomUUID(),
      profileProcessCountBefore: run.profileProcessCountBefore,
      profileProcessCountDuring: run.profileProcessCountDuring,
      profileProcessCountAfter: run.profileProcessCountAfter,
      startedAt: run.startedAt ?? new Date().toISOString(),
      ...run,
    };
  }

  async function stop(reason = "final") {
    if (cleaning) {
      return { skipped: true, reason: "cleanup already in progress", run: activeRun };
    }

    cleaning = true;
    const run = activeRun;
    activeRun = null;
    try {
      if (!run) {
        return {
          skipped: true,
          reason: "no active run",
        };
      }
      return await cleanupBrowserRun({ ...run, stoppedReason: reason }, { ...options, throwOnLeak: options.throwOnLeak ?? true });
    } finally {
      cleaning = false;
    }
  }

  function setRun(run) {
    const profileProcessCountBefore = activeRun?.profileProcessCountBefore;
    activeRun = normalizeRun({ ...(activeRun ?? {}), ...(run ?? {}) });
    if (profileProcessCountBefore !== undefined) activeRun.profileProcessCountBefore = profileProcessCountBefore;
    return activeRun;
  }

  function clearRun() {
    activeRun = null;
  }

  function installInterruptHandlers() {
    if (installed) return;
    installed = true;
    const handler = (signal) => {
      const code = DEFAULT_SIGNAL_CODES[signal] ?? 130;
      void stop(signal).finally(() => {
        process.exitCode = 1;
        process.exit(code);
      });
    };
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
    process.on("SIGBREAK", handler);
  }

  return {
    setRun,
    clearRun,
    stop,
    installInterruptHandlers,
  };
}

export async function countBrowserRunProfiles(profilePath, options = {}) {
  return countChromeProcessesForProfile(profilePath, options);
}
