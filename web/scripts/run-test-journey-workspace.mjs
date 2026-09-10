import { spawn } from 'node:child_process';

const customer = String(process.env.QUOTESUITE_TEST_CUSTOMER_EMAIL || '').trim();
const factory = String(process.env.QUOTESUITE_TEST_FACTORY_EMAIL || '').trim();
const deliveryEnabled = String(process.env.QUOTESUITE_TEST_DELIVERY_ENABLED || '') === '1';
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('[QuoteSuite test journey] The deterministic adapter cannot run in production.');
  process.exitCode = 1;
} else {
  console.info(`[QuoteSuite test journey] customer=${customer ? 'configured' : 'required for external session'} factory=${factory ? 'configured' : 'required for factory actions'} delivery=${deliveryEnabled && customer && factory ? 'test allowlist enabled' : 'preview only'}`);
  if (deliveryEnabled && (!customer || !factory)) console.warn('[QuoteSuite test journey] Delivery remains blocked until both explicit test addresses are configured.');
  const child = spawn(process.execPath, ['scripts/run-development-workspace.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, QUOTESUITE_TEST_JOURNEY: '1' },
    stdio: 'inherit',
    windowsHide: true,
  });
  const forward = (signal) => { if (!child.killed) child.kill(signal); };
  process.once('SIGINT', () => forward('SIGINT'));
  process.once('SIGTERM', () => forward('SIGTERM'));
  process.exitCode = await new Promise((resolve) => child.once('exit', (code) => resolve(Number(code || 0))));
}
