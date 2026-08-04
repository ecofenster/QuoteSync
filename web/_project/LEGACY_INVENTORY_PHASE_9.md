# Legacy Inventory - Phase 9

Updated: 2026-07-10

Status: Complete after recovery audit.

## Scope

Search terms:

```text
workflow
wizard
windowConfiguration
legacy
ConfiguratorWorkflow
WorkflowDraft
WorkflowState
GridEditor
WorkflowShell
ConfiguratorModal
disabled
deprecated
```

Live implementation scope was `src`, `tests`, and `scripts`. Historical docs, manifests, backups, and roadmap files contain older terminology and are treated as archival unless referenced by live imports.

## Classification

| Item | Location | Classification | Phase 9 disposition |
| --- | --- | --- | --- |
| B92 contract compiler, projection, and contract-aware metrics | `src/features/b92Configurator`, `src/features/configurator/configuredPositionContract.*`, `src/domain/estimates/estimateCalculations.ts`, `src/services/documents/estimateDocumentService.ts` | production | Contract-first; no direct legacy workflow dependency found. |
| Disabled estimate workflow provider/hook | `src/features/estimateWorkflow/*`, `src/features/estimateCollection/EstimateExpandedPanel.tsx` | compatibility | Consumer now imports through `disabledWorkflowQuarantine.ts`; remains only to show disabled workflow state and preserve old draft compatibility. |
| Workflow draft hydration | `src/features/estimateWorkflow/workflowDraft.ts`, `src/features/configurator/configuratorWorkflow.helpers.ts` | compatibility | Kept for old state hydration; `windowConfiguration` reads go through `legacyWindowConfigurationAdapter.ts`. |
| Legacy `windowConfiguration` persisted blob | `src/features/configurator/legacyWindowConfigurationAdapter.ts` | compatibility | Explicit adapter boundary only. Not a production source of truth. |
| Renderer compatibility input | `src/features/configurator/rendering/windowConfigurationRenderAdapter.ts`, `src/features/configurator/rendering/buildWindowDrawingModel.ts` | compatibility/render diagnostic | Direct reads isolated to render adapter; B92 diagnostics preserved. |
| Admin preview render calls | `src/features/admin/rendering/adminPreviewRenderAdapter.ts`, admin workspaces | admin-preview | Admin code now calls `buildAdminPreviewWindowDrawingModel`; only adapter maps to renderer compatibility input. |
| Configurator schema preview layout helper | `src/features/configurator/configuratorSchema.helpers.ts` | admin-preview | Renamed to `buildAdminPreviewInputFromConfiguratorLayoutDefinition`; no longer exposes `windowConfiguration` to admin callers. |
| Legacy workflow draft-to-position helpers | `src/features/configurator/configuratorWorkflow.helpers.ts` | dead-code | Deleted: `buildPositionFromWorkflowDraft`, `applyPositionToWorkflowDraft`, and private support helpers. |
| Old App-level position wizard state | `src/App.tsx` | dead-code | Removed in Phase 8; no identifiers remain. |
| `GridEditor`, `ConfiguratorWorkspace`, `ConfiguratorEntryModal`, `WorkflowShell` | deleted source paths / historical docs | dead-code | No live `src` imports remain. |
| Phase 5 compatibility tests | `tests/phase5-contract.test.ts` | test-only | Extended with legacy `windowConfiguration` hydration coverage. |
| Phase 6 E2E script | `scripts/run-phase6-e2e.mjs` | test-only | Preserves B92 quick-add, old estimate load/display, document output, unsupported B92 failure, and EF client protection checks. |
| CSS classes named `legacy-*` | `src/App.css`, `src/App.tsx`, shared UI | production styling | Naming only; no configurator source-of-truth role. |
| Project calculator wizard | `src/project calculator/ProjectCalculatorWizard.tsx` | production tool | Separate tool wizard, unrelated to estimate configurator source of truth. |
| ADR/project map/backup manifests | `docs`, `_project`, `_backups`, `_manifests` | documentation/archive | Retained as historical references, not live production imports. |

## Production Path Confirmation

- Estimate totals use contract-aware metrics.
- Quote/document output uses contract-first descriptions.
- B92 quick add persists `configuredContract` and legacy projection fields.
- Unsupported B92 combinations fail safely through compiler checks.
- No production estimate/render/quote/document path directly reads `Position.windowConfiguration`.
