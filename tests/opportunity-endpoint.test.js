import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/opportunity-application.js';

const validApplication = {
  application_type: 'sponsor',
  name: 'Jordan Smith',
  email: 'sales@example.com',
  organization: 'Example Sponsor',
  website: 'https://example.com',
  country: 'United States',
  region: 'Virginia',
  city: 'Arlington',
  category: 'Business services',
  requested_package: 'Supporting sponsor',
  event_interest: 'Agriculture and Innovation Summit',
  preferred_date: '',
  message: 'We are interested in discussing sponsorship.',
  public_description: '',
  contact_consent: true,
  marketing_consent: false,
  public_listing_consent: false
};

function makeEnv(options = {}) {
  const writes = [];
  const kv = {
    async get() { return options.rateLimited ? '5' : null; },
    async put() {}
  };
  const DB = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (options.dbFail) throw new Error('D1 unavailable');
              writes.push({ sql, values });
              return { meta: { changes: 1, last_row_id: 41 } };
            }
          };
        }
      };
    }
  };
  return { env: { DB, SESSIONS: kv, TURNSTILE_SECRET_KEY: options.secret ?? 'test-secret' }, writes };
}

async function submit(data, options = {}) {
  const { env, writes } = makeEnv(options);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = options.fetch || (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ success: true, hostname: 'preview.example' }), { status: 200 });
  });
  try {
    const request = new Request('https://preview.example/api/opportunity-application', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.42',
        'Referer': options.referer || 'https://preview.example/sponsors?utm_source=test'
      },
      body: JSON.stringify(data)
    });
    const response = await onRequestPost({ request, env });
    return { response, writes, fetchCalls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('rejects malformed JSON without writing to D1', async () => {
  const { env, writes } = makeEnv();
  const request = new Request('https://preview.example/api/opportunity-application', { method: 'POST', body: '{' });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
});

test('rejects missing contact consent before Turnstile or D1', async () => {
  const { response, writes, fetchCalls } = await submit({ ...validApplication, contact_consent: false });
  assert.equal(response.status, 422);
  assert.equal(writes.length, 0);
  assert.equal(fetchCalls, 0);
});

test('rejects missing Turnstile token without writing to D1', async () => {
  const { response, writes, fetchCalls } = await submit({ ...validApplication, 'cf-turnstile-response': '' });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
  assert.equal(fetchCalls, 0);
});

test('fails closed when the Turnstile secret binding is unavailable', async () => {
  const { response, writes, fetchCalls } = await submit({ ...validApplication, 'cf-turnstile-response': 'token' }, { secret: '' });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
  assert.equal(fetchCalls, 0);
});

test('rejects a Turnstile token validated for a different hostname', async () => {
  const fetch = async () => new Response(JSON.stringify({ success: true, hostname: 'attacker.example' }), { status: 200 });
  const { response, writes } = await submit({ ...validApplication, 'cf-turnstile-response': 'token' }, { fetch });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
});

test('rate limits application submissions before verification', async () => {
  const { response, writes, fetchCalls } = await submit({ ...validApplication, 'cf-turnstile-response': 'token' }, { rateLimited: true });
  assert.equal(response.status, 429);
  assert.equal(writes.length, 0);
  assert.equal(fetchCalls, 0);
});

test('stores a valid application and normalizes the same-origin source path', async () => {
  const { response, writes, fetchCalls } = await submit({ ...validApplication, 'cf-turnstile-response': 'valid-token' });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT INTO opportunity_applications/);
  assert.ok(writes[0].values.includes('/sponsors'));
  assert.equal(fetchCalls, 1);
});

test('keeps the application successful when optional email notification is not configured', async () => {
  const { response, writes } = await submit({ ...validApplication, 'cf-turnstile-response': 'valid-token' });
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
});

test('does not send a client-supplied status into the application record', async () => {
  const { response, writes } = await submit({ ...validApplication, status: 'approved', 'cf-turnstile-response': 'valid-token' });
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.doesNotMatch(writes[0].sql, /status/);
});

test('rejects a cross-origin Referer as the application source', async () => {
  const { response, writes } = await submit({ ...validApplication, 'cf-turnstile-response': 'valid-token' }, { referer: 'https://attacker.example/sponsors' });
  assert.equal(response.status, 200);
  assert.ok(writes[0].values.includes('/'));
});

test('returns a save error when D1 fails and does not claim success', async () => {
  const { response, writes } = await submit({ ...validApplication, 'cf-turnstile-response': 'valid-token' }, { dbFail: true });
  assert.equal(response.status, 500);
  assert.equal(writes.length, 0);
});
