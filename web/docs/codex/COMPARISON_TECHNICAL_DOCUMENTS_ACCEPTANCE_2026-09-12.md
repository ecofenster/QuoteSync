# Comparison and technical-document acceptance

Implementation checkpoint: `5f3cb01`

## Technically verified

- Canonical active Manufacturer/Supplier and Product/System records drive new technical-document registration; stale and mismatched identities fail closed.
- The retained canonical file remains the single provider-backed binary.
- A user can review an active document against an exact Client/Project and current Estimate Position, or deliberately choose the whole Project.
- Customer Portal visibility requires an explicit review confirmation. Progress, exact result, recovery and next action are shown.
- Refresh restores the saved applicability and customer-visibility decision.
- An explicitly reviewed unresolved comparison mapping remains `unmapped` after persistence/hydration.
- Comparison/document tests pass 40/40, TypeScript and production build pass, and the normal-route disposable browser run cleaned its exact Chrome process/profile to 0/0.

## Short user checklist

1. In Administration → Manufacturer / System Documents, register one disposable retained technical file using a current Manufacturer and Product/System. Confirm the result names the file and canonical category.
2. Select **Review Project use**, choose a disposable Client/Project, select one exact Position and keep visibility **Internal only**. Save and refresh; confirm the same choice remains.
3. Change visibility to **Approved for this customer's Portal**. Confirm the save is blocked until the exact-document review checkbox is selected, then save and confirm the result names the Project and next action.
4. Open the existing Ty Clai comparison. Confirm unresolved supplier evidence is still shown as unresolved, review Positions A, G, N (A) and P, then download the searchable landscape PDF and compare the same wording/drawings.

Do not expose the Portal publicly or mark these Roadmap items accepted until this checklist passes. The older comparison commercial-breakdown recovery is separate remaining implementation.
