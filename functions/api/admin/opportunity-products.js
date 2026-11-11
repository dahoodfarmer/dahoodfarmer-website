const PRODUCT_STATUSES = new Set(['draft', 'active', 'inactive']);
const APPLICATION_TYPES = new Set(['', 'business_listing', 'vendor', 'sponsor', 'speaker', 'academy', 'property_partner', 'membership']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function sameOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) return origin === expected;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).origin === expected; } catch { return false; }
}

function checkoutEnabled(env) {
  return env.DHF_CHECKOUT_ENABLED === 'true' &&
    Boolean(env.PAYMENTS_DB) &&
    Boolean(env.STRIPE_SECRET_KEY) &&
    Boolean(env.STRIPE_PUBLISHABLE_KEY);
}

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      'SELECT product_id, slug, funnel, product_type, name, description, price_cents, currency, status, requires_approval, required_application_type, max_quantity, inventory_limit, inventory_sold, sort_order, available_from, available_until, created_at, updated_at FROM opportunity_products ORDER BY funnel ASC, sort_order ASC, name ASC'
    ).all();
    return json({ products: result.results || [], checkout_enabled: checkoutEnabled(env) });
  } catch (error) {
    console.error('Admin opportunity product query failed:', error?.stack || error?.message || String(error));
    return json({ error: 'The product catalog is temporarily unavailable.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid request.' }, 400);

  const productId = typeof data.product_id === 'string' ? data.product_id.trim() : '';
  const status = typeof data.status === 'string' ? data.status.trim() : '';
  const priceCents = Number(data.price_cents);
  if (!productId || productId.length > 100) return json({ error: 'Valid product ID is required.' }, 422);
  if (!PRODUCT_STATUSES.has(status)) return json({ error: 'Invalid product status.' }, 422);
  if (!Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 10000000) return json({ error: 'Price must be between $1.00 and $100,000.00.' }, 422);

  if (status === 'active' && !checkoutEnabled(env)) {
    return json({ error: 'Checkout is not enabled. Products must remain drafts until the payment engine, test credentials and payment database are ready.' }, 409);
  }

  const requiresApproval = data.requires_approval === true || data.requires_approval === 1 || data.requires_approval === '1';
  const requiredApplicationType = typeof data.required_application_type === 'string' ? data.required_application_type.trim() : '';
  if (!APPLICATION_TYPES.has(requiredApplicationType)) return json({ error: 'Invalid required application type.' }, 422);
  if (requiresApproval && !requiredApplicationType) return json({ error: 'An application type is required for approval-gated products.' }, 422);

  try {
    const product = await env.DB.prepare('SELECT product_id FROM opportunity_products WHERE product_id = ?').bind(productId).first();
    if (!product) return json({ error: 'Product not found.' }, 404);

    await env.DB.prepare(
      'UPDATE opportunity_products SET status = ?, price_cents = ?, requires_approval = ?, required_application_type = ?, updated_at = datetime(\'now\') WHERE product_id = ?'
    ).bind(status, priceCents, requiresApproval ? 1 : 0, requiredApplicationType, productId).run();

    return json({ success: true, product_id: productId, status, price_cents: priceCents, checkout_enabled: checkoutEnabled(env) });
  } catch (error) {
    console.error('Admin opportunity product update failed:', error?.stack || error?.message || String(error));
    return json({ error: 'Product update failed.' }, 500);
  }
}
