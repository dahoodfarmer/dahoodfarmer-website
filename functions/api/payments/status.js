import { reconcileInvoice } from '../../lib/invoices.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(sessionId)) return json({ error: 'Invalid payment reference.' }, 400);
  if (!env.STRIPE_SECRET_KEY || !env.PAYMENTS_DB) return json({ error: 'Payment status is unavailable.' }, 503);

  const order = await env.PAYMENTS_DB.prepare(
    'SELECT order_id, amount, currency, purpose, invoice_id, partnership_id, status FROM dhf_payment_orders WHERE provider_session_id = ?'
  ).bind(sessionId).first();
  if (!order) return json({ error: 'Payment reference not found.' }, 404);

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
      headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
    });
    if (response.ok) {
      const session = await response.json();
      const reconciles = session.metadata?.order_id === order.order_id &&
        Number(session.amount_total) === Number(order.amount) &&
        session.currency === order.currency &&
        (order.purpose !== 'invoice' || (session.metadata?.invoice_id === order.invoice_id && Number(session.metadata?.partnership_id) === Number(order.partnership_id)));
      if (!reconciles) return json({ error: 'Payment reference reconciliation failed.' }, 409);
      let status = order.status;
      if (session.payment_status === 'paid') status = 'paid';
      else if (session.status === 'expired' && status !== 'paid') status = 'expired';
      else if (session.status === 'complete' && status !== 'paid') status = 'processing';
      if (status !== order.status) {
        await env.PAYMENTS_DB.prepare("UPDATE dhf_payment_orders SET status = ?, updated_at = datetime('now') WHERE provider_session_id = ?").bind(status, sessionId).run();
      }
      if (order.purpose === 'invoice' && env.DB) {
        await reconcileInvoice(env.DB, order.invoice_id, order.partnership_id, order.order_id, status);
      }
      return json({ orderId: order.order_id, amount: order.amount, currency: order.currency, status });
    }
  } catch (error) {
    console.error('Payment status reconciliation failed:', error?.message || String(error));
  }
  return json({ orderId: order.order_id, amount: order.amount, currency: order.currency, status: order.status });
}
