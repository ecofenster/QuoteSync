# Europa 92 Alu Clad Generated Summary

## Folders Found
- `1 Field`: empty
- `2 Field`: processed (10 DXFs)
- `3 Field`: processed (first locked horizontal fixed/fixed/fixed proof)
- `4 Field`: empty
- `5 Field`: empty
- `6 Field`: empty

## Processed Types
- `External_Fixed_TTL.dxf`: 2-field fixed + tilt-turn left, external, `2000 x 1000`, refs: B92-1, B92-10, B92-13, B92-5, B92-6, B92-7, B92-8
- `External_Fixed_TTR.dxf`: 2-field fixed + tilt-turn right, external, `2000 x 1000`, refs: B92-1, B92-10, B92-12, B92-2, B92-5, B92-7, B92-8
- `External_TTL_TTR.dxf`: 2-field tilt-turn left + tilt-turn right, external, `2000 x 1000`, refs: B92-10, B92-15, B92-7, B92-8
- `External_Turn_TT_Flying_Mullion.dxf`: 2-field turn + tilt-turn with flying mullion, external, `2000 x 1000`, refs: B92-10, B92-7, B92-8
- `External-Fixed-Fixed.dxf`: 2-field fixed + fixed, external, `2000 x 1000`, refs: B92-1, B92-11, B92-2, B92-3
- `Internal_Fixed_TTL.dxf`: 2-field fixed + tilt-turn left, internal, `2000 x 1000`, refs: B92-13, B92-4, B92-5, B92-6, B92-7, B92-8, B92-9
- `Internal_Fixed_TTR.dxf`: 2-field fixed + tilt-turn right, internal, `2000 x 1000`, refs: B92-10, B92-12, B92-2, B92-4, B92-5, B92-7, B92-8
- `Internal_TTL_TTR.dxf`: 2-field tilt-turn left + tilt-turn right, internal, `2000 x 1000`, refs: B92-10, B92-15, B92-7, B92-8
- `Internal_Turn_TT_Flying_Mullion.dxf`: 2-field turn + tilt-turn with flying mullion, internal, `2000 x 1000`, refs: B92-10, B92-18, B92-7, B92-8
- `Internal-Fixed-Fixed.dxf`: 2-field fixed + fixed, internal, `2000 x 1000`, refs: B92-1, B92-11, B92-2, B92-3

## Output SVG Paths
- `_project/Test/Europa 92 Alu Clad/2 Field/generated-internal.svg`
- `_project/Test/Europa 92 Alu Clad/2 Field/generated-external.svg`

## Common Profile/Section Refs Found
- `B92-1`
- `B92-10`
- `B92-11`
- `B92-12`
- `B92-13`
- `B92-15`
- `B92-18`
- `B92-2`
- `B92-3`
- `B92-4`
- `B92-5`
- `B92-6`
- `B92-7`
- `B92-8`
- `B92-9`

## Common Geometry/Rule Lessons
- The populated Europa 92 Alu Clad evidence is a two-field family with consistent `2000 x 1000` outer dimensions.
- The fixed/fixed, fixed/opening, paired tilt-turn, and flying-mullion examples all preserve a two-cell topology with nominal 1000 mm field split.
- Internal and external views use different visible offset/projection evidence; these should remain separate semantic rules.
- Profile refs are present as B92 callouts and differ by topology, side, and view.
- Corrected simple 2-field horizontal centre refs are: fixed/fixed `B92-11`, fixed/TTL `B92-13`, fixed/TTR `B92-12`, TTL/TTR static `B92-15`, and turn/TT flying mullion `B92-18` internally.
- The first locked vertical 2-field fixed/fixed proof confirms the horizontal divider/transom as `B92-19`; `B92-11` is rejected for that vertical divider case.
- `B92-14` is not globally wrong; it should be treated as a distinct compound/grid fixed/fixed context rather than the simple 2-field fixed/fixed centre ref.
- The first locked horizontal 3-field fixed/fixed/fixed proof confirms both internal vertical fixed/fixed divisions use `B92-11`, repeated by symmetrical translation only. No alternate field-index-specific mullion behaviour was found.
- Equal-field datum and physical ownership are separate concepts. `logicalDivisionX` preserves equal field/sash/glass reference zones, while `physicalOwnershipBoundaryX` controls profile start/stop/termination. Cladding extents do not redefine equal field width.
- B92-13/B92-14 red-line examples are annotation/reference only. Do not extract, trace, or count the red line as profile geometry.
- AC1009/R12 LINE-only proof DXFs should use known-good passive structure, simple tables/layers, and layer names no longer than 31 characters.

## B92 1-Field Profile Family Rules
- The accepted 1 Field Tilt & Turn profile proof is also the base proof family for `1 Field Fixed Sash`, `1 Field Tilt & Turn`, `1 Field Turn Left`, `1 Field Turn Right`, and `1 Field Tilt`.
- These use the same general sash/openable profile family. The main variation is operation/handing: handle-side and hinge-side assignment changes by operation and view.
- Do not duplicate geometry unnecessarily where `profileRef`, `sourceGeometry`, `placementRole`, `transform/handing`, and `validation/source` metadata can express the variation.
- 1 Field Fixed current base/default profiles: top/head `B92-1`, sides `B92-2` reusable/mirrored, bottom/sill `B92-3`.
- 1 Field Tilt & Turn / sash/openable current base/default profiles: top/head `B92-7`, bottom/sill `B92-8`, sides `B92-9` and `B92-10` by role/handing/view.

## B92 System-Wide Top/Bottom Profile Option Sets
- B92 top and bottom profile options are system-wide selectable profile options across applicable window types/layouts, not only 1-field.
- Fixed/no-sash top option set: standard `B92-1`; trickle vent option `B92-7/78V`.
- Sash/openable top option set: standard `B92-7`; trickle vent option `B92-7/100V`.
- Fixed/no-sash bottom option set: standard `B92-3`; alternatives `B92-3A`, `B92-3B`, `B92-3C`, `B92-3D`, `B92-3F`, `B92-3G`, `B92-26`.
- Sash/openable bottom option set: standard `B92-8`; alternatives `B92-8A`, `B92-8B`, `B92-8C`, `B92-8D`, `B92-8E`, `B92-8F`, `B92-25`.
- Bottom variants represent with/without rebate internally, with/without rebate externally, and slightly different aluminium cladding profiles externally.
- Visual rule: internally, timber rebates are visible and should be represented in internal section/elevation proofing where the selected profile has them.
- Visual rule: externally, rebates are hidden by aluminium cladding and are not visible externally; external visible differences are driven by the aluminium cladding/profile condition, not exposed timber rebate linework.
- These options should be modelled as profile option sets selected by field/opening condition and view, not as separate independent window-type geometry methods.
- Preserve metadata distinctions for `profileRef`, `sourceGeometry`, `placementRole`, `transform/handing`, `view`, `optionSet`, and `validation/source`.
- Future option refs are planning metadata only until their authority elevations/profile DXFs are drawn, proofed, and accepted.

## Approved / Locked 1-Field Proofs
- `1 Field Fixed` internal proof: approved/locked as-is based on current DXF/SVG proof.
- `1 Field Fixed` external proof: approved/locked as-is based on current DXF/SVG proof.
- `1 Field Tilt & Turn` internal proof: approved/locked as-is based on current DXF/SVG proof.
- `1 Field Tilt & Turn` external proof: approved/locked as-is based on current DXF/SVG proof.
- These 1-field approvals are the base references for future profile reuse.
- The 1 Field Tilt & Turn proof family also informs Fixed Sash, Turn Left, Turn Right, and Tilt, subject to operation/handing changes.
- For two-field work, approved 1-field outer frame/sash profiles may be reused where applicable.
- Two-field layouts introduce mullion/meeting profiles, so centre/profile shapes must not be assumed from 1-field proofs.
- Mullion profiles require their own authority DXF/SVG proofing and validation.
- Do not treat 1-field approval as approval for mullion geometry.

## Approved / Locked 2-Field Proofs
- `2 Field / Hor - 2 Field Fixed` internal proof: approved/locked as-is based on current DXF/SVG proof.
- `2 Field / Hor - 2 Field Fixed` external proof: approved/locked as-is after corrected external source/elevation/exploded files were rerun.
- Validation counts: internal DXF `LINE=53`, `TEXT=0`, `MTEXT=0`, `CIRCLE=0`; external DXF `LINE=48`, `TEXT=0`, `MTEXT=0`, `CIRCLE=0`.
- Correction history: initial external proof looked visually close, but centre mullion position was wrong due to a user/source DXF issue. The user corrected external `B92-1`, `B92-3`, and `B92-11` source DXFs, then corrected the external authority elevation and exploded elevation. The external proof was regenerated from the corrected source chain and visually approved.
- Method confirmation: approved 1-field profiles may be reused for matching outer frame roles, but new mullion/meeting profiles must be separately proved from authority files.
- `B92-2` reuse was role-limited to outer side jambs only; `B92-2` was not used for centre/mullion geometry.
- `B92-11` internal/external was newly proved in this two-field fixed/fixed proof; 1-field approval did not cover `B92-11`.
- The `.bak` exploded file was not used.
- Internal `B92-2` length-axis scaling to match the 2-field authority jamb span is accepted as transform metadata for this proof.
- `2 Field / Hor - 2 Field Turn - Tilt and Turn` internal proof: approved/locked as-is after corrected source/authority regeneration.
- `2 Field / Hor - 2 Field Turn - Tilt and Turn` external proof: approved/locked as-is after corrected source/authority regeneration.
- Validation counts: internal DXF `LINE=96`, `TEXT=0`, `MTEXT=0`, `CIRCLE=0`; external DXF `LINE=110`, `TEXT=0`, `MTEXT=0`, `CIRCLE=0`.
- SVG validation: internal and external SVGs parse as valid XML; SVG XML escaping is preserved as `Turn / Tilt &amp; Turn`.
- Correction history: initial generated SVGs had a raw ampersand XML escaping issue in `aria-label` and `title` values, which was corrected without changing DXF geometry. Internal top bead gaps were then found at the left/top Turn field and right/top Tilt & Turn field.
- B92-10 correction history: investigation showed a B92-10 bead datum/source-authority mismatch of 5.5mm. B92-10 was corrected, B92-9 was checked and confirmed correct, and the proofs were regenerated from corrected source/authority geometry rather than hand-patched.
- Final regenerated internal bead closures match authority: left/top Turn bead closure relative from top `72.500mm`; right/top Tilt & Turn bead closure relative from top `72.500mm`.
- Method confirmation: `B92-18` internal/external is newly proved as the flying/meeting mullion for this proof. `B92-18` is not `B92-11` static mullion geometry.
- `B92-11` was not used. `B92-9` was not used. `B92-10` was reused for both outer hinge-side roles because both outer sides are hinge sides.
- Approved 1 Field Tilt & Turn `B92-10` side geometry was reused only for matching outer hinge-side roles.
- No `.bak` files were used. No 1 Field proof files, 2 Field Fixed/Fixed proof files, source DXFs, or app/runtime/Admin/Estimate files were changed during this documentation finalisation.
- Method lesson: when reused profile geometry appears visually wrong, verify source/authority datum consistency before patching generated proof geometry. Correct source/authority files first, then regenerate proofs. For flying mullion cases, do not apply fixed/fixed `B92-11` centre logic.
- `2 Field / Hor - 2 Field Tilt and Turn Left - Tilt and Turn Right` internal proof: approved/locked as-is after authority-line reconciliation and DXF structural validation.
- `2 Field / Hor - 2 Field Tilt and Turn Left - Tilt and Turn Right` external proof: approved/locked as-is after authority-line reconciliation and DXF structural validation.
- Approval is based on corrected SVG visual review plus DXF structural validation. DXF CAD-viewer visual confirmation was not independently completed because local double-click/open behaviour prompts "press enter to continue" and closes, but structural validation confirms visible LINE geometry with R12-style `HEADER`, `TABLES`, `ENTITIES`, and `LAYER` records.
- Validation counts: internal DXF `LINE=69`, `TEXT=0`, `MTEXT=0`, `MULTILEADER=0`, `CIRCLE=0`; external DXF `LINE=92`, `TEXT=0`, `MTEXT=0`, `MULTILEADER=0`, `CIRCLE=0`.
- Bounds: internal DXF `X 1068.270..3068.270`, `Y 1425.159..2425.159`; external DXF `X 967.097..2967.097`, `Y 1479.882..2479.882`.
- SVG validation: internal SVG valid XML with 69 SVG lines; external SVG valid XML with 92 SVG lines. SVG line counts match DXF LINE counts.
- MULTILEADER/user markup was removed. Missing authority closure/junction lines were restored from authority elevations.
- `B92-10` split-target placement remains correct and not full-width.
- `B92-15` remains the newly proved static centre/meeting mullion for this proof.
- `B92-9`, `B92-11`, and `B92-18` were not used in this proof. No `.bak` files were used.
- Source DXFs, 1 Field proof files, 2 Field Fixed/Fixed proof files, 2 Field Turn / Tilt & Turn proof files, and app/runtime/Admin/Estimate files were unchanged during finalisation.
- Method lesson: authority elevation LINEs are presumed required proof geometry unless the user explicitly confirms they are source errors. Reconciliation must not suppress authority closure/junction lines merely because they look duplicate, profile-ambiguous, or authority-only. Reusable profile source geometry does not override the authority elevation.
- `2 Field / Hor - 2 Field Fixed - Tilt and Turn Left` internal proof: approved/locked as the first mixed-field true profile-driven B92 assembly proof.
- `2 Field / Hor - 2 Field Fixed - Tilt and Turn Left` external proof: approved/locked as the first mixed-field true profile-driven B92 assembly proof.
- This proof is not an authority-elevation export. Individual profile DXFs were parsed and transformed, then authority reconciliation was applied only after profile-driven assembly.
- Source profiles used: `B92-4` fixed field head, `B92-5` fixed field sill, `B92-6` fixed outer side, `B92-7` Tilt & Turn head joined to `B92-4`, `B92-8` Tilt & Turn sill joined to `B92-5`, `B92-10` Tilt & Turn outer side, and `B92-12` fixed/T&T centre profile.
- Joined-end logic proved: `B92-4` joins `B92-7` at the head, `B92-5` joins `B92-8` at the sill, and `B92-12` handles the fixed/T&T centre junction.
- Authority-reconciled lines: internal `8`, external `12`. Required vertical connector/closure lines were preserved.
- Final DXF validation counts: internal `LINE=55`, `TEXT=0`, `MTEXT=0`, `MULTILEADER=0`, `CIRCLE=0`; external `LINE=54`, `TEXT=0`, `MTEXT=0`, `MULTILEADER=0`, `CIRCLE=0`.
- Final DXF bounds: internal and external `X 30..2030`, `Y 30..1030`. R12-style DXF container remains valid.
- Final CAD orientation note: initial 180-degree rotation correction was insufficient; final accepted DXFs were horizontally mirrored about `X = 1030` using `x' = 2060 - x`, `y' = y`.
- User visually approved final internal and external DXFs as perfect.
- `2 Field / Hor - 2 Field Fixed - Tilt and Turn Right` internal proof: approved/locked as the opposite mixed-field case to `Hor - 2 Field Fixed - Tilt and Turn Left`.
- `2 Field / Hor - 2 Field Fixed - Tilt and Turn Right` external proof: approved/locked as the opposite mixed-field case to `Hor - 2 Field Fixed - Tilt and Turn Left`.
- Manual CAD/SVG review passed for the generated Fixed / Tilt & Turn Right DXF and SVG proof files.
- This proof is not an authority-elevation export. Individual profile DXFs were parsed and transformed, then authority reconciliation was applied only after profile-driven assembly.
- Source profiles used internally: `B92-4` fixed field head, `B92-5` fixed field sill, `B92-6` fixed outer side, `B92-7` Tilt & Turn head joined to `B92-4`, `B92-8` Tilt & Turn sill joined to `B92-5`, `B92-9` Tilt & Turn outer side, and `B92-13` fixed/T&T centre profile.
- Source profiles used externally: `B92-4` fixed field head, `B92-5` fixed field sill, `B92-6` fixed outer side, `B92-7` Tilt & Turn head joined to `B92-4`, `B92-8` Tilt & Turn sill joined to `B92-5`, `B92-10` Tilt & Turn outer side, and `B92-13` fixed/T&T centre profile.
- `B92-13` is confirmed for this Fixed / Tilt & Turn Right handed mixed adjacency case. `B92-12` remains the accepted centre profile for the locked Fixed / Tilt & Turn Left case and was not reused here.
- Authority-reconciled lines: internal `5`, external `10`. Required authority/opening/connector lines were preserved on top.
- Final DXF validation counts: internal `LINE=67`, `TEXT=0`, `MTEXT=0`, `MULTILEADER=0`, `CIRCLE=0`; external `LINE=68`, `TEXT=0`, `MTEXT=0`, `MULTILEADER=0`, `CIRCLE=0`.
- Final DXF bounds: internal and external `X 30..2030`, `Y 30..1030`. AC1009/R12-style DXF container remains valid with `SECTION`, `ENDSEC`, and `EOF`.
- SVG validation: internal SVG line count `67`; external SVG line count `68`. SVG line counts match DXF LINE counts.
- The Fixed / Tilt & Turn Left and Fixed / Tilt & Turn Right proofs now form an approved opposite mixed-adjacency pair.
- `2 Field / Ver - 2 Field Fixed Bottom - Fixed Top` internal proof: approved/locked as the first vertical 2-field fixed/fixed profile-driven B92 assembly proof.
- `2 Field / Ver - 2 Field Fixed Bottom - Fixed Top` external proof: approved/locked as the first vertical 2-field fixed/fixed profile-driven B92 assembly proof.
- Manual CAD/SVG review passed for the generated vertical fixed/fixed DXF and SVG proof files.
- This proof is not an authority-elevation export. Individual profile DXFs were parsed and transformed using placement logic derived from target authority/exploded evidence.
- Source profiles used internally: `B92-1` top/head, corrected `B92-2 Left`, corrected `B92-2 Right`, `B92-3` bottom/sill, and `B92-19` horizontal divider/transom.
- Source profiles used externally: `B92-1` top/head, `B92-2 Left`, `B92-2 Right`, `B92-3` bottom/sill, and `B92-19` horizontal divider/transom.
- `B92-19` is confirmed as the divider/transom profile for this vertical Fixed Bottom / Fixed Top case. `B92-11` was rejected for this vertical divider case.
- Final DXF validation counts: internal `LINE=38`, external `LINE=32`.
- Final DXF bounds: internal `X 30..1030`, `Y 24..2030`; external `X 30..1030`, `Y 30.05..2030`. AC1009/R12-style DXF containers remain valid with `SECTION`, `ENDSEC`, and `EOF`.
- SVG validation: internal SVG line count `38`; external SVG line count `32`. SVG line counts match DXF LINE counts.
- `2 Field / Ver - 2 Field Tilt and Turn Bottom - Fixed Top` internal proof: approved/locked as the first vertical mixed Tilt & Turn / fixed transom profile-driven B92 assembly proof.
- `2 Field / Ver - 2 Field Tilt and Turn Bottom - Fixed Top` external proof: approved/locked as the first vertical mixed Tilt & Turn / fixed transom profile-driven B92 assembly proof.
- Manual CAD/SVG review passed for the generated vertical mixed DXF and SVG proof files.
- This proof is not an authority-elevation export. Individual profile DXFs were parsed and transformed using placement logic derived from target authority/exploded evidence.
- Source profiles used internally: `B92-4` fixed top/head, `B92-6` fixed top left/right sides, `B92-21` horizontal mixed fixed/T&T divider/transom, `B92-8` Tilt & Turn bottom sill, `B92-9` Tilt & Turn bottom left side, and `B92-10` Tilt & Turn bottom right side.
- Source profiles used externally: `B92-4` fixed top/head, `B92-6` fixed top left/right sides, `B92-21` horizontal mixed fixed/T&T divider/transom, `B92-8` Tilt & Turn bottom sill, `B92-9` Tilt & Turn bottom left side, and `B92-10` Tilt & Turn bottom right side.
- `B92-21` is confirmed as the divider/transom profile for this vertical Tilt & Turn Bottom / Fixed Top case. `B92-19` remains specific to the locked vertical Fixed Bottom / Fixed Top case and was not reused here.
- Final DXF validation counts: internal `LINE=68`, external `LINE=65`.
- Final DXF bounds: internal `X 30..1030`, `Y 30..2030`; external `X 30..1030.001`, `Y 30.001..2030`. AC1009/R12-style DXF containers remain valid with `SECTION`, `ENDSEC`, and `EOF`.
- SVG validation: internal SVG line count `68`; external SVG line count `65`. SVG line counts match DXF LINE counts.
- `2 Field / Ver - 2 Field Fixed Bottom - Tilt and Turn Top` internal proof: approved/locked as the opposite vertical mixed fixed/Tilt & Turn transom profile-driven B92 assembly proof.
- `2 Field / Ver - 2 Field Fixed Bottom - Tilt and Turn Top` external proof: approved/locked as the opposite vertical mixed fixed/Tilt & Turn transom profile-driven B92 assembly proof.
- Manual CAD/SVG review passed for the generated opposite vertical mixed DXF and SVG proof files.
- This proof is not an authority-elevation export. Individual profile DXFs were parsed and transformed using placement logic derived from target authority/exploded evidence.
- Source profiles used internally: `B92-5` fixed bottom/sill, `B92-6` fixed bottom left side, `B92-6` fixed bottom right side, `B92-20` horizontal mixed fixed/T&T divider/transom, `B92-7` Tilt & Turn top/head, `B92-9` Tilt & Turn top left side, and `B92-10` Tilt & Turn top right side.
- Source profiles used externally: `B92-5` fixed bottom/sill, `B92-6` fixed bottom left side, `B92-6` fixed bottom right side, `B92-20` horizontal mixed fixed/T&T divider/transom, `B92-7` Tilt & Turn top/head, `B92-9` Tilt & Turn top left side, and `B92-10` Tilt & Turn top right side.
- External `B92-6` left/right source files matched target authority directly; no missing-source or same-side mirrored-placement caveat remains for this locked proof.
- `B92-20` is confirmed as the divider/transom profile for this vertical Fixed Bottom / Tilt & Turn Top case. `B92-21` remains specific to the locked opposite mixed case, Tilt & Turn Bottom / Fixed Top, and was not reused here. `B92-19` remains specific to the locked vertical fixed/fixed case.
- Final DXF validation counts: internal `LINE=69`, external `LINE=68`.
- Final DXF bounds: internal `X 30..1030.001`, `Y 30..2030`; external `X 30..1030.001`, `Y 30..2030`. AC1009/R12-style DXF containers remain valid with `SECTION`, `ENDSEC`, and `EOF`.
- SVG validation: internal SVG line count `69`; external SVG line count `68`. SVG line counts match DXF LINE counts.

## Approved / Locked 3-Field Proofs
- `3 Field / Hor - 3 Field Fixed` internal proof: APPROVED / LOCKED as the first horizontal 3-field fixed/fixed/fixed B92 proof.
- `3 Field / Hor - 3 Field Fixed` external proof: APPROVED / LOCKED as the first horizontal 3-field fixed/fixed/fixed B92 proof.
- Manual CAD/SVG review passed for the generated internal and external SVG/DXF proof files.
- Approved internal refs: `B92-1` head, `B92-3` sill, `B92-2` left jamb, `B92-2` right jamb, and `B92-11` mullion x2.
- Approved external refs: `B92-1` head, `B92-3` sill, `B92-2` left jamb, `B92-2` right jamb, and `B92-11` mullion x2.
- Both internal divisions are vertical fixed/fixed mullions using `B92-11`.
- `B92-11` double-mullion reuse is confirmed as symmetrical translation only; no alternate field-index-specific mullion behaviour was found.
- `B92-19` is not applicable to this horizontal 3-field case.
- Head and sill remain continuous across the full 3000 mm width, and the outer perimeter remains closed/returned.
- Final DXF validation counts: internal `LINE=60`, external `LINE=44`.
- Final DXF bounds: internal and external normalized proof bounds `3000 x 1000`. AC1009/R12-style DXF containers remain valid with `SECTION`, `ENDSEC`, and `EOF`.
- SVG/DXF parity confirmed: internal SVG line count `60`, external SVG line count `44`; SVG line counts match DXF LINE counts.
- `3 Field / Hor - 3 Field Tilt & Turn Left - Fixed - Tilt & Turn Right` internal proof: APPROVED / LOCKED as the first horizontal 3-field mixed TTL / Fixed / TTR B92 proof.
- `3 Field / Hor - 3 Field Tilt & Turn Left - Fixed - Tilt & Turn Right` external proof: APPROVED / LOCKED as the first horizontal 3-field mixed TTL / Fixed / TTR B92 proof.
- Manual CAD/SVG review passed for the generated internal and external SVG/DXF proof files.
- Approved output files: `HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`, `HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`, `HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg`, and `HOR_3_FIELD_TILT_TURN_LEFT_FIXED_TILT_TURN_RIGHT_EXTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`.
- Approved internal refs: `B92-7` top left/right T&T heads, `B92-8` bottom left/right T&T sills, `B92-4` fixed middle head, `B92-5` fixed middle sill, `B92-10` left/right outer T&T sides, and `B92-12` left/right static fixed/T&T mullions.
- Approved external refs: `B92-7` top left/right T&T heads, `B92-8` bottom left/right T&T sills, `B92-4` fixed middle head, `B92-5` fixed middle sill, `B92-10` left/right outer T&T sides, and `B92-12` left/right static fixed/T&T mullions.
- `B92-12` left/right is confirmed as the static fixed/T&T mullion pair for this 3-field TTL / Fixed / TTR case.
- `B92-11`, `B92-18`, and vertical transoms `B92-19`, `B92-20`, and `B92-21` are not applicable to this horizontal 3-field TTL / Fixed / TTR case.
- Final placement uses the joined assembled elevation DXFs: `Hor_3_Field_TT_Fixed_TT_Internal_Elevation.dxf` and `Hor_3_Field_TT_Fixed_TT_External_Elevation.dxf`.
- Critical placement rule: source/exploded profiles verify geometry and orientation, but joined assembled elevations provide final proof placement. Never use the exploded layout as final placement for this proof.
- Transform rule: translation only. No mirror, no rotation, no scale, no bbox-fit, and no inferred top/bottom flip from SVG display orientation.
- SVG note: approved SVGs include a faint gray assembled-authority underlay for visual comparison.
- DXF note: approved DXFs contain only regenerated proof `LINE` entities.
- Final validation counts: internal DXF `LINE=120`, internal SVG proof lines `120`; external DXF `LINE=106`, external SVG proof lines `106`.
- Final bounds: internal `574.062,1198.160 -> 3574.062,2198.160`, external `581.323,1599.396 -> 3581.323,2599.396`; both are `3000 x 1000` and match authority bounds.
- DXF structure confirmed for both: `AC1009`, `SECTION`, `ENDSEC`, and `EOF`. SVG XML parse passed.
- Clean locked proof count now: 24 approved internal/external proof views, across 12 approved internal/external proof pairs.

## Accepted 3-Field Reference Proofs / Not Locked
- `3 Field / Hor - 3 Field Tilt Turn Right - Fixed - Tilt Turn Left` internal consolidated equal-field datum pilot is ACCEPTED AS REFERENCE ONLY, not approved/locked as a full/generalised renderer proof.
- Accepted reference file: `3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_ACCEPTED_REFERENCE.md`.
- Accepted visual files: `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.svg` and `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_INTERNAL_PROFILE_SECTION_ASSEMBLY_PROOF.dxf`.
- Supporting accepted reports: `B92_EQUAL_FIELD_DATUM_DXF_REPAIR_REPORT.md` and `B92_EQUAL_FIELD_DATUM_CONSOLIDATED_PILOT_REPORT.md`.
- Accepted status: consolidated SVG/DXF acceptable; B92-13 ownership-zone behaviour accepted for this internal 3-field TTR / Fixed / TTL proof; `logicalDivisionX` vs `physicalOwnershipBoundaryX` separation accepted; equal-field datum concept accepted.
- Accepted B92-13 internal ownership-zone physical boundary coordinates remain `3924.417`, `3981.417`, and `4002.417`.
- Logical equal-field datum remains separate from those physical boundaries; remaining division issues are parked for later review and must not be used to undo the accepted ownership-zone reference.
- This accepted reference does not implement or approve external/generalised behaviour, runtime renderer/Admin/Estimate integration, or wider equal-field handling.
- DXF lesson from the accepted consolidated reference: AC1009/R12 layer names must stay `<=31` characters; use known-good passive DXF structure; LINE-only proof DXFs should keep simple `LAYER` tables and `CONTINUOUS` linetypes unless extra tables are explicitly defined.

## Gaps Preventing Production-Rule Implementation
- No native dimension entities were present; overall size was derived from line geometry.
- Profile section shapes and exact cladding/mitre ownership are not fully described by these elevations alone.
- Centre-junction/flying-mullion ownership needs section DXFs or explicitly dimensioned rules.
- External flying mullion `B92-18` is now covered by the approved `2 Field / Hor - 2 Field Turn - Tilt and Turn` proof; future flying-mullion variants still require their own authority/source validation.
- More archetypes are needed for transoms, unequal fields, larger grids, and internal/external masking parity.
