import { getApexRateLimitSalt, enforceApexTelemetryLimit } from '../../lib/apex-analytics.js';
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: HEADERS }); }
export async function onRequestPost({ request, env }) {
  if (env.APEX_ENABLED !== 'true') return json({ error: 'APEX is not enabled.' }, 404);
  const origin = request.headers.get('Origin');
  try { if (!origin || new URL(origin).origin !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403); }
  catch { return json({ error: 'Invalid origin.' }, 403); }
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({ error: 'JSON is required.' }, 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 2000) return json({ error: 'Feedback payload is too large.' }, 413);
  if (!env.APEX_DB) return json({ ok: true, recorded: false });
  const salt = await getApexRateLimitSalt(env);
  if (!env.SESSIONS || !salt) return json({ error: 'Feedback is temporarily unavailable.' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!await enforceApexTelemetryLimit(env, salt, ip, 'feedback', 30, 86400)) return json({ error: 'Feedback limit reached.' }, 429);
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: 'Feedback payload is too large.' }, 413);
    data = JSON.parse(raw);
  } catch { return json({ error: 'Invalid request.' }, 400); }
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
