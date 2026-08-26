import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const fileName = resolve(process.cwd(), ".env.local");
const variableName = "QUOTESUITE_INTEGRATION_ENCRYPTION_KEY";
const redirectName = "GOOGLE_WORKSPACE_REDIRECT_URI";
const defaultRedirectUri = "http://localhost:3001/api/integrations/googleWorkspace/oauth/callback";
const validKey = (value) => /^[a-f\d]{64}$/i.test(value) || (() => {
  try { return Buffer.from(value, "base64").length === 32; } catch { return false; }
})();

const current = existsSync(fileName) ? await readFile(fileName, "utf8") : "";
const match = current.match(new RegExp(`^${variableName}=(.*)$`, "m"));
if (match && !validKey(match[1].trim())) throw new Error(`${variableName} exists but is not a valid 32-byte base64 or 64-character hex key.`);

const key = match?.[1].trim() || randomBytes(32).toString("base64");
let next = current && !current.endsWith("\n") ? `${current}\n` : current;
if (!match) next += `${variableName}=${key}\n`;
if (!new RegExp(`^${redirectName}=`, "m").test(next)) next += `${redirectName}=${defaultRedirectUri}\n`;
if (next !== current) await writeFile(fileName, next, { encoding: "utf8", mode: 0o600 });

const fingerprint = createHash("sha256").update(key).digest("hex").slice(0, 12);
console.log(`${match ? "Existing" : "Generated"} local QuoteSuite integration encryption key (valid 32-byte key; fingerprint ${fingerprint}).`);
console.log(`${redirectName} is configured for the QuoteSuite API callback.`);
