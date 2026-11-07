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
    const debug = JSON.stringify({ success: data.success, errorCodes: data['error-codes'], hostname: data.hostname, action: data.action, cdata: data.cdata, challenge_ts: data.challenge_ts });
    const errorCodes = Array.isArray(data['error-codes']) && data['error-codes'].length > 0
      ? data['error-codes'].join(', ')
      : 'Captcha verification failed';
    return { success: false, error: errorCodes + ' [DEBUG: ' + debug + ']' };
  }

  if (expectedHostname && data.hostname && data.hostname !== expectedHostname) {
    return { success: false, error: 'Captcha token hostname mismatch' };
  }

  return { success: true, error: null };
}
