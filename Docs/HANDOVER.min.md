# HANDOVER.MIN.md — QuoteSync

**Reset:** Restored to save-point 20260219_130137_full_project.zip  
**Web:** C:\Github\QuoteSync\web (stable; compiles; runs)  
**Docs:** C:\Github\QuoteSync\Docs  
**Rules:** NO manual edits. Run only .ps1 patches from C:\Github\QuoteSync\web\ps1_patches. **No scripts pasted in chat.**

**Requested change ONLY:**
1) Add tabs INSIDE Estimate Picker (Client Info default; Estimates with Open/Lost/Order dropdown; Orders filtered; Notes WYSIWYG + timestamp + user; Files URL + open + uploads).  
2) Add sidebar item **Follow Ups** under Customers after **Client Database**.

**Do NOT:** redesign layout, refactor sidebar structure, change styles, reformat, refactor types broadly, add global helpers beyond necessity.

**Next step:** Upload current src\App.tsx, locate markers for Estimate Picker and Customers sidebar, patch only inside those blocks with safe anchors + backups.

