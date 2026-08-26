import { integrationSecretBootstrap } from './loadLocalEnvironment.js';

// This dynamic boundary guarantees infrastructure secrets are loaded and validated
// before any route or integration service module is evaluated.
await import('./startQuoteSuiteApi.js');

export { integrationSecretBootstrap };
