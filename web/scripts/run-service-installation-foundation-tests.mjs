import {spawn} from "node:child_process";
const child=spawn(process.execPath,["--test","--test-isolation=none","tests/service-installation-foundation.test.mjs"],{stdio:"inherit"});
process.exitCode=await new Promise(resolve=>child.on("exit",resolve))??1;
