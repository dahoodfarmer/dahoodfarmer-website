import { isValidEmail, sanitizeString, getClientIP, isValidPayload, checkRateLimit } from '../lib/validation.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { insertSubscriber } from '../lib/db.js';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
export async function onRequestPost({ request, env }) {
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env.SESSIONS, ip, 'newsletter', 3, 60);
  if (!allowed) return json({ error: 'Too many requests. Please try again in a minute.' }, 429);
  let data; try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request body' }, 400);
  const consentValue = data.consent;
  const hasConsent = consentValue === true || consentValue === 'true' || consentValue === 'on' || consentValue === 'yes' || consentValue === 1;
  if (!hasConsent) return json({ error: 'Explicit consent is required to subscribe. Please check the consent box.' }, 422);
  const turnstile = await verifyTurnstile(data['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, ip, new URL(request.url).hostname);
  if (!turnstile.success) return json({ error: turnstile.error }, 403);
  const email = sanitizeString(data.email, 254).toLowerCase();
  if (!email || !isValidEmail(email)) return json({ error: 'Valid email is required' }, 422);
  try { const result = await insertSubscriber(env.DB, email); return json({ success: true, message: result.action === 'reactivated' ? 'Welcome back! Your subscription has been reactivated.' : 'Successfully subscribed! You can unsubscribe at any time.' }); }
  catch (err) { return json({ error: 'Failed to subscribe' }, 500); }
}
