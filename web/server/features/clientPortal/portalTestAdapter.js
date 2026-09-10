import { createHash } from 'node:crypto';
import { createTestDeliveryPolicy } from '../lifecycle/testDeliveryPolicy.js';

export function createPortalTestAdapter(environment = process.env) {
  const delivery = createTestDeliveryPolicy(environment);
  const configured = delivery.enabled && Boolean(delivery.customer && delivery.factory);
  const customerOnly = (value) => {
    const email = String(value || '').trim().toLowerCase();
    if (!configured) throw Object.assign(new Error('The portal test adapter requires both configured test addresses.'), { status: 503, code: 'portal_test_adapter_not_configured' });
    if (email !== delivery.customer) throw Object.assign(new Error('Portal test access is restricted to the configured test customer address.'), { status: 403, code: 'test_delivery_recipient_blocked' });
    return email;
  };
  return {
    enabled: configured,
    cookieSecure: false,
    validateInvitationEmail(email) { return customerOnly(email); },
    async verify(assertion, context) {
      const email = customerOnly(assertion?.email);
      if (email !== String(context.expectedEmail || '').trim().toLowerCase()) throw Object.assign(new Error('Test identity does not match the invited contact.'), { status: 403, code: 'portal_identity_email_mismatch' });
      return { provider: 'quotesuite_test_adapter', subject: createHash('sha256').update(`quotesuite-test:${email}`).digest('hex'), email };
    },
  };
}
