const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(sessionId)) return json({ error: 'Invalid payment reference.' }, 400);
  if (!env.STRIPE_SECRET_KEY || !env.DB) return json({ error: 'Payment status is unavailable.' }, 503);

  const order = await env.DB.prepare(
    'SELECT order_id, amount, currency, status FROM dhf_payment_orders WHERE provider_session_id = ?'
  ).bind(sessionId).first();
  if (!order) return json({ error: 'Payment reference not found.' }, 404);

  // Webhooks are authoritative. Retrieve the session as a reconciliation fallback.
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
      headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
    });
    if (response.ok) {
      const session = await response.json();
      let status = order.status;
      if (session.payment_status === 'paid') status = 'paid';
      else if (session.status === 'expired') status = 'expired';
      if (status !== order.status) {
        await env.DB.prepare("UPDATE dhf_payment_orders SET status = ?, updated_at = datetime('now') WHERE provider_session_id = ?").bind(status, sessionId).run();
      }
      return json({ orderId: order.order_id, amount: order.amount, currency: order.currency, status });
    }
  } catch (error) {
    console.error('Payment status reconciliation failed:', error?.message || String(error));
  }
  return json({ orderId: order.order_id, amount: order.amount, currency: order.currency, status: order.status });
}
