import { validateBooking, sanitize } from '../lib/validation.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { insertBooking } from '../lib/db.js';

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const errors = validateBooking(data);
  if (errors.length) return json({ error: errors.join(', ') }, 400);
  const turnstile = await verifyTurnstile(data['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!turnstile.success) return json({ error: turnstile.error }, 403);
  await insertBooking(env.DB, {
    name: sanitize(data.name, 100), email: sanitize(data.email, 254),
    organization: sanitize(data.organization, 200), inquiry_type: sanitize(data.inquiry_type, 50),
    preferred_date: sanitize(data.preferred_date, 50), details: sanitize(data.details, 5000),
    ip: request.headers.get('CF-Connecting-IP'),
  });
  return json({ success: true, message: 'Booking request received!' });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
