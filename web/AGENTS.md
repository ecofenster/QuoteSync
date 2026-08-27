# QuoteSync Agent Rules

## Browser automation lifecycle

- Every browser automation run must own and clean up every Chrome/Chromium process and temporary profile it creates.
- Browser acceptance scripts must close their CDP/browser connection, terminate the owned browser process tree, remove the uniquely owned temporary profile, and verify zero browser processes remain for that exact profile from a `finally` cleanup path.
- On Windows, cleanup must target only the current run's root PID/process tree or processes matched to its exact `--user-data-dir`. Broad image-name termination is prohibited.
- Shared browser lifecycle helpers must be reused instead of scripts inventing independent launch and cleanup behavior.
- Cleanup must cover normal completion, exceptions, timeouts, child-process failure, and practical interrupt handling.

## Integration configuration persistence

- Provider configuration is entered once through Administration → Integrations and persists securely. Runtime/server master encryption is infrastructure-managed and must not require normal users to manually reload environment variables or re-enter provider credentials after restart.

## Provider-backed document uploads

- Files uploads must target the currently selected, capability-gated provider folder through the provider-neutral backend boundary. The provider remains binary-content authority; QuoteSuite persists canonical metadata and relationships only after the provider confirms file identity, and must not silently overwrite existing evidence or create a successful document record for a failed upload.

## Provider change notifications

- External provider notifications are change signals, never canonical message or document data. QuoteSuite must reconcile through the provider cursor/delta boundary into the local canonical projection, deduplicate notifications and retain bounded reconciliation as a consistency safety net; webhook authentication material and OAuth tokens remain backend-only.

## Application typography governance

- Ordinary QuoteSuite application typography must use the canonical semantic `--qs-type-*` scale; feature-specific arbitrary font sizing is prohibited. User text-size preferences operate only through the canonical token presets. Specialist Configurator/drawing annotations and generated customer/print documents retain separately reviewed typography contracts and must not be migrated without explicit scope.
