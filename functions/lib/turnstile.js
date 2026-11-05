export async function verifyTurnstile(token, secret, remoteip) {
  if (!token) return { success: false, error: 'Missing captcha token' };
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return { success: data.success, error: data.success ? null : 'Captcha verification failed' };
  } catch (e) {
    return { success: false, error: 'Captcha service unavailable' };
  }
}
