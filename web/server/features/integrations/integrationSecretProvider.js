export const INTEGRATION_ENCRYPTION_KEY_NAME = "QUOTESUITE_INTEGRATION_ENCRYPTION_KEY";

const safeMessages = Object.freeze({
  missing: "The server integration encryption service is not configured.",
  invalid: "The server integration encryption key has an invalid format.",
});

function decodeBase64Key(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 && decoded.toString("base64") === value ? decoded : null;
}

export function resolveIntegrationEncryptionKey({ environment = process.env, encryptionKey } = {}) {
  if (Buffer.isBuffer(encryptionKey)) {
    return encryptionKey.length === 32
      ? { state: "available", key: encryptionKey, code: null, message: null }
      : { state: "invalid", key: null, code: "invalid_encryption_key", message: safeMessages.invalid };
  }

  const value = String(encryptionKey ?? environment[INTEGRATION_ENCRYPTION_KEY_NAME] ?? "").trim();
  if (!value) return { state: "missing", key: null, code: "encryption_not_configured", message: safeMessages.missing };
  if (/^[a-f\d]{64}$/i.test(value)) return { state: "available", key: Buffer.from(value, "hex"), code: null, message: null };
  const decoded = decodeBase64Key(value);
  if (decoded) return { state: "available", key: decoded, code: null, message: null };
  return { state: "invalid", key: null, code: "invalid_encryption_key", message: safeMessages.invalid };
}

export function bootstrapIntegrationSecretProvider({
  environment = process.env,
  environmentPath,
  existsSyncImpl,
  loadEnvFileImpl,
} = {}) {
  if (environmentPath && existsSyncImpl(environmentPath)) loadEnvFileImpl(environmentPath);
  const resolution = resolveIntegrationEncryptionKey({ environment });
  return Object.freeze({
    source: environmentPath || null,
    state: resolution.state,
    available: resolution.state === "available",
    code: resolution.code,
    message: resolution.message,
  });
}
