import { createDevelopmentWorkspaceSupervisor } from "./development-workspace-supervisor.mjs";

const supervisor = createDevelopmentWorkspaceSupervisor();
let finishing = false;

async function finish(reason, exitCode = 0) {
  if (finishing) return;
  finishing = true;
  try {
    const cleanup = await supervisor.stop(reason);
    if (cleanup) console.log(`[QuoteSuite dev] owned process cleanup complete (${reason}).`);
  } catch (error) {
    console.error("[QuoteSuite dev] cleanup failed", error);
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => void finish(signal));
}
process.once("uncaughtException", (error) => {
  console.error(error);
  void finish("uncaughtException", 1);
});
process.once("unhandledRejection", (error) => {
  console.error(error);
  void finish("unhandledRejection", 1);
});

try {
  const started = await supervisor.start();
  console.log(`[QuoteSuite dev] Vite and watched API started. API watch PID ${started.apiWatcherPid}; Vite PID ${started.frontendPid}.`);
  console.log("[QuoteSuite dev] Server/shared dependency changes restart the owned API; Vite handles frontend HMR.");
  const ended = await supervisor.waitForUnexpectedExit();
  console.error(`[QuoteSuite dev] ${ended.role} exited unexpectedly (code ${ended.code ?? "none"}, signal ${ended.signal ?? "none"}).`);
  await finish(`${ended.role}_exit`, 1);
} catch (error) {
  console.error(`[QuoteSuite dev] ${error instanceof Error ? error.message : String(error)}`);
  await finish("startup_failure", 1);
}
