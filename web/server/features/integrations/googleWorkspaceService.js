import { randomBytes } from "node:crypto";
import { createIntegrationSecretVault } from "./integrationSecretVault.js";

export const GOOGLE_WORKSPACE_PROVIDER = "google_workspace";
export const GOOGLE_WORKSPACE_SCOPES = Object.freeze([
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive",
]);

const parse = (value, fallback) => { try { return JSON.parse(value ?? ""); } catch { return fallback; } };
const nowIso = () => new Date().toISOString();
const providerError = (message, status = 502, code = "google_workspace_error") => Object.assign(new Error(message), { status, code });

export function createGoogleWorkspaceService(db, { fetchImpl = fetch, environment = process.env, encryptionKey, now = () => new Date() } = {}) {
  const vault = createIntegrationSecretVault({ environment, encryptionKey });

  async function storedConfig() { return db.get("SELECT * FROM integration_provider_config WHERE provider=?", GOOGLE_WORKSPACE_PROVIDER); }
  async function resolvedConfig() {
    const stored = await storedConfig();
    const clientId = String(stored?.client_id || environment.GOOGLE_WORKSPACE_CLIENT_ID || "").trim();
    const redirectUri = String(stored?.redirect_uri || environment.GOOGLE_WORKSPACE_REDIRECT_URI || "").trim();
    let clientSecret = String(environment.GOOGLE_WORKSPACE_CLIENT_SECRET || "").trim();
    if (stored?.encrypted_client_secret) clientSecret = vault.decrypt(stored.encrypted_client_secret);
    return { clientId, clientSecret, redirectUri, stored };
  }

  async function configure(input = {}) {
    const current = await storedConfig(), timestamp = nowIso();
    const clientId = String(input.clientId ?? current?.client_id ?? environment.GOOGLE_WORKSPACE_CLIENT_ID ?? "").trim();
    const redirectUri = String(input.redirectUri ?? current?.redirect_uri ?? environment.GOOGLE_WORKSPACE_REDIRECT_URI ?? "").trim();
    const secretInput = input.clientSecret === undefined ? undefined : String(input.clientSecret).trim();
    if (!clientId || !redirectUri) throw providerError("Google OAuth client ID and redirect URI are required.", 400, "invalid_oauth_configuration");
    if (secretInput === "") throw providerError("Google OAuth client secret cannot be empty.", 400, "invalid_oauth_configuration");
    const encryptedSecret = secretInput === undefined ? current?.encrypted_client_secret ?? null : vault.encrypt(secretInput);
    if (!encryptedSecret && !environment.GOOGLE_WORKSPACE_CLIENT_SECRET) throw providerError("Google OAuth client secret is required.", 400, "invalid_oauth_configuration");
    const template = input.folderTemplate ?? parse(current?.folder_template_json, {});
    await db.run(`INSERT INTO integration_provider_config(provider,client_id,encrypted_client_secret,redirect_uri,capabilities_json,estimates_root_folder_id,orders_root_folder_id,folder_template_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET client_id=excluded.client_id,encrypted_client_secret=excluded.encrypted_client_secret,redirect_uri=excluded.redirect_uri,capabilities_json=excluded.capabilities_json,estimates_root_folder_id=excluded.estimates_root_folder_id,orders_root_folder_id=excluded.orders_root_folder_id,folder_template_json=excluded.folder_template_json,updated_at=excluded.updated_at`,
      GOOGLE_WORKSPACE_PROVIDER, clientId, encryptedSecret, redirectUri, JSON.stringify(GOOGLE_WORKSPACE_SCOPES), input.estimatesRootFolderId ?? current?.estimates_root_folder_id ?? null, input.ordersRootFolderId ?? current?.orders_root_folder_id ?? null, JSON.stringify(template), timestamp, timestamp);
    return status();
  }

  async function connection() { return db.get("SELECT * FROM integration_oauth_connections WHERE provider=?", GOOGLE_WORKSPACE_PROVIDER); }
  async function status() {
    const config = await resolvedConfig(), connected = await connection();
    return {
      provider: GOOGLE_WORKSPACE_PROVIDER,
      configured: Boolean(config.clientId && config.clientSecret && config.redirectUri),
      encryptionConfigured: vault.configured,
      connected: connected?.status === "connected",
      connectionStatus: connected?.status ?? "disconnected",
      account: connected?.status === "connected" ? { id: connected.account_id, email: connected.account_email, name: connected.account_name } : null,
      scopes: parse(connected?.scopes_json, GOOGLE_WORKSPACE_SCOPES),
      redirectUri: config.redirectUri || null,
      clientIdHint: config.clientId ? `${config.clientId.slice(0, 8)}…${config.clientId.slice(-6)}` : null,
      estimatesRootFolderId: config.stored?.estimates_root_folder_id ?? null,
      ordersRootFolderId: config.stored?.orders_root_folder_id ?? null,
      folderTemplate: parse(config.stored?.folder_template_json, {}),
      error: connected?.error_message ?? null,
    };
  }

  async function beginOAuth() {
    const config = await resolvedConfig();
    if (!config.clientId || !config.clientSecret || !config.redirectUri) throw providerError("Google Workspace OAuth is not configured in Administration.", 409, "oauth_not_configured");
    const state = randomBytes(32).toString("base64url"), createdAt = now().toISOString(), expiresAt = new Date(now().getTime() + 10 * 60_000).toISOString();
    await db.run("DELETE FROM integration_oauth_states WHERE expires_at<?", createdAt);
    await db.run("INSERT INTO integration_oauth_states(state,provider,redirect_uri,expires_at,created_at) VALUES(?,?,?,?,?)", state, GOOGLE_WORKSPACE_PROVIDER, config.redirectUri, expiresAt, createdAt);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", GOOGLE_WORKSPACE_SCOPES.join(" "));
    url.searchParams.set("state", state);
    return { authorizationUrl: url.toString(), state, expiresAt };
  }

  async function exchangeToken(params) {
    const response = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) throw providerError(String(body.error_description || body.error || "Google OAuth token exchange failed."), 502, "oauth_exchange_failed");
    return body;
  }

  async function completeOAuth({ state, code }) {
    const saved = await db.get("SELECT * FROM integration_oauth_states WHERE state=? AND provider=?", String(state || ""), GOOGLE_WORKSPACE_PROVIDER);
    if (!saved || saved.expires_at < now().toISOString()) throw providerError("Google OAuth state is invalid or expired.", 400, "invalid_oauth_state");
    const config = await resolvedConfig();
    const tokens = await exchangeToken({ code: String(code || ""), client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: saved.redirect_uri, grant_type: "authorization_code" });
    const identityResponse = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const identity = await identityResponse.json().catch(() => ({}));
    if (!identityResponse.ok || !identity.sub) throw providerError("Google account identity could not be read after OAuth.", 502, "identity_failed");
    const timestamp = now().toISOString(), expiresAt = new Date(now().getTime() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`INSERT INTO integration_oauth_connections(provider,status,account_id,account_email,account_name,encrypted_access_token,encrypted_refresh_token,token_type,expires_at,scopes_json,error_message,connected_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET status='connected',account_id=excluded.account_id,account_email=excluded.account_email,account_name=excluded.account_name,encrypted_access_token=excluded.encrypted_access_token,encrypted_refresh_token=COALESCE(excluded.encrypted_refresh_token,integration_oauth_connections.encrypted_refresh_token),token_type=excluded.token_type,expires_at=excluded.expires_at,scopes_json=excluded.scopes_json,error_message=NULL,connected_at=excluded.connected_at,updated_at=excluded.updated_at`,
        GOOGLE_WORKSPACE_PROVIDER, "connected", String(identity.sub), String(identity.email || ""), String(identity.name || identity.email || ""), vault.encrypt(tokens.access_token), tokens.refresh_token ? vault.encrypt(tokens.refresh_token) : null, String(tokens.token_type || "Bearer"), expiresAt, JSON.stringify(String(tokens.scope || GOOGLE_WORKSPACE_SCOPES.join(" ")).split(/\s+/).filter(Boolean)), null, timestamp, timestamp);
      await db.run("DELETE FROM integration_oauth_states WHERE state=?", saved.state);
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    return status();
  }

  async function disconnect() {
    await db.run("DELETE FROM integration_oauth_connections WHERE provider=?", GOOGLE_WORKSPACE_PROVIDER);
    return status();
  }

  async function refresh(connectionRow) {
    if (!connectionRow.encrypted_refresh_token) throw providerError("Google Workspace refresh token is unavailable; reconnect the account.", 401, "reconnect_required");
    const config = await resolvedConfig(), tokens = await exchangeToken({ refresh_token: vault.decrypt(connectionRow.encrypted_refresh_token), client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token" });
    const expiresAt = new Date(now().getTime() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    await db.run("UPDATE integration_oauth_connections SET encrypted_access_token=?,expires_at=?,token_type=?,updated_at=?,error_message=NULL,status='connected' WHERE provider=?", vault.encrypt(tokens.access_token), expiresAt, String(tokens.token_type || "Bearer"), now().toISOString(), GOOGLE_WORKSPACE_PROVIDER);
    return tokens.access_token;
  }

  async function accessToken() {
    const current = await connection();
    if (current?.status !== "connected" || !current.encrypted_access_token) throw providerError("Google Workspace is not connected.", 409, "provider_disconnected");
    if (!current.expires_at || new Date(current.expires_at).getTime() <= now().getTime() + 60_000) return refresh(current);
    return vault.decrypt(current.encrypted_access_token);
  }

  async function googleFetch(url, options = {}, retry = true) {
    const token = await accessToken();
    const response = await fetchImpl(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
    if (response.status === 401 && retry) {
      const current = await connection();
      await refresh(current);
      return googleFetch(url, options, false);
    }
    return response;
  }

  return { status, configure, beginOAuth, completeOAuth, disconnect, accessToken, googleFetch, resolvedConfig };
}
