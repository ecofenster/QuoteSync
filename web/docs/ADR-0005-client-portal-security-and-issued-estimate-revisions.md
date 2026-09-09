# ADR-0005: Client Portal security and issued Estimate revisions

Status: Accepted foundation; production external access remains disabled
Date: 2026-09-06

## Context

The internal Portal Preview already projects customer-safe canonical records, but QuoteSuite has no production staff authentication, external identity provider, tenant-aware persistence, or public security perimeter. Customer access cannot safely be enabled by reusing the hard-coded development staff user or by treating a Client email address as an identity.

## Decision

- A portal Contact belongs to a canonical Client and may hold explicit Project grants. External identity links are provider-neutral and separate from QuoteSuite staff users. Viewer grants remain read-only; reviewer/delegate grants may invoke reviewed customer commands.
- Invitations are scoped to tenant, Client, Contact and Project. A Project grant becomes active only after invitation acceptance. Raw high-entropy invitation and session secrets are returned only at creation/acceptance; only SHA-256 digests are persisted. Invitations expire, are single-use and revocable.
- Sessions are revocable, idle- and absolute-expiring, and represented by Secure, HttpOnly, SameSite cookies. State-changing requests also require a session-bound CSRF token and an idempotency key.
- Authentication never grants resources by itself. Every portal request rechecks tenant, Client, Contact, exact Project grant and an explicit released-resource record.
- Issuing a quotation captures an immutable Estimate release containing the exact Estimate/Position, customer projection, commercial, terms and document evidence. Database triggers prevent mutation of that Estimate revision and its costing state. Further work uses an explicitly linked new Estimate revision.
- Review, amendment, decline and intent-to-proceed evidence is immutable and audited. Intent to proceed does not create an Order or contact a supplier.
- Customer Reviewing, Revision Requested, Declined and Intent to Proceed are also projected as canonical workflow events so later Communications automation can consume governed evidence without owning state.
- Informal Position review responses are distinct from the future signed acceptance contract. That later boundary must record YES/NO for each Position against item/reference, configuration, dimensions and specification before canonical Order creation.
- The server constructs an allowlisted customer projection from released snapshots. Internal costing, supplier strategy, rates, margins, notes and diagnostics never enter the response.

## Production gate

The registered external route remains fail-closed. Enabling it requires a selected and reviewed OAuth 2.1/OIDC authorization-code-with-PKCE or equivalent passwordless identity provider, real tenant resolution, staff authentication/RBAC, deployment TLS/origin/rate-limit controls, invitation delivery policy, session operations, GDPR retention and e-signature/legal decisions. The deterministic adapter is test-only and is never registered by the production API start.

## Consequences

The data and command boundaries can now be tested without pretending the Client Portal is production-ready. Client Info may show safe access/activity summaries but never raw invitation or session material. Canonical Order, signed Position acceptance, external communications automation and public deployment remain later governed stages.
