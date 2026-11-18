import { getConfiguredPaymentDestinations } from '../lib/payment-destinations.js';

export async function onRequestGet({ env }) {
  const enabled = env.DHF_PAYMENTS_ENABLED === 'true'
    && env.DHF_SQUARE_PAYMENT_LINKS_ENABLED === 'true';
  return new Response(JSON.stringify({
    methods: enabled ? getConfiguredPaymentDestinations(env) : [],
    payment_status: enabled ? 'external_destinations_only' : 'disabled',
    automatic_confirmation: false
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}
