import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentProviderConfig, resolvePaymentProvider, isAllowedPaymentMethod } from '../functions/lib/payment-provider.js';

test('payment configuration fails closed when no provider is selected', () => {
  const config = getPaymentProviderConfig({ DHF_PAYMENTS_ENABLED: 'true', DHF_INVOICING_ENABLED: 'true', DHF_PAYMENT_METHODS: 'card,apple_pay' });
  assert.equal(config.provider, 'none');
  assert.equal(config.paymentsEnabled, false);
  assert.deepEqual(config.methods, []);
});

test('payment methods remain disabled unless the owner enables a recognized provider', () => {
  const config = getPaymentProviderConfig({ DHF_PAYMENT_PROVIDER: 'stripe', DHF_PAYMENT_METHODS: 'card,apple_pay,ach,unknown', DHF_INVOICING_ENABLED: 'true' });
  assert.equal(config.provider, 'stripe');
  assert.equal(config.paymentsEnabled, false);
  assert.equal(config.invoicingEnabled, false);
  assert.deepEqual(config.methods, []);
});

test('enabled provider exposes only explicitly configured supported methods', () => {
  const config = getPaymentProviderConfig({ DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_PROVIDER: 'stripe', DHF_PAYMENT_METHODS: 'card,apple_pay,ach,unknown', DHF_INVOICING_ENABLED: 'true' });
  assert.equal(config.paymentsEnabled, true);
  assert.equal(config.invoicingEnabled, true);
  assert.deepEqual(config.methods, ['card', 'apple_pay', 'ach']);
});

test('unknown providers fail closed instead of falling back to Stripe', () => {
  const config = getPaymentProviderConfig({ DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_PROVIDER: 'some_gateway', DHF_PAYMENT_METHODS: 'card' });
  assert.equal(config.provider, 'none');
  assert.equal(config.paymentsEnabled, false);
});

test('provider adapter must implement the complete server-side contract', () => {
  const env = { DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_PROVIDER: 'flo' };
  assert.equal(resolvePaymentProvider(env, { flo: { createInvoice() {} } }), null);
  const adapter = { createInvoice() {}, retrieveInvoice() {}, verifyWebhook() {} };
  assert.equal(resolvePaymentProvider(env, { flo: adapter }), adapter);
});

test('supported payment method allowlist is explicit', () => {
  assert.equal(isAllowedPaymentMethod('apple_pay'), true);
  assert.equal(isAllowedPaymentMethod('card'), true);
  assert.equal(isAllowedPaymentMethod('ach'), true);
  assert.equal(isAllowedPaymentMethod('bank_transfer'), true);
  assert.equal(isAllowedPaymentMethod('cash_app'), false);
});
