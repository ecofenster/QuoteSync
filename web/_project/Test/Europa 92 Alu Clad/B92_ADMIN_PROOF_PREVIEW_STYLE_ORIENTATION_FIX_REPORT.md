# B92 Admin Proof Preview Style Orientation Fix Report

Date: 2026-05-29

This report records the consolidated Admin B92 profile-section assembly proof preview orientation and styling fixes.

Scope was limited to the Admin proof preview pipeline. No approved proof SVG/DXF files, source DXF files, renderer geometry files, Estimate files, or Admin layout redesign changes were made.

## Root Cause: Upside-Down Views

The two affected proof families use SVG group transforms with a flipped Y axis:

- `b92-2-field-tilt-turn-left-right`
- `b92-2-field-tilt-turn-right-left`

Their source SVGs wrap proof linework in transforms like:

```text
translate(...) scale(1,-1) translate(...)
```

The source-time geometry generator previously flattened `translate(...)` only and ignored `scale(1,-1)`. That preserved segment counts but left Admin geometry in raw CAD Y-axis orientation.

Fix:

- `scripts/generate-b92-profile-section-proof-geometry.mjs` flattens `translate(...)` and `scale(...)` transform lists using an affine matrix before writing generated proof geometry.
- `data-layer` is also extracted as proof semantic role metadata, so transformed SVGs keep their profile/layer identity in generated geometry.
- The consolidated equal-field accepted-reference family now reads generated Admin line geometry from the user-corrected internal/external DXF proof files, because those DXFs are the accepted source of truth after removal of unwanted extra lines.
- The approved proof SVG/DXF source files were not changed.

## Root Cause: Incorrect Blue Glass Bounds

The first five approved proof families define the native proof styling rule. Their glass overlays are bounded by actual glazing bead/profile coordinates.

The incorrect implementation used a generic equal-field overlay for later proof families. That created blue rectangles from broad proof bounds instead of glazing bead geometry. The later frame-only correction removed bad glass, but it also failed the intended rule because every approved proof should have native blue glass where the bead-bounded glass area can be derived.

## Exact Fix

`src/features/admin/windowTypes/b92ProfileSectionProofSemanticAdapter.ts` now derives glass bounds for the remaining families from the approved proof line geometry:

- collect long vertical and horizontal proof-line clusters,
- find large interior daylight gaps between adjacent bead/profile boundary clusters,
- derive one glass rectangle per field from those bead-bounded gaps,
- use horizontal derivation for horizontal layouts and vertical derivation for stacked layouts,
- preserve the first five hand-derived overlays unchanged.

This produces bead-bounded glass areas instead of invented equal rectangles.

## Trusted Reference Overlays Preserved

These first five families remain unchanged and continue to define the styling rule:

- `b92-1-field-fixed`
- `b92-1-field-tilt-turn`
- `b92-2-field-fixed-fixed`
- `b92-2-field-fixed-tilt-turn-left`
- `b92-2-field-turn-tilt-turn`

## Derived Bead-Bounded Glass Added

These nine families now derive native blue glass from proof bead/profile boundary gaps:

- `b92-2-field-tilt-turn-left-right`
- `b92-2-field-tilt-turn-right-left`
- `b92-2-field-fixed-tilt-turn-right`
- `b92-2-field-fixed-bottom-fixed-top`
- `b92-2-field-tilt-turn-bottom-fixed-top`
- `b92-2-field-fixed-bottom-tilt-turn-top`
- `b92-3-field-fixed-fixed-fixed`
- `b92-3-field-tilt-turn-left-fixed-tilt-turn-right`
- `b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference`

No frame-only fallback styling is used for these registered families.

## Files Changed

- `scripts/generate-b92-profile-section-proof-geometry.mjs`
- `src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts`
- `src/features/admin/windowTypes/b92ProfileSectionProofSemanticAdapter.ts`
- `_project/Test/Europa 92 Alu Clad/B92_ADMIN_PROOF_PREVIEW_STYLE_ORIENTATION_FIX_REPORT.md`

## Validation Run

Commands/checks run:

- `node scripts/generate-b92-profile-section-proof-geometry.mjs`
- Confirmed generated proof geometry still contains 14 families and 28 views.
- Confirmed all expected segment counts are unchanged:
  - `b92-1-field-fixed`: `30 / 37`
  - `b92-1-field-tilt-turn`: `38 / 52`
  - `b92-2-field-fixed-fixed`: `53 / 48`
  - `b92-2-field-fixed-tilt-turn-left`: `55 / 54`
  - `b92-2-field-turn-tilt-turn`: `96 / 110`
  - `b92-2-field-tilt-turn-left-right`: `69 / 92`
  - `b92-2-field-tilt-turn-right-left`: `58 / 84`
  - `b92-2-field-fixed-tilt-turn-right`: `67 / 68`
  - `b92-2-field-fixed-bottom-fixed-top`: `38 / 32`
  - `b92-2-field-tilt-turn-bottom-fixed-top`: `68 / 65`
  - `b92-2-field-fixed-bottom-tilt-turn-top`: `69 / 68`
  - `b92-3-field-fixed-fixed-fixed`: `60 / 44`
  - `b92-3-field-tilt-turn-left-fixed-tilt-turn-right`: `120 / 106`
  - `b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference`: `106 / 82`
- Confirmed corrected consolidated DXF line counts:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`: `106`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`: `82`
- Confirmed Admin generated geometry for the consolidated equal-field accepted-reference family now points at those corrected DXF files via `sourceDxfFile` and uses `106 / 82` generated segments.
- Confirmed the nine derived families produce the expected glass region count:
  - each 2-field proof: 2 glass regions per view,
  - each 3-field proof: 3 glass regions per view.
- Confirmed the first five approved proof families retain their existing hand-derived glass overlay code path.
- Targeted TypeScript check passed:

```powershell
npx tsc --noEmit --jsx react-jsx --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict src/features/admin/windowTypes/B92ProfileSectionAssemblyPreview.tsx src/features/admin/windowTypes/b92ProfileSectionProofRegistry.ts src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts src/features/admin/windowTypes/b92ProfileSectionProofSemanticAdapter.ts
```

## Source Proof File Confirmation

No approved proof SVG files were edited.

No approved proof DXF files were edited.

No source DXF files were edited.

## Recommendation

Ready for manual Admin review.

Manual review should confirm:

- the first five dropdown items remain visually unchanged,
- all remaining registered families show native frame and native blue glass,
- glass sits inside the glazing bead/profile boundary areas,
- no equal-field invented blue rectangles remain,
- the two T&T/T&T families remain upright.

This pass fixes Admin preview display only. It does not change approved proof geometry, approval status, proof source files, renderer geometry, or Estimate integration.
