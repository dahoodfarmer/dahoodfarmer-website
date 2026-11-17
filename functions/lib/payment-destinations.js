const DESTINATIONS = [
  { id: 'square', label: 'Square', env: 'DHF_SQUARE_PAYMENT_URL', hosts: new Set(['square.link', 'checkout.square.site']) }
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
