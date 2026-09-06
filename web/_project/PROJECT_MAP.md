# PROJECT_MAP

Last updated: 2026-09-04

## Working rules
- Design is handled by the user + ChatGPT.
- Codex implements only.
- Inspect the live repo before changing structure, behaviour, or documentation.
- Use targeted staging where appropriate; do not default to broad staging.
- Backups must exclude `C:\Github\QuoteSync\web\_backups` from the backup source.
- Stop backend/dev before backup so `quotesync.db` is not locked.
- Any database entries required for new or existing features/functions must be added to `quotesync.db` going forward.

## Product architecture boundary

- QuoteSuite's long-term product architecture is **QuoteSuite Core + optional modules, add-ins and industry verticals**.
- Ecofenster and Window & Door remain the first end-to-end proving workflow. Genuinely generic business capability belongs in Core; specialist configuration, manufacturer intelligence and Window & Door domain rules remain within that vertical boundary.
- Do not prematurely generalise or weaken the current proven workflow. A genuine second vertical should later validate Core neutrality.
- Commercial packaging may combine a core subscription, users/seats, optional paid capabilities and justified usage-based services without hard-coded product prices.
- Canonical policy is maintained in `AGENTS.md`; programme scope, candidate modules and growth context are maintained in Administration → Development → QuoteSuite Roadmap.

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
- Configurator workflow-definition shell is now live under:
  - `src/features/estimateWorkflow/*`
  - `src/features/configurator/components/*`
  - `src/features/configurator/components/steps/*`
- The live configurator path is now position-scoped:
  - estimate creation opens estimate context
  - `Add Position` uses the shared position editor in create mode
  - expanded-estimate row `Edit position` uses the same shared position editor in edit mode
- The old `App.tsx` position wizard is no longer the live configurator path.
- The workflow shell now provides:
  - ordered declarative steps
  - top progress flow
  - next/back navigation
  - validation hooks
  - conditional external-sill skipping
  - local draft save/resume abstraction
  - review summary
- The existing `ConfiguratorWorkspace` remains the visual configuration stage inside the wider workflow shell.
- Opening render / SVG asset preview is now fully removed.
- Transitional layout editor is the single live preview/editor path.
- The Configuration stage now owns the first windows-only element-definition layer:
  - scalable composition layout structure
  - per-field type assignment
  - per-junction mullion types
  - split mode foundations
  - frame / rebate controls
  - glass presets
  - bars / astragals / duplex foundations
  - hardware foundations
- Admin-driven configurator catalog foundation is now live in `quotesync.db` for:
  - manufacturers
  - products
  - window types
  - section profiles
  - window-type profile mappings
  - sections / drawings
  - materials
  - colours
  - hardware
  - glass
- The native drawing-render foundation is now split into:
  - admin catalog input
  - structured drawing model
  - QuoteSync SVG render output
- CAD/SVG files are now explicitly treated as source/reference input only, not final render output.
- Profile / Section Mapping Layer v1 now bridges the admin catalog to the native drawing model by:
  - storing section/profile records in `quotesync.db`
  - storing product/type-to-profile mappings in `quotesync.db`
  - resolving those mappings inside the configurator before drawing
  - feeding section-aware values into the drawing-model builder for:
    - frame widths
    - sash widths / insets / overlaps
    - mullion width
    - transom width
    - cill / bottom differences
- The profile-driven render path has been strengthened so linked section-drawing reference records can now enrich resolved profile geometry with render-driving values such as:
  - visible internal frame face
  - glass inset / bead offsets
  - sash overlap
  - handle axis offsets
  - hinge pivot offsets
  - flying-mullion meeting gap
- Section drawing records remain reference-input sources only:
  - DXF/DWG/SVG paths are catalog metadata used to inform profile geometry
  - the live preview still renders from the native drawing model, not the uploaded files
- Fixed and inward-opening tilt & turn previews are now section-driven rather than using the same generic geometry assumptions.

## Current structural direction
- `App.tsx` must not be expanded blindly; move logic into feature files where practical.
- Shared view behaviour should be reused across contexts instead of duplicated.
- Global controls remain outside shared collection internals when they are page-specific.
- CSS and structure tracking handovers remain mandatory maintenance documents:
  - `_project/_handover/css-handover.md`
  - `_project/_handover/audit-structure.md`

## Current phase boundary
- The current live phase is **Profile / Section Mapping Layer v1** on top of the catalog/drawing/render foundation.
- Quick edit remains explicitly deferred while the catalog/drawing/render architecture is being established correctly.
- The configurator is not a single screen. It is a guided position-entry workflow in which the visual configurator is only one stage.
- The render engine must draw natively from structured data, not display imported DXF/SVG files directly.
- The preferred geometry pipeline is now:
  - backend catalog / section data
  - resolved profile geometry
  - native drawing model
  - live technical render
- This phase stays scoped to:
  - fixed windows
  - inward-opening tilt & turn windows
- This phase does not yet widen into:
  - outward opening implementation
  - sliding implementation
  - DXF/DWG export
  - full CAD section interpretation

## Configurator workflow definition to carry forward
1. Estimated Order Forecast
2. Project Site Address
3. Invoice Address
   - optional / skippable
4. Estimate Defaults
   - guided next/back sequence
   - Supplier & Product
   - Finishes
   - Hardware
   - Glazing
   - Handle
   - Door Options
   - Accessories
   - frame extensions removed from Defaults and moved to Configuration
5. Quick Add Position seed
   - product
   - product type
   - family type
6. Position Configurator

## Position configurator flow to carry forward
1. Add Position
   - position reference
   - quantity
   - room name
   - position type
2. Dimensions
   - width
   - height
3. Configuration
   - internal sections:
     - Layout
     - Fields
     - Mullions / Splits
     - Frame / Rebate
     - Glass
     - Bars / Astragals / Duplex
     - Hardware
4. Save
5. Prompt to add another position or finish

## Configurator design direction for next phase
- Guided workflow with next/back controls.
- Top progress flow.
- Save/resume from the current step.
- Admin-driven defaults and option dependencies.
- Windows-only element-definition scope is now live for the first pass.
- Support/design-level requirements:
  - admin data drives product/system/type/section relationships
  - drawing model carries geometry, meaning, annotation, and relationships
  - render engine outputs native QuoteSync SVG and is structured for later PDF/DXF work
  - profile/section mappings now form the bridge between admin catalog data and the native drawing model
  - 1 field
  - 2/3/4/5/6+ field horizontal
  - 2/3/4/5/6+ field vertical
  - scalable grid compositions using rows/columns
  - mixed field types within one element
  - static mullion vs flying mullion at junction level
  - frame division vs glass division
  - manual split adjustment
  - handles
  - hinging options
  - rebate inside/outside on bottom frame
  - frame dimensions in 25mm increments
  - handle height logic
  - inside/outside orientation hook
  - glazing presets inside Configuration
  - astragals / feature bars inside Configuration
  - duplex toggle inside Configuration
  - manual bar positioning foundations
  - layout capacity is not the product definition; the real definition comes from:
    - layout structure
    - field behaviour per position
    - junction rules between adjacent fields
  - CAD exports are reference input only:
    - DXF may be authored source
    - SVG may be cleaned debug/reference
    - neither is the final render
  - future corner / bay / angle / post conditions
  - future door / sliding / lift-slide / bifold families
- Glass and Bars are no longer top-level outer workflow pages.

## Maintenance artifacts from this run
- Backup: `C:\Github\QuoteSync\web\_backups\20260420_170559-quotesync-maintenance-backup.zip`
- Structure snapshot: `C:\Github\QuoteSync\web\_project\structure\20260420_170559-structure-snapshot.txt`
- Manifest: `C:\Github\QuoteSync\web\_project\_manifests\20260420_170559-maintenance-manifest.txt`
- New chat handover: `C:\Github\QuoteSync\web\_project\_handover\20260420_170559-new-chat-handover.md`
- Configurator handover: `C:\Github\QuoteSync\web\_project\_handover\20260420_170559-configurator-handover.md`

## 2026-04-22 workflow refinement
- Estimate-stage flow is now being tightened around:
  - Forecast
  - Project Site Address
  - Estimate Defaults
  - Quick Add Seed
  - Configuration
  - Review / Save
- Invoice address is now removed from the live estimate-stage path.
- Estimate Defaults is now structured as an internal guided sequence driven from the catalog bootstrap for:
  - Supplier / Product
  - Timber options where relevant
  - Finishes
  - Hardware / Handles
  - Glass
  - Accessories
- Step 7 `Configuration` now owns the real position-working inputs:
  - Position reference
  - Quantity
  - Room name
  - Width
  - Height
- Configurator role refinement now includes:
  - `Layout` with a Freehand foundation
  - field-pattern selection kept field-count-specific
  - `Openings` reframed as `System Options`
- Render refinement in this pass is limited to:
  - improved field-label placement
  - opening indicators staying visually inside the glazed area
- The profile-driven render path remains intact and is still the source of render-driving geometry where mapped data exists.

---

## 20260424_142103 — Configurator architecture checkpoint

### Admin source of truth
- Admin Configurator is the source of truth for product/configurator definitions.
- Estimate Configurator should become a consumer of Admin-defined systems, options, render profiles, layouts, and glass options.
- Avoid separate admin and estimate configurator logic long-term.

### Shared schema layer introduced
- src/features/configurator/configuratorSchema.types.ts
- src/features/configurator/configuratorSchema.helpers.ts

### Current rendering flow
Admin Definition -> Shared Schema -> profileSectionMapping.ts -> buildWindowDrawingModel.ts -> QuoteSyncDrawingSvg.tsx

### Current status
- Phase 1 shared schema/helpers: complete and committed (280be7d).
- Admin-defined trickle vent support: complete and committed (42a04fc).
- 1-field inward/internal Admin renders are approved source of truth for Fixed, Fixed with sash, Tilt, Turn Left/Right, Tilt & Turn Left/Right.
- Multi-field Admin rendering/layout authoring is the next major phase.

### Next recommended phase
Admin multi-field configurator support using the shared schema; do not start bottom rebate until multi-field Admin architecture is established.
