import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaidReceipt, createReceiptToken } from '../functions/lib/payment-receipts.js';

function fakeDb() {
  const calls = [];
  const saved = new Map();
  return {
    calls,
    prepare(sql) {
      return { bind(...values) {
        return {
          async first() {
            calls.push({ kind: 'first', sql, values });
            if (/JOIN sponsor_partnerships/.test(sql)) return {
              invoice_id: 'inv-123', partnership_id: 7, description: 'Corporate sponsorship',
              amount_cents: 125000, recipient_name: 'Test Buyer',
              recipient_email: 'buyer@example.com', business_name: 'Example Company'
            };
            if (/FROM payment_receipts/.test(sql)) return saved.get(values[0]) || null;
            return null;
          },
          async run() {
            calls.push({ kind: 'run', sql, values });
            if (/INSERT OR IGNORE INTO payment_receipts/.test(sql)) {
              const [receipt_id, invoice_id, partnership_id, receipt_token_hash, recipient_name, recipient_email, business_name, description, amount_cents, currency, payment_method, provider_id, provider_reference, paid_at] = values;
              if (![...saved.values()].some(row => row.invoice_id === invoice_id)) {
                saved.set(invoice_id, { receipt_id, invoice_id, recipient_email, amount_cents, currency, paid_at, email_status: 'not_configured' });
              }
            }
            return { meta: { changes: 1 } };
          }
        };
      }};
    }
  };
}
const env = { DHF_RECEIPT_TOKEN_SECRET: 'test-only-secret-that-is-at-least-32-chars' };

test('creates a branded receipt record once for a verified paid invoice', async () => {
  const DB = fakeDb();
  const receipt = await createPaidReceipt({ DB, env, invoiceId: 'inv-123', providerId: 'manual', providerReference: 'pi_test_123', amountCents: 125000, paidAt: '2026-11-17T12:00:00.000Z' });
  assert.match(receipt.receipt_id, /^DHF-20261117-[A-F0-9]{8}$/);
  assert.equal(receipt.recipient_email, 'buyer@example.com');
  assert.equal(receipt.amount_cents, 125000);
  assert.match(receipt.receipt_url, /^\/receipt\/[A-Za-z0-9_-]{40,64}$/);
  assert.equal(DB.calls.filter(call => /INSERT OR IGNORE INTO payment_receipts/.test(call.sql)).length, 1);
});

test('receipt token is deterministic per invoice and secret for safe retry recovery', async () => {
  const first = await createReceiptToken('inv-123', env.DHF_RECEIPT_TOKEN_SECRET);
  const second = await createReceiptToken('inv-123', env.DHF_RECEIPT_TOKEN_SECRET);
  const other = await createReceiptToken('inv-456', env.DHF_RECEIPT_TOKEN_SECRET);
  assert.equal(first, second);
  assert.notEqual(first, other);
});

test('does not create a receipt when paid amount differs from approved invoice', async () => {
  const DB = fakeDb();
  await assert.rejects(
    createPaidReceipt({ DB, env, invoiceId: 'inv-123', providerId: 'manual', providerReference: 'pi_bad', amountCents: 1000 }),
    /does not match/
  );
  assert.equal(DB.calls.some(call => /INSERT OR IGNORE INTO payment_receipts/.test(call.sql)), false);
});

test('requires a dedicated receipt token secret', async () => {
  const DB = fakeDb();
  await assert.rejects(
    createPaidReceipt({ DB, env: {}, invoiceId: 'inv-123', providerId: 'manual', providerReference: 'pi_test', amountCents: 125000 }),
    /not configured/
  );
});
