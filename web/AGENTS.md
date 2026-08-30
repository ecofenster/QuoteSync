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

## Manufacturer quotation ingestion reliability

- Manufacturer quotation ingestion is a critical QuoteSuite workflow. It must remain source-preserving, provenance-preserving, idempotent, transactionally safe, quantitatively reconciled, diagnostically explicit and recoverable.
- QuoteSuite must never report a manufacturer quotation import as successful or completed unless the expected canonical supplier positions, Products / Supply rows and Project Costing product projection have been verified from persisted state. Silent failure, false success, fabricated evidence and unrecoverable partial imports are prohibited.
- Recovery follows one bounded ladder: native DOCX/PDF structural extraction; deterministic geometry/layout reconstruction; bounded supplier/layout interpretation; visual/page-region evidence extraction; bounded OCR only for genuinely raster or missing evidence; then explicit reviewed unresolved evidence. Missing evidence remains missing or review-required, and one unresolved position must not silently discard unrelated valid positions.
- Structured manufacturer specifications and distinct manufacturer visual views are source evidence. Preserve their exact wording, roles and source regions with provenance even when no canonical or customer-safe projection exists; normalization must never replace the original evidence.

## Development API runtime verification

- Any task that changes server-side/API code and performs live acceptance or mutation must verify the identity or required capability of the active listening API process first. Source files on disk do not prove which source the running process loaded. Advance the shared runtime contract when compatibility changes; for bounded changes within one contract, verify the changed endpoint capability directly.
- Both supported development starts run `server/index.js`: from `web\server`, use `node index.js`; from `web`, use `npm run api`. The invalid form is `node index.js` from `web`, where no root `index.js` exists.
