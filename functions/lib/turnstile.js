// Cloudflare Turnstile token verification utility
// Verifies tokens server-side via the siteverify endpoint
// Validates response hostname, handles HTTP errors and malformed JSON

export function getExpectedTurnstileHostname(request) {
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

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

  if (expectedHostname && data.hostname && data.hostname !== expectedHostname) {
    return { success: false, error: 'Captcha token hostname mismatch' };
  }

  return { success: true, error: null };
}


// Send a server-side notification through Resend when configured.
// The form remains safely stored in D1 if email delivery is unavailable.
function escapeEmailHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
  });
}

export async function sendSubmissionNotification(env, subject, fields, replyTo) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;
  const to = env.NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) {
    return { sent: false, reason: 'Email notification is not configured' };
  }

  const rows = Object.keys(fields).map(function (key) {
    return '<tr><th align="left" style="padding:8px;border-bottom:1px solid #ddd;">' +
      escapeEmailHtml(key) + '</th><td style="padding:8px;border-bottom:1px solid #ddd;">' +
      escapeEmailHtml(fields[key]) + '</td></tr>';
  }).join('');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from,
        to: [to],
        reply_to: replyTo || undefined,
        subject: subject,
        html: '<div style="font-family:Arial,sans-serif"><h2>' + escapeEmailHtml(subject) +
          '</h2><table style="border-collapse:collapse;width:100%">' + rows + '</table></div>',
      }),
    });

    if (!response.ok) {
      return { sent: false, reason: 'Email provider rejected the notification (HTTP ' + response.status + ')' };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: 'Email provider could not be reached' };
  }
}
