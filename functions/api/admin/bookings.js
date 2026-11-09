export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const p = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const l = Math.min(Math.max(1, parseInt(u.searchParams.get('limit') || '50', 10) || 50), 100);
  const o = (p - 1) * l;

  try {
    // The production bookings table does not have an ip_address column.
    // Do not select a field that is absent from the deployed schema.
    const r = await env.DB.prepare(
      'SELECT id,name,email,organization,inquiry_type,preferred_date,details,created_at,status FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(l, o).all();
    const c = await env.DB.prepare('SELECT COUNT(*) as total FROM bookings').first();

    return new Response(JSON.stringify({
      bookings: r.results || [],
      total: c?.total || 0,
      page: p,
      limit: l
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (e) {
    console.error('Admin bookings query failed:', e);
    return new Response(JSON.stringify({ error: 'Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
}
