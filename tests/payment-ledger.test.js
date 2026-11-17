import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/admin/payment-ledger.js';

test('owner ledger separates gross payments, refunds, net payments, and outstanding balances', async () => {
  let sqlSeen = '';
  const DB = {
    prepare(sql) {
      sqlSeen = sql;
      return {
        bind(limit) {
          assert.equal(limit, 150);
          return {
            async all() {
              return { results: [
                { invoice_id: 'inv-paid', invoice_number: 'DHF-001', amount_cents: 10000, refund_amount_cents: 2500, invoice_status: 'paid', payment_status: 'refunded', receipt_id: 'DHF-REC-001', customer_name: 'Synthetic Buyer', customer_email: 'buyer@example.invalid', provider_id: 'stripe' },
                { invoice_id: 'inv-outstanding', invoice_number: 'DHF-002', amount_cents: 5000, refund_amount_cents: 0, invoice_status: 'issued', payment_status: 'invoice_sent', receipt_id: null, customer_name: 'Synthetic Buyer', customer_email: 'buyer@example.invalid', provider_id: 'stripe' }
              ] };
            }
          };
        }
      };
    }
  };
  const response = await onRequestGet({
    request: new Request('https://preview.example.invalid/api/admin/payment-ledger?limit=150'),
    env: { DB, DHF_RECEIPT_TOKEN_SECRET: 'test-only-receipt-secret-that-is-over-32-characters' }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(sqlSeen, /refund_amount_cents/);
  assert.deepEqual(body.summary, {
    paid_count: 1,
    gross_paid_cents: 10000,
    refunded_cents: 2500,
    net_paid_cents: 7500,
    outstanding_count: 1,
    outstanding_cents: 5000
  });
  assert.match(body.invoices[0].receipt_url, /^\/receipt\/[A-Za-z0-9_-]{40,64}$/);
});
