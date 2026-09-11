# Development Roadmap reconciliation — 11 September 2026

## Corrected totals

| Status | Previous display | Reconciled | Meaning |
| --- | ---: | ---: | --- |
| Complete | 23 | 23 | Implemented and complete for the stated bounded scope |
| In progress | 24 | 73 | Some implementation exists; remaining work and acceptance are explicit |
| Not started | 201 | 142 | No material implementation evidence |
| Blocked | not represented | 3 | Cannot progress to release/acceptance until named dependencies exist |
| Superseded / legacy | not represented | 10 | Retained until governed replacement/removal |
| **Total** | **248** | **251** | Three net entries were added to represent previously invisible governance/release gates |

The underlying typed entries now drive all five displayed totals. A Roadmap item can also state implementation, technical verification and user acceptance separately.

## Status changes and evidence

- `manufacturer-rfq-lifecycle`, children `1`, `4`–`8`: Not started → In progress. Bounded recipient/routing, sent evidence, returned-message matching, revision deduplication and reviewed handoff exist; the full ordinary-user supplier journey is unaccepted.
- quotation children `1`–`8`, `10`, `12`–`18`: Not started → In progress. Numbering/revisions, VAT, PDF, issue/release, Email, follow-up and Portal foundations exist. Detailed technical mode (`9`) and true DOCX (`11`) remain Not started.
- `canonical-order`: Not started → In progress. Canonical Order and portal/procurement foundations exist; production journey remains incomplete.
- `procurement`, children `1`, `8`, `10`: Not started → In progress. Selected internal procurement commands, supplier confirmation and controlled delivery evidence exist; other children remain untouched.
- communications children `1`, `3`, `14`, `15`: Not started → In progress. Email provider, push-signal reconciliation, supplier intake and controlled delivery evidence exist; other channels remain Not started.
- document-storage children `1`, `3`–`7`, `11`, `12`: Not started → In progress. Google Drive, configured hierarchy, issued copies and version/conflict foundations exist; OneDrive and broader taxonomy remain untouched.
- `survey-delivery-installation`, `workforce-domain`, `platform-programme`: Not started → In progress because bounded implementation foundations exist; their generated capability children remain Not started unless separately evidenced.
- `guided-ux-staged-review`, children Email, Clients/Projects, Files and Estimates: Not started → In progress. Governance and bounded review/repairs exist, but ordinary-user acceptance is pending. Comparisons, Portal and Orders remain Not started.
- `payment-invoicing`: Not started → Blocked. Required accounting, VAT, cancellation/refund and reconciliation authorities are undefined.
- `saas`: Not started → Blocked. Core tenant ownership and clean package boundaries do not exist. `saas-clean-customer-provisioning` is In progress only because clean DB/storage initialization passes; `saas-tenant-isolation-acceptance` is Blocked.
- cleanup-freeze children `1`–`9`: Not started → Superseded / legacy. They are known legacy surfaces/dependencies awaiting governed replacement and removal, not untouched future features.

No Complete item was promoted by this reconciliation. Tests or code presence alone did not create a user-accepted status.

## Remaining work for active acceptance entries

- Email intake/filing: the user's later EF-CL-028 retry saved the exact selected DOCX, but evidence-backed existing-record and same-name/content conflict review still remains; restore the recycled working Estimate before opening the saved document in Manufacturer Import review.
- Files: user-confirm externally renamed Drive path and destination; preserve provider IDs and avoid duplicate folder trees.
- Estimates: user-confirm Delete/Archive presentation; keep issued evidence immutable.
- Clients/Projects and CRM: canonical Dashboard projection, exact deep links, owner/team/handover, unanswered/waiting/stalled queues, unified customer history and uninterrupted intake-to-follow-up flow.
- Manufacturer RFQ/quotation/order/procurement: controlled end-to-end journeys and remaining explicitly untouched children.
- Clean provisioning: tenant-owned branding/assets and allowlisted package manifest.

## Blockers and dependencies

- Tenant-aware ownership/authorization for every Core record and provider file.
- Neutral packaging/provisioning that excludes Ecofenster-owned assets, evidence, provider IDs, credentials and caches.
- Production authentication/RBAC and exact resource authorization.
- One canonical CRM activity/status projection before Dashboard acceptance.
- Evidence-backed existing-record/file conflict decisions before intake acceptance.
- Accounting authority before payment/invoicing implementation.

## Recommended next bounded tasks

1. Restore EF-EST-2026-057, open the already-saved EF-CL-028 DOCX in Manufacturer Import review, and stop before the explicit Project Costing import decision.
2. Replace the Dashboard's browser-local/synthetic CRM metrics with one read-only server projection and exact record links.
3. Add the smallest Needs attention queue: overdue, unanswered, waiting and stalled, each with owner, last contact, next action and due date.
4. Complete evidence-backed Client/Project matching and owner/follow-up continuation in Enquiry/Email intake.
5. Move Ecofenster-private document branding/assets behind a tenant-owned boundary and define a clean package manifest before any release expansion.

These are sequencing recommendations, not authorisation to implement all unfinished work.
