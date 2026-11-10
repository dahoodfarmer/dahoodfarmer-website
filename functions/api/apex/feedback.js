const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: HEADERS }); }
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  try { if (!origin || new URL(origin).origin !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403); }
  catch { return json({ error: 'Invalid origin.' }, 403); }
  if (!env.APEX_DB) return json({ ok: true, recorded: false });
  if (!env.SESSIONS || !env.APEX_RATE_LIMIT_SALT) return json({ error: 'Feedback is temporarily unavailable.' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.APEX_RATE_LIMIT_SALT + ':' + ip));
  const ipHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const rateKey = 'apex:feedback:' + ipHash;
  let rate = null;
  try { rate = await env.SESSIONS.get(rateKey, 'json'); } catch {}
  if (rate && rate.count >= 30) return json({ error: 'Feedback limit reached.' }, 429);
  await env.SESSIONS.put(rateKey, JSON.stringify({ count: (rate?.count || 0) + 1 }), { expirationTtl: 86400 });
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
