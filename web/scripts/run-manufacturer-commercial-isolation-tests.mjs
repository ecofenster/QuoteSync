import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve('.tmp-phase5-tests');
const outfile = path.join(root, 'manufacturer-commercial-isolation.test.mjs');
await mkdir(root, { recursive: true });
try {
  await build({ entryPoints: ['tests/manufacturer-commercial-isolation.test.ts'], bundle: true, platform: 'node', format: 'esm', outfile, packages: 'external' });
  const child = spawn(process.execPath, ['--test', 'tests/manufacturer-commercial-isolation.test.mjs', outfile], { stdio: 'inherit' });
  process.exitCode = await new Promise((resolve) => child.on('exit', resolve)) ?? 1;
} finally {
  await rm(outfile, { force: true });
}
