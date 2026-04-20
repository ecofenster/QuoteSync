# QuoteSync – Structure & Codebase Audit Handover

## Purpose
Track structure audit covering:
- File responsibilities
- Dead code
- Duplicate code
- App.tsx reduction

## Completed
- Codebase structure audit completed
- CSS audit aligned
- App.tsx identified as oversized and over-responsible

## To Do
- Extract logic from App.tsx into feature modules
- Remove dead/unused code
- Consolidate duplicate UI primitives
- Introduce cleaner folder structure
- Reduce App.tsx to orchestration only

## Phased Plan

### Phase 1
- Identify extraction targets in App.tsx
- Move logic into features/services

### Phase 2
- Introduce new folders where required
- Split large files

### Phase 3
- Remove dead/unused code
- Clean imports

### Phase 4
- Final App.tsx reduction

## Rules

- App.tsx MUST NOT be expanded blindly
- New logic MUST go into new files/modules
- Structure takes priority over speed
- Smaller files = easier maintenance and debugging

## Tracking Requirement

This document MUST be updated after each structure change:
- What was done
- What remains
- Any structural decisions

audit-structure must be updated after every structural change.

## Update (20260418_124654)
- Added tool-local CSS beside live tool components:
  - `src/features/tools/glass/GlassWeightCalculatorTool.css`
  - `src/features/tools/bsen/BSENStandardsTool.css`
- Updated corresponding live TSX files to wire CSS safely.
- App.tsx remains untouched.
- Continue modular extraction approach; no structural rollback required.
## Update (20260418_130621)
- Admin styling moved to CSS
- No structural change to logic
- App.tsx still untouched

## 20260418_210116
Structure stable post CSS rollout

## Update (20260420_105229)

### What was done
- Refreshed structure audit tracking during the maintenance run.
- Recorded the Unified Estimate Collection System as the next architecture phase.
- Recorded that Client Estimates is the correct behaviour reference and Main-menu Estimates should be corrected to match it.

### What remains
- Converge client and main-menu estimate collection structures onto one shared expandable system.
- Keep list parity first and defer grid mode until later.
- Continue reducing opportunities for behaviour drift between views.

### Structural decisions
- No app source files were modified in this maintenance-only step.
- Behaviour model reuse across contexts is now a structure rule, not a suggestion.

## Update (20260420_persistence_audit)

### What was done
- Audited live persistence boundaries across `server/db.js`, estimate/client/note/follow-up/settings routes, and the current `quotesync.db` schema.
- Confirmed business data is persisted in SQLite while per-view UI state remains frontend-only.
- Confirmed orders are persisted as estimates with `outcome = 'Order'` and `order_meta_json`, not as a separate table.

### What remains
- Run/verify the estimate ownership migration against the live DB so `created_by_user_id`, `created_by_name`, and `created_by_role` are physically present in `quotesync.db`, not just in bootstrap/route code.
- Decide later whether user preferences such as list/grid or My/All should remain transient or move into persisted settings.
- Add a real files/documents persistence model if Client Files needs to survive reloads.

### Structural decisions
- Persistence boundary is currently correct as a rule: business entities in DB, ephemeral view state in frontend state.
- User role/group foundation is code-defined only for now and is intentionally not yet a permissions or access-control system.
- Ownership persistence concern from the original audit is now superseded by the later safe schema migration and backfill; the live DB now carries the estimate creator columns.

## Update (20260420_170559)

### What was done
- Refreshed structure tracking after the estimate-system unification, ownership alignment, Stage B entry-point work, and toolbar/persistence cleanup.
- Recorded the shared estimate collection layer as the live cross-context pattern for:
  - global estimate/order/lost views
  - client estimate/order/lost views
- Recorded `src/components/ControlToolbar.tsx` as the current shared toolbar/layout wrapper for consistent control-row rendering.
- Recorded `src/utils/userPreferences.ts` as the safe localStorage utility used for per-view preference persistence.
- Recorded that ownership persistence is now aligned at the live schema level after the safe estimate-column migration.

### What remains
- Continue reducing `App.tsx` where new work can safely move into dedicated feature files.
- Keep shared collection behaviour and shared control layout reused instead of reimplemented per context.
- Start the next design/implementation boundary at Configurator Workflow Definition rather than quick edit.

### Structural decisions
- The next phase is a workflow-definition phase, not a UI-expansion phase.
- The configurator is now a workflow boundary decision, not just a renderer decision.
- Quick edit remains deferred until configurator workflow scope, step ownership, and save/resume responsibilities are defined.
