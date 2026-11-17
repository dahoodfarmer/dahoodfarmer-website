import test from 'node:test';
import assert from 'node:assert/strict';
import { sendReceiptEmail } from '../functions/lib/receipt-email.js';

function db(changes = 1) {
  const calls = [];
  return { calls, prepare(sql) { return { bind(...values) { return { async run() { calls.push({ sql, values }); return { meta: { changes } }; } }; } }; } };
}
const receipt = { invoice_id: 'inv-1', receipt_id: 'DHF-20261117-ABCDEF12', recipient_email: 'buyer@example.com', amount_cents: 50000, receipt_url: '/receipt/opaque-token' };

test('does not send receipt email unless the owner enables the email gate', async () => {
  const DB = db();
  const oldFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not send'); };
  try {
    const result = await sendReceiptEmail({ DB, env: { RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'receipts@example.com' }, receipt });
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'disabled');
    assert.equal(called, false);
    assert.equal(DB.calls.length, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test('sends one branded receipt email only after explicit enablement', async () => {
  const DB = db();
  const oldFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ id: 'email_test_1' }), { status: 200 });
  };
  try {
    const result = await sendReceiptEmail({ DB, env: { DHF_RECEIPT_EMAIL_ENABLED: 'true', RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'receipts@example.com', PUBLIC_SITE_URL: 'https://dahoodfarmer.com' }, receipt });
    assert.equal(result.sent, true);
    assert.equal(result.id, 'email_test_1');
    assert.equal(request.url, 'https://api.resend.com/emails');
    const body = JSON.parse(request.init.body);
    assert.deepEqual(body.to, ['buyer@example.com']);
    assert.match(body.html, /https:\/\/dahoodfarmer\.com\/receipt\/opaque-token/);
    assert.ok(DB.calls.some(call => /SET email_status = 'sent'/.test(call.sql)));
  } finally { globalThis.fetch = oldFetch; }
});

test('does not send a duplicate when another request has already claimed the email', async () => {
  const DB = db(0);
  const oldFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not send'); };
  try {
    const result = await sendReceiptEmail({ DB, env: { DHF_RECEIPT_EMAIL_ENABLED: 'true', RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'receipts@example.com' }, receipt });
    assert.equal(result.reason, 'already_sent_or_pending');
    assert.equal(called, false);
  } finally { globalThis.fetch = oldFetch; }
});
