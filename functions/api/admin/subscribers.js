export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;
  const results = await env.DB.prepare('SELECT id, email, subscribed_at, status FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
  return new Response(JSON.stringify({ subscribers: results.results || [] }), { headers: { 'Content-Type': 'application/json' } });
}
