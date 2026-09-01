export const QUOTESUITE_RUNTIME_CONTRACT = Object.freeze({
  family: 'quotesuite-api',
  version: 'runtime-health-v3',
  identity: 'quotesuite-runtime-health-2026-08-31-v3',
  capabilities: Object.freeze([
    'api-readiness',
    'sqlite-readiness',
    'runtime-identity',
    'client-mutation-gating',
    'internorm-aspect-schedule-v1',
    'internorm-three-dealer-contract-v1',
    'internorm-pdf-image-ownership-v1',
    'manufacturer-commercial-isolation-v1',
    'supplier-commercial-classification-v1',
    'product-supply-reconciliation-v1',
    'project-costing-installation-materials-contract-v1',
    'project-costing-installation-current-catalogue-v1',
    'project-costing-supplier-installation-choice-v1'
  ])
});
