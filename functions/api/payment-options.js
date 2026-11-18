export async function onRequestGet() {
  return new Response(JSON.stringify({
    methods: [],
    payment_status: 'disabled',
    payment_model: 'direct_bank_transfer_pending_owner_setup',
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
