# B92-13 Internal Ownership Zone Validated Reference

## 1. User Visual Review Result

User visual review result:

- The pilot SVG and DXF look good.
- The remaining division issue is explicitly out of scope for this validation.
- The division issue will be handled separately later.

This validation preserves the semantic B92-13 internal ownership-zone pilot as accepted reference evidence. It does not approve or lock the full generated proof.

## 2. Pilot Files Preserved As Reference

Accepted pilot reference files:

- `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
- `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
- `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_REPORT.md`
- `generate_b92_13_internal_ownership_zone_pilot.cjs`

These files are preserved as the current validated reference for the B92-13 internal middle/right ownership-zone behaviour in this test workflow.

## 3. Exact Scope Of Validation

Validated scope:

- Internal view only.
- 3-field horizontal arrangement only.
- Field sequence: Tilt Turn Right / Fixed / Tilt Turn Left.
- Middle/right junction only.
- B92-13 internal ownership-zone behaviour only.
- Translation-only placement logic.

Not part of this validation:

- external view,
- other field counts,
- other B92 junctions,
- runtime renderer/Admin/Estimate integration,
- full proof approval or lock.

## 4. What Is Validated

Validated:

- The ownership-zone shift to:
  - `3924.417`
  - `3981.417`
  - `4002.417`
- The semantic rule approach:
  - B92-13 owns the local internal junction feature zone.
  - Adjacent affected terminations resolve to the B92-13-owned post-zone boundary.
  - The rule is expressed by context, profile role, and boundary family rather than as an arbitrary output-line patch.
- Translation-only placement remains the rule.
- No mirror, rotation, scaling, or bbox-fit behaviour is introduced.
- Layer `0` construction/evidence is excluded from rule input.

## 5. What Is Not Validated

Not validated:

- The division issue.
- Full generated proof approval.
- Full generated proof lock.
- External behaviour.
- Other B92 junctions.
- Other 3-field arrangements.
- Approved 1-field proof behaviour.
- Approved 2-field proof behaviour.
- Runtime renderer integration.
- Admin integration.
- Estimate integration.

## 6. Rule Candidate To Carry Forward

Rule candidate:

> B92-13 owns the approximately 21-22 mm internal junction feature zone at the middle/right TTR-Fixed-TTL boundary.

Operational interpretation:

- Context: internal horizontal 3-field Tilt Turn Right / Fixed / Tilt Turn Left.
- Junction: middle/right fixed-to-tilt-turn boundary.
- Owner: B92-13.
- Affected boundary families:
  - raw `3902.418` resolves to owned boundary `3924.417`,
  - raw `3959.418` resolves to owned boundary `3981.417`,
  - raw `3980.418` resolves to owned boundary `4002.417`.
- Adjacent affected profiles terminate/start after the B92-13-owned feature zone.

This rule should be carried forward as a semantic ownership-zone rule, not as individual coordinate edits.

## 7. Recommended Next Phase

Recommended next phase:

1. Isolate the division issue separately.
2. Create a report that identifies whether the division issue is:
   - field division logic,
   - sash/fixed field ownership,
   - profile group selection,
   - drawing annotation,
   - or another assembly termination issue.
3. Do not generalise the B92-13 ownership-zone rule until the division issue is documented and separated from this accepted ownership-zone behaviour.
4. After the division issue is understood, decide whether to:
   - keep this pilot as a local test-workflow rule,
   - promote it to a reusable B92-13 internal fixed/T&T ownership-zone rule,
   - or add handed equivalents only after matching evidence exists.

## 8. Safety / Preservation Confirmation

Confirmed:

- No regeneration was performed during this validation reference step.
- No generated proof was overwritten.
- No accepted pilot SVG/DXF/report/script was overwritten.
- No source DXF was touched.
- No renderer/Admin/Estimate runtime files were changed.
- No approval or lock status was changed.
- `npm run dev` was not run.
- `git add` was not run.

## Audit

- Files read:
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_PILOT_REPORT.md`
  - `generate_b92_13_internal_ownership_zone_pilot.cjs`
- File created:
  - `B92_13_INTERNAL_OWNERSHIP_ZONE_VALIDATED_REFERENCE.md`
- Confirmation no other files changed:
  - No generated proof, source DXF, runtime, approval/lock, npm, or git state was changed.
