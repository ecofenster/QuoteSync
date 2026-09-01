import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputDirectory = ".tmp-phase5-tests";
const outputFile = `${outputDirectory}/supplier-import-review-runtime.test.mjs`;
await mkdir(outputDirectory, { recursive: true });

try {
  await build({
    entryPoints: ["tests/supplier-import-review-runtime.test.tsx"],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    logLevel: "silent",
    external: ["node:*", "react", "react-dom/*"],
  });
  const child = spawn(process.execPath, ["--test", outputFile], { stdio: "inherit", shell: false });
  process.exitCode = await new Promise((resolve) => child.on("exit", resolve)) ?? 1;
} finally {
  await rm(outputFile, { force: true });
}
