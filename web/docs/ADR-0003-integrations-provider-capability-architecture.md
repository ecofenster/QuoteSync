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

## Secret boundary

The current local-server implementation stores managed Google Maps and what3words keys as plaintext JSON values in the local SQLite settings table. They are filtered from generic Settings, never returned unmasked, and are not stored in browser storage. This is not encryption at rest. A future deployment requiring a stronger boundary should replace only the credential repository with operating-system or deployment secret storage while retaining the provider/capability service contract.

Google Maps is one user-facing integration experience but not necessarily one physical credential:

- Tenant/company business integration: Administration-managed and server-only. It supplies Geocoding API and Routes API capabilities to Web, future iOS and future Android clients through QuoteSuite APIs. The tenant credential never reaches a client.
- QuoteSuite Web map rendering: deployment-managed browser credential, inherently client-visible and restricted to QuoteSuite web origins and Maps JavaScript API.
- Future QuoteSuite iOS map rendering: QuoteSuite-managed Maps SDK for iOS credential restricted to the App Store application's bundle identity.
- Future QuoteSuite Android map rendering: QuoteSuite-managed Maps SDK for Android credential restricted to the Play Store package and signing certificate.

Tenants configure only the coherent Google Maps business integration. QuoteSuite/deployment owns platform rendering credentials because the Web origins, iOS bundle identity, Android package and signing identity belong to QuoteSuite. Browser geocoding is not a business-logic fallback: application geocoding uses the backend capability service.

## Storage locations

OneDrive, SharePoint and Google Drive are true API integrations. Network paths and local file locations are storage-location configuration and must be administered separately from provider connections. Client Files may reference either kind but must not treat a Windows/network path as an OAuth integration.

## Deferred work

OAuth connection flows, mail synchronisation, calendars, webhooks/change notifications, Site Visit & Travel, and customer-facing document workflows are explicitly deferred.
