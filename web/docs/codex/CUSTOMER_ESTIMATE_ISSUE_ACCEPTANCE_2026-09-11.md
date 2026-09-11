# Customer Estimate issue and recovery acceptance

Implementation checkpoint: `04d0864`

Terms checkpoint: `6f01660`

Lifecycle checkpoint: `d896615`

## Technically verified

- **Download PDF** shows its own immediate progress and confirms the filename, size and that no Email was sent.
- **Send to Client** first prepares one retained PDF and Email draft. The result plainly says nothing was sent.
- **Send Estimate** prevents duplicate submission. A provider failure preserves the PDF, draft and edited fields and explains that retry is safe.
- Provider-confirmed success records one issued quotation, immutable customer release, `quotation.issued` event and three-day Follow Up.
- A changed second preparation for an already-issued Estimate revision is rejected before any provider call. An exact retry reuses the issued evidence.
- Disposable normal-route browser verification passed without external delivery. Exact owned Chrome cleanup reported zero processes and zero profiles.
- The live workspace cover photograph is present as tenant-owned branding data. EF-EST-2026-055 previously passed read-only preview/PDF checks for Ty Clai, corrected product assets, theme-independent headings, omitted contaminated decoration and removed internal wording.
- Validity, terms and exclusions are reviewed once for the working Estimate. The same wording appears in preview/server PDF and is frozen into issued evidence. Changed wording invalidates an older prepared Email before any provider call.
- Reopening an issued Estimate shows its current issued, superseded or withdrawn state. A newer issued revision automatically supersedes the earlier offer while keeping both immutable PDFs and releases.
- Withdraw Estimate requires an explicit reason, shows immediate progress, prevents duplicate submission and retains the issued PDF, Email, Portal release and history. Accepted offers cannot be withdrawn through this control.
- Superseded offers remain customer-readable history but reject new customer actions. Withdrawn offers remain visible to staff and are excluded from external Portal view, document download, review and acceptance.

## Short user checklist (not yet accepted)

1. Open EF-EST-2026-055 and choose **Review Customer Quotation**.
2. Confirm Ty Clai, the full-page cover photograph, readable headings, corrected Ecotherm/Europa images and no decorative scenery mock-up.
3. Choose **Review terms**, confirm the validity period, terms and exclusions, and verify the same wording appears in the Estimate Summary.
4. Choose **Download PDF** and confirm the result says it was downloaded but not issued or Emailed; verify the PDF contains the reviewed wording.
5. In a disposable Estimate, choose **Send to Client** and confirm the Email is clearly prepared but not sent.
6. Reopen an issued disposable Estimate and confirm the issued state, locked terms, issued PDF link and Follow Up are clear.
7. In disposable data only, choose **Withdraw Estimate**, read the consequence, enter a reason and confirm. Verify the issued evidence still opens and the result explains that a new revision is the next action.
8. Do not send until a separately authorised controlled test-address run. When that run is authorised, confirm success names the recipient and next Follow Up.

This checkpoint is not user acceptance and did not send a live Email. Generic configured drawing coverage remains the separate Package 3 gap shared with Package 7.
