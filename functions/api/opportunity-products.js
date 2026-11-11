function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

const FUNNELS = new Set(['business', 'summits', 'marketplace', 'academy', 'sponsors']);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const funnel = (url.searchParams.get('funnel') || '').trim();
  if (funnel && !FUNNELS.has(funnel)) return json({ error: 'Invalid product category.' }, 400);

  try {
    const where = [
      "status = 'active'",
      "(available_from IS NULL OR available_from <= datetime('now'))",
      "(available_until IS NULL OR available_until >= datetime('now'))",
      "(inventory_limit IS NULL OR inventory_sold < inventory_limit)"
    ];
    const values = [];
    if (funnel) { where.push('funnel = ?'); values.push(funnel); }
    const result = await env.DB.prepare(
      'SELECT product_id, slug, funnel, product_type, name, description, price_cents, currency, max_quantity, inventory_limit, inventory_sold ' +
      'FROM opportunity_products WHERE ' + where.join(' AND ') + ' ORDER BY sort_order ASC, name ASC'
    ).bind(...values).all();
    return json({ products: result.results || [], total: (result.results || []).length });
  } catch (error) {
    console.error('Opportunity product catalog query failed:', error?.stack || error?.message || String(error));
    return json({ error: 'The product catalog is temporarily unavailable.' }, 500);
  }
}
