# Customer Estimate issue and recovery acceptance

Implementation checkpoint: `04d0864`

## Technically verified

- **Download PDF** shows its own immediate progress and confirms the filename, size and that no Email was sent.
- **Send to Client** first prepares one retained PDF and Email draft. The result plainly says nothing was sent.
- **Send Estimate** prevents duplicate submission. A provider failure preserves the PDF, draft and edited fields and explains that retry is safe.
- Provider-confirmed success records one issued quotation, immutable customer release, `quotation.issued` event and three-day Follow Up.
- A changed second preparation for an already-issued Estimate revision is rejected before any provider call. An exact retry reuses the issued evidence.
- Disposable normal-route browser verification passed without external delivery. Exact owned Chrome cleanup reported zero processes and zero profiles.
- The live workspace cover photograph is present as tenant-owned branding data. EF-EST-2026-055 previously passed read-only preview/PDF checks for Ty Clai, corrected product assets, theme-independent headings, omitted contaminated decoration and removed internal wording.

## Short user checklist (not yet accepted)

1. Open EF-EST-2026-055 and choose **Review Customer Quotation**.
2. Confirm Ty Clai, the full-page cover photograph, readable headings, corrected Ecotherm/Europa images and no decorative scenery mock-up.
3. Choose **Download PDF** and confirm the result says it was downloaded but not issued or Emailed.
4. In a disposable Estimate, choose **Send to Client** and confirm the Email is clearly prepared but not sent.
5. Do not send until a separately authorised controlled test-address run. When that run is authorised, confirm success names the recipient and next Follow Up.

Terms, exclusions and validity are the next implementation slice. This checkpoint is not user acceptance and did not send a live Email.
