export async function onRequestGet({ request, env }) {
  const u = new URL(request.url); const p = Math.max(1, parseInt(u.searchParams.get('page')||'1',10)||1); const l = Math.min(Math.max(1, parseInt(u.searchParams.get('limit')||'100',10)||100),200); const o = (p-1)*l;
  try { const r = await env.DB.prepare('SELECT id,email,status,consent_at,subscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT ? OFFSET ?').bind(l,o).all(); const c = await env.DB.prepare("SELECT COUNT(*) as total FROM newsletter_subscribers WHERE status='active'").first();
  return new Response(JSON.stringify({ subscribers: r.results||[], total: c?.total||0, page: p, limit: l }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' } }); }
  catch (e) { return new Response(JSON.stringify({ error: 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
}
