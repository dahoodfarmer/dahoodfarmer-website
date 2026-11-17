const DESTINATIONS = [
  { id: 'paypal', label: 'PayPal', env: 'DHF_PAYPAL_PAYMENT_URL', hosts: new Set(['paypal.com', 'www.paypal.com', 'paypal.me']) },
  { id: 'venmo', label: 'Venmo', env: 'DHF_VENMO_PAYMENT_URL', hosts: new Set(['venmo.com', 'www.venmo.com']) },
  { id: 'cash_app', label: 'Cash App Business', env: 'DHF_CASH_APP_BUSINESS_URL', hosts: new Set(['cash.app']) }
];

function safeDestinationUrl(value, hosts) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !hosts.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== '443')) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function getConfiguredPaymentDestinations(env = {}) {
  return DESTINATIONS.flatMap(destination => {
    const url = safeDestinationUrl(env[destination.env], destination.hosts);
    return url ? [{ id: destination.id, label: destination.label, url }] : [];
  });
}
