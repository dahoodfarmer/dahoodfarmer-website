import { checkRateLimit, getClientIP, isValidEmail, isValidPayload, sanitizeString } from '../../lib/validation.js';
import { findInvoiceByToken, reconcileInvoice } from '../../lib/invoices.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const purposes = new Set(['support','invoice']);

function authorizedOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) return origin === url.origin;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).origin === url.origin; } catch { return false; }
}
function authorizedHost(hostname) {
  return hostname === 'dahoodfarmer.com' || hostname === 'www.dahoodfarmer.com' || hostname.endsWith('.dahoodfarmer-website.pages.dev');
}
async function stripeFetch(path, env, init = {}) {
  return fetch('https://api.stripe.com/v1/' + path, {
    ...init,
    headers: { 'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY, ...(init.headers || {}) }
  });
}
async function expireSession(sessionId, env) {
  try { await stripeFetch('checkout/sessions/' + encodeURIComponent(sessionId) + '/expire', env, { method: 'POST' }); } catch {}
}

export async function onRequestPost({ request, env }) {
  if (env.DHF_CHECKOUT_ENABLED !== 'true') return json({ error: 'Online payments are disabled in this environment.' }, 503);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) return json({ error: 'Online payments are being prepared. Please check back soon.' }, 503);
  if (!env.PAYMENTS_DB) return json({ error: 'Payment records are temporarily unavailable.' }, 503);
  if (!authorizedOrigin(request)) return json({ error: 'Cross-origin checkout request rejected.' }, 403);
  const requestUrl = new URL(request.url);
  if (!authorizedHost(requestUrl.hostname)) return json({ error: 'This checkout domain is not authorized.' }, 400);
  const ip = getClientIP(request);
  if (!await checkRateLimit(env.SESSIONS, ip, 'payment-create', 5, 60)) return json({ error: 'Too many payment attempts. Please wait and try again.' }, 429);

  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request.' }, 400);
  const purpose = sanitizeString(data.purpose, 24);
  if (!purposes.has(purpose)) return json({ error: 'Choose a valid payment type.' }, 422);

  let amount;
  let description;
  let email = '';
  let invoice = null;
  if (purpose === 'support') {
    amount = Number(data.amount);
    description = sanitizeString(data.description, 120);
    email = sanitizeString(data.email, 254).toLowerCase();
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 1000000) return json({ error: 'Enter an amount between $1.00 and $10,000.00.' }, 422);
    if (email && !isValidEmail(email)) return json({ error: 'Enter a valid email address.' }, 422);
  } else {
    const token = typeof data.invoice_token === 'string' ? data.invoice_token : '';
    if (!/^[a-f0-9]{64}$/i.test(token) || !env.DB) return json({ error: 'A valid invoice link is required.' }, 422);
    try { invoice = await findInvoiceByToken(env.DB, token); }
    catch (error) { console.error('Invoice checkout lookup failed:', error?.message || String(error)); return json({ error: 'Invoice details are unavailable.' }, 503); }
    if (!invoice) return json({ error: 'Invoice not found.' }, 404);
    if (invoice.status === 'paid') return json({ error: 'This invoice has already been paid.' }, 409);
    if (invoice.status === 'void' || invoice.status === 'expired') return json({ error: 'This invoice is no longer payable.' }, 410);
    if (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)) {
      await env.DB.prepare("UPDATE sponsor_invoices SET status = 'expired', updated_at = datetime('now') WHERE invoice_id = ? AND status IN ('issued','pending')").bind(invoice.invoice_id).run();
      return json({ error: 'This invoice has passed its due date. Please contact Da HoodFarmer.' }, 410);
    }
    amount = Number(invoice.amount_cents);
    description = sanitizeString(invoice.description, 160);
    email = sanitizeString(invoice.contact_email, 254).toLowerCase();
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) return json({ error: 'Invoice amount is invalid.' }, 409);

    const existing = await env.PAYMENTS_DB.prepare(
      "SELECT order_id, provider_session_id, status, amount, currency FROM dhf_payment_orders WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(invoice.invoice_id).first();
    if (existing) {
      if (existing.status === 'paid') return json({ error: 'This invoice has already been paid.' }, 409);
      if (existing.status === 'pending' || existing.status === 'processing') {
        try {
          const existingResponse = await stripeFetch('checkout/sessions/' + encodeURIComponent(existing.provider_session_id), env);
          if (existingResponse.ok) {
            const existingSession = await existingResponse.json();
            const reconciles = existingSession.metadata?.order_id === existing.order_id &&
              existingSession.metadata?.invoice_id === invoice.invoice_id &&
              Number(existingSession.amount_total) === Number(existing.amount) &&
              existingSession.currency === existing.currency;
            if (!reconciles) return json({ error: 'Existing payment attempt could not be reconciled.' }, 409);
            if (existingSession.payment_status === 'paid') {
              await env.PAYMENTS_DB.prepare("UPDATE dhf_payment_orders SET status = 'paid', updated_at = datetime('now') WHERE order_id = ?").bind(existing.order_id).run();
              await reconcileInvoice(env.DB, invoice.invoice_id, invoice.partnership_id, existing.order_id, 'paid');
              return json({ orderId: existing.order_id, status: 'paid' }, 409);
            }
            if (existingSession.status === 'open' && existingSession.client_secret) {
              return json({ clientSecret: existingSession.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY, orderId: existing.order_id });
            }
            if (existingSession.status === 'expired') {
              await env.PAYMENTS_DB.prepare("UPDATE dhf_payment_orders SET status = 'expired', updated_at = datetime('now') WHERE order_id = ?").bind(existing.order_id).run();
              await reconcileInvoice(env.DB, invoice.invoice_id, invoice.partnership_id, existing.order_id, 'expired');
            } else {
              return json({ error: 'A payment attempt is already processing. Refresh this invoice shortly.' }, 409);
            }
          }
        } catch (error) {
          console.error('Existing payment attempt lookup failed:', error?.message || String(error));
          return json({ error: 'An existing payment attempt is being checked. Please try again shortly.' }, 503);
        }
      }
    }
  }

  const orderId = crypto.randomUUID();
  const params = new URLSearchParams();
  params.set('ui_mode', 'embedded');
  params.set('mode', 'payment');
  params.set('redirect_on_completion', 'if_required');
  params.set('return_url', requestUrl.origin + '/payment/complete?session_id={CHECKOUT_SESSION_ID}');
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(amount));
  params.set('line_items[0][price_data][product_data][name]', 'Da HoodFarmer — ' + (description || (purpose === 'support' ? 'Support' : 'Sponsor invoice')));
  params.set('metadata[order_id]', orderId);
  params.set('metadata[purpose]', purpose);
  params.set('payment_intent_data[metadata][order_id]', orderId);
  params.set('payment_intent_data[metadata][purpose]', purpose);
  if (invoice) {
    params.set('metadata[invoice_id]', invoice.invoice_id);
    params.set('metadata[partnership_id]', String(invoice.partnership_id));
    params.set('payment_intent_data[metadata][invoice_id]', invoice.invoice_id);
    params.set('payment_intent_data[metadata][partnership_id]', String(invoice.partnership_id));
  }
  if (email && isValidEmail(email)) params.set('customer_email', email);

  let stripeResponse;
  try {
    stripeResponse = await stripeFetch('checkout/sessions', {
      ...env,
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY
    }, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': orderId }, body: params.toString() });
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
      "INSERT INTO dhf_payment_orders (order_id, provider, provider_session_id, purpose, description, amount, currency, status, customer_email, invoice_id, partnership_id) VALUES (?, 'stripe', ?, ?, ?, ?, 'usd', 'pending', ?, ?, ?)"
    ).bind(orderId, session.id, purpose, description, amount, email, invoice?.invoice_id || null, invoice?.partnership_id || null).run();
    if (invoice) {
      await env.DB.prepare(
        "UPDATE sponsor_invoices SET status = 'pending', payment_order_id = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status IN ('issued','pending')"
      ).bind(orderId, invoice.invoice_id).run();
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET payment_status = 'pending', payment_reference = ?, updated_at = datetime('now') WHERE id = ? AND payment_status <> 'paid'"
      ).bind(orderId, invoice.partnership_id).run();
    }
  } catch (error) {
    console.error('Payment order persistence failed:', error?.message || String(error));
    await expireSession(session.id, env);
    return json({ error: 'We could not save this order. No payment was taken; please try again.' }, 500);
  }

  return json({ clientSecret: session.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY, orderId });
}
