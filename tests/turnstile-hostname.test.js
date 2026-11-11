import test from 'node:test';
import assert from 'node:assert/strict';
import { getExpectedTurnstileHostname } from '../functions/lib/turnstile.js';

test('derives the hostname from a Pages Preview request', () => {
  const request = new Request('https://feature-dhf-opportunity-network-build.dahoodfarmer-website.pages.dev/api/contact');
  assert.equal(getExpectedTurnstileHostname(request), 'feature-dhf-opportunity-network-build.dahoodfarmer-website.pages.dev');
});

test('derives the hostname from the production request without a hard-coded Preview alias', () => {
  const request = new Request('https://dahoodfarmer.com/api/contact');
  assert.equal(getExpectedTurnstileHostname(request), 'dahoodfarmer.com');
});
