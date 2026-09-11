# Controlled Enquiry-to-Order test journey

The development journey uses canonical QuoteSuite records and the real external Client Portal authorization boundary. It is not staff impersonation and cannot run in production.

## Configuration

Set the values documented in `config/test-journey.example.env` in the development environment, then run:

```powershell
npm run dev:test-journey
```

That command creates a clean temporary database and removes it on exit. For a reusable acceptance workspace whose Clients, Projects, Estimates, files and integration settings survive restarts, run:

```powershell
npm run dev:acceptance
```

The persistent workspace is stored under `.quotesuite-acceptance` and is excluded from Git. It never uses the normal QuoteSuite database. Stop it normally and run the same command later to continue where testing stopped. Delete that folder only when its acceptance history is no longer needed.

To initialise it without starting the application, run `npm run dev:acceptance -- --prepare-only`.

## Gmail and Drive in the persistent workspace

1. Start `npm run dev:acceptance`.
2. Open **Administration → Integrations**.
3. Connect the designated Google test account once, then select dedicated test Enquiries, Estimates and Orders roots. Do not select live customer roots.
4. The OAuth connection and selected Drive folder IDs are encrypted and retained in the isolated acceptance database, so they remain available after a restart.

Gmail and Drive still use the normal provider boundaries. Inbox reads use the connected test mailbox; filing writes only to the selected test Drive roots. External provider notifications remain signals and do not replace canonical reconciliation.

## Controlled test delivery

Keep the values from `config/test-journey.example.env` in the ignored `.env.local` file. Use only designated test mailboxes. Merely configuring the customer and factory addresses does not enable sending.

Delivery remains preview-only while `QUOTESUITE_TEST_DELIVERY_ENABLED=0`. Setting it to `1` is effective only when both allowlisted addresses are present, the application is in test-journey mode, and the user explicitly chooses the reviewed **Send now** action. Any different To, CC or BCC recipient fails closed. Production delivery and customer exposure remain separate acceptance gates.

`QUOTESUITE_TEST_CUSTOMER_EMAIL` and `QUOTESUITE_TEST_FACTORY_EMAIL` are the only permitted recipients while test-journey mode is active. Customer Portal test identity must match the configured customer address. CC/BCC and recipient changes outside the allowlist fail closed.

Delivery remains `preview_only` unless `QUOTESUITE_TEST_DELIVERY_ENABLED=1` is also set. Configured addresses do not enable delivery by themselves. Do not enable delivery until both designated test mailboxes have been supplied and the controlled send is explicitly approved.

When delivery is enabled, staff must also select **Send now to the configured factory test address** on the reviewed supplier-change or factory-Order action. Otherwise QuoteSuite retains a preview draft. Selected canonical Google Drive attachments are read through the existing connected provider boundary at send time; the generated change summary and Order PDF remain immutable managed attachments.

## Entry points

- Staff: QuoteSuite → Client Portal → Client Portal Directory.
- Customer: use the single-use invitation link created for the configured test customer. This opens the separately rendered external Portal and establishes its own HttpOnly Project-scoped session.
- Factory: staff prepares supplier-change and factory-order correspondence inside the Client Portal staff workspace. Returned test documents are linked from canonical Project Files before verification.

## Journey

1. Review a Gmail test message and use **Add Enquiry**.
2. Review Client, Project, brief and selected attachments; qualify the Enquiry.
3. Confirm canonical folders/files, prepare the supplier enquiry and retain the returned manufacturer document.
4. Import/review the working Estimate, open **Review Customer Estimate**, download the unified PDF, then prepare and issue the immutable revision.
5. Open the customer invitation in a separate browser context, review every Position and submit Position/general changes.
6. Staff opens **Changes Requested**, creates the successor revision, prepares the reviewed supplier email with generated change-summary PDF, links the returned revision and records before/after evidence plus any unrelated material changes.
7. Resolve every review item, review and issue the successor Estimate, then use the customer session to accept every Position and the overall Estimate.
8. Staff approves the linked Order, prepares the factory Order with the immutable staff-approved Order PDF, links the returned factory confirmation and verifies every accepted Position.
9. Release the generated Final Confirmation PDF. The customer approves every Position and the overall confirmation, or staff reviews a returned signed PDF against the same exact release.

Email provider delivery and production identity/deployment are separate acceptance gates. Payment, production release and delivery policy are outside this journey.
