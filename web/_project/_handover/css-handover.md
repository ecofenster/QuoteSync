# QuoteSync – CSS Architecture Handover

## 📌 Purpose

This document defines the transition from inline styling to a structured, scalable CSS system across QuoteSync.

It records:

* Current state
* What has been completed
* What needs to be done
* The correct phased implementation order
* Rules governing CSS and structure going forward

---

## ✅ Current State (as of snapshot)

* Project committed and pushed to GitHub (`Pre-CSS-audit snapshot`)
* Styling is predominantly **inline within TSX files**
* `App.tsx` is oversized and contains:

  * UI primitives (Card, Button, Input, etc.)
  * Layout logic
  * Feature rendering
* `index.css` exists but is minimal (reset/base only)
* `App.css` is unused/empty
* Tools (`/features/tools/*`) are self-contained but inline styled
* Admin page exists but branding is **not yet functional**
* Colours are **hardcoded across multiple files**
* No central design/token system exists
* UI primitives are duplicated across multiple files (App, EstimatePicker, Dashboard)

---

## 🎯 Target Architecture

### CSS Structure

```
src/
  styles/
    tokens.css
    base.css
    utilities.css
    ui.css
```

---

### Responsibilities

#### tokens.css

* All design tokens:

  * colours
  * spacing
  * radii
  * typography
  * shadows
* Controlled by Admin/Branding (eventually)

---

#### base.css

* Reset styles
* Root layout
* App shell defaults (safe, non-dynamic only)

---

#### utilities.css

* Layout helpers only:

  * flex/grid
  * spacing helpers
  * alignment
* Must remain lightweight (NOT a dumping ground)

---

#### ui.css

* Shared reusable UI classes:

  * buttons
  * cards
  * inputs
  * pills
  * tables

---

## 🎨 Branding Strategy (CRITICAL)

Branding must NOT be hardcoded anywhere in the project.

### Use CSS variables:

```
--color-brand-primary
--color-brand-on-primary
--color-surface
--color-border
--color-text-primary
--color-text-muted
--color-success
--color-warning
--color-danger
```

---

### Runtime Application

* Values stored via Admin/Branding settings (DB)
* Applied using:

```js
document.documentElement.style.setProperty(...)
```

---

### Rules

* No new hardcoded colours allowed
* All colours must map to tokens
* Tokens must have safe defaults
* Admin branding must override tokens (not replace styling)

---

## 🚧 What Has Been Completed

✔ Codebase committed and stabilised
✔ Tools integration phase established
✔ Glass tool rebuilt (functional baseline)
✔ CSS audit completed (Codex)
✔ Styling issues identified
✔ Migration strategy defined
✔ Structural direction agreed (modularisation over inline growth)

---

## 🧩 What Needs To Be Done

---

### Phase 1 — CSS Foundation (FIRST)

Create:

* `src/styles/tokens.css`
* `src/styles/base.css`
* `src/styles/utilities.css`
* `src/styles/ui.css`

Update:

* `index.css` to import all

⚠️ NO UI/visual changes at this stage

---

### Phase 2 — Tools Migration (LOW RISK)

Convert to local CSS:

* Glass tool
* BS EN tool

Actions:

* move inline styles → component CSS files
* replace colours with tokens
* preserve layout exactly

---

### Phase 3 — Admin Page Migration

Convert:

* `AdminPlaceholderPage.tsx` → CSS file

Actions:

* extract styling
* introduce token-based colours
* prepare for branding integration

---

### Phase 4 — Shared UI Extraction

Create reusable UI classes:

* buttons
* inputs
* cards
* pills
* tables

Then update:

* EstimatePicker
* Dashboard
* shared tabs

---

### Phase 5 — App.tsx Reduction (CRITICAL)

Refactor:

* remove inline styling
* extract UI primitives
* move layout styles to CSS

---

⚠️ STRICT RULES

* DO NOT change sidebar behaviour
* DO NOT change layout structure
* DO NOT introduce visual regressions

---

### Phase 6 — Branding System Activation

Implement:

* Admin → Branding settings
* runtime CSS variable injection

Result:

✔ full theme control from Admin
✔ no hardcoded styling
✔ scalable UI system

---

## ⚠️ Risks

* App.tsx is tightly coupled → high regression risk
* Inline styles are duplicated across files
* No token system currently exists
* Sidebar/layout must remain unchanged
* Dynamic styles must remain inline (only static styles move)

---

## 🚫 DO NOT DO

* Do NOT refactor entire project in one pass
* Do NOT redesign UI during migration
* Do NOT introduce new styling frameworks
* Do NOT modify layout logic early
* Do NOT move dynamic styles blindly into CSS

---

## 🔒 ENFORCED RULES (CRITICAL)

### CSS Tracking Rule

This document MUST be updated after every CSS-related change:

* What was done
* What remains
* Decisions made

---

### App.tsx Control Rule

* App.tsx MUST NOT be added to blindly
* Only modify App.tsx if absolutely required
* New logic/UI MUST go into new files/modules
* App.tsx should become orchestration only

---

### Structure Rule

* Modularisation takes priority over convenience
* New functionality = new file/folder
* Smaller files = easier debugging, patching, and scaling

---

## 📍 Next Step

👉 Run second Codex audit:

* App.tsx reduction
* dead code identification
* duplicate code removal
* folder restructuring

This will define:

* what gets removed
* what gets extracted
* final structure direction

---

## 🧠 End Goal

A system that is:

* scalable
* maintainable
* brand-controlled
* modular
* easy to debug and extend
* aligned with QuoteSync architecture

---

END OF HANDOVER


CSS handover must be updated after every CSS change.

## Update (20260418_124654)

### What was done
- Completed Phase 1 CSS foundation.
- Added `tokens.css`, `base.css`, `utilities.css`, and `ui.css`.
- Completed Tools Phase 2:
  - scaffolded tool-local CSS
  - wired safe static styles into Glass Weight Calculator and BS EN Standards
- Confirmed both tools still render correctly.

### What remains
- Phase 3 — Admin page migration
- Phase 4 — Shared UI extraction
- Phase 5 — App.tsx reduction
- Phase 6 — Branding runtime wiring

### Decisions made
- Ecofenster brand defaults are locked into tokens:
  - black `#231f20`
  - green `#55b948`
  - light green `#b5da9c`
  - white `#ffffff`
- Dynamic styles remain inline.
- Only safe static styles have been migrated so far.
## Update (20260418_130621)
### What was done
- Admin CSS scaffold created
- Admin TSX wired to CSS
- Static styles moved safely

### What remains
- Shared UI primitives
- App.tsx reduction
- Branding runtime wiring

### Decisions
- Maintain layout integrity
- Continue phased extraction only

## 20260418_210116
CSS rollout complete through Estimate Picker

## Update (20260420_105229)

### What was done
- Refreshed CSS handover as part of the maintenance run.
- Recorded the current workflow rule that design is user + ChatGPT led and Codex implements.
- Recorded the list-first / grid-secondary view standard for data-heavy business screens.

### What remains
- Keep future estimate collection styling aligned across client and main-menu contexts.
- Deliver list parity first before introducing grid mode for the shared estimate collection system.
- Continue updating this document after each CSS-related implementation step.

### Decisions made
- No CSS source files were modified in this maintenance-only step.
- Behaviour consistency across views matters more than introducing new visual modes early.