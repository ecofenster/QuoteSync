# PROJECT_MAP

Last updated: 2026-04-18 12:03:33

## Current state
- Tools are accessed from the top shell and are intended to render in the main app panel rather than replacing the full shell.
- Left sidebar no longer carries Preferences or Tools sections.
- Sidebar logo should not be reintroduced.
- Admin contains Settings and Project Preferences.
- CSS architecture handover exists and must be updated after each CSS-related change.
- Structure audit handover exists and must be updated after each structural change.
- App.tsx must not be added to blindly; new logic should go into separate files/folders unless App.tsx specifically requires the change.
- Structure and modularisation are now explicit project priorities to improve maintainability, fault finding, and future patching.

## Active priorities
1. Finish the tools foundation cleanly under separate feature folders/files.
2. Stabilise the Glass Weight Calculator against the PHP/source-of-truth version.
3. Complete the CSS architecture phase in controlled order:
   - tokens.css
   - base.css
   - utilities.css
   - ui.css
4. Run and apply the structure/dead-code/App.tsx reduction audit in phased order.
5. After tools and structure groundwork are stable, return to the paused configurator/settings work.

## Configurator/settings phase to return to
- configurator.defaultDimensions
- configurator.showDimensions
- feature.configurator.enabled

## Important architecture notes
- App.tsx should be reduced over time by moving logic into separate files/folders.
- Tools should live under src/features/tools/*
- Avoid fragile patching on live files. Prefer full-file replacement based on current live source.
- Backups must exclude _backups from the backup source.
- Before running backup scripts, stop the QuoteSync backend/dev server so quotesync.db is not locked.
- CSS handover and audit-structure handover are mandatory tracking documents and must be updated as work progresses.

## Handover note
This update reflects the transition into:
- CSS architecture planning
- structure/dead-code/App.tsx reduction planning
- stricter modularisation rules for future work
## Update (20260418_124654)
- CSS Phase 1 foundation completed under `src/styles/`:
  - `tokens.css`
  - `base.css`
  - `utilities.css`
  - `ui.css`
- Tools Phase 2 completed for:
  - `src/features/tools/glass/GlassWeightCalculatorTool.tsx`
  - `src/features/tools/bsen/BSENStandardsTool.tsx`
- Tool-local CSS now exists beside live tool components.
- Next priority: Admin CSS extraction before shared UI primitive work.
## Update (20260418_130621)
- Admin CSS Phase 3 complete
- Admin now partially token-driven
- Next: shared UI primitives (Phase 4)

## 20260418_210116
CSS Phase 4 + 5 + 6 completed

## Update (20260420_105229)
- Maintenance refresh completed from a single explicit backup-first run.
- Workflow rule confirmed: design is handled by the user + ChatGPT; Codex is the implementer only.
- Git rule confirmed: commit/push at safe logical boundaries; end-of-phase is acceptable.
- Backup rule confirmed: Codex does not create backups automatically; backup must be explicitly done before major structural implementation.
- Current next architecture phase: Unified Estimate Collection System.
  - Main-menu Estimates is the wrong model.
  - Client Estimates is the correct behaviour model.
  - Target: one shared expandable estimate collection system across client and main-menu contexts.
  - Same expand/collapse behaviour across both contexts.
  - List parity first, grid mode later.
- Grid/List standard:
  - list-first for data-heavy business views
  - grid-secondary where useful
  - same behaviour model across views
- Maintenance artifacts for this run:
  - Backup: C:\Github\QuoteSync\web\_backups\20260420_105229-quotesync-maintenance-backup.zip
  - Structure snapshot: C:\Github\QuoteSync\web\_project\structure\20260420_105229-structure-snapshot.txt
  - Manifest: C:\Github\QuoteSync\web\_project\_manifests\20260420_105229-maintenance-manifest.txt
  - New handover: C:\Github\QuoteSync\web\_project\_handover\20260420_105229-new-chat-handover.md
  - Configurator handover: C:\Github\QuoteSync\web\_project\_handover\20260420_105229-configurator-handover.md