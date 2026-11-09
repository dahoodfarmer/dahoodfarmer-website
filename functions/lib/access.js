// Validate Cloudflare Access JWTs for privileged admin routes.
// This middleware fails closed until the Access application and its audience
// are configured in the Pages environment.

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonSegment(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function requireAdminAccess(request, env) {
  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN || '').trim().replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
  const audience = String(env.CF_ACCESS_AUD || '').trim();
  const allowedEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!teamDomain || !audience || !allowedEmail) {
    return jsonError('Admin access is not configured. Contact the site administrator.', 503);
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return jsonError('Authentication required.', 401);

  const parts = token.split('.');
  if (parts.length !== 3) return jsonError('Invalid authentication token.', 403);

  try {
    const header = decodeJsonSegment(parts[0]);
    const claims = decodeJsonSegment(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return jsonError('Invalid authentication token.', 403);

    const issuer = 'https://' + teamDomain;
    if (claims.iss !== issuer) return jsonError('Invalid authentication issuer.', 403);

    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= now) return jsonError('Authentication expired.', 403);
    if (typeof claims.nbf === 'number' && claims.nbf > now + 60) return jsonError('Authentication is not yet valid.', 403);

    const tokenAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!tokenAudiences.includes(audience)) return jsonError('Not authorized for this application.', 403);
    if (String(claims.email || '').toLowerCase() !== allowedEmail) return jsonError('Not authorized for this account.', 403);

    const certResponse = await fetch(issuer + '/cdn-cgi/access/certs', {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!certResponse.ok) throw new Error('Unable to retrieve Access signing keys');
    const certs = await certResponse.json();
    const jwk = (certs.keys || []).find((key) => key.kid === header.kid);
    if (!jwk) return jsonError('Unknown authentication signing key.', 403);

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(parts[0] + '.' + parts[1])
    );
    if (!valid) return jsonError('Invalid authentication signature.', 403);

    return null;
  } catch (error) {
    console.error('Admin Access verification unavailable:', error?.message || String(error));
    return jsonError('Admin authentication is temporarily unavailable.', 503);
  }
}
