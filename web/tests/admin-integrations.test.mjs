import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createIntegrationService, isIntegrationSecretKey } from "../server/features/integrations/integrationService.js";

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qs-integrations-"));
  const db = await open({ filename: path.join(root, "test.db"), driver: sqlite3.Database });
  await db.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT,group_name TEXT,updated_at TEXT)");
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  return { db, service: createIntegrationService(db, options) };
}

test("Google Maps and what3words credentials save masked and never return the secret", async (t) => {
  const { service } = await fixture(t, { env: {} });
  for (const [provider, key] of [["googleMaps", "google-secret-A7x9"], ["what3words", "words-secret-B8y0"]]) {
    const status = await service.configure(provider, { enabled: true, apiKey: key });
    assert.equal(status.configured, true); assert.equal(status.source, "quotesync"); assert.equal(status.maskedKey, `••••••••${key.slice(-4)}`);
    assert.equal(JSON.stringify(status).includes(key), false);
    assert.equal(status.category, "location_mapping"); assert.ok(status.capabilities.length > 0);
  }
});

test("enabled and configured are independent; disabling preserves the credential", async (t) => {
  const { service } = await fixture(t, { env: {} });
  await service.configure("googleMaps", { enabled: true, apiKey: "preserved-key" });
  const disabled = await service.configure("googleMaps", { enabled: false });
  assert.equal(disabled.enabled, false); assert.equal(disabled.configured, true);
  assert.equal((await service.configure("googleMaps", { enabled: true })).configured, true);
});

test("removing a managed key safely reveals environment fallback", async (t) => {
  const { service } = await fixture(t, { env: { GOOGLE_MAPS_API_KEY: "environment-key" } });
  await service.configure("googleMaps", { apiKey: "persisted-key" });
  assert.equal((await service.status("googleMaps")).source, "quotesync");
  const cleared = await service.clearCredential("googleMaps");
  assert.equal(cleared.source, "environment"); assert.equal(cleared.configured, true);
});

test("persisted configuration overrides environment fallback", async (t) => {
  const { service } = await fixture(t, { env: { VITE_WHAT3WORDS_API_KEY: "environment-key" } });
  assert.equal((await service.status("what3words")).source, "environment");
  assert.equal((await service.configure("what3words", { apiKey: "persisted-key" })).source, "quotesync");
});

test("connection tests persist success and sanitized failure state", async (t) => {
  const success = await fixture(t, { env: {}, fetchImpl: async () => ({ ok: true, json: async () => ({ status: "OK" }) }) });
  await success.service.configure("googleMaps", { enabled: true, apiKey: "secret" });
  assert.equal((await success.service.testConnection("googleMaps")).successful, true);
  assert.equal((await success.service.status("googleMaps")).lastTestSuccessful, true);

  const failure = await fixture(t, { env: {}, fetchImpl: async () => ({ ok: false, json: async () => ({ error: "provider detail" }) }) });
  await failure.service.configure("what3words", { enabled: true, apiKey: "secret" });
  const result = await failure.service.testConnection("what3words");
  assert.equal(result.successful, false); assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("generic settings secret matcher covers only managed credential keys", () => {
  assert.equal(isIntegrationSecretKey("integrations.googleMaps.apiKey"), true);
  assert.equal(isIntegrationSecretKey("integrations.what3words.apiKey"), true);
  assert.equal(isIntegrationSecretKey("integrations.googleMaps.enabled"), false);
});
