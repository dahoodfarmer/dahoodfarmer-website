import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as subscribe } from '../functions/api/newsletter.js';

const columns = ['email', 'unsubscribe_token', 'consent_at', 'status', 'subscribed_at'];

function makeDb(existing = null) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      if (sql.startsWith('PRAGMA table_info')) {
        return { async all() { return { results: columns.map(name => ({ name })) }; } };
      }
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.startsWith('SELECT * FROM newsletter_subscribers')) return existing;
              return null;
            },
            async run() {
              writes.push({ sql, values });
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

function makeRequest(payload) {
  return new Request('https://preview.example/api/newsletter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '198.51.100.25'
    },
    body: JSON.stringify(payload)
  });
}

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await callback(); }
  finally { globalThis.fetch = original; }
}

function makeKv() {
  return {
    async get() { return null; },
    async put() {}
  };
}

test('newsletter signup requires explicit consent before Turnstile or D1 writes', async () => {
  const db = makeDb();
  let fetchCalls = 0;
  const response = await withFetch(async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ success: true, hostname: 'preview.example' }), { status: 200 });
  }, () => subscribe({
    request: makeRequest({ email: 'reader@example.com', consent: false, 'cf-turnstile-response': 'token' }),
    env: { DB: db, SESSIONS: makeKv(), TURNSTILE_SECRET_KEY: 'preview-secret' }
  }));

  assert.equal(response.status, 422);
  assert.equal(fetchCalls, 0);
  assert.equal(db.writes.length, 0);
});

test('newsletter signup verifies Turnstile and stores consent evidence in D1', async () => {
  const db = makeDb();
  let siteverifyCalls = 0;
  const response = await withFetch(async (url, init) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(init.method, 'POST');
    siteverifyCalls += 1;
    return new Response(JSON.stringify({ success: true, hostname: 'preview.example' }), { status: 200 });
  }, () => subscribe({
    request: makeRequest({ email: 'Reader@Example.com', consent: true, 'cf-turnstile-response': 'valid-token' }),
    env: { DB: db, SESSIONS: makeKv(), TURNSTILE_SECRET_KEY: 'preview-secret' }
  }));

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(siteverifyCalls, 1);
  assert.equal(db.writes.length, 1);

  const insert = db.writes[0];
  assert.match(insert.sql, /INSERT OR IGNORE INTO newsletter_subscribers/);
  assert.match(insert.sql, /unsubscribe_token/);
  assert.match(insert.sql, /consent_at/);
  assert.match(insert.sql, /subscribed_at/);
  assert.match(insert.sql, /status/);
  assert.equal(insert.values[0], 'reader@example.com');
  assert.ok(insert.values[1], 'unsubscribe token should be stored');
  assert.ok(Number.isFinite(Date.parse(insert.values[2])), 'consent timestamp should be ISO date data');
  assert.equal(insert.values[3], 'active');
  assert.ok(Number.isFinite(Date.parse(insert.values[4])), 'subscription timestamp should be ISO date data');
});
