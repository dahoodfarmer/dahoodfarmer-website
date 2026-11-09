import { validateBooking, getClientIP, isValidPayload, checkRateLimit } from '../lib/validation.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { insertBooking } from '../lib/db.js';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
export async function onRequestPost({ request, env }) {
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env.SESSIONS, ip, 'booking', 5, 60);
  if (!allowed) return json({ error: 'Too many requests. Please try again in a minute.' }, 429);
  let data; try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request body' }, 400);
  const turnstile = await verifyTurnstile(data['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, ip, env.EXPECTED_HOSTNAME || 'dahoodfarmer.com');
  if (!turnstile.success) return json({ error: turnstile.error }, 403);
  const validation = validateBooking(data);
  if (!validation.valid) return json({ error: validation.errors.join(', ') }, 422);
  try {
    await insertBooking(env.DB, { ...validation.sanitized, ip });
    return json({ success: true, message: 'Your booking request has been received. We will contact you to confirm details.' });
  } catch (err) {
    console.error('Booking D1 insert failed:', err?.stack || err?.message || String(err));
    return json({ error: 'Failed to save booking request' }, 500);
  }
}
