import { getConfiguredPaymentDestinations } from '../lib/payment-destinations.js';

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    methods: getConfiguredPaymentDestinations(env),
    payment_status: 'external_destinations_only',
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
