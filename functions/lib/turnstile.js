export async function verifyTurnstile(token, secret, remoteip) {
  if (typeof token !== 'string' || !token.trim()) return { success: false, error: 'Please complete the security check.' };
  if (typeof secret !== 'string' || !secret.trim()) return { success: false, error: 'Spam protection is temporarily unavailable.' };
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return { success: false, error: 'Spam protection service is temporarily unavailable.' };
    const data = await res.json();
    return { success: data?.success === true, error: data?.success === true ? null : 'Security check failed. Please refresh and try again.' };
  } catch {
    return { success: false, error: 'Spam protection service is temporarily unavailable.' };
  }
}
