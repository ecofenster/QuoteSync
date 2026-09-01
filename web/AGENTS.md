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

## Administration interaction consistency

- Administration configuration areas must reuse established QuoteSuite navigation, table, CRUD, modal, status, responsive and theme patterns. Feature-specific settings must not introduce an unnecessarily bespoke interaction model when the shared patterns satisfy the workflow.

## Manufacturer quotation ingestion reliability

- Manufacturer quotation ingestion is a critical QuoteSuite workflow. It must remain source-preserving, provenance-preserving, idempotent, transactionally safe, quantitatively reconciled, diagnostically explicit and recoverable.
- QuoteSuite must never report a manufacturer quotation import as successful or completed unless the expected canonical supplier positions, Products / Supply rows and Project Costing product projection have been verified from persisted state. Silent failure, false success, fabricated evidence and unrecoverable partial imports are prohibited.
- Recovery follows one bounded ladder: native DOCX/PDF structural extraction; deterministic geometry/layout reconstruction; bounded supplier/layout interpretation; visual/page-region evidence extraction; bounded OCR only for genuinely raster or missing evidence; then explicit reviewed unresolved evidence. Missing evidence remains missing or review-required, and one unresolved position must not silently discard unrelated valid positions.
- Structured manufacturer specifications and distinct manufacturer visual views are source evidence. Preserve their exact wording, roles and source regions with provenance even when no canonical or customer-safe projection exists; normalization must never replace the original evidence.
- Manufacturer visual evidence must never be associated automatically with a position unless deterministic source ownership is proven. Retain unavailable or review-required evidence rather than selecting a nearby, visually similar or otherwise guessed drawing.

## Manufacturer and supplier/dealer identity

- Canonical manufacturer identity owns product brands, systems and catalogue families. Commercial supplier/dealer identity owns the issued quotation, dealer-specific prices, terms, settlement and pricing policy. Do not merge these identities merely because one document contains both.
- A manufacturer may be quoted through multiple suppliers/dealers, and one supplier/dealer may sell multiple manufacturers. Imported position evidence must retain both identities and the exact quotation provenance; dealer-specific pricing must never leak to another dealer through a shared manufacturer identity.
- Where the manufacturer and commercial supplier are genuinely the same legal business, the two roles may resolve to the same underlying identity without duplicating product or commercial evidence.
- Commercial confirmation and reconciliation must be isolated by commercial dealer, quotation and revision. Confirming or revising one supplier quotation must never delete, replace or absorb another dealer quotation's Products / Supply or Project Costing projections; manufacturer identity cannot substitute for dealer identity.
- Source position/list prices remain faithful to the supplier quotation. Additive supplier accessories import to Products / Supply or Extras exactly once according to their source-backed classification, and supplier delivery/freight imports to Transport.
- When a supplier states an explicit pre-discount Products / Supply or List Price subtotal, reconcile source unit price × source quantity plus every source-backed Products / Supply item against that subtotal before considering any discount. Retain contributors, exclusions, classifications and variance; a material unexplained variance blocks commercial confirmation. When no explicit source subtotal exists, retain the extracted total and report reconciliation as unavailable rather than inventing a target.
- Supplier installation and survey charges remain source commercial evidence and are not imported automatically into Project Costing. Controlled commercial role overrides a legacy persisted category for Project Costing classification: supplier installation lives only in Installation, supplier survey only in Survey / Site Visit, and neither may appear in or inherit markup from Extras. Supplier installation is an explicit substitutive choice for the active Installation cost, never additive, and the Estimate-owned installation programme must remain available when it is not selected. Internal company, project, site-visit or installation costs must never be attributed to a supplier quotation.
- Supplier discounts, rebates and settlement adjustments remain visible source evidence but are not applied automatically. Applying a supplier discount requires an explicit user action through the canonical Project Costing discount boundary; original line evidence remains unchanged and no discount may be applied twice.
- Supplier quotation reconciliation and Project Costing imported cost are distinct. Intentionally excluded optional components, unapplied discounts and evidence-only installation/survey charges do not constitute an extraction or reconciliation failure.
- A configured policy must not reapply a source-backed discount to values already classified as net, and an explicit quotation issuer must fail closed when it conflicts with the selected configured dealer or quotation aggregate.
- Installation Materials use material-specific quantity strategies rather than one generic contingency formula. Order-fixed items, including Illbruck AA270 and AB005, contribute exactly one per order when required and zero when excluded; contingency must never increase them.
- Administration is the Installation Materials purchase-cost authority. New Project Costing scenarios snapshot material identity, variant, purchase unit, coverage, cost and calculation assumptions; later Administration changes must not silently reprice an existing scenario, and a required item without a snapshotted cost remains explicitly review-required rather than becoming zero.
- ME508, ME501, TP600 and ME902 use the canonical installation-joint perimeter with one 15% linear contingency before whole-unit rounding. FM330 instead uses the approved 92 mm depth × 20 mm joint ÷ 45 litres-per-can model and whole boxes of 12 without the separate 15% contingency. Non-rectangular products require an explicit canonical installation perimeter rather than an assumed rectangular fallback.
- Mechanical fixing placement is calculated independently for each installed product and then multiplied by that position's grouped quantity; never divide a whole-project perimeter by generic spacing. Bracket length is a product variant, not fixing-centre spacing. Use only the exact source-backed GGF/product rule applicable to the frame and project context, and require review for unsupported families or geometry.
- The approved bracket assembly uses two bracket-to-frame screws per bracket and, for concrete, ICF, brick or block, one substrate fixing per bracket. Whole-pack rounding applies only at the purchasable product boundary and adds no contingency. Until an exact substrate product and cost is supplied, retain the calculated substrate quantity but keep its commercial state review-required; never invent a masonry or timber fixing.
- Current Administration catalogue seed corrections may update active catalogue configuration once, but must never rewrite saved Estimate material/rule snapshots. Historical material values remain read-only until an explicit current-catalogue amendment; selectable options then come only from the current active Administration catalogue. Historical placeholder identities remain inactive compatibility evidence rather than selectable new-costing products.

## Development API runtime verification

- Any task that changes server-side/API code and performs live acceptance or mutation must verify the identity or required capability of the active listening API process first. Source files on disk do not prove which source the running process loaded. Advance the shared runtime contract when compatibility changes; for bounded changes within one contract, verify the changed endpoint capability directly.
- Both supported development starts run `server/index.js`: from `web\server`, use `node index.js`; from `web`, use `npm run api`. The invalid form is `node index.js` from `web`, where no root `index.js` exists.

## Development API process ownership

- The user owns the normal persistent QuoteSuite development API. Before any task starts, restarts or otherwise controls an API, inspect port 3001 and capture whether it was listening plus its PID, parent PID, command line, start time and runtime contract. Reuse one compatible pre-existing API; never blindly start a second listener.
- When no API existed at task start, any API started by Codex for tests, browser acceptance, runtime verification or read-only inspection is temporary Codex-owned infrastructure. Track its exact root PID/process tree, stop it from a `finally` cleanup path and restore port 3001 to not listening before reporting completion.
- A pre-existing user-owned API must not be silently replaced. If a server-code change genuinely requires restart, preserve the ownership baseline, avoid multiple listeners and explicitly report any intentionally retained replacement PID and command. Unknown or ambiguous listeners must not be terminated automatically.
- Cleanup may target only exact PIDs/process trees started by the current task. Broad Node termination such as image-name or process-name killing is prohibited because Vite, Codex and unrelated applications may also use Node.
- At applicable task completion, compare port 3001 with the captured baseline and report its final ownership state. The supported user starts remain `node index.js` from `web\server` and `npm run api` from `web`.
