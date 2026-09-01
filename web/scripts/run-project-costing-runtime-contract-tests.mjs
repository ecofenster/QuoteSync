import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const dir = ".tmp-project-costing-runtime-contract-tests";
const out = `${dir}/project-costing-runtime-contract.test.mjs`;
await mkdir(dir, { recursive: true });
try {
  await build({
    entryPoints: ["tests/project-costing-runtime-contract.test.tsx"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: out,
    packages: "external",
  });
  const child = spawn(process.execPath, ["--test", out], { stdio: "inherit" });
  process.exitCode = await new Promise((resolve) => child.on("exit", resolve)) ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
