export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return new Response('Not configured', { status: 503 });
  const body = await request.text();
  try {
    const event = JSON.parse(body);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await env.DB.prepare('INSERT INTO orders (stripe_session_id, customer_email, amount, currency, status) VALUES (?,?,?,?,?)').bind(session.id, session.customer_email || '', session.amount_total || 0, session.currency || 'usd', 'paid').run();
    }
  } catch (e) { /* ignore parse errors */ }
  return new Response('OK', { status: 200 });
}
