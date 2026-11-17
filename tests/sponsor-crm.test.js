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
  assert.deepEqual(Object.keys(body), ['applications', 'partnerships', 'deliverables', 'activities']);
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
  const response = await onRequestPost({ request: req({ action: 'update', id: 4, stage: 'contracted', division: 'business_network', contract_status: 'draft', payment_status: 'not_requested' }), env: { DB } });
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


test('cannot issue a sponsor invoice before a signed agreement and agreed amount', async () => {
  const DB = fakeDb({ partnership: { id: 4, application_id: 12, contract_status: 'draft', agreed_amount_cents: 50000, package_name: 'Corporate Partner' } });
  const response = await onRequestPost({ request: req({ action: 'create_invoice', partnership_id: 4 }), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.some(c => /INSERT INTO sponsor_invoices/.test(c.sql)), false);
});

test('issues a secure sponsor invoice only after agreement is signed', async () => {
  const DB = fakeDb({ partnership: { id: 4, application_id: 12, contract_status: 'signed', agreed_amount_cents: 50000, package_name: 'Corporate Partner', payment_status: 'not_requested' } });
  const response = await onRequestPost({ request: req({ action: 'create_invoice', partnership_id: 4, due_date: '2026-12-31' }), env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.amount_cents, 50000);
  assert.ok(body.invoice_url.startsWith('https://preview.example/pay/invoice?token='));
  assert.match(body.invoice_url.split('token=')[1], /^[a-f0-9]{64}$/);
  const insert = DB.calls.find(c => /INSERT INTO sponsor_invoices/.test(c.sql));
  assert.ok(insert);
  assert.notEqual(insert.values[6], body.invoice_url.split('token=')[1]);
  assert.ok(DB.calls.some(c => /UPDATE sponsor_partnerships SET payment_status = 'invoice_sent'/.test(c.sql)));
});

test('adds a dated follow-up activity', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: req({ action: 'add_activity', partnership_id: 4, activity_type: 'follow_up', summary: 'Call the sponsor contact', follow_up_at: '2026-12-02' }), env: { DB } });
  assert.equal(response.status, 200);
  assert.ok(DB.calls.some(c => /INSERT INTO sponsor_activities/.test(c.sql)));
});
