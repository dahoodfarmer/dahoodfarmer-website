import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/admin/sponsor-crm.js';

const origin = 'https://preview.example';
function request(body, originHeader = origin) {
  return new Request(origin + '/api/admin/sponsor-crm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: originHeader },
    body: JSON.stringify(body)
  });
}
function fakeDb({ partnership = null, openInvoice = null, insertError = null } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({ kind: 'first', sql, values });
              if (/FROM sponsor_partnerships s JOIN opportunity_applications/.test(sql)) return partnership;
              if (/FROM sponsor_invoices/.test(sql)) return openInvoice;
              return null;
            },
            async run() {
              calls.push({ kind: 'run', sql, values });
              if (/INSERT INTO sponsor_invoices/.test(sql) && insertError) throw insertError;
              return { meta: { changes: 1, last_row_id: 42 } };
            }
          };
        }
      };
    }
  };
}
const validPartnership = {
  id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed',
  agreed_amount_cents: 50000, package_name: 'Corporate Partner',
  payment_status: 'not_requested', contact_email: 'buyer@example.com',
  contact_name: 'Buyer', organization: 'Example Sponsor'
};

test('blocks cross-origin CRM writes', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }, 'https://attacker.example'),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
  });
  assert.equal(response.status, 403);
  assert.equal(DB.calls.length, 0);
});

test('internal invoice creation remains disabled unless its Preview-only gate is enabled', async () => {
  const DB = fakeDb({ partnership: validPartnership });
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'false' }
  });
  assert.equal(response.status, 503);
  assert.equal(DB.calls.length, 0);
});

test('creates a DHF invoice from the signed agreement without calling a payment provider', async () => {
  const DB = fakeDb({ partnership: validPartnership });
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('No external payment provider may be called'); };
  try {
    const response = await onRequestPost({
      request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
      env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.invoice_number, 'DHF-2026-000042');
    assert.equal(body.amount_cents, 50000);
    assert.match(body.invoice_url, /^https:\/\/preview\.example\/invoice\/[A-Za-z0-9_-]{40,64}$/);
    assert.equal(body.payment_activation, 'disabled');
    assert.equal(networkCalls, 0);
    const insert = DB.calls.find(call => /INSERT INTO sponsor_invoices/.test(call.sql));
    assert.ok(insert);
    assert.equal(insert.values[2], 50000);
    assert.equal(insert.values[5].length, 64);
    assert.ok(DB.calls.some(call => /UPDATE sponsor_partnerships SET payment_status = 'invoice_sent'/.test(call.sql)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a conflict if a concurrent request already created an open invoice', async () => {
  const DB = fakeDb({ partnership: validPartnership, insertError: new Error('UNIQUE constraint failed: sponsor_invoices.partnership_id') });
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.match(body.error, /Another open invoice/);
});

test('rejects invoice issuance without a signed agreement and agreed amount', async () => {
  const DB = fakeDb({ partnership: { ...validPartnership, contract_status: 'draft' } });
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
  });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.some(call => /INSERT INTO sponsor_invoices/.test(call.sql)), false);
});

test('does not create a replacement invoice when an open invoice has a different amount or due date', async () => {
  const DB = fakeDb({
    partnership: validPartnership,
    openInvoice: { invoice_id: 'existing', amount_cents: 40000, due_date: '2026-12-31', status: 'issued', id: 41 }
  });
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
  });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.some(call => /INSERT INTO sponsor_invoices/.test(call.sql)), false);
});

test('resumes an open DHF invoice by rotating its opaque URL token', async () => {
  const DB = fakeDb({
    partnership: validPartnership,
    openInvoice: { invoice_id: 'existing-invoice', amount_cents: 50000, due_date: '2026-12-31', status: 'issued', id: 41 }
  });
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.invoice_id, 'existing-invoice');
  assert.equal(body.invoice_number, 'DHF-2026-000041');
  assert.equal(DB.calls.some(call => /INSERT INTO sponsor_invoices/.test(call.sql)), false);
  const rotate = DB.calls.find(call => /UPDATE sponsor_invoices SET token_hash =/.test(call.sql));
  assert.ok(rotate);
  assert.equal(rotate.values[0].length, 64);
  assert.equal(rotate.values[1], 'DHF-2026-000041');
  assert.equal(rotate.values[3], 'existing-invoice');
});

test('rejects an agreed amount above the invoice database limit', async () => {
  const DB = fakeDb({ partnership: { ...validPartnership, agreed_amount_cents: 100000001 } });
  const response = await onRequestPost({
    request: request({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
    env: { DB, DHF_INTERNAL_INVOICING_ENABLED: 'true' }
  });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.some(call => /INSERT INTO sponsor_invoices/.test(call.sql)), false);
});
