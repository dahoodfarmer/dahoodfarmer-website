const PROVIDERS = new Set(['none', 'stripe', 'flo', 'manual']);
const METHODS = new Set(['apple_pay', 'card', 'ach', 'bank_transfer']);
function parseMethods(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(item => METHODS.has(item)))];
}
export function getPaymentProviderConfig(env = {}) {
  const requested = typeof env.DHF_PAYMENT_PROVIDER === 'string' ? env.DHF_PAYMENT_PROVIDER.trim().toLowerCase() : 'none';
  const provider = PROVIDERS.has(requested) ? requested : 'none';
  const methods = parseMethods(env.DHF_PAYMENT_METHODS);
  const configured = provider !== 'none' && env.DHF_PAYMENTS_ENABLED === 'true';
  return Object.freeze({
    provider,
    methods: configured ? methods : [],
    paymentsEnabled: configured,
    invoicingEnabled: configured && env.DHF_INVOICING_ENABLED === 'true',
    checkoutEnabled: configured && env.DHF_CHECKOUT_ENABLED === 'true'
  });
}
export function resolvePaymentProvider(env = {}, adapters = {}) {
  const config = getPaymentProviderConfig(env);
  if (!config.paymentsEnabled) return null;
  const adapter = adapters[config.provider];
  if (!adapter) return null;
  if (!['createInvoice', 'retrieveInvoice', 'verifyWebhook'].every(method => typeof adapter[method] === 'function')) return null;
  return adapter;
}
export function isAllowedPaymentMethod(method) { return METHODS.has(method); }

async function stripeRequest(path, env, method = 'GET', params = null, idempotencyKey = '') {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe secret is not configured.');
  const headers = { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY };
  const init = { method, headers };
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = params.toString();
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch('https://api.stripe.com/v1/' + path, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Payment provider request failed.');
  return result;
}

async function verifyStripeWebhook(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(part => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp + '.' + payload));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some(signature => constantTimeEqual(signature, expected));
}
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createStripeInvoiceAdapter(env = {}) {
  return Object.freeze({
    createInvoice({ params, idempotencyKey }) {
      return stripeRequest('invoices', env, 'POST', params, idempotencyKey || '');
    },
    retrieveInvoice(invoiceId) {
      if (typeof invoiceId !== 'string' || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) throw new Error('Invalid provider invoice ID.');
      return stripeRequest('invoices/' + encodeURIComponent(invoiceId), env);
    },
    verifyWebhook(payload, signature) {
      return verifyStripeWebhook(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    }
  });
}
