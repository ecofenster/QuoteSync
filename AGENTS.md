# QuoteSuite Repository Instructions

These are the standing repository-wide instructions for Codex and other development agents working in this repository. They apply to every task unless a higher-priority instruction explicitly overrides them.

The QuoteSuite Development Roadmap in **Administration → Development → QuoteSuite Roadmap** is the authority for current priorities, programme status, sequencing, dependencies and development history. Do not place changing roadmap information in this file.

## Start every development task

1. Read and follow the applicable `AGENTS.md` before acting.
2. Consult the QuoteSuite Development Roadmap for current priorities and status.
3. Work from the current repository and file state. Inspect relevant files rather than relying on stale assumptions.
4. Check the current branch, HEAD, staging area and working-tree state before making changes when the task can affect repository content.
5. Preserve unrelated and pre-existing changes. A dirty working tree is expected and is not permission to alter or include everything.

## Repository and Git safety

- Treat `main` as protected. Do not switch to, merge into, commit on or push `main` unless the user explicitly authorises that exact action.
- Never stage, commit, amend, push, force-push, fetch-and-integrate, create a checkpoint or otherwise change Git history unless the user explicitly authorises it.
- When staging is authorised, stage only an explicit, reviewed path list. Do not use `git add .`, `git add -A` or broad directory staging unless every included path is approved.
- Before committing, review the staged path list and complete staged diff, run `git diff --cached --check`, and scan staged content for secrets, credentials, unsafe binaries and unrelated material.
- Never use destructive Git or filesystem operations—including reset, clean, restore, checkout-discard, stash, bulk deletion or broad moves—without explicit authorisation and exact verified targets.
- Do not discard, overwrite, relocate or absorb unrelated user work. Untracked files, local evidence, reference assets, databases, credentials, browser profiles and generated material remain untouched unless specifically in scope.
- After an authorised commit, confirm its exact path list, confirm staging is empty and verify that no intended file was omitted before any authorised push.
- Never force-push. Fetch and compare the intended remote branch before an authorised push; stop on unexpected divergence.

## Protected live data

- Clients `EF-CL-001` through `EF-CL-008` are protected live user data.
- Do not edit, delete, merge, deduplicate, re-reference, deactivate or otherwise mutate these Clients or their persisted data.
- Do not attach disposable Estimates or other mutable test records to protected Clients.
- Tests and acceptance workflows must use explicitly owned disposable fixtures and clean up only records they own.
- Where a task could affect live data, use deterministic read-only before/after verification appropriate to the risk.
- Do not inspect or print credentials, ignored secret files or live API keys unnecessarily.

## Canonical architecture boundaries

- Estimate is the current canonical project and commercial container unless an approved architecture change explicitly supersedes it.
- The dedicated Estimate workspace is the primary operational commercial UI. Internal View is the default staff workspace; Customer View is a customer-safe reduced presentation of the same Estimate-owned Project Costing scenario. Shared actions always modify canonical Estimate/Position state, and Administration Customer View controls must never enable internal commercial data.
- Configurator is the generic product architecture. B92 is one currently proven product/system-specific implementation and must not be treated as universal coverage. `ConfiguredPositionContract` remains the canonical technical configuration contract where a position is genuinely configured.
- Document drawings must resolve through product/system-specific providers behind a generic Configurator boundary. Providers may reuse proven geometry, but must return unavailable for unsupported families and must not persist duplicate drawing geometry or configuration state.
- Configurator foundation does not mean the Configurator product programme is complete. Preserve that distinction in implementation, tests and roadmap status.
- Canonical Estimate Positions bridge B92 and reviewed supplier imports into Estimate-owned positions. Do not create competing position authorities.
- Supplier evidence remains separate from canonical Estimate Positions and customer-facing output. Preserve evidence lineage without making evidence a second source of truth.
- Manufacturer position visuals must retain the original source asset and mapping provenance. Customer-facing output may use only a reviewed renderable derivative; ambiguous visual-to-position associations remain unavailable rather than being guessed.
- Manufacturer-quoted thermal values are immutable source evidence, distinct from certificate/catalogue values and QuoteSuite-calculated performance. Preserve their quotation, revision and position provenance; never relabel them as calculated values or invent missing Uf/Psi.
- Project Costing is the sole authority for customer quotation selling prices. Customer documents must consume saved Project Costing commercial state; they must not independently recalculate prices or use legacy Estimate/manufacturer prices.
- Administration commercial defaults initialise new Project Costing scenarios only. Once persisted, Estimate-owned commercial values and revisions must not be silently rewritten when an Administration default changes.
- Supplier pricing methods are supplier-specific, revision-snapshotted inputs to Project Costing. `1 to 1 Pricing` is an explicit GBP commercial parity policy, not an FX rate; preserve original currency, amount, saved FX evidence and policy provenance. Staged supplier discounts compound sequentially and remain internal commercial information.
- Customer-facing output must not expose supplier purchase prices, purchase FX, supplier discounts, internal markups, margins, internal commercial notes, evidence/debug IDs or other internal-only data.
- Customer-document branding is tenant/company data and is separate from QuoteSuite application branding. Generic document renderers must consume a brand projection and must not hard-code QuoteSuite or a development tenant.
- Do not create parallel stores, duplicate pricing engines, competing identity models or compatibility workarounds that bypass canonical boundaries.
- Treat compatibility and legacy paths as contained transitional code. Do not resurrect them as canonical architecture merely to satisfy stale tests.

## Development discipline

- Make the smallest coherent change that satisfies the request and preserves established architecture.
- Fix only the requested capability or proven defect. Do not perform opportunistic cleanup, adjacent UI redesign or unrelated refactoring.
- Do not rewrite whole files when a bounded edit is sufficient. Prefer exact, reviewable changes over broad mechanical or regex replacement.
- Do not perform a broad `App.tsx` rewrite. Extract only the responsibility directly required by the active feature, and protect it with focused regression coverage.
- Do not change production behaviour to satisfy an obsolete test assumption. First classify whether a failure is a product defect, stale assertion, infrastructure issue or environment/provider issue.
- Stop and report genuine product defects when the active task does not authorise their repair. Never weaken tests to hide defects.
- Do not invent business rules, technical specifications, customer data, supplier data or missing thermal/commercial values.
- Keep implementation bounded, incremental and testable. Do not begin work that cannot reasonably reach a coherent validated boundary within the available task scope.
- Preserve the design system, dark/light theme behaviour and accessibility conventions when changing UI.
- Do not introduce credentials, live fixture identifiers, protected Client references or local environment assumptions into production code.

## Development Roadmap governance

- Every completed development slice must update **Administration → Development → QuoteSuite Roadmap** before being reported complete.
- Update relevant item status, dependencies, blockers, next action, technical debt and limitations according to actual evidence.
- Add a concise Roadmap History entry describing the objective, capability delivered, validation and remaining limitations.
- Mark an item GREEN/Complete only when its defined capability and appropriate acceptance criteria are complete. Partial foundations or useful implementation remain AMBER/In Progress.
- Record relevant new ideas and debt without automatically interrupting the agreed development sequence. Only current-stage requirements, genuine defects, safety/reliability needs, architectural blockers or explicit reprioritisation should interrupt it.
- Keep temporary milestone state, target dates, priorities, sequencing and task-specific decisions in the Roadmap, Roadmap History, task instruction or appropriate technical documentation—not in `AGENTS.md`.

## Validation and completion

- Add or update focused regression coverage for changed behaviour.
- During development, run targeted validation proportional to the change; avoid repeatedly running broad suites without a reason.
- Select the smallest acceptance boundary that proves the change: UI/layout work uses focused tests, applicable TypeScript and targeted browser inspection; commercial-calculation work uses focused calculation tests and the relevant minimal scenario/browser proof; manufacturer fixtures are reserved for extraction, mapping, evidence or import changes; quotation/PDF/print acceptance is reserved for document projection, layout, rendering or printing changes.
- Reserve the complete Client → Import → Costing → Quotation → PDF workflow for cross-boundary milestones/regression checkpoints or an explicit request. Do not make full imports, full disposable commercial workflows or PDF regeneration the default validation for unrelated changes.
- Prefer an isolated test database, then a reusable seeded disposable scenario for UI-only checks, then minimal purpose-built disposable records. Never use protected Clients for acceptance.
- Before declaring a coherent implementation complete, run the focused tests for every changed boundary plus TypeScript, ESLint, applicable design-system validation, production build and `git diff --check`, unless the user explicitly narrows validation or an environment blocker is reported.
- Run broader integration or browser/E2E validation when the risk crosses domain boundaries or when required by acceptance criteria. Use disposable fixtures and never mutate protected Clients.
- Report exact test results, static-validation results, known warnings, unperformed acceptance checks and remaining limitations truthfully.
- Do not call a stage complete merely because source exists, usage is low or time is ending.

## Permanent-rule maintenance

On every future development task, Codex must:

1. Read and follow the applicable `AGENTS.md`.
2. Consult the QuoteSuite Development Roadmap for current priorities and status.
3. Consider whether the task introduces, changes, supersedes or reveals a genuinely permanent repository or development rule.
4. Update `AGENTS.md` when such a permanent rule has been established or changed, keeping the edit bounded and consistent with higher-priority instructions.
5. Report every `AGENTS.md` change in the final task report.

Do not add temporary information here, including Codex allowance, current milestone progress, changing roadmap status, transient blockers, short-lived implementation decisions or task-specific instructions.
