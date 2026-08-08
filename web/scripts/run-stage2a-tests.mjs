import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const outfile='.tmp-phase5-tests/stage2a-project-calculator-lab.test.mjs';
await mkdir('.tmp-phase5-tests',{recursive:true});
await build({entryPoints:['tests/stage2a-project-calculator-lab.test.ts'],outfile,bundle:true,platform:'node',format:'esm',sourcemap:'inline',logLevel:'silent',external:['node:*','express','sqlite','sqlite3']});
const child=spawn(process.execPath,['--test',outfile],{stdio:'inherit',shell:false});
child.on('exit',(code,signal)=>signal?process.kill(process.pid,signal):process.exit(code??1));
