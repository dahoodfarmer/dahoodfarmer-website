import { validateBooking, getClientIP, isValidPayload, checkRateLimit } from '../lib/validation.js';
import { verifyTurnstile, sendSubmissionNotification } from '../lib/turnstile.js';
import { insertBooking } from '../lib/db.js';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
export async function onRequestPost({ request, env }) {
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env.SESSIONS, ip, 'booking', 5, 60);
  if (!allowed) return json({ error: 'Too many requests. Please try again in a minute.' }, 429);
  let data; try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request body' }, 400);
  const turnstile = await verifyTurnstile(data['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, ip, new URL(request.url).hostname);
  if (!turnstile.success) return json({ error: turnstile.error }, 403);
  const validation = validateBooking(data);
  if (!validation.valid) return json({ error: validation.errors.join(', ') }, 422);
  try {\n    await insertBooking(env.DB, { ...validation.sanitized, ip });\n    const email = await sendSubmissionNotification(env, 'New Da HoodFarmer booking request', {\n      Name: validation.sanitized.name, Email: validation.sanitized.email,\n      Organization: validation.sanitized.organization, Type: validation.sanitized.inquiry_type,\n      'Preferred date': validation.sanitized.preferred_date, Details: validation.sanitized.details,\n    }, validation.sanitized.email);\n    return json({ success: true, emailSent: email.sent, message: email.sent ? 'Your booking request has been received. We will contact you to confirm details.' : 'Your booking request was received and saved. Email notification is not yet available.' });\n  }
  catch (err) { return json({ error: 'Failed to save booking request' }, 500); }
}
