import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
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

test("removing a managed key safely reveals environment fallback for providers that permit it", async (t) => {
  const { service } = await fixture(t, { env: { WHAT3WORDS_API_KEY: "environment-key" } });
  await service.configure("what3words", { apiKey: "persisted-key" });
  assert.equal((await service.status("what3words")).source, "quotesync");
  const cleared = await service.clearCredential("what3words");
  assert.equal(cleared.source, "environment"); assert.equal(cleared.configured, true);
});

test("persisted configuration overrides environment fallback", async (t) => {
  const { service } = await fixture(t, { env: { VITE_WHAT3WORDS_API_KEY: "environment-key" } });
  assert.equal((await service.status("what3words")).source, "environment");
  assert.equal((await service.configure("what3words", { apiKey: "persisted-key" })).source, "quotesync");
});

test("connection tests persist success and sanitized failure state", async (t) => {
  const calls = [];
  const success = await fixture(t, { env: {}, fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/geocode/")) return { ok: true, json: async () => ({ status: "OK", results: [{ geometry: { location: { lat: 51.501, lng: -0.142 } } }] }) };
    return { ok: true, json: async () => ({ routes: [{ distanceMeters: 3210, duration: "754s" }] }) };
  } });
  await success.service.configure("googleMaps", { enabled: true, apiKey: "secret" });
  const result = await success.service.testConnection("googleMaps");
  assert.equal(result.successful, true);
  assert.deepEqual(result.capabilities, { geocoding: true, routing: true });
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /routes\.googleapis\.com\/directions\/v2:computeRoutes/);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers["X-Goog-Api-Key"], "secret");
  assert.equal(calls[1].options.headers["X-Goog-FieldMask"], "routes.distanceMeters,routes.duration");
  assert.equal((await success.service.status("googleMaps")).lastTestSuccessful, true);

  const failure = await fixture(t, { env: {}, fetchImpl: async () => ({ ok: false, json: async () => ({ error: "provider detail" }) }) });
  await failure.service.configure("what3words", { enabled: true, apiKey: "secret" });
  const failureResult = await failure.service.testConnection("what3words");
  assert.equal(failureResult.successful, false); assert.equal(JSON.stringify(failureResult).includes("secret"), false);
});

test("server Google credential never falls back to browser or server environment keys", async (t) => {
  const { service } = await fixture(t, { env: { VITE_GOOGLE_MAPS_API_KEY: "browser-only", GOOGLE_MAPS_API_KEY: "legacy-server-key" } });
  assert.equal((await service.status("googleMaps")).configured, false);
  await assert.rejects(() => service.enabledCredential("googleMaps"), /not configured/);
});

test("Google geocoding and Routes API return normalized results without exposing credentials", async (t) => {
  const calls = [];
  const { service } = await fixture(t, { env: {}, fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/geocode/")) {
      const query = new URL(String(url)).searchParams.get("address");
      const location = query === "BA2 8AP" ? { lat: 51.321, lng: -2.438 } : { lat: 56.117, lng: -3.359 };
      return { ok: true, json: async () => ({ status: "OK", results: [{ geometry: { location } }] }) };
    }
    return { ok: true, json: async () => ({ routes: [{ distanceMeters: 123456, duration: "7201s" }] }) };
  } });
  await service.configure("googleMaps", { enabled: true, apiKey: "server-secret" });
  const origin = await service.geocodeGoogle("KY4 9FA");
  const destination = await service.geocodeGoogle(" BA2 8AP ");
  const route = await service.routeGoogle(origin, destination);
  assert.deepEqual(origin, { lat: 56.117, lng: -3.359 });
  assert.deepEqual(destination, { lat: 51.321, lng: -2.438 });
  assert.deepEqual(route, { distanceKm: 123.456, durationMinutes: 121 });
  assert.equal(new URL(calls[0].url).searchParams.get("address"), "KY4 9FA");
  assert.equal(new URL(calls[1].url).searchParams.get("address"), "BA2 8AP");
  assert.equal(calls[2].url.includes("server-secret"), false);
  assert.equal(calls[2].options.headers["X-Goog-FieldMask"], "routes.distanceMeters,routes.duration");
  assert.equal(JSON.stringify(route).includes("server-secret"), false);
});

test("Google provider failures are sanitized while retaining actionable restriction diagnosis", async (t) => {
  const { service } = await fixture(t, { env: {}, fetchImpl: async () => ({ ok: true, json: async () => ({ status: "REQUEST_DENIED", error_message: "API keys with referer restrictions cannot be used with this API." }) }) });
  await service.configure("googleMaps", { enabled: true, apiKey: "never-return-this" });
  await assert.rejects(
    () => service.geocodeGoogle("KY4 9FA"),
    (error) => error.status === 422 && error.message === "Google rejected the server credential because it has website/referrer restrictions." && !error.message.includes("never-return-this")
  );
});

test("Google connection test does not report success when geocoding works but routing is unavailable", async (t) => {
  let call = 0;
  const { service } = await fixture(t, { env: {}, fetchImpl: async () => {
    call += 1;
    if (call === 1) return { ok: true, json: async () => ({ status: "OK", results: [{ geometry: { location: { lat: 51.501, lng: -0.142 } } }] }) };
    return { ok: false, json: async () => ({ error: { status: "PERMISSION_DENIED", message: "Routes API has not been used in project before or it is disabled." } }) };
  } });
  await service.configure("googleMaps", { enabled: true, apiKey: "server-key" });
  const result = await service.testConnection("googleMaps");
  assert.equal(result.successful, false);
  assert.deepEqual(result.capabilities, { geocoding: true, routing: false });
  assert.match(result.message, /^Routing failed: A required Google Maps API is not enabled/);
});

test("generic settings secret matcher covers only managed credential keys", () => {
  assert.equal(isIntegrationSecretKey("integrations.googleMaps.apiKey"), true);
  assert.equal(isIntegrationSecretKey("integrations.what3words.apiKey"), true);
  assert.equal(isIntegrationSecretKey("integrations.googleMaps.enabled"), false);
});

test("browser rendering and tenant Google business capabilities remain isolated", async () => {
  const [app, mapPanel, location, routeIntegration, serverService, apiClient] = await Promise.all([
    readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/GoogleMapPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/services/locationService.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/projectCalculatorLab/integrations/routeIntegration.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/features/integrations/integrationService.js", import.meta.url), "utf8"),
    readFile(new URL("../src/services/api/apiClient.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /ENV\.VITE_GOOGLE_MAPS_API_KEY/);
  assert.match(app, /const ENV = import\.meta\.env/);
  assert.doesNotMatch(app, /import\.meta as any\)\?\.env|import\.meta\?\.env/);
  assert.match(mapPanel, /maps\/api\/js\?key=/);
  assert.doesNotMatch(location, /new window\.google\.maps\.Geocoder/);
  assert.match(location, /\/api\/integrations\/googleMaps\/geocode/);
  assert.match(location, /apiFetch\("\/api\/integrations\/googleMaps\/geocode"/);
  assert.doesNotMatch(location, /fetch\("\/api\/integrations\/googleMaps\/geocode"/);
  assert.match(routeIntegration, /\/api\/integrations\/googleMaps\/geocode/);
  assert.match(routeIntegration, /\/api\/integrations\/googleMaps\/route/);
  assert.match(routeIntegration, /apiFetch\("\/api\/integrations\/googleMaps\/geocode"/);
  assert.doesNotMatch(routeIntegration, /fetch\("\/api\/integrations\/googleMaps\/(?:geocode|route)"/);
  assert.match(apiClient, /API_BASE_URL = "http:\/\/localhost:3001"/);
  assert.match(mapPanel, /Map display is not configured for this QuoteSuite deployment/);
  assert.doesNotMatch(mapPanel, /Add VITE_GOOGLE_MAPS_API_KEY to \.env\.local/);
  assert.doesNotMatch(serverService, /VITE_GOOGLE_MAPS_API_KEY|GOOGLE_MAPS_API_KEY/);
});
