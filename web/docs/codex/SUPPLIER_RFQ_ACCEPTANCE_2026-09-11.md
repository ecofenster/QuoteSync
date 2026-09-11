# Supplier RFQ preparation acceptance

Checkpoint: `0c4ed0f`

## Implemented and technically verified

- A working Estimate exposes **Request supplier quote**.
- The guided dialog shows the exact Client, Project and Estimate context, current Administration suppliers and current canonical Project files.
- The user chooses only the files to attach, reviews the recipient, subject and message, and has one clear primary action.
- Preview-only workspaces save an Email draft and never send. Controlled test delivery remains allowlist-gated.
- Each RFQ keeps an immutable snapshot of the selected provider file IDs, provider revisions/checksums and display paths, plus its RFQ revision lineage.
- Progress appears immediately. Double submission is blocked. Failure keeps all entered values and selection. A partial retry reuses the same Email draft and RFQ command.
- Disposable service and normal-route browser acceptance passed, including injected failure/retry and exact 1 RFQ / 1 Email draft postconditions.
- The browser run removed its exact Chrome process tree and temporary profile and independently reported 0 remaining processes and 0 profiles.

## Short user checklist (not yet accepted)

1. Open a disposable working Estimate and choose **Request supplier quote**.
2. Confirm the Client, Project and Estimate are unmistakable.
3. Select a supplier, recipient and only the intended Project files.
4. Choose **Prepare Email draft** and confirm the result names the supplier, RFQ revision, files and next action.
5. Reopen the action and confirm the previous request is discoverable under **View previous requests**.

Do not enable sending for this checklist. Returned-response matching and Manufacturer Import handoff are the next Package 2 slice and are not accepted by this result.
