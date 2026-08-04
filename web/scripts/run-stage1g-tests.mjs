import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const outfile = '.tmp-phase5-tests/stage1g-review.test.mjs';
await mkdir('.tmp-phase5-tests', { recursive: true });
await build({ entryPoints: ['tests/stage1g-commercial-review.test.ts'], outfile, bundle: true, platform: 'node', format: 'esm', sourcemap: 'inline', logLevel: 'silent', external: ['node:*', 'mammoth', 'pdfjs-dist/*', 'sqlite', 'sqlite3'] });
const child = spawn(process.execPath, ['--test', outfile], { stdio: 'inherit', shell: false });
child.on('exit', (code, signal) => signal ? process.kill(process.pid, signal) : process.exit(code ?? 1));
