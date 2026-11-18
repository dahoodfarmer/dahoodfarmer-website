import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredPaymentDestinations } from '../functions/lib/payment-destinations.js';
import { onRequestGet } from '../functions/api/payment-options.js';

test('only configured official HTTPS Square payment links are returned', () => {
  const methods = getConfiguredPaymentDestinations({
    DHF_SQUARE_PAYMENT_URL: 'https://square.link/u/DHFbusiness'
  });
  assert.deepEqual(methods.map(item => item.id), ['square']);
  assert.equal(methods[0].url, 'https://square.link/u/DHFbusiness');
});

test('rejects lookalike hosts, non-HTTPS URLs, credentials and unsupported destinations', () => {
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_SQUARE_PAYMENT_URL: 'https://square.link.attacker.example/pay'
  }), []);
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_SQUARE_PAYMENT_URL: 'http://square.link/u/dhf'
  }), []);
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_SQUARE_PAYMENT_URL: 'https://user:pass@square.link/u/dhf'
  }), []);
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_SQUARE_PAYMENT_URL: 'https://square.link:8443/u/dhf'
  }), []);
  assert.deepEqual(getConfiguredPaymentDestinations({
    DHF_PAYPAL_PAYMENT_URL: 'https://paypal.me/dahoodfarmer',
    DHF_VENMO_PAYMENT_URL: 'https://venmo.com/u/dahoodfarmer',
    DHF_CASH_APP_BUSINESS_URL: 'https://cash.app/$dahoodfarmer'
  }), []);
});

test('public payment-options endpoint fails closed when either payment switch is off', async () => {
  const response = await onRequestGet({ env: {
    DHF_SQUARE_PAYMENT_URL: 'https://square.link/u/DHFbusiness',
    DHF_PAYMENTS_ENABLED: 'false',
    DHF_SQUARE_PAYMENT_LINKS_ENABLED: 'true'
  }});
  const body = await response.json();
  assert.deepEqual(body.methods, []);
  assert.equal(body.payment_status, 'disabled');
});

test('public payment-options endpoint returns no-store safe configuration only', async () => {
  const response = await onRequestGet({ env: {
    DHF_SQUARE_PAYMENT_URL: 'https://checkout.square.site/DHFbusiness',
    DHF_PAYMENTS_ENABLED: 'true',
    DHF_SQUARE_PAYMENT_LINKS_ENABLED: 'true'
  }});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.methods.length, 1);
  assert.equal(body.methods[0].id, 'square');
  assert.equal(body.automatic_confirmation, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
