import { getApexRateLimitSalt, enforceApexTelemetryLimit } from '../../lib/apex-analytics.js';
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: HEADERS }); }
export async function onRequestPost({ request, env }) {
  if (env.APEX_ENABLED !== 'true') return json({ error: 'APEX is not enabled.' }, 404);
  try { if (!request.headers.get('Origin') || new URL(request.headers.get('Origin')).origin !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403); }
  catch { return json({ error: 'Invalid origin.' }, 403); }
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({ error: 'JSON is required.' }, 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 2000) return json({ error: 'Event payload is too large.' }, 413);
  if (!env.APEX_DB) return json({ ok: true, recorded: false });
  const salt = await getApexRateLimitSalt(env);
  if (!env.SESSIONS || !salt) return json({ error: 'Telemetry is not configured.' }, 503);
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: 'Event payload is too large.' }, 413);
    data = JSON.parse(raw);
  } catch { return json({ error: 'Invalid request.' }, 400); }
  const allowed = ['widget_open', 'cta_click'];
  if (!allowed.includes(data.eventType)) return json({ error: 'Unsupported event.' }, 400);
  const conversationId = typeof data.conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(data.conversationId) ? data.conversationId : crypto.randomUUID();
  const targetPath = ['/booking', '/contact', '/shop'].includes(data.targetPath) ? data.targetPath : null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!await enforceApexTelemetryLimit(env, salt, ip, 'event', 60, 600)) return json({ error: 'Event limit reached.' }, 429);
  try {
    await env.APEX_DB.prepare('INSERT INTO apex_events (id, conversation_id, event_type, target_path, status) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), conversationId, data.eventType, targetPath, 'ok').run();
    return json({ ok: true, recorded: true });
  } catch (error) {
    console.error('APEX event write failed:', error?.message || 'unknown');
    return json({ ok: false, recorded: false }, 503);
  }
}
