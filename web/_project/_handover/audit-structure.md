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