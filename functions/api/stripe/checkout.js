const CANONICAL_ORIGIN = 'https://dahoodfarmer.com';
const PRODUCT_CATALOG = {};
const ALLOWED_SUCCESS_PATH = '/shop?status=success';
const ALLOWED_CANCEL_PATH = '/shop?status=cancelled';
function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return jsonResponse({ error: 'Payment processing is not yet configured. The store is coming soon.' }, 503);
  if (Object.keys(PRODUCT_CATALOG).length === 0) return jsonResponse({ error: 'The store is not yet open. Products are coming soon.' }, 503);
  let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid request' }, 400); }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'Invalid request body' }, 400);
  const productId = String(body.productId || '').trim();
  const product = PRODUCT_CATALOG[productId];
  if (!product) return jsonResponse({ error: 'Invalid or unavailable product' }, 422);
  const email = String(body.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Invalid email address' }, 422);
  const successUrl = CANONICAL_ORIGIN + ALLOWED_SUCCESS_PATH;
  const cancelUrl = CANONICAL_ORIGIN + ALLOWED_CANCEL_PATH;
  try {
    const session = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'mode': 'payment', 'line_items[0][price]': product.priceId, 'line_items[0][quantity]': '1', 'success_url': successUrl, 'cancel_url': cancelUrl, 'customer_email': email }) });
    const result = await session.json();
    if (result.error) return jsonResponse({ error: 'Payment session could not be created' }, 400);
    await env.DB.prepare('INSERT INTO orders (stripe_session_id, product_id, customer_email, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)').bind(result.id, productId, email, product.amount, 'usd', 'pending').run();
    return jsonResponse({ success: true, url: result.url, sessionId: result.id });
  } catch (err) { return jsonResponse({ error: 'Payment processing failed' }, 500); }
}
