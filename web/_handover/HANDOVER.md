# QuoteSync — Development Handover (2026-03-04 Savepoint)

## Project
- **QuoteSync CRM / Estimating platform**
- **Repository location:** `C:\Github\QuoteSync\web`
- **Patch scripts location:** `C:\Github\QuoteSync\web\ps1_patches`
- **Backups:** `C:\Github\QuoteSync\web\_backups`

## Current Status
The application is running correctly via:
- `npm run dev`

Vite dev server is stable.

## Recent work completed

### Estimate Picker
Tabs implemented:
- Client info tab
- Estimates tab
- Orders tab
- Client notes tab
- File attachments tab

Estimate actions row implemented.

Buttons present:
- Send
- Add Follow Up
- Status (custom dropdown)
- Open

#### Status behaviour
| Status | Pill colour |
|---|---|
| Open | black |
| Order | green |
| Lost | red |

Dropdown menu items are neutral (white background).  
Colour only appears after selection on the pill.

### Follow Ups System
Features implemented:
- ✔ Add follow-up from estimate
- ✔ Follow-ups listed by date
- ✔ Multiple follow-ups per day supported
- ✔ Clicking a follow-up populates the detail pane
- ✔ Email + phone call flags stored
- ✔ Future integration planned with client notes

## UI Behaviour
Estimate list row includes:
- Email
- Follow up
- Estimate status
- Open estimate

Follow-up UI:
- Left panel: Follow-up list
- Bottom panel: Selected follow-up details

## Important Development Rules (MUST be followed)
1) **No manual edits requested from user.**  
   All changes must be delivered as **PowerShell patch scripts**. User runs scripts only.

2) Scripts must always:
   - run from: `PS C:\Github\QuoteSync\web\ps1_patches>`
   - detect web root automatically
   - create backups before modifying files

3) Always create backup before modifying files:
   - Backup location: `C:\Github\QuoteSync\web\_backups`

4) JSX must never be corrupted:
   - `style={ ... }` ❌
   - `style={{ ... }}` ✅  
   PowerShell patches must preserve **double braces**.

5) Never replace files with placeholders.  
   Patches must modify existing code only.

## Architecture Direction
QuoteSync will become:
1) Standalone app
2) WordPress plugin
3) Licensed SaaS
4) SQL backend (future)

## Next Development Phase
### Phase: Data Model Stabilisation
Goals:
1) Lock TypeScript models
2) Remove any usage
3) Centralise models in: `src/models/types.ts`

Then:
- Phase 2: Validation layer
- Phase 3: Database persistence

## Known Safe Baseline
Savepoint created: **2026-03-04**  
Backup location: `C:\Github\QuoteSync\web\_backups` (contains full project zip)

## Files recently edited
Primary:
- `src/features/estimatePicker/EstimatePickerTabs.tsx`

Related:
- `FollowUpsFeature.tsx`
- `EstimatePickerFeature.tsx`
- `App.tsx`

## First step in the new chat
Assistant must:
1) Confirm project state
2) Verify the savepoint
3) Ensure no JSX corruption
4) Continue development safely

## Optional (recommended next improvement)
Refactor `EstimatePickerTabs` and split into:
- `EstimateRowActions.tsx`
- `EstimateStatusDropdown.tsx`
- `EstimateSendModal.tsx`

This prevents the huge file from causing JSX corruption again.

