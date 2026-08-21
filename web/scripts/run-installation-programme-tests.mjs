import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
const dir=".tmp-installation-programme-tests",out=`${dir}/installation-programme.test.mjs`;
await mkdir(dir,{recursive:true});try{await build({entryPoints:["tests/installation-programme.test.ts"],bundle:true,platform:"node",format:"esm",outfile:out,packages:"external"});const child=spawn(process.execPath,["--test",out],{stdio:"inherit"});process.exitCode=await new Promise(resolve=>child.on("exit",resolve))??1}finally{await rm(dir,{recursive:true,force:true})}
