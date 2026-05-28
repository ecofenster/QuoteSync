# B92 Equal Field Datum Consolidated Close-Out

## Scope

This close-out records the accepted B92 equal-field datum / ownership-zone reference work for:

- system: `B92`
- view: internal only
- layout: 3-field horizontal
- arrangement: Tilt Turn Right / Fixed / Tilt Turn Left
- junction focus: middle/right B92-13 ownership-zone

This is documentation/index/preservation close-out only. It is not a full proof approval/lock and not a runtime renderer/Admin/Estimate implementation.

## Accepted Reference

Primary accepted reference:

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_ACCEPTED_REFERENCE.md`

Accepted files preserved:

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_ACCEPTED_REFERENCE.md`
- `B92_EQUAL_FIELD_DATUM_DXF_REPAIR_REPORT.md`

Supporting accepted ownership-zone reference:

- `B92_13_INTERNAL_OWNERSHIP_ZONE_VALIDATED_REFERENCE.md`

Discoverability update:

- `../../generated-summary.md` was updated with an `Accepted 3-Field Reference Proofs / Not Locked` section.

No active-folder README/index existed to update.

## Accepted Status

Accepted:

- Consolidated SVG/DXF visual output is acceptable.
- B92-13 ownership-zone behaviour is accepted for this internal 3-field TTR / Fixed / TTL proof.
- `logicalDivisionX` vs `physicalOwnershipBoundaryX` separation is accepted.
- Equal-field datum concept is accepted.
- DXF transport repair result is accepted as the current AC1009-safe proof-output lesson.

Accepted physical ownership-zone coordinates:

- `3924.417`
- `3981.417`
- `4002.417`

Accepted logical division/reference concept:

- `logicalDivisionX` preserves equal field/sash/glass reference zones.
- `physicalOwnershipBoundaryX` may sit away from the logical division because profile ownership/termination is physical assembly behaviour.

## Parked Status

Parked:

- Remaining division issues.
- Exact visible sash/glass semantic extraction and numeric validation.
- Wider equal-field implementation.
- External behaviour.
- Generalised behaviour across other B92 junctions.
- Runtime renderer/Admin/Estimate integration.

These parked items do not block the accepted consolidated reference.

Do not treat this accepted reference as:

- full/generalised renderer implementation,
- external proof approval,
- approved/locked full proof,
- approval for 1-field or 2-field changes,
- approval for all B92-13 or B92-14 junctions.

## Carry-Forward DXF Lesson

For AC1009/R12 LINE-only proof DXFs:

- Keep layer names `<=31` characters.
- Use known-good passive DXF structure:
  - `HEADER`
  - `TABLES`
  - `ENTITIES`
  - single final `EOF`
- Keep tables/layers simple.
- Prefer `LAYER` table only for LINE-only proof outputs unless another table is genuinely required.
- Use `CONTINUOUS` linetype unless extra linetypes are explicitly defined.
- Avoid handles, subclass markers, and owner handles unless the writer is upgraded consistently.
- Preserve passive drawing-file output; do not emit command/script-like text.

## Carry-Forward Semantic Rules

Carry forward:

- The division/reference centreline runs through the timber frame profile depth/width.
- Red-line examples are annotation only:
  - do not extract,
  - do not trace,
  - do not count as profile geometry.
- Cladding extent does not redefine equality.
- Physical ownership boundaries may differ from logical divisions.
- B92-13 owns the accepted internal middle/right feature zone in this specific 3-field TTR / Fixed / TTL reference.

## Recommended Resume Point

When resumed:

1. Keep this consolidated accepted reference untouched.
2. Isolate remaining division issues separately.
3. Extract authoritative sash/glass-visible semantic boundaries before claiming numeric visible sash/glass equality.
4. Only then decide whether to generalise the B92-13 ownership-zone rule or widen equal-field datum handling.

## Close-Out Confirmation

Confirmed for this close-out pass:

- Documentation/index/close-out only.
- No regeneration.
- No proof/source overwrite.
- No geometry changes.
- No renderer/Admin/Estimate changes.
- No approval/lock beyond accepted-reference documentation.
- `npm run dev` was not run.
- `git add` was not run.

## Audit

- Files read:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_ACCEPTED_REFERENCE.md`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`
  - `B92_EQUAL_FIELD_DATUM_DXF_REPAIR_REPORT.md`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_VALIDATED_REFERENCE.md`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `../../generated-summary.md`
- Files changed:
  - `../../generated-summary.md`
- Files created:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_CLOSEOUT.md`
- Confirmation no other files changed:
  - No regeneration, proof/source overwrite, geometry change, renderer/Admin/Estimate change, approval/lock change, npm dev server, or git staging was performed.
