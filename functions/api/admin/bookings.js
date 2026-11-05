export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;
  const results = await env.DB.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
  return new Response(JSON.stringify({ bookings: results.results || [] }), { headers: { 'Content-Type': 'application/json' } });
}
