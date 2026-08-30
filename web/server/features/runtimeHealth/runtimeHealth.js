import { randomUUID } from 'node:crypto';
import { QUOTESUITE_RUNTIME_CONTRACT } from '../../../shared/runtimeHealthContract.js';

const DEFAULT_DATABASE_TIMEOUT_MS = 1500;
const serverStartedAt = new Date().toISOString();
const serverInstanceId = randomUUID();

function normalizedEnvironment(value) {
  const environment = String(value || 'development').trim().toLowerCase();
  if (environment === 'production' || environment === 'test') return environment;
  return 'development';
}

export async function checkDatabaseReadiness(dbPromise, { timeoutMs = DEFAULT_DATABASE_TIMEOUT_MS } = {}) {
  let timeoutId;
  try {
    const database = await Promise.race([
      Promise.resolve(dbPromise),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Database readiness timed out')), timeoutMs);
        timeoutId.unref?.();
      })
    ]);
    const result = await Promise.race([
      database.get('SELECT 1 AS ready'),
      new Promise((_, reject) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => reject(new Error('Database readiness timed out')), timeoutMs);
        timeoutId.unref?.();
      })
    ]);
    return result?.ready === 1;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createRuntimeHealthHandler({
  dbPromise,
  environment = process.env.NODE_ENV,
  processRef = process,
  startedAt = serverStartedAt,
  instanceId = serverInstanceId,
  databaseTimeoutMs = DEFAULT_DATABASE_TIMEOUT_MS
}) {
  return async function runtimeHealthHandler(_request, response) {
    const databaseAvailable = await checkDatabaseReadiness(dbPromise, { timeoutMs: databaseTimeoutMs });
    const isDevelopment = normalizedEnvironment(environment) === 'development';
    const body = {
      apiAvailable: true,
      databaseAvailable,
      status: databaseAvailable ? 'connected' : 'database_unavailable',
      environment: normalizedEnvironment(environment),
      runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family,
      runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version,
      runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity,
      capabilities: [...QUOTESUITE_RUNTIME_CONTRACT.capabilities],
      databaseType: 'sqlite',
      startedAt,
      uptimeSeconds: Math.max(0, Math.floor(Number(processRef.uptime?.() || 0))),
      instanceId,
      ...(isDevelopment ? { serverEntry: 'server/index.js' } : {})
    };

    response.set?.('Cache-Control', 'no-store');
    response.status(databaseAvailable ? 200 : 503).json(body);
  };
}
