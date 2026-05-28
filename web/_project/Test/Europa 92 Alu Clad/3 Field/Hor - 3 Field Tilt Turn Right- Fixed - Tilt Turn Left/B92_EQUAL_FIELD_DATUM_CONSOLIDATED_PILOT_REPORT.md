# B92 Equal Field Datum Consolidated Pilot Report

## 1. Files Changed

Created local consolidated generator:

- `generate_b92_equal_field_datum_consolidated_pilot.cjs`

Created consolidated pilot outputs:

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`

Created this report:

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`

The accepted ownership-zone pilot SVG/DXF was read as input and was not overwritten.

## 2. Exact Implementation Made

Implemented a local consolidated pilot that preserves the accepted B92-13 internal ownership-zone profile geometry and adds separate equal-field datum semantics as non-profile reference entities.

The implementation separates:

- `logicalDivisionX`: equal-field reference datum.
- `physicalOwnershipBoundaryX`: profile ownership/termination boundary.
- `claddingExtentX`: cladding coverage data, excluded from equal-field width calculation.

No mirror, rotation, scaling, or bbox-fit logic was introduced. The profile geometry is copied translation-only from the accepted pilot output.

## 3. How `logicalDivisionX` Is Represented

`logicalDivisionX` is represented on a dedicated non-profile DXF/SVG layer:

- `LOGICAL_DIVISION_REFERENCE_NON_PROFILE`

Logical divisions:

| Role | logicalDivisionX | Reference line hits | Profile endpoint hits at same X |
|---|---:|---:|---:|
| left_middle_equal_field_reference | 2903.918 | 4 | 4 |
| middle_right_equal_field_reference | 3903.918 | 4 | 4 |

These reference lines are semantic datum markers only. They are not source/profile geometry and must not be counted as profile lines.

## 4. How `physicalOwnershipBoundaryX` Is Represented

`physicalOwnershipBoundaryX` remains represented by the accepted B92-13 ownership-zone pilot profile endpoints. Additional short non-profile guide lines are emitted only on:

- `PHYSICAL_OWNERSHIP_BOUNDARY_REFERENCE_NON_PROFILE`

Accepted physical ownership boundaries:

| Boundary family | Raw boundary X | physicalOwnershipBoundaryX | related logicalDivisionX | Offset from logical division | Profile endpoint hits |
|---|---:|---:|---:|---:|---:|
| outer | 3902.418 | 3924.417 | 3903.918 | 20.500 | 16 |
| middle_rebate | 3959.418 | 3981.417 | 3903.918 | 77.500 | 14 |
| inner_mitre | 3980.418 | 4002.417 | 3903.918 | 98.500 | 8 |

## 5. How `claddingExtentX` Is Kept Separate

`claddingExtentX` is not used to calculate field equality.

Current cladding semantics:

- typical aluminium cladding allowance: approximately 6 mm wider than timber,
- affects equal field width: `false`,
- current pilot treatment: `tracked separately when cladding geometry is present`,
- rule: Cladding extents are not used to calculate logicalDivisionX, equal sash width, or equal glass width.

No cladding extent was used to move `logicalDivisionX`.

## 6. B92-13 Ownership-Zone Pilot Behaviour Preserved

The accepted ownership-zone x positions remain present in the consolidated profile geometry:

- `3924.417`
- `3981.417`
- `4002.417`

Validation:

- input accepted pilot profile LINE count: 106
- consolidated profile LINE count before adding references: 106
- non-profile reference LINE count added: 8
- profile geometry preserved from accepted pilot: `true`
- accepted pilot profile LINE sequence retained as consolidated DXF prefix: `true`

## 7. Before / After Comparison

### Logical Division Coordinate

| Datum | Before ownership-zone pilot | Accepted physical pilot | Consolidated equal-field datum |
|---|---:|---:|---:|
| left/middle logical division | 2903.918 | unchanged logical datum | 2903.918 |
| middle/right logical division | 3903.918 | not moved to physical boundary | 3903.918 |

### Physical Ownership Boundary Coordinates

| Boundary family | Original raw boundary | Accepted pilot physical boundary | Consolidated physical boundary |
|---|---:|---:|---:|
| outer | 3902.418 | 3924.417 | 3924.417 |
| middle_rebate | 3959.418 | 3981.417 | 3981.417 |
| inner_mitre | 3980.418 | 4002.417 | 4002.417 |

### Visible Sash / Glass Equality Checks Where Measurable

The measurable equal-field reference spans are:

| Field | Width | Basis |
|---:|---:|---|
| 1 | 1000.000 | logical equal-field datum |
| 2 | 1000.000 | logical equal-field datum |
| 3 | 1000.000 | logical equal-field datum |

Equal reference fields validated: `true`

Sash/glass visible equality is preserved at datum level, but exact visible sash/glass numeric widths are not fully certified from the profile-proof-only line set because those lines are not yet semantically tagged as sash-visible or glass-visible authority boundaries. This remains a validation extraction task, not an ownership-zone failure.

## 8. Generated Files

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`

## 9. Validation Run

Command:

- `node generate_b92_equal_field_datum_consolidated_pilot.cjs`

Validation summary:

- output filenames include `CONSOLIDATED` or `EQUAL_FIELD_DATUM`: `true`
- equal logical reference field widths: `1000.000 / 1000.000 / 1000.000`
- equal fields pass: `true`
- accepted physical ownership endpoint hits found: `true`
- accepted pilot profile LINE sequence retained before appended references: `true`
- no source DXF was written.
- no accepted pilot file was overwritten.

## 10. Remaining Blockers

- Exact visible sash/glass widths still need authority role extraction before numeric visible sash/glass equality can be certified.
- The consolidated pilot is not a full proof approval or lock.
- External, 1-field, 2-field, Admin, Estimate, and runtime renderer behavior remain out of scope.

## 11. Ready / Not Ready Recommendation

Recommendation: ready for manual visual review as a consolidated pilot reference only.

The ownership-zone behavior is preserved, and the equal-field datum is now explicit and separate from physical ownership boundaries. It is not ready for generalisation until visible sash/glass authority roles are extracted and checked.

## Audit

- Files read:
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_VALIDATED_REFERENCE.md`
  - `B92_13_INTERNAL_DIVISION_ISSUE_ISOLATION_REPORT.md`
  - `B92_LOGICAL_DIVISION_VS_PHYSICAL_BOUNDARY_PLAN.md`
  - `B92_EQUAL_FIELD_DATUM_IMPLEMENTATION_PLAN.md`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_REPORT.md`
- Files changed:
  - `generate_b92_equal_field_datum_consolidated_pilot.cjs`
- Files created:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`
- Validation run:
  - `node generate_b92_equal_field_datum_consolidated_pilot.cjs`
- Confirmation no prohibited files changed by this consolidated pass:
  - No source DXF was overwritten.
  - No accepted pilot file was overwritten.
  - No approval or lock status was changed.
  - No external proof was changed.
  - No approved 1-field or 2-field proof was changed.
  - No renderer/Admin/Estimate runtime file was changed.
  - `npm run dev` was not run.
  - `git add` was not run.
