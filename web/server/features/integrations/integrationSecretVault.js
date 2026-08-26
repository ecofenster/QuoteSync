import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function resolveKey(environment, explicitKey) {
  if (Buffer.isBuffer(explicitKey) && explicitKey.length === 32) return explicitKey;
  const value = String(explicitKey || environment.QUOTESUITE_INTEGRATION_ENCRYPTION_KEY || "").trim();
  if (!value) return null;
  if (/^[a-f\d]{64}$/i.test(value)) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 32) return decoded;
  throw Object.assign(new Error("QUOTESUITE_INTEGRATION_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key."), { status: 409, code: "invalid_encryption_key" });
}

export function createIntegrationSecretVault({ environment = process.env, encryptionKey } = {}) {
  const key = resolveKey(environment, encryptionKey);
  const requireKey = () => {
    if (!key) throw Object.assign(new Error("Integration encryption is not configured. Set QUOTESUITE_INTEGRATION_ENCRYPTION_KEY to a 32-byte base64 or 64-character hex key."), { status: 409, code: "encryption_not_configured" });
    return key;
  };
  return {
    configured: Boolean(key),
    encrypt(value) {
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", requireKey(), iv);
      const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
      return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
    },
    decrypt(value) {
      const [version, iv, tag, encrypted] = String(value || "").split(":");
      if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Stored integration secret has an unsupported format.");
      const decipher = createDecipheriv("aes-256-gcm", requireKey(), Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
    },
  };
}
