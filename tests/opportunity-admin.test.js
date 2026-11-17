import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as getApplications, onRequestPost as updateApplication } from '../functions/api/admin/opportunity-applications.js';
import { onRequestGet as getDirectory } from '../functions/api/business-directory.js';

const baseApplication = {
  id: 7,
  application_type: 'business_listing',
  name: 'Taylor Owner',
  email: 'owner@example.com',
  organization: 'Taylor Farms',
  website: 'https://taylor.example',
  country: 'United States',
  region: 'Georgia',
  city: 'Atlanta',
  category: 'Agriculture',
  public_description: 'A family farm producing specialty crops.',
  public_listing_consent: 1,
  status: 'approved'
};

function fakeDb(options = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              calls.push({ kind: 'all', sql, values });
              if (options.allError) throw new Error('D1 unavailable');
              return { results: options.rows || [] };
            },
            async first() {
              calls.push({ kind: 'first', sql, values });
              if (options.firstError) throw new Error('D1 unavailable');
              if (/COUNT\(\*\)/i.test(sql)) return { total: options.total ?? 1 };
              return options.application ?? baseApplication;
            },
            async run() {
              calls.push({ kind: 'run', sql, values });
              if (options.runError) throw new Error('D1 unavailable');
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

function adminRequest(path, body, origin = 'https://preview.example') {
  return new Request('https://preview.example' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body)
  });
}

test('public directory returns only approved public fields and never leaks applicant data', async () => {
  const DB = fakeDb({ rows: [{ id: 2, business_name: 'Farm Co', description: 'Public description', website: 'https://farm.example', category: 'Agriculture', city: 'Macon', region: 'Georgia', country: 'United States', status: 'active', email: 'private@example.com', message: 'private application note' }] });
  const response = await getDirectory({ request: new Request('https://preview.example/api/business-directory'), env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.listings.length, 1);
  assert.equal(body.listings[0].business_name, 'Farm Co');
  assert.equal('email' in body.listings[0], false);
  assert.equal('message' in body.listings[0], false);
  assert.equal('application_id' in body.listings[0], false);
});

test('admin application list is paginated and includes listing state', async () => {
  const DB = fakeDb({ rows: [{ ...baseApplication, listing_status: 'hidden' }] });
  const request = new Request('https://preview.example/api/admin/opportunity-applications?page=2&limit=25&status=approved&type=business_listing');
  const response = await getApplications({ request, env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.page, 2);
  assert.equal(body.limit, 25);
  assert.equal(body.applications[0].listing_status, 'hidden');
  assert.ok(DB.calls.some(c => c.values.includes(25) && c.values.includes(25)));
});

test('rejects invalid admin status without database writes', async () => {
  const DB = fakeDb();
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'published' }), env: { DB } });
  assert.equal(response.status, 422);
  assert.equal(DB.calls.filter(c => c.kind === 'run').length, 0);
});

test('rejects cross-origin admin POST requests', async () => {
  const DB = fakeDb();
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'approved' }, 'https://attacker.example'), env: { DB } });
  assert.equal(response.status, 403);
  assert.equal(DB.calls.length, 0);
});

test('approving a business application does not automatically publish a directory listing', async () => {
  const DB = fakeDb();
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'approved' }), env: { DB } });
  assert.equal(response.status, 200);
  assert.equal(DB.calls.filter(c => c.kind === 'run').length, 1);
  assert.equal(DB.calls.some(c => /INSERT INTO business_listings/i.test(c.sql)), false);
});

test('publishes only an approved business application with explicit public-listing consent', async () => {
  const DB = fakeDb();
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'approved', listing_status: 'active' }), env: { DB } });
  assert.equal(response.status, 200);
  assert.ok(DB.calls.some(c => /INSERT INTO business_listings/i.test(c.sql)));
});

test('refuses to publish when the applicant did not consent to public listing', async () => {
  const DB = fakeDb({ application: { ...baseApplication, public_listing_consent: 0 } });
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'approved', listing_status: 'active' }), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.filter(c => c.kind === 'run').length, 0);
});

test('refuses to publish before the application is approved', async () => {
  const DB = fakeDb({ application: { ...baseApplication, status: 'reviewing' } });
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'reviewing', listing_status: 'active' }), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.filter(c => c.kind === 'run').length, 0);
});

test('refuses to publish while changing an approved application to a non-approved status', async () => {
  const DB = fakeDb({ application: { ...baseApplication, status: 'approved' } });
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'reviewing', listing_status: 'active' }), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal(DB.calls.filter(c => c.kind === 'run').length, 0);
});

test('declining an application hides an existing listing before updating status', async () => {
  const DB = fakeDb();
  const response = await updateApplication({ request: adminRequest('/api/admin/opportunity-applications', { id: 7, status: 'declined' }), env: { DB } });
  assert.equal(response.status, 200);
  assert.match(DB.calls.find(c => c.kind === 'run').sql, /UPDATE business_listings SET status = 'hidden'/);
});
