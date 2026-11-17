import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as showUnsubscribeConfirmation } from '../functions/api/unsubscribe.js';

test('unsubscribe confirmation keeps its own POST handler instead of newsletter signup', async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /SELECT id, unsubscribe_token FROM newsletter_subscribers/);
      return {
        bind(email, status) {
          assert.equal(email, 'reader@example.com');
          assert.equal(status, 'active');
          return {
            async first() {
              return { id: 1, unsubscribe_token: 'test-unsubscribe-token' };
            }
          };
        }
      };
    }
  };

  const request = new Request(
    'https://preview.example/api/unsubscribe?email=reader%40example.com&token=test-unsubscribe-token'
  );
  const response = await showUnsubscribeConfirmation({ request, env: { DB: db } });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /data-newsletter="false"/);
  assert.match(html, /action="\/api\/unsubscribe"/);
  assert.match(html, /name="token"/);
  assert.match(html, /Confirm Unsubscribe/);
});
