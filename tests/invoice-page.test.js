import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/invoice/[token].js';
import { hashInvoiceToken } from '../functions/lib/invoices.js';

test('secure invoice page resolves the opaque token and renders the signed-agreement amount', async () => {
  const token = 'a'.repeat(43);
  const tokenHash = await hashInvoiceToken(token);
  const DB = {
    prepare(sql) {
      return { bind(value) {
        assert.equal(value, tokenHash);
        return { async first() {
          return {
            invoice_number: 'DHF-2026-000042',
            description: 'Da HoodFarmer — Corporate Partner',
            amount_cents: 50000,
            currency: 'usd',
            due_date: '2026-12-31',
            status: 'issued',
            recipient_name: 'Test Buyer',
            business_name: 'Example Sponsor'
          };
        }};
      }};
    }
  };
  const response = await onRequestGet({ params: { token }, env: { DB } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /DHF-2026-000042/);
  assert.match(html, /\$500\.00/);
  assert.match(html, /Available payment destinations/);
  assert.match(html, /external-payment-options/);
  assert.match(html, /exact invoice amount/);
  assert.match(html, /independently verifies cleared funds/);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
});

test('rejects malformed invoice tokens without querying the database', async () => {
  let queried = false;
  const response = await onRequestGet({
    params: { token: 'not-a-valid-token' },
    env: { DB: { prepare() { queried = true; } } }
  });
  assert.equal(response.status, 404);
  assert.equal(queried, false);
});
