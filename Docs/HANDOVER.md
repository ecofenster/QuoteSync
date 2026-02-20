# QuoteSync — Handover (Clean Reset State)

**Date:** 19 Feb 2026  
**Project:** QuoteSync  
**Repo root:** C:\Github\QuoteSync  
**Web app location:** C:\Github\QuoteSync\web  
**Docs location:** C:\Github\QuoteSync\Docs  
**Stack:** React + Vite + TypeScript  
**Shell:** PowerShell 7 (pwsh)  
**User rule:** **NO manual edits.** Only .ps1 patches run from C:\Github\QuoteSync\web\ps1_patches.

---

## 1) Current Status (after full reset)

- Project restored from save point: 20260219_130137_full_project.zip
- System compiles and runs.
- Baseline is clean and stable.
- No experimental tab logic present.
- No “Follow Ups” menu item present.
- Estimate Picker currently shows:
  - Client contact information
  - Existing estimates list
  - Back / New Estimate buttons

---

## 2) Original Request (must not drift)

**Scope is ONLY:**
1) Inside the **Estimate Picker** view, add tabs along the top (Estimate Picker only).  
2) Add a **Follow Ups** item under **Customers** sidebar, directly after **Client Database**.

**No other UI/structure changes permitted:**
- No layout redesign
- No sidebar refactor
- No style changes
- No reformatting
- No unrelated type refactors
- No global helper refactors
- No changing unrelated keys/IDs

---

## 3) Required Tabs (Estimate Picker only)

### Tab 1 — Client Info (default landing tab)
- Shows all client information (current content exactly as-is).

### Tab 2 — Estimates
- Lists all estimates.
- For each estimate, provide a dropdown:
  - Open
  - Lost
  - Order
- Selecting **Order** marks the estimate accordingly.

### Tab 3 — Orders
- Shows only estimates marked **Order**.

### Tab 4 — Client Notes
- WYSIWYG comment area.
- Each note:
  - Timestamped
  - Shows which user added it

### Tab 5 — Files
- Field for URL (SharePoint/Drive/OneDrive/local path)
- Button to open link
- Allowed uploads (metadata capture is acceptable initially):
  - dwg
  - excel
  - word
  - pdf
  - sketchup
  - etc.

---

## 4) Additional Sidebar Change

Under **Customers**, after:
- Client Database

Add:
- **Follow Ups**

Nothing else.

---

## 5) What went wrong previously (do not repeat)

- MenuKey modified unnecessarily / too broadly.
- Sidebar matching brittle.
- JSX blocks inserted inside open expressions.
- Partial type injections caused compounding edits.
- Multiple patches refactored beyond scope.
- UI changed beyond request.

This has been reset. We are back to a clean baseline.

---

## 6) Operational Rules (locked)

### 6.1 No scripts pasted in chat (MANDATORY)
- **No PowerShell scripts are to be pasted into chat.**
- All patches must be supplied as a downloadable .ps1 file.
- User downloads the .ps1 into:
  - C:\Github\QuoteSync\web\ps1_patches
- User runs the script from that directory only.

I must always provide:
- Run directory
- Unblock command
- Run command

Example:
`
Run from:
PS C:\Github\QuoteSync\web\ps1_patches>

Unblock:
Unblock-File .\YYYYMMDD_patch_name.ps1

Run:
pwsh .\YYYYMMDD_patch_name.ps1
`

### 6.2 Patch discipline (MANDATORY)
Every patch script must:
- Resolve the correct working directory automatically
- Create timestamped backups before edits
- Fail if anchors are ambiguous
- Never introduce placeholder text
- Avoid touching unrelated code/typing/layout

---

## 7) Next-step procedure (for the next chat)

**Before writing any patch:**
1) Ensure we have the current src\App.tsx (upload it if needed).
2) Identify exact safe markers:
   - Estimate Picker block markers
   - Customers sidebar block anchors
3) Design patch anchored strictly to those blocks only.
4) Keep changes minimal and isolated.

---

## 8) Strategic roadmap (context only; not part of this patch)
QuoteSync will become:
- WordPress plugin
- Standalone app
- Licensed SaaS
- Eventually SQL-backed

Immediate next work after UI patch:
- Lock data models properly
- Add validation

