import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapIntegrationSecretProvider } from "./features/integrations/integrationSecretProvider.js";

const serverDirectory = dirname(fileURLToPath(import.meta.url));

export function resolveLocalEnvironmentPath() {
  return resolve(serverDirectory, "..", ".env.local");
}

const localEnvironmentPath = resolveLocalEnvironmentPath();

export function loadLocalEnvironment({
  environment = process.env,
  environmentPath = localEnvironmentPath,
  existsSyncImpl = existsSync,
  loadEnvFileImpl = (path) => process.loadEnvFile(path),
} = {}) {
  return bootstrapIntegrationSecretProvider({ environment, environmentPath, existsSyncImpl, loadEnvFileImpl });
}

const integrationSecretBootstrap = loadLocalEnvironment();

export { integrationSecretBootstrap, localEnvironmentPath };
