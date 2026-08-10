# ADR-0003: Integration Provider and Capability Architecture

- Status: Foundation accepted in source; live provider credentials remain environment/company dependent
- Scope: Administration → Integrations and external-service consumption

## Decision

Administration → Integrations is the sole administrative owner for external-service connections. Application features depend on named capabilities; they do not read or manage provider credentials.

The current provider registry supplies category and capability metadata alongside secret-safe status. Google Maps provides map display, geocoding, routing, distance and travel-time capabilities. what3words provides words-to-coordinates and coordinates-to-words capabilities. Backend operations resolve the active credential using company-managed configuration first, an environment fallback second, and an unconfigured state last.

Future provider families should extend this registry rather than introduce feature-owned integrations:

- Microsoft 365: OneDrive, SharePoint, mail and calendar capabilities through one OAuth/application connection.
- Google Workspace: Drive, Gmail and calendar capabilities through one OAuth/application connection.
- Other providers are added only when an approved QuoteSuite feature requires them.

OAuth access and refresh tokens must remain backend-only. Status responses expose connection state, enabled state, capability grants and safe metadata, never tokens. Provider adapters own token refresh and API calls. Application features consume stable capability services such as `route_distance`, `cloud_file_storage`, `mail_send`, `mail_sync` or `calendar_events`.

## Secret boundary

The current local-server implementation stores managed Google Maps and what3words keys as plaintext JSON values in the local SQLite settings table. They are filtered from generic Settings, never returned unmasked, and are not stored in browser storage. This is not encryption at rest. A future deployment requiring a stronger boundary should replace only the credential repository with operating-system or deployment secret storage while retaining the provider/capability service contract.

Google Maps JavaScript display is a deliberate exception: its browser key is inherently client-visible and remains an environment-supplied, referrer/API-restricted client credential. Backend geocoding, routing, distance and future travel calculations use the backend-managed credential.

## Storage locations

OneDrive, SharePoint and Google Drive are true API integrations. Network paths and local file locations are storage-location configuration and must be administered separately from provider connections. Client Files may reference either kind but must not treat a Windows/network path as an OAuth integration.

## Deferred work

OAuth connection flows, mail synchronisation, calendars, webhooks/change notifications, Site Visit & Travel, and customer-facing document workflows are explicitly deferred.
