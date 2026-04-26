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

## Update (20260420_configurator_workflow_shell)

### What was done
- Added a dedicated workflow-definition layer under `src/features/estimateWorkflow/`:
  - `workflow.types.ts`
  - `workflow.steps.ts`
  - `workflowDefinition.ts`
  - `workflowGuards.ts`
  - `workflowDraft.ts`
  - `workflowValidation.ts`
- Added guided workflow shell components under `src/features/configurator/components/` and `src/features/configurator/components/steps/`.
- Kept the existing `ConfiguratorWorkspace` and moved it into the `configuration` step instead of replacing it outright.
- Wired the new shell through `EstimateExpandedPanel` so the existing configurator entry point now opens the workflow shell with minimal integration changes.

### What remains
- Runtime-review the workflow shell and adjust step detail once design feedback lands.
- Decide later whether draft persistence stays local or moves into DB-backed draft records.
- Deep configurator engine logic, quick edit, and broader family branching still remain out of scope for this shell pass.

### Structural decisions
- Workflow metadata is now declarative rather than switch-heavy.
- Save/resume is now behind a draft abstraction so persistence can move later without rewriting the shell UI.
- `App.tsx` remains untouched in this phase.

## Update (20260420_position_configurator_unification)

### What was done
- Corrected the live architecture so the configurator is treated as a position editor, not an estimate-level configurator.
- Kept estimate context in the estimate container flow and reused one shared position editor for:
  - create mode from estimate workspace `Add Position`
  - edit mode from expanded-estimate row `Edit position`
- Replaced the old live `App.tsx` position wizard render path with the shared workflow shell/provider stack.
- Hardened workflow-provider state so a normalised draft object is always available on first render.

### What remains
- Runtime-check the create/edit flows and refine any step detail after design feedback.
- Decide later whether the draft adapter should remain local-storage backed or move to DB-backed draft records.
- Deeper element/geometry engines and quick edit remain out of scope.

### Structural decisions
- There should be one live position configurator/editor system, not separate estimate-create and position-edit configurators.
- Position editing should not restart a whole-estimate workflow.
- The null-draft crash was a provider-boundary issue and is now handled at the workflow foundation layer.

## Update (20260420_configurator_element_definition_v1)

### What was done
- Reworked the live position-flow step boundary to:
  - `addPosition`
  - `dimensions`
  - `configuration`
  - `review`
- Added invoice-address direction into the wider workflow draft without reopening a broad `App.tsx` redesign.
- Rebuilt `src/features/configurator/configuratorWorkflow.helpers.ts` into the windows-only element-definition adapter layer for:
  - layout families
  - field-type mappings
  - glass preset catalog
  - configuration normalisation
  - position/draft conversion
- Reworked `src/features/configurator/ConfiguratorWorkspace.tsx` so the single live transitional editor is driven by structured configuration state instead of loose insertion-only controls.
- Removed the old top-level `GlassStep`, `BarsStep`, and `ExternalWindowSillStep` render path so glass and bars no longer exist as separate outer workflow pages.

### What remains
- Keep the next configurator work inside the windows-only family boundary before branching into doors/sliding/bifolds/corners.
- Move later admin-driven catalogs/settings into a dedicated source rather than scattering option data.
- Reduce unrelated legacy `App.tsx` position-wizard leftovers in a separate cleanup pass.

### Structural decisions
- `Transitional layout editor` remains the only live preview/editor system.
- Glass, bars, astragals, duplex, mullions, split logic, frame/rebate, and hardware belong inside `Configuration`, not as parallel outer workflow pages.
- The window-element-definition layer must stay reusable between create/edit flows and remain admin-extensible.

## Update (20260421_configurator_composition_logic)

### What was done
- Replaced the earlier limited named layout-family assumption with rows/columns-driven composition logic in the configurator helper/model layer.
- Added explicit junction state so adjacent-field relationships are now first-class for both:
  - vertical mullions
  - horizontal transoms
- Updated the live Configuration workspace so presets are only shortcuts; the real saved model now comes from scalable composition structure.

### What remains
- Keep future geometry/render work reading from this composition model instead of inventing a second definition layer.
- Extend later family branches from the same structure rather than introducing separate hardcoded template systems.

### Structural decisions
- Field count is layout capacity, not the product definition.
- The product definition now comes from:
  - layout structure
  - field behaviour per position
  - adjacency/junction rules
- Grid compositions are part of the same core model, not a separate configurator path.

## Update (20260421_catalog_drawing_render_foundation)

### What was done
- Added DB-backed configurator catalog tables in `server/db.js` and a dedicated `server/routes/configuratorCatalog.js` API route.
- Replaced the admin placeholder for `Configurator Controls` with a real top-tab workspace in:
  - `src/features/admin/AdminConfiguratorCatalogWorkspace.tsx`
  - `src/features/admin/configuratorCatalogService.ts`
  - `src/features/admin/configuratorCatalog.types.ts`
- Added drawing-model/render foundation files under `src/features/configurator/rendering/`.
- Refactored `src/components/GridEditor.tsx` so the live preview is now:
  - drawing model build
  - native QuoteSync SVG render
  rather than direct ad hoc SVG construction only.

### What remains
- Expand the admin catalog deeper into configurator option binding beyond the first glass-preset connection.
- Keep future PDF/DXF work reading from the drawing model rather than from rendered SVG output.
- Add richer section/profile rule interpretation from catalog data into the drawing model in later passes.

### Structural decisions
- The architecture is now explicitly:
  - admin data
  - drawing model
  - render engine
- CAD/DXF/SVG files are reference input only and must not become the final drawing path.
- The render engine must remain multi-output ready, so the drawing model cannot collapse into SVG-only state.

## Update (20260421_profile_section_mapping_v1)

### What was done
- Added DB-backed section/profile records and window-type profile-mapping records in `server/db.js`.
- Extended `server/routes/configuratorCatalog.js` and the frontend catalog types/service layer so the admin/catalog bootstrap now includes:
  - `sectionProfiles`
  - `profileMappings`
- Split the Admin `Sections / Drawings` surface into a dedicated workspace:
  - `src/features/admin/ConfiguratorSectionsWorkspace.tsx`
  - profiles
  - mappings
  - reference drawings
- Added `src/features/configurator/rendering/profileSectionMapping.ts` as the bridge that resolves catalog mappings into drawing-model inputs.
- Updated `src/features/configurator/ConfiguratorWorkspace.tsx` and `src/components/GridEditor.tsx` so the live configurator passes resolved section/profile data into the native drawing builder.
- Reworked `src/features/configurator/rendering/buildWindowDrawingModel.ts` so frame, sash, mullion, transom, and cill geometry now read from resolved section-aware values with fallback defaults.

### What remains
- Expand the mapping resolver beyond fixed and inward tilt & turn when outward-opening/sliding work is intentionally started.
- Bind more configurator/admin options into the same resolver path instead of introducing parallel hardcoded geometry rules.
- Add richer section/profile rule interpretation from reference drawings later without letting DXF/SVG become the final render path.

### Structural decisions
- Section/profile records and product/type mappings are now the explicit bridge layer between admin data and the native renderer.
- The renderer must consume resolved section-aware values rather than hardcoded generic geometry whenever mappings exist.
- `Sections / Drawings` is no longer just a reference-drawing editor; it is now the profile/mapping management surface for the render foundation.

## Update (20260422_profile_driven_render_architecture)

### What was done
- Strengthened `src/features/configurator/rendering/profileSectionMapping.ts` so linked section-drawing records now enrich resolved profiles with geometry-rule values instead of leaving that data stranded in catalog bootstrap only.
- Extended resolved profile data and drawing-model metadata to carry reference-input provenance for section drawings while keeping the render path native.
- Updated `src/features/configurator/rendering/buildWindowDrawingModel.ts` so more geometry now reads from resolved profile/section values before falling back to generic assumptions.

### What remains
- Continue moving render-driving values out of generic defaults and into catalog/profile data where that backend information exists.
- Expand the same profile-driven pattern later for outward-opening, sliding, coupling, and corner logic when those phases are intentionally started.
- Improve admin/catalog authoring over time, but keep that as a controlled backend/catalogue evolution rather than a single-pass UI rewrite.

### Structural decisions
- Section drawing records are reference-input data, not final render assets.
- The preferred pipeline is now explicit in structure:
  - backend catalog / profile data
  - resolved geometry values
  - native drawing model
  - render output
- The current admin/configurator workspace should be treated as scaffolding around the future catalogue/rules backend, not the final long-term authoring surface.

## Update (20260422_defaults_restructure)

### What was done
- Removed invoice address from the live estimate-stage workflow path.
- Reduced duplicate position entry by making `Configuration` the real working position step for:
  - position reference
  - quantity
  - room name
  - width / height
- Replaced the placeholder estimate-defaults summary with a real internal section sequence driven from catalog bootstrap data.
- Clarified configurator section roles:
  - `Layout` now includes a Freehand foundation
  - `Fields` remains field-count-specific and pattern-first
  - `Openings` has been repurposed as `System Options`
- Kept render cleanup local to the drawing builder by refining field-label placement and opening-line bounds there.

### What remains
- Broaden catalog-driven filtering and system-option authoring as more admin data becomes authoritative.
- Expand Freehand from foundation state into richer mixed-height / empty-field composition tools later.
- Continue reducing duplication between defaults and configuration without reopening the completed profile-driven renderer foundation.

### Structural decisions
- Workflow restructuring now sits on top of the existing profile-driven render architecture rather than replacing it.
- Estimate defaults and live position configuration are now separate responsibilities:
  - defaults define the option envelope
  - configuration edits the active position within that envelope

---

## 20260424_142103 — Post trickle-vent / schema audit

### Clean
- Shared schema layer added without runtime behaviour changes.
- Admin-defined trickle vent support committed separately.
- Trickle vent geometry now uses explicit section dimensions only.
- Admin 1-field inward/internal renders are source of truth.

### Risks / technical debt
- Estimate Configurator still owns multi-field layout/opening logic.
- Admin Configurator does not yet author full multi-field/grid layouts.
- Glass presets still partially exist in estimate-side logic.
- Working tree contains unrelated dirty/deleted/untracked files that must not be swept into future commits.

### Next audit priority
Before Phase 2 implementation, audit existing estimate multi-field layout/render logic and migrate into shared/Admin-backed definitions in controlled slices.
