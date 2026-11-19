const PROVIDERS = new Set(['none', 'manual']);
const METHODS = new Set(['bank_transfer']);
function parseMethods(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(item => METHODS.has(item)))];
}
export function getPaymentProviderConfig(env = {}) {
  const requested = typeof env.DHF_PAYMENT_PROVIDER === 'string' ? env.DHF_PAYMENT_PROVIDER.trim().toLowerCase() : 'none';
  const provider = PROVIDERS.has(requested) ? requested : 'none';
  const methods = parseMethods(env.DHF_PAYMENT_METHODS);
  const configured = provider === 'manual' && env.DHF_PAYMENTS_ENABLED === 'true';
  return Object.freeze({
    provider,
    methods: configured ? methods : [],
    paymentsEnabled: configured,
    invoicingEnabled: false,
    checkoutEnabled: false
  });
}
export function isAllowedPaymentMethod(method) { return METHODS.has(method); }
