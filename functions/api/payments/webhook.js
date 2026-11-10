const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(part => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
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

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.DB) return json({ error: 'Webhook is not configured.' }, 503);
  const raw = await request.text();
  const valid = await verifyStripeSignature(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ error: 'Invalid signature.' }, 400);

  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Invalid event.' }, 400); }
  const session = event.data?.object;
  if (!session?.id) return json({ received: true });

  const updates = {
    'checkout.session.completed': session.payment_status === 'paid' ? 'paid' : 'processing',
    'checkout.session.async_payment_succeeded': 'paid',
    'checkout.session.async_payment_failed': 'failed',
    'checkout.session.expired': 'expired'
  };
  const status = updates[event.type];
  if (!status) return json({ received: true });

  try {
    const order = await env.DB.prepare(
      'SELECT order_id, amount, currency FROM dhf_payment_orders WHERE provider_session_id = ?'
    ).bind(session.id).first();
    if (!order) return json({ error: 'Order not found.' }, 404);
    if (session.metadata?.order_id !== order.order_id || Number(session.amount_total) !== Number(order.amount) || session.currency !== order.currency) {
      console.error('Stripe webhook order reconciliation mismatch for session:', session.id);
      return json({ error: 'Order reconciliation failed.' }, 400);
    }

    // Record event IDs for audit/deduplication. Reapplying the same state update is safe.
    await env.DB.prepare(
      "INSERT OR IGNORE INTO dhf_payment_events (event_id, event_type) VALUES (?, ?)"
    ).bind(event.id, event.type).run();

    await env.DB.prepare(
      "UPDATE dhf_payment_orders SET status = ?, customer_email = CASE WHEN ? <> '' THEN ? ELSE customer_email END, updated_at = datetime('now') WHERE provider_session_id = ?"
    ).bind(status, session.customer_details?.email || '', session.customer_details?.email || '', session.id).run();
    return json({ received: true });
  } catch (error) {
    console.error('Stripe webhook database update failed:', error?.message || String(error));
    return json({ error: 'Temporary processing error.' }, 500);
  }
}
