const normalize = (value) => String(value || '').trim().toLowerCase();

export function createTestDeliveryPolicy(environment = process.env) {
  const enabled = String(environment.QUOTESUITE_TEST_JOURNEY || '') === '1' && String(environment.NODE_ENV || '').toLowerCase() !== 'production';
  const deliveryEnabled = enabled && String(environment.QUOTESUITE_TEST_DELIVERY_ENABLED || '') === '1';
  const customer = normalize(environment.QUOTESUITE_TEST_CUSTOMER_EMAIL);
  const factory = normalize(environment.QUOTESUITE_TEST_FACTORY_EMAIL);
  const allowed = new Set([customer, factory].filter(Boolean));
  return {
    enabled,
    configured: enabled && Boolean(customer && factory),
    customer,
    factory,
    assertRecipient(value, role) {
      if (!deliveryEnabled) throw Object.assign(new Error('Test journey delivery is preview only. Explicitly enable test delivery before sending.'), { status: 409, code: 'test_delivery_disabled' });
      if (!customer || !factory) throw Object.assign(new Error('Configure explicit test customer and factory addresses before sending.'), { status: 409, code: 'test_delivery_addresses_required' });
      const recipient = normalize(value);
      if (!allowed.has(recipient) || (role === 'customer' && recipient !== customer) || (role === 'factory' && recipient !== factory)) throw Object.assign(new Error(`Delivery is restricted to the configured test ${role} address.`), { status: 403, code: 'test_delivery_recipient_blocked' });
      return recipient;
    },
    assertAllRecipients(values) {
      if (!enabled) return values;
      if (!deliveryEnabled) throw Object.assign(new Error('Test journey delivery is preview only. Explicitly enable test delivery before sending.'), { status: 409, code: 'test_delivery_disabled' });
      if (!customer || !factory) throw Object.assign(new Error('Configure explicit test customer and factory addresses before sending.'), { status: 409, code: 'test_delivery_addresses_required' });
      for (const value of values || []) if (!allowed.has(normalize(value))) throw Object.assign(new Error('Test journey delivery is restricted to the configured customer and factory addresses.'), { status: 403, code: 'test_delivery_recipient_blocked' });
      return values;
    },
    publicStatus() { return { enabled, deliveryEnabled, configured: enabled && Boolean(customer && factory), customerConfigured: Boolean(customer), factoryConfigured: Boolean(factory), deliveryMode: deliveryEnabled ? 'test_allowlist' : 'preview_only' }; },
  };
}
