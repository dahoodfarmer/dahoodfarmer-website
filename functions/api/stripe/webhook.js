async function verifySig(payload, sig, secret) {
  if (!secret) return { valid: false, error: 'Webhook secret not configured' };
  if (!sig) return { valid: false, error: 'Missing signature header' };
  const parts = {}; sig.split(',').forEach(p => { const [k,v] = p.split('='); parts[k] = v; });
  if (!parts.t || !parts.v1) return { valid: false, error: 'Invalid signature format' };
  const ts = parseInt(parts.t, 10); if (isNaN(ts)) return { valid: false, error: 'Bad timestamp' };
  if (Math.abs(Math.floor(Date.now()/1000) - ts) > 300) return { valid: false, error: 'Timestamp outside tolerance' };
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const computed = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const hex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2,'0')).join('');
  if (hex.length !== parts.v1.length) return { valid: false, error: 'Signature mismatch' };
  let match = true; for (let i = 0; i < hex.length; i++) { if (hex[i] !== parts.v1[i]) match = false; }
  return match ? { valid: true } : { valid: false, error: 'Signature verification failed' };
}
function json(data, s = 200) { return new Response(JSON.stringify(data), { status: s, headers: { 'Content-Type': 'application/json' } }); }
function validateEvent(e) { return e && typeof e === 'object' && typeof e.id === 'string' && typeof e.type === 'string' && e.data && typeof e.data.object === 'object'; }
export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Not configured' }, 503);
  const payload = await request.text();
  const v = await verifySig(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!v.valid) return json({ error: v.error }, 400);
  let event; try { event = JSON.parse(payload); } catch { return json({ error: 'Invalid payload' }, 400); }
  if (!validateEvent(event)) return json({ error: 'Invalid event structure' }, 400);
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO processed_events (event_id, event_type, created_at) VALUES (?, ?, datetime('now'))").bind(event.id, event.type).run();
    const existing = await env.DB.prepare('SELECT created_at FROM processed_events WHERE event_id = ?').bind(event.id).first();
    if (!existing) return json({ error: 'Idempotency check failed' }, 500);
  } catch (e) { return json({ error: 'Idempotency tracking unavailable' }, 500); }
  const wasDup = await env.DB.prepare("SELECT created_at FROM processed_events WHERE event_id = ? AND created_at < datetime('now', '-1 second')").bind(event.id).first();
  if (wasDup) return json({ received: true, duplicate: true });
  try {
    if (event.type === 'checkout.session.completed') { const s = event.data.object; if (s.payment_status === 'paid') { await env.DB.prepare("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE stripe_session_id = ?").bind(s.id).run(); } else { await env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE stripe_session_id = ?").bind(s.payment_status || 'unpaid', s.id).run(); } }
    else if (event.type === 'checkout.session.expired') { const s = event.data.object; await env.DB.prepare("UPDATE orders SET status = 'expired', updated_at = datetime('now') WHERE stripe_session_id = ?").bind(s.id).run(); }
    else if (event.type === 'payment_intent.payment_failed') { const i = event.data.object; if (i.metadata && i.metadata.checkout_session_id) { await env.DB.prepare("UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE stripe_session_id = ?").bind(i.metadata.checkout_session_id).run(); } }
    return json({ received: true });
  } catch (err) { return json({ error: 'Webhook processing failed' }, 500); }
}
