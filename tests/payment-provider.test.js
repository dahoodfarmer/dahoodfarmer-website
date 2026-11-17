import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentProviderConfig, isAllowedPaymentMethod } from '../functions/lib/payment-provider.js';

test('payment configuration fails closed when no provider is selected', () => {
  const config = getPaymentProviderConfig({ DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_METHODS: 'bank_transfer' });
  assert.equal(config.provider, 'none');
  assert.equal(config.paymentsEnabled, false);
  assert.deepEqual(config.methods, []);
});

test('manual bank transfer is only exposed when explicitly enabled', () => {
  const config = getPaymentProviderConfig({
    DHF_PAYMENT_PROVIDER: 'manual',
    DHF_PAYMENTS_ENABLED: 'true',
    DHF_PAYMENT_METHODS: 'bank_transfer'
  });
  assert.equal(config.provider, 'manual');
  assert.equal(config.paymentsEnabled, true);
  assert.deepEqual(config.methods, ['bank_transfer']);
  assert.equal(config.checkoutEnabled, false);
  assert.equal(config.invoicingEnabled, false);
});

test('Stripe and unknown providers are rejected without fallback', () => {
  for (const provider of ['stripe', 'flo', 'unknown']) {
    const config = getPaymentProviderConfig({ DHF_PAYMENT_PROVIDER: provider, DHF_PAYMENTS_ENABLED: 'true' });
    assert.equal(config.provider, 'none');
    assert.equal(config.paymentsEnabled, false);
  }
});

test('only owner-confirmed bank transfer is a supported manual method', () => {
  assert.equal(isAllowedPaymentMethod('bank_transfer'), true);
  assert.equal(isAllowedPaymentMethod('apple_pay'), false);
  assert.equal(isAllowedPaymentMethod('card'), false);
  assert.equal(isAllowedPaymentMethod('ach'), false);
});
