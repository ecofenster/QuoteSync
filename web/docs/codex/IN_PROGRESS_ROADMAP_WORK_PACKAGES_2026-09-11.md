# In-progress Roadmap completion programme

Baseline: the 73 entries reconciled as `in_progress` on 11 September 2026. The executable mapping is `src/features/developmentRoadmap/roadmap.workPackages.ts`; every baseline ID appears exactly once.

Grouping does not change delivery status. An entry remains in progress until its own remaining implementation and technical verification are complete, and its user-acceptance statement is updated independently. A merged or superseded row is not counted as delivered functionality.

## Dependency order

1. **CRM workday and Enquiry intake (5)** — canonical dashboard projection, exact-record navigation, ownership/next-action continuity and Enquiry intake. No external dependency for the internal foundation. Ordinary-user acceptance remains required.
2. **Email, Files and supplier-document intake (23)** — builds on CRM context. Much of individual-message reading, provider filing and import handoff exists; remaining work is conflict classification, complete error/recovery paths and consolidated browser/user acceptance. Genuine provider acceptance requires configured Gmail/Drive but no live filing is authorised for EF-CL-028.
3. **Customer Estimate, quotation and release (23)** — reuses manufacturer evidence and the existing document renderer. Remaining work mixes implementation gaps, exact-output verification and user acceptance; production sending remains a controlled external dependency.
4. **Portal, canonical Order and procurement (7)** — depends on immutable released Estimate evidence. Controlled journey infrastructure exists; production identity, e-signature policy and delivery authority are external blockers and are not weakened.
5. **Quote comparison and reusable technical documents (4)** — depends on canonical intake plus customer-commercial truth. Existing analysis and document-library foundations are reused; exception review and customer-safe projection remain the joined acceptance gate.
6. **Installation operations (3)** — depends on an Estimate-owned costing snapshot. Existing workforce/materials work is reused; scheduling and unsupported catalogue evidence remain explicit dependencies.
7. **Configurator and drawing proof (3)** — can progress after customer-output contracts are stable. Existing B92 proof is reused; broader product families remain evidence-dependent.
8. **Platform boundary, clean provisioning and bounded cleanup (5)** — extracts stable shared boundaries after the first journeys. Clean database/storage support exists; tenant-neutral assets/package manifest remain implementation gaps. Cross-tenant Core ownership and production RBAC are genuine release blockers recorded outside this 73-entry cohort.

## Package gates

Each package is completed as one user journey and shared-service pass: remaining implementation → focused service/API tests → normal-route browser verification including failure/recovery → Roadmap evidence update → coherent checkpoint/push → short user-acceptance checklist. Prior evidence is reused unless the package changes its contract.

The first implementation pass starts with: **start the day → see real overdue/today work → search/open the exact Client, Enquiry, Project, Estimate, Order or follow-up → complete work and set the next action**. It replaces browser-local dashboard inference rather than adding another CRM store.
