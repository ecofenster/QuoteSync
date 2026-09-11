# Email supplier-file conflict acceptance

Implemented and technically verified on 11 September 2026. User acceptance remains pending.

The filing picker now checks the exact retained attachment against the selected Estimate → Suppliers → named supplier folder before enabling submission. It distinguishes an attachment already filed from identical bytes and from a matching filename whose content differs or cannot be verified. A potentially revised document is never overwritten: the user explicitly chooses a new revision and QuoteSuite creates a collision-safe filename.

Disposable browser evidence covers immediate “Saving document…” feedback, duplicate-submit protection, a provider failure with safe retry, retained selections, preservation of the prior file, successful revision filing, exact filename/destination and the Open Files / Import Manufacturer Estimate next actions. The run preserved the user-owned API instance and independently verified zero owned browser processes and zero temporary profiles after cleanup.

## Short user checklist

1. In Email, select the intended individual message and choose **Link existing**.
2. Confirm Client, Project, working Estimate, Supplier and the exact retained document.
3. Read **File check**. For a same-name supplier return, choose **Save this attachment as a new revision**; for confirmed identical bytes, choose whether to reuse the existing file.
4. Select **File selected document** once. Confirm progress appears immediately.
5. Confirm the result names the saved/reused filename and exact destination, then use **Open Files** or **Import Manufacturer Estimate**.

Do not use the recycled EF-EST-2026-057 for import review until it has been deliberately restored. This checklist does not authorise automated filing of either live EF-CL-028 message.
