import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredPaymentDestinations } from '../functions/lib/payment-destinations.js';
import { onRequestGet } from '../functions/api/payment-options.js';

test('only configured official HTTPS PayPal and Venmo destinations are returned', () => {
  const methods = getConfiguredPaymentDestinations({
    DHF_PAYPAL_PAYMENT_URL: 'https://www.paypal.com/paypalme/dhf',
    DHF_VENMO_PAYMENT_URL: 'https://venmo.com/u/dahoodfarmer'
  });
  assert.deepEqual(methods.map(item => item.id), ['paypal', 'venmo']);
  assert.equal(methods[0].url, 'https://www.paypal.com/paypalme/dhf');
});

test('rejects lookalike hosts, non-HTTPS URLs, credentials and unsupported destinations', () => {
  const methods = getConfiguredPaymentDestinations({
    DHF_PAYPAL_PAYMENT_URL: 'https://paypal.com.attacker.example/pay',
    DHF_VENMO_PAYMENT_URL: 'http://venmo.com/u/dhf',
    DHF_CASHAPP_PAYMENT_URL: 'https://cash.app/$dahoodfarmer'
  });
  assert.deepEqual(methods, []);
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_PAYPAL_PAYMENT_URL: 'https://user:pass@paypal.com/pay',
    DHF_VENMO_PAYMENT_URL: 'https://venmo.com:8443/u/dhf'
  }), []);
});

test('public payment-options endpoint returns no-store safe configuration only', async () => {
  const response = await onRequestGet({ env: {
    DHF_PAYPAL_PAYMENT_URL: 'https://paypal.me/dahoodfarmer'
  }});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.methods.length, 1);
  assert.equal(body.methods[0].id, 'paypal');
  assert.equal(body.automatic_confirmation, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
