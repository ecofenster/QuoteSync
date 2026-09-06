# ADR-0004: Client comparison, technical documents and portal projection

Status: Accepted foundation; external portal access remains blocked pending security approval
Date: 2026-09-06

## Context

QuoteSuite needs to compare several supplier proposals against one issued or prepared QuoteSuite Estimate revision, reuse manufacturer/system evidence across Projects, and present a customer-safe lifecycle view. These capabilities must not create competing Position, document, Estimate, Order or Client stores.

## Decision

### Compare Quotes

`quote_comparisons` is a Client-owned, revisioned aggregate. Creation captures the selected Estimate ID, revision and Position snapshot. That snapshot is the comparison baseline even if a later editable Estimate changes.

Each `quote_comparison_proposals` row represents one supplier proposal package. A package may link multiple `canonical_documents` as commercial, technical or supporting evidence. `quote_comparison_position_mappings` maps supplier item references to canonical Estimate Position IDs and records grouped, split, missing, additional, alternative or unresolved relationships plus structured differences. Staff correction writes actor/time provenance and an audit event. Supplier item references never become canonical Position identity.

Original supplier total, comparable-scope amount and normalized-project amount remain separate. Approval fails closed while item review or commercial scope is unresolved. Recommendation automation and Window & Door technical rules remain future vertical work.

### Manufacturer / System Documents

`manufacturer_system_documents` adds reusable owner, Product/System, category, subcategory, format, version/date/expiry, jurisdiction/applicability, provenance and supersession metadata to an existing `canonical_documents` row. The provider remains binary authority. Supersession creates a new record and retains the old evidence.

`project_manufacturer_document_links` explicitly records Project relevance and whether staff approved customer visibility. Automatic relevance selection is not part of this foundation.

### Client Portal

The portal is a filtered projection of canonical Client, Project, Estimate, Order and Document records. It is not a second store. The internal Portal Preview proves Dashboard, Estimates, Orders, Rejected and Documents information architecture with an explicit document-type allowlist. Missing customer commercial totals remain unavailable rather than being derived from supplier cost.

No public portal route or active customer command is introduced by this foundation.

Before external access, QuoteSuite requires:

- a production identity provider using OAuth 2.1 / OpenID Connect authorization code with PKCE, or an equivalently reviewed passwordless system;
- single-use, short-lived, hashed invitations tied to tenant, Client and permitted Projects;
- server-side revocable sessions in Secure, HttpOnly, SameSite cookies with idle and absolute expiry;
- resource authorization on every Project, Estimate revision, Order and Document request, independent of UI visibility;
- tenant isolation, least privilege, rate limiting, replay protection, security event logging and access revocation;
- immutable issued-revision command boundaries and step-up verification for acceptance, order and signature actions;
- audit evidence for invitation, authentication, viewed revision, decision, signer, timestamp, consent and exact document hash;
- reviewed GDPR retention/export/erasure-exception rules and jurisdiction-specific e-signature advice.

Provider choice, multiple contacts per Client, delegation, MFA policy, invitation/session lifetimes, legal signature wording and support recovery remain product/security decisions. A client-supplied bearer link alone is not an approved authentication model.

## Ownership

QuoteSuite Core owns the comparison aggregate, proposal packages, canonical document relationships, lifecycle projection, authentication/authorization and audit contracts. The Window & Door vertical owns Position-specific geometry/configuration, product/system normalization, glazing and thermal values, hardware, security/compliance interpretation, sill/rebate rules and technical drawing applicability. Company configuration owns portal branding, comparison visibility, document categories, decline reasons and approval thresholds.

## Consequences

The bounded UI is useful internally without weakening the future security boundary. Supplier proposal extraction, customer-safe comparison publishing, customer commands, e-signature, payments and automatic technical-document relevance remain separate reviewed stages.
