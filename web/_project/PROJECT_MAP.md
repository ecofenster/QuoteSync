# PROJECT_MAP

Last updated: 2026-04-20 17:05:59

## Working rules
- Design is handled by the user + ChatGPT.
- Codex implements only.
- Inspect the live repo before changing structure, behaviour, or documentation.
- Use targeted staging where appropriate; do not default to broad staging.
- Backups must exclude `C:\Github\QuoteSync\web\_backups` from the backup source.
- Stop backend/dev before backup so `quotesync.db` is not locked.
- Any database entries required for new or existing features/functions must be added to `quotesync.db` going forward.

## Current completed architecture work
- Shared estimate collection system is now the live behaviour model across:
  - global `Estimates`, `Orders`, `Lost`
  - client `Estimates`, `Orders`, `Lost`
- `EstimateWorkflowProvider` has been moved into the per-expanded estimate panel so workflow state is owned by the expanded estimate context.
- List/Grid view support exists across global and client estimate collection views.
- My/All filtering exists across global and client estimate collection views.
- Creator ownership fields are wired through the estimate flow and the live DB schema has been aligned with the code migration for:
  - `created_by_user_id`
  - `created_by_name`
  - `created_by_role`
- Main-page entry points now exist for:
  - `Add Client`
  - `Add Estimate`
- View/filter preference persistence is now in `localStorage` for estimate views and Client Database views.
- Control toolbar layout and placement have been standardised around the global toolbar pattern.

## Current structural direction
- `App.tsx` must not be expanded blindly; move logic into feature files where practical.
- Shared view behaviour should be reused across contexts instead of duplicated.
- Global controls remain outside shared collection internals when they are page-specific.
- CSS and structure tracking handovers remain mandatory maintenance documents:
  - `_project/_handover/css-handover.md`
  - `_project/_handover/audit-structure.md`

## Current phase boundary
- The next phase is **Configurator Workflow Definition**.
- Quick edit is explicitly deferred until the configurator boundary, step flow, and save/resume behaviour are properly defined.
- The configurator is not a single screen. It is a guided position-entry workflow in which the visual configurator is only one stage.

## Configurator workflow definition to carry forward
1. Estimated Order Forecast
2. Project Site Address
3. Estimate Defaults
4. Add Position
   - position reference
   - quantity
   - room name
   - position type
5. Dimensions
   - width
   - height
   - remove fields display
6. External Window Sill
   - choose depth
   - choose end cap types
   - skip if fully default-driven unless the user chooses to edit
7. Configuration (Configurator)
8. Glass
9. Bars / Astragals / Duplex / related options
10. Review / Save / Resume

## Configurator design direction for next phase
- Guided workflow with next/back controls.
- Top progress flow.
- Save/resume from the current step.
- Admin-driven defaults and option dependencies.
- Windows-first likely implementation scope.
- Support/design-level requirements:
  - 1 field
  - 2/3/4/5/6 field vertical
  - 2/3/4/5/6 field horizontal
  - mixed field types within one element
  - static mullion vs flying mullion
  - frame division vs glass division
  - manual split adjustment
  - handles
  - hinging options
  - rebate inside/outside on bottom frame
  - frame dimensions in 25mm increments
  - freehand / coupled-unit direction
  - handle height logic
  - inside/outside render correction
  - glazing presets
  - astragals / feature bars
  - duplex toggle
  - manual bar positioning
  - future corner / bay / angle / post conditions
  - future door / sliding / lift-slide / bifold families
- Remove non-pertinent totals from the configurator stage:
  - total m2
  - linear meterage
  - total quantity
  - estimate total

## Maintenance artifacts from this run
- Backup: `C:\Github\QuoteSync\web\_backups\20260420_170559-quotesync-maintenance-backup.zip`
- Structure snapshot: `C:\Github\QuoteSync\web\_project\structure\20260420_170559-structure-snapshot.txt`
- Manifest: `C:\Github\QuoteSync\web\_project\_manifests\20260420_170559-maintenance-manifest.txt`
- New chat handover: `C:\Github\QuoteSync\web\_project\_handover\20260420_170559-new-chat-handover.md`
- Configurator handover: `C:\Github\QuoteSync\web\_project\_handover\20260420_170559-configurator-handover.md`
