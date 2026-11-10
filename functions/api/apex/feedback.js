const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: HEADERS }); }
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  try { if (!origin || new URL(origin).origin !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403); }
  catch { return json({ error: 'Invalid origin.' }, 403); }
  if (!env.APEX_DB) return json({ ok: true, recorded: false });
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const conversationId = typeof data.conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(data.conversationId) ? data.conversationId : null;
  const rating = data.rating === 'helpful' || data.rating === 'not_helpful' ? data.rating : null;
  const category = ['accuracy', 'relevance', 'clarity', 'other'].includes(data.category) ? data.category : null;
  if (!conversationId || !rating) return json({ error: 'Feedback could not be validated.' }, 400);
  try {
    await env.APEX_DB.prepare('INSERT INTO apex_feedback (id, conversation_id, rating, category) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), conversationId, rating, category).run();
    return json({ ok: true, recorded: true });
  } catch (error) {
    console.error('APEX feedback write failed:', error?.message || 'unknown');
    return json({ ok: false, recorded: false }, 503);
  }
}
