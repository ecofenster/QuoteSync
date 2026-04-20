# QuoteSync New Chat Handover

Generated: 2026-04-20 10:53:19

## Workflow rules
- Design is handled by the user + ChatGPT.
- Codex is the implementer only.
- Do not guess paths or file contents blindly; inspect the live repo first.
- Do not auto-run npm or dev servers.
- Commit/push at safe logical boundaries; end-of-phase is acceptable.
- Codex does not create backups automatically; backup must be explicitly done before major structural implementation.

## Current architecture direction
- Next architecture phase: Unified Estimate Collection System.
- Main-menu Estimates is wrong.
- Client Estimates is the correct behaviour model.
- Target one shared expandable estimate collection system across client and main-menu contexts.
- Keep the same expand/collapse behaviour across both contexts.
- Deliver list parity first.
- Leave grid mode until later.

## Grid/List standard
- List-first for data-heavy business views.
- Grid-secondary where useful.
- Behaviour should stay aligned across views.

## Maintenance artifacts from this run
- Backup: C:\Github\QuoteSync\web\_backups\20260420_105229-quotesync-maintenance-backup.zip
- Structure snapshot: C:\Github\QuoteSync\web\_project\structure\20260420_105229-structure-snapshot.txt
- Manifest: C:\Github\QuoteSync\web\_project\_manifests\20260420_105229-maintenance-manifest.txt
- Updated project map: C:\Github\QuoteSync\web\_project\PROJECT_MAP.md
- Updated changelog: C:\Github\QuoteSync\web\_project\CHANGELOG.md

## Next implementation expectation
When implementation starts, use the live Client Estimates behaviour as the reference model and avoid inventing a separate Main-menu Estimates interaction pattern.