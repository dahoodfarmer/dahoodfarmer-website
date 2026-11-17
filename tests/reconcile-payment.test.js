import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/admin/reconcile-payment.js';

const tokenSecret = 'preview-only-test-secret-at-least-32-characters';
function req(body, origin = 'https://preview.example') {
  return new Request('https://preview.example/api/admin/reconcile-payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body)
  });
}
function db(initialStatus = 'issued') {
  const calls = [];
  let invoiceStatus = initialStatus;
  let providerId = 'unconfigured';
  let receipt = null;
  const invoice = {
    invoice_id: 'invoice-123', partnership_id: 7, amount_cents: 125000, currency: 'usd',
    status: initialStatus, provider_id: providerId, recipient_name: 'Buyer',
    recipient_email: 'buyer@example.com', business_name: 'Example Company',
    description: 'Corporate sponsorship'
  };
  return {
    calls,
    prepare(sql) {
      return { bind(...values) {
        return {
          async first() {
            calls.push({ kind: 'first', sql, values });
            if (/FROM sponsor_invoices i/.test(sql)) return { ...invoice, status: invoiceStatus, provider_id: providerId };
            if (/JOIN sponsor_partnerships/.test(sql)) return invoice;
            if (/FROM payment_receipts/.test(sql)) return receipt;
            return null;
          },
          async run() {
            calls.push({ kind: 'run', sql, values });
            if (/UPDATE sponsor_invoices SET status = 'paid'/.test(sql)) { invoiceStatus = 'paid'; providerId = 'manual'; }
            if (/INSERT OR IGNORE INTO payment_receipts/.test(sql)) {
              receipt = { receipt_id: values[0], invoice_id: values[1], recipient_email: values[5], amount_cents: values[8], currency: values[9], paid_at: values[13], email_status: 'not_configured' };
            }
            return { meta: { changes: 1 } };
          }
        };
      }};
    }
  };
}
const base = {
  invoice_id: 'invoice-123', amount_cents: 125000, payment_method: 'bank_transfer',
  payment_reference: 'BANK-REF-2026-001', cleared_funds_confirmed: true
};

test('requires explicit owner confirmation of cleared funds', async () => {
  const DB = db();
  const response = await onRequestPost({ request: req({ ...base, cleared_funds_confirmed: false }), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret } });
  assert.equal(response.status, 422);
  assert.equal(DB.calls.some(call => /UPDATE sponsor_invoices SET status = 'paid'/.test(call.sql)), false);
});

test('rejects an amount that does not exactly match the invoice', async () => {
  const DB = db();
  const response = await onRequestPost({ request: req({ ...base, amount_cents: 125001 }), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret } });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.some(call => /UPDATE sponsor_invoices SET status = 'paid'/.test(call.sql)), false);
});

test('records verified bank transfer and creates one customer receipt', async () => {
  const DB = db();
  const response = await onRequestPost({ request: req(base), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret, DHF_RECEIPT_EMAIL_ENABLED: 'false' } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.payment_status, 'paid');
  assert.match(body.receipt_id, /^DHF-/);
  assert.match(body.receipt_url, /^\/receipt\/[A-Za-z0-9_-]{40,64}$/);
  assert.ok(DB.calls.some(call => /UPDATE sponsor_invoices SET status = 'paid'/.test(call.sql)));
  assert.ok(DB.calls.some(call => /INSERT OR IGNORE INTO payment_receipts/.test(call.sql)));
  assert.ok(DB.calls.some(call => /UPDATE sponsor_partnerships SET payment_status = 'paid'/.test(call.sql)));
});

test('rejects cross-origin reconciliation requests', async () => {
  const DB = db();
  const response = await onRequestPost({ request: req(base, 'https://attacker.example'), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret } });
  assert.equal(response.status, 403);
  assert.equal(DB.calls.length, 0);
});


test('a retry after successful reconciliation reuses the existing receipt without paying twice', async () => {
  const DB = db();
  const first = await onRequestPost({ request: req(base), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret, DHF_RECEIPT_EMAIL_ENABLED: 'false' } });
  const firstBody = await first.json();
  const second = await onRequestPost({ request: req(base), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret, DHF_RECEIPT_EMAIL_ENABLED: 'false' } });
  const secondBody = await second.json();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(secondBody.already_reconciled, true);
  assert.equal(secondBody.receipt_id, firstBody.receipt_id);
  assert.equal(DB.calls.filter(call => /UPDATE sponsor_invoices SET status = 'paid'/.test(call.sql)).length, 1);
  assert.equal(DB.calls.filter(call => /UPDATE sponsor_partnerships SET payment_status = 'paid'/.test(call.sql)).length, 2);
});

test('does not reconcile a void invoice', async () => {
  const DB = db('void');
  const response = await onRequestPost({ request: req(base), env: { DB, DHF_RECEIPT_TOKEN_SECRET: tokenSecret } });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.some(call => /UPDATE sponsor_invoices SET status = 'paid'/.test(call.sql)), false);
});

test('fails closed when receipt signing is not configured', async () => {
  const DB = db();
  const response = await onRequestPost({ request: req(base), env: { DB } });
  assert.equal(response.status, 503);
  assert.equal(DB.calls.length, 0);
});
