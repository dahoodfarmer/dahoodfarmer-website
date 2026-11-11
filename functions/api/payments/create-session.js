import { checkRateLimit, getClientIP, isValidEmail, isValidPayload, sanitizeString } from '../../lib/validation.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const purposes = new Set(['support']);

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) return json({ error: 'Online payments are being prepared. Please check back soon.' }, 503);
  const ip = getClientIP(request);
  if (!await checkRateLimit(env.SESSIONS, ip, 'payment-create', 5, 60)) return json({ error: 'Too many payment attempts. Please wait and try again.' }, 429);

  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request.' }, 400);

  const amount = Number(data.amount);
  const purpose = sanitizeString(data.purpose, 24);
  const description = sanitizeString(data.description, 120);
  const email = sanitizeString(data.email, 254).toLowerCase();
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 1000000) return json({ error: 'Enter an amount between $1.00 and $10,000.00.' }, 422);
  if (!purposes.has(purpose)) return json({ error: 'Choose a valid payment type.' }, 422);
  if (email && !isValidEmail(email)) return json({ error: 'Enter a valid email address.' }, 422);
  if (!env.PAYMENTS_DB) return json({ error: 'Payment records are temporarily unavailable.' }, 503);

  const orderId = crypto.randomUUID();
  const params = new URLSearchParams();
  params.set('ui_mode', 'embedded');
  params.set('mode', 'payment');
  params.set('redirect_on_completion', 'if_required');
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) return json({ error: 'Cross-origin checkout request rejected.' }, 403);
  const allowedHost = requestUrl.hostname === 'dahoodfarmer.com' || requestUrl.hostname === 'www.dahoodfarmer.com' || requestUrl.hostname.endsWith('.dahoodfarmer-website.pages.dev');
  if (!allowedHost) return json({ error: 'This checkout domain is not authorized.' }, 400);
  params.set('return_url', requestUrl.origin + '/payment/complete?session_id={CHECKOUT_SESSION_ID}');
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(amount));
  params.set('line_items[0][price_data][product_data][name]', 'Da HoodFarmer — ' + (description || purposeLabel(purpose)));
  params.set('metadata[order_id]', orderId);
  params.set('metadata[purpose]', purpose);
  params.set('payment_intent_data[metadata][order_id]', orderId);
  params.set('payment_intent_data[metadata][purpose]', purpose);
  if (email) params.set('customer_email', email);

  let stripeResponse;
  try {
    stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': orderId },
      body: params.toString()
    });
  } catch {
    return json({ error: 'The payment service could not be reached. Please try again.' }, 502);
  }
  const session = await stripeResponse.json();
  if (!stripeResponse.ok || !session.client_secret) {
    console.error('Stripe Checkout session creation failed:', session.error?.type || 'unknown_error', session.error?.code || '');
    return json({ error: 'We could not start checkout. Please try again.' }, 502);
  }

  try {
    await env.PAYMENTS_DB.prepare(
      "INSERT INTO dhf_payment_orders (order_id, provider, provider_session_id, purpose, description, amount, currency, status, customer_email) VALUES (?, 'stripe', ?, ?, ?, ?, 'usd', 'pending', ?)"
    ).bind(orderId, session.id, purpose, description, amount, email).run();
  } catch (error) {
    console.error('Payment order persistence failed:', error?.message || String(error));
    // Expire the orphaned session so an unrecorded payment cannot be completed.
    try { await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(session.id) + '/expire', { method: 'POST', headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } }); } catch {}
    return json({ error: 'We could not save this order. No payment was taken; please try again.' }, 500);
  }

  return json({ clientSecret: session.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY, orderId });
}

function purposeLabel(purpose) {
  return ({ support: 'Support', product: 'Product purchase', service: 'Service payment', invoice: 'Invoice payment' })[purpose] || 'Payment';
}
