QuoteSync savepoint: 20260303_164917_SAVEPOINT_working_estimate_picker
Working: Customers → Client Database → Open shows Estimate Picker with Client Info.
Fixed: parser breaks in EstimatePickerTabs.tsx + runtime crash pendingPickerClientId undefined.
Savepoint files: App.tsx, EstimatePickerFeature.tsx, EstimatePickerTabs.tsx (plus optional context).
Rules: scripts-only, run from web\ps1_patches, Unblock-File then pwsh, backup before changes, no layout changes without approval.
Env: Date: 2026-03-03 16:49:17 | Web root: C:\Github\QuoteSync\web | Node: v22.18.0 | npm:  11.6.0 | Branch: main | Commit:  72d13c8
