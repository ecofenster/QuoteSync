import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

function waitForExit(child, timeoutMs, wait = delay) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    wait(timeoutMs).then(() => false),
  ]);
}

function normalizeForComparison(value = "") {
  return String(value).replace(/\\/g, "/");
}

function runCommandWithOutput(command, args, spawnImpl = spawn) {
  return new Promise((resolve, reject) => {
    const process = spawnImpl(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let output = "";
    let error = "";

    process.stdout.on("data", (chunk) => {
      output += String(chunk);
    });

    process.stderr.on("data", (chunk) => {
      error += String(chunk);
    });

    process.once("error", (processError) => reject(processError));
    process.once("exit", (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }
      const details = error.trim();
      reject(new Error(`command "${command} ${args.join(" ")}" exited with ${code}${details ? `: ${details}` : ""}`));
    });
  });
}

function runCommand(command, args, spawnImpl = spawn) {
  return new Promise((resolve) => {
    const process = spawnImpl(command, args, { stdio: "ignore", shell: false });
    process.once("error", () => resolve(false));
    process.once("exit", () => resolve(true));
  });
}

function commandMatchesProfile(commandLine, profilePath, exactOnly = true) {
  if (!commandLine || !profilePath) return false;
  const commandLineNormal = normalizeForComparison(commandLine);
  const profileNormal = normalizeForComparison(profilePath);
  const quotedProfile = `"${profileNormal}"`;

  const normalizedNeedles = [
    `--user-data-dir=${profileNormal}`,
    `--user-data-dir=${quotedProfile}`,
    `--user-data-dir=${JSON.stringify(profileNormal)}`,
  ];

  for (const needle of normalizedNeedles) {
    if (commandLineNormal.includes(needle)) {
      return true;
    }
  }

  if (!exactOnly) {
    return commandLineNormal.includes("--user-data-dir=") && commandLineNormal.includes(profileNormal);
  }

  return false;
}

function parseWin32ChromeProcesses(output) {
  const trimmed = output.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((entry) => entry && Number(entry.ProcessId) > 0)
      .map((entry) => ({
        pid: Number(entry.ProcessId),
        commandLine: entry.CommandLine ?? "",
      }));
  } catch {
    return [];
  }
}

function parsePosixChromeProcesses(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      if (!match) return null;
      return { pid: Number(match[1]), commandLine: match[2] || "" };
    })
    .filter((entry) => entry !== null && Number.isFinite(entry.pid) && entry.pid > 0);
}

function uniqueProcesses(processes) {
  const seen = new Set();
  const unique = [];
  for (const process of processes) {
    if (!process.pid || seen.has(process.pid)) continue;
    seen.add(process.pid);
    unique.push(process);
  }
  return unique;
}

export async function listChromeProcesses(options = {}) {
  const platformName = options.platformName ?? process.platform;
  if (platformName === "win32") {
    const output = await runCommandWithOutput(
      "powershell",
      ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"],
      options.spawnImpl,
    );
    return parseWin32ChromeProcesses(output);
  }

  const output = await runCommandWithOutput("ps", ["-eo", "pid=,args="], options.spawnImpl);
  return parsePosixChromeProcesses(output);
}

export async function listChromeProcessesForProfile(profilePath, options = {}) {
  const exactOnly = options.exactOnly ?? true;
  const processes = await listChromeProcesses(options);
  const matching = processes.filter((entry) => commandMatchesProfile(entry.commandLine, profilePath, exactOnly));
  return uniqueProcesses(matching);
}

export async function countChromeProcessesForProfile(profilePath, options = {}) {
  const processes = await listChromeProcessesForProfile(profilePath, options);
  return processes.length;
}

export async function terminateChromeProcessByPid(pid, options = {}) {
  if (!pid || !Number.isFinite(pid)) return { pid, exited: true, forced: false };
  const platformName = options.platformName ?? process.platform;

  if (platformName === "win32") {
    await runCommand("taskkill", ["/PID", String(pid), "/T", "/F"], options.spawnImpl);
    return { pid, exited: true, forced: true };
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return { pid, exited: true, forced: false };
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code === "EPERM") {
        return { pid, exited: true, forced: false };
      }
      return { pid, exited: true, forced: false };
    }
    await (options.delayImpl ?? delay)(100);
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Best-effort final attempt for POSIX. Return best-effort state.
  }

  let stillAlive = true;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code !== "EPERM") {
        stillAlive = false;
        break;
      }
      stillAlive = false;
      break;
    }
    await (options.delayImpl ?? delay)(100);
  }

  return { pid, exited: !stillAlive, forced: true };
}

export async function terminateChromeProcessesForProfile(profilePath, options = {}) {
  const matches = await listChromeProcessesForProfile(profilePath, options);
  const pids = uniqueProcesses(matches).map((entry) => entry.pid);
  const results = [];
  for (const pid of pids.sort((a, b) => b - a)) {
    results.push(await terminateChromeProcessByPid(pid, options));
  }

  const remaining = await countChromeProcessesForProfile(profilePath, options);
  return {
    pids,
    results,
    remaining,
  };
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
