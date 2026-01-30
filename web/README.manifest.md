# QuoteSync Project Manifest (Authoritative)

**Project root:** C:\QuoteSync\web  
**Timezone:** Europe/London

## Baseline (Last Known Good)
- **File:** src/App.tsx
- **Status:** Confirmed running via 
pm run dev
- **Note:** App.tsx was manually overwritten from app.txt and confirmed stable.
- **Baseline backup reference:** App.tsx.before_baseline_lockin_20260130_122110.bak

## Non-Negotiable Safety Rules
1. Backup before every script to: C:\QuoteSync\web\_backups
2. No partial/in-place edits to large files (especially App.tsx). Restore snapshot or full atomic rewrite only.
3. Fail fast: if expected inputs/paths are missing, abort without writing.

## UI Rule (Locked)
- No design/look/style changes unless explicitly requested by user.

## Functional Model (Agreed)
- Clients: Business/Individual. Auto ref: EF-CL-001 (incremental)
- Projects: always belong to a Client
- Estimates: always belong to a Project. Auto ref: EF-EST-YYYY-001. No manual name.
- Orders (future): from accepted estimate. EF-ORD-YYYY-001
- Positions: belong to an Estimate; added within Estimate view

## Reference Source
- Orgadata LogiKal documentation: https://help.orgadata.com/en/documentation/