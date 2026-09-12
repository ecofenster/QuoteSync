import { createLifecycleService } from './lifecycleService.js';

export function startSupplierRevisionFollowupWorker({ databasePromise, environment = process.env, intervalMs = 60_000 } = {}) {
  if (!databasePromise || String(environment.QUOTESUITE_SUPPLIER_FOLLOWUP_WORKER || '1') === '0') return { stop() {} };
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const service = createLifecycleService(await databasePromise, { environment });
      await service.processDueSupplierRevisionFollowups();
    } catch (error) {
      console.error('Supplier revision follow-up worker failed:', error instanceof Error ? error.message : error);
    } finally { running = false; }
  };
  const timer = setInterval(() => { void run(); }, Math.max(10_000, Number(intervalMs) || 60_000));
  timer.unref?.();
  void run();
  return { stop() { clearInterval(timer); } };
}
