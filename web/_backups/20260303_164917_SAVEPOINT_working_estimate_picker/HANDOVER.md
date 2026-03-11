# QuoteSync Handover (savepoint: 20260303_164917_SAVEPOINT_working_estimate_picker)

## Status
- App is **working again** after recent breakages.
- **Customers → Client Database → Open** now loads the **Estimate Picker** screen and shows **Client Info** (tabs visible).
- Recent failures included:
  - App.tsx truncation errors (Vite “Unexpected token … at EOF”).
  - EstimatePickerTabs.tsx stray duplicated JSX lines causing parser errors.
  - Runtime error: **pendingPickerClientId is not defined** (blank screen in App).

## What was fixed (today)
- Fixed Estimate Picker tab component syntax issues (stray duplicated lines like }}>{children}</div>; and similar).
- Fixed runtime crash by ensuring pendingPickerClientId is defined/guarded in App.tsx (so Open doesn’t crash the App component).
- Restored the Estimate Picker flow so selecting a client and clicking **Open** reliably enters the picker view.

## Current working files in this savepoint
- src\App.tsx
- src\features\estimatePicker\EstimatePickerFeature.tsx
- src\features\estimatePicker\EstimatePickerTabs.tsx

(Additional context files were copied if present.)

## Known issues / next stabilisation tasks
- Confirm "Open / Back / New Estimate" flows for multiple clients.
- Confirm tab switching: Client Info / Estimates / Orders / Client Notes / Files.
- Confirm no hidden runtime errors in console while navigating.
- Tighten backup/restore scripts so they always find flattened backup filenames.

## Rules (do not break)
- **NO manual edits by user** (Ecofenster only runs provided scripts).
- Always provide a **real .ps1 file** for download (not inline “create the file yourself”).
- Scripts must be run from: **PS C:\Github\QuoteSync\web\ps1_patches>**
- Run steps every time:
  1) Unblock-File .\NAME.ps1
  2) pwsh -ExecutionPolicy Bypass -File .\NAME.ps1
- **Backup before every change** (timestamped under web\_backups\...).
- Do not change UI layout without explicit approval.

## Environment
Date: 2026-03-03 16:49:17
Web root: C:\Github\QuoteSync\web
Node: v22.18.0
npm:  11.6.0
Branch: main
Commit:  72d13c8
