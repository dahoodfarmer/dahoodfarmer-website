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
