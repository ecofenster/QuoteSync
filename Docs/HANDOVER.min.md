# QuoteSync – HANDOVER.min.md
**Version:** v0.1.0  
**Last updated:** 2026-02-10 12:42  

## Purpose
This file is the authoritative handover for continuing development of **QuoteSync**, a Logikal-inspired window & door configurator / estimation system for **Ecofenster Ltd**.

It is intentionally compact and checklist-driven to avoid long chat context and ambiguity.

---

## Baseline & Intent
- Product is **conceptually based on Orgadata Logikal**
- Reference documentation: https://help.orgadata.com/en/documentation/
- Current UI / workflow is **experimental and incomplete**
- Accuracy vs Logikal behaviour is a **primary goal**, not styling

---

## Current Technical State
- Framework: React + Vite + TypeScript
- Entry: src/main.tsx → src/App.tsx
- Grid preview logic: components/GridEditor.tsx
- Local root: C:\Github\QuoteSync
- App **currently runs** via 
pm run dev
- Backups + logs folders exist

---

## Workflow (Intended)
1. Create Client + Estimate (single entry point)
2. Supplier & Product Defaults (estimate-level)
3. Add Position
4. Position wizard:
   - Position
   - Dimensions
   - Configuration
5. Repeat positions
6. Summary → Order → Production (future)

---

## CHANGE STATUS CHECKLIST

### Core Structure
- [x] Clients with multiple estimates
- [x] Estimate picker when multiple exist
- [x] Estimate-level defaults screen
- [ ] Client database vs address database separation **(NOT DONE)**

### UI / Navigation
- [ ] Left menu fixed (non-scrolling)
- [ ] Rename “Customers” → **Create Client / Estimate**
- [ ] Single condensed client form with Business toggle
- [ ] Address database moved into client workflow

### References & IDs
- [ ] Estimate ref format  
  **Required:** EF-EST-YYYY-###  
  **Current:** incorrect / partial

### Preview / Geometry
- [ ] Preview drawing realigned to Logikal
- [ ] Screenshot of original Logikal-style preview required
- [ ] Canvas geometry spec to be supplied in text

### Grid / Fields
- [x] Fields auto-split by count
- [ ] Drag to resize divisions
- [ ] Manual numeric control per field
- [ ] Per-field openable types (Tilt & Turn, Turn, Top-hung, etc.)

### Glass
- [ ] Known glass systems:
  - Saint-Gobain
  - Guardian
  - Euroglas
- [ ] Double / Triple / Toughened / Laminated / Obscure
- [ ] Ug & g values derived from glass system

### Bars
- [ ] Astragal bars:
  - 25 / 30 / 35 / 40 mm
  - Slim / wide
  - Ovolo + profiles
- [ ] Spacer bar between glazing bars
- Ref image:  
  https://fire-bird.net/wordpress/wp-content/uploads/2018/09/muntin-profiles-01.jpg

### Position Management
- [x] Add position
- [ ] Edit existing position
- [ ] Duplicate position
- [ ] Re-enter configuration after save

### Defaults Philosophy (IMPORTANT)
- Estimate defaults should be **limited to**:
  - Supplier
  - Product type
  - Product
  - External finish
  - Internal finish
  - Hinges
- All other options must be **per-position only**

---

## Rules for Future Chats / Dev
- **Never rebuild or simplify files without explicit upload**
- If a file is missing → **ASK**
- Prefer **small, focused changes**
- No UI/layout changes unless explicitly requested
- Use logs + backups for every write
- Long scripts should be delivered as files, not chat blobs

---

## Next Immediate Priorities
1. Lock estimate ref format
2. Fix preview drift vs Logikal
3. Editable positions
4. Client database refactor
5. Grid drag-resize

---
END
