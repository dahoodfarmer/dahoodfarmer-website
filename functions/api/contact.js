import { validateContact, sanitize } from '../lib/validation.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { insertContact } from '../lib/db.js';

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const errors = validateContact(data);
  if (errors.length) return json({ error: errors.join(', ') }, 400);
  const turnstile = await verifyTurnstile(data['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!turnstile.success) return json({ error: turnstile.error }, 403);
  await insertContact(env.DB, {
    name: sanitize(data.name, 100), email: sanitize(data.email, 254),
    subject: sanitize(data.subject, 200), message: sanitize(data.message, 5000),
    ip: request.headers.get('CF-Connecting-IP'),
  });
  return json({ success: true, message: 'Thank you for reaching out!' });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
