import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";
const outfile = ".tmp-phase5-tests/stage1d1-import-lab.test.mjs";
await mkdir(".tmp-phase5-tests", { recursive: true });
await build({ entryPoints: ["tests/stage1d1-supplier-import-lab.test.ts"], outfile, bundle: true, platform: "node", format: "esm", sourcemap: "inline", logLevel: "silent", external: ["node:*", "express", "multer", "sqlite", "sqlite3"] });
const child = spawn(process.execPath, ["--test", outfile], { stdio: "inherit", shell: false });
child.on("exit", (code, signal) => signal ? process.kill(process.pid, signal) : process.exit(code ?? 1));
