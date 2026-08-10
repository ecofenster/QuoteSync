const PROVIDERS = Object.freeze({
  googleMaps: {
    category: "location_mapping",
    capabilities: ["map_display", "geocoding", "routing", "distance", "travel_time"],
    envNames: ["GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_MAPS_API_KEY"],
    testUrl: (key) => `https://maps.googleapis.com/maps/api/geocode/json?address=SW1A%201AA&region=GB&key=${encodeURIComponent(key)}`,
  },
  what3words: {
    category: "location_mapping",
    capabilities: ["words_to_coordinates", "coordinates_to_words"],
    envNames: ["WHAT3WORDS_API_KEY", "VITE_WHAT3WORDS_API_KEY"],
    testUrl: (key) => `https://api.what3words.com/v3/convert-to-coordinates?words=filled.count.soap&key=${encodeURIComponent(key)}`,
  },
});

const secretKey = (provider) => `integrations.${provider}.apiKey`;
const enabledKey = (provider) => `integrations.${provider}.enabled`;
const testKey = (provider) => `integrations.${provider}.testStatus`;

function parseValue(row, fallback = null) {
  if (!row) return fallback;
  try { return JSON.parse(String(row.value)); } catch { return row.value ?? fallback; }
}

function maskKey(value) {
  const key = String(value || "").trim();
  if (!key) return null;
  return `${"•".repeat(8)}${key.slice(-4)}`;
}

export function isIntegrationSecretKey(key) {
  return /^integrations\.(googleMaps|what3words)\.apiKey$/i.test(String(key || ""));
}

export function createIntegrationService(db, { env = process.env, fetchImpl = fetch } = {}) {
  const assertProvider = (provider) => {
    if (!Object.hasOwn(PROVIDERS, provider)) throw Object.assign(new Error("Unknown integration"), { status: 404 });
    return PROVIDERS[provider];
  };

  async function readRow(key) {
    return db.get("SELECT key, value, updated_at FROM settings WHERE key = ? LIMIT 1", key);
  }

  async function writeValue(key, value) {
    await db.run(`INSERT INTO settings (key,value,group_name,updated_at) VALUES (?,?, 'integrations',CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,group_name='integrations',updated_at=CURRENT_TIMESTAMP`, key, JSON.stringify(value));
  }

  function environmentKey(provider) {
    const config = assertProvider(provider);
    for (const name of config.envNames) {
      const value = String(env[name] || "").trim();
      if (value) return value;
    }
    return "";
  }

  async function persistedKey(provider) {
    return String(parseValue(await readRow(secretKey(provider)), "") || "").trim();
  }

  async function resolvedCredential(provider) {
    assertProvider(provider);
    const stored = await persistedKey(provider);
    if (stored) return { key: stored, source: "quotesync" };
    const fallback = environmentKey(provider);
    return fallback ? { key: fallback, source: "environment" } : { key: "", source: "none" };
  }

  async function status(provider) {
    assertProvider(provider);
    const enabledValue = parseValue(await readRow(enabledKey(provider)), { enabled: true });
    const enabled = typeof enabledValue === "boolean" ? enabledValue : enabledValue?.enabled !== false;
    const credential = await resolvedCredential(provider);
    const test = parseValue(await readRow(testKey(provider)), null);
    return {
      provider,
      category: PROVIDERS[provider].category,
      capabilities: [...PROVIDERS[provider].capabilities],
      enabled,
      configured: Boolean(credential.key),
      source: credential.source,
      maskedKey: maskKey(credential.key),
      lastTestedAt: test?.testedAt || null,
      lastTestSuccessful: typeof test?.successful === "boolean" ? test.successful : null,
    };
  }

  async function listStatuses() {
    return Promise.all(Object.keys(PROVIDERS).map(status));
  }

  async function configure(provider, { enabled, apiKey } = {}) {
    assertProvider(provider);
    if (typeof enabled === "boolean") await writeValue(enabledKey(provider), { enabled });
    if (apiKey !== undefined) {
      const normalized = String(apiKey || "").trim();
      if (!normalized) throw Object.assign(new Error("API key cannot be empty; use Remove key instead"), { status: 400 });
      await writeValue(secretKey(provider), normalized);
      await db.run("DELETE FROM settings WHERE key = ?", testKey(provider));
    }
    return status(provider);
  }

  async function clearCredential(provider) {
    assertProvider(provider);
    await db.run("DELETE FROM settings WHERE key IN (?, ?)", secretKey(provider), testKey(provider));
    return status(provider);
  }

  async function enabledCredential(provider) {
    const current = await status(provider);
    if (!current.enabled) throw Object.assign(new Error("Integration is disabled"), { status: 409 });
    const credential = await resolvedCredential(provider);
    if (!credential.key) throw Object.assign(new Error("Integration is not configured"), { status: 409 });
    return credential.key;
  }

  async function testConnection(provider) {
    const config = assertProvider(provider);
    const key = await enabledCredential(provider);
    let successful = false;
    let message = "Connection failed. Check the key and provider permissions.";
    try {
      const response = await fetchImpl(config.testUrl(key));
      const body = await response.json().catch(() => ({}));
      if (provider === "googleMaps") successful = response.ok && body?.status === "OK";
      else successful = response.ok && Number.isFinite(body?.coordinates?.lat) && Number.isFinite(body?.coordinates?.lng);
      if (successful) message = "Connection successful.";
    } catch {
      successful = false;
    }
    const testedAt = new Date().toISOString();
    await writeValue(testKey(provider), { testedAt, successful });
    return { successful, message, testedAt };
  }

  return { status, listStatuses, configure, clearCredential, enabledCredential, testConnection };
}
