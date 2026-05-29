# B92 Approved Profile Section Assembly Admin Registration Report

Date: 2026-05-29

This report records the single consolidated Admin catalogue registration pass for the B92 / Europa 92 Alu Clad approved profile-section assembly proof set.

Scope was limited to the 14 approved/accepted proof pairs already documented in `B92_APPROVED_PROFILE_SECTION_ASSEMBLY_PROOF_SET_REPORT.md`. No proof SVG, DXF, source DXF, renderer geometry, Estimate, or Admin layout redesign changes were made.

## Registered Proof Families

All 14 approved/accepted proof families are now present in `src/features/admin/windowTypes/b92ProfileSectionProofRegistry.ts` and have generated internal/external geometry in `src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts`.

| ID | Label | Status | Views |
| --- | --- | --- | --- |
| `b92-1-field-fixed` | 1 Field Fixed | approved-locked | internal, external |
| `b92-1-field-tilt-turn` | 1 Field Tilt & Turn | approved-locked | internal, external |
| `b92-2-field-fixed-fixed` | 2 Field Horizontal Fixed / Fixed | approved-locked | internal, external |
| `b92-2-field-fixed-tilt-turn-left` | 2 Field Horizontal Fixed / Tilt & Turn Left | approved-locked | internal, external |
| `b92-2-field-turn-tilt-turn` | 2 Field Horizontal Turn / Tilt & Turn | approved-locked | internal, external |
| `b92-2-field-tilt-turn-left-right` | 2 Field Horizontal Tilt & Turn Left / Tilt & Turn Right | approved-locked | internal, external |
| `b92-2-field-tilt-turn-right-left` | 2 Field Horizontal Tilt & Turn Right / Tilt & Turn Left | approved-locked | internal, external |
| `b92-2-field-fixed-tilt-turn-right` | 2 Field Horizontal Fixed / Tilt & Turn Right | approved-locked | internal, external |
| `b92-2-field-fixed-bottom-fixed-top` | 2 Field Vertical Fixed Bottom / Fixed Top | approved-locked | internal, external |
| `b92-2-field-tilt-turn-bottom-fixed-top` | 2 Field Vertical Tilt & Turn Bottom / Fixed Top | approved-locked | internal, external |
| `b92-2-field-fixed-bottom-tilt-turn-top` | 2 Field Vertical Fixed Bottom / Tilt & Turn Top | approved-locked | internal, external |
| `b92-3-field-fixed-fixed-fixed` | 3 Field Horizontal Fixed / Fixed / Fixed | approved-locked | internal, external |
| `b92-3-field-tilt-turn-left-fixed-tilt-turn-right` | 3 Field Horizontal Tilt & Turn Left / Fixed / Tilt & Turn Right | approved-locked | internal, external |
| `b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference` | 3 Field Horizontal Tilt & Turn Right / Fixed / Tilt & Turn Left Equal-Field Reference | accepted-reference-only | internal, external |

## Newly Added Families

The following seven families were added to the Admin registry and generator input list:

- `b92-2-field-fixed-tilt-turn-right`
- `b92-2-field-fixed-bottom-fixed-top`
- `b92-2-field-tilt-turn-bottom-fixed-top`
- `b92-2-field-fixed-bottom-tilt-turn-top`
- `b92-3-field-fixed-fixed-fixed`
- `b92-3-field-tilt-turn-left-fixed-tilt-turn-right`
- `b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference`

The consolidated equal-field datum TTR / Fixed / TTL proof is registered as `accepted-reference-only`, not as a full renderer generalisation.

## Generated Geometry Confirmation

`scripts/generate-b92-profile-section-proof-geometry.mjs` now includes all 14 approved/accepted proof pairs as source-time SVG inputs.

The generated geometry file contains:

- 14 proof families.
- 28 proof views.
- Internal and external views for every registered family.
- No registry family without generated geometry.
- No generated geometry family without registry entry.

Segment-count validation against the accepted proof-set counts passed:

| ID | Internal | External |
| --- | ---: | ---: |
| `b92-1-field-fixed` | 30 | 37 |
| `b92-1-field-tilt-turn` | 38 | 52 |
| `b92-2-field-fixed-fixed` | 53 | 48 |
| `b92-2-field-fixed-tilt-turn-left` | 55 | 54 |
| `b92-2-field-turn-tilt-turn` | 96 | 110 |
| `b92-2-field-tilt-turn-left-right` | 69 | 92 |
| `b92-2-field-tilt-turn-right-left` | 58 | 84 |
| `b92-2-field-fixed-tilt-turn-right` | 67 | 68 |
| `b92-2-field-fixed-bottom-fixed-top` | 38 | 32 |
| `b92-2-field-tilt-turn-bottom-fixed-top` | 68 | 65 |
| `b92-2-field-fixed-bottom-tilt-turn-top` | 69 | 68 |
| `b92-3-field-fixed-fixed-fixed` | 60 | 44 |
| `b92-3-field-tilt-turn-left-fixed-tilt-turn-right` | 120 | 106 |
| `b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference` | 114 | 96 |

## Registry Confirmation

`B92_PROFILE_SECTION_PROOF_FAMILIES` now contains 14 entries. Existing seven entries were preserved, including their existing mapped design IDs.

`B92ProfileSectionAssemblyPreview` continues to render the selected family/view through `DrawingViewport`. The preview now distinguishes the accepted-reference-only status in the status label while keeping the same browse/test surface.

User access remains:

1. Open Admin window type preview/editor.
2. Choose preview source `B92`.
3. Select the proof family from the `Proof family` dropdown.
4. Switch internal/external view using the existing preview controls.

## Unmapped Design IDs

Existing mapped design IDs were preserved:

- `b92-2-field-fixed-fixed`: `windows-2-fixed-fixed-static`
- `b92-2-field-fixed-tilt-turn-left`: `windows-2-fixed-tilt-turn-left-static`

No new `mappedDesignIds` were added. The seven newly registered families remain manually browseable/testable from the proof-family selector because a safe one-to-one design mapping was not already obvious.

## Validation Run

Commands run:

- `node scripts/generate-b92-profile-section-proof-geometry.mjs`
- Registry/geometry count validation: passed with 14 registry families, 14 geometry families, 14 internal views, and 14 external views.
- Segment-count validation: passed for all 28 views.
- `npx tsc -b --noEmit`: failed on pre-existing unrelated app-wide TypeScript errors.
- Targeted TypeScript check for the touched proof files: passed.

Targeted TypeScript command:

```powershell
npx tsc --noEmit --jsx react-jsx --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict src/features/admin/windowTypes/B92ProfileSectionAssemblyPreview.tsx src/features/admin/windowTypes/b92ProfileSectionProofRegistry.ts src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts
```

## Recommendation

Ready for Admin manual browse/test of all 14 approved/accepted proof families and all 28 internal/external views.

This is Admin proof-catalogue registration only. It is not proof regeneration, proof overwrite, source DXF alteration, renderer geometry generalisation, or Estimate integration.

## Files Read

- `_project/Test/Europa 92 Alu Clad/B92_APPROVED_PROFILE_SECTION_ASSEMBLY_PROOF_SET_REPORT.md`
- `_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_ACCEPTED_REFERENCE.md`
- `_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_EXTERNAL_ACCEPTED_REFERENCE.md`
- `scripts/generate-b92-profile-section-proof-geometry.mjs`
- `src/features/admin/windowTypes/b92ProfileSectionProofRegistry.ts`
- `src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts`
- `src/features/admin/windowTypes/B92ProfileSectionAssemblyPreview.tsx`
- `package.json`

## Files Changed

- `scripts/generate-b92-profile-section-proof-geometry.mjs`
- `src/features/admin/windowTypes/b92ProfileSectionProofRegistry.ts`
- `src/features/admin/windowTypes/b92ProfileSectionProofGeometry.ts`
- `src/features/admin/windowTypes/B92ProfileSectionAssemblyPreview.tsx`

## Files Created

- `_project/Test/Europa 92 Alu Clad/B92_APPROVED_PROFILE_SECTION_ASSEMBLY_ADMIN_REGISTRATION_REPORT.md`

## Prohibited Changes Confirmation

No proof SVG files were changed. No proof DXF files were changed. No source DXF files were changed. No renderer geometry files were changed. No Estimate files were changed. No `npm run dev` was run. No `git add` was run.
