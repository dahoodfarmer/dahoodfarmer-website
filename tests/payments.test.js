import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as createSession } from '../functions/api/payments/create-session.js';
import { onRequestPost as receiveWebhook } from '../functions/api/payments/webhook.js';
import { onRequestGet as getPaymentStatus } from '../functions/api/payments/status.js';

const previewOrigin = 'https://feature-dhf-payment-engine-f.dahoodfarmer-website.pages.dev';

function makePaymentsDb(options = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              calls.push({ kind: 'run', sql, values });
              if (options.failRun) throw new Error('D1 unavailable');
              return { meta: { changes: 1 } };
            },
            async first() {
              calls.push({ kind: 'first', sql, values });
              if (options.failFirst) throw new Error('D1 unavailable');
              return options.order || { order_id: 'order-1', amount: 2500, currency: 'usd', status: 'pending' };
            }
          };
        }
      };
    }
  };
}

function makeEnv(options = {}) {
  return {
    STRIPE_SECRET_KEY: options.secret ?? 'sk_test_mock',
    STRIPE_PUBLISHABLE_KEY: options.publishable ?? 'pk_test_mock',
    STRIPE_WEBHOOK_SECRET: options.webhookSecret ?? 'whsec_mock',
    PAYMENTS_DB: options.db === false ? null : (options.db || makePaymentsDb()),
    SESSIONS: options.kv || {
      async get() { return null; },
      async put() {}
    }
  };
}

function paymentRequest(data, origin = previewOrigin, host = previewOrigin) {
  return new Request(host + '/api/payments/create-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'CF-Connecting-IP': '198.51.100.10'
    },
    body: JSON.stringify(data)
  });
}

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await callback(); }
  finally { globalThis.fetch = original; }
}

async function stripeSignature(payload, secret = 'whsec_mock') {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp + '.' + payload));
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return 't=' + timestamp + ',v1=' + hex;
}

test('payment checkout fails closed when Stripe keys are not configured', async () => {
  const env = makeEnv({ secret: '', publishable: '' });
  const response = await createSession({ request: paymentRequest({ amount: 2500, purpose: 'support' }), env });
  assert.equal(response.status, 503);
  assert.equal(env.PAYMENTS_DB.calls.length, 0);
});

test('payment checkout rejects amounts outside the allowed support range', async () => {
  const env = makeEnv();
  const low = await createSession({ request: paymentRequest({ amount: 99, purpose: 'support' }), env });
  const high = await createSession({ request: paymentRequest({ amount: 1000001, purpose: 'support' }), env });
  assert.equal(low.status, 422);
  assert.equal(high.status, 422);
  assert.equal(env.PAYMENTS_DB.calls.length, 0);
});

test('payment checkout does not allow product, service or invoice amounts from the browser', async () => {
  const env = makeEnv();
  for (const purpose of ['product', 'service', 'invoice']) {
    const response = await createSession({ request: paymentRequest({ amount: 2500, purpose }), env });
    assert.equal(response.status, 422);
  }
  assert.equal(env.PAYMENTS_DB.calls.length, 0);
});

test('payment checkout rejects cross-origin requests before contacting Stripe', async () => {
  const env = makeEnv();
  await withFetch(async () => { throw new Error('Stripe must not be called'); }, async () => {
    const response = await createSession({ request: paymentRequest({ amount: 2500, purpose: 'support' }, 'https://attacker.example'), env });
    assert.equal(response.status, 403);
  });
  assert.equal(env.PAYMENTS_DB.calls.length, 0);
});

test('payment checkout rejects unauthorized hostnames', async () => {
  const env = makeEnv();
  await withFetch(async () => { throw new Error('Stripe must not be called'); }, async () => {
    const response = await createSession({ request: paymentRequest({ amount: 2500, purpose: 'support' }, 'https://evil.example', 'https://evil.example') , env });
    assert.equal(response.status, 400);
  });
  assert.equal(env.PAYMENTS_DB.calls.length, 0);
});

test('successful support checkout uses the server-validated amount and stores a pending order', async () => {
  const db = makePaymentsDb();
  const env = makeEnv({ db });
  let stripeBody;
  let stripeHeaders;
  const response = await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    stripeBody = new URLSearchParams(init.body);
    stripeHeaders = init.headers;
    return new Response(JSON.stringify({ id: 'cs_test_abc123', client_secret: 'cs_test_abc123_secret_mock' }), { status: 200 });
  }, () => createSession({ request: paymentRequest({ amount: 2500, purpose: 'support', description: 'Founding support', email: 'buyer@example.com' }), env }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.clientSecret, 'cs_test_abc123_secret_mock');
  assert.equal(body.publishableKey, 'pk_test_mock');
  assert.ok(body.orderId);
  assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '2500');
  assert.equal(stripeBody.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(stripeBody.get('metadata[order_id]'), body.orderId);
  assert.equal(stripeBody.get('customer_email'), 'buyer@example.com');
  assert.equal(stripeHeaders['Idempotency-Key'], body.orderId);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO dhf_payment_orders/);
  assert.equal(db.calls[0].values[0], body.orderId);
  assert.equal(db.calls[0].values[4], 2500);
});

test('Stripe failure does not create a payment order', async () => {
  const db = makePaymentsDb();
  const env = makeEnv({ db });
  const response = await withFetch(async () => new Response(JSON.stringify({ error: { type: 'card_error' } }), { status: 400 }), () =>
    createSession({ request: paymentRequest({ amount: 2500, purpose: 'support' }), env }));
  assert.equal(response.status, 502);
  assert.equal(db.calls.length, 0);
});

test('failed order persistence expires the orphaned Stripe session', async () => {
  const db = makePaymentsDb({ failRun: true });
  const env = makeEnv({ db });
  const calls = [];
  const response = await withFetch(async (url, init) => {
    calls.push({ url, method: init?.method || 'GET' });
    if (url === 'https://api.stripe.com/v1/checkout/sessions') {
      return new Response(JSON.stringify({ id: 'cs_test_orphan', client_secret: 'secret' }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'cs_test_orphan', status: 'expired' }), { status: 200 });
  }, () => createSession({ request: paymentRequest({ amount: 2500, purpose: 'support' }), env }));
  assert.equal(response.status, 500);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /cs_test_orphan\/expire$/);
});

test('webhook rejects invalid signatures before touching payment records', async () => {
  const db = makePaymentsDb();
  const request = new Request(previewOrigin + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': 't=1,v1=bad' },
    body: JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed', data: { object: { id: 'cs_test_abc123' } } })
  });
  const response = await receiveWebhook({ request, env: makeEnv({ db }) });
  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 0);
});

test('webhook reconciles order metadata and amount before marking an order paid', async () => {
  const db = makePaymentsDb();
  const event = {
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_test_abc123',
      payment_status: 'paid',
      metadata: { order_id: 'order-1' },
      amount_total: 2500,
      currency: 'usd',
      customer_details: { email: 'buyer@example.com' }
    } }
  };
  const payload = JSON.stringify(event);
  const signature = await stripeSignature(payload);
  const request = new Request(previewOrigin + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': signature },
    body: payload
  });
  const response = await receiveWebhook({ request, env: makeEnv({ db }) });
  assert.equal(response.status, 200);
  assert.ok(db.calls.some(c => /INSERT OR IGNORE INTO dhf_payment_events/.test(c.sql)));
  assert.ok(db.calls.some(c => /UPDATE dhf_payment_orders SET status = \?/.test(c.sql) && c.values[0] === 'paid'));
});

test('webhook rejects mismatched order metadata without updating payment status', async () => {
  const db = makePaymentsDb();
  const event = {
    id: 'evt_test_456',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_test_abc123',
      payment_status: 'paid',
      metadata: { order_id: 'different-order' },
      amount_total: 2500,
      currency: 'usd'
    } }
  };
  const payload = JSON.stringify(event);
  const request = new Request(previewOrigin + '/api/payments/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': await stripeSignature(payload) },
    body: payload
  });
  const response = await receiveWebhook({ request, env: makeEnv({ db }) });
  assert.equal(response.status, 400);
  assert.equal(db.calls.filter(c => c.kind === 'run').length, 0);
});

test('payment status rejects malformed Stripe session IDs', async () => {
  const db = makePaymentsDb();
  const request = new Request(previewOrigin + '/api/payments/status?session_id=bad');
  const response = await getPaymentStatus({ request, env: makeEnv({ db }) });
  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 0);
});

test('payment status reconciles a paid Stripe session against the stored order', async () => {
  const db = makePaymentsDb();
  const env = makeEnv({ db });
  const response = await withFetch(async () => new Response(JSON.stringify({
    id: 'cs_test_abc123',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 2500,
    currency: 'usd',
    metadata: { order_id: 'order-1' }
  }), { status: 200 }), () => getPaymentStatus({
    request: new Request(previewOrigin + '/api/payments/status?session_id=cs_test_abc123'),
    env
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'paid');
  assert.equal(body.orderId, 'order-1');
  assert.ok(db.calls.some(c => c.kind === 'run' && /UPDATE dhf_payment_orders/.test(c.sql)));
});

test('payment status refuses a Stripe session whose amount does not match the stored order', async () => {
  const db = makePaymentsDb();
  const response = await withFetch(async () => new Response(JSON.stringify({
    id: 'cs_test_abc123',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 9999,
    currency: 'usd',
    metadata: { order_id: 'order-1' }
  }), { status: 200 }), () => getPaymentStatus({
    request: new Request(previewOrigin + '/api/payments/status?session_id=cs_test_abc123'),
    env: makeEnv({ db })
  }));
  assert.equal(response.status, 409);
  assert.equal(db.calls.filter(c => c.kind === 'run').length, 0);
});
