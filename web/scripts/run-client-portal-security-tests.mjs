import { spawn } from "node:child_process";

const child=spawn(process.execPath,["--test","--test-isolation=none","tests/client-portal-security.test.mjs","tests/estimate-procurement-actions.test.mjs"],{stdio:"inherit",shell:false});
const exitCode=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",(code,signal)=>signal?reject(new Error(`Client Portal security tests ended by ${signal}.`)):resolve(code??1))});
process.exitCode=exitCode;
