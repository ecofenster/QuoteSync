import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const outdir = ".tmp-phase5-tests";
const outfile = `${outdir}/stage1c-supplier-persistence.test.mjs`;
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: ["tests/stage1c-supplier-persistence.test.ts"], outfile, bundle: true,
  platform: "node", format: "esm", sourcemap: "inline", logLevel: "silent",
  external: ["node:*", "sqlite", "sqlite3"],
});
const child = spawn(process.execPath, ["--test", outfile], { stdio: "inherit", shell: false });
child.on("exit", (code, signal) => signal ? process.kill(process.pid, signal) : process.exit(code ?? 1));
