export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe not configured' }, 503);
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'mode': 'payment',
      'success_url': 'https://dahoodfarmer.com/store?success=1',
      'cancel_url': 'https://dahoodfarmer.com/store?canceled=1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round((data.amount || 0) * 100)),
      'line_items[0][price_data][product_data][name]': data.product_name || 'Da HoodFarmer Product',
      'line_items[0][quantity]': '1',
    }),
  });
  const session = await res.json();
  return json({ url: session.url });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
