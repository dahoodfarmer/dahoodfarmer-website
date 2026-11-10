const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_CONTEXT = 'DHF_APEX_ATTRIBUTION_V1:';

export function isApexConversationId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(value)) return null;
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function attributionKey(env) {
  if (!env.APEX_RATE_LIMIT_SALT || String(env.APEX_RATE_LIMIT_SALT).length < 32) return null;
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.APEX_RATE_LIMIT_SALT),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createApexAttributionToken(env, conversationId) {
  if (!isApexConversationId(conversationId)) return null;
  try {
    const key = await attributionKey(env);
    if (!key) return null;
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(TOKEN_CONTEXT + conversationId));
    return conversationId + '.' + encodeBase64Url(signature);
  } catch {
    return null;
  }
}

export async function verifyApexAttributionToken(env, token) {
  if (typeof token !== 'string' || token.length > 160) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !isApexConversationId(parts[0])) return null;
    const signature = decodeBase64Url(parts[1]);
    const key = await attributionKey(env);
    if (!signature || !key) return null;
    const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(TOKEN_CONTEXT + parts[0]));
    return valid ? parts[0] : null;
  } catch {
    return null;
  }
}

// Records only the conversion event and signed anonymous conversation reference.
// Never stores the form payload, name, email, or message in APEX analytics.
export async function recordApexLead(env, attributionToken, targetPath) {
  if (!env.APEX_DB || !['/contact', '/booking'].includes(targetPath)) return false;
  try {
    const conversationId = await verifyApexAttributionToken(env, attributionToken);
    if (!conversationId) return false;
    await env.APEX_DB.prepare(
      'INSERT INTO apex_events (id, conversation_id, event_type, target_path, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), conversationId, 'lead_submit', targetPath, 'ok').run();
    return true;
  } catch (error) {
    console.error('APEX lead attribution write failed:', error?.message || 'unknown');
    return false;
  }
}
