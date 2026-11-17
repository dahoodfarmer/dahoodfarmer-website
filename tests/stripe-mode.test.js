import test from 'node:test';
import assert from 'node:assert/strict';
import { createStripeInvoiceAdapter } from '../functions/lib/payment-provider.js';

test('test-mode Preview refuses a live Stripe API key before any network request', async () => {
  const adapter = createStripeInvoiceAdapter({
    STRIPE_SECRET_KEY: 'sk_live_placeholder',
    DHF_STRIPE_EXPECT_LIVEMODE: 'false'
  });
  await assert.rejects(adapter.retrieveInvoice('in_test_123'), /test-mode API key required/);
});

test('live-mode environment refuses a test Stripe API key before any network request', async () => {
  const adapter = createStripeInvoiceAdapter({
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    DHF_STRIPE_EXPECT_LIVEMODE: 'true'
  });
  await assert.rejects(adapter.retrieveInvoice('in_test_123'), /live-mode API key required/);
});

test('Stripe adapter rejects unrecognized key prefixes', async () => {
  const adapter = createStripeInvoiceAdapter({
    STRIPE_SECRET_KEY: 'placeholder',
    DHF_STRIPE_EXPECT_LIVEMODE: 'false'
  });
  await assert.rejects(adapter.retrieveInvoice('in_test_123'), /test-mode API key required/);
});
