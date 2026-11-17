const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

export async function onRequestGet({ env }) {
  const key = env.STRIPE_SECRET_KEY || '';
  if (env.DHF_STRIPE_EXPECT_LIVEMODE === 'true' || !/^(?:sk|rk)_test_/.test(key)) {
    return json({ configured: false, mode: 'test', error: 'A Stripe test-mode key is required for this read-only check.' }, 503);
  }
  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }
    });
    if (!response.ok) {
      return json({ configured: true, authenticated: false, mode: 'test', error: 'Stripe test-mode authentication could not be verified. Check the key and its read permissions.' }, 502);
    }
    const account = await response.json();
    return json({
      configured: true,
      authenticated: true,
      mode: 'test',
      account_country: account.country || null,
      default_currency: account.default_currency || null,
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      webhook_secret_present: Boolean(env.STRIPE_WEBHOOK_SECRET)
    });
  } catch {
    return json({ configured: true, authenticated: false, mode: 'test', error: 'Stripe test-mode check could not reach the provider.' }, 502);
  }
}
