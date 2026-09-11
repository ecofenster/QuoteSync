import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const customer = String(process.env.QUOTESUITE_TEST_CUSTOMER_EMAIL || '').trim();
const factory = String(process.env.QUOTESUITE_TEST_FACTORY_EMAIL || '').trim();
const deliveryEnabled = String(process.env.QUOTESUITE_TEST_DELIVERY_ENABLED || '') === '1';
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('[QuoteSuite test journey] The deterministic adapter cannot run in production.');
  process.exitCode = 1;
} else {
  const suppliedDatabasePath = String(process.env.QUOTESUITE_DB_PATH || '').trim();
  const disposableRoot = suppliedDatabasePath ? null : await mkdtemp(path.join(os.tmpdir(), 'quotesuite-test-workspace-'));
  const databasePath = suppliedDatabasePath || path.join(disposableRoot, 'quotesync.db');
  const attachmentRoot = String(process.env.QUOTESYNC_ATTACHMENT_ROOT || '').trim() || path.join(disposableRoot || path.dirname(databasePath), 'attachments');
  console.info(`[QuoteSuite test journey] customer=${customer ? 'configured' : 'required for external session'} factory=${factory ? 'configured' : 'required for factory actions'} delivery=${deliveryEnabled && customer && factory ? 'test allowlist enabled' : 'preview only'}`);
  console.info(`[QuoteSuite test journey] database=${suppliedDatabasePath ? 'caller-supplied isolated path (retained)' : 'fresh disposable database (removed on exit)'} persisted-provider-connections=${suppliedDatabasePath ? 'depend on supplied database' : 'none'}`);
  if (deliveryEnabled && (!customer || !factory)) console.warn('[QuoteSuite test journey] Delivery remains blocked until both explicit test addresses are configured.');
  const child = spawn(process.execPath, ['scripts/run-development-workspace.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, QUOTESUITE_TEST_JOURNEY: '1', QUOTESUITE_DB_PATH: databasePath, QUOTESYNC_ATTACHMENT_ROOT: attachmentRoot },
    stdio: 'inherit',
    windowsHide: true,
  });
  const forward = (signal) => { if (!child.killed) child.kill(signal); };
  process.once('SIGINT', () => forward('SIGINT'));
  process.once('SIGTERM', () => forward('SIGTERM'));
  try {
    process.exitCode = await new Promise((resolve) => child.once('exit', (code) => resolve(Number(code || 0))));
  } finally {
    if (disposableRoot) await rm(disposableRoot, { recursive:true, force:true });
  }
}
