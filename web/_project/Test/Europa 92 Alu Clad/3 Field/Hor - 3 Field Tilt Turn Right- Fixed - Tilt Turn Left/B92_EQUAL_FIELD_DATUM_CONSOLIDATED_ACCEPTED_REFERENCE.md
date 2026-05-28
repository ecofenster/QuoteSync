# B92 Equal Field Datum Consolidated Accepted Reference

## 1. User Acceptance Note

User acceptance:

- The consolidated SVG/DXF are acceptable.
- Remaining division issues are parked for later review.
- The parked division issues must not block this accepted reference.

This note preserves the consolidated equal-field datum pilot as an accepted reference only. It does not approve or lock the full proof workflow.

## 2. Accepted Files Preserved As Reference

Accepted consolidated reference files:

- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
- `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`
- `B92_EQUAL_FIELD_DATUM_DXF_REPAIR_REPORT.md`
- `B92_13_INTERNAL_OWNERSHIP_ZONE_VALIDATED_REFERENCE.md`

These files are preserved as the current accepted internal 3-field TTR / Fixed / TTL consolidated reference for:

- B92-13 middle/right ownership-zone behaviour,
- logical equal-field datum separation,
- repaired AC1009 DXF transport structure.

## 3. What Is Accepted

Accepted:

- Consolidated SVG/DXF visual output.
- B92-13 ownership-zone behaviour at the internal middle/right junction.
- Accepted physical ownership-zone x positions:
  - `3924.417`
  - `3981.417`
  - `4002.417`
- `logicalDivisionX` vs `physicalOwnershipBoundaryX` separation.
- Equal-field datum concept:
  - logical divisions preserve equal reference fields,
  - physical ownership boundaries may sit away from logical divisions,
  - cladding extents do not redefine equal field width.
- DXF transport repair result:
  - passive AC1009 structure,
  - LINE-only proof output,
  - short layer names,
  - known-good section/table/entity pattern.

## 4. What Is Parked

Parked for later review:

- Remaining division issues.
- Wider equal-field implementation.
- Exact visible sash/glass semantic extraction and numeric validation.
- External behaviour.
- Generalised behaviour across other B92 junctions.
- 1-field and 2-field proof impact.
- Runtime renderer/Admin/Estimate integration.

These parked items do not invalidate the accepted consolidated reference.

## 5. AC1009 DXF Lesson

Carry forward the DXF export lesson:

- Avoid layer names longer than 31 characters for AC1009/R12-style DXF outputs.
- Use the known-good passive DXF structure:
  - `HEADER`
  - `TABLES`
  - `ENTITIES`
  - single final `EOF`
- For LINE-only proof outputs, keep tables and layers simple:
  - `LAYER` table only unless another table is genuinely required,
  - `CONTINUOUS` linetypes unless linetypes are explicitly defined,
  - no handles/subclasses/owner handles unless the whole writer is upgraded consistently.
- Preserve LF-only text output to match the known-good proof files.

## 6. Carry-Forward Rules

Carry forward these semantic rules:

- The division/reference centreline runs through the timber frame profile depth/width.
- Red-line examples are annotation only:
  - do not extract them,
  - do not trace them,
  - do not count them as profile geometry.
- Cladding extent does not redefine equality.
- `logicalDivisionX` controls equal field/sash/glass reference zones.
- `physicalOwnershipBoundaryX` controls profile start/stop/termination/ownership.
- Physical ownership boundaries may differ from logical divisions.
- B92-13 owns the accepted internal middle/right feature zone in this 3-field TTR / Fixed / TTL reference.

## 7. Recommended Next Phase When Resumed

Recommended next phase:

1. Keep this consolidated accepted reference untouched.
2. Isolate the remaining division issue separately from ownership-zone validation.
3. Extract authoritative sash/glass-visible semantic boundaries before claiming full visible sash/glass numeric equality.
4. Only after that, decide whether to:
   - generalise the B92-13 ownership-zone rule,
   - implement wider equal-field datum handling,
   - or create additional handed/layout-specific pilots.

Do not use the parked division issue to undo the accepted B92-13 ownership-zone behaviour.

## 8. No Regeneration / Runtime / Source Change Confirmation

Confirmed for this accepted-reference step:

- No regeneration was performed.
- No proof output was overwritten.
- No source DXF or SVG was changed.
- No approval or lock status was changed beyond this accepted-reference note.
- No renderer/Admin/Estimate files were changed.
- `npm run dev` was not run.
- `git add` was not run.

## Audit

- Files read:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`
  - `B92_EQUAL_FIELD_DATUM_DXF_REPAIR_REPORT.md`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_VALIDATED_REFERENCE.md`
- File created:
  - `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_ACCEPTED_REFERENCE.md`
- Confirmation no other files changed:
  - No regeneration, proof overwrite, source DXF/SVG change, approval/lock change, renderer/Admin/Estimate change, npm dev server, or git staging was performed.
