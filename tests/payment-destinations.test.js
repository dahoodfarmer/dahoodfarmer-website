import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredPaymentDestinations } from '../functions/lib/payment-destinations.js';
import { onRequestGet } from '../functions/api/payment-options.js';

test('no third-party payment destinations are exposed, even if stale provider variables exist', () => {
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_SQUARE_PAYMENT_URL: 'https://square.link/u/DHFbusiness',
    DHF_PAYPAL_PAYMENT_URL: 'https://paypal.me/dahoodfarmer',
    DHF_VENMO_PAYMENT_URL: 'https://venmo.com/u/dahoodfarmer'
  }), []);
});

test('public payment-options endpoint always fails closed until owner-approved direct bank instructions exist', async () => {
  const response = await onRequestGet({ env: {
    DHF_PAYMENTS_ENABLED: 'true',
    DHF_PAYMENT_PROVIDER: 'square',
    DHF_SQUARE_PAYMENT_LINKS_ENABLED: 'true',
    DHF_SQUARE_PAYMENT_URL: 'https://square.link/u/DHFbusiness'
  }});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.methods, []);
  assert.equal(body.payment_status, 'disabled');
  assert.equal(body.payment_model, 'direct_bank_transfer_pending_owner_setup');
  assert.equal(body.automatic_confirmation, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
