import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/admin/sponsor-crm.js';

const sponsorApp = { id: 12, application_type: 'sponsor' };
function fakeDb(options = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        async all() { calls.push({ kind: 'all', sql, values: [] }); return { results: options.rows || [] }; },
        bind(...values) {
          return {
            async all() { calls.push({ kind: 'all', sql, values }); return { results: options.rows || [] }; },
            async first() {
              calls.push({ kind: 'first', sql, values });
              if (/recipient_name/.test(sql)) return options.receiptInvoice ?? {
                invoice_id: 'inv-existing-paid', partnership_id: 4, description: 'Corporate sponsorship',
                amount_cents: 50000, recipient_name: 'Buyer', recipient_email: 'buyer@example.com',
                business_name: 'Example Sponsor'
              };
              if (/FROM opportunity_applications/i.test(sql)) return options.application ?? sponsorApp;
              if (/FROM sponsor_partnerships/i.test(sql)) return options.partnership ?? { id: 4, application_id: 12, stage: 'prospect' };
              if (/FROM sponsor_invoices/i.test(sql)) return options.openInvoice ?? null;
              if (/FROM sponsor_deliverables/i.test(sql)) return options.deliverable ?? { id: 9 };
              return options.first ?? { id: 4 };
            },
            async run() { calls.push({ kind: 'run', sql, values }); return { meta: { changes: options.changes ?? 1, last_row_id: options.lastRowId ?? 9 } }; }
          };
        }
      };
    }
  };
}
const origin = 'https://preview.example';
function req(body, originHeader = origin) {
  return new Request(origin + '/api/admin/sponsor-crm', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: originHeader }, body: JSON.stringify(body) });
}

test('sponsor CRM GET returns prospect, partnership, deliverable and activity collections', async () => {
  const DB = fakeDb({ rows: [{ id: 1 }] });
  const response = await onRequestGet({ env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ['applications', 'partnerships', 'deliverables', 'activities', 'invoice_issuing_enabled', 'payment_provider', 'payment_methods']);
  assert.equal(DB.calls.filter(c => c.kind === 'all').length, 4);
});

test('rejects cross-origin sponsor CRM writes', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'create', application_id: 12 }, 'https://attacker.example'), env: { DB } });
  assert.equal(response.status, 403);
  assert.equal(DB.calls.length, 0);
});

test('creates a partnership only from a sponsor application', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'create', application_id: 12, division: 'advertising_media', package_name: 'Media Partner' }), env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.partnership.id, 4);
  assert.ok(DB.calls.some(c => /INSERT OR IGNORE INTO sponsor_partnerships/.test(c.sql)));
});

test('rejects non-sponsor applications when creating a partnership', async () => {
  const DB = fakeDb({ application: { id: 12, application_type: 'vendor' } });
  const response = await onRequestPost({ request: req({ action: 'create', application_id: 12 }), env: { DB } });
  assert.equal(response.status, 404);
  assert.equal(DB.calls.some(c => /INSERT OR IGNORE/.test(c.sql)), false);
});

test('cannot manually mark sponsor payment as paid or refunded', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'update', id: 4, stage: 'qualified', division: 'business_network', contract_status: 'not_started', payment_status: 'paid' }), env: { DB } });
  assert.equal(response.status, 422);
  assert.equal(DB.calls.some(c => /UPDATE sponsor_partnerships/.test(c.sql)), false);
});

test('requires agreement URL and signed date before marking contract signed', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'update', id: 4, stage: 'qualified', division: 'business_network', contract_status: 'signed', payment_status: 'not_requested' }), env: { DB } });
  assert.equal(response.status, 422);
  assert.equal(DB.calls.some(c => /UPDATE sponsor_partnerships/.test(c.sql)), false);
});

test('rejects insecure agreement and invoice links', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'update', id: 4, stage: 'qualified', division: 'business_network', contract_status: 'not_started', payment_status: 'not_requested', contract_url: 'http://example.com' }), env: { DB } });
  assert.equal(response.status, 422);
});

test('requires a signed agreement before moving a partnership to contracted', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'update', id: 4, stage: 'contracted', division: 'business_network', contract_status: 'draft' }), env: { DB } });
  assert.equal(response.status, 409);
});

test('adds a deliverable to an existing partnership', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'add_deliverable', partnership_id: 4, title: 'Homepage sponsor placement', due_date: '2026-12-01' }), env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(DB.calls.some(c => /INSERT INTO sponsor_deliverables/.test(c.sql)));
});


test('invoice issuing remains disabled until the owner enables the invoicing gate', async () => {
  const DB = fakeDb({ partnership: { id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed', agreed_amount_cents: 50000, payment_status: 'not_requested' } });
  const response = await onRequestPost({ request: req({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }), env: { DB, DHF_INVOICING_ENABLED: 'false', STRIPE_SECRET_KEY: 'sk_test_mock' } });
  assert.equal(response.status, 503);
  assert.equal(DB.calls.some(c => /INSERT INTO sponsor_invoices/.test(c.sql)), false);
});

test('creates a finalized Stripe hosted invoice without sending an email', async () => {
  const DB = fakeDb({ partnership: { id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed', agreed_amount_cents: 50000, package_name: 'Corporate Partner', payment_status: 'not_requested', contact_email: 'buyer@example.com', contact_name: 'Buyer', organization: 'Example Sponsor', stripe_customer_id: '' } });
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/account')) return new Response(JSON.stringify({ id: 'acct_test', livemode: false }), { status: 200 });
    if (String(url).endsWith('/customers')) return new Response(JSON.stringify({ id: 'cus_test_1' }), { status: 200 });
    if (String(url).endsWith('/invoices')) return new Response(JSON.stringify({ id: 'in_test_1', status: 'draft', amount_due: 0 }), { status: 200 });
    if (String(url).endsWith('/invoiceitems')) return new Response(JSON.stringify({ id: 'ii_test_1' }), { status: 200 });
    if (String(url).endsWith('/invoices/in_test_1/finalize')) return new Response(JSON.stringify({ id: 'in_test_1', status: 'open', amount_due: 50000, hosted_invoice_url: 'https://invoice.stripe.com/i/test_invoice', invoice_pdf: 'https://files.stripe.com/test.pdf', number: 'INV-TEST-001' }), { status: 200 });
    throw new Error('Unexpected Stripe request: ' + String(url));
  };
  try {
    const response = await onRequestPost({ request: req({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }), env: { DB, DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_PROVIDER: 'stripe', DHF_PAYMENT_METHODS: 'card,apple_pay,ach', DHF_INVOICING_ENABLED: 'true', DHF_STRIPE_EXPECT_LIVEMODE: 'false', STRIPE_SECRET_KEY: 'sk_test_mock' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.invoice_url, 'https://invoice.stripe.com/i/test_invoice');
    assert.equal(body.invoice_number, 'INV-TEST-001');
    assert.equal(body.amount_cents, 50000);
    assert.equal(calls.length, 5);
    assert.equal(calls.some(c => c.url.endsWith('/send')), false);
    const invoiceParams = new URLSearchParams(calls.find(c => c.url.endsWith('/invoices')).init.body);
    assert.equal(invoiceParams.get('collection_method'), 'send_invoice');
    assert.equal(invoiceParams.get('auto_advance'), 'false');
    const itemParams = new URLSearchParams(calls.find(c => c.url.endsWith('/invoiceitems')).init.body);
    assert.equal(itemParams.get('amount'), '50000');
    assert.equal(itemParams.get('invoice'), 'in_test_1');
    assert.ok(DB.calls.some(c => /UPDATE sponsor_partnerships SET payment_status = CASE/.test(c.sql)));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('requires a due date and valid sponsor billing email before invoicing', async () => {
  const DB = fakeDb({ partnership: { id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed', agreed_amount_cents: 50000, package_name: 'Corporate Partner', payment_status: 'not_requested', contact_email: '', contact_name: 'Buyer', organization: 'Example Sponsor' } });
  const response = await onRequestPost({ request: req({ action: 'create_invoice', partnership_id: 4 }), env: { DB, DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_PROVIDER: 'stripe', DHF_INVOICING_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_mock' } });
  assert.equal(response.status, 422);
});

test('resumes an existing open Stripe invoice instead of creating a duplicate', async () => {
  const DB = fakeDb({
    partnership: { id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed', agreed_amount_cents: 50000, package_name: 'Corporate Partner', payment_status: 'invoice_sent', contact_email: 'buyer@example.com', contact_name: 'Buyer', organization: 'Example Sponsor', stripe_customer_id: 'cus_test_1' },
    openInvoice: { invoice_id: 'inv-existing', partnership_id: 4, amount_cents: 50000, due_date: '2026-12-31', status: 'issued', stripe_invoice_id: 'in_existing' }
  });
  let calls=0;
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async(url)=>{calls++;return new Response(JSON.stringify(String(url).endsWith('/account')?{id:'acct_test',livemode:false}:{id:'in_existing',status:'open',amount_due:50000,hosted_invoice_url:'https://invoice.stripe.com/i/existing',invoice_pdf:'https://files.stripe.com/existing.pdf',number:'INV-EXISTING'}),{status:200})};
  try {
    const response=await onRequestPost({request:req({action:'create_invoice',partnership_id:4,due_date:'2026-12-31'}),env:{DB,DHF_PAYMENTS_ENABLED:'true',DHF_PAYMENT_PROVIDER:'stripe',DHF_INVOICING_ENABLED:'true',DHF_STRIPE_EXPECT_LIVEMODE:'false',STRIPE_SECRET_KEY:'sk_test_mock'}});
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.invoice_url,'https://invoice.stripe.com/i/existing');
    assert.equal(calls,2);
  } finally {globalThis.fetch=oldFetch}
});

test('blocks invoice regeneration when an existing invoice amount or due date differs', async () => {
  const DB=fakeDb({
    partnership:{id:4,application_id:12,stage:'contracted',contract_status:'signed',agreed_amount_cents:50000,package_name:'Corporate Partner',payment_status:'invoice_sent',contact_email:'buyer@example.com',contact_name:'Buyer',organization:'Example Sponsor'},
    openInvoice:{invoice_id:'inv-existing',partnership_id:4,amount_cents:40000,due_date:'2026-12-31',status:'issued',stripe_invoice_id:'in_existing'}
  });
  const response=await onRequestPost({request:req({action:'create_invoice',partnership_id:4,due_date:'2026-12-31'}),env:{DB,DHF_PAYMENTS_ENABLED:'true',DHF_PAYMENT_PROVIDER:'stripe',DHF_INVOICING_ENABLED:'true',DHF_STRIPE_EXPECT_LIVEMODE:'false',STRIPE_SECRET_KEY:'sk_test_mock'}});
  assert.equal(response.status,409);
});

test('adds a dated follow-up activity', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'add_activity', partnership_id: 4, activity_type: 'follow_up', summary: 'Call the sponsor contact', follow_up_at: '2026-12-02' }), env: { DB } });
  assert.equal(response.status, 200);
  assert.ok(DB.calls.some(c => /INSERT INTO sponsor_activities/.test(c.sql)));
});


test('refuses live or unrecognized Stripe keys before any provider request in Preview', async () => {
  for (const key of ['sk_live_mock', 'not-a-stripe-key']) {
    const DB = fakeDb({ partnership: { id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed', agreed_amount_cents: 50000, package_name: 'Corporate Partner', payment_status: 'not_requested', contact_email: 'buyer@example.com', contact_name: 'Buyer', organization: 'Example Sponsor', stripe_customer_id: '' } });
    const oldFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; throw new Error('Provider must not be called'); };
    try {
      const response = await onRequestPost({
        request: req({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
        env: {
          DB,
          DHF_PAYMENTS_ENABLED: 'true',
          DHF_PAYMENT_PROVIDER: 'stripe',
          DHF_INVOICING_ENABLED: 'true',
          DHF_STRIPE_EXPECT_LIVEMODE: 'false',
          STRIPE_SECRET_KEY: key
        }
      });
      assert.equal(response.status, 503);
      assert.equal(calls, 0);
      assert.equal(DB.calls.some(c => /INSERT INTO sponsor_invoices/.test(c.sql)), false);
    } finally {
      globalThis.fetch = oldFetch;
    }
  }
});


test('reconciling an already-paid provider invoice creates the missing receipt once', async () => {
  const DB = fakeDb({
    partnership: { id: 4, application_id: 12, stage: 'contracted', contract_status: 'signed', agreed_amount_cents: 50000, package_name: 'Corporate Partner', payment_status: 'invoice_sent', contact_email: 'buyer@example.com', contact_name: 'Buyer', organization: 'Example Sponsor', stripe_customer_id: 'cus_test_1' },
    openInvoice: { invoice_id: 'inv-existing-paid', partnership_id: 4, amount_cents: 50000, due_date: '2026-12-31', status: 'issued', stripe_invoice_id: 'in_existingpaid' },
    receiptInvoice: { invoice_id: 'inv-existing-paid', partnership_id: 4, description: 'Corporate sponsorship', amount_cents: 50000, recipient_name: 'Buyer', recipient_email: 'buyer@example.com', business_name: 'Example Sponsor' },
    first: { receipt_id: 'DHF-20261117-ABCD1234', invoice_id: 'inv-existing-paid', recipient_email: 'buyer@example.com', amount_cents: 50000, currency: 'usd', paid_at: '2026-11-17T12:00:00.000Z', email_status: 'not_configured' }
  });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(JSON.stringify(String(url).endsWith('/account')
    ? { id: 'acct_test', livemode: false }
    : { id: 'in_existingpaid', status: 'paid', amount_paid: 50000, total: 50000, currency: 'usd', payment_intent: 'pi_test_paid', status_transitions: { paid_at: 1794931200 } }), { status: 200 });
  try {
    const response = await onRequestPost({
      request: req({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }),
      env: { DB, DHF_PAYMENTS_ENABLED: 'true', DHF_PAYMENT_PROVIDER: 'stripe', DHF_INVOICING_ENABLED: 'true', DHF_STRIPE_EXPECT_LIVEMODE: 'false', DHF_RECEIPT_TOKEN_SECRET: 'test-only-secret-that-is-at-least-32-chars', STRIPE_SECRET_KEY: 'sk_test_mock' }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.payment_status, 'paid');
    assert.ok(body.receipt_id);
    assert.ok(DB.calls.some(c => /INSERT OR IGNORE INTO payment_receipts/.test(c.sql)));
  } finally {
    globalThis.fetch = oldFetch;
  }
});
