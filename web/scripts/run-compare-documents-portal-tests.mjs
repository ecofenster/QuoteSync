import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";

const tempRoot=await mkdtemp(path.join(tmpdir(),"quotesuite-compare-tests-"));
const compiledPortalTest=path.join(tempRoot,"client-portal-projection.test.mjs");
let exitCode=1;
try{
  await build({entryPoints:["tests/client-portal-projection.test.ts"],outfile:compiledPortalTest,bundle:true,platform:"node",format:"esm",sourcemap:"inline",logLevel:"silent",external:["node:*"]});
  const child=spawn(process.execPath,["--test","--test-isolation=none","tests/quote-comparison-foundation.test.mjs",compiledPortalTest],{stdio:"inherit",shell:false});
  exitCode=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",(code,signal)=>signal?reject(new Error(`Focused foundation tests ended by ${signal}.`)):resolve(code??1))});
}finally{
  await rm(tempRoot,{recursive:true,force:true});
}
process.exitCode=exitCode;
