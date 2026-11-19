// Cloudflare Turnstile token verification utility
// Verifies tokens server-side via the siteverify endpoint
// Validates response hostname, handles HTTP errors and malformed JSON

export async function verifyTurnstile(token, secret, remoteip, expectedHostname) {
  if (!token) {
    return { success: false, error: 'Missing captcha token' };
  }
  if (!secret) {
    return { success: false, error: 'Turnstile secret key is not configured. Set TURNSTILE_SECRET_KEY in Pages environment variables.' };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);

  let res;
  try {
    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (e) {
    return { success: false, error: 'Captcha service unreachable' };
  }

  if (!res.ok) {
    return { success: false, error: `Captcha verification service returned HTTP ${res.status}` };
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    return { success: false, error: 'Captcha service returned malformed response' };
  }

  if (!data.success) {
    console.error('Turnstile verification failed:', JSON.stringify({ success: data.success, errorCodes: data['error-codes'], hostname: data.hostname, challenge_ts: data.challenge_ts }));
    return { success: false, error: 'Security verification failed. Please refresh the page and try again.' };
  }

  if (expectedHostname && data.hostname !== expectedHostname) {
    return { success: false, error: 'Captcha token hostname mismatch' };
  }

  return { success: true, error: null };
}


// Send a notification through the private Cloudflare Email Service Worker.
// The form record is saved before this is called; email failure must not discard it.
export async function sendSubmissionNotification(env, type, fields, replyTo) {
  if (!env.EMAIL_NOTIFIER) {
    return { sent: false, reason: 'Private email notification service is not configured' };
  }

  try {
    const response = await env.EMAIL_NOTIFIER.fetch('https://email-notifier.internal/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, fields, replyTo: replyTo || undefined }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      return { sent: false, reason: 'Email notification service returned an invalid response' };
    }

    if (!response.ok || !result.sent) {
      return { sent: false, reason: 'Email notification service could not deliver the message' };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: 'Private email notification service is unavailable' };
  }
}
