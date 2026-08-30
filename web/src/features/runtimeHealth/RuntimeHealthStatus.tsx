import React from "react";
import { useRuntimeHealth } from "./RuntimeHealthContext";
import { runtimeHealthCopy } from "./runtimeHealth";

export function RuntimeHealthBadge() {
  const { state } = useRuntimeHealth();
  const development = import.meta.env.DEV;
  const copy = runtimeHealthCopy(state.phase, development);
  const healthy = state.phase === "connected";

  return (
    <div
      className="runtime-health__badge"
      data-state={state.phase}
      role="status"
      aria-live="polite"
      title={healthy ? "A QuoteSuite API instance is running and its database is connected." : copy.title}
    >
      <span className="runtime-health__dot" aria-hidden="true" />
      {copy.label}
    </div>
  );
}

export function RuntimeHealthNotice() {
  const { state, retry } = useRuntimeHealth();
  const development = import.meta.env.DEV;
  const copy = runtimeHealthCopy(state.phase, development);
  const healthy = state.phase === "connected";
  const busy = state.phase === "connecting" || state.phase === "rechecking";
  const alert = ["api_offline", "database_unavailable", "runtime_mismatch"].includes(state.phase);

  if (healthy) return null;

  return (
    <div
      key={state.phase}
      className="runtime-health__notice"
      data-state={state.phase}
      data-mutations={state.phase === "recovered" ? "allowed" : "paused"}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
    >
      <div className="runtime-health__copy">
        <strong>{copy.title}</strong>
        <span>{copy.message}</span>
        {development && state.phase === "api_offline" && (
          <span className="runtime-health__startup-help">
            Start either from <code>web\server: node index.js</code> or from <code>web: npm run api</code>.
          </span>
        )}
      </div>
      {state.phase !== "recovered" && (
        <button className="ui-button runtime-health__retry" type="button" onClick={retry} disabled={busy}>
          {busy ? "Checking…" : "Retry connection"}
        </button>
      )}
    </div>
  );
}

export default function RuntimeHealthStatus() {
  return (
    <>
      <RuntimeHealthBadge />
      <RuntimeHealthNotice />
    </>
  );
}
