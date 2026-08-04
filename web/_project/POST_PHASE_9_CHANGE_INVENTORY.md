# Post-Phase-9 Change Inventory

Updated: 2026-07-10

## Repository Snapshot

- Branch: `main`
- Local HEAD: `4c6a8c5607e4da192fb2079f326099b7b36921fa`
- Remote-tracking HEAD: `origin/main` at `8a17e98733381d4a6aff3476ddda1ae78fe4eaf7`
- Ahead/behind: `0 behind, 120 ahead`
- Relationship: `origin/main` is an ancestor of `HEAD`; `HEAD` is not an ancestor of `origin/main`
- In-progress git operation: none detected (`rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, and `REVERT_HEAD` absent)
- Staged changes: none (`git diff --cached --stat` empty)
- Working tree: dirty

## Ignore / Tracking Notes

The governance documents are untracked because `.gitignore` contains:

```text
web/_project/
```

Confirmed by:

```text
.gitignore:34:web/_project/ "_project\\PROJECT_STATUS.md"
.gitignore:34:web/_project/ "_project\\LEGACY_INVENTORY_PHASE_9.md"
.gitignore:34:web/_project/ "_project\\POST_PHASE_9_CHANGE_INVENTORY.md"
```

Safest correction is to keep `web/_project/` ignored by default and add narrow negations only for governance documents:

```gitignore
web/_project/*
!web/_project/PROJECT_STATUS.md
!web/_project/LEGACY_INVENTORY_PHASE_9.md
!web/_project/POST_PHASE_9_CHANGE_INVENTORY.md
```

Do not force-add the whole `_project/` tree; it contains test evidence, CAD/PDF/reference data, manifests, handovers, and spreadsheet content that should be reviewed separately.

## Classification Summary

| Classification | Entries | Tracking recommendation |
| --- | ---: | --- |
| Phase 9 recovery work | 36 | Track after review as one or more focused commits. |
| Phase 8 recovery work | 46 | Track only with matching UI/theme/admin/B92 validation scope. |
| Phase 7 recovery work | 8 | Track only if client/reference protection changes are intended. |
| Project documentation | 33 | Track governance docs narrowly; review large/reference docs separately. |
| Generated/build output | 10 directory/file groups | Do not track. Add/adjust ignore rules after review. |
| Runtime data | 4 | Do not track unless a sanitized fixture is explicitly intended. |
| Unknown or unrelated change | 16 | Do not include in recovery commits until owner/purpose is confirmed. |

Counts are status-entry based. Large untracked browser profile directories contain thousands of files and are intentionally summarized by directory.

## Tracked Modified / Deleted Files

| Path | Git status | Classification | Probable phase | Should be tracked? | Risk / uncertainty |
| --- | --- | --- | --- | --- | --- |
| `../WIP - Roadmap.txt` | D | Unknown or unrelated change | Unknown | No, until confirmed | Parent-directory tracked file deleted; do not restore or commit without owner review. |
| `../code_unfinished.txt` | D | Unknown or unrelated change | Unknown | No, until confirmed | Parent-directory tracked file deleted; high risk of accidental cleanup. |
| `../quotesync-tree.txt` | D | Generated/build output | Unknown | No | Likely generated tree snapshot; deletion may be intentional cleanup but is outside web root. |
| `.gitignore` | M | Project documentation | Phase 9 checkpoint | Yes, after review | Currently unignores `docs/` but still ignores `_project/`; proposed governance exception still needed. |
| `_project/Test/Europa 92 Alu Clad/3 Field/Hor - 3 Field Tilt Turn Right- Fixed - Tilt Turn Left/B92_EQUAL_FIELD_DATUM_CONSOLIDATED_CLOSEOUT.md` | M | Project documentation | Phase 8 recovery work | Maybe | B92 proof/closeout evidence; review before tracking. |
| `_project/Test/Europa 92 Alu Clad/generated-summary.md` | M | Project documentation | Phase 8 recovery work | Maybe | Generated/reference summary; may be evidence, not governance. |
| `eslint.config.js` | M | Unknown or unrelated change | Cross-phase support | Maybe | Disables many lint rules and ignores broad paths; track only if accepted as policy. |
| `package.json` | M | Phase 9 recovery work | Phase 9 | Yes | Adds validation scripts used by recovery tests/E2E. |
| `server/routes/clients.js` | M | Phase 7 recovery work | Phase 7 | Yes, if EF/live-client protection intended | Server behavior change; validate API paths. |
| `src/App.css` | M | Phase 8 recovery work | Phase 8 | Yes, if theme cleanup intended | Styling changes broad; can mix with source changes. |
| `src/App.tsx` | M | Phase 8 recovery work | Phase 8 with Phase 9 references | Yes, but split carefully | Mixed shell/theme, protected-client, disabled configurator and contract display changes. |
| `src/components/ControlToolbar.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | UI component styling/behavior; review with theme commit. |
| `src/components/GoogleMapPanel.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | UI/theme style changes likely. |
| `src/components/GridEditor.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy editor deletion; ensure no live imports. |
| `src/components/Toggle.css` | M | Phase 8 recovery work | Phase 8 | Yes | Theme/control styling. |
| `src/components/Toggle.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Theme/control component. |
| `src/dashboard/main/MainDashboard.css` | M | Phase 8 recovery work | Phase 8 | Yes | Dashboard UI/theme work. |
| `src/dashboard/main/MainDashboard.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Dashboard UI/navigation work. |
| `src/domain/estimates/estimateCalculations.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Contract-aware totals; core production behavior. |
| `src/features/admin/AdminConfiguratorCatalogWorkspace.tsx` | M | Phase 9 recovery work | Phase 8/9 mixed | Yes, split with care | Admin preview isolation plus B92 configurator shell tab. |
| `src/features/admin/AdminPlaceholderPage.css` | M | Phase 8 recovery work | Phase 8 | Yes | Admin UI/theme. |
| `src/features/admin/AdminPlaceholderPage.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Admin/settings UI changes. |
| `src/features/admin/AdminRenderProfileWorkspace.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | Admin preview uses isolated render adapter. |
| `src/features/admin/configuratorCatalog.types.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Catalog/schema expansion; review with admin/B92 work. |
| `src/features/admin/windowTypes/AdminWindowTypesWorkspace.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Window type workspace changes. |
| `src/features/admin/windowTypes/B92ProfileSectionAssemblyPreview.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | B92 proof/preview rendering work. |
| `src/features/admin/windowTypes/WindowTypeDesignList.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Window type admin UI. |
| `src/features/admin/windowTypes/WindowTypeEditor.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Large admin UI/model edit; review independently. |
| `src/features/admin/windowTypes/WindowTypePreviewPanel.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | Admin preview isolation path. |
| `src/features/admin/windowTypes/windowTypeSourceModel.types.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Source model schema change. |
| `src/features/clientPortal/ClientPortalPlaceholderPage.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | UI/theme placeholder change. |
| `src/features/clients/ClientsView.css` | M | Phase 8 recovery work | Phase 8 | Yes | Client UI/theme. |
| `src/features/clients/defaultClients.ts` | M | Phase 7 recovery work | Phase 7 | Yes, if seed data intended | Live/demo client protection context; review data changes. |
| `src/features/configurator/ConfiguratorEntryModal.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy configurator UI deleted. |
| `src/features/configurator/ConfiguratorWorkspace.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy configurator workspace deleted. |
| `src/features/configurator/components/ConfiguratorProgress.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow UI deleted. |
| `src/features/configurator/components/ConfiguratorStepFrame.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow UI deleted. |
| `src/features/configurator/components/ConfiguratorWorkflowShell.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow shell deleted. |
| `src/features/configurator/components/steps/AddPositionStep.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow step deleted. |
| `src/features/configurator/components/steps/ConfigurationStep.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow step deleted. |
| `src/features/configurator/components/steps/EstimateDefaultsStep.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow step deleted. |
| `src/features/configurator/components/steps/ForecastStep.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow step deleted. |
| `src/features/configurator/components/steps/ProjectSiteAddressStep.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow step deleted. |
| `src/features/configurator/components/steps/ReviewStep.tsx` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow step deleted. |
| `src/features/configurator/configuratorSchema.helpers.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Admin preview helper rename/isolation. |
| `src/features/configurator/configuratorWorkflow.helpers.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Retires draft-to-position helpers; keeps hydration compatibility. |
| `src/features/configurator/configuratorWorkflow.summary.ts` | D | Phase 9 recovery work | Phase 9 | Yes | Legacy workflow summary deleted. |
| `src/features/configurator/rendering/DrawingViewport.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Rendering viewport/UI behavior. |
| `src/features/configurator/rendering/QuoteSyncDrawingSvg.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Drawing output changes; validate with render tests. |
| `src/features/configurator/rendering/buildWindowDrawingModel.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Isolates `windowConfiguration` behind compatibility adapter. |
| `src/features/configurator/rendering/drawingModel.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Drawing model schema/support. |
| `src/features/configurator/rendering/drawingViewport.types.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Drawing viewport typing. |
| `src/features/configurator/rendering/profileResolution/adminWindowTypeSourceAdapter.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Admin source model/B92 bridge. |
| `src/features/configurator/rendering/profileResolution/b92ContractDrawingAdapter.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Large B92 drawing/proof work; separate commit. |
| `src/features/configurator/rendering/profileResolution/b92ContractPreview.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 preview contract work. |
| `src/features/configurator/rendering/profileResolution/b92DatumAcquisitionAudit.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 datum evidence/audit. |
| `src/features/configurator/rendering/profileResolution/b92DatumGeometry.types.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 datum types. |
| `src/features/configurator/rendering/profileResolution/b92DatumGeometryRegister.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 datum registry. |
| `src/features/configurator/rendering/profileResolution/b92DatumProjection.types.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 projection types. |
| `src/features/configurator/rendering/profileResolution/b92DatumProjectionFixture.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 projection fixtures. |
| `src/features/configurator/rendering/profileResolution/b92FixedInternalWindowTypeSource.seed.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 source seed. |
| `src/features/configurator/rendering/profileResolution/b92FixedNoSashProjectionDrawingPilot.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 pilot renderer. |
| `src/features/configurator/rendering/profileResolution/b92FixedNoSashProjectionParity.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 parity diagnostics. |
| `src/features/configurator/rendering/profileResolution/b92FixedSashInternalWindowTypeSource.seed.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 source seed. |
| `src/features/configurator/rendering/profileResolution/b92JunctionRuleRegistry.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 junction registry. |
| `src/features/configurator/rendering/profileResolution/b92ProfileMaps.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 profile mapping. |
| `src/features/configurator/rendering/profileResolution/b92ProfileTypes.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 profile typing. |
| `src/features/configurator/rendering/profileResolution/b92ProjectionEngine.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 projection engine. |
| `src/features/configurator/rendering/profileResolution/b92ProjectionRendererLikeAdapter.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 projection adapter. |
| `src/features/configurator/rendering/profileResolution/b92ProjectionValidation.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 validation. |
| `src/features/configurator/rendering/profileResolution/b92SegmentBuilders.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 segment builders. |
| `src/features/configurator/rendering/profileResolution/b92SegmentResolver.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 segment resolver. |
| `src/features/configurator/rendering/profileResolution/b92SegmentResolver.types.ts` | M | Phase 8 recovery work | Phase 8 | Yes | B92 resolver types. |
| `src/features/configurator/rendering/profileResolution/catalogWindowTypeSourceAdapter.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Catalog to source model bridge. |
| `src/features/configurator/rendering/profileResolution/fieldGrid.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Field grid helper. |
| `src/features/configurator/rendering/profileResolution/junctionResolver.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Junction resolver. |
| `src/features/configurator/rendering/profileResolution/profileResolver.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Profile resolver. |
| `src/features/configurator/rendering/profileResolution/windowTypeRenderContract.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Render contract type additions. |
| `src/features/estimateCollection/EstimateCollectionActions.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Estimate collection UI/action flow. |
| `src/features/estimateCollection/EstimateCollectionRow.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Estimate collection UI. |
| `src/features/estimateCollection/EstimateCollectionView.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Estimate collection UI. |
| `src/features/estimateCollection/EstimateExpandedPanel.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | Uses disabled workflow quarantine and contract-aware position flow. |
| `src/features/estimatePicker/EstimatePickerFeature.css` | M | Phase 8 recovery work | Phase 8 | Yes | Estimate picker styling. |
| `src/features/estimatePicker/EstimatePickerFeature.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Estimate picker wrapper changes. |
| `src/features/estimatePicker/EstimatePickerTabs.tsx` | M | Phase 9 recovery work | Phase 8/9 mixed | Yes | Contract-aware description plus existing picker work. |
| `src/features/estimatePicker/components/EstimateActionsBar.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Estimate action UI. |
| `src/features/estimatePicker/tabs/EstimatePositionsTable.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | Position table supports contract-backed positions/quick-add flow. |
| `src/features/estimatePicker/tabs/FilesTab.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | UI text/style. |
| `src/features/estimatePicker/tabs/NotesTab.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | UI text/style. |
| `src/features/estimatePicker/tabs/OrderInstallationsBlock.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Order/install UI. |
| `src/features/estimatePicker/tabs/shared.css` | M | Phase 8 recovery work | Phase 8 | Yes | Shared UI/theme. |
| `src/features/estimatePicker/tabs/shared.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Shared UI primitives. |
| `src/features/estimatePositions/EstimatePositionsFeature.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | B92 quick-add compiles/persists `ConfiguredPositionContract`. |
| `src/features/estimatePositions/components/PositionExpandedPanel.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | Displays contract-backed position details. |
| `src/features/estimateWorkflow/EstimateWorkflowProvider.tsx` | M | Phase 9 recovery work | Phase 9 | Yes | Disabled workflow compatibility only. |
| `src/features/estimateWorkflow/workflow.types.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Compatibility type support. |
| `src/features/estimateWorkflow/workflowDraft.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Hydrates legacy `windowConfiguration` via adapter. |
| `src/features/followUps/FollowUpsFeature.css` | M | Phase 8 recovery work | Phase 8 | Yes | Follow-up UI/theme. |
| `src/features/followUps/FollowUpsFeature.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Follow-up UI. |
| `src/features/tools/bsen/BSENStandardsTool.css` | M | Phase 8 recovery work | Phase 8 | Yes | Tool UI/theme. |
| `src/features/tools/bsen/BSENStandardsTool.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Tool UI. |
| `src/features/tools/glass/GlassWeightCalculatorTool.css` | M | Phase 8 recovery work | Phase 8 | Yes | Tool UI/theme. |
| `src/features/tools/glass/GlassWeightCalculatorTool.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | Tool UI. |
| `src/layout/AppShell.css` | M | Phase 8 recovery work | Phase 8 | Yes | App shell/theme. |
| `src/layout/AppShell.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | App shell/navigation. |
| `src/layout/appShellNav.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Navigation entries. |
| `src/main.tsx` | M | Phase 8 recovery work | Phase 8 | Yes | App bootstrap/theme import. |
| `src/models/types.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Adds `configuredContract` to persisted position envelope. |
| `src/services/documents/estimateDocumentService.ts` | M | Phase 9 recovery work | Phase 9 | Yes | Contract-first quote/document output. |
| `src/styles/base.css` | M | Phase 8 recovery work | Phase 8 | Yes | Theme foundation. |
| `src/styles/tokens.css` | M | Phase 8 recovery work | Phase 8 | Yes | Theme tokens. |
| `src/styles/ui.css` | M | Phase 8 recovery work | Phase 8 | Yes | Shared UI styling. |
| `src/styles/utilities.css` | M | Phase 8 recovery work | Phase 8 | Yes | Utility styling. |
| `src/system/settings.ts` | M | Phase 8 recovery work | Phase 8 | Yes | Settings/theme support. |
| `tsconfig.app.json` | M | Unknown or unrelated change | Cross-phase support | Maybe | Relaxes unused checks; should be reviewed with lint policy. |
| `tsconfig.node.json` | M | Unknown or unrelated change | Cross-phase support | Maybe | Relaxes unused checks; should be reviewed with lint policy. |

## Untracked Files And Directories

| Path | Git status | Classification | Probable phase | Should be tracked? | Risk / uncertainty |
| --- | --- | --- | --- | --- | --- |
| `../B92_full_profile_correction_matrix.xlsx` | ?? | Project documentation | Phase 8 | Maybe | Binary reference spreadsheet outside web root; review size/sensitivity. |
| `../B92_profile_full_matrix.xlsx` | ?? | Project documentation | Phase 8 | Maybe | Binary reference spreadsheet outside web root; review size/sensitivity. |
| `../Claude_Test/` | ?? | Unknown or unrelated change | Unknown | No, until reviewed | External/tool output outside web root. |
| `../Handles/` | ?? | Project documentation | Unknown | Maybe | Product/reference asset directory outside web root; inspect before tracking. |
| `../Lacquers/` | ?? | Project documentation | Phase 8 | Maybe | Reference assets outside web root; may be large. |
| `../System Profile Images/` | ?? | Project documentation | Phase 8 | Maybe | Reference images outside web root; likely large. |
| `../WIP - PDFs and types/` | ?? | Project documentation | Unknown | No, until reviewed | WIP/reference material outside web root; risk of large/sensitive files. |
| `../config layout/` | ?? | Project documentation | Unknown | Maybe | Reference layout material outside web root. |
| `../profile data - B92.xlsx` | ?? | Project documentation | Phase 8 | Maybe | Binary reference spreadsheet outside web root. |
| `../quotesync.db` | ?? | Runtime data | Unknown | No | Database; do not track raw runtime/client data. |
| `../theme ideas/` | ?? | Project documentation | Phase 8 | No, until curated | Design reference outside web root; likely not governance. |
| `.tmp-chrome-phase1-clean/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output; thousands of files. |
| `.tmp-chrome-phase1-demo/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output. |
| `.tmp-chrome-phase1-demo2/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output. |
| `.tmp-chrome-phase1-demo3/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output. |
| `.tmp-chrome-phase1-demo4/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output. |
| `.tmp-chrome-phase1-stale/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output. |
| `.tmp-chrome-phase1/` | ?? | Generated/build output | Unknown | No | Browser profile/cache output. |
| `.tmp-chrome-phase6-1783604161947-5997f9268e979/` | ?? | Generated/build output | Phase 9 validation | No | E2E browser profile/cache output. |
| `.tmp-chrome-phase6-1783605665924-5c7fac163cfb38/` | ?? | Generated/build output | Phase 9 validation | No | E2E browser profile/cache output. |
| `.tmp-chrome-phase6-1783686876455-eecdcec5099bf8/` | ?? | Generated/build output | Phase 9 validation | No | E2E browser profile/cache output from latest validation. |
| `.tmp-phase5-tests/` | ?? | Generated/build output | Phase 9 validation | No | Bundled test output. |
| `B92_FENSTERNORM_GUIDED_CONFIGURATOR_PHASE1_TO_5_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | Review doc; likely useful but not governance checkpoint. |
| `B92_FENSTERNORM_STYLE_FINAL_UX_SCREEN_MAP.md` | ?? | Project documentation | Phase 8 | Maybe | UX documentation. |
| `B92_FENSTERNORM_STYLE_UX_REVIEW_AND_MIGRATION_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | UX/migration plan. |
| `B92_IMPLEMENTATION_ARCHITECTURE_AND_COMPONENT_MAP.md` | ?? | Project documentation | Phase 8 | Maybe | Architecture map; review for currency. |
| `B92_INLINE_CSS_CLEANUP_PHASES_1_TO_5_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | Cleanup review doc. |
| `B92_INLINE_CSS_CLEANUP_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | Cleanup plan doc. |
| `B92_PHASE2A_RIGHT_CLICK_CONTEXT_SCAFFOLD_REPORT.md` | ?? | Project documentation | Phase 8 | Maybe | B92 report. |
| `B92_PHASE2A_RIGHT_CLICK_STRUCTURE_CORRECTION_REPORT.md` | ?? | Project documentation | Phase 8 | Maybe | B92 report. |
| `B92_PHASE2A_STRUCTURE_PRESET_IMPLEMENTATION_REPORT.md` | ?? | Project documentation | Phase 8 | Maybe | B92 report. |
| `B92_PHASE2A_STRUCTURE_TILE_LIBRARY_UX_CORRECTION_REPORT.md` | ?? | Project documentation | Phase 8 | Maybe | B92 report. |
| `B92_PHASE2_STRUCTURE_RIGHT_CLICK_MODEL_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | B92 plan. |
| `B92_PHASE4_PREVIEW_STATUS_MANUAL_QA_CHECKLIST.md` | ?? | Project documentation | Phase 8 | Maybe | Manual QA checklist. |
| `B92_SINGLE_CONFIGURATOR_ARCHITECTURE_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | Architecture review. |
| `B92_SIZE_EDITOR_IMPLEMENTATION_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | Implementation plan. |
| `B92_SOLE_CONFIGURATOR_MIGRATION_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | Migration plan. |
| `B92_STABILISATION_REFACTOR_PASSES_1_TO_5_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | Stabilisation review. |
| `B92_STABILISATION_REFACTOR_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | Stabilisation plan. |
| `CLIENT_REFERENCE_RENUMBERING_AND_SORT_PLAN.md` | ?? | Project documentation | Phase 7 | Maybe | Client reference plan. |
| `QUOTESYNC_DARK_MODE_WHITE_SURFACE_CLEANUP_PHASES_1_TO_5_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | Theme cleanup review. |
| `QUOTESYNC_DARK_MODE_WHITE_SURFACE_CLEANUP_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | Theme cleanup plan. |
| `QUOTESYNC_INLINE_CSS_PHASE1A_1C_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | CSS cleanup review. |
| `QUOTESYNC_INLINE_CSS_PHASE1_APPSHELL_SHARED_UI_PLAN.md` | ?? | Project documentation | Phase 8 | Maybe | CSS cleanup plan. |
| `QUOTESYNC_LIGHT_DARK_THEME_CSS_CLEANUP_REPORT.md` | ?? | Project documentation | Phase 8 | Maybe | Theme cleanup report. |
| `QUOTESYNC_THEME_CLEANUP_PHASES_1_2_REVIEW.md` | ?? | Project documentation | Phase 8 | Maybe | Theme cleanup review. |
| `docs/` | ?? | Project documentation | Phase 9/architecture | Yes, selectively | Contains ADR; `.gitignore` now allows docs, but review all files before tracking. |
| `logo.png` | ?? | Unknown or unrelated change | Phase 8 | Maybe | Root image asset; verify usage and duplication. |
| `quotesync.db.backup-client-ref-renumber-20260604-154537` | ?? | Runtime data | Phase 7 | No | Database backup; do not track raw runtime/client data. |
| `quotesync.db.backup-phase1-verification-20260707-152023` | ?? | Runtime data | Validation | No | Database backup; do not track raw runtime/client data. |
| `scripts/export-b92-exact-render-output.mjs` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92 evidence/export script. |
| `scripts/extract-europa92-type5-authority-linework.mjs` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92 evidence extraction script. |
| `scripts/reassemble-b92-18-flying-mullion-proofs.mjs` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92 proof script. |
| `scripts/reassemble-exploded-b92-proofs.mjs` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92 proof script. |
| `scripts/run-phase5-tests.mjs` | ?? | Phase 9 recovery work | Phase 9 | Yes | Test runner used by `npm test`. |
| `scripts/run-phase6-e2e.mjs` | ?? | Phase 9 recovery work | Phase 9 | Yes | Existing E2E runner used by `npm run test:e2e`. |
| `server/quotesync.db` | ?? | Runtime data | Unknown | No | Runtime database. |
| `src/Logos/` | ?? | Phase 8 recovery work | Phase 8 | Maybe | UI/logo assets; verify usage and size. |
| `src/assets.d.ts` | ?? | Phase 8 recovery work | Phase 8 | Yes | Asset typing needed by build if imports use images. |
| `src/assets/eco-glass-background.avif` | ?? | Phase 8 recovery work | Phase 8 | Maybe | Visual asset; verify usage. |
| `src/components/QuoteSyncLogo.tsx` | ?? | Phase 8 recovery work | Phase 8 | Yes | Logo component. |
| `src/components/ThemeSelector.tsx` | ?? | Phase 8 recovery work | Phase 8 | Yes | Theme UI. |
| `src/domain/positions/` | ?? | Phase 9 recovery work | Phase 9 | Yes | Position presentation uses contract-aware descriptions. |
| `src/features/admin/rendering/` | ?? | Phase 9 recovery work | Phase 9 | Yes | Admin preview render adapter quarantine boundary. |
| `src/features/admin/windowTypes/b92RalClassicColours.ts` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92/RAL colour support. |
| `src/features/b92Configurator/` | ?? | Phase 9 recovery work | Phase 8/9 mixed | Yes | Forward B92 configurator and contract compiler; review as major commit. |
| `src/features/clientPortal/ClientPortalPlaceholderPage.css` | ?? | Phase 8 recovery work | Phase 8 | Yes | Client portal styling. |
| `src/features/configurator/configuredPositionContract.types.ts` | ?? | Phase 9 recovery work | Phase 9 | Yes | Canonical contract type. |
| `src/features/configurator/configuredPositionContract.utils.ts` | ?? | Phase 9 recovery work | Phase 9 | Yes | Contract utilities. |
| `src/features/configurator/legacyPositionContractAdapter.ts` | ?? | Phase 9 recovery work | Phase 9 | Yes | Compatibility adapter. |
| `src/features/configurator/legacyWindowConfigurationAdapter.ts` | ?? | Phase 9 recovery work | Phase 9 | Yes | Legacy `windowConfiguration` boundary. |
| `src/features/configurator/rendering/authorityFixtures/` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92 authority fixtures. |
| `src/features/configurator/rendering/buildFixedInternalRectanglePilot.ts` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92/render pilot support. |
| `src/features/configurator/rendering/profileResolution/b92FixedFixedEvidenceLineworkPilot.ts` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92 evidence pilot. |
| `src/features/configurator/rendering/profileResolution/profilePilotAnnotations.ts` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92/profile pilot support. |
| `src/features/configurator/rendering/profileResolution/profilePilotGeometry.ts` | ?? | Phase 8 recovery work | Phase 8 | Maybe | B92/profile pilot support. |
| `src/features/configurator/rendering/profileSectionAssembly/` | ?? | Phase 8 recovery work | Phase 8 | Maybe | Profile assembly renderer support. |
| `src/features/configurator/rendering/windowConfigurationRenderAdapter.ts` | ?? | Phase 9 recovery work | Phase 9 | Yes | Renderer compatibility adapter. |
| `src/features/estimateWorkflow/disabledWorkflowQuarantine.ts` | ?? | Phase 9 recovery work | Phase 9 | Yes | Disabled workflow quarantine boundary. |
| `src/google-maps.d.ts` | ?? | Phase 8 recovery work | Phase 8 | Yes, if maps integration uses it | Ambient type support. |
| `src/logo.png` | ?? | Unknown or unrelated change | Phase 8 | Maybe | Duplicated logo asset; verify usage. |
| `src/theme/` | ?? | Phase 8 recovery work | Phase 8 | Yes | Theme system. |
| `tests/` | ?? | Phase 9 recovery work | Phase 9 | Yes | Contains Phase 5 contract tests; track selectively. |
| `_project/PROJECT_STATUS.md` | ignored/untracked | Project documentation | Phase 9 | Yes, after ignore fix | Governance document; should be version-controlled. |
| `_project/LEGACY_INVENTORY_PHASE_9.md` | ignored/untracked | Project documentation | Phase 9 | Yes, after ignore fix | Governance document; should be version-controlled. |
| `_project/POST_PHASE_9_CHANGE_INVENTORY.md` | ignored/untracked | Project documentation | Phase 9 checkpoint | Yes, after ignore fix | This checkpoint inventory; should be version-controlled. |

## Proposed Commit Boundaries

### 1. Theme, Shell, And Shared UI Recovery

- Purpose: capture broad Phase 8 UI/theme/app shell cleanup.
- Include: `src/App.css`, `src/App.tsx` theme-only hunks, `src/components/ControlToolbar.tsx`, `src/components/GoogleMapPanel.tsx`, `src/components/Toggle.*`, `src/dashboard/main/*`, `src/features/*/*.css`, `src/layout/*`, `src/styles/*`, `src/theme/`, `src/components/QuoteSyncLogo.tsx`, `src/components/ThemeSelector.tsx`, relevant logo/assets.
- Dependencies: none, but easiest before Phase 9 commits if source hunks can be cleanly separated.
- Validation: `npm run typecheck`, `npm run lint`, visual smoke check.
- Must not include: contract/quarantine files, runtime `.db` files, `.tmp-*`, unrelated parent-directory deletes.

### 2. B92/Admin Source Model And Preview Work

- Purpose: capture B92 proof/render/admin preview work that is not solely Phase 9 quarantine.
- Include: B92/profile-resolution files, admin window type workspace/editor files, `src/features/b92Configurator/` where it is forward configurator work, B92 proof scripts and selected B92 documentation.
- Dependencies: may depend on theme assets and shared admin UI from commit 1.
- Validation: `npm run typecheck`, `npm run lint`, `npm run build`, B92 proof/manual checks where applicable.
- Must not include: legacy workflow deletion, disabled workflow quarantine, runtime databases, Chrome temp output.

### 3. Canonical Configured Position Contract And Compatibility Adapters

- Purpose: establish `ConfiguredPositionContract` as production source of truth and preserve compatibility.
- Include: `src/features/configurator/configuredPositionContract.*`, `legacyPositionContractAdapter.ts`, `legacyWindowConfigurationAdapter.ts`, `windowConfigurationRenderAdapter.ts`, `src/models/types.ts`, `src/domain/estimates/estimateCalculations.ts`, `src/services/documents/estimateDocumentService.ts`, `src/domain/positions/`, relevant parts of `EstimatePositionsFeature.tsx`, `PositionExpandedPanel.tsx`, `EstimatePickerTabs.tsx`.
- Dependencies: may depend on B92 compiler/source model work in commit 2.
- Validation: `npm run typecheck`, `npm test`, `npm run build`.
- Must not include: deletion of old workflow UI unless separated into commit 4.

### 4. Complete Legacy Configurator Retirement

- Purpose: remove dead legacy configurator UI and old `GridEditor` surfaces after compatibility is preserved.
- Include: deletions of `src/components/GridEditor.tsx`, `src/features/configurator/ConfiguratorEntryModal.tsx`, `ConfiguratorWorkspace.tsx`, `ConfiguratorWorkflowShell.tsx`, old workflow step components, `configuratorWorkflow.summary.ts`, and retirement hunks in `configuratorWorkflow.helpers.ts`.
- Dependencies: commit 3 must land first.
- Validation: `npm run typecheck`, `npm run lint`, `npm test`, import search for deleted component names.
- Must not include: unrelated UI/theme changes or runtime/generated output.

### 5. Complete Disabled Workflow Quarantine

- Purpose: keep disabled workflow state available only through a named quarantine boundary.
- Include: `src/features/estimateWorkflow/disabledWorkflowQuarantine.ts`, `EstimateExpandedPanel.tsx` quarantine imports/usages, workflow draft hydration changes, Phase 9 tests covering legacy hydration.
- Dependencies: commit 3 first; commit 4 can be before or after if tests still pass.
- Validation: `npm run typecheck`, `npm test`, `npm run test:e2e`.
- Must not include: broad workflow UI deletion if already captured in commit 4.

### 6. Recovery Validation And Governance Documentation

- Purpose: track recovery status, inventory, ADR, and validation scripts.
- Include: `package.json` test scripts, `scripts/run-phase5-tests.mjs`, `scripts/run-phase6-e2e.mjs`, `tests/phase5-contract.test.ts`, `docs/ADR-0001-canonical-configured-position-architecture.md`, `_project/PROJECT_STATUS.md`, `_project/LEGACY_INVENTORY_PHASE_9.md`, `_project/POST_PHASE_9_CHANGE_INVENTORY.md`, and a narrow `.gitignore` exception for those `_project` governance docs.
- Dependencies: after commits 3-5 so tests/docs describe actual code.
- Validation: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`.
- Must not include: `_project/Test/**`, raw spreadsheets, `.db` files, `.tmp-*`, or general `_project` archive content.

### 7. Client Reference / Runtime Protection Work

- Purpose: capture Phase 7 client reference renumbering/protection changes if still desired.
- Include: `server/routes/clients.js`, `src/features/clients/defaultClients.ts`, selected protected-client hunks in `src/App.tsx`, `CLIENT_REFERENCE_RENUMBERING_AND_SORT_PLAN.md` if useful.
- Dependencies: independent, but validate against current app state.
- Validation: targeted API smoke test plus `npm run typecheck`.
- Must not include: raw `quotesync.db`, database backups, or unrelated UI/theme hunks.

## Remote Synchronisation Assessment

The local branch is 120 commits ahead of `origin/main` and 0 behind. Because `origin/main` is an ancestor of `HEAD`, a normal push of committed history would be fast-forward with respect to the remote-tracking branch. No fetch was performed during this checkpoint, so this assessment is only as current as the existing local `origin/main` ref.

The last 20 commits are all B92/admin/proof related and appear intentional by message. The uncommitted working tree, however, contains generated artifacts, runtime data, broad lint/tsconfig policy relaxation, and parent-directory deletions that are not suitable for a single push/commit without review.
