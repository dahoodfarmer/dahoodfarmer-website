import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('permanent Payment Center QR uses a local QR library and stable /pay destination', async () => {
  const page = await readFile(new URL('../public/payment-center.html', import.meta.url), 'utf8');
  const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
  const library = await readFile(new URL('../public/js/qrcode.min.js', import.meta.url), 'utf8');
  const license = await readFile(new URL('../public/js/QRCODE-LICENSE.txt', import.meta.url), 'utf8');
  assert.match(page, /id="payment-center-qr"/);
  assert.match(page, /src="\/assets\/dhf-carter-columbia-logo\.webp"/);
  assert.match(page, /window\.location\.origin\+'\/pay'/);
  assert.match(page, /download-payment-center-qr/);
  assert.match(page, /Direct Bank Transfer/);
  assert.match(page, /Setup pending/);
  assert.match(page, /external-payment-options/);
  assert.match(page, /dhf-payment-options\.js/);
  assert.match(page, /src="\/js\/qrcode\.min\.js"/);
  assert.match(redirects, /^\/pay \/payment-center 301/m);
  assert.ok(library.length > 10000);
  assert.match(license, /MIT License/);
});

test('invoice page generates its own QR from the opaque invoice URL', async () => {
  const page = await readFile(new URL('../functions/invoice/[token].js', import.meta.url), 'utf8');
  assert.match(page, /id="invoice-qr"/);
  assert.match(page, /text:window\.location\.href/);
  assert.match(page, /download-invoice-qr/);
  assert.match(page, /external-payment-options/);
  assert.match(page, /dhf-payment-options\.js/);
  assert.match(page, /\/js\/qrcode\.min\.js/);
});
