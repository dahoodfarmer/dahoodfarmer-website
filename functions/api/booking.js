import { validateBooking, getClientIP, isValidPayload, checkRateLimit } from '../lib/validation.js';
import { verifyTurnstile, sendSubmissionNotification } from '../lib/turnstile.js';
import { insertBooking } from '../lib/db.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env.SESSIONS, ip, 'booking', 5, 60);
  if (!allowed) return json({ error: 'Too many requests. Please try again in a minute.' }, 429);

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!isValidPayload(data)) return json({ error: 'Invalid request body' }, 400);

  const turnstile = await verifyTurnstile(
    data['cf-turnstile-response'],
    env.TURNSTILE_SECRET_KEY,
    ip,
    env.EXPECTED_HOSTNAME || 'dahoodfarmer.com'
  );
  if (!turnstile.success) return json({ error: turnstile.error }, 403);

  const validation = validateBooking(data);
  if (!validation.valid) return json({ error: validation.errors.join(', ') }, 422);

  try {
    await insertBooking(env.DB, { ...validation.sanitized, ip });

    // Email is best-effort and must never undo or misreport a successful D1 save.
    const notification = sendSubmissionNotification(
      env,
      'New Da HoodFarmer booking request',
      validation.sanitized,
      validation.sanitized.email
    ).then((result) => {
      if (!result.sent) console.warn('Booking notification not sent:', result.reason || 'Unknown reason');
      return result;
    }).catch((error) => {
      console.error('Booking notification scheduling failed:', error?.stack || error?.message || String(error));
      return { sent: false };
    });

    if (typeof context.waitUntil === 'function') context.waitUntil(notification);
    else await notification;

    return json({ success: true, message: 'Your booking request has been received. We will contact you to confirm details.' });
  } catch (err) {
    console.error('Booking submission save failed:', err);
    return json({ error: 'Failed to save booking request' }, 500);
  }
}
