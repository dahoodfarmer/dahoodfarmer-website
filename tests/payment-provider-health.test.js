import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/admin/payment-provider-health.js';

test('refuses to use a live or unrecognized Stripe key for Preview diagnostics', async () => {
  const oldFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not call provider'); };
  try {
    const response = await onRequestGet({ env: { STRIPE_SECRET_KEY: 'sk_live_placeholder', DHF_STRIPE_EXPECT_LIVEMODE: 'false' } });
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally { globalThis.fetch = oldFetch; }
});

test('performs a read-only account request with a test key and returns no credential material', async () => {
  const oldFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({
      id: 'acct_test_hidden',
      country: 'US',
      default_currency: 'usd',
      details_submitted: true,
      charges_enabled: false,
      payouts_enabled: false
    }), { status: 200 });
  };
  try {
    const response = await onRequestGet({ env: { STRIPE_SECRET_KEY: 'sk_test_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_placeholder' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(request.url, 'https://api.stripe.com/v1/account');
    assert.equal(request.init.method, 'GET');
    assert.equal(body.authenticated, true);
    assert.equal(body.mode, 'test');
    assert.equal(body.account_country, 'US');
    assert.equal(body.charges_enabled, false);
    assert.equal(body.payouts_enabled, false);
    assert.equal(JSON.stringify(body).includes('sk_test_placeholder'), false);
    assert.equal(JSON.stringify(body).includes('whsec_placeholder'), false);
    assert.equal(JSON.stringify(body).includes('acct_test_hidden'), false);
  } finally { globalThis.fetch = oldFetch; }
});

test('reports missing test-mode credentials without attempting an external request', async () => {
  const oldFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not call provider'); };
  try {
    const response = await onRequestGet({ env: {} });
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally { globalThis.fetch = oldFetch; }
});

test('reports provider authentication failures without exposing provider response details', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'secret diagnostic detail' } }), { status: 401 });
  try {
    const response = await onRequestGet({ env: { STRIPE_SECRET_KEY: 'sk_test_placeholder' } });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.authenticated, false);
    assert.equal(JSON.stringify(body).includes('secret diagnostic detail'), false);
  } finally { globalThis.fetch = oldFetch; }
});
