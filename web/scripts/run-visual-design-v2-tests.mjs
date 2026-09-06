import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const output = ".tmp-phase5-tests/visual-design-v2-theme.test.mjs";
await mkdir(".tmp-phase5-tests", { recursive: true });
await build({ entryPoints: ["tests/visual-design-v2-theme.test.ts"], outfile: output, bundle: true, platform: "node", format: "esm", sourcemap: "inline", logLevel: "silent", external: ["node:*"] });
const child = spawn(process.execPath, ["--test", output, "tests/quotesuite-header-assets.test.mjs"], { stdio: "inherit", shell: false });
const code = await new Promise((resolve) => child.on("exit", resolve));
await rm(output, { force: true });
process.exitCode = code ?? 1;
