export const QUOTESUITE_RUNTIME_CONTRACT = Object.freeze({
  family: 'quotesuite-api',
  version: 'runtime-health-v1',
  identity: 'quotesuite-runtime-health-2026-08-29-v1',
  capabilities: Object.freeze([
    'api-readiness',
    'sqlite-readiness',
    'runtime-identity',
    'client-mutation-gating'
  ])
});
