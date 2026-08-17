import { useEffect, useState } from "react";
import { clearIntegrationKey, getIntegrationStatuses, saveIntegration, testIntegration, type IntegrationProvider, type IntegrationStatus } from "../../services/integrations/integrationService";

const PROVIDERS: Array<{ id: IntegrationProvider; title: string; description: string }> = [
  { id: "googleMaps", title: "Google Maps", description: "Server credential for geocoding, routes, distance, and travel time. Browser map display uses its separately deployed website-restricted key." },
  { id: "what3words", title: "what3words", description: "Resolve three-word addresses and coordinates for project locations." },
];

function sourceLabel(status?: IntegrationStatus) {
  if (!status?.configured) return "Not configured";
  return status.source === "quotesync" ? "QuoteSuite managed" : "Environment fallback";
}

export default function AdminIntegrationsPanel() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [keys, setKeys] = useState<Record<IntegrationProvider, string>>({ googleMaps: "", what3words: "" });
  const [busy, setBusy] = useState<IntegrationProvider | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  const refresh = async () => setStatuses(await getIntegrationStatuses());
  useEffect(() => { void refresh().catch(() => setMessage({ general: "Integration status could not be loaded." })); }, []);

  const run = async (provider: IntegrationProvider, action: () => Promise<IntegrationStatus | void>) => {
    setBusy(provider); setMessage((current) => ({ ...current, [provider]: "" }));
    try { const next = await action(); if (next) setStatuses((current) => current.map((item) => item.provider === provider ? next : item)); }
    catch (error) { setMessage((current) => ({ ...current, [provider]: error instanceof Error ? error.message : "Integration request failed." })); }
    finally { setBusy(null); }
  };

  return <div className="admin-integrations">
    <div className="admin-card admin-card--content ui-card">
      <div className="admin-section-title">Integrations</div>
      <p>Company-managed credentials are stored by the QuoteSuite server. Saved keys are masked and are not exposed through general Settings.</p>
      {message.general ? <div className="ui-status ui-status--error">{message.general}</div> : null}
    </div>
    <div className="admin-integrations__grid">
      {PROVIDERS.map((provider) => {
        const status = statuses.find((item) => item.provider === provider.id);
        const disabled = busy === provider.id;
        return <section className="admin-card admin-card--content ui-card admin-integration-card" key={provider.id}>
          <div className="admin-integration-card__header">
            <div><h3>{provider.title}</h3><p>{provider.description}</p></div>
            <span className={`ui-status ${status?.configured ? "ui-status--success" : "ui-status--muted"}`}>{sourceLabel(status)}</span>
          </div>
          <label className="admin-integration-card__toggle"><input type="checkbox" checked={status?.enabled ?? true} disabled={!status || disabled} onChange={(event) => void run(provider.id, () => saveIntegration(provider.id, { enabled: event.target.checked }))} /> Enabled</label>
          {status?.capabilities?.length ? <div className="admin-integration-card__capabilities" aria-label={`${provider.title} capabilities`}>{status.capabilities.map((capability) => <span className="ui-chip" key={capability}>{capability.replaceAll("_", " ")}</span>)}</div> : null}
          <label className="ui-field"><span>{provider.id === "googleMaps" ? "Server API Key" : "API Key"}</span><input className="ui-input" type="password" autoComplete="new-password" placeholder={status?.maskedKey || "Enter API key"} value={keys[provider.id]} onChange={(event) => setKeys((current) => ({ ...current, [provider.id]: event.target.value }))} /></label>
          {status?.maskedKey ? <div className="admin-integration-card__metadata">Saved credential: <strong>{status.maskedKey}</strong></div> : null}
          {status?.lastTestedAt ? <div className="admin-integration-card__metadata">Last tested: {new Date(status.lastTestedAt).toLocaleString()} — {status.lastTestSuccessful ? "successful" : "failed"}</div> : null}
          {message[provider.id] ? <div className="ui-status ui-status--warning">{message[provider.id]}</div> : null}
          <div className="ui-action-row">
            <button className="ui-button ui-button--primary" disabled={disabled || !keys[provider.id].trim()} onClick={() => void run(provider.id, async () => { const next = await saveIntegration(provider.id, { enabled: status?.enabled ?? true, apiKey: keys[provider.id] }); setKeys((current) => ({ ...current, [provider.id]: "" })); setMessage((current) => ({ ...current, [provider.id]: "Configuration saved." })); return next; })}>Save / Update</button>
            <button className="ui-button" disabled={disabled || !status?.configured || !status.enabled} onClick={() => void run(provider.id, async () => { const result = await testIntegration(provider.id); setMessage((current) => ({ ...current, [provider.id]: result.message })); await refresh(); })}>Test Connection</button>
            <button className="ui-button ui-button--danger" disabled={disabled || status?.source !== "quotesync"} onClick={() => void run(provider.id, () => clearIntegrationKey(provider.id))}>Remove key</button>
          </div>
        </section>;
      })}
    </div>
  </div>;
}
