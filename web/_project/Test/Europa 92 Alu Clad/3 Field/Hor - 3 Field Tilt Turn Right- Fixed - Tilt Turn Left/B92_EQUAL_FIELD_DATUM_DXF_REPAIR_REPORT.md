# B92 Equal Field Datum DXF Repair Report

## Exact Root Cause

The consolidated DXF still differed from the known-good DXFs in an AutoCAD R12 / `AC1009` compatibility area:

- It used three layer names longer than the old 31-character DXF layer-name limit.
- The known-good DXFs use short layer names only.
- It also previously had mixed line endings after the first repair pass.

The overlength layer names were:

| Previous layer name | Length | Repaired layer name | Length |
|---|---:|---|---:|
| `LOGICAL_DIVISION_REFERENCE_NON_PROFILE` | 38 | `LOGICAL_DIV_REF_NON_PROFILE` | 27 |
| `EQUAL_FIELD_REFERENCE_ZONE_NON_PROFILE` | 38 | `EQUAL_FIELD_REF_NON_PROFILE` | 27 |
| `PHYSICAL_OWNERSHIP_BOUNDARY_REFERENCE_NON_PROFILE` | 49 | `PHYS_OWN_BOUND_REF_NON_PROFILE` | 30 |

The file was being treated by AutoCAD as non-passive/invalid on open even though the basic `SECTION` / `ENDSEC` / `EOF` framing was present. The remaining structural mismatch was the use of AC1009 with layer names that exceed the compatibility profile used by the working files.

No accidental command/script text, duplicate `EOF`, duplicate `ENDSEC`, BOM, unsupported entity type, handle/subclass conflict, or extra trailing content was found.

## Structural Differences vs Working DXFs

Compared against:

- `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
- `JOINED_ELEVATION_PLACEMENT_REVIEW_INTERNAL.dxf`

| Structure item | Known-good DXFs | Consolidated before hard fix | Consolidated after hard fix |
|---|---|---|---|
| Encoding BOM | none | none | none |
| Line endings | LF only | mixed after first repair | LF only |
| Section order | `HEADER`, `TABLES`, `ENTITIES` | same | same |
| Tables present | `LAYER` only | `LAYER` only | `LAYER` only |
| LTYPE table | absent | absent | absent |
| Layer linetype references | `CONTINUOUS` only | `CONTINUOUS` only after first repair | `CONTINUOUS` only |
| Max layer-name length | <= 22 | 49 | 30 |
| Entities | `LINE` only | `LINE` only | `LINE` only |
| Handles/subclasses/owners | absent | absent | absent |
| `SECTION` count | 3 | 3 | 3 |
| `ENDSEC` count | 3 | 3 | 3 |
| `EOF` count | 1 | 1 | 1 |
| Text before first `SECTION` | none | none | none |
| Content after `EOF` | none | none | none |

## What Was Repaired

Only the consolidated DXF export/write structure was repaired.

Fixed file:

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`

Repairs:

- Rewrote the file with LF-only line endings, matching the known-good files.
- Kept the same passive AC1009 structure:
  - `HEADER`
  - `TABLES`
  - `ENTITIES`
- Kept only a `LAYER` table.
- Kept only `LINE` entities.
- Shortened only the three non-profile reference layer names to R12-safe names.
- Kept all linetypes as `CONTINUOUS`.
- Preserved one final `EOF`.

No source DXF or accepted pilot file was touched.

## AutoCAD Compatibility Validation

Parser validation result after hard fix:

```json
{
  "sections": ["HEADER", "TABLES", "ENTITIES"],
  "tables": ["LAYER"],
  "tableCounts": { "LAYER": 4 },
  "bom": false,
  "crlf": 0,
  "eof": 1,
  "endsec": 3,
  "sectionCount": 3,
  "entities": ["LINE"],
  "lineCount": 114,
  "layerNameMax": 30,
  "profilePrefixIdenticalToPilot": true,
  "referenceLineCount": 8
}
```

The repaired file now matches the known-good DXFs from AutoCAD's passive DXF perspective:

- no script/command-style content,
- no unsupported entities,
- no unsupported tables,
- no undefined linetypes,
- no BOM,
- LF-only text structure,
- AC1009-compatible layer-name lengths.

`acad.exe`, `accoreconsole.exe`, and `ODAFileConverter.exe` were not available on PATH in this shell, so an actual AutoCAD process open could not be run here. Based on the structural comparison and repair, the file is now expected to open as a passive DXF drawing. Manual AutoCAD open is still the final external confirmation.

## Geometry Unchanged Confirmation

Geometry was preserved.

The repaired DXF contains:

- 114 total `LINE` entities,
- 106 accepted pilot profile `LINE` entities,
- 8 equal-field datum / reference `LINE` entities.

The first 106 `LINE` entities are identical to the accepted ownership-zone pilot DXF, including profile layer names and coordinates.

Accepted ownership-zone coordinates remain present:

- `3924.41739`
- `3981.41739`
- `4002.41739`

Equal-field datum coordinates remain present:

- `2903.91753`
- `3903.91753`

Coordinate hit validation:

| X coordinate | Endpoint hits after repair |
|---:|---:|
| `3924.41739` | 18 |
| `3981.41739` | 16 |
| `4002.41739` | 10 |
| `2903.91753` | 8 |
| `3903.91753` | 8 |

Only non-profile reference layer names changed for AC1009 compatibility.

## File Opens Normally Confirmation

Direct AutoCAD open could not be executed from this environment because no AutoCAD command-line executable was available on PATH.

What is confirmed:

- The repaired file now matches the known-good passive DXF section/table/entity pattern.
- It contains no command/script text.
- It contains no unsupported tables or entities.
- It uses AC1009-safe layer names.
- It has one valid `EOF` and no trailing junk.

Expected result: AutoCAD should now open the file normally as a drawing instead of treating it as invalid command/script-like input.

## Prohibited File Confirmation

No prohibited files were changed.

Confirmed:

- No accepted pilot DXF was overwritten.
- No accepted pilot SVG was overwritten.
- No source DXF was overwritten.
- No ownership-zone coordinates were changed.
- No logical division/reference coordinates were changed.
- No renderer/Admin/Estimate files were changed.
- No approval or lock status was changed.
- `npm run dev` was not run.
- `git add` was not run.

## Audit

- Files read:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `JOINED_ELEVATION_PLACEMENT_REVIEW_INTERNAL.dxf`
- Files changed:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `B92_EQUAL_FIELD_DATUM_DXF_REPAIR_REPORT.md`
- Validation run:
  - Lightweight Node DXF structural comparison against both known-good DXFs.
  - Profile-prefix comparison against the accepted B92-13 ownership-zone pilot DXF.
  - AutoCAD executable availability check for `acad.exe`, `accoreconsole.exe`, and `ODAFileConverter.exe`.
- Confirmation no prohibited files changed:
  - No accepted pilot files, source DXFs, SVGs, external proofs, renderer/Admin/Estimate files, approval/lock state, npm dev server, or git staging were changed.
