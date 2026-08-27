# ADR-0003: Integration Provider and Capability Architecture

- Status: Foundation accepted in source; live provider credentials remain environment/company dependent
- Scope: Administration → Integrations and external-service consumption

## Decision

Administration → Integrations is the sole administrative owner for external-service connections. Application features depend on named capabilities; they do not read or manage provider credentials.

The current provider registry supplies category and capability metadata alongside secret-safe status. Google Maps provides geocoding, routing, distance and travel-time business capabilities. what3words provides words-to-coordinates and coordinates-to-words capabilities. Google Maps backend operations resolve only the tenant/company credential managed through Administration → Integrations; browser-oriented environment credentials are never a backend fallback. Other providers may retain an explicitly approved deployment fallback where their architecture requires it.

Future provider families should extend this registry rather than introduce feature-owned integrations:

- Microsoft 365: OneDrive, SharePoint, mail and calendar capabilities through one OAuth/application connection.
- Google Workspace: Drive, Gmail and calendar capabilities through one OAuth/application connection.
- Other providers are added only when an approved QuoteSuite feature requires them.

OAuth access and refresh tokens must remain backend-only. Status responses expose connection state, enabled state, capability grants and safe metadata, never tokens. Provider adapters own token refresh and API calls. Application features consume stable capability services such as `route_distance`, `cloud_file_storage`, `mail_send`, `mail_sync` or `calendar_events`.

## Mailbox change notification boundary

The canonical mailbox architecture has three layers: the local communication projection supplies immediate UI state; a provider cursor/delta adapter reconciles authoritative changes; and an optional authenticated notification adapter signals when reconciliation should run. Notifications never contain trusted canonical message state and can be duplicated, delayed, delivered out of order or missed.

Gmail uses `users.watch` plus Google Cloud Pub/Sub as the first notification adapter. Safe watch history/expiration, notification-deduplication and projection-version metadata may be persisted, but OAuth tokens, webhook credentials and Pub/Sub authentication material may not. A notification is acknowledged only after its account and delivery authentication have passed the deployment verifier; its history position then drives the existing Gmail `history.list` reconciliation. QuoteSuite-originated mutations persist the provider-confirmed result immediately, while a later matching history event remains idempotent.

Push mode is enabled only when deployment configuration provides a Pub/Sub topic, externally reachable HTTPS push audience and authenticated push service-account contract. Local development must not pretend this infrastructure exists: it uses cache-first projection plus bounded incremental reconciliation while Email is active, on return/focus and after network recovery. Periodic reconciliation remains required in every deployment as the recovery path for missed notifications and expired history cursors.

## Secret boundary

The current local-server implementation stores managed Google Maps and what3words keys as plaintext JSON values in the local SQLite settings table. They are filtered from generic Settings, never returned unmasked, and are not stored in browser storage. This is not encryption at rest. A future deployment requiring a stronger boundary should replace only the credential repository with operating-system or deployment secret storage while retaining the provider/capability service contract.

Google Workspace provider settings are entered once through Administration → Integrations. The OAuth client ID, authorised redirect URI, root folder IDs, folder template, capability metadata and safe account/connection metadata persist in SQLite. The OAuth client secret and access/refresh tokens persist only as AES-256-GCM ciphertext. Status APIs never return the client secret, tokens, ciphertext or master key.

The master QuoteSuite integration encryption key is infrastructure-owned and remains outside the application database. Startup resolves it through a secret-provider bootstrap boundary before integration services are used, validates its format without logging it, and exposes only safe availability state. The local-development provider loads the application-relative ignored `.env.local` file independently of the process working directory. Production providers can later obtain the same secret through Windows secure/DPAPI-backed service configuration, Azure Key Vault, AWS Secrets Manager, Docker/Kubernetes secrets or an equivalent managed server secret store without changing provider persistence or OAuth services.

Missing, invalid or incorrect infrastructure encryption material never deletes persisted integration rows and never generates a replacement key. In that condition, status distinguishes stored provider configuration from operational availability. Restoring the correct infrastructure key makes the existing configuration and connection usable again without re-entering credentials or reconnecting OAuth.

Google Maps is one user-facing integration experience but not necessarily one physical credential:

- Tenant/company business integration: Administration-managed and server-only. It supplies Geocoding API and Routes API capabilities to Web, future iOS and future Android clients through QuoteSuite APIs. The tenant credential never reaches a client.
- QuoteSuite Web map rendering: deployment-managed browser credential, inherently client-visible and restricted to QuoteSuite web origins and Maps JavaScript API.
- Future QuoteSuite iOS map rendering: QuoteSuite-managed Maps SDK for iOS credential restricted to the App Store application's bundle identity.
- Future QuoteSuite Android map rendering: QuoteSuite-managed Maps SDK for Android credential restricted to the Play Store package and signing certificate.

Tenants configure only the coherent Google Maps business integration. QuoteSuite/deployment owns platform rendering credentials because the Web origins, iOS bundle identity, Android package and signing identity belong to QuoteSuite. Browser geocoding is not a business-logic fallback: application geocoding uses the backend capability service.

## Storage locations

OneDrive, SharePoint and Google Drive are true API integrations. Network paths and local file locations are storage-location configuration and must be administered separately from provider connections. Client Files may reference either kind but must not treat a Windows/network path as an OAuth integration.

## Deferred work

Additional platform secret-provider implementations, production Pub/Sub provisioning/authentication, calendars, non-Gmail change-notification adapters, Site Visit & Travel, and customer-facing document workflows are explicitly deferred.
