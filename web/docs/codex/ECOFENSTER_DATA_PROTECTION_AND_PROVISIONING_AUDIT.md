# Ecofenster data protection and clean provisioning audit

Date: 11 September 2026

## Outcome

The current Ecofenster workspace contains 29 Client rows. All 29 are now identified for protection by their actual canonical Client IDs, including inactive/test/demo rows; protection no longer depends on an EF-CL reference range. The migration inserts protection only when the exact Client already exists in that database, so it does not seed a clean workspace.

Clean database and isolated attachment-root initialization passed. Clean customer packaging and end-to-end tenant isolation did not pass and remain release blockers.

## Current safeguards

- Canonical-ID protection is persisted with workspace owner `ecofenster`.
- Client API and UI protection use persisted identity metadata, not name/reference heuristics.
- The protected set was enumerated from the live database read-only; no Ecofenster record was deleted, reset or rewritten for acceptance.
- The persistent acceptance database initialized with zero Clients, Projects, Enquiries, Estimates, Orders, communications, canonical documents, Drive discoveries, integration configuration, Portal contacts and Portal releases, and an empty isolated attachment root.
- Local live databases, ignored provider configuration and acceptance workspaces are excluded from Git.
- Provider binaries remain outside the canonical database; the acceptance runner overrides the managed-attachment root to its isolated workspace.

## Gaps found

- Core Clients, Projects, Enquiries, Estimates, Orders, communications and document/provider relationships are not comprehensively tenant-owned/scoped. Portal has tenant-aware grant foundations, but that does not secure normal staff APIs, search or downloads across tenants.
- `src/features/clients/defaultClients.ts` contains Ecofenster-specific customer/default data.
- `src/data/installers.ts` contains Ecofenster installation teams.
- customer quotation branding/rendering includes Ecofenster-specific defaults and tracked customer/product imagery in build inputs.
- application logo/theme sources include Ecofenster private/company assets. A future clean package needs a tenant-owned asset boundary and an approved neutral asset manifest; removing them from the current workspace without that migration would break existing output.
- some server fallback wording still names Ecofenster.
- no allowlisted release/package manifest currently proves that database copies, cached mail/search indexes, attachments, generated PDFs and tenant-private assets are absent.
- no disposable two-tenant adversarial harness currently proves denial through UI, API, search, downloads and Portal links.

## Separate acceptance gates

### Clean new installation/workspace

Pass only when a packaged/provisioned workspace contains approved application defaults and explicitly licensed shared catalogue/reference data, but no Ecofenster business rows, provider IDs, credentials/tokens, cached communications/search content, local attachments, generated output or private branding/assets.

Current status: **blocked for release**. Database/storage initialization passes; build/package inputs remain contaminated.

### Tenant isolation

Pass only when a disposable two-tenant test proves a second customer cannot enumerate, search, open or download Ecofenster records/files or use a Portal link/grant outside the exact tenant/Client/Project/resource boundary.

Current status: **blocked for release**. Core tenant ownership and authorization are incomplete, so the denial matrix cannot yet pass.

## Required next bounded work

1. Define canonical workspace/tenant ownership for every Core business and provider relationship.
2. Enforce tenant scope at repository, API, search/index, download and Portal boundaries.
3. Move company branding, document defaults and customer evidence to a tenant-owned provider/configuration store.
4. Establish an allowlisted build/package/provisioning manifest that distinguishes application defaults, licensed shared catalogue data and customer-owned data.
5. Run clean-package inventory and two-tenant denial acceptance in disposable environments.
