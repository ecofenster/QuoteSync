# Portal, Order and procurement acceptance

Implementation checkpoint: `3b3fd4d`

## Technically verified

- A released Estimate remains immutable while the customer records Position-level changes. Staff receives the exact reviewed request and creates a linked editable successor revision.
- Supplier-change correspondence and the factory Order remain preview-only unless the controlled test-delivery allowlist is explicitly enabled. The verification run sent no Email.
- Issuing the successor revision preserves the earlier release as superseded history. The current issued PDF downloaded through the Portal matches the immutable archive and prepared Email attachment bytes.
- Exact Position acceptance creates one canonical Order awaiting staff approval and plainly confirms that no factory Order was sent.
- Staff approval creates the immutable Order document. Factory confirmation is checked against every accepted Position; unresolved or unexplained changes block release.
- Final customer confirmation is tied to the exact reviewed confirmation revision. A returned signed PDF remains only a file until staff explicitly reviews and records it.
- Customer and staff actions show action-specific progress, prevent repeat submission while busy, describe the completed consequence and state the next useful action.
- Focused Portal security/lifecycle tests passed 18/18. The complete normal-route disposable browser journey passed on desktop and mobile, generated searchable Estimate/Order/final-confirmation PDFs, and finished with zero owned browser processes and zero owned profiles.

## Short user checklist (not yet accepted)

1. In the persistent isolated acceptance workspace, open an issued test Estimate through the customer Portal and submit one Position change. Confirm the result says the project team will review it.
2. In staff Client Portal, open **Changes Requested**, create the working revision and prepare the supplier-change preview. Confirm the issued Estimate remains unchanged and nothing is sent.
3. Link disposable returned supplier evidence, complete each requested-change check and issue the successor test Estimate.
4. Reopen the customer Portal, accept every Position and the overall Estimate. Confirm the named Order is waiting for staff approval and no factory Order was sent.
5. In staff Client Portal, approve the Order and prepare the factory Order preview. Confirm the exact Order PDF opens and delivery remains preview-only.
6. Link a disposable factory-confirmation file. Verify a missing or unexplained change blocks release; complete the checks, release final confirmation and approve it in the customer Portal.
7. Link a disposable signed PDF and record the reviewed approval. Confirm the final Order state and retained document links are understandable.

This is technical verification in disposable data, not user acceptance or approval for public Portal access. Production identity, tenant/staff RBAC, e-signature/legal policy and controlled real-provider delivery remain external gates. Payment, manufacturing, dispatch, delivery, installation and warranty stages remain incomplete.
