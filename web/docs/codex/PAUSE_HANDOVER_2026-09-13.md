# Shutdown handover — 13 September 2026

## Stop and resume contract

The user has paused the entire authorised programme for approximately one week. Start no new work until the user returns. Do not treat the original 73-entry objective, broader intake/conflicts, installation programme or later customer stages as complete or user-accepted.

On return read `AGENTS.md`, `src/features/developmentRoadmap/roadmap.data.ts`, `src/features/developmentRoadmap/roadmap.workPackages.ts`, this handover and the newest notes in `docs/codex/IN_PROGRESS_ROADMAP_WORK_PACKAGES_2026-09-11.md`. Verify the branch, checkpoint and preserved worktree before continuing. Do not reset, clean, replay completed work or automatically retry live operations.

## Checkpoint identities

- Repository: `C:\Github\QuoteSync`, working directory `C:\Github\QuoteSync\web`.
- Approved branch: `backup/post-phase-9-working-2026-08-04`.
- Completed implementation HEAD at handover preparation: `8ef01e28cedce4fc568cc271f35ada425e1fc6e5` — Configure and snapshot reviewed installer mileage policies.
- Recorded remote-tracking SHA at preparation: `503bc2fecd96d5e354a79c1f7b968ddfdc5ca99e`; 21 implementation/evidence commits ahead. This is a captured tracking value, not a fresh remote verification.
- Remote: `https://github.com/ecofenster/QuoteSync.git`. Earlier push attempts were permission-blocked. The latest user expressly requests checkpoint/push to this approved backup branch; perform one permitted push attempt and verify the remote SHA. Report any denial, never bypass it.
- This handover is committed after the implementation checkpoint. Its own enclosing commit cannot contain its self-referential SHA. Resolve the shutdown checkpoint with `git log -1 --format=%H -- docs/codex/PAUSE_HANDOVER_2026-09-13.md`; the final shutdown report supplies its exact local/remote verification. Check `git rev-parse HEAD`, `git status --short`, and `git ls-remote --heads origin backup/post-phase-9-working-2026-08-04` before resuming. Differences require investigation, not destructive restoration.

## Current bounded task and completed work

Installer travel-policy configuration and reviewed snapshot adoption are complete at the implementation checkpoint. Administration Company add/edit stores an optional per-vehicle-mile rate or explicitly included vehicle-mileage policy with its basis. Existing Companies receive no default tariff. Installation proposes that policy but requires explicit adoption, deriving the canonical rate/version on the server. Alternatively staff retain the saved Estimate rate. Later Administration changes do not reprice earlier snapshots. Retry reuses confirmed work; stale reviews, fabricated snapshots and invalid rates fail visibly. Included vehicle mileage does not silently exclude labour, food, accommodation or additional attendance expenses.

Earlier coherent checkpoints retained exact route-save receipts, corrected endpoint SQL mapping, enforced paired route ownership, added separate outward/return review and manual evidence, distinguished daily return from an overnight journey, and preserved source-qualified weights/materials in installer PDFs. See the journal and `git log 503bc2f..8ef01e2` for the completed chain. Existing suspect historical routes are not automatically rewritten: require reviewed recalculation.

Relevant implementation paths:

- `shared/installationTravelPolicy.js` and `.d.ts`; `shared/installationRoutePair.js`; `shared/manualInstallationTravel.js`; `shared/routeSnapshotClient.js`; `shared/installationProgramme.js`.
- `server/schema/supplierCommercialSchema.js`; `server/features/projectCalculatorLab/` services and `estimateSitePostcode.js`; locate `installationWorkforceService.js` and `installationReviewTransaction.js` by filename.
- `src/features/projectCalculatorLab/InstallationTravelReview.tsx`, `ConfigureInstallation.tsx`; locate `InstallationWorkforceAdmin.tsx` by filename.
- `server/features/installationSafety/installationDocumentSource.js` and installation document projection/PDF tests.
- `scripts/run-complete-customer-order-journey-browser.mjs`; `tests/installation-travel-policy.test.mjs`; `tests/route-snapshot-persistence.test.mjs`.

## Exact next unfinished step — do not implement before return

Full-address travel has ONLY been investigated read-only. No unfinished implementation patch exists for it. Continue by adding a canonical full-address projection from the saved assigned Team base and selected revision's actual site, then carry that binding into reviewed routing, server adoption and installer PDF. Current journey binding is UK-postcode based and must not be described as full-address routing.

Already inspected: `estimateSitePostcode.js` prioritises Estimate project address/postcode then Client project address and finally explicit Client-address fallback. `getScenario` and ConfigureInstallation's selected Team snapshot expose basePostcode but omit baseAddress in relevant projections. Team Administration already retains baseAddress.line1; Company address/postcode also exist. `installationDocumentSource.js` uses working Estimate project_address for working sources and immutable release siteAddress/projectAddress for issued/Order sources. Preserve that revision distinction. Never combine an address with a conflicting manual postcode, invent coordinates or silently rewrite saved travel. Retain explicit postcode-only/manual basis when full evidence is unavailable. Preserve unrelated ConfigureInstallation edits.

After implementing this bounded address change, proportionately verify exact owner/revision binding, missing/conflicting addresses, distinct directions, manual recovery, policy snapshots and normal-route PDFs; then current and Legacy Light/Dark and smaller-screen/zoom access. Reuse valid earlier evidence rather than repeating the whole programme.

## Validation already completed

- 15 focused travel-policy, actual-schema route persistence, route-pair, manual travel, evidence and projection tests pass.
- `node scripts/run-installation-programme-tests.mjs`: 26 pass. `npm run typecheck`: pass. `npm run test:development-roadmap`: 28 pass before this documentation checkpoint.
- Normal-browser run `9ea684bd-8015-463e-b338-369e24c7440c` exits 0 using disposable records/storage: Company missing-rate error retains basis; save/reopen; existing Estimate stays unchanged; proposed GBP 0.65 policy; explicit version-2 adoption; blocked save and safe retry; installer/client PDF preparation; bounded 11-document history recovery; 960x600 document actions.
- Installer PDF SHA256 `b761adb696a3cdb460161583f3b0d67b51577c33cfe5b1574a8e13ca0566775b` (3 pages). Client PDF `8b043c1938da4bd177915cc598f389edb45c44e4d959b401b84a7c25194f6c75` (1 page; price-free and no installer allowances).
- Routing/geocoding were controlled no-network evidence, not real-provider route verification. Application persistence/costing/document generation used the actual isolated API. No live emails or live business filing occurred.
- Owned browser root 41216 and exact profile `C:\Users\PC\AppData\Local\Temp\QuoteSync\e2e\phase6\run-rR2MfQ` were cleaned in finally with independent zero process/profile counts. Shutdown inspection also finds that profile and earlier run-X2ZXup absent, those browser PIDs absent, and no listeners on test ports 3104/5276/9416.
- Shutdown changes are documentation/Roadmap next-action only; re-run Roadmap consistency and diff checks, not an unnecessary new browser journey. Final shutdown report records their outcome.

## Pending requirements and ordinary-user acceptance

`survey-delivery-installation` remains partial/unaccepted; `workforce-domain` retains its delivered policy/qualification evidence without overall acceptance. Original-73 mapping and statuses are not reduced by this checkpoint. Remaining connected work includes full-address travel, relevant policy types if genuinely needed, stale-source recovery, unsupported weight/field evidence, reviewed current drawings through configured folder IDs, complete operational/support/Purenit details, ordinary/door FFL survey approval and editable revision handoff, reviewed attachments and email delivery. Do not promise a complete installer pack, approved lifting weight or survey workflow.

Short pending user check: in disposable Administration configure/reopen a Company's mileage policy; open a disposable Estimate's Installation; select/save its Team; review both journey legs and policy; choose daily return or overnight; Apply; inspect saved basis/costing and installer PDF; amend Company policy and confirm the existing Estimate does not change. Also review manual-error recovery and current/Legacy theme readability. Full-address checks follow its implementation, not before. Other package checklists remain in the programme journal; live EF-CL-028 filing stays for reviewed user submission. Broader intake/conflict acceptance, tenant isolation and clean provisioning remain separate gates; unverified isolation/contaminated provisioning remain release blockers. No new contractual SLA or live delivery permission is inferred.

## Preserved local work / ownership

See [PAUSE_WORKTREE_INVENTORY_2026-09-13.md](PAUSE_WORKTREE_INVENTORY_2026-09-13.md) for the exact pre-handover status inventory. Five tracked unrelated paths remain: the two root text-file deletions, two B92 reports, and ConfigureInstallation.tsx (23 insertions/15 deletions unrelated feedback). These belong to pre-existing/user work and are not included. Untracked B92/design reports, audit scripts, private supplier PDFs/assets, credentials-related files and root asset directories are preserved, ownership unconfirmed. Do not execute old live-recovery scripts on resumption merely because they exist.

Git push backs up committed source/documentation only. It does NOT back up this unrelated dirty/untracked content or ignored `.quotesuite-acceptance/`, `server/quotesync.db`, local attachments, secrets and `test-output/`. Those remain locally intact; no purge, reset or mass add is authorised. The inventory backs up names/status, not contents. Preserve the PC disk; a clean remote clone cannot reconstruct local private data or test evidence.

## Runtime and persistent acceptance restart — no secrets

At shutdown inspection the normal user-owned API listened on 3001, PID 17268 (started 13 September 10:22:36 local), parent watcher 29604, supervisor 3156 (both started 11 September). Command: Node watched `C:\Github\QuoteSync\web\server\index.js`; supervisor `scripts/run-development-workspace.mjs`. These pre-existing processes are user-owned and are not terminated by Codex. Watcher child IDs can change; recapture PID/parent/command/start/health before any runtime action. The current source health contract is v15; verify `/api/health` and the changed endpoint capability, not just files on disk. The older pre-existing native watcher may restart on notifications; do not mistake it for an owned test process.

No owned test/browser/API jobs remain from the passing run; all tests started for shutdown must finish before reporting safe shutdown. Do not kill all Node/Chrome processes. PC shutdown will stop user applications normally.

From `C:\Github\QuoteSync\web`, use `npm run dev:quotesuite` for normal full-stack development. API-only is `npm run api`, or `node index.js` from `web\server`, never from web. Inspect port 3001 first and reuse a compatible existing listener.

For persistent isolated acceptance, use `npm run dev:acceptance` instead of a simultaneous normal stack. Default ignored root `.quotesuite-acceptance` holds `quotesync-acceptance.db` and `attachments`; optional QUOTESUITE_ACCEPTANCE_ROOT changes that root. Existing progress survives restarting this command. Do not run a reset or substitute the live database. See `docs/codex/TEST_JOURNEY.md` and `config/test-journey.example.env` for configuration names, not secret values. Gmail/Drive must be connected in that workspace's Administration using designated test accounts and roots; encrypted integration configuration belongs to that database. No current credential validity is claimed here. Keep the existing infrastructure encryption configuration intact; do not copy live tokens into tests.

Controlled delivery stays preview-only unless its explicit enable switch AND test-recipient allowlist are configured and the reviewed Send action is authorised. This pause does not authorise enabling sending. Never send live client/installer/supplier emails for automated acceptance. `dev:test-journey` and the automated browser runner instead use temporary disposable databases removed at exit, not persistent acceptance progress.

## Pasteable restart instruction

Read AGENTS.md, the authoritative Development Roadmap and docs/codex/PAUSE_HANDOVER_2026-09-13.md. Verify the approved branch, shutdown checkpoint SHA and preserved worktree against its inventory. Resume only the recorded full-address installer-travel next step; reuse completed evidence, preserve unrelated/live data and delivery safeguards, and keep unaccepted work unaccepted.
