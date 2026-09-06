import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";
const outdir = ".tmp-phase5-tests"; const outfile = `${outdir}/stage1d-upload.test.mjs`;
await mkdir(outdir, { recursive: true });
await build({ entryPoints: ["tests/stage1d-supplier-upload.test.ts"], outfile, bundle: true, platform: "node", format: "esm", sourcemap: "inline", logLevel: "silent", external: ["node:*", "express", "multer", "sqlite", "sqlite3", "react", "react-dom", "mammoth", "pdfjs-dist/*", "@napi-rs/canvas", "@napi-rs/canvas/*"] });
const child=spawn(process.execPath,["--test",outfile],{stdio:"inherit",shell:false});child.on("exit",(code,signal)=>signal?process.kill(process.pid,signal):process.exit(code??1));
