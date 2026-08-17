const PROVIDERS = Object.freeze({
  googleMaps: {
    category: "location_mapping",
    capabilities: ["geocoding", "routing", "distance", "travel_time"],
    envNames: [],
  },
  what3words: {
    category: "location_mapping",
    capabilities: ["words_to_coordinates", "coordinates_to_words"],
    envNames: ["WHAT3WORDS_API_KEY", "VITE_WHAT3WORDS_API_KEY"],
    testUrl: (key) => `https://api.what3words.com/v3/convert-to-coordinates?words=filled.count.soap&key=${encodeURIComponent(key)}`,
  },
});

const GOOGLE_GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function safeGoogleFailure(body, fallback) {
  const status = String(body?.status || body?.error?.status || "").trim();
  const detail = String(body?.error_message || body?.error?.message || "").trim();
  const reasons = Array.isArray(body?.error?.details)
    ? body.error.details.map((item) => item?.reason || item?.metadata?.reason || "").join(" ")
    : "";
  const combined = `${status} ${detail} ${reasons}`.toLowerCase();
  if (combined.includes("referer restriction") || combined.includes("referer <empty>") || combined.includes("http_referrer_blocked")) return "Google rejected the server credential because it has website/referrer restrictions.";
  if (combined.includes("api_not_activated") || combined.includes("has not been used") || combined.includes("not enabled")) return "A required Google Maps API is not enabled for this credential's project.";
  if (combined.includes("billing")) return "Google Maps billing is not enabled for this credential's project.";
  if (combined.includes("api_key_invalid") || combined.includes("invalid api key")) return "Google rejected the configured server credential.";
  if (combined.includes("ip") && combined.includes("not allowed")) return "Google rejected the server credential's IP restriction.";
  return status ? `${fallback} (${status}).` : fallback;
}

function providerFailure(message, status = 422) {
  return Object.assign(new Error(message), { status });
}

function durationMinutes(value) {
  const seconds = Number.parseFloat(String(value || "").replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.ceil(seconds / 60) : null;
}

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

  async function geocodeGoogle(query) {
    const key = await enabledCredential("googleMaps");
    const normalized = String(query || "").trim();
    if (!normalized) throw providerFailure("query is required", 400);
    const url = new URL(GOOGLE_GEOCODING_URL);
    url.searchParams.set("address", normalized);
    url.searchParams.set("region", "GB");
    url.searchParams.set("key", key);
    const response = await fetchImpl(url);
    const body = await response.json().catch(() => ({}));
    const location = body?.results?.[0]?.geometry?.location;
    if (!response.ok || body?.status !== "OK" || !location) {
      throw providerFailure(safeGoogleFailure(body, "Location could not be resolved"));
    }
    return { lat: Number(location.lat), lng: Number(location.lng) };
  }

  async function routeGoogle(origin, destination) {
    const key = await enabledCredential("googleMaps");
    if (![origin?.lat, origin?.lng, destination?.lat, destination?.lng].every(Number.isFinite)) {
      throw providerFailure("valid route coordinates are required", 400);
    }
    const response = await fetchImpl(GOOGLE_ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: false,
      }),
    });
    const body = await response.json().catch(() => ({}));
    const route = body?.routes?.[0];
    const minutes = durationMinutes(route?.duration);
    if (!response.ok || !Number.isFinite(route?.distanceMeters) || minutes == null) {
      throw providerFailure(safeGoogleFailure(body, "Route could not be calculated"));
    }
    return { distanceKm: route.distanceMeters / 1000, durationMinutes: minutes };
  }

  async function testConnection(provider) {
    const config = assertProvider(provider);
    await enabledCredential(provider);
    let successful = false;
    let message = "Connection failed. Check the key and provider permissions.";
    let capabilities;
    if (provider === "googleMaps") {
      capabilities = { geocoding: false, routing: false };
      try {
        const origin = await geocodeGoogle("SW1A 1AA");
        capabilities.geocoding = true;
        try {
          await routeGoogle(origin, { lat: 51.5155, lng: -0.1419 });
          capabilities.routing = true;
          successful = true;
          message = "Connection successful. Geocoding and routing are available.";
        } catch (error) {
          message = `Routing failed: ${error instanceof Error ? error.message : message}`;
        }
      } catch (error) {
        message = `Geocoding failed: ${error instanceof Error ? error.message : message}`;
      }
    } else {
      try {
        const key = await enabledCredential(provider);
        const response = await fetchImpl(config.testUrl(key));
        const body = await response.json().catch(() => ({}));
        successful = response.ok && Number.isFinite(body?.coordinates?.lat) && Number.isFinite(body?.coordinates?.lng);
        if (successful) message = "Connection successful.";
      } catch {
        successful = false;
      }
    }
    const testedAt = new Date().toISOString();
    await writeValue(testKey(provider), { testedAt, successful, ...(capabilities ? { capabilities } : {}) });
    return { successful, message, testedAt, ...(capabilities ? { capabilities } : {}) };
  }

  return { status, listStatuses, configure, clearCredential, enabledCredential, geocodeGoogle, routeGoogle, testConnection };
}
