const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApexConversationId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// Records only the conversion event and anonymous conversation UUID.
// Never stores the form payload, name, email, or message in APEX analytics.
export async function recordApexLead(env, conversationId, targetPath) {
  if (!env.APEX_DB || !isApexConversationId(conversationId)) return false;
  if (!['/contact', '/booking'].includes(targetPath)) return false;
  try {
    await env.APEX_DB.prepare(
      'INSERT INTO apex_events (id, conversation_id, event_type, target_path, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), conversationId, 'lead_submit', targetPath, 'ok').run();
    return true;
  } catch (error) {
    console.error('APEX lead attribution write failed:', error?.message || 'unknown');
    return false;
  }
}
