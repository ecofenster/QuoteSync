import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const outdir = ".tmp-phase5-tests";
const outfile = `${outdir}/phase5-contract.test.mjs`;

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ["tests/phase5-contract.test.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: "inline",
  logLevel: "silent",
  external: ["node:test", "node:assert/strict"],
});
const child = spawn(process.execPath, ["--test", outfile], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
