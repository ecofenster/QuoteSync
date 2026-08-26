import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { resolveIntegrationEncryptionKey } from "./integrationSecretProvider.js";

export function createIntegrationSecretVault({ environment = process.env, encryptionKey } = {}) {
  const resolution = resolveIntegrationEncryptionKey({ environment, encryptionKey });
  const requireKey = () => {
    if (!resolution.key) throw Object.assign(new Error(resolution.message), { status: 409, code: resolution.code });
    return resolution.key;
  };
  return {
    configured: resolution.state === "available",
    state: resolution.state,
    errorCode: resolution.code,
    message: resolution.message,
    encrypt(value) {
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", requireKey(), iv);
      const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
      return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
    },
    decrypt(value) {
      const [version, iv, tag, encrypted] = String(value || "").split(":");
      if (version !== "v1" || !iv || !tag || !encrypted) throw Object.assign(new Error("Stored integration secret has an unsupported format."), { status: 409, code: "encrypted_value_invalid" });
      try {
        const decipher = createDecipheriv("aes-256-gcm", requireKey(), Buffer.from(iv, "base64"));
        decipher.setAuthTag(Buffer.from(tag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
      } catch (error) {
        if (error?.code === "encryption_not_configured" || error?.code === "invalid_encryption_key") throw error;
        throw Object.assign(new Error("Stored integration data cannot be decrypted by the server encryption service."), { status: 409, code: "integration_decryption_failed" });
      }
    },
  };
}
