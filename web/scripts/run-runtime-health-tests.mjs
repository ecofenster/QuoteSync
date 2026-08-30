import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const outfile = ".tmp-phase5-tests/runtime-health.test.mjs";
await mkdir(".tmp-phase5-tests", { recursive: true });
await build({
  entryPoints: ["tests/runtime-health.test.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: "inline",
  logLevel: "silent",
  external: ["node:*"],
  define: {
    "import.meta.env.VITE_API_BASE_URL": '"http://localhost:3001"',
  },
});
const child = spawn(process.execPath, ["--test", outfile], { stdio: "inherit", shell: false });
child.on("exit", (code, signal) => signal ? process.kill(process.pid, signal) : process.exit(code ?? 1));
