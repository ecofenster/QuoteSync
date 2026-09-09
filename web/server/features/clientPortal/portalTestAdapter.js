import { createHash } from 'node:crypto';
import { createTestDeliveryPolicy } from '../lifecycle/testDeliveryPolicy.js';

export function createPortalTestAdapter(environment = process.env) {
  const delivery = createTestDeliveryPolicy(environment);
  return {
    enabled: delivery.configured,
    cookieSecure: false,
    validateInvitationEmail(email) { return delivery.assertRecipient(email, 'customer'); },
    async verify(assertion, context) {
      if (!delivery.configured) throw Object.assign(new Error('The portal test adapter requires both configured test addresses.'), { status: 503, code: 'portal_test_adapter_not_configured' });
      const email = String(assertion?.email || '').trim().toLowerCase();
      delivery.assertRecipient(email, 'customer');
      if (email !== String(context.expectedEmail || '').trim().toLowerCase()) throw Object.assign(new Error('Test identity does not match the invited contact.'), { status: 403, code: 'portal_identity_email_mismatch' });
      return { provider: 'quotesuite_test_adapter', subject: createHash('sha256').update(`quotesuite-test:${email}`).digest('hex'), email };
    },
  };
}
