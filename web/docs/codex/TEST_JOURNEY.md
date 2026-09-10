# Controlled Enquiry-to-Order test journey

The development journey uses canonical QuoteSuite records and the real external Client Portal authorization boundary. It is not staff impersonation and cannot run in production.

## Configuration

Set the values documented in `config/test-journey.example.env` in the development environment, then run:

```powershell
npm run dev:test-journey
```

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
